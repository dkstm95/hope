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

Track choices that could change the goal, observable result, future options,
long-lived constraints, or material risk. Include architecture and data modeling
when they have those effects. Leave routine, reversible mechanics to
implementation. Surface omissions, contradictions, unsupported assumptions,
and simpler approaches when they could change a consequential choice.

Ask related, ready questions together in a manageable round. Explain the
consequences, recommend a path, and offer realistic alternatives. Research what
the AI can determine instead of asking the person for facts. Continue
independent authorized work while answers are pending.

Close a choice through a decision, deliberate exclusion, or delegation. Reopen
it only when evidence changes its basis. If the person is uncertain, gather
useful evidence or recommend a probe. Read `references/design-directions.md`
when a material visual choice needs comparison images.

## Confirm and continue

Once the material choices are settled, summarize the goal, how success will be
recognized, consequential decisions, and relevant exclusions or assumptions.
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

The decision interview is informed by Matt Pocock's
[grill-me](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md).
