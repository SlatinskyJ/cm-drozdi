# Phase 5 — React 19 + Next.js 14 → 15 → 16 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app from Next 14.2 / React 18.3 to Next 16.4 / React 19.3 in two separately-committed Steps (A: Next 15.5 + React 19, B: Next 16.4), keeping lint on the legacy ESLint 8 config, with an unchanged route table and identical proxy behavior.

**Architecture:** First capture characterization baselines on untouched Next 14: the build route table and a curl matrix of the auth gate. Then make each change in its own commit, ordered so every commit builds: dead dependency out → router stops using `next/headers` → framework bump with the async-API fix → (Step A gate) → lint script off `next lint` → Next 16 + proxy rename → `getSessionCookie` → `next-env.d.ts` untracked → docs → (Step B gate, baselines re-compared). Codemods are pinned (`@next/codemod@16.4.0`) and always run with `--skip-eslint-upgrade`. Their output is reviewed, never trusted blindly.

**Tech Stack:** Next.js 15.5.27 → 16.4.0, React 19.3.0, Better Auth 1.6 (`better-auth/cookies`), tRPC 11, ESLint 8.57 + `.eslintrc.cjs` + `eslint-config-next@15.5.27`, Yarn 1, Playwright (+ Playwright MCP for smoke), native Postgres on `localhost:5432`.

**Spec:** `docs/superpowers/specs/2026-10-12-phase-5-react19-next16.md` (read it first; it has the rationale for every decision below).

## Global Constraints

- Branch `feat/upgrade-phase-5-react19-next16`, worktree `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-5-react19-next16`. Never touch `main`. Don't push or open a PR unless the orchestrator asks.
- **Node 22:** every shell command that runs `yarn`, `npx`, `node`, or `next` is prefixed with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" &&` (shell state does not persist between calls). The prefix is written out in the gate blocks below. Add it to every other command too.
- **Versions (exact resolved):** `next` 15.5.27 after Step A, 16.4.0 after Step B; `react`/`react-dom` 19.3.0; `@types/react`/`@types/react-dom` 19.3.x; `eslint-config-next` **exactly `15.5.27`** (no caret) for the whole phase; `eslint` stays `^8.57.0`.
- **Do not change:** `better-auth`, `@trpc/*`, `@tanstack/react-query`, `typescript`, `prisma`/`@prisma/client`, `tailwindcss`, `zod`, `.eslintrc.cjs`, `.github/workflows/ci.yml`, `next.config.js`.
- **Hands off the timezone PR's files:** do not edit `src/server/api/trpc.ts`, `src/utils/date.ts`, `playwright.config.ts`, `e2e/helpers/date.ts`. Nothing in this plan may rely on `dateMiddleware` existing or not existing.
- **Every `@next/codemod` run passes `--skip-eslint-upgrade`.** If a codemod creates `eslint.config.mjs`, or adds `eslint@9` or `@eslint/eslintrc`, delete or revert those changes.
- **No codemod residue:** `UnsafeUnwrapped*`, `@next-codemod-error`, and `@next-codemod-ignore` must never be committed.
- **Lint coverage:** `eslint src --ext .js,.jsx,.ts,.tsx` (same set as `next lint`). Do not widen to `.`. That is Phase 9.
- **Commit trailer:** every commit message ends with a blank line followed by `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git commit -F -` with a heredoc so the trailer is exact.
- **e2e only at the end of each Step** (Task 5, Task 11). Other tasks run the fast gate. `yarn e2e` truncates and reseeds the DB named in `.env`'s `DATABASE_URL`. That is expected.
- **Before `yarn e2e` or `yarn build`:** nothing may be listening on port 3000 (`lsof -ti:3000` prints nothing; otherwise `lsof -ti:3000 | xargs kill`). Playwright reuses an existing server locally, and Next 16 refuses concurrent builds.
- **Scratch artifacts** go in `docs/superpowers/task-reports/`. It is gitignored, so never `git add -f` it.
- Smoke-test credentials are the dev seed users defined in `prisma/seed.ts` / `e2e/global-setup.ts` (dev-only test values). Read them there, and don't copy them into commits or reports.

### Fast gate (after every task that changes code)

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && \
  yarn install --frozen-lockfile && \
  npx prisma generate && \
  SKIP_ENV_VALIDATION=1 yarn lint && \
  yarn typecheck && \
  SKIP_ENV_VALIDATION=1 yarn build
```
Expected: every command exits 0, with no ESLint errors and no new ESLint warnings versus the previous task.

### Full gate (end of each Step)

Fast gate, then (port 3000 free):
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn e2e
```
Expected: all specs pass (`admin-gate`, `auth`, `event-crud`, `events-calendar`, `members`) with 0 failed and 0 flaky.

### Smoke checklist (Playwright MCP, end of each Step)

Run after the full gate. First reseed the DB (`yarn db:seed:local`), then start the prod server in the background (`yarn start`, after the build) and use the `mcp__playwright__browser_*` tools against `http://localhost:3000`:

1. Logged out: navigate to `/events` and confirm the URL ends at `/login`.
2. Log in as the seeded admin through the `/login` form (placeholders `E-mail` / `Heslo`, button `Přihlásit`), then confirm you land on `/events`.
3. `/events`: the calendar renders with styling. `browser_evaluate` `getComputedStyle(document.documentElement).backgroundColor` returns `rgb(230, 223, 196)` (#E6DFC4). Event cards render. Clicking a card opens the detail dialog, and the dialog closes again.
4. Request/create an event (fill required fields, start date + `HH:MM` duration), confirm it appears, change its state from the state dropdown, then delete it.
5. `/members`: create a member, change its role, then delete it (each succeeds with a toast and the row updates). This exercises the `ctx.headers` fix.
6. Log out from the menu. `/events` redirects to `/login` again.
7. `browser_console_messages` (level error) shows no hydration mismatch, no "A tree hydrated but…", and no React error. Pre-existing network 401s from logged-out requests are fine.
8. Stop the server: `lsof -ti:3000 | xargs kill`.

Record each item as pass/fail (one line each) in `docs/superpowers/task-reports/phase-5-verification.md` under a `## Step A smoke` / `## Step B smoke` heading.

## Review Focus

1. **HTTPS `__Secure-` cookie (Vercel preview/prod):** e2e runs over http, so it only uses the unprefixed cookie. A logged-in user on HTTPS must still pass the proxy. Pinned by the `secure` row of the proxy matrix (Task 1 baseline, re-checked in Tasks 8 and 11) and by the post-push Vercel check in Task 11.
2. **Admin member mutations under Next 15+:** a non-awaited `headers()` hands Better Auth a Promise, which breaks authorization for create/setRole/delete member. Pinned by `members.spec.ts` (create, role change, delete) in the full gates and by smoke item 5.
3. **Fresh CI checkout without `next-env.d.ts`:** CI lint/typecheck jobs never build, so static image imports lose their types. Pinned by the delete-and-rerun simulation in Task 9.
4. **Turbopack CSS on Tailwind 3:** a production build can succeed and still ship unstyled pages. Pinned by smoke item 3 (computed background color plus visual check of the calendar CSS) in Task 11.
5. **React 19 hydration/runtime errors** that don't fail any assertion. Pinned by smoke item 7 in Tasks 5 and 11.

---

## Before Task 1: merge latest `develop`

Before Task 1, merge latest `develop`, which will include the timezone fix (`fix/event-timezone-prague`) once it has landed. This plan works whether or not it has landed. Task 11 re-merges if `develop` moved.

- [ ] **Merge**

```bash
cd /Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-5-react19-next16
git fetch origin
git merge origin/develop -F - <<'EOF'
Merge origin/develop into feat/upgrade-phase-5-react19-next16

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: "Already up to date." or a clean merge. On conflicts, stop and report. This branch only carries docs at this point, so a conflict means something unexpected.

- [ ] **Note timezone status:** `git log origin/develop --oneline | grep -i -m1 timezone`. Write the result (merged SHA, or "not yet merged") as the first line of `docs/superpowers/task-reports/phase-5-verification.md` (create the dir/file).

---

## Step A — Next 15.5 + React 19

### Task 1: Capture Next 14 baselines (no commit)

**Files:**
- Create (gitignored): `docs/superpowers/task-reports/phase-5-routes.sh`, `docs/superpowers/task-reports/phase-5-proxy-matrix.sh`, `docs/superpowers/task-reports/phase-5-build-before.log`, `docs/superpowers/task-reports/phase-5-routes-before.txt`, `docs/superpowers/task-reports/phase-5-proxy-before.txt`

**Interfaces:**
- Produces: `phase-5-routes.sh <build-log>` prints one `<marker> <route>` line per route. `phase-5-proxy-matrix.sh` prints one `<path> [<cookie-case>] <status> <redirect-url>` line per probe (server must be on :3000). Tasks 5, 8 and 11 diff against the two `*-before.txt` files.

- [ ] **Step 1: Install and confirm the baseline is green**

Run the **fast gate**, but replace its build line with:
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && SKIP_ENV_VALIDATION=1 yarn build 2>&1 | tee docs/superpowers/task-reports/phase-5-build-before.log
```
Expected: all green on Next 14.2.x. If anything fails on untouched develop, stop and report. Do not fix it in this phase.

- [ ] **Step 2: Write `phase-5-routes.sh`**

```bash
#!/usr/bin/env bash
# Extract "<marker> <route>" from a `next build` log. Size columns are dropped
# (Next 16 no longer prints them); Next 14's λ is normalized to ƒ.
grep -E '^[┌├└] ' "$1" | awk '{print $2, $3}' | sed 's/^λ/ƒ/'
```
`chmod +x` it, then run `docs/superpowers/task-reports/phase-5-routes.sh docs/superpowers/task-reports/phase-5-build-before.log > docs/superpowers/task-reports/phase-5-routes-before.txt`.
Expected: one line per route. Every page (`/`, `/data-deletion`, `/events`, `/login`, `/members`, `/reset-password`) and both API routes are `ƒ`, and `/robots.txt` and `/sitemap.xml` are `○`. If the file is empty, the build log's tree characters differ. Fix the grep and re-run before moving on.

- [ ] **Step 3: Write `phase-5-proxy-matrix.sh`**

```bash
#!/usr/bin/env bash
# Characterize the auth gate (middleware/proxy) against a running `yarn start`.
# /data-deletion has no auth of its own, so its status reflects the gate alone.
B=http://localhost:3000
probe() {
  local args=(-s -o /dev/null -w '%{http_code} %{redirect_url}')
  [ -n "$3" ] && args+=(-H "Cookie: $3")
  printf '%-40s %s\n' "$1 [$2]" "$(curl "${args[@]}" "$B$1")"
}
probe /data-deletion none
probe /data-deletion plain  'better-auth.session_token=dummy.sig'
probe /data-deletion secure '__Secure-better-auth.session_token=dummy.sig'
probe /data-deletion empty  'better-auth.session_token='
probe /events none
probe / none
probe /login none
probe /reset-password none
probe /robots.txt none
probe /sitemap.xml none
probe /favicon.ico none
probe /api/auth/get-session none
```

- [ ] **Step 4: Capture the proxy baseline**

Start `yarn start` in the background (port 3000 free first), wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login` prints `200`, run `docs/superpowers/task-reports/phase-5-proxy-matrix.sh > docs/superpowers/task-reports/phase-5-proxy-before.txt`, then stop the server.
Expected content: `/data-deletion [none]` and `/events [none]` → `307 http://localhost:3000/login`. `plain`, `secure` → `200`. `empty` → `200` on Next 14, because the hand-rolled check treats an empty cookie as present (see Task 8). Every other row → `200`.

No commit. Baseline files are gitignored.

---

### Task 2: Remove unused `@ant-design/nextjs-registry`

**Files:**
- Modify: `package.json`, `yarn.lock`

**Interfaces:** none. This goes first because its peers pin `next`/`react` and would obstruct the codemod's install in Task 4.

- [ ] **Step 1: Confirm it is unused**

Run: `git grep -n "nextjs-registry\|@ant-design" -- src e2e prisma`
Expected: no output.

- [ ] **Step 2: Remove it**

Run: `yarn remove @ant-design/nextjs-registry`
Expected: `package.json` no longer lists it, and `yarn.lock` shrinks.

- [ ] **Step 3: Fast gate.** Expected: green.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -F - <<'EOF'
chore: remove unused @ant-design/nextjs-registry

Imported nowhere; its peer ranges pin next/react and would get in the way
of the Phase 5 framework upgrade.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Member router passes `ctx.headers` to Better Auth

**Files:**
- Modify: `src/server/api/routers/member.ts` (import on line 1; `create` ~L53-64, `setRole` ~L111-116, `delete` ~L154-159)

**Interfaces:**
- Consumes: `ctx.headers: Headers` from `createTRPCContext` (`src/server/api/trpc.ts`, unchanged). For HTTP calls it is the incoming request's headers, including the admin's session cookie.
- Produces: no new symbols. `member.ts` no longer imports `next/headers`.

Works on Next 14 and fixes the Next 15+ bug where a Promise was passed as `headers`.

- [ ] **Step 1: Edit `member.ts`**

- Delete `import { headers } from 'next/headers';`.
- `create`: change `.mutation(async ({ input }) => {` to `.mutation(async ({ ctx, input }) => {`.
- In `create`, `setRole` and `delete`: delete the `const h = headers();` line and pass `headers: ctx.headers` in the `auth.api.createUser` / `auth.api.setRole` / `auth.api.revokeUserSessions` call.

- [ ] **Step 2: Verify no `next/headers` left in routers**

Run: `git grep -n "next/headers\|headers()" -- src/server/api/routers`
Expected: no output.

- [ ] **Step 3: Fast gate.** Expected: green. (Behavior is covered by `members.spec.ts` in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/member.ts
git commit -F - <<'EOF'
fix: pass tRPC ctx.headers to Better Auth admin calls

member.create/setRole/delete called next/headers' headers() without
awaiting it. On Next 15+ that hands Better Auth a Promise instead of the
request headers. ctx.headers already carries the incoming request headers
(including the admin's session cookie), so use it and drop the
next/headers import from the router.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Upgrade to Next 15.5 + React 19

**Files:**
- Modify: `package.json`, `yarn.lock`
- Modify: `src/trpc/server.ts` (`createContext`, ~L15-22)
- Modify: `src/server/auth.ts` (doc comment + eslint-disable, ~L37-43)
- Modify (only if Next rewrites them on build): `next-env.d.ts`, `tsconfig.json`
- Possibly modify (React 19 codemods): files under `src/app/_components/ui/`, kept only under the rule in Step 4

**Interfaces:**
- Produces: `createContext` in `src/trpc/server.ts` becomes `async` and returns `Promise<context>`. `createCaller(createContext)` accepts that unchanged. `getServerAuthSession(): Promise<AppSession | null>` keeps its signature.

- [ ] **Step 1: Run the upgrade codemod**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && \
  npx --yes @next/codemod@16.4.0 upgrade 15.5.27 --skip-eslint-upgrade --verbose 2>&1 | tee docs/superpowers/task-reports/phase-5-codemod-15.log
```
Expected: it runs non-interactively (accepting defaults), upgrades `next`, `react`, `react-dom`, `@types/react` and `@types/react-dom`, and runs the recommended codemods, including `next-async-request-api` and the React 19 codemods.
**If install fails or the run is interrupted:** `git checkout package.json yarn.lock && yarn install --frozen-lockfile`, then install manually instead:
`yarn add next@15.5.27 react@19.3.0 react-dom@19.3.0 && yarn add -D @types/react@19.3.0 @types/react-dom@19.3.0`, then `npx --yes types-react-codemod@latest preset-19 ./src` (accept defaults).

- [ ] **Step 2: Pin `eslint-config-next`**

Run: `yarn add -D --exact eslint-config-next@15.5.27`
Expected: `"eslint-config-next": "15.5.27"` (no caret) in `package.json`.

- [ ] **Step 3: Normalize `package.json`**

- `yarn list --pattern "next|react|react-dom|@types/react|@types/react-dom|eslint-config-next|eslint" --depth=0` resolves to: next 15.5.27, react 19.3.0, react-dom 19.3.0, @types/react 19.3.x, @types/react-dom 19.3.x, eslint-config-next 15.5.27, eslint 8.57.x. Accept whatever range syntax the codemod wrote for next/react/types.
- If the codemod added a `resolutions` or `overrides` block for `@types/react*`, delete it (not needed for stable React 19).
- If the `dev` script gained `--turbopack`, restore `"dev": "next dev"`. Turbopack arrives with Next 16 in Task 7.
- `"lint"` must still be `"next lint"` (changed in Task 6).
- Run `yarn install` to sync `yarn.lock` after any manual edit.

- [ ] **Step 4: Review every codemod-touched file**

Run: `git status --porcelain` and `git diff --stat`.
- Allowed: `package.json`, `yarn.lock`, `src/trpc/server.ts`, `src/server/auth.ts`, `next-env.d.ts`, `tsconfig.json`.
- Under `src/app/_components/ui/`, keep only pure type-level renames recommended by `@types/react@19` (for example `React.ElementRef` → `React.ComponentRef`, `MutableRefObject` → `RefObject`). List them in the commit body.
- `git checkout -- <file>` anything else and note it in the commit body.

- [ ] **Step 5: Hand-fix `src/trpc/server.ts`**

`createContext = cache(async () => { const heads = new Headers(await headers()); heads.set('x-trpc-source', 'rsc'); return createTRPCContext({ headers: heads }); })`. Remove any `UnsafeUnwrappedHeaders` import, cast, or codemod comment.

- [ ] **Step 6: Clean `src/server/auth.ts`**

Delete the `// eslint-disable-next-line @typescript-eslint/await-thenable …` line. Replace the doc comment above `getServerAuthSession` with:
```typescript
/**
 * Server-side session accessor for server components and route handlers.
 * Returns `null` when unauthenticated.
 */
```
Leave `await auth.api.getSession({ headers: await headers() })` unchanged.

- [ ] **Step 7: Verify no codemod residue and no sync request APIs**

Run: `git grep -n "UnsafeUnwrapped\|@next-codemod-error\|@next-codemod-ignore" -- src` → expected: no output.
Run: `git grep -n "headers()" -- src | grep -v "await headers()"` → expected: no output (the only `headers()` calls left are the awaited ones in `src/trpc/server.ts` and `src/server/auth.ts`).

- [ ] **Step 8: Fast gate**

Expected: green. `next lint` prints a deprecation notice (fine). Next 15.5's `next build` also lints, and it must pass too. If `eslint-plugin-react-hooks@5` (pulled in by `eslint-config-next@15.5.27`) reports new findings, fix them in place. Do not add disables without a one-line reason. If the build rewrote `next-env.d.ts` or `tsconfig.json`, include them in the commit.

- [ ] **Step 9: Commit**

```bash
git add -A package.json yarn.lock src next-env.d.ts tsconfig.json
git status --porcelain   # expected: nothing left unstaged except gitignored task-reports
git commit -F - <<'EOF'
feat!: upgrade to Next.js 15.5 and React 19

- next 15.5.27, react/react-dom 19.3.0, @types/react(-dom) 19.3
  (via @next/codemod@16.4.0 upgrade 15.5.27 --skip-eslint-upgrade)
- eslint-config-next pinned to 15.5.27 (last eslintrc-compatible line;
  ESLint 8 + .eslintrc.cjs stay until Phase 9)
- trpc/server.ts: await the now-async headers() in the RSC context
- server/auth.ts: drop the Next-14 await-thenable workaround comment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
(Append to the body any kept or reverted codemod edits from Step 4 before committing.)

---

### Task 5: Step A gate (no commit unless a fix is needed)

**Files:** none expected. Any fix gets its own `fix:` commit with the trailer.

- [ ] **Step 1: Full gate.** Expected: green, all five e2e specs pass.
- [ ] **Step 2: Proxy matrix.** Start `yarn start`, run `phase-5-proxy-matrix.sh > docs/superpowers/task-reports/phase-5-proxy-after-A.txt`, then run `diff docs/superpowers/task-reports/phase-5-proxy-before.txt docs/superpowers/task-reports/phase-5-proxy-after-A.txt`. Expected: no diff (middleware code is unchanged in Step A). Stop the server.
- [ ] **Step 3: Route table.** `phase-5-routes.sh` on a fresh `SKIP_ENV_VALIDATION=1 yarn build 2>&1 | tee docs/superpowers/task-reports/phase-5-build-after-A.log`, saved as `phase-5-routes-after-A.txt` and diffed against `phase-5-routes-before.txt`. Expected: no diff. Record any diff in the verification report.
- [ ] **Step 4: Smoke checklist** (all 8 items) and record the results under `## Step A smoke`.
- [ ] **Step 5:** If any step failed, use superpowers:systematic-debugging to find the cause, fix it in a dedicated commit (`fix: <what> on Next 15/React 19`), and re-run this task from Step 1. Do not start Step B with a red Step A.

---

## Step B — Next 16.4

### Task 6: Run ESLint directly instead of `next lint`

**Files:**
- Modify: `package.json` (`scripts.lint`)

**Interfaces:**
- Produces: `yarn lint` = `eslint src --ext .js,.jsx,.ts,.tsx` (Task 9 prefixes `next typegen &&`).

Done on Next 15.5, before the Next 16 upgrade removes `next lint`, so `yarn lint` keeps working throughout.

- [ ] **Step 1: Edit the script:** `"lint": "eslint src --ext .js,.jsx,.ts,.tsx"`.

- [ ] **Step 2: Prove the config is loaded (canary)**

Create `src/lint-canary.tsx`:
```tsx
Promise.resolve(1);
export default function LintCanary() {
	return <img src="/logo.svg" alt="" />;
}
```
Run: `export PATH=… && SKIP_ENV_VALIDATION=1 yarn lint; echo "exit=$?"`
Expected: an **error** `@typescript-eslint/no-floating-promises` (proves the type-checked preset and `parserOptions.project` load), a **warning** `@next/next/no-img-element` (proves `next/core-web-vitals` from `eslint-config-next@15.5.27` loads), and `exit=1`.

- [ ] **Step 3: Delete the canary** (`rm src/lint-canary.tsx`) and re-run `SKIP_ENV_VALIDATION=1 yarn lint`. Expected: exit 0, no output beyond the yarn banner.

- [ ] **Step 4: Fast gate.** Expected: green.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -F - <<'EOF'
chore: run eslint directly instead of next lint

next lint is deprecated in 15.5 and removed in 16. Lint scope stays
equivalent to next lint (src only); widening to e2e/, prisma/ and root
configs is deferred to Phase 9 with the flat-config migration.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Upgrade to Next 16.4 (middleware → proxy rename)

**Files:**
- Modify: `package.json`, `yarn.lock`
- Rename: `src/middleware.ts` → `src/proxy.ts` (codemod `middleware-to-proxy`)
- Modify (if Next rewrites them on build): `next-env.d.ts`, `tsconfig.json`

**Interfaces:**
- Produces: `src/proxy.ts` with `export default function proxy(req: NextRequest)` and the unchanged `export const config = { matcher: [...] }`. The body is still the hand-rolled cookie check here; Task 8 replaces it.

- [ ] **Step 1: Run the upgrade codemod**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && \
  npx --yes @next/codemod@16.4.0 upgrade 16.4.0 --skip-eslint-upgrade --skip-react-upgrade --verbose 2>&1 | tee docs/superpowers/task-reports/phase-5-codemod-16.log
```
Expected: `next` → 16.4.0. The `middleware-to-proxy` codemod renames `src/middleware.ts` → `src/proxy.ts`. `remove-unstable-prefix` and `remove-experimental-ppr` find nothing.
**If install fails:** restore `package.json`/`yarn.lock`, run `yarn add next@16.4.0`, then `npx --yes @next/codemod@16.4.0 middleware-to-proxy .`.

- [ ] **Step 2: Normalize**

- `yarn list --pattern "next|react|react-dom|eslint-config-next|eslint" --depth=0` → next 16.4.0, react/react-dom 19.3.0, eslint-config-next 15.5.27, eslint 8.57.x.
- The `dev` script is `"next dev"` (drop any `--turbopack`, which is the default in 16). `build` is `"next build"`.
- No `eslint.config.mjs` exists, and `git diff package.json` shows no eslint/`@eslint/*` changes.
- `src/middleware.ts` is gone and `src/proxy.ts` exists. If the default-exported function is still named `middleware`, rename it to `proxy`. Then `git add -A src && git diff --cached -M -- src/middleware.ts src/proxy.ts` shows a rename whose only content change is the function name. The `matcher` string is byte-identical.

- [ ] **Step 3: Fast gate**

Expected: green. `next build` runs Turbopack and prints a route table that includes a `Proxy (Middleware)` entry. It must not print a "middleware is deprecated" warning. Commit any `tsconfig.json` (for example `.next/dev/types/**/*.ts` added to `include`, `jsx` adjusted) or `next-env.d.ts` rewrite exactly as Next produced it.
**Turbopack fallback (spec §5):** if the build fails in Turbopack and you can't fix it within this task, set `"build": "next build --webpack"` and `"dev": "next dev --webpack"`, note "Turbopack fallback in use: <error>" in the verification report and the commit body, and continue.

- [ ] **Step 4: Proxy matrix**

Run against `yarn start` → `phase-5-proxy-after-7.txt` and diff with `phase-5-proxy-before.txt`. Expected: no diff.

- [ ] **Step 5: Commit**

```bash
git add -A package.json yarn.lock src next-env.d.ts tsconfig.json
git commit -F - <<'EOF'
feat!: upgrade to Next.js 16.4; middleware.ts -> proxy.ts

- next 16.4.0 via @next/codemod@16.4.0 upgrade 16.4.0
  --skip-eslint-upgrade --skip-react-upgrade
- middleware-to-proxy: src/middleware.ts -> src/proxy.ts, function renamed
  to proxy; matcher unchanged. The proxy now runs on the Node.js runtime.
- Turbopack is now the default for dev and build (no webpack config)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Proxy uses `getSessionCookie`

**Files:**
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `getSessionCookie(request: Request | Headers): string | null` from `better-auth/cookies`. It returns the `__Secure-better-auth.session_token` value, else the `better-auth.session_token` value, else `null`.
- Produces: `export default function proxy(req: NextRequest): NextResponse` and `export const config` (matcher unchanged).

- [ ] **Step 1: Rewrite `src/proxy.ts`**

```typescript
import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Optimistic gate: only checks that a Better Auth session cookie is present
// (getSessionCookie handles both the plain and the HTTPS `__Secure-` name).
// It does not validate the session. Real checks happen in the events/members
// layouts (auth.api.getSession) and in protectedProcedure. Keep this file free
// of DB, env and server imports: it runs on every matched request.
export default function proxy(req: NextRequest) {
	if (!getSessionCookie(req)) {
		return NextResponse.redirect(new URL('/login', req.url));
	}
	return NextResponse.next();
}
```
Keep the `export const config = { matcher: [...] }` block exactly as it was.

- [ ] **Step 2: Verify matcher untouched**

Run: `git diff -- src/proxy.ts | grep -n "matcher\|_next/static"`
Expected: no output (the config block is unchanged).

- [ ] **Step 3: Fast gate.** Expected: green.

- [ ] **Step 4: Proxy matrix**

Run against `yarn start` → `phase-5-proxy-after-8.txt` and diff with `phase-5-proxy-before.txt`.
Expected: the **only** difference is the `empty` row, `200` → `307 http://localhost:3000/login`. `getSessionCookie` treats an empty value as absent, which is stricter and intended (spec §2). The `secure` row must still be `200`. Any other difference is a bug.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts
git commit -F - <<'EOF'
refactor: use better-auth getSessionCookie in the proxy

The proxy runs on Node in Next 16, so the Edge-runtime reason for
hand-rolling the cookie check is gone. getSessionCookie checks the same
__Secure-/plain cookie names. Still a presence-only check (empty values
now count as absent); session validation stays in the layouts and
protectedProcedure.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Untrack `next-env.d.ts`; generate types with `next typegen`

**Files:**
- Modify: `.gitignore` (the `# next-env.d.ts is committed …` comment line under `# next.js`)
- Delete from index: `next-env.d.ts`
- Modify: `package.json` (`scripts.lint`, `scripts.typecheck`)

**Interfaces:**
- Produces: `"typecheck": "next typegen && tsc --noEmit"` and `"lint": "next typegen && eslint src --ext .js,.jsx,.ts,.tsx"`. CI (`.github/workflows/ci.yml`, unchanged) already runs both with `SKIP_ENV_VALIDATION=1`.

- [ ] **Step 1: Edit `.gitignore`**

Replace the line `# next-env.d.ts is committed — Next.js manages it, do not edit manually` with:
```
# Generated by next dev/build/typegen (yarn lint and yarn typecheck run typegen)
next-env.d.ts
```

- [ ] **Step 2: Untrack:** `git rm --cached next-env.d.ts`.

- [ ] **Step 3: Update both scripts** as in Interfaces.

- [ ] **Step 4: Fresh-checkout simulation (mirrors the CI jobs, which never build)**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && \
  rm -rf .next next-env.d.ts && SKIP_ENV_VALIDATION=1 yarn lint && \
  rm -rf .next next-env.d.ts && SKIP_ENV_VALIDATION=1 yarn typecheck && \
  git status --porcelain
```
Expected: both pass, `next-env.d.ts` exists again on disk, and `git status --porcelain` lists only `.gitignore`, `package.json`, `D  next-env.d.ts` (staged), and possibly `tsconfig.json` if typegen adjusted it (commit it too). It does not list `?? next-env.d.ts`.

- [ ] **Step 5: Fast gate.** Expected: green.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json tsconfig.json
git commit -F - <<'EOF'
chore: untrack next-env.d.ts; run next typegen before lint/typecheck

Next 16 recommends gitignoring next-env.d.ts (it now differs between dev
and build). CI's lint/typecheck jobs never build, so both scripts run
`next typegen` first to generate it and the route types.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Update `CLAUDE.md` and the master plan

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

**Interfaces:** docs only. Describe the code **as it is on this branch after the develop merge**. Read `src/server/api/trpc.ts`, `src/utils/date.ts`, `src/server/auth.ts`, `src/proxy.ts` and `src/trpc/react.tsx` before writing.

- [ ] **Step 1: `CLAUDE.md` edits**

- **Project overview:** first sentence becomes "a T3-stack app (Next.js 16 App Router + React 19 + tRPC + Prisma + Better Auth + Tailwind + shadcn/ui)."
- **Commands:**
  - `yarn dev` — start dev server (Turbopack). If the Task 7 fallback is in use, write "(webpack — Turbopack fallback, see Phase 5 PR)".
  - `yarn lint` — `next typegen` then ESLint 8 CLI on `src/` with legacy `.eslintrc.cjs` (`eslint-config-next` pinned to 15.5 until Phase 9).
  - `yarn typecheck` — `next typegen` then `tsc --noEmit`. This replaces the `npx tsc --noEmit` line.
  - `./start-database.sh` — unused locally (Postgres runs natively). Slated for removal after Phase 9.
- **tRPC layer:** client link is `httpBatchStreamLink` (not `unstable_…`). Describe the global middlewares that exist in `src/server/api/trpc.ts` now: if `dateMiddleware` is gone, remove its bullet and the "two global middlewares" count; if the timezone PR already rewrote this section, leave it. Mention `adminProcedure` (asserts `UserRole.ADMIN`).
- **Auth & authorization (replace the section):**
  - Better Auth (`src/server/auth.ts`): email + password, sign-up disabled, Prisma adapter, `admin` plugin with access control in `src/server/auth-access.ts`. Roles are the string enum `UserRole` (`src/enums/UserRole.ts`: `guest`/`member`/`admin`). Server access via `getServerAuthSession()`; client via `authClient` (`src/lib/auth-client.ts`); route handler `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler`).
  - `src/proxy.ts` (Next 16 proxy, Node runtime) redirects to `/login` when no Better Auth session cookie is present (`getSessionCookie`, presence-only, no DB). Matcher excludes `api`, `_next/static`, `_next/image`, `auth`, `login`, `reset-password`, `favicon.ico`, `images`, `sitemap.xml`, `robots.txt`, and `/`. Real checks: `events`/`members` layouts and `protectedProcedure`/`adminProcedure`.
  - `src/utils/permissions.ts` (`useIsAdmin`) — client-side admin check via `authClient.useSession()`.
- **Domain model:** `state: Int` → `EventState` (`PROPOSED=0, PENDING=1, CONFIRMED=2, CANCELED=3`). Add the `member` router (`create`/`list`/`setRole`/`delete`/`generatePasswordLink` admin-only, `setPassword` public).
- **Date/calendar utilities:** rewrite to match `src/utils/date.ts` as it is now (Phase 4 removed `moment` and `@internationalized/date`, and the timezone PR may have added `@date-fns/tz`). If the timezone PR already rewrote it, leave it.
- Change nothing else (Branching, Worktrees, gate block, Model routing).

- [ ] **Step 2: Master plan edits**

- **Tracking table:** Phase 5 row. If `gh pr list --head feat/upgrade-phase-5-react19-next16 --json number --jq '.[0].number'` prints a number `N`, use `[#N](https://github.com/SlatinskyJ/cm-drozdi/pull/N)`; otherwise use `in progress (branch feat/upgrade-phase-5-react19-next16; PR link added when opened)`.
- **Phase 5 → Step B, first bullet:** replace "`middleware.ts` conventions (confirm matcher unchanged for the timezone-offset + Better Auth gate)" with "`middleware.ts` → `proxy.ts` (Node runtime; matcher unchanged for the Better Auth cookie gate)".
- **Phase 5 → Step B, lint bullet:** replace "running `eslint` directly (e.g. `eslint .`)" with "running `eslint` directly (`next typegen && eslint src --ext .js,.jsx,.ts,.tsx` — same coverage as `next lint`; widening is Phase 9)".
- **Phase 9:** add two bullets:
  - "Widen lint scope from `src` to the whole repo (`e2e/`, `prisma/`, root config files) and fix the new hits."
  - "`eslint-config-next@16` enables the React Compiler rules from `eslint-plugin-react-hooks@7` (`set-state-in-effect`, `refs`, `purity`, `immutability`, `incompatible-library` …) — budget for app-code fixes."

- [ ] **Step 3: Check:** `git diff --stat` shows only these two files.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
git commit -F - <<'EOF'
docs: update CLAUDE.md and master plan for Phase 5

CLAUDE.md described NextAuth/Discord/Facebook, next lint and
src/middleware.ts; bring it in line with Better Auth, the Next 16 proxy,
the eslint CLI + next typegen scripts and the current tRPC/date code.
Master plan: Phase 5 tracking row, corrected Phase 5 wording, Phase 9 notes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Step B gate and final comparison

**Files:** none expected. Fixes get their own `fix:` commits with the trailer. The report goes to `docs/superpowers/task-reports/phase-5-verification.md` (gitignored, input for the PR description).

- [ ] **Step 1: Re-sync if develop moved**

Run `git fetch origin && git log --oneline HEAD..origin/develop`. If it prints commits, merge as in "Before Task 1" (same message + trailer), resolve conflicts, and re-run the fast gate.

- [ ] **Step 2: Full gate.** Expected: green, all e2e specs pass.

- [ ] **Step 3: Route table comparison**

`SKIP_ENV_VALIDATION=1 yarn build 2>&1 | tee docs/superpowers/task-reports/phase-5-build-after.log`, then `phase-5-routes.sh … > phase-5-routes-after.txt`, then `diff phase-5-routes-before.txt phase-5-routes-after.txt` (paths under `docs/superpowers/task-reports/`).
Expected: no diff. Additions or removals of framework-internal routes (for example `/_not-found`) are acceptable and must be listed in the report. Any app page or API route changing between `○` and `ƒ` is a blocker. Investigate before continuing.

- [ ] **Step 4: Proxy matrix:** against `yarn start` → `phase-5-proxy-after.txt`, diffed with `phase-5-proxy-before.txt`. Expected: only the `empty` row differs (as in Task 8).

- [ ] **Step 5: Smoke checklist** (all 8 items, with item 3 also confirming the event-calendar CSS and the Pacifico/Geist fonts render) and record the results under `## Step B smoke`.

- [ ] **Step 6: Final greps**

```bash
git grep -n "nextjs-registry" ; \
git grep -n "UnsafeUnwrapped\|@next-codemod-error\|@next-codemod-ignore" -- src ; \
git grep -n "next/headers" -- src/server/api/routers ; \
git grep -n "next lint" -- package.json CLAUDE.md ; \
test ! -e src/middleware.ts && echo "middleware gone" ; \
git ls-files next-env.d.ts
```
Expected: the only output is `middleware gone`.

- [ ] **Step 7: Finish the verification report**

Add to `phase-5-verification.md`: final resolved versions (`yarn list --pattern "next|react|react-dom|eslint-config-next" --depth=0`); route-table diff (or "identical"); proxy-matrix diff; e2e summary line from Step 2; smoke results; Turbopack fallback status; timezone-PR status. Also add a **post-push checklist** for the PR author: "Vercel preview — logged-out `/events` → `/login`; logged-in `/events` loads (HTTPS `__Secure-` cookie through the Node proxy)."

- [ ] **Step 8:** `git status --porcelain` → empty. `git log --oneline origin/develop..HEAD` lists the Phase 5 commits (Tasks 2, 3, 4, 6, 7, 8, 9, 10, plus any `fix:` and merge commits). Stop here and hand off to the orchestrator for the PR.
