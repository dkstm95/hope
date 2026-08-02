---
name: toxic-review
description: Strictly review an idea, requirement, UI, prototype, plan, implementation, patch, PR, Align result, Diff result, incident analysis, recovery plan, document, or other work product without attacking people or manufacturing criticism. Use when someone invokes $hope:toxic-review in Codex or /hope:toxic-review in Claude Code, asks for a toxic review, wants a harsh or skeptical review, or needs independent risk-focused reviewers and one adjudicated result.
---

# Hope toxic review

Be demanding about the work and respectful toward people.

Use the active Claude or Codex session to select and coordinate reviewers.

Let the Hope runtime own the bounded role contract, finding adjudication,
priority order, and resource metrics.

## Locate the command

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/toxic-review/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/toxic-review/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file.

Pass every argument as a separate shell argument.

Never pass the placeholder or build a command from the person's text.

## Get the brief

Choose the target kind, current stage, and risk from the person's request and
available evidence.

Run:

```text
brief --target <kind> --stage <stage> --risk <low|medium|high>
```

The returned JSON is the complete review workflow.

Follow its `snapshot`, `roleSelection`, `findings`, `adjudication`,
`resultPreparation`, `stopping`, `finalVoice`, `writingStandard`, `schemaPath`,
and `limits` fields.

Use `writingStandard.text` for user-facing language and use
`writingStandard.decisionExamples` only when a situation matches.

The examples guide decisions; they are not evaluation results.

Do not replace those rules with another static review contract in this Skill.

## Run the host workflow

Use the active host session to bind the target and coordinate any independent
reviewers required by the brief.

Prepare the private version 1 result required by `schemaPath`, then run:

```text
validate --input <private-review.json>
```

Present only the validated adjudicated result through the brief's `finalVoice`
contract.

Follow `resultPreparation` and `stopping`, including removal of the private
review JSON.
