<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:cheap-mode -->
# Cheap mode (token discipline)

Default to short replies. No restating the task, no trailing summaries, no decorative headers for one-line answers. Skip preamble like "I'll now…" — just do it.
Don't open large files unless needed for the task. Prefer `grep`/`Glob` over reading whole modules.
Don't spawn subagents for things a single grep or read can answer.
Comments in code: only when the WHY is non-obvious (already in base instructions — restated here because token discipline is the main goal in this repo).
<!-- END:cheap-mode -->
