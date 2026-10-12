import { test, expect } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import { cleanupTestUsers, createTestEvent, getEventByName, resetDb } from '../helpers/db';
import { trpcMutation } from '../helpers/trpc';

/**
 * The tRPC input-validation contract, called straight over the HTTP endpoint:
 * which inputs the Zod schemas accept or reject, and the flattened
 * `data.zodError` shape the `errorFormatter` returns. Pinned so a Zod upgrade
 * can't change either silently.
 */

const ROLE_EMAIL = 'zod-role@e2e.example.com';

test.use({ storageState: ADMIN_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

// Safety net in case a regression lets the invalid-role user through.
test.afterAll(async () => {
  await cleanupTestUsers([ROLE_EMAIL]);
});

test('event.create rejects an invalid email with a flattened zodError', async ({ page }) => {
  const res = await trpcMutation(page.request, 'event.create', {
    name: 'Zod Reject E2E',
    isPrivate: true,
    email: 'not-an-email',
  });

  expect(res.status).toBe(400);
  expect(res.errorCode).toBe('BAD_REQUEST');
  expect(res.zodError?.formErrors).toEqual([]);
  expect(Object.keys(res.zodError?.fieldErrors ?? {})).toEqual(['email']);
  expect(res.zodError?.fieldErrors.email).toHaveLength(1);
  await expect(getEventByName('Zod Reject E2E')).rejects.toThrow();
});

test('event.changeState accepts EventState values and rejects anything else', async ({
  page,
}) => {
  const event = await createTestEvent({ name: 'Zod State E2E' });

  for (const state of [7, 'CONFIRMED']) {
    const res = await trpcMutation(page.request, 'event.changeState', { id: event.id, state });
    expect(res.status).toBe(400);
    expect(Object.keys(res.zodError?.fieldErrors ?? {})).toEqual(['state']);
  }

  // The edges first: a regression in how z.enum filters a numeric TS enum's
  // reverse-mapping keys would most likely hit 0 (falsy) or the last member.
  for (const state of [0, 3, 2]) {
    const ok = await trpcMutation(page.request, 'event.changeState', { id: event.id, state });
    expect(ok.status).toBe(200);
    expect((await getEventByName('Zod State E2E')).state).toBe(state);
  }
});

test('event.changeState rejects a malformed id', async ({ page }) => {
  const res = await trpcMutation(page.request, 'event.changeState', {
    id: 'not a cuid',
    state: 2,
  });

  expect(res.status).toBe(400);
  expect(Object.keys(res.zodError?.fieldErrors ?? {})).toEqual(['id']);
});

test('member.create keeps the custom Czech role message', async ({ page }) => {
  const res = await trpcMutation(page.request, 'member.create', {
    email: ROLE_EMAIL,
    name: 'Zod Role',
    role: 'guest',
  });

  expect(res.status).toBe(400);
  expect(res.zodError?.fieldErrors.role).toEqual(['Lze přiřadit pouze roli Člen nebo Admin.']);
});

test('non-input errors carry zodError: null', async ({ page }) => {
  // Valid input, so each error comes from the procedure body, after input
  // validation, and the errorFormatter must report zodError: null.

  // A TRPCError thrown directly: the self-delete guard.
  const session = await page.request.get('/api/auth/get-session');
  const { user } = (await session.json()) as { user: { id: string } };
  const selfDelete = await trpcMutation(page.request, 'member.delete', { userId: user.id });
  expect(selfDelete.status).toBe(400);
  expect(selfDelete.errorCode).toBe('BAD_REQUEST');
  expect(selfDelete.zodError).toBeNull();

  // A plain Error wrapped by tRPC (Prisma: no event with this id), so the
  // TRPCError's cause is a non-Zod Error. Pins the formatter's
  // `instanceof ZodError` check: `instanceof ZodRealError` matches any Error
  // and would make the formatter crash on this cause.
  const missing = await trpcMutation(page.request, 'event.changeState', {
    id: 'cnonexistent0000000000000',
    state: 2,
  });
  expect(missing.status).toBe(500);
  expect(missing.errorCode).toBe('INTERNAL_SERVER_ERROR');
  expect(missing.zodError).toBeNull();
});
