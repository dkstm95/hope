<!-- Generated from docs/design.md. Do not edit. -->

# Hope design

This is the visual definition for the Hope Diff HTML artifact.

A feature document owns its information and reading order.

This file owns the visual language used to present that information.

Diff is the only Hope feature that currently creates a visual artifact.

Do not build a general component framework for a possible future artifact.

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

They are design sources and do not ship with the current runtime.

The Diff feature's `scripts/design/tokens.mjs` is the code source of truth for
colors, type sizes, spacing, and layout limits.

A renderer must read those tokens instead of copying their values.

## GUI widgets

Use the relevant group below whenever Hope introduces or changes that widget or
interaction.

A guideline does not create a reason to add a widget that Hope does not need.

When a matching widget exists, follow its guidelines unless a documented
product need, accessibility requirement, or platform convention calls for a
different choice.

The list preserves all 86 guidelines from Jakob Nielsen's [10 GUI Design
Elements Build Every User Interface](https://www.uxtigers.com/post/gui-widgets)
in Hope's language.

### Buttons

1. **GUI-01 — Pressable appearance.** Give a button a contained shape,
   sufficient contrast, and a visible pressed state.
2. **GUI-02 — Outcome label.** Start the label with a verb that names the
   result. Avoid generic labels such as **OK**; if 2–4 words cannot explain the
   result, reconsider the interaction.
3. **GUI-03 — One primary action.** Give each screen exactly one visually
   dominant primary action.
4. **GUI-04 — Reachable target.** Keep frequent actions large and nearby, and
   make a touch target at least 1 by 1 centimeter.
5. **GUI-05 — Prompt acknowledgment.** Show that a press was received within
   0.1 seconds.
6. **GUI-06 — Disabled guidance.** Keep a temporarily unavailable button
   visible but muted, and explain why it is unavailable and how to enable it.
7. **GUI-07 — Action semantics.** Use buttons for actions and links for
   navigation.
8. **GUI-08 — Task-end placement.** Put the button after the fields or content
   it completes, at the natural end of the task.

### Input fields and forms

1. **GUI-09 — Necessary fields.** Remove every field that is not required for
   the task.
2. **GUI-10 — Persistent labels.** Keep a visible label outside every field.
   Treat placeholder text as a hint, never as the label.
3. **GUI-11 — Flexible formats.** Accept reasonable input variations and
   normalize them in software.
4. **GUI-12 — Local recovery.** Put an error beside the field that caused it
   and preserve everything the person entered.
5. **GUI-13 — Task-specific controls.** Match the control to the data and task,
   such as a date picker for a date or a trash control for removal.
6. **GUI-14 — Single-column order.** Lay out a form in one column and group
   related fields so the reading order stays clear.
7. **GUI-15 — Submit outcome.** Name the submit button by the result instead of
   using a generic **Submit** label.
8. **GUI-16 — Validation timing.** Do not reject a value while the person is
   still typing; validate after they leave the field.

### Menus

1. **GUI-17 — User vocabulary.** Name categories in the person's language and
   verify the structure with card sorting and tree testing.
2. **GUI-18 — Click to open.** Prefer click over hover. If hover is necessary,
   add a short delay and tolerate diagonal movement toward a submenu.
3. **GUI-19 — Shallow hierarchy.** Limit cascading menus to two levels and
   restructure categories instead of adding more depth.
4. **GUI-20 — Visible desktop navigation.** Show top-level navigation on a
   desktop and reserve a compact menu for screens that lack the space.
5. **GUI-21 — Current location.** Mark the person's current location in the
   navigation.
6. **GUI-22 — Meaningful order.** Order items by importance and task frequency;
   alphabetize only when people know the exact name they seek.
7. **GUI-23 — Promoted commands.** Keep the two or three most frequent commands
   visible and reserve the menu for less frequent choices.

### Links

1. **GUI-24 — Visible link styling.** Mark an inline link with both color and
   an underline.
2. **GUI-25 — Exclusive link styling.** Reserve link styling for real links.
3. **GUI-26 — Front-loaded meaning.** Put the most informative words first,
   especially within roughly the first 11 characters.
4. **GUI-27 — Predictable destination.** Write link text that predicts its
   destination and remains meaningful outside the surrounding sentence.
5. **GUI-28 — Visited state.** Distinguish visited and unvisited links when an
   interface contains many links.
6. **GUI-29 — Distinct roles.** Do not make a link look like a button or a
   button look like a link.
7. **GUI-30 — Same-tab default.** Open a link in the same tab by default and
   state any exception in the visible link text.

### Dialog boxes

1. **GUI-31 — Blocking use only.** Use a modal only when a decision genuinely
   blocks further work.
2. **GUI-32 — Result labels.** Name each dialog button by its result instead of
   relying on **OK** or **Cancel**.
3. **GUI-33 — Safe defaults.** Default to the safest choice, make **Esc**
   cancel, and never let an accidental **Enter** cause destruction.
4. **GUI-34 — One question.** Ask one question per dialog and explain the
   situation, consequence, and choice in 1–2 sentences.
5. **GUI-35 — Undo reversible work.** Prefer undo over confirmation when an
   action can be reversed.
6. **GUI-36 — Modeless continuation.** Use a modeless dialog when work can
   continue.
7. **GUI-37 — No arrival overlay.** Never interrupt a newly arrived visitor
   with an overlay.
8. **GUI-38 — No dialog stacks.** Never open a dialog on top of another
   dialog.

### Alerts, notifications, and errors

1. **GUI-39 — Plain language.** Explain the state in plain words and never show
   a raw error code as the whole message.
2. **GUI-40 — Exact source.** Identify what failed and point to the field,
   file, or step where it happened.
3. **GUI-41 — Recovery step.** State the way forward in one sentence.
4. **GUI-42 — No blame.** Do not blame the person or use guilt-laden terms such
   as **illegal**, **fatal**, or **invalid user**.
5. **GUI-43 — Proportionate format.** Use a toast for information, a persistent
   inline message for a recoverable error, and a modal alert only for a
   catastrophic condition.
6. **GUI-44 — Redundant status cues.** Communicate status with an icon, color,
   and words rather than color alone.
7. **GUI-45 — Notification restraint.** Keep notifications scarce by default
   and let people control their frequency.

### Icons

1. **GUI-46 — Text pairing.** Pair an icon with text. Use a tooltip only when
   space genuinely prevents a visible label.
2. **GUI-47 — Standard metaphor.** Use the established symbol when one exists
   instead of inventing a replacement.
3. **GUI-48 — Recognition test.** Show a proposed icon by itself to five people
   and ask what it means before trusting the metaphor.
4. **GUI-49 — Coherent set.** Keep one visual style across the icon set while
   giving every icon a distinct silhouette.
5. **GUI-50 — Preserve learned symbols.** Do not redraw a familiar icon merely
   to follow fashion.
6. **GUI-51 — Small favicon.** Reduce the favicon to one strong shape and make
   sure it remains clear at 16 by 16 pixels.
7. **GUI-52 — Rare icon-only buttons.** Reserve an icon-only button for the
   small set of near-universal symbols.

### Checkboxes, radio buttons, and toggles

1. **GUI-53 — Choice model.** Use checkboxes for independent choices and radio
   buttons for mutually exclusive choices.
2. **GUI-54 — Vertical options.** Stack options vertically so every label has
   an unambiguous control.
3. **GUI-55 — Clickable labels.** Make the whole label activate its control.
4. **GUI-56 — Radio defaults.** Choose a sensible default and add a **None**
   option when abstaining is valid.
5. **GUI-57 — Positive wording.** Phrase choices positively and avoid nested
   negatives.
6. **GUI-58 — Immediate toggles.** Use a toggle only when its setting takes
   effect immediately; use a checkbox when a later submit action commits it.
7. **GUI-59 — One yes-or-no control.** Represent a yes-or-no choice with one
   checkbox instead of two radio buttons.
8. **GUI-60 — Visible small sets.** Show 2–4 choices as radio buttons rather
   than hiding them in a select.

### Tabs

1. **GUI-61 — One row.** Keep tabs in one row and reduce their number or label
   length when they do not fit.
2. **GUI-62 — Short labels.** Name each tab with 1–2 plain words.
3. **GUI-63 — Distinct states.** Connect the selected tab visually to its panel
   and distinguish selected, hovered, and unselected states.
4. **GUI-64 — Parallel peers.** Use tabs only for content of the same type at
   the same level; use a visible step sequence for ordered work.
5. **GUI-65 — Useful default.** Open the tab that most people need first.
6. **GUI-66 — Comparison in one view.** Never split content people must compare
   across tabs; use a comparison table.
7. **GUI-67 — Addressable tabs.** Give each tab its own URL when the platform
   allows it.

### Search

1. **GUI-68 — Visible search box.** Put an open search box near the top of every
   page in a content-rich site instead of hiding it behind an icon.
2. **GUI-69 — Query width.** Make the field at least 27 characters wide so a
   person can see and edit the whole query.
3. **GUI-70 — Familiar submission.** Use a magnifying glass for submission and
   make **Enter** work.
4. **GUI-71 — Forgiving matching.** Tolerate typos, plurals, and synonyms.
5. **GUI-72 — Retained query.** Keep the query in the field on the results page
   so it can be revised.
6. **GUI-73 — Complete results UI.** Use scannable titles, explanatory
   snippets, and filters when the collection needs them.
7. **GUI-74 — Complete index.** Index everything people consider part of the
   site.
8. **GUI-75 — Search-log review.** Review search logs every month and treat
   common queries with poor results as usability defects.

### Windows and scrolling

1. **GUI-76 — Same-window default.** Open content in the current window or tab
   unless the person chooses otherwise.
2. **GUI-77 — Native scrolling.** Never override the speed or direction of the
   platform's scroll gesture.
3. **GUI-78 — Visible scrollbars.** Keep a scrollbar visible for every
   scrollable pane.
4. **GUI-79 — Bounded infinite scroll.** Use infinite scroll only when nothing
   important appears below the list; otherwise provide **Load more**.
5. **GUI-80 — Important content first.** Order content by importance because
   attention declines with each screenful.
6. **GUI-81 — Working Back.** Protect the Back action and avoid gratuitous new
   windows or state changes that break it.

### Pointers and cursors

1. **GUI-82 — Platform cursors.** Use the platform's standard cursors without
   restyling them.
2. **GUI-83 — Truthful cursor.** Show a pointing hand only for a clickable
   element and an I-beam only for editable text.
3. **GUI-84 — Long-wait feedback.** Show a busy indicator for a wait longer
   than 1 second.
4. **GUI-85 — No hover-only path.** Never make hover the only way to reach
   important information or an action.
5. **GUI-86 — Visible keyboard focus.** Give keyboard navigation a visible
   focus indicator.

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

Keep their source hashes, build commands, and licenses beside the Diff feature's
fonts under `assets/fonts/`.

Start with this compact scale and adjust it only through named tokens:

| Use | Wide screen | Narrow screen |
| --- | --- | --- |
| Main body | 14px / 1.55 | 16px / 1.55 |
| Supporting text | 12px / 1.5 | 14px / 1.5 |
| Code | 13px / 1.35 | 14px / 1.35 |
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

Exact Hope surface values live only in the Diff feature's
`scripts/design/tokens.mjs`.

Code is a separate visual surface with fixed Hope light and dark colors.

A theme change switches both at once.

It does not replace the Hope palette outside code.

Insert repository text only as escaped content.

Keep source lines explicit in the document and distinguish patch additions,
deletions, context, and hunk headers without a stateful language parser.

The initial theme comes from the resolved Diff display option:

- `system`;
- `light`; or
- `dark`.

The theme control changes only the open document.

It does not write host configuration or browser storage.

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

Use the visible quiz question as the response field's persistent label.

When that question and a clear placeholder make the purpose evident, do not
repeat a generic visible label such as **My answer** or **Selection**.

Keep the question programmatically associated with the field and retain an
accessible name for assistive technology.

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

The Diff renderer inserts it as text and never accepts authored HTML, CSS,
JavaScript, SVG, or URLs.

Design code may contain tokens, fixed assets, and small helpers.

Diff owns its concrete HTML.

Add a shared artifact component only after another real artifact needs the same
behavior.
