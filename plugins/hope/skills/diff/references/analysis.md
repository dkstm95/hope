# Diff analysis rules

Use these rules with the complete analysis schema and the shared Hope Write
standard.

## Work the understanding frontier

Start with the material claims and questions needed to explain or judge the
change: its observable core before and after, purpose and significance,
changed-file accounting, and any material risk or uncertainty.

The understanding frontier is the unresolved subset whose prerequisites have been
read. Close a claim with the smallest captured evidence that proves it.
Close a question with evidence, an explicit material limit, or a verification
item that names what would resolve it. New evidence may split or reopen a claim.

Collect context only when it advances this frontier. Do not add a branch because
information is merely available, and do not use the analysis schema as a
thinking checklist. It serializes the review after the reasoning is complete.

The frontier is closed when the core before and after are grounded, every
changed line belongs to a supported group, every material finding is grounded, and every remaining material uncertainty is an explicit limit or
verification item. Do not author the final analysis while a material frontier
item remains unresolved.

## Ground every claim

- Copy `runId`, the latest `snapshotDigest`, and `locale` from Hope.
- Cite only source IDs and line numbers that appear in the bundle.
- Keep a claim no broader than its evidence. Split parts supported by code,
  stated intent, or inference differently.
- Select the smallest continuous interval that proves a claim. Hope preserves
  an authored interval of up to 96 lines and splits it into rendered references
  of at most 24 lines; do not partition one interval by hand.
- Treat a test as evidence of an expected condition, not proof that it ran or
  that wider integration behavior succeeded. Never invent execution or CI
  results.
- Compare pull-request and commit claims with the changed-file map and code.
  Report a material contradiction as a review item.
- Keep provider titles, code, paths, commands, and excerpts exact in source
  fields. Refer to them plainly in generated prose.

## Explain the change

Write `title` as one short, direct observable result in the review locale.
Ground it in the same changed-code range as `coreChange`; do not copy the pull-
request or commit title, lead with an identifier, or introduce separate
evidence.

Let the visible explanation answer: what changed, why it matters, how old and
new behavior differ, when the outcome changes, what the review found, and how
it knows.

Give the engineer a working model they can use to recognize consequences and
form follow-up questions, decisions, or work ideas. Reserve review items for
material actions grounded in the captured change.

- State `purpose` as the goal, without an “aims to” wrapper. Use `stated`,
  `inferred`, or `unknown`; code is not itself a purpose statement.
- Ground both `coreChange.before` and `coreChange.after` in changed-file code.
  Pull-request or commit prose may explain why, but cannot establish either
  code state.
- Give `before`, `after`, and `why` one main idea each. Start with the affected
  actor or thing and state the practical result.
- Use zero or one `background` item for context a new reader needs before the
  comparison.
- Keep the overall explanation understandable without code identifiers. Put
  implementation reasons beside their code in `groups`.
- Use one to four `coreChange.details` for distinct observable outcomes or
  preserved conditions. Do not turn them into a file or identifier inventory.
- Connect every material behavior-bearing changed surface to a visible claim,
  review item, material limit, or a group explanation. A group's kind records
  the role of its code but does not account for a distinct behavior by itself.
- Use `behavior` only when a flow, condition, state, comparison, or small
  experiment helps the reader predict an outcome. Do not repeat the groups.
- Let `behavior.summary` introduce the distinct condition, state, or
  relationship that makes the model useful. Keep it distinct from
  `coreChange.details`.
- When runtime behavior is unchanged, explain the real maintenance, build,
  documentation, dependency, development, or test effect.

## Organize all changed code by meaning

Author `groups` in the same analysis as the overall explanation. Choose the
units and reading order by shared purpose: one group may combine implementation
and tests across files, or use only part of one file. A small PR can need only
one group. Do not mechanically create one group per file or line, and do not
repeat the overview in every group.

Each group has a stable `g-...` ID, a `kind`, a short `title`, and `text` that
leads with why the change exists, then explains the relevant before/after
difference. Use `explained` for code that carries the change's behavior or
judgment, `supporting` for tests, types, configuration, or documentation that
serve it, and `mechanical` for renames, formatting, generated output, or moves
with no judgment of their own. The changed-file table shows each file as the
strongest kind among groups that own any of its lines.
Choose the needed depth; there is no target number of groups or sentences.
For each material change, connect the previous behavior and its triggering
condition to the new mechanism and observable result. Explain why the check,
state, or operation belongs at that point in the code. Describe consequential
boundaries, preserved behavior, and limits beside the code they qualify; a
separate review item does not replace that explanation. For changed tests,
connect the input and assertion to the behavior they establish, distinguishing
test intent from observed execution. Keep mechanical edits brief and do not
invent a motive or missing implementation detail to fill a template.

Use distinct paragraphs for distinct ideas. Split a group when its parts need
different explanations; use a part's `note` for local mechanics or test meaning
that would interrupt the group's main explanation. Check whether a reader can
explain why the changed lines produce the stated result and recognize an
important boundary case. A paraphrase of the diff or overview is insufficient.

Distinguish `stated`, `inferred`, and `unknown`. A stated reason needs captured
pull-request or commit prose; it may also cite code that shows its implementation.
Code alone cannot establish stated intent. For unavailable content, explain
the visible metadata and the limit without claiming to have read its body.

Use `parts` in reading order. Each part names a captured `fileId`. Omit both
`startLine` and `endLine` for the whole file; otherwise use an inclusive range
of lines in that file's captured **patch source**, including its hunk headers.
These are the bundle's `sourceId:lineNumber` coordinates, not old/new code line
numbers. An
optional `note` adds context specific to that part when code is selected.

Assign every changed line and every non-text file entry exactly once. Shared
code belongs to one group and can be cited by others. The runtime preserves
remaining context beside the nearest change, original file paths, and exact
before/after line numbers. It rejects overlaps, gaps, and context-only parts.
Group titles start collapsed; selecting a title or code shows the right-hand
explanation. No separate analysis pass or reader payload is needed.

## Account for limits

Give every captured limit one `limitImpacts` entry with a concrete impact. Name
what remains unknown and whether it limits a main explanation or judgment. Mark
it `material` only when it does. Not reading the whole repository is not a
material limit by itself; collect context instead when a specific unchanged
file would close the question.

Diff does not run CI, tests, builds, or lint. Treat that as material only when a
main claim depends on execution that static evidence cannot establish. Then add
one linked `verify` item stating what evidence would close the uncertainty.

## Report actionable review items

- Use `resolve` for a concrete change, `decide` for a requirement or trade-off,
  and `verify` for missing evidence.
- Set importance by the harm of ignoring the item: high for security, privacy,
  data, recovery, broad, core, or main-goal harm; medium for real but limited or
  recoverable harm; low for local non-core harm.
- Omit taste-only comments and never advise approval or rejection.
- Match each item's basis to its evidence.
- When an item closes a known limit, link the limit and put the action only in
  the item.
- Make `doneWhen` close the exact uncertainty. Do not claim that a narrow test
  proves a wider end-to-end, migration, hang, or security property.

## Keep prose focused

Write user-facing fields in the resolved locale as plain text. Hope does not
parse Markdown or HTML, and validation rejects backticks. Keep internal IDs out
of visible prose.

Put one idea in one primary field. Before validation, compare siblings that
share evidence or strongly overlapping ranges. Shared support signals a
redundancy check but does not prove duplication. Consolidate repeated meaning
without removing evidence needed by a distinct claim.

Keep each prose value to one semantic paragraph unless a real paragraph
boundary is needed. Normally use at most 12 review items and four core details;
do not fill maxima for their own sake.

## Use teaching aids when useful

Include a visual, microworld, or quiz only when it makes a distinct part of the
change easier to understand than the existing explanation. Let the task
determine the choice; omit unused aids without recording a decision or reason.
Read `teaching-aids.md` when authoring an aid for its supported formats and
evidence requirements.

## Stay within the analysis budget

The schema and preflight own the exact size and evidence limits. Prefer a
focused explanation over exhausting them. Reuse an exact smallest interval
that already proves the same mechanism, and normally keep a range to 4–12
lines.

Target at most 480 rendered code-evidence line occurrences so validation
repairs have room. If validation reports an overage, use its field
contributions, largest ranges, and overlap list to remove the largest
repetition first.

The complete grouped diff does not consume the citation excerpt budget. That
budget bounds supporting excerpts, not the code the reader can inspect.
