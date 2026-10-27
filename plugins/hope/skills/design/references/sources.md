# Design sources and primary standards

Read this index when a source matters to the current choice or when local
guidance needs more depth. These are references, not governing instructions or
required installations. Continue from local guidance and project evidence if
external access fails, and name a material knowledge gap.

The sources were inspected on 2026-09-12 at the pinned commits. Verify current
official APIs and standards before implementation or conformance claims. No
source establishes that a workflow produces better results across tasks or
models.

## Adapted sources

Hope's process references (`judgment.md`, `exploration.md`, `prototypes.md`,
`verification.md`, `continuity.md`) are rewritten syntheses of these sources,
reorganized around the person's goal and scope. Hope does not inherit their
fixed variant counts, one-look budgets, favorite policies, mandatory browser
handoffs, review loops, compulsory subagents, or automatic delegation when
tools fail.

| Source | License and notice | Informed |
| --- | --- | --- |
| [Jakub Krehel's skills](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills) | MIT; `../LICENSE.jakub` | Purposeful review, root-cause prioritization, reference interpretation, stress fixtures, comparisons around a useful axis |
| [Emil Kowalski's skills](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills) | MIT; `../LICENSE.emil` | Isolated working prototypes, motion review by observation, interaction polish |
| [Interface Design](https://github.com/Dammyjay93/interface-design/tree/2f9be3206855bcb2d1d0af262c8bae25cba6658d/.claude) | MIT; `../LICENSE.interface-design` | Domain and intent, system coherence, design memory, inconsistency and generic-composition review |
| [Impeccable](https://github.com/pbakaus/impeccable/tree/cb56ed6c19a07329a9fa0cd4e657bee040156593/plugin/skills/impeccable) | Apache-2.0; `../LICENSE.impeccable` (copyright Paul Bakaus) | Modes of purpose, composition and execution; audit, critique, and polish; extract and document existing systems |
| [Design Lab](https://github.com/0xdesign/design-plugin/tree/fcf1766208abe5581732375d5d0ec9049dcf28f2/design-and-refine/skills/design-lab) | No license found; methods described independently, no prose, code, or templates copied | Visual dialogue, comparable prototypes, element feedback, synthesis, continuity |

For the craft topics Hope no longer summarizes (layout, typography, color,
interaction states, accessibility, motion, responsive and native adaptation,
assets and performance), the same sources remain useful reading:
`better-layout`, `better-typography`, `better-colors`, `better-accessibility`,
`better-ui`, and `better-writing` under Jakub Krehel's skills; `animate`,
`animation-vocabulary`, `animate-expo`, and `apple-design` under Emil
Kowalski's; and `typeset`, `colorize`, `clarify`, `animate`, `optimize`,
`onboard`, `harden`, `adapt`, `ios`, and `android` under Impeccable. Treat their
example values and fixed rules as starting points, not gates.

## Primary standards

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA patterns](https://www.w3.org/WAI/ARIA/apg/), [contrast definitions](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and [target-size exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) govern their stated conformance criteria. Keep usability recommendations and APCA separate from those claims, and do not import a universal 44-pixel rule or a blanket disabled-text contrast rule as WCAG.
- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) contributed navigation, forms, truthful feedback, recovery, and performance checks. Vercel-specific preferences are not universal.
- [Google's DESIGN.md specification](https://github.com/google-labs-code/design.md/blob/9bf8eae67128b6cc55ad9bf86665767deb4c11cd/docs/spec.md) is an alpha interchange proposal, not automatic project authority. Use the established design record.

## Discovery

Brand, style, font, and platform catalogs such as the
[Awesome Design.md catalog](https://github.com/VoltAgent/awesome-design-md/tree/8147538b4226ae41e2487a9179e3bcc1f68e8554/design-md)
and the [UI/UX Pro Max data directory](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/7f69fed6a2717900085f1bc3b263721f8ba025e2/src/ui-ux-pro-max/data)
can help locate candidates. They are third-party observations, often of
marketing sites: they do not supply a product's interaction or state system,
exact computed values, proprietary fonts, or rights to assets, and a catalog
accent can still fail text contrast. Verify the actual reference when fidelity
matters, and do not claim to have checked a catalog you could not open.
[UI Skills](https://www.ui-skills.com/), [Minimal Gallery](https://minimal.gallery/),
and [Awwwards](https://www.awwwards.com/) help locate examples; inspect the
actual surface before inferring behavior.

Project-specific CJK composition and input, time-zone meaning, preview
ownership, feedback delivery, and the Align handoff are Hope's additions, not
attributed to a single upstream rule.
