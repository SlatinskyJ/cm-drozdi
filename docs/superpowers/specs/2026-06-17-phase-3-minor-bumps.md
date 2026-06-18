# Phase 3 — Low-risk version bumps

**Branch:** `chore/upgrade-phase-3-minor-bumps` (fork from `develop`)
**Risk:** low. **Size:** small.
**Master plan:** `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

## Goal

Clear the batch of small, independent dependency bumps that don't require a dedicated phase, without touching anything load-bearing for the bigger upgrades still ahead (React 19/Next 16, Tailwind 4, Prisma 7, Zod 4, ESLint 10).

## Scope

Bump the following, split into separate commits so a break is isolated to one logical group:

1. **tRPC stable + react-query**
   - `@trpc/server`, `@trpc/client`, `@trpc/react-query`: `^11.0.0-rc.446` → `^11.17.0` (stable).
   - `@tanstack/react-query`: `^5.50.0` → `^5.101.0` (latest 5.x).
   - `typescript`: `^5.5.3` → `^5.9.3`. Required: `@trpc/react-query@11.17.0` has a hard peer dep on `typescript >=5.7.2`, which the current `^5.5.3` doesn't satisfy. Same-major bump (5.5 → 5.9), no config changes expected.
   - `unstable_httpBatchStreamLink` (used in `src/trpc/react.tsx`) is now a `@deprecated` alias for `httpBatchStreamLink` in 11.17.0 (confirmed via package inspection — not removed, just renamed/stabilized). Rename the import and call site to `httpBatchStreamLink`.
   - Transformer placement (`superjson`, set in both `src/trpc/react.tsx` via the link's `transformer` option and `src/server/api/trpc.ts` via `initTRPC...create({ transformer })`) is unchanged between rc.446 and 11.17.0 — no code change needed there.
   - `t._config.isDev` (used in `timingMiddleware` in `src/server/api/trpc.ts` for the dev artificial delay) is still present and unchanged in 11.17.0 — confirmed via package inspection.

2. **Env/tooling-adjacent**
   - `@t3-oss/env-nextjs`: `^0.10.1` → `^0.13.11` (latest).
   - `zod`: `^3.23.3` → `^3.25.76`. Required: `@t3-oss/env-nextjs@0.12.0+` raised its peer dep to `zod ^3.24.0 || ^4.0.0`, which the current `^3.23.3` doesn't satisfy. This is a same-major bump (zod stays on v3 — the v3→v4 jump is still Phase 8) needed purely to unblock the env-nextjs bump.
   - `@types/node`: `^20.14.10` → `^22` (matches the `engines.node: 22.x` already set in `package.json`).

3. **UI/utility minors**
   - `react-hook-form` → `^7.79.0`, `react-hot-toast` → `^2.6.0`, `react-icons` → `^5.6.0`, `superjson` → `^2.2.6`, `geist` → `^1.7.2` — latest within current major, no peer conflicts found.
   - `@vercel/speed-insights`: `^1.0.12` → `^1.3.1` (latest **1.x** only — npm's overall latest is `2.0.0`, a major; capped at 1.3.1 to stay within this phase's no-majors rule. The 2.0 jump is a deferred follow-up, not part of this phase).

4. **Dev formatting tools**
   - `prettier` → `^3.8.4`, `prettier-plugin-tailwindcss` → `^0.8.0` — latest within current major; `prettier-plugin-tailwindcss@0.8.0`'s only hard peer is `prettier ^3.0`, no Tailwind-version coupling, so it's safe to bump while staying on Tailwind 3.

## General policy: minor bumps anywhere, even off the original list

If satisfying a peer dependency for an in-scope package requires bumping a package not originally listed (as happened with `typescript` and `zod` above), that's allowed **as long as the forced bump stays within the dependency's current major version**. Document the forced bump and the reason inline in the relevant commit. A bump that would force a major version anywhere (in-scope or forced) is out of scope — stop, leave it at its current version, and note it as a follow-up instead.

## Explicitly out of scope

Do not touch: `react`, `react-dom`, `next`, `prisma`/`@prisma/client`, `tailwindcss`, `eslint`/`eslint-config-next`/`@typescript-eslint/*`, any `@nextui-org/*` package, `framer-motion`, `@internationalized/date`, `better-auth`, `moment`, `lodash`. These are each covered by their own later phase or are staying as-is. (`zod` and `typescript` are no longer blanket-excluded — see the forced same-major bumps above and the general policy.)

Zod 4 and a TypeScript major are still out of scope regardless of the general policy above — only same-major bumps are permitted here.

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
