# Hope write

Hope write helps a person draft, edit, or review prose without losing its
meaning, facts, uncertainty, citations, or intended voice.

## Modes

- `draft` creates new prose from the person's request and available context.
- `edit` changes requested prose or files.
- `review` reports material clarity, meaning, or flow problems without changing
  files.

The request selects the mode. Hope does not ask for a mode when the requested
action is already clear.

## Shared standard

`features/write/standard.md` is the only editable copy of Hope's writing
standard. It adapts George Orwell's six writing rules and adds the structural
and preservation rules needed for current Hope work.

The feature returns that standard with the selected mode and the matching
response contract. A host adapter must use the returned brief instead of
carrying another copy of the rules.

Hope diff also loads this standard from the write core. It returns the standard
with each prepared review so the active host can apply it to every generated
sentence. Diff adds its own evidence and uncertainty rules without copying the
writing rules.

## Two entry paths

The Claude and Codex Skill uses the active host session to produce prose. It
asks the generated Hope runtime for the current writing brief, then follows that
brief while handling the person's requested text or files.

The independent harness exposes the same feature as `hope write`. Automatic
writing must report that its model adapter is unavailable until the harness has
one. The internal `brief` command remains available so every entry path can use
the same mode contract and writing standard.

## Boundaries

- Do not invent a fact or remove uncertainty to make prose sound complete.
- Keep exact code, commands, identifiers, interface text, quotations, and legal
  language intact unless the person asks to change them.
- Treat sentence length as a signal, not a fixed pass or fail limit.
- Follow a more specific project rule when it serves a clear local need.
- Do not change files when the person asks only for a review.
