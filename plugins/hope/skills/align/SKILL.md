---
name: align
description: Use before implementation when requirements, scope, design, expected behavior, or an important assumption needs shared agreement and a durable implementation brief.
---

# Hope Align

Use the active host session to inspect the task, build a shared understanding
with the person, and preserve the agreed intent as one self-contained HTML
artifact.

Align does not implement the task.

## Inspect first

Read available repository, document, and conversation evidence before asking a
question.

Do not ask the person to repeat a fact that the available evidence can answer.

Keep these kinds of information distinct:

- repository facts;
- user decisions;
- AI proposals;
- assumptions;
- open questions; and
- uncertainty that belongs to research or implementation.

Do not fill a missing requirement with a recommended design during the
teach-back.

Label any proposed success condition, scope exclusion, or expected behavior as
an AI proposal and keep it open until the person confirms it.

## Teach back

Start with a short account of:

- the goal;
- success conditions;
- in-scope and out-of-scope work;
- expected behavior;
- important assumptions; and
- the next material choice.

Match the detail to the task risk.

Interview length is not a reason to leave a question or assumption that could
change the result unresolved.

## Ask only material questions

Ask about intent, preference, work rules, expected behavior, or a choice that
would change the result.

Explain why the answer matters.

Offer realistic options and a recommendation when one choice is a sensible
default.

Let the person delegate a reversible low-impact choice.

Ask material questions together when the person can answer them independently.
Ask one at a time only when an answer determines the next question.

Continue the interview until the person's intent and the agent's understanding
agree on every point that could change the work.

Reduce the person's effort with concise questions and updated teach-backs, not
by lowering the readiness standard.

Do not repeat a closed question in different words.

Use an example, edge case, or counterexample only when it tests the shared
mental model.

Leave research and implementation checks open when the conversation cannot
honestly settle them.

## Decide readiness

Complete alignment only when:

- the goal and success conditions are clear enough to judge the result;
- scope boundaries are visible;
- important expected behavior is understood;
- no material question or open assumption remains; and
- the work can be divided into verifiable pieces.

Model confidence is not approval.

## Preserve the agreement

When Align starts and reaches agreement, always create or revise its HTML
artifact. Task size changes the amount of detail, not whether an artifact is
created.

Read `references/artifact.md` and the complete
`scripts/align-input-v1.schema.json` before creating structured input.

Apply the shared Write standard to the artifact language. Put each fact in one
section only. Omit optional behavior, decisions, implementation choices, and
evidence when they add no information. Add a behavior flow only when sequence
or branching is clearer than prose.

Inspect the project's existing documentation conventions. Use its established
location for durable design or specification documents when one is clear.
Otherwise use `docs/alignments/`. Never use a hidden Hope directory for this
project knowledge.

Choose one stable, descriptive HTML path for one intent. Another implementation
attempt, branch, or pull request for the same intent does not create another
artifact.

Write the structured input to a temporary JSON file outside the repository.
Run the adapter with every argument passed separately, then remove the temporary
input.

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

Create a first artifact with:

```text
create --input <draft.json> --output <artifact.html> --root <repository>
```

If an artifact may already own the same intent, inspect it first:

```text
inspect --artifact <artifact.html>
```

A material change to the goal, success, scope, expected behavior, constraint,
or non-goal creates a new revision in the same artifact. A reversible technical
choice does not.

Revise only after `inspect` verifies the Hope-owned artifact and only when it is
still the same intent:

```text
revise --input <draft.json> --artifact <artifact.html> --expect <digest> --root <repository>
```

Do not replace an unknown, manually changed, or identity-mismatched artifact.
Leave it in place and ask the person where to create a new artifact.

Recommend keeping the artifact with the project. Never run `git add`, commit,
push, publish, or open it automatically.

## Continue into implementation

Report the absolute artifact path and the current revision.

Wait for an explicit user response before implementation. When implementation
is approved in the same session, run `inspect` again and use its current content
as the implementation contract before editing files.

In a later session, one explicit artifact path is enough. Inspect it and use
the current revision; do not guess a global or repository-wide “latest” Align
artifact.

The artifact does not track implementation progress and Align does not link it
to a Diff artifact.
