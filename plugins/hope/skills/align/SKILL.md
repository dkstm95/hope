---
name: align
description: Resolve intent, scope, consequential design choices, or important assumptions that need shared understanding before implementation. Use when requested or when an unresolved choice would materially change the result.
---

# Hope Align

Discover and test a design with the person to understand its goal and
consequential decisions. Honor existing decisions, delegation, and implementation
authorization. Align owns its open choices even when an implementation skill
runs alongside it. Do not turn clear, authorized work into a new approval process.

Read `../write/references/writing-standard.md` for user-facing language.

## Discover choices through their consequences

Start from the conversation, relevant code, and governing project sources.
Keep evidence, user decisions, AI proposals, assumptions, and uncertainty distinct.

Understand the goal by following relevant situations from the starting need
to the proposed outcome in its real setting. Investigate transitions that
depend on unstated choices or unsupported assumptions. Derive questions from
the task and evidence, without a fixed topic checklist or round count.

Use a decision tree to track discovered choices and their dependencies. A
choice is material when it could change the goal, observable result, future
options, long-lived constraints, or material risk, including architecture and
data modeling with those effects. Leave routine, reversible mechanics to
implementation. Reversibility alone does not make behavior or success criteria
routine.

## Work the complete decision frontier

The frontier contains every unresolved material branch whose prerequisites are
settled. Ask the whole frontier in each round. Number the questions, explain
their consequences, recommend a path, and offer realistic alternatives. Research what the AI can
determine instead of asking the person for facts. Continue independent
authorized work while answers are pending, but keep dependent work behind its
unresolved choices.

After each answer or new evidence, trace its effects in the real situation and
its interactions with other commitments to discover choices beyond the current
tree. Update the problem understanding and tree, then recompute the frontier.
Reopen settled choices when their basis changes. Close each material branch
through a decision, deliberate exclusion, or explicit delegation, applying
agreement only to the choices it covers. Unstated consequences remain open.

For uncertainty that conversation cannot resolve, identify a useful observation
and gather evidence or recommend a small probe. Use actual screens or mockups
when judgment depends on seeing the experience; read `references/design-directions.md`
for visual exploration through Design. Bring the result back into discovery and
agreement; uncertainty alone does not close a branch.

## Test the understanding before confirmation

Agreement and sufficient discovery are separate requirements. Once known
material choices are resolved, return to the original goal. Walk through
concrete situations with the choices applied together to test the outcome and
its supporting evidence. Look for missing decisions, conflicts, or unsupported
assumptions that the tree never exposed, and simpler ways to meet the goal.

Return material issues to discovery and agreement. Finish when all material
branches are resolved and one proportionate walkthrough finds no new material issue.
An empty question list or assent to recommendations does not establish this.
A clear, narrow request may need no additional question round.

Summarize the goal, problem, success criteria, consequential decisions and
effects, and the exclusions, delegation, or assumptions shaping the agreement.
Report verification and its limits, distinguishing reasoned walkthroughs from
observed behavior. Confirm new shared understanding without reconfirming an
unchanged agreement.

After confirmation, use existing implementation authorization without asking
again; otherwise leave implementation for the person's decision. An
alignment-only request ends with the confirmed understanding.

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
