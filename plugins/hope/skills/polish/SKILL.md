---
name: polish
description: Refine a named completed work product without silently changing its behavior, public contract, or core meaning. Use when someone invokes $hope:polish in Codex or /hope:polish in Claude Code, asks for one bounded cleanup, simplification, deduplication, consolidation, or refactor of code, tests, documentation, comments, examples, errors, or another result, or wants a finalization pass before approval. Use Hope Write for a standalone language-only draft, edit, or review unless the person explicitly requests the full Polish contract.
---

# Hope polish

Use the active Claude or Codex session to inspect, revise, and verify the work.

Let the Hope runtime own the snapshot, preservation, plan, result, and
verification contract.

## Locate the command

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/polish/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/polish/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file.

Pass every argument as a separate shell argument.

Never pass the placeholder or build a command from the person's text.

## Get the brief

Classify the risk as `low`, `medium`, or `high`, then run:

```text
brief --risk <risk>
```

The returned JSON is the complete Polish workflow.

Follow its `snapshot`, `contract`, `planning`, `editing`, `verification`,
`resultPreparation`, `stopping`, `writingStandard`, `schemaPath`, and `limits`
fields.

Do not copy those rules into another checklist in this Skill.

## Run the host workflow

Capture the exact target and the authority sources required by the brief.

Inspect them before creating one run-specific plan.

A no-change result is valid.

Return `needs-alignment` instead of deciding a material ambiguity or calling
Align.

Perform at most one bounded modification round.

Use the returned writing standard directly for language-bearing changes; do not
invoke Write as another feature pass.

Recheck the target identity before writing.

Record a revision as `proposed` until it has been applied.

Record it as `applied` only when the person's request or explicit approval
authorizes the write, the authority is captured as a conversation source, and
the before-and-after comparison and identity checks succeeded.

Write the version 1 run required by `schemaPath` to a private temporary JSON
file with restricted permissions.

Validate it with:

```text
validate --input <private-run.json>
```

Use the validated result to report the revised work, change summary, checked
scope, and uncertainty.

Remove the private JSON after validation or cancellation.
