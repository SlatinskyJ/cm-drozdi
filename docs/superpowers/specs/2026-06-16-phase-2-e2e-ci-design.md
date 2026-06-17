# Phase 2 — E2E Regression Net + CI: Design Spec

**Date:** 2026-06-16
**Branch:** `chore/upgrade-phase-2-e2e-ci`
**Status:** approved

---

## Overview

Adds a Playwright E2E regression net covering all critical user paths, a three-job GitHub Actions CI workflow, and per-PR isolated preview databases via Neon branching. Built on top of the Phase 1 Better Auth credentials system. This net is the regression detector for phases 4–9.

---

## 1. Test Suite

### Structure

```
playwright.config.ts
e2e/
  global-setup.ts             # prisma migrate deploy + seed; programmatic auth → storageState
  helpers/
    db.ts                     # truncate domain tables + reseed helper
    auth.ts                   # storageState path constants
  specs/
    auth.spec.ts              # real login form UI; unauthenticated redirect
    events-calendar.spec.ts   # calendar renders; open event detail modal
    event-crud.spec.ts        # create event (validation error + success); delete event
    admin-gate.spec.ts        # /members → access forbidden for member role
    members.spec.ts           # create member; list; delete (confirm modal); role change
```

### Seed Changes

Update `prisma/seed.ts`: give the dev/test member user a known password (same `DEV_PASSWORD` pattern as admin). Production seed behaviour is unchanged — admin remains passwordless in prod.

Split the `db:seed` npm script:
- `"db:seed"` — `tsx prisma/seed.ts` (no `--env-file`; used by Vercel release command and CI)
- `"db:seed:local"` — `tsx --env-file=.env prisma/seed.ts` (local dev)

Update CLAUDE.md commands section to reference `db:seed:local` for local use.

### Authentication

`global-setup.ts` calls Better Auth's `signIn.email` API directly (programmatic — no browser; uses `auth.api.signInEmail` with `asResponse: true` to extract `set-cookie` header) to obtain session cookies for two roles:

- `e2e/.auth/admin.json` — used by `events-calendar.spec.ts`, `event-crud.spec.ts`, `members.spec.ts`
- `e2e/.auth/member.json` — used by `admin-gate.spec.ts`

`auth.spec.ts` uses no storageState — it tests the real login form and unauthenticated redirect flows end-to-end.

### Test Isolation

`global-setup.ts` runs `prisma migrate deploy` + `yarn db:seed` once before the full suite.

Each spec file runs `resetDb()` in `beforeEach`:
- Truncates domain tables: `Event`, `UsersOnEvents`, `InstrumentsOnUsers`
- Re-seeds Better Auth user accounts (admin + member with known credentials)
- Better Auth schema tables (`User`, `Session`, `Account`, `Verification`) are not truncated — managed via seeding only

`members.spec.ts` creates its own throwaway users for edit/delete/role-change tests — never mutates the shared seeded admin or member.

### Spec Coverage

| Spec | Scenarios |
|---|---|
| `auth.spec.ts` | Unauthenticated request → redirects to `/login`; login form with valid credentials succeeds + redirects to `/events`; login form with invalid credentials shows error |
| `events-calendar.spec.ts` | Events calendar page renders; clicking an event opens the detail modal |
| `event-crud.spec.ts` | Create event form — submit with missing fields shows validation error; successful create adds event to calendar; delete event removes it |
| `admin-gate.spec.ts` | Member role visiting `/members` sees access forbidden page (not admin content) |
| `members.spec.ts` | Members list renders existing members; create member form — validation error + successful create; role change via dropdown; delete member via confirm modal |

### Assertion Style

Assert user-visible outcomes: text content, navigation, row presence, error messages. Never assert internal markup, CSS class names, or component structure — these will legitimately change in Phase 4 (shadcn migration).

### Playwright Config

- Browser: **Chromium only**
- Workers: **1 (serial)** — DB is shared; parallelism requires per-worker DB isolation
- `webServer`: `command: 'yarn start'` (always match prod build; CI runs `yarn build` before `yarn e2e`)
- `use.baseURL`: `http://localhost:3000`

### Scripts

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

`e2e/.auth/` must be added to `.gitignore` — contains session cookies generated at runtime.

---

## 2. CI Workflow

**File:** `.github/workflows/ci.yml`

**Trigger:**
```yaml
on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened, ready_for_review]
```

**Three parallel jobs — all required for merge:**

### `lint` job
- Runs on: all PRs including drafts
- No DB required
- Steps: checkout → Node 22 → `yarn install` (cached) → `SKIP_ENV_VALIDATION=1 yarn lint`

### `typecheck` job
- Runs on: all PRs including drafts
- No DB required
- Steps: checkout → Node 22 → `yarn install` (cached) → `prisma generate` → `yarn typecheck`

### `e2e` job
- Runs on: **ready PRs only** (`if: github.event.pull_request.draft == false`)
- Postgres 16 service container on `localhost:5432`
- Steps: checkout → Node 22 → `yarn install` (cached) → `prisma generate` → `prisma migrate deploy` + `yarn db:seed` → `SKIP_ENV_VALIDATION=1 yarn build` → `yarn e2e`

**Secrets required in GitHub repo settings:**

| Secret | Value |
|---|---|
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5432/test` (service container) |
| `BETTER_AUTH_SECRET` | any fixed string |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@cmdrozdi.cz` (required because `next build` sets `NODE_ENV=production`, making this field required with no default) |

**Branch protection:** all three jobs set as required status checks in GitHub branch protection settings for `develop`.

---

## 3. Neon + Preview DB

> **Revised 2026-06-17:** First execution of this section wired a single shared Neon database (`cm-drozdi-postgres`) across Development, Preview, and Production — not the per-PR branching this section specifies, and not via the Previews Integration. That caused `prisma migrate deploy` to fail on every preview build with `P3005` (schema not empty / no migration history), since the shared DB's schema predates Prisma's migration tracking. The revision below creates a **new, separate Neon project dedicated to Preview only**, leaving the existing shared DB serving Production (and Development) untouched until the full master-plan migration (deferred to after Phase 9, per the original "Production" note below).

### Remove dead dependency

`@vercel/postgres` is in `package.json` but never imported anywhere in the codebase. Remove it. *(Done — commit `6259191`.)*

### Neon project setup (manual steps — user performs these)

1. In the same Neon account, create a **new** project, e.g. `cm-drozdi-preview` (separate from the existing `cm-drozdi-postgres` project, which keeps serving Production/Development unchanged)
2. Use the project's default branch as the preview parent branch — rename it to `develop` for clarity
3. Copy the connection string for that branch
4. Run `DATABASE_URL=<develop-connection-string> npx prisma migrate deploy && DATABASE_URL=<develop-connection-string> yarn db:seed` to establish the baseline (correct migration history + seed data) on `develop`

No second/unused branch is created in this project — a future production migration target (if/when one is needed) is a decision for the later master-plan phase that actually cuts Production over to Neon, not this one (YAGNI).

### Vercel integration (manual steps — user performs these)

1. In Vercel project settings, go to **Integrations** → search for **Neon Postgres**
2. Install the **Neon Postgres Previews Integration** and connect it to the new `cm-drozdi-preview` Neon project
3. Set `develop` as the parent branch for preview deployments
4. Scope the integration to the **Preview** environment only — Production and Development env vars must not change
5. Verify that `DATABASE_URL` appears in Vercel's Preview environment settings (injected automatically by the integration) and that Production/Development `DATABASE_URL` are untouched

Vercel + Neon will then automatically:
1. Create a new Neon branch from `develop` for each preview deployment (inheriting its schema, migration history, and seed data)
2. Inject that branch's `DATABASE_URL` into the preview environment
3. Clean up the branch when the PR is closed/merged

Because each preview branch forks from a properly `migrate deploy`'d `develop`, the `P3005` baseline error cannot recur on preview builds.

### Build-time migrate + seed

`vercel.json`'s `releaseCommand` is **not a valid Vercel config key** (schema rejects it — discovered when this caused PR #13's Vercel build to fail). Instead, use a `vercel-build` script in `package.json`, which Vercel runs automatically in place of `next build`:

```json
"vercel-build": "if [ \"$VERCEL_ENV\" != \"production\" ]; then npx prisma migrate deploy && yarn db:seed; fi && next build"
```

This keeps each preview DB in sync with the branch's migrations and seed data, with no `vercel.json` needed. *(Done — commit `806fc8b`.)*

### Production

Production `DATABASE_URL` in Vercel is **unchanged** — stays on the existing `cm-drozdi-postgres` Neon database for the full duration of the master plan, until a later phase explicitly migrates it.

### `.env.example`

Update the existing Neon comment to clarify it refers to the dedicated preview project (`cm-drozdi-preview`), not the shared Production database.

---

## 4. CLAUDE.md Update

The draft PR rule is already present in CLAUDE.md. No change needed.

Update the Commands section to reference `yarn db:seed:local` for local seeding (replacing the old `yarn db:seed` which no longer loads `.env`).

---

## Exit Criteria

- `yarn e2e` passes locally against a fresh test DB
- All 5 spec files green in CI
- CI workflow required on PRs to `develop`; `e2e` job skips on draft PRs
- Vercel preview deployments: login works, each PR gets its own isolated DB branch
- Production deployment: unaffected
