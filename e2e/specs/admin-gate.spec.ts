import { test, expect } from '@playwright/test';
import { MEMBER_AUTH } from '../helpers/auth';
import { resetDb } from '../helpers/db';

test.use({ storageState: MEMBER_AUTH });

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Admin gate', () => {
  test('member role visiting /members sees access forbidden page', async ({ page }) => {
    await page.goto('/members');
    // MembersLayout renders AccessForbiddenPage for non-admin authenticated users
    await expect(page.getByText('Přístup zakázán')).toBeVisible();
  });
});
