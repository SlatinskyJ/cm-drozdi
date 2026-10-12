import { test, expect, type Page } from '@playwright/test';
import { ADMIN_AUTH, signInViaApi } from '../helpers/auth';
import {
  cleanupTestUsers,
  countSetPasswordTokens,
  createSetPasswordToken,
  createTestUser,
  getDeletedAt,
  getPasswordHash,
  resetDb,
  softDeleteUser,
} from '../helpers/db';

const PASSWORD = 'e2e-password-1234';

// Throwaway users created by this spec (auth tables are not truncated in resetDb)
const EMAILS = {
  adminDelete: 'deleted-admin-ui@e2e.example.com',
  staleLink: 'deleted-stale-link@e2e.example.com',
  signIn: 'deleted-sign-in@e2e.example.com',
  session: 'deleted-session@e2e.example.com',
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
async function submitPasswordLink(page: Page, token: string) {
  await page.goto(`/reset-password?token=${token}`);
  await page.getByPlaceholder('Nové heslo (min. 8 znaků)').fill('new-password-1234');
  await page.getByRole('button', { name: 'Nastavit heslo' }).click();
}

test.describe('Deleted member', () => {
  test('admin deleting a member kills their pending link, password and sessions', async ({
    browser,
    baseURL,
  }) => {
    const user = await createTestUser({
      email: EMAILS.adminDelete,
      name: 'Deleted Via UI',
      password: PASSWORD,
    });
    const token = await createSetPasswordToken(user.id);

    // The member has a live session before the delete
    const memberContext = await browser.newContext({ baseURL });
    const memberPage = await memberContext.newPage();
    expect((await signInViaApi(memberContext.request, EMAILS.adminDelete, PASSWORD)).status()).toBe(200);
    await memberPage.goto('/events');
    await expect(memberPage).toHaveURL('/events');

    // Admin deletes the member through the UI
    const adminContext = await browser.newContext({ baseURL, storageState: ADMIN_AUTH });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/members');
    await adminPage.locator('tr').filter({ hasText: 'Deleted Via UI' }).getByRole('button', { name: 'Smazat' }).click();
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(adminPage.getByRole('cell', { name: 'Deleted Via UI' })).not.toBeVisible();
    await expect.poll(() => getDeletedAt(user.id)).not.toBeNull();

    // The pending set-password link was removed and no longer works
    expect(await countSetPasswordTokens(user.id)).toBe(0);
    await submitPasswordLink(memberPage, token);
    await expect(memberPage.getByText('Neplatný odkaz.')).toBeVisible();
    expect(await getPasswordHash(user.id)).toBeNull();

    // The old session is gone and signing in again fails
    await memberPage.goto('/events');
    await expect(memberPage).toHaveURL('/login');
    expect((await signInViaApi(memberContext.request, EMAILS.adminDelete, PASSWORD)).ok()).toBe(false);

    await memberContext.close();
    await adminContext.close();
  });

  test('a set-password link that survived the delete is rejected', async ({ page }) => {
    const user = await createTestUser({ email: EMAILS.staleLink, name: 'Stale Link Member' });
    const activeToken = await createSetPasswordToken(user.id);
    const staleToken = await createSetPasswordToken(user.id);

    // Control: a link works while the member is active
    await submitPasswordLink(page, activeToken);
    await expect(page).toHaveURL('/login');
    const hashBefore = await getPasswordHash(user.id);
    expect(hashBefore).not.toBeNull();

    // Soft-delete only — the second token stays in the DB
    await softDeleteUser(user.id);
    await submitPasswordLink(page, staleToken);
    await expect(page.getByText('Neplatný odkaz.')).toBeVisible();
    expect(await getPasswordHash(user.id)).toBe(hashBefore);
    // The rejected token is burned
    expect(await countSetPasswordTokens(user.id)).toBe(0);
  });

  test('a deleted member who still has a password cannot sign in', async ({ request }) => {
    const user = await createTestUser({
      email: EMAILS.signIn,
      name: 'Sign In Member',
      password: PASSWORD,
    });

    // Control: the credentials work while the member is active
    expect((await signInViaApi(request, EMAILS.signIn, PASSWORD)).status()).toBe(200);

    // Soft-delete only — the credential account stays in the DB
    await softDeleteUser(user.id);
    expect((await signInViaApi(request, EMAILS.signIn, PASSWORD)).status()).toBe(403);
  });

  test('an existing session of a deleted member stops working', async ({ browser, baseURL }) => {
    const user = await createTestUser({
      email: EMAILS.session,
      name: 'Session Admin',
      role: 'admin',
      password: PASSWORD,
    });

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    expect((await signInViaApi(context.request, EMAILS.session, PASSWORD)).status()).toBe(200);

    // Control: the session grants access to pages and admin tRPC procedures
    await page.goto('/members');
    await expect(page.getByText('Členové')).toBeVisible();
    expect((await context.request.get('/api/trpc/member.list')).status()).toBe(200);

    // Soft-delete only — the session row stays in the DB
    await softDeleteUser(user.id);
    await page.goto('/members');
    await expect(page).toHaveURL('/login');
    expect((await context.request.get('/api/trpc/member.list')).status()).toBe(401);

    await context.close();
  });
});
