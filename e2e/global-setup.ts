import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { auth } from '../src/server/auth';

const AUTH_DIR = path.join(process.cwd(), 'e2e/.auth');
const DEV_PASSWORD = 'admin1234';

async function saveStorageState(email: string, password: string, outPath: string) {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`Sign-in failed for ${email}: HTTP ${response.status}`);
  }

  // Node 18+ API; getSetCookie() returns an array, one entry per Set-Cookie header
  const rawCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];

  const cookies = rawCookies.filter(Boolean).map((raw) => {
    const parts = raw.split(';').map((s) => s.trim());
    const nameValue = parts[0]!;
    const eqIdx = nameValue.indexOf('=');
    return {
      name: nameValue.slice(0, eqIdx),
      value: nameValue.slice(eqIdx + 1),
      domain: 'localhost',
      path:
        parts.find((p) => p.toLowerCase().startsWith('path='))?.split('=')[1] ?? '/',
      expires: -1,
      httpOnly: parts.some((p) => p.toLowerCase() === 'httponly'),
      secure: false,
      sameSite: (parts
        .find((p) => p.toLowerCase().startsWith('samesite='))
        ?.split('=')[1] ?? 'Lax') as 'Lax' | 'Strict' | 'None',
    };
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ cookies, origins: [] }, null, 2));
}

export default async function globalSetup() {
  // Migrate and seed — idempotent; safe to re-run even if CI steps already did this
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  execSync('yarn db:seed', { stdio: 'inherit' });

  await saveStorageState(
    process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? 'admin@cmdrozdi.cz',
    DEV_PASSWORD,
    path.join(AUTH_DIR, 'admin.json'),
  );

  await saveStorageState(
    'member@cmdrozdi.cz',
    DEV_PASSWORD,
    path.join(AUTH_DIR, 'member.json'),
  );

  console.log('✔ Auth storageState saved to e2e/.auth/');
}
