<!-- Generated from docs/design.md. Do not edit. -->

# Hope design

This is the shared visual definition for files made by Hope.

A feature document owns its information and reading order.

This file owns the visual language used to present that information.

The first implementation is the Hope diff review.

Do not build a general component framework before a second Hope feature needs
the same component.

## Direction

Hope artifacts should feel:

- direct;
- compact;
- calm;
- easy to scan; and
- clearly divided without looking boxed in.

Use familiar words, short sentences, and one clear reading path.

Prefer useful content over decoration.

The source repository keeps reference images under `docs/design/baseline-v1/`.

They show the intended density and tone.

They are comparison material, not pixel-perfect specifications.

They do not ship in the runtime plugin.

`design/tokens.mjs` is the code source of truth for shared colors, type sizes,
spacing, and layout limits.

A renderer must read those tokens instead of copying their values.

## Layout

Use one linear document in every viewport.

On a wide screen:

- keep the main text at a readable width;
- place a compact table of contents beside it when space allows;
- keep the product bar compact and place the artifact title in the document;
- keep dense body text intentionally smaller than mobile text; and
- do not stretch paragraphs across a large monitor.

On a narrow screen:

- keep the same information order and status language;
- use one column;
- put a compact native collapsible table of contents in the product bar;
- do not give the closed table of contents its own body row or vertical gap;
- open its links in a bounded panel directly below the product bar;
- use larger body text and touch targets.

When the theme and contents controls appear together, give both a 44-pixel
control height, the same border role, and the same corner radius.

An icon-only control may be narrower, but it must not look like a smaller
control family.

The product bar owns repository and pull request identity.

The synopsis card header owns the artifact title, compact **Commit** label, and
capture time.

Do not repeat repository identity.

Do not add a persistent sentence that explains that an offline artifact does not
update itself.

A complex drawer is allowed only after its focus, keyboard, scroll, and deep
link behavior is tested.

### Align artifacts

Align uses one decision-centered reading path.

Show status once beside the artifact title.

Put the goal and next action in the same first-screen flow without nesting
complete bordered cards.

Use quiet section dividers for scope, expected behavior, preview, agreement,
uncertainty, and verifiable work.

Reserve a stronger boundary for the next action, an unanswered question, and
each preview viewport.

Wide and narrow preview frames must use the same canonical content and state.

The viewport changes layout only.

Keep the same semantic order and label every intentional difference.

Use the same theme icons, current-section contents marker, disclosure arrow,
deep-link reveal behavior, and print expansion as Diff.

Keep decorative disclosure arrows out of accessible names.

Offset fragment destinations below the sticky header and verify the final
focused position.

Keep Align disclosures to one level.

A disclosure summary carries the decision, group count, or user-visible work
change needed to decide whether to open it.

Do not use a generic **Details** label when the summary can name its content.

On narrow screens, show the narrow preview first and collapse the duplicate
wide preview.

Do not make a preview look simple by removing content that the final artifact
must show.

The representative preview fixture includes decisions, evidence, material
uncertainty, and verifiable work.

Responsive visual copies do not create duplicate document headings.

One canonical text representation carries the preview meaning for assistive
technology.

## Type

Use three clear roles.

| Role | Font |
| --- | --- |
| Body prose | Hope Sans Light, from Gmarket Sans |
| Wordmark, controls, labels, and headings | Hope Sans Medium or Bold |
| Code, commands, paths, and hashes | Hope Code, from D2Coding |

Embed the fixed WOFF2 files in every offline artifact.

Use a local sans-serif or monospace fallback only for characters that the
bundled fonts do not contain.

Do not synthesize a missing font weight.

Hope presents the converted files under Hope-owned family names because both
source licenses reserve their original family names.

Keep their source hashes, build commands, and licenses in `design/fonts/`.

Start with this compact scale and adjust it only through named tokens:

| Use | Wide screen | Narrow screen |
| --- | --- | --- |
| Main body | 14px / 1.55 | 16px / 1.55 |
| Supporting text | 12px / 1.5 | 14px / 1.5 |
| Code | 13px / 1.55 | 14px / 1.55 |
| Page title | 24px / 1.25 | 28px / 1.25 |
| Section title | 18px / 1.35 | 20px / 1.35 |

Keep prose near 60–80 characters per line.

Long paths and code may scroll inside their own region.

Text-bearing controls use a minimum height and grow when text is enlarged.

They must not create page-level horizontal scrolling.

## Space and boundaries

Use a small, consistent spacing scale.

Do not invent a new gap for each component.

```text
4 · 8 · 12 · 16 · 24 · 32
```

Give each top-level section a clear start.

Use a heading, a cyan keyline, and measured space.

Number conditional sections in their rendered order so the document and its
table of contents agree.

Use one quiet divider at a section boundary instead of extending the cyan line
through the whole section.

Use two border roles:

- a quiet divider for document structure; and
- a stronger component border for controls, code, and separate task or state
  regions.

Do not draw a strong rule between every sentence or row.

Do not nest full component borders inside the first-screen summary.

Compact summary items use rows; their detailed versions may use cards later in
the document.

Use one quiet marker gutter to help the eye follow body content:

- ordinary paragraphs have no marker;
- two or more parallel claims use one small dot each;
- ordered behavior and code steps use `01`, `02`, `03`;
- a status dot, section number, disclosure arrow, or other existing marker is
  not paired with another generic bullet; and
- nested lists stop after one level and use a neutral marker inside.

Keep the first-screen review result especially compact.

Render each preview as a small kind marker, plain importance text, and title.

Do not add a representative status, total, or kind counts above the previews.

When no item exists, show one plain empty-result sentence.

Show concrete material scope limits without a generic scope badge.

Omit that synopsis row when no material limit exists.

Use the same label-and-value grid as the other synopsis rows.

Separate preview items with spacing, not rules.

Use semantic `ul` and `ol` elements for content that is a list.

Make the first-screen synopsis one self-contained component.

Put the pull request title, reviewed commit, and capture time in its header.

Do not place a second title block above it or show a generic **Summary** title
inside it.

Keep **Summary** as a quiet navigation and screen-reader heading so the document
heading order remains intact.

In each full review item, align kind, importance, and basis on one visual
centerline.

Keep kind and importance as outlined markers and basis as quieter plain text.

When a change has two to four brief behavior steps, show them as connected
cards: horizontal on a wide screen and vertical on a narrow screen.

Use the same text and order in both layouts.

Use a normal numbered list for five or more steps or when any step is longer
than 80 characters.

## Color and themes

Generate one artifact that supports light and dark themes.

The official light palette is `Sand Paper`: a warm near-white page with a
slightly brighter reading surface.

It should feel softer than pure white without looking beige or gray.

Exact Hope surface values live only in `design/tokens.mjs`.

Code is a separate visual surface.

Use GitHub Light Default inside code regions in light mode and GitHub Dark
Default inside code regions in dark mode.

A theme change switches both at once.

It does not replace the Hope palette outside code.

Highlight syntax during artifact generation with trusted, fixed grammars and
themes.

Insert repository text only as escaped token content.

If Hope does not support a file language, show its escaped source without
guessed highlighting.

The initial theme comes from the resolved Hope setting:

- `system`;
- `light`; or
- `dark`.

The theme control changes only the open document.

It does not write Hope settings or browser storage.

Reloading returns to the generated initial theme.

Print uses a light surface.

Use these status roles:

| Meaning | Color role |
| --- | --- |
| Resolve | Red |
| Decide | Amber |
| Verify | Blue |
| Scope | Neutral blue-gray |

Importance stays in text.

Never use color as the only status signal.

## Interaction

Every interaction must still leave useful content when JavaScript is disabled.

Use trusted, fixed scripts only.

Supported interactions can include:

- open or close evidence;
- move through the table of contents;
- switch the current document theme;
- try a safe declarative microworld;
- draft an optional quiz response without submitting or saving it; and
- reveal the quiz answer and evidence through a separate disclosure.

When a quiz response box has a clear placeholder, do not repeat a visible field
label such as **My answer** or **Selection**.

Keep an accessible name for assistive technology.

A response is never required before the answer can be opened.

Give repeated controls a unique accessible name by associating each one with its
question.

Print output omits the reader's transient quiz response.

It shows each question, answer, and supporting evidence regardless of the
current disclosure state.

The **Evidence and scope** section is a dense reference appendix.

Keep the whole section open initially so the available groups remain visible.

Its source groups, context checks, scope limits, checked-file group, and
artifact details must open independently and start closed.

Use native disclosure controls so they work without JavaScript.

Opening a fragment link must reveal every disclosure that contains its target.

Code markup must contain explicit line separators.

One source line must remain one visible line even without layout styles; long
lines scroll inside the code surface instead of merging with adjacent lines.

Do not make audit completeness look like repeated interface content.

Merge changed-file source metadata into the changed-file table, keep other
sources in a separate small table, and group exclusions with the same reason.

Keep the collapsed interface compact.

Expanded details must still account for every source, file, and limit.

Do not show a section-copy control while artifacts use temporary local paths.

Stable section IDs remain available for navigation.

Add copying only when Hope has a portable publication URL and can show visible
success feedback.

Do not add task completion, assignment, comments, or hidden persistence.

## Accessibility

Target WCAG 2.2 AA.

Every artifact needs:

- one `h1` and a valid heading order;
- landmarks and a skip link;
- visible keyboard focus;
- text labels for every status;
- sufficient contrast in both themes;
- reduced-motion and forced-colors support;
- useful content at 200% text zoom and 400% page zoom;
- a text alternative for every diagram or interactive explanation; and
- correct `lang`, `dir`, and bidirectional isolation for mixed content.

Keep mobile controls at least 44 by 44 CSS pixels.

On a narrow screen, keep status and control labels at 12px or larger.

Supporting labels and interactive summaries use the medium face.

Body prose keeps the light face.

Test the final file through `file://`, not only through a web server.

## Implementation boundary

Repository, provider, and model content is untrusted.

A feature renderer inserts it as text and never accepts authored HTML, CSS,
JavaScript, SVG, or URLs.

Shared design code may contain tokens, fixed assets, and small helpers.

The feature owns its concrete HTML.

Promote a feature component into shared code only after another Hope feature
needs the same behavior.
