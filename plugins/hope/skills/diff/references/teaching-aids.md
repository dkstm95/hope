# Diff teaching aids

Read this reference only after `analysis.md` identifies a distinct teaching job
for a visual, microworld, or quiz. Use the smallest aid that performs that job.

## Microworld

Use a microworld for a small, bounded input, condition, or state whose changes
help the reader predict different outcomes.

Use declarative explanation text only. Do not include repository code,
commands, expressions, URLs, or scripts, and never imply that the microworld
ran repository code or produced a test result.

Choose one to three controls with two to four options each and no more than 12
total combinations. Run `microworld-skeleton` as directed by `workflow.md` and
provide one grounded scenario for every returned combination.

Use `"after": "unchanged"` when the represented steps and outcome stay exactly
the same. Do not copy the `before` trace into `after`.

## Visual

Choose the visual by the teaching job:

- `component-map` for fixed components, responsibilities, calls, or handoffs;
- `decision-table` for meaningful conditions and outcomes;
- `flow` for runtime data movement or control flow; and
- `sequence` only when time order or ordered messages are the point.

Do not add a visual for a short relationship that prose already explains, for
a concept definition better handled by background or a primer, or for a
presentation-only change with no relationship, branch, interaction, state
transition, or prediction to show.

Use concrete example values only when they clarify data movement or control
flow. Ground each value, mark simplification or inference, and use the smallest
set needed. Record one underlying value once; do not repeat it in another form
or visual field. Identifiers and prose labels are not example values merely
because they appear in evidence.

## Quiz

Include one to five evidence-backed questions about a non-trivial behavior,
preserved condition, or failure case. Do not test memorization of a name, path,
or sentence from the review.
