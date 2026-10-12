# Phase 6 — Tailwind CSS 3 → 4 (incl. shadcn TW4 conversion)

**Branch:** `chore/upgrade-phase-6-tailwind4` (per master plan), forked from `develop`.
**Risk:** medium-high (silent visual regressions). **Size:** medium.
**Runs after:** Phase 5 (Next 16 + React 19, Turbopack by default) and the in-flight timezone-fix PR. The execution plan starts by merging `origin/develop` and refusing to proceed unless `package.json` shows `next@^16` / `react@^19`.

## Context

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` → Phase 6: run `npx @tailwindcss/upgrade`, move the `tailwind.config.ts` theme into CSS (`@theme` in `src/styles/globals.css`), swap the PostCSS plugin for `@tailwindcss/postcss`, convert the shadcn setup to TW4 (`@theme inline`, `tw-animate-css`, `components.json`), make `prettier-plugin-tailwindcss` TW4-aware, and hunt renamed utilities. The overriding requirement: **the app must look identical afterwards.**

Interactive brainstorming was skipped for this phase; every decision below was made from a read of the code at `develop` @ `3894f9a` (Phase 4 merged) plus the official guides (tailwindcss.com/docs/upgrade-guide, ui.shadcn.com/docs/tailwind-v4) and the package versions on npm on 2026-10-12.

### Versions (npm, 2026-10-12)

| Package | Now | Target |
|---|---|---|
| `tailwindcss` | `^3.4.3` (devDep) | `^4.3.3` (devDep) |
| `@tailwindcss/postcss` | — | `^4.3.3` (devDep, new) |
| `@tailwindcss/upgrade` | — | run once via `npx`, not installed |
| `tailwindcss-animate` | `^1.0.7` (dep) | **removed** |
| `tw-animate-css` | — | `^1.4.0` (devDep, new — shadcn's TW4 replacement) |
| `prettier-plugin-tailwindcss` | `^0.8.0` | unchanged (0.8.x supports v4 via `tailwindStylesheet`; 0.8.1 is a patch, not needed) |
| `tailwind-merge` | `^3.6.0` | unchanged (v3 is already the TW4-native line) |
| `postcss` | `^8.4.39` | unchanged |

Re-check with `npm view` when the plan runs; take the latest 4.x of the Tailwind packages.

## Current state (audited)

- `tailwind.config.ts`: `content: ['./src/**/*.tsx']`; everything under `theme.extend`: `screens.sm = 460px`; colors (see "Palette"); `fontFamily.sans = [var(--font-geist-sans), ...defaultTheme.fontFamily.sans]`, `fontFamily.pacifico = [var(--font-pacifico)]`; `plugins: [tailwindcss-animate]`.
- `postcss.config.cjs`: `{ plugins: { tailwindcss: {} } }` (no autoprefixer). Phase 5 may rename it — the plan checks.
- `src/styles/globals.css`: three `@tailwind` directives + `@layer base { :root { … } }` with shadcn vars as **bare HSL triplets** (`--border: 38 27% 70%`). No `* { border-color }` rule, no body rule, no `@apply`, no `theme()`.
- `components.json`: `"config": "tailwind.config.ts"`, style `new-york`, baseColor `neutral`, cssVariables on.
- **`src/utils/colors.ts`** imports `tailwindcss/resolveConfig` (removed in v4) and the config — it has **zero importers** (dead code). It would break `typecheck` after the upgrade.
- `src/app/EventCalendar.css` (imported by `EventCalendar.tsx`): one rule on `span[data-unavailable=true]`, a NextUI leftover that matches nothing in the react-day-picker markup. Left untouched (out of scope).
- Prettier: **two** config files exist. `.prettierrc.js` (tabs/single quotes) takes precedence over `prettier.config.js` (the one loading `prettier-plugin-tailwindcss`), so the Tailwind plugin is currently inactive. No `format` script, no CI formatting check.
- e2e specs assert roles/text only (`tbody tr` on members is markup-neutral). No e2e selector depends on a Tailwind class.

### How the config actually resolves today (what "identical" means)

The Tailwind config overrides several shadcn vars with hex, so `globals.css`'s `:root` vars are **not** the source of truth for those utilities:

| Utility color | Resolves to today | Note |
|---|---|---|
| `primary` | `#9c7243` | `--primary` HSL var is unused by utilities |
| `primary-foreground` | `hsl(var(--primary-foreground))` | |
| `secondary` | `#bdd086` | |
| `accent` | `#85a042` | |
| `accent-foreground` | `hsl(var(--accent-foreground))` | |
| `background` | **`#E6DFC4`** | `--background` (`48 40% 84%` ≈ `#e6e0c6`) is close but *not* equal — the hex wins |
| `foreground`, `border`, `input`, `ring`, `card(-foreground)`, `popover(-foreground)`, `muted(-foreground)` | `hsl(var(--x))` | |
| `white` | **`#FAF8E8`** | `text-white` / `bg-white` are cream, not `#fff` |
| `dark`, `danger` (+`foreground #422506`), `success`, `warning`, `unknown`, `content1/3/4` | hex | |
| `default-50…900`, `green/orange/yellow/blue-50…950` | hex scales | `green/orange/yellow/blue` fully replace Tailwind's scales (all shades redefined) |
| default `border` color | Tailwind 3 `gray-200` = `#e5e7eb` | not `--border`: no `* { border-color }` rule exists |
| `rounded-*` | Tailwind defaults | `--radius` is defined but **unused** (no `borderRadius` mapping) |
| `destructive`, `secondary-foreground`, `success/warning/unknown` vars | not mapped to utilities | vars exist in `:root` only; no class uses them |

Tailwind default-palette classes in use: `text-stone-400` (layout footer), `text-red-500` (login + reset-password error), `border-gray-500/30` (home), `bg-black`, `bg-black/80`. Tailwind v4 re-tuned its default palette in OKLCH (e.g. v4 `red-500` = `oklch(63.7% 0.237 25.331)`, visibly redder than v3 `#ef4444`).

## Decisions

### D1 — Run the official codemod for class renames, deps and PostCSS; hand-write the final CSS

Run `npx @tailwindcss/upgrade@latest` once on a clean tree (it refuses a dirty tree; never pass `--force`). Use its output for: template class renames, `package.json` bumps, `postcss.config.*`. Then **replace `src/styles/globals.css` with the hand-written target** in the plan instead of polishing the codemod's CSS: the codemod emits a generic `@theme` (and possibly `@config`/`@plugin` fallbacks) that does not follow the shadcn TW4 layout and would not encode D3–D6. The codemod's CSS is saved to `docs/superpowers/task-reports/phase-6/` and used as a cross-check that no theme key was missed.

**Codemod caveats the plan guards against:**
- It rewrites "candidates" in **every file found by automatic source detection** (all non-gitignored files), so it can edit Markdown under `docs/`, `.agents/`, `CLAUDE.md`. Everything outside `src/`, `package.json`, `yarn.lock`, `postcss.config.*`, `tailwind.config.ts`, `src/styles/globals.css` is reverted.
- It can misfire on **non-class strings** that look like renamed utilities. Known sites: `placeholder="blur"` on `next/image` (`src/app/page.tsx`) must not become `blur-sm`; `variant="outline"` / the `outline:` cva key must not change. Every changed line of the diff is reviewed.
- It may install with npm instead of Yarn 1 (a `package-lock.json` appears) — delete it and re-add with `yarn`.
- It does **not** fix: the `space-*` selector change, preflight changes, dead `resolveConfig` imports, the tailwindcss-animate swap, or `components.json`.

### D2 — Delete `src/utils/colors.ts` before the codemod

Dead file (no importers) whose only purpose is `resolveConfig`, which v4 removed. Deleted in its own commit before the codemod (the codemod needs a clean tree). Not a mixed concern: it's a direct casualty of this upgrade.

### D3 — CSS-first theme, exactly mirroring today's resolution (no OKLCH)

- **Hex stays hex.** Every hex color from the config goes into a plain `@theme` block as `--color-<name>: <hex>` (incl. `white: #faf8e8`, `background: #e6dfc4`, all 50–950 scales). `--breakpoint-sm: 460px`.
- **HSL vars → shadcn TW4 pattern.** `:root` moves out of `@layer base` to top level and each value is wrapped: `--border: hsl(38 27% 70%)`. A `@theme inline` block maps **only the keys that the config mapped to vars today** (`border, input, ring, foreground, card(-foreground), popover(-foreground), muted(-foreground), primary-foreground, accent-foreground`) as `--color-x: var(--x)`. Vars that no utility used (`--primary`, `--secondary(-foreground)`, `--accent`, `--destructive(-foreground)`, `--success`, `--warning`, `--unknown`, `--background`, `--radius`) stay in `:root` untouched and unmapped — mapping them would change colors (e.g. `bg-background` would switch from `#E6DFC4` to the HSL value) or add utilities.
- **No OKLCH conversion.** shadcn's TW4 guide keeps HSL for upgraded projects; converting would introduce rounding drift for zero visual gain. Same HSL numbers, same hex.
- **No `--radius-*` mapping.** shadcn's TW4 template maps `rounded-*` to `--radius`; this project never did, so `rounded-md` etc. keep Tailwind's defaults (v4 defaults equal v3 values after the `sm→xs` renames).
- **Fonts:** `@theme inline { --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'; }` (v3's default sans stack, same as v4's). `fontFamily.pacifico` is **dropped**: no `font-pacifico` class exists in `src/`, the `--font-pacifico` variable is never defined (layout applies `pacifico.className`, not `.variable`), and in v4 `--font-pacifico: var(--font-pacifico)` would be a self-reference.
- **Pin the default-palette shades the app uses to their v3 hex** in `@theme`: `--color-gray-500: #6b7280`, `--color-stone-400: #a8a29e`, `--color-red-500: #ef4444` (plus any other default-palette shade found by the post-codemod grep). Black is `#000` in both versions.
- **Sources:** `@import 'tailwindcss' source(none);` + `@source '../**/*.tsx';` — exactly v3's `content` (`src/**/*.tsx`). Automatic detection would also scan `docs/` and `.agents/skills/` Markdown (thousands of example classes) and `.ts` files v3 never scanned.
- `tailwind.config.ts` is deleted; `components.json` gets `"config": ""` (everything else unchanged).

### D4 — `tailwindcss-animate` → `tw-animate-css`

Remove the `tailwindcss-animate` dependency (and any `@plugin` line the codemod adds); `yarn add -D tw-animate-css`; `@import 'tw-animate-css';` after the Tailwind import. Class names (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-2`, …) are the same API.

One composition change: v4's `translate-x-[-50%]` uses the CSS `translate` property, which **adds to** the keyframe `transform` instead of being replaced by it (v3). `DialogContent`'s `slide-in-from-left-1/2 slide-in-from-top-[48%] slide-out-to-left-1/2 slide-out-to-top-[48%]` would therefore slide the dialog in from off-centre. Remove those four classes (this matches shadcn's current TW4 `dialog.tsx`). Accepted difference: the old 2 % upward nudge during the 200 ms open animation disappears; fade + zoom stay. Static rendering is unaffected.

The project-local `tailwind-v4-shadcn` skill claims `tw-animate-css` "doesn't exist" — that is wrong (1.4.0 on npm, used by shadcn's official guide). Follow the official guide; the skill is Vite-oriented (ignore its `@tailwindcss/vite` advice — Next uses PostCSS).

### D5 — Preflight / behavior compat shims (keep v3 rendering)

Added as one `@layer base` block in `globals.css`, with **literal v3 hex values** (not `var(--color-gray-*)`, which are v4 OKLCH):

| v4 change | Shim | Why needed here |
|---|---|---|
| Default border color `gray-200` → `currentColor` | `*, ::after, ::before, ::backdrop, ::file-selector-button { border-color: #e5e7eb; }` | 16 bare `border`/`border-t` uses (cards, dialogs, popovers, menus, raw inputs, members table) |
| Placeholder color → current text color @ 50 % | `input::placeholder, textarea::placeholder { color: #9ca3af; }` | Raw `<input>`s in login / create-member / reset-password have no placeholder class |
| Buttons `cursor: pointer` → `default` | `button:not(:disabled), [role='button']:not(:disabled) { cursor: pointer; }` | Behavior parity (official compat snippet) |
| `input/select/textarea` get `background-color: transparent` | `input:where(:not([type='button'], [type='reset'], [type='submit'])), select, textarea { background-color: Field; }` | v3 left the UA field background (white); raw inputs and the members role `<select>` would turn page-colored. shadcn `Input`/`Textarea` set `bg-transparent` as a utility, which still wins over `@layer base` |

Not shimmed: ring default width/color (no bare `ring` or color-less `ring-N` in `src/` — the plan re-verifies), `<dialog>` margins (no native `<dialog>`), `hidden` attribute (none in `src/`).

**Accepted behavior difference:** `hover:` now only applies under `@media (hover: hover)`. On touch devices hover styles no longer "stick" after a tap. This is a v4 improvement, invisible on desktop, and not shimmed (no `@custom-variant hover`).

### D6 — `space-x-*` / `space-y-*`: keep v3's selector via a custom variant

v4 changed `space-y-N` from `> :not([hidden]) ~ :not([hidden]) { margin-top }` to `> :not(:last-child) { margin-bottom }`. That changes layout here:
- `EventForm`'s `space-y-1` wraps an **inline** `<Label>` + `<Input>`: margin-bottom on an inline element has no effect → the 4 px label/input gap disappears.
- `CardHeader` / `DialogHeader` carry `space-y-1.5` while callers turn them into `flex-row items-center` (Event card header, event detail header): the margin moves from the last items to the first items → items shift vertically.

The guide's suggested fix (`flex flex-col gap-*`) blockifies the inline label and changes line-box heights, so it is not identical either. Decision: define

```css
@custom-variant v3-space (& > :not([hidden]) ~ :not([hidden]));
```

and rewrite every usage mechanically: `space-y-N` → `v3-space:mt-N`, `sm:space-x-N` → `sm:v3-space:ml-N`. Same selector, same specificity, same layer as v3. Usages today (re-grep in the plan): `EventForm.tsx` (`space-y-4`, 7× `space-y-1`, `space-y-2` on the popover), `MembersSkeleton.tsx` (`space-y-2`), `card.tsx` `CardHeader` (`space-y-1.5`), `dialog.tsx` `DialogHeader` (`space-y-1.5`) and `DialogFooter` (`sm:space-x-2`). No direct child of these containers has its own `mb-*`/`mr-*`, so v3's explicit zeroing of the opposite margin is not needed (the plan re-checks). No `divide-*` usage exists.

### D7 — Renamed utilities (expected codemod output; verified by grep afterwards)

| v3 → v4 | Sites in `src/` today |
|---|---|
| `outline-none` → `outline-hidden` | 12 (button, input, textarea, badge, switch, dialog close, dropdown items ×4, popover, Event card) |
| `shadow-sm` → `shadow-xs` | 4 (input, textarea, switch, `CalendarSkeleton`) |
| `shadow` → `shadow-sm` | 1 (`card.tsx`) |
| `rounded-sm` → `rounded-xs` | 5 (dialog close, dropdown items/sub-trigger) |
| `rounded` → `rounded-sm` | 10 (raw inputs, members select + pill, reset-password skeleton) |
| `backdrop-blur-sm` → `backdrop-blur-xs` | 1 (`DialogOverlay`) |
| `[--var]` → `(--var)` in arbitrary values | `calendar.tsx` (`h/w/px/size/min-w-[--cell-size]`), `origin-[--radix-…]` in popover/tooltip/dropdown |
| `bg-opacity-*` | `Menu.tsx` only — see below |

Unchanged-and-fine: `shadow-md/lg/2xl`, `rounded-md/lg/xl/full`, explicit `ring-0/1/2/[3px]` (all paired with an explicit ring color), `ring-offset-*`, `translate-x-[-50%]`, all spacing/sizing/typography (v4 values equal v3).

`calendar.tsx` was generated from shadcn's TW4 registry, so it already contains v4-only classes that v3 silently ignored (`shadow-xs`, `has-focus:*`, `**:` variants, `ring-[3px]` on `dropdown_root`). They become active in v4 but only on `dropdown_root` (unused: `captionLayout="label"`) and RTL (unused) — no visible effect; the screenshots confirm.

**`Menu.tsx` quirk (pre-existing, preserved):** the Menu button passes `bg-opacity-60 hover:bg-opacity-100`. `tailwind-merge` 3 treats `bg-opacity-60` as a background *color* and strips the variant's `bg-primary` (verified: `twMerge(...)` output has no `bg-primary`), so the button renders **transparent** today. In v4 `bg-opacity-*` generates nothing, so it stays transparent — identical. Leave the classes alone (if the codemod rewrites them, revert that hunk); filed as a follow-up (was a primary/60 button intended?).

### D8 — PostCSS, Prettier, shadcn

- `postcss.config.*` → `{ plugins: { '@tailwindcss/postcss': {} } }` (keep whatever file name/format Phase 5 left; the codemod usually rewrites it). Next 16/Turbopack reads the PostCSS config natively.
- `prettier.config.js`: add `tailwindStylesheet: './src/styles/globals.css'` so the plugin can resolve the v4 theme. The plugin stays inactive because `.prettierrc.js` shadows this file — pre-existing, **not** fixed here (consolidating the configs would re-sort classes across the whole codebase; follow-up). Do not run `prettier --write`.
- No `shadcn add`/re-generation of components (would overwrite the customized `cva` variants). shadcn's optional TW4 cleanups (`size-*` instead of `w-*/h-*`, removing `forwardRef`, `data-slot`) are out of scope — follow-up candidates.

## Visual regression method

Production is several releases behind `develop`, so it is **not** a reference. The baseline is the pre-upgrade build of this branch (after merging `develop` with Phase 5), captured before any Tailwind change.

- **Harness:** a standalone Playwright config + spec (`.mjs`, so neither `tsc` nor ESLint pick them up) under the gitignored `docs/superpowers/task-reports/phase-6/visual/`. It reuses `e2e/global-setup.ts` (migrate, seed, admin/member `storageState`), runs against `yarn start` (production build) with `TZ=Europe/Prague`, and uses `toHaveScreenshot` with `threshold: 0, maxDiffPixels: 0, animations: 'disabled'`. Baseline = `--update-snapshots` run on the pre-upgrade build; "after" = plain run on the upgraded build. Failing shots produce `-expected/-actual/-diff.png` and an HTML report (slider view) — no extra diff tooling needed.
- **Determinism:** browser clock frozen at `2027-02-01T09:00:00+01:00` (`page.clock.setFixedTime`); the spec reseeds a fixed set of 5 events (one per badge variant, incl. a null-start "unknown" state, a long name, a private event) dated in Feb 2027 so they are both "upcoming" for the server and inside the frozen calendar month; mouse parked at (0,0) before each shot; fonts and images awaited. The baseline is re-run once unchanged to prove zero flake before the upgrade starts. (If the plan is executed after 2027-01-31, move the frozen date and the event dates forward by the same amount before capturing.)
- **Viewports:** `desktop` 1280×800 @1x, `mobile` 375×812 @2x with `isMobile`/`hasTouch`.
- **Screens/states (each at both viewports unless noted):** home (public) with calendar; home as admin; login; login error; reset-password form; data-deletion; events list; event card keyboard focus ring; event name tooltip (desktop only); Menu dropdown open; event detail dialog; state dropdown in the dialog; edit form; edit-form date popover; request form; request-form date popover; request-form start-in-past validation error; members page; member delete confirm dialog; create-member error toast; member hitting `/members` (AccessForbidden); state-change success toast. Loading skeletons are transient and not captured — their diffs are reviewed in code only.
- **Classifying differences:** every failing shot gets an entry in `docs/superpowers/task-reports/phase-6/visual/DIFFS.md` (gitignored) with its cause and verdict. Root causes are confirmed with the Playwright MCP tools (`getComputedStyle` / `getBoundingClientRect` on the element in both builds). Only two verdicts are allowed without a code fix:
  1. *color-mix rounding* — opacity-modifier colors (`bg-primary/90`, `text-default-600/70`, `border-gray-500/30`, `bg-black/80`, …) are now `color-mix(in oklab, …)`; a pixel difference of ≤ 2/255 per channel in those areas is accepted after sampling it.
  2. *sub-pixel rasterization* — identical computed styles and bounding boxes, anti-aliasing-only pixels (e.g. `translate` property vs `transform` matrix).
  Anything else is a regression: fix it in a follow-up commit and re-run until the "after" run is green or every remaining failure carries one of the two verdicts.

## Testing & exit criteria

- `grep` finds no `tailwind.config`, `tailwindcss-animate`, `@tailwind `, `resolveConfig`, `outline-none`, `backdrop-blur-sm`, `-[--` arbitrary values or `space-x-`/`space-y-` in `src/`. The `shadow`/`rounded` renames are proven by before/after occurrence counts (the v4 names `shadow-sm`/`rounded-sm` are legitimate afterwards).
- Built CSS contains `#9c7243`, `#e6dfc4`, `#faf8e8`, `460px`; `components.json` has `"config": ""`.
- Visual harness: every after-shot passes or carries an accepted verdict in `DIFFS.md`.
- Full gate in order, Node 22: `yarn install --frozen-lockfile`, `npx prisma generate`, `yarn lint`, `yarn typecheck`, `SKIP_ENV_VALIDATION=1 yarn build`, `yarn e2e`. e2e runs once, at the end.
- `CLAUDE.md` documents the CSS-first setup; master plan Phase 6 tracking row + version table updated.

## Risks

- **Turbopack + `@tailwindcss/postcss`:** supported, but first exercised here — caught by `yarn build` / `yarn dev`.
- **Native binaries in CI:** `@tailwindcss/oxide` / `lightningcss` ship per-platform optional packages; Yarn 1 records all of them in `yarn.lock`, so `--frozen-lockfile` on the Linux runner should work. Only CI proves it.
- **Unlayered CSS now beats every utility** (v4 uses native cascade layers). Unlayered sources: `next/font` classes (`font-family` on `<html>` / events wrapper — no utility on the same element sets fonts), `EventCalendar.css` (dead selector), react-hot-toast's goober styles (toasts carry no Tailwind classes). No conflict today; screenshots confirm.

## Non-goals

- Fixing the `Menu.tsx` transparent-button quirk, consolidating the two Prettier configs, removing `EventCalendar.css`, shadcn React-19 cleanups (`forwardRef`, `data-slot`, `size-*`), dark mode. All candidate follow-ups.
- Touching `next`, `react`, `prisma`, `zod`, `eslint`, `better-auth`, `tailwind-merge` versions.
