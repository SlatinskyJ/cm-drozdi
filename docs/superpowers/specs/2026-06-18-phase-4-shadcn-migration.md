# Phase 4 — Finish shadcn migration, remove NextUI

**Branch:** `feat/upgrade-phase-4-shadcn` (per master plan)
**Risk:** medium (UI regressions). **Size:** large — biggest manual-verification phase in the roadmap.

## Context

`docs/superpowers/plans/2026-06-11-dependency-upgrade-master-plan.md` Phase 4 calls for finishing the shadcn/ui migration and removing NextUI entirely (restart fresh — the old migration stash was discarded). This spec covers the concrete decisions needed before writing the execution plan. Phase 3 (minor bumps) audited the codebase at 14 NextUI consumers; a re-audit for this spec found 15 (a new file, `src/app/members/page.tsx`, was added since).

No `components.json` exists yet — `shadcn init` has never been run. This phase runs it against the **current Tailwind 3** setup; the Tailwind 4 conversion is Phase 6 and out of scope here.

## Scope

### Files migrated off `@nextui-org/*` (15)

Wrapper components rebuilt as owned shadcn source (existing `extendVariants` calls replaced by direct edits to the generated `cva` config — shadcn components are copied into the repo to be edited, not wrapped):

- `src/app/_components/ui/Button.tsx`
- `src/app/_components/ui/Calendar.tsx`
- `src/app/_components/ui/Dropdown.tsx` → `DropdownMenu`
- `src/app/_components/ui/Chip.tsx` → `Badge`
- `src/app/_components/ui/Skeleton.tsx`
- `src/app/_components/ui/Tooltip.tsx`

New shadcn components added (no existing wrapper): Dialog, Switch, Card, Popover, Input, Textarea, Label, Separator.

Consumers updated to the new components:

- `src/app/_components/Providers.tsx` — `NextUIProvider` removed entirely
- `src/app/_components/KeyValue.tsx` — switches from a raw `@nextui-org/tooltip` import to the `@components/ui/Tooltip` wrapper
- `src/app/members/page.tsx` — `Modal` family → `Dialog`
- `src/app/events/_components/Event.tsx` — `Card`/`Divider`/`useDisclosure` → `Card`/`Separator`/local `useState`
- `src/app/events/_components/EventDetailModal.tsx` — `Modal` → `Dialog`
- `src/app/events/_components/RequestEvent.tsx` — `Modal` → `Dialog`
- `src/app/events/_components/EventForm.tsx` — `Input`/`Textarea`/`Switch`/`DateRangePicker` → shadcn equivalents + new start+duration fields (see below)
- `src/app/events/_utils/useEventForm.ts` — form shape changes from a date range to start+duration
- `src/app/_components/ui/skeletons/EventSkeleton.tsx` — `Card`/`Divider` → `Card`/`Separator`
- `src/app/_components/Menu.tsx` — `Dropdown` family → `DropdownMenu`
- `src/app/events/_components/EditableState.tsx` — `Dropdown` family → `DropdownMenu`

### Dependencies removed

All 13 `@nextui-org/*` packages, `framer-motion`, `@internationalized/date`, **and `moment`** (see "Date utilities" below — `moment`'s only usage is fully replaced by `date-fns`, which also kills a second date library).

### Dependencies added

`date-fns` (note: it likely already arrives transitively via `react-day-picker`/shadcn Calendar; pin it explicitly since this phase uses it directly in `src/utils/date.ts` and `useEventForm.ts`), plus whatever shadcn's CLI installs for Dialog/Popover/DropdownMenu (Radix primitives).

### Tailwind config

`tailwind.config.ts`: remove the `nextui()` plugin and its entry in `content`. No other structural change — colors stay under `theme.extend.colors` exactly as today (see "Theme mapping").

## Theme mapping (color palette preserved exactly)

**No color values change.** The existing custom palette (`primary #9c7243`, `secondary #bdd086`, `accent #85a042`, `dark #5a3d2d`, `background #E6DFC4`, `danger #ed5122`/`success #687f31`/`warning #fade15`/`unknown #7152ff`, plus the `default`/`green`/`orange`/`yellow`/`blue` 50–900 scales) stays in `tailwind.config.ts` under `theme.extend.colors`, untouched.

`src/styles/globals.css` gains a `:root` block defining shadcn's standard CSS variables, assigned from the existing hex values where a clear semantic match exists:

| shadcn var | source |
|---|---|
| `--background` | `#E6DFC4` |
| `--foreground` | `#5a3d2d` (existing `dark`) |
| `--primary` | `#9c7243` |
| `--secondary` | `#bdd086` |
| `--accent` | `#85a042` |
| `--destructive` | `#ed5122` (existing `danger`) |
| `--card`, `--border`, `--ring`, etc. | derived from the same palette, picked during implementation to match current visual appearance |

No shadcn-standard slot exists for `success`/`warning`/`unknown` — kept as additional custom CSS vars (`--success`, `--warning`, `--unknown`) since `Badge` needs all 5 event-state colors (default/warning/success/danger/unknown — see `formatEventState.ts`).

Tailwind's **default** color palette (slate, gray, red, blue, etc.) is unaffected — it already lives alongside the custom palette today since everything is under `extend`, and stays available after this phase. Nothing is removed; only additive CSS vars are introduced.

`components.json` is created by `shadcn init`, pointed at `src/styles/globals.css`; `baseColor` choice doesn't matter materially since every color slot is overridden to match the existing palette regardless.

## Component mapping detail

| File | NextUI used | shadcn replacement | Notes |
|---|---|---|---|
| `ui/Button.tsx` | `extendVariants`, `color="primary"` | `shadcn add button`; edit `cva` | Add `primary` (white text) variant, `xl` size variant |
| `ui/Calendar.tsx` | `extendVariants` + `@internationalized/date` | `shadcn add calendar` (react-day-picker) | `CalendarWithDates`/`isDateUnavailable` rewritten on plain `Date` using `date-fns isSameDay` |
| `ui/Dropdown.tsx` | Dropdown/Trigger/Menu/Item | `shadcn add dropdown-menu` | `DropdownMenuItem` needs `asChild` + `next/link` for `href`-style items (Menu.tsx); `onSelect` replaces `onAction` |
| `ui/Chip.tsx` | `extendVariants`, 5 colors | `shadcn add badge`; edit `cva` | Add `default`/`warning`/`success`/`danger`/`unknown` variants |
| `ui/Tooltip.tsx` | `extendVariants`, `xl` size | `shadcn add tooltip`; edit `cva` | Add `xl` content-size variant |
| `ui/Skeleton.tsx` | `extendVariants` | `shadcn add skeleton` | Near drop-in |
| `Providers.tsx` | `NextUIProvider` (navigate/locale/className) | deleted | Radix-based shadcn components need no global provider; `locale="cs-CZ"` was only consumed by NextUI's date pickers (now native); `className="h-full"` moves to a plain wrapping `div` |
| `KeyValue.tsx` | raw `@nextui-org/tooltip` | `@components/ui/Tooltip` | Consistency fix, in scope since it's still a NextUI import |
| `members/page.tsx` | `Modal` family | `shadcn add dialog` | `isOpen`/`onClose` → `open`/`onOpenChange` |
| `Event.tsx` | `Card`/`CardBody`/`CardHeader`, `Divider`, `useDisclosure` | `shadcn add card separator` | `useDisclosure` → local `useState<boolean>` |
| `EventDetailModal.tsx`, `RequestEvent.tsx` | `Modal`, `backdrop="blur"`, `hideCloseButton` | `Dialog` | Blur via `DialogOverlay` className override; suppress the default close-X by using a bare `DialogContent` (footers already have Zavřít/Zrušit buttons) |
| `EventForm.tsx` | `Input`, `Textarea`, `Switch`, `DateRangePicker` | `shadcn add input textarea switch label popover calendar` | No floating label in shadcn — each field becomes stacked `<Label>` + `<Input>`; `Switch` uses `checked`/`onCheckedChange`; date+duration per below |
| `useEventForm.ts` | `DateRangePickerProps`, `@internationalized/date` | rewritten form shape | See "Date + duration redesign" |
| `EventSkeleton.tsx` | `Card`, `Divider` | same as `Event.tsx` | |
| `Menu.tsx`, `EditableState.tsx` | `Dropdown` family | `DropdownMenu` | `EditableState`'s per-item `color` prop (warning/success/danger) becomes text/background classes applied directly to each `DropdownMenuItem` (no built-in color variant on that primitive) |

## Date + duration redesign

The current `DateRangePicker` (start+end range, `@internationalized/date`-based) has no shadcn equivalent. Replaced with a **start datetime + duration** model — a deliberate UX simplification, not just a like-for-like swap:

- **Form shape:** `useEventForm`'s `TEventInputs` changes from `{ date: { start, end } }` to `{ start: Date, duration: string }`, where `duration` is a free-typed `"HH:MM"` string.
- **Validation:** `duration` matched against `/^([0-9]{1,2}):([0-5][0-9])$/`, required.
- **Submit:** parse `duration` to minutes, compute `end = date-fns addMinutes(start, durationMinutes)`. The outgoing payload (`start`, `end` as `Date`) is unchanged — `Event` schema/DB/server are untouched.
- **Edit (`transformInitValues`):** given existing `start`/`end`, `start` passes through directly; `duration` is reverse-derived via `date-fns differenceInMinutes(end, start)` formatted back to `"HH:MM"`.
- **UI:** `start` renders as a `Popover` trigger (button showing the formatted date+time) → `PopoverContent` containing a shadcn `Calendar` for the date plus a native `<input type="time">` for the hour/minute, both merged into one `Date` and pushed into the `Controller` field. `duration` renders as a single `<Input placeholder="HH:MM">`, pattern-validated on blur/submit — no input-masking library, kept dependency-free.
- **Granularity:** minute-level, matching today's `granularity="minute"`. No seconds anywhere.
- **react-day-picker boundary:** the Calendar always hands back a plain JS `Date` — unavoidable. Everywhere else (arithmetic, diffing, formatting), use `date-fns`, never raw `Date` methods (`getTime`/`setHours`/etc.), for consistency and testability.

## Date utilities (`src/utils/date.ts`) — full migration off `@internationalized/date` and `moment`

Audited consumers (only call sites, confirmed via grep):

- `getTimeDiff` + `formatTime` (consumed together in `EventValues.tsx`) collapse into one `formatDuration(start: Date, end: Date): string`, built on `date-fns differenceInMinutes`, output format unchanged (`"H:MM"`, no leading zero on hours, padded minutes) — same rendered value as today.
- `formatDateToTime(date)` → `date-fns format(date, 'H:mm')` (replicates current leading-zero-stripped hour, zero-padded minute).
- `addMinutes` (consumed by `src/server/api/trpc.ts`'s `dateMiddleware`) → drop the custom implementation, import `date-fns`'s `addMinutes` directly at the call site.
- `parseDateJStoCalendarDateTime` (consumed by `ui/Calendar.tsx` and `useEventForm.ts`) → deleted entirely; both call sites work on plain `Date` directly once `@internationalized/date` is gone (`Calendar.tsx`'s `isDateUnavailable` uses `date-fns isSameDay`).

`moment` has no other usages in the codebase (confirmed via grep) — removing it from `package.json` is safe. This also removes the `lodash floor` import from `date.ts` (no longer needed once `getTimeDiff` is rewritten).

## Testing & exit criteria

- `grep -r "@nextui-org\|framer-motion\|@internationalized/date\|moment" src/ package.json` → empty.
- Full verification gate passes: `yarn install`, `npx prisma generate`, `yarn lint`, `npx tsc --noEmit`, `yarn build`, `yarn e2e`.
- Existing e2e specs assert via role/label locators (`getByRole('dialog')`, `getByLabel(...)`, `getByRole('button', { name: ... })`) — these survive the markup swap as long as accessible roles/labels are preserved (shadcn's Radix-based Dialog/Button do this natively).
- `event-crud.spec.ts` doesn't currently exercise the date field. Since the form's data model changes (start+duration replacing a range) is the one functional behavior change in this phase, add a new e2e case: fill start+duration on the request-event form, submit, and confirm the created event's date renders correctly on `/events`.
- Manual visual smoke-check of every screen (calendar, event cards, modals, members table, dropdown menu, badges/chips) — open the migrated dev build alongside the live production site (www.cmdrozdi.cz) as a visual reference and confirm colors/layout/spacing match. This is the largest manual-verification phase in the roadmap; budget time for it.

## Non-goals (explicitly out of scope, per master plan)

- Tailwind 3 → 4 conversion (Phase 6).
- React 19 / Next 16 (Phase 5).
- Touching `react`, `next`, `prisma`, `tailwind` (major), `zod`, `eslint`, `better-auth`.
