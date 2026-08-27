# Diff analysis rules

Use these rules with the complete analysis schema and the shared Hope Write
standard.

## Work the review frontier

Start with the material claims and questions needed to explain or judge the
pull request: its observable core before and after, purpose and significance,
changed-file accounting, and any material risk or uncertainty.

The review frontier is the unresolved subset whose prerequisites have been
inspected. Close a claim with the smallest captured evidence that proves it.
Close a question with evidence, an explicit material limit, or a verification
item that names what would resolve it. New evidence may split or reopen a claim.

Collect context only when it advances this frontier. Do not add a branch because
information is merely available, and do not use the analysis schema as a
thinking checklist. It serializes the review after the reasoning is complete.

The frontier is closed when the core before and after are grounded, every
classifiable file has a supported disposition, every material finding is
grounded, and every remaining material uncertainty is an explicit limit or
verification item. Do not author the final analysis while a material frontier
item remains unresolved.

## Ground every claim

- Copy `runId`, the latest `snapshotDigest`, and `locale` from Hope.
- Cite only source IDs and line ranges delivered by inspection.
- Keep a claim no broader than its evidence. Split parts supported by code,
  stated intent, or inference differently.
- Select the smallest continuous interval that proves a claim. Hope preserves
  an authored interval of up to 96 lines and splits it into rendered references
  of at most 24 lines; do not partition one interval by hand.
- Treat a test as evidence of an expected condition, not proof that it ran or
  that wider integration behavior succeeded. Never invent execution or CI
  results.
- Compare provider claims with the changed-file map and code. Report a material
  contradiction as a review item.
- Keep provider titles, code, paths, commands, and excerpts exact in source
  fields. Refer to them plainly in generated prose.

## Explain the change

Write `title` as one short, direct observable result in the review locale.
Ground it in the same changed-code range as `coreChange`; do not copy the pull-
request title, lead with an identifier, or introduce separate evidence.

Let the visible explanation answer: what changed, why it matters, how old and
new behavior differ, when the outcome changes, what the review found, and how
it knows.

- State `purpose` as the goal, without an “aims to” wrapper. Use `stated`,
  `inferred`, or `unknown`; code is not itself a purpose statement.
- Ground both `coreChange.before` and `coreChange.after` in changed-file code.
  Pull-request prose may explain why, but cannot establish either code state.
- Give `before`, `after`, and `why` one main idea each. Start with the affected
  actor or thing and state the practical result.
- Use zero or one `background` item for context a new reader needs before the
  comparison.
- Keep the main path understandable without code identifiers. Put technical
  mechanics and implementation sequence in collapsed `codeSteps`.
- Use one to four `coreChange.details` for distinct observable outcomes or
  preserved conditions. Do not turn them into a file or identifier inventory.
- Use `behavior` only when a flow, condition, state, comparison, or small
  experiment helps the reader predict an outcome. Do not repeat `codeSteps`.
- When runtime behavior is unchanged, explain the real maintenance, build,
  documentation, dependency, development, or test effect.
- Give each included file exactly one `explained`, `supporting`, or `mechanical`
  disposition.

## Account for context and limits

Add `contextChecks` only for concrete categories that mattered. Mark each
`checked`, `not-applicable`, or `limited`.

A checked category needs evidence whose role matches the claim. Use `unknown`
without evidence for an unchecked limited or not-applicable category. Do not
use vague categories such as the whole repository or ecosystem.

Give every material limit one concrete impact and link it from a limited
context check. Name what remains unknown and whether it limits a main
explanation or judgment. Not reading the whole repository is not a material
limit by itself.

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
boundary is needed. Normally use at most 12 review items, four core details,
and 12 code steps; do not fill maxima for their own sake.

## Decide teaching aids

Consider teaching aids after the core review frontier is closed. Do not open an
aid branch during evidence inspection.

Record one decision for each `visual`, `microworld`, and `quiz`:

- `not-applicable` when it has no distinct teaching job;
- `omitted` when prose or another selected aid already does that job clearly;
  or
- `included` when it makes a distinct job materially easier to understand.

Give every decision a reason and every included aid a concise `teachingJob`.
Do not assign the same job to two included aids.

Consider a microworld for a bounded input or state whose changes help predict
outcomes, a visual for a static relationship or flow that prose makes hard to
follow, and a quiz for non-trivial predictions or preserved conditions that do
not need interaction.

If any aid has a distinct teaching job, read `teaching-aids.md` before deciding
whether to omit or include it and before authoring its content. If none has such
a job, mark all three not applicable without loading that reference.

## Add a beginner primer only when needed

Use a beginner primer only for a named concept or deeper starting point that
ordinary background cannot supply. A new-reader request alone does not require
one, and a selected aid may already do the job.

Use `code` when an item paraphrases a mechanism directly established by code.
Use `inferred` only when its material meaning goes beyond the evidence. Split
the two when one basis cannot accurately cover both.

## Stay within the analysis budget

The schema and preflight own the exact size and evidence limits. Prefer a
focused explanation over exhausting them. Reuse an exact smallest interval
that already proves the same mechanism, and normally keep a range to 4–12
lines.

Target at most 480 rendered code-evidence line occurrences so validation
repairs have room. If validation reports an overage, use its field
contributions, largest ranges, and overlap list to remove the largest
repetition first.
