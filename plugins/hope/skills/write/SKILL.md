---
name: write
description: Use as the cross-cutting language standard whenever clearer language would improve any task, including standalone drafts, edits, and reviews and language within implementation or another Skill; preserve meaning, facts, uncertainty, citations, exact text, and voice.
---

# Hope Write

Use the active host session to draft, edit, review, or improve language. Read
`references/writing-standard.md` before doing the work.

Write may own a standalone language task or accompany another task or Skill.
When it accompanies other work, preserve that work's scope, authority, process,
and completion conditions. Apply the standard to its language-bearing parts in
the same session; do not create a separate Write workflow, result, or worker.

## Choose the language action

- `draft` creates new prose.
- `edit` changes existing prose or files.
- `review` reports material clarity, meaning, or flow problems without changing
  the target.

Infer the action when the request already makes it clear. It describes the
language work, not the surrounding task: implementation, feature changes,
architecture migrations, and broad restructuring remain ordinary work.

## Return the requested result

For a draft, lead with the requested text and only its necessary context. For an
edit, make the authorized change and report the result. For a review, report
material findings without editing the target.

Use the current language unless the person or project chooses another. For
translated or parallel text, first read the target version for naturalness,
then compare versions for meaning drift.

Do not copy the writing standard or its checklist into the response.

Return when the requested language action is complete and meaning, facts,
uncertainty, citations, exact text, and voice remain preserved. Correct a
clarity or preservation problem introduced by Write, but do not continue
polishing beyond the requested result.
