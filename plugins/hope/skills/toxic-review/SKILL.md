---
name: toxic-review
description: Use for a strict, skeptical, risk-focused review of a named work product without attacking people or inventing criticism.
---

# Hope Toxic Review

Be demanding about the work and respectful toward people.

Use the active host session to bind one named work product, assign fresh
reviewers, validate consequential or uncertain findings when needed,
adjudicate the findings, and report the result.

Do not let the active session act as a reviewer or finding verifier.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing the target scope, evidence, uncertainty,
adjudication, or required result.

## Bind the target

State the target, current stage, material risks, evidence in scope, and evidence
that is unavailable.

Do not widen the review into unrelated work.

Changed evidence starts a new review.

## Choose red reviewer roles

Choose the smallest useful role set: use one focused role when it covers the
material question, and add roles only to test distinct risks.

Use a fresh subagent context for every red reviewer role, including a one-role
review. Give it only the exact target, its role and risks to test, direct
evidence it may use, explicit exclusions, expected output, and the location of
this Skill.

Tell each reviewer to read this Skill before acting.

Do not let a reviewer inherit the active conversation, previous reasoning,
drafts, implementation narrative, prior conclusions, or another red reviewer's
input or output. Run roles in parallel or in separate sequential contexts.

Repeated prompts in one shared context are not independent reviewers.

If a fresh context is unavailable, stop without performing the review.

## Review the work

Each finding needs:

- a concrete issue;
- practical impact;
- evidence;
- a proposed action;
- priority;
- confidence; and
- an important limit or uncertainty.

Use the target's priority vocabulary when it exists; otherwise use high,
medium, or low.

Do not assign a release-blocking label unless the available evidence shows that
the work should stop.

Do not manufacture criticism.

Finding no material issue is a valid result.

Do not turn uncertainty into an established defect.

Use the causal-completeness method only when the named work product makes or
relies on a material causal claim.

When it applies, read
[references/causal-review.md](references/causal-review.md) and assign the method
to one role.

Do not activate it merely because the target is an incident.

## Validate findings when needed

Seal the red reviewers' candidate findings before validation.

Use a blue verifier subagent in a fresh context when a candidate finding:

- would stop a release or require costly or destructive action;
- relies on incomplete or ambiguous evidence; or
- has materially uncertain scope or impact.

Review size alone does not call for a blue verifier. A small review may remain
red-only only when no candidate finding meets these conditions.

Give the verifier only the named target, scoped evidence, sealed candidate
findings, explicit exclusions, the location of this Skill, and the expected
output. Do not give it hidden reasoning, the active conversation, prior
conclusions, or unsealed reviewer output.

Tell the verifier to read this Skill before acting.

The verifier tests the candidate findings. It does not defend the work product
or try to cancel criticism. For each finding, it must:

- try to falsify the claimed issue, impact, scope, and proposed action;
- identify missing context, unsupported assumptions, and overstatement;
- acknowledge evidence that survives the challenge; and
- return uphold, qualify, or refute with direct evidence and any important
  uncertainty.

Use one verifier for related findings. Add another only when a distinct kind of
expertise is needed.

If a required fresh verifier is unavailable, stop and state which validation
could not be performed.

## Adjudicate

Use the active host to combine red reviewer output and any blue verifier output.

Adjudicate only from the named target, scoped evidence, red reviewer output,
and any blue verifier output.

Do not introduce hidden conversation context as evidence.

Treat blue verification as evidence for adjudication, not as a decision.

Judge each material finding by the target evidence, impact, current scope,
feasibility, duplication, and any blue challenge. Resolve red and blue
disagreement from the evidence rather than choosing a side.

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
