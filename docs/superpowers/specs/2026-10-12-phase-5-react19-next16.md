# Phase 5 — React 19 + Next.js 14 → 15 → 16

**Branch:** `feat/upgrade-phase-5-react19-next16` (per master plan), forked from `develop` after Phase 4 (#20) merged.
**Risk:** high (framework runtime). **Size:** large in blast radius, small in diff — most of the work is verification.

## Context

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` Phase 5 upgrades the framework from Next 14.2 / React 18.3 to Next 16 / React 19, in two sub-steps in one PR: Step A (Next 15.5 + React 19) and Step B (Next 16.4). Decisions (added 2026-10-12) in the master plan set the lint approach for this phase: pin `eslint-config-next@15.5`, run `eslint` directly, and leave flat config to Phase 9.

All decisions below are final (set by the repo owner on 2026-10-12). Research was run against the Phase 4 checkout and re-verified against `develop` @ `3894f9a` (Phase 4 merged, with its review fixes).

Versions at spec time (npm, 2026-10-12): `next` latest `16.4.0`, 15.x line ends at `15.5.27` (`backport` tag); `react`/`react-dom` `19.3.0`; `@types/react`/`@types/react-dom` `19.3.0`; `@next/codemod` `16.4.0`; `eslint-config-next@15.5.27` has peer `eslint ^7.23 || ^8 || ^9` and still ships an eslintrc-compatible config. `eslint-config-next@16.x` is flat-config only, needs `eslint >=9`, and turns on the React Compiler lint rules (`eslint-plugin-react-hooks@7`).

## Baseline (develop @ 3894f9a)

| package | installed | target |
|---|---|---|
| next | ^14.2.4 | 15.5.27 (Step A) → 16.4.0 (Step B) |
| react / react-dom | ^18.3.1 | 19.3.0 |
| @types/react / @types/react-dom | ^18.3.x | 19.3.x |
| eslint-config-next | ^14.2.4 | **15.5.27, exact pin** (stays on 15.5 through Phase 9) |
| eslint | ^8.57.0 | unchanged |
| @ant-design/nextjs-registry | ^1.0.1 | **removed** (imported nowhere; its peers pin next/react) |
| better-auth, @trpc/*, @tanstack/react-query, typescript, prisma, tailwindcss, zod | — | **unchanged** (all already declare React 19 / Next 16 support; keeping them fixed isolates framework churn) |

`next.config.js` is `{}` apart from the env-validation import, so none of the Next 15/16 config renames or removals apply. Node is 22.14 locally and `22.x` in `engines` (Next 16 needs ≥20.9).

## Concurrency with the timezone fix

A separate PR (`fix/event-timezone-prague`) is in flight. It removes `dateMiddleware` from `src/server/api/trpc.ts` and switches date display to `@date-fns/tz` in `Europe/Prague`. Phase 5 must:

- Merge latest `develop` **before Task 1** (and again before the final gate if `develop` has moved).
- Not depend on `dateMiddleware` existing. Phase 5 does not edit `src/server/api/trpc.ts`, `src/utils/date.ts`, `playwright.config.ts`, or `e2e/helpers/date.ts` (the files the timezone PR owns). Any doc text written in this phase describes those files as they are after the merge.

## Decisions

### 1. Async request APIs — fixed by hand, no codemod casts

Every `headers()`/`cookies()`/`draftMode()`/`params`/`searchParams` use in the repo (re-verified with grep):

| file | today | change |
|---|---|---|
| `src/trpc/server.ts` (`createContext`) | `cache(() => new Headers(headers()))` | `cache(async () => …new Headers(await headers())…)` (matches the current create-t3-app template). On Next 15 types the old form is a TS error, and on Next 16 it breaks at runtime. |
| `src/server/api/routers/member.ts` `create`, `setRole`, `delete` | `const h = headers();` passed as Better Auth `headers` | Use `ctx.headers` (already on the tRPC context; it is the incoming request's headers including the admin's session cookie). Drop the `next/headers` import from the router. On Next 15+ the old code passes a **Promise** to Better Auth, which is a real authorization bug. |
| `src/server/auth.ts` `getServerAuthSession` | already `await headers()` | No functional change. Delete the stale `eslint-disable-next-line @typescript-eslint/await-thenable` and the "Next 14 / Phase 5" doc comment. |

No `cookies()`, `draftMode()`, `params`, `searchParams` page props, `generateSitemaps`, or image metadata routes exist. The `next-async-request-api` codemod may still run as part of `upgrade`. Anything it emits (`@next-codemod-error` comments, `UnsafeUnwrapped*` casts) is replaced by the hand fixes above, and `git grep` must find none at the end of Step A.

`createTRPCContext` keeps calling `getServerAuthSession()` (it works on 15/16 in route handlers and RSC). Switching it to `opts.headers` is optional cleanup and out of scope.

### 2. Middleware → proxy (Step B)

- `src/middleware.ts` → `src/proxy.ts` (Next 16 convention). The proxy always runs on the **Node.js runtime**, which cannot be configured. The `middleware` convention is deprecated in 16 and would keep running on Edge.
- `export default function proxy(req: NextRequest)`.
- Use `getSessionCookie(req)` from `better-auth/cookies`. The old reason for avoiding it (jose needs `CompressionStream`, which Edge lacks) no longer applies on Node. `getSessionCookie` checks `__Secure-better-auth.session_token` first and falls back to `better-auth.session_token`, the same dual check the file hand-rolls today (verified in `better-auth/dist/cookies/index.mjs`). One minor difference: a cookie with an *empty* value now counts as absent, which is stricter and harmless.
- **Presence check only. No DB lookup in the proxy.** Real validation stays in `events/layout.tsx`, `members/layout.tsx`, and `protectedProcedure`. A DB check would add a Prisma round-trip to every matched request.
- Do not import `~/env` or `~/server/*` into the proxy.
- The matcher is carried over **byte-identical**:
  `'/((?!api|_next/static|_next/image|auth|login|reset-password|favicon.ico|images|sitemap.xml|robots.txt|$).*)'`
- The master plan's mention of a "timezone-offset" in the middleware is wrong. The timezone logic was tRPC's `dateMiddleware`, which has nothing to do with Next middleware. The master plan text is corrected in this phase.

### 3. Lint stays legacy in Phase 5

- `eslint@8.57` + `.eslintrc.cjs` stay. `eslint-config-next` is pinned to exactly `15.5.27`. Its `eslint-plugin-react-hooks@^5` adds no React Compiler rules.
- `next lint` (deprecated in 15.5, removed in 16) is replaced by the ESLint CLI.
- **Coverage choice (recorded): `eslint src --ext .js,.jsx,.ts,.tsx`.** This lints the same set as `next lint`, whose default dirs are `app`, `pages`, `components`, `lib`, `src`, and only `src` exists here. The alternative, `eslint .`, would pull `e2e/`, `prisma/seed.ts`, and root config files into a type-checked ruleset for the first time and require fixing unrelated hits in a framework PR. Widening to the whole repo is moved to Phase 9.
- Every `@next/codemod upgrade` run passes `--skip-eslint-upgrade`, so the codemod neither installs ESLint 9 nor generates a FlatCompat `eslint.config.mjs`.
- The CI `lint` job keeps calling `yarn lint`, so the workflow needs no change.

### 4. `next-env.d.ts` untracked + `next typegen`

Next 16 docs say to gitignore `next-env.d.ts` and untrack it if it is tracked. Next 16 also writes different route-type references for dev and build, which would churn the file. Untracking it creates one problem: the CI `lint` and `typecheck` jobs run on a fresh checkout with no build, so without the file, static image imports (`src/app/page.tsx` imports `.jpg`/`.svg`) stop type-checking. Fix: prefix both scripts with `next typegen`, which generates `next-env.d.ts` plus route types without building:

- `"typecheck": "next typegen && tsc --noEmit"`
- `"lint": "next typegen && eslint src --ext .js,.jsx,.ts,.tsx"`

`next typegen` loads `next.config.js`, which imports `src/env.js`. CI already runs both jobs with `SKIP_ENV_VALIDATION=1`, and locally `.env` exists, so nothing else changes. Any `tsconfig.json` edits Next applies automatically on first 16.x run (for example adding `.next/dev/types/**/*.ts` to `include`, or adjusting `jsx`) are accepted and committed as-is.

### 5. Turbopack — accept the Next 16 default for dev and build

There is no custom webpack config, so `next build` will not refuse to run under Turbopack. Tailwind 3 runs through `postcss.config.cjs`, which Turbopack reads natively. `next/font/google` (Pacifico) and `geist/font` are supported. Any `--turbopack` flag the Step A codemod adds to `dev` is removed, so Step A changes the framework version only and Turbopack arrives with Step B as the default. **Fallback:** if the Turbopack production build fails or renders CSS incorrectly and the cause can't be fixed in this phase, add `--webpack` to `build` (and `dev`), record it in the PR description as a known deviation, and open a follow-up issue. Do not silently ship broken styling.

### 6. Caching — no changes needed

There are no `fetch()` calls, no `revalidate`/`dynamic`/`unstable_cache`/`'use cache'`/`revalidateTag` usage, and both GET route handlers read the request. The root layout reads `headers()` through `getServerAuthSession`, so every page is already dynamic. The Next 15 client router cache default (`staleTimes.dynamic` 30s → 0) is accepted. It means `<Link>` navigation always refetches RSC data, which only helps after `router.refresh()` mutations. `experimental.staleTimes`, `cacheComponents`, and `reactCompiler` stay off.

### 7. React 19 code

- `forwardRef` (shadcn primitives) still works in React 19.3. Leave it; Phase 6 regenerates the shadcn components.
- `React.ElementRef` is deprecated in `@types/react@19` but still compiles. Leave it (also obsoleted by Phase 6). If a React 19 codemod rewrites it to `React.ComponentRef` mechanically, keep that edit.
- None of these are used: `useFormState`, server actions, string refs, `propTypes`/`defaultProps`, global `JSX`, `ReactDOM.render`, or `useRef()` without an argument.
- Every UI peer (Radix, react-day-picker, react-hook-form, react-hot-toast, lucide-react, react-icons, geist, @vercel/speed-insights 1.x, React Query, tRPC, better-auth) already allows React 19.

### 8. Commit structure

Two Steps in one PR, as the master plan prescribes. Each task is its own commit so the history bisects cleanly, and each commit builds.

- **Step A:** remove `@ant-design/nextjs-registry`; `member.ts` → `ctx.headers` (works on Next 14); Next 15.5 + React 19 + `@types/react*` 19 + `eslint-config-next@15.5.27` + `trpc/server.ts` await + `auth.ts` comment cleanup; then the Step A gate.
- **Step B:** lint script → ESLint CLI; Next 16.4 (codemod, `middleware.ts` → `proxy.ts` rename); proxy uses `getSessionCookie`; untrack `next-env.d.ts` + `next typegen`; `CLAUDE.md` + master plan; then the Step B gate.

All commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Verification & exit criteria

Gate (Node 22: every command prefixed with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" &&`; native Postgres on `localhost:5432`):

```bash
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
yarn e2e
```

- **Per task:** gate without `yarn e2e`. **End of each Step:** full gate including `yarn e2e`, plus a Playwright-MCP smoke test.
- **Route table:** capture the Next 14 `yarn build` route table **before any change** (Task 1) and compare it after Step B. Compare only route + ○/ƒ marker. Next 16 drops the size columns, and Next 14 may print `λ`, which is normalized to `ƒ`. Expected: no change. Any page flipping between static and dynamic is a blocker to explain or fix.
- **Proxy matrix:** a curl characterization script records status + redirect target against `yarn start` for the matched/excluded paths and both cookie names (plain and `__Secure-`). It is captured on Next 14 in Task 1 and must be identical after Step B. This is the only local coverage of the `__Secure-` (HTTPS/Vercel) cookie path.
- **Fresh-checkout simulation:** after untracking `next-env.d.ts`, `rm -rf .next next-env.d.ts` then `yarn lint` + `yarn typecheck` must pass, mirroring the CI jobs.
- **Smoke (Playwright MCP, after each Step):** login/logout; unauthenticated `/events` → `/login`; `/events` calendar + cards + detail dialog; create/edit/state-change/delete an event; `/members` create/setRole/delete (exercises the `ctx.headers` fix); styles applied (Tailwind palette, `EventCalendar.css`, fonts); no hydration or React errors in the console.
- `git grep -n "UnsafeUnwrapped\|@next-codemod-error\|@next-codemod-ignore\|next/headers" src/server/api/routers` → empty. `git grep -n "nextjs-registry"` → empty.
- **Post-push (PR author, not the implementer):** on the Vercel preview, an unauthenticated `/events` redirects to `/login`, and a logged-in `/events` loads. This covers the HTTPS `__Secure-` cookie under the Node proxy.

## Docs updated in this phase

- `CLAUDE.md`: overview (Next 16 / React 19 / Better Auth / shadcn), `yarn lint` / `yarn typecheck` lines, `start-database.sh` marked unused locally, the Auth & authorization section rewritten for Better Auth + `src/proxy.ts`, the tRPC client link name, and the date-utilities paragraph brought in line with the merged code.
- Master plan: Phase 5 row in Tracking; Phase 5 text (`eslint src` instead of `eslint .`, "timezone-offset" removed); Phase 9 gains "widen lint scope to the whole repo" and "React Compiler lint rules arrive with eslint-config-next 16".

## Non-goals

- ESLint 9/10, flat config, `eslint-config-next@16`, React Compiler lint cleanup (Phase 9).
- Tailwind 4 / shadcn regeneration / `forwardRef` → ref-as-prop (Phase 6).
- Bumping better-auth (1.7.x), tRPC, React Query, TypeScript, Prisma, zod.
- `next.config.js` → `next.config.ts`, `reactCompiler`, `cacheComponents`, `staleTimes`.
- Moving `createTRPCContext` off `next/headers`.
- Any change to date/timezone handling (owned by `fix/event-timezone-prague`).
