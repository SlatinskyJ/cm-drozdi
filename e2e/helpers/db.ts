import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@better-auth/utils/password';

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
}) {
  return prisma.event.create({
    data: {
      name: overrides?.name ?? 'Test Event',
      isPrivate: false,
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

/**
 * Deletes users by email list. Called in afterAll of members.spec.ts to clean up
 * throwaway users created during tests (auth tables are NOT truncated in resetDb).
 */
export async function cleanupTestUsers(emails: string[]) {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

/**
 * Creates a user straight in the DB, optionally with a password (credential
 * account), bypassing the admin UI. Clean up with `cleanupTestUsers`.
 */
export async function createTestUser(opts: {
  email: string;
  name: string;
  role?: 'member' | 'admin';
  password?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      role: opts.role ?? 'member',
      emailVerified: true,
    },
  });
  if (opts.password) {
    await prisma.account.create({
      data: {
        providerId: 'credential',
        accountId: user.id,
        userId: user.id,
        password: await hashPassword(opts.password),
      },
    });
  }
  return user;
}

/**
 * Mints a set-password token for a user the way `generateSetPasswordUrl` does,
 * without revoking older ones. Open it at `/reset-password?token=<token>`.
 */
export async function createSetPasswordToken(userId: string) {
  const token = randomUUID();
  await prisma.verification.create({
    data: {
      identifier: `set-password:${token}`,
      value: userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

/** Number of set-password tokens (used or not) still stored for a user. */
export async function countSetPasswordTokens(userId: string) {
  return prisma.verification.count({
    where: { value: userId, identifier: { startsWith: 'set-password:' } },
  });
}

/**
 * Marks a user deleted *without* the rest of `member.delete` (tokens,
 * credential and sessions stay), to prove each guard holds on its own.
 */
export async function softDeleteUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}

/** Reads a user's soft-delete marker. */
export async function getDeletedAt(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { deletedAt: true },
  });
  return user.deletedAt;
}

/** The user's stored password hash, or null when they have no credential. */
export async function getPasswordHash(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'credential' },
    select: { password: true },
  });
  return account?.password ?? null;
}

/** Number of session rows owned by a user or impersonations they started. */
export async function countSessions(where: { userId?: string; impersonatedBy?: string }) {
  return prisma.session.count({ where });
}
