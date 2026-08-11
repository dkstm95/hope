# Diff analysis rules

Use these rules with the analysis schema and the shared Hope Write standard.

## Evidence and identity

- Copy `runId`, the latest `snapshotDigest`, and `locale` from Hope.
- Cite only source IDs and line ranges delivered by inspection.
- Keep each claim no broader than its evidence. Split claims whose parts rest
  on code, stated intent, or inference differently.
- Use the smallest supporting excerpt and no more than 24 lines in one
  evidence reference.
- Test code establishes an expected condition, not that the test ran or that a
  wider integration behavior succeeded.
- Do not invent execution or CI results.
- Compare pull-request and commit claims with the changed-file map and code. A
  material stale or contradictory claim belongs in a review item.
- Keep provider titles, code, paths, commands, and excerpts exact in source and
  evidence fields. Refer to them plainly in generated prose.

## Explanation

- Keep `coreChange.before`, `coreChange.after`, and `coreChange.why` short
  enough for the first screen.
- Start `coreChange.details` with purpose, previous and new behavior, affected
  people or systems, and the important result.
- Put implementation sequences, functions, types, inheritance, and
  file-by-file mechanics in `codeSteps`, not in place of the main explanation.
- Use `behavior` only when a flow, condition, state change, comparison, or
  small experiment helps the reader predict an outcome. Do not duplicate
  `codeSteps`.
- When runtime behavior intentionally stays unchanged, explain the actual
  maintenance, development, build, documentation, dependency, or test effect.
  Do not invent a runtime change.
- Give each included file exactly one `explained`, `supporting`, or
  `mechanical` disposition.

## Context and limits

- Add `contextChecks` only for concrete categories that mattered. Mark each
  `checked`, `not-applicable`, or `limited`.
- A checked category needs a grounded basis and evidence whose role matches
  it. Pull-request prose can establish stated intent; collected code is needed
  for code behavior.
- Use `unknown` without evidence for an unchecked limited or not-applicable
  category.
- Do not use vague categories such as the whole repository or ecosystem.
- Give every reported limit one concrete impact and link it from a limited
  context check. Name the exact caller, state path, setting, test, or question
  left unknown and state whether that omission materially limits a main
  explanation or judgment.
- Not reading the whole repository is not itself a material limit.

## Review items

- Choose the kind by the next action: `resolve` for a concrete change,
  `decide` for a requirement or trade-off choice, and `verify` for evidence
  needed to close uncertainty.
- Set importance by the harm of ignoring the item. High covers security,
  privacy, data, recovery, broad, core, or main-goal harm. Medium is real but
  limited or recoverable. Low is local and does not affect the core result.
- Omit taste-only style comments.
- Give every item a basis that matches its evidence.
- When an item closes a known scope limit, add its ID to `limitIds` and put the
  action in the item instead of repeating the limit.
- For a `verify` item, make `doneWhen` close the exact uncertainty. A component
  test cannot prove a wider end-to-end, migration, hang, or security property
  that it does not exercise.
- Do not advise approval or rejection.

## Prose and focus

- Follow the shared Hope Write standard for every user-facing field. Preserve
  evidence, uncertainty, exact-source constraints, and the resolved locale
  when simpler wording would change meaning.
- Write generated prose in the resolved locale as plain text. Hope does not
  parse Markdown or HTML, and validation rejects backticks.
- Never put internal IDs such as `source-7`, `file-2`, or `limit-1` in
  user-facing prose. Use the recognizable file, component, behavior, or limit
  name instead.
- Keep one idea in one primary field. Reuse the smallest exact evidence range
  only when another field genuinely needs it.
- Normally use at most 12 review items, 6 core details, and 12 code steps. Do
  not fill maxima for their own sake.

## Teaching-aid decisions

Record one decision for each of `visual`, `microworld`, and `quiz`.

For each aid:

1. Identify the distinct teaching job from the task and evidence. A sequence,
   identifier, or technical term in the source does not create a teaching job
   by itself.
2. Use `not-applicable` when the aid has no distinct teaching job. One aid may
   be useful while another remains not applicable.
3. Use `omitted` when the aid has a distinct teaching job, but prose or another
   selected aid already performs it clearly.
4. Use `included` only when the aid still makes its distinct teaching job
   materially easier to understand.

Every decision needs a clear `reason`.

An included aid also needs a concise `teachingJob`.

Do not give two included aids the same teaching job.

Consider the aids in this order:

1. Use a microworld for a small, bounded input, condition, or state whose
   changes help the reader predict different outcomes.
2. Use a visual for a static flow, branch, interaction, or component
   relationship that prose alone makes hard to follow.
3. Use a quiz for one to five non-trivial predictions, preserved conditions,
   or failure cases that do not need an interactive model.

### Microworld

Use declarative explanation text only.

Do not put repository code, commands, expressions, URLs, or scripts in the
microworld.

Never claim that it ran repository code or produced a test result.

Choose one to three controls with two to four options each.

The complete set must have no more than 12 combinations.

Run `microworld-skeleton` as directed by the Skill and provide exactly one
grounded scenario for every returned combination.

### Visual

Choose the visual from the task's teaching job, not from every relationship in
the evidence.

- Use `component-map` for fixed components, responsibilities, calls, or
  handoffs when structure is the teaching job. A call alone does not make
  timing or order the teaching job.
- Use `decision-table` when comparing meaningful branches or conditions and
  their outcomes is the teaching job.
- Use `flow` when runtime data movement or control flow is the teaching job.
- Use `sequence` only when time order or ordered messages between participants
  are themselves the teaching job.

Do not add a visual for a short relationship that the ordinary explanation
already makes clear.

Do not add one when the only deeper need is a concept definition handled by
the beginner primer.

For a presentation-only change with no flow, branch, component relationship,
interaction, state transition, or prediction to visualize, use
`not-applicable`.

Do not use `omitted` merely because ordinary Background already explains that
change.

Use concrete example values in a caption, detail, message label, or table cell
only when they make data movement or control flow easier to follow.

Ground each value in review evidence.

Mark a simplified or inferred value in the surrounding explanation.

Use the smallest set of values needed for the teaching job.

Record one underlying evidence value once.

Do not repeat it in cardinal, ordinal, or paraphrased form, or in another
visual field.

Code identifiers, component names, and prose step labels are not concrete
example values merely because they appear in evidence.

Do not invent values for a static relationship that has none.

### Quiz

Include one to five evidence-backed questions.

Test a non-trivial behavior, preserved condition, or failure case.

Do not test whether the reader memorized a name, path, or sentence from the
review.

## Beginner primer

Include a beginner primer only when the task requires a named concept or a
deeper starting point that ordinary Background cannot supply.

A request for a new reader does not by itself require one.

Omit the primer when Background, the main explanation, or a selected aid
already gives enough context.

Use `code` when an item paraphrases a mechanism directly established by code
evidence.

Plain language does not make that mechanism inferred.

Use `inferred` only when the item's material meaning goes beyond what its
evidence directly establishes.

Split direct behavior from a broader inferred definition when one basis cannot
accurately cover both.

## Resource limits

- Keep the full analysis within Hope's preflight limits: 128 KiB for both the
  JSON file and canonical serialization, 48 KiB of generated prose, 192
  evidence references, 96 unique evidence ranges, 1,200 unique evidence lines,
  96 KiB of unique excerpts, and 600 code-evidence line occurrences across
  distinct rendered ranges.
- Prefer a focused explanation over exhausting an allowance.
