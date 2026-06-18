import { test, expect } from '@playwright/test';
import { resetDb } from '../helpers/db';

// No storageState — this file tests the real auth UI and redirect behavior

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Authentication', () => {
  test('unauthenticated request to /events redirects to /login', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveURL('/login');
  });

  test('login form with valid credentials redirects to /events', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('E-mail').fill('admin@cmdrozdi.cz');
    await page.getByPlaceholder('Heslo').fill('admin1234');
    await page.getByRole('button', { name: 'Přihlásit' }).click();
    await expect(page).toHaveURL('/events');
  });

  test('login form with wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('E-mail').fill('admin@cmdrozdi.cz');
    await page.getByPlaceholder('Heslo').fill('wrongpassword');
    await page.getByRole('button', { name: 'Přihlásit' }).click();
    await expect(page.getByText('Přihlášení selhalo')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});
