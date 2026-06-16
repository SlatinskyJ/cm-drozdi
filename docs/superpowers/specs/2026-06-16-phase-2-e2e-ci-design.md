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

### Authentication

`global-setup.ts` calls Better Auth's `signIn.email` API directly (programmatic — no browser) to obtain session cookies for two roles:

- `e2e/.auth/admin.json` — used by `events-calendar.spec.ts`, `event-crud.spec.ts`, `members.spec.ts`
- `e2e/.auth/member.json` — used by `admin-gate.spec.ts`

`auth.spec.ts` uses no storageState — it tests the real login form and unauthenticated redirect flows end-to-end.

### Test Isolation

`global-setup.ts` runs `prisma migrate deploy` + `yarn db:seed` once before the full suite.

Each spec file runs `resetDb()` in `beforeAll`:
- Truncates domain tables: `Event`, `UsersOnEvents`, `InstrumentsOnUsers`
- Re-seeds Better Auth user accounts (admin + member with known credentials)
- Better Auth schema tables (`User`, `Session`, `Account`, `Verification`) are not truncated — managed via seeding only

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

### Scripts

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

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

**Branch protection:** all three jobs set as required status checks in GitHub branch protection settings for `develop`.

---

## 3. Neon + Preview DB

### Remove dead dependency

`@vercel/postgres` is in `package.json` but never imported anywhere in the codebase. Remove it.

### Neon account setup

Create a Neon account with two branches:

| Branch | Purpose |
|---|---|
| `main` | Future production DB (unused until master plan complete) |
| `develop` | Preview parent — migrated + seeded with dev data |

Run `prisma migrate deploy && yarn db:seed` against the `develop` Neon branch once during setup to establish the baseline.

### Vercel integration

Install the **Neon Postgres Previews Integration** on Vercel. Configure `develop` as the parent branch for preview deployments. Vercel + Neon automatically:
1. Create a new Neon branch from `develop` for each preview deployment
2. Inject `DATABASE_URL` for that branch into the preview environment
3. Clean up the branch when the PR is closed/merged

### Release command

Add `vercel.json` with a Release Command that runs after each deployment build, guarded to skip production:

```json
{
  "releaseCommand": "if [ \"$VERCEL_ENV\" != \"production\" ]; then prisma migrate deploy && yarn db:seed; fi"
}
```

This keeps each preview DB in sync with the branch's migrations and seed data.

### Production

Production `DATABASE_URL` in Vercel is **unchanged** — stays on existing Vercel Postgres for the full duration of the master plan. The Neon `main` branch is created now but not wired to production until after Phase 9.

### `.env.example`

Add a comment noting the Neon connection string format for developers setting up a Neon-backed environment.

---

## 4. CLAUDE.md Update

Add to the Branching section:

> **PRs must always be created as drafts** (`gh pr create --draft`). Only the user marks a PR ready for review. Never create a ready-for-review PR directly.

---

## Exit Criteria

- `yarn e2e` passes locally against a fresh test DB
- All 5 spec files green in CI
- CI workflow required on PRs to `develop`; `e2e` job skips on draft PRs
- Vercel preview deployments: login works, each PR gets its own isolated DB branch
- Production deployment: unaffected
