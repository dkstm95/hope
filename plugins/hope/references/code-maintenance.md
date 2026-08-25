# Code maintenance guidance

Use this guidance for behavior-preserving maintenance of operating code and its
directly supporting tests, configuration, build logic, and documentation.

## Establish the active path

Trace entry points, consumers, runtime registration, configuration, generated
boundaries, and build or deployment settings before judging what is active.
Running code and configuration are authoritative when tests, documentation,
comments, examples, or history disagree; the latter remain evidence.

## Remove proven cost

- Reuse an established helper, component, or pattern when its consumers share
  behavior and ownership.
- Remove avoidable branches, states, duplication, wrappers, indirection, and
  ceremony. Prefer direct, familiar control and data flow.
- Remove an abstraction that obscures behavior or sits at the wrong boundary.
  Add or extend one only when repeated logic shares behavior, a reason to
  change, and an owner.
- Remove repeated work, unnecessary I/O or allocation, redundant build steps,
  and algorithmic cost only when a plausible workload shows concrete benefit.
  Do not trade clarity or safety for speculative optimization.

Before removing code or support material, rule out public or external
consumers, dynamic lookup, reflection, string-based registration, generated
sources, and package or release boundaries. A missing text reference does not
prove safety, and a passing test does not prove an implementation shape is
necessary.

When removal is safe, also remove dedicated tests, documentation,
configuration, generation, and assets that no longer have a consumer. Keep
shared support for remaining paths and update material that no longer describes
them.

## Preserve and verify behavior

Keep observable behavior and public contracts unchanged. Leave bug fixes,
product and compatibility decisions, migrations, dependency changes, and
unrelated audits outside maintenance.

Choose the smallest coherent change that removes the proven cost. Add a test or
check only when it is the minimum evidence needed to protect the refactor.

Verify with the narrowest useful mix of targeted tests, type checks, lint or
formatting checks, builds, and direct runtime observation. Confirm that every
edit belongs to the maintenance change. Leave an uncertain removal unchanged.
