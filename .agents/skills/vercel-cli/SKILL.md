---
name: vercel-cli
description: Inspect and manage Vercel deployments, logs, projects, and env vars via the `vercel` CLI instead of the token-heavy Vercel MCP. Use when checking deploy status, reading build/runtime logs, listing projects/deployments, pulling env vars, or deploying.
metadata:
  priority: 5
  docs:
    - "https://vercel.com/docs/cli"
  bashPatterns:
    - '\bvercel\s+'
  promptSignals:
    phrases:
      - "vercel deploy"
      - "vercel logs"
      - "vercel deployment"
      - "check deploy"
      - "build logs"
      - "runtime logs"
      - "vercel env"
      - "deploy status"
    anyOf:
      - "vercel"
      - "deployment"
      - "deploy"
    minScore: 4
retrieval:
  aliases:
    - vercel cli
    - vercel deploy
---

# Vercel CLI

Use the `vercel` CLI for all Vercel work. Cheaper than the Vercel MCP (which was removed for token cost). CLI installed globally (`vercel --version`).

## Prereqs

- Auth check: `vercel whoami`. If not logged in, tell user to run `vercel login` themselves (interactive — suggest they type `! vercel login`).
- Link project (once per repo): `vercel link`. Creates `.vercel/project.json` with project + org id. Most commands below need this or an explicit project name.
- Non-interactive: pass `--yes` to skip prompts. Token auth: `vercel --token $VERCEL_TOKEN ...` or `VERCEL_TOKEN` env.
- Scope to a team: `--scope <team-slug>`.

## Command map (MCP tool → CLI)

| Need | CLI |
|------|-----|
| List projects | `vercel project ls` |
| Inspect project | `vercel project inspect <name>` |
| List deployments | `vercel ls [project]` |
| Inspect a deployment | `vercel inspect <url>` |
| Build logs | `vercel inspect <url> --logs` |
| Runtime logs (live) | `vercel logs <url>` |
| Deploy preview | `vercel` |
| Deploy prod | `vercel --prod` |
| List teams | `vercel teams ls` |
| List env vars | `vercel env ls` |
| Pull env to `.env` | `vercel env pull` |
| Add env var | `vercel env add <name> <env>` |
| Redeploy | `vercel redeploy <url>` |

## Common flows

**Check latest deploy status**
```bash
vercel ls --yes            # newest first; grab top URL
vercel inspect <url>       # state: BUILDING / READY / ERROR
```

**Debug failed build**
```bash
vercel ls --yes
vercel inspect <url> --logs   # build-time logs
```

**Tail runtime errors**
```bash
vercel logs <deployment-url>  # streams; Ctrl-C to stop. Use -j for JSON.
```

**Deploy this branch**
```bash
vercel              # preview URL
vercel --prod       # production
```

## Tips

- Output is human-formatted by default. Add `-j` / `--json` where supported for parsing.
- `vercel inspect` accepts deployment URL or deployment id.
- Build logs are point-in-time; `vercel logs` is for live/runtime. Don't confuse them.
- Don't tail `vercel logs` in a blocking foreground call — run in background or bound it, else it hangs.
- For Vercel docs lookups the MCP `search_vercel_documentation` is gone; use WebFetch on https://vercel.com/docs or the `context7` MCP.
