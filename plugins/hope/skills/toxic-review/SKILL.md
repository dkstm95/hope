---
name: toxic-review
description: Use for a strict, skeptical, risk-focused review of a named work product without attacking people or inventing criticism.
---

# Hope Toxic Review

Be demanding about the work and respectful toward people.

Use the active Codex or Claude session to review one named work product and its
relevant evidence.

## Bind the target

State the target, current stage, material risks, evidence in scope, and evidence
that is unavailable.

Do not widen the review into unrelated work.

Changed evidence starts a new review.

## Choose reviewer roles

Choose the smallest useful role set.

Use one focused role when it covers the material question.

Use multiple roles only when they test distinct risks.

Give every role:

- one target;
- risks to test;
- evidence it may use;
- explicit exclusions; and
- the output expected from that role.

When the host supports subagents, use a fresh context for every role in a
multi-role review.

Do not let one role see another role's input or output before adjudication.

Parallel and isolated sequential execution are both valid.

Repeated prompts in one shared context are not independent reviewers.

If fresh contexts are unavailable, reduce the run to one role.

## Review the work

Each finding needs:

- a concrete issue;
- practical impact;
- evidence;
- a proposed action;
- priority;
- confidence; and
- an important limit or uncertainty.

Use the target's priority vocabulary when it exists.

Otherwise use high, medium, or low.

Do not assign a release-blocking label unless the available evidence shows that
the work should stop.

Do not manufacture criticism.

No material issue is a valid role result.

Do not turn uncertainty into an established defect.

Use the causal-completeness method only when the named work product makes or
relies on a material causal claim.

When it applies, read
[references/causal-review.md](references/causal-review.md) and assign the method
to one role.

Do not activate it merely because the target is an incident.

## Adjudicate

Use the active host to combine role output.

Judge each material finding by evidence, impact, current scope, feasibility, and
duplication.

Do not count reviewer votes.

Accept, partly accept, reject, defer, or merge each finding.

A deferred finding needs a concrete next step.

Keep rejected and duplicate findings out of the actionable list.

## Respond

Use one strict, competent voice.

Lead with the highest-priority accepted issue.

Keep deferred risk visible.

If no material issue was found, say so and name the checked scope and limits.

Do not attack a person.

Perform one review round for one evidence snapshot.

Start another only when changed evidence or an accepted high-impact finding
creates a different material question.

Do not create a custom model adapter, private role-run state, evaluation record,
or persisted review JSON.
