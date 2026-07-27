---
name: write
description: Write, rewrite, edit, or review clear human-facing prose without losing its meaning, facts, or intended voice. Use when someone invokes $hope:write in Codex or /hope:write in Claude Code, asks Hope to draft or improve text, or works on documentation, a wiki, a README, product copy, an explanation, or another prose-heavy file.
---

# Hope write

Use the active Claude or Codex session only to produce the prose. Let the Hope
runtime provide the current writing standard and mode contract.

## Choose the command

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/write/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/write/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file. Pass every argument as a separate shell argument. Never pass the
placeholder or build a command from the person's text.

## Get the writing brief

Choose the mode from the requested action:

- Use `draft` to create new prose.
- Use `edit` to change existing prose or files.
- Use `review` to report findings without changing files.

Do not ask for a mode when the request already makes the action clear. Run:

```text
brief --mode <draft|edit|review>
```

The returned JSON is Hope's complete writing brief. Follow its `standard` and
mode-specific `response`. Also follow the person's request and any more
specific project rule.

Write in the current language unless the person or project asks for another
one. Do not copy the brief or its checklist into the result.
