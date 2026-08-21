---
name: sweep
description: Use to inventory a project for broad maintenance and return an evidence-linked, decision-ready whole-project plan without changing files.
---

# Hope Sweep

Use the active host session to set the scope, inspect the project, merge
evidence, and return a read-only maintenance plan.

Do not edit files during Sweep.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing the inspected coverage, evidence,
decisions, uncertainty, or required result.

## Establish coverage

Identify the repository root and current revision.

Inspect tracked files and relevant untracked files owned by the project.

Exclude ignored dependencies, caches, build outputs, external directories, and
other non-owned paths.

Report every material exclusion and coverage gap.

Treat symbolic links as entries.

Record their target text without following them outside the project.

Use subagents for disjoint batches when that materially improves coverage.

Every batch inspector must use a fresh context with no inherited conversation,
previous reasoning, findings, or another inspector's output.

Give each subagent an explicit file assignment.

Give it only the person's exact request, project-owned instructions, assigned
files, applicable maintenance risks, exclusions, the location of this Skill,
and expected evidence format.

Tell each inspector to read this Skill before acting.

If fresh contexts are unavailable, inspect sequentially in the active session
and disclose that independent batch inspection was unavailable.

Merge their evidence and report missing or overlapping coverage.

Reconcile reported counts and coverage claims against the source inventory.

Every project-owned entry must be inspected, excluded with a reason, or named
as a coverage gap.

Do not claim whole-project coverage when inspection was partial.

## Inspect maintenance risks

Consider:

- broken references and configuration drift;
- dead or stale code and content;
- missing, repeated, or premature abstractions;
- test gaps and documentation drift;
- checks that freeze wording, file names, or implementation shape without
  guarding a concrete failure;
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

Name the affected behavior or contract precisely.

Do not collapse distinct input versions, stored artifacts, compatibility paths,
or product promises into one label such as "legacy" or "history."

Check consumers, generated copies, public contracts, and history before calling
something unused.

Do not treat a passing test as proof that a file or abstraction is necessary.

Do not treat a missing reference search as proof that removal is safe when an
external contract may exist.

Try to disprove every material finding before reporting it.

Check the strongest plausible alternative explanation and contradictory
evidence.

Remove the finding or lower its certainty when it does not survive that check.

For a visual or interactive finding, reproduce the relevant viewport and state
in the intended viewer.

Treat thumbnails, composite previews, and screenshots from another state as
leads, not confirmation.

## Make decisions easy

Classify every actionable finding as one of:

- `Recommend`: evidence supports a specific change and no material product
  choice remains;
- `Decide`: the person owns a product, compatibility, retention, or other
  material trade-off; or
- `Defer`: evidence or authority is insufficient for a recommendation.

Give each item a stable ID and include:

- the exact behavior, promise, or files in scope;
- evidence and whether it is fact, inference, or an open question;
- user or maintenance impact; and
- the verification needed after implementation.

When dependencies, recommended order, compatibility, or release effects are
material, include them. Mark any that evidence does not establish as `unknown`.

For each `Decide` item, ask one concrete question, recommend a default with a
reason, and state the consequence of each viable option.

Turn a broad concern into the behavior the choice would preserve or remove.

Do not put a `Defer` item in the recommended implementation order.

Group compatible `Recommend` items and already accepted `Decide` items into
proposed, bounded implementation batches with their file scope and checks.

For each unresolved `Decide` item, show which proposed batch its recommended
default would join if accepted.

Finalize and run selected batches only in a separate implementation task after
the person accepts any included defaults.

## Return the plan

Lead with the most important conclusion.

Report:

- coverage, exclusions, and gaps;
- `Recommend`, `Decide`, and `Defer` items;
- proposed implementation batches and their order; and
- the smallest response needed from the person.

Keep the final request to answers for unresolved `Decide` items and selection
of proposed batches for a separate implementation task. Offer one reply that
accepts every recommended default and selects all recommended batches.

If no product decision remains, say so directly.

A no-change or findings-only result is valid.

Prefer removing an unneeded product promise, its implementation, and its tests
together.

Do not create approval records, completion records, session records, or Polish
composition data.

Do not invoke Polish.

After returning the plan, wait for the person to select a separate
implementation task.
