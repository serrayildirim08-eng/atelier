---
description: Show today's Claude Code token usage and estimated cost for this project
argument-hint: "[days] (default: 1)"
---

Run the cost report script and show the user the result. The script summarizes token usage from session logs in `~/.claude/projects/-Users-serrayildirim-projects-akalan-portal/`.

```bash
bash $CLAUDE_PROJECT_DIR/.claude/scripts/cost-today.sh $ARGUMENTS
```

After showing the output, give one short tip if the total is high (e.g., "switch to Sonnet with /model claude-sonnet-4-6" if Opus dominates, or "use /clear more often" if cache reads are low compared to fresh input).
