import { randomUUID } from 'crypto';

import { auth } from '~/server/auth';
import { env } from '~/env';
import { db } from '~/server/db';

const PREFIX = 'set-password:';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, passwordless user
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour, existing credential

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
	const ctx = await auth.$context;
	const accounts = await ctx.internalAdapter.findAccounts(userId);
	const hasCredential = accounts.some((a) => a.providerId === 'credential');
	const ttl = hasCredential ? RESET_TTL_MS : INVITE_TTL_MS;

	await db.verification.deleteMany({
		where: { value: userId, identifier: { startsWith: PREFIX } },
	});

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
 * the existing password. One-time: `consumeVerificationValue` atomically
 * finds and deletes the verification row.
 */
export async function setPasswordWithToken(
	token: string,
	newPassword: string,
): Promise<void> {
	const ctx = await auth.$context;
	const record = await ctx.internalAdapter.consumeVerificationValue(
		PREFIX + token,
	);
	if (!record) throw new Error('INVALID_TOKEN');
	if (record.expiresAt < new Date()) throw new Error('EXPIRED_TOKEN');

	const minLength = ctx.password.config.minPasswordLength;
	if (newPassword.length < minLength) throw new Error('PASSWORD_TOO_SHORT');

	const userId = record.value;
	const hash = await ctx.password.hash(newPassword);
	const accounts = await ctx.internalAdapter.findAccounts(userId);
	const hasCredential = accounts.some((a) => a.providerId === 'credential');

	if (!hasCredential) {
		await ctx.internalAdapter.linkAccount({
			userId,
			accountId: userId,
			providerId: 'credential',
			password: hash,
		});
	} else {
		await ctx.internalAdapter.updatePassword(userId, hash);
	}
}
