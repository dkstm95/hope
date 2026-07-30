---
name: write
description: Draft, edit, or review clear language without losing meaning, facts, uncertainty, or voice. Use when someone invokes $hope:write in Codex or /hope:write in Claude Code, works on documentation or other prose, or would benefit from clearer prompts, instructions, responses, interface text, errors, comments, or names inside implementation work.
---

# Hope write

Use the active Claude or Codex session to apply the writing pass.

Let the Hope runtime provide the current writing standard and mode contract.

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
file.

Pass every argument as a separate shell argument.

Never pass the placeholder or build a command from the person's text.

## Get the writing brief

Choose the mode from the requested action:

- Use `draft` to create new prose.
- Use `edit` to change existing prose or files.
- Use `review` to report findings without changing files.

Do not ask for a mode when the request already makes the action clear.

Run:

```text
brief --mode <draft|edit|review>
```

The returned JSON is Hope's complete writing brief.

Follow its `standard` and mode-specific `response`.

Also follow the person's request and any more specific project rule.

Use Write for a standalone language-only draft, edit, or review.

Use Hope Polish when the person instead asks for one bounded revision of a named
completed work product that may include structural cleanup, refactoring,
consolidation, or supported removal.

Write in the current language unless the person or project asks for another one.

Preserve exact text when the brief requires it.

When clarifying an input prompt, do not silently change its scope or resolve a
material ambiguity.

Do not copy the brief or its checklist into the result.
