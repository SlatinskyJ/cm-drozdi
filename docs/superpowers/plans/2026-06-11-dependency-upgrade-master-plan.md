# Dependency Upgrade & Modernization Master Plan

> **For agentic workers:** This is the MASTER ROADMAP, not an execution plan. Each phase gets its own spec + detailed execution plan (written via superpowers:writing-plans) immediately before that phase starts. Do NOT execute phases from this document alone.

**Goal:** Modernize cm-drozdi from its 2024-era T3 stack to current stable versions, and replace the aging OAuth-only auth with a maintained credentials-based system — one phase per PR, with a working, deployable app after every phase.

**Architecture:** Ten sequential phases. Lay guardrails (baseline), migrate auth to Better Auth, build an E2E regression net + CI, then climb the dependency ladder ordered by risk and dependency chain: cheap bumps → UI library migration → framework majors → styling → data layer → validation → tooling. Each phase is independently shippable.

**Tech Stack:** Next.js, React, tRPC, Prisma, **Better Auth** (replacing NextAuth v4), Tailwind, shadcn/ui, Zod, TypeScript, Yarn 1, Postgres.

---

## Decisions (locked 2026-06-14)

- **Branch base:** ALL phases fork from `develop` and PR back into `develop`. Ignore `main` unless told otherwise. `main` stays production-only (release merges from develop).
- **Prior attempts:** Discard all previous upgrade work — remote branches `feature/upgrade-to-NextJS15`, `chore/update-prisma`, and the local shadcn stash/`chore/migrate-to-shadcn` branch. Nothing is salvaged.
- **Version target:** latest stable across the board (Next 16, React 19, Prisma 7, Tailwind 4, Zod 4, ESLint 10 — or 9 if plugins lag, see ESLint target below). Early-adopter risk accepted; the phased approach + E2E net absorbs it.
- **Auth:** migrate off NextAuth v4 to **Better Auth** (actively maintained, free/self-hosted, first-class email+password, DB sessions, optional social later). NextAuth v5/Auth.js is maintenance-mode and OAuth-focused — rejected.
  - **Account model:** per-member, **admin-created** (no open self-registration). Better Auth `admin` plugin for create-member + role management.
  - **Social login:** dropped as a requirement; nice-to-have to add later.
  - **Data:** **full DB reset** — wipe everything (incl. events) and reseed. No data migration. Greatly simplifies the auth phase.
- **Roles:** keep `UserRole` GUEST=0 / MEMBER=1 / ADMIN=2, carried as a Better Auth custom user field.
- **CI:** introduce **GitHub Actions** (repo has none) in Phase 2 — runs the full gate on every PR with a throwaway Postgres service.

## Decisions (added 2026-10-12)

- **Merge authority:** Claude may merge any PR it creates into `develop` (phase PRs and any other) itself, gated by an agent review: an `opus` reviewer agent posts `[review-agent]` PR comments, fixer agents resolve every `[must-fix]`, and once the verdict is `READY TO MERGE` Claude marks the PR ready, waits for all CI checks to finish green (on docs-only PRs the skipped jobs count as passing), and squash-merges. If CI fails after `gh pr ready`, Claude runs `gh pr ready --undo`, fixes, and the reviewer re-reviews. `main` is never touched. **Exception:** a PR that embodies a big decision (architecture, a scope change versus this plan, dropping or adding a phase, a data-loss risk, a change to workflow/governance rules, anything the user hasn't already approved) needs the user's OK before merge. See `CLAUDE.md` → Branching.
- **ESLint target (Phase 9):** when Phase 9 starts, re-check peer support of `eslint-plugin-react` / `eslint-plugin-import` / `eslint-plugin-jsx-a11y` (pulled in by `eslint-config-next@16`). If they support ESLint 10, go to 10; otherwise do ESLint 9 flat config and note 10 as a follow-up. Phase 5 keeps legacy lint working by pinning `eslint-config-next@15.5` and running `eslint` directly (`next lint` is removed in Next 16).
- **Version targets refreshed** (npm, 2026-10-12) — see the version gap table. Two adjustments:
  - **Prisma:** target latest **7.x stable** (7.10 at refresh). npm's `latest` tag points at `8.0.0-rc.*`; a release candidate is not "latest stable", so Prisma 8 is out of scope.
  - **TypeScript:** 6.0 and 7.0 are now released. `typescript-eslint` (8.71) supports only `<6.1`, so target **TypeScript 6.0.x**, bumped in Phase 9 alongside the ESLint tooling. TS 7 is deferred until `typescript-eslint` supports it.

---

## Ground rules (apply to every phase)

1. **One phase = one branch = one PR.** Fork from fresh `develop`. Merge (after the agent review gate — see Decisions 2026-10-12) before starting next phase.
2. **Before each phase:** write a spec (brainstorming skill) saved to `docs/superpowers/specs/2026-MM-DD-phase-N-<name>.md`, then a detailed execution plan (writing-plans skill) saved to `docs/superpowers/plans/2026-MM-DD-phase-N-<name>.md`. (Specs live in `specs/`, execution plans + this master plan live in `plans/`.)
3. **Verification gate (the gate, since there is no unit suite):**
   ```bash
   yarn install
   npx prisma generate
   yarn lint
   npx tsc --noEmit
   yarn build
   yarn e2e
   ```
   All must pass clean. From Phase 2 on, CI enforces this on every PR.
4. **No mixed concerns.** If a phase reveals an unrelated bug, fix in a separate PR.
5. **Lockfile:** commit `yarn.lock` changes with the phase that caused them.
6. **Rollback story:** every phase is one `git revert` of one merge commit.

---

## Current state (audited 2026-06-11 / 14)

- Work from `develop` (4 commits ahead of `main`). Discard prior upgrade branches and the shadcn stash.
- **Testing: none.** No `*.test.*`/`*.spec.*`, no Playwright/vitest/jest, no `.github/workflows`, no `test` script. Safety net today = `tsc` + `next build` + manual checking.
- **Auth today:** NextAuth v4, OAuth-only (Discord + Facebook), `@auth/prisma-adapter`, **database sessions**. `src/server/auth.ts`, `src/middleware.ts` (cookie gate), `src/app/api/auth/[...nextauth]/route.ts`, `src/utils/permissions.ts`, `getServerAuthSession`. Env: `DISCORD_*`, `FACEBOOK_*`, `NEXTAUTH_*` in `src/env.js`.
- Node v22.14.0 local, Yarn 1.22.19. No `engines`, no `.nvmrc`.
- 14 files import `@nextui-org/*`. ESLint on legacy `.eslintrc.cjs`. `src/env.js` uses `@t3-oss/env-nextjs`.

## Version gap table

Targets refreshed 2026-10-12 (latest stable on npm at that date; re-check at each phase's spec).

| Package | Current | Target | Jump |
|---|---|---|---|
| next-auth + @auth/prisma-adapter | — (removed; better-auth ^1.6.18) | **removed** → better-auth | done (Phase 1) |
| next | ^14.2.4 | 16.x (16.4 at refresh) | 2 majors |
| react / react-dom | ^18.3.1 | 19.x (19.3 at refresh) | 1 major |
| prisma + @prisma/client | ^5.21 / ^5.14 | 7.x stable (7.10 at refresh; not 8.0 rc) | 2 majors |
| tailwindcss | ^4.3.3 (4.3.3) | 4.x (4.3 at refresh) | done (Phase 6) |
| zod | ^3.25 | 4.x (4.6 at refresh) | 1 major |
| eslint | ^9.39.5 (flat config) | 10.x (or 9.x, see Decisions 2026-10-12; 10.12 at refresh) | done (Phase 9) — 10 pending plugin peers |
| @trpc/* | ^11.17.0 | 11.x stable | done (Phase 3) |
| @tanstack/react-query | ^5.101.0 | 5.10x | done (Phase 3) |
| framer-motion | ^11 | **removed** | dies with NextUI |
| @nextui-org/* (13 pkgs) | 2.x | **removed** | replaced by shadcn |
| @vercel/postgres | — (removed) | **removed** | done (Phase 2) |
| typescript | ~6.0.3 | 6.0.x (not 7 — typescript-eslint caps at <6.1) | done (Phase 9) — TS 7 deferred |
| @types/node | ^22 | 22.x | done (Phase 3) |

**Explicit non-goals:** social/OAuth login (defer as nice-to-have), a full unit/integration suite, Yarn 1 → modern package manager. Candidate follow-ups after Phase 9.

**Post-Phase-9 cleanup:** done — `start-database.sh` removed (local dev runs a native Postgres install, not Docker). Phase 9 follow-ups: **ESLint 10** once `eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y` declare `^10` in their `eslint` peer (ESLint 9 is already out of support); **TypeScript 7** once `typescript-eslint` supports it; **Prettier config shadowing** — `.prettierrc.js` takes precedence over `prettier.config.js`, so `prettier-plugin-tailwindcss` is inactive; merging them reformats the codebase, so it is its own PR, which also removes `.prettierrc.js` from `tsconfig.json#include`.

**Open follow-ups found during the run (not yet fixed):** 4 `event-crud` e2e specs around the `EventForm` start picker (Czech/past-days, exact start display, both "editing without changes keeps … 14:00") fail when the browser clock is frozen at ~00:00 Prague with the default e2e `BROWSER_TZ=America/New_York` (all runs, local and CI), i.e. roughly 00:00–06:00 Prague; `EventForm` already passes `timeZone={APP_TIME_ZONE}` and a Prague-based `disabled` bound, so the suspected cause is react-day-picker's timezone handling or the specs' own date assumptions — needs investigation; `deletes an event` flakes ~1/130 after ~2 min of repeated runs (admin delete button missing, i.e. the session role is not seen); the proxy matcher does not exclude `_vercel`; consider pg `sslmode=verify-full` and `attachDatabasePool`; feature-branch Vercel previews fail with "Resource provisioning failed" before building, while `develop` previews build.

---

## Phase 0 — Baseline & guardrails

**Branch:** `chore/upgrade-phase-0-baseline`
**Risk:** none. **Size:** tiny.

- Add `"engines": { "node": ">=20" }`; add `.nvmrc` with `22`.
- Add `"typecheck": "tsc --noEmit"` script so the gate is one command per step.
- Run the gate on untouched `develop`; record results in the PR as the baseline. Fix anything already broken here.

**Exit criteria:** gate passes on develop; baseline documented.

## Phase 1 — Auth migration to Better Auth

**Branch:** `feat/upgrade-phase-1-better-auth`
**Risk:** high (auth is critical-path; no E2E net yet — rely on thorough manual smoke + review). **Size:** large.
**Note:** done on the current stable stack (pre-framework-upgrades) to isolate auth from Next 16/React 19 churn, and to remove the next-auth-v4-on-React-19 risk before Phase 5. Use context7 for current Better Auth docs during the spec (no project-local better-auth skill exists).

- Add `better-auth`; remove `next-auth`, `@auth/prisma-adapter`.
- `src/server/auth.ts`: Better Auth instance with `emailAndPassword: { enabled: true, disableSignUp: true }`, Prisma adapter, `admin` plugin, `additionalFields: { role }` mapped to `UserRole` (default GUEST).
- Schema: replace NextAuth's `Account`/`Session`/`User`/`VerificationToken` with Better Auth's generated schema (`npx @better-auth/cli generate`). Keep `UsersOnEvents`/`InstrumentsOnUsers`/`Event`/`Instrument` domain tables. **Full DB reset** — drop & recreate, fresh migration; no data preservation.
- Route handler: `src/app/api/auth/[...nextauth]/route.ts` → `src/app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`.
- `src/middleware.ts`: swap the NextAuth cookie gate for Better Auth session check (`getSessionCookie`), preserving the existing matcher exclusions.
- Replace `getServerAuthSession()` (server) and `useSession` (client) call sites with Better Auth equivalents (`auth.api.getSession`, `authClient.useSession`). Update `src/utils/permissions.ts` (`useIsAdmin`).
- New UI: a sign-in page (email + password form via `authClient.signIn.email`) and a minimal admin "create member" flow (set email + initial password + role via the admin plugin). A sign-out control.
- `src/env.js` + `.env.example`: remove `DISCORD_*`/`FACEBOOK_*`/`NEXTAUTH_*`; add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (server schema + runtimeEnv).
- Seed script: initial ADMIN + a couple of MEMBER accounts for dev/test.

**Exit criteria:** gate passes; manual smoke — admin creates a member, member logs in/out, role gating (admin-only UI) works, unauthenticated hits redirect, protected tRPC procedures still authorize, event CRUD works under the new session.

## Phase 2 — E2E regression net + CI

**Branch:** `chore/upgrade-phase-2-e2e-ci`
**Risk:** low (additive only). **Size:** medium. **Rationale:** with credentials auth now in place, E2E login is trivial; this net is the regression detector for phases 4-9 (catches what `tsc` can't — visual breaks, caching/rendering changes, runtime breakage). Built against the final auth, so it survives every later upgrade.

- Add `@playwright/test`; `playwright.config.ts`; `yarn e2e` + `yarn e2e:ui` scripts.
- Login helper: seed a known user, sign in via the credentials form (or programmatic `signIn.email`), save `storageState`. One dedicated test exercises the real login flow directly (no mocking needed now).
- **Per-test isolation:** truncate + reseed the test DB before each test. (True transactional rollback won't work — the Next server holds its own DB connection across the HTTP boundary; truncate-and-reseed gives equivalent isolation.) Needs a dedicated test database + seed.
- **Preview DB (idea, needs refinement):** currently preview deployments share the production DATABASE_URL and have no Better Auth schema or seed data — login doesn't work on preview. Phase 2 already needs a throwaway DB for CI; consider extending that solution to Vercel preview environments too (e.g. Neon branching or a dedicated preview Postgres). Decide approach during Phase 2 spec.
- Critical-path specs (~6-8): unauthenticated redirect to sign-in; successful login; events calendar renders; open event detail modal; request/create event — validation error + successful submit; delete event; admin-only UI gated for non-admins.
- `.github/workflows/ci.yml` (first CI in repo): Postgres service container + test env secrets → install → prisma generate → lint → tsc → build → e2e, on every PR to develop.
- Assert user-visible outcomes (text, navigation, row presence), never internal markup that shadcn/Tailwind phases will legitimately change.

**Exit criteria:** `yarn e2e` green locally and in CI; all critical paths covered; CI required on PRs. From here, every phase keeps e2e green.

## Phase 3 — Low-risk version bumps

**Branch:** `chore/upgrade-phase-3-minor-bumps`
**Risk:** low. **Size:** small.

- `@trpc/server`, `@trpc/client`, `@trpc/react-query`: `11.0.0-rc.446` → `^11` stable. Check rc.446→stable changelog for renamed APIs (e.g. `unstable_httpBatchStreamLink`, transformer placement) against `src/trpc/` setup.
- `@tanstack/react-query` → latest 5.x.
- Minor/patch bumps: `react-hook-form`, `react-hot-toast`, `react-icons`, `superjson`, `geist`, `@vercel/speed-insights`, `prettier`, `prettier-plugin-tailwindcss`, `@t3-oss/env-nextjs` (latest zod-3-compatible only — zod 4 is Phase 8), `@types/node` → 22.
- Do **not** touch: react, next, prisma, tailwind, zod, eslint, anything `@nextui-org`, better-auth.

**Exit criteria:** gate passes; tRPC calls work in e2e + smoke.

## Phase 4 — Finish shadcn migration, remove NextUI

**Branch:** `feat/upgrade-phase-4-shadcn`
**Risk:** medium (UI regressions). **Size:** large — biggest manual-work phase. **Restart fresh** (the old stash is discarded).

- Run `shadcn init` cleanly on current develop (Tailwind 3 setup — TW4 conversion is Phase 6). Use the `shadcn` project-local skill + MCP.
- Migrate all NextUI consumers (14 files at audit time): Providers, Chip, Tooltip, Calendar, Button, Dropdown, Skeleton(s), KeyValue, EventForm, Event, EventDetailModal, RequestEvent, useEventForm.
- Component mapping: Modal → Dialog, Dropdown → DropdownMenu, date-picker/date-input → shadcn Calendar (`react-day-picker`) + Popover + input, Chip → Badge, Switch → Switch, Skeleton → Skeleton, Tooltip → Tooltip, Card → Card.
- Remove deps: all 13 `@nextui-org/*`, `framer-motion`, `@internationalized/date` (verify no other importers first).
- Remove NextUI plugin/content from `tailwind.config.ts`.
- Keep E2E green — if a selector breaks it's either a real regression or an over-coupled test (fix the test only if it asserted internal markup).

**Exit criteria:** `grep -r "@nextui-org\|framer-motion" src/` empty; gate passes; every screen visually smoke-checked.

## Phase 5 — React 19 + Next.js 14 → 15 → 16

**Branch:** `feat/upgrade-phase-5-react19-next16`
**Risk:** high. **Size:** large. Two sub-steps in one PR, committed separately. Use the `next-upgrade` project-local skill.

**Step A — Next 15 + React 19:**
- `npx @next/codemod@canary upgrade 15` (async request APIs).
- Hunt manually: `cookies()`/`headers()`/`draftMode()` now async (tRPC context, Better Auth server calls); `params`/`searchParams` are Promises; fetch & route handlers **no longer cached by default** (audit every `fetch` + GET handler for needed `cache`/`revalidate`); `useFormState` → `useActionState`.
- Bump `@types/react` `@types/react-dom` → 19. Better Auth is React-19/Next-compatible (a key reason auth moved to Phase 1).
- Verify gate + full smoke before Step B.

**Step B — Next 16:**
- `npx @next/codemod@canary upgrade` to 16. Review: Turbopack-by-default (check tailwind/postcss compat on TW3), `middleware.ts` → `proxy.ts` (Node runtime; matcher unchanged for the Better Auth cookie gate), removed legacy APIs, `next lint` removal (handled in the next bullet), image defaults.
- Lint (see Decisions 2026-10-12 → ESLint target): pin `eslint-config-next@15.5` (its peer range still accepts eslint 8; `16.x` requires eslint >=9) and switch the `lint` script from `next lint` (removed in Next 16) to running `eslint` directly (`next typegen && eslint src --ext .js,.jsx,.ts,.tsx` — same coverage as `next lint`; widening is Phase 9). Keep the legacy `.eslintrc.cjs` on eslint 8 — flat config and `eslint-config-next@16` stay in Phase 9.

**Exit criteria:** gate passes on Next 16/React 19; auth flow, middleware redirects, event CRUD, calendar all e2e + smoke-tested; `yarn build` route table compared against Phase 0 baseline for unexpected dynamic/static changes.

## Phase 6 — Tailwind 3 → 4

**Branch:** `chore/upgrade-phase-6-tailwind4`
**Risk:** medium-high (silent visual regressions). **Size:** medium. Use `tailwind-v4-shadcn` skill.

- Run `npx @tailwindcss/upgrade`.
- Config moves: `tailwind.config.ts` theme → CSS `@theme` in `src/styles/globals.css`; `@tailwind ...` → `@import "tailwindcss"`; PostCSS plugin → `@tailwindcss/postcss`.
- shadcn TW4 conversion: CSS vars → `@theme inline`, `tailwindcss-animate` → `tw-animate-css`, per shadcn's official TW4 guide; verify `components.json`.
- `prettier-plugin-tailwindcss` → TW4-compatible (config added; plugin inactive until the two Prettier configs `.prettierrc.js` / `prettier.config.js` are merged — follow-up).
- Hunt codemod-flagged renames: `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, ring width + border color default changes.

**Exit criteria:** gate passes; Playwright screenshot diff of every screen vs the pre-upgrade build (see the Phase 6 spec).

## Phase 7 — Prisma 5 → 6 → 7

**Branch:** `feat/upgrade-phase-7-prisma7`
**Risk:** high (data layer). **Size:** medium. Two sub-steps, committed separately. Use `prisma-upgrade-v7` (+ `prisma-driver-adapter-implementation` if adapters) skills.

**Step A — 5 → 6:** minimal breakage expected. Check implicit m-n relation order, `Buffer`→`Uint8Array` for `Bytes`, full-text search flags. Regenerate, gate, smoke.

**Step B — 6 → 7:** the real work. During spec, read the v7 guide and decide on:
- New `prisma.config.ts` (replaces `package.json#prisma`/schema-folder conventions).
- Generator `prisma-client-js` → new `prisma-client` (explicit output path, import from generated path — touches `src/server/db.ts`, possibly `postinstall`).
- Driver adapters now default — choose `@prisma/adapter-pg` vs current (`@vercel/postgres` was already removed in Phase 2 — check `src/server/db.ts` for the current connection setup).
- **Verify Better Auth's Prisma adapter is compatible with Prisma 7 client** before committing Step B; block on it if not (check during spec). *(2026-10-12: `better-auth` 1.6.x (installed, 1.6.18) and 1.7.x (latest, 1.7.7) both list `prisma`/`@prisma/client` `^5 || ^6 || ^7` as peer deps, so no better-auth bump is needed first — confirm at runtime.)*
- Run `prisma migrate dev` against a dev/test DB, never prod. Verify `db:*` scripts.

**Exit criteria:** gate passes; all CRUD + auth e2e + smoke-tested against dev DB; migrate-deploy dry-run documented; Vercel build (postinstall generate) works.

## Phase 8 — Zod 3 → 4

**Branch:** `chore/upgrade-phase-8-zod4`
**Risk:** medium. **Size:** small-medium. Use `zod-4` skill.

- `zod` → 4.x. *(2026-10-12: `@t3-oss/env-nextjs@0.13.11`, already installed since Phase 3, declares `zod ^3.24 || ^4` — no env-nextjs bump needed.)*
- Hunt: `z.string().email()` → top-level `z.email()`, error-customization API (`message`→`error`, errorMap), `.default()` w/ transforms, `z.record()` two-arg requirement, coerce changes.
- Touch points: `src/env.js`, every tRPC router input schema (`src/server/api/routers/`), `useEventForm`/form validation.
- Confirm tRPC 11 stable + any `@hookform/resolvers` usage support zod 4 (resolvers not currently a dep — confirm during spec).

**Exit criteria:** gate passes; form validation errors still render (submit invalid event form); env validation still fails-fast on a missing var.

## Phase 9 — ESLint 8 → 10 (or 9) flat config

**Branch:** `chore/upgrade-phase-9-eslint10`
**Risk:** low (tooling only). **Size:** small-medium.

- `.eslintrc.cjs` → `eslint.config.mjs` flat config.
- `eslint` → 10.x if `eslint-plugin-react` / `eslint-plugin-import` / `eslint-plugin-jsx-a11y` support it by then, else 9.x with 10 noted as a follow-up (see Decisions 2026-10-12 → ESLint target). `@typescript-eslint/*` → latest (flat-native `typescript-eslint` meta-package), `eslint-config-next` unpinned from 15.5 → 16 flat preset, drop `@types/eslint`.
- Preserve current rule customizations (audit full `.eslintrc.cjs` during spec — only top 30 lines reviewed so far): type-checked presets, `array-type` off, `consistent-type-definitions` off, inline type-imports, `no-unused-vars` argsIgnorePattern, etc.
- The `lint` script already runs `eslint` directly (switched off `next lint` in Phase 5) — only move it onto the flat config.
- Fix or explicitly-comment new violations; no blanket disables.
- Widen lint scope from `src` to the whole repo (`e2e/`, `prisma/`, root config files) and fix the new hits.
- `eslint-config-next@16` enables the React Compiler rules from `eslint-plugin-react-hooks@7` (`set-state-in-effect`, `refs`, `purity`, `immutability`, `incompatible-library` …) — budget for app-code fixes.
- `typescript` → 6.0.x (see Decisions 2026-10-12): fix new TS 6 deprecation errors rather than silencing them with `ignoreDeprecations`.
- Outcome: ESLint 9 (`eslint-plugin-react` / `import` / `jsx-a11y` peers capped at `^9` on 2026-10-12), `eslint.config.mjs`, `eslint .`, TS 6.0.3; see spec `docs/superpowers/specs/2026-10-12-phase-9-eslint-flat-ts6.md`.

**Exit criteria:** `yarn lint` passes with equivalent-or-stricter ruleset; CI/Vercel build unaffected.

---

## Phase order rationale

- **1 (auth) early:** independent of dep upgrades, highest-value change; doing it on the stable stack isolates it from framework churn and removes the next-auth-v4/React-19 risk before Phase 5. Credentials auth also makes Phase 2's E2E login trivial (vs a throwaway OAuth harness).
- **2 (E2E) before the risky climb:** the regression detector for phases 4-9; built against final auth so it never needs rewriting.
- **4 before 5:** NextUI 2.x is flaky on React 19 and pins framer-motion 11 — migrate UI first so Phase 5 debugs only framework breakage.
- **5 before 6:** Tailwind 4 + shadcn TW4 guide assume current React; Next 16 Turbopack interacts with PostCSS — land framework first.
- **7/8 after 5:** independent of UI churn; kept late so the riskiest data-layer change lands on a quiet codebase. 7 and 8 can swap if needed.
- **9 last:** pure tooling, depends on Next 16 being settled. No fold-in needed: Phase 5 keeps legacy lint working by pinning `eslint-config-next@15.5` and running `eslint` directly on eslint 8.

## Tracking

Once a phase has an open PR, track that PR (`gh pr view <number>`) for live status instead of hand-editing a status column here. Only phases without a PR yet show "not started".

| Phase | PR |
|---|---|
| 0 — Baseline | [#4](https://github.com/SlatinskyJ/cm-drozdi/pull/4) (merged) |
| 1 — Better Auth migration | [#7](https://github.com/SlatinskyJ/cm-drozdi/pull/7) (merged) |
| 2 — E2E net + CI | [#13](https://github.com/SlatinskyJ/cm-drozdi/pull/13) (merged) |
| 3 — Minor bumps | [#18](https://github.com/SlatinskyJ/cm-drozdi/pull/18) |
| 4 — shadcn migration | [#20](https://github.com/SlatinskyJ/cm-drozdi/pull/20) |
| 5 — React 19 / Next 16 | [#24](https://github.com/SlatinskyJ/cm-drozdi/pull/24) |
| 6 — Tailwind 4 | [#26](https://github.com/SlatinskyJ/cm-drozdi/pull/26) |
| 7 — Prisma 7 | [#27](https://github.com/SlatinskyJ/cm-drozdi/pull/27) |
| 8 — Zod 4 | [#29](https://github.com/SlatinskyJ/cm-drozdi/pull/29) |
| 9 — ESLint 10 (or 9) flat config | [#30](https://github.com/SlatinskyJ/cm-drozdi/pull/30) |
