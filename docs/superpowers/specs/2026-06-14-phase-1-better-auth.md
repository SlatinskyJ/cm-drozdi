# Phase 1 — Auth Migration to Better Auth (Spec)

> Phase spec for the [dependency upgrade master plan](../plans/2026-06-11-dependency-upgrade-master-plan.md).
> Branch: `feat/upgrade-phase-1-better-auth`. Forks from `develop`, PRs back into `develop`.
> Status: spec — execution plan to follow (writing-plans).

## Goal

Replace NextAuth v4 (OAuth-only Discord/Facebook, `@auth/prisma-adapter`, DB sessions) with
**Better Auth** (email + password, admin-created accounts, DB sessions, string roles) on the
**current pre-upgrade stack** (Next 14 / React 18 / Prisma 5 / Tailwind 3 / Zod 3). No framework
bumps in this phase — auth is isolated from the later upgrade churn.

Full DB reset: no data is preserved.

## Locked decisions (from the master plan + brainstorming + grilling 2026-06-14)

- **Auth library:** Better Auth. Remove `next-auth`, `@auth/prisma-adapter`.
- **Sign-up:** disabled (`emailAndPassword.disableSignUp = true`). Accounts are admin-created only.
- **Roles:** keep the `UserRole` enum names GUEST / MEMBER / ADMIN, but **stored as strings**
  (`'guest'` / `'member'` / `'admin'`), backed by the Better Auth **admin plugin** `role` field +
  custom access control. (DB reset makes the Int→String column change free.) `UserRole` is the **single
  role type across the whole codebase**; the Better Auth (`string`) and Prisma (`string`) boundaries are
  cast to it exactly once (§1/§3/§6). Only **Member** and **Admin** are assignable in the UI — `guest`
  is the internal safe default (`defaultRole`), never assigned by an admin.
- **Password flow:** link-based set + reset, via **two small server helpers** exposed through tRPC (§2a —
  no custom HTTP plugin). New members are created **with no password at all** — a member **cannot log in
  until they use their link to set a password** (required security property). The admin mints a
  **copyable link** (the generate helper returns the URL directly — no email, no callback capture) and
  hands it over out-of-band; opening it lets the member set their initial password, which **creates their
  `credential` account** (mirrors Better Auth's built-in `setPassword`/`linkAccount`). The same helpers
  serve both "set initial password" and "admin-triggered reset." **No email sending yet** — generation
  returning the URL *is* the deliver seam; an email sender can later send the URL instead of returning it.
  - **Split link lifetime (auto-detected by credential presence, §2a):** user has **no** `credential`
    yet → **invite** link, **7-day** expiry (covers out-of-band delivery of a brand-new/restored member);
    user **has** a `credential` → **reset** link, **1-hour** expiry. The consume path is identical; only
    `expiresAt` differs. Min password length **8**, enforced client + server from one config source.
  - **Why our own helpers, not built-in reset:** `requestPasswordReset` *does* work for passwordless
    users (source-confirmed: no credential check), but (a) the token `resetPassword` creating a credential
    when none exists is unconfirmed in our version, and (b) the generated URL only surfaces inside the
    `sendResetPassword` callback fired via `runInBackgroundOrAwait` — racy to capture. Two small server
    helpers over `auth.$context.internalAdapter` (§2a) remove both unknowns deterministically.
- **Members admin UI:** lives at the existing `/members` route (currently a stub; `Menu` already links
  to it). Admin-gated. Create member (Member/Admin) + member list (with a **"pending" badge** for members
  who haven't set a password) + per-row **edit role** + **soft-delete** + copyable password link.
  - **Soft-delete (not hard-delete):** a `deletedAt` timestamp is set; the member's `credential` account
    is deleted (removes password → cannot log in) and their sessions revoked. The list hides
    `deletedAt != null`. Restore (clear `deletedAt` + new invite link) and perma-delete are **manual /
    deferred**. **Guards:** an admin cannot soft-delete **themselves**, and the **last remaining admin**
    cannot be soft-deleted or demoted (lockout protection).
  - The `Menu` "Členové" link is **hidden from non-admins** (server gate still enforces). Self-service
    forgot-password page and guest-entry links deferred.
- **Landing page auth controls:** **none.** Remove the `<Login />` button from the root layout entirely.
  Visitors see no login/logout. Sign-out moves into the `Menu` dropdown (only renders when logged in) and
  bounces to `/login`. The sign-in page lives at **`/login`** (renamed from `/sign-in`), reachable only by
  direct/bookmarked URL or the middleware unauth-redirect; if already authenticated it redirects to
  `/events`.
- **Data:** full reset via `prisma db push --force-reset` + seed (no migration history exists in the
  repo today — db-push workflow). Seed (dev): 1 ADMIN + 1 MEMBER. Prod bootstrap: 1 passwordless admin
  via link (see §10) — no seed/test accounts in production.
- **Drop** the dead `Post` model (T3 scaffold; no router, no consumers).

## Out of scope (this phase)

- Social / OAuth login (deferred nice-to-have).
- Real email sending (set/reset links are admin-copyable only for now).
- Self-service "forgot password" page and guest-entry links.
- Member edit beyond role (name/email editing), bulk ops.
- **Restore of a soft-deleted member** and **perma-delete** UI (both manual / deferred — restore = clear
  `deletedAt` + new invite link; perma-delete = manual DB op, FK-safe via the join-table cascades).
- Framework/dependency upgrades (later phases).

---

## Current-state facts (audited 2026-06-14)

- `src/server/auth.ts` — NextAuth `authOptions` + `getServerAuthSession()` wrapper; module
  augmentation types `session.user.role: UserRole` and `session.user.id`.
- `src/middleware.ts` — `withAuth` checking `next-auth.session-token` / `__Secure-next-auth.session-token`
  cookies; matcher excludes `api|_next/static|_next/image|auth|favicon.ico|images|sitemap.xml|robots.txt|$`.
- `src/app/api/auth/[...nextauth]/route.ts` — `NextAuth(authOptions)` handler.
- `src/utils/permissions.ts` — `useIsAdmin()` via `getSession()` from `next-auth/react`.
- `src/server/api/trpc.ts` — context calls `getServerAuthSession()`; `protectedProcedure` only checks
  `ctx.session?.user` truthiness. **No router reads `session.user.id`** (grep-confirmed).
- Session consumers: `src/app/layout.tsx` (renders `<Login/>` + `<Menu/>`), `src/app/_components/Login.tsx`,
  `src/app/events/layout.tsx` (GUEST → `AccessForbiddenPage`).
- `src/env.js` — `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DISCORD_*`, `FACEBOOK_*`.
- `prisma/schema.prisma` — NextAuth models `Account` / `Session` / `User` / `VerificationToken`;
  domain models `Event` / `Instrument` / `UsersOnEvents` / `InstrumentsOnUsers`; dead `Post`.
  `User.role` is `Int? @default(0)`. **No `prisma/migrations/` dir** (db-push workflow).
- `src/app/_components/Providers.tsx` — `NextUIProvider` + tRPC provider. **No `SessionProvider`.**
- `src/app/_components/Menu.tsx` — client Dropdown nav (Domů / Události / Členové → `/members`).
- `src/app/members/page.tsx` — stub (`<div>Members page</div>`).
- `@components/ui/*` (Button, Dropdown, …) are **NextUI wrappers** (`extendVariants`), not real shadcn —
  shadcn migration is still Phase 4. New forms use plain Tailwind + the existing `Button` wrapper.
- No `tsx`/`ts-node` dependency; no `seed` script.

---

## Design

### 1. Role model

`src/enums/UserRole.ts` becomes string-valued:

```ts
export enum UserRole {
  GUEST = 'guest',
  MEMBER = 'member',
  ADMIN = 'admin',
}
```

All existing comparisons (`session.user.role === UserRole.GUEST` in `events/layout.tsx`,
`=== UserRole.ADMIN` in `permissions.ts`) keep working unchanged — they compare against the enum, not a
literal. The DB `role` column becomes a string, provided by the admin plugin.

**`UserRole` is the single role type across the codebase.** Better Auth infers `user.role` as `string`
and Prisma reads it as `string`; we cast to `UserRole` **once at each boundary** so nothing downstream
ever handles raw strings:

```ts
// src/server/auth.ts
import type { UserRole } from '~/enums/UserRole';
type InferredUser = (typeof auth.$Infer.Session)['user'];
export type SessionUser = Omit<InferredUser, 'role'> & { role: UserRole };
export type AppSession = { session: (typeof auth.$Infer.Session)['session']; user: SessionUser };
```

`getServerAuthSession()` is annotated to return `AppSession | null`, the client `useSession` wrapper
(§3) returns `SessionUser`, and `member.list` (§8) casts Prisma's `role` to `UserRole`. Router input
schemas use `z.nativeEnum(UserRole)`.

**Access control** (`createAccessControl` from `better-auth/plugins/access`): define roles
`guest` (no perms), `member` (no admin perms), `admin` (full user-management: `user: ['create','list','set-role','delete','set-password', …]`).
Admin plugin config: `{ ac, roles: { guest, member, admin }, adminRoles: ['admin'], defaultRole: 'guest' }`.
`adminRoles: ['admin']` is what authorizes a logged-in user to call the admin endpoints.

### 2. Better Auth instance — `src/server/auth.ts` (rewrite)

```ts
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL], // VERCEL_URL-derived in env.js → previews work (§11)
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8, // single source of truth for the §2a helper + the /reset-password form
  },
  user: {
    additionalFields: {
      deletedAt: { type: 'date', required: false, input: false }, // soft-delete marker (§8/§9)
    },
  },
  plugins: [admin({ ac, roles, adminRoles: ['admin'], defaultRole: 'guest' })],
});
```

- **`getServerAuthSession(): Promise<AppSession | null>`** kept for minimal call-site churn:
  `auth.api.getSession({ headers: headers() })` cast to `AppSession` (`headers()` is **sync** on Next 14).
  Call sites read `.user.role` / truthiness — compatible, and `role` is now `UserRole` (§1).
- **Inferred types:** export `SessionUser` / `AppSession` (§1). The tRPC context type flows from the
  wrapper's return type; drop the NextAuth module augmentation.
- **`minPasswordLength: 8`** is the one place the rule lives; the §2a helper reads
  `(await auth.$context).password.config.minPasswordLength` and the `/reset-password` form mirrors it.

### 2a. Password-link server helpers — `src/server/auth-password-link.ts`

Two plain server functions providing the truly-passwordless set/reset flow deterministically (no email,
no callback capture, **no custom HTTP plugin** — exposed through tRPC instead). They use
`(await auth.$context).internalAdapter` + `.password` and reuse the `verification` table for one-time
tokens. This file imports `auth` from `auth.ts` (one-directional — `auth.ts` does **not** import this).

- **`generateSetPasswordUrl(userId): Promise<string>`** — looks up the user's accounts; **auto-picks the
  expiry by credential presence**: no `credential` account → **invite**, `expiresAt = now + 7d`; has
  `credential` → **reset**, `expiresAt = now + 1h`. Mints `token = crypto.randomUUID()`, stores a
  verification value `{ identifier: 'set-password:' + token, value: userId, expiresAt }` via
  `internalAdapter.createVerificationValue(...)`, returns `BETTER_AUTH_URL + '/reset-password?token=' +
  token`. Generation is the "deliver link" seam: today it's returned to the admin; later an email sender
  sends it. Used by the admin tRPC mutation **and the seed** (both server-side, no HTTP round-trip).
- **`setPasswordWithToken(token, newPassword): Promise<void>`** — looks up `'set-password:' + token` via
  `internalAdapter.findVerificationValue(...)`, throws if missing/expired, resolves `userId`, validates
  `newPassword.length >= password.config.minPasswordLength` (the §2 config), then: if the user has no
  `credential` account → `internalAdapter.linkAccount({ userId, accountId: userId, providerId:
  'credential', password: hash })`; else `internalAdapter.updatePassword(userId, hash)`. Deletes the
  verification value (one-time use). (Setting a password also implicitly reactivates a restored member —
  `deletedAt` clearing is handled by the admin restore flow, deferred.)

Exposure (in the `member` router, §8): `generatePasswordLink` is an **admin-gated** `protectedProcedure`
calling `generateSetPasswordUrl`; `setPassword` is a **`publicProcedure`** (the token is the auth)
calling `setPasswordWithToken`.

### 3. Client — `src/lib/auth-client.ts`

```ts
// baseURL omitted → defaults to same-origin (no client env var needed).
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
export const { signIn, signOut } = authClient;
```

`useIsAdmin()` rewritten onto `authClient.useSession()` → `(data?.user.role as UserRole) === UserRole.ADMIN`
(no provider needed; Better Auth manages its own store). The `role` cast to `UserRole` happens here (one
of the boundary casts from §1) so consumers compare `UserRole` only.

### 4. Route handler

- New: `src/app/api/auth/[...all]/route.ts` → `export const { GET, POST } = toNextJsHandler(auth);`
- Delete: `src/app/api/auth/[...nextauth]/route.ts` (and its dir).

### 5. Middleware — `src/middleware.ts`

- Replace `withAuth` with a `middleware(req)` using `getSessionCookie(req)` from `better-auth/cookies`.
  No cookie → `NextResponse.redirect(new URL('/login', req.url))`.
- Matcher: keep all current exclusions, **add `login` and `reset-password`** so those pages are
  reachable unauthenticated. (`api` already excluded → `[...all]` handler unaffected; `/` already
  excluded → public landing intact.)
- **Optimistic only.** `getSessionCookie` checks cookie *presence*, not validity — the **server layouts
  are authoritative** (§7): they redirect to `/login` on a null/invalid session. This is what makes
  soft-delete (revoked session + a lingering cookie) actually lock the user out.

### 6. tRPC — `src/server/api/trpc.ts`

- `createTRPCContext`: `const session = await getServerAuthSession();` (now the Better Auth wrapper,
  typed `AppSession | null`). `ctx.session.user.role` is `UserRole`.
- `protectedProcedure`: unchanged — still checks `ctx.session?.user`. Better Auth result exposes `.user`.

### 7. New pages & components

- **Server-side gate hardening (applies to `events/layout.tsx` + `members/layout.tsx`):** the layouts are
  **authoritative**. Pattern:
  ```ts
  const session = await getServerAuthSession();
  if (!session) redirect('/login');                       // null/invalid → out (closes soft-delete window)
  if (session.user.role === UserRole.GUEST) return <AccessForbiddenPage />;   // events
  // members/layout: if (session.user.role !== UserRole.ADMIN) return <AccessForbiddenPage />;
  ```
- **`/login`** (`src/app/login/page.tsx`) — client email+password form → `authClient.signIn.email`.
  On success redirect to `/events`; render error on failure. **If already authenticated → redirect to
  `/events`** (server check). Plain Tailwind + `@components/ui/Button`. Czech labels (`Přihlásit`,
  `E-mail`, `Heslo`). No link back from anywhere public.
- **`/reset-password`** (`src/app/reset-password/page.tsx`) — reads `token` from query, new-password
  form (min-8, client + server) → `member.setPassword` tRPC mutation (§2a/§8). Doubles as "set initial
  password" for new members (creates their credential). On success redirect to `/login`. Handles
  missing/invalid/expired token (mutation throws → show message).
- **`/members`** (`src/app/members/page.tsx` + `layout.tsx`) — **admin-gated** (hardened gate above;
  non-admin → `AccessForbiddenPage`). Client UI:
  - **Create member** form: email + name + role select (**Member / Admin only**) → `member.create` tRPC
    → `authClient.admin.createUser` (**no password**, `emailVerified: true`). On success, immediately
    offer the copyable set-password link (from `member.generatePasswordLink`).
  - **Member list**: table (name, email, role, **"pending" badge** when `hasPassword === false`) from
    `member.list` tRPC (Prisma-direct, `deletedAt: null` only).
  - **Per-row actions**: **Edit role** (Member/Admin select → `member.setRole`), **Soft-delete** (confirm
    dialog → `member.delete`; disabled for self and for the last admin), **Copy password link**
    (`member.generatePasswordLink` → copyable URL). Guard rejections surface as Czech error toasts.
- **Sign-out**: add an "Odhlásit" item to `Menu.tsx` → `authClient.signOut()` then redirect to `/login`.
  **Hide the "Členové" item for non-admins** via `useIsAdmin()`.
- **Remove** `<Login />` from `src/app/layout.tsx`; delete `src/app/_components/Login.tsx`.

### 8. `member` tRPC router — `src/server/api/routers/member.ts`

Most procedures use an **`adminProcedure`** (a `protectedProcedure` that asserts
`ctx.session.user.role === UserRole.ADMIN`), registered in `routers/index.ts` + `root.ts`. Inputs use
`z.nativeEnum(UserRole)` for roles; the create/edit UI only offers `MEMBER`/`ADMIN`.

- `create({ email, name, role })` (admin) → `auth.api.createUser({ body: { email, name, role, data: {
  emailVerified: true } }, headers })` — **no password** (login-incapable until link used).
- `list()` (admin) → **Prisma-direct** (§7): `db.user.findMany({ where: { deletedAt: null }, select: {
  id, name, email, role, accounts: { where: { providerId: 'credential' }, select: { id: true } } },
  orderBy: { createdAt: 'asc' } })` → `{ id, name, email, role: role as UserRole, hasPassword:
  accounts.length > 0 }`.
- `setRole({ userId, role })` (admin) → **guard:** if changing away from `ADMIN`, reject when the target
  is the last active admin (`count(role: 'admin', deletedAt: null) <= 1`). Then `auth.api.setRole(...)`.
- `delete({ userId })` (admin) — **soft-delete**, with guards: reject if `userId === ctx.session.user.id`
  (no self-delete) or target is the last active admin. Then in one flow: `db.user.update({ where: {
  id: userId }, data: { deletedAt: new Date() } })`; delete the credential account (`db.account.deleteMany({
  where: { userId, providerId: 'credential' } })`); revoke sessions (`auth.api.revokeUserSessions({ body:
  { userId }, headers })` or `db.session.deleteMany({ where: { userId } })`).
- `generatePasswordLink({ userId })` (admin) → `generateSetPasswordUrl(userId)` (§2a, auto-expiry),
  returns `{ url }`.
- `setPassword({ token, newPassword })` (**`publicProcedure`** — token is the auth) →
  `setPasswordWithToken(token, newPassword)`.

The admin-plugin `auth.api.*` calls (`createUser`/`setRole`/`revokeUserSessions`) pass the request
`headers` so the admin session authorizes them; `list`/soft-delete writes use Prisma directly (gated by
`adminProcedure`); `generateSetPasswordUrl`/`setPasswordWithToken` are plain server helpers (gating is
the procedure type + the token). All guard rejections are `TRPCError({ code: 'BAD_REQUEST' })` with a
Czech message.

### 9. Schema — `prisma/schema.prisma`

- Run `npx @better-auth/cli generate` to emit Better Auth models (`User` / `Session` / `Account` /
  `Verification`; admin plugin adds `role`, `banned`, `banReason`, `banExpires` to `User`; the
  `additionalFields` config adds **`deletedAt DateTime?`** to `User`). **Run it against a copy / review
  the diff** — the CLI rewrites `schema.prisma`; confirm it preserves `Event` / `Instrument` / join
  tables and only adds/updates the auth models (merge by hand if it clobbers domain models).
- **Reconnect** domain relations onto the generated `User`: `UsersOnEvents`, `InstrumentsOnUsers`.
- **Add `onDelete: Cascade`** to the `user` relation on **`UsersOnEvents`** and **`InstrumentsOnUsers`**
  (so a manual perma-delete of a soft-deleted member cleans up their join rows without an FK violation;
  the `Event` / `Instrument` rows themselves stay).
- Keep `Event` / `Instrument` join tables otherwise as-is.
- **Drop `Post`** (and its `User.posts` back-relation).
- Verify generated model/field names line up with what the Prisma adapter + admin plugin expect.

### 10. DB reset, seed & production bootstrap

**Dev/test reset:** `prisma db push --force-reset` (wipe + apply new schema), then run the seed. Dev-only
and one-time — **never wired into deploy/CI against prod** (it wipes events). The prod wipe, if ever
needed, is a deliberate manual op.

**Seed** `prisma/seed.ts` (run via new `tsx` devDep; add `db:seed` script). Idempotent + env-gated so it
is safe to run anywhere:

All `auth.api.createUser` calls work server-side **without a session** (confirmed in Better Auth source).
Every step is **idempotent** — skip if the account already exists. Branch on `NODE_ENV`:

All created accounts get `emailVerified: true` (admin vouches; no email-verification flow exists).

- **Bootstrap admin — production (`NODE_ENV === 'production'`):** create the admin from
  `BOOTSTRAP_ADMIN_EMAIL` **with no password**, then call `generateSetPasswordUrl(user.id)` and **print
  the link to stdout once**. The operator opens it and sets the password. No password ever in env/code.
- **Dev accounts (`NODE_ENV !== 'production'`):** create the admin (`BOOTSTRAP_ADMIN_EMAIL`, dev default
  `admin@cmdrozdi.cz`) **with a known dev password** — a `DEV_PASSWORD` constant in the seed (e.g.
  `'admin1234'`, **printed to stdout** so it's discoverable, never from env) — for immediate local login;
  **plus** 1 MEMBER (`member@cmdrozdi.cz`, name "Test Member") **with no password**, printing the
  member's `generateSetPasswordUrl` link to stdout so the set-password flow can be exercised locally.
  These are **skipped in production**.

**Production result:** exactly one admin (password set by the operator via link) and **zero seed/test
accounts**. All further members are created through the `/members` admin UI (passwordless → link).

### 11. Env — `src/env.js` + `.env.example`

- **Remove:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DISCORD_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`
  (server schema + `runtimeEnv`).
- **Add:** `BETTER_AUTH_SECRET` (server, required in prod, optional in dev — mirror old `NEXTAUTH_SECRET`
  pattern), `BETTER_AUTH_URL` (server), `BOOTSTRAP_ADMIN_EMAIL` (server — the prod/dev bootstrap admin
  email; see §10).
- **`BETTER_AUTH_URL`** reuses the old `NEXTAUTH_URL` Vercel handling so previews work:
  ```js
  BETTER_AUTH_URL: z.preprocess(
    (str) => (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : str),
    z.string().url(),
  ),
  ```
  local `.env` → `http://localhost:3000`; Vercel prod env → real domain; previews → derived from
  `VERCEL_URL`. This is what makes copyable set-password links point at the right host everywhere.
- Keep `DATABASE_URL`, `NODE_ENV`. Update `.env.example` to match (dev defaults for `BETTER_AUTH_URL` =
  `http://localhost:3000` and `BOOTSTRAP_ADMIN_EMAIL` = `admin@cmdrozdi.cz`).

### 12. Dependencies

- **Add:** `better-auth`; `tsx` (dev, for seed).
- **Remove:** `next-auth`, `@auth/prisma-adapter`.
- Commit `yarn.lock` with the phase.

---

## Verification

**Gate** (per master plan):

```bash
yarn install
npx prisma generate
yarn lint
npx tsc --noEmit
yarn build
```

**Manual smoke** (no E2E net until Phase 2):

1. DB reset + seed succeeds; seeded accounts exist; dev password + member link printed.
2. Unauthenticated hit on a gated route → redirect to `/login`. Visiting `/login` while logged in →
   `/events`.
3. Landing `/` shows no login/logout control; public calendar renders.
4. Seeded admin logs in (`/login`, dev password) → reaches `/events` and `/members`.
5. Admin creates a member (no password, role Member) → member shows **"pending"** → copy invite link →
   open link → set password (min-8 enforced) → member logs in; "pending" badge clears.
6. Admin edits a member's role (Member↔Admin); admin **soft-deletes** a member → row disappears from the
   list, the member can **no longer log in** (password removed) and any live session is booted.
7. **Guards:** admin cannot soft-delete self; cannot soft-delete/demote the last admin (Czech error).
8. Role gating: non-admin blocked from `/members` (and "Členové" hidden in `Menu`) and admin-only UI
   (`DeleteEvent`); GUEST → forbidden on `/events`. A revoked/expired session with a lingering cookie is
   redirected to `/login` by the server layout (not shown the page).
9. Set/reset link expiry: invite link works after a delay; an expired or reused link is rejected.
10. Sign-out from `Menu` → `/login` and clears the session (gated routes redirect again).
11. Protected tRPC procedures still authorize; event CRUD works under the new session.

**Exit criteria:** gate passes clean; all smoke steps pass.

---

## Risks & mitigations

- **Password-link helpers** (§2a) are the least-standard piece → validate the full chain (passwordless
  create → generate link → setPasswordWithToken creates credential → member logs in) before building the
  members UI on them (early step in the execution plan). Confirm `(await auth.$context).internalAdapter`
  exposes `createVerificationValue` / `findVerificationValue` / `deleteVerificationValue` / `linkAccount`
  / `updatePassword` / `findAccounts` and `(await auth.$context).password.hash` in our `better-auth`
  version; if a name differs, adjust the helper (behavior unchanged).
- **Admin plugin role wiring** (string roles + custom access control + `adminRoles`) — confirm a seeded
  admin can actually call `createUser`/`setRole`/`revokeUserSessions`; confirm `defaultRole: 'guest'`
  applies and `disableSignUp` does **not** block admin `createUser`.
- **`auth.api.getSession` headers** — `headers()` is sync on Next 14; revisit in Phase 5 (becomes async).
- **Schema regen (`@better-auth/cli generate`)** rewrites `schema.prisma` and may not preserve the domain
  models / may rename fields the relations depend on — review the diff, reconnect carefully, confirm
  `deletedAt` and the `onDelete: Cascade` survived, re-run the gate.
- **Soft-delete completeness** — verify all three effects land (set `deletedAt`, drop credential, revoke
  sessions) and that the optimistic-cookie + authoritative-layout split actually boots the user.
- **No E2E net yet** (high-risk phase) — rely on thorough manual smoke + code review; Phase 2 adds the net.

## Master-plan tracking update (carry into this PR)

- Mark Phase 0 row **merged** (per [[upgrade-phase-pr-doc-updates]] convention — Phase 0 row was left
  "in review").
- Mark Phase 1 row **in progress / in review** with this branch.
