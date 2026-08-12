---
name: polish
description: Use after a work product or code change is complete when someone asks to polish, simplify, clean up, deduplicate, consolidate, refactor, or improve efficiency without changing settled behavior, meaning, or public contracts. Review a named target or the current repository change set with independent cleanup scouts, let a fresh finisher apply one bounded local improvement pass by default, and verify it. Do not use for initial implementation, requested feature changes, bug hunting, architecture migrations, or broad maintenance sweeps.
---

# Hope Polish

Use the active host session only to bind the target, assign independent cleanup
scouts, hand their evidence to one fresh finisher, and report the result.

Do not let the active session inspect, judge, revise, or verify the target as a
scout or finisher.

Perform one candidate-discovery round and at most one coherent modification
pass. A limited correction or reversion of a regression introduced by that pass
is part of verification, not another cleanup round.

## Bind the target

Prefer an exact target named by the person.

When no target is named and the current project is a Git repository, bind the
smallest reliable change set that matches the request:

- use a reliable last-turn change set when the request clearly refers to it;
- otherwise include the current branch changes ahead of its upstream plus
  staged, unstaged, and relevant untracked files; or
- use only the working-tree changes when no upstream comparison is available.

For a non-repository result, use the named or clearly referenced completed work
product. Ask for a target only when the available context cannot identify one
without widening the task.

Before review, state:

- the target, its purpose, and the evidence snapshot;
- what is in and out of scope;
- the behavior, meaning, facts, uncertainty, citations, voice, and public
  contracts that must stay unchanged;
- whether the run may edit or is review-only; and
- how the result can be verified.

A request to polish, simplify, clean up, deduplicate, consolidate, or refactor
grants authority for reversible local edits inside the stated boundary unless
the person asks for review-only output. It does not authorize a feature change,
public-contract change, dependency migration, architecture move, or unrelated
cleanup.

Recheck the target evidence before writing. Stop and bind a new snapshot when
the target changed after inspection or its identity is uncertain.

## Assign cleanup scouts

Use one to four fresh scouts. Choose the smallest role set that can test the
material cleanup opportunities without making one scout repeat another.

For code, tests, configuration, build logic, or other code-bearing changes,
read [references/code.md](references/code.md) and select from its review lenses.

For other work products, derive distinct lenses from the target's purpose.
Common useful questions are whether the result duplicates existing material,
contains avoidable structure or wording, spends effort without improving the
result, or is organized at the wrong level. Use Hope Write for language-bearing
judgment.

Every scout must:

- use a fresh subagent context with no inherited conversation, previous
  reasoning, drafts, implementation narrative, conclusions, or other scout
  output;
- inspect the bound target and only enough surrounding evidence to establish a
  candidate;
- remain read-only;
- report each candidate's location, evidence, proposed action, expected benefit,
  preservation risk, and verification method; and
- separate suspected correctness problems or required product decisions from
  cleanup candidates.

Give each scout the person's exact request, the bound target, its preservation
contract, its assigned lens, direct evidence locations, exclusions, the
location of this Skill, and the expected output. Tell it to read this Skill and
any applicable reference before acting.

Do not require a finding. No useful cleanup is a valid result.

If fresh subagent contexts are unavailable, stop without performing Polish.

## Let a fresh finisher decide

Start one fresh finisher after the scouts complete. The finisher may see the
scout reports but must not inherit the conversation that produced the target or
the scouts' hidden reasoning.

Give the finisher only:

- the person's exact request;
- the bound target, purpose, preservation contract, scope, and write authority;
- authoritative project rules and direct evidence locations;
- every scout report, including no-finding and out-of-scope results;
- the applicable verification methods;
- the location of this Skill; and
- an instruction to read this Skill before acting.

The finisher inspects the target, then accepts, merges, rejects, or defers each
candidate from evidence and net benefit. Do not count scout votes.

Accept only changes that:

- have a concrete reason and a visible improvement;
- preserve the bound behavior, meaning, and contracts;
- fit one small, coherent pass; and
- can be verified in the changed scope.

Reject personal taste, speculative optimization, parallel abstractions, broad
rewrites, and cleanup whose benefit does not justify its risk. Remove or merge
content only when evidence shows that it is unnecessary or duplicative.

Do not fix a suspected correctness bug, implement a product decision, or hide a
feature change inside Polish. Report it separately. Return `needs alignment`
when such an issue prevents a safe cleanup decision.

If the run is review-only, report the adjudicated candidates without editing.
Otherwise, create a short plan from the accepted candidates, recheck the target,
and apply the pass. Use Hope Write for language-bearing changes within the
finisher; it does not add another worker or modification round. A no-change
result is valid.

## Verify the pass

Run the smallest checks that can detect a regression in the changed scope and
inspect the final difference against the preservation contract.

If verification exposes a regression introduced by Polish, correct only that
regression inside the same boundary or revert the affected Polish change. Do
not use verification as a new candidate-discovery round. Do not fix a
pre-existing failure unless the person starts a separate task.

The finisher reports:

- what changed, or why no change was needed;
- which candidates were rejected or deferred and why;
- what was checked and what passed or failed;
- what remains uncertain; and
- any correctness concern or material decision left outside Polish.

Passing checks prove only their stated scope.

Do not create a private JSON run, schema record, digest ledger, or composition
receipt.

Do not commit, push, open a pull request, or merge unless the person asks for
that separate action.
