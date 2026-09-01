---
name: align
description: Explore a task before implementation when intent, expected behavior, architecture, data modeling, scope, or an important assumption needs shared understanding.
---

# Hope Align

Use the strongest available reasoning to inspect the task and lead the
conversation until the person and AI share the intent and consequential
decisions. Align owns inquiry, decisions, and confirmation. Implementation
starts with the person's explicit authorization.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Preserve the agreement, evidence distinctions, confirmation
conditions, and artifact contract.

## Build understanding from evidence

Start with the conversation, relevant code, and the project's governing
sources. Find architecture authorities, decision records, schemas, data
policies, design systems, and local conventions when they exist. Follow their
actual authority and surface conflicts that affect the task.

Facts, research, system analysis, and recommendations belong to the AI. Intent
and choices with consequences worth human understanding belong to the person,
who may decide or explicitly delegate them. Keep facts, user decisions, AI
proposals, assumptions, material questions, and uncertainty distinct.

Build a decision tree from choices that could materially change the goal,
observable result, future decision space, or risk of harm. Include data
modeling and architecture when they shape those consequences or create a
long-lived constraint. Give reversible code mechanics to the implementation
AI.

For every possible branch, ask:

> Is this choice worth the person's understanding and a decision or explicit
> delegation before implementation?

Use model judgment to answer that routing question. Surface an omission,
contradiction, risk, unsupported assumption, edge case, or simpler structure when
it could change a material branch. Explain the issue, impact, evidence, and
uncertainty, then recommend the best path.

When the person supplies an Align artifact path, read `references/artifact.md`
and inspect that exact artifact as evidence.

## Work the decision frontier

The frontier contains every unresolved material branch whose prerequisites are
settled. Ask the whole frontier in one round. Number each question, explain its
consequence, and give a recommendation with realistic alternatives. Questions
carry decisions; the AI supplies the surrounding facts and reasoning.

After each answer, update the decision tree and recompute the frontier. Reopen a
dependent choice when new evidence or an earlier decision changes it. Close a
branch through a decision, deliberate exclusion, or explicit delegation.

Uncertainty is a valid answer. It invites the AI to research, obtain a useful
probe, or recommend a path. For a material visual choice, read
`references/design-directions.md`. Keep the branch active until the person has
enough evidence to decide or delegate it.

## Confirm shared understanding

When the frontier is empty, teach back the shared goal and problem model, the
intended outcomes and recognition methods, the consequential decisions and
their effects, and every exclusion, delegation, or assumption that shaped them.
Ask the person to confirm this understanding. Their confirmation completes
Align. Ask whether implementation may begin as a separate choice; explicit
authorization starts implementation, and the person may leave it for later.

## Preserve confirmed understanding

After confirmation, read `references/artifact.md` when an existing artifact
continues, the understanding needs a durable record, or another session or
worker will rely on it. The active conversation is sufficient for the rest.

Run the private adapter through the active host when the artifact reference
calls for it.

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/skills/align/scripts/cli.mjs"
```

Codex:

```text
node <skill-dir>/scripts/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory containing this
file.

Report where the confirmed understanding remains. For a handoff, pass the
artifact path and revision from `references/artifact.md`; the receiving AI uses
it as the authority for confirmed intent and decisions, inspects the current
project, and owns the remaining implementation reasoning.

Align's decision-tree and frontier interview is informed by Matt Pocock's
[grill-me](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md)
skill.
