import { headers } from 'next/headers';
import { betterAuth } from 'better-auth';
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { deleteSessionCookie } from 'better-auth/cookies';
import { admin } from 'better-auth/plugins';

import { ac, roles } from '~/server/auth-access';
import { env } from '~/env';
import { db } from '~/server/db';
import type { UserRole } from '~/enums/UserRole';

/**
 * Whether a session is an impersonation started by an admin who has since
 * been deleted (or no longer exists). Such a session belongs to the live
 * member, so the `deletedAt` checks on `session.user` don't catch it. Costs a
 * primary-key lookup, and only for impersonation sessions.
 */
async function isImpersonatorDeleted(
	impersonatedBy: string | null | undefined,
): Promise<boolean> {
	if (!impersonatedBy) return false;
	const admin = await db.user.findUnique({
		where: { id: impersonatedBy },
		select: { deletedAt: true },
	});
	if (!admin) return true;
	return admin.deletedAt !== null;
}

const userDeletedError = () =>
	new APIError('FORBIDDEN', {
		message: 'User is deleted',
		code: 'USER_DELETED',
	});

export const auth = betterAuth({
	database: prismaAdapter(db, { provider: 'postgresql' }),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: [env.BETTER_AUTH_URL],
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
	},
	user: {
		additionalFields: {
			deletedAt: { type: 'date', required: false, input: false },
		},
	},
	databaseHooks: {
		session: {
			create: {
				// Every sign-in (and impersonation) creates a session: refuse it
				// for soft-deleted users, whatever credentials they still hold,
				// and refuse an impersonation whose admin was deleted meanwhile.
				before: async (session) => {
					const user = await db.user.findUnique({
						where: { id: session.userId },
						select: { deletedAt: true },
					});
					if (!user || user.deletedAt) throw userDeletedError();
					const { impersonatedBy } = session as {
						impersonatedBy?: string | null;
					};
					if (await isImpersonatorDeleted(impersonatedBy)) {
						throw userDeletedError();
					}
				},
			},
		},
	},
	hooks: {
		// A session can outlive its user's soft delete (e.g. a row left behind
		// by a failed delete). Better Auth's own endpoints — notably the admin
		// plugin's `/admin/*` — read the session via `getSessionFromCtx`, not
		// `getServerAuthSession`, so enforce the rule here too.
		before: createAuthMiddleware(async (ctx) => {
			// Sign-in must work from a browser that still holds a deleted
			// user's cookie (session creation is guarded by the database hook
			// above), sign-out must always work, and `/get-session` is handled
			// by the after hook without an extra session lookup.
			if (
				ctx.path.startsWith('/sign-in') ||
				ctx.path === '/sign-out' ||
				ctx.path === '/get-session'
			) {
				return;
			}
			// `disableRefresh`: this lookup is cached in `ctx.context.session`
			// and reused by the endpoint, so it must not write a refreshed
			// session the endpoint's response would not carry a cookie for.
			const session = await getSessionFromCtx<
				{ deletedAt?: Date | null },
				{ impersonatedBy?: string | null }
			>(ctx, { disableRefresh: true });
			if (
				session?.user.deletedAt ||
				(await isImpersonatorDeleted(session?.session.impersonatedBy))
			) {
				throw userDeletedError();
			}
		}),
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/get-session') return;
			const returned = ctx.context.returned as
				| {
						session?: { impersonatedBy?: string | null };
						user?: { deletedAt?: Date | null };
				  }
				| null
				| undefined;
			if (
				returned?.user?.deletedAt ||
				(await isImpersonatorDeleted(returned?.session?.impersonatedBy))
			) {
				// Treat a deleted user's session as signed out everywhere,
				// including the client-side `useSession()`.
				deleteSessionCookie(ctx);
				return ctx.json(null);
			}
		}),
	},
	plugins: [admin({ ac, roles, adminRoles: ['admin'], defaultRole: 'guest' })],
});

type InferredUser = (typeof auth.$Infer.Session)['user'];
export type SessionUser = Omit<InferredUser, 'role'> & { role: UserRole };
export type AppSession = {
	session: (typeof auth.$Infer.Session)['session'];
	user: SessionUser;
};

/**
 * Server-side session accessor for server components and route handlers.
 * Returns `null` when unauthenticated, including when a session somehow
 * outlived its user's soft delete, or is an impersonation whose admin was
 * deleted — every server-side guard (layouts, tRPC context) goes through
 * here. The `/get-session` after hook already nulls such sessions; the checks
 * below are defense in depth and must be kept.
 */
export const getServerAuthSession = async (): Promise<AppSession | null> => {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session || session.user.deletedAt) return null;
	if (await isImpersonatorDeleted(session.session.impersonatedBy)) return null;
	return session as AppSession;
};
