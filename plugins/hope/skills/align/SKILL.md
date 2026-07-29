---
name: align
description: Align a person and AI on a task before implementation by finding important misunderstandings, adapting the interview to risk, and rendering the current shared understanding. Use when someone invokes $hope:align in Codex or /hope:align in Claude Code, asks to align before coding, wants requirements or design clarified before implementation, or needs a pre-implementation shared-understanding check.
---

# Hope align

Use the active Claude or Codex session for repository inspection and the
interview. Let the Hope runtime own the interview contract, readiness checks,
resource limits, and HTML rendering.

## Locate the command

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/align/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/align/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file. Pass every argument as a separate shell argument. Never pass the
placeholder or build a command from the person's text.

## Get the brief

Classify task risk as `low`, `medium`, or `high`. Mark UI work with `--ui yes`;
otherwise use `--ui no`. Run:

```text
brief --risk <risk> --ui <yes|no>
```

Add `--host-locale <locale>` when the host provides one. The returned JSON is
the complete Align workflow. Follow its `snapshot`, `interview`, `state`,
`approval`, `rendering`, `response`, `lifecycle`, `writingStandard`,
`schemaPath`, and `limits` fields. Do not replace those rules with another
static interview contract in this Skill.

## Run the host workflow

Use the active host session for the repository inspection and adaptive
interview described by the brief. Maintain the private version 1 state required
by `schemaPath`, then validate it with:

```text
validate --input <private-state.json>
```

Render when the brief requires it:

```text
render --input <private-state.json>
```

Add `--output <new-path>` only when the person selected one. Use the validated
result and rendered artifact in the conversation. Follow the brief's approval
boundary before continuing to implementation. Align itself does not implement
the task.
