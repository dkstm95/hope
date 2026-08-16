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

Ask the person to select an option or explicitly delegate the choice. Do not
finish alignment while that material choice remains open.

## Handle unavailable visuals

If a needed image capability is unavailable, fails, or cannot present the
result to the person, explain the missing result. Do not ask the person to
select an unseen option or silently replace the visual comparison with prose.

Continue without images only after the person explicitly waives the visual
review. Record the reason and waiver in the agreement.

## Preserve the selection

When visual directions were used, include their local image paths, descriptions,
references, recommendation, and selection in the structured Align input. Use
absolute paths to ordinary non-interlaced PNG files that meet the limits in
`artifact.md`. For every material outside reference, record a short explanation
of how it influenced the option.
