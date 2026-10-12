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
		'src/generated/**', // generated Prisma client (Phase 7; was .eslintrc.cjs ignorePatterns)
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
