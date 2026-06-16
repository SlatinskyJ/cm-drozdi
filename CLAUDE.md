# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Source code for www.cmdrozdi.cz — a T3-stack app (Next.js 14 App Router + tRPC + Prisma + NextAuth v4 + Tailwind + NextUI, the latter mid-migration to shadcn/ui). Manages event scheduling/booking for a music ensemble, with member/admin roles, an events calendar, and instrument assignments.

## Branching

- `develop` is the integration branch — fork new work branches from `develop`, and target `develop` with PRs.
- `main` is production-only. Never commit or push directly to `main`; it's updated only via release merges from `develop`.

## Commands

- `yarn install` — installs deps; `postinstall` runs `prisma generate` automatically.
- `yarn dev` — start dev server.
- `yarn build` — production build (`next build`).
- `yarn start` — run production build.
- `yarn lint` — `next lint` using legacy `.eslintrc.cjs`.
- `npx tsc --noEmit` — typecheck (no dedicated script exists yet).
- `./start-database.sh` — spins up a local Postgres container (`cm-drozdi-postgres`) for dev, reading/writing `DATABASE_URL` in `.env`.
- `yarn db:push` — push Prisma schema to DB without a migration (used for first-time setup per README).
- `yarn db:generate` — `prisma migrate dev` (create + apply a migration).
- `yarn db:migrate` — `prisma migrate deploy`.
- `yarn db:studio` — open Prisma Studio.

**No test suite exists.** There are no `*.test.*`/`*.spec.*` files, no test runner, and no CI workflow. The only verification gate is `yarn lint`, `npx tsc --noEmit`, `yarn build`, and manual smoke testing via `yarn dev` (log in, view the events calendar, open an event detail modal, create/request/edit/delete an event).

## Architecture

### Path aliases (tsconfig)

- `~/*` → `src/*`
- `@public/*` → `public/*`
- `@components/*` → `src/app/_components/*`

### tRPC layer

- `src/server/api/root.ts` defines `appRouter`; sub-routers live in `src/server/api/routers/` and are re-exported through `src/server/api/routers/index.ts`.
- `src/server/api/trpc.ts` defines `publicProcedure` / `protectedProcedure`. Every procedure goes through two global middlewares — **important when adding new procedures**:
  - `timingMiddleware` — logs execution time and adds an artificial delay in dev.
  - `dateMiddleware` — recursively walks the response (via `mapValuesDeep`) and shifts every `Date` value by the server's local timezone offset (`addMinutes`). This means any `Date`/`DateTime` field returned from a tRPC procedure is automatically timezone-adjusted before reaching the client — don't double-adjust dates in routers or components.
- Client setup in `src/trpc/react.tsx` (React Query + `unstable_httpBatchStreamLink` + SuperJSON transformer); server-side caller via `createCaller` in `root.ts`.

### Auth & authorization

- NextAuth v4 (`src/server/auth.ts`) with `@auth/prisma-adapter`, Discord and Facebook providers. `User.role` (Int in DB) is mapped through the `jwt`/`session` callbacks into `session.user.role`, typed via module augmentation as `UserRole` (`src/enums/UserRole.ts`: `GUEST=0`, `MEMBER=1`, `ADMIN=2`).
- `src/middleware.ts` gates the entire site behind an auth cookie check (matcher excludes `api`, `auth`, static assets, `sitemap.xml`, `robots.txt`, and `/`).
- `src/utils/permissions.ts` (`useIsAdmin`) does a client-side session check against `UserRole.ADMIN` for admin-only UI.

### Domain model (`prisma/schema.prisma`)

- `Event`: core entity with `state: Int` mapped to `EventState` (`src/enums/EventState.ts`: `PROPOSED`, `PENDING`, `CONFIRMED`, `CANCELED`), plus scheduling/contact fields and `isPrivate`.
- `UsersOnEvents` / `InstrumentsOnUsers`: explicit many-to-many join tables linking `User` ↔ `Event` and `User` ↔ `Instrument`.
- `src/server/api/routers/event.ts`: `create` (upsert, **public**), `getUpcoming` / `changeState` / `deleteById` (**protected**), `getForCalendar` (public, limited field selection for the public calendar view).

### Env vars

All env vars are validated via `@t3-oss/env-nextjs` in `src/env.js`. Adding a new env var requires updating both the `server`/`client` zod schemas and the `runtimeEnv` map there, plus `.env.example`.

### Date/calendar utilities

`src/utils/date.ts` mixes `@internationalized/date` (calendar UI, e.g. NextUI date pickers) and `moment` (duration math) — used by the events calendar and event form.

## Active initiative: modernization & dependency upgrade

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` is the master roadmap for modernizing this app from its 2024-era T3 stack to current versions, plus migrating auth off NextAuth. The work is split into sequential phases, each its own branch/PR, with a spec written via the `brainstorming` skill (saved under `docs/superpowers/specs/`) and an execution plan via the `writing-plans` skill (saved under `docs/superpowers/plans/`) before the phase starts. **Read that file first** for the locked decisions, phase breakdown, ordering rationale, and current status before doing any upgrade, auth, or NextUI→shadcn work — it is the source of truth and is kept current there (don't duplicate its specifics here). Do not execute phases from the roadmap alone; each phase gets its own spec + execution plan.

`.agents/skills/` contains project-local skills supporting this effort (`next-upgrade`, `prisma-upgrade-v7`, `prisma-driver-adapter-implementation`, `tailwind-v4-shadcn`, `shadcn`, `zod-4`, `vercel-cli`).

## Model routing

Subagent tiers: **Haiku explores, Sonnet builds, Opus orchestrates + reviews.**

- Default to `sonnet` for all implementation work.
- Use `haiku` subagents for read-only search/exploration only; they must write findings to disk (not SendMessage — Haiku goes idle instead of returning via message-passing).
- Escalate to `opus` only for: planning, architectural decisions, final code review.
- Do not use `opus` for commit messages, formatting, grep/search, or trivial one-liner edits.
- Three named agents in `~/.claude/agents/`: `explorer` (haiku), `implementor` (sonnet), `reviewer` (opus).
