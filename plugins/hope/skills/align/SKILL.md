---
name: align
description: Interview the person before implementation when requirements, scope, expected behavior, design, or an important assumption needs shared agreement.
---

# Hope Align

Inspect the task and interview the person until every material intent decision
is explicit and shared. Align does not implement the task.

Do not start or manage a host goal, implementation loop, retry state, progress,
or completion evidence.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing the agreement, evidence distinctions,
confirmation conditions, or artifact contract.

## Inspect the task

Read available repository, document, and conversation evidence before asking a
question. Facts belong to the evidence; intent decisions belong to the person.
Do not ask the person to repeat a fact that the evidence can answer.

Keep facts, user decisions, AI proposals, assumptions, material questions, and
research or implementation uncertainty distinct.

Test whether the requested work is likely to achieve the goal. Surface only an
omission, contradiction, risk, unsupported assumption, edge case, or materially
simpler path that could change the intended result or prevent material harm. For
each concern, explain the issue, impact, evidence, and uncertainty. Do not invent
concerns, treat taste as a defect, or widen the task because another product
could be better.

If the person supplies an Align artifact path, read `references/artifact.md`
and inspect it as evidence. Do not search for a repository-wide latest artifact.

## Work the intent tree

Map the task as an intent tree. A branch is material when different answers
could change any of these:

- the observable outcome;
- deliberately excluded work;
- a person-visible or domain-visible flow;
- who can judge the result; or
- the risk of material harm.

The frontier is every unresolved material decision whose prerequisites are
settled. Ask the whole frontier in one round. Number the questions, explain why
each answer matters, and offer realistic options with a recommended default
when one is sensible. Do not ask a dependent question in the same round as its
prerequisite.

Wait for the person's answers, update the intent tree, and recompute the
frontier. An answer may add, remove, split, or reopen branches. When a changed
decision invalidates a dependent answer, reopen it explicitly.

Treat a reversible, low-impact improvement as an AI proposal. Close it when the
person accepts, declines, or delegates it; do not let it block alignment.

“I don't know” is a valid answer. Research a missing fact when evidence can
settle it. When a person-facing choice needs reaction evidence rather than more
prose, obtain a probe. For a material visual choice, read
`references/design-directions.md`. Keep the branch open until the person has
seen the evidence and decided or explicitly delegated the choice.

Leave research and implementation checks to the work only when their result
cannot change the agreed intent.

## Confirm shared intent

The frontier is empty only when every material branch is decided, deliberately
excluded, or explicitly delegated. A small, clear task may have an empty
frontier after inspection.

Teach back:

- the goal;
- each observable outcome, how to recognize it, and whether an agent or person
  judges it;
- deliberately excluded work;
- any important person-visible or domain-visible flow; and
- settled assumptions that affect the result.

Ask the person to confirm this shared intent. Model confidence is not approval.
Do not implement the task or create or revise an artifact before confirmation.

## Continue after confirmation

After the person confirms, read `references/artifact.md` when an existing
artifact must be retained or revised, the agreement needs a durable record, or
the task will pass to another session or worker. Otherwise keep the agreement
in the active conversation.

When `references/artifact.md` calls for the private adapter, run it through the
active host.

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

Report that alignment is ready and where the agreement remains. Wait for
explicit implementation approval.

When another session or worker will implement the task, pass the artifact path
and revision required by `references/artifact.md`. The receiver must inspect the
artifact as the intent authority, inspect the current project separately, and
choose implementation details through the ordinary project workflow.
