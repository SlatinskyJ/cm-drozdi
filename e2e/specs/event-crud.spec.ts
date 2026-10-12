import { test, expect, type Page } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import {
  resetDb,
  countEvents,
  createTestEvent,
  findEventById,
  getEventByName,
} from '../helpers/db';
import {
  addDays,
  type CalendarDay,
  dayButtonName,
  displayDate,
  todayInAppTz,
  wallClockInAppTz,
} from '../helpers/date';

test.use({ storageState: ADMIN_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

/**
 * Opens the start date/time picker in the open form dialog, picks `day` by its
 * accessible (Czech) name and optionally types a time.
 */
async function pickStart(page: Page, day: CalendarDay, time?: string) {
  const form = page.getByRole('dialog').first();
  await form.getByRole('button', { name: /^Datum a čas/ }).click();
  const picker = page.getByRole('dialog', { name: 'Výběr data a času' });
  const today = todayInAppTz();
  if (day.month !== today.month || day.year !== today.year) {
    await picker.getByRole('button', { name: 'Přejít na další měsíc' }).click();
  }
  await picker.getByRole('button', { name: dayButtonName(day), exact: true }).click();
  if (time) {
    await picker.getByLabel('Čas', { exact: true }).fill(time);
  }
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
}

test.describe('Event CRUD', () => {
  test('submit button is disabled when required fields are empty', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    const form = page.getByRole('dialog', { name: 'Nová rezervace' });
    await expect(form).toBeVisible();
    // No start chosen yet: the trigger says so instead of showing a fake value.
    await expect(form.getByRole('button', { name: /^Datum a čas/ })).toHaveText('Vyberte datum');
    await expect(form.getByRole('button', { name: 'Potvrdit' })).toBeDisabled();
  });

  test('start picker is Czech, starts on Monday and blocks past days', async ({ page }) => {
    const today = todayInAppTz();
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Datum a čas/ }).click();
    const picker = page.getByRole('dialog', { name: 'Výběr data a času' });
    // Weeks start on Monday: the first day of every grid row is a Monday.
    await expect(picker.getByRole('row').first().getByRole('gridcell').first()).toHaveAccessibleName(
      /^pondělí, /,
    );
    const yesterday = addDays(today, -1);
    if (yesterday.month === today.month) {
      await expect(
        picker.getByRole('button', { name: dayButtonName(yesterday), exact: true }),
      ).toBeDisabled();
    }
    // Today is selectable (its name is prefixed with "Dnes, ").
    await expect(
      picker.getByRole('button', { name: `Dnes, ${dayButtonName(today)}`, exact: true }),
    ).toBeEnabled();
  });

  test('creates an event successfully', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    const form = page.getByRole('dialog', { name: 'Nová rezervace' });
    await form.getByLabel('Název události').fill('Nová Akce E2E');
    await form.getByLabel('Email').fill('akce@example.com');
    await pickStart(page, addDays(todayInAppTz(), 7));
    await form.getByLabel('Délka (HH:MM)').fill('1:30');
    await form.getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    await expect(form).not.toBeVisible();
    await page.goto('/events');
    await expect(page.getByText('Nová Akce E2E')).toBeVisible();
  });

  test('displays the start date and time exactly as entered', async ({ page }) => {
    const day = addDays(todayInAppTz(), 7);
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    const form = page.getByRole('dialog', { name: 'Nová rezervace' });
    await form.getByLabel('Název události').fill('Datum E2E');
    await form.getByLabel('Email').fill('datum@example.com');
    await pickStart(page, day, '14:00');
    await expect(form.getByRole('button', { name: /^Datum a čas/ })).toHaveText(
      `${displayDate(day)} 14:00`,
    );
    await form.getByLabel('Délka (HH:MM)').fill('2:00');
    await form.getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();

    // Stored as 14:00 Prague wall-clock time.
    const stored = await getEventByName('Datum E2E');
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(wallClockInAppTz(stored.start!)).toBe(
      `${day.year}-${pad(day.month)}-${pad(day.day)} 14:00`,
    );

    await page.goto('/events');
    await page.getByRole('button', { name: /Datum E2E/ }).click();
    const detail = page.getByRole('dialog', { name: 'Datum E2E' });
    await expect(detail.getByText(displayDate(day), { exact: true })).toBeVisible();
    await expect(detail.getByText('14:00', { exact: true })).toBeVisible();
    await expect(detail.getByText('2:00', { exact: true })).toBeVisible();
  });

  // One date on each side of the DST switch, so whichever one the current date
  // isn't in exercises the offset at the event's own date, not "now".
  for (const { season, month, utcHour } of [
    { season: 'winter (CET)', month: 1, utcHour: 13 },
    { season: 'summer (CEST)', month: 7, utcHour: 12 },
  ]) {
    test(`editing without changes keeps a ${season} event at 14:00`, async ({ page }) => {
      const year = new Date().getUTCFullYear() + 1;
      const start = new Date(Date.UTC(year, month - 1, 15, utcHour, 0)); // 14:00 Prague
      const end = new Date(start.getTime() + 90 * 60_000);
      await createTestEvent({ name: 'Round Trip E2E', start, end });

      await page.goto('/events');
      await page.getByRole('button', { name: /Round Trip E2E/ }).click();
      const detail = page.getByRole('dialog', { name: 'Round Trip E2E' });
      await expect(detail.getByText(`15. ${month}. ${year}`, { exact: true })).toBeVisible();
      await expect(detail.getByText('14:00', { exact: true })).toBeVisible();
      await expect(detail.getByText('1:30', { exact: true })).toBeVisible();

      await detail.getByRole('button', { name: 'Editovat' }).click();
      await expect(detail.getByRole('button', { name: /^Datum a čas/ })).toHaveText(
        `15. ${month}. ${year} 14:00`,
      );
      await expect(detail.getByLabel('Délka (HH:MM)')).toHaveValue('1:30');
      await detail.getByRole('button', { name: 'Uložit' }).click();
      await expect(detail).not.toBeVisible();

      const stored = await getEventByName('Round Trip E2E');
      expect(stored.start?.toISOString()).toBe(start.toISOString());
      expect(stored.end?.toISOString()).toBe(end.toISOString());

      await page.getByRole('button', { name: /Round Trip E2E/ }).click();
      await expect(detail.getByText('14:00', { exact: true })).toBeVisible();
    });
  }

  test('edits an existing event', async ({ page }) => {
    const year = new Date().getUTCFullYear() + 1;
    const start = new Date(Date.UTC(year, 0, 15, 13, 0)); // 14:00 Prague
    const end = new Date(start.getTime() + 60 * 60_000);
    const event = await createTestEvent({ name: 'Upravit E2E', start, end });

    await page.goto('/events');
    await page.getByRole('button', { name: /Upravit E2E/ }).click();
    const detail = page.getByRole('dialog', { name: 'Upravit E2E' });
    await detail.getByRole('button', { name: 'Editovat' }).click();
    await detail.getByLabel('Název události').fill('Upraveno E2E');
    await detail.getByRole('button', { name: 'Uložit' }).click();
    await expect(detail).not.toBeVisible();

    // The same event was updated in place (no new event was created).
    const stored = await findEventById(event.id);
    expect(stored?.name).toBe('Upraveno E2E');
    expect(stored?.start?.toISOString()).toBe(start.toISOString());
    expect(await countEvents()).toBe(1);
    await expect(page.getByRole('button', { name: /Upraveno E2E/ })).toBeVisible();
  });

  test('deletes an event', async ({ page }) => {
    await createTestEvent({ name: 'Smazat Mě E2E' });
    await page.goto('/events');
    await expect(page.getByText('Smazat Mě E2E')).toBeVisible();
    // Open event detail modal
    await page.getByRole('button', { name: /Smazat Mě E2E/ }).click();
    await expect(page.getByRole('dialog', { name: 'Smazat Mě E2E' })).toBeVisible();
    // DeleteEvent button is in the modal footer (only visible to admin role)
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Událost smazána')).toBeVisible();
    // After router.refresh(), event is gone from the list
    await expect(page.getByRole('button', { name: /Smazat Mě E2E/ })).not.toBeVisible();
  });
});
