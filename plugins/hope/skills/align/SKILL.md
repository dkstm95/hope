---
name: align
description: Resolve intent, scope, consequential design choices, or important assumptions that need shared understanding before implementation. Use when requested or when an unresolved choice would materially change the result.
---

# Hope Align

Build shared understanding of the goal and consequential decisions. Use the
conversation's existing decisions, delegation, and implementation authorization.
Do not turn clear, authorized work into a new approval process.

Read `../write/references/writing-standard.md` for user-facing language.

## Resolve consequential choices

Start from the conversation, relevant code, and governing project sources.
Research facts and recommend a path. Keep evidence, user decisions, AI
proposals, assumptions, and uncertainty distinct.

Build and maintain a decision tree of choices that could change the goal,
observable result, future options, long-lived constraints, or material risk.
Include architecture and data modeling when they have those effects. For every
possible branch, judge whether it needs the person's understanding and a
decision or explicit delegation before implementation. Leave routine,
reversible mechanics to implementation. Surface omissions, contradictions,
unsupported assumptions, edge cases, and simpler approaches when they could
change a material branch.

## Work the complete decision frontier

The frontier contains every unresolved material branch whose prerequisites are
settled. Ask the whole frontier in each round; do not select only the easiest
or most obvious questions. Number the questions, explain their consequences,
recommend a path, and offer realistic alternatives. Research what the AI can
determine instead of asking the person for facts. Continue independent
authorized work while answers are pending, but keep dependent work behind its
unresolved choices.

After each answer, update the decision tree and recompute the entire frontier,
including newly ready branches. Reopen dependent choices when new evidence or
an earlier decision changes their basis. Close each material branch through a
decision, deliberate exclusion, or explicit delegation; do not silently settle
it through an assumption.

If the person is uncertain, gather useful evidence or recommend a probe. Keep
the branch open until they can decide, deliberately exclude it, or explicitly
delegate it. Read `references/design-directions.md` when a material visual
choice needs comparison images.

## Confirm and continue

Before confirmation, check the whole tree: every material branch must be
resolved, including dependent branches that became ready in later rounds.
An empty question list alone is not completion. When the frontier is empty and
no material branch remains unresolved, summarize the goal and problem model,
how success will be recognized, consequential decisions and their effects,
and every exclusion, delegation, or assumption that shaped the agreement.
Ask for confirmation of new shared understanding; do not ask the person to
reconfirm an unchanged agreement.

Confirmation of understanding and permission to implement are distinct. Use
implementation authorization already given, including a request to align and
then build. If none exists, leave implementation for the person's decision.
An alignment-only request ends with the confirmed understanding.

## Preserve understanding when needed

Read `references/artifact.md` when the person supplies an Align artifact, asks
for a durable record, or another session or worker will rely on the agreement.
Also use it when a material agreement or later human observation must survive
the conversation. Otherwise the conversation is sufficient.

The reference owns artifact authoring, revision, and handoff. Run its commands
through `node "<skill-dir>/scripts/cli.mjs"`, replacing `<skill-dir>` with the
absolute directory containing this file. In Claude Code it is
`${CLAUDE_PLUGIN_ROOT}/skills/align`.

Report where the confirmed understanding remains. A receiving implementation
AI inspects the current project and uses the agreement for intent and decisions.

The decision-tree and complete-frontier interview is informed by Matt Pocock's
[grill-me](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md).
