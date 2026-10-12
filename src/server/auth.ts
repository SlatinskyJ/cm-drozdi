import { headers } from 'next/headers';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';

import { ac, roles } from '~/server/auth-access';
import { env } from '~/env';
import { db } from '~/server/db';
import type { UserRole } from '~/enums/UserRole';

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
				// for soft-deleted users, whatever credentials they still hold.
				before: async (session) => {
					const user = await db.user.findUnique({
						where: { id: session.userId },
						select: { deletedAt: true },
					});
					if (!user || user.deletedAt) {
						throw new APIError('FORBIDDEN', {
							message: 'User is deleted',
							code: 'USER_DELETED',
						});
					}
				},
			},
		},
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
 * Server-side session accessor. `await headers()` works on Next 14 (awaiting
 * the sync return is a no-op) and is forward-compatible with Next 15+ where
 * `headers()` becomes async (Phase 5). Returns `null` when unauthenticated,
 * including when a session somehow outlived its user's soft delete — every
 * server-side guard (layouts, tRPC context) goes through here.
 */
export const getServerAuthSession = async (): Promise<AppSession | null> => {
	// eslint-disable-next-line @typescript-eslint/await-thenable -- headers() is sync on Next 14 but becomes async on Next 15+; awaiting now is forward-compatible.
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session || session.user.deletedAt) return null;
	return session as AppSession;
};
