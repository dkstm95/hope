<!-- Generated from docs/sweep.md. Do not edit. -->

# Hope Sweep

Hope Sweep inventories a project for broad maintenance and returns an
evidence-linked plan.

Sweep is read-only.

## Product boundary

Sweep inspects the complete project-owned worktree when the available tools and
context allow it.

It includes tracked files and relevant untracked files.

It excludes ignored dependencies, caches, build outputs, external directories,
and other paths the project does not own.

Report every material exclusion and coverage gap.

Treat symbolic links as entries.

Record their target text without following them outside the project.

Do not claim whole-project coverage when inspection was partial.

When disjoint batch inspection improves coverage, every batch inspector uses a
fresh context with no inherited conversation, previous reasoning, findings, or
another inspector's output.

Each inspector receives only the exact request, project-owned instructions,
assigned files, applicable risks, exclusions, and expected evidence format.

If fresh contexts are unavailable, inspect sequentially in the active session
and disclose that independent batch inspection was unavailable.

## Review areas

Consider these areas when they apply:

- broken references and configuration drift;
- dead or stale code and content;
- missing, repeated, or premature abstractions;
- test gaps and documentation drift;
- dependency, security, license, and compatibility risk;
- performance or operational waste;
- generated-source and release-boundary drift; and
- unclear ownership or project structure.

The list guides inspection.

It does not require a finding in every area.

## Evidence

Tie each finding to concrete files, symbols, configuration, tests, or external
authoritative sources.

Separate confirmed facts from inferences and open questions.

Check consumers, generated copies, public contracts, and history before calling
something unused.

Do not treat a passing test as proof that a file or abstraction is necessary.

Do not treat a missing reference search as proof that removal is safe when an
external contract may exist.

## Plan

Return an ordered plan that includes:

- what was inspected;
- what was excluded or could not be checked;
- confirmed findings and their impact;
- removal or simplification candidates;
- dependencies between candidates;
- recommended order;
- verification needed for each change; and
- items that need a product decision.

A no-change or findings-only result is valid.

Prefer deleting an unneeded product promise and its implementation together over
removing only its tests.

## No execution

Sweep does not edit files.

It does not create approval attestations, completion records, session records,
or Polish composition data.

It does not invoke Polish.

After Sweep returns the plan, the person may select any candidate and start a
separate implementation task.

That task owns its authority, changes, and verification.
