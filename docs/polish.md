# Hope Polish

Hope Polish performs one bounded cleanup or refactor of a named completed work
product.

It preserves intended behavior and meaning.

## Product boundary

Polish starts from an exact target that the active host can inspect.

The target may be code, tests, documentation, prompts, comments, examples, or
another completed work product.

Before editing, state:

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
