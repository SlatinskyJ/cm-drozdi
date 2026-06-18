# Phase 1 — Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: [`docs/superpowers/specs/2026-06-14-phase-1-better-auth.md`](../specs/2026-06-14-phase-1-better-auth.md). Master plan: [`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`](2026-06-11-dependency-upgrade-master-plan.md).
> Branch: `feat/upgrade-phase-1-better-auth` (forks from `develop`, PRs back into `develop`).

**Goal:** Replace NextAuth v4 (OAuth-only) with Better Auth (email+password, admin-created accounts, string roles, link-based password set/reset) on the current pre-upgrade stack — no framework bumps.

**Architecture:** Better Auth instance with the Prisma adapter + `admin` plugin (custom access control, string roles `guest`/`member`/`admin`). Sign-up disabled; members are admin-created with **no** password and activate via a copyable set-password link. Two small server helpers over `auth.$context.internalAdapter` provide the deterministic passwordless set/reset flow, exposed through a new `member` tRPC router. Full DB reset + seed (no migration history). Server layouts are the authoritative auth gate; middleware is an optimistic cookie check.

**Tech Stack:** Next 14 App Router, React 18, tRPC 11-rc, Prisma 5, Tailwind 3, NextUI (UI wrappers), Zod 3, TypeScript, Postgres, Yarn 1. **Add** `better-auth`, `tsx` (dev). **Remove** `next-auth`, `@auth/prisma-adapter`.

---

## Verification model (read first)

**There is no unit/E2E test suite in this phase** (E2E arrives in Phase 2). The verification gate is:

```bash
yarn install
npx prisma generate
yarn lint
npx tsc --noEmit
yarn build
```

Plus the manual smoke checklist in the spec (§Verification). Because TDD's red/green loop has no runner here, each task is verified by the **typecheck/lint subset that can pass at that point**, plus a targeted manual check. The auth swap has an **unavoidable broken window**: once `src/server/auth.ts` is rewritten, the old NextAuth importers won't compile until their call sites are migrated. Tasks 5–12 form that window; the **full gate is expected to fail inside it and is run as a single checkpoint at the end of Task 12**. Each task still commits a logical unit. Where a task *can* be green in isolation (Tasks 1–4), it is verified with `npx tsc --noEmit`.

**One spike task (Task 4) front-loads the highest risk**: confirming the version-specific `auth.$context` internal-adapter API the password-link helpers depend on, before any UI is built on them.

See the **Open Questions — RESOLVED** table at the end: all nine drafting-time unknowns were confirmed against the official Better Auth docs and the repo (2026-06-15). Only two residuals remain — the internal-adapter shapes (Task 4 spike) and the seed's transitive `next/headers` import (Task 15) — each with a defined resolution mechanism.

---

## File structure

**Create:**
- `src/server/auth-access.ts` — access-control statements + `guest`/`member`/`admin` role objects (shared by server plugin + client).
- `src/lib/auth-client.ts` — `createAuthClient` + `adminClient`, exports `signIn`/`signOut`/`useSession`.
- `src/server/auth-password-link.ts` — `generateSetPasswordUrl` + `setPasswordWithToken` helpers (§2a).
- `src/app/api/auth/[...all]/route.ts` — Better Auth Next handler.
- `src/server/api/routers/member.ts` — `member` tRPC router (create/list/setRole/delete/generatePasswordLink/setPassword).
- `src/app/login/page.tsx` — email+password sign-in page (renamed from any prior `/sign-in`).
- `src/app/reset-password/page.tsx` — set/reset password form (token from query).
- `src/app/members/layout.tsx` — admin-gated layout.
- `prisma/seed.ts` — idempotent, env-gated seed.
- `scripts/verify-auth-context.ts` (throwaway, deleted after Task 4) — internal-adapter API probe.

**Modify:**
- `src/enums/UserRole.ts` — Int → string enum.
- `src/server/auth.ts` — rewrite as Better Auth instance + `getServerAuthSession` + `SessionUser`/`AppSession` types.
- `src/middleware.ts` — `getSessionCookie` gate; matcher adds `login`/`reset-password`.
- `src/server/api/trpc.ts` — context type flows from new wrapper; add `adminProcedure`.
- `src/server/api/routers/index.ts`, `src/server/api/root.ts` — register `member` router.
- `src/utils/permissions.ts` — `useIsAdmin` onto `authClient.useSession`.
- `src/app/layout.tsx` — remove `<Login/>`.
- `src/app/_components/Menu.tsx` — add "Odhlásit"; hide "Členové" for non-admins.
- `src/app/events/layout.tsx` — harden gate (null session → redirect).
- `src/app/members/page.tsx` — full members admin UI.
- `prisma/schema.prisma` — Better Auth models, drop `Post`, reconnect domain relations, `deletedAt`, cascades.
- `src/env.js`, `.env.example` — swap env vars.
- `package.json` — deps + `db:seed` script.

**Delete:**
- `src/app/_components/Login.tsx`
- `src/app/api/auth/[...nextauth]/route.ts` (and its directory)

---

## Task 1: `UserRole` enum → string values

**Files:**
- Modify: `src/enums/UserRole.ts`

- [ ] **Step 1: Change enum to string values**

```ts
export enum UserRole {
	GUEST = 'guest',
	MEMBER = 'member',
	ADMIN = 'admin',
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. All comparisons (`=== UserRole.GUEST` in `events/layout.tsx`, `=== UserRole.ADMIN` in `permissions.ts`) compare against the enum, not a literal, so they still compile. (At runtime they now compare strings — correct once sessions provide string roles; the old NextAuth numeric role is being removed anyway.)

- [ ] **Step 3: Commit**

```bash
git add src/enums/UserRole.ts
git commit -m "refactor: make UserRole a string enum (guest/member/admin)"
```

---

## Task 2: Dependencies + env vars

Add Better Auth and `tsx`; swap env vars. **`next-auth` and `@auth/prisma-adapter` stay installed until Task 14** (their last importers are removed there) to keep the broken window short. Old env vars (`NEXTAUTH_*`, `DISCORD_*`, `FACEBOOK_*`) are referenced by the still-present old `auth.ts`, so they are **removed in Task 6** (the `auth.ts` rewrite), not here — here we only **add** the new ones.

**Files:**
- Modify: `package.json`
- Modify: `src/env.js`
- Modify: `.env.example`

- [ ] **Step 1: Add dependencies**

```bash
yarn add better-auth
yarn add -D tsx
```

- [ ] **Step 2: Add `db:seed` script to `package.json`**

In the `scripts` block add (the `--env-file` loads `.env`, since `tsx` — unlike `next` — does not auto-load it; Node 22 + tsx v4 support the flag):

```json
"db:seed": "tsx --env-file=.env prisma/seed.ts",
```

- [ ] **Step 3: Add new env vars to `src/env.js`** (keep the old ones for now)

In the `server` schema object, add these keys alongside the existing ones:

```js
		BETTER_AUTH_SECRET:
			process.env.NODE_ENV === 'production'
				? z.string()
				: z.string().optional(),
		BETTER_AUTH_URL: z.preprocess(
			(str) =>
				process.env.VERCEL_URL
					? `https://${process.env.VERCEL_URL}`
					: str,
			z.string().url(),
		),
		// Required in production (no default); dev/test fall back to 'admin@cmdrozdi.cz'.
		BOOTSTRAP_ADMIN_EMAIL:
			process.env.NODE_ENV === 'production'
				? z.string().email()
				: z.string().email().default('admin@cmdrozdi.cz'),
```

In `runtimeEnv`, add:

```js
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
```

- [ ] **Step 4: Add new vars to `.env.example`**

```bash
# Better Auth
# Generate a secret: openssl rand -base64 32
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"
BOOTSTRAP_ADMIN_EMAIL="admin@cmdrozdi.cz"
```

- [ ] **Step 5: Set the new vars in local `.env`** (not committed)

Add `BETTER_AUTH_SECRET` (run `openssl rand -base64 32`), `BETTER_AUTH_URL=http://localhost:3000`, `BOOTSTRAP_ADMIN_EMAIL=admin@cmdrozdi.cz` to `.env`.

- [ ] **Step 6: Verify install + typecheck**

Run: `yarn install && npx tsc --noEmit`
Expected: PASS (old auth code still compiles; new vars are additive).

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock src/env.js .env.example
git commit -m "build: add better-auth + tsx, add BETTER_AUTH_* env vars"
```

---

## Task 3: Access-control module

Define the access-control statements and role objects once, shared by the server plugin (Task 6) and the client (Task 7).

**Files:**
- Create: `src/server/auth-access.ts`

> ✓ **Confirmed against Better Auth docs** (resolved 2026-06-15): `createAccessControl` from `better-auth/plugins/access`; `defaultStatements` + `adminAc` from `better-auth/plugins/admin/access`; admin merges `...adminAc.statements`. The code below is the documented pattern verbatim.

- [ ] **Step 1: Write the access-control module**

```ts
import { createAccessControl } from 'better-auth/plugins/access';
import {
	adminAc,
	defaultStatements,
} from 'better-auth/plugins/admin/access';

/**
 * Access-control statements for the admin plugin. We reuse the plugin's
 * default `user`/`session` statements so admin endpoints
 * (createUser/setRole/listUsers/removeUser/revokeUserSessions) authorize
 * correctly.
 */
export const statement = {
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const guest = ac.newRole({});
export const member = ac.newRole({});
export const admin = ac.newRole({
	...adminAc.statements,
});

export const roles = { guest, member, admin };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (nothing imports this yet).

- [ ] **Step 3: Commit**

```bash
git add src/server/auth-access.ts
git commit -m "feat: add Better Auth access-control roles (guest/member/admin)"
```

---

## Task 4: Spike — confirm `auth.$context` internal-adapter API

**Highest-risk piece first.** Before building helpers/UI on the internal adapter, confirm the method names exist in the installed `better-auth`. This requires a minimal Better Auth instance, so this task also creates a *first cut* of `src/server/auth.ts` that later tasks finalize. The DB must be running (`./start-database.sh`).

**Files:**
- Create: `src/server/auth.ts` (first cut — finalized in Task 6)
- Create (throwaway): `scripts/verify-auth-context.ts`

- [ ] **Step 1: Write a first-cut Better Auth instance**

```ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';

import { ac, roles } from '~/server/auth-access';
import { env } from '~/env';
import { db } from '~/server/db';

export const auth = betterAuth({
	database: prismaAdapter(db, { provider: 'postgresql' }),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: [env.BETTER_AUTH_URL],
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
	},
	user: {
		additionalFields: {
			deletedAt: { type: 'date', required: false, input: false },
		},
	},
	plugins: [admin({ ac, roles, adminRoles: ['admin'], defaultRole: 'guest' })],
});
```

- [ ] **Step 2: Write the probe script**

`scripts/verify-auth-context.ts`:

```ts
import { auth } from '~/server/auth';

async function main() {
	const ctx = await auth.$context;
	const internal = ctx.internalAdapter;
	const expected = [
		'createVerificationValue',
		'findVerificationValue',
		'deleteVerificationValue',
		'linkAccount',
		'updatePassword',
		'findAccounts',
	] as const;
	for (const name of expected) {
		console.log(
			`internalAdapter.${name}:`,
			typeof (internal as Record<string, unknown>)[name],
		);
	}
	console.log('password.hash:', typeof ctx.password?.hash);
	console.log(
		'password.config.minPasswordLength:',
		ctx.password?.config?.minPasswordLength,
	);
}

void main().then(() => process.exit(0));
```

- [ ] **Step 3: Run the probe**

Run: `npx tsx scripts/verify-auth-context.ts`
Expected: every line prints `function` (and `minPasswordLength: 8`). **If any prints `undefined`,** find the real name in `node_modules/better-auth` (grep the package types) and record the correction in the plan's Open Questions before continuing — Tasks 8/9 depend on these exact names.

- [ ] **Step 4: Delete the throwaway probe**

```bash
rm scripts/verify-auth-context.ts
```

- [ ] **Step 5: Commit the first-cut instance**

```bash
git add src/server/auth.ts
git commit -m "feat: add first-cut Better Auth instance; verify $context internal adapter"
```

> Note: after this commit, `src/server/auth.ts` no longer exports `authOptions`/`getServerAuthSession`, so `src/app/api/auth/[...nextauth]/route.ts`, `src/app/_components/Login.tsx`, `src/app/layout.tsx`, `src/server/api/trpc.ts`, and `src/app/events/layout.tsx` **stop compiling**. This opens the broken window — proceed through Tasks 5–12, with the full-gate checkpoint at the end of Task 12.

---

## Task 5: Prisma schema + DB reset

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Generate Better Auth models against a copy**

Run `npx @better-auth/cli generate` and **review the diff** — it rewrites `schema.prisma`. It should add/update `User` (with `role`, `banned`, `banReason`, `banExpires`, and `deletedAt` from `additionalFields`), `Session`, `Account`, `Verification`. Confirm it did **not** clobber `Event`, `Instrument`, `UsersOnEvents`, `InstrumentsOnUsers`. If it did, merge by hand.

> ✓ **Confirmed from docs:** Better Auth CLI Prisma **schema generation is supported** (schema *migration* is not — irrelevant, we use `db push`). It generates models from the auth config + enabled plugins. Docs don't guarantee it preserves unrelated domain models, so the diff-and-merge mitigation stays: keep a pre-gen copy (`git stash`/branch) and merge by hand if it touches `Event`/`Instrument`/join tables. The CLI may prompt for the config path — point it at `src/server/auth.ts`.

- [ ] **Step 2: Reconcile domain models in `prisma/schema.prisma`**

Ensure the final schema:
- Keeps `Event`, `Instrument`, `UsersOnEvents`, `InstrumentsOnUsers`.
- Reconnects `User.UsersOnEvents` and `User.InstrumentsOnUsers` relations onto the generated `User`.
- Adds `onDelete: Cascade` to the `user` relation on **both** `UsersOnEvents` and `InstrumentsOnUsers`:

```prisma
model UsersOnEvents {
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  event     Event    @relation(fields: [eventId], references: [id])
  eventId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@id([userId, eventId])
}

model InstrumentsOnUsers {
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  instrument   Instrument @relation(fields: [instrumentId], references: [id])
  instrumentId String

  @@id([userId, instrumentId])
}
```

- **Drop `Post`** entirely and remove the `User.posts` back-relation.
- Confirm `deletedAt DateTime?` exists on `User`.

- [ ] **Step 3: Reset + regenerate the DB**

Ensure the local Postgres is running (`./start-database.sh`), then:

```bash
npx prisma db push --force-reset
npx prisma generate
```

Expected: schema applied; client regenerated. (Dev-only, wipes events — never run against prod.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — same error set as after Task 4 (`src/app/api/auth/[...nextauth]/route.ts`, `src/app/_components/Login.tsx`, `src/app/layout.tsx`, `src/server/api/trpc.ts`, `src/app/events/layout.tsx`). The point is to confirm the **regenerated Prisma client introduces no new errors** against the existing domain-model queries (`event` router, etc.) before building Tasks 6–12 on top of it.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: Better Auth Prisma schema; drop Post; cascade join tables; DB reset"
```

---

## Task 6: Finalize `auth.ts` — `getServerAuthSession`, types, env cleanup

**Files:**
- Modify: `src/server/auth.ts`
- Modify: `src/env.js`
- Modify: `.env.example`

- [ ] **Step 1: Add the session wrapper + inferred types to `auth.ts`**

Append to `src/server/auth.ts`:

```ts
import { headers } from 'next/headers';
import type { UserRole } from '~/enums/UserRole';

type InferredUser = (typeof auth.$Infer.Session)['user'];
export type SessionUser = Omit<InferredUser, 'role'> & { role: UserRole };
export type AppSession = {
	session: (typeof auth.$Infer.Session)['session'];
	user: SessionUser;
};

/**
 * Server-side session accessor. `await headers()` works on Next 14 (awaiting
 * the sync return is a no-op) and is forward-compatible with Next 15+ where
 * `headers()` becomes async (Phase 5). Returns `null` when unauthenticated.
 */
export const getServerAuthSession = async (): Promise<AppSession | null> => {
	const session = await auth.api.getSession({ headers: await headers() });
	return session as AppSession | null;
};
```

> ✓ **Confirmed against Better Auth Next.js docs:** `auth.api.getSession({ headers: await headers() })` is the documented server-component pattern. `await headers()` is used deliberately for Next 15 forward-compat; it's a harmless no-op on Next 14's sync `headers()`.

- [ ] **Step 2: Remove old env vars from `src/env.js`**

Delete `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` from both the `server` schema and `runtimeEnv`. Keep `DATABASE_URL`, `NODE_ENV`, and the three `BETTER_AUTH_*`/`BOOTSTRAP_ADMIN_EMAIL` vars added in Task 2.

- [ ] **Step 3: Remove old vars from `.env.example`**

Delete the `# Next Auth`, `NEXTAUTH_URL`, and Discord/Facebook provider blocks. Leave the Prisma + Better Auth blocks.

- [ ] **Step 4: Typecheck the file in isolation**

Run: `npx tsc --noEmit`
Expected: FAIL — but only on the NextAuth importers (route handler, Login, trpc, events layout, layout). Confirm there are **no** errors originating inside `src/server/auth.ts` or `src/env.js` themselves. (Those get fixed in Tasks 7–14.)

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts src/env.js .env.example
git commit -m "feat: finalize Better Auth getServerAuthSession + session types; drop NextAuth env vars"
```

---

## Task 7: Client — `auth-client.ts` + `useIsAdmin`

**Files:**
- Create: `src/lib/auth-client.ts`
- Modify: `src/utils/permissions.ts`

- [ ] **Step 1: Write the client**

`src/lib/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

// baseURL omitted → defaults to same-origin (no client env var needed).
export const authClient = createAuthClient({
	plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 2: Rewrite `useIsAdmin`**

`src/utils/permissions.ts`:

```ts
import { authClient } from '~/lib/auth-client';
import { UserRole } from '~/enums/UserRole';

export function useIsAdmin(): boolean {
	const { data } = authClient.useSession();
	return (data?.user.role as UserRole) === UserRole.ADMIN;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: still failing only on the remaining NextAuth importers (route, Login, trpc, layouts). No new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-client.ts src/utils/permissions.ts
git commit -m "feat: add Better Auth client; rewrite useIsAdmin onto useSession"
```

---

## Task 8: Password-link helpers (§2a)

Uses the internal-adapter API confirmed in Task 4. **If the spike found different names, substitute them here.**

**Files:**
- Create: `src/server/auth-password-link.ts`

- [ ] **Step 1: Write the helpers**

```ts
import { randomUUID } from 'crypto';

import { auth } from '~/server/auth';
import { env } from '~/env';
import { db } from '~/server/db';

const PREFIX = 'set-password:';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, passwordless user
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour, existing credential

/**
 * Mint a one-time set/reset-password URL for a user. Auto-picks expiry by
 * credential presence: no credential → 7-day invite; has credential → 1-hour
 * reset. Returning the URL *is* the deliver seam (an email sender can later
 * send it instead). Server-side only (admin tRPC mutation + seed).
 *
 * Invalidates any previously-issued, still-valid set-password tokens for this
 * user first, so at most one link is ever usable at a time.
 */
export async function generateSetPasswordUrl(userId: string): Promise<string> {
	const ctx = await auth.$context;
	const accounts = await ctx.internalAdapter.findAccounts(userId);
	const hasCredential = accounts.some((a) => a.providerId === 'credential');
	const ttl = hasCredential ? RESET_TTL_MS : INVITE_TTL_MS;

	await db.verification.deleteMany({
		where: { value: userId, identifier: { startsWith: PREFIX } },
	});

	const token = randomUUID();
	await ctx.internalAdapter.createVerificationValue({
		identifier: PREFIX + token,
		value: userId,
		expiresAt: new Date(Date.now() + ttl),
	});

	return `${env.BETTER_AUTH_URL}/reset-password?token=${token}`;
}

/**
 * Consume a set/reset token and set the user's password. Creates the
 * `credential` account on first use (passwordless → active), otherwise updates
 * the existing password. One-time: the verification value is deleted.
 */
export async function setPasswordWithToken(
	token: string,
	newPassword: string,
): Promise<void> {
	const ctx = await auth.$context;
	const record = await ctx.internalAdapter.findVerificationValue(
		PREFIX + token,
	);
	if (!record) throw new Error('INVALID_TOKEN');
	if (record.expiresAt < new Date()) {
		await ctx.internalAdapter.deleteVerificationValue(record.id);
		throw new Error('EXPIRED_TOKEN');
	}

	const minLength = ctx.password.config.minPasswordLength;
	if (newPassword.length < minLength) throw new Error('PASSWORD_TOO_SHORT');

	const userId = record.value;
	const hash = await ctx.password.hash(newPassword);
	const accounts = await ctx.internalAdapter.findAccounts(userId);
	const hasCredential = accounts.some((a) => a.providerId === 'credential');

	if (!hasCredential) {
		await ctx.internalAdapter.linkAccount({
			userId,
			accountId: userId,
			providerId: 'credential',
			password: hash,
		});
	} else {
		await ctx.internalAdapter.updatePassword(userId, hash);
	}

	await ctx.internalAdapter.deleteVerificationValue(record.id);
}
```

> ⚠️ **Residual (version-internal, resolved by the Task 4 spike):** `internalAdapter` is an internal API not covered by published docs, so the exact shapes of `findVerificationValue` return (`.id`/`.value`/`.expiresAt`), `createVerificationValue`, `linkAccount`, `updatePassword` args are confirmed against `node_modules/better-auth` types in Task 4. Adjust to match; the control flow stays as written.
>
> **Task 4 spike finding (correction):** `internalAdapter.deleteVerificationValue` **does not exist**. The installed `better-auth@1.6.18`'s `InternalAdapter` (`node_modules/better-auth/node_modules/@better-auth/core/dist/types/context.d.mts`) instead exposes `deleteVerificationByIdentifier(identifier: string): Promise<void>` and `consumeVerificationValue(identifier: string): Promise<Verification | null>` (atomic find+delete). All other expected names — `createVerificationValue`, `findVerificationValue`, `linkAccount`, `updatePassword`, `findAccounts`, `password.hash`, `password.config.minPasswordLength` — matched as expected. **Implementation guidance for the two helpers below:** replace the two `ctx.internalAdapter.deleteVerificationValue(record.id)` calls with `ctx.internalAdapter.deleteVerificationByIdentifier(PREFIX + token)`. Optionally, `setPasswordWithToken` may use `consumeVerificationValue(PREFIX + token)` in place of `findVerificationValue` + delete for atomicity — either approach is acceptable.
>
> **Fallback if `internalAdapter` proves awkward:** the admin plugin exposes a public `auth.api.setUserPassword` endpoint (confirmed in docs). It sets a credential directly but requires an admin session and doesn't carry the token-link semantics, so it's a fallback for the credential-creation step only — not a replacement for the token flow.
>
> **`db.verification` dependency:** the stale-token cleanup in `generateSetPasswordUrl` queries the Prisma `Verification` model directly (not via `internalAdapter`). That model is generated by Task 5's schema regen, which now runs *before* this task — so `db.verification` typechecks correctly here.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (still failing on remaining NextAuth importers). If `internalAdapter` field/arg shapes mismatch, fix them now using the installed types.

- [ ] **Step 3: Commit**

```bash
git add src/server/auth-password-link.ts
git commit -m "feat: add passwordless set/reset link helpers (generate + consume)"
```

---

## Task 9: Route handler swap

**Files:**
- Create: `src/app/api/auth/[...all]/route.ts`
- Delete: `src/app/api/auth/[...nextauth]/route.ts` (and the now-empty `[...nextauth]` dir)

- [ ] **Step 1: Write the new handler**

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '~/server/auth';

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 2: Delete the NextAuth handler**

```bash
git rm src/app/api/auth/\[...nextauth\]/route.ts
rmdir "src/app/api/auth/[...nextauth]" 2>/dev/null || true
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: the `[...nextauth]` error is gone; remaining errors only in `Login.tsx`, `layout.tsx`, `trpc.ts`, `events/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth
git commit -m "feat: mount Better Auth Next handler at [...all]; remove NextAuth route"
```

---

## Task 10: Middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Replace with the optimistic cookie gate**

```ts
import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(req: NextRequest) {
	const sessionCookie = getSessionCookie(req);
	if (!sessionCookie) {
		return NextResponse.redirect(new URL('/login', req.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|auth|login|reset-password|favicon.ico|images|sitemap.xml|robots.txt|$).*)',
	],
};
```

Note: `login` and `reset-password` added to exclusions so they're reachable unauthenticated; `api` and `/` already excluded (handler + public landing intact). This is presence-only — the server layouts (Task 12) are authoritative.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no middleware errors; remaining errors only in `Login.tsx`, `layout.tsx`, `trpc.ts`, `events/layout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: swap middleware to Better Auth optimistic cookie gate"
```

---

## Task 11: tRPC context + `adminProcedure`

**Files:**
- Modify: `src/server/api/trpc.ts`

- [ ] **Step 1: Add the `UserRole` import + `adminProcedure`**

The context already calls `await getServerAuthSession()` (line 33) — that now resolves the Better Auth wrapper (`AppSession | null`), so the context type flows automatically; **no change needed to `createTRPCContext` or `protectedProcedure`**. Add an `adminProcedure` after `protectedProcedure`:

Add the import near the top:

```ts
import { UserRole } from '~/enums/UserRole';
```

Add at the end of the file:

```ts
/**
 * Admin-only procedure. Builds on `protectedProcedure` and asserts the session
 * user's role is ADMIN. Used by the `member` router (§8).
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.session.user.role !== UserRole.ADMIN) {
		throw new TRPCError({ code: 'FORBIDDEN' });
	}
	return next({ ctx });
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no `trpc.ts` errors; remaining errors only in `Login.tsx`, `layout.tsx`, `events/layout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/trpc.ts
git commit -m "feat: add adminProcedure; tRPC context now uses Better Auth session"
```

---

## Task 12: Layouts — harden gates, remove `<Login/>`, close the broken window

**Files:**
- Modify: `src/app/events/layout.tsx`
- Create: `src/app/members/layout.tsx`
- Modify: `src/app/layout.tsx`
- Delete: `src/app/_components/Login.tsx`

- [ ] **Step 1: Harden `events/layout.tsx`**

```tsx
import { GeistSans } from 'geist/font/sans';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import AccessForbiddenPage from '~/app/_components/AccessForbidden';
import { UserRole } from '~/enums/UserRole';
import { getServerAuthSession } from '~/server/auth';

export default async function EventsLayout({
	children,
}: Readonly<{ children: ReactNode }>) {
	const session = await getServerAuthSession();

	if (!session) redirect('/login');
	if (session.user.role === UserRole.GUEST) {
		return <AccessForbiddenPage />;
	}

	return <div className={GeistSans.className}>{children}</div>;
}
```

- [ ] **Step 2: Create admin-gated `members/layout.tsx`**

```tsx
import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import AccessForbiddenPage from '~/app/_components/AccessForbidden';
import { UserRole } from '~/enums/UserRole';
import { getServerAuthSession } from '~/server/auth';

export default async function MembersLayout({
	children,
}: Readonly<{ children: ReactNode }>) {
	const session = await getServerAuthSession();

	if (!session) redirect('/login');
	if (session.user.role !== UserRole.ADMIN) {
		return <AccessForbiddenPage />;
	}

	return <>{children}</>;
}
```

- [ ] **Step 3: Remove `<Login/>` from `src/app/layout.tsx`**

Delete the `import Login from '~/app/_components/Login';` line and the `<Login />` element. The `session` fetch can stay (it still gates whether `<Menu/>` renders):

```tsx
						<div className="absolute right-4 top-2 z-10 flex gap-2 align-bottom">
							{session && <Menu />}
						</div>
```

- [ ] **Step 4: Delete `Login.tsx`**

```bash
git rm src/app/_components/Login.tsx
```

- [ ] **Step 5: Run the full gate**

```bash
yarn install
npx prisma generate
yarn lint
npx tsc --noEmit
yarn build
```

Expected: all PASS. This is the checkpoint that closes the broken window — this was the last NextAuth importer, and the schema was already regenerated in Task 5. Fix anything red before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/app/events/layout.tsx src/app/members/layout.tsx src/app/layout.tsx src/app/_components/Login.tsx
git commit -m "feat: harden auth gates (null→/login); add members gate; remove Login button"
```

---

## Task 13: `member` tRPC router

**Files:**
- Create: `src/server/api/routers/member.ts`
- Modify: `src/server/api/routers/index.ts`
- Modify: `src/server/api/root.ts`

- [ ] **Step 1: Write the router**

`src/server/api/routers/member.ts`:

```ts
import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
	adminProcedure,
	createTRPCRouter,
	publicProcedure,
} from '~/server/api/trpc';
import { auth } from '~/server/auth';
import {
	generateSetPasswordUrl,
	setPasswordWithToken,
} from '~/server/auth-password-link';
import { db } from '~/server/db';
import { UserRole } from '~/enums/UserRole';

const assignableRole = z.nativeEnum(UserRole).refine(
	(r) => r === UserRole.MEMBER || r === UserRole.ADMIN,
	{ message: 'Lze přiřadit pouze roli Člen nebo Admin.' },
);

async function activeAdminCount() {
	return db.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } });
}

/**
 * Wraps an `auth.api.*` admin call and turns any thrown error into a generic
 * Czech-language TRPCError — Better Auth's admin endpoints throw `APIError`
 * with English messages not meant for end users.
 */
async function callAuth<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof TRPCError) throw e;
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Operace selhala. Zkontrolujte zadané údaje.',
		});
	}
}

export const memberRouter = createTRPCRouter({
	create: adminProcedure
		.input(
			z.object({
				email: z.string().email(),
				name: z.string().min(1),
				role: assignableRole,
			}),
		)
		.mutation(async ({ input }) => {
			const result = await callAuth(() =>
				auth.api.createUser({
					body: {
						email: input.email,
						name: input.name,
						role: input.role,
						data: { emailVerified: true },
					},
					headers: await headers(),
				}),
			);
			return { userId: result.user.id };
		}),

	list: adminProcedure.query(async ({ ctx }) => {
		const users = await ctx.db.user.findMany({
			where: { deletedAt: null },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				accounts: {
					where: { providerId: 'credential' },
					select: { id: true },
				},
			},
			orderBy: { createdAt: 'asc' },
		});
		return users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role as UserRole,
			hasPassword: u.accounts.length > 0,
		}));
	}),

	setRole: adminProcedure
		.input(z.object({ userId: z.string(), role: assignableRole }))
		.mutation(async ({ ctx, input }) => {
			if (input.role !== UserRole.ADMIN) {
				const target = await ctx.db.user.findUnique({
					where: { id: input.userId },
					select: { role: true },
				});
				if (
					target?.role === UserRole.ADMIN &&
					(await activeAdminCount()) <= 1
				) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Nelze odebrat roli poslednímu administrátorovi.',
					});
				}
			}
			await callAuth(() =>
				auth.api.setRole({
					body: { userId: input.userId, role: input.role },
					headers: await headers(),
				}),
			);
			return { ok: true };
		}),

	delete: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (input.userId === ctx.session.user.id) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Nemůžete smazat sami sebe.',
				});
			}
			const target = await ctx.db.user.findUnique({
				where: { id: input.userId },
				select: { role: true },
			});
			if (
				target?.role === UserRole.ADMIN &&
				(await activeAdminCount()) <= 1
			) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Nelze smazat posledního administrátora.',
				});
			}
			// Soft-delete: mark, remove password (credential), revoke sessions.
			await ctx.db.user.update({
				where: { id: input.userId },
				data: { deletedAt: new Date() },
			});
			await ctx.db.account.deleteMany({
				where: { userId: input.userId, providerId: 'credential' },
			});
			await callAuth(() =>
				auth.api.revokeUserSessions({
					body: { userId: input.userId },
					headers: await headers(),
				}),
			);
			return { ok: true };
		}),

	generatePasswordLink: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input }) => {
			const url = await generateSetPasswordUrl(input.userId);
			return { url };
		}),

	setPassword: publicProcedure
		.input(z.object({ token: z.string(), newPassword: z.string() }))
		.mutation(async ({ input }) => {
			try {
				await setPasswordWithToken(input.token, input.newPassword);
			} catch (e) {
				const msg = e instanceof Error ? e.message : 'UNKNOWN';
				const map: Record<string, string> = {
					INVALID_TOKEN: 'Neplatný odkaz.',
					EXPIRED_TOKEN: 'Odkaz vypršel.',
					PASSWORD_TOO_SHORT: 'Heslo je příliš krátké.',
				};
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: map[msg] ?? 'Nastavení hesla selhalo.',
				});
			}
			return { ok: true };
		}),
});
```

> ✓ **Confirmed against docs:** `auth.api.createUser` accepts `{ body: { email, password?, name, role, data }, headers }` and works server-side without a session; `password` omitted → no credential account (passwordless, login-incapable until link used). `setRole`/`revokeUserSessions`/`removeUser` are registered admin endpoints. `disableSignUp` only gates the public sign-up endpoint, not admin `createUser`. The createUser **return** is `{ user }` → `result.user.id` (low-risk; verify in the Task 16 smoke). `await headers()` mirrors Task 6. All three `auth.api.*` calls (`createUser`/`setRole`/`revokeUserSessions`) go through `callAuth` so a thrown `APIError` (English, internal) surfaces to the client as a generic Czech message instead.

- [ ] **Step 2: Register the router**

`src/server/api/routers/index.ts`:

```ts
export * from './event';
export * from './member';
```

`src/server/api/root.ts` — add to the router map:

```ts
import { eventRouter, memberRouter } from '~/server/api/routers';
// ...
export const appRouter = createTRPCRouter({
	event: eventRouter,
	member: memberRouter,
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/member.ts src/server/api/routers/index.ts src/server/api/root.ts
git commit -m "feat: add member tRPC router (create/list/setRole/delete/link/setPassword)"
```

---

## Task 14: UI pages + Menu + remove NextAuth deps

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/reset-password/page.tsx`
- Modify: `src/app/members/page.tsx`
- Modify: `src/app/_components/Menu.tsx`
- Modify: `package.json` (remove `next-auth`, `@auth/prisma-adapter`)

- [ ] **Step 1: `/login` page**

`src/app/login/page.tsx`:

```tsx
'use client';

import { Button } from '@components/ui/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from '~/lib/auth-client';

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const { error } = await signIn.email({ email, password });
		setLoading(false);
		if (error) {
			setError('Přihlášení selhalo. Zkontrolujte e-mail a heslo.');
			return;
		}
		router.push('/events');
		router.refresh();
	}

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={onSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Přihlásit</h1>
				<input
					type="email"
					placeholder="E-mail"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				<input
					type="password"
					placeholder="Heslo"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				{error && <p className="text-sm text-red-500">{error}</p>}
				<Button type="submit" color="primary" disabled={loading}>
					Přihlásit
				</Button>
			</form>
		</div>
	);
}
```

> ✓ **Decided (Q5):** the authed→`/events` redirect uses a **server-component wrapper** (`page.tsx` calls `getServerAuthSession()` and redirects) with the form extracted to a `'use client'` `LoginForm.tsx` — chosen over a client `useSession` redirect because the server check is authoritative and avoids a flash of the form. Implemented in Step 2.

- [ ] **Step 2: `/login` server-redirect wrapper**

Make `src/app/login/page.tsx` a server component that redirects, and move the form to `src/app/login/LoginForm.tsx` (`'use client'`). Server page:

```tsx
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '~/server/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
	const session = await getServerAuthSession();
	if (session) redirect('/events');
	return <LoginForm />;
}
```

(`LoginForm.tsx` holds the `'use client'` form from Step 1, default-exported as `LoginForm`.)

- [ ] **Step 3: `/reset-password` page**

`src/app/reset-password/page.tsx` (client; reads `token` from query, min-8 enforced, calls `member.setPassword`):

```tsx
'use client';

import { Button } from '@components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '~/trpc/react';

export default function ResetPasswordPage() {
	const router = useRouter();
	const token = useSearchParams().get('token') ?? '';
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const setPasswordMut = api.member.setPassword.useMutation({
		onSuccess: () => router.push('/login'),
		onError: (e) => setError(e.message),
	});

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError('Heslo musí mít alespoň 8 znaků.');
			return;
		}
		setPasswordMut.mutate({ token, newPassword: password });
	}

	if (!token) return <p className="p-8">Neplatný odkaz.</p>;

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={onSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Nastavit heslo</h1>
				<input
					type="password"
					placeholder="Nové heslo (min. 8 znaků)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				{error && <p className="text-sm text-red-500">{error}</p>}
				<Button
					type="submit"
					color="primary"
					disabled={setPasswordMut.isPending}
				>
					Nastavit heslo
				</Button>
			</form>
		</div>
	);
}
```

> ✓ **Confirmed from repo:** the tRPC client is `api` from `~/trpc/react` and mutations expose `isPending` (e.g. `src/app/events/_components/DeleteEvent.tsx`). No change needed.

- [ ] **Step 4: `/members` admin UI**

`src/app/members/page.tsx` (client). Create-member form (Member/Admin only) + list with "pending" badge + per-row edit role / soft-delete / copy link. Guards surface as toasts.

```tsx
'use client';

import { Button } from '@components/ui/Button';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserRole } from '~/enums/UserRole';
import { api } from '~/trpc/react';

const ASSIGNABLE: { label: string; value: UserRole }[] = [
	{ label: 'Člen', value: UserRole.MEMBER },
	{ label: 'Admin', value: UserRole.ADMIN },
];

export default function MembersPage() {
	const utils = api.useUtils();
	const list = api.member.list.useQuery();
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');
	const [role, setRole] = useState<UserRole>(UserRole.MEMBER);

	const create = api.member.create.useMutation({
		onSuccess: async ({ userId }) => {
			setEmail('');
			setName('');
			await utils.member.list.invalidate();
			const { url } = await genLink.mutateAsync({ userId });
			await navigator.clipboard.writeText(url);
			toast.success('Člen vytvořen. Odkaz pro nastavení hesla zkopírován.');
		},
		onError: (e) => toast.error(e.message),
	});
	const setRoleMut = api.member.setRole.useMutation({
		onSuccess: () => utils.member.list.invalidate(),
		onError: (e) => toast.error(e.message),
	});
	const del = api.member.delete.useMutation({
		onSuccess: () => utils.member.list.invalidate(),
		onError: (e) => toast.error(e.message),
	});
	const genLink = api.member.generatePasswordLink.useMutation({
		onError: (e) => toast.error(e.message),
	});

	async function copyLink(userId: string) {
		const { url } = await genLink.mutateAsync({ userId });
		await navigator.clipboard.writeText(url);
		toast.success('Odkaz zkopírován.');
	}

	return (
		<div className="mx-auto max-w-3xl p-6">
			<h1 className="mb-4 text-2xl font-bold">Členové</h1>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					create.mutate({ email, name, role });
				}}
				className="mb-8 flex flex-wrap items-end gap-2"
			>
				<input
					type="text"
					placeholder="Jméno"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				<input
					type="email"
					placeholder="E-mail"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				<select
					value={role}
					onChange={(e) => setRole(e.target.value as UserRole)}
					className="rounded border px-3 py-2"
				>
					{ASSIGNABLE.map((r) => (
						<option key={r.value} value={r.value}>
							{r.label}
						</option>
					))}
				</select>
				<Button type="submit" color="primary" disabled={create.isPending}>
					Vytvořit
				</Button>
			</form>

			<table className="w-full text-left">
				<thead>
					<tr>
						<th>Jméno</th>
						<th>E-mail</th>
						<th>Role</th>
						<th>Akce</th>
					</tr>
				</thead>
				<tbody>
					{list.data?.map((m) => (
						<tr key={m.id} className="border-t">
							<td>{m.name}</td>
							<td>{m.email}</td>
							<td>
								<select
									value={m.role}
									onChange={(e) =>
										setRoleMut.mutate({
											userId: m.id,
											role: e.target.value as UserRole,
										})
									}
									className="rounded border px-2 py-1"
								>
									{ASSIGNABLE.map((r) => (
										<option key={r.value} value={r.value}>
											{r.label}
										</option>
									))}
								</select>
								{!m.hasPassword && (
									<span className="ml-2 rounded bg-yellow-200 px-2 py-0.5 text-xs text-yellow-900">
										čeká na heslo
									</span>
								)}
							</td>
							<td className="flex gap-2">
								<Button
									onClick={() => copyLink(m.id)}
									isLoading={genLink.isPending}
								>
									Kopírovat odkaz
								</Button>
								<Button
									color="danger"
									onClick={() => {
										if (confirm(`Smazat člena ${m.name}?`))
											del.mutate({ userId: m.id });
									}}
								>
									Smazat
								</Button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

> ✓ **Confirmed from repo:** `@components/ui/Button` (NextUI wrapper) accepts `color="danger"`, `onClick`, `isLoading` (see `DeleteEvent.tsx`). `size="sm"` is **removed** — the wrapper's variant map only defines `size: { xl }`, so `sm` isn't valid; default size is used. `api.useUtils()` is the correct rc.446 name (used in `src/app/events/_components/EditableState.tsx`).

- [ ] **Step 5: `Menu.tsx` — sign-out + hide "Členové" for non-admins**

```tsx
'use client';

import { Button } from '@components/ui/Button';
import {
	Dropdown,
	DropdownItem,
	DropdownMenu,
	DropdownTrigger,
} from '@components/ui/Dropdown';
import { useRouter } from 'next/navigation';
import { signOut } from '~/lib/auth-client';
import { useIsAdmin } from '~/utils/permissions';

export default function Menu() {
	const router = useRouter();
	const isAdmin = useIsAdmin();

	async function handleSignOut() {
		await signOut();
		router.push('/login');
		router.refresh();
	}

	return (
		<Dropdown>
			<DropdownTrigger>
				<Button
					color="primary"
					className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
				>
					Menu
				</Button>
			</DropdownTrigger>
			<DropdownMenu>
				{[
					<DropdownItem key="home" href="/">
						Domů
					</DropdownItem>,
					<DropdownItem key="events" href="/events">
						Události
					</DropdownItem>,
					...(isAdmin
						? [
								<DropdownItem key="members" href="/members">
									Členové
								</DropdownItem>,
							]
						: []),
					<DropdownItem key="signout" onPress={handleSignOut}>
						Odhlásit
					</DropdownItem>,
				]}
			</DropdownMenu>
		</Dropdown>
	);
}
```

> ✓ **Resolved (Q7):** NextUI uses a react-aria collection for `DropdownMenu` children, which doesn't reliably accept a conditional `null`/`false` child — so the items are built as an **array** (with the admin item spread in conditionally) above. `onPress` is the NextUI action handler for `DropdownItem` (the existing items use `href`; the sign-out item needs an action). If `tsc` flags the array-children typing on the `extendVariants` wrapper, fall back to two separate `<DropdownMenu>` returns (admin vs non-admin).

- [ ] **Step 6: Remove NextAuth deps**

```bash
yarn remove next-auth @auth/prisma-adapter
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS. Fix any wrapper-prop mismatches flagged above.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: login/reset-password/members UI + Menu sign-out; remove next-auth deps"
```

---

## Task 15: Seed + production bootstrap

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write the idempotent, env-gated seed**

```ts
import { auth } from '~/server/auth';
import { generateSetPasswordUrl } from '~/server/auth-password-link';
import { db } from '~/server/db';
import { env } from '~/env';
import { UserRole } from '~/enums/UserRole';

const DEV_PASSWORD = 'admin1234';

async function ensureUser(opts: {
	email: string;
	name: string;
	role: UserRole;
	password?: string;
}) {
	const existing = await db.user.findUnique({ where: { email: opts.email } });
	if (existing) return { id: existing.id, created: false };
	const res = await auth.api.createUser({
		body: {
			email: opts.email,
			name: opts.name,
			role: opts.role,
			password: opts.password, // omitted → passwordless
			data: { emailVerified: true },
		},
	});
	return { id: res.user.id, created: true };
}

async function main() {
	const isProd = env.NODE_ENV === 'production';

	// Admin
	const admin = await ensureUser({
		email: env.BOOTSTRAP_ADMIN_EMAIL,
		name: 'Admin',
		role: UserRole.ADMIN,
		password: isProd ? undefined : DEV_PASSWORD,
	});
	if (isProd && admin.created) {
		const url = await generateSetPasswordUrl(admin.id);
		console.log('\n=== PRODUCTION ADMIN BOOTSTRAP ===');
		console.log('Admin:', env.BOOTSTRAP_ADMIN_EMAIL);
		console.log('Set-password link (open once):', url);
		console.log('==================================\n');
	} else if (!isProd) {
		console.log(`Dev admin: ${env.BOOTSTRAP_ADMIN_EMAIL} / ${DEV_PASSWORD}`);
	}

	// Dev-only member (passwordless → exercise set-password flow)
	if (!isProd) {
		const member = await ensureUser({
			email: 'member@cmdrozdi.cz',
			name: 'Test Member',
			role: UserRole.MEMBER,
		});
		if (member.created) {
			const url = await generateSetPasswordUrl(member.id);
			console.log('Dev member set-password link:', url);
		}
	}
}

void main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
```

> ✓ **Q4 resolved (docs):** `auth.api.createUser` works without a session, and omitting `password` yields a passwordless (login-incapable) user — exactly the seed's intent. Note the seed calls `createUser` **without** `headers` (no admin session in a CLI context); docs confirm server-side createUser needs no session.
>
> **Q9 resolution & residual risk:**
> - **Path aliases:** `tsx` reads `tsconfig.json` and resolves `~/*` automatically — no `tsconfig-paths` needed.
> - **Env:** loaded via `--env-file=.env` in the `db:seed` script (Task 2). `~/env` validation runs at import, so `.env` must be present.
> - **⚠️ Transitive `next/headers` import:** `prisma/seed.ts` imports `~/server/auth`, whose `getServerAuthSession` imports `next/headers` at module top. Importing (not calling) `next/headers` outside a Next request is normally harmless, but **if it throws under `tsx`**, the fix is to split the bare `betterAuth()` instance into its own module (e.g. `src/server/auth-instance.ts`) that the seed imports, leaving `next/headers` only in `auth.ts`'s `getServerAuthSession`. Verify in Step 2; refactor only if it breaks.

- [ ] **Step 2: Run the seed**

```bash
yarn db:seed
```

Expected: prints the dev admin credentials and the member set-password link; rerun is a no-op (idempotent).

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: idempotent env-gated seed + prod admin bootstrap link"
```

---

## Task 16: Manual smoke + master-plan tracking

**Files:**
- Modify: `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

- [ ] **Step 1: Run the full manual smoke checklist** (spec §Verification, steps 1–11)

Start `yarn dev` and walk every step: DB reset+seed; unauth redirect to `/login`; `/login` while authed → `/events`; landing `/` has no login control; admin logs in → `/events` + `/members`; create member (pending) → copy link → set password → member logs in (badge clears); edit role; soft-delete (row gone, login blocked, session booted); guards (no self-delete, no last-admin delete/demote — Czech errors); role gating (non-admin blocked from `/members`, "Členové" hidden, GUEST forbidden on `/events`); link expiry (expired/reused rejected); sign-out from Menu → `/login`; protected tRPC + event CRUD work. Record results.

- [ ] **Step 2: Update the master-plan tracking table**

Mark **Phase 0** row `merged` (per the `upgrade-phase-pr-doc-updates` convention) and **Phase 1** row `in review` with branch `feat/upgrade-phase-1-better-auth`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
git commit -m "docs: mark Phase 0 merged, Phase 1 in review in master plan"
```

- [ ] **Step 4: Final gate before PR**

```bash
yarn install && npx prisma generate && yarn lint && npx tsc --noEmit && yarn build
```

Expected: all PASS. Then open the PR into `develop`.

---

## Open Questions — RESOLVED (2026-06-15)

All nine questions from the first draft were resolved against the official Better Auth docs (context7 `/better-auth/better-auth`) and the repo. None changed the architecture — only exact import paths / argument shapes / props. Summary:

| # | Topic | Resolution |
|---|---|---|
| Q1 | Access-control imports (T3) | ✓ Docs-confirmed: `createAccessControl` from `better-auth/plugins/access`; `defaultStatements`+`adminAc` from `better-auth/plugins/admin/access`; admin merges `...adminAc.statements`. |
| Q2 | `getSession` + `headers()` (T6/T13) | ✓ Use `auth.api.getSession({ headers: await headers() })` — documented pattern; `await` is a no-op on Next 14 sync `headers()` and forward-compatible for Phase 5. |
| Q3 | internalAdapter shapes (T8) | ✓ **Resolved by the Task 4 spike** (commit 1ed678a) against `node_modules/better-auth` types. All names matched except `deleteVerificationValue`, which doesn't exist — use `deleteVerificationByIdentifier(identifier)` (or `consumeVerificationValue(identifier)` for atomic find+delete). See §2a note. Fallback: public `auth.api.setUserPassword` for the credential-creation step. |
| Q4 | `createUser`/`setRole` (T13/T15) | ✓ Docs-confirmed: server-side, no session; `password` optional → passwordless; `disableSignUp` doesn't block admin createUser; `data` carries `emailVerified`. Return `{ user }` → `result.user.id` (verify in T16 smoke). |
| Q5 | `/login` authed-redirect (T14) | ✓ Decided: server-component wrapper + extracted `LoginForm.tsx`. |
| Q6 | tRPC rc.446 client (T14) | ✓ Repo-confirmed: `api` from `~/trpc/react`, `api.useUtils()`, mutation `isPending`. |
| Q7 | NextUI wrapper props (T14) | ✓ Repo-confirmed: `color="danger"`/`onClick`/`isLoading` valid; `size="sm"` dropped (not in variant map); Menu uses an items **array** (no conditional `null` child); `onPress` for the sign-out action. |
| Q8 | `@better-auth/cli generate` (T5) | ✓ Docs-confirmed: Prisma schema **generation supported**. Diff-and-merge mitigation retained for domain-model preservation. |
| Q9 | `tsx` paths + env (T15) | ✓ `tsx` resolves `~/*` from tsconfig; `.env` loaded via `--env-file=.env`. ⚠️ **Residual:** transitive `next/headers` import in the seed — split the `betterAuth()` instance into its own module only if it throws under `tsx`. |

**One residual item carries into execution** (Q3 was fully resolved by the Task 4 spike, see above):
1. **Q9** — the seed's transitive `next/headers` import → verified at Task 15 Step 2, with a one-file refactor as the fallback.

---

## Self-review notes

- **Spec coverage:** §1 → T1/T3/T7/T13 (boundary casts); §2 → T4/T6; §2a → T8; §3 → T7; §4 → T9; §5 → T10; §6 → T11; §7 → T12/T14; §8 → T13; §9 → T5; §10 → T15; §11 → T2/T6; §12 → T2/T14. Verification §  → T12/T16. Tracking update → T16. All covered.
- **Type consistency:** `getServerAuthSession(): Promise<AppSession|null>` (T6) is consumed in T11/T12/T14; `UserRole` string enum (T1) used everywhere; `member.list` returns `hasPassword`/`role: UserRole` consumed by T14 UI; helper names `generateSetPasswordUrl`/`setPasswordWithToken` (T8) match T13/T15 call sites; `adminProcedure` (T11) used in T13.
- **Broken-window honesty:** Tasks 5–12 don't fully compile/build standalone; full gate is the Task 12 checkpoint. This is called out in the Verification model and per-task expected outputs.
