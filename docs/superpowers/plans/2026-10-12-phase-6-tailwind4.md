# Phase 6 — Tailwind CSS 3 → 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Tailwind CSS 3 → 4 (CSS-first config, `@tailwindcss/postcss`, shadcn TW4 conventions, `tw-animate-css`) with every screen rendering identically to the pre-upgrade build.

**Architecture:** Capture a deterministic Playwright screenshot baseline of the pre-upgrade build first. Then: delete dead `resolveConfig` code → run the official codemod (class renames, deps, PostCSS) → replace `globals.css` with a hand-written CSS-first theme that mirrors exactly how `tailwind.config.ts` resolves today → add v3-compat shims (preflight + `space-*`) → re-capture and explain or fix every pixel difference → full gate → docs.

**Tech Stack:** Next.js 16 (Turbopack) + React 19 (from Phase 5), Tailwind CSS 4.x, `@tailwindcss/postcss`, `tw-animate-css`, shadcn/ui (new-york), `tailwind-merge` 3, Playwright, Yarn 1, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-12-phase-6-tailwind4.md` — read it first; decisions D1–D8 are referenced below.

## Global Constraints

- Worktree: `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/chore--upgrade-phase-6-tailwind4`, branch `chore/upgrade-phase-6-tailwind4`. Run every command from the worktree root (prefix `cd /Users/jakubslatinsky/Dev/cm-drozdi-worktrees/chore--upgrade-phase-6-tailwind4 &&` if your shell resets). Never touch `main`. Do not push or open a PR — the orchestrator does that (draft PR into `develop`).
- Every Node/Yarn/npx command needs Node 22: prefix it with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" &&` (spelled out in every command below).
- Postgres runs natively on `localhost:5432` (`DATABASE_URL` in `.env`). Do not use `start-database.sh`/Docker.
- Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit with `git commit -F - <<'EOF' … EOF`.
- **No visual change.** Colors, spacing, radii, shadows, fonts must render as before. The only accepted differences are those listed in the spec (dialog open-animation nudge, touch `hover:` gating, color-mix rounding ≤ 2/255, anti-aliasing-only pixels).
- Do not bump `next`, `react`, `prisma`, `zod`, `eslint`, `better-auth`, `tailwind-merge`. Do not run `prettier --write`. Do not run `shadcn add`.
- Fast gate between tasks: `yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build` (all with the PATH prefix). `yarn e2e` runs only in Task 7.
- The lint script is whatever `package.json` says after Phase 5 (expected `eslint …`, not `next lint`). Do not change it.
- Port 3000 must be free before any visual run (`lsof -ti tcp:3000` prints nothing); stop any `yarn dev`/`yarn start` you started.
- All visual-harness files and artifacts live in `docs/superpowers/task-reports/phase-6/` (gitignored — confirm with `git check-ignore -v docs/superpowers/task-reports/phase-6/x`). They are never committed.

## Review Focus

- **`space-*` selector change on inline / flex-row children** — `EventForm` label↔input gaps and the Event-card / event-detail headers must not move. Covered by Task 5 (mechanical rewrite to `v3-space:`) and shots `13`, `15`, `07`, `11`.
- **v4 preflight on form controls** — raw `<input>`s and the members role `<select>` must keep a white field background and gray-400 placeholders. Covered by Task 5 shims and shots `03`, `05`, `18`.
- **Codemod false positives on non-class strings** — `placeholder="blur"` (next/image) and `variant="outline"` must survive. Covered by Task 3 Step 6 greps and shot `01` (hero image renders, no broken placeholder).
- **Default-palette OKLCH re-tune** — `text-red-500`, `text-stone-400`, `border-gray-500/30` must keep v3 hex. Covered by Task 4 pins + grep, shots `04`, `01`.
- **Unlayered CSS now beats utilities** (native cascade layers): `next/font` classes, `EventCalendar.css`, toast styles. Covered by full-page shots of every screen (fonts on `01`/`07`, toasts on `20`/`22`).

---

### Task 1: Sync with `develop`, confirm Phase 5, record the base

**Files:** none edited (merge only).

**Interfaces:**
- Consumes: nothing.
- Produces, all in `docs/superpowers/task-reports/phase-6/`: `BASE_SHA` (pre-upgrade commit, used by Tasks 4 and 6), `POSTCSS_FILE` (PostCSS config file name), `class-counts-before.txt` (used by Task 3).

- [ ] **Step 1: Merge latest develop**

```bash
git fetch origin && git merge origin/develop -m "chore: merge origin/develop into chore/upgrade-phase-6-tailwind4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: `Already up to date.`, a fast-forward, or a clean merge commit with that message. On conflicts, resolve keeping `develop`'s code and commit with the same message + trailer.

- [ ] **Step 2: Verify Phase 5 is merged**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && node -p "const p=require('./package.json'); [p.dependencies.next, p.dependencies.react, p.scripts.lint].join(' | ')"
```
Expected: next starts with `^16`, react with `^19`. **If not, STOP** and report "Phase 5 not merged into develop" — do not continue.

- [ ] **Step 3: Record environment facts**

```bash
mkdir -p docs/superpowers/task-reports/phase-6 && git rev-parse HEAD > docs/superpowers/task-reports/phase-6/BASE_SHA && ls postcss.config.* > docs/superpowers/task-reports/phase-6/POSTCSS_FILE && cat docs/superpowers/task-reports/phase-6/*
```
Expected: a SHA and exactly one file name (e.g. `postcss.config.cjs` or `.mjs`). Then record the pre-upgrade counts of the utilities the codemod renames (the same command is re-run in Task 3; the character classes make `rounded` not match `rounded-md`, `shadow` not match `shadow-lg`):

```bash
for c in outline-none outline-hidden shadow-sm shadow-xs shadow rounded-sm rounded-xs rounded backdrop-blur-sm backdrop-blur-xs; do printf '%s %s\n' "$c" "$(grep -rhoE "(^|[^a-z0-9/-])$c([^a-z0-9/-]|$)" src --include='*.tsx' | wc -l | tr -d ' ')"; done | tee docs/superpowers/task-reports/phase-6/class-counts-before.txt
```
Expected at `3894f9a`-equivalent code (Phase 5 may shift a few): `outline-none 12`, `shadow-sm 4`, `shadow-xs 1` (calendar.tsx, already v4-style), `shadow 1`, `rounded-sm 5`, `rounded 10`, `backdrop-blur-sm 1`, the rest `0`. Also check `tailwind.config.ts`, `src/styles/globals.css`, `components.json`, `src/utils/colors.ts` still match the spec's "Current state" (Phase 5 should not have touched them); note any deviation in `docs/superpowers/task-reports/phase-6/NOTES.md` and adapt the later tasks accordingly.

- [ ] **Step 4: Gate on the base**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn install --frozen-lockfile && npx prisma generate && yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build
```
Expected: all pass. If the base is red, STOP and report — Phase 6 must start green.

---

### Task 2: Visual regression harness + baseline

No commit — everything is gitignored.

**Files:**
- Create: `docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs`
- Create: `docs/superpowers/task-reports/phase-6/visual/visual.spec.mjs`
- Generated: `…/visual/baseline/{desktop,mobile}/*.png`

**Interfaces:**
- Consumes: `e2e/global-setup.ts` (migrate + seed + writes `e2e/.auth/admin.json` / `member.json`), `.env`.
- Produces: the visual-run command used by Task 6:
  `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npx playwright test --config docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs`
  and baseline PNGs named `01-…` to `22-…` (table below).

- [ ] **Step 1: Write the config**

```js
// docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
loadEnv({ path: path.join(repoRoot, '.env') });

export default defineConfig({
	testDir: here,
	testMatch: 'visual.spec.mjs',
	outputDir: path.join(here, 'results'),
	snapshotPathTemplate: '{testDir}/baseline/{projectName}/{arg}{ext}',
	globalSetup: path.join(repoRoot, 'e2e/global-setup.ts'),
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list'], ['html', { outputFolder: path.join(here, 'report'), open: 'never' }]],
	expect: {
		toHaveScreenshot: { threshold: 0, maxDiffPixels: 0, animations: 'disabled', caret: 'hide', scale: 'device' },
	},
	use: { baseURL: 'http://localhost:3000', timezoneId: 'Europe/Prague' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
		{
			name: 'mobile',
			use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
		},
	],
	webServer: {
		command: 'yarn start',
		cwd: repoRoot,
		env: { TZ: 'Europe/Prague' },
		url: 'http://localhost:3000',
		reuseExistingServer: false,
	},
});
```

- [ ] **Step 2: Write the spec's shared setup**

In `visual.spec.mjs` (plain ESM JS; `@prisma/client`, `date-fns`, `@playwright/test` resolve from the repo's `node_modules`):

- `test.describe.configure({ mode: 'serial' })`.
- Constants: `FIXED_NOW = new Date('2027-02-01T09:00:00+01:00')`; `ADMIN = path.resolve('e2e/.auth/admin.json')`, `MEMBER = path.resolve('e2e/.auth/member.json')` (cwd is the repo root).
- `test.beforeAll`: with a `new PrismaClient()`, `usersOnEvents.deleteMany()`, `instrumentsOnUsers.deleteMany()`, `event.deleteMany()`, then create exactly these events (all `email: 'visual@example.com'`, `phone: '+420 777 123 456'`, `location: 'Brno'`, `description: 'Vizuální test'` unless noted), then `$disconnect()`:

| name | state | start | end | isPrivate |
|---|---|---|---|---|
| `Svatba Novákovi` | 0 | `2027-02-05T15:00:00+01:00` | `2027-02-05T20:00:00+01:00` | false |
| `Hody v Křenovicích s velmi dlouhým názvem události` | 1 | `2027-02-12T18:00:00+01:00` | `2027-02-12T23:00:00+01:00` | false |
| `Firemní večírek` | 2 | `2027-02-20T19:00:00+01:00` | `2027-02-20T22:30:00+01:00` | true |
| `Ples` | 3 | `2027-02-26T20:00:00+01:00` | `2027-02-27T02:00:00+01:00` | false |
| `Neznámý stav` | 7 | `null` | `null` | false (no location/description) |

- `test.beforeEach(async ({ page }) => page.clock.setFixedTime(FIXED_NOW))`.
- `async function snap(page, name, { hoverTarget } = {})`: `await page.waitForLoadState('networkidle')`; await `document.fonts.ready` and every `img.decode()` via `page.evaluate`; then `hoverTarget ? await hoverTarget.hover() : await page.mouse.move(0, 0)`; then `await expect(page).toHaveScreenshot(name + '.png', { fullPage: true })`.
- Day-button names: `format(new Date(y, m - 1, d), 'PPPP', { locale: cs })` from `date-fns` / `date-fns/locale` (same as `e2e/helpers/date.ts`).

- [ ] **Step 3: Write the 22 tests**

One `test()` per row, in this order (row 22 mutates data, so it is last). Group by auth with `test.describe` + `test.use({ storageState })`; "public" = `storageState: { cookies: [], origins: [] }`. Before `snap`, wait for the "ready" condition.

| # / shot name | auth | steps | ready when |
|---|---|---|---|
| `01-home-public` | public | `goto('/')` | `[data-slot="calendar"]` visible and text `/únor 2027/i` visible |
| `02-home-admin` | admin | `goto('/')` | as 01 + button `Menu` visible |
| `03-login` | public | `goto('/login')` | button `Přihlásit` visible |
| `04-login-error` | public | fill placeholder `E-mail` = `admin@cmdrozdi.cz`, `Heslo` = `wrongpassword`, click `Přihlásit` | text `Přihlášení selhalo` visible |
| `05-reset-password` | public | `goto('/reset-password?token=visual-test')` | heading `Nastavit heslo` visible |
| `06-data-deletion` | public | `goto('/data-deletion')` | `networkidle` |
| `07-events` | admin | `goto('/events')` | 5 cards: `getByRole('button').filter({ hasText: 'Ples' })` visible |
| `08-events-card-focus` | admin | on `/events`, press `Tab` (max 30×) until the `Svatba Novákovi` card is `document.activeElement` | that card focused |
| `09-events-tooltip` | admin | **desktop only** (`test.skip(testInfo.project.name === 'mobile')`); `snap(page, name, { hoverTarget: page.getByText('Hody v Křenovicích', { exact: false }).first() })` | `getByRole('tooltip')` visible (wait for it after hovering, before the screenshot — hover inside `snap` is idempotent) |
| `10-menu-open` | admin | on `/events` click button `Menu` | `getByRole('menu')` visible |
| `11-event-detail` | admin | on `/events` click the `Svatba Novákovi` card | `getByRole('dialog', { name: 'Svatba Novákovi' })` visible |
| `12-event-state-menu` | admin | as 11, then in the dialog click button `/Návrh/` | `getByRole('menu')` visible |
| `13-event-edit` | admin | as 11, click `Editovat` | label `Název události` visible |
| `14-event-edit-date-popover` | admin | as 13, click button `/^Datum a čas/` | `getByRole('dialog', { name: 'Výběr data a času' })` visible |
| `15-request-form` | public | `goto('/')`, click `Rezervovat` | `getByRole('dialog', { name: 'Nová rezervace' })` visible |
| `16-request-date-popover` | public | as 15, click `/^Datum a čas/` | date picker dialog visible |
| `17-request-start-error` | public | as 16, click the day button for 2027-02-01, fill picker label `Čas` = `08:00`, press `Escape` once to close only the popover | text `Začátek nesmí být v minulosti` visible |
| `18-members` | admin | `goto('/members')` | text `member@cmdrozdi.cz` visible |
| `19-members-delete-confirm` | admin | in row `getByRole('row').filter({ hasText: 'member@cmdrozdi.cz' })` click `Smazat` | `getByRole('dialog', { name: 'Smazat člena' })` visible (do **not** confirm) |
| `20-members-error-toast` | admin | fill placeholder `Jméno` = `Duplicitní člen`, `E-mail` = `member@cmdrozdi.cz`, click `Vytvořit` | `getByRole('status')` visible; `snap(…, { hoverTarget: page.getByRole('status') })` (hover pauses the toast timer) |
| `21-members-forbidden` | member | `goto('/members')` | AccessForbidden page text visible (`networkidle`) |
| `22-event-state-toast` | admin | as 12, click `getByRole('menuitem', { name: 'Potvrzeno' })` | text `Stav změněn` visible; `snap(…, { hoverTarget: page.getByText('Stav změněn') })` |

If a locator above does not match the post-Phase-5 markup, adjust the locator (not the app) and note it in `NOTES.md`. If step 17's error only appears after blur/submit, trigger it the way the form validates (e.g. click the dialog title) — the requirement is "the start-field error message is visible".

- [ ] **Step 4: Confirm the harness is invisible to lint/typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn lint && yarn typecheck && git status --short
```
Expected: both pass; `git status` shows nothing under `docs/superpowers/task-reports/`. If lint or typecheck reports a harness file, STOP and report (do not edit lint/ts config).

- [ ] **Step 5: Build the pre-upgrade app and capture the baseline**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && SKIP_ENV_VALIDATION=1 yarn build && npx playwright test --config docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs --update-snapshots
```
Expected: `43 passed` (22 × 2 projects minus the skipped mobile tooltip; 1 skipped) and 43 PNGs under `visual/baseline/`.

- [ ] **Step 6: Prove determinism**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npx playwright test --config docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs
```
Expected: `43 passed`, zero screenshot failures, on the unchanged build. If anything differs, fix the harness (extra waits, a `mask` for genuinely dynamic content — record any mask in `NOTES.md`) and redo Step 5–6 until two consecutive runs are identical. Do not start Task 3 before this is green.

- [ ] **Step 7: Open the baseline and sanity-check it**

Look at `visual/report/index.html` (or the PNGs) and the shots at a glance: calendar shows February 2027 with events, badges in 5 colors, dialogs open, toasts visible. Optionally confirm one screen live with the Playwright MCP tools (`browser_navigate` to `http://localhost:3000` while `yarn start` runs).

---

### Task 3: Remove dead `resolveConfig` code, run the codemod

**Files:**
- Delete: `src/utils/colors.ts`
- Modify (by codemod): `package.json`, `yarn.lock`, `$(cat docs/superpowers/task-reports/phase-6/POSTCSS_FILE)`, `src/styles/globals.css`, `tailwind.config.ts` (likely deleted), class strings in `src/**/*.tsx`

**Interfaces:**
- Consumes: clean tree from Task 1–2.
- Produces: Tailwind 4 installed (`tailwindcss`, `@tailwindcss/postcss` in devDependencies); v4 class names in `src/`; `docs/superpowers/task-reports/phase-6/codemod-globals.css` (codemod's CSS, cross-check input for Task 4).

- [ ] **Step 1: Delete `src/utils/colors.ts`**

```bash
grep -rn "utils/colors" src e2e || echo "no importers"
```
Expected: `no importers`. Then `git rm src/utils/colors.ts`, run the fast gate (PATH prefix) — expected pass — and commit:

```
chore: remove unused resolveConfig-based colors helper

src/utils/colors.ts had no importers and depends on tailwindcss/resolveConfig,
which Tailwind 4 removes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- [ ] **Step 2: Run the codemod on the clean tree**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && git status --short && npm view @tailwindcss/upgrade version && npx @tailwindcss/upgrade@latest
```
Expected: empty `git status`; version starts with `4.`; the tool finishes with a migration summary. Never pass `--force`. Record the tool version in `NOTES.md`.

- [ ] **Step 3: Keep only in-scope changes**

```bash
git status --short && git diff --stat
```
Revert every changed path outside this allowlist with `git checkout -- <path>` (and delete untracked files outside it): `src/`, `package.json`, `yarn.lock`, the PostCSS config, `tailwind.config.ts`. Expected reverts: Markdown under `docs/`, `.agents/`, `CLAUDE.md`, `README.md` if touched. If `package-lock.json` appeared: `rm package-lock.json`, then `yarn install` so `yarn.lock` reflects the new deps.

- [ ] **Step 4: Save the codemod CSS and check deps/PostCSS**

```bash
cp src/styles/globals.css docs/superpowers/task-reports/phase-6/codemod-globals.css && export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && node -p "const p=require('./package.json'); JSON.stringify({tw: p.devDependencies.tailwindcss ?? p.dependencies.tailwindcss, pc: p.devDependencies['@tailwindcss/postcss'] ?? p.dependencies['@tailwindcss/postcss']})" && cat $(cat docs/superpowers/task-reports/phase-6/POSTCSS_FILE)
```
Expected: both `^4.x`. If either landed in `dependencies`, move it to `devDependencies` (`yarn remove X && yarn add -D X@^4…`). The PostCSS config must contain only `'@tailwindcss/postcss': {}` as plugin, in the file Phase 5 left (keep its name and module format); fix by hand if not.

- [ ] **Step 5: Verify the renames landed**

Re-run the Task 1 counting loop, writing to `class-counts-after.txt` instead of `-before.txt`. Using `before`/`after` from the two files, all of these must hold (spec D7):

| check | meaning |
|---|---|
| after `outline-none` = 0 and after `outline-hidden` = before `outline-none` + before `outline-hidden` | `outline-none` → `outline-hidden` |
| after `shadow-xs` = before `shadow-sm` + before `shadow-xs` | `shadow-sm` → `shadow-xs` |
| after `shadow` = 0 and after `shadow-sm` = before `shadow` | `shadow` → `shadow-sm` |
| after `rounded-xs` = before `rounded-sm` + before `rounded-xs` | `rounded-sm` → `rounded-xs` |
| after `rounded` = 0 and after `rounded-sm` = before `rounded` | `rounded` → `rounded-sm` |
| after `backdrop-blur-sm` = 0 and after `backdrop-blur-xs` = before `backdrop-blur-sm` + before `backdrop-blur-xs` | `backdrop-blur-sm` → `backdrop-blur-xs` |

Then:
```bash
grep -rnE --include='*.tsx' -e "-\[--|bg-gradient-to-|flex-grow|flex-shrink|overflow-ellipsis" src; grep -rn 'placeholder="blur"' src/app/page.tsx
```
Expected: first grep prints nothing (`[--cell-size:2rem]` is a valid arbitrary *property* and is not matched; `h-[--cell-size]`, `origin-[--radix-…]` must now read `h-(--cell-size)`, `origin-(--radix-…)`); second grep prints the unchanged next/image prop. Fix any mismatch by hand per spec D7.

- [ ] **Step 6: Review every changed line for false positives**

```bash
git diff -U0 -- src | grep -E '^[-+][^-+]'
```
Check each hunk against spec D7. Must be unchanged: `placeholder="blur"` in `src/app/page.tsx`, `variant="outline"` in `EventForm.tsx`, the `outline:` key in `button.tsx`'s cva, `Menu.tsx`'s `bg-opacity-60 hover:bg-opacity-100` (revert the hunk if the codemod rewrote it — spec D7 "Menu quirk"), all non-className strings. Revert any misfire.

- [ ] **Step 7: Ring sanity check**

```bash
grep -rnoE "[a-z:-]*ring-[0-9]+[^ '\"]*" src --include='*.tsx'
```
Expected: every `ring-N` usage sits in a class string that also has a `ring-<color>` (`ring-ring`, `ring-ring/50`) or is `ring-0`. Do not change any ring class here; if one lacks a color, write it into `NOTES.md` so Task 6 checks that element (v3's default ring color was `rgb(59 130 246 / 0.5)`, v4's is `currentColor`).

- [ ] **Step 8: Fast gate and commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn install && yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build
```
Expected: pass. If the build fails only because of the codemod's CSS (e.g. an `@config`/`@plugin 'tailwindcss-animate'` problem), do Task 4 Steps 1–4 now and make a single combined commit at the end of Task 4 instead. Otherwise commit (`git add -A src package.json yarn.lock postcss.config.* tailwind.config.ts`):

```
chore: run @tailwindcss/upgrade codemod (Tailwind 3 -> 4)

Bumps tailwindcss to 4.x, swaps the PostCSS plugin for @tailwindcss/postcss
and renames v3 utilities (outline-none, shadow-sm, rounded, backdrop-blur-sm,
[--var] arbitrary values). Non-class strings reviewed and left intact.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 4: CSS-first theme (shadcn TW4 layout), `tw-animate-css`, `components.json`, Prettier

**Files:**
- Replace: `src/styles/globals.css`
- Delete: `tailwind.config.ts` (if the codemod kept it)
- Modify: `package.json`, `yarn.lock` (remove `tailwindcss-animate`, add `tw-animate-css`), `components.json`, `prettier.config.js`

**Interfaces:**
- Consumes: Task 3's v4 install.
- Produces: the theme tokens every utility relies on (names unchanged from v3: `primary`, `primary-foreground`, `secondary`, `accent`, `accent-foreground`, `dark`, `background`, `foreground`, `white`, `danger`, `danger-foreground`, `success`, `warning`, `unknown`, `content1/3/4`, `border`, `input`, `ring`, `card(-foreground)`, `popover(-foreground)`, `muted(-foreground)`, `default-50…900`, `green/orange/yellow/blue-50…950`, `font-sans`, breakpoint `sm`). Task 5 appends to this file.

- [ ] **Step 1: Swap the animation package**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn remove tailwindcss-animate && yarn add -D tw-animate-css@^1.4.0
```
Expected: `tailwindcss-animate` gone from `package.json`; `tw-animate-css` in devDependencies.

- [ ] **Step 2: Write `src/styles/globals.css`**

Replace the whole file with (exact values — spec D3; tabs for indentation):

```css
@import 'tailwindcss' source(none);
@import 'tw-animate-css';

/* Scan exactly what Tailwind 3's `content` scanned: every .tsx file under src/. */
@source '../**/*.tsx';

/* Brand palette — hex values copied verbatim from the former tailwind.config.ts. */
@theme {
	--breakpoint-sm: 460px;

	--color-primary: #9c7243;
	--color-secondary: #bdd086;
	--color-accent: #85a042;
	--color-dark: #5a3d2d;
	--color-background: #e6dfc4;
	--color-white: #faf8e8;
	--color-danger: #ed5122;
	--color-danger-foreground: #422506;
	--color-success: #687f31;
	--color-warning: #fade15;
	--color-unknown: #7152ff;
	--color-content1: #faf8e8;
	--color-content3: #dcd2ab;
	--color-content4: #c9b880;

	--color-default-50: #faf8e8;
	--color-default-100: #e6dfc4;
	--color-default-200: #dcd2ab;
	--color-default-300: #c9b880;
	--color-default-400: #bda262;
	--color-default-500: #b18c4f;
	--color-default-600: #9c7243;
	--color-default-700: #825a3b;
	--color-default-800: #6c4934;
	--color-default-900: #5a3d2d;

	--color-green-50: #f6f8ed;
	--color-green-100: #ebf0d7;
	--color-green-200: #d7e3b3;
	--color-green-300: #bdd086;
	--color-green-400: #acc270;
	--color-green-500: #85a042;
	--color-green-600: #687f31;
	--color-green-700: #4f6229;
	--color-green-800: #424f25;
	--color-green-900: #394423;
	--color-green-950: #1c240f;

	--color-orange-50: #fef4ee;
	--color-orange-100: #fde6d7;
	--color-orange-200: #facaae;
	--color-orange-300: #f6a67e;
	--color-orange-400: #f17546;
	--color-orange-500: #ed5122;
	--color-orange-600: #de3918;
	--color-orange-700: #b82816;
	--color-orange-800: #932219;
	--color-orange-900: #761f18;
	--color-orange-950: #400c0a;

	--color-yellow-50: #fefee8;
	--color-yellow-100: #fefec3;
	--color-yellow-200: #fef98a;
	--color-yellow-300: #fdef4e;
	--color-yellow-400: #fade15;
	--color-yellow-500: #eac508;
	--color-yellow-600: #ca9a04;
	--color-yellow-700: #a16e07;
	--color-yellow-800: #85560e;
	--color-yellow-900: #714712;
	--color-yellow-950: #422506;

	--color-blue-50: #f2f2ff;
	--color-blue-100: #e9e8ff;
	--color-blue-200: #d6d3ff;
	--color-blue-300: #b7b0ff;
	--color-blue-400: #9483ff;
	--color-blue-500: #7152ff;
	--color-blue-600: #602ef9;
	--color-blue-700: #511ce5;
	--color-blue-800: #4a19d2;
	--color-blue-900: #39159d;
	--color-blue-950: #200a6b;

	/* Tailwind 3 values of the default-palette shades used in src/ (v4 re-tuned them in OKLCH). */
	--color-gray-500: #6b7280;
	--color-stone-400: #a8a29e;
	--color-red-500: #ef4444;
}

/* shadcn CSS variables (Tailwind 4 layout: top-level :root, hsl() in the value). */
:root {
	--background: hsl(48 40% 84%);
	--foreground: hsl(21 33% 26%);
	--card: hsl(48 40% 84%);
	--card-foreground: hsl(21 33% 26%);
	--popover: hsl(48 40% 84%);
	--popover-foreground: hsl(21 33% 26%);
	--primary: hsl(32 40% 44%);
	--primary-foreground: hsl(0 0% 100%);
	--secondary: hsl(75 44% 67%);
	--secondary-foreground: hsl(21 33% 26%);
	--muted: hsl(38 30% 78%);
	--muted-foreground: hsl(21 25% 40%);
	--accent: hsl(77 42% 44%);
	--accent-foreground: hsl(0 0% 100%);
	--destructive: hsl(14 85% 53%);
	--destructive-foreground: hsl(0 0% 100%);
	/* Event-state colors with no shadcn slot (see formatEventState.ts). */
	--success: hsl(78 44% 35%);
	--warning: hsl(53 96% 53%);
	--unknown: hsl(251 100% 66%);
	--border: hsl(38 27% 70%);
	--input: hsl(38 27% 70%);
	--ring: hsl(32 40% 44%);
	--radius: 0.5rem;
}

/* Only the keys tailwind.config.ts mapped to CSS variables (spec D3). */
@theme inline {
	--color-foreground: var(--foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-primary-foreground: var(--primary-foreground);
	--color-accent-foreground: var(--accent-foreground);

	--font-sans:
		var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
		'Segoe UI Symbol', 'Noto Color Emoji';
}
```

- [ ] **Step 3: Cross-check against the codemod and the old config**

```bash
git show $(cat docs/superpowers/task-reports/phase-6/BASE_SHA):tailwind.config.ts | grep -oiE '#[0-9a-f]{6}' | tr 'A-F' 'a-f' | sort -u > docs/superpowers/task-reports/phase-6/old-hex.txt; grep -oiE '#[0-9a-f]{6}' src/styles/globals.css | tr 'A-F' 'a-f' | sort -u > docs/superpowers/task-reports/phase-6/new-hex.txt; comm -23 docs/superpowers/task-reports/phase-6/old-hex.txt docs/superpowers/task-reports/phase-6/new-hex.txt
```
Expected: no output (every distinct hex of the old config exists in the new CSS). Every hex in the old config must appear in `globals.css` with the same value (compare by hand; case-insensitive). Also diff key names against `codemod-globals.css`: every `--color-*`/`--breakpoint-*` key there must exist here, except `--color-*` keys that point at vars the old config did not map, and `--font-pacifico` (intentionally dropped, spec D3). Then the default-palette grep:

```bash
grep -rnoE "\b(text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|shadow)-(slate|gray|zinc|neutral|stone|red|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" src --include='*.tsx' | awk -F: '{print $NF}' | sort -u
```
Expected: `border-gray-500`, `text-red-500`, `text-stone-400` only. For any other shade, add `--color-<name>-<shade>: <v3 hex>` to the pin list; get the v3 hex with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npx -y -p tailwindcss@3.4.17 node -e "console.log(require('tailwindcss/colors').<name>[<shade>])"`.

- [ ] **Step 4: Remove the JS config, update shadcn + Prettier config**

- `git rm tailwind.config.ts` if it still exists; afterwards `grep -rn "tailwind.config" src package.json postcss.config.* prettier.config.js tsconfig.json` prints nothing.
- `components.json`: set `"tailwind.config"` to `""`; leave every other key unchanged.
- `prettier.config.js`: add `tailwindStylesheet: './src/styles/globals.css',` next to `plugins`. Do not touch `.prettierrc.js`. Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npx prettier --find-config-path src/app/layout.tsx` and record the output (expected `.prettierrc.js`) in `NOTES.md` — this is the known shadowing issue (spec D8), not fixed here.

- [ ] **Step 5: Fast gate + built-CSS check**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build && CSS=$(grep -rl "faf8e8" .next/static --include='*.css') && echo "$CSS" && for v in '#9c7243' '#e6dfc4' '#faf8e8' '460px' 'tw-enter' '--border:'; do grep -qi -- "$v" $CSS && echo "ok $v" || echo "MISSING $v"; done
```
Expected: gate passes; one or more CSS files listed; six `ok` lines (the minifier may lowercase or shorten — if a value is reported missing, grep for an equivalent spelling before treating it as a failure). Also `grep -c "tailwindcss-animate" package.json yarn.lock` → `0` for `package.json` (a transitive mention in `yarn.lock` is a failure too — re-run `yarn install`).

- [ ] **Step 6: Commit**

```
chore: CSS-first Tailwind 4 theme, tw-animate-css, shadcn TW4 config

Moves the tailwind.config.ts theme into @theme / @theme inline in
globals.css (hex palette kept verbatim, HSL shadcn vars wrapped and
mapped only where the config mapped them), pins the v3 hex of the
default-palette shades in use, restricts sources to src/**/*.tsx,
replaces tailwindcss-animate with tw-animate-css, sets
components.json tailwind.config to "" and points
prettier-plugin-tailwindcss at the stylesheet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 5: Tailwind 3 compat shims (preflight, `space-*`, dialog animation)

**Files:**
- Modify: `src/styles/globals.css` (append)
- Modify: `src/app/events/_components/EventForm.tsx`, `src/app/members/_components/MembersSkeleton.tsx`, `src/app/_components/ui/card.tsx`, `src/app/_components/ui/dialog.tsx` (+ any other `space-[xy]-` site the grep finds)

**Interfaces:**
- Consumes: Task 4's `globals.css`.
- Produces: custom variant `v3-space` (selector `& > :not([hidden]) ~ :not([hidden])`) — `v3-space:mt-N` replaces `space-y-N`, `v3-space:ml-N` replaces `space-x-N`.

- [ ] **Step 1: Append the shims to `globals.css`**

```css
/* Tailwind 3 compat: v3's space-x/space-y selector (spec D6). v3-space:mt-N = v3 space-y-N, v3-space:ml-N = v3 space-x-N. */
@custom-variant v3-space (& > :not([hidden]) ~ :not([hidden]));

/* Tailwind 3 preflight compat (spec D5). Literal v3 values — not v4's OKLCH palette. */
@layer base {
	*,
	::after,
	::before,
	::backdrop,
	::file-selector-button {
		border-color: #e5e7eb;
	}

	input::placeholder,
	textarea::placeholder {
		color: #9ca3af;
	}

	button:not(:disabled),
	[role='button']:not(:disabled) {
		cursor: pointer;
	}

	input:where(:not([type='button'], [type='reset'], [type='submit'])),
	select,
	textarea {
		background-color: Field;
	}
}
```

- [ ] **Step 2: Rewrite every `space-*` usage**

```bash
grep -rnoE "[a-z0-9:-]*space-[xy]-[0-9.]+" src --include='*.tsx'
```
Expected (from the spec): `EventForm.tsx` `space-y-4` ×1, `space-y-1` ×7, `space-y-2` ×1; `MembersSkeleton.tsx` `space-y-2`; `card.tsx` `space-y-1.5`; `dialog.tsx` `space-y-1.5` and `sm:space-x-2`. Replace mechanically, keeping any variant prefix: `space-y-N` → `v3-space:mt-N`, `space-x-N` → `v3-space:ml-N` (e.g. `sm:space-x-2` → `sm:v3-space:ml-2`). Then check that no direct child of those containers carries an `mb-*` (for `space-y`) or `mr-*` (for `space-x`) class; if one does, add `v3-space:mb-0` / `v3-space:mr-0` to that container (v3 zeroed the opposite margin). Re-run the grep: expected no output.

- [ ] **Step 3: Remove the dialog slide classes (spec D4)**

In `src/app/_components/ui/dialog.tsx` `DialogContent`, delete exactly `data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`. Keep fade/zoom and `translate-x-[-50%] translate-y-[-50%]`.

- [ ] **Step 4: Fast gate + CSS check**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build && grep -rhoE ":not\(\[hidden\]\) ?~ ?:not\(\[hidden\]\)" .next/static --include='*.css' | head -1 && grep -rlo "e5e7eb" .next/static --include='*.css' | head -1
```
Expected: gate passes; both greps print a match (the v3 sibling selector and the border-color shim are in the built CSS).

- [ ] **Step 5: Commit**

```
fix: Tailwind 3 compat shims to keep rendering identical

Restores v3 preflight defaults (gray-200 border color, gray-400
placeholders, pointer cursor on buttons, UA field background on form
controls), replaces space-x/space-y with a v3-space custom variant that
keeps v3's sibling selector, and drops the dialog slide classes that
compose differently with v4's translate property.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 6: Visual comparison — explain or fix every difference

**Files:**
- Create: `docs/superpowers/task-reports/phase-6/visual/DIFFS.md` (gitignored log)
- Modify: only what a confirmed regression requires (`src/styles/globals.css`, `src/**/*.tsx`)

**Interfaces:**
- Consumes: baseline PNGs and the visual-run command (Task 2), Tasks 3–5 code.
- Produces: an "after" run where every shot passes or has an accepted verdict in `DIFFS.md`.

- [ ] **Step 1: Build and run the comparison**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && SKIP_ENV_VALIDATION=1 yarn build && npx playwright test --config docs/superpowers/task-reports/phase-6/visual/playwright.visual.config.mjs
```
Expected: ideally `43 passed`. Failures are expected to be possible; never run with `--update-snapshots` here. If the frozen date has become a past date (today > 2027-01-31), first move `FIXED_NOW` and all event dates forward by the same whole number of months, check out `$(cat docs/superpowers/task-reports/phase-6/BASE_SHA)` in a temporary worktree (`git worktree add ../cm-drozdi-worktrees/phase-6-baseline <sha>`, `yarn install --frozen-lockfile`, copy `.env`, build, run the harness with `--update-snapshots` from there, copy the `baseline/` dir back, `git worktree remove`), then re-run this step.

- [ ] **Step 2: Log every failing shot**

For each failure, open `visual/report/index.html` (expected/actual/diff slider) and add a `DIFFS.md` entry: shot name, project, region (element), observed change, root cause, verdict. Confirm the root cause with the Playwright MCP tools against `yarn start` of the **after** build (`browser_navigate`, `browser_evaluate` with `getComputedStyle(el)` / `el.getBoundingClientRect()`), and compare with the same values recorded from the baseline build if needed (rebuild base in the temp worktree from Step 1 when you need live baseline values).

- [ ] **Step 3: Fix regressions**

Allowed verdicts without a fix (spec "Classifying differences"): *color-mix rounding* (sampled channel delta ≤ 2/255, in an opacity-modifier color area) and *sub-pixel rasterization* (identical computed styles and boxes). Everything else is a regression: fix it in CSS/classes so the computed style matches v3, rebuild, re-run Step 1. Commit each distinct fix separately:

```
fix(styles): <what changed back> (Tailwind 4 visual diff)

<one line: shot(s) affected and root cause>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- [ ] **Step 4: Final comparison**

Re-run Step 1. Expected: every failure listed in `DIFFS.md` with an accepted verdict and evidence, all others `passed`. Write the final tally (`N passed / M accepted`) at the top of `DIFFS.md` — the orchestrator copies it into the PR description.

---

### Task 7: Full verification gate

**Files:** none (fixes only if something fails).

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: green gate; the orchestrator relies on it before opening the PR.

- [ ] **Step 1: Clean v3 leftovers grep**

```bash
grep -rnE "@tailwind |tailwindcss-animate|resolveConfig|tailwind\.config" src package.json components.json postcss.config.* ; grep -rnoE --include='*.tsx' -e "(^|[^a-z0-9/-])(outline-none|backdrop-blur-sm|space-[xy]-[0-9.]+)([^a-z0-9/-]|$)|-\[--" src
```
Expected: no output. (`shadow-sm`/`rounded-sm` are legitimate v4 names now — Task 3 Step 5 already proved the renames by count.)

- [ ] **Step 2: Run the gate in order**

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && yarn install --frozen-lockfile && npx prisma generate && yarn lint && yarn typecheck && SKIP_ENV_VALIDATION=1 yarn build && yarn e2e
```
Expected: every command exits 0; Playwright reports all specs passed. Port 3000 must be free first (e2e starts its own `yarn start`). On failure, debug with superpowers:systematic-debugging, fix, commit as `fix: <what> (Tailwind 4)` + trailer, and re-run the whole gate.

- [ ] **Step 3: Dev-server smoke (Turbopack)**

Start `yarn dev` (PATH prefix, background), open `http://localhost:3000/` and `/login` with the Playwright MCP tools (`browser_navigate`, `browser_take_screenshot`), confirm the calendar and colors render and `browser_console_messages` shows no CSS/PostCSS errors, then stop the dev server.

---

### Task 8: Docs — CLAUDE.md and master plan

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

**Interfaces:**
- Consumes: final state of Tasks 3–7.
- Produces: docs the PR carries (the PR link itself is added by whoever opens the PR).

- [ ] **Step 1: CLAUDE.md**

`grep -n -i "tailwind\|postcss\|tailwind.config\|tailwindcss-animate" CLAUDE.md`. Update any stale statement (e.g. the overview's stack list → "Tailwind 4"). Then add this subsection under `## Architecture` (after "Date/calendar utilities"):

```markdown
### Styling (Tailwind 4, CSS-first)

- No `tailwind.config.*`: the theme lives in `src/styles/globals.css` — brand palette in `@theme` (hex), shadcn variables in a top-level `:root` (`hsl(...)` values) mapped via `@theme inline`, `tw-animate-css` for shadcn animations, PostCSS via `@tailwindcss/postcss`. `components.json` has `"tailwind.config": ""`.
- Sources are limited to `src/**/*.tsx` (`@import 'tailwindcss' source(none)` + `@source`).
- Tailwind 3 compat shims kept on purpose (Phase 6): v3 preflight defaults in `@layer base`, the `v3-space:` variant instead of `space-x/y-*` (use `v3-space:mt-N`), and v3 hex pins for the default-palette shades in use. Don't remove them without a visual check.
```

- [ ] **Step 2: Master plan**

In `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`:
- Version gap table, `tailwindcss` row: Current → `^4.x (<installed version>)`, Jump → `done (Phase 6)`.
- Phase 6 section, exit criteria: replace "side-by-side visual check of every page vs production" with "Playwright screenshot diff of every screen vs the pre-upgrade build (see the Phase 6 spec)".
- Tracking table, row `6 — Tailwind 4`: replace `not started` with `in progress (\`chore/upgrade-phase-6-tailwind4\`)`. Leave the other rows alone.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
```
```
docs: document Tailwind 4 CSS-first setup, update Phase 6 tracking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
Expected: `git status` clean except gitignored task-reports; `git log --oneline origin/develop..HEAD` shows the Task 3–8 commits.
