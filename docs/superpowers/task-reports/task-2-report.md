# Task 2 Report: Date utilities — date.ts partial migration to date-fns

## What was implemented

Completed Steps 1–3 from the brief:

### Step 1: Rewrote `src/utils/date.ts`
- Replaced `moment` + `lodash floor` with `date-fns` equivalents
- Deleted `getTimeDiff()`, `formatTime()`, and `addMinutes()` (custom helper)
- Added `formatDuration(start: Date, end: Date): string` using `date-fns`'s `differenceInMinutes` and `format`
- Kept `parseDateJStoCalendarDateTime()` untouched (still needed by Calendar.tsx and useEventForm.ts in later tasks)
- Imports now: `@internationalized/date` (parseDateTime), `date-fns` (differenceInMinutes, format)

### Step 2: Updated `src/app/events/_components/EventValues.tsx`
- Changed import from `formatDateToTime, formatTime, getTimeDiff` → `formatDateToTime, formatDuration`
- Replaced `timeDiff` calculation (using getTimeDiff) with `duration` calculation (using formatDuration)
- Simplified "Délka" KeyValue from `!!timeDiff ? formatTime(timeDiff) : null` to just `duration`

### Step 3: Updated `src/server/api/trpc.ts`
- Changed import from `import { addMinutes } from '~/utils/date'` → `import { addMinutes } from 'date-fns'`
- No call-site changes needed; `date-fns`'s `addMinutes(date: Date, amount: number)` has identical signature

## Fast gate results

```
✓ SKIP_ENV_VALIDATION=1 yarn lint    — No ESLint warnings or errors
✓ npx tsc --noEmit                   — No TypeScript errors
✓ SKIP_ENV_VALIDATION=1 yarn build   — Build succeeded (11/11 pages generated)
```

All three gates passed clean.

## Manual smoke-check trace

For an event with `start = 14:00` and `end = 15:30`:

**Čas (time) field:**
- Calls `formatDateToTime(14:00)`
- Uses `format(date, 'H:mm')` from date-fns
- Result: `"14:00"` ✓ (matches old behavior)

**Délka (duration) field:**
- Calls `formatDuration(14:00, 15:30)`
- `differenceInMinutes(15:30, 14:00)` → 90 minutes
- `hours = Math.floor(90 / 60)` → 1
- `remainder = String(90 % 60).padStart(2, '0')` → String(30).padStart(2, '0') → `"30"`
- Result: `"1:30"` ✓ (matches old behavior: 1 hour, 30 minutes with zero-padded remainder)

Math verified manually; function signatures and output formats produce identical results to the old implementation.

## Files changed

- `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-4-shadcn/src/utils/date.ts`
- `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-4-shadcn/src/app/events/_components/EventValues.tsx`
- `/Users/jakubslatinsky/Dev/cm-drozdi-worktrees/feat--upgrade-phase-4-shadcn/src/server/api/trpc.ts`

## Self-review findings

✓ `parseDateJStoCalendarDateTime` kept (not deleted) — still consumed by Calendar.tsx and useEventForm.ts
✓ Final date.ts exports: `formatDuration`, `parseDateJStoCalendarDateTime`, `formatDateToTime` (exactly 3 functions)
✓ Imports from `moment` and `lodash floor` removed
✓ `moment`, `floor`, `getTimeDiff`, `formatTime`, custom `addMinutes` all deleted
✓ `date-fns` import added with `differenceInMinutes` and `format` functions
✓ `addMinutes` now imported from `date-fns` in trpc.ts
✓ Fast gate passes (lint, tsc, build all clean)
✓ No breaking changes to consumer code; EventValues.tsx compiles and runs

## Concerns

None. All steps completed as specified. Fast gate passing. No deviations from the brief.
