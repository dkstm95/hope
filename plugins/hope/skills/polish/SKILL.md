---
name: polish
description: Use only after someone asks to polish or refine one named, completed work product in a bounded pass that must preserve its settled behavior and meaning. Do not use for initial implementation, feature changes, architecture migrations, or broad restructuring.
---

# Hope Polish

Use the active host session only to bind the task, start one fresh worker, and
report the result.

The fresh worker must not inherit the conversation that produced the work.

Do not let the active session inspect, revise, or verify the target as the
Polish worker.

Do not use Polish to implement the work product, add or change a feature,
perform an architecture migration, or carry out broad restructuring.

A requirement to preserve existing behavior does not turn ordinary
implementation or restructuring into Polish.

The fresh worker inspects, revises, and verifies the named completed result.

Perform at most one bounded modification round.

## Create an isolated handoff

Before editing, confirm that the host can start a subagent with no inherited
conversation context.

If it cannot, stop and explain that Polish requires a fresh worker.

Give the worker only:

- the person's exact request;
- the exact target and its purpose;
- settled behavior and meaning, facts, uncertainty, citations, intended voice,
  and public contracts;
- in-scope and out-of-scope work plus the granted write authority;
- the location of this Skill;
- direct evidence locations; and
- the verification methods.

Do not pass previous reasoning, drafts, failed approaches, implementation
narrative, or another agent's conclusions.

Tell the worker to read this Skill before acting.

## Establish the boundary

The fresh worker inspects the exact target before planning.

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

The fresh worker creates a short plan from the inspected target.

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

The fresh worker reports:

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
