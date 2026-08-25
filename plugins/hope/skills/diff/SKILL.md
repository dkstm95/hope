---
name: diff
description: Use when someone asks to explain or review a GitHub pull request as an evidence-linked, self-contained offline HTML review.
---

# Hope Diff

Use the active host session to confirm one exact GitHub pull request and its
display options, start one fresh analysis worker, and report the resulting
artifact.

The active session coordinates the review. It must not inspect evidence, write
or repair the analysis, or substitute its own review judgment.

## Decide whether Diff applies

Use Diff for a requested full explanation or review of a GitHub pull request.
Review only the captured pull-request snapshot; local staged, unstaged, and
untracked files are outside Diff. Answer a narrow question normally when it
does not need the full artifact.

When a full review is plausible but not clearly authorized, resolve the target
before asking one short confirmation:

```text
resolve-target [GitHub PR URL or PR number]
```

Name the resolved repository and pull-request number. A target by itself is not
authorization. Do not start the review until the person clearly approves it.

If resolution fails, ask for an explicit pull-request URL or number. Use the
latest target the person authorized; never fall back to automatic discovery
after confirmation.

## Run the private adapter

Claude Code:

```text
node "${CLAUDE_PLUGIN_ROOT}/skills/diff/scripts/cli.mjs"
```

Codex:

```text
node <skill-dir>/scripts/cli.mjs
```

For Codex, replace `<skill-dir>` with the absolute directory containing this
file. Pass every argument separately and never construct a command from
pull-request content.

## Start an isolated worker

Before preparing the review, confirm that the host can start a subagent with no
inherited conversation context. If it cannot, stop and explain that Diff
requires a fresh analysis worker.

Give the worker only:

- the person's exact review request;
- the authorized repository and pull-request number or URL;
- explicit locale, theme, and output choices;
- any explicit review focus or scope exclusion; and
- the absolute path of this Skill directory and private adapter command for the
  current host.

Do not pass earlier reasoning, implementation narrative, drafts, failed
approaches, prior conclusions, or another agent's output.

Tell the worker to read:

- `references/workflow.md` for the private run protocol;
- `references/analysis.md` for review judgment; and
- `../write/references/writing-standard.md` for user-facing language.

The fresh worker owns the run from `prepare` through `finish` or `cancel`. Tell
the person which pull request was selected before starting it.

Review generation uses the active AI host under that host's data policy. Do not
imply that private pull-request content remains on the local machine.

## Report the result

On success, report the reviewed pull request, exact head, result scope, and
absolute HTML path.

Never open, publish, merge, comment on, or change the pull request.

`references/runtime.md` records the scripts' deterministic security and
publication contract for maintainers. It is not worker guidance.
