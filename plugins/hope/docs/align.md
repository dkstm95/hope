<!-- Generated from docs/align.md. Do not edit. -->

# Hope align

Hope align helps a person and an AI find important misunderstandings before
implementation starts.

It is an adaptive interview with a visible shared understanding, not a long-form
plan generator and not a proof of perfect understanding.

## Product boundary

Align works on one named task and one captured set of sources.

A source can be a conversation turn, repository revision, file, URL, or another
artifact.

A Git source needs a full object ID or content digest.

Every other source needs a content digest.

Names such as `main`, `latest`, and `current` are not stable identities.

Changing the source set creates a new Align revision.

Align asks about intent, preference, work rules, and material choices.

It reads available project evidence instead of asking the person to repeat facts
that the repository can answer.

It does not implement the task, change project files, or claim that a prototype
proves production behavior.

Align and Diff are independent.

A later Diff may use an Align artifact as captured context, but neither feature
requires the other.

Align composes with Polish at one narrow point.

After the runtime reports a contract-ready approval candidate, the host prepares
an exact candidate digest and invokes Polish once before asking for approval.

Polish must preserve every fact, source, decision, uncertainty, and meaning in
the Align state.

If it revises the candidate, Align increments its revision, records the change,
and validates readiness again.

If Polish finds a material ambiguity, Align resumes the interview.

Polish never invokes Align.

## Adaptive interview

Each round starts with a short teach-back of the current goal, scope, expected
behavior, and material assumptions.

A useful question includes:

- the current understanding;
- why the decision matters;
- the realistic choices and effects;
- Hope's recommendation; and
- how the person may delegate the choice.

There is no fixed question count.

Do not repeat a closed question with new wording.

Give a recommended default for a reversible, low-impact choice.

Leave an item for research, implementation-time checking, or deliberate deferral
when an interview cannot honestly settle it.

Use representative examples, edge cases, and counterexamples when they test the
shared mental model.

Do not use trivia or ask the person to repeat the generated document.

## Perspectives

Every session considers these perspectives, but activates only the ones that
reduce a material risk:

- Shared understanding
- Product requirements
- Experience design
- System architecture
- Program design
- Verifiable pieces of work

The state records why a perspective is active or skipped.

Experience design is active only when the work changes a user interface.

System architecture is active only when boundaries, APIs, state, storage, or
data flow may change.

Small fixes may skip most perspectives.

An active perspective records concrete decisions or checks.

Each verifiable piece of work names the user-visible change, bounded scope,
verification, and failure or recovery behavior.

A list of file edits by itself is not such a piece.

## Recorded state

The structured state separates:

- the current goal, success conditions, scope, and scenarios;
- repository facts and their source;
- user decisions and their captured conversation sources;
- AI proposals;
- important assumptions and whether they are confirmed, delegated, or open;
- open questions;
- classified uncertainty;
- changes since earlier interview rounds;
- active and skipped perspectives;
- implementation slices.

Version 2 also records a static UI preview contract when `ui` is true.

The contract records:

- which change axes apply: copy, layout, visual hierarchy, component
  placement, user flow, or screen state;
- whether a preview is required, provided, or not required;
- one or more canonical screen content trees;
- wide and narrow frames that reference those screens; and
- annotations that reference nodes in the canonical tree.

The screen tree accepts only Hope-owned layout and content nodes.

It does not accept HTML, CSS, JavaScript, SVG, URLs, event handlers, class names,
or arbitrary attributes.

The renderer creates both the visual mockup and its text view from that same
tree.

A host does not author a second text alternative that can drift from the visual
content.

Hope derives resource counts and readiness blockers from this state.

A host must not invent token, time, test, or source measurements that it did not
observe.

Trusted host integrations may attach observed cost measurements outside the
authored state.

## Readiness

The state moves through three phases:

1. `interviewing` — a material question or assumption remains open.
2. `ready-proposed` — Hope finds no current contract blocker and proposes that
   implementation may start.
3. `approved` — the person explicitly approves the next step.

The runtime checks that a proposed or approved state has a goal, success
conditions, explicit in-scope and out-of-scope boundaries, scenarios, no open
question, no open assumption, and at least one verifiable slice.

Medium- and high-risk work also needs active product-requirement and
vertical-slice perspectives.

Version 2 applies an additional preview gate:

- non-UI work records `not-required` with the `none` change axis;
- copy-only UI work may record `not-required` with a reason;
- layout, visual hierarchy, component placement, user flow, or screen-state
  changes require `provided` previews;
- `required` means the preview is still missing and blocks readiness; and
- every provided screen must have one wide frame and one narrow frame.

The wide and narrow frames reference the same screen tree.

A viewport may change layout, but it cannot silently change content, state, or
reading order.

These checks find contradictions in the record.

They do not prove complete understanding.

Before showing a contract-ready candidate for approval, the host runs
`polish-candidate` on the private state.

The command rejects an interviewing or blocked state and returns an artifact
source bound to the canonical candidate digest.

The digest excludes derived metrics and the prior Polish record.

After Polish returns, the host runs `complete-polish`.

The shared transition checks that the run targeted the prepared digest,
revalidates the resulting Align state, records the outcome and verification
status, and binds a record to the resulting candidate.

A revised state must increment its revision, remain contract-ready, and record
the cleanup.

`needs-alignment` must increment the revision and return to interviewing with a
recorded blocker.

A completed record prevents another pass over the same candidate.

A user change removes the stale record, creates a new digest, and may receive
one new pass.

Model-authored state cannot approve itself.

The `approved` phase requires a trusted approval record from the host, supplied
outside the structured state.

The record names a user decision and a conversation source with a content
digest.

The runtime checks both against the captured snapshot.

When only the CLI is available, the Skill keeps the runtime state at
`ready-proposed`.

After an explicit user response, the host session may continue the work, but it
must not claim runtime approval unless the host can supply the trusted record.

## Shared-understanding artifact

The runtime renders the structured state into deterministic, self-contained
HTML.

The HTML shows the current shared understanding during the interview; it is not
a separate final report.

Render after several related decisions are settled or when the person asks to
inspect the current state.

Do not regenerate it after every sentence.

### First screen

The first screen helps the person answer four questions in about 30 seconds:

1. What work are we aligning on?
2. Which alignment phase are we in?
3. What goal and success conditions are already shared?
4. What is the next material choice or approval action?

Show the current phase once beside the title.

Do not turn interview rounds, source counts, byte counts, or other internal
resource measurements into a first-screen dashboard.

When an open question exists, show the first question and Hope's recommendation
as the primary next action.

Link to the full choices instead of repeating every choice on the first screen.

When no question remains, show the next approval or implementation action.

Translate blocker codes into actions a person can recognize.

Keep the exact codes in structured state, but do not use them as the main
interface language.

### Reading order

Keep this order across Align artifacts.

Omit a conditional section when it has no content.

| Order | Section | Job |
| --- | --- | --- |
| 1 | Alignment at a glance | Show the title, phase, goal, next action, and version 3 primary agreements. |
| 2 | Scope and success | Compare included work, excluded work, and success conditions. |
| 3 | Expected behavior | Test the shared model with representative cases and boundaries. |
| 4 | Visual preview | Compare the same screen content at wide and narrow viewports when required. |
| 5 | Agreed understanding | Put open questions first, then decisions, accepted proposals, readable evidence, and material assumptions. |
| 6 | Verifiable pieces of work | Show the path from user-visible change to verification and recovery. |

Keep open questions, scope, expected behavior, visual previews, material
uncertainty, and verifiable work available in the main reading path.

Use progressive disclosure without hiding a material choice.

Keep the goal, next action, scope, success conditions, scenarios, primary
agreement text, and preview visible without opening a disclosure.

Version 3 names up to three primary agreements in structured state instead of
letting the renderer guess which records matter most.

Those primary agreements are settled decisions or proposals.

Show their short decision text with the next action and repeat it in the agreed
understanding section with its supporting detail.

An open proposal never counts as a primary agreement.

Keep it visible in a separate unresolved-proposal block with its AI-proposal
origin and open status.

Keep the rationale and, for user decisions, readable source names behind each
primary agreement's decision text.

Show accepted and delegated AI proposals with their origin and status rather
than claiming an unavailable source name.

Group non-primary settled agreements under one compact count and keep their
complete text, rationale, status, and available source names inside that
disclosure.

Start repository evidence, confirmed or delegated assumptions, deferred
uncertainty, and work scope, verification, and recovery details closed.

Start an assumption group with an open assumption and an uncertainty group
with research or implementation-check work open.

Show each work title and user-visible change in its disclosure summary.

Do not nest disclosure controls in Align content.

A direct fragment link opens every disclosure needed to reveal its target.

Leave enough scroll margin that the sticky header does not cover the focused
target.

Print output reveals every disclosure and preserves the same content order.

On a wide screen, show wide and narrow preview frames together.

On a narrow screen, show the narrow frame first and put the wide frame behind
one native disclosure.

Keep responsive visual copies out of the document heading outline.

Expose one canonical text representation for assistive technology and keep
viewport captions available for the visual comparison.

The artifact always shows:

- the goal, current phase, and next action;
- scope, success conditions, and expected scenarios;
- open questions and agreed decisions;
- open proposals in a visibly unresolved block;
- accepted or delegated proposals with their status in the agreement flow;
- repository facts as readable evidence with source names;
- material assumptions and uncertainty;
- verifiable pieces of work; and
- provided static previews.

The artifact conditionally shows empty or missing material states only when the
person must act on them.

The artifact does not render version numbers, risk, capture time, the full
phase track, a no-blocker row, design-perspective activation records, change
history, resource counts, raw source locators, revisions, or digests.

Those values remain in structured state for validation and audit.

They do not create hidden or collapsed UI in the normal artifact.

Version 1 stays readable and keeps its existing candidate and Polish record
identity.

Hope does not rewrite it implicitly.

Version 2 states stay readable without a presentation field.

New sessions use version 3.

Version 2 preview data is bounded before rendering: at most 4 screens, 8 frames,
256 nodes, 8 levels of nesting, 12 children per group, and 32 annotations.

IDs are unique, references must resolve, and all authored text is escaped.

A preview is a static alignment mockup, not an executable prototype and not
evidence of production behavior.

The renderer uses Hope design tokens, embeds the fixed fonts, supports light and
dark themes, offers the same theme and responsive contents controls as other
Hope artifacts, and remains useful with JavaScript disabled.

It reveals the theme control only after its script initializes, so a disabled
script never leaves a false interactive control.

It never replaces an existing output path.

## Resource limits

Versions 1, 2, and 3 accept at most 128 KiB of structured input, 64 KiB of
generated prose, 64 source references, 64 decisions or facts per group, 48
scenarios, 24 perspectives, and 48 slices.

Versions 2 and 3 also apply the preview-specific ceilings listed above before
HTML generation.

Structured input may contain at most 128 nesting levels and 65,536 values.

The artifact is limited to 8 MiB.

These are safety ceilings, not targets.

The brief asks the host to keep only the evidence, decisions, and questions that
can change the work.

## Two entry paths

The Claude and Codex Skills use the active host session for repository
inspection and the interview.

It asks the generated runtime for the complete host workflow, validates one
structured state, prepares one exact Polish candidate when ready, and asks the
runtime to render HTML.

Normative interview, state, Polish composition, readiness, and lifecycle rules
live in that runtime brief rather than in the Skill.

The independent harness exposes the same feature as `hope align`.

Its internal `brief`, `validate`, `polish-candidate`, `complete-polish`, and
`render` commands reach the shared core.

For version 1, version 2, and version 3 fixtures, the harness and generated
plugin must return the same validation result, Polish candidate, render bytes,
digest, and invalid-input error.

Automatic interviewing reports that the harness model adapter is unavailable
until one exists.
