import { test, expect } from '@playwright/test';
import { MEMBER_AUTH } from '../helpers/auth';
import { countEvents, createTestEvent, findEventById, resetDb } from '../helpers/db';
import { trpcMutation, trpcQuery } from '../helpers/trpc';

/**
 * Server-side authorization of the event procedures, called straight over the
 * tRPC HTTP endpoint (`/api/trpc` is not behind the auth middleware), so these
 * tests don't depend on what the UI hides.
 */

const CONFIRMED = 2; // EventState.CONFIRMED

function futureDate(daysAhead: number): Date {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60_000);
}

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Event API as an anonymous visitor', () => {
  test('event.update is rejected with UNAUTHORIZED', async ({ page }) => {
    const event = await createTestEvent({ name: 'Original E2E' });

    const res = await trpcMutation(page.request, 'event.update', {
      id: event.id,
      name: 'Hijacked E2E',
      isPrivate: true,
    });

    expect(res.errorCode).toBe('UNAUTHORIZED');
    expect(res.status).toBe(401);
    const stored = await findEventById(event.id);
    expect(stored?.name).toBe('Original E2E');
    expect(stored?.isPrivate).toBe(false);
  });

  test('event.create with an existing id creates a new event instead of overwriting it', async ({
    page,
  }) => {
    const event = await createTestEvent({ name: 'Original E2E', email: 'original@example.com' });

    const res = await trpcMutation(page.request, 'event.create', {
      id: event.id,
      name: 'Hijacked E2E',
      email: 'attacker@example.com',
      isPrivate: true,
      state: CONFIRMED,
    });

    // Returns only the new event's id, never the stored row.
    expect(res.status).toBe(200);
    expect(res.errorCode).toBeUndefined();
    const created = res.data as { id: string };
    expect(Object.keys(created)).toEqual(['id']);
    expect(created.id).not.toBe(event.id);

    // The existing event is untouched.
    const original = await findEventById(event.id);
    expect(original?.name).toBe('Original E2E');
    expect(original?.email).toBe('original@example.com');
    expect(original?.isPrivate).toBe(false);

    // A new event was created, as PROPOSED whatever state was sent.
    expect(await countEvents()).toBe(2);
    const stored = await findEventById(created.id);
    expect(stored?.name).toBe('Hijacked E2E');
    expect(stored?.state).toBe(0); // EventState.PROPOSED
  });

  test('event.deleteById is rejected with UNAUTHORIZED', async ({ page }) => {
    const event = await createTestEvent({ name: 'Keep Me E2E' });

    const res = await trpcMutation(page.request, 'event.deleteById', { id: event.id });

    expect(res.errorCode).toBe('UNAUTHORIZED');
    expect(await findEventById(event.id)).not.toBeNull();
  });

  test('event.getForCalendar hides the name and location of private events', async ({
    page,
  }) => {
    await createTestEvent({
      name: 'Soukromá E2E',
      location: 'Tajné místo E2E',
      isPrivate: true,
      start: futureDate(7),
    });
    await createTestEvent({
      name: 'Veřejná E2E',
      location: 'Náměstí E2E',
      isPrivate: false,
      start: futureDate(8),
    });

    const res = await trpcQuery(page.request, 'event.getForCalendar');

    expect(res.status).toBe(200);
    const events = res.data as {
      name: string | null;
      location: string | null;
      isPrivate: boolean;
      start: Date | null;
    }[];
    expect(events).toHaveLength(2);
    const privateEvent = events.find((e) => e.isPrivate);
    expect(privateEvent).toMatchObject({ name: null, location: null });
    expect(privateEvent?.start).toBeInstanceOf(Date);
    expect(events.find((e) => !e.isPrivate)).toMatchObject({
      name: 'Veřejná E2E',
      location: 'Náměstí E2E',
    });
  });
});

test.describe('Event API as a member', () => {
  test.use({ storageState: MEMBER_AUTH });

  test('event.update edits the event (members can edit, as in the UI)', async ({ page }) => {
    const event = await createTestEvent({ name: 'Original E2E' });

    const res = await trpcMutation(page.request, 'event.update', {
      id: event.id,
      name: 'Upraveno členem E2E',
      isPrivate: true,
    });

    expect(res.errorCode).toBeUndefined();
    expect(res.data).toEqual({ id: event.id });
    const stored = await findEventById(event.id);
    expect(stored?.name).toBe('Upraveno členem E2E');
    expect(stored?.isPrivate).toBe(true);
  });

  test('event.deleteById is rejected with FORBIDDEN (admin-only)', async ({ page }) => {
    const event = await createTestEvent({ name: 'Keep Me E2E' });

    const res = await trpcMutation(page.request, 'event.deleteById', { id: event.id });

    expect(res.errorCode).toBe('FORBIDDEN');
    expect(res.status).toBe(403);
    expect(await findEventById(event.id)).not.toBeNull();
  });
});
