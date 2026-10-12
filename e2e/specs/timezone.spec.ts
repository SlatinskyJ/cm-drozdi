import { test, expect, type Page } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import { resetDb, createTestEvent } from '../helpers/db';
import {
  addDays,
  type CalendarDay,
  dayButtonName,
  displayDate,
  monthGridName,
  todayInAppTz,
} from '../helpers/date';

test.use({ storageState: ADMIN_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

/**
 * The instant at which the Prague wall clock shows `day` at `hour:minute`.
 * Tries the CET (+1) and CEST (+2) offsets and keeps the one that round-trips.
 */
function pragueInstant(day: CalendarDay, hour: number, minute: number): Date {
  for (const offset of [1, 2]) {
    const instant = new Date(
      Date.UTC(day.year, day.month - 1, day.day, hour - offset, minute),
    );
    const wall = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Prague',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const get = (type: string) => Number(wall.find((p) => p.type === type)!.value);
    if (get('day') === day.day && get('hour') === hour) return instant;
  }
  throw new Error('No such Prague wall-clock time');
}

/**
 * Loads `url` without Next's JS bundles: React never hydrates, so the page
 * shows exactly what the server rendered (React's inline streaming scripts
 * still reveal Suspense content).
 */
async function gotoServerRendered(page: Page, url: string) {
  await page.route('**/_next/static/chunks/**', (route) => route.abort());
  await page.goto(url);
}

/** Collects React hydration errors (minified #418/#423/#425) on `page`. */
function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  const isHydrationError = (text: string) =>
    /hydrat|Minified React error #(418|423|425)/i.test(text);
  page.on('pageerror', (error) => {
    if (isHydrationError(error.message)) errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && isHydrationError(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

test.describe('Prague time, whatever the server and browser timezones', () => {
  test('server-rendered and hydrated pages show the same Prague time', async ({
    page,
    browser,
  }) => {
    const today = todayInAppTz();
    // 14:00 on 15 July next year, Prague (CEST) time.
    const july: CalendarDay = { year: today.year + 1, month: 7, day: 15 };
    await createTestEvent({
      name: 'SSR E2E',
      start: pragueInstant(july, 14, 0),
      end: pragueInstant(july, 15, 30),
    });
    // 00:30 tomorrow in Prague: still "today" in UTC and in the Americas.
    const tomorrow = addDays(today, 1);
    await createTestEvent({ name: 'Midnight E2E', start: pragueInstant(tomorrow, 0, 30) });

    const serverPage = await browser.newPage({ storageState: ADMIN_AUTH });
    const hydratedErrors = collectHydrationErrors(page);
    const views = [
      { name: 'server-rendered', page: serverPage, goto: gotoServerRendered },
      { name: 'hydrated', page, goto: (p: Page, url: string) => p.goto(url) },
    ];

    for (const view of views) {
      await test.step(`${view.name}: event card`, async () => {
        await view.goto(view.page, '/events');
        const card = view.page.getByRole('button', { name: /SSR E2E/ });
        await expect(card.getByText(displayDate(july), { exact: true })).toBeVisible();
        await expect(card.getByText('14:00', { exact: true })).toBeVisible();
        await expect(card.getByText('1:30', { exact: true })).toBeVisible();
      });

      await test.step(`${view.name}: public calendar marks the Prague day`, async () => {
        // Only checkable without navigating when tomorrow is in today's month.
        if (tomorrow.month !== today.month) return;
        await view.goto(view.page, '/');
        await expect(
          view.page.getByRole('button', {
            name: `Dnes, ${dayButtonName(today)}`,
            exact: true,
          }),
        ).toBeEnabled();
        await expect(
          view.page.getByRole('button', { name: dayButtonName(tomorrow), exact: true }),
        ).toBeDisabled();
      });
    }

    await serverPage.close();
    expect(hydratedErrors).toEqual([]);
  });

  test('public calendar marks the Prague day of an event just after midnight', async ({
    page,
  }) => {
    const today = todayInAppTz();
    const nextMonth = addDays({ ...today, day: 1 }, 32);
    const day: CalendarDay = { ...nextMonth, day: 15 };
    // 00:30 Prague on the 15th is still the 14th in UTC and in the Americas.
    await createTestEvent({ name: 'Calendar E2E', start: pragueInstant(day, 0, 30) });

    await page.goto('/');
    await page.getByRole('button', { name: 'Přejít na další měsíc' }).click();
    const month = page.getByRole('grid', { name: monthGridName(day), exact: true });
    await expect(month).toBeVisible();
    await expect(
      month.getByRole('button', { name: dayButtonName(day), exact: true }),
    ).toBeDisabled();
    await expect(
      month.getByRole('button', { name: dayButtonName(addDays(day, -1)), exact: true }),
    ).toBeEnabled();
  });
});
