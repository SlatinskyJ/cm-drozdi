# Phase 9 — ESLint 8 → flat config (ESLint 9, 10 if plugins allow) + TypeScript 5.9 → 6.0

**Branch:** `chore/upgrade-phase-9-eslint10` (per master plan), forked from `develop` @ `d1e076e` (Phase 5 merged). Phases 6 (Tailwind 4), 7 (Prisma 7) and 8 (Zod 4) must be merged into `develop` before execution starts.
**Risk:** low (tooling only; two one-line app edits). **Size:** small-medium.

## Context

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` Phase 9 moves linting off ESLint 8 + legacy `.eslintrc.cjs` onto a flat config with `eslint-config-next@16`, widens lint to the whole repo, and bumps TypeScript to 6.0.x (Decisions 2026-10-12). Phase 5 left lint on `eslint@8.57` + `eslint-config-next@15.5.27` (exact pin) with `next typegen && eslint src --ext .js,.jsx,.ts,.tsx`.

All decisions below are final (set by the repo owner on 2026-10-12). This spec records them and the evidence behind them.

**Evidence.** Besides the docs (ESLint 9/10 migration guides, `eslint-config-next@16.4.0` source, `typescript-eslint` flat-config docs, the TypeScript 6.0 release notes), the full migration was trialled in a scratch copy of `develop` @ `d1e076e` and again on `origin/chore/upgrade-phase-6-tailwind4`: install, flat config, `eslint .`, TS 6.0.3 `tsc`, `next build`, the rule-set comparison and the probe file described below. Results are quoted where they matter. Phases 7 and 8 had only docs on their branches at spec time, so their code effects are checked at execution time, not assumed.

## Versions at spec time (npm, 2026-10-12)

| package | installed | target |
|---|---|---|
| `eslint` | ^8.57.0 | **^9.39.5** (latest 9.x; 10.12.0 is `latest`, see Decision 1) |
| `eslint-config-next` | 15.5.27 (exact) | **exact match of `next`** (16.4.0 today) |
| `typescript-eslint` (meta-package) | — | **^8.71.1** |
| `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` | ^8.1.0 (resolved 8.30.1) | **removed** as direct deps (provided by `typescript-eslint`) |
| `@types/eslint` | ^8.56.10 | **removed** (ESLint 9 ships its own types) |
| `typescript` | ^5.9.3 | **~6.0.3** (highest 6.0.x; tilde keeps it inside `typescript-eslint`'s range) |

Peer ranges checked with `npm view <pkg> peerDependencies`:

| package (version pulled by `eslint-config-next@16.4.0`) | `eslint` peer |
|---|---|
| `eslint-plugin-react@7.37.5` | `^3 … ^8 \|\| ^9.7` (no 10) |
| `eslint-plugin-import@2.32.0` | `… ^8 \|\| ^9` (no 10) |
| `eslint-plugin-jsx-a11y@6.10.2` | `… ^8 \|\| ^9` (no 10) |
| `eslint-plugin-react-hooks@7.1.1` | `… ^9.0.0 \|\| ^10.0.0` |
| `typescript-eslint@8.71.1` | `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`; **`typescript >=4.8.4 <6.1.0`** |
| `eslint-config-next@16.4.0` | `eslint >=9.0.0`, `typescript >=3.3.1` |

`eslint-config-next@16.4.0` brings `typescript-eslint ^8.56.0`, `eslint-plugin-react-hooks ^7.1.0`, `@next/eslint-plugin-next 16.4.0` and `globals 16.4.0` as its own dependencies. Yarn dedupes `typescript-eslint` to the single top-level 8.71.1 (verified). Two copies would fail with "Cannot redefine plugin @typescript-eslint".

## Decisions

### 1. ESLint major: 9 now, 10 as a follow-up (gated re-check)

ESLint 10 only if `eslint-plugin-react`, `eslint-plugin-import` **and** `eslint-plugin-jsx-a11y` (at the versions `eslint-config-next@<next version>` pulls in) all declare `^10` in their `eslint` peer range. At spec time all three stop at `^9`, so the target is **ESLint 9 flat config**. The plan's first task re-checks this and sets `ESLINT_MAJOR=9|10`. The config file, scope and fixes are the same for both majors. ESLint 10's breaking changes don't touch this repo: it needs Node ≥22.13 (local 22.14, CI `22`); config lookup starts from each file's directory, which changes nothing with one root config; the `eslint:recommended` additions don't apply because the config doesn't use `eslint:recommended`; `eslint-env` comments don't exist here.

Known cost, recorded: npm marks `eslint@9.39.5` as "no longer supported" (the 9.x maintenance window ended after 10.0 shipped on 2026-02-06). This is dev-only tooling with no runtime exposure, so the trade-off stands: a supported-but-unpeered plugin stack on 10 would be worse. The ESLint 10 follow-up becomes the first tooling item once the three plugins declare support.

### 2. Config file: `eslint.config.mjs`

`eslint.config.mjs` at the repo root (Next 16's convention; the `.mjs` extension makes it ESM regardless of `package.json#type`). Structure, in order:

1. `globalIgnores([...])` (Decision 5).
2. `...nextVitals` from `eslint-config-next/core-web-vitals`: Next's base entry (react, react-hooks v7 incl. React Compiler rules, import, jsx-a11y, `@next/next`, browser+node globals, Babel parser for JS), its `next/typescript` parser entry for `*.ts(x)`, its default ignores (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`), and `@next/next` core-web-vitals rules.
3. `...tseslint.configs.recommendedTypeChecked`, `...tseslint.configs.stylisticTypeChecked`. Their base entry has no `files` filter, so it puts `@typescript-eslint/parser` on **every** linted file (JS too), as the old root-level `parser` did. This replaces Next's Babel parser for `.js`/`.mjs`/`.cjs`.
4. One project block: `languageOptions.parserOptions` `{ projectService: true, tsconfigRootDir: import.meta.dirname }` plus the custom rules (Decision 3).

Built with `defineConfig` / `globalIgnores` from `eslint/config` (ESLint ≥9.22). `tseslint.config()` is deprecated upstream and is not used.

**`eslint-config-next/typescript` is deliberately not included.** It adds `typescript-eslint`'s untyped `recommended` set (a subset of `recommendedTypeChecked`) and then sets `@typescript-eslint/no-unused-vars: 'warn'` and `@typescript-eslint/no-unused-expressions: 'warn'`. Depending on order, that would either drop the `argsIgnorePattern` option or downgrade `no-unused-expressions` from `error` to `warn`, which breaks "equivalent-or-stricter". The type-checked presets already cover everything it adds.

`parserOptions.project: true` becomes `projectService: true` (typescript-eslint's recommended setting for v8). Files the TS project service can't find fail with a parsing error, so every linted file must be in `tsconfig.json`'s program (Decision 5).

### 3. Every `.eslintrc.cjs` customization is preserved (audit)

Full audit of `.eslintrc.cjs` at `d1e076e` (it has no `overrides`, `ignorePatterns`, `env`, `settings` or `globals`). The plan re-audits the file after merging `develop`, because Phase 7 may add `ignorePatterns: ['src/generated/**']`. Any key added by then must be carried over too.

| `.eslintrc.cjs` | flat config |
|---|---|
| `root: true` | implicit (flat config doesn't cascade) |
| `parser: '@typescript-eslint/parser'` | set by `tseslint.configs.*TypeChecked` base entry (all files) |
| `parserOptions.project: true` | `parserOptions.projectService: true` + `tsconfigRootDir: import.meta.dirname` |
| `plugins: ['@typescript-eslint']` | registered by the tseslint presets (same plugin object Next registers; deduped) |
| `extends: next/core-web-vitals` | `...nextVitals` |
| `extends: plugin:@typescript-eslint/recommended-type-checked` | `...tseslint.configs.recommendedTypeChecked` |
| `extends: plugin:@typescript-eslint/stylistic-type-checked` | `...tseslint.configs.stylisticTypeChecked` |
| `@typescript-eslint/array-type: off` | same |
| `@typescript-eslint/consistent-type-definitions: off` | same |
| `@typescript-eslint/consistent-type-imports: [warn, {prefer: 'type-imports', fixStyle: 'inline-type-imports'}]` | same |
| `@typescript-eslint/no-unused-vars: [warn, {argsIgnorePattern: '^_'}]` | same |
| `@typescript-eslint/require-await: off` | same |
| `@typescript-eslint/no-misused-promises: [error, {checksVoidReturn: {attributes: false}}]` | same |

**Machine check (rule-set comparison).** `eslint --print-config` is captured for `src/server/api/trpc.ts`, `src/app/page.tsx` and `src/env.js` before (ESLint 8) and after (flat). A script reports any rule that is enabled before and is missing, off, or lower severity after. Scratch-trial result: **nothing dropped or weakened.** The only option diffs are ESLint 9 printing rule defaults explicitly (`dot-notation`, `no-empty-function`, `prefer-const`, `no-unused-expressions`). Added: the 14 `react-hooks` React Compiler rules (`static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating`) and `@next/next/no-location-assign-relative-destination`.

**Behavioural check (probe file).** A throwaway `src/lint-probe.tsx` (its source is kept as `docs/superpowers/task-reports/lint-probe.tsx.txt`, gitignored and non-`.tsx` so `tsc`'s repo-wide `**/*.tsx` include doesn't pick it up; it is copied into `src/` only for the run, then deleted) contains one deliberate violation or non-violation per customization. A checker asserts that these fire: `consistent-type-imports` (with the inline `import { type X }` fix), `no-unused-vars` on a plain local, `no-misused-promises` on a Promise in a condition, `no-explicit-any`, `no-unsafe-member-access` (type-aware), `prefer-optional-chain` (stylistic type-aware), `react-hooks/exhaustive-deps`, `react-hooks/set-state-in-effect` (React Compiler) and `@next/next/no-img-element`. It also asserts that these stay silent: `array-type`, `consistent-type-definitions`, `require-await`, `no-unused-vars` on an `_`-prefixed arg, `no-misused-promises` on an async `onClick` attribute, and any parse/project-service error. Scratch-trial result: the old config fails only on `set-state-in-effect` (expected, it is new), and the new config passes everything.

### 4. Scripts, CI, bot

- `"lint": "next typegen && eslint ."` (`--ext` no longer exists in flat-config ESLint; file selection comes from the config). No `--max-warnings` (warnings stay non-fatal, as today). The gate still requires zero warnings because the baseline has zero.
- `"typecheck"` is unchanged.
- `.github/workflows/ci.yml` needs **no change**. The `lint` job runs `yarn install --frozen-lockfile` (its `postinstall` runs `prisma generate`) and then `yarn lint` (which runs `next typegen`), so `e2e/`, `prisma/seed.ts` and `src/` all have generated types on a fresh checkout. The plan verifies this with a fresh-checkout simulation.
- `.github/claude-bot.md` needs **no change**. Its gate is `SKIP_ENV_VALIDATION=1 yarn lint` + `SKIP_ENV_VALIDATION=1 yarn typecheck`, and neither script name nor meaning changes.
- Vercel: `vercel-build` runs `next build`, which doesn't lint in Next 16. TS 6 affects the build's type check; the scratch `next build` on TS 6.0.3 passed with an unchanged route table.

### 5. Lint scope = whole repo; ignores; project-service coverage

`eslint .` lints `src/`, `e2e/`, `prisma/` and root config files (`next.config.js`, `playwright.config.ts`, `postcss.config.cjs`, `prettier.config.js`, `.prettierrc.js`, `eslint.config.mjs`, plus `prisma.config.ts` once Phase 7 adds it). Flat-config ESLint does **not** skip dotfiles or read `.gitignore`, so ignores are explicit:

| ignore | why |
|---|---|
| `.next/**`, `out/**`, `build/**`, `next-env.d.ts` | already in `eslint-config-next`'s ignores; not repeated |
| `node_modules/`, `.git/` | ESLint defaults |
| `.agents/**`, `.claude/**` | vendored agent-skill templates (tracked via `skills-lock.json`, `.claude/skills/*` symlink into `.agents/`). Not app code, not in the TS program (TS globs skip dot-dirs), would be project-service errors |
| `docs/superpowers/task-reports/**` | gitignored scratch output (holds the probe file and scripts) |
| `playwright-report/**`, `test-results/**` | generated Playwright output (the HTML report ships `.js` assets) |
| `.vercel/**` | `vercel build` output, if present locally |
| `src/generated/**` | **only if** Phase 7 merged a generated Prisma client there (its spec plans `src/generated/prisma`, with `// @ts-nocheck` + `/* eslint-disable */` files) |

Project-service coverage. `tsconfig.json#include` has `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.cjs`, but TS globs skip dotfiles and `.mjs` isn't listed. Today `.eslintrc.cjs` is listed explicitly for this reason. So:

- `".eslintrc.cjs"` is replaced by `"eslint.config.mjs"` in `include`. The scratch `tsc` on TS 6 type-checked it (`checkJs`) with zero errors.
- `".prettierrc.js"` is added to `include`. The trial showed it is the only file that otherwise fails with "was not found by the project service". This beats `allowDefaultProject`, which would give it a different, default compiler setup.
- Any other root `*.mjs` file present after the `develop` merge (for example if Phase 6 or 7 renamed a config to `.mjs`) is added to `include` the same way.

### 6. New rule hits: fix them, no blanket disables

Policy: fix real violations. Disabling a specific rule is allowed only in `eslint.config.mjs`, scoped as narrowly as possible (`files` glob), with a comment stating why. A single-line exception uses `// eslint-disable-next-line <rule> -- <reason>`. No file-level `/* eslint-disable */`, no dropping a preset, no `--quiet`. Existing disable comments must still be needed: ESLint 9 reports unused directives as warnings by default, and the one existing directive (`src/app/page.tsx`) is still used.

Hits found in the scratch trial (`develop` @ `d1e076e`, identical on the Phase 6 branch):

| file | rule | fix |
|---|---|---|
| `src/server/api/trpc.ts:127` | `prefer-optional-chain` (newer `typescript-eslint` catches it) | `!ctx.session?.user` (autofix) |
| `src/server/auth.ts:31` | `prefer-optional-chain` (suggestion only) | `if (!admin) return true;` then `return admin.deletedAt !== null;`. Same truth table, clearer than `admin?.deletedAt !== null` |
| `e2e/global-setup.ts:9,53`, `e2e/helpers/auth.ts:10`, `e2e/helpers/date.ts:17-18`, `e2e/specs/members.spec.ts:26` | `dot-notation` on `process.env['X']` | `process.env.X` (autofix) |
| `e2e/global-setup.ts:22` | `no-explicit-any`, `no-unsafe-*` on `(response.headers as any).getSetCookie?.()` | `response.headers.getSetCookie()`. Typed in TS's DOM lib and native in Node 22, so the `any` cast and `get('set-cookie')` fallback are dead code |
| `e2e/specs/deleted-member.spec.ts:153,165,264` | `no-unsafe-member-access` on Playwright `APIResponse.json()` (returns `any`) | assert a narrow shape: `((await r.json()) as { code?: string }).code`, `((await r.json()) as { user?: { id?: string } } \| null)?.user?.id` |

No React Compiler (`react-hooks/*`) hits exist at spec time. Phases 6–8 may add some (for example shadcn regeneration or form code that trips `incompatible-library` / `set-state-in-effect`). They are fixed under the same policy, and each behaviour-changing component fix triggers the Playwright-MCP smoke check.

### 7. TypeScript 6.0.x

- `typescript@~6.0.3` (or the highest 6.0.x patch inside the then-current `typescript-eslint` peer range). TS 7 stays deferred, even if `typescript-eslint` widens its range by then; that becomes a follow-up note.
- Scratch `tsc` on 6.0.3 failed only with **TS5101 `baseUrl` is deprecated**. Fix: delete `"baseUrl": "."`. Every `paths` entry is already `./`-prefixed, so it resolves relative to `tsconfig.json`, and nothing imports bare `src/...`. `tsx` (`prisma/seed.ts`, which uses `~/` aliases, also run by Vercel preview builds through `yarn db:seed`) resolves `~/*` without `baseUrl` (verified). `e2e/` uses no aliases.
- TS 6's `types` default becomes `[]`. Today `process`/Node globals typecheck only because Next's type references pull in `@types/node` transitively. Add `"types": ["node"]` so this doesn't depend on Next. Scratch `tsc` was clean with it.
- No `ignoreDeprecations` anywhere. Other TS 6 default changes are no-ops here: `strict`, `module`, `target`, `esModuleInterop` and `moduleResolution: bundler` are already set explicitly; `noUncheckedSideEffectImports` (CSS side-effect imports) and `rootDir` (`noEmit`) produced no errors. `lib: ["dom", "dom.iterable", …]` still works (`dom.iterable` is now an empty alias). Its removal is cosmetic and out of scope.
- `typescript-eslint` must not print its "unsupported TypeScript version" warning during `yarn lint`.

### 8. Commit structure

One PR, one commit per task, each commit passing the fast gate:

1. Flat config on ESLint 9 (or 10) + `eslint-config-next` 16 + `typescript-eslint` meta-package, scope still `src`, src hits fixed.
2. Widen scope to the repo: ignores, `tsconfig` include, e2e/prisma/root hits fixed.
3. TypeScript 6.0.x + `tsconfig.json` deprecation fixes.
4. `CLAUDE.md` + master plan.

All commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Verification & exit criteria

Gate (Node 22: prefix every command with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" &&`; native Postgres on `localhost:5432`):

```bash
yarn install --frozen-lockfile
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
SKIP_ENV_VALIDATION=1 yarn typecheck
SKIP_ENV_VALIDATION=1 yarn build
yarn e2e
```

- **Per task:** gate without `yarn e2e`. **End:** full gate including `yarn e2e`, once.
- **Equivalent-or-stricter:** the rule-set comparison prints `OK: nothing dropped or weakened` for all three files, and the probe prints `PROBE OK`. The probe is run against the old config first; there it fails only on `react-hooks/set-state-in-effect`.
- **Scope:** the list of files `eslint .` lints includes `e2e/**`, `prisma/seed.ts`, `next.config.js`, `playwright.config.ts`, `eslint.config.mjs`, `.prettierrc.js`, and contains nothing under an ignored path.
- **Zero** errors and **zero** warnings from `yarn lint`; no `ignoreDeprecations` in the repo; no `.eslintrc*`; no `@types/eslint`, `@typescript-eslint/eslint-plugin` or `@typescript-eslint/parser` in `package.json`.
- **Fresh-checkout simulation (mirrors CI's lint/typecheck jobs, which never build):** `rm -rf .next next-env.d.ts` → `yarn install --frozen-lockfile` → `yarn lint`, and the same before `yarn typecheck`. Both pass.
- **Route table:** `yarn build` route list identical to the pre-change build.
- **Smoke (Playwright MCP):** only if a React Compiler fix touched a component under `src/app/`. It exercises the screens that component renders.
- **Post-push (PR author, not the implementer):** CI `lint`/`typecheck`/`e2e` green; Vercel preview deployment `READY` (its `vercel-build` runs `tsx` seed + `next build` on TS 6).

## Docs updated in this phase

- `CLAUDE.md` → Commands: the `yarn lint` line describes `next typegen` + ESLint 9 (or 10) flat config `eslint.config.mjs` over the whole repo (no more "legacy `.eslintrc.cjs`, pinned to 15.5 until Phase 9").
- Master plan: Phase 9 Tracking row; version gap table `eslint` / `typescript` rows marked done with the resolved versions; Phase 9 section records the ESLint 9 outcome; the follow-ups below are listed under the post-Phase-9 cleanup paragraph.

## Follow-ups (not in this phase)

- **ESLint 10** once `eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y` declare `^10` (ESLint 9 is already out of support).
- **TypeScript 7** once `typescript-eslint` supports it.
- **Prettier config shadowing** (from Phase 6): `.prettierrc.js` takes precedence over `prettier.config.js`, so `prettier-plugin-tailwindcss` is inactive. Merging them would reformat the codebase, so it's a separate PR. That PR also drops `.prettierrc.js` from `tsconfig.json#include`.
- Optional: drop `dom.iterable` from `lib` (empty in TS 6); `--max-warnings 0` in `lint`.

## Non-goals

- ESLint 10 when its plugin peers aren't met; TS 7; `eslint:recommended` / other new presets; Prettier or formatting changes; `--max-warnings`.
- `ignoreDeprecations`; any `tsconfig` change beyond `baseUrl`, `types`, and the `include` entries above.
- Any behaviour change in app code beyond the two `prefer-optional-chain` rewrites and whatever React Compiler fixes Phases 6–8 make necessary.
- `.github/workflows/*`, `.github/claude-bot.md`, `next.config.js`.
