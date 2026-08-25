# Align artifact

Read this reference only when inspecting, creating, migrating, or revising an
Align artifact. `SKILL.md` owns the conversation, readiness, artifact timing,
and revision judgment. This reference owns artifact authoring and commands.

## Author the current intent

Read the complete `scripts/align-input-v3.schema.json` before writing input. It
reuses shared scalar and visual definitions from
`scripts/align-input-v2.schema.json`.

`create` and `revise` accept only v3 input:

- `goal` and `problem` form the summary;
- each `intent` item binds one observable outcome to its judgment method and
  `agent` or `human` source, with a reason only when it adds material context;
- `exclusions` names deliberately deferred product work;
- `flow` records a person-visible or domain-visible sequence only when sequence
  or branching adds information; and
- `designDirections` and `evidence` remain optional.

Positive intent statements define what is included. Do not repeat them as
scope, boundary, expected behavior, or a decision list. Omit an optional field
when it adds no information.

Put a settled material assumption only in the intent statement or reason it
affects. Do not add a separate assumptions section.

Record the intended experience and why it matters. Exclude architecture,
modules, algorithms, tools, files, protocols, data structures, implementation
order, test commands, work assignments, reversible technical choices, current
implementation state, and completion results. Never put internal control flow
in `flow` or use repository evidence to describe the current implementation.

A ready artifact contains no unresolved intent. Resolve material questions
before authoring, put deliberately deferred work in `exclusions`, and leave
research or implementation uncertainty in the work that owns it.

Put each fact in one place. Compare sibling items and consolidate repeated
meaning, but keep distinct claims that happen to cite the same evidence. Also
compare each intent statement with its reason and flow. Keep each prose value to
one semantic paragraph unless a real paragraph boundary is needed. Use one
decisive result for the title, one direct statement for the goal, and only the
main practical cause or effect for an intent reason.

## Attach evidence

Give evidence that supports a specific claim a stable lowercase `id`. Write the
claim as the schema's cited-title or cited-prose object and name only the IDs
that directly support it. Reuse an evidence item instead of copying it. Keep
general evidence uncited rather than inventing a claim link.

When a design direction uses a source already in `evidence`, reference its ID
and add `influence`. Use a direct `label`, `url`, and `influence` reference only
when the source does not belong in the evidence list.

The runtime rejects duplicate evidence entries and exact duplicate sibling
items. Shared evidence IDs are a review signal, not proof that two claims are
duplicates.

## Migrate v2 input

`migrate-input` is the only path that accepts a v2 input file. It returns a v3
`draft` for fields with a direct mapping and keeps the former boundary, included
scope, decisions, and open choices in `review`.

The result has `ready: false`. Resolve every review item against the current
agreement, remove repeated meaning, and pass only a clean v3 input to `create`
or `revise`. Do not guess how an earlier boundary, decision, or open choice
becomes current intent.

## Choose the artifact and input paths

Use the project's established location for durable design or specification
documents when one is clear; otherwise use `docs/alignments/`. Never publish
project knowledge in a hidden Hope directory.

Choose one stable, descriptive HTML path for one goal. A new implementation
attempt, branch, or pull request for the same goal does not create another
artifact.

Write structured input to a temporary JSON file outside the repository. Pass
every adapter argument separately and remove the temporary input afterward.

Design-direction images must be absolute paths to stable ordinary,
non-interlaced PNG files. Use two or three images, at most 512 KiB each and 1 MiB
total. Each edge must be at most 4,096 pixels and the image at most 8 megapixels.
Do not supply a symbolic link, authored HTML, CSS, JavaScript, SVG, or data URL.

## Run a command

Use the adapter command selected in `SKILL.md` with one subcommand:

```text
create --input <draft.json> --output <artifact.html> [--root <repository>]
inspect --artifact <artifact.html>
migrate-input --input <legacy-v2.json>
revise --input <draft.json> --artifact <artifact.html> --expect <digest> [--root <repository>]
```

The adapter prints structured JSON. `create` and `revise` return the artifact
path, Align ID, current revision, and digest. `inspect` also returns the current
content and compact revision index.

## Create, inspect, and revise safely

`create` publishes a new artifact and never replaces an existing path.

Before `revise`, use `inspect` to verify the artifact, confirm that it still
owns the same goal, and use its current digest. Leave an unknown, manually
changed, identity-mismatched, or stale artifact untouched. The runtime also
stops if the repository or path identity changes during publication.

A material change to the goal, decided intent, exclusions, person-visible flow,
or selected design direction creates one new revision in the same artifact. An
implementation result or technical choice does not.

`inspect` keeps v1, v2, and v3 history readable. `revise` preserves those
revisions and appends v3 current intent.

Treat the artifact as project documentation of the agreement at that time.
Keep it by default after implementation. Do not update it to mirror the
implemented result, delete it merely because work finished, or link it to a
Diff artifact. Remove it only when the person decides to do so.
