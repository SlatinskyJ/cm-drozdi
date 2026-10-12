import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

const AUTH_DIR = path.join(process.cwd(), 'e2e/.auth');

export const ADMIN_AUTH = path.join(AUTH_DIR, 'admin.json');
export const MEMBER_AUTH = path.join(AUTH_DIR, 'member.json');

/** Origin header for Better Auth POSTs — it rejects null/missing origins (CSRF protection). */
export const AUTH_ORIGIN = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';

/**
 * Signs in through Better Auth's email endpoint. Session cookies land in the
 * request context (and its browser context, if any). Better Auth rate-limits
 * sign-in to 3 requests / 10 s in production builds, so a 429 is waited out
 * and retried rather than mistaken for a refused sign-in; if it is still
 * rate-limited after 4 attempts this throws, so no caller can mistake a 429
 * for a refusal.
 */
export async function signInViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  for (let attempt = 1; ; attempt++) {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email, password },
      headers: { Origin: AUTH_ORIGIN },
    });
    if (response.status() !== 429) return response;
    if (attempt === 4) throw new Error('sign-in still rate-limited after 4 attempts');
    const retryAfter = Number(response.headers()['x-retry-after'] ?? '10');
    await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
  }
}
