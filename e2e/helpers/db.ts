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
export async function createTestEvent(overrides?: {
  name?: string;
  email?: string;
  start?: Date;
  end?: Date;
  isPrivate?: boolean;
  location?: string;
}) {
  return prisma.event.create({
    data: {
      name: overrides?.name ?? 'Test Event',
      isPrivate: overrides?.isPrivate ?? false,
      location: overrides?.location,
      state: 0,
      email: overrides?.email ?? 'test@example.com',
      start: overrides?.start,
      end: overrides?.end,
    },
  });
}

/** Reads an event straight from the DB (bypassing tRPC and the UI). */
export async function getEventByName(name: string) {
  return prisma.event.findFirstOrThrow({ where: { name } });
}

/** Reads an event by id straight from the DB, or null if it doesn't exist. */
export async function findEventById(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

/** Counts all events in the DB. */
export async function countEvents() {
  return prisma.event.count();
}

/**
 * Deletes users by email list. Called in afterAll of members.spec.ts to clean up
 * throwaway users created during tests (auth tables are NOT truncated in resetDb).
 */
export async function cleanupTestUsers(emails: string[]) {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
