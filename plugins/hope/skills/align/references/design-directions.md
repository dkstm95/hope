# Align design directions

Use this guidance only when a material visual intent branch cannot be settled
honestly through conversation and the person has not supplied an authoritative
visual direction.

The mockups are evidence for the interview. They do not preserve component
structure, frontend architecture, implementation tools, or other internal
solution design in the Align artifact.

## Decide whether a visual probe is needed

Use a visual probe when a new screen, component, layout, or style choice could
materially change the intended experience and the person needs to react to an
image to decide it.

Do not create mockups for a small correction, a behavior-only change, or an
accessibility fix without a material visual choice. Do not replace a
person-provided mockup, design system, or other settled visual authority with AI
preferences.

## Ground the probe

Inspect the project's existing screens, design rules, components, and brand
assets first. Research outside references only when that evidence does not give
enough direction and a research capability is available.

If outside grounding is needed but unavailable, name the missing evidence. Ask
the person to supply a reference, choose to continue from project evidence, or
leave the visual direction outside this task. Do not call an ungrounded option
researched.

Treat outside work as inspiration rather than authority. Record each reference
that materially influenced an option and explain the influence without copying
another product's distinctive design.

## Create and compare

Use a suitable available capability to make two readable, meaningfully
different image mockups. Add a third only when it contributes another material
direction. Keep mockup work outside product files; it explores the agreement
and does not implement the product UI.

Show every option in one response when the host can present images. For each
option, state its main idea, strengths, trade-offs, and material references.
Mark the recommendation as an AI proposal and explain why it best fits the
known goal and constraints.

Keep each option summary to one brief main idea. Put supporting detail in that
option's strengths, trade-offs, and references. Keep each strength and trade-off
to one brief, comparable point.

Ask the person to select an option or explicitly delegate the choice. Feed the
decision back into the intent tree and recompute the frontier. Do not finish
alignment while the branch remains open.

## Handle an unavailable probe

If the needed capability is unavailable, fails, or cannot present the result,
explain the missing evidence. Do not ask the person to select an unseen option
or replace the comparison silently with prose.

Continue without mockups only after the person decides the resulting intent
boundary: use an existing visual authority, delegate the choice, or exclude a
new visual direction from this task. Preserve that resulting decision, not a
process waiver.

## Preserve the selection

Only when the confirmed agreement needs an artifact, review the conversation
evidence for every direction shown, the recommendation, and the selected option.
In `designDirections`, include each direction's local image path, description,
and material references, along with the recommendation and selection. Do not
record a design-direction image only as general evidence. Use absolute paths to
ordinary non-interlaced PNG files that meet the limits in `artifact.md`.

For every material outside reference, record a short explanation of how it
influenced the option. After publication, inspect the artifact and verify that
every shown direction, the recommendation, and the selection match the
conversation. Resolve a missing or rejected image instead of silently omitting
the visual agreement.
