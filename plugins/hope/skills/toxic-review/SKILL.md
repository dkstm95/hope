---
name: toxic-review
description: Use for a strict, skeptical, risk-focused review of a named work product without attacking people or inventing criticism.
---

# Hope Toxic Review

Use the active host session to bind one work product, assign fresh red
reviewers, arrange blue verification when a finding warrants it, adjudicate the
evidence, and report one proportionate result.

Be demanding about the work and respectful toward people. The active session
coordinates and adjudicates; it must not act as a reviewer or verifier.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Preserve the target scope, evidence, uncertainty, adjudication, and
required result.

## Bind one target

State the named work product, current stage, material risks, evidence in scope,
and unavailable evidence. Do not widen the review into unrelated work. Changed
evidence starts a new review.

## Assign red reviewers

Choose the smallest role set that covers the material risks. Use one focused
role when it is enough and add roles only for distinct questions.

Every role needs a fresh subagent context, including a one-role review. If the
host cannot provide one, stop without reviewing the work.

Give each reviewer only:

- the exact target;
- its role and risks to test;
- direct evidence it may use;
- explicit exclusions;
- the expected output; and
- this Skill directory.

Do not pass the active conversation, earlier reasoning, drafts, implementation
narrative, prior conclusions, or another reviewer's input or output. Parallel
roles or separate sequential contexts are valid; repeated prompts in one
context are not independent.

Tell every red reviewer to read `references/red-review.md` and the shared Hope
Write standard.

When the work product makes or relies on a material causal claim, assign the
causal-completeness method to one role and tell it to also read
`references/causal-review.md`. Do not activate that method merely because the
target is an incident.

## Decide whether findings need blue verification

Seal the red findings first. A candidate requires a fresh blue verifier when
any of these applies:

- it alleges a high-priority material defect or equivalent;
- it would stop a release or require broad, costly, destructive, or
  difficult-to-reverse action;
- its evidence is incomplete or ambiguous; or
- its scope or impact is materially uncertain.

Reviewer confidence and review size do not change this rule. If no candidate
meets it, continue without a blue verifier.

For required verification, give a fresh verifier only the target, scoped
evidence, sealed candidates, exclusions, expected output, and this Skill
directory. Tell it to read `references/verification.md` and the shared Hope
Write standard. Use one verifier for related findings and add another only for
distinct expertise.

If a required fresh verifier is unavailable, stop and identify what could not
be validated.

## Adjudicate the evidence

Before adjudicating, confirm that every required candidate has a blue result.
Use only the named target, scoped evidence, sealed red findings, and blue
results. Do not introduce hidden conversation context or count votes.

Treat blue verification as evidence, not a decision. Judge each candidate by
the target evidence, impact, scope, feasibility, duplication, and blue
challenge. Accept, partly accept, reject, defer, or merge it.

For every candidate, record its disposition and a short evidence-based reason.
Give an actionable candidate its final priority, explain any changed priority
or action, and do not state it more strongly than verification supports. A
deferred finding needs a concrete next step.

Reject a refuted issue or a finding with no supported material impact. When the
issue remains material, narrow any refuted impact, scope, or action.

Keep rejected and duplicate findings out of the actionable list while
accounting for them in a concise adjudication summary.

## Respond once

Use one strict, competent, proportionate voice. Lead with the highest-priority
accepted issue and keep deferred risk visible. Include the adjudication summary
and focus the actionable list on accepted, partly accepted, and deferred
findings.

If no material issue remains, say so and name the checked scope and limits. Do
not attack a person.

Perform one review round for one evidence snapshot. Start another only when
changed evidence or an accepted high-impact finding creates a different
material question.

Do not create a custom model adapter, private role-run state, evaluation record,
or persisted review JSON.
