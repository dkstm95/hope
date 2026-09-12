# Accessible interaction

## Preserve the control's contract

Use native buttons, links, labels, forms, tables, headings, and landmarks where
they fit. A custom role promises keyboard and assistive-technology behavior,
not just a name. Prefer a proven project primitive for complex widgets and
consult the applicable WAI-ARIA pattern when implementing one.

Keep all relevant actions keyboard-operable in a logical order. Composite
widgets such as tabs, menus, and listboxes need their expected arrow-key model;
do not make every nested item an arbitrary Tab stop. Avoid positive tabindex.
Do not capture typing, composition, or browser shortcuts for a preview picker.

Focus must be visible and not hidden under fixed headers, footers, or overlays.
Preserve the native indicator or verify a custom one against adjacent surfaces,
including forced colors. A brand color or currentColor does not automatically
pass. Keep focus when appropriate; move it deliberately for a new view or
blocking dialog and restore it to a sensible location on dismissal. Dismiss
the topmost relevant overlay without closing unrelated layers.

Choose initial dialog focus for its content and consequences. A destructive
confirmation should not make the dangerous action the accidental default.
Native dialog behavior or a tested primitive is preferable to a hand-built
overlay that leaves the background interactive. Test the actual implementation.

## Names, structure, and updates

Every control needs a meaningful accessible name. Persistent visible form
labels help everyone; an icon-only action still needs a name. Hide duplicated
decoration rather than exposing every visual layer to the accessibility tree.
Never place a focusable element under aria-hidden.

Use headers and associations for structured data. A visible layout can omit
redundant metadata labels without discarding their meaning. Charts need an
accessible summary or data representation, and color needs supporting text,
shape, position, or pattern where it conveys meaning.

Choose how a change is communicated. If focus moves to it, avoid a duplicate
announcement. Associate field help and errors with their controls. Use polite
status updates for nonurgent async results; interrupt only for genuinely urgent
information. Keep repeated live regions stable and avoid announcing every
streaming token or hover. Test actual screen-reader behavior where it matters;
an accessibility-tree inspection alone is not such a test.

Alt text follows purpose: empty for redundant decoration, meaningful for
informative content, action-oriented for a functional image. Complex visuals
may need nearby detail or data. Media with meaningful speech or sound needs
appropriate captions/transcripts and operable controls.

## Space, motion, and alternate input

Separate visible size from hit area and prevent overlapping targets. Use the
platform's units and requirements. WCAG 2.2 AA's 24 CSS-pixel target criterion
has exceptions; larger touch targets are usability guidance, not a reason to
misreport every dense desktop control as nonconforming. Verify applicable
criteria with W3C instead of importing a universal 44px rule.

Test text enlargement and reflow. Let text-bearing containers grow; retain
browser zoom. Genuinely two-dimensional data may scroll in its own container
while surrounding controls remain usable. Check zoom and text spacing as well
as ordinary viewport resizing.

Respect reduced-motion and contrast preferences. Keep meaningful feedback when
removing large spatial movement. Moving or timed content needs appropriate
control; important information must not disappear on an inaccessible timer.
Provide button/keyboard alternatives for dragging or gestures when the gesture
is not essential. Decorative layers must not intercept interaction.

Do not equate a clean automated scan with conformance. State the target, tests,
and limits. Read `adaptation.md` for native platform and localization behavior.

Primary references: [WAI-ARIA patterns](https://www.w3.org/WAI/ARIA/apg/),
[WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Design source influences are recorded in `sources.md`.
