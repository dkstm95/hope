# Hope design

This document defines Hope's project-wide GUI guidance and the Hope Technical
Record used by Align, Diff, and standalone Diagram HTML artifacts.

The Project GUI layout and Project GUI widgets sections apply whenever a Hope
feature introduces or changes a matching layout, control, or interaction.

Feature-named sections apply only to that artifact. Sections named for Hope
artifacts apply to every Technical Record.

The Align, Diff, and Diagram Skills own their feature judgment and prose.

The Technical Record is a compact, dual-mode technical memo. One shared token
source defines its common color, type, spacing, document, and navigation roles.
Align and Diff use the same document rail and reading surface. Diagram inherits
the same roles inside another record and embeds their current values in a
standalone HTML visual.

`plugins/hope/assets/artifact-theme.mjs` owns the exact common token values.
Feature-local tokens add roles such as Diff status and code colors. Feature
renderers continue to own content structure, interaction, and publication.

## Project GUI layout

Show each piece of information once in a viewport. A responsive layout may move
it, but must not leave a second visible copy.

Define spacing and alignment through layout groups. Do not correct one element
with an isolated margin when the relationship belongs to the group.

Derive the position of a connecting line, arrow, or other annotation from the
same layout structure as the element it identifies. Do not maintain
independent hand-tuned coordinates.

When space becomes too narrow, move needed information and actions into a
compact form that preserves access. Do not merely hide or squeeze them.

Keep body prose in one reading column. On a wide screen, use parallel columns
only for a short comparison summary whose options are easier to scan together.
Limit each comparison cell to a title, visual when useful, brief summary, and
brief points on the same comparison axes; put longer supporting explanation
below in the single reading flow. Stack comparison cells when the viewport is
narrow. Navigation, labels, tables, diagrams, and controls are structural UI
rather than prose columns and follow the structure they need.

Preserve an authored semantic paragraph as a separate HTML paragraph. Do not
collapse distinct paragraphs into one run of text or use layout columns to
create paragraph boundaries.

Use the same small set of semantic section patterns across Align and Diff:

- structured label-and-value rows for summaries, with the goal first;
- parallel cells only for brief comparisons that must be scanned together;
- one ordered vertical sequence for behavior or process;
- visible conclusions with native disclosures for reasons;
- compact inline markers for evidence and judgment methods; and
- numbered inline evidence references with one folded source list at the end.

When one claim cites several numbered evidence entries, display that marker
group in ascending document-number order. Keep each source's assigned number
and the final source-list order unchanged.

Keep summary labels compact without changing their wording. In Korean, when a
summary label consists of two two-syllable words, stack one word per line in
the label gutter while preserving the space in its text and accessible name.

## Hope artifact layout

Use one linear document at every viewport. Place the unnumbered document title
first, then start the numbered reading areas with a visible `01 Summary`. Show
the same number beside each area title and table-of-contents link. Number
conditional areas in rendered order and leave no gap when one is omitted. Keep
each section number the same type size and line height as its title.

Give every numbered area an accent section number, text-colored title, and one
clear divider directly below its title. Do not add a second rule above the
area. Use 40 pixels between the document title and Summary, then 48 pixels
between later areas on a wide screen and 40 pixels on a narrow screen. Use the
smaller steps in this shared spacing scale within an area:

```text
4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64
```

On a wide screen, place a 256-pixel document rail on the left. Start it with the
artifact identity, then show the numbered document index. Keep version or
review identity secondary near the bottom. Place repository identity and the
language and theme controls in the rail footer. Mark the current index entry
with one accent line and stronger text.

On a narrow screen, turn the rail into a compact top bar and move the same
navigation into a bounded panel beside the display controls. Preserve the
reading order and access to every item.

Put the artifact state directly below the document title. This keeps the
reading status with the record it describes while the rail carries navigation
and identity.

Render an ordered behavior or process as one connected vertical sequence. Keep
each two-digit step number beside its title and put the detail below. Use
horizontal columns only for direct comparison.

Give the document title enough emphasis to establish the reading path, then
keep body type compact and readable. Use thin dividers instead of enclosing
ordinary content in cards. Omit an optional area instead of rendering an empty
box.

## Diff artifact direction

The Diff artifact should feel:

- direct;
- compact;
- calm;
- easy to scan; and
- clearly divided without looking boxed in.

Use familiar words, short sentences, and one clear reading path.

Prefer useful content over decoration.

Use the Technical Record roles for the shared visual language.

The Diff feature's `scripts/design/tokens.mjs` consumes the shared tokens and
owns Diff-only code and status roles.

The Diff renderer must read those tokens instead of copying their values.

## Diff artifact structure

The first screen should explain the shape and limits of the change in about 30
seconds.

Show a plain-language title written from the changed behavior, reviewed commit,
goal, previous and new behavior, practical impact, the top one to three review
items or a clear empty result, and material review limits. Keep the provider's
pull-request title in the collapsed review information instead of using it as
the document title. Let the title name one decisive result; keep secondary
mechanics in the summary when they make the title harder to scan.

Compare the brief previous and new behavior summaries side by side on a wide
screen and stack them in that order on a narrow screen. Keep the practical
impact and every longer explanation in the single reading flow below the
comparison.

Keep internal source IDs, model details, token counts, processing state, and
capture time out of the first screen.

Use four top-level reading areas and omit a conditional area when it adds no
value:

1. Summary
2. Behavior change
3. Review items
4. Evidence and scope

Summary previews the most important review items. Keep the complete **Review
items** section in a native disclosure that starts closed; a fragment link to a
specific item opens it. This keeps the first reading path focused without
removing the full finding, effect, next step, completion condition, or evidence.

Keep background in Summary after the direct before-and-after explanation. Open
Behavior change with one **Change overview** subsection. Lead with the behavior
summary, use the core details to support it, and follow with an optional behavior
model. Give the lead and details the same body type scale. Keep the understanding
check as its own subsection because it asks the reader to act. The behavior
summary adds the condition, state, or relationship that makes its flow useful.
Present a visual's authored title as its figure caption so it identifies the
visual within that model. Keep teaching aid choices with the implementation
record in Evidence and scope.

Let the reading path answer these questions in order:

1. What changed?
2. Why does it matter?
3. How do previous and new behavior differ?
4. Under which conditions does the outcome change?
5. What did the review find, and what limited the judgment?
6. What implementation and evidence support that explanation?

This is a reader-question order, not a fixed six-question template. Omit a
question that does not apply instead of creating an empty or repetitive block.

Explain behavior before code. Keep functions, types, file mechanics, and code
steps in a collapsed **Implementation details** group inside Evidence and
scope. In the main path, translate source states and callback return values into
the human choice, condition, and outcome they represent.

Show only the code excerpts needed for understanding instead of reproducing the
full diff.

Put a quiet numbered reference such as `[1]` immediately after every grounded
claim. Reuse the number when the same source interval supports another claim.
Activating the reference shows a bounded preview popover anchored to that
reference. Place it below the marker when space allows, flip it above when
needed, and keep it within the viewport. Its ordinary fragment link remains
useful without JavaScript and leads to the canonical source entry.

Collect the complete numbered source list in one native disclosure at the end
of Evidence and scope. Start it closed on screen and reveal it for fragment
navigation and print. Keep code excerpts there instead of repeating them below
each claim.

Do not repeat a plain **Code** or equivalent basis label when the numbered
reference already links the claim to captured code. Keep a basis label only
when it changes how the reader should judge the claim, such as an inference, a
source statement, or something Hope could not confirm. Write those remaining
labels as explicit phrases beside the claim and its evidence marker rather than
as a separate metadata row. A teaching aid's evidence marker belongs beside
the caption or instruction it supports, not alone at the end of the component.

Use Evidence and scope as the complete index of the captured snapshot, checked
files, supporting sources, exclusions, and limits.

This order follows evidence that context before a passage improves
comprehension and recall
([Bransford and Johnson, 1972](https://doi.org/10.1016/S0022-5371(72)80006-9)),
pre-training helps people build a mental model
([Mayer, Mathias, and Wetzell, 2002](https://pubmed.ncbi.nlm.nih.gov/12240927/)),
and headings and previews direct attention
([Lorch and Lorch, 1996](https://doi.org/10.1037/0022-0663.88.1.38)). Keep
secondary implementation mechanics folded while the reader builds that model
to reduce competing processing
([Sweller, 1988](https://doi.org/10.1207/s15516709cog1202_4)). Use a diagram
only when its spatial structure makes a relationship or inference easier to
find than prose
([Larkin and Simon, 1987](https://doi.org/10.1111/j.1551-6708.1987.tb00863.x)).

## Align artifact direction

The Align artifact should feel like a compact shared-understanding record:
direct, quiet, easy to scan, and complete enough to preserve the intent and
consequential decisions the person confirmed.

The Align feature's `scripts/design/tokens.mjs` is the sole authority for its
design version and consumes the shared Technical Record tokens.

## Align artifact structure

The artifact is the current shared understanding. It guides implementation at
the level of intent and decisions that the person confirmed. Implementation owns
reversible code mechanics, current-system analysis, progress, and completion
evidence.

Show each fact once, in this order:

1. title, then **Intent** with the one-sentence goal, problem, detailed goals,
   their judgment methods, and an optional core flow with final branches;
2. **Decisions** with consequential decisions and their reasons;
3. **Design directions** with compared experience directions and the selected
   option, only when the person-facing experience needed visual agreement; and
4. **Boundary and evidence** with deliberately excluded work, retained legacy
   boundaries, and supporting evidence when any of them add value.

Positive statements define the agreement. Give each statement one home and
attach a material reason to the statement it explains. A flow earns its place
when sequence or branching adds meaning. Put deferred product work in **Not
included**.

A ready artifact contains settled, deliberately excluded, or explicitly
delegated material branches. Research and implementation uncertainty remain
with the work that owns them. Earlier artifact versions retain their historical
fields while the current record follows this structure.

Keep earlier versions in the secondary version history navigation. Label the
current version **current understanding** and keep the record as the single
authority for confirmed intent and decisions.

Keep detailed goals, consequential choices, their material reasons, exclusions,
and the core flow visible. Fold judgment methods, option references, and the
supporting-evidence section. Put `[n]` after a claim only when its structured
value names a validated evidence ID. Reuse that number throughout the current
understanding, show a bounded preview popover when it is activated, and keep the
complete numbered evidence list in the final folded section. Unreferenced
supporting evidence stays in that list, and claim links represent actual
references. Use these information roles directly and keep a consistent layout
across lengths and item counts.

Show each detailed goal and consequential decision as one visible
statement. For a consequential choice, add a quiet line that says whether the person
selected it or delegated it to the AI. A detailed goal carries no selection
source.
Put `[AI]` after a condition an AI agent can assess and `[User]` or the locale's
equally compact user label after one that needs a person's judgment. Activating the marker
opens the way to recognize the condition in a bounded popover anchored to that
marker. Keep the complete judgment methods in one folded list at the end of the
shared-understanding section so fragment navigation and print preserve them.
Judgment methods serve as recognition guidance while implementation owns their
results. Keep each inline marker at
least 24 pixels and use a 44-pixel close target.

Use body prose weight for detailed goals and stronger weight for
consequential decisions. Put a material reason directly below its decision in
quiet supporting text. Keep the selection source quiet and secondary.

Show data meaning, ownership, lifecycle, architecture boundaries, system
relationships, and experience choices when the confirmed decisions include
them. Implementation records hold algorithms, tools, files, protocols,
execution order, commands, progress, work ownership, changed files, test
status, and completion results.

## Diagram artifact direction

Diagram uses the Technical Record as its host language. A diagram inside Align
or Diff inherits that artifact's surface, type, spacing, accent, links, and
status roles. Its own composition carries only the relationships or quantities
that earned the visual.

A standalone Diagram HTML uses the same left document rail, document title,
semantic color roles, theme control, and responsive behavior. Present the main
visual first, then its conclusion, scope, uncertainty, source, or exact-value
table when those details contribute meaning.

Use ordinary prose type for human-readable labels and Hope Code for technical
identifiers. Let `paper`, `ink`, `muted`, `rule`, `accent`, and `link` map to
the active Technical Record tokens. Status uses text and shape together with
its semantic color.

## Project GUI widgets

Use native controls suited to the task and established platform conventions.
Apply guidance to controls the product needs; it does not require adding them.
Follow these defaults unless a documented product need, accessibility
requirement, or platform convention calls for an exception.

- Name actions by their outcome. Use buttons for actions and links for
  navigation, with persistent labels and visible keyboard focus.
- Keep related fields in reading order. Preserve entered values on error,
  identify the affected field, and explain recovery beside it. Do not reject
  a value while the person is still typing; validate after they leave the field.
- Open links in the same tab by default and state any exception in the visible
  link text.
- Use checkboxes for independent choices, radio buttons for exclusive choices,
  and toggles for settings that take effect immediately.
- Show current location and state through text or shape as well as color.
  Keep frequently used actions reachable and comparisons visible together.
- Use a modal only for a blocking decision. Prefer undo for reversible work,
  support Escape, restore focus, and prevent accidental destructive actions.
- Preserve native scrolling, Back navigation, keyboard access, and touch access.
  Essential information and controls must not depend on hover.
- Give prompt feedback and a clear recovery path. Add usability research when
  an unresolved product question warrants it, rather than as a fixed ritual.

This guidance draws on Jakob Nielsen's
[GUI design elements](https://www.uxtigers.com/post/gui-widgets).
The artifact accessibility and interaction sections below own Hope's concrete
requirements.

## Align artifact layout

Give the current understanding most of the page and keep version history secondary. In
the left document rail, show the current version and at most one prior version
summary. Open earlier detail from that history instead of repeating it in the
document. On narrower layouts, include the history in the common navigation
panel opened by one 44-pixel control to the right of the theme control.

Keep detailed goals in **Intent** and consequential decisions in
**Decisions**, within one reading column. Present **Outside scope** inside
**Boundary and evidence** as one compact list in two columns on a wide screen
and one column on a narrow screen. The positive agreement statements already
serve the included scope.

Nest an optional core flow below the detailed goals. Attach its results directly
to the sequence as final branches in their original order. Phase groups and
branches reflect artifact data directly.

Keep each material reason directly below the decision it explains. Together,
the detailed goals and decisions carry the complete agreement.

Show two or three person-facing design directions together in one
comparison section. Keep the same option order. Keep recommendation and
selection labels beside the option title within the same comparison row. On a
wide screen, compare each option's title, image,
brief summary, strengths, and trade-offs in parallel; align those shared rows
across the options and stack each complete option on a narrow screen. Inside
each option, put strengths and trade-offs before recommendation and selection
reasons, then put folded references last. Keep the reasons and references
inside the option they explain. Put context shared by all options below the
comparison in one reading column. Pair every image with useful alt text, and
mark recommendation and selection with words rather than color alone.

Align embeds Hope Sans and Hope Code so it uses the same Hope type families as
Diff across supported hosts. Its shared palette, spacing, type sizes, and
layout values come from the Technical Record tokens.

## Hope artifact identity

Align and Diff embed Hope Sans and Hope Code under `plugins/hope/assets/`.
Their favicon uses the Hope product icon. The visible rail identity uses the
artifact name and a compact record identifier: `ALIGN / SPEC-nnn` or
`DIFF / PR-n`.

## Diff artifact layout

On a wide screen:

- keep the main text at a readable width;
- keep dense body text intentionally smaller than mobile text; and
- do not stretch paragraphs across a large monitor.

On a narrow screen:

- open a compact native collapsible table of contents from an icon-only control
  beside the display control in the compact top bar;
- do not give the closed table of contents its own body row or vertical gap;
- open its links in a bounded panel directly below the compact top bar;
- keep the panel vertically scrollable without passing its scroll gesture to
  the document;
- close the open panel with Escape and return focus to its control; and
- use larger body text and touch targets.

Use the same repository type treatment as Align. Present the reviewed commit in
the rail footer and repeat its short identity below the document title. In both
the rail and panel, mark the current section with an accent bar and stronger
text.

Give the common display control a 44-pixel height and give its theme segment a
visible boundary. Keep the pull-request link outside that group. When the
display and contents controls appear together, give them the same height,
border role, and corner radius.

An icon-only control may be narrower, but it must not look like a smaller
control family.

The document owns the change-based artifact title. Summary owns the goal. The
rail footer owns repository and pull-request identity, the title status owns the
compact reviewed commit, and collapsed review information owns capture time.

Do not add a persistent sentence that explains that an offline artifact does not
update itself.

A complex drawer is allowed only after its focus, keyboard, scroll, and deep
link behavior is tested.

## Diff artifact type

Use three clear roles.

| Role | Font |
| --- | --- |
| Body prose and controls | Hope Sans Medium, from Gmarket Sans |
| Wordmark and headings | Hope Sans Bold |
| Code, commands, paths, and hashes | Hope Code, from D2Coding |

Embed the fixed WOFF2 files in every offline artifact. Use a local sans-serif or
monospace fallback only for characters that the bundled fonts do not contain,
and do not synthesize a missing font weight.

Hope presents the converted files under Hope-owned family names because both
source licenses reserve their original family names.

Keep their source hashes, build commands, and licenses beside the shared fonts
under `plugins/hope/assets/fonts/`.

Use the same compact prose scale as Align and adjust it only through named
tokens. Diff keeps a separate code scale:

| Use | Wide screen | Narrow screen |
| --- | --- | --- |
| Main body | 14px / 1.58 | 13px / 1.6 |
| Supporting text | 12px / 1.55 | 12px / 1.55 |
| Code | 12px / 1.35 | 13px / 1.35 |
| Page title | 28px / 1.16 | 24px / 1.2 |
| Section title | 15px / 1.45 | 15px / 1.4 |

Keep prose near 60–80 characters per line. Long paths and code may scroll
inside their own region. Text-bearing controls use a minimum height and grow
when text is enlarged without creating page-level horizontal scrolling.

## Diff artifact space and boundaries

Use two border roles:

- a quiet divider for document structure; and
- a stronger component border for controls, code, and separate task or state
  regions.

Give an adjacent vertical boundary to the later block's top edge. Within a
repeated group, put the divider on each item after the first. Do not combine a
previous block's bottom border with the next block's top border.

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

Keep the first-screen review result especially compact. Group the previews in
one quiet verification region and render each as a small kind marker, plain
importance text, and title. Do not add a representative status, total, or kind
counts. When no item exists, show one plain empty-result sentence.

Show concrete material scope limits in the same label-and-value grid as the
other synopsis rows, without a generic scope badge. Omit the row when no
material limit exists.

Use semantic `ul` and `ol` elements for content that is a list.

Render the goal as the first label-and-value row in Summary. Keep the
provider's pull-request title and capture time in collapsed review information.

In each full review item, align kind, importance, and any visible basis on one
visual centerline.

Keep kind and importance as outlined markers. When basis changes how the reader
should judge the item, show it as quieter plain text; omit a code basis that the
numbered evidence already makes visible.

## Hope artifact themes

Generate each artifact as one self-contained file that supports light and dark
themes. The initial theme comes from the artifact input or resolved display option:
`system`, `light`, or `dark`. The theme control changes only the open document;
it does not write host configuration or browser storage. Reload restores the
generated initial theme, and print uses the light surface.

The light view uses a near-white canvas, a white reading surface, charcoal
text, quiet neutral rules, and deep teal emphasis. The dark view uses graphite
paper, a slightly brighter reading surface, warm white text, quiet gray rules,
and mint emphasis. Blue identifies links in both views. Print uses the light
surface.

Exact shared values live in `plugins/hope/assets/artifact-theme.mjs`.

## Align artifact color

Align uses the shared surface, text, rule, accent, link, and visited roles.

## Diff artifact color

The official light palette is `Technical Paper`: the same near-white canvas and
white reading surface used by Align.

It should feel clean, bright, and calm, with enough surface separation to
preserve the document hierarchy.

Shared Hope surface values come from the Technical Record tokens. Diff's
`scripts/design/tokens.mjs` owns its status and code roles.

Code is a separate visual surface with fixed Hope light and dark colors. A theme
change switches the code surface with the artifact without replacing the Hope
palette outside code.

Use these status roles:

| Meaning | Color role |
| --- | --- |
| Resolve | Red |
| Decide | Amber |
| Verify | Blue |
| Scope | Neutral blue-gray |

Keep importance in text and never use color as the only status signal.

## Diff artifact interaction

Every interaction must still leave useful content when JavaScript is disabled.

Use trusted, fixed scripts only.

Supported interactions can include:

- preview a numbered evidence reference and open its canonical list entry;
- move through the table of contents;
- switch the current document theme;
- try a safe declarative microworld;
- draft an optional quiz response without submitting or saving it; and
- reveal the quiz answer and evidence through a separate disclosure.

Anchor a reference preview to the marker that opened it. Prefer the space below
the marker, flip above when needed, and clamp it to the viewport. Reposition it
after scrolling or resizing while the marker remains visible. On a narrow
screen, use a bottom sheet only when neither side has enough usable height.

Keep a microworld's title, instructions, and model warning visible. Fold its
controls, scenarios, simplifying assumptions, omissions, and evidence into one
native disclosure. These are optional exploration details, not prerequisites
for understanding the behavior summary and flow.

Use the visible quiz question as the response field's persistent label. When
that question and a clear placeholder make the purpose evident, do not repeat a
generic label such as **My answer** or **Selection**. Keep the question
programmatically associated with the field, and give repeated controls unique
accessible names through their questions. A response is never required before
the answer can be opened.

Print omits the reader's transient quiz response and shows every review item,
microworld detail, question, answer, and supporting evidence regardless of the
current disclosure state.

The **Evidence and scope** section is a dense reference appendix. Start the
section closed. Opening it reveals source groups, context checks, scope limits,
the checked-file group, artifact details, and the final numbered evidence list
as independent disclosures that also start closed.

Use native disclosure controls so they work without JavaScript. Opening a
fragment link must reveal every disclosure that contains its target.

Code markup must contain explicit line separators. One source line remains one
visible line without layout styles; long lines scroll inside the code surface
instead of merging with adjacent lines.

Do not make audit completeness look like repeated interface content. Merge
changed-file source metadata into the changed-file table, keep other sources in
a separate small table, and group exclusions that share a reason.

Keep the collapsed interface compact. A closed disclosure occupies only its
summary row and borders; it does not reserve body padding or leave unused parent
spacing.

Keep the understanding-check subsection visible when it is present. Let each
question and its answer open independently instead of collapsing the whole
subsection.

Expanded details must still account for every source, file, and limit.

Keep stable section IDs available for navigation. Do not show a section-copy
control while artifacts use temporary local paths; add copying only when Hope
has a portable publication URL and can show visible success feedback.

Do not add task completion, assignment, comments, or hidden persistence.

## Hope artifact accessibility

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

When an artifact embeds typefaces, body prose, supporting labels, controls, and
interactive summaries use its medium face. Headings use its bold face.

Print keeps a compact artifact identity with its record or pull-request ID,
repository, revision or reviewed commit, and date.

Test the final file through `file://`, not only through a web server.

## Hope artifact implementation boundary

Repository, provider, and model content is untrusted.

Each renderer inserts authored prose as text and never accepts authored HTML,
CSS, JavaScript, or SVG. Diff separately validates the source URLs it owns;
Align renders only `http` and `https` evidence locations as links.

Diff inserts repository text only as escaped content. It keeps source lines
explicit and distinguishes patch additions, deletions, context, and hunk
headers without a stateful language parser.

Align may embed raster design-direction images only after its runtime verifies
their supported signature, dimensions, and size. It never treats an authored
data URL or SVG as a design-direction image.

Design code may contain shared Technical Record tokens, feature-local tokens,
fixed assets, and small helpers.

Each feature owns its concrete HTML, state, and publication boundary. Shared
implementation stays focused on the exact visual tokens used by multiple
features.
