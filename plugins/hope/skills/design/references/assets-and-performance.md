# Assets and perceived performance

## Make the subject present

Use photography, illustration, texture, diagrams, or product imagery when they
carry information or the chosen direction. Inspect existing assets first. An
empty box, generic icon tile, or gradient is not an adequate substitute for a
specific subject the person selected.

Specify an asset's job, crop, aspect ratio, focal point, intended size, background,
and relationship to text. Use the available image tool for raster creation or
editing; extend an existing vector/icon system with its native tools. Keep real
UI text and controls semantic. For a selected comp, produce suitable assets
rather than shipping a low-resolution crop with neighboring UI baked into it.

Inspect cutouts on light and dark surfaces for actual alpha, edge quality,
white foreground preservation, and holes. Inspect textures for seams and image
placement for accidental cropping. Keep logos proportionate with their needed
clear space; verify readability at the actual output size. A source's open
documentation license does not provide every pictured asset or proprietary font.

Record origin and meaningful generation/edit instructions with the artifact
or in the project's existing asset record. Do not force an embedded-prompt
format, separate database, or duplicate asset registry. Never present generated
people, product imagery, testimonials, or metrics as verified evidence. Preserve
real claims and label illustrative data where it could otherwise mislead.

Keep a coherent family across thumbnails, photography, illustration, and icons.
Personality should suit the product and emotional moment; recovery from data
loss needs useful clarity, not a joke. Sound and haptics must respect the user's
controls and platform conventions.

## Keep the interface responsive

Reserve image geometry to prevent layout shift. Choose responsive sources and
appropriate formats, preload only critical assets, and defer offscreen media
without delaying the main content. Check broken and slow asset loads. Meaningful
video needs controls and accessible alternatives; decorative loops must not
exhaust the user or run unnecessarily when hidden.

Choose font files for actual scripts and styles. Check fallback metrics,
invisible text, and layout changes as fonts load. Avoid downloading a large
catalog or many unused weights into the product to support a design decision.

Measure the observed bottleneck. For slow typing, inspect work triggered by
keystrokes and rerenders. For animation, inspect main-thread work, layout,
painting, and compositing. Batch layout reads and writes rather than alternating
them per element. Virtualize large lists when measurement warrants it and retain
selection, focus, and access to data. Do not apply arbitrary item-count cutoffs
or memoization everywhere.

Reuse the project's component and library ecosystem. Prefer a native or proven
primitive over a custom inaccessible control; do not replace an installed library
just because a source author favors another. Consult current API documentation
for the chosen version. Specialized references for notifications, command menus,
OTP, motion, drag/drop, syntax highlighting, and live charts are in `sources.md`.

Distinguish actual latency from feedback timing. Show acknowledgement promptly,
avoid misleading progress and gratuitous waiting, and preserve a recoverable
state when work fails. Test under relevant network/CPU constraints and devices
when available; disclose simulated conditions. A visually complete mockup is
not a benchmark of production network or native-device performance.
