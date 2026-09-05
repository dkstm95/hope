---
name: toxic-review
description: Give a named work product a strict, independent review of material risks without attacking people or inventing criticism.
---

# Hope Toxic Review

Coordinate independent red reviewers, verify consequential findings with blue
reviewers, and adjudicate one evidence snapshot. The active session coordinates
and judges; it does not serve as a reviewer or verifier.

Read `../write/references/writing-standard.md` for user-facing language.

## Bind the review and assign red roles

State the target, stage, material risks, evidence, exclusions, and unavailable
evidence. Use the smallest role set covering distinct risks; one role is valid.

Give each role a fresh subagent with no inherited conversation. Supply only the
exact target, assigned risks, direct evidence, exclusions, expected output, and
absolute Skill path. Exclude earlier reasoning, drafts, implementation
narrative, prior conclusions, and other reviewers' work. Separate parallel or
sequential contexts are independent; repeated prompts in one context are not.

Tell red reviewers to read `references/red-review.md` and the shared Write
standard. Assign `references/causal-review.md` to one role only when the target
makes or relies on a material causal claim.

If a fresh reviewer is unavailable, explain the missing capability and stop the
independent review without claiming it was performed.

## Verify consequential findings

Seal red findings before verification. A candidate requires a fresh blue
verifier if it alleges a high-priority defect, could block release, proposes
broad, costly, destructive, or difficult-to-reverse action, or has materially
incomplete, ambiguous, or uncertain evidence, scope, or impact. Confidence and
review size do not waive this requirement.

Give blue only the target, scoped evidence, sealed candidates, exclusions,
expected output, and Skill path. Tell it to read `references/verification.md`
and the Write standard. One verifier may cover related findings; add roles
only for distinct expertise. If required verification is unavailable, identify
the unresolved candidates and stop before presenting them as adjudicated.

## Adjudicate and report

Use only the target, scoped evidence, red findings, and required blue results.
Judge evidence and proportionality rather than votes. For every candidate,
record accept, partly accept, reject, defer, or merge with an evidence-based
reason. Give actionable candidates a final priority, explain changed priorities
or actions, and give deferred findings a concrete next step.

Reject refuted issues and findings without supported material impact. Narrow
unsupported impact, scope, or action; report nothing more strongly than the
evidence supports. Keep rejected and duplicate candidates in a concise
adjudication summary, outside the actionable list.

Lead with the highest-priority accepted issue and keep deferred risk visible.
If no material issue remains, say so with the reviewed scope and limits. Be
strict about the work and respectful toward people.

Finish after one round. Repeat only for changed evidence or an accepted
high-impact finding that raises a different material question. Do not create
custom model adapters, private role state, evaluation records, or review JSON.
