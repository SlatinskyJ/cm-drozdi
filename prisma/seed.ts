import { auth } from '~/server/auth';
import { generateSetPasswordUrl } from '~/server/auth-password-link';
import { db } from '~/server/db';
import { env } from '~/env';
import { UserRole } from '~/enums/UserRole';
import { hashPassword } from '@better-auth/utils/password';

const DEV_PASSWORD = 'admin1234';

async function ensureUser(opts: {
	email: string;
	name: string;
	role: UserRole;
	password?: string;
}) {
	const existing = await db.user.findUnique({ where: { email: opts.email } });
	if (existing) {
		// Ensure the credential account has the expected password (idempotent fix for
		// users created without a password or whose password drifted from DEV_PASSWORD)
		if (opts.password) {
			const hashed = await hashPassword(opts.password);
			const updated = await db.account.updateMany({
				where: { userId: existing.id, providerId: 'credential' },
				data: { password: hashed },
			});
			if (updated.count === 0) {
				await db.account.create({
					data: {
						providerId: 'credential',
						accountId: existing.id,
						userId: existing.id,
						password: hashed,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				});
			}
		}
		return { id: existing.id, created: false };
	}
	const res = await auth.api.createUser({
		body: {
			email: opts.email,
			name: opts.name,
			role: opts.role,
			password: opts.password, // omitted → passwordless
			data: { emailVerified: true },
		},
	});
	return { id: res.user.id, created: true };
}

async function main() {
	const isProd = env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production';

	// Admin
	const admin = await ensureUser({
		email: env.BOOTSTRAP_ADMIN_EMAIL,
		name: 'Admin',
		role: UserRole.ADMIN,
		password: isProd ? undefined : DEV_PASSWORD,
	});
	if (isProd && admin.created) {
		const url = await generateSetPasswordUrl(admin.id);
		console.log('\n=== PRODUCTION ADMIN BOOTSTRAP ===');
		console.log('Admin:', env.BOOTSTRAP_ADMIN_EMAIL);
		console.log('Set-password link (open once):', url);
		console.log('==================================\n');
	} else if (!isProd) {
		console.log(`Dev admin: ${env.BOOTSTRAP_ADMIN_EMAIL} / ${DEV_PASSWORD}`);
	}

	// Dev-only member — password required in dev/test so E2E can sign in programmatically
	if (!isProd) {
		await ensureUser({
			email: 'member@cmdrozdi.cz',
			name: 'Test Member',
			role: UserRole.MEMBER,
			password: DEV_PASSWORD,
		});
	}
}

void main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
