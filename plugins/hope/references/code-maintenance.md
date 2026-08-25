# Code maintenance guidance

Use this guidance for behavior-preserving maintenance of code and its directly
supporting tests, configuration, build logic, and documentation.

## Find active code

Trace entry points, runtime registration, build and deployment settings,
generated boundaries, and consumers before deciding what is active.

Treat running code and configuration as the authority when documentation,
tests, comments, examples, or history disagree with them. Use those sources as
evidence, not as a substitute for the operating path.

## Improve structure

### Reuse

Prefer an established helper, component, pattern, or convention over a parallel
implementation when the consumers share behavior and ownership.

### Simplicity and abstraction

Remove avoidable branches, states, duplication, wrappers, indirection, and
ceremony. Prefer direct, familiar control and data flow over compressed or
clever code.

Remove abstractions that obscure behavior or sit at the wrong boundary. Create
or extend an abstraction only when repeated logic shares behavior, a reason to
change, and an owner.

### Efficiency

Remove repeated work, unnecessary I/O, avoidable allocation, redundant build
steps, and algorithmic cost when a plausible workload and concrete benefit
exist. Reject speculative optimization that harms clarity or safety.

## Remove safely

Before removing code or support material, rule out public or external
consumers, dynamic lookup, reflection, string-based registration, generated
sources, and package or release boundaries.

A missing text reference is not proof that removal is safe. A passing test is
not proof that an implementation shape is necessary. Leave uncertain removals
unchanged.

When removal is safe, also remove dedicated tests, documentation,
configuration, generation steps, and assets that no longer have a consumer.
Keep shared support that still serves another path.

Update documentation, comments, examples, and configuration that no longer
match the remaining code.

## Preserve behavior

Keep observable behavior and public contracts unchanged. Leave bug fixes,
product or compatibility decisions, migrations, dependency changes, and
unrelated audits outside the maintenance change.

Prefer the smallest coherent change that removes the proven cost. Add a test or
check only when it is the minimum evidence needed to protect the refactor.

Verify with the narrowest useful combination of targeted tests, type checks,
lint or formatting checks, builds, and direct runtime observation. Confirm
that every edit belongs to the maintenance change and preserves its behavior.
