import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '~/env';
import { PrismaClient } from '~/generated/prisma/client';

const createPrismaClient = () =>
	new PrismaClient({
		// Prisma 7 requires a driver adapter. 5 s connect timeout matches Prisma <=6
		// (pg's default is 0 = wait forever); other pool settings keep pg defaults.
		adapter: new PrismaPg({
			connectionString: env.DATABASE_URL,
			connectionTimeoutMillis: 5_000,
		}),
		log:
			env.NODE_ENV === 'development'
				? ['query', 'error', 'warn']
				: ['error'],
	});

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
