import { PrismaClient } from '@prisma/client';
import { auth } from '../../src/server/auth';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  name: string;
  role: 'admin' | 'member';
  password: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? 'admin@cmdrozdi.cz',
    name: 'Admin',
    role: 'admin',
    password: 'admin1234',
  },
  {
    email: 'member@cmdrozdi.cz',
    name: 'Test Member',
    role: 'member',
    password: 'admin1234',
  },
];

/**
 * Truncates domain tables (preserves auth tables) and ensures seed users exist.
 * Call in beforeEach of every spec file.
 */
export async function resetDb() {
  await prisma.usersOnEvents.deleteMany();
  await prisma.instrumentsOnUsers.deleteMany();
  await prisma.event.deleteMany();

  // Re-create seed users if somehow deleted (normally they persist across resets)
  for (const user of SEED_USERS) {
    const exists = await prisma.user.findUnique({ where: { email: user.email } });
    if (!exists) {
      await auth.api.createUser({
        body: {
          email: user.email,
          name: user.name,
          role: user.role,
          password: user.password,
          data: { emailVerified: true },
        },
      });
    }
  }
}

/** Creates a test event directly via Prisma (bypasses tRPC/HTTP) for test setup. */
export async function createTestEvent(overrides?: { name?: string; email?: string }) {
  return prisma.event.create({
    data: {
      name: overrides?.name ?? 'Test Event',
      isPrivate: false,
      state: 0,
      email: overrides?.email ?? 'test@example.com',
    },
  });
}

/**
 * Deletes users by email list. Called in afterAll of members.spec.ts to clean up
 * throwaway users created during tests (auth tables are NOT truncated in resetDb).
 */
export async function cleanupTestUsers(emails: string[]) {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
