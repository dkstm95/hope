---
name: align
description: Use before implementation when requirements, scope, design, expected behavior, or an important assumption needs shared agreement.
---

# Hope Align

Use the active host session to inspect the task, build a shared understanding
with the person, and preserve the agreed intent when a durable record is needed.

Align does not implement the task.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing the agreement, evidence distinctions,
readiness conditions, or artifact contract.

## Inspect and challenge

Read available repository, document, and conversation evidence before asking a
question. Do not ask the person to repeat a fact that evidence can answer.

Keep repository facts, user decisions, AI proposals, assumptions, material
questions, and research or implementation uncertainty distinct.

Test whether the requested work is likely to achieve the goal. Surface only an
omission, contradiction, risk, unsupported assumption, edge case, or materially
simpler path that could change the intended result or prevent material harm. Do
not invent concerns, treat taste as a defect, or widen the task because another
product could be better.

For each concern, explain the issue, impact, evidence, and uncertainty. Recommend
a sensible default when one exists. Treat a reversible, non-blocking improvement
as an AI proposal rather than a readiness condition. Keep this challenge and
review in the active Align session.

## Build shared intent

Teach back:

- the goal;
- each decided observable outcome, how to recognize it, and whether an agent or
  person can judge it;
- deliberately excluded work;
- a person-visible or domain-visible flow when sequence matters;
- important assumptions; and
- the next material choice.

Match the detail and number of questions to the task's risk.

Label a proposed intent statement, exclusion, or flow as an AI proposal until
the person confirms it. Do not fill a missing requirement with a recommended
design during the teach-back.

Ask only about a goal, preference, work rule, expected behavior, or choice that
could change the result. Explain why the answer matters and offer realistic
options with a recommended default when one is sensible.

Group questions the person can answer independently. Sequence them only when an
answer changes the next question. Once the person accepts, declines, or delegates
a reversible low-impact proposal, close it and do not let it block readiness.
Use an example or edge case only when it tests the shared mental model.

Continue until the person and agent agree on every point that could change the
work. Leave research and implementation checks to the work that can resolve
them.

## Route material UI choices

When a new screen, component, or material visual redesign leaves a choice that
could change the intended experience, read `references/design-directions.md`
and follow it. Do not turn a small UI correction into a design exercise.

## Decide readiness

Alignment is ready only when:

- the goal and decided intent are clear enough to judge;
- deliberately excluded work is visible;
- any important person-visible or domain-visible sequence is understood;
- no material question or open assumption remains; and
- the work can be divided into verifiable pieces.

Model confidence is not approval.

Write each intent item as one observable condition, one way to recognize it,
and one judgment source. Use `agent` only when an agent can observe and report
the outcome. Use `human` when judgment depends on a person's preference,
observation, or approval. Do not let an agent infer a person's judgment.

Align does not start or manage a host goal, implementation loop, retry state,
progress, or completion evidence.

## Decide whether to preserve an artifact

If the person supplies an artifact path, or available evidence identifies one
for the same goal, read `references/artifact.md` and inspect it. Do not search
for a repository-wide latest artifact.

If inspection verifies the same goal, revise the artifact only when the
agreement changed materially; otherwise retain it. If Hope cannot verify its
identity or contents, leave it in place and ask where to create a new artifact.

After readiness, create or revise an artifact when:

- the person asks for one;
- the work will continue in another session or pass to another worker;
- a material decision, assumption, or exclusion must survive this conversation;
  or
- later human observation or approval is part of the decided intent.

Otherwise keep the agreement in the conversation. Do not create an artifact
merely because Align ran, and do not ask the person to choose unless the need
for a durable record is itself material or uncertain.

## Preserve the agreement

When an artifact is required, read `references/artifact.md` and the complete
`scripts/align-input-v3.schema.json`, including its referenced shared
definitions. Follow them for authoring, migration, publication, and revision.

Run the private adapter through the active host:

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

If visual directions were used, also follow **Preserve the selection** in
`references/design-directions.md`.

The artifact records the agreed intent, not solution design, implementation
choices, current implementation state, or completion results.

## Continue or hand off

Report that alignment is ready, the artifact outcome—created, revised, retained,
or skipped—and why. For an existing artifact, report its absolute path and
current revision. If skipped, state that the agreement remains in the active
conversation.

Wait for an explicit response before implementation. When implementation is
approved in the same session, carry the agreement into the work.

Before another session or worker relies on the agreement, ensure it has a
durable artifact, pass its explicit path and revision, and require the receiving
session to inspect it. Treat the artifact as the intent authority, inspect the
current project separately, and choose implementation details through the
ordinary project workflow.
