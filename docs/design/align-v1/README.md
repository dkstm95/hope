# Align visual baseline v1

`reference.png` records the approved starting composition for the first Align
HTML artifact.

It shows the wide light layout and the narrow dark layout in one image. The
Align renderer should preserve its information order, density, typography,
dividers, behavior flow, navigation, intent history, and light/dark treatment.

The current contract in `docs/design.md` also owns refinements made after that
composition: uniform product-bar spacing, row-aligned behavior connectors,
numbered decisions, history only in secondary navigation, and a narrow-screen
navigation panel.

The editable code values live in
`plugins/hope/skills/align/scripts/design/tokens.mjs`. Align owns those values.
Diff does not define or constrain this baseline.
