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
    // NextUI Input with label — matched by associated <label> text
    await page.getByRole('dialog').getByLabel('Název události').fill('Nová Akce E2E');
    await page.getByRole('dialog').getByLabel('Email').fill('akce@example.com');
    await page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    // Modal closes after success
    await expect(page.getByRole('dialog').getByText('Nová rezervace')).not.toBeVisible();
    // New event appears in the list on /events (state=0 so getUpcoming includes it)
    await page.goto('/events');
    await expect(page.getByText('Nová Akce E2E')).toBeVisible();
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
