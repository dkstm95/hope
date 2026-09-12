# Visual system

## Layout and density

Group related items more tightly than separate jobs. Use shared edges and
baselines; check optical alignment of asymmetrical icons and text rather than
trusting bounding boxes alone. Let content and frequency determine density by
region. A spacious header over a dense work area can waste the user's viewport;
a uniform dense grid can erase hierarchy. Compare with real content.

Use intrinsic sizing, flex/grid, wrapping, and content-driven breakpoints before
measuring layout in JavaScript. Give text containers room to grow. Keep controls
reachable near their effects and safe from viewport edges. Reveal clipped or
scrollable content with a useful affordance. Inspect overlays against overflow
ancestors and stacking contexts; dialogs or popovers may need the top layer or
a portal rather than ever-larger z-index values.

## Typography and font delivery

Start from the existing type system. Choose fonts for language coverage,
legibility, role, character, and available weights. A single well-tuned family
often serves a product; contrasting display/body faces can support an expressive
surface. Do not add fonts just to make the work look designed.

Make hierarchy with weight, color, position, and spacing as well as size.
Data, metadata, controls, prose, and display text need different treatment.
Tune line height and measure to the actual script, face, size, and reading task;
an English character-count target is not a universal Korean or table rule.
Test real headings at intermediate widths before forcing line breaks.

Use tabular digits for changing values and aligned comparisons when the font
supports them. Keep identifiers distinguishable and copyable. Allow long URLs
and identifiers to wrap or scroll in their own region. If truncation hides
meaningful content, provide an accessible way to obtain the complete value;
a hover-only tooltip is insufficient on touch or keyboard-only paths.

Load the styles and weights actually used, with a fallback that covers the
required scripts. Check font-load failure and layout shift. Variable files help
when their axes or weight range are used; static files can be cheaper for a few
faces. Prefer standard weight/width/optical-size properties where supported;
use custom axis and OpenType tags only after checking the font's documentation.
Keep fallback emphasis working instead of disabling synthesis globally.

Keep useful text selectable. Use the page's language and direction and isolate
mixed-direction identifiers where needed. Preserve code punctuation and product
facts while adjusting presentation. Source fonts and their licenses before
depending on a proprietary face; a brand analysis does not supply its font.

## Color, themes, and contrast

Use existing tokens and notation. Distinguish raw colors from semantic roles:
text, surface, border, action, selection, and status. Add a component token only
when it solves real reuse or variation. Stable roles allow themes to change
without changing meaning. Do not impose a new token taxonomy on a small fix.

When creating a palette, establish where a supplied brand color belongs and
whether its exact value is fixed. Build perceptually useful steps, check their
separation, and keep equivalent roles coherent across hues. Use a color library
for conversion or measurement when needed. Never silently change a fixed brand
color to make white button text work; a different role or foreground may solve it.

Measure the actual foreground/background pair, including opacity, inherited
surfaces, images, gradients, hover, focus, and disabled/selected states as
applicable. Use the project's stated accessibility target and consult current
W3C definitions for conformance. APCA may inform an additional perceptual check;
it is not a replacement certificate for WCAG. Re-measure after a change.

Dark mode needs intentional surface separation and saturation, not an inverted
light palette. Use one coherent mechanism for system preference and any user
override. Test initial loading and native controls; set appropriate color-scheme.
Retain visible focus and controls in forced colors. Color can reinforce status,
but should not be its only signal. Accent usage follows the job, not a fixed
percentage or a universal one-button rule.

## Surfaces, imagery, and icons

Choose a coherent depth language. Use boundaries to clarify structure and
shadows or tonal steps where elevation means something. Avoid wrapping every
group in another card. Derive nested radii from visible insets rather than
assigning the same radius everywhere. Inspect contrast and edges on both themes.

Match icon style and weight to neighboring text, render at its intended size,
and preserve recognizable states. Prefer the existing icon family or native
symbols. Mirror directional meaning in RTL where appropriate, not logos,
digits, or every icon indiscriminately. Keep decoration out of the hit path.
Treat image crop, ratio, resolution, focal subject, and edge treatment as part
of the composition. Read `assets-and-performance.md` for production and loading.

Sources: `sources.md` (Jakub layout, typography, colors, UI; Interface Design;
Impeccable). Values in source examples are starting points, not universal gates.
