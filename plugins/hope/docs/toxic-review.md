<!-- Generated from docs/toxic-review.md. Do not edit. -->

# Hope Toxic Review

Hope Toxic Review is a strict, skeptical, risk-focused review of a named work
product.

It is demanding about the work and respectful toward people.

## Product boundary

Review one exact target and the evidence needed to judge it.

The target may be a plan, design, implementation, document, incident analysis,
or another completed work product.

Do not widen the review into unrelated work.

Changed evidence starts a new review.

## Reviewer roles

Choose the smallest useful role set from the target and its material risks.

Use one focused role when it covers the important question.

Use multiple roles only when they test distinct risks.

Give every reviewer role a fresh context, including a one-role review.

A reviewer does not inherit the conversation, previous reasoning, drafts,
implementation narrative, prior conclusions, or another reviewer's output.

It receives only the exact target, role, risks, direct evidence, exclusions,
and expected output.

Do not describe repeated prompts in one shared context as independent review.

If a fresh context is unavailable, stop without performing the review.

## Findings

Each finding needs:

- a concrete issue;
- practical impact;
- evidence;
- a proposed action;
- priority;
- confidence; and
- any important limit or uncertainty.

Use the target's priority vocabulary when one exists.

Otherwise use high, medium, or low, and reserve a release-blocking conclusion
for evidence that the work should stop.

Do not manufacture criticism.

No material issue is a valid result.

Do not turn uncertainty into an established defect.

## Adjudication

The active host combines reviewer output into one result.

It adjudicates only from the named target, scoped evidence, and reviewer
output.

Hidden conversation context is not review evidence.

Judge findings by evidence, impact, current scope, feasibility, and duplication.

Do not count reviewer votes.

Accept, partly accept, reject, defer, or merge each material finding.

A deferred finding needs a concrete next step.

Lead the final response with the highest-priority accepted issue.

Keep deferred risk visible.

## Causal claims

Use the causal-completeness method only when the named work product makes or
relies on a material causal claim.

The detailed method lives in
`plugins/hope/skills/toxic-review/references/causal-review.md`.

Do not run that method merely because the target is an incident.

Do not execute a new experiment inside the review.

State when the available evidence cannot distinguish plausible causes.

## Stopping

Perform one review round for one evidence snapshot.

Start another only when changed evidence or an accepted high-impact finding
creates a different material question.

Stop when another role or round would repeat evidence or only increase the
criticism count.

Toxic Review does not use a custom model adapter, structured role-run state,
evaluation protocol, or persisted review record.
