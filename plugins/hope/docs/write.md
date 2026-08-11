<!-- Generated from docs/write.md. Do not edit. -->

# Hope Write

Hope Write drafts, edits, or reviews language without losing meaning, facts,
uncertainty, citations, exact text, or intended voice.

## Use throughout a task

Use Write whenever clearer language would improve the work.

This includes documentation, plans, prompts, instructions, schemas, comments,
errors, product copy, intermediate updates, and final responses.

Apply it before implementation when clearer input would reduce mistakes.

Apply it again before returning language-bearing work.

## Modes

- `draft` creates new prose.
- `edit` changes existing prose or files.
- `review` reports material clarity or meaning problems without changing the
  target.

The request selects the mode.

Do not ask for a mode when the action is already clear.

## Writing standard

The complete standard lives in
`plugins/hope/skills/write/references/writing-standard.md`.

The main rules are:

- lead with the conclusion, decision, or requested result;
- use short, familiar, direct language;
- keep one main idea in each sentence and one clear job in each paragraph;
- use headings and lists only when they clarify real structure;
- preserve meaning, facts, uncertainty, citations, exact text, and voice;
- do not silently narrow, expand, or resolve the person's request;
- keep technical language when it is more precise;
- write each language as natural original prose; and
- follow a stricter project rule when it serves a clear need.

Naturalness is part of correctness.

For translated or parallel text, first read the target version on its own, then
compare the versions for meaning drift.

## Boundaries

Write does not invent a fact or remove uncertainty to make prose sound
complete.

It does not delete, demote, or reorder a material claim without authority.

It does not change files during a review.

A request to polish or refine one named, completed work product in a bounded
finishing pass belongs to Polish.

Initial implementation, feature changes, architecture migrations, and broad
restructuring remain ordinary work even when they must preserve existing
behavior.

Other Hope Skills may apply the writing standard directly.

They do not need a runtime brief or a second Write invocation.
