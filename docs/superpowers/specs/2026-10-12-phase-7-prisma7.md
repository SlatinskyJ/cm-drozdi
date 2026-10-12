# Phase 7 — Prisma 5 → 6 → 7

**Branch:** `feat/upgrade-phase-7-prisma7` (per master plan), forked from `develop`.
**Risk:** high (data layer). **Size:** medium.
**Status:** decided 2026-10-12 (no interactive brainstorm; decisions recorded below).

## Context

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` Phase 7 upgrades Prisma in two sub-steps, committed separately: **Step A** 5 → 6 (expected near no-op), **Step B** 6 → 7 (new generator, `prisma.config.ts`, mandatory driver adapter, explicit env loading). Target is **Prisma 7.x stable, 7.10.0 at spec time**. npm's `latest` dist-tag points at `8.0.0-rc.*`. That is a release candidate, out of scope (Decisions 2026-10-12). Never run `yarn add prisma@latest` or `@prisma/client@latest`.

Phase 7 runs after Phase 5 (Next 16 / React 19), Phase 6 (Tailwind 4) and the Prague-timezone fix PR (#22). This spec was written against `develop` at `3894f9a` (Phase 4). The execution plan starts by merging the latest `origin/develop` and re-running the inventory greps, because those PRs may add files that import Prisma.

Sources: the official upgrade guides (`prisma/web` repo: `guides/upgrade-prisma-orm/v6.mdx`, `v7.mdx`, `orm/v7/reference/prisma-config-reference.mdx`, `orm/v7/.../connection-pool.mdx`, `.../pgbouncer.mdx`), the project-local skills `.agents/skills/prisma-upgrade-v7/` and `.agents/skills/prisma-driver-adapter-implementation/`, and a throwaway `prisma generate` + `tsc` trial of this repo's schema on 7.10.0 (scratchpad, not committed).

## Current state (audited at `3894f9a`)

| Item | Today |
|---|---|
| Packages | `prisma@^5.21.0` (dev), `@prisma/client@^5.14.0`, both resolve to 5.22.0 |
| Generator | `prisma-client-js`, output in `node_modules` |
| Datasource | `url = env("DATABASE_URL")` in `schema.prisma`; no `directUrl`, no shadow URL |
| Migrations | one: `prisma/migrations/20240101000000_initial` |
| Client | `src/server/db.ts`: `new PrismaClient({ log })` singleton on `globalThis` (no adapter) |
| `@prisma/client` importers | `src/server/db.ts`, `e2e/helpers/db.ts` (`new PrismaClient()` with no args) |
| `db` consumers | `src/server/auth.ts` (`prismaAdapter(db, { provider: 'postgresql' })`), `auth-password-link.ts`, `api/trpc.ts`, `routers/member.ts`, `prisma/seed.ts` |
| Env loading | Prisma 5 CLI auto-loads `.env`. Seed: `db:seed` = `tsx prisma/seed.ts` (env injected); `db:seed:local` = `tsx --env-file=.env`. Playwright config calls `dotenv.config()`. |
| Scripts | `postinstall: prisma generate`; `db:generate: prisma migrate dev`; `db:migrate: prisma migrate deploy`; `db:push`; `db:studio`; `vercel-build` runs `npx prisma migrate deploy && yarn db:seed` when `VERCEL_ENV != production`, then `next build` |
| CI | `typecheck` job runs `npx prisma generate` with **no `DATABASE_URL`**; `e2e` job runs `prisma generate`, `migrate deploy`, `db:seed` against a Postgres 16 service |
| e2e | `global-setup.ts` runs `npx prisma migrate deploy` + `yarn db:seed`; `helpers/db.ts` deletes/creates rows with its own client |
| Hosting | Vercel. Preview DB: Neon project `cm-drozdi-preview`, per-branch via the Neon Previews Integration (Phase 2 spec §3). Production `DATABASE_URL` is the separate Neon DB `cm-drozdi-postgres`, also used by the Vercel Development env. |
| Better Auth | `better-auth@^1.6.18`. `@better-auth/prisma-adapter` declares optional peers `prisma`/`@prisma/client` `^5 \|\| ^6 \|\| ^7`. It types the client as an empty interface and never imports `@prisma/client` at runtime. It uses `db.$transaction(cb)` when available and matches `P2025` by error code. |

## Step A — 5 → 6 (target 6.19.3, latest 6.x)

Applicability of every v6 breaking change to this repo:

| v6 change | Applies? | Why |
|---|---|---|
| Node ≥ 18.18 / 20.9 / 22.11 | OK | local Node 22.14, CI `node-version: 22`, `engines: 22.x` |
| TypeScript ≥ 5.1 | OK | 5.9.x |
| Implicit m-n relation tables: unique index → primary key | **No** | Both m-n relations (`UsersOnEvents`, `InstrumentsOnUsers`) are explicit models with `@@id`. No `_AToB` tables, so no `upgrade-to-v6` migration is needed. |
| `Bytes` → `Uint8Array` instead of `Buffer` | **No** | no `Bytes` fields |
| `fullTextSearch` → `fullTextSearchPostgres` | **No** | no `previewFeatures` |
| `NotFoundError` removed (use `P2025`) | **No** | not imported. `findFirstOrThrow` in `e2e/helpers/db.ts` is unaffected. |
| `async` / `await` / `using` reserved as model names | **No** | |

**Decision:** Step A is a version bump only: `prisma` and `@prisma/client` to `^6.19.3`, no source changes. Evidence comes from verification, not code: an empty schema diff, a fresh-DB `migrate deploy`, the timezone round-trip baseline, e2e, and a smoke test. Then commit.

## Step B — 6 → 7 (target 7.10.0, latest 7.x stable)

### B1. Packages
- `prisma` (dev) and `@prisma/client` to `^7.10.0`. `@prisma/client` **stays** a runtime dependency: the generated client imports `@prisma/client/runtime/client`.
- Add `@prisma/adapter-pg@^7.10.0` and `pg@^8.23.1`. `pg` is already a dependency of the adapter; it is listed explicitly to follow the docs and make the driver version visible. `@types/pg` comes in through the adapter. App code never imports `pg` directly.
- All three `@prisma/*`/`prisma` packages must resolve to the **same** 7.x version.
- `dotenv@^17` is already a devDependency and is reused by `prisma.config.ts`.
- **Better Auth: no bump in this phase.** 1.6.x already allows `^7`. Bumping to 1.7.x is a separate concern (ground rule 4) and goes in a follow-up PR. Compatibility is proven at runtime (see Testing).

### B2. Generator and output path
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
datasource db {
  provider = "postgresql"
}
```
- **Output `src/generated/prisma`**, imported as `~/generated/prisma/client` from `src/` and by relative path from `e2e/`. This was chosen over `src/server/db/generated`, which would put a `db/` directory next to `src/server/db.ts` and make `~/server/db` ambiguous. It was also chosen over a root-level `generated/`, because inside `src` the existing `~/*` alias works with no new tsconfig path.
- `moduleFormat` stays at the default `esm`. `package.json` is already `"type": "module"`, and tsconfig is already `module: ESNext`, `moduleResolution: Bundler`.
- The generated files carry `// @ts-nocheck` and `/* eslint-disable */`, and import siblings with `.ts` extensions. The trial run showed `tsc --noEmit` with this repo's compiler options passes with zero errors. tsx, Next and Playwright resolve explicit `.ts` paths.
- `.gitignore` gets `/src/generated/`. The client is regenerated by `postinstall` everywhere: local, CI and Vercel.
- The ESLint config ignores `src/generated/**`, to avoid type-aware parsing of generated code.
- `url` is removed from the `datasource` block. In v7 it moves to `prisma.config.ts`.

### B3. `prisma.config.ts` (repo root)
```ts
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ quiet: true }); // Prisma 7 no longer auto-loads .env; never overrides already-set vars

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
```
Decisions:
- **`process.env.DATABASE_URL ?? ''` instead of the `env()` helper.** `env()` throws `PrismaConfigEnvError` when the variable is missing. Since Prisma 7.2, `prisma generate` works with an undefined URL. Two contexts run `prisma generate` with no `DATABASE_URL`: the CI `typecheck` job and Vercel's `postinstall`. With `env()`, both would break.
- **dotenv loads `.env` and never overrides.** `DATABASE_URL=<x> npx prisma …` keeps working, and CI and Vercel, which inject env vars and have no `.env`, behave the same as before.
- **No `migrations.seed`.** The repo never uses `prisma db seed`. Seeding stays `yarn db:seed` / `yarn db:seed:local`, which already handle env themselves.
- **No `shadowDatabaseUrl`.** `migrate dev` keeps creating its temporary shadow DB on the local server.

### B4. Driver adapter and connection pooling
`src/server/db.ts`:
```ts
new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5_000 }),
  log: /* unchanged */,
})
```
- **`@prisma/adapter-pg` (TCP via `pg`)**, not `@prisma/adapter-neon`. The app runs on Vercel's Node runtime, not edge, so the plain `pg` TCP driver works against both Neon and local Postgres. Using it everywhere keeps local, CI and Vercel on one code path.
- **Pool settings:** `connectionTimeoutMillis: 5_000` restores the Prisma ≤ 6 connect timeout; `pg`'s default is `0`, meaning no timeout. Every other setting keeps the `pg` default: `max: 10`, `idleTimeoutMillis: 10s`. A 10 s idle timeout suits serverless better than v6's 300 s. Each Vercel function instance owns one pool, and the existing `globalThis` singleton stays.
- **Not adopted:** `attachDatabasePool` from `@vercel/functions` (for Fluid compute). Whether Fluid compute is enabled on this project is unknown, and adopting it is a new dependency plus a Vercel-behaviour change. Listed as a follow-up.
- **Timestamps:** the schema stores `DateTime` as `timestamp(3)`, without time zone. `@prisma/adapter-pg` 7.10 overrides `pg`'s parser and reads `timestamp` as UTC (`normalize_timestamp` appends `+00:00`), so stored values keep the v5 semantics. The plan still adds an explicit round-trip check under three process `TZ`s, run on v6 as a baseline and again on v7, because the app's event times are timezone-sensitive (PR #22).
- **SSL:** v7 uses `pg`, which validates certificates. With `sslmode=require` it behaves as verify-full and may log a `SECURITY WARNING … treated as aliases for 'verify-full'` line. Neon serves publicly trusted certificates, so no `ssl` override is set. Neon URLs are not edited in this phase.

### B5. Pooled vs. direct URL; does `migrate deploy` need a direct URL?
- Prisma's guidance: the Schema Engine (migrate) wants a **direct** connection, and PgBouncer-pooled URLs can fail with `prepared statement "s0" already exists`. In v7, `datasource.directUrl` is **removed**. Whatever `prisma.config.ts` `datasource.url` points at is what the CLI uses, and the runtime uses whatever URL the adapter gets.
- **Decision: the CLI keeps using `DATABASE_URL`, exactly as today.** `vercel-build` on Prisma 5 already runs `migrate deploy` against the preview `DATABASE_URL` successfully, and v7's schema engine connects the same way, so nothing changes.
- **Rejected: preferring `DATABASE_URL_UNPOOLED`** (which Neon integrations inject). The Phase 2 spec records that the original Neon storage integration wired the production DB `cm-drozdi-postgres` into Development, Preview and Production. If a stale, Preview-scoped `DATABASE_URL_UNPOOLED` from that integration still exists, a config that prefers it would run `migrate deploy` and the seed **against production** on every preview build. The upside (direct vs. pooled) is not worth that risk without the owner confirming which variables Preview actually has. See Open questions.
- Local and CI: `DATABASE_URL` is a plain direct connection (`localhost:5432`), so the question doesn't arise.

### B6. Env loading
| Context | Before (v5/v6) | After (v7) |
|---|---|---|
| `npx prisma …` locally | CLI auto-loads `.env` | `prisma.config.ts` → `dotenv` loads `.env` |
| `yarn db:seed:local` | `tsx --env-file=.env` | unchanged |
| `yarn db:seed` (CI / Vercel) | env injected | unchanged |
| CI `typecheck` `prisma generate` | no URL needed | no URL needed (`?? ''`) |
| CI `e2e` job | env from secrets | unchanged; no `.env` in CI, so dotenv is a no-op |
| Vercel `postinstall` / `vercel-build` | env injected | unchanged |
| Playwright workers (`e2e/helpers/db.ts`) | v5 client read `DATABASE_URL` itself | helper passes `process.env.DATABASE_URL` (loaded by `playwright.config.ts` `config()`) to `PrismaPg` |
| Next runtime | Next loads `.env` | unchanged; `src/server/db.ts` uses validated `env.DATABASE_URL` |

`.github/workflows/ci.yml` needs **no change**.

### B7. Removed CLI behaviour and flags
- `migrate dev` and `db push` no longer run `prisma generate`. **Decision:** chain it in the scripts to keep the developer workflow the same: `db:generate` → `prisma migrate dev && prisma generate`, `db:push` → `prisma db push && prisma generate`.
- `migrate dev` / `migrate reset` no longer auto-seed. No effect: the repo never configured a Prisma seed.
- Removed flags: `--skip-generate`, `--skip-seed`, `db execute --url/--schema`, and `migrate diff --from-url/--to-url/--from-schema-datasource/--to-schema-datasource/--shadow-database-url`. A grep of scripts, CI, e2e and docs finds none in use. Only this phase's own verification commands use `migrate diff`, and the plan uses the v6 flags in Step A and the v7 flags (`--from-config-datasource --to-schema`) in Step B.
- Removed env vars (`PRISMA_*_ENGINE_*`, `PRISMA_MIGRATE_SKIP_*`, and others) are not used.
- The CLI prints an "Update available 7.x → 8.0.0-rc" banner. Ignore it. `PRISMA_HIDE_UPDATE_MESSAGE=1` silences it.

### B8. Type-level breaking changes
- `PrismaClient` requires `adapter` (or `accelerateUrl`). `datasources` / `datasourceUrl` are gone. This affects `src/server/db.ts` and `e2e/helpers/db.ts`.
- `Prisma.validator` was removed in favour of `satisfies`. Not used here.
- `$use` middleware and `$metrics` were removed. Not used.
- Mapped enum behaviour reverted to v6 behaviour. The schema has no enums.
- Types come from the generated module (`~/generated/prisma/client`, or `/browser`, `/enums`, `/models` for client-safe imports). At `3894f9a`, nothing outside `db.ts` / `e2e/helpers/db.ts` imports Prisma types. The plan re-greps after merging `develop`, and any client component needing Prisma types must import from `~/generated/prisma/browser`, never `/client`.
- Better Auth's `prismaAdapter(db, …)` accepts any object, and its `$Infer` types come from Better Auth, not Prisma, so nothing changes at the type level.

## Better Auth compatibility

- Peer ranges allow v7, and the adapter has no runtime import of `@prisma/client`. It calls model delegates (`db.user`, `db.session`, `db.account`, `db.verification`), interactive `db.$transaction(cb)`, and `P2025` error codes. All of these work with the `prisma-client` generator plus `adapter-pg`, including interactive transactions.
- **Explicit runtime check, required before Step B is pushed:** e2e `auth.spec.ts`, which covers credential login, wrong password and redirect; e2e `members.spec.ts`, which covers admin create member, role change and soft-delete with `revokeUserSessions`; and a manual Playwright-MCP smoke of the **set-password link** flow. In that flow an admin creates a member, generates a link, the member sets a password, logs in and logs out. It exercises the verification table, `linkAccount` and session creation through the new client, and no e2e spec covers it.
- **Gate:** if any Better Auth path fails on v7 and it can't be fixed without patching Better Auth, stop, report, and do not push Step B. Bumping better-auth inside Phase 7 needs the owner's OK.

## Safety (production data)

- **Nothing in this phase runs against the production DB or Neon.** Every DB-touching command in the plan starts with a guard that refuses to run unless `DATABASE_URL` points at `localhost:5432` / `127.0.0.1:5432`. This matters because `vercel env pull` writes the Development env, which shares the production DB, into `.env`.
- Schema and migration checks run against a **throwaway local DB**, `cm_drozdi_p7_verify`, created from scratch and dropped at the end:
  1. `migrate deploy` from empty (the dry run of what Vercel does)
  2. `migrate status`: up to date
  3. `migrate diff` from the migrated DB to `schema.prisma` with `--exit-code`: exit 0, meaning an empty diff
  4. `migrate dev --create-only`: no new folder under `prisma/migrations/`

  Step A runs the same four checks as a baseline, so a non-empty diff in Step B can be attributed to v7.
- **Expected result: no new migration.** If a diff appears, stop and ask the owner. A new migration would apply to every preview branch and, at the next release, to production. That is a data-risk decision, so the big-decision exception in `CLAUDE.md` applies.
- Merging into `develop` doesn't deploy production. Production gets the v7 runtime path (adapter-pg, certificate-validating SSL) only at the next `develop` → `main` release. `vercel-build` skips migrate and seed in production, and this phase creates no migration, so production schema and data are untouched either way.

## Vercel

- Preview builds on the PR must still: install, run `postinstall` → `prisma generate` (no DB needed), run `migrate deploy` on the Neon preview branch (expected: "No pending migrations to apply"), run `yarn db:seed`, and finish `next build`.
- Before pushing, run a local simulation: `VERCEL_ENV=preview DATABASE_URL=<verify DB> yarn vercel-build`.
- **Post-push check (read-only):** `vercel ls` / `vercel inspect <url> --logs` must show `Generated Prisma Client (v7.x.y)`, the migrate-deploy result, the seed output, a successful build and `READY` state. Then use Playwright MCP to load the preview's public `/` page, whose calendar makes a DB read through `event.getForCalendar` with Prisma 7, and `GET /api/trpc/event.getForCalendar?batch=1&input=%7B%7D`. Last, run `vercel logs <url>` bounded and look for runtime errors: `P1010`, SSL, `ECONNREFUSED`, pool timeouts.
- **No Vercel or Neon setting, env var or integration is changed in this phase.** A logged-in check on the preview (login, admin creates member) needs credentials typed into a non-local host, so the **repo owner** does it, or it's skipped if Vercel Deployment Protection blocks the agent.

## Testing & exit criteria

Gate, run in this order with Node 22 on `PATH` (`export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`):
`yarn install --frozen-lockfile` → `npx prisma generate` → lint (`SKIP_ENV_VALIDATION=1 yarn lint`, whatever `lint` is after Phase 5) → `yarn typecheck` → `SKIP_ENV_VALIDATION=1 yarn build` → `yarn e2e`. `yarn e2e` runs only at the end of Step A and the end of Step B.

Exit criteria:
- The gate passes after Step A and after Step B. CI is green on the PR.
- `grep -rn "@prisma/client" src e2e prisma` returns no import lines. Only `package.json` mentions it, as a dependency.
- Schema diff is empty, fresh-DB `migrate deploy` succeeds, and no new migration exists. All of this is documented in the PR body.
- The timezone round-trip prints identical results on v6 and v7 under `TZ=UTC`, `Europe/Prague` and `America/New_York`.
- Better Auth: e2e auth and members specs green, plus the manual set-password-link smoke.
- `prisma generate` succeeds with no `DATABASE_URL` and no `.env` (CI typecheck / Vercel `postinstall` conditions).
- Vercel preview build `READY` with migrate deploy and seed in the logs, and the public page reads from the DB.

## Non-goals
- Prisma 8 (rc), `@prisma/adapter-neon`, Prisma Accelerate or Prisma Postgres.
- Any schema or migration change. Data model cleanup, such as `Event.id @id @unique` or `User.role String?`, is a separate PR.
- Bumping better-auth to 1.7.x (follow-up).
- `attachDatabasePool` / Fluid compute tuning, Neon URL edits, or switching the CLI to `DATABASE_URL_UNPOOLED` (follow-ups gated on the owner's answer below).
- Removing `start-database.sh` (post-Phase-9 cleanup).

## Open questions for the repo owner
1. **Preview env vars:** does the Vercel **Preview** environment hold a static `DATABASE_URL_UNPOOLED` (or `POSTGRES_URL*`) left over from the original Neon storage integration and pointing at the production DB `cm-drozdi-postgres`? This doesn't block Phase 7, which deliberately keeps using `DATABASE_URL` only. It decides whether a later follow-up can point the CLI at the unpooled URL safely, and it's worth removing as a latent risk regardless.
2. **Logged-in preview check:** please log in on the Phase 7 preview deployment once (admin → create member) after the PR's preview turns `READY`. The agent can't type credentials on a non-local host.
