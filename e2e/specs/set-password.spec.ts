import { test, expect, type Page } from '@playwright/test';
import { signInViaApi } from '../helpers/auth';
import {
  cleanupTestUsers,
  countSetPasswordTokens,
  createSetPasswordToken,
  createTestUser,
  getPasswordHash,
  resetDb,
} from '../helpers/db';

// No storageState — these tests sign in with the password the link sets

const OLD_PASSWORD = 'old-password-1234';
const NEW_PASSWORD = 'new-password-1234';

// Throwaway users created by this spec (auth tables are not truncated in resetDb)
const EMAILS = {
  invite: 'set-password-invite@e2e.example.com',
  reset: 'set-password-reset@e2e.example.com',
};

test.beforeAll(async () => {
  await cleanupTestUsers(Object.values(EMAILS));
});

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await cleanupTestUsers(Object.values(EMAILS));
});

/** Submits a new password through the public set-password page. */
async function submitPasswordLink(page: Page, token: string, password: string) {
  await page.goto(`/reset-password?token=${token}`);
  await page.getByPlaceholder('Nové heslo (min. 8 znaků)').fill(password);
  await page.getByRole('button', { name: 'Nastavit heslo' }).click();
}

test.describe('Set-password link', () => {
  test('a new member sets a password through the link and signs in with it', async ({
    page,
  }) => {
    const user = await createTestUser({ email: EMAILS.invite, name: 'Invited Member' });
    const token = await createSetPasswordToken(user.id);
    expect(await getPasswordHash(user.id)).toBeNull();

    // Setting the password succeeds and sends the member to the login page
    await submitPasswordLink(page, token, NEW_PASSWORD);
    await expect(page).toHaveURL('/login');
    expect(await getPasswordHash(user.id)).not.toBeNull();
    expect(await countSetPasswordTokens(user.id)).toBe(0);

    // The stored password signs in through the login form
    await page.getByPlaceholder('E-mail').fill(EMAILS.invite);
    await page.getByPlaceholder('Heslo').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Přihlásit' }).click();
    await expect(page).toHaveURL('/events');

    // The link is single-use
    const hashAfterFirstUse = await getPasswordHash(user.id);
    await submitPasswordLink(page, token, 'another-password-1234');
    await expect(page.getByText('Neplatný odkaz.')).toBeVisible();
    expect(await getPasswordHash(user.id)).toBe(hashAfterFirstUse);
  });

  test('a reset link replaces an existing password', async ({ page, request }) => {
    const user = await createTestUser({
      email: EMAILS.reset,
      name: 'Reset Member',
      password: OLD_PASSWORD,
    });

    // Sign-ins go through the separate `request` context, so the page stays
    // signed out and the set-password page can redirect to /login.
    // Control: the old password works before the reset
    expect((await signInViaApi(request, EMAILS.reset, OLD_PASSWORD)).status()).toBe(200);

    const token = await createSetPasswordToken(user.id);
    await submitPasswordLink(page, token, NEW_PASSWORD);
    await expect(page).toHaveURL('/login');

    // The existing credential was updated: old password refused, new one works
    expect((await signInViaApi(request, EMAILS.reset, OLD_PASSWORD)).status()).toBe(401);
    expect((await signInViaApi(request, EMAILS.reset, NEW_PASSWORD)).status()).toBe(200);
  });
});
