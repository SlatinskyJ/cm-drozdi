# Design — Claude GitHub Bot

**Date:** 2026-06-16
**Repo:** cm-drozdi (cmdrozdi.cz)

## Overview

A Claude Code Routine that sweeps `@claude` PR comments on demand, applying code fixes and answering questions, posting results as a dedicated bot GitHub account (`cmdrozdi-bot`).

---

## Architecture

```
@claude resolve comment (posted by repo owner)
       ↓
GitHub Actions workflow (.github/workflows/claude-resolve.yml)
  — issue_comment trigger, filtered to owner + "@claude resolve"
  — checks PR is open
  — POSTs to Routine /fire endpoint with PR number, comment URL
       ↓
Claude Code Routine (API trigger, runs on Anthropic cloud)
  — reads .github/claude-bot.md for project context
  — processes all pending @claude comments in the PR
  — pushes fixes, posts replies as claude-bot account
  — replies to @claude resolve with sweep summary
```

### Claude Code Routine

- **Trigger type:** API — HTTP POST to per-routine `/fire` endpoint
- **Repository:** cm-drozdi
- **Runs on:** Anthropic-managed cloud infrastructure (no local machine required)
- **Prompt:** short (see below); Routine reads `.github/claude-bot.md` from repo at runtime

> **Note:** GitHub triggers for Routines are research-preview and do not support private repositories. GitHub Actions is used as the event bridge instead.

### Bot GitHub Account

- **Username:** `cmdrozdi-bot` (verify availability; fall back to `cmdrozdi-bot` if taken)
- **Permissions:** write access to cm-drozdi repo
- **PAT scope:** `repo` (covers commits, PR comments, branch push)
- **PAT storage:** Routine environment variables section (never travels over the wire)
- All comments and commits the bot makes appear under this account, keeping the user's own comments visually distinct

### GitHub Actions Secrets

| Secret | Value |
|--------|-------|
| `CLAUDE_ROUTINE_URL` | Routine `/fire` endpoint URL |
| `CLAUDE_ROUTINE_TOKEN` | Routine bearer token |

---

## Trigger Flow

1. User leaves one or more `@claude <instruction>` comments on a PR
2. When ready for a sweep, user posts `@claude resolve` in the PR
3. GitHub Actions fires on the `issue_comment` event:
   - Filters to comments by the repo owner only
   - Filters to comments containing `@claude resolve`
   - Checks the PR is open (exits silently if closed/merged)
   - POSTs to Routine `/fire` with: PR number, comment URL
4. Routine fires; Claude reads `.github/claude-bot.md` for project context
5. Claude checks if this specific `@claude resolve` comment already has a reply from `@claude-bot` — if yes, this is a duplicate run, exit immediately
6. Claude finds all `@claude` comments in the PR and processes them
7. Claude replies to the `@claude resolve` comment with a sweep summary

---

## Sweep Startup

At the start of every sweep, before processing any comments:

```bash
yarn install        # also runs prisma generate via postinstall
```

No `DATABASE_URL` needed — `prisma generate` reads `prisma/schema.prisma` only (no live DB). Lint and typecheck are static and also require no DB.

Node version: trust Anthropic's cloud environment (repo requires >=20; Routine infra assumed to meet this).

---

## Comment Processing Rules

**Skip (silently):**
- Any `@claude` comment that already has a reply from `@claude-bot` → handled in a prior sweep
- The `@claude resolve` trigger comment itself
- Outdated comments (on code lines no longer in the current diff)

**Fix request** (comment asks Claude to change code):
1. Edit the relevant files
2. Run `yarn lint` + `npx tsc --noEmit`
3. If verification fails → attempt to self-heal the failure
   - If self-heal is clear → fix, re-verify, proceed
   - If self-heal is ambiguous → post a reply comment asking for clarification, skip this fix
4. Commit to PR branch with message: `fix: <description> (resolves @claude-bot comment)`
   - Commit author = `cmdrozdi-bot`
   - One commit per fixed comment
5. Push
6. Reply to the comment with a summary of what was changed

**Question** (comment asks why/how something works):
1. Post a reply comment with the answer
2. No code changes

**Ambiguous** (intent unclear):
1. Reply asking for clarification
2. No code changes

**Push failure:**
- Reply to the `@claude resolve` trigger comment with the error; do not retry silently

---

## Sweep Completion

After processing all comments, the bot replies to the `@claude resolve` comment:

> Done. Fixed 2 issues, answered 1 question, skipped 1 outdated comment.

This reply is also the duplicate-detection marker for future runs. The user can post new `@claude` comments and trigger `@claude resolve` again for another sweep — each sweep is independent.

---

## Git Authentication (in Routine)

The Routine configures git using the bot PAT from its env vars before any commit/push:

```bash
git config user.name "cmdrozdi-bot"
git config user.email "claude-bot@users.noreply.github.com"
git remote set-url origin https://claude-bot:${BOT_PAT}@github.com/SlatinskyJ/cm-drozdi.git
```

---

## `.github/claude-bot.md` — Content Structure

Lives in the repo (versioned). The Routine reads it at the start of every run. The Routine prompt itself is minimal; all project knowledge lives here.

Sections:
- **Project overview** — condensed from `CLAUDE.md`: T3 stack, branching rules, path aliases, tRPC/auth/Prisma notes, verification gate
- **Bot role** — process all pending `@claude` comments in the triggered PR
- **Verification gate** — `yarn lint` + `npx tsc --noEmit`; self-heal failures; post comment if ambiguous
- **Commit conventions** — `fix: <description> (resolves @claude comment)`; bot account as author; one commit per fix
- **Constraints** — never touch `main`; skip outdated comments; skip already-answered comments; don't apply fixes to future-work comments (flag them)
- **Trigger comment** — `@claude resolve` starts the sweep; do not process it as a task

Full draft is written as part of the implementation.

---

## Routine Prompt (stored in Routine config)

```
Read `.github/claude-bot.md` for project context and operating instructions.

You have been triggered by an `@claude resolve` comment. Context:

{{text}}

Parse the PR number and triggering comment URL from the above, then proceed according to `.github/claude-bot.md`.
```

> **Note:** `{{text}}` injects the raw API trigger payload. The setup script handles checkout; Claude only needs to parse the comment URL from the payload to post the sweep summary reply. Verify `{{text}}` is substituted on first run — if it appears literally, update the prompt to instruct Claude to read the incoming context directly.

---

## GitHub Actions Workflow (`.github/workflows/claude-resolve.yml`)

Trigger: `issue_comment` → `created`

Steps:
1. Filter: comment author must be repo owner (`SlatinskyJ`)
2. Filter: comment body must contain `@claude resolve`
3. Check PR is open via GitHub API; exit silently if closed/merged
4. POST to `${{ secrets.CLAUDE_ROUTINE_URL }}` with bearer token `${{ secrets.CLAUDE_ROUTINE_TOKEN }}` and body containing PR number, comment URL

No checkout needed — the Routine clones the repo itself.

---

## Out of Scope

- Polling or always-on infrastructure
- Support for other repos (`.github/claude-bot.md` pattern is portable when needed)
- Automatic scheduling
- GitHub Copilot or GitHub Actions as the AI executor (Routine handles all intelligence)
