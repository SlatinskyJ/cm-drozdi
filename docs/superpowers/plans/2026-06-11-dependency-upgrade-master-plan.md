# Dependency Upgrade Master Plan

> **For agentic workers:** This is the MASTER ROADMAP, not an execution plan. Each phase gets its own spec + detailed execution plan (written via superpowers:writing-plans) immediately before that phase starts. Do NOT execute phases from this document alone.

**Goal:** Upgrade cm-drozdi from its 2024-era T3 stack to current LTS/stable versions of every dependency, one phase per PR, with a working app after every phase.

**Architecture:** Nine sequential phases. First lay guardrails (baseline + an E2E regression net), then cheap pinned-version bumps, then UI library migration (removes the biggest React-19 blocker), then framework majors (React/Next), then styling (Tailwind 4), then data layer (Prisma 7), then validation (Zod 4), then tooling (ESLint flat config). Each phase is independently shippable and leaves `main` deployable.

**Tech Stack:** Next.js, React, tRPC, Prisma, NextAuth v4, Tailwind, shadcn/ui, Zod, TypeScript, Yarn 1, Vercel Postgres.

---

## Ground rules (apply to every phase)

1. **One phase = one branch = one PR.** Branch from fresh `main`. Merge before starting next phase.
2. **Before each phase:** write a spec (brainstorming skill) + detailed execution plan (writing-plans skill) saved next to this file as `2026-MM-DD-phase-N-<name>.md`.
3. **Verification gate (the gate, since there is no unit suite):**
   ```bash
   yarn install
   npx prisma generate
   yarn lint
   npx tsc --noEmit
   yarn build
   yarn e2e        # added once Phase 1 lands; before that, manual smoke only
   ```
   All must pass clean. Then manual smoke for anything e2e does not cover: `yarn dev`, log in, view events calendar, open event detail, create/request event, delete event.
4. **No mixed concerns.** If a phase reveals an unrelated bug, fix in separate PR.
5. **Lockfile:** commit `yarn.lock` changes with the phase that caused them.
6. **Rollback story:** every phase is one `git revert` of one merge commit.

---

## Current state (audited 2026-06-11)

- On `main` @ `60096ee`, clean tree.
- **Testing: none.** No `*.test.*`/`*.spec.*` files, no vitest/jest/playwright/cypress, no `.github/workflows` CI, no `test` script. Only existing safety net = `tsc` + `next build` + manual checking.
- Shadcn migration WIP exists in `stash@{0}` on branch `chore/migrate-to-shadcn` (new `Button.tsx`/`Calendar.tsx`, old ones renamed `Old*`, `components.json`, `src/lib/`, edits to Menu/events components/globals.css/tailwind.config).
- Node v22.14.0 local, Yarn 1.22.19. No `engines` field, no `.nvmrc`.
- 14 files import `@nextui-org/*`. ESLint uses legacy `.eslintrc.cjs`. `src/env.js` uses `@t3-oss/env-nextjs`. NextAuth v4 with Prisma adapter, custom `src/middleware.ts`.

## Version gap table

| Package | Current | Target | Jump |
|---|---|---|---|
| next | ^14.2.4 | 16.x | 2 majors |
| react / react-dom | ^18.3.1 | 19.2.x | 1 major |
| prisma + @prisma/client | ^5.21 / ^5.14 | 7.x | 2 majors |
| tailwindcss | ^3.4.3 | 4.x | 1 major (config rewrite) |
| zod | ^3.23.3 | 4.x | 1 major |
| eslint | ^8.57 | 10.x | 2 majors (flat config) |
| @trpc/* | 11.0.0-rc.446 | 11.x stable | rc → stable |
| @tanstack/react-query | ^5.50 | 5.10x | minors |
| framer-motion | ^11 | **removed** | dies with NextUI |
| @nextui-org/* (13 pkgs) | 2.x | **removed** | replaced by shadcn |
| next-auth | ^4.24.7 | 4.24.x | patches only (v5 out of scope) |
| @auth/prisma-adapter | ^1.6.0 | latest v4-compatible | check peer deps |
| @vercel/postgres | ^0.10.0 | keep (deprecated upstream) | migration deferred, see Phase 6 note |
| typescript | ^5.5.3 | 5.x latest | minor |
| @types/node | ^20 | 22.x | match runtime |

**Explicit non-goals:** NextAuth v5 / Auth.js migration, replacing @vercel/postgres, a full unit/integration suite, Yarn 1 → modern package manager. Each is a candidate follow-up after Phase 8.

---

## Phase 0 — Baseline & guardrails

**Branch:** `chore/upgrade-phase-0-baseline`
**Risk:** none. **Size:** tiny.

- Add `"engines": { "node": ">=20" }` to package.json; add `.nvmrc` with `22`.
- Run the verification gate on untouched `main` and record results in the phase PR description — this is the baseline every later phase is measured against. If anything already fails, fix it here.
- Optional: add `"typecheck": "tsc --noEmit"` script so the gate is one command per step.

**Exit criteria:** gate passes on main; baseline documented.

## Phase 1 — E2E regression net

**Branch:** `chore/upgrade-phase-1-e2e`
**Risk:** low (additive only, no app changes). **Size:** medium. **Rationale:** with zero tests and seven risky upgrade PRs ahead, a thin behavior-level net catches the regressions `tsc` cannot — Tailwind visual breaks, Next caching/rendering changes, runtime auth/data breakage. Playwright E2E tests behavior not implementation, so it survives every later upgrade unchanged.

- Add Playwright + `@playwright/test`; `playwright.config.ts`; `yarn e2e` + `yarn e2e:ui` scripts.
- **Auth strategy (decide in spec):** NextAuth v4 login in E2E — likely a test-only credentials path or storageState session-cookie injection, against a seeded test DB. Needs a dev/test database + seed script. This is the main design question for the spec.
- Critical-path specs (~5-8): unauthenticated redirect to login; events calendar renders; open event detail modal; request/create event form — validation error + successful submit; delete event; menu navigation.
- Add `.github/workflows/ci.yml`: install → prisma generate → lint → tsc → build → e2e on every PR. (First CI in the repo.)
- Tests assert user-visible outcomes (text, navigation, row presence), never internal markup that shadcn/Tailwind phases will legitimately change.

**Exit criteria:** `yarn e2e` green locally and in CI; all critical paths covered; gate (now incl. e2e) documented as the new baseline. From here on, every phase must keep e2e green.

## Phase 2 — Low-risk version bumps

**Branch:** `chore/upgrade-phase-2-minor-bumps`
**Risk:** low. **Size:** small.

- `@trpc/server`, `@trpc/client`, `@trpc/react-query`: `11.0.0-rc.446` → `^11` stable. Check changelog rc.446 → stable for renamed APIs (e.g. `unstable_httpBatchStreamLink` naming, transformer placement) against `src/trpc/` setup files.
- `@tanstack/react-query` → latest 5.x.
- Minor/patch bumps: `next-auth`, `@auth/prisma-adapter` (stay v4-peer-compatible), `react-hook-form`, `react-hot-toast`, `react-icons`, `superjson`, `geist`, `@vercel/speed-insights`, `prettier`, `prettier-plugin-tailwindcss`, `@t3-oss/env-nextjs` (latest zod-3-compatible only — zod 4 comes in Phase 7), `@types/node` → 22.
- Do **not** touch: react, next, prisma, tailwind, zod, eslint, anything `@nextui-org`.

**Exit criteria:** gate passes; tRPC calls work in e2e + smoke.

## Phase 3 — Finish shadcn migration, remove NextUI

**Branch:** resume `chore/migrate-to-shadcn` (pop `stash@{0}`)
**Risk:** medium (UI regressions). **Size:** large — the biggest manual-work phase.

- Restore stash; reconcile with anything merged since (`2c0a036` instrument-tables commit is on this branch but not main — decide: rebase branch on main or cherry-pick).
- Migrate remaining NextUI consumers (14 files at audit time): Providers, Chip, Tooltip, Calendar, Button, Dropdown, Skeleton(s), KeyValue, EventForm, Event, EventDetailModal, RequestEvent, useEventForm.
- Component mapping: Modal → shadcn Dialog, Dropdown → DropdownMenu, date-picker/date-input → shadcn Calendar (`react-day-picker`) + Popover + input, Chip → Badge, Switch → Switch, Skeleton → Skeleton, Tooltip → Tooltip, Card → Card.
- Remove deps: all 13 `@nextui-org/*`, `framer-motion`, `@internationalized/date` (verify nothing else imports it first).
- Remove NextUI plugin/content paths from `tailwind.config.ts`; delete `Old*.tsx` files once nothing imports them.
- shadcn install targets Tailwind 3 setup for now (Tailwind 4 conversion is Phase 5).
- E2E from Phase 1 must stay green — if a selector breaks, it means either a real regression or an over-coupled test; fix the test only if it asserted internal markup.

**Exit criteria:** `grep -r "@nextui-org\|framer-motion" src/` returns nothing; gate passes; every screen visually smoke-checked (calendar, modals, forms, toasts, menu).

## Phase 4 — React 19 + Next.js 14 → 15 → 16

**Branch:** `chore/upgrade-phase-4-react19-next16`
**Risk:** high. **Size:** large. Two sub-steps inside one PR, committed separately.

**Step A — Next 15 + React 19:**
- `npx @next/codemod@canary upgrade 15` (handles async request APIs).
- Breaking changes to hunt manually: `cookies()`/`headers()`/`draftMode()` now async (check `src/server/`, tRPC context, auth); `params`/`searchParams` are Promises in pages/layouts/routes; fetch & route handlers **no longer cached by default** (audit every `fetch` and GET route handler for needed `cache`/`revalidate` opts); `useFormState` → `useActionState`.
- Bump `@types/react` `@types/react-dom` → 19. NextAuth v4 + React 19: expect peer-dep warnings, verify `SessionProvider`/`getServerSession` runtime behavior.
- Verify gate + full smoke before Step B.

**Step B — Next 16:**
- `npx @next/codemod@canary upgrade` to 16. Review: Turbopack-by-default for dev/build (check tailwind/postcss compat — should be fine on TW3), `middleware.ts` conventions (file still supported; confirm matcher behavior unchanged for the timezone-offset + auth middleware), removed legacy APIs (`next lint` behavior changes — note for Phase 8), image defaults.
- `eslint-config-next` → 16-compatible version (still on legacy config until Phase 8 — confirm it still loads under eslint 8; if next 16 drops eslintrc support entirely, Phase 8 folds into this phase — check release notes during spec).

**Exit criteria:** gate passes on Next 16/React 19; auth flow, middleware redirects, event CRUD, calendar all e2e + smoke-tested; build output shows no unexpected dynamic/static rendering changes (`yarn build` route table compared against Phase 0 baseline).

## Phase 5 — Tailwind 3 → 4

**Branch:** `chore/upgrade-phase-5-tailwind4`
**Risk:** medium-high (visual regressions everywhere, silent). **Size:** medium.

- Run `npx @tailwindcss/upgrade` (requires Node 20+, clean git — both satisfied).
- Config moves: `tailwind.config.ts` theme → CSS `@theme` in `src/styles/globals.css`; `@tailwind base/components/utilities` → `@import "tailwindcss"`; PostCSS plugin → `@tailwindcss/postcss`.
- shadcn/ui Tailwind-4 conversion: CSS variables move to `@theme inline`, `tailwindcss-animate` → `tw-animate-css`, update per shadcn's official TW4 guide. Verify `components.json` config matches.
- `prettier-plugin-tailwindcss` → TW4-compatible version.
- Hunt renamed utilities the codemod flags: `shadow-sm`→`shadow-xs` scale shifts, `outline-none`→`outline-hidden`, ring width default change, border default color change.

**Exit criteria:** gate passes; side-by-side visual check of every page vs production; dark/light theme (if any) intact.

## Phase 6 — Prisma 5 → 6 → 7

**Branch:** `chore/upgrade-phase-6-prisma7`
**Risk:** high (data layer). **Size:** medium. Two sub-steps, committed separately.

**Step A — 5 → 6:** minimal breakage expected; Node/TS minimums already satisfied. Check: implicit m-n relation order changes, `Buffer` → `Uint8Array` for `Bytes` fields, full-text search flag changes. Regenerate client, gate, smoke.

**Step B — 6 → 7:** the real work. During spec, read the v7 upgrade guide and decide on:
- New `prisma.config.ts` (replaces schema-folder/env conventions; `package.json#prisma` config removed).
- Generator: `prisma-client-js` → new `prisma-client` generator (output path now explicit, client imported from generated path — touches `src/server/db.ts` and possibly the `postinstall` hook).
- Driver adapters now the default pattern — decide between `@prisma/adapter-pg` and keeping current setup; this is the moment to evaluate dropping deprecated `@vercel/postgres` (it's only used for the DB connection — check `src/server/db.ts`). If swap is trivial, fold it in; if not, defer and note follow-up.
- `@auth/prisma-adapter` compatibility with Prisma 7 client — verify before committing to Step B; if incompatible, Step B blocks until adapter release supports it (check during spec, not mid-flight).
- Run `prisma migrate dev` against a branch/dev database, never prod. Verify `db:*` scripts still work.

**Exit criteria:** gate passes; all CRUD e2e + smoke-tested against dev DB; migration deploy dry-run documented; Vercel build (postinstall generate) works.

## Phase 7 — Zod 3 → 4

**Branch:** `chore/upgrade-phase-7-zod4`
**Risk:** medium. **Size:** small-medium.

- `zod` → 4.x and `@t3-oss/env-nextjs` → zod-4-compatible major together (env.js is the tightest coupling).
- Breaking changes to hunt: `z.string().email()` → `z.email()` style top-level formats, error customization API (`message` → `error`, errorMap changes), `.default()` semantics with transforms, `z.record()` now requires two args, coerce changes.
- Touch points: `src/env.js`, every tRPC router input schema (`src/server/api/routers/`), `useEventForm` / form validation.
- tRPC 11 stable supports zod 4 — confirm resolver versions if react-hook-form uses `@hookform/resolvers` (not currently a dep; forms may validate via tRPC only — confirm during spec).

**Exit criteria:** gate passes; form validation errors still render correctly (submit invalid event form, check messages); env validation still fails-fast on missing var (test by unsetting one).

## Phase 8 — ESLint 8 → 10 flat config

**Branch:** `chore/upgrade-phase-8-eslint10`
**Risk:** low (tooling only, no runtime). **Size:** small-medium.

- `.eslintrc.cjs` → `eslint.config.mjs` flat config.
- `eslint` → 10.x, `@typescript-eslint/*` → latest (flat-native `typescript-eslint` meta-package), `eslint-config-next` flat preset, drop `@types/eslint`.
- Preserve current rule customizations: type-checked presets, `array-type` off, `consistent-type-definitions` off, inline type-imports preference, `no-unused-vars` argsIgnorePattern, `require-await` off, drizzle rules (audit full `.eslintrc.cjs` during spec — only top 30 lines reviewed so far).
- `next lint` was deprecated/removed in Next 16 — switch `lint` script to `eslint .` invocation per Next 16 docs.
- Expect new violations from newer rule versions: fix or explicitly disable with comment, don't blanket-disable.

**Exit criteria:** `yarn lint` passes with equivalent-or-stricter ruleset; CI/Vercel build unaffected.

---

## Phase order rationale

- **1 before everything risky:** the E2E net is the regression detector for phases 3-8; building it first means every later phase has an objective pass/fail signal beyond `tsc`.
- **3 before 4:** NextUI 2.x is incompatible-or-flaky with React 19 and pins framer-motion 11. Migrating UI first means Phase 4 debugs only framework breakage, not doomed-library breakage.
- **4 before 5:** Tailwind 4 + shadcn TW4 guide assumes current React; also Next 16's Turbopack default interacts with PostCSS — better to land framework first, then styling on a stable base.
- **6/7 after 4:** independent of UI churn; kept late so the riskiest data-layer change happens on an otherwise-quiet codebase. 6 and 7 could swap or parallelize if needed.
- **8 last:** pure tooling, zero runtime risk, and final ESLint setup depends on Next 16 (Phase 4) being settled. **Exception:** if Next 16 hard-drops eslintrc support and `next build` fails on it, pull Phase 8 forward into Phase 4 (verify in Phase 4 spec).

## Tracking

| Phase | PR | Status |
|---|---|---|
| 0 — Baseline | – | not started |
| 1 — E2E regression net | – | not started |
| 2 — Minor bumps | – | not started |
| 3 — shadcn migration | – | WIP in stash@{0} |
| 4 — React 19 / Next 16 | – | not started |
| 5 — Tailwind 4 | – | not started |
| 6 — Prisma 7 | – | not started |
| 7 — Zod 4 | – | not started |
| 8 — ESLint 10 | – | not started |
