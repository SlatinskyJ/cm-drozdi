import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Truncates domain tables (preserves auth tables) and ensures seed users exist.
 * Call in beforeEach of every spec file.
 */
export async function resetDb() {
  await prisma.usersOnEvents.deleteMany();
  await prisma.instrumentsOnUsers.deleteMany();
  await prisma.event.deleteMany();
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
