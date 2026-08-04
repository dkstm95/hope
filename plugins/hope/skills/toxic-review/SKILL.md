---
name: toxic-review
description: Use for a strict, skeptical, risk-focused review of a named work product without attacking people or inventing criticism.
---

# Hope toxic review

Be demanding about the work and respectful toward people.

Use the active Claude or Codex session to select and coordinate reviewers.

Let the Hope runtime own the bounded role contract, finding adjudication,
priority order, and resource metrics.

## Locate the command

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/toxic-review/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/toxic-review/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file.

Pass every argument as a separate shell argument.

Never pass the placeholder or build a command from the person's text.

## Get the brief

Choose the target kind, current stage, and risk from the person's request and
available evidence.

Run:

```text
brief --target <kind> --stage <stage> --risk <low|medium|high>
```

The returned JSON is the complete review workflow.

Follow its `snapshot`, `roleSelection`, `findings`, `adjudication`,
`roleRun`, `resultPreparation`, `causalCompleteness`, `stopping`, `finalVoice`,
`writingStandard`, `schemaPath`, and `limits` fields.

Use `writingStandard.text` for user-facing language.

Follow `causalCompleteness.activation` before selecting that perspective, and
use its `decisionExamples` only when a situation matches.

The causal-completeness examples guide decisions; they are not evaluation
results.

Do not replace those rules with another static review contract in this Skill.

## Evaluate causal-completeness behavior

Use this workflow only when the person explicitly asks to evaluate a change to
the causal-completeness method or to produce release evidence for it.

Run `evaluation-plan` through the same runtime command.

For every listed run, call `evaluation-prepare` with its case, variant, and run
number.

Give an independent reviewing host only the returned `brief` and `hostInput`.

Do not read the oracle before that host returns its result.

Then call `evaluation-oracle` for the case and evaluate every rubric criterion.

Call `evaluation-receipt` with the validated review and host-owned model,
effort, and invocation identity.

For a legacy run, complete the returned null assessment after evaluation.

For a rules-only or full run, keep the assessment copied from the structured
causal result.

For every run, complete the rubric, evaluator, and evaluation-time fields, and
keep the prepared input, brief, invocation, and output bindings.

Validate each receipt with `evaluation-validate` and the complete array with
`evaluation-validate-set`.

Keep failed runs in the set and report run success separately from rubric
totals.

Do not describe deterministic contract tests as model behavior evidence.

## Prepare the role run

Use the active host session to bind the target and select the smallest useful
role set.

Write one private plan that follows `roleRun.planSchemaPath`.

Record why those roles are needed and the person's maximum role count.

Use one role and `single` mode when one focused pass covers the material risk.

Use multiple roles only when they cover distinct material risks.

Run:

```text
run-prepare --input <private-plan.json>
```

Save the returned private run state with restricted permissions outside the
repository.

For every pending role, run:

```text
role-input --state <private-run.json> --role <role-id>
```

The returned object is the complete reviewer input.

## Execute one role

Give a reviewer exactly one prepared role input.

In Claude Code, invoke the plugin's `hope:toxic-reviewer` agent.

In Codex, spawn a fresh subagent with the prepared role input and tell it to
follow `roleRun.reviewer`.

For a one-role run on a host without subagents, the active session may execute
the prepared input before adjudication.

For a multi-role run, every reviewer must use a fresh context and must not see
another role's input or output.

Parallel and isolated-sequential scheduling are both valid when contexts stay
independent.

If the host cannot provide fresh contexts, reduce the plan to one role or stop.

Do not describe repeated role prompts in one shared context as independent
reviewers.

The reviewer returns one private result that follows
`roleRun.roleResultSchemaPath`.

After a successful reviewer call, run:

```text
role-complete --state <private-run.json> --input <private-role-result.json> --invocation <host-invocation-id>
```

Replace the private run state with the returned state.

If the reviewer fails or is cancelled, run `role-fail` with its role, host
invocation identity, error code, message, retryability, and status.

Never create an empty successful role result for a failed reviewer.

Use `role-retry` only for a retryable failed or cancelled role, then execute the
new pending attempt.

## Adjudicate and finish

Continue only when the run state is `ready-for-adjudication`.

Use the active host session to adjudicate the completed role findings.

Write only the adjudications and summary required by
`roleRun.adjudicationSchemaPath`.

Run:

```text
run-finalize --state <private-run.json> --input <private-adjudication.json>
```

Present only the returned validated `review` through the brief's `finalVoice`
contract.

The returned `execution` record is the trusted account of role selection,
attempts, completion, and independence.

Do not replace it with reviewer-authored claims.

## Legacy and evaluation validation

The direct validation command remains available for existing version 1 review
records and causal evaluation runs:

```text
validate --input <private-review.json>
```

Follow `resultPreparation` and `stopping`, including removal of every private
plan, run state, role result, adjudication, and review JSON after validation or
cancellation.
