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

Keep failed runs in the evidence set.

Store bounded receipts under ignored `test-results/` or an equivalent private
release-evidence location.

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

The first completed follow-up kept the semantic rules and made example removal
a candidate after all 28 version 3 `rules-only` runs passed in fresh Codex
contexts.

A separate production verification prepares the exact active version 4 brief
without examples or evaluation-only control text. Its eight fresh runs must all
pass before Hope treats the active brief as release evidence.

The first production-verification set passed all eight checked decisions in
fresh Codex contexts.

The Claude and Codex Skill coordinates fresh host runs, while the independent
harness exposes the same deterministic preparation and validation commands.

The runtime does not claim that repository tests executed a host model.

## Source influence

Boris Cherny's 2026 Y Combinator talk, [We Deleted 80% of Claude Code's
Prompt](https://www.youtube.com/watch?v=qyPCVqFUyDo), influenced the ablation and
evaluation-refresh approach.

The reported prompt reduction, model behavior, durations, and worker counts were
speaker claims rather than results reproduced by Hope.

Hope keeps its own product invariants and requires its own evidence before
changing them.
