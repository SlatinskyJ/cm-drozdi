# Task 3: Skeleton migration — Report

## What I implemented

1. **Deleted legacy wrapper first** (per the ordering constraint to avoid macOS case-insensitive collision):
   ```bash
   git rm src/app/_components/ui/Skeleton.tsx
   ```

2. **Ran the shadcn CLI** to generate the primitive:
   ```bash
   npx shadcn@latest add skeleton --yes
   ```
   Output:
   ```
   - Checking registry.
   ✔ Checking registry.
   - Updating files.
   ✔ Created 1 file:
     - src/app/_components/ui/skeleton.tsx
   ```
   Generated content matches the expected shape exactly:
   ```tsx
   import { cn } from "~/lib/utils"

   function Skeleton({
     className,
     ...props
   }: React.HTMLAttributes<HTMLDivElement>) {
     return (
       <div
         className={cn("animate-pulse rounded-md bg-primary/10", className)}
         {...props}
       />
     )
   }

   export { Skeleton }
   ```
   (Brief said `bg-muted`; actual generated class is `bg-primary/10` — this is just the current shadcn registry's default skeleton style, not a deviation I introduced. Functionally a drop-in, className-only API as required.)

   `components.json` was not touched by the CLI (verified via `git diff components.json` — empty).

3. **Updated the 4 consumers' import paths** from `@components/ui/Skeleton` to `@components/ui/skeleton` via sed, in:
   - `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`
   - `src/app/_components/ui/skeletons/EventSkeleton.tsx`
   - `src/app/reset-password/ResetPasswordSkeleton.tsx`
   - `src/app/members/_components/MembersSkeleton.tsx`

   Diffs are import-line-only; confirmed `EventSkeleton.tsx` still imports `Card`/`CardBody`/`CardHeader` from `@nextui-org/card` and `Divider` from `@nextui-org/divider` — left untouched for Task 8.

## Fast gate output

- `SKIP_ENV_VALIDATION=1 yarn lint` → `✔ No ESLint warnings or errors`
- `npx tsc --noEmit` → no output, exit clean
- `SKIP_ENV_VALIDATION=1 yarn build` → `✓ Compiled successfully`, all 11 pages generated. (Warnings present are pre-existing/unrelated: browserslist outdated, Better Auth base URL/secret warnings, metadataBase warnings — none related to this change.)

All three steps passed clean.

## Files changed

- Deleted: `src/app/_components/ui/Skeleton.tsx`
- Created: `src/app/_components/ui/skeleton.tsx`
- Modified: `src/app/_components/ui/skeletons/CalendarSkeleton.tsx`
- Modified: `src/app/_components/ui/skeletons/EventSkeleton.tsx`
- Modified: `src/app/reset-password/ResetPasswordSkeleton.tsx`
- Modified: `src/app/members/_components/MembersSkeleton.tsx`

Commit: `53df79c feat: migrate Skeleton to shadcn`

Note: the commit also swept up two pre-existing untracked report files (`docs/superpowers/task-reports/task-1-report.md`, `task-2-report.md`) that were sitting untracked in the worktree before I started — `git add -A` picked them up alongside my changes. They are docs-only and harmless, but flagging since they weren't part of this task's own output.

## Self-review findings

- `Skeleton.tsx` is gone; `skeleton.tsx` is present. Confirmed via `ls`.
- All 4 consumers now import from the lowercase `@components/ui/skeleton` path. Confirmed via grep.
- `EventSkeleton.tsx` and `CalendarSkeleton.tsx` still use NextUI `Card`/`Divider`/utility classes (`rounded-large`, `bg-content1`, `shadow-small`, `text-default-400`) — untouched, confirmed via grep showing `@nextui-org/card` and `@nextui-org/divider` imports still present in `EventSkeleton.tsx`.
- Fast gate (lint, tsc, build) passed clean.
- `components.json` unmodified by the CLI.

## Concerns

- None blocking. Only note: the shadcn registry's default skeleton class is `bg-primary/10` rather than `bg-muted` as the brief anticipated — purely a registry detail, doesn't affect the className-only drop-in API contract, and is not something to "fix" since it reflects the current shadcn CLI output exactly as run.
- The stray task-1/task-2 report files got included in this commit (see note above) — not harmful, just worth knowing in case those reports were meant to be committed separately/already.
