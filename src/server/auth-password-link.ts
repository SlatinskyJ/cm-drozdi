import { randomUUID } from 'crypto';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '~/generated/prisma/client';

import { auth } from '~/server/auth';
import { env } from '~/env';
import { db } from '~/server/db';

const PREFIX = 'set-password:';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, passwordless user
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour, existing credential

/**
 * Matches every set-password token issued for a user, used or not. Exported so
 * `member.delete` can revoke them inside its own transaction.
 */
export function setPasswordTokensWhere(
	userId: string,
): Prisma.VerificationWhereInput {
	return { value: userId, identifier: { startsWith: PREFIX } };
}

/**
 * Delete every set-password token issued for a user, used or not. Called before
 * minting a new link.
 */
export async function revokeSetPasswordTokens(userId: string): Promise<void> {
	await db.verification.deleteMany({ where: setPasswordTokensWhere(userId) });
}

/**
 * Mint a one-time set/reset-password URL for a user. Auto-picks expiry by
 * credential presence: no credential → 7-day invite; has credential → 1-hour
 * reset. Returning the URL *is* the deliver seam (an email sender can later
 * send it instead). Server-side only (admin tRPC mutation + seed).
 *
 * Invalidates any previously-issued, still-valid set-password tokens for this
 * user first, so at most one link is ever usable at a time.
 */
export async function generateSetPasswordUrl(userId: string): Promise<string> {
	// A deleted user's link would be rejected on use anyway; don't hand one out.
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { deletedAt: true },
	});
	if (!user || user.deletedAt) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Uživatel nebyl nalezen.',
		});
	}

	const ctx = await auth.$context;
	const accounts = await ctx.internalAdapter.findAccounts(userId);
	const hasCredential = accounts.some((a) => a.providerId === 'credential');
	const ttl = hasCredential ? RESET_TTL_MS : INVITE_TTL_MS;

	await revokeSetPasswordTokens(userId);

	const token = randomUUID();
	await ctx.internalAdapter.createVerificationValue({
		identifier: PREFIX + token,
		value: userId,
		expiresAt: new Date(Date.now() + ttl),
	});

	return `${env.BETTER_AUTH_URL}/reset-password?token=${token}`;
}

/**
 * Consume a set/reset token and set the user's password. Creates the
 * `credential` account on first use (passwordless → active), otherwise updates
 * the existing password. Rejects tokens of deleted users. One-time: the token
 * is consumed atomically together with the password write, so two concurrent
 * submits of the same link cannot both succeed. Expired tokens and tokens of
 * deleted users are burned; a too-short password leaves the link usable.
 */
export async function setPasswordWithToken(
	token: string,
	newPassword: string,
): Promise<void> {
	const ctx = await auth.$context;
	const identifier = PREFIX + token;
	const record = await db.verification.findFirst({ where: { identifier } });
	if (!record) throw new Error('INVALID_TOKEN');
	if (record.expiresAt < new Date()) {
		await db.verification.deleteMany({ where: { identifier } });
		throw new Error('EXPIRED_TOKEN');
	}

	const userId = record.value;
	// A deleted (or missing) user must never get a password back, even if a
	// stale token survived the delete.
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { deletedAt: true },
	});
	if (!user || user.deletedAt) {
		await db.verification.deleteMany({ where: { identifier } });
		throw new Error('INVALID_TOKEN');
	}

	const minLength = ctx.password.config.minPasswordLength;
	if (newPassword.length < minLength) throw new Error('PASSWORD_TOO_SHORT');

	const hash = await ctx.password.hash(newPassword);

	await db.$transaction(async (tx) => {
		// Single use: only the request that actually deletes the token proceeds.
		const consumed = await tx.verification.deleteMany({ where: { identifier } });
		if (consumed.count === 0) throw new Error('INVALID_TOKEN');

		// Re-check `deletedAt` under a row lock: this UPDATE waits for a
		// concurrent `member.delete` transaction and then sees its `deletedAt`,
		// or makes that delete wait and remove the credential written here.
		const active = await tx.user.updateMany({
			where: { id: userId, deletedAt: null },
			data: { updatedAt: new Date() },
		});
		if (active.count === 0) throw new Error('INVALID_TOKEN');

		const credential = await tx.account.findFirst({
			where: { userId, providerId: 'credential' },
			select: { id: true },
		});
		if (credential) {
			await tx.account.update({
				where: { id: credential.id },
				data: { password: hash },
			});
		} else {
			await tx.account.create({
				data: {
					userId,
					accountId: userId,
					providerId: 'credential',
					password: hash,
				},
			});
		}
	});
}
