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

For an included visual, read
`../../visualize/references/diagram-standard.md` before authoring it. Visualize
owns the selection and design standard. Diff still owns the evidence, teaching
job, artifact schema, and delivery. The artifact accepts only `component-map`,
`decision-table`, `flow`, or `sequence`; choose within those kinds and keep the
exact schema required by the Diff workflow.

Identifiers and prose labels are not example values merely because they appear
in evidence.

## Quiz

Include one to five evidence-backed questions about a non-trivial behavior,
preserved condition, or failure case. Do not test memorization of a name, path,
or sentence from the review.
