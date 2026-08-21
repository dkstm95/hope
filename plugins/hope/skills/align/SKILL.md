---
name: align
description: Use before implementation when requirements, scope, design, expected behavior, or an important assumption needs shared agreement.
---

# Hope Align

Use the active host session to inspect the task, build a shared understanding
with the person, and preserve the agreed goal in a durable implementation brief
when one is needed.

Align does not implement the task.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing the agreement, evidence distinctions,
readiness conditions, or artifact contract.

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

Label any proposed check, scope exclusion, or expected behavior as
an AI proposal and keep it open until the person confirms it.

## Challenge the brief

After inspection and before teach-back, test whether the requested work is
likely to achieve the goal. Surface only a material omission, contradiction,
risk, unsupported assumption, edge case, or materially simpler path that could
change the work or prevent material harm. Do not invent concerns, treat taste
as a defect, or widen the task because another product could be better.

Classify each concern as one of:

- a material question whose answer could change the goal, checks, scope, or
  expected behavior;
- a non-blocking optional improvement; or
- research or implementation uncertainty.

For each concern, explain the issue, impact, evidence, and uncertainty, then
recommend the sensible default when one exists. If none qualifies, continue.

## Teach back

Start with a short account of:

- the goal;
- the conditions that must pass, how to verify them, and who decides whether
  they pass: an agent or person;
- in-scope and out-of-scope work;
- expected behavior;
- important assumptions; and
- the next material choice.

Match the detail to the task risk.

Interview length is not a reason to leave a question or assumption that could
change the result unresolved.

## Ask only material questions

Ask about the goal, preference, work rules, expected behavior, or a choice that
would change the result.

Explain why the answer matters.

Offer realistic options and a recommendation when one choice is a sensible
default.

An optional improvement remains an AI proposal until the person accepts it,
declines it, or delegates the choice when it is reversible and low-impact.
Each outcome closes the proposal: do not reopen or keep advocating it, and
never let it block readiness.

Ask related questions together when the person can answer them independently;
do not impose an arbitrary limit. Sequence them only when an answer determines
the content or need for the next question.

Continue the interview until the person's goal and the agent's understanding
agree on every point that could change the work.

Reduce the person's effort with concise questions and updated teach-backs, not
by lowering the readiness standard.

Do not repeat a closed question in different words.

Use an example, edge case, or counterexample only when it tests the shared
mental model.

Leave research and implementation checks open when the conversation cannot
honestly settle them.

## Keep review inside Align

Keep Align's challenge and interview in the active session. Do not start or
recommend a separate review, reviewer, or review feature.

## Show material UI choices

When the task may require a new screen, component, or material visual redesign,
read `references/design-directions.md` after inspecting the available project
and conversation evidence.

Use that guidance only when a visual choice could change the implemented
result. Do not turn a small UI correction into a design exercise.

## Decide readiness

Complete alignment only when:

- the goal and checks are clear enough to judge the result;
- scope boundaries are visible;
- important expected behavior is understood;
- no material question or open assumption remains; and
- the work can be divided into verifiable pieces.

Model confidence is not approval.

Write each check as one condition, one verification method, and one decision
source. Use `agent` only when an implementation agent can perform the check and
report the result needed for judgment. Use `human` when completion depends on a
person's preference, observation, or approval. Do not let an agent infer that a
human check passed.

Align owns this agreed goal contract. It does not start or manage a host's goal
feature, implementation loop, retry state, progress, or completion evidence.

## Decide whether the agreement needs an artifact

When the person supplies an artifact path or available evidence identifies one
that may own the same goal, inspect it before deciding the artifact outcome:

```text
inspect --artifact <artifact.html>
```

Do not search for a repository-wide latest artifact. If inspection verifies
the same goal and the agreement changed materially, revise it. If the agreement
did not change materially, retain the artifact. If inspection cannot verify the
artifact, or shows that it is unknown, manually changed, or identity-mismatched,
leave it in place and ask the person where to create a new artifact.

After alignment reaches readiness, create or revise an HTML artifact when:

- the person asks for one;
- implementation is expected to continue in another session or pass to another
  worker;
- a material decision, assumption, or scope boundary must survive the active
  conversation; or
- a completion check depends on a person's later observation or approval.

When none applies, keep the agreement in the conversation and do not create an
artifact. This commonly covers a small, clear task that will continue in the
active session. Do not create an artifact merely because Align ran.

Decide from the available evidence. Do not ask the person to choose unless the
need for a durable record is itself material or uncertain.

When an artifact is required, preserve the agreement as follows.

Read `references/artifact.md` and the complete
`scripts/align-input-v2.schema.json` before creating structured input.

If visual directions were used, re-read `references/design-directions.md` at
this point and follow its **Preserve the selection** section before writing the
input.

Put each fact in one section only. Omit optional behavior, decisions,
implementation choices, and evidence when they add no information. Add a
behavior flow only when sequence or branching is clearer than prose.

Keep each prose value to one semantic paragraph. Put a distinct idea in the
existing field or list item that owns it. When one field genuinely needs a
second paragraph, separate the paragraphs with a newline so the renderer keeps
the boundary. Keep the title to one decisive result, the goal to one direct
statement, and each decision reason to the main practical cause or effect.

Inspect the project's existing documentation conventions. Use its established
location for durable design or specification documents when one is clear.
Otherwise use `docs/alignments/`. Never use a hidden Hope directory for this
project knowledge.

Choose one stable, descriptive HTML path for one goal. Another implementation
attempt, branch, or pull request for the same goal does not create another
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

A material change to the goal, checks, scope, expected behavior, constraint,
or non-goal creates a new revision in the same artifact. A reversible technical
choice does not.

Revise only after `inspect` verifies the Hope-owned artifact and only when it is
still the same goal:

```text
revise --input <draft.json> --artifact <artifact.html> --expect <digest> --root <repository>
```

When visual directions were used, run `inspect` on the created or revised
artifact before reporting alignment complete.

Treat the artifact as project documentation for the related work. Keep it in
the project by default, including after implementation. Do not delete a
completed artifact merely because the related work finished; remove it only
when the person decides to do so.

## Continue into implementation

Report that alignment is ready. Report the artifact outcome—created, revised,
retained, or skipped—and why. For a created, revised, or retained artifact,
report its absolute path and current revision. If it was skipped, state that
the agreement remains in the active conversation.

Wait for an explicit user response before implementation. When implementation
is approved in the same session, use the current agreement as the
implementation contract. If an artifact exists, run `inspect` again before
editing files and use its current content as that contract.

Before work moves to another session or worker, create or revise the artifact
if the agreement exists only in the conversation. Report its absolute path and
revision, and pass that explicit path with the work. The receiving session or
worker must inspect it before editing files.

In a later session, one explicit artifact path is enough. Inspect it and use
the current revision; do not guess a global or repository-wide “latest” Align
artifact.

The artifact does not track implementation progress and Align does not link it
to a Diff artifact.
