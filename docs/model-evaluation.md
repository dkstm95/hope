# Hope model behavior evaluation

Hope evaluates model-dependent behavior before changing the instructions, tools,
or orchestration that support it.

Deterministic tests prove code and contract behavior, while model evaluations
measure what one declared host and model did on bounded cases.

Neither kind of evidence replaces the other.

## When evaluation is required

Run the relevant model evaluation when:

- Hope starts supporting a materially different model or host behavior;
- a Skill, runtime brief, tool description, decision example, or model-facing
  schema changes;
- orchestration changes what the model sees or the order in which it acts; or
- a repeated real failure suggests that a new instruction may be needed.

A formatting-only change does not require model evaluation when it cannot
change model input or behavior.

## Preserve product invariants

Do not treat every instruction as an ablation candidate.

Keep these rules unless Hope intentionally changes its product contract:

- user authority and confirmation boundaries;
- exact target, source, and output identity;
- ownership, cleanup, and destructive-action safety;
- evidence and uncertainty boundaries;
- privacy and untrusted-input handling; and
- resource limits and honest failure behavior.

A strong model result does not make these product guarantees unnecessary.

## Classify the remaining instructions

Group the remaining model-facing material before an ablation:

- **Protocol** tells the host which state transition or tool call comes next.
- **Semantic guidance** helps the model make a product decision.
- **Decision examples** demonstrate how a rule applies to a representative case.
- **Observed workaround** addresses a repeated failure seen in a named case or
  real run.

Prefer moving deterministic protocol work into the runtime when that preserves
the same visible state, recovery, and control.

Remove semantic guidance, examples, or workarounds only after a bounded
comparison shows that the smaller input preserves the required behavior.

## Evaluation evidence

One model-behavior evaluation uses checked-in synthetic or sanitized cases and
keeps each case oracle hidden until the model returns its result.

Give each run a fresh context containing only its prepared brief, blinded input,
and output contract.

Bind every receipt to:

- the case, suite, variant, and run;
- the host, model identity, and effort reported for that run;
- the active contract and exact brief digest;
- the host invocation identity; and
- the exact prepared input and model output digests.

Record the exact model identity when the host exposes it.

When the host does not expose one, record that limitation explicitly instead of
guessing a model name.

Keep failed runs and retries in the runner's attempt ledger.

Hope distinguishes two evidence classes:

- `synthetic` receipts come from the deterministic factories and CLI receipt
  commands; and
- `host-attested` receipts carry a trusted runner campaign, host event identity,
  statement digest, issuer, time, and proof accepted by a verifier outside the
  receipt.

Individual host-attested receipts are not enough for a release decision.

Complete-set validation also requires every receipt to use one runner campaign
and issuer, then asks a trusted ledger verifier to confirm that every planned
run is present and that the caller did not omit, replace, or hide an attempt or
retry from that campaign.

The verifier must consult host-owned state instead of trusting the submitted
JSON.

Without both trusted verifiers, validation fails closed.

Tests may opt in to synthetic complete-set validation with
`allowSynthetic: true`, but that result is test-only and cannot authorize a
production prompt or Skill change.

The public CLI has no flag that turns synthetic receipts into release
evidence.

Store bounded receipts under ignored `test-results/` or an equivalent private
location.

Never put private user content into a checked-in evaluation case or receipt.

## Compare variants

Start with one complete contract as the baseline.

Compare rule groups instead of deleting an arbitrary percentage of lines.

A useful first comparison is:

1. the minimum product invariants and output contract;
2. the complete rules without decision examples; and
3. the complete current contract.

Use the same host, model, effort, cases, and run count across variants.

Treat latency, tool calls, retries, and tokens as trusted measurements only when
the host actually observed and supplied them.

Do not change a production Skill or runtime from a partial receipt set.

## Interpret and refresh results

A complete passing set is smoke evidence for its recorded configuration, not a
statistical guarantee or proof about another host.

Do not interpret worker count, run duration, or a deterministic validator pass
as model quality.

Do not declare an evaluation saturated from one model run.

Review the cases when repeated supported-model runs stop separating variants or
a real failure falls outside the checked behavior.

Replace or strengthen an easy case instead of adding easier cases only to keep a
high pass rate.

Keep earlier bounded receipts so a later decision can distinguish an improved
model from a changed test.

## First implementation

Hope Diff invocation classification is the first feature to apply this policy.

Its shared runtime prepares blinded multilingual decisions, three instruction
variants, exact receipts, and complete-set validation.

The historical follow-up reported all 28 version 3 `rules-only` runs passing.

A separate production verification prepares the exact active version 4 brief
without examples or evaluation-only control text. Its eight fresh runs must all
pass before Hope treats the active brief as release evidence.

The historical production set reported all eight checked decisions passing.

Those Diff receipts predate the shared host-attestation and complete-attempt
gate.

They do not independently establish their Codex identity, fresh-context
execution, or release eligibility under the current policy.

The active version 4 brief remains a historical product state, not new evidence
that authorizes another removal.

The Claude and Codex Skill coordinates fresh host runs, while the independent
harness exposes the same deterministic preparation and validation commands.

The runtime does not claim that repository tests executed a host model.

## Cross-feature selection

Hope owns one versioned feature-selection contract for deciding whether a
request belongs to Align, Diff, Polish, Settings, Sweep, Toxic Review, Write,
or no Hope feature.

This contract does not execute the selected feature.

It tests the semantic boundary represented by the installed Skill descriptions.

The host's internal plugin dispatcher remains outside Hope's deterministic
control, so a passing set is not proof that the dispatcher made the same choice.

The version 1 evaluation used seven synthetic Korean and English requests.

It compared the complete published descriptions with shorter descriptions that
preserved each feature's core job.

Every decision ran once under both variants.

All decisions except the fixed Settings preference change ran a second time
under both variants, producing 26 runs in total.

The version 2 evaluation added Sweep and replaced repeated inputs with six
harder boundary, conformance, and safety cases.

It uses 13 distinct synthetic requests under both variants, producing 26 runs.

Each fresh context receives one request and one variant.

List the matrix with:

```text
hope model-evaluation feature-selection-plan
```

Prepare one blinded run with:

```text
hope model-evaluation feature-selection-prepare \
  --case <id> --variant <minimal|full> --run <number>
```

Give a fresh host only the returned `brief`, `hostInput`, and
`outputContract`.

Do not read the case oracle or give the host another variant before it returns
one JSON object with `decision` and `reason`.

Create and validate bounded receipts with the matching
`feature-selection-receipt`, `feature-selection-validate`, and
`feature-selection-validate-set` commands.

Version 3 keeps the 26-run matrix and adds the shared evidence boundary.

A release-eligible complete set requires every planned run, one declared host,
model, and effort, a unique invocation identity for every run, valid host
attestations, and a trusted complete-attempt ledger.

It returns `candidate-minimal` only when all 26 decisions pass.

Earlier version 1 and version 2 runs reported 26 of 26 passing decisions, but
their caller-authored receipts cannot satisfy the version 3 evidence gate.

Those runs are useful historical smoke data, not release authorization.

They also injected Hope's descriptions and rules into isolated contexts rather
than exercising the installed Codex dispatcher.

Hope therefore retains the full published Skill descriptions.

Shortening them requires new trusted evidence from the actual supported
dispatcher being changed.

Adding a public feature or changing a Skill description requires a new contract
version and matching cases.

The global evaluation has no public Skill because it tests Skill selection
before one feature adapter is active.

The independent harness and generated plugin runtime expose the same
deterministic preparation and validation boundary.

## Polish preservation

Hope owns one versioned evaluation for deciding whether a proposed Polish
change preserves the named target's contract.

The version 1 evaluation uses 12 distinct synthetic code, test, documentation,
interface-text, incident, and research cases.

It covers observable behavior, public contracts, core meaning, facts,
uncertainty, citations, voice, supported removal, dynamic reachability,
generated sources, verification limits, and material product choices.

Each case runs once with `invariants-only` and once with `full`, producing 24
runs.

Both variants keep the active Polish product invariants.

The full variant also includes the current scope, planning, editing, stopping,
and verification guidance relevant to preservation judgment.

The model chooses one supported candidate, keeps the current target, or returns
`needs-alignment` for a material product, requirement, or behavior choice.

List and prepare the matrix with:

```text
hope model-evaluation polish-preservation-plan
hope model-evaluation polish-preservation-prepare \
  --case <id> --variant <invariants-only|full> --run 1
```

Give a fresh host only the returned `brief`, `hostInput`, and
`outputContract`.

Do not read the case oracle or give the host another case or variant before it
returns one JSON object with `decision`, `candidateId`, and `reason`.

Use the matching `polish-preservation-receipt`,
`polish-preservation-validate`, and `polish-preservation-validate-set` commands
to bind and validate the evidence.

Version 2 adds the shared evidence boundary.

A release-eligible complete set requires every planned run, one declared host,
model, and effort, a unique invocation identity for every run, valid host
attestations, and a trusted complete-attempt ledger.

It returns `candidate-invariants-only` only when all 24 judgments pass.

The historical version 1 run reported 23 of 24 passing judgments and returned
`keep-full`.

The full variant reportedly passed all 12 cases. The invariants-only variant
reportedly passed 11 of 12 and kept the current target in
`polish-preservation-02` because it did not find enough evidence that the safe
private-helper extraction preserved every accepted option and return value.

That score remains reproducible as a deterministic receipt calculation, but
the version 1 receipt cannot independently prove its fresh-context or host
configuration claims.

That result keeps the full Polish preservation guidance. It does not justify
removing the additional scope, planning, editing, stopping, or verification
rules.

That decision applies only to the bounded preservation judgment tested here.

It does not prove that a free-form edit preserved semantics or permit removal
of identity, authority, planning, application, receipt, or verification
protocol.

The independent harness and generated plugin runtime expose the same
deterministic preparation and validation boundary.

## Write decision examples

Write carries four representative decision examples alongside its semantic
writing standard.

Hope treats those examples as removable guidance, not as permanent product
invariants.

The version 2 ablation compares the exact current `edit` brief with a
`rules-only` brief that removes only `decisionExamples`.

It checks six synthetic artifacts and edit requests: the four represented
decisions and two safety boundaries where aggressive splitting or
consolidation would be wrong.

Each input supplies the current artifact, the requested edit, and factual
constraints without stating whether an action is correct or describing its
expected harm.

Review case neutrality independently before starting a release campaign.

The plan requires two fresh contexts per decision and variant, producing 24
runs.

List and prepare the matrix with:

```text
hope model-evaluation write-example-plan
hope model-evaluation write-example-prepare \
  --case <id> --variant <rules-only|full> --run <number>
```

Give a fresh host only the returned `brief`, `hostInput`, and
`outputContract`.

Use the matching `write-example-receipt`, `write-example-validate`, and
`write-example-validate-set` commands to bind and validate the evidence.

The release-eligible complete set returns `remove-examples` only when all 24
runs pass with one declared host, model, and effort, 24 unique invocation
identities, valid host attestations, and a trusted complete-attempt ledger.

The historical version 1 run reported all 24 decisions passing, but its
caller-authored receipts do not satisfy the version 2 evidence gate.

Its production verification also reused the ablation cases.

Hope therefore restored and retains the four active decision examples and the
Skill instructions that consume them.

List and prepare those six exact-production runs with:

```text
hope model-evaluation write-production-plan
hope model-evaluation write-production-prepare --case <id> --run 1
```

Use the matching `write-production-receipt`, `write-production-validate`, and
`write-production-validate-set` commands for the final evidence.

Version 2 production verification uses six separate held-out situations and
the exact active brief.

It does not reuse an ablation case.

Before a release campaign, an independent reviewer must compare every
production case with every ablation case and confirm that its artifact
structure, constraints, and competing cues differ.

The current production inputs include a mixed incident update, native error
dialog fields, and a troubleshooting decision table instead of repeating the
matching ablation structures.

The runtime compares the complete prepared brief with the canonical active
`edit` brief, not only its decision examples.

This checks transfer to new scenarios; it does not claim a separate decision
taxonomy.

The active brief is accepted only when all six runs pass with host attestations
and a trusted complete-attempt ledger.

The CLI alone cannot produce that release decision.

Removing the examples later requires a new trusted ablation result followed by
a versioned production check of the exact example-free candidate.

It does not justify removing the underlying semantic structure or preservation
rules.

## Source influence

Boris Cherny's 2026 Y Combinator talk, [We Deleted 80% of Claude Code's
Prompt](https://www.youtube.com/watch?v=qyPCVqFUyDo), influenced the ablation and
evaluation-refresh approach.

The reported prompt reduction, model behavior, durations, and worker counts were
speaker claims rather than results reproduced by Hope.

Hope keeps its own product invariants and requires its own evidence before
changing them.
