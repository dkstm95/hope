<!-- Generated from docs/polish.md. Do not edit. -->

# Hope Polish

Hope Polish refines one named, completed work product in a bounded finishing
pass.

It preserves intended behavior and meaning.

## Product boundary

Use Polish only after the work product is complete for the current task and the
person asks to polish or refine it.

Do not use Polish for initial implementation, feature additions or changes,
architecture migrations, or broad restructuring.

A requirement to preserve existing behavior during those tasks does not make
them Polish.

The active host binds the task and delegates the finishing pass to one fresh
worker that did not inherit the conversation that produced the work.

The active host does not perform the inspection, revision, or verification.

If the host cannot create a fresh context, Polish stops before editing.

The worker receives only the exact request, target, settled behavior and
meaning, facts, uncertainty, citations, intended voice, public contracts,
scope, write authority, direct evidence, and verification methods.

Do not give it previous reasoning, drafts, failed approaches, implementation
narrative, or another agent's conclusions.

Polish starts from an exact target that the fresh worker can inspect.

The target may be code, tests, documentation, prompts, comments, examples, or
another completed work product.

Before editing, the fresh worker states:

- the target and its purpose;
- what is in and out of scope;
- the behavior, meaning, facts, uncertainty, citations, and public contracts
  that must stay unchanged;
- the small set of planned changes; and
- how the checked scope will be verified.

Do not use Polish to hide a new product decision.

Stop with a clear alignment need when the requested cleanup would change
observable behavior, a public contract, or core meaning.

## Revision

Inspect the target before planning.

Perform at most one bounded modification round.

Each change needs a concrete reason tied to the target.

Removing or merging content is allowed only when available evidence supports
that it is unnecessary or duplicative.

Similar tests, repeated documentation, and apparently unused code may serve
different boundaries.

Keep them when their purpose cannot be established.

A no-change result is valid.

## Authority and identity

The person's request may authorize an in-scope edit.

Ask for explicit approval when the proposed removal or consolidation is not
clearly authorized by the request.

Recheck the target before writing.

Stop when the target changed after inspection or when its identity is
uncertain.

Polish does not commit, push, open a pull request, or merge unless the person
asks for that separate action.

## Verification

Run the smallest checks that can detect a regression in the changed scope.

Report:

- what changed;
- what was checked;
- what passed or failed;
- what remains uncertain; and
- whether no change was needed.

Passing checks prove only their stated scope.

Do not claim complete semantic preservation from a formatter, linter, or test
suite alone.

## Relationship to other Skills

Write supplies the shared language standard for language-bearing changes.

Polish applies that standard directly rather than invoking Write as another
workflow.

Align, Sweep, Diff, and Toxic Review do not require a Polish record.

A person may start Polish separately after any of those Skills produces a
stable work product.

Polish does not create a private JSON run, schema record, digest ledger, or
composition receipt.
