# Design — Claude GitHub Bot

**Date:** 2026-06-16
**Repo:** cm-drozdi (cmdrozdi.cz)

## Overview

A Claude Code Routine that sweeps `@claude` PR comments on demand, applying code fixes and answering questions, posting results as a dedicated bot GitHub account.

---

## Architecture

### Claude Code Routine

- **Trigger type:** GitHub — PR comment events
- **Filter:** comment body matches `@claude resolve`
- **Repository:** cm-drozdi
- **Prompt:** short (see below); references `.github/claude-bot.md` in the repo for project context
- **Runs on:** Anthropic-managed cloud infrastructure (no local machine required)

### Bot GitHub Account

A dedicated GitHub account (name TBD, e.g. `cmdrozdi-claude-bot`) with write access to cm-drozdi. All comments and commits the bot makes appear under this account, keeping the user's own comments visually distinct.

- Generate a PAT for the bot account (scope: `repo` — covers commits, PR comments, and branch push)
- Store the PAT as a secret accessible to the Routine (via MCP connector or Routine env var)
- The Routine uses this PAT for all GitHub API calls (posting comments) and git operations (commit author + push)

---

## Trigger Flow

1. User leaves one or more `@claude <instruction>` comments on a PR (inline review threads or top-level)
2. When ready for a sweep, user posts `@claude resolve` in the PR
3. Routine fires; Claude reads `.github/claude-bot.md` for project context
4. Claude finds all `@claude` comments in the PR and processes them (see rules below)
5. Claude replies to the `@claude resolve` comment with a sweep summary

---

## Comment Processing Rules

**Skip (silently):**
- Any `@claude` comment that already has a reply from the bot account → already handled in a prior sweep
- Any `@claude resolve` comment that already has a bot reply → this Routine run is a duplicate, exit immediately
- Outdated comments (comments on code lines that no longer exist in the current diff)

**Fix request** (comment asks Claude to change code):
1. Edit the relevant files
2. Run verification gate: `yarn lint` + `npx tsc --noEmit`
3. Commit to the PR branch (commit author = bot account)
4. Push
5. Reply to the comment with a summary of what was changed

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

After processing all comments, the bot replies to the `@claude resolve` comment with a summary, e.g.:

> Done. Fixed 2 issues, answered 1 question, skipped 1 outdated comment.

This reply also serves as the duplicate-detection marker: a second `@claude resolve` with no bot reply is a fresh sweep; one with a bot reply is a duplicate and exits immediately.

The user can post new `@claude` comments after a sweep and trigger `@claude resolve` again for another pass.

---

## `.github/claude-bot.md` — Content Structure

This file lives in the repo (versioned) and is read by the Routine at the start of every run. The Routine prompt itself is minimal; all project knowledge lives here.

Sections:
- **Project overview** — condensed from `CLAUDE.md`: T3 stack, branching rules (`develop` integration branch, `main` production-only), path aliases, tRPC/auth/Prisma notes
- **Bot role** — process all pending `@claude` comments in the triggered PR
- **Verification gate** — `yarn lint` + `npx tsc --noEmit` must pass before any push
- **Commit conventions** — follow repo style; bot account as author; one commit per logical fix
- **Constraints** — never touch `main`; don't apply fixes to outdated comments; don't resolve comments about future work (flag them)
- **Trigger comment** — `@claude resolve` starts the sweep; the bot must not process this comment as a task

---

## Routine Prompt (stored in Routine config)

```
Read `.github/claude-bot.md` for project context and operating instructions.

You have been triggered by an `@claude resolve` comment on PR #{{pr_number}} in the cm-drozdi repo.
Find all `@claude` comments in this PR and process them according to the instructions in `.github/claude-bot.md`.
When done, reply to the `@claude resolve` comment with a sweep summary.
```

> **Implementation note:** Verify whether the Routine GitHub trigger injects context variables (e.g. `{{pr_number}}`, `{{comment_body}}`). If not, the prompt will need to instruct Claude to discover the PR number from the triggering event payload instead.

---

## Out of Scope

- Polling or always-on infrastructure — runs only when `@claude resolve` is posted
- Support for other repos — design is cm-drozdi specific for now; `.github/claude-bot.md` pattern is reusable
- GitHub Actions — Routines replace this entirely
- Automatic scheduling — purely on-demand
