# Adaptation and specialist surfaces

## Responsive work

Let content determine where a composition stops working. Test intermediate
widths, not only desktop and phone endpoints. Decide what changes structurally:
sidebar to drawer, columns to sequence, table scrolling or alternate summary,
inline details to a dedicated view. Preserve essential information and task
continuity; do not hide features simply to fit a narrow screenshot.

Screen width is not input method. Consider touch targets, hover availability,
keyboard, pointer precision, orientation, safe areas, and the on-screen keyboard.
Ensure sticky controls and overlays leave the active content and focus visible.
Responsive images may need a different crop as well as a smaller file.

## Language and content

Use the intended language in realistic prototypes. Test short, typical, long,
missing, and mixed-script values. A Latin-only font or a hard-coded heading
break can silently change the result in Korean. Preserve complete identifiers,
units, names, and meaningful labels even when compacting a layout.

Use locale-aware dates, times, numbers, and pluralization. Account for time zone
meaning rather than merely reformatting a date. Use logical properties and the
correct language/direction metadata. Isolate mixed-direction values; mirror
directional controls selectively. Test keyboard shortcuts for the actual
platform/layout and composition input for CJK. Don't infer language from location.

## Native and desktop platforms

Follow the target platform's current conventions and the existing app. On iOS,
preserve navigation/back gestures, safe areas, Dynamic Type, semantic colors,
native controls, and accessibility settings. On Android, preserve system Back,
window/keyboard insets, scalable text, Material roles where used, and adaptation
between compact and expanded layouts. Do not confuse CSS pixels, points, dp,
and sp when assessing targets and text.

Cross-platform frameworks still ship into platform behavior. Use their supported
components, gesture/animation primitives, and accessibility APIs; don't pretend
a narrow web preview validates a native app. Capture native results from the
actual simulator, emulator, or device and name the evidence. If runtime access
is unavailable, deliver a design reference with that limitation rather than
claiming native verification. Restore any device settings changed for testing.

Desktop tools may need denser data, menus, resizable panes, shortcuts, and window
adaptation. Mobile conventions do not automatically govern these tasks. Keep
platform APIs in current official documentation; `sources.md` indexes the
relevant implementation families without maintaining a parallel SDK manual.

## Data, AI, and expressive surfaces

For dashboards, begin with the question the data answers. Use charts only when
their encoding helps; preserve units, scale, uncertainty, status, and accessible
data alternatives. Consider filtering, selection, drilldown, streaming updates,
and whether animation obscures changes. Apply Hope Diagram's public guidance
for the quantitative representation while keeping the product's visual system.

For maps, spatial editors, or 3D, distinguish essential spatial manipulation
from decoration. Give navigation and gesture alternatives where possible and
keep orientation, selection, loading, and fallback intelligible. Choose SVG,
canvas, or WebGL from the actual data, interaction, and performance needs.
The catalog's row-count thresholds are hints, not measurements of this app.

AI interfaces need understandable input, progress, cancellation, output state,
and recovery; see `interaction.md`. Do not add invented human identity, sources,
or success claims to make a mockup feel credible.

For landing pages, portfolios, pricing, editorial work, or brand experiences,
composition can be more expressive. Preserve meaningful content and evidence
through the full scroll, not just a hero. Keep ordinary navigation usable and
offer reduced-motion and low-capability paths for demanding effects.

Print, email, slides, and brand collateral have separate delivery constraints.
Carry over the chosen visual system and content relationships, then use the
available specialist tools for pagination, email compatibility, export, or
asset production. Do not expand a UI request into a whole brand package.

Sources: `sources.md` (Impeccable adapt/native/iOS/Android, Emil Expo/Apple,
UI/UX platform and specialist catalogs, Jakub typography and layout).
