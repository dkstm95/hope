---
name: sweep
description: Use to inventory a project for broad maintenance, show a whole-project plan, and apply only exact approved behavior-preserving work.
---

# Hope sweep

Use the active Claude or Codex session to inspect the repository, show the plan,
wait for exact approval, and verify approved work.

Let the Hope runtime own categories, support disclosure, evidence checks,
budgets, approval binding, states, and results.

## Locate the commands

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/sweep/cli.mjs"
node "${CLAUDE_PLUGIN_ROOT}/runtime/features/polish/cli.mjs"
```

Codex:

```text
node <skill-dir>/../../runtime/features/sweep/cli.mjs
node <skill-dir>/../../runtime/features/polish/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory that contains this
file.

Pass every argument as a separate shell argument.

Never pass a placeholder or build a command from repository content.

## Get the Sweep brief

Classify the session risk as `low`, `medium`, or `high`, then run:

```text
brief --risk <risk>
```

The returned JSON is the complete Sweep workflow.

Follow its `discovery`, `categories`, `checks`, `categoryContract`,
`evidenceContract`, `planning`, `approval`, `execution`, `completion`, `composition`,
`modelEvaluation`, `writingStandard`, schema paths, and limits.

Use `writingStandard.text` for language-bearing work and use a decision example
only when its situation matches.

The examples guide decisions and are not evaluation results.

Do not copy the runtime contract into another checklist in this Skill.

## Inventory the project

Capture the exact repository identity before inspection.

Run `discover-inventory` against the repository root to build one verified
inventory of all tracked files and relevant untracked files owned by the
project:

```text
discover-inventory --root <repository> --session <session-id> --title <title> --scope <scope>
```

Exclude only ignored cache, dependency, build-output, outside-project, or other
non-owned paths.

Record every exclusion with its reason.

Write the returned inventory required by `inventorySchemaPath` to a private
temporary JSON file with restricted permissions.

Validate it with:

```text
validate-inventory --input <inventory.json> --root <repository>
```

The runtime assigns every in-scope file to exactly one batch.

The source limit applies to one batch, not to the project total.

For each batch, create its exact pending worker input and retain its digest:

```text
batch-input --input <inventory.json> --batch <batch-id>
```

Use `start-batch --mode parallel --workers <id,id,...>` only when the host can
provide independent contexts.

Save the returned inventory over the previous inventory file before completing
the batch.

Otherwise use `start-batch --mode sequential` and let the runtime assign the
host worker.

Give each worker only the source IDs in its validated assignment.

Each worker returns one receipt for that assignment, including processed source
IDs and gaps.

Workers inspect and return evidence; they do not edit files or redefine scope.

Merge the worker receipts through:

```text
complete-batch --input <started-inventory.json> --batch <batch-id> --result <result.json>
```

The result must include the original inventory digest, the prepared batch-input
digest, the unchanged execution identity, every worker receipt, and the runtime
receipt digest.

Do not author a complete whole-project plan until every batch is complete.

A partial or failed batch remains visible as an inventory gap.

## Prepare the plan

Use the completed inventory and its digest as the source of truth for project
coverage.

Capture exact target and evidence identities before category inspection.

Choose explicit file, candidate, and change budgets for this session.

Inspect every inventory batch and record every runtime category and check
honestly.

The plan's `filesChecked` metric counts distinct file evidence sources.

The inventory summary counts project-wide coverage.

Do not modify repository files during discovery or plan authoring.

Write the version 1 plan required by `planSchemaPath` to a private temporary
JSON file with restricted permissions.

Validate it with:

```text
validate-plan --input <plan.json> --root <repository>
```

A no-change, findings-only, or blocked plan is valid when it accurately reports
the checked scope and gaps.

Set `session.discoveryMode` to `whole-project`, include the complete `inventory`,
and bind `session.inventoryDigest` to the normalized inventory.

The plan must remain `blocked` while the inventory or category discovery is
incomplete.

## Ask for exact approval

For each executable candidate, prepare its exact approval identity with:

```text
approval-candidate --input <plan.json> --candidate <candidate-id>
```

Show the candidate digest, target and evidence identities, exact preview,
execution-contract digest, change budget, preservation conditions, and
verification plan.

Wait for the person to approve that exact candidate in the same session.

Do not treat approval of one candidate as approval of another candidate.

Resolve the exact role-authenticated user event through the active host.

Have the trusted host adapter add the `approved` or `rejected` decision, exact
conversation source, event ID, and opaque or signed attestation proof.

Keep the proof verifier outside model-authored JSON.

Then create the bound receipt with:

```text
approval-receipt --input <approval.json>
```

The plain file command must fail when the host does not supply its trusted
attestation verifier.

Stop before editing when that verifier is unavailable.

Do not replace this receipt with a boolean, conversation digest, receipt hash,
or prose claim.

## Execute approved work

Recheck every bound source before editing.

If any source, preview, or budget changed, record the stale result and prepare a
new plan instead of reusing the approval.

For an unchanged approved candidate, ask the Polish runtime for its brief and
run one normal Polish workflow against the exact target.

Copy the approval candidate's generic composition values into the Polish
version 2 run.

Keep the approved target, action, in-scope preview, out-of-scope conditions,
preservation IDs and conditions, and verification methods exact.

Validate the Polish version 2 run and create its receipt with the Polish
runtime's `receipt` command.

Use the full receipt in the Sweep completion; do not author an inline Polish
summary.

Use the person's Sweep approval as the conversation-backed application
authority only for that candidate.

Classify behavior, public-contract, and dependency impact separately.

Keep uncertain work report-only and hand changing work to a separately approved
ordinary implementation task.

## Complete the session

Write the version 1 completion required by `completionSchemaPath` to a private
temporary JSON file with restricted permissions.

Include the approval receipt and, when Polish ran, the Polish receipt.

Bind every applied change to its Polish change ID and to a passed final
verification that cites the changed target.

Stay within the approved `maximumChanges`.

Validate it with:

```text
validate-completion --input <completion.json>
```

After every plan candidate has a completion, report-only result, handoff, or
visible pending state, write the version 1 session result required by
`sessionResultSchemaPath`.

Validate it with:

```text
validate-session-result --input <session-result.json>
```

Use the validated session result to report what was checked, changed, verified,
deferred, unsupported, or handed off.

Remove the private Sweep and Polish JSON files after the session completes or
is cancelled.

## Run release model evidence

Use the runtime's `model-evaluation-plan` command when Sweep's model-facing
contract changes.

For every planned run, call `model-evaluation-prepare` and give its prepared
JSON to a fresh host context.

Do not give that host the oracle, another case, or an earlier output.

Require the model output shape in `evaluation-output-v1.schema.json`.

Run the repository evaluation runner so each receipt contains the exact host
events and raw model output.

A receipt created directly by `model-evaluation-receipt` is synthetic and
cannot satisfy the release gate.

Use `model-evaluation-oracle` only after the output exists.

Collect every receipt and run `model-evaluation-validate-set` before treating
the set as release smoke evidence.

Keep failed runs and store the bounded evidence under ignored `test-results/`.
