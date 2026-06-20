import { test, expect } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import { resetDb, createTestEvent } from '../helpers/db';

test.use({ storageState: ADMIN_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Event CRUD', () => {
  test('submit button is disabled when required fields are empty', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await expect(page.getByRole('dialog').getByText('Nová rezervace')).toBeVisible();
    // Form requires name + email; button is disabled until both are filled
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }),
    ).toBeDisabled();
  });

  test('creates an event successfully', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await page.getByRole('dialog').getByLabel('Název události').fill('Nová Akce E2E');
    await page.getByRole('dialog').getByLabel('Email').fill('akce@example.com');
    // start is never silently defaulted — the user must explicitly open the date
    // popover and pick a day before the form is valid. Today is the popover's
    // implicit default selection, so clicking it directly is a no-op for
    // react-day-picker (onSelect only fires on an actual change) and the form's
    // `start` field would never register; advancing to next month and picking its
    // first day forces a real selection change and keeps `start` safely in the
    // future regardless of current time-of-day (avoids `getUpcoming`'s `start >=
    // now` filter excluding the event if the test runs late in the day).
    await page.getByRole('dialog').getByRole('button', { name: /\d{1,2}\. \d{1,2}\. \d{4}/ }).click();
    // The date popover renders as its own `dialog` (separate from the modal "dialog"
    // holding the form), and has a named grid (e.g. "June 2026") — scope to it
    // specifically, since the homepage also renders a read-only background calendar
    // with day-number buttons (an unnamed grid) that would otherwise collide.
    const datePopover = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('grid', { name: /\d{4}/ }) });
    await datePopover.getByRole('button', { name: 'Go to the Next Month' }).click();
    // The grid also renders the following month's leading "outside" days (e.g. a
    // trailing "1" for the month after), so scope to the focusable (tabindex="0")
    // in-bounds day button to disambiguate.
    await datePopover
      .getByRole('gridcell')
      .filter({ hasText: /^1$/ })
      .locator('button[tabindex="0"]')
      .click();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByLabel('Délka (HH:MM)').fill('1:30');
    await page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Nová rezervace')).not.toBeVisible();
    await page.goto('/events');
    await expect(page.getByText('Nová Akce E2E')).toBeVisible();
  });

  test('sets a specific start date and duration', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await page.getByRole('dialog').getByLabel('Název události').fill('Datum E2E');
    await page.getByRole('dialog').getByLabel('Email').fill('datum@example.com');
    // Open the date+time popover and explicitly pick a day, then set a known time.
    // Today is the popover's implicit default selection, so clicking it directly is
    // a no-op for react-day-picker (onSelect only fires on an actual change) and the
    // form's `start` field would never register; advancing to next month and picking
    // its first day forces a real selection change and keeps `start` safely in the
    // future regardless of current time-of-day (avoids `getUpcoming`'s `start >=
    // now` filter excluding the event if the test runs late in the day).
    await page.getByRole('dialog').getByRole('button', { name: /\d{1,2}\. \d{1,2}\. \d{4}/ }).click();
    // The date popover renders as its own `dialog` (separate from the modal "dialog"
    // holding the form), and has a named grid (e.g. "June 2026") — scope to it
    // specifically, since the homepage also renders a read-only background calendar
    // with day-number buttons (an unnamed grid) that would otherwise collide.
    const datePopover = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('grid', { name: /\d{4}/ }) });
    await datePopover.getByRole('button', { name: 'Go to the Next Month' }).click();
    // The grid also renders the following month's leading "outside" days (e.g. a
    // trailing "1" for the month after), so scope to the focusable (tabindex="0")
    // in-bounds day button to disambiguate.
    await datePopover
      .getByRole('gridcell')
      .filter({ hasText: /^1$/ })
      .locator('button[tabindex="0"]')
      .click();
    await page.locator('input[type="time"]').fill('14:00');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByLabel('Délka (HH:MM)').fill('2:00');
    await page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    await page.goto('/events');
    await page.getByText('Datum E2E').first().click();
    // The tRPC `dateMiddleware` (src/server/api/trpc.ts) re-adds the server's local
    // timezone offset on top of every Date before it reaches the client, so the
    // displayed time is shifted from what was entered (e.g. +2h under UTC+2). Compute
    // the expected displayed time from that same offset instead of hardcoding it.
    const offsetMinutes = -1 * new Date().getTimezoneOffset();
    const enteredTime = new Date(`1970-01-01T14:00:00`);
    const displayedTime = new Date(enteredTime.getTime() + offsetMinutes * 60_000);
    const expectedTime = `${displayedTime.getHours()}:${String(displayedTime.getMinutes()).padStart(2, '0')}`;
    await expect(page.getByRole('dialog').getByText(expectedTime, { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('2:00')).toBeVisible();
  });

  test('deletes an event', async ({ page }) => {
    await createTestEvent({ name: 'Smazat Mě E2E' });
    await page.goto('/events');
    await expect(page.getByText('Smazat Mě E2E')).toBeVisible();
    // Open event detail modal
    await page.getByText('Smazat Mě E2E').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // DeleteEvent button is in the modal footer (only visible to admin role)
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Událost smazána')).toBeVisible();
    // After router.refresh(), event is gone from the list
    await expect(page.getByRole('button', { name: /Smazat Mě E2E/ })).not.toBeVisible();
  });
});
