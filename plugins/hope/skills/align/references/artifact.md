# Align artifact

Read this reference when inspecting, creating, or revising an Align artifact,
or after confirmed understanding needs a durable record. `SKILL.md` owns the
conversation and confirmation. This reference owns artifact timing, authoring,
identity, revision judgment, and commands.

## Inspect supplied evidence

When the person supplies an artifact path, inspect that exact path. Use its
current content as evidence and ask for current confirmation through the Align
conversation.

Retain the artifact when inspection verifies the same goal and the confirmed
understanding is unchanged. Revise it when material intent, decisions, exclusions,
flow, or visual selection changed. An uncertain identity or content keeps the
existing file in place and calls for a new artifact location from the person.

## Decide whether to preserve the understanding

After confirmation, create or revise an artifact when:

- the person asks for one;
- another session or worker will rely on the understanding;
- a material decision, assumption, exclusion, or delegation must survive the
  conversation; or
- later human observation or approval forms part of the agreement.

For other work, keep the understanding in the conversation. Ask the person
about a durable record when its value is itself material or uncertain.

## Author the current understanding

Read the complete `../scripts/align-input-v3.schema.json` before writing input.
`create` and `revise` accept that current input format.

- `goal` and `problem` form the summary;
- each `intent` item records one material part of the shared understanding,
  its recognition method, and its `agent` or `human` judge;
- `exclusions` names deliberately deferred work;
- `flow` records a core person, domain, data, or system sequence and its final
  branches when the order or branching adds meaning; and
- `designDirections` and `evidence` remain optional.

The `intent` field keeps its stable format while holding both detailed goals
and consequential choices. A reason adds the consequence or constraint that
made the item worth confirming. Add `decidedBy: user` when the person selected
a consequential choice and `decidedBy: delegated` when the person delegated
that choice to the AI. Detailed goals omit this field. Positive statements
define the agreement, and each fact has one home.

Record the decisions at the level the person understood and confirmed. Data
meaning, ownership, lifecycle, architecture boundaries, system relationships,
and experience choices belong here when they shaped a material branch. The
implementation work owns reversible code mechanics, execution order, commands,
progress, and completion evidence.

A ready artifact records every material branch as decided, deliberately
excluded, or explicitly delegated. Settled assumptions live with the item they
affect and name themselves as assumptions in that statement or reason. This
keeps them distinct from evidence-backed facts and confirmed intent. Compare
sibling items, reasons, and flow so each prose value contributes distinct
meaning. Use one decisive result for the title, one direct statement for the
goal, and the main consequence for a reason.

When visual directions contributed to the agreement, also follow **Preserve
the selection** in `design-directions.md`.

## Attach evidence

Give evidence that supports a specific claim a stable lowercase `id`. Write the
claim as the schema's cited-title or cited-prose object and name the IDs that
directly support it. Reuse an evidence item across supported claims. General
evidence can remain uncited in the evidence list.

When a design direction uses a source already in `evidence`, reference its ID
and add `influence`. A direct `label`, `url`, and `influence` reference serves a
source that has a distinct role from the evidence list.

The runtime requires unique evidence entries and unique sibling items. Shared
evidence IDs signal a useful review point while each claim keeps its own
meaning.

## Choose the artifact and input paths

Use the project's established location for durable decision, architecture, or
specification documents when one is clear; otherwise use `docs/alignments/`. Project
knowledge belongs in an ordinary project path.

Choose one stable, descriptive HTML path for one goal. Further implementation
attempts, branches, and pull requests continue the same artifact.

Write structured input to a temporary JSON file outside the repository. Pass
every adapter argument separately and remove the temporary input afterward.

Design-direction images use absolute paths to stable ordinary,
non-interlaced PNG files. Use two or three images, at most 512 KiB each and 1
MiB total. Each edge can reach 4,096 pixels and the image can reach 8
megapixels. Authored HTML, CSS, JavaScript, SVG, data URLs, and symbolic links
stay outside this input boundary.

## Run a command

Use the adapter selected in `SKILL.md` with one subcommand:

```text
create --input <draft.json> --output <artifact.html> [--root <repository>]
inspect --artifact <artifact.html>
revise --input <draft.json> --artifact <artifact.html> --expect <digest> [--root <repository>]
```

The adapter prints structured JSON. `create` and `revise` return the artifact
path, Align ID, current revision, and digest. `inspect` also returns the current
content and compact revision index.

## Create, inspect, and revise safely

`create` publishes at a new path. Before `revise`, use `inspect` to verify the
artifact, confirm that it still owns the same goal, and use its current digest.
An unknown, manually changed, identity-mismatched, or stale artifact stays in
place. The runtime also stops when repository or path identity changes during
publication.

A material change to the goal, shared understanding, exclusions, relevant
flow, or selected design direction creates one new revision in the same
artifact. Implementation results and AI-owned reversible technical choices
stay with implementation.

`inspect` keeps v1, v2, and v3 history readable. `revise` preserves those
revisions and appends the current shared understanding.

Treat the artifact as project documentation of the agreement at that time and
keep it after implementation. The person owns any later removal decision.

## Report or hand off

Report the artifact outcome—created, revised, retained, or skipped—and why. For
an existing artifact, report its absolute path and current revision. A skipped
artifact leaves the confirmed understanding in the active conversation.

Before another session or worker relies on the agreement, pass its explicit
path and revision and require the receiving session to inspect it.
