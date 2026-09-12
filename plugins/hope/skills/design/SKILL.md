---
name: design
description: Design or refine interface mockups with people who describe goals and impressions rather than design terminology. Use for UI direction, visual references, alternatives, and design feedback, including visual choices within Align.
---

# Hope Design

Turn the person's purpose and impressions into a considered interface they can
see, try, and direct. Carry new screens, refinements, reference studies, or
comparisons through the requested result. Preserve settled choices, the parts
the person likes, and existing implementation authorization.

Read `../write/references/writing-standard.md` for language and
`references/judgment.md` for design judgment. Use the topic references below
when they affect the current work; do not read the whole library on every run.

## Establish what this work needs

Read the conversation, actual screens, representative code and content, design
rules, components, and assets. A coherent existing interface is a design system
even without a DESIGN.md. Distinguish a local refinement, a new surface inside
that system, and a requested redesign. Preserve the corresponding scope.

Understand who uses the screen, what they need to accomplish, and where it fits
in their work. Investigate what the environment can answer. Ask only unresolved
questions that change the result, in terms of actions and consequences rather
than CSS values or style names. Use visual evidence when words cannot settle
a visual choice. Follow existing decisions and delegation; a request to make a
mockup does not itself choose a material product trade-off.

An impression is a clue, not a prescription. For "cramped," inspect grouping,
density, reading width, and navigation effort before adding space. For "bland,"
inspect composition and emphasis before adding effects. Explain the likely
cause through the person's task. Read `references/exploration.md` when direction,
reference interpretation, or feedback needs work.

## Make the design inspectable

Develop and self-check a recommended direction before asking the person to do
design work. Compare alternatives when a meaningful choice remains: usually
two, with more only for a distinct consequential direction or an explicit
request. Do not manufacture alternatives for a settled or narrow correction.
Show differences through the same realistic content and comparable conditions.
Explain benefits and costs in everyday terms and identify the recommendation
as a proposal. Select only within existing delegation or the person's decision.

Use the medium that answers the question. Images can establish composition and
art direction; working UI can establish interaction, states, and adaptation.
Use both when necessary. Read `references/prototypes.md` to create, inspect,
present, and retain mockups. Use the host and project's existing tools; image
or browser unavailability is an evidence gap, never a choice or approval.

Before showing the result, check its purpose, hierarchy, content, and relevant
states in the rendered surface. Read `references/verification.md` for the
affected checks. Fix material defects within scope. A screenshot or automated
scan alone does not prove usability, interaction, or design quality.

## Refine without starting over

Connect feedback to the shown direction, region, and state. Accept ordinary
language, a pointed-out element, or an annotated image. Preserve what the person
accepted while changing the cause of the problem. When combining parts from
different options, reconcile their hierarchy, component language, and behavior.
Repeated rejection calls for a different diagnosis or comparison, not another
color swap. Do not require a fixed interview, variant count, or feedback round.

Finish when the requested scope has an inspectable result, material choices
are decided or delegated, relevant defects are resolved, and verification
limits are clear. Human preference belongs to the person; never report it as
AI-verified. Continue product implementation when it was requested and the
necessary choices are resolved. Otherwise hand off the design.

Return the result or its exact path and viewing instructions, the chosen
direction and reasons, material behavior and adaptation decisions, and what
was actually checked. Read `references/continuity.md` when choices must survive
this session or another screen or worker will rely on them.

## Work inside Align

This is the public handoff contract. Align supplies the goal, target, constraints,
settled choices, authority and delegation, and unresolved visual decisions.
Use those directly. Design owns the visual exploration, mockups, feedback, and
design evidence; Align owns the overall decision frontier and agreement.

Return the shown options and paths, recommendation and reasoning, the person's
selection or delegated choice, material reference influences, and verification
limits. Return newly discovered product choices to Align with their consequences;
do not start a second product interview or recursively invoke Align. Align owns
its artifact format and persistence. A direct Design request needs no separate
Align session or artifact merely to use this process.

## Load knowledge for the work

| When it matters | Read |
|---|---|
| Purpose, hierarchy, density, generic or overworked composition | `references/judgment.md` |
| Direction, ordinary-language feedback, references, expressive variation | `references/exploration.md` |
| Images, working prototypes, comparison and element feedback | `references/prototypes.md` |
| Layout, typography, fonts, color, themes, surfaces, icons | `references/visual-system.md` |
| Navigation, forms, asynchronous states, recovery, onboarding, UI copy | `references/interaction.md` |
| Keyboard, focus, semantics, screen readers, zoom, input alternatives | `references/accessibility.md` |
| Motion, gestures, haptics, timing, interruption, implementation recipes | `references/motion.md` |
| Responsive layouts, localization, native and specialist platforms | `references/adaptation.md` |
| Photography, illustration, textures, brand assets, performance | `references/assets-and-performance.md` |
| Rendered quality, stress cases, fidelity, regression, completion | `references/verification.md` |
| Existing systems, reusable decisions, artifact ownership and handoff | `references/continuity.md` |
| Additional depth, brand/style/font catalogs, library and platform sources | `references/sources.md` |

For explanatory diagrams and quantitative charts, also use the public
`../diagram/SKILL.md`; keep the current product's visual system. Specialized
image, document, or presentation work uses the available tools for that medium
under the same scope. Design does not require an external skill installation.
