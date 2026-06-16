# Claude GitHub Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up a Claude Code Routine that sweeps `@claude` PR comments when the repo owner posts `@claude resolve`, applying fixes and answering questions as a dedicated `@claude-bot` GitHub account.

**Architecture:** GitHub Actions workflow listens for `@claude resolve` PR comments (owner-only) and POSTs to a Claude Code Routine's API trigger endpoint. The Routine runs on Anthropic's cloud, reads `.github/claude-bot.md` for project context, processes all pending `@claude` comments in the PR (fixes or answers each), then replies to the trigger comment with a sweep summary.

**Tech Stack:** GitHub Actions (`issue_comment` trigger), Claude Code Routines (API trigger), `gh` CLI / GitHub REST API, `jq`, `yarn`, TypeScript/Next.js (the app being edited by the bot)

---

### Task 1: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/claude-resolve.yml`

- [ ] **Step 1: Create `.github/` directory and workflow file**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/claude-resolve.yml`:

```yaml
name: Claude Bot — Resolve PR Comments

on:
  issue_comment:
    types: [created]

jobs:
  claude-resolve:
    # Only fire when:
    # - comment is by the repo owner
    # - comment contains "@claude resolve"
    # - the issue is actually a PR
    # - the PR is open
    if: |
      github.event.comment.user.login == 'SlatinskyJ' &&
      contains(github.event.comment.body, '@claude resolve') &&
      github.event.issue.pull_request != null &&
      github.event.issue.state == 'open'
    runs-on: ubuntu-latest

    steps:
      - name: Fire Claude Routine
        env:
          PR_NUMBER: ${{ github.event.issue.number }}
          COMMENT_URL: ${{ github.event.comment.html_url }}
          ROUTINE_URL: ${{ secrets.CLAUDE_ROUTINE_URL }}
          ROUTINE_TOKEN: ${{ secrets.CLAUDE_ROUTINE_TOKEN }}
        run: |
          payload=$(jq -n \
            --arg pr "$PR_NUMBER" \
            --arg url "$COMMENT_URL" \
            '{"text": "PR number: \($pr)\nTriggering comment URL: \($url)"}')

          curl -sf -X POST "$ROUTINE_URL" \
            -H "Authorization: Bearer $ROUTINE_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$payload"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/claude-resolve.yml
git commit -m "feat: add GitHub Actions workflow to fire Claude Routine on @claude resolve"
```

---

### Task 2: Bot Context File

**Files:**
- Create: `.github/claude-bot.md`

- [ ] **Step 1: Write `.github/claude-bot.md`**

```markdown
# Claude Bot — Project Context & Operating Instructions

You are `@claude-bot`, a Claude Code Routine acting on the cm-drozdi repository (cmdrozdi.cz). You process `@claude` PR comments posted by the repo owner (`SlatinskyJ`) — applying code fixes and answering questions.

---

## Project Overview

**Stack:** Next.js 14 App Router, tRPC, Prisma, NextAuth v4, Tailwind, NextUI (mid-migration to shadcn/ui).

**Path aliases (tsconfig):**
- `~/*` → `src/*`
- `@public/*` → `public/*`
- `@components/*` → `src/app/_components/*`

**Branching:** `develop` is the integration branch. `main` is production-only — never commit or push to `main`. PRs target `develop`.

**Key architecture notes:**
- tRPC routers live in `src/server/api/routers/`. All procedures pass through `timingMiddleware` and `dateMiddleware` (auto timezone-adjusts `Date` fields — don't double-adjust).
- Auth: NextAuth v4 in `src/server/auth.ts`. `UserRole` enum: `GUEST=0`, `MEMBER=1`, `ADMIN=2`.
- Env vars validated via `@t3-oss/env-nextjs` in `src/env.js` — any new env var needs schema + `runtimeEnv` entry there.
- `prisma/schema.prisma` is the domain model source of truth.

---

## Your Role

When triggered, you receive a PR number and a triggering comment URL. Your job:

1. Configure git and authenticate (see Git Setup below)
2. Run `yarn install` (installs deps; postinstall runs `prisma generate` automatically — no DB needed)
3. Find all comments in the PR
4. Process each eligible `@claude` comment (see rules below)
5. Reply to the triggering `@claude resolve` comment with a sweep summary

---

## Git Setup (do this before any commit or push)

```bash
export GH_TOKEN="$BOT_PAT"
git config user.name "claude-bot-cmdrozdi"
git config user.email "claude-bot@users.noreply.github.com"
git remote set-url origin https://claude-bot:${BOT_PAT}@github.com/SlatinskyJ/cm-drozdi.git
```

`BOT_PAT` is available as an environment variable in your Routine environment. `GH_TOKEN` must be set so the `gh` CLI authenticates as `claude-bot-cmdrozdi`.

Checkout the PR branch before making any edits:
```bash
gh pr checkout <PR_NUMBER>
```

---

## Comment Processing Rules

### Skip silently:
- Any `@claude` comment that already has a reply from `@claude-bot` (handled in a prior sweep)
- The `@claude resolve` trigger comment itself
- Outdated comments (on diff lines that no longer exist in the current PR)

### Duplicate detection:
Check if the triggering `@claude resolve` comment already has a reply from `@claude-bot`. If yes, this is a duplicate run — exit immediately without processing anything.

### Fix request (comment asks you to change code):
1. Edit the relevant files
2. Run the verification gate:
   ```bash
   yarn lint
   npx tsc --noEmit
   ```
3. If verification fails:
   - Attempt to self-heal the failures
   - If the fix is unambiguous → apply it, re-run verification, proceed
   - If the fix is ambiguous → reply to the comment asking for clarification; skip this fix for now
4. Commit with message: `fix: <brief description> (resolves @claude-bot comment)`
   - One commit per fixed comment
5. Push: `git push origin HEAD`
6. Reply to the comment summarising what was changed

### Question (comment asks why/how something works):
1. Post a reply with the answer
2. No code changes, no commit

### Ambiguous (intent is unclear):
1. Post a reply asking for clarification
2. No code changes, no commit

### Push failure:
- Reply to the `@claude resolve` trigger comment with the error message
- Do not retry

---

## Sweep Summary

After processing all comments, reply to the `@claude resolve` comment:

> Done. Fixed N issues, answered N questions, skipped N outdated comments.

This reply also acts as the duplicate-detection marker — a future `@claude resolve` without a bot reply on it means it's a fresh sweep.

---

## Constraints

- **Never commit or push to `main`**
- **Never push to `develop` directly** — only to the PR's feature branch
- Skip comments that discuss future work or out-of-scope changes (reply flagging them as out of scope instead)
- Follow existing code patterns; don't introduce abstractions beyond what the fix requires
- No test suite exists — the only verification gate is `yarn lint` + `npx tsc --noEmit`
```

- [ ] **Step 2: Commit**

```bash
git add .github/claude-bot.md
git commit -m "feat: add claude-bot context file for Claude Code Routine"
```

---

### Task 3: Manual — Create Bot GitHub Account

> These steps cannot be automated. Complete them in your browser.

- [ ] **Step 1: Check username availability**

Go to `https://github.com/claude-bot` — if the account exists and is not yours, use `claude-bot-cmdrozdi` instead. Update `.github/claude-bot.md` and the workflow git config accordingly if you use a different name.

- [ ] **Step 2: Create the account**

Sign up at github.com with a new email address. Set username to `claude-bot-cmdrozdi` (or fallback).

- [ ] **Step 3: Grant repo access**

In the cm-drozdi repo settings → Collaborators → Add `claude-bot-cmdrozdi` with **Write** role.

Accept the invitation from the `claude-bot-cmdrozdi` account.

- [ ] **Step 4: Generate a PAT for `claude-bot-cmdrozdi`**

Logged in as `claude-bot-cmdrozdi`:
- Go to Settings → Developer settings → Personal access tokens → Fine-grained tokens (or classic)
- Classic token, scope: `repo`
- No expiry (or set a long expiry you'll remember to rotate)
- Copy the token — you'll need it in Tasks 4 and 5

---

### Task 4: Manual — Create Claude Code Routine

> Complete in the Claude Code desktop app or at `claude.ai/code/routines`.

- [ ] **Step 1: Create a new Routine**

Name: `cm-drozdi PR Resolver`
Type: Remote

- [ ] **Step 2: Set the prompt**

```
Read `.github/claude-bot.md` for project context and operating instructions.

You have been triggered by an `@claude resolve` comment. The following context was provided:

{{text}}

Extract the PR number and triggering comment URL from the above text, then proceed according to `.github/claude-bot.md`.
```

> **Note:** `{{text}}` may or may not be interpolated depending on how the Routine injects the POST body's `text` field. If the raw placeholder appears at runtime (not substituted), remove the `{{text}}` and instead instruct Claude to use the `gh` CLI to find the most recent `@claude resolve` comment on the PR as the trigger. Verify this on first run.

- [ ] **Step 3: Set trigger to API**

Trigger type: API

- [ ] **Step 4: Add environment variable**

In the Routine's environment/secrets section:
```
BOT_PAT = <the PAT generated in Task 3 Step 4>
```

- [ ] **Step 5: Save the Routine and copy the API credentials**

After saving, the Routine will show:
- **Endpoint URL** (the `/fire` URL)
- **Bearer token**

Copy both — needed in Task 5.

---

### Task 5: Manual — Add GitHub Actions Secrets

> In the cm-drozdi repo on GitHub: Settings → Secrets and variables → Actions → New repository secret.

- [ ] **Step 1: Add `CLAUDE_ROUTINE_URL`**

Value: the Routine `/fire` endpoint URL from Task 4 Step 5.

- [ ] **Step 2: Add `CLAUDE_ROUTINE_TOKEN`**

Value: the Routine bearer token from Task 4 Step 5.

---

### Task 6: Smoke Test

- [ ] **Step 1: Create a test PR**

Push a small throwaway branch from `develop` and open a draft PR.

- [ ] **Step 2: Leave a test `@claude` comment**

On any line in the diff, add an inline comment:
```
@claude Add a comment explaining what this line does
```

- [ ] **Step 3: Post `@claude resolve`**

As `SlatinskyJ`, post a top-level PR comment:
```
@claude resolve
```

- [ ] **Step 4: Verify GitHub Actions fired**

Go to the repo's Actions tab → `Claude Bot — Resolve PR Comments`. Confirm the run appeared and succeeded (green).

- [ ] **Step 5: Verify Routine fired**

Go to `claude.ai/code/routines` → `cm-drozdi PR Resolver` → run history. Confirm a run appeared.

- [ ] **Step 6: Verify bot replied**

Check the PR — `@claude-bot` should have replied to the `@claude` comment and posted a sweep summary on the `@claude resolve` comment.

- [ ] **Step 7: Close and delete the test PR/branch**

```bash
gh pr close <number> --delete-branch
```
