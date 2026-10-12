import { test, expect, type Page } from '@playwright/test';
import { ADMIN_AUTH, AUTH_ORIGIN, signInViaApi } from '../helpers/auth';
import {
  cleanupTestUsers,
  countSessions,
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
  impersonator: 'deleted-impersonator@e2e.example.com',
  impersonated: 'impersonated-member@e2e.example.com',
  staleImpersonator: 'deleted-stale-impersonator@e2e.example.com',
  staleImpersonated: 'stale-impersonated-member@e2e.example.com',
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

/** Deletes a member through the admin UI and waits for the delete to land. */
async function deleteViaAdminUi(page: Page, name: string, userId: string) {
  await page.goto('/members');
  await page.locator('tr').filter({ hasText: name }).getByRole('button', { name: 'Smazat' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByRole('cell', { name })).not.toBeVisible();
  await expect.poll(() => getDeletedAt(userId)).not.toBeNull();
}

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
    await deleteViaAdminUi(adminPage, 'Deleted Via UI', user.id);

    // The pending set-password link was removed and no longer works
    expect(await countSetPasswordTokens(user.id)).toBe(0);
    await submitPasswordLink(memberPage, token);
    await expect(memberPage.getByText('Neplatný odkaz.')).toBeVisible();
    expect(await getPasswordHash(user.id)).toBeNull();

    // The old session is gone and signing in again fails
    await memberPage.goto('/events');
    await expect(memberPage).toHaveURL('/login');
    // The credential was deleted, so this is a plain wrong-credentials refusal
    expect((await signInViaApi(memberContext.request, EMAILS.adminDelete, PASSWORD)).status()).toBe(401);

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

    // Control: the session grants access to pages, admin tRPC procedures,
    // Better Auth's admin API and get-session
    await page.goto('/members');
    await expect(page.getByText('Členové')).toBeVisible();
    expect((await context.request.get('/api/trpc/member.list')).status()).toBe(200);
    const listUrl = '/api/auth/admin/list-users';
    expect((await context.request.get(listUrl, { headers: { Origin: AUTH_ORIGIN } })).status()).toBe(200);
    const before = await context.request.get('/api/auth/get-session');
    expect(before.status()).toBe(200);
    expect(((await before.json()) as { user?: { id?: string } } | null)?.user?.id).toBe(user.id);

    // Soft-delete only — the session row stays in the DB
    await softDeleteUser(user.id);
    expect(await countSessions({ userId: user.id })).toBeGreaterThan(0);
    await page.goto('/members');
    await expect(page).toHaveURL('/login');
    expect((await context.request.get('/api/trpc/member.list')).status()).toBe(401);

    // Better Auth's own endpoints refuse the leftover session too
    const list = await context.request.get(listUrl, { headers: { Origin: AUTH_ORIGIN } });
    expect(list.status()).toBe(403);
    expect(((await list.json()) as { code?: string }).code).toBe('USER_DELETED');
    // ...and get-session reports no session and expires the cookie
    const after = await context.request.get('/api/auth/get-session');
    expect(after.status()).toBe(200);
    expect(await after.json()).toBeNull();
    const setCookie = after
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .join('\n');
    expect(setCookie).toMatch(/(?:__Secure-)?better-auth\.session_token=;[^\n]*Max-Age=0/i);
    expect((await context.cookies()).some((c) => c.name.endsWith('session_token'))).toBe(false);

    await context.close();
  });

  test('deleting an admin also ends the impersonation sessions they started', async ({
    browser,
    baseURL,
  }) => {
    const impersonator = await createTestUser({
      email: EMAILS.impersonator,
      name: 'Impersonating Admin',
      role: 'admin',
      password: PASSWORD,
    });
    const target = await createTestUser({ email: EMAILS.impersonated, name: 'Impersonated Member' });

    // The admin signs in and impersonates a member; the impersonation
    // session belongs to the member, with impersonatedBy = the admin
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    expect((await signInViaApi(context.request, EMAILS.impersonator, PASSWORD)).status()).toBe(200);
    const impersonate = await context.request.post('/api/auth/admin/impersonate-user', {
      data: { userId: target.id },
      headers: { Origin: AUTH_ORIGIN },
    });
    expect(impersonate.status()).toBe(200);
    expect(await countSessions({ impersonatedBy: impersonator.id })).toBe(1);
    await page.goto('/events');
    await expect(page).toHaveURL('/events');

    // Another admin deletes the impersonating admin
    const adminContext = await browser.newContext({ baseURL, storageState: ADMIN_AUTH });
    await deleteViaAdminUi(await adminContext.newPage(), 'Impersonating Admin', impersonator.id);

    // Every session of the deleted admin is gone, the impersonation included
    expect(await countSessions({ userId: impersonator.id })).toBe(0);
    expect(await countSessions({ impersonatedBy: impersonator.id })).toBe(0);
    await page.goto('/events');
    await expect(page).toHaveURL('/login');

    await context.close();
    await adminContext.close();
  });

  test('an impersonation session that outlived its admin stops working', async ({
    browser,
    baseURL,
  }) => {
    const impersonator = await createTestUser({
      email: EMAILS.staleImpersonator,
      name: 'Stale Impersonating Admin',
      role: 'admin',
      password: PASSWORD,
    });
    const target = await createTestUser({
      email: EMAILS.staleImpersonated,
      name: 'Stale Impersonated Member',
    });

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    expect((await signInViaApi(context.request, EMAILS.staleImpersonator, PASSWORD)).status()).toBe(
      200,
    );
    const impersonate = await context.request.post('/api/auth/admin/impersonate-user', {
      data: { userId: target.id },
      headers: { Origin: AUTH_ORIGIN },
    });
    expect(impersonate.status()).toBe(200);

    // Control: the impersonation session works while the admin is active
    await page.goto('/events');
    await expect(page).toHaveURL('/events');
    expect((await context.request.get('/api/trpc/event.getUpcoming')).status()).toBe(200);
    const listSessions = '/api/auth/list-sessions';
    expect((await context.request.get(listSessions, { headers: { Origin: AUTH_ORIGIN } })).status()).toBe(200);

    // Soft-delete only the admin — the impersonation session (owned by the
    // live member) stays in the DB, as when its insert races the delete
    await softDeleteUser(impersonator.id);
    expect(await countSessions({ impersonatedBy: impersonator.id })).toBe(1);

    await page.goto('/events');
    await expect(page).toHaveURL('/login');
    expect((await context.request.get('/api/trpc/event.getUpcoming')).status()).toBe(401);
    const list = await context.request.get(listSessions, { headers: { Origin: AUTH_ORIGIN } });
    expect(list.status()).toBe(403);
    expect(((await list.json()) as { code?: string }).code).toBe('USER_DELETED');
    const after = await context.request.get('/api/auth/get-session');
    expect(after.status()).toBe(200);
    expect(await after.json()).toBeNull();

    await context.close();
  });
});
