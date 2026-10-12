# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Source code for www.cmdrozdi.cz — a T3-stack app (Next.js 16 App Router + React 19 + tRPC + Prisma + Better Auth + Tailwind + shadcn/ui). Manages event scheduling/booking for a music ensemble, with member/admin roles, an events calendar, and instrument assignments.

## Branching

- `develop` is the integration branch — fork new work branches from `develop`, and target `develop` with PRs.
- `main` is production-only. Never commit or push directly to `main`; it's updated only via release merges from `develop`.
- **PRs are always created as drafts** (`gh pr create --draft`).
- **Agent review gate (replaces "only the user merges", 2026-10-12):** applies to every PR Claude creates into `develop` (phase PRs and any other). Before a PR leaves draft, an `opus` reviewer agent reviews it and posts findings as PR review comments prefixed `[review-agent] [must-fix]` / `[review-agent] [nit]`, ending with `VERDICT: CHANGES NEEDED` or `VERDICT: READY TO MERGE`. Fixer agents address every `[must-fix]` comment (push fix + reply on the thread), then the reviewer re-reviews. Once the verdict is `READY TO MERGE`, Claude may mark the PR ready (`gh pr ready`), wait for all CI checks to finish green, and squash-merge into `develop`.
  - **Docs-only PRs:** CI skips its lint/typecheck/e2e jobs via the `changes` paths filter, so "green" means no failing checks (skipped jobs count as passing).
  - **CI failure after `gh pr ready`:** convert back to draft (`gh pr ready --undo`), fix, and have the reviewer re-review before trying again. Same for any push made after the `READY TO MERGE` verdict.
  - **Big-decision exception:** if the PR embodies a big decision (architecture, a scope change versus the master plan, dropping or adding a phase, a data-loss risk, a change to workflow/governance rules like this one, or anything else the user hasn't already approved), Claude stops at `READY TO MERGE` and asks the user before merging.
- Claude never targets, pushes to, or merges into `main`.

## Worktrees

Use plain `git worktree` (not Claude's native worktree feature) to isolate phase/feature work:

- Worktrees live at `../cm-drozdi-worktrees/<dir-name>/`, a sibling of this repo checkout.
- `<dir-name>` = the branch name with every `/` replaced by `--` (e.g. branch `chore/upgrade-phase-3-minor-bumps` → dir `chore--upgrade-phase-3-minor-bumps`). The branch itself keeps the `/`.
- Create: `git worktree add ../cm-drozdi-worktrees/<dir-name> -b <branch-name>`
- Remove after merge: `git worktree remove ../cm-drozdi-worktrees/<dir-name>`

## Commands

- `yarn install` — installs deps; `postinstall` runs `prisma generate` automatically.
- `yarn dev` — start dev server (Turbopack).
- `yarn build` — production build (`next build`).
- `yarn start` — run production build.
- `yarn lint` — `next typegen` then ESLint 8 CLI on `src/` with legacy `.eslintrc.cjs` (`eslint-config-next` pinned to 15.5 until Phase 9).
- `yarn typecheck` — `next typegen` then `tsc --noEmit`.
- `./start-database.sh` — unused locally (Postgres runs natively). Slated for removal after Phase 9.
- `yarn db:push` — push Prisma schema to DB without a migration (used for first-time setup per README).
- `yarn db:seed:local` — seed dev DB (loads `.env`). In CI/Vercel use `yarn db:seed` (env injected externally).
- `yarn db:generate` — `prisma migrate dev` (create + apply a migration).
- `yarn db:migrate` — `prisma migrate deploy`.
- `yarn db:studio` — open Prisma Studio.
- `yarn e2e` — run full Playwright E2E suite (requires `yarn build` first; needs DATABASE_URL + BETTER_AUTH_* in env).
- `yarn e2e:ui` — open Playwright UI for interactive test running.

**Verification gate:**
```bash
yarn install
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
yarn e2e
```
All must pass clean. CI runs lint + typecheck on every PR to `develop` and adds e2e once the PR is non-draft (docs-only PRs skip all three).

## Architecture

### Path aliases (tsconfig)

- `~/*` → `src/*`
- `@public/*` → `public/*`
- `@components/*` → `src/app/_components/*`

### tRPC layer

- `src/server/api/root.ts` defines `appRouter`; sub-routers live in `src/server/api/routers/` and are re-exported through `src/server/api/routers/index.ts`.
- `src/server/api/trpc.ts` defines `publicProcedure` / `protectedProcedure` / `memberProcedure` (asserts `UserRole.MEMBER` or `UserRole.ADMIN`) / `adminProcedure` (asserts `UserRole.ADMIN`). Every procedure goes through `timingMiddleware` (logs execution time and adds an artificial delay in dev).
- Dates are passed through unchanged: every `Date`/`DateTime` a procedure returns (or receives) is a true UTC instant, serialized by SuperJSON. Never shift dates by a timezone offset in routers or components — convert to Prague time only when formatting or parsing (see Date/calendar utilities).
- Client setup in `src/trpc/react.tsx` (React Query + `httpBatchStreamLink` + SuperJSON transformer); server-side caller via `createCaller` in `root.ts`.

### Auth & authorization

- Better Auth (`src/server/auth.ts`): email + password, sign-up disabled, Prisma adapter, `admin` plugin with access control in `src/server/auth-access.ts`. Roles are the string enum `UserRole` (`src/enums/UserRole.ts`: `guest`/`member`/`admin`). Server access via `getServerAuthSession()`; client via `authClient` (`src/lib/auth-client.ts`); route handler `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler`).
- `src/proxy.ts` (Next 16 proxy, Node runtime) redirects to `/login` when no Better Auth session cookie is present (`getSessionCookie`, presence-only, no DB). Matcher excludes `api`, `_next/static`, `_next/image`, `auth`, `login`, `reset-password`, `favicon.ico`, `images`, `sitemap.xml`, `robots.txt`, and `/`. Real checks: `events`/`members` layouts and `protectedProcedure`/`memberProcedure`/`adminProcedure`.
- `src/utils/permissions.ts` (`useIsAdmin`) — client-side admin check via `authClient.useSession()`.

### Domain model (`prisma/schema.prisma`)

- `Event`: core entity with `state: Int` mapped to `EventState` (`src/enums/EventState.ts`: `PROPOSED=0`, `PENDING=1`, `CONFIRMED=2`, `CANCELED=3`), plus scheduling/contact fields and `isPrivate`.
- `UsersOnEvents` / `InstrumentsOnUsers`: explicit many-to-many join tables linking `User` ↔ `Event` and `User` ↔ `Instrument`.
- `src/server/api/routers/event.ts`: `create` (**public** "request an event": takes no id, always creates as PROPOSED, returns only `{ id }`), `update` / `getUpcoming` / `changeState` (**member**: MEMBER or ADMIN), `deleteById` (**admin**), `getForCalendar` (public; private events come back with `name`/`location` nulled). `/api/trpc` is excluded from the auth proxy (`src/proxy.ts` matcher), so every procedure must enforce its own role — match the UI's gate (`memberProcedure` / `adminProcedure` in `trpc.ts`).
- `src/server/api/routers/member.ts`: `create` / `list` / `setRole` / `delete` / `generatePasswordLink` (**admin-only**), `setPassword` (**public**, token-based).

### Env vars

All env vars are validated via `@t3-oss/env-nextjs` in `src/env.js`. Adding a new env var requires updating both the `server`/`client` zod schemas and the `runtimeEnv` map there, plus `.env.example`.

### Date/calendar utilities

The app has a single display timezone, `APP_TIME_ZONE = 'Europe/Prague'` in `src/utils/date.ts` (all users are in Czechia). Dates are stored and sent over the API as UTC instants; they are converted to Prague wall-clock time only at the edges, with `@date-fns/tz`, independent of the server's (UTC on Vercel) or the browser's timezone:

- Display: use the `formatDate` / `formatDateToTime` / `formatDateTime` helpers, or pass `{ in: appTz }` to date-fns. Never call date-fns `format`/`getHours`/`startOfDay`/... on an event date without `{ in: appTz }` — they would use the runtime's timezone and cause wrong times and hydration mismatches.
- Calendars (shadcn `Calendar` / react-day-picker): pass `timeZone={APP_TIME_ZONE}` so days, "today" and matchers are Prague calendar days.
- Form input (`EventForm`): the picked day and time are interpreted as Prague wall-clock time; the form keeps a plain `Date` instant. Past days are blocked relative to today in Prague (`startOfTodayInAppTz`).

E2E runs the server with `TZ=UTC` and the browser in `America/New_York` (override via `E2E_SERVER_TZ` / `E2E_BROWSER_TZ`) to prove this.

## Active initiative: modernization & dependency upgrade

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` is the master roadmap for modernizing this app from its 2024-era T3 stack to current versions, plus migrating auth off NextAuth. The work is split into sequential phases, each its own branch/PR, with a spec written via the `brainstorming` skill (saved under `docs/superpowers/specs/`) and an execution plan via the `writing-plans` skill (saved under `docs/superpowers/plans/`) before the phase starts. **Read that file first** for the locked decisions, phase breakdown, ordering rationale, and current status before doing any upgrade, auth, or NextUI→shadcn work — it is the source of truth and is kept current there (don't duplicate its specifics here). Do not execute phases from the roadmap alone; each phase gets its own spec + execution plan.

`.agents/skills/` contains project-local skills supporting this effort (`next-upgrade`, `prisma-upgrade-v7`, `prisma-driver-adapter-implementation`, `tailwind-v4-shadcn`, `shadcn`, `zod-4`, `vercel-cli`).

## Model routing

Subagent models: **`opus` or `haiku` only, never `sonnet`** (matches the user's global rule). Always set `model` explicitly on Agent / workflow `agent()` calls.

- `haiku` for mechanical, well-scoped, easily verified work (read-only search/exploration, version lookups, trivial edits). Haiku subagents must write findings to disk (not SendMessage — Haiku goes idle instead of returning via message-passing).
- `opus` for everything else: planning, architectural decisions, implementation, PR review, fixing review comments.
- Named agents in `~/.claude/agents/`: `explorer` (haiku), `implementor` and `reviewer` — run both with `model: opus`.
