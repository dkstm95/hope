<!-- Generated from docs/toxic-review.md. Do not edit. -->

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

## Causal completeness

Toxic Review may select one causal-completeness perspective when a named work
product makes or relies on a material claim about why an outcome occurred.

This remains a review of that work product.

It does not turn a raw symptom into a new incident analysis, and an `incident`
target does not activate the perspective by itself.

The selected role:

- binds the claimed outcome and any captured baseline before reviewing a
  proposed cause;
- maps only the end-to-end flow, state owners, I/O, and process boundaries that
  are relevant to that outcome;
- considers only materially distinct causal candidates supported by the
  captured sources;
- treats a candidate as a still-plausible explanation for a material share of
  the outcome at the highest phase or boundary level the evidence supports;
- removes a proposed cause from the live candidate set when a captured upper
  bound or contrary observation disconfirms material contribution;
- keeps a long serial critical-path phase as a phase-level candidate when the
  phase is supported but its internal implementation cause remains unresolved;
- keeps independently bounded, non-overlapping material phases as distinct
  candidates instead of merging them only because one unresolved cross-cutting
  aggregate spans them;
- allows zero or one supported candidate instead of manufacturing an
  alternative;
- records each candidate's evidence, assumptions, and a prediction that could
  disconfirm it;
- with no supported candidate, names the minimum observation needed to form
  one;
- with one candidate, names the lowest-cost safe check that could disconfirm
  it; and
- with two or more candidates, names the lowest-cost safe discriminator.

The selected role sets `method` to `causal-completeness` and includes one
top-level `causalAnalysis` record.

That record contains:

- the claimed outcome and captured baseline, or an explicit statement that the
  baseline is missing;
- the claim assessment, cause level, and candidate count;
- each material observed phase or boundary in the relevant flow;
- one or more candidate links for every mapped flow item, or a concrete reason
  to exclude that item;
- each candidate's level, location, statement, evidence, assumptions,
  disconfirming prediction, and source references; and
- the next safe check and every candidate it must form, disconfirm, or
  distinguish.

An inseparable aggregate is one uncertainty boundary.

The role does not promote the aggregate's named subcomponents to separate
candidates unless a captured observation distinguishes them.

When separately observed material phases partition that aggregate, the role
links the aggregate flow item to those phase candidates.

It does not replace the observed phases with one aggregate candidate.

The role also does not keep a disconfirmed claimed cause as a candidate merely
to document its rejection.

Uncertainty inside a measured serial phase does not erase the phase-level
candidate.

The validator requires the record when the role selects the method.

It checks source and role boundaries, flow dispositions, candidate links,
candidate count, derived cause level, and the next-check shape.

These structural checks do not prove that the host mapped every material phase
or chose a causally correct candidate.

The blinded behavior evaluation checks those semantic decisions.

Other roles keep their own target, evidence, exclusions, and claims instead of
repeating this sequence.

The role does not execute a new check or mix later evidence into the current
snapshot.

If no safe check exists, the role states that limit instead of inventing one.

Finding confidence reflects the evidence for the work product's defect, not
confidence in a root cause.

An unsupported causal claim can therefore be an `established` finding even
when causation remains inconclusive.

The adjudicator defers a finding with a concrete `nextStep` only when new
evidence or follow-up is required before the adjudication can close.

The summary then says that causation is inconclusive, and `scopeLimits` names
the missing evidence.

`noMaterialIssueFound` still means that the checked work product had no material
issue in scope; it never means that Hope disproved a root cause.

When the work product already represents uncertainty honestly and no material
problem remains, an empty finding set is valid.

With no candidate, stop after naming the minimum evidence needed to form one.

With one candidate, stop after recording its disconfirming prediction and the
lowest-cost safe check.

With two or more candidates, stop after each has a distinguishing prediction
and the lowest-cost safe discriminator is known.

When no safe check exists, state that limit and stop.

Exclude branches outside the captured outcome and source set instead of
expanding into an unbounded diagnosis.

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

Contract and two-track tests prove only that hosts receive the same rules and
that deterministic evaluation boundaries reject invalid data.

They do not prove that a host model follows the causal-completeness sequence.

Before releasing a change to that sequence, use the active Skill to run the
checked-in synthetic cases from
`features/toxic-review/causal-evaluation.mjs`.

The shared runtime owns three evaluation suites:

- `conformance` runs the two published decision patterns once with the complete
  brief;
- `ablation` runs one held-out, multi-candidate critical path twice with the
  legacy brief, the causal rules without examples, and the complete brief; and
- `safety` runs a supported bounded claim and an inconclusive claim twice with
  the complete brief.

This produces twelve runs.

The paired ablation separates the effect of the method from the effect of its
decision examples.

The prepared legacy brief explicitly excludes the optional causal role method
and `causalAnalysis` record so the shared additive schema does not contaminate
the legacy control.

The safety suite prevents a strategy that rejects every causal work product
from appearing successful.

List the exact run matrix with:

```text
hope toxic-review evaluation-plan
```

Prepare each listed run with:

```text
hope toxic-review evaluation-prepare \
  --case <id> --variant <legacy|rules-only|full> --run <number>
```

The command returns the exact brief, blinded host input, review target and
source bindings, and normalized input and brief digests.

Give the reviewing host only that prepared brief and `hostInput`.

Keep the case oracle for the later evaluation.

After the host has returned its result, read that case's oracle and rubric with:

```text
hope toxic-review evaluation-oracle --case <id>
```

After the host validates its Toxic Review result, create a receipt template with:

```text
hope toxic-review evaluation-receipt \
  --case <id> --variant <variant> --run <number> \
  --input <review.json> --model <id> --effort <level> \
  --invocation <host-invocation-id>
```

The runtime binds the prepared input, active brief, host invocation identity,
and exact validated output digest.

Rules-only and full results must contain `causalAnalysis`.

Their templates copy the claim assessment, cause level, candidate count, and
no-material-issue decision from that record.

The evaluator cannot replace those recorded values.

Legacy results must not contain the structured record.

For those results, the evaluator supplies the observed assessment.

The evaluator completes every rubric result in both cases.

An oracle may allow a bounded set of cause levels or candidate counts when the
captured evidence supports more than one honest grouping of the same material
phases.

It does not force one arbitrary grouping merely to make scoring exact.

Each passing rubric result cites a JSON Pointer to one decoded authored text
field and an exact excerpt from that field.

Validate one receipt with:

```text
hope toxic-review evaluation-validate --input <receipt.json>
```

Validate the complete release evidence with:

```text
hope toxic-review evaluation-validate-set --input <receipts.json>
```

Validation rechecks the Toxic Review result and binds it to the prepared case,
source digests, active brief variant, host input, host output, and unique
invocation.

It derives run success from both the rubric results and the blinded oracle.

It retains valid failed runs instead of dropping them.

The complete set uses one model and effort, covers every configured run, and
reports run totals separately from correlated rubric totals.

Store bounded receipts under ignored `test-results/` or equivalent release
evidence.

Never copy private user sources into an evaluation case or receipt.

These paired Skill runs are smoke evidence, not a CI model test or statistical
guarantee.

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
