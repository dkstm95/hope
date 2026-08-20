# Align design directions

Use this guidance when a material UI choice remains open and the person has not
already supplied an authoritative visual direction.

## Decide whether visuals are needed

Create visual directions for a new screen or component, or for a layout or
style change whose appearance could materially change the result.

Do not create them for a small spacing correction, a behavior-only change, or
an accessibility fix that has no material visual choice. Do not replace a
person-provided mockup, design system, or other settled visual authority with AI
preferences.

## Ground the directions

Inspect the project's existing screens, design rules, components, and brand
assets first. Research outside references only when that evidence does not give
enough direction and a research capability is available.

If outside grounding is needed but research is unavailable or fails, name the
missing evidence and ask the person to supply a reference, continue from the
available project evidence, or pause. Do not silently treat an ungrounded
direction as researched.

Treat outside work as inspiration rather than authority. Record each reference
that materially influenced an option and explain the influence without copying
another product's distinctive design.

## Create and compare

Use a suitable available capability to make two readable, meaningfully
different image mockups. Add a third only when it contributes another material
direction. Do not present superficial color changes as separate directions.

Keep mockup work outside product files. The mockups explore the agreement; they
do not implement the product UI.

Show every option in one response when the host can present images. For each
option, state its main idea, strengths, trade-offs, and material references.
Mark the recommendation as an AI proposal and explain why it best fits the
known goal and constraints.

Keep each option summary to one brief main idea so the artifact can compare the
previews directly. Put the supporting detail in that option's strengths,
trade-offs, and references instead of extending the summary. Keep each strength
and trade-off to one brief point that can be compared with the same field in
the other options. Use references for longer supporting context.

Ask the person to select an option or explicitly delegate the choice. Do not
finish alignment while that material choice remains open.

## Handle unavailable visuals

If a needed image capability is unavailable, fails, or cannot present the
result to the person, explain the missing result. Do not ask the person to
select an unseen option or silently replace the visual comparison with prose.

Continue without images only after the person explicitly waives the visual
review. Record the reason and waiver in the agreement.

## Preserve the selection

Before writing the structured Align input, review the conversation evidence for
every direction shown, the recommendation, and the selected option. In
`designDirections`, include each direction's local image path, description, and
material references, along with the recommendation and selection. Do not record
a design-direction image only as general evidence. Use absolute paths to
ordinary non-interlaced PNG files that meet the limits in `artifact.md`. For
every material outside reference, record a short explanation of how it
influenced the option.

Do not report alignment complete until both conditions hold: the inspected
current content includes every direction shown, and its recommendation and
selection match those recorded in the conversation. If an image is missing or
fails the artifact boundary, resolve that problem instead of silently omitting
the visual agreement.
