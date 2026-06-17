import { test, expect } from '@playwright/test';
import { ADMIN_AUTH } from '../helpers/auth';
import { resetDb, cleanupTestUsers } from '../helpers/db';

test.use({ storageState: ADMIN_AUTH });

// Unique emails for throwaway users created by this spec
const TEST_EMAILS = [
  'test-new@e2e.example.com',
  'test-role@e2e.example.com',
  'test-delete@e2e.example.com',
];

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  // Auth tables are not truncated in resetDb, so explicitly delete throwaway users
  // created during this spec (handles cleanup even if a test fails before UI deletion)
  await cleanupTestUsers(TEST_EMAILS);
});

test.describe('Members', () => {
  test('members list renders seeded admin and member', async ({ page }) => {
    const adminEmail = process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? 'admin@cmdrozdi.cz';
    await page.goto('/members');
    await expect(page.getByText('Členové')).toBeVisible();
    await expect(page.getByText(adminEmail)).toBeVisible();
    await expect(page.getByText('member@cmdrozdi.cz')).toBeVisible();
  });

  test('create member form — submit without name does not add a row', async ({ page }) => {
    await page.goto('/members');
    // Wait for the member list to load before capturing the baseline row count
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const rowsBefore = await page.locator('tbody tr').count();
    // Fill email but not name — HTML required on name blocks submission
    await page.getByPlaceholder('E-mail').fill('test-new@e2e.example.com');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(rowsBefore);
  });

  test('creates a member successfully', async ({ page }) => {
    await page.goto('/members');
    await page.getByPlaceholder('Jméno').fill('New E2E Member');
    await page.getByPlaceholder('E-mail').fill('test-new@e2e.example.com');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText('Člen vytvořen.')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'New E2E Member' })).toBeVisible();
  });

  test('role change dropdown updates the member role', async ({ page }) => {
    // Create a throwaway member to modify
    await page.goto('/members');
    await page.getByPlaceholder('Jméno').fill('Role Test Member');
    await page.getByPlaceholder('E-mail').fill('test-role@e2e.example.com');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText('Člen vytvořen.')).toBeVisible();

    const row = page.locator('tr').filter({ hasText: 'Role Test Member' });
    await row.getByRole('combobox').selectOption('admin');
    // The select value updates immediately; after mutation + list invalidation it stays
    await expect(row.getByRole('combobox')).toHaveValue('admin');
  });

  test('deletes a member via confirm modal', async ({ page }) => {
    // Create a throwaway member to delete
    await page.goto('/members');
    await page.getByPlaceholder('Jméno').fill('Delete Test Member');
    await page.getByPlaceholder('E-mail').fill('test-delete@e2e.example.com');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText('Člen vytvořen.')).toBeVisible();

    // Click the row's Smazat button to open the confirm modal
    const row = page.locator('tr').filter({ hasText: 'Delete Test Member' });
    await row.getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Opravdu smazat člena Delete Test Member?')).toBeVisible();

    // Confirm deletion
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByRole('cell', { name: 'Delete Test Member' })).not.toBeVisible();
  });
});
