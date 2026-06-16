import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ADMIN_AUTH, MEMBER_AUTH } from './helpers/auth';

const DEV_PASSWORD = 'admin1234';

async function saveStorageState(email: string, password: string, outPath: string) {
  const baseUrl = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Sign-in failed for ${email}: HTTP ${response.status}`);
  }

  // getSetCookie() returns each Set-Cookie header separately (Node 22 undici)
  const rawCookies: string[] = (response.headers as any).getSetCookie?.()
    ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);

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
  execSync('YARN_IGNORE_ENGINES=1 yarn db:seed', { stdio: 'inherit' });

  const adminEmail = process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? 'admin@cmdrozdi.cz';

  await saveStorageState(adminEmail, DEV_PASSWORD, ADMIN_AUTH);
  await saveStorageState('member@cmdrozdi.cz', DEV_PASSWORD, MEMBER_AUTH);

  console.log('✔ Auth storageState saved to e2e/.auth/');
}
