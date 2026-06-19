# Phase 4 — Finish shadcn migration, remove NextUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every NextUI component with shadcn/ui equivalents, remove all NextUI/framer-motion/@internationalized-date/moment dependencies, and redesign the event date field from a date-range to start+duration — while keeping the existing custom color palette and all e2e specs green.

**Architecture:** One commit per component family, ordered so that shared primitives (Button, Skeleton, Tooltip, Badge, DropdownMenu) land before the composite screens that consume them (Dialog/Card screens, the event form). `shadcn add <name>` always runs immediately after `git rm`-ing any same-named legacy wrapper, never before, to avoid macOS case-insensitive filesystem collisions between e.g. `Button.tsx` and the CLI-generated `button.tsx`. NextUI packages and the `nextui()` Tailwind plugin are removed only in the final cleanup commit, after every consumer has been migrated — removing them earlier would unstyle any NextUI component still in the tree.

**Tech Stack:** Next.js 14 (App Router), Tailwind 3, shadcn/ui (Radix primitives + `class-variance-authority`), `react-day-picker`, `date-fns`, react-hook-form, Playwright.

## Global Constraints

- Stay on branch `feat/upgrade-phase-4-shadcn`, forked from `develop`.
- **No color values change.** The existing palette in `tailwind.config.ts` (`primary #9c7243`, `secondary #bdd086`, `accent #85a042`, `dark #5a3d2d`, `background #E6DFC4`, `danger #ed5122`/`success #687f31`/`warning #fade15`/`unknown #7152ff`, plus `default`/`green`/`orange`/`yellow`/`blue` 50–900 scales) stays in `theme.extend.colors`, untouched, until the final cleanup task only removes the `nextui()` plugin entry — the colors themselves are never edited.
- Do **not** touch `react`, `next`, `prisma`, `tailwindcss` (major), `zod`, `eslint`, `better-auth` versions.
- Every legacy wrapper file (`Button.tsx`, `Calendar.tsx`, `Dropdown.tsx`, `Chip.tsx`, `Skeleton.tsx`, `Tooltip.tsx`) must be `git rm`'d in the same task, before `npx shadcn@latest add <component>` is run for its replacement — never let an uppercase legacy file and the lowercase shadcn-generated file of the same name coexist, even momentarily, since macOS's default case-insensitive filesystem treats them as the same path.
- Fast gate after every task: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`. Must pass clean before moving to the next task. `yarn e2e` is run only after Task 11 (event form) and again as the final Task 16 gate — not after every single task, since most intermediate tasks leave NextUI and shadcn coexisting and some screens mid-migration.
- `grep -r "@nextui-org\|framer-motion\|@internationalized/date" src/ package.json` must be empty only after Task 14 (dependency cleanup) — it will show matches throughout earlier tasks and that's expected.
- This phase found 4 NextUI-direct-import consumers beyond the spec's audited list of files that exist purely because the spec only grepped for `@nextui-org` imports, not for imports of our own `@components/ui/*` wrappers: `Menu.tsx`, `EditableState.tsx`, `CalendarSkeleton.tsx`, `EventCalendar.tsx`, `ResetPasswordSkeleton.tsx`, `MembersSkeleton.tsx`, `CreateMemberForm.tsx`, `reset-password/page.tsx`, `login/LoginForm.tsx`, `events/_components/DeleteEvent.tsx` all import our wrappers and must have their import paths (and in Button's case, prop names) updated even though they were not in the spec's file list.

---

### Task 1: Bootstrap shadcn — deps, `cn()`, `components.json`

**Files:**
- Modify: `package.json` (add `date-fns`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`)
- Create: `src/lib/utils.ts`
- Create: `components.json`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `cn(...inputs: ClassValue[]): string` from `src/lib/utils.ts`, used by every shadcn component generated in later tasks. `components.json` aliases used by every `npx shadcn@latest add` call in later tasks.

- [ ] **Step 1: Add dependencies**

Run:
```bash
yarn add date-fns clsx tailwind-merge class-variance-authority tailwindcss-animate
```
Expected: resolves clean, `package.json`/`yarn.lock` updated. (`tailwindcss-animate` is shadcn's standard animation plugin for Tailwind 3 — the TW4 equivalent `tw-animate-css` is Phase 6's concern, not this one.)

- [ ] **Step 2: Create `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `components.json`**

```json
{
	"$schema": "https://ui.shadcn.com/schema.json",
	"style": "new-york",
	"rsc": true,
	"tsx": true,
	"tailwind": {
		"config": "tailwind.config.ts",
		"css": "src/styles/globals.css",
		"baseColor": "neutral",
		"cssVariables": true,
		"prefix": ""
	},
	"aliases": {
		"components": "@components",
		"utils": "~/lib/utils",
		"ui": "@components/ui",
		"lib": "~/lib",
		"hooks": "~/hooks"
	}
}
```

This maps shadcn's `ui` alias onto the existing `@components/ui/*` → `src/app/_components/ui/*` path from `tsconfig.json`, so `npx shadcn@latest add <x>` writes straight into the directory that already holds the legacy wrappers.

- [ ] **Step 4: Add the Tailwind animate plugin to `tailwind.config.ts`**

In `tailwind.config.ts`, add to the existing `plugins` array (alongside `nextui(...)`, which stays for now):
```typescript
import tailwindcssAnimate from 'tailwindcss-animate';
```
and add `tailwindcssAnimate` as an entry in `plugins: [nextui({...}), tailwindcssAnimate]`.

- [ ] **Step 5: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean (no files reference the new utilities yet, so this just confirms the dependency install and config edit didn't break anything).

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock src/lib/utils.ts components.json tailwind.config.ts
git commit -m "chore: bootstrap shadcn/ui tooling"
```

---

### Task 2: Date utilities — `date.ts` partial migration to `date-fns`

Independent of every UI task; do it early so later tasks (Calendar, EventForm) can lean on `date-fns` directly. `parseDateJStoCalendarDateTime` stays for now — it is still consumed by `Calendar.tsx` and `useEventForm.ts`, both migrated in later tasks; deleting it here would break the build.

**Files:**
- Modify: `src/utils/date.ts`
- Modify: `src/app/events/_components/EventValues.tsx`
- Modify: `src/server/api/trpc.ts:1-20` (the `addMinutes` import and `dateMiddleware`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `formatDuration(start: Date, end: Date): string` and `formatDateToTime(date: Date): string` from `src/utils/date.ts`, consumed by `EventValues.tsx` in this same task. `date-fns`'s `addMinutes` imported directly at the `trpc.ts` call site (no longer re-exported from `date.ts`).

- [ ] **Step 1: Rewrite the non-NextUI exports in `src/utils/date.ts`**

Replace the whole file with:
```typescript
import {
	type CalendarDateTime,
	parseDateTime,
} from '@internationalized/date';
import { differenceInMinutes, format } from 'date-fns';

export function formatDuration(start: Date, end: Date): string {
	const minutes = differenceInMinutes(end, start);
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

export function parseDateJStoCalendarDateTime(date: Date): CalendarDateTime {
	return parseDateTime(date.toISOString().slice(0, -1));
}

export function formatDateToTime(date: Date): string {
	return format(date, 'H:mm');
}
```

This drops `getTimeDiff`, `formatTime`, `addMinutes`, the `moment` import, and the `lodash floor` import — `formatDuration` collapses `getTimeDiff`+`formatTime` into one function producing the same `"H:MM"` output (no leading zero on hours, zero-padded minutes). `parseDateJStoCalendarDateTime` is untouched (still needed until Task 10).

- [ ] **Step 2: Update `EventValues.tsx`**

In `src/app/events/_components/EventValues.tsx`, replace:
```typescript
import { formatDateToTime, formatTime, getTimeDiff } from '~/utils/date';
```
with:
```typescript
import { formatDateToTime, formatDuration } from '~/utils/date';
```
and replace:
```typescript
	const timeDiff =
		(!!event.start && !!event.end && getTimeDiff(event.start, event.end)) ??
		null;
```
```typescript
	const duration =
		!!event.start && !!event.end
			? formatDuration(event.start, event.end)
			: null;
```
and the `KeyValue` for "Délka" from:
```typescript
			<KeyValue
				label="Délka"
				value={!!timeDiff ? formatTime(timeDiff) : null}
				withHover={withHover}
			/>
```
to:
```typescript
			<KeyValue label="Délka" value={duration} withHover={withHover} />
```

- [ ] **Step 3: Update `src/server/api/trpc.ts`**

Replace:
```typescript
import { addMinutes } from '~/utils/date';
```
with:
```typescript
import { addMinutes } from 'date-fns';
```
The call site (`addMinutes(value, offset)` inside `dateMiddleware`) is unchanged — `date-fns`'s `addMinutes(date: Date, amount: number): Date` has the same signature as the deleted custom helper.

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 5: Manual smoke check**

Run `yarn dev`, open `/events`, open an existing event's detail view, confirm "Čas" and "Délka" still render the same values as before (e.g. an event 14:00–15:30 shows Čas `14:00`, Délka `1:30`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/date.ts src/app/events/_components/EventValues.tsx src/server/api/trpc.ts
git commit -m "refactor: migrate date.ts duration/time helpers to date-fns"
```

---

### Task 3: Skeleton migration

**Files:**
- Delete: `src/app/_components/ui/Skeleton.tsx`
- Create (via CLI): `src/app/_components/ui/skeleton.tsx`
- Modify: `src/app/_components/ui/skeletons/EventSkeleton.tsx`
- Modify: `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`
- Modify: `src/app/reset-password/ResetPasswordSkeleton.tsx`
- Modify: `src/app/members/_components/MembersSkeleton.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Skeleton` component from `@components/ui/skeleton` (lowercase path), a drop-in replacement — same `className`-only API as the NextUI version, consumed by the four files above in this same task and by no later task.

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Skeleton.tsx
npx shadcn@latest add skeleton
```
Expected: creates `src/app/_components/ui/skeleton.tsx` exporting `Skeleton` as a plain `<div className={cn('animate-pulse rounded-md bg-muted', className)} />`.

- [ ] **Step 2: Update the four consumers' import paths**

In each of `src/app/_components/ui/skeletons/EventSkeleton.tsx`, `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`, `src/app/reset-password/ResetPasswordSkeleton.tsx`, `src/app/members/_components/MembersSkeleton.tsx`, change:
```typescript
import { Skeleton } from '@components/ui/Skeleton';
```
to:
```typescript
import { Skeleton } from '@components/ui/skeleton';
```
No other changes in these four files yet — `EventSkeleton.tsx` and `CalendarSkeleton.tsx` still reference NextUI `Card`/`Divider` and NextUI-only utility classes (`rounded-large`, `bg-content1`, `shadow-small`, `text-default-400`) at this point; those are migrated in Task 8. Leave them as-is for now.

- [ ] **Step 3: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: migrate Skeleton to shadcn"
```

---

### Task 4: Button migration

NextUI's `Button` is used with `color` (primary/danger), `variant` (e.g. `ghost`), `isLoading`, `isDisabled`, and `radius="full"` — none of which match shadcn's generated button's vocabulary exactly. The edited `button.tsx` keeps shadcn's standard `variant` prop name (not renamed) but replaces its value set with this app's NextUI-derived semantics (`primary`/`destructive`/`destructive-ghost`/etc., collapsing NextUI's two axes — `color` + `variant` — into shadcn's single `variant` axis), adds an `isLoading` prop that renders a spinner and forces `disabled`, and keeps `isDisabled` as an additional accepted prop name (mapped onto the native `disabled` attribute). Every call site's `color="..."`/`variant="..."` prop is renamed to `variant="..."` with the value mapped onto the new vocabulary (`danger`→`destructive`; `ghost` and `primary` keep their names) — see Step 3 for the full list. `radius="full"` (used once) is dropped in favor of an explicit `rounded-full` class at its one call site.

**Files:**
- Delete: `src/app/_components/ui/Button.tsx`
- Create (via CLI, then hand-edited): `src/app/_components/ui/button.tsx`
- Modify (import path `@components/ui/Button` → `@components/ui/button`, prop renamed `color`→`variant`, value unchanged): `src/app/_components/Menu.tsx`, `src/app/members/_components/CreateMemberForm.tsx`, `src/app/reset-password/page.tsx`, `src/app/login/LoginForm.tsx`
- Modify (import path + prop renamed `color="danger"` → `variant="destructive"`): `src/app/events/_components/DeleteEvent.tsx`
- Modify (import path + prop renamed + `radius` removal): `src/app/events/_components/RequestEvent.tsx`
- Modify (import path + prop renamed only — surrounding `Modal`/`Dialog` shell stays untouched until Task 8): `src/app/members/page.tsx`, `src/app/events/_components/EventDetailModal.tsx`. The new `Button` no longer accepts NextUI's old prop vocabulary (`color`, two-axis `variant`), so the fast gate's `tsc` step would fail on these two files between Task 4 and Task 8 if only the import path changed — the prop values must be renamed now even though the JSX shell around them isn't rewritten until Task 8.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Button` from `@components/ui/button`, props `variant?: 'default' | 'primary' | 'destructive' | 'destructive-ghost' | 'ghost' | 'outline' | 'secondary' | 'link'`, `size?: 'default' | 'sm' | 'lg' | 'icon' | 'xl'`, `isLoading?: boolean`, `isDisabled?: boolean`, plus native `<button>` props (`disabled`, `type`, `onClick`, `className`, etc.). Consumed by every later task that renders a button (8, 11).

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Button.tsx
npx shadcn@latest add button
```
Expected: creates `src/app/_components/ui/button.tsx` with shadcn's default `buttonVariants` cva (`variant`: default/destructive/outline/secondary/ghost/link; `size`: default/sm/lg/icon) and a `Button` component.

- [ ] **Step 2: Hand-edit `src/app/_components/ui/button.tsx`**

Replace the generated file's contents with:
```typescript
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-secondary text-dark hover:bg-secondary/80',
				primary: 'bg-primary text-white hover:bg-primary/90',
				destructive: 'bg-danger text-white hover:bg-danger/90',
				'destructive-ghost':
					'text-danger hover:bg-danger/10',
				ghost: 'hover:bg-accent/20',
				outline:
					'border border-dark/20 bg-transparent hover:bg-accent/10',
				secondary: 'bg-secondary text-dark hover:bg-secondary/80',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-9 px-4 py-2',
				sm: 'h-8 rounded-md px-3 text-xs',
				lg: 'h-10 rounded-md px-8',
				xl: 'p-8 text-xl font-semibold',
				icon: 'h-9 w-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
	isLoading?: boolean;
	isDisabled?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant,
			size,
			asChild = false,
			isLoading,
			isDisabled,
			disabled,
			children,
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				disabled={disabled ?? isDisabled ?? isLoading}
				{...props}
			>
				{isLoading ? <Loader2 className="animate-spin" /> : null}
				{children}
			</Comp>
		);
	},
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

`destructive-ghost` covers the existing `color="danger" variant="ghost"` combination (used by "Zavřít"/"Zrušit" buttons in Task 8) as a single variant value, since shadcn only has one variant axis. `lucide-react` is shadcn's standard icon dependency — installed automatically by the `shadcn add button` CLI run in Step 1 (confirm with `yarn why lucide-react` if unsure; add it explicitly via `yarn add lucide-react` if the CLI didn't).

- [ ] **Step 3: Update import paths and rename `color`→`variant` at every consumer**

In `src/app/_components/Menu.tsx`, `src/app/members/_components/CreateMemberForm.tsx`, `src/app/reset-password/page.tsx`, `src/app/login/LoginForm.tsx`, `src/app/events/_components/DeleteEvent.tsx`, `src/app/members/page.tsx`, `src/app/events/_components/EventDetailModal.tsx`, `src/app/events/_components/RequestEvent.tsx`, change:
```typescript
import { Button } from '@components/ui/Button';
```
to:
```typescript
import { Button } from '@components/ui/button';
```
Then rename every `color="..."` prop on `Button` to `variant="..."` across all eight files: `CreateMemberForm.tsx`'s, `reset-password/page.tsx`'s, and `LoginForm.tsx`'s `color="primary"` each become `variant="primary"`. `DeleteEvent.tsx`'s `color="danger"` becomes `variant="destructive"`. `members/page.tsx`'s existing NextUI `variant="ghost"` (a *different*, already-present prop from NextUI's own two-axis Button) stays `variant="ghost"` unchanged — it already happens to match the new vocabulary — and its `color="danger"` becomes `variant="destructive"`. `EventDetailModal.tsx`'s `color="destructive-ghost"` and `color="primary"` (×2) become `variant="destructive-ghost"` and `variant="primary"`. `RequestEvent.tsx` is handled in Step 4 below (it also needs the `radius` removal). All other props (`isLoading`, `disabled`, `type="submit"`) are unchanged — the new component accepts them as-is. Note: `members/page.tsx` and `EventDetailModal.tsx`'s surrounding `Modal`/`ModalFooter`/`ModalBody` markup is still NextUI at this point — only the `Button` prop values change here; the full Modal→Dialog rewrite happens in Task 8.

- [ ] **Step 4: Update `RequestEvent.tsx`'s floating action button**

In `src/app/events/_components/RequestEvent.tsx`, change:
```typescript
			<Button
				className="fixed bottom-12 right-3 z-50 text-2xl shadow-lg lg:bottom-14 lg:right-5"
				radius="full"
				color="primary"
				size="xl"
				onClick={onOpen}
			>
```
to:
```typescript
			<Button
				className="fixed bottom-12 right-3 z-50 rounded-full text-2xl shadow-lg lg:bottom-14 lg:right-5"
				variant="primary"
				size="xl"
				onClick={onOpen}
			>
```
(`radius="full"` dropped, `rounded-full` added to `className`; `color`→`variant` renamed per Step 3). Leave the rest of `RequestEvent.tsx` (the `Modal`/`useDisclosure` import and JSX) untouched — that's Task 8.

- [ ] **Step 5: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 6: Manual smoke check**

Run `yarn dev`. Check: `/login` submit button renders primary-colored; `/members` "Kopírovat odkaz"/"Smazat" buttons render; the floating "Rezervovat" button on `/` is a filled circle in the bottom-right corner, primary-colored, unchanged position.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate Button to shadcn"
```

---

### Task 5: Tooltip migration

NextUI's `Tooltip` is a single self-contained component (`content` prop + one child trigger). shadcn's generated `tooltip.tsx` is three composable Radix parts (`Tooltip`/`TooltipTrigger`/`TooltipContent`) plus a `TooltipProvider`. To keep the two call sites (`KeyValue.tsx`, `Event.tsx`) unchanged in shape, the edited file keeps the Radix root renamed to `TooltipRoot` internally and exports a drop-in `Tooltip` that composes all three parts behind the same `content`/`delay`/`size`/`isDisabled` props NextUI had.

**Files:**
- Delete: `src/app/_components/ui/Tooltip.tsx`
- Create (via CLI, then hand-edited): `src/app/_components/ui/tooltip.tsx`
- Modify: `src/app/_components/KeyValue.tsx`
- Modify: `src/app/_components/Providers.tsx` (add `TooltipProvider` — see Task 9, not here; this task only changes the import path, no JSX, in `KeyValue.tsx`)

**Interfaces:**
- Consumes: `cn` from `src/lib/utils.ts` (Task 1).
- Produces: `Tooltip` from `@components/ui/tooltip` with props `{ content: React.ReactNode; delay?: number; size?: 'default' | 'xl'; isDisabled?: boolean; children: React.ReactNode }`, consumed by `KeyValue.tsx` (this task) and `Event.tsx` (Task 8). Also exports `TooltipProvider` for `Providers.tsx` (Task 9) to wrap the app in.

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Tooltip.tsx
npx shadcn@latest add tooltip
```
Expected: creates `src/app/_components/ui/tooltip.tsx` exporting `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider` (Radix-based).

- [ ] **Step 2: Hand-edit `src/app/_components/ui/tooltip.tsx`**

Append to the generated file (keep the existing `TooltipProvider`/`TooltipTrigger`/`TooltipContent` exports, and rename the generated `Tooltip` export to `TooltipRoot` everywhere it's defined/used in the file), then add:
```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const tooltipContentVariants = cva('', {
	variants: {
		size: {
			default: '',
			xl: 'text-2xl',
		},
	},
	defaultVariants: {
		size: 'default',
	},
});

export function Tooltip({
	content,
	delay,
	size,
	isDisabled,
	children,
}: Readonly<{
	content: React.ReactNode;
	delay?: number;
	size?: VariantProps<typeof tooltipContentVariants>['size'];
	isDisabled?: boolean;
	children: React.ReactNode;
}>) {
	if (isDisabled) return <>{children}</>;

	return (
		<TooltipRoot delayDuration={delay}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent className={cn(tooltipContentVariants({ size }))}>
				{content}
			</TooltipContent>
		</TooltipRoot>
	);
}
```
Add `import { cn } from '~/lib/utils';` to the top of the file if not already present from the CLI-generated boilerplate.

- [ ] **Step 3: Update `KeyValue.tsx`**

In `src/app/_components/KeyValue.tsx`, change:
```typescript
import { Tooltip } from '@nextui-org/tooltip';
```
to:
```typescript
import { Tooltip } from '@components/ui/tooltip';
```
No other changes — `content`, `delay={500}`, `isDisabled` props are all still accepted by the new `Tooltip`.

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean. (`TooltipProvider` isn't wrapped around the app yet — Radix's `TooltipTrigger`/`TooltipContent` render fine without a `TooltipProvider` ancestor in dev, but hover delay falls back to Radix defaults until Task 9 adds the provider with `delayDuration`. This is a temporary, untested intermediate state, not user-facing yet since nothing renders the new `Tooltip` outside this file until Task 8.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate Tooltip to shadcn"
```

---

### Task 6: Badge (Chip) migration

**Files:**
- Delete: `src/app/_components/ui/Chip.tsx`
- Create (via CLI, then hand-edited): `src/app/_components/ui/badge.tsx`
- Modify: `src/app/events/_utils/formatEventState.ts`

**Interfaces:**
- Consumes: `cn` from `src/lib/utils.ts` (Task 1).
- Produces: `Badge` + `type BadgeProps` from `@components/ui/badge`, `variant` prop (shadcn's standard prop name, kept consistent with Button's Task 4 rename) accepting `'default' | 'warning' | 'success' | 'destructive' | 'unknown'` (value renamed from NextUI's `danger` → `destructive` to match Button's naming, see Step 3). Consumed by `formatEventState.ts` (this task, for the `BadgeProps['variant']` type) and by `Event.tsx`/`EditableState.tsx` (Task 8).

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Chip.tsx
npx shadcn@latest add badge
```
Expected: creates `src/app/_components/ui/badge.tsx` with a default `badgeVariants` cva (`variant`: default/secondary/destructive/outline).

- [ ] **Step 2: Hand-edit `src/app/_components/ui/badge.tsx`**

Replace the generated file's `badgeVariants` and component with:
```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-default-100 text-dark',
				warning: 'border-transparent bg-warning text-dark',
				success: 'border-transparent bg-success text-default-100',
				destructive: 'border-transparent bg-danger text-white',
				unknown: 'border-transparent bg-unknown text-default-100',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
```
This preserves all 5 of the original `Chip.tsx`'s color treatments (`default`/`danger`→`destructive`/`success`/`unknown` explicitly styled, `warning` newly given explicit `bg-warning text-dark` styling since NextUI's built-in warning palette is no longer available).

- [ ] **Step 3: Update `formatEventState.ts`**

In `src/app/events/_utils/formatEventState.ts`, change:
```typescript
import { type ChipProps } from '@components/ui/Chip';
```
to:
```typescript
import { type BadgeProps } from '@components/ui/badge';
```
and:
```typescript
export type TFormatEventStateReturn = {
	label: string;
	color: ChipProps['color'];
	value: EventState;
};
```
to:
```typescript
export type TFormatEventStateReturn = {
	label: string;
	color: BadgeProps['variant'];
	value: EventState;
};
```
(the `TFormatEventStateReturn.color` field name stays `color` — it's this app's own data-shape field describing a semantic color, not a passthrough of Badge's prop name; call sites read `state.color` and pass it into `<Badge variant={state.color}>`). Change the one `danger` value to `destructive`:
```typescript
		case EventState.CANCELED:
			return { label: 'Zrušeno', color: 'destructive', value: state };
```
(was `color: 'danger'`). Leave `'default'`, `'warning'`, `'success'`, `'unknown'` as-is — they match the new `badgeVariants` variant keys exactly.

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean. (`Badge` isn't rendered anywhere yet — `Event.tsx`/`EditableState.tsx` still import the deleted `Chip` from `@components/ui/Chip` at this point, which would be a build error... )

- [ ] **Step 4b: Verify the build isn't actually broken**

Run `grep -rn "@components/ui/Chip" src/` — expect two hits, `Event.tsx` and `EditableState.tsx`. Since `Chip.tsx` was deleted in Step 1, `tsc`/`build` in Step 4 must already be failing on those two files. **Fix:** in Step 4, if the gate fails on those two files, that confirms they need their import paths bumped here too (even though their full migration to `Badge`'s JSX is Task 8). Change, in both `src/app/events/_components/Event.tsx` and `src/app/events/_components/EditableState.tsx`:
```typescript
import { Chip } from '@components/ui/Chip';
```
to:
```typescript
import { Badge as Chip } from '@components/ui/badge';
```
(aliased import — keeps the rest of each file's structure mostly unchanged until Task 8 replaces the JSX properly). Since `Badge`'s prop is `variant`, not NextUI's `color`, also rename the one `<Chip color={...}>` call site in each file to `<Chip variant={...}>` now — in `Event.tsx`: `<Chip color={stateData.color}>{stateData.label}</Chip>` → `<Chip variant={stateData.color}>{stateData.label}</Chip>`; in `EditableState.tsx`: the `<Chip color={state.color} ...>` opening tag → `<Chip variant={state.color} ...>`. Re-run the fast gate from Step 4; it must pass now.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate Chip to shadcn Badge"
```

(Note: `Event.tsx`'s `Badge as Chip` alias from Step 4b stays in place until Task 8, since `Event.tsx` is a Card-based file migrated there. `EditableState.tsx`'s alias is replaced for real in Task 7 below, since that file is Dropdown-based.)

---

### Task 7: DropdownMenu migration

NextUI's `DropdownMenu` took an `onAction` handler at the menu level and `DropdownItem` took `href` (rendered as a link) or relied on `onPress`/click bubbling up to `onAction`. shadcn's `DropdownMenuItem` has no `href`/`onAction` — link items need `asChild` + `next/link`, and the handler moves to each item's own `onSelect`.

**Files:**
- Delete: `src/app/_components/ui/Dropdown.tsx`
- Create (via CLI): `src/app/_components/ui/dropdown-menu.tsx`
- Modify: `src/app/_components/Menu.tsx`
- Modify: `src/app/events/_components/EditableState.tsx`

**Interfaces:**
- Consumes: `Badge` from `@components/ui/badge` (Task 6).
- Produces: nothing consumed by later tasks — `Menu.tsx` and `EditableState.tsx` are leaf consumers.

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Dropdown.tsx
npx shadcn@latest add dropdown-menu
```
Expected: creates `src/app/_components/ui/dropdown-menu.tsx` exporting `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, etc. (Radix-based). No hand-editing needed — used directly, unlike Button/Badge/Tooltip (the original NextUI wrappers here had no real custom variants, just an unused `defaultVariants: { color: 'primary' }` on `DropdownMenu` which had no visible effect since `DropdownMenu` itself renders no visible chrome in NextUI either — only `DropdownMenuContent`'s default shadcn styling is used as-is).

- [ ] **Step 2: Rewrite `Menu.tsx`**

Replace `src/app/_components/Menu.tsx` with:
```typescript
'use client';

import { Button } from '@components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '~/lib/auth-client';
import { useIsAdmin } from '~/utils/permissions';

export default function Menu() {
	const router = useRouter();
	const isAdmin = useIsAdmin();

	async function handleSignOut() {
		await signOut();
		router.push('/login');
		router.refresh();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="primary"
					className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
				>
					Menu
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem asChild>
					<Link href="/">Domů</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/events">Události</Link>
				</DropdownMenuItem>
				{isAdmin ? (
					<DropdownMenuItem asChild>
						<Link href="/members">Členové</Link>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem onSelect={handleSignOut}>
					Odhlásit
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
```

- [ ] **Step 3: Rewrite `EditableState.tsx`**

Replace `src/app/events/_components/EditableState.tsx` with:
```typescript
'use client';
import { Badge } from '@components/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { toNumber } from 'lodash';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BiSolidDownArrow } from 'react-icons/bi';
import { type TEvent } from '~/app/_models/event';
import { type TFormatEventStateReturn } from '~/app/events/_utils/formatEventState';
import { EventState } from '~/enums/EventState';
import { api } from '~/trpc/react';

const STATE_ITEM_CLASSNAMES: Record<
	EventState.PENDING | EventState.CONFIRMED | EventState.CANCELED,
	string
> = {
	[EventState.PENDING]: 'text-warning',
	[EventState.CONFIRMED]: 'text-success',
	[EventState.CANCELED]: 'text-danger',
};

export default function EditableState({
	state,
	eventId,
}: Readonly<{ state: TFormatEventStateReturn; eventId: TEvent['id'] }>) {
	const { mutate } = api.event.changeState.useMutation();
	const utils = api.useUtils();
	const router = useRouter();

	const handleUpdate = (newState: EventState) => {
		mutate(
			{ id: eventId, state: newState },
			{
				onSuccess: () => {
					void utils.event.getUpcoming.refetch();
					toast.success('Stav změněn');
					router.refresh();
				},
			},
		);
	};

	const options: { state: EventState; label: string }[] = [
		{ state: EventState.PENDING, label: 'Nerozhodnuto' },
		{ state: EventState.CONFIRMED, label: 'Potvrzeno' },
		{ state: EventState.CANCELED, label: 'Zrušeno' },
	].filter((option) => option.state !== state.value);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Badge variant={state.color} className="cursor-pointer">
					{state.label}
					<BiSolidDownArrow className="ml-2" />
				</Badge>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.state}
						className={
							STATE_ITEM_CLASSNAMES[
								option.state as EventState.PENDING | EventState.CONFIRMED | EventState.CANCELED
							]
						}
						onSelect={() => handleUpdate(option.state)}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
```

Note `toNumber` import is dropped — `mutate` now takes `newState: EventState` directly from the typed `options` array instead of a `string | number` coerced via `toNumber` (NextUI's `onAction` only ever passed the raw `key`, a string; the typed array removes that round-trip entirely). `endContent` (NextUI prop on `Chip`) becomes a plain trailing child inside the `Badge` div, since `Badge` is just a styled `div`, not a component with named content slots.

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 5: Manual smoke check**

Run `yarn dev`. Check the top-right "Menu" dropdown opens and every link navigates correctly, "Odhlásit" signs out. Open an event detail modal as admin, click the state badge, confirm the dropdown shows the two other states and clicking one updates the badge.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate Dropdown to shadcn DropdownMenu"
```

---

### Task 8: Dialog + Card + Separator — migrate every Modal/Card screen

The largest task. Adds three new shadcn components and rewrites every screen that uses NextUI `Modal`/`Card`/`Divider`. `EventForm.tsx`'s internal fields are untouched here (still NextUI `Input`/`Textarea`/`Switch`/`DateRangePicker` — Task 11's job); this task only touches the Modal/Dialog shell around it.

**Files:**
- Create (via CLI): `src/app/_components/ui/dialog.tsx`, `src/app/_components/ui/card.tsx`, `src/app/_components/ui/separator.tsx`
- Modify: `src/app/members/page.tsx`
- Modify: `src/app/events/_components/Event.tsx`
- Modify: `src/app/events/_components/EventDetailModal.tsx`
- Modify: `src/app/events/_components/RequestEvent.tsx`
- Modify: `src/app/_components/ui/skeletons/EventSkeleton.tsx`
- Modify: `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`

**Interfaces:**
- Consumes: `Button` (Task 4), `Badge` (Task 6), `Tooltip` (Task 5).
- Produces: nothing consumed by later tasks — all consumers here are leaf screens.

- [ ] **Step 1: Generate the three new shadcn primitives**

```bash
npx shadcn@latest add dialog card separator
```
Expected: creates `dialog.tsx`, `card.tsx`, `separator.tsx` in `src/app/_components/ui/`.

- [ ] **Step 2: Hand-edit `dialog.tsx`'s generated `DialogContent` to support hiding the close button and to blur the overlay by default**

In `src/app/_components/ui/dialog.tsx`, find the generated `DialogOverlay` and add `backdrop-blur-sm` to its className (alongside the existing `bg-black/80`). Find the generated `DialogContent` and add a `showCloseButton` prop:
```typescript
const DialogContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
		showCloseButton?: boolean;
	}
>(({ className, children, showCloseButton = true, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(/* ...existing classes... */, className)}
			{...props}
		>
			{children}
			{showCloseButton ? (
				<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
			) : null}
		</DialogPrimitive.Content>
	</DialogPortal>
));
```
(Keep every other generated export — `Dialog`, `DialogTrigger`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — unchanged.)

- [ ] **Step 3: Rewrite the delete-confirm modal in `members/page.tsx`**

In `src/app/members/page.tsx`, change the import:
```typescript
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from '@nextui-org/modal';
```
to:
```typescript
import { Button } from '@components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@components/ui/dialog';
```
(`Button`'s import line already exists earlier in the file from Task 4 — keep only one import statement for it.) Replace the JSX:
```typescript
			<Modal
				isOpen={pendingDelete !== null}
				onClose={() => setPendingDelete(null)}
				size="sm"
			>
				<ModalContent>
					<ModalHeader>Smazat člena</ModalHeader>
					<ModalBody>
						<p>Opravdu smazat člena {pendingDelete?.name}?</p>
					</ModalBody>
					<ModalFooter>
						<Button variant="ghost" onClick={() => setPendingDelete(null)}>
							Zrušit
						</Button>
						<Button color="danger" onClick={confirmDelete} isLoading={del.isPending}>
							Smazat
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
```
with:
```typescript
			<Dialog
				open={pendingDelete !== null}
				onOpenChange={(open) => !open && setPendingDelete(null)}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Smazat člena</DialogTitle>
					</DialogHeader>
					<p>Opravdu smazat člena {pendingDelete?.name}?</p>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setPendingDelete(null)}>
							Zrušit
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDelete}
							isLoading={del.isPending}
						>
							Smazat
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
```
(`variant="ghost"` stays `variant="ghost"` — already matches the new vocabulary; `color="danger"` → `variant="destructive"`, per Task 4's prop rename. These prop values were already updated at Task 4 time per its Step 3 note; this step rewrites the surrounding Modal→Dialog shell.)

- [ ] **Step 4: Rewrite `Event.tsx`**

Replace `src/app/events/_components/Event.tsx` with:
```typescript
'use client';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Separator } from '@components/ui/separator';
import { Tooltip } from '@components/ui/tooltip';
import { useState } from 'react';
import { type TEvent } from '~/app/_models/event';
import EventValues from '~/app/events/_components/EventValues';
import formatEventState from '~/app/events/_utils/formatEventState';
import { EventDetailModal } from './EventDetailModal';

export default function Event({ event }: Readonly<{ event: TEvent }>) {
	const [isOpen, setIsOpen] = useState(false);

	const stateData = formatEventState(event.state);

	return (
		<>
			<Card
				className="w-[265px] cursor-pointer bg-green-400"
				onClick={() => setIsOpen(true)}
			>
				<CardHeader className="flex flex-row items-center">
					<Tooltip content={event.name} delay={500} size="xl">
						<span className="truncate text-xl">{event.name}</span>
					</Tooltip>
					<div className="grow" />
					<Badge variant={stateData.color}>{stateData.label}</Badge>
				</CardHeader>
				<Separator />
				<CardContent>
					<EventValues event={event} withHover />
				</CardContent>
			</Card>
			<EventDetailModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				event={event}
				state={stateData}
			/>
		</>
	);
}
```
(`useDisclosure` → local `useState<boolean>`; `isPressable`/`onPress` → `onClick` on the `Card` itself; `CardBody` → `CardContent`; `Divider` → `Separator`. `Chip`/`Tooltip` aliases from Tasks 5/6 are now real imports.)

- [ ] **Step 5: Rewrite `EventDetailModal.tsx`**

Replace `src/app/events/_components/EventDetailModal.tsx`'s imports and JSX:
```typescript
import { Button } from '@components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from '@components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type TEvent } from '~/app/_models/event';
import DeleteEvent from '~/app/events/_components/DeleteEvent';
import EditableState from '~/app/events/_components/EditableState';
import { EventForm } from '~/app/events/_components/EventForm';
import EventValues from '~/app/events/_components/EventValues';
import { useEventForm } from '~/app/events/_utils/useEventForm';
import { type TFormatEventStateReturn } from '../_utils/formatEventState';

export function EventDetailModal({
	event,
	state,
	isOpen,
	onClose,
}: Readonly<{
	event: TEvent;
	state: TFormatEventStateReturn;
	isOpen: boolean;
	onClose: () => void;
}>) {
	const [isEdit, setIsEdit] = useState<boolean>(false);
	const router = useRouter();

	const handleEdit = () => {
		setIsEdit((prev) => !prev);
	};

	const handleClose = () => {
		onClose();
		setIsEdit(false);
	};

	const handleSaveSuccess = () => {
		router.refresh();
		handleClose();
	};

	const {
		control,
		handleSubmit,
		isPending,
		formState: { isValid },
	} = useEventForm(event, handleSaveSuccess);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-2xl" showCloseButton={false}>
				<DialogHeader className="flex flex-row items-center">
					<div>{event.name}</div>
					<div className="grow" />
					<EditableState state={state} eventId={event.id} />
				</DialogHeader>
				{isEdit ? (
					<EventForm control={control} />
				) : (
					<EventValues event={event} />
				)}
				<DialogFooter className="flex-row">
					<Button onClick={handleClose} variant="destructive-ghost">
						Zavřít
					</Button>
					<div className="grow" />
					<DeleteEvent eventId={event.id} onSuccess={handleClose} />
					{isEdit ? (
						<Button
							variant="primary"
							onClick={handleSubmit}
							isLoading={isPending}
							isDisabled={!isValid}
						>
							Uložit
						</Button>
					) : (
						<Button variant="primary" onClick={handleEdit}>
							Editovat
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```
(`backdrop="blur"` is now the dialog's global default from Step 2; `hideCloseButton` → `showCloseButton={false}`; `size="lg"` → `className="sm:max-w-2xl"`; `color="danger" variant="ghost"` on the Zavřít button → the `destructive-ghost` variant added in Task 4.)

- [ ] **Step 6: Rewrite `RequestEvent.tsx`**

Replace `src/app/events/_components/RequestEvent.tsx`'s imports and JSX:
```typescript
'use client';
import { Button } from '@components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@components/ui/dialog';
import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { EventForm } from '~/app/events/_components/EventForm';
import { useEventForm } from '~/app/events/_utils/useEventForm';

export default function RequestEvent() {
	const [isOpen, setIsOpen] = useState(false);
	const router = useRouter();

	const onSaveSuccess = useCallback(() => {
		router.refresh();
		setIsOpen(false);
		toast.success('Rezervace vytvořena');
	}, [router]);

	const {
		handleSubmit,
		control,
		isPending,
		formState: { isValid },
	} = useEventForm(undefined, onSaveSuccess);

	return (
		<>
			<Button
				className="fixed bottom-12 right-3 z-50 rounded-full text-2xl shadow-lg lg:bottom-14 lg:right-5"
				variant="primary"
				size="xl"
				onClick={() => setIsOpen(true)}
			>
				Rezervovat
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="sm:max-w-3xl" showCloseButton={false}>
					<DialogHeader>
						<DialogTitle className="text-center">
							Nová rezervace
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit}>
						<EventForm control={control} />
						<DialogFooter className="mt-4 flex-row">
							<Button
								type="button"
								onClick={() => setIsOpen(false)}
								isLoading={isPending}
								variant="destructive-ghost"
							>
								Zrušit
							</Button>
							<div className="grow" />
							<Button
								type="submit"
								isLoading={isPending}
								isDisabled={!isValid}
								variant="primary"
							>
								Potvrdit
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
```
(`useDisclosure` → local `useState`; `size="xl"` → `className="sm:max-w-3xl"`; `hideCloseButton`+`backdrop="blur"` → `showCloseButton={false}` + the global blur default; added explicit `type="button"` to the Zrušit button since outside a NextUI context buttons inside a `<form>` default to `type="submit"` per the HTML spec and would otherwise also trigger submission.)

- [ ] **Step 7: Rewrite `EventSkeleton.tsx` and `CalendarSkeleton.tsx`**

Replace `src/app/_components/ui/skeletons/EventSkeleton.tsx` with:
```typescript
import { Skeleton } from '@components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Separator } from '@components/ui/separator';

export async function EventSkeleton() {
	return (
		<Card className="w-[265px] bg-green-400 [&:nth-child(2)]:opacity-75 [&:nth-child(3)]:opacity-50">
			<CardHeader className="flex flex-row items-center">
				<Skeleton className="h-7 w-36 rounded-full" />
				<div className="grow" />
				<Skeleton className="h-7 w-10 rounded-full" />
			</CardHeader>
			<Separator />
			<CardContent>
				<Skeleton className="h-[7.5rem] w-full rounded-xl" />
			</CardContent>
		</Card>
	);
}
```
In `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`, replace the NextUI-plugin-only utility classes (`rounded-large`, `bg-content1`, `shadow-small`, `text-default-400`) with plain Tailwind equivalents — these classes are injected by the `nextui()` plugin (removed in Task 14) and are not part of the custom palette in `tailwind.config.ts`:
```typescript
import { Skeleton } from '@components/ui/skeleton';

export default function CalendarSkeleton() {
	return (
		<div className="w-[256px] rounded-lg bg-default-50 shadow-sm">
			<Skeleton className="mx-16 my-2 h-[32px] rounded-full" />
			<div className="mb-2 flex h-[22px] w-full justify-center text-sm font-medium text-default-400">
				<span className="w-8 text-center">P</span>
				<span className="w-8 text-center">Ú</span>
				<span className="w-8 text-center">S</span>
				<span className="w-8 text-center">Č</span>
				<span className="w-8 text-center">P</span>
				<span className="w-8 text-center">S</span>
				<span className="w-8 text-center">N</span>
			</div>
			<Skeleton className="h-[188px]" />
		</div>
	);
}
```
(`bg-content1`/`text-default-400` are already custom-palette colors, kept as-is; only the plugin-injected `rounded-large`→`rounded-lg`, `shadow-small`→`shadow-sm`, and `text-small`→`text-sm` change.)

- [ ] **Step 8: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 9: Manual smoke check**

Run `yarn dev`. On `/events`: click an event card, confirm the detail dialog opens with blurred backdrop, no stray close-X in the corner, "Editovat"/"Uložit"/"Zavřít"/"Smazat" all work. On `/`: click "Rezervovat", confirm the request dialog opens, fill required fields, submit. On `/members`: click "Smazat" on a member, confirm the small confirm dialog opens and works.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate Modal/Card/Divider screens to shadcn Dialog/Card/Separator"
```

---

### Task 9: `Providers.tsx` — remove `NextUIProvider`, add `TooltipProvider`

**Files:**
- Modify: `src/app/_components/Providers.tsx`

**Interfaces:**
- Consumes: `TooltipProvider` from `@components/ui/tooltip` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite `Providers.tsx`**

```typescript
'use client';
import { TooltipProvider } from '@components/ui/tooltip';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { type ReactNode } from 'react';
import { TRPCReactProvider } from '~/trpc/react';

export default function Providers({ children }: { children: ReactNode }) {
	return (
		<div className="h-full">
			<TooltipProvider delayDuration={500}>
				<TRPCReactProvider>
					{children}
					<SpeedInsights />
				</TRPCReactProvider>
			</TooltipProvider>
		</div>
	);
}
```

`navigate={push}`/`useRouter` is dropped — that prop only wired NextUI's internal client-side navigation (used by NextUI's own router-aware components, none of which survive this migration) to Next's router; nothing else in the app relied on it. `locale="cs-CZ"` is dropped — it only affected NextUI's date pickers, which are gone after Task 11. `className="h-full"` moves from the provider onto a plain wrapping `div`. `TooltipProvider`'s `delayDuration={500}` matches every individual `Tooltip` call site's `delay={500}` as a sensible global default (each call site still passes its own `delay` prop too, via `TooltipRoot`'s `delayDuration` override in Task 5's `Tooltip`, so this default is mostly a redundant safety net).

- [ ] **Step 2: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 3: Manual smoke check**

Run `yarn dev`. Confirm the app still fills the viewport height correctly (no layout shift from the provider change) and tooltips (e.g. hovering a truncated event name) still appear after a short delay.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove NextUIProvider, add TooltipProvider"
```

---

### Task 10: Calendar migration

**Files:**
- Delete: `src/app/_components/ui/Calendar.tsx`
- Create (via CLI): `src/app/_components/ui/calendar.tsx`
- Create: `src/app/_components/ui/CalendarWithDates.tsx`
- Modify: `src/app/events/_components/EventCalendar.tsx`

The shadcn-generated `calendar.tsx` (lowercase, `react-day-picker`-based) is used as-is, with no hand-edits — unlike Button/Badge/Tooltip, the old `Calendar.tsx` had no real custom variants (`extendVariants(NextCalendar, {})` was empty). The `CalendarWithDates` wrapper function moves to its own new file (capitalized, not case-colliding with `calendar.tsx`) since it's the actual piece of custom logic.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CalendarWithDates` from `@components/ui/CalendarWithDates`, same `{ events: TCalendarEvent[] }` prop shape as before, consumed by `EventCalendar.tsx` (this task).

- [ ] **Step 1: Delete the legacy wrapper, then generate the shadcn primitive**

```bash
git rm src/app/_components/ui/Calendar.tsx
npx shadcn@latest add calendar
```
Expected: creates `src/app/_components/ui/calendar.tsx` (installs `react-day-picker` as a dependency if not already present transitively).

- [ ] **Step 2: Create `CalendarWithDates.tsx`**

```typescript
'use client';
import { isSameDay, startOfDay } from 'date-fns';
import { type Matcher } from 'react-day-picker';
import { Calendar } from '@components/ui/calendar';
import { type TCalendarEvent } from '~/app/_models/event';

export function CalendarWithDates({
	events,
}: Readonly<{ events: TCalendarEvent[] }>) {
	const eventDates = events
		.map((event) => event.start)
		.filter((date): date is Date => !!date);

	const isEventDate: Matcher = (day) =>
		eventDates.some((eventDate) => isSameDay(eventDate, day));

	return (
		<Calendar
			mode="single"
			selected={undefined}
			disabled={[{ before: startOfDay(new Date()) }, isEventDate]}
			showOutsideDays
		/>
	);
}
```

This preserves the existing behavior exactly: a read-only calendar (no `onSelect` is wired, so nothing is ever selectable), dates before today disabled, and dates that have an event also rendered as disabled/greyed — `isDateUnavailable` in the old NextUI version had the identical effect (graying out event dates, not highlighting them; this looks unusual for a "calendar of events" but it is the current production behavior and the spec calls for an exact visual port, not a UX redesign here — flag this specific date-graying behavior during the Task 16 visual smoke-check in case it was actually a pre-existing bug worth a follow-up, but do not change it in this phase).

- [ ] **Step 3: Update `EventCalendar.tsx`**

In `src/app/events/_components/EventCalendar.tsx`, change:
```typescript
import { CalendarWithDates } from '@components/ui/Calendar';
```
to:
```typescript
import { CalendarWithDates } from '@components/ui/CalendarWithDates';
```
No other changes in this file.

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 5: Manual smoke check**

Run `yarn dev`, open `/`, confirm the calendar renders, past dates and event dates render visually distinct (greyed) from other future dates, per the note in Step 2.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate Calendar to shadcn"
```

---

### Task 11: `EventForm`/`useEventForm` — date+duration redesign

The one functional behavior change in this phase: `TEventInputs.date: { start, end }` (a NextUI `DateRangePicker` value) becomes `{ start: Date; duration: string }`. The outgoing tRPC payload (`start`/`end` as `Date`) is unchanged — `Event` schema/DB/server are untouched.

**Files:**
- Create (via CLI): `src/app/_components/ui/switch.tsx`, `src/app/_components/ui/popover.tsx`, `src/app/_components/ui/input.tsx`, `src/app/_components/ui/textarea.tsx`, `src/app/_components/ui/label.tsx`
- Modify: `src/app/events/_utils/useEventForm.ts`
- Modify: `src/app/events/_components/EventForm.tsx`

**Interfaces:**
- Consumes: `Calendar` (Task 10), `Button` (Task 4).
- Produces: `TEventInputs = { start: Date; duration: string } & Omit<TCreateEvent, 'start' | 'end'>` and `DURATION_PATTERN: RegExp`, both exported from `useEventForm.ts`, consumed by `EventForm.tsx` in this same task. `EventDetailModal.tsx`/`RequestEvent.tsx` (Task 8) already call `useEventForm` and `<EventForm control={control}>` generically — neither needs further changes since they never destructured the old `date` shape directly.

- [ ] **Step 1: Generate the five new shadcn primitives**

```bash
npx shadcn@latest add switch popover input textarea label
```
Expected: creates `switch.tsx`, `popover.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx` in `src/app/_components/ui/`. None need hand-editing — used as-is.

- [ ] **Step 2: Rewrite `useEventForm.ts`**

```typescript
import { addMinutes, differenceInMinutes } from 'date-fns';
import { isNil, omitBy } from 'lodash';
import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { type TCreateEvent, type TEvent } from '~/app/_models/event';
import { api } from '~/trpc/react';

export type TEventInputs = Omit<TCreateEvent, 'start' | 'end'> & {
	start: Date;
	duration: string;
};

export const DURATION_PATTERN = /^([0-9]{1,2}):([0-5][0-9])$/;

function formatDurationMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

function parseDurationMinutes(duration: string): number {
	const match = DURATION_PATTERN.exec(duration);
	if (!match) return 0;
	return Number(match[1]) * 60 + Number(match[2]);
}

function transformInitValues(data?: TEvent): Partial<TEventInputs> {
	if (!data) return {};

	const { start, end, ...rest } = data;
	const duration =
		!!start && !!end
			? formatDurationMinutes(differenceInMinutes(end, start))
			: undefined;
	return { ...omitBy(rest, isNil), start: start ?? undefined, duration };
}

export function useEventForm(initValues?: TEvent, onSuccess?: () => void) {
	const { mutate: createEvent, isPending } = api.event.create.useMutation();

	const transformedInitValues = transformInitValues(initValues);

	const { handleSubmit, ...restForm } = useForm<TEventInputs>({
		defaultValues: { isPrivate: true, ...transformedInitValues },
		mode: 'onChange',
	});

	const onSubmit: SubmitHandler<TEventInputs> = useCallback(
		(data) => {
			const { start, duration, ...rest } = data;

			const req: TCreateEvent = {
				...rest,
				start,
				end: addMinutes(start, parseDurationMinutes(duration)),
			};
			createEvent(req, {
				onSuccess,
			});
		},
		[createEvent, onSuccess],
	);

	return { ...restForm, handleSubmit: handleSubmit(onSubmit), isPending };
}
```

- [ ] **Step 3: Rewrite `EventForm.tsx`**

```typescript
'use client';
import { Button } from '@components/ui/button';
import { Calendar } from '@components/ui/calendar';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@components/ui/popover';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import {
	DURATION_PATTERN,
	type TEventInputs,
} from '~/app/events/_utils/useEventForm';

function StartDateTimeField({
	value,
	onChange,
}: Readonly<{ value?: Date; onChange: (date: Date) => void }>) {
	const current = value ?? new Date();

	function handleDateSelect(date: Date | undefined) {
		if (!date) return;
		const merged = new Date(date);
		merged.setHours(current.getHours(), current.getMinutes());
		onChange(merged);
	}

	function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const [hours, minutes] = e.target.value.split(':').map(Number);
		const merged = new Date(current);
		merged.setHours(hours ?? 0, minutes ?? 0);
		onChange(merged);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="w-full justify-start font-normal"
				>
					{format(current, 'd. M. yyyy HH:mm', { locale: cs })}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto space-y-2 p-3">
				<Calendar mode="single" selected={current} onSelect={handleDateSelect} />
				<Input
					type="time"
					value={format(current, 'HH:mm')}
					onChange={handleTimeChange}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function EventForm({
	control,
}: Readonly<{ control: Control<TEventInputs> }>) {
	return (
		<div className="space-y-4">
			<div className="space-y-1">
				<Label htmlFor="name">Název události</Label>
				<Controller
					name="name"
					control={control}
					rules={{ required: true }}
					render={({ field }) => (
						<Input id="name" {...field} value={field.value ?? ''} required />
					)}
				/>
			</div>
			<Controller
				name="isPrivate"
				control={control}
				render={({ field }) => (
					<div className="flex items-center gap-2">
						<Switch
							id="isPrivate"
							checked={field.value}
							onCheckedChange={field.onChange}
						/>
						<Label htmlFor="isPrivate">Soukormá událost</Label>
					</div>
				)}
			/>
			<div className="space-y-1">
				<Label>Datum a čas</Label>
				<Controller
					name="start"
					control={control}
					rules={{ required: true }}
					render={({ field }) => (
						<StartDateTimeField
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="duration">Délka (HH:MM)</Label>
				<Controller
					name="duration"
					control={control}
					rules={{ required: true, pattern: DURATION_PATTERN }}
					render={({ field }) => (
						<Input
							id="duration"
							placeholder="HH:MM"
							{...field}
							value={field.value ?? ''}
						/>
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="email">Email</Label>
				<Controller
					name="email"
					control={control}
					rules={{
						required: true,
						pattern: {
							value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
							message: 'invalid email address',
						},
					}}
					render={({ field }) => (
						<Input id="email" {...field} value={field.value ?? ''} required />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="phone">Telefon</Label>
				<Controller
					name="phone"
					control={control}
					render={({ field }) => (
						<Input id="phone" {...field} value={field.value ?? ''} />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="location">Lokace</Label>
				<Controller
					name="location"
					control={control}
					render={({ field }) => (
						<Input id="location" {...field} value={field.value ?? ''} />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="description">Popis</Label>
				<Controller
					name="description"
					control={control}
					render={({ field }) => (
						<Textarea
							id="description"
							{...field}
							value={field.value ?? ''}
						/>
					)}
				/>
			</div>
		</div>
	);
}
```

Each `<Label htmlFor="x">` + `<Input id="x">` pair preserves the accessible label association the e2e specs rely on (`getByLabel('Název události')`, `getByLabel('Email')`) — NextUI's `label` prop generated the same association internally; this is now explicit. The `StartDateTimeField`'s trigger `Button` has `type="button"` to avoid submitting the form when opening the popover (it lives inside a `<form>` per `RequestEvent.tsx`).

- [ ] **Step 4: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 5: Run the existing e2e event-crud spec**

Run: `yarn build && yarn e2e e2e/specs/event-crud.spec.ts`
Expected: the two existing cases ("submit button is disabled when required fields are empty", "deletes an event") pass. The "creates an event successfully" case will now fail, because it doesn't fill `start`/`duration` at all: `start` is **intentionally** left unregistered until the user opens the date popover and picks a day — `StartDateTimeField`'s `current = value ?? new Date()` fallback only affects what's *displayed* in the closed trigger button, it never calls `onChange`, so the form-level `start` value stays `undefined` and `required: true` keeps the form invalid. This is by design (explicit date selection, not a silent default) — confirm the failure by running the spec; if it fails because the Potvrdit button stays disabled, that's expected pending Task 15's e2e update, not a regression to fix here.

- [ ] **Step 6: Manual smoke check**

Run `yarn dev`, open "Rezervovat", confirm: clicking the date button opens a popover with a calendar + a time input; picking a date keeps the previously-set time; typing a duration like `1:30` and submitting succeeds; editing an existing event shows the correct pre-filled start date/time and duration matching its current `start`/`end`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: redesign event form to start+duration"
```

---

### Task 12: Delete `parseDateJStoCalendarDateTime` — last `@internationalized/date` usage in `date.ts`

After Tasks 10 and 11, nothing calls `parseDateJStoCalendarDateTime` anymore (`Calendar.tsx`'s replacement works on plain `Date` via `date-fns isSameDay`; `useEventForm.ts`'s replacement works on plain `Date` directly).

**Files:**
- Modify: `src/utils/date.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm there are no remaining call sites**

Run: `grep -rn "parseDateJStoCalendarDateTime" src/`
Expected: only the definition in `src/utils/date.ts` itself — zero call sites.

- [ ] **Step 2: Delete the function and its import**

In `src/utils/date.ts`, remove:
```typescript
import {
	type CalendarDateTime,
	parseDateTime,
} from '@internationalized/date';
```
and:
```typescript
export function parseDateJStoCalendarDateTime(date: Date): CalendarDateTime {
	return parseDateTime(date.toISOString().slice(0, -1));
}
```
The file now contains only `formatDuration` and `formatDateToTime` (from Task 2).

- [ ] **Step 3: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 4: Commit**

```bash
git add src/utils/date.ts
git commit -m "refactor: remove last @internationalized/date usage from date.ts"
```

---

### Task 13: Tailwind config + CSS variables

Removes the `nextui()` plugin (now safe — every consumer is migrated as of Task 12) and adds shadcn's standard CSS variables to `globals.css`, mapped onto the existing palette per the spec's theme-mapping table. **No color value changes** — every hex value below already exists in `tailwind.config.ts`'s `theme.extend.colors`.

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/styles/globals.css`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the first task to actually remove the plugin — every prior task ran with both `nextui()` and shadcn coexisting).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Remove the `nextui()` plugin from `tailwind.config.ts`**

Remove the import:
```typescript
import { nextui } from "@nextui-org/theme";
```
Remove the NextUI-only content path entry:
```typescript
"./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
```
(keep `"./src/**/*.tsx"`). Replace the `plugins` array:
```typescript
  plugins: [tailwindcssAnimate],
```
(was `plugins: [nextui({...})]` with `tailwindcssAnimate` already added alongside it in Task 1 — now `nextui(...)` itself is removed, leaving just the animate plugin). Also remove `darkMode: "class"` only if nothing else in the app relies on a `dark:` variant — run `grep -rn "dark:" src/` first; if there are no hits, remove the line, otherwise leave it (it's independent of NextUI and harmless either way).

- [ ] **Step 2: Add shadcn CSS variables to `globals.css`**

Replace `src/styles/globals.css`'s contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
	:root {
		--background: 43 38% 84%;
		--foreground: 21 33% 26%;
		--card: 43 38% 84%;
		--card-foreground: 21 33% 26%;
		--popover: 43 38% 84%;
		--popover-foreground: 21 33% 26%;
		--primary: 27 39% 45%;
		--primary-foreground: 0 0% 100%;
		--secondary: 80 36% 70%;
		--secondary-foreground: 21 33% 26%;
		--muted: 38 30% 78%;
		--muted-foreground: 21 25% 40%;
		--accent: 92 41% 41%;
		--accent-foreground: 0 0% 100%;
		--destructive: 14 86% 56%;
		--destructive-foreground: 0 0% 100%;
		--border: 38 27% 70%;
		--input: 38 27% 70%;
		--ring: 27 39% 45%;
		--radius: 0.5rem;
	}
}
```
These HSL triplets are the existing hex values converted (`--background` = `#E6DFC4`, `--foreground`/`--card-foreground`/etc. = `#5a3d2d` (`dark`), `--primary` = `#9c7243`, `--secondary` = `#bdd086`, `--accent` = `#85a042`, `--destructive` = `#ed5122` (`danger`)) — no new colors introduced, only re-expressed in the HSL format shadcn's generated components expect (e.g. `bg-background`, `text-foreground` utility classes resolve via `hsl(var(--background))` per shadcn's Tailwind preset convention, which is unaffected by this phase since Tailwind 4's `@theme` migration is Phase 6). `--success`, `--warning`, `--unknown` are deliberately **not** added here — `Badge`'s cva in Task 6 already references the existing named colors (`bg-warning`, `bg-success`, `bg-unknown`) directly from `tailwind.config.ts`'s `theme.extend.colors`, not through CSS variables, so no shadcn-variable slot is needed for them.

- [ ] **Step 3: Run the fast gate**

Run: `SKIP_ENV_VALIDATION=1 yarn lint && npx tsc --noEmit && SKIP_ENV_VALIDATION=1 yarn build`
Expected: passes clean.

- [ ] **Step 4: Full manual visual smoke-check (first pass)**

Run `yarn dev`. Open every screen (`/`, `/events`, `/members`, `/login`, `/reset-password`) and confirm nothing rendered using NextUI-plugin-only utility classes (`rounded-large`, `shadow-small`, etc.) broke — these classes silently no-op (rather than error) when the plugin that defined them is removed, so a visual check is the only way to catch this. Run `grep -rn "rounded-large\|rounded-medium\|rounded-small\|shadow-large\|shadow-medium\|shadow-small\|text-small\|text-medium\|text-large" src/` first to find any remaining plugin-only utility class usages outside what was already fixed in Task 8; fix any hits the same way Task 8 fixed `CalendarSkeleton.tsx`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove nextui Tailwind plugin, add shadcn CSS variables"
```

---

### Task 14: Remove all NextUI/framer-motion/`@internationalized/date`/`moment` dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks (last task that touches dependencies).
- Produces: nothing.

- [ ] **Step 1: Confirm zero remaining source references**

Run: `grep -rn "@nextui-org\|framer-motion\|@internationalized/date\|moment" src/`
Expected: no output. If anything appears, stop and fix that file first — do not remove the package it depends on.

- [ ] **Step 2: Remove the dependencies**

```bash
yarn remove @nextui-org/card @nextui-org/chip @nextui-org/date-input @nextui-org/date-picker @nextui-org/dropdown @nextui-org/input @nextui-org/modal @nextui-org/popover @nextui-org/skeleton @nextui-org/switch @nextui-org/system @nextui-org/theme @nextui-org/tooltip framer-motion @internationalized/date moment
```
Expected: `package.json`/`yarn.lock` updated, 16 packages removed (the 13 `@nextui-org/*` packages enumerated in `package.json`'s dependency list, `framer-motion`, `@internationalized/date`, `moment`). `lodash` is **kept** — it's still used by `useEventForm.ts` (`omitBy`/`isNil`) and `EditableState.tsx`/elsewhere; only its `floor` import was dropped (in Task 2), not the whole package.

- [ ] **Step 3: Run the full gate**

Run:
```bash
yarn install
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
npx tsc --noEmit
SKIP_ENV_VALIDATION=1 yarn build
```
Expected: all pass clean.

- [ ] **Step 4: Verify the spec's exit-criteria grep**

Run: `grep -r "@nextui-org\|framer-motion\|@internationalized/date\|moment" src/ package.json`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: remove NextUI, framer-motion, @internationalized/date, moment"
```

---

### Task 15: E2E — add the start+duration request-event case

**Files:**
- Modify: `e2e/specs/event-crud.spec.ts`

**Interfaces:**
- Consumes: the finished `RequestEvent`/`EventForm` UI from Tasks 8 and 11.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update the "creates an event successfully" case to fill start+duration**

In `e2e/specs/event-crud.spec.ts`, replace the existing "creates an event successfully" test with one that also fills the new fields and asserts the rendered date on `/events`:
```typescript
  test('creates an event successfully', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await page.getByRole('dialog').getByLabel('Název události').fill('Nová Akce E2E');
    await page.getByRole('dialog').getByLabel('Email').fill('akce@example.com');
    // start is never silently defaulted — the user must explicitly open the date
    // popover and pick a day (here, today) before the form is valid; time is left
    // as whatever "now" merges in, no need to touch the time input for this case.
    await page.getByRole('dialog').getByRole('button', { name: /\d{1,2}\. \d{1,2}\. \d{4}/ }).click();
    await page.getByRole('gridcell', { name: new Date().getDate().toString(), exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByLabel('Délka (HH:MM)').fill('1:30');
    await page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Nová rezervace')).not.toBeVisible();
    await page.goto('/events');
    await expect(page.getByText('Nová Akce E2E')).toBeVisible();
  });

  test('sets a specific start date and duration', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rezervovat' }).click();
    await page.getByRole('dialog').getByLabel('Název události').fill('Datum E2E');
    await page.getByRole('dialog').getByLabel('Email').fill('datum@example.com');
    // Open the date+time popover and pick "today" explicitly, then set a known time
    await page.getByRole('dialog').getByRole('button', { name: /\d{1,2}\. \d{1,2}\. \d{4}/ }).click();
    await page.getByRole('gridcell', { name: new Date().getDate().toString(), exact: true }).click();
    await page.locator('input[type="time"]').fill('14:00');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByLabel('Délka (HH:MM)').fill('2:00');
    await page.getByRole('dialog').getByRole('button', { name: 'Potvrdit' }).click();
    await expect(page.getByText('Rezervace vytvořena')).toBeVisible();
    await page.goto('/events');
    await page.getByText('Datum E2E').first().click();
    await expect(page.getByRole('dialog').getByText('14:00')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('2:00')).toBeVisible();
  });
```
The popover trigger button's accessible name is the formatted date string (`d. M. yyyy HH:mm` from `StartDateTimeField` in Task 11) — the regex match avoids hardcoding today's date in the locator while still finding the right button.

- [ ] **Step 2: Run the updated spec**

Run: `yarn build && yarn e2e e2e/specs/event-crud.spec.ts`
Expected: all four cases in the file pass (the two pre-existing ones, plus the two from this task).

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/event-crud.spec.ts
git commit -m "test: cover start+duration event creation in e2e"
```

---

### Task 16: Final verification gate, full visual smoke-check, master-plan tracking update

**Files:**
- Modify: `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` (tracking table only)

**Interfaces:**
- Consumes: everything from Tasks 1–15.
- Produces: nothing — terminal task.

- [ ] **Step 1: Run the complete verification gate**

```bash
yarn install
npx prisma generate
SKIP_ENV_VALIDATION=1 yarn lint
npx tsc --noEmit
SKIP_ENV_VALIDATION=1 yarn build
yarn e2e
```
Expected: every step passes clean, including the full `yarn e2e` suite (`admin-gate.spec.ts`, `auth.spec.ts`, `members.spec.ts`, `event-crud.spec.ts`, `events-calendar.spec.ts`).

- [ ] **Step 2: Run the spec's exit-criteria greps**

```bash
grep -r "@nextui-org\|framer-motion\|@internationalized/date\|moment" src/ package.json
```
Expected: empty (re-confirms Task 14, after all later tasks' changes).

- [ ] **Step 3: Full visual smoke-check against production, via Playwright MCP**

Run `yarn dev` locally. Using the Playwright MCP tools, navigate to and screenshot every screen — `/` (calendar + floating Rezervovat button), `/events` (event cards, badges, detail dialog, edit form, dropdown state menu), `/members` (table, create-member form, delete-confirm dialog), `/login`, `/reset-password` — both on the local `yarn dev` instance and on the live site at www.cmdrozdi.cz, and compare colors, spacing, and layout between the two sets of screenshots. This is the phase's largest verification step; budget real time for it, not a quick pass. Present the paired before/after screenshots for the user to spot-check rather than asking them to run both sites side by side themselves. Note any visual drift found; fix in this task's branch before opening the PR (do not defer cosmetic regressions to a follow-up — this phase's whole purpose is the UI migration).

- [ ] **Step 4: Update the master-plan tracking table**

In `docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md`, update the tracking table row:
```markdown
| 4 — shadcn migration | not started |
```
to point at the PR opened in Step 5 below (exact PR number filled in after creation, per this repo's established convention of tracking PRs by link rather than a hand-written status word).

- [ ] **Step 5: Commit and open the draft PR**

```bash
git add docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md
git commit -m "docs: track Phase 4 PR in master plan"
git push -u origin feat/upgrade-phase-4-shadcn
gh pr create --draft --base develop --title "Phase 4: finish shadcn migration, remove NextUI" --body "$(cat <<'EOF'
## Summary
- Migrates every NextUI consumer to shadcn/ui (Button, Calendar, DropdownMenu, Badge, Tooltip, Skeleton, Dialog, Card, Separator, Switch, Popover, Input, Textarea, Label).
- Redesigns the event date field from a start+end range to start+duration.
- Removes @nextui-org/*, framer-motion, @internationalized/date, and moment.

## Test plan
- [ ] Full verification gate passes (lint, typecheck, build, e2e)
- [ ] `grep -r "@nextui-org\|framer-motion\|@internationalized/date\|moment" src/ package.json` is empty
- [ ] Manual visual smoke-check of every screen against production
EOF
)"
```
Then update the master-plan PR link from Step 4 with the real PR number/URL returned by `gh pr create`, amend that commit, and push again.
