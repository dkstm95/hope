---
name: sweep
description: Use to inventory a project for broad maintenance and return an evidence-linked, whole-project plan without changing files.
---

# Hope Sweep

Use the active Codex or Claude session to inspect the project and return a
read-only maintenance plan.

Do not edit files during Sweep.

## Establish coverage

Identify the repository root and current revision.

Inspect tracked files and relevant untracked files owned by the project.

Exclude ignored dependencies, caches, build outputs, external directories, and
other non-owned paths.

Report every material exclusion and coverage gap.

Treat symbolic links as entries.

Record their target text without following them outside the project.

Use independent subagents for disjoint batches when that materially improves
coverage.

Give each subagent an explicit file assignment.

Merge their evidence and report missing or overlapping coverage.

Do not claim whole-project coverage when inspection was partial.

## Inspect maintenance risks

Consider:

- broken references and configuration drift;
- dead or stale code and content;
- missing, repeated, or premature abstractions;
- test gaps and documentation drift;
- dependency, security, license, and compatibility risk;
- performance, package, build, and CI waste;
- generated-source and release-boundary drift; and
- unclear ownership or project structure.

The list guides inspection.

It does not require a finding in every area.

## Require evidence

Tie each finding to concrete files, symbols, configuration, tests, or
authoritative external sources.

Separate confirmed facts from inferences and open questions.

Check consumers, generated copies, public contracts, and history before calling
something unused.

Do not treat a passing test as proof that a file or abstraction is necessary.

Do not treat a missing reference search as proof that removal is safe when an
external contract may exist.

## Return the plan

Lead with the most important conclusion.

Include:

- what was inspected;
- what was excluded or could not be checked;
- confirmed findings and their impact;
- removal or simplification candidates;
- dependencies between candidates;
- recommended order;
- verification needed for each change; and
- items that need a product decision.

A no-change or findings-only result is valid.

Prefer removing an unneeded product promise, its implementation, and its tests
together.

Do not create approval records, completion records, session records, or Polish
composition data.

Do not invoke Polish.

After returning the plan, wait for the person to select a separate
implementation task.
