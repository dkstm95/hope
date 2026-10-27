# Align record

Read this reference when inspecting, creating, or revising an Align record,
or after confirmed understanding needs a durable record. `SKILL.md` owns the
conversation and confirmation. This reference owns record timing, authoring,
revision judgment, and commands.

An Align record is one JSON file in the repository, such as
`docs/alignments/<slug>.json`. It holds the current understanding and a short
history of when it changed. Hope renders a self-contained HTML page beside it,
`<slug>.html`, for people to read. The JSON is the source of truth; git keeps
its earlier content and integrity.

## Inspect supplied evidence

When the person supplies a record or its HTML page, inspect the record. The page
names it in `<meta name="hope-align-record">`. Use its content as evidence and
follow `SKILL.md` to confirm new or changed understanding. Honor an unchanged
agreement and authorization already given in the conversation.

Retain the record when inspection verifies the same goal and the confirmed
understanding is unchanged. Revise it when material intent, decisions, exclusions,
flow, or visual selection changed. An uncertain goal or content keeps the
existing files in place and calls for a new record location from the person.

A page without a record beside it and with an embedded `hope-align-data`
script comes from Hope 8 or earlier. Run `migrate` on it before inspecting or
revising.

## Decide whether to preserve the understanding

After confirmation, create or revise a record when:

- the person asks for one;
- another session or worker will rely on the understanding;
- a material decision, assumption, exclusion, or delegation must survive the
  conversation; or
- later human observation or approval forms part of the agreement.

For other work, keep the understanding in the conversation.

## Author the current understanding

Read the complete `../scripts/align-input-v3.schema.json` before writing input.
`create` and `revise` accept that current input format. The record stores the
same content without `schemaVersion`, `locale`, `theme`, and `revisionSummary`;
`revisionSummary` becomes the new history entry.

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

A ready record holds every material branch as decided, deliberately
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

## Choose the record and input paths

Use the project's established location for durable decision, architecture, or
specification documents when one is clear; otherwise use `docs/alignments/`. Project
knowledge belongs in an ordinary project path.

Choose one stable, descriptive `.json` path inside the repository for one goal.
Further implementation attempts, branches, and pull requests continue the same
record. Commit the record, its HTML page, and its images together.

Write structured input to a temporary JSON file outside the repository. Pass
every adapter argument separately and remove the temporary input afterward.

Save design-direction images as PNG files inside the repository, for example
in `docs/alignments/<slug>/`, before `create` or `revise`. In input, an image
path is absolute or relative to the record; the record stores it relative to
the record file. Use two or three images, at most 512 KiB each and 1 MiB total.
Each edge can reach 4,096 pixels and the image can reach 8 megapixels. Hope
checks the PNG signature, dimensions, and sizes and embeds the images in the
HTML at render time. Authored HTML, CSS, JavaScript, SVG, data URLs, and images
outside the repository stay outside this input boundary.

## Run a command

Use the adapter selected in `SKILL.md` with one subcommand:

```text
create --input <draft.json> --output <record.json> [--root <repository>]
inspect --record <record.json>
revise --input <draft.json> --record <record.json> [--root <repository>]
render --record <record.json>
migrate --artifact <legacy.html>
```

The adapter prints structured JSON. `create`, `revise`, and `render` return the
record and HTML paths, Align ID, revision, and title. `inspect` also returns the
metadata, history, and current content.

## Create, inspect, revise, and render

`create` writes the record and its HTML page and refuses to replace either
file. Both stay inside the repository. Before `revise`, use `inspect` to
confirm that the record still owns the same goal. `revise` replaces the
content, appends one history entry from `revisionSummary`, and rewrites both
files. Git owns concurrent edits and earlier content.

A material change to the goal, shared understanding, exclusions, relevant
flow, or selected design direction creates one new revision in the same
record. Implementation results and AI-owned reversible technical choices
stay with implementation.

After someone edits the JSON by hand, run `render` to rebuild the HTML page.
`render` validates the record with the same rules as `create`. An
`alternateLocale` field with the other locale and a sibling `.html` file adds
a language link to the page.

`migrate` turns a Hope 8 page into a record beside it. It refuses a page whose
seal shows a change outside Hope. It keeps the Align ID and dates, turns every
earlier revision into a history entry, writes embedded images as PNG files
beside the record, and re-renders the page at the same path. The latest
revision becomes the current content; v1 and v2 fields without a current home
become intent items or exclusions, and items without a recorded judgment method
are judged by the person. The command reports where each field went. Review the
result before committing it.

Treat the record as project documentation of the agreement at that time and
keep it after implementation. The person owns any later removal decision.

## Report or hand off

Report the record outcome—created, revised, retained, or skipped—and why. For
an existing record, report its path and current revision. A skipped record
leaves the confirmed understanding in the active conversation.

Before another session or worker relies on the agreement, pass the record path
and revision and require the receiving session to inspect the record.
