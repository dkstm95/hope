<!-- Generated from docs/write.md. Do not edit. -->

# Hope write

Hope write helps a person draft, edit, or review prose without losing its
meaning, facts, uncertainty, citations, or intended voice.

## Use throughout a task

Write is not limited to prose-only requests.

Use it whenever clearer language would improve a Hope task.

Apply it while creating or changing:

- input prompts and task restatements;
- documentation, product copy, plans, explanations, and reviews;
- intermediate updates and final responses in any format;
- prompts, instructions, schemas, and model-facing text; and
- implementation code when Write can improve its names, comments, errors,
  user-facing strings, model-facing text, or other language-bearing structure.

Use Write before implementation when clearer input would reduce mistakes.

Preserve the person's intent and leave a material ambiguity visible.

Apply Write during the work and again before sending a response.

## Modes

- `draft` creates new prose from the person's request and available context.
- `edit` changes requested prose or files.
- `review` reports material clarity, meaning, or flow problems without changing
  files.

The request selects the mode.

Hope does not ask for a mode when the requested action is already clear.

## Shared standard

`features/write/standard.md` is the only editable copy of Hope's writing
standard.

It adapts George Orwell's six writing rules and adds the structural and
preservation rules needed for current Hope work.

Write prefers one sentence per prose paragraph when it improves meaning,
readability, or rhythm.

It keeps related sentences together when splitting them would harm meaning,
flow, or voice, or conflict with the target format.

In Markdown and plain text, one blank line separates consecutive prose
paragraphs.

Other formats use their native paragraph structure instead of a literal blank
line.

Write chooses target-supported headings, lists, dividers, and paragraph
boundaries to express semantic structure.

The renderer controls visible spacing, typography, and styling.

Naturalness is part of correctness.

The active host writes each language as original prose instead of copying
another language's word order, idioms, or sentence shape.

For translated or parallel text, it reads each version on its own and replaces
literal translations or word combinations that are grammatical but unnatural
together.

Its final check uses two passes: first read the target version on its own for
naturalness, then compare the versions for meaning drift.

Meaning must stay aligned across versions; their sentence structure does not
need to match.

The feature returns that standard with the selected mode and the matching
response contract.

A host adapter must use the returned brief instead of carrying another copy of
the rules.

Project instructions may require Write as a cross-cutting pass in another
feature or implementation task.

That use does not move the other feature's behavior into Write.

Write owns only the writing standard and mode contract.

A standalone language-only drafting, editing, or review request belongs to
Write.

A request to make one bounded revision of a named completed work
product—including structural cleanup, refactoring, consolidation, or supported
removal—belongs to Polish.

Polish consumes this standard for language-bearing changes; it does not run
Write as a second feature pass.

Hope diff also loads this standard from the write core.

It returns the standard with each prepared review so the active host can apply
it to every generated sentence.

Diff adds its own evidence and uncertainty rules without copying the writing
rules.

## Two entry paths

The Claude and Codex Skills use the active host session to apply the writing
pass.

They ask the generated Hope runtime for the current writing brief, then follow
that brief while handling the person's request, text, or files.

The independent harness exposes the same feature as `hope write`.

Automatic writing must report that its model adapter is unavailable until the
harness has one.

The internal `brief` command remains available so every entry path can use the
same mode contract and writing standard.

Before the harness delegates an AI feature, it creates one task writing pass
from this core.

The pass contains an `edit` brief for clarifying input and a `draft` brief for
the response.

The harness passes both to the feature command.

Current automatic model paths remain unavailable, but a future harness adapter
must receive this pass instead of defining its own writing rules.

Fixed protocol output stays deterministic and is edited at its source.

## Boundaries

- Do not invent a fact or remove uncertainty to make prose sound complete.
- Do not silently narrow or expand a person's request while clarifying it.
- Keep exact code, commands, identifiers, interface text, quotations, and legal
  language intact unless the person asks to change them.
- Treat sentence length as a signal, not a fixed pass or fail limit.
- Follow a more specific project rule when it serves a clear local need.
- Do not change files when the person asks only for a review.
