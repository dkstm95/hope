# Hope toxic review

Hope toxic review is a strict review of a work product at any stage.

It should feel like a demanding, competent manager: hard on the work, precise
about the evidence, and respectful toward people.

The name is intentionally strong because uncritical agreement is a product risk.

It never licenses insults, ridicule, hostility, or judgments about a person.

## Product boundary

Toxic Review can inspect an idea, requirement, prototype, plan, implementation,
patch, pull request, Align state, Diff result, incident analysis, recovery plan,
document, or another named artifact.

The review binds itself to captured sources.

A Git source needs a full object ID or content digest.

Every other source needs a content digest.

Mutable labels such as `main`, `latest`, and `current` are not evidence
identities.

It is independent of Align and Diff.

Their artifacts are valid inputs, not required inputs.

The feature finds material problems, simpler alternatives, and unsupported
claims.

It does not manufacture criticism to fill a quota. “No material issue found in
the checked scope” is valid and is not a claim that the work is safe outside
that scope.

## Adaptive review roles

The main reviewer selects only roles that match the target, stage, available
evidence, and risk.

There is no permanent panel.

One role is enough when one focused pass covers the material risk.

Each selected role records:

- the review target;
- risks to focus on;
- evidence it may use;
- areas it must not review;
- claims to confirm or disprove; and
- the expected output.

Roles inspect independently when the host supports subagents.

Give each role the smallest source bundle that can answer its questions.

Do not copy the whole repository or conversation to every role.

Parallel execution is useful for independent latency, but it does not count as a
token saving.

Useful perspectives can include:

- problem selection;
- simpler or reversible alternatives;
- requirements;
- experience and accessibility;
- architecture;
- program design;
- security and privacy;
- operations and recovery;
- cost and performance; or
- verification strength.

These are choices, not fixed roles.

## Findings and adjudication

A role finding states the issue, practical impact, proposed action, confidence,
and supporting source references.

Priority reflects the effect of ignoring the problem.

Confidence reflects evidence strength.

Do not turn uncertainty into a known defect.

The main reviewer adjudicates every finding as:

- `accepted`;
- `partially-accepted`;
- `rejected`;
- `deferred`; or
- `duplicate`.

The decision records the evidence, actual impact, current scope, feasibility,
and reason for any duplication.

For accepted and partially accepted findings, the adjudicator owns the final
action, impact, priority, confidence, and evidence references.

The role's original proposal remains in the audit record.

A duplicate points to the finding that owns the issue.

Rejected findings stay in the audit record but do not appear as recommended
work.

The runtime validates one adjudication per finding, derives counts and the ratio
of actionable findings to all findings, and sorts final actionable work by the
adjudicator's priority.

A deferred finding needs a next step and remains visible as unresolved work.

It cannot produce a `noMaterialIssueFound` result.

The final response uses this adjudicated result.

It does not paste several reviewer voices together.

## Final voice

Lead with the most consequential accepted issue or say that none was found in
the checked scope.

Explain what to change, why it matters, and what closes the issue.

Keep important uncertainty and deferred decisions visible.

Do not praise the work merely to soften the review.

Do not use demeaning, sarcastic, or personal language.

The useful-criticism rate matters more than the number of findings.

## Cost and stopping

Version 1 supports one review round per run with one to six roles, at most 96
findings, 128 source references, and 128 KiB of structured input.

Structured input may contain at most 128 nesting levels and 65,536 values.

These are safety ceilings, not targets.

Start a new run with a new snapshot and result only when an accepted high-impact
finding, a changed source, or new evidence creates a different material
question.

Stop when another run would repeat the same evidence or only increase the
criticism count.

The result records deterministic byte, role, finding, adjudication, and
actionable-finding metrics.

Elapsed time or token measurements are not accepted inside reviewer-authored
JSON.

A trusted host may supply them separately when it observed them.

## Two entry paths

The Claude and Codex Skills use the active host session to choose roles,
coordinate independent reviews, and adjudicate their findings.

It asks the generated runtime for the complete host workflow and validates the
combined result before presenting one final voice.

Normative snapshot, role, finding, adjudication, stopping, and final-voice rules
live in that runtime brief rather than in the Skill.

The independent harness exposes the same feature as `hope toxic-review`.

Its internal `brief` and `validate` commands reach the shared core.

Automatic multi-agent review reports that the harness model adapter is
unavailable until one exists.
