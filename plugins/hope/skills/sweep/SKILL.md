---
name: sweep
description: Apply proven, behavior-preserving codebase cleanup. Use only when explicitly invoked.
disable-model-invocation: true
---

# Hope Sweep

Use only when the person invokes `$hope:sweep`, `/hope:sweep`, or the
host's equivalent skill command or picker. Continue follow-ups within that
invoked task without requiring another invocation. Ordinary requests and calls
from another skill do not activate this skill; continue authorized work through
the ordinary workflow. Reading a shared reference does not invoke its skill.

Apply proven maintenance to operating code and directly supporting tests,
configuration, build logic, documentation, examples, and assets. Read
`../write/references/writing-standard.md` for user-facing language.

## Scope

Use the named repository, or the current one, and the whole repository unless
the person narrows it. Record the revision and working-tree state; preserve
unrelated edits and project instructions. Invocation authorizes reversible
local edits in this scope, not commits, pushes, pull requests, or merges.

## Prove and apply cleanup

Establish current behavior from running code and configuration. Follow the
actual consumers and boundaries relevant to each proposed cleanup.

Remove dead code, duplication, needless branches or wrappers, misplaced
abstractions, and repeated work. Share logic only when behavior, ownership,
and reasons to change match. Optimize only for a plausible workload with a
concrete benefit.

Prove a removal has no remaining consumer, including external or dynamic use
where relevant. A missing text reference alone does not prove safety. Remove
dedicated tests, documentation, generation, configuration, and assets with
their obsolete consumer; retain support for remaining paths.

Apply small coherent batches. Leave bugs, public-contract or behavior changes,
product and compatibility decisions, migrations, dependency changes, and
uncertain removals outside Sweep. Do not turn those signals into unsolicited
findings or follow-up tasks.

## Verify and finish

Verify affected consumers with the narrowest useful tests, checks, builds, or
runtime observations, plus required project checks. Add tests only when needed
to protect the refactor. Correct or revert regressions Sweep introduced; do not
repair pre-existing failures or widen scope during verification.

Finish when the supported cleanup is complete and affected behavior has been
checked. Report the cleanup, supporting material changed with it, and any
verification limits. If no proven cleanup exists, say so. Keep unrelated
signals out of the report.
