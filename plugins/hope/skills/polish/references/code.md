# Polishing code changes

Use this guidance when the bound target contains code, tests, configuration,
build logic, or another executable or machine-consumed change.

Polish the changed code and the smallest surrounding area needed to establish
reuse, behavior, and ownership. Do not turn a finishing pass into a whole-project
maintenance sweep.

## Select review lenses

Assign only lenses that could materially improve the target. Use all four for a
substantial code change. Combine or omit a lens for a small target when the
assignment would otherwise duplicate another scout.

### Reuse

Look for existing helpers, utilities, components, patterns, and conventions that
the change should reuse instead of creating a parallel implementation.

Check actual consumers and contracts before consolidating. Similar-looking code
may serve different behavior or ownership boundaries.

### Simplicity

Look for avoidable branches, states, duplication, indirection, wrappers, and
ceremony in the changed path.

Prefer direct control and data flow. Do not replace clear code with compressed,
clever, or unfamiliar code merely to reduce line count.

### Efficiency

Look for repeated work, unnecessary I/O, avoidable allocation, redundant build
steps, or an algorithmic cost introduced by the change.

Require a plausible workload and concrete benefit. Reject speculative
micro-optimization and any speedup that materially harms clarity or safety.

### Abstraction fit

Check whether the change operates at the right level of abstraction and keeps
responsibility at the boundary that owns it.

Look for premature generalization, one-use abstractions that obscure behavior,
stale wrappers, and logic placed in the wrong layer. Also look for duplicated
policy that belongs in one established owner.

Do not extract a helper merely because two fragments look alike. Do not preserve
an abstraction merely because a test currently names its implementation shape.

## Ground candidates

Inspect the exact difference, applicable project instructions, nearby code,
consumers, existing helpers, and relevant tests. Use history only when current
evidence cannot establish why a boundary exists.

For each candidate, provide:

- the exact file, symbol, or changed path;
- the current unnecessary cost;
- evidence that the proposed form fits existing behavior and ownership;
- the smallest proposed change;
- the behavior or contract at risk; and
- the check that can detect a regression.

Keep a suspected correctness bug out of the cleanup list. Polish does not hunt
for bugs. Report the concern separately with its evidence so the person can
start a review or fix task.

## Apply a code pass

Prefer one small, reviewable patch. Preserve public APIs and observable behavior.
Keep dependency upgrades, framework migrations, architecture moves, and broad
module decomposition outside Polish.

Deletion, deduplication, helper reuse, control-flow simplification, and replacing
a stale local pattern with the project's current convention are valid only when
the evidence establishes the affected consumers and preservation boundary.

Verify with the narrowest useful combination of targeted tests, type checks,
lint or formatting checks, builds, and direct runtime observation. Inspect the
final diff to confirm that every edit belongs to the cleanup plan.

## Design sources

These lenses draw on Claude Code's cleanup-only `/simplify` review and OpenAI's
guidance to refactor in small, behavior-preserving, verifiable passes:

- <https://code.claude.com/docs/en/commands>
- <https://learn.chatgpt.com/use-cases/refactor-your-codebase>
- <https://learn.chatgpt.com/docs/code-review>
