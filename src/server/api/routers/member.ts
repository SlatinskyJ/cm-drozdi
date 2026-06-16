import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
	adminProcedure,
	createTRPCRouter,
	publicProcedure,
} from '~/server/api/trpc';
import { auth } from '~/server/auth';
import {
	generateSetPasswordUrl,
	setPasswordWithToken,
} from '~/server/auth-password-link';
import { db } from '~/server/db';
import { UserRole } from '~/enums/UserRole';

const assignableRole = z.nativeEnum(UserRole).refine(
	(r) => r === UserRole.MEMBER || r === UserRole.ADMIN,
	{ message: 'Lze přiřadit pouze roli Člen nebo Admin.' },
);

async function activeAdminCount() {
	return db.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } });
}

/**
 * Wraps an `auth.api.*` admin call and turns any thrown error into a generic
 * Czech-language TRPCError — Better Auth's admin endpoints throw `APIError`
 * with English messages not meant for end users.
 */
async function callAuth<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof TRPCError) throw e;
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Operace selhala. Zkontrolujte zadané údaje.',
		});
	}
}

export const memberRouter = createTRPCRouter({
	create: adminProcedure
		.input(
			z.object({
				email: z.string().email(),
				name: z.string().min(1),
				role: assignableRole,
			}),
		)
		.mutation(async ({ input }) => {
			const h = await headers();
			const result = await callAuth(() =>
				auth.api.createUser({
					body: {
						email: input.email,
						name: input.name,
						role: input.role,
						data: { emailVerified: true },
					},
					headers: h,
				}),
			);
			return { userId: result.user.id };
		}),

	list: adminProcedure.query(async ({ ctx }) => {
		const users = await ctx.db.user.findMany({
			where: { deletedAt: null },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				accounts: {
					where: { providerId: 'credential' },
					select: { id: true },
				},
			},
			orderBy: { createdAt: 'asc' },
		});
		return users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role as UserRole,
			hasPassword: u.accounts.length > 0,
		}));
	}),

	setRole: adminProcedure
		.input(z.object({ userId: z.string(), role: assignableRole }))
		.mutation(async ({ ctx, input }) => {
			if (input.role !== UserRole.ADMIN) {
				const target = await ctx.db.user.findUnique({
					where: { id: input.userId },
					select: { role: true },
				});
				if (
					target?.role === UserRole.ADMIN &&
					(await activeAdminCount()) <= 1
				) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Nelze odebrat roli poslednímu administrátorovi.',
					});
				}
			}
			const h = await headers();
			await callAuth(() =>
				auth.api.setRole({
					body: { userId: input.userId, role: input.role },
					headers: h,
				}),
			);
			return { ok: true };
		}),

	delete: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (input.userId === ctx.session.user.id) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Nemůžete smazat sami sebe.',
				});
			}
			const target = await ctx.db.user.findUnique({
				where: { id: input.userId },
				select: { role: true },
			});
			if (!target) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Uživatel nebyl nalezen.' });
			}
			if (
				target.role === UserRole.ADMIN &&
				(await activeAdminCount()) <= 1
			) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Nelze smazat posledního administrátora.',
				});
			}
			// Soft-delete: mark, remove password (credential), revoke sessions.
			await ctx.db.user.update({
				where: { id: input.userId },
				data: { deletedAt: new Date() },
			});
			await ctx.db.account.deleteMany({
				where: { userId: input.userId, providerId: 'credential' },
			});
			const h = await headers();
			await callAuth(() =>
				auth.api.revokeUserSessions({
					body: { userId: input.userId },
					headers: h,
				}),
			);
			return { ok: true };
		}),

	generatePasswordLink: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input }) => {
			const url = await generateSetPasswordUrl(input.userId);
			return { url };
		}),

	setPassword: publicProcedure
		.input(z.object({ token: z.string(), newPassword: z.string() }))
		.mutation(async ({ input }) => {
			try {
				await setPasswordWithToken(input.token, input.newPassword);
			} catch (e) {
				const msg = e instanceof Error ? e.message : 'UNKNOWN';
				const map: Record<string, string> = {
					INVALID_TOKEN: 'Neplatný odkaz.',
					EXPIRED_TOKEN: 'Odkaz vypršel.',
					PASSWORD_TOO_SHORT: 'Heslo je příliš krátké.',
				};
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: map[msg] ?? 'Nastavení hesla selhalo.',
				});
			}
			return { ok: true };
		}),
});
