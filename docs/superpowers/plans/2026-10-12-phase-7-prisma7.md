# Phase 7 — Prisma 5 → 6 → 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Prisma from 5.22 to 6.19 (Step A), then to 7.x stable (Step B), on the `prisma-client` generator with the `@prisma/adapter-pg` driver adapter and a `prisma.config.ts`, with no schema or migration change and no contact with production data.

**Architecture:** Step A is a version bump with no source changes, proven by DB checks, e2e and a smoke test before its own commit. Step B is one atomic, buildable commit. It sets the generator output to `src/generated/prisma` (gitignored, rebuilt by `postinstall`), adds a root `prisma.config.ts` that loads `.env` through dotenv and reads `process.env.DATABASE_URL`, and passes a `PrismaPg` adapter in `src/server/db.ts` and `e2e/helpers/db.ts`. Every DB-touching check runs against a throwaway local DB, `cm_drozdi_p7_verify`, behind a localhost guard.

**Tech Stack:** Prisma 6.19.3 → 7.10.0, `@prisma/adapter-pg` 7.10.0, `pg` 8.23.x, Better Auth 1.6.x (`prismaAdapter`), Next.js 16 / React 19 (after Phase 5), Playwright, Yarn 1, Postgres 16 (native, local), Vercel + Neon preview branches.

**Spec:** `docs/superpowers/specs/2026-10-12-phase-7-prisma7.md` (read it first; it has every decision and its rationale).

## Global Constraints

- Branch `feat/upgrade-phase-7-prisma7` in worktree `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-7-prisma7`. PR base is `develop`. Never touch `main`.
- **Every shell block starts with the shell preamble (P):**
  ```bash
  cd /Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-7-prisma7
  export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"
  ```
- **Every block that touches a database also runs the DB guard (G) right after P.** G refuses to run unless `.env` points at local Postgres:
  ```bash
  set -a; . ./.env; set +a
  case "$DATABASE_URL" in
    postgres*://*@localhost:5432/*|postgres*://*@127.0.0.1:5432/*) ;;
    *) echo "REFUSING: DATABASE_URL is not the local DB"; exit 1 ;;
  esac
  DEV_URL="${DATABASE_URL%%\?*}"
  VERIFY_URL="${DEV_URL%/*}/cm_drozdi_p7_verify"
  ```
- Never run anything against production or Neon. Never run `vercel env pull/add/rm`, `vercel deploy`, `vercel --prod`, or `vercel redeploy`. Never edit Vercel or Neon settings.
- Versions: Prisma **7.x stable only**. Never `yarn add prisma@latest` or `@prisma/client@latest`, because `latest` is `8.0.0-rc.*`. `prisma`, `@prisma/client` and `@prisma/adapter-pg` must resolve to the same version. Do **not** bump `better-auth`, `next`, `react`, `zod`, `tailwindcss` or `eslint`. Ignore the CLI's "Update available … 8.0.0-rc" banner, or set `PRISMA_HIDE_UPDATE_MESSAGE=1`.
- **No new migration.** If any check shows a schema diff or creates a folder under `prisma/migrations/`, stop and ask the owner. That is the big-decision / data-risk exception in `CLAUDE.md`.
- Gate order: `yarn install --frozen-lockfile` → `npx prisma generate` → `SKIP_ENV_VALIDATION=1 yarn lint` (or whatever the `lint` script is after Phase 5) → `yarn typecheck` → `SKIP_ENV_VALIDATION=1 yarn build` → `yarn e2e`. `yarn e2e` runs only at the end of Step A (Task 2) and Step B (Task 4).
- Before any `yarn start` or `yarn e2e`, port 3000 must be free: `lsof -iTCP:3000 -sTCP:LISTEN` prints nothing.
- Commit messages end with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use a heredoc: `git commit -F - <<'EOF' … EOF`.
- Smoke checks use the Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_fill_form`, `browser_click`) against `http://localhost:3000` only. The admin login is `BOOTSTRAP_ADMIN_EMAIL` from `.env` (default `admin@cmdrozdi.cz`) with `DEV_PASSWORD` from `prisma/seed.ts`. Never repeat passwords in chat or the PR.
- Record evidence (command outputs named in each task) in a notes file in your scratchpad. It feeds the PR body in Task 5.

## Review Focus

1. **Server process in a non-UTC timezone writing and reading `timestamp(3)` columns.** Event times must not shift under adapter-pg. The `tz-roundtrip` check covers it: Task 2 records a baseline, Task 4 compares against it.
2. **`prisma generate` with no `DATABASE_URL` and no `.env`**, the condition in the CI `typecheck` job and Vercel `postinstall`. It must succeed. Task 3 Step 7.
3. **A developer running Prisma CLI commands with only `.env` (nothing exported).** The CLI must still find the local DB, because v7 dropped `.env` auto-load. Task 3 Step 8.
4. **Better Auth's set-password-link flow** (verification rows, `linkAccount`, interactive `$transaction`) on the new client. No e2e spec covers it. Task 4 Step 6.
5. **Neon preview runtime over SSL** with `pg` now validating certificates. A public DB read must work on the preview deployment. Task 5 Step 4.

---

### Task 1: Sync with `develop`, preflight inventory, baseline gate (still Prisma 5)

**Files:** none modified (merge commit only).

**Interfaces:**
- Consumes: nothing.
- Produces: a branch containing Phases 5, 6 and the timezone PR (#22). Also an inventory confirming that the only `@prisma/client` importers are `src/server/db.ts` and `e2e/helpers/db.ts`. Later tasks assume exactly this set and must also handle any extra file found here.

- [ ] **Step 1: Merge latest develop and confirm prerequisites**

```bash
# P
git fetch origin
git merge --no-edit origin/develop
git log origin/develop --oneline | grep -iE "phase 5|phase 6|prague|timezone"
grep -E '"(next|react|tailwindcss|prisma|@prisma/client|better-auth)"' package.json
```
Expected: the merge succeeds without conflicts (or is already up to date). The log shows the Phase 5 (React 19 / Next 16) and Phase 6 (Tailwind 4) merge commits and the timezone fix (#22). `package.json` shows `next ^16`, `react ^19`, `tailwindcss ^4`, `prisma ^5.21.0`. **If Phase 5 or 6 is not merged, stop and report.** Phase 7 must not start before them.

- [ ] **Step 2: Re-check target versions**

```bash
# P
npm view prisma@6 version | tail -1
npm view prisma@7 version | tail -1
npm view @prisma/adapter-pg@7 version | tail -1
npm view pg version
npm view better-auth version; yarn list --pattern better-auth --depth=0
```
Expected: `6.19.3`, `7.10.0`, `7.10.0`, `8.23.x`. If a newer 6.x or 7.x stable exists, use it instead of 6.19.3 / 7.10.0 everywhere below. Record the installed better-auth version, which should be 1.6.x and is not bumped.

- [ ] **Step 3: Inventory Prisma usage**

```bash
# P
grep -rnE "from ['\"]@prisma/client|require\(['\"]@prisma/client" src e2e prisma *.ts *.js 2>/dev/null
grep -rnE "\\\$use\(|\\\$metrics|NotFoundError|Prisma\.validator|datasourceUrl|datasources:|Bytes|fullTextSearch" src e2e prisma
grep -rnE "skip-generate|skip-seed|--from-url|--to-url|schema-datasource|shadow-database-url|db execute" package.json .github e2e
grep -nE '"(postinstall|db:[a-z:]+|vercel-build|lint|typecheck)"' package.json
```
Expected: the first grep lists only `src/server/db.ts` and `e2e/helpers/db.ts`. The second and third greps print nothing. The scripts match the spec's "Current state" table, except `lint`, which Phase 5 changed to plain `eslint`. If extra files import `@prisma/client`, add them to Task 3 Step 6. If they're client components importing types, they import from `~/generated/prisma/browser`.

- [ ] **Step 4: Baseline static gate on Prisma 5**

```bash
# P
lsof -iTCP:3000 -sTCP:LISTEN
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
```
Expected: all pass. `prisma generate` prints `Generated Prisma Client (v5.22.0)`. If anything fails here, it's pre-existing breakage from the merge. Stop and report; don't fix it in this phase (ground rule 4).

No commit, apart from the merge commit if Step 1 created one.

---

### Task 2: Step A — Prisma 5 → 6.19

**Files:**
- Modify: `package.json` (`prisma`, `@prisma/client` → `^6.19.3`), `yarn.lock`
- Temporary, never committed: `tz-roundtrip.tmp.ts` (repo root)

**Interfaces:**
- Consumes: Task 1 inventory.
- Produces: Prisma 6.19.3. The **v6 baseline** outputs of the DB checks and the tz round-trip, which Task 4 compares against.

- [ ] **Step 1: Bump packages**

```bash
# P
yarn add @prisma/client@^6.19.3
yarn add -D prisma@^6.19.3
yarn list --pattern prisma --depth=0
```
Expected: both resolve to `6.19.3`, and the `postinstall` output shows `Generated Prisma Client (v6.19.3)`. The spec's Step A table already established that no v6 breaking change applies, so no source edits are needed.

- [ ] **Step 2: Static gate**

```bash
# P
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
```
Expected: all pass.

- [ ] **Step 3: Fresh-DB deploy dry run, schema diff, no-new-migration check (v6 flags)**

```bash
# P
# G
psql "$DEV_URL" -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS cm_drozdi_p7_verify' -c 'CREATE DATABASE cm_drozdi_p7_verify'
DATABASE_URL="$VERIFY_URL" npx prisma migrate deploy
DATABASE_URL="$VERIFY_URL" yarn db:seed
DATABASE_URL="$VERIFY_URL" npx prisma migrate status
npx prisma migrate diff --from-url "$VERIFY_URL" --to-schema-datamodel prisma/schema.prisma --exit-code; echo "diff exit=$?"
DATABASE_URL="$VERIFY_URL" npx prisma migrate dev --create-only --name phase7_drift_check
git status --porcelain prisma/migrations
```
Expected:
- `migrate deploy` → `Applying migration 20240101000000_initial` and `All migrations have been successfully applied.`
- The seed prints the `Dev admin: …` line.
- `migrate status` → `Database schema is up to date!`
- `diff exit=0`
- `migrate dev` → `Already in sync, no schema change or pending migration was found.`
- `git status` prints nothing.

Record all of it as the v6 baseline. If any output differs, stop; see Global Constraints → No new migration.

- [ ] **Step 4: Timezone round-trip baseline**

Create `tz-roundtrip.tmp.ts` at the repo root:
```ts
import { PrismaClient } from '@prisma/client'; // Task 4 swaps these two lines for the v7 client + adapter

const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const instant = new Date('2026-07-01T10:00:00.000Z');
const ev = await db.event.create({ data: { name: 'tz-roundtrip', isPrivate: false, start: instant } });
const back = await db.event.findUniqueOrThrow({ where: { id: ev.id } });
const raw = await db.$queryRaw<{ s: string }[]>`SELECT to_char("start", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS s FROM "Event" WHERE id = ${ev.id}`;
console.log(JSON.stringify({ tz: process.env.TZ, roundTrip: back.start?.toISOString(), raw: raw[0]?.s }));
await db.event.delete({ where: { id: ev.id } });
await db.$disconnect();
```
Run it:
```bash
# P
# G
for tz in UTC Europe/Prague America/New_York; do TZ=$tz DATABASE_URL="$VERIFY_URL" npx tsx tz-roundtrip.tmp.ts; done
rm tz-roundtrip.tmp.ts
```
Expected: three lines, each with `"roundTrip":"2026-07-01T10:00:00.000Z","raw":"2026-07-01T10:00:00.000"` and only the `tz` differing. Record them. The file is deleted; `git status` must not show it.

- [ ] **Step 5: e2e (end of Step A)**

```bash
# P
# G
lsof -iTCP:3000 -sTCP:LISTEN
yarn e2e
```
Expected: every spec passes (`admin-gate`, `auth`, `event-crud`, `events-calendar`, `members`, plus anything Phases 5/6 or #22 added). Record the pass count.

- [ ] **Step 6: Smoke (Playwright MCP)**

Start the server in the background with `TZ=Europe/Prague yarn start`, wait for `Ready`, then:
1. Navigate to `/`. The public calendar renders.
2. Log in as admin at `/login`. You land on `/events` with event cards.
3. Open `/members`. Seeded admin and member rows are listed.

Stop the server with `lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill`.

- [ ] **Step 7: Commit Step A**

```bash
# P
git status --porcelain   # expect only package.json and yarn.lock
git add package.json yarn.lock
git commit -F - <<'EOF'
chore(deps): upgrade Prisma 5 → 6.19 (Phase 7 step A)

No source changes needed: no implicit m-n relations, Bytes fields,
fullTextSearch flag or NotFoundError usage. Verified empty schema
diff, fresh-DB migrate deploy, timezone round-trip and full e2e.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Step B — Prisma 7: generator, config, adapter, imports

One atomic commit, so the branch builds at every commit.

**Files:**
- Modify: `prisma/schema.prisma` (generator + datasource blocks only)
- Create: `prisma.config.ts`
- Modify: `package.json` (deps; `db:generate`, `db:push` scripts), `yarn.lock`
- Modify: `.gitignore` (add `/src/generated/`)
- Modify: `.eslintrc.cjs` (add `ignorePatterns`)
- Modify: `src/server/db.ts`
- Modify: `e2e/helpers/db.ts`
- Modify: any extra file found by the Task 1 Step 3 inventory

**Interfaces:**
- Consumes: Prisma 6.19.3 from Task 2.
- Produces:
  - Generated client module `~/generated/prisma/client` (on disk at `src/generated/prisma/client.ts`), exporting `PrismaClient` and `Prisma`.
  - `db` from `~/server/db`, an adapter-backed `PrismaClient`. Its export name and type shape are unchanged, so `auth.ts`, `trpc.ts`, the routers, `auth-password-link.ts` and `prisma/seed.ts` don't change.
  - `prisma.config.ts`, which every Prisma CLI command reads.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Replace the generator block with `provider = "prisma-client"` plus `output = "../src/generated/prisma"`. Remove the `url = env("DATABASE_URL")` line from `datasource db`, keeping `provider = "postgresql"`. Exact blocks are in spec §B2. Don't touch anything below the datasource block.

- [ ] **Step 2: Create `prisma.config.ts`**

Use the contents of spec §B3 verbatim: dotenv `config({ quiet: true })`, `defineConfig` with `schema`, `migrations.path`, and `datasource: { url: process.env.DATABASE_URL ?? '' }`. Do **not** use the `env()` helper.

- [ ] **Step 3: Install packages (scripts off, then generate explicitly)**

```bash
# P
yarn add --ignore-scripts @prisma/client@^7.10.0 @prisma/adapter-pg@^7.10.0 pg@^8.23.1
yarn add --ignore-scripts -D prisma@^7.10.0
node -p "['prisma','@prisma/client','@prisma/adapter-pg'].map(p=>p+'@'+require('./node_modules/'+p+'/package.json').version).join(' ')"
npx prisma generate
```
Expected: `prisma@7.10.0 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0` (same version for all three). Then `Loaded Prisma config from prisma.config.ts` and `Generated Prisma Client (7.10.0) to ./src/generated/prisma`.

- [ ] **Step 4: Ignore generated code**

- `.gitignore`: add `/src/generated/` under a `# prisma generated client` comment.
- `.eslintrc.cjs`: add top-level `"ignorePatterns": ["src/generated/**"]`. If Phase 5 left the ignore list somewhere else, such as an `.eslintignore` or `--ignore-pattern` in the `lint` script, add it there instead.

`git status --porcelain` must not list `src/generated`.

- [ ] **Step 5: Keep the developer workflow (v7 no longer auto-generates)**

In `package.json`: `"db:generate": "prisma migrate dev && prisma generate"` and `"db:push": "prisma db push && prisma generate"`. Leave `postinstall`, `db:migrate`, `db:seed`, `db:seed:local`, `db:studio` and `vercel-build` unchanged.

- [ ] **Step 6: Switch the client imports to the generated path with the adapter**

- `src/server/db.ts`: import `PrismaClient` from `~/generated/prisma/client` and `PrismaPg` from `@prisma/adapter-pg`. `createPrismaClient` passes `adapter: new PrismaPg({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5_000 })` and keeps the existing `log` option and `globalThis` singleton.
- `e2e/helpers/db.ts`: import `PrismaClient` from `../../src/generated/prisma/client` (relative, no alias) and construct with `adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })`. The exported helpers don't change.
- Any extra importer from Task 1 Step 3: server code imports from `~/generated/prisma/client`, client components from `~/generated/prisma/browser`.

```bash
# P
grep -rnE "from ['\"]@prisma/client" src e2e prisma *.ts
```
Expected: no output.

- [ ] **Step 7: `prisma generate` with no URL and no `.env` (Review Focus 2)**

```bash
# P
mv .env .env.p7bak && (env -u DATABASE_URL npx prisma generate; echo "generate exit=$?"); mv .env.p7bak .env
ls .env
```
Expected: `Generated Prisma Client (7.10.0)`, `generate exit=0`, and `.env` restored.

- [ ] **Step 8: CLI reads `.env` by itself (Review Focus 3)**

```bash
# P
# G
env -u DATABASE_URL npx prisma migrate status
```
Expected: `Datasource "db": PostgreSQL database "<local dev db>", schema "public" at "localhost:5432"` and `Database schema is up to date!`. Read-only against the local dev DB.

- [ ] **Step 9: Static gate**

```bash
# P
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
```
Expected: all pass. If `next build` complains about `pg` bundling (`pg-native`, `cloudflare:sockets`), add `serverExternalPackages: ['pg']` to `next.config.js` and note why in the commit body. Next normally externalises `pg` by default.

- [ ] **Step 10: Commit Step B**

```bash
# P
git add prisma/schema.prisma prisma.config.ts package.json yarn.lock .gitignore .eslintrc.cjs src/server/db.ts e2e/helpers/db.ts
git status --porcelain   # nothing else staged or untracked except files from Task 1 Step 3
git commit -F - <<'EOF'
feat(db): upgrade Prisma 6 → 7 with prisma-client generator and pg adapter (Phase 7 step B)

- generator prisma-client → src/generated/prisma (gitignored, built by postinstall)
- prisma.config.ts loads .env via dotenv; datasource url = DATABASE_URL
  (process.env, not env(), so `prisma generate` works without a URL in CI/Vercel)
- src/server/db.ts and e2e/helpers/db.ts use @prisma/adapter-pg
  (connectionTimeoutMillis 5s = Prisma <=6 connect timeout)
- db:generate / db:push chain `prisma generate` (v7 no longer auto-generates)
- no schema or migration change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Step B runtime verification — DB checks, Vercel build simulation, timezone, Better Auth, e2e

**Files:** none committed, unless a fix is needed. Any fix goes in its own commit with the standard trailer.

**Interfaces:**
- Consumes: Task 3 commit; Task 2 baseline outputs.
- Produces: evidence for the PR body. Step B is cleared for push only if every step matches.

- [ ] **Step 1: Fresh verify DB + local `vercel-build` simulation (migrate deploy dry run + seed + build)**

```bash
# P
# G
psql "$DEV_URL" -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS cm_drozdi_p7_verify' -c 'CREATE DATABASE cm_drozdi_p7_verify'
VERCEL_ENV=preview DATABASE_URL="$VERIFY_URL" SKIP_ENV_VALIDATION=1 yarn vercel-build
```
Expected: `Loaded Prisma config from prisma.config.ts`, `Applying migration 20240101000000_initial`, `All migrations have been successfully applied.`, the seed's `Dev admin: …` line, then a successful `next build`.

- [ ] **Step 2: Schema diff + no-new-migration check (v7 flags)**

```bash
# P
# G
DATABASE_URL="$VERIFY_URL" npx prisma migrate status
DATABASE_URL="$VERIFY_URL" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code; echo "diff exit=$?"
DATABASE_URL="$VERIFY_URL" npx prisma migrate dev --create-only --name phase7_drift_check
git status --porcelain prisma/migrations
```
Expected: same results as the Task 2 Step 3 baseline. `Database schema is up to date!`, `diff exit=0`, `Already in sync…`, and `git status` prints nothing. Any difference means stop and ask the owner.

- [ ] **Step 3: Timezone round-trip on v7 (Review Focus 1)**

Recreate `tz-roundtrip.tmp.ts` from Task 2 Step 4, replacing its first two lines with:
```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client';

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
```
```bash
# P
# G
for tz in UTC Europe/Prague America/New_York; do TZ=$tz DATABASE_URL="$VERIFY_URL" npx tsx tz-roundtrip.tmp.ts; done
rm tz-roundtrip.tmp.ts
```
Expected: three lines **identical** to the Task 2 baseline: `roundTrip` `2026-07-01T10:00:00.000Z`, `raw` `2026-07-01T10:00:00.000`. Any shift means stop and report; do not push.

- [ ] **Step 4: Drop the verify DB**

```bash
# P
# G
psql "$DEV_URL" -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS cm_drozdi_p7_verify'
```

- [ ] **Step 5: Full gate incl. e2e (end of Step B)**

```bash
# P
# G
lsof -iTCP:3000 -sTCP:LISTEN
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
yarn e2e
```
Expected: all pass, with the same e2e pass count as Task 2 Step 5. `global-setup` prints `Loaded Prisma config from prisma.config.ts` from its `migrate deploy`. `auth.spec.ts` and `members.spec.ts` green is the automated Better Auth check (login, wrong password, admin create, role change, delete with session revoke). If the e2e helper fails to load the generated client inside Playwright, report the exact error. Don't switch `moduleFormat` without noting it in the PR.

- [ ] **Step 6: Better Auth + app smoke (Playwright MCP) (Review Focus 4)**

Start `TZ=Europe/Prague yarn start` in the background, then:
1. `/`: the public calendar renders, which is a DB read.
2. Log in as admin, land on `/events`. Create an event with a start time of 14:00. The card shows 14:00. Delete it.
3. `/members`: create a member `p7-smoke@example.com` (role Člen), then generate its set-password link from the member row.
4. Log out. Open the link (`/reset-password?token=…`). Set a fresh password of 8+ characters, generated with `openssl rand -hex 8` and not echoed anywhere.
5. Log in as `p7-smoke@example.com`, land on `/events`, log out.
6. Log in as admin and delete `p7-smoke@example.com` through the confirm dialog.

Expected: every step succeeds, with no server errors in the `yarn start` output (no `P1010`, `P2025`, adapter or transaction errors). Stop the server with `lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill`. **If a Better Auth path fails and can't be fixed without patching or bumping better-auth, stop and report; do not push** (spec, Better Auth gate).

---

### Task 5: Push, draft PR, CI, Vercel preview check

**Files:** none.

**Interfaces:**
- Consumes: Tasks 2–4 commits and evidence notes.
- Produces: the draft PR number `<N>`, used by Task 6.

- [ ] **Step 1: Push and open the draft PR**

```bash
# P
git push -u origin feat/upgrade-phase-7-prisma7
gh pr create --draft --base develop --title "Phase 7: Prisma 5 → 6 → 7" --body-file <scratchpad>/phase7-pr-body.md
```
The body contains: a summary of Step A and Step B, which link the spec and plan; the evidence (diff `exit=0` on v6 and v7, fresh-DB deploy output, tz round-trip lines from v6 and v7, e2e counts, smoke results); a line saying **no migration, no Vercel/Neon change, production untouched until the next release**; the spec's two owner questions; and a test-plan checklist. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Expected: the PR URL is printed. Record `<N>`.

- [ ] **Step 2: CI**

```bash
# P
gh pr checks <N> --watch
```
Expected: `lint` and `typecheck` pass. The `typecheck` job proves `prisma generate` runs without `DATABASE_URL`. `e2e` is skipped because the PR is a draft; it runs once the review gate marks the PR ready.

- [ ] **Step 3: Vercel preview build logs (read-only)**

```bash
# P
vercel whoami
vercel ls --yes -m githubCommitRef=feat/upgrade-phase-7-prisma7 | head -5
vercel inspect <preview-url>
vercel inspect <preview-url> --logs 2>&1 | grep -E "Prisma config|Generated Prisma Client|migration|Dev admin|Compiled|rror"
```
If `-m` filtering isn't supported, take the URL from the Vercel bot comment on the PR. Expected: status `● Ready`. The logs show `Generated Prisma Client (7.10.0)`, a migrate-deploy result (`No pending migrations to apply.` or the initial migration applied on a fresh branch), the seed's `Dev admin:` line, and a successful build, with no `Error` lines. If `vercel whoami` isn't logged in, ask the user to run `! vercel login`.

- [ ] **Step 4: Preview runtime (Review Focus 5)**

Run `vercel logs <preview-url>` as a background command, then with Playwright MCP:
1. Navigate to `<preview-url>/`. The public calendar renders.
2. Navigate to `<preview-url>/api/trpc/event.getForCalendar?batch=1&input=%7B%7D`. The response is JSON starting with `[{"result":{"data":`.

Stop the log stream after about 60 s and check it for `P1010`, `SSL`, `self-signed`, `ECONNREFUSED`, `timeout`. The `SECURITY WARNING … aliases for 'verify-full'` line from `pg` is expected and harmless. If Vercel Deployment Protection blocks access, don't sign in to Vercel. Note it in the PR and leave the check to the owner. Do not log in to the app on the preview: the owner does that (spec, Open question 2).

---

### Task 6 (final): CLAUDE.md Prisma notes + master-plan tracking row

**Files:**
- Modify: `CLAUDE.md` (Commands section; new `### Prisma (v7)` subsection under Architecture)
- Modify: `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` (tracking table row 7 only)

**Interfaces:**
- Consumes: PR `<N>` from Task 5.
- Produces: nothing; terminal task. Afterwards the PR goes through the `CLAUDE.md` agent review gate.

- [ ] **Step 1: Update `CLAUDE.md`**

Commands section:
- `yarn install`: `postinstall` runs `prisma generate`, which writes the client to `src/generated/prisma` (gitignored).
- `yarn db:push`: now `prisma db push && prisma generate`.
- `yarn db:generate`: now `prisma migrate dev && prisma generate`. Prisma 7 no longer auto-generates or auto-seeds; seed explicitly with `yarn db:seed:local`.

New `### Prisma (v7)` subsection, one bullet each:
- CLI config lives in `prisma.config.ts`, which loads `.env` via dotenv and uses `DATABASE_URL`.
- Import the client from `~/generated/prisma/client`, never `@prisma/client`. Client components use `~/generated/prisma/browser`.
- The runtime connects through `@prisma/adapter-pg` in `src/server/db.ts`.
- Never `yarn add prisma@latest`: `latest` is an 8.0 release candidate.

- [ ] **Step 2: Update the tracking row**

In the master plan's Tracking table, replace `| 7 — Prisma 7 | not started |` with `| 7 — Prisma 7 | [#<N>](https://github.com/SlatinskyJ/cm-drozdi/pull/<N>) |`.

- [ ] **Step 3: Commit and push**

```bash
# P
git add CLAUDE.md docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
git commit -F - <<'EOF'
docs: Prisma 7 notes in CLAUDE.md, track Phase 7 PR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
```
Expected: the push succeeds and CI re-runs green. Hand the PR to the `CLAUDE.md` agent review gate. Phase 7 needs the owner's OK before merge only if a migration, a better-auth bump or a Vercel/Neon change ended up being required. None is planned.
