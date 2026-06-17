import { test, expect } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import { resetDb, createTestEvent } from '../helpers/db';

test.use({ storageState: ADMIN_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Events calendar', () => {
  test('events page renders with section headings', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByText('Události')).toBeVisible();
    await expect(page.getByText('Nadcházející')).toBeVisible();
  });

  test('clicking an event card opens the event detail modal', async ({ page }) => {
    await createTestEvent({ name: 'Concert E2E Test' });
    await page.goto('/events');
    await expect(page.getByText('Concert E2E Test')).toBeVisible();
    // Event cards are pressable — click propagates from span to card
    await page.getByText('Concert E2E Test').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Concert E2E Test')).toBeVisible();
  });
});
