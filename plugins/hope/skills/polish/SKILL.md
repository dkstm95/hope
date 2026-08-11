---
name: polish
description: Use only after someone asks to polish or refine one named, completed work product in a bounded pass that must preserve its settled behavior and meaning. Do not use for initial implementation, feature changes, architecture migrations, or broad restructuring.
---

# Hope Polish

Use the active Codex or Claude session only after a named work product exists,
is complete for the current task, and the person asks to polish or refine it.

Do not use Polish to implement the work product, add or change a feature,
perform an architecture migration, or carry out broad restructuring.

A requirement to preserve existing behavior does not turn ordinary
implementation or restructuring into Polish.

Inspect, revise, and verify the named completed result.

Perform at most one bounded modification round.

## Establish the boundary

Inspect the exact target before planning.

State:

- the target and its purpose;
- what is in and out of scope;
- the behavior, meaning, facts, uncertainty, citations, and public contracts
  that must stay unchanged;
- the small set of planned changes; and
- how the checked scope will be verified.

Use the person's request as write authority only for work clearly inside that
boundary.

Ask before a removal or consolidation that is not clearly authorized.

Return `needs alignment` instead of silently choosing a material product
behavior or public-contract change.

## Revise once

Create a short plan from the inspected target.

Every change needs a concrete reason.

Removing or merging content is allowed only when available evidence shows that
it is unnecessary or duplicative.

Similar tests, repeated documentation, and apparently unused code may protect
different boundaries.

Keep them when their purpose cannot be established.

A no-change result is valid.

Recheck the target before writing.

Stop when it changed after inspection or its identity is uncertain.

Apply the Hope Write standard directly to language-bearing changes.

Do not invoke Write as another workflow.

## Verify and report

Run the smallest checks that can detect a regression in the changed scope.

Report:

- what changed;
- what was checked;
- what passed or failed;
- what remains uncertain; and
- whether no change was needed.

Passing checks prove only their stated scope.

Do not create a private JSON run, schema record, digest ledger, or composition
receipt.

Do not commit, push, open a pull request, or merge unless the person asks for
that separate action.
