# Phase 3 — Low-risk version bumps

**Branch:** `chore/upgrade-phase-3-minor-bumps` (fork from `develop`)
**Risk:** low. **Size:** small.
**Master plan:** `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

## Goal

Clear the batch of small, independent dependency bumps that don't require a dedicated phase, without touching anything load-bearing for the bigger upgrades still ahead (React 19/Next 16, Tailwind 4, Prisma 7, Zod 4, ESLint 10).

## Scope

Bump the following, split into separate commits so a break is isolated to one logical group:

1. **tRPC stable + react-query**
   - `@trpc/server`, `@trpc/client`, `@trpc/react-query`: `^11.0.0-rc.446` → `^11` (stable).
   - `@tanstack/react-query`: `^5.50.0` → latest 5.x.
   - Verify against the rc.446 → stable changelog that `unstable_httpBatchStreamLink` (used in `src/trpc/react.tsx`) and the transformer placement (`superjson`, set in both `src/trpc/react.tsx` and `src/server/api/trpc.ts` via `initTRPC...create()`) are unchanged. If the link or transformer API was renamed/moved in stable, update call sites accordingly.

2. **Env/tooling-adjacent**
   - `@t3-oss/env-nextjs`: `^0.10.1` → latest version that still supports Zod 3 (do not pull a Zod-4-only major; Zod 4 is Phase 8).
   - `@types/node`: `^20.14.10` → `^22` (matches the `engines.node: 22.x` already set in `package.json`).

3. **UI/utility minors**
   - `react-hook-form`, `react-hot-toast`, `react-icons`, `superjson`, `geist`, `@vercel/speed-insights` — bump each to latest within their current major (no major-version jumps).

4. **Dev formatting tools**
   - `prettier`, `prettier-plugin-tailwindcss` — bump to latest within current major.

## Explicitly out of scope

Do not touch: `react`, `react-dom`, `next`, `prisma`/`@prisma/client`, `tailwindcss`, `zod`, `eslint`/`eslint-config-next`/`@typescript-eslint/*`, any `@nextui-org/*` package, `framer-motion`, `@internationalized/date`, `better-auth`, `moment`, `lodash`. These are each covered by their own later phase or are staying as-is.

If any bump above turns out to require a major-version jump (e.g. a "latest" minor pulls in a peer-dependency conflict that forces a major), stop, leave that one package at its current version, and note it as a follow-up rather than absorbing unplanned risk into this phase.

## Verification approach

- After each commit: run the fast gate — `yarn lint && npx tsc --noEmit && yarn build`. This catches breakage immediately and keeps it isolated to the commit that caused it.
- Do **not** run `yarn e2e` after every commit — it's slow and redundant with CI. Run it once, locally, after all four commits are in, as a final check before opening the PR. CI (Phase 2) re-runs the full gate including e2e on the PR anyway, which is the real merge gate.
- Smoke-check tRPC specifically after commit 1 (the only commit with real API-change risk): load the app, confirm a query and a mutation both round-trip (e.g. events calendar load + create/update event flow).

## Exit criteria

- All four commits land on `chore/upgrade-phase-3-minor-bumps`.
- `yarn lint`, `npx tsc --noEmit`, `yarn build` pass clean after each commit.
- `yarn e2e` passes clean once, after all commits.
- tRPC queries/mutations confirmed working via smoke check.
- Draft PR opened against `develop`; CI gate (lint, tsc, build, e2e) green on the PR.
- Master-plan tracking table row for Phase 3 updated to reflect the open PR, per [[master-plan-pr-status-tracking]] (link the PR, no hand-written status word — check actual state via `gh pr view`).
