import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

const AUTH_DIR = path.join(process.cwd(), 'e2e/.auth');

export const ADMIN_AUTH = path.join(AUTH_DIR, 'admin.json');
export const MEMBER_AUTH = path.join(AUTH_DIR, 'member.json');

/**
 * Signs in through Better Auth's email endpoint. Session cookies land in the
 * request context (and its browser context, if any). Better Auth rate-limits
 * sign-in to 3 requests / 10 s in production builds, so a 429 is waited out
 * and retried rather than mistaken for a refused sign-in.
 */
export async function signInViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  // Origin must match BETTER_AUTH_URL — Better Auth rejects null/missing origins (CSRF protection)
  const origin = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
  for (let attempt = 1; ; attempt++) {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email, password },
      headers: { Origin: origin },
    });
    if (response.status() !== 429 || attempt === 4) return response;
    const retryAfter = Number(response.headers()['x-retry-after'] ?? '10');
    await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
  }
}
