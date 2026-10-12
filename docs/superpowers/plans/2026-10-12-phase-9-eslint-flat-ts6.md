# Phase 9 — ESLint flat config + TypeScript 6.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ESLint 8 + `.eslintrc.cjs` with an `eslint.config.mjs` flat config on ESLint 9 (10 only if its plugin peers allow) using `eslint-config-next@16`, lint the whole repo with an equivalent-or-stricter rule set, and move TypeScript to 6.0.x without `ignoreDeprecations`.

**Architecture:** Task 1 captures baselines on the old setup: the effective rule set per file type, a probe-file result, and the build route table. It also writes the scripts that later tasks use to prove nothing was lost. Then one commit per concern, each passing the fast gate: flat config with `src` scope (rule set and probe compared against baseline) → whole-repo scope → TypeScript 6 → docs → final gate with e2e.

**Tech Stack:** ESLint 9.39.x (or 10.x), `eslint-config-next` = `next` version (16.4.0 at spec time), `typescript-eslint` 8.71.x (flat, `projectService`), TypeScript 6.0.x, Next 16 (`next typegen`), Yarn 1, Playwright, native Postgres on `localhost:5432`.

**Spec:** `docs/superpowers/specs/2026-10-12-phase-9-eslint-flat-ts6.md`. Read it first: it has the rationale, the customization audit table and the known-hit list.

## Global Constraints

- Branch `chore/upgrade-phase-9-eslint10`, worktree `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/chore--upgrade-phase-9-eslint10`. Never touch `main`. Don't push or open a PR unless the orchestrator asks.
- **Node 22:** every shell command that runs `yarn`, `npx`, `node` or `next` is prefixed with `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" &&`, because shell state doesn't persist between calls. Below it is written as `$N22 &&`, so substitute the full prefix.
- **Versions:** `eslint` `^9.39.5` (or `^10.<latest minor>` if Task 1 sets `ESLINT_MAJOR=10`); `eslint-config-next` **exact**, same string as `next` in `package.json`; `typescript-eslint` `^8.71.1` (or newer 8.x); `typescript` `~6.0.<highest 6.0 patch>` (6.0.3 at spec time). Never TS 7.
- **Remove:** `.eslintrc.cjs`, `@types/eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` (direct deps only).
- **Do not change:** `.github/workflows/*`, `.github/claude-bot.md`, `next.config.js`, `.prettierrc.js` / `prettier.config.js` contents (Prettier shadowing is a follow-up), any non-lint/TS dependency.
- **No `ignoreDeprecations`**, no `eslint-config-next/typescript` import, no `tseslint.config()`, no file-level `/* eslint-disable */`, no preset removal, no `--quiet`. A rule turned off or relaxed in `eslint.config.mjs` needs a comment with the reason. A line exception uses `// eslint-disable-next-line <rule> -- <reason>`.
- **Lint result:** 0 errors **and** 0 warnings (baseline has 0 warnings).
- **Commit trailer:** every commit message ends with a blank line followed by `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git commit -F -` with a heredoc.
- **e2e only in Task 6.** `yarn e2e` truncates and reseeds the DB named in `.env`'s `DATABASE_URL`, which is expected. Before `yarn e2e` or `yarn build`, port 3000 must be free (`lsof -ti:3000 | xargs kill` if `lsof -ti:3000` prints anything).
- **Scratch artifacts** go in `docs/superpowers/task-reports/` (gitignored; never `git add -f`). Abbreviated below as `$TR`: start every command that uses it with `TR=docs/superpowers/task-reports &&` (run from the repo root), or substitute the path.
- `src/lint-probe.tsx` must never be committed. The probe script deletes it on exit. `git status --porcelain` must not list it.

### Fast gate (after every task that changes code)

```bash
$N22 && yarn install --frozen-lockfile && npx prisma generate && \
  SKIP_ENV_VALIDATION=1 yarn lint && SKIP_ENV_VALIDATION=1 yarn typecheck && \
  SKIP_ENV_VALIDATION=1 yarn build
```
Expected: every command exits 0. `yarn lint` prints no problems (no `✖` summary line) and no `typescript-eslint` "unsupported version of TypeScript" warning.

## Review Focus

1. **Silent rule loss.** A preset, option or plugin isn't carried over, so lint "passes" because it checks less. Pinned by the rule-set comparison and the probe (Task 1 baseline, Task 2 and Task 6 re-run).
2. **CI fresh checkout.** The `lint` job never builds, so type-aware linting of `e2e/` and `prisma/` depends on the `postinstall`-generated Prisma client and on `next typegen`. Pinned by the fresh-checkout simulation in Tasks 3 and 6.
3. **Ignore list wrong in either direction.** Generated/vendored code gets linted (project-service errors, slow) or real code is skipped. Pinned by the linted-file list assertion in Task 3.
4. **TS 6 module resolution without `baseUrl`.** `~/` aliases must still resolve in `next build`, `tsc`, and `tsx` (`prisma/seed.ts`, also run by Vercel preview builds). Pinned by the build, typecheck and the `tsx` alias probe in Task 4, and the post-push Vercel check in Task 6.
5. **React Compiler fixes changing UI behaviour.** A "fix" for `set-state-in-effect` / `refs` / `purity` can alter rendering in ways no assertion catches. Pinned by the conditional Playwright-MCP smoke check in Task 6 plus the e2e suite.

---

### Task 1: Sync, re-check peers, capture baselines (no commit)

**Files:**
- Create (gitignored, all under `$TR`): `phase-9-preflight.md`, `compare-rules.mjs`, `lint-probe.tsx.txt`, `check-probe.mjs`, `lint-probe.sh`, `before-*.json`, `phase-9-build-before.log`, `phase-9-routes-before.txt`

**Interfaces:**
- Produces: `ESLINT_MAJOR` (9 or 10), `TS_VERSION` (e.g. `6.0.3`), `NEXT_VERSION` (from `package.json`), recorded in `$TR/phase-9-preflight.md`. `node $TR/compare-rules.mjs <before.json> <after.json>` prints `OK: nothing dropped or weakened` or `FAIL: …` and lists DROPPED/WEAKER/OPTIONS/ADDED lines. `bash $TR/lint-probe.sh` (run from repo root) prints `PROBE OK` (exit 0) or `PROBE FAIL (n)` with MISSING/UNEXPECTED lines (exit 1). Baseline print-configs `$TR/before-{trpc,page,env}.json`. Baseline routes `$TR/phase-9-routes-before.txt`.

- [ ] **Step 1: Merge latest `develop`**

```bash
cd /Users/jakubslatinsky/Dev/cm-drozdi-worktrees/chore--upgrade-phase-9-eslint10
git fetch origin
git merge origin/develop -F - <<'EOF'
Merge origin/develop into chore/upgrade-phase-9-eslint10

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: clean merge (the branch only carries the Phase 9 docs). On conflict, stop and report.

- [ ] **Step 2: Confirm Phases 6–8 are merged**

```bash
for b in chore/upgrade-phase-6-tailwind4 feat/upgrade-phase-7-prisma7 chore/upgrade-phase-8-zod4; do
  gh pr list --head "$b" --state merged --json number,mergedAt --jq ".[] | \"$b #\(.number) \(.mergedAt)\""; done
```
Expected: one line per branch. If any phase is not merged, stop and report. Phase 9 runs last.

- [ ] **Step 3: Re-check ESLint 10 peer support and the TS range**

```bash
$N22 && NEXT_VERSION=$(node -p "require('./package.json').dependencies.next") && echo "next $NEXT_VERSION" && \
npm view eslint-config-next@$NEXT_VERSION dependencies peerDependencies --json && \
for p in eslint-plugin-react eslint-plugin-import eslint-plugin-jsx-a11y; do \
  v=$(npm view eslint-config-next@$NEXT_VERSION dependencies.$p); echo "$p $v"; \
  npm view "$p@$v" peerDependencies.eslint | tail -1; done && \
npm view typescript-eslint version peerDependencies --json && \
npm view typescript@'>=6.0.0 <6.1.0' version | tail -1 && npm view eslint@9 version | tail -1 && npm view eslint version
```
Decide and write into `$TR/phase-9-preflight.md` (create `$TR` first):
- `ESLINT_MAJOR=10` only if **all three** plugins' resolved highest versions list `^10` (or `>=10`) in their `eslint` peer. Otherwise `ESLINT_MAJOR=9`. Spec-time answer: 9.
- `ESLINT_SPEC`: `^<latest 9.x>` (9.39.5 at spec time) or `^<latest 10.x>`.
- `TS_VERSION` = highest `6.0.x` that `typescript-eslint`'s `typescript` peer range admits (6.0.3 at spec time; range `>=4.8.4 <6.1.0`). If the range no longer admits any 6.0.x, stop and report. If the range now admits 7.x, still use 6.0.x and note "TS 7 now supported by typescript-eslint" for the follow-up list.
- `NEXT_VERSION`.

- [ ] **Step 4: Audit the current `.eslintrc.cjs`**

`cat .eslintrc.cjs` and compare it with the spec's audit table (Decision 3). Write into `phase-9-preflight.md` every key that is **not** in that table, for example `ignorePatterns: ['src/generated/**']` from Phase 7. Each one must be carried into `eslint.config.mjs` in Task 2: ignore patterns go into `globalIgnores`, rules into the project block, `overrides` become `files`-scoped blocks. Also record the output of:
```bash
ls -d src/generated 2>/dev/null; ls *.mjs 2>/dev/null; git ls-files '*.mjs' ':!:docs/**'
```
These are the generated-client dir (→ ignore) and root `.mjs` files (→ `tsconfig` include in Task 3).

- [ ] **Step 5: Baseline gate + route table**

Run the fast gate, with its build replaced by `$N22 && SKIP_ENV_VALIDATION=1 yarn build 2>&1 | tee $TR/phase-9-build-before.log`. Then:
```bash
grep -E '^[┌├└] ' $TR/phase-9-build-before.log | awk '{print $2, $3}' > $TR/phase-9-routes-before.txt
```
Expected: all green, lint prints nothing, `phase-9-routes-before.txt` is non-empty. If the baseline fails, stop and report; don't fix it in this phase.

- [ ] **Step 6: Capture baseline effective rule sets (ESLint 8)**

```bash
$N22 && npx eslint --print-config src/server/api/trpc.ts > $TR/before-trpc.json && \
  npx eslint --print-config src/app/page.tsx > $TR/before-page.json && \
  npx eslint --print-config src/env.js > $TR/before-env.json
```

- [ ] **Step 7: Write `$TR/compare-rules.mjs`**

```js
// Usage: node compare-rules.mjs before.json after.json  (eslint --print-config output)
import { readFileSync } from 'node:fs';
const sev = (v) => { const s = Array.isArray(v) ? v[0] : v; return ({ off: 0, warn: 1, error: 2 })[s] ?? s; };
const opts = (v) => JSON.stringify(Array.isArray(v) ? v.slice(1) : []);
const [b, a] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')).rules);
let bad = 0;
for (const [k, v] of Object.entries(b)) {
  if (sev(v) === 0) continue;
  if (!(k in a) || sev(a[k]) === 0) { console.log(`DROPPED  ${k} (was ${sev(v)})`); bad++; continue; }
  if (sev(a[k]) < sev(v)) { console.log(`WEAKER   ${k} ${sev(v)} -> ${sev(a[k])}`); bad++; }
  else if (opts(a[k]) !== opts(v)) console.log(`OPTIONS  ${k} ${opts(v)} -> ${opts(a[k])}`);
}
for (const [k, v] of Object.entries(a)) if (sev(v) > 0 && !(k in b && sev(b[k]) > 0)) console.log(`ADDED    ${k}`);
console.log(bad ? `FAIL: ${bad} rule(s) dropped or weakened` : 'OK: nothing dropped or weakened');
```
Sanity check: `node $TR/compare-rules.mjs $TR/before-trpc.json $TR/before-trpc.json` prints only `OK: nothing dropped or weakened`.

- [ ] **Step 8: Write the probe (`$TR/lint-probe.tsx.txt`, `$TR/check-probe.mjs`, `$TR/lint-probe.sh`)**

`$TR/lint-probe.tsx.txt`, exact content (the checker matches the import line and the `onClick=` line). The `.txt` extension matters: `tsconfig.json` includes `**/*.tsx` repo-wide, so a `.tsx` file under `$TR` would break `yarn typecheck` and `yarn build`:
```tsx
'use client';
import { ReactNode, useEffect, useState } from 'react';

export type Shape = { a: Array<string> };
export interface Other {
	b: string;
}

async function noAwait(_unused: number) {
	return 1;
}

export const probeAny = (JSON.parse('{}') as any).foo as string;
export const probeChain = (o?: { x?: { y: number } }) => o && o.x && o.x.y;

export function Probe({ items, label }: { items: string[]; label: ReactNode }) {
	const [n, setN] = useState(0);
	useEffect(() => {
		setN(items.length);
	}, [items]);
	useEffect(() => {
		document.title = String(n);
	}, []);
	const leftover = 1;
	const p = Promise.resolve(1);
	if (p) {
		void noAwait(n);
	}
	return (
		<div>
			{label}
			<img src="/x.png" alt="" />
			<button
				onClick={async () => {
					await noAwait(1);
				}}
			>
				x
			</button>
		</div>
	);
}
```

`$TR/check-probe.mjs`:
```js
// Usage: node check-probe.mjs <eslint-json> <eslint-fix-dry-run-json>
import { readFileSync } from 'node:fs';
const [plain, fixed] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8'))[0]);
const hits = new Set(plain.messages.map((m) => m.ruleId));
const must = [
  '@typescript-eslint/consistent-type-imports', '@typescript-eslint/no-unused-vars',
  '@typescript-eslint/no-misused-promises', '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-unsafe-member-access', '@typescript-eslint/prefer-optional-chain',
  'react-hooks/exhaustive-deps', 'react-hooks/set-state-in-effect', '@next/next/no-img-element',
];
const mustNot = [
  '@typescript-eslint/array-type', '@typescript-eslint/consistent-type-definitions',
  '@typescript-eslint/require-await', null, // null = parsing / project-service error
];
let fail = 0;
for (const r of must) if (!hits.has(r)) { console.log(`MISSING  ${r}`); fail++; }
for (const r of mustNot) if (hits.has(r)) { console.log(`UNEXPECTED ${r ?? 'parse error'}`); fail++; }
const unused = plain.messages.filter((m) => m.ruleId === '@typescript-eslint/no-unused-vars').map((m) => m.message);
if (unused.some((m) => m.includes('_unused'))) { console.log('UNEXPECTED no-unused-vars on _unused (argsIgnorePattern lost)'); fail++; }
if (!unused.some((m) => m.includes('leftover'))) { console.log('MISSING  no-unused-vars on leftover'); fail++; }
const misused = plain.messages.filter((m) => m.ruleId === '@typescript-eslint/no-misused-promises').map((m) => m.line);
const onClickLine = plain.source.split('\n').findIndex((l) => l.includes('onClick=')) + 1;
if (misused.some((l) => l >= onClickLine)) { console.log('UNEXPECTED no-misused-promises on the async onClick (checksVoidReturn.attributes lost)'); fail++; }
if (!fixed.output?.includes("import { type ReactNode, useEffect, useState } from 'react';")) { console.log('MISSING  inline type-import fix'); fail++; }
console.log(fail ? `PROBE FAIL (${fail})` : 'PROBE OK');
process.exit(fail ? 1 : 0);
```

`$TR/lint-probe.sh` (`chmod +x`):
```bash
#!/usr/bin/env bash
# Run from the repo root. Lints a throwaway probe inside src/ (so the TS project
# service covers it), then deletes it. Never commit src/lint-probe.tsx.
set -u
D=docs/superpowers/task-reports
cp "$D/lint-probe.tsx.txt" src/lint-probe.tsx
trap 'rm -f src/lint-probe.tsx' EXIT
npx eslint --format json src/lint-probe.tsx > "$D/probe-plain.json"
npx eslint --format json --fix-dry-run src/lint-probe.tsx > "$D/probe-fixed.json"
node "$D/check-probe.mjs" "$D/probe-plain.json" "$D/probe-fixed.json"
```

- [ ] **Step 9: Run the probe against the old config (expected to fail)**

Run: `$N22 && bash $TR/lint-probe.sh; test ! -e src/lint-probe.tsx && echo cleaned`
Expected, exactly:
```
MISSING  react-hooks/set-state-in-effect
PROBE FAIL (1)
cleaned
```
Any other MISSING/UNEXPECTED line means the probe or the baseline is off. Fix the probe before continuing (record the deviation in `phase-9-preflight.md`).

No commit.

---

### Task 2: Flat config on ESLint 9/10 + `eslint-config-next` 16 (scope still `src`)

**Files:**
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.cjs`
- Modify: `package.json` (deps + `lint` script), `yarn.lock`, `tsconfig.json` (`include`: `.eslintrc.cjs` → `eslint.config.mjs`), `src/server/api/trpc.ts` (~L127), `src/server/auth.ts` (~L31), plus any `src/` file with a new hit

**Interfaces:**
- Consumes: `ESLINT_SPEC`, `NEXT_VERSION`, the extra `.eslintrc.cjs` keys from Task 1 Step 4, `compare-rules.mjs`, `lint-probe.sh`.
- Produces: `eslint.config.mjs` exporting `defineConfig([...])` with, in order: one `globalIgnores([...])` entry (the final ignore list), `...nextVitals`, `...tseslint.configs.recommendedTypeChecked`, `...tseslint.configs.stylisticTypeChecked`, and one project block (`languageOptions.parserOptions` + `rules`). Task 3 doesn't need to edit it.

- [ ] **Step 1: Swap dependencies**

```bash
$N22 && yarn remove @types/eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser && \
  yarn add -D "eslint@$ESLINT_SPEC" "eslint-config-next@$NEXT_VERSION" "typescript-eslint@^8.71.1"
```
(Substitute the values from `phase-9-preflight.md`; `eslint-config-next` has no caret.) Then check:
`yarn list --pattern "typescript-eslint|@typescript-eslint/eslint-plugin" --depth=3 | grep -oE '(typescript-eslint|@typescript-eslint/eslint-plugin)@[0-9.]+' | sort -u`
Expected: exactly one version of each. Two versions would cause "Cannot redefine plugin @typescript-eslint". If so, raise `typescript-eslint` to the version `eslint-config-next` resolves and re-install.

- [ ] **Step 2: Write `eslint.config.mjs`**

```js
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

// eslint-config-next/typescript is intentionally NOT used: it only adds the untyped
// typescript-eslint `recommended` set (covered by recommendedTypeChecked below) and
// would reset no-unused-vars / downgrade no-unused-expressions to 'warn'.
export default defineConfig([
	// eslint-config-next already ignores .next/, out/, build/, next-env.d.ts;
	// node_modules/ and .git/ are ESLint defaults. Flat config does not skip
	// dotfiles or read .gitignore, so generated/vendored paths are listed here.
	globalIgnores([
		'.agents/**', // vendored agent-skill templates (skills-lock.json); not app code, outside the TS program
		'.claude/**', // symlinks into .agents/
		'.vercel/**', // `vercel build` output
		'docs/superpowers/task-reports/**', // gitignored scratch output
		'playwright-report/**', // generated Playwright output
		'test-results/**', // generated Playwright output
	]),
	...nextVitals,
	// The type-checked presets set @typescript-eslint/parser for every file (JS too),
	// replacing Next's Babel parser, as the old root-level `parser` did.
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ prefer: 'type-imports', fixStyle: 'inline-type-imports' },
			],
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{ checksVoidReturn: { attributes: false } },
			],
		},
	},
]);
```
If `src/generated` exists (Task 1 Step 4), add `'src/generated/**', // generated Prisma client (Phase 7)` to `globalIgnores`. Don't pass `globalIgnores` an empty array; it throws. Carry over every extra key recorded in Task 1 Step 4. Ignore patterns go into `globalIgnores([...])`. Rules go into the project block. Each carried key gets a one-line comment naming its origin.

- [ ] **Step 3: Remove the old config; point `tsconfig` at the new one**

`git rm .eslintrc.cjs`. In `tsconfig.json#include`, replace the `".eslintrc.cjs"` entry with `"eslint.config.mjs"`. In `package.json`, set `"lint": "next typegen && eslint src"`.

- [ ] **Step 4: Rule-set comparison**

```bash
$N22 && npx next typegen >/dev/null && \
  npx eslint --print-config src/server/api/trpc.ts > $TR/after-trpc.json && \
  npx eslint --print-config src/app/page.tsx > $TR/after-page.json && \
  npx eslint --print-config src/env.js > $TR/after-env.json && \
  for f in trpc page env; do echo "== $f"; node $TR/compare-rules.mjs $TR/before-$f.json $TR/after-$f.json; done
```
Expected: each block ends with `OK: nothing dropped or weakened`. ADDED lines are the 14 `react-hooks/*` React Compiler rules and `@next/next/no-location-assign-relative-destination`. OPTIONS lines only show ESLint 9 filling in defaults (`dot-notation`, `no-empty-function`, `prefer-const`, `no-unused-expressions`). Any DROPPED/WEAKER line is a bug in the config; fix it, don't accept it. A rule *removed upstream* between plugin versions is the only acceptable exception, and only if its replacement is shown ADDED. Record it in `phase-9-preflight.md`.

- [ ] **Step 5: Probe passes**

Run: `$N22 && bash $TR/lint-probe.sh; test ! -e src/lint-probe.tsx && echo cleaned`
Expected: `PROBE OK` then `cleaned`.

- [ ] **Step 6: Lint `src` and fix the hits**

Run: `$N22 && SKIP_ENV_VALIDATION=1 yarn lint`
Expected hits at spec time (more may come from Phases 6–8):
- `src/server/api/trpc.ts` `prefer-optional-chain` → `if (!ctx.session?.user) {` (`npx eslint --fix` does it).
- `src/server/auth.ts` `prefer-optional-chain` on `return !admin || admin.deletedAt !== null;` → replace with `if (!admin) return true;` and `return admin.deletedAt !== null;` on two lines. Not `admin?.deletedAt !== null`, which has the same truth table but is less clear.
- Any `react-hooks/*` (React Compiler) hit: fix the component (derive state during render instead of `setState` in an effect; key-reset instead of syncing props to state; move impure calls such as `Date.now()`/`Math.random()` out of render; don't read `ref.current` during render). If the only fix changes behaviour or the hit is a library limitation (`incompatible-library`), use a line-level `// eslint-disable-next-line react-hooks/<rule> -- <reason>`. List every touched `src/app/**` file in `phase-9-preflight.md` under "smoke needed".
Re-run until `yarn lint` prints nothing.

- [ ] **Step 7: Fast gate.** Expected: green.

- [ ] **Step 8: Commit**

```bash
git add -A eslint.config.mjs .eslintrc.cjs package.json yarn.lock tsconfig.json src
git status --porcelain   # must not list src/lint-probe.tsx
git commit -F - <<'EOF'
chore(lint): migrate to ESLint flat config with eslint-config-next 16

eslint.config.mjs replaces .eslintrc.cjs: next/core-web-vitals flat preset,
typescript-eslint recommended/stylistic type-checked via projectService, and
every previous rule customization carried over (rule-set diff: nothing
dropped or weakened). Adds the react-hooks v7 React Compiler rules. Drops
@types/eslint and the separate @typescript-eslint/* packages in favour of
the typescript-eslint meta-package. Lint scope is still src/.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
(If `ESLINT_MAJOR=10`, write "ESLint 10" in the body.)

---

### Task 3: Widen lint scope to the whole repo

**Files:**
- Modify: `package.json` (`lint` script), `tsconfig.json` (`include`), `eslint.config.mjs` (only if Step 2 shows a missing ignore), `e2e/global-setup.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/date.ts`, `e2e/specs/members.spec.ts`, `e2e/specs/deleted-member.spec.ts`, plus any `prisma/` / root file with new hits

**Interfaces:**
- Consumes: Task 2's `eslint.config.mjs`; the `src/generated` / root `.mjs` findings from Task 1 Step 4.
- Produces: `"lint": "next typegen && eslint ."`; `$TR/phase-9-linted-files.txt` (sorted relative paths that `eslint .` lints).

- [ ] **Step 1: Scope and project-service coverage**

The ignore list is already in place from Task 2. `tsconfig.json#include`: add `".prettierrc.js"` next to `"eslint.config.mjs"`, plus every root `*.mjs` file found in Task 1 Step 4 other than `eslint.config.mjs`. Don't use `allowDefaultProject`.

`package.json`: `"lint": "next typegen && eslint ."`.

- [ ] **Step 2: Assert the linted file set**

```bash
$N22 && npx next typegen >/dev/null && npx eslint . --format json -o $TR/phase-9-lint.json; \
node -e 'const r=require(process.argv[1]);for(const f of r)console.log(require("path").relative(process.cwd(),f.filePath))' "$PWD/$TR/phase-9-lint.json" | sort > $TR/phase-9-linted-files.txt; \
for f in e2e/global-setup.ts e2e/specs/auth.spec.ts prisma/seed.ts next.config.js playwright.config.ts postcss.config.cjs prettier.config.js .prettierrc.js eslint.config.mjs src/env.js; do \
  grep -qxF "$f" $TR/phase-9-linted-files.txt || echo "NOT LINTED $f"; done; \
grep -E '^(\.agents|\.claude|\.next|\.vercel|node_modules|docs/|playwright-report|test-results|src/generated)/|^next-env\.d\.ts$' $TR/phase-9-linted-files.txt
```
Expected: no output (every listed file is linted, nothing ignored is). If a generated or vendored path shows up, add it to `globalIgnores` with a comment. Also check `prisma.config.ts` is in the list if it exists. Replace `postcss.config.cjs` / `prettier.config.js` with their current names if Phase 6 renamed them.

- [ ] **Step 3: Fix the new hits**

Run: `$N22 && SKIP_ENV_VALIDATION=1 yarn lint`
Expected hits at spec time, with their fixes:
- No `Parsing error: … was not found by the project service`. If there is one, the file belongs in `tsconfig.json#include` (Step 1), or in `globalIgnores` if it's generated or vendored.
- `dot-notation` on `process.env['X']` in `e2e/global-setup.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/date.ts`, `e2e/specs/members.spec.ts` → `process.env.X` (`npx eslint --fix e2e`).
- `e2e/global-setup.ts` `no-explicit-any` / `no-unsafe-*` on `(response.headers as any).getSetCookie?.() ?? (…get('set-cookie')…)` → `const rawCookies = response.headers.getSetCookie();` (typed in the DOM lib, native in Node 22).
- `e2e/specs/deleted-member.spec.ts` `no-unsafe-member-access` on `APIResponse.json()` (returns `any`): `(await before.json())?.user?.id` → `((await before.json()) as { user?: { id?: string } } | null)?.user?.id`, and both `(await list.json()).code` → `((await list.json()) as { code?: string }).code`.
- Anything else in `e2e/`, `prisma/` or root configs (for example from Phase 7's `prisma.config.ts` or `e2e/helpers/db.ts` changes) gets the same treatment: real types over casts to `any`, no disables unless justified per Global Constraints.
Re-run until `yarn lint` prints nothing.

- [ ] **Step 4: Fresh-checkout simulation (CI `lint` job)**

```bash
$N22 && rm -rf .next next-env.d.ts && yarn install --frozen-lockfile && SKIP_ENV_VALIDATION=1 yarn lint
```
Expected: passes with no output from ESLint. (`postinstall` regenerates the Prisma client and `next typegen` regenerates `next-env.d.ts`.)

- [ ] **Step 5: Fast gate.** Expected: green.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs package.json tsconfig.json e2e prisma
git status --porcelain   # only intended files; no src/lint-probe.tsx
git commit -F - <<'EOF'
chore(lint): lint the whole repo, not just src/

`yarn lint` now runs `eslint .`, covering e2e/, prisma/ and root config
files; .prettierrc.js joins the TS program so the type-aware rules can
parse it. Fixes the new hits:
dot-notation on process.env, untyped Headers#getSetCookie cast and
unsafe access on Playwright APIResponse.json().

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: TypeScript 6.0.x

**Files:**
- Modify: `package.json`, `yarn.lock`, `tsconfig.json` (remove `baseUrl`, add `types`), plus any file with a new TS 6 error

**Interfaces:**
- Consumes: `TS_VERSION` from Task 1.
- Produces: `typescript` `~$TS_VERSION`; `tsconfig.json` without `baseUrl` and with `"types": ["node"]`.

- [ ] **Step 1: Bump**

Run: `$N22 && yarn add -D "typescript@~$TS_VERSION"`. Then `npx tsc -v` prints `Version 6.0.x`.

- [ ] **Step 2: See the failure**

Run: `$N22 && SKIP_ENV_VALIDATION=1 yarn typecheck`
Expected: fails with `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`.

- [ ] **Step 3: Fix `tsconfig.json`**

- Delete `"baseUrl": "."`. The `paths` entries are already `./`-prefixed and resolve relative to `tsconfig.json`. Confirm nothing relied on `baseUrl` as a lookup root: `git grep -nE "from ['\"](src|e2e|prisma|public)/" -- '*.ts' '*.tsx' '*.js' '*.mjs'` prints nothing.
- Add `"types": ["node"]` to `compilerOptions`. TS 6 defaults `types` to `[]`, and Node globals would otherwise arrive only through Next's type references.
- Don't add `ignoreDeprecations`. Don't touch `lib`, `target`, `module`, `moduleResolution`, `strict`.

- [ ] **Step 4: Typecheck passes**

Run: `$N22 && SKIP_ENV_VALIDATION=1 yarn typecheck`
Expected: exit 0. Any other TS 6 error (for example stricter generic-call/JSX inference, or `noUncheckedSideEffectImports` on a side-effect import) is fixed in code: add an explicit type argument, or a `declare module` for a real side-effect import. Never use `@ts-expect-error` or `ignoreDeprecations`. Then check `git grep -n ignoreDeprecations` prints nothing.

- [ ] **Step 5: `tsx` alias probe (seed / Vercel preview path)**

```bash
$N22 && printf "import { UserRole } from '~/enums/UserRole';\nconsole.log('ALIAS OK', Object.values(UserRole).join(','));\n" > prisma/alias-probe.ts && \
  npx tsx prisma/alias-probe.ts; rm -f prisma/alias-probe.ts
```
Expected: `ALIAS OK guest,member,admin`, and `prisma/alias-probe.ts` is gone afterwards. If `src/enums/UserRole.ts` no longer exists, import any other `~/` module that has no side effects.

- [ ] **Step 6: Lint under TS 6**

Run: `$N22 && SKIP_ENV_VALIDATION=1 yarn lint 2>&1 | tee $TR/phase-9-lint-ts6.log; grep -i "SUPPORTED TYPESCRIPT\|not officially supported" $TR/phase-9-lint-ts6.log`
Expected: lint passes with no problems, and the grep prints nothing. Fix any new type-aware hits as in Task 3 Step 3.

- [ ] **Step 7: Fast gate**, then check the route table is unchanged:
```bash
$N22 && SKIP_ENV_VALIDATION=1 yarn build 2>&1 | tee $TR/phase-9-build-after.log >/dev/null && \
  grep -E '^[┌├└] ' $TR/phase-9-build-after.log | awk '{print $2, $3}' | diff $TR/phase-9-routes-before.txt -
```
Expected: no diff. `git diff tsconfig.json` shows only the `baseUrl` removal and the `types` line (the build must not rewrite `tsconfig.json`; if it does, inspect and commit only intended lines).

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock tsconfig.json   # plus any files fixed in Steps 4/6
git commit -F - <<'EOF'
chore: TypeScript 5.9 -> 6.0

Highest 6.0.x within typescript-eslint's supported range (TS 7 deferred).
Fixes the TS 6 deprecations instead of using ignoreDeprecations: drop
baseUrl (paths are already ./-relative) and list "types": ["node"] now that
types defaults to [].

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Update `CLAUDE.md` and the master plan

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`

**Interfaces:** docs only. Describe what the branch actually contains (ESLint 9 or 10, resolved versions from `yarn list --pattern "eslint|eslint-config-next|typescript-eslint|typescript" --depth=0`).

- [ ] **Step 1: `CLAUDE.md`**

- Commands → `yarn lint` line becomes: "`yarn lint` — `next typegen` then ESLint <9|10> flat config (`eslint.config.mjs`: `eslint-config-next` core-web-vitals + `typescript-eslint` type-checked presets) over the whole repo (`eslint .`)."
- Commands → `./start-database.sh` line: leave it (its removal is a separate post-Phase-9 cleanup).
- Change nothing else unless it names `.eslintrc.cjs`, ESLint 8, `eslint src`, or TypeScript 5. `git grep -n "eslintrc\|ESLint 8\|eslint src\|TypeScript 5" CLAUDE.md` must print nothing afterwards.

- [ ] **Step 2: Master plan**

- **Tracking table, Phase 9 row:** if `gh pr list --head chore/upgrade-phase-9-eslint10 --json number --jq '.[0].number'` prints `N`, use `[#N](https://github.com/SlatinskyJ/cm-drozdi/pull/N)`; otherwise `in progress (branch chore/upgrade-phase-9-eslint10; PR link added when opened)`. Also fix the Phase 6, 7 and 8 rows if they still say "not started" (look up each PR number with `gh pr list --head <branch> --state all`).
- **Version gap table:** `eslint` row → current `^9.39` (or `^10.x`), target unchanged, Jump "done (Phase 9) — 10 pending plugin peers" (or "done (Phase 9)"). `typescript` row → `~6.0.x`, Jump "done (Phase 9) — TS 7 deferred".
- **Phase 9 section:** append one bullet: "Outcome: ESLint <9|10> (`eslint-plugin-react/import/jsx-a11y` peers capped at `^9` on <date>), `eslint.config.mjs`, `eslint .`, TS <version>; see spec `docs/superpowers/specs/2026-10-12-phase-9-eslint-flat-ts6.md`."
- **Post-Phase-9 cleanup paragraph:** add the follow-ups: ESLint 10 when the three plugins declare `^10` (skip if already on 10); TypeScript 7 when `typescript-eslint` supports it; Prettier config shadowing (`.prettierrc.js` overrides `prettier.config.js`, so `prettier-plugin-tailwindcss` is inactive; merging reformats the codebase; that PR also removes `.prettierrc.js` from `tsconfig.json#include`).

- [ ] **Step 3: Check:** `git diff --stat` lists only these two files.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
git commit -F - <<'EOF'
docs: update CLAUDE.md and master plan for Phase 9

Lint is now an ESLint flat config over the whole repo and TypeScript is
6.0. Master plan: Phase 9 tracking row, version table, outcome note, and
the ESLint 10 / TS 7 / Prettier-shadowing follow-ups.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Final gate and verification report

**Files:** none expected. Fixes go in their own `fix:` commits with the trailer. The report goes to `$TR/phase-9-verification.md` (gitignored, input for the PR description).

- [ ] **Step 1: Re-sync if `develop` moved.** `git fetch origin && git log --oneline HEAD..origin/develop`. If that prints commits, merge as in Task 1 Step 1 and re-run the fast gate. Re-run Task 3 Step 2 if the merge added files.

- [ ] **Step 2: Full gate.** Fast gate, then (port 3000 free) `$N22 && yarn e2e`. Expected: every spec passes, 0 failed, 0 flaky.

- [ ] **Step 3: Equivalent-or-stricter, final.** Re-run Task 2 Step 4 (all three print `OK: nothing dropped or weakened`) and Task 2 Step 5 (`PROBE OK`). Run `git status --porcelain` and confirm it is empty (no probe file left).

- [ ] **Step 4: Fresh-checkout simulation, both CI jobs**

```bash
$N22 && rm -rf .next next-env.d.ts && yarn install --frozen-lockfile && SKIP_ENV_VALIDATION=1 yarn lint && \
  rm -rf .next next-env.d.ts && npx prisma generate && SKIP_ENV_VALIDATION=1 yarn typecheck
```
Expected: both pass.

- [ ] **Step 5: Smoke (conditional).** Only if `phase-9-preflight.md` lists "smoke needed" files. Reseed (`$N22 && yarn db:seed:local`) and start `yarn start` in the background. Then, with the `mcp__playwright__browser_*` tools against `http://localhost:3000`, log in as the seeded admin (credentials are in `prisma/seed.ts` / `e2e/global-setup.ts`; don't copy them into reports) and exercise every screen that renders a touched component. Check that `browser_console_messages` (level error) shows no React errors. Stop the server with `lsof -ti:3000 | xargs kill`. Record pass/fail per screen.

- [ ] **Step 6: Final greps**

```bash
ls .eslintrc* 2>/dev/null; \
git grep -n "ignoreDeprecations\|eslint-config-next/typescript\|tseslint.config(" ; \
node -p "const p=require('./package.json');['@types/eslint','@typescript-eslint/eslint-plugin','@typescript-eslint/parser'].filter(k=>p.devDependencies[k]||p.dependencies[k]).join(',')" ; \
git grep -n "eslint-disable" -- src e2e prisma ':!src/generated' ; \
git diff --stat origin/develop -- .github next.config.js
```
Expected: no `.eslintrc*`, no `git grep` hits for the first pattern, an empty line from `node -p`, and the `.github`/`next.config.js` diff empty. Every `eslint-disable` hit must be either the pre-existing `src/app/page.tsx` directive or a new line-level one carrying a `-- <reason>`.

- [ ] **Step 7: Write the report** `$TR/phase-9-verification.md`: resolved versions (`yarn list --pattern "eslint|eslint-config-next|typescript-eslint|typescript|eslint-plugin-react-hooks" --depth=0`), `ESLINT_MAJOR` and the peer evidence from Task 1, the rule-set comparison output (ADDED list), probe results before/after, the linted-file count, the list of fixed hits by file, any rule disabled with its justification, route-table diff ("identical"), e2e summary line, smoke results or "not needed", and the **post-push checklist** for the PR author: "CI lint/typecheck/e2e green; Vercel preview deployment READY (`vercel-build` runs `tsx` seed + `next build` on TS 6); `/events` loads on the preview."

- [ ] **Step 8:** `git status --porcelain` is empty. `git log --oneline origin/develop..HEAD` lists the merge commit(s), Tasks 2–5, and any `fix:` commits. Stop here and hand off to the orchestrator for the PR.
