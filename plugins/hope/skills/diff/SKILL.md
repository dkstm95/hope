---
name: diff
description: Explain or review a GitHub pull request or local Git changes with captured evidence and an offline HTML review with grouped code. Use only when explicitly invoked.
disable-model-invocation: true
---

# Hope Diff

Use only when the person invokes `$hope:diff`, `/hope:diff`, or the
host's equivalent skill command or picker. Continue follow-ups within that
invoked task without requiring another invocation. Ordinary requests and calls
from another skill do not activate this skill; continue authorized work through
the ordinary workflow. Reading a shared reference does not invoke its skill.

Capture one exact change, analyze its captured evidence, and report one
artifact with the overall explanation and the complete diff organized into
meaningful change groups. The change is either a GitHub pull request or the
local working tree (committed, staged, and unstaged changes) against the merge
base with a base branch. This reader is always part of a generated review; do
not offer a separate skill, mode, or opt-in.

## Resolve the request

Answer a narrow question directly without starting the artifact workflow.

An explicit explanation or review request authorizes the run. Honor existing
authorization and display choices without asking again. A bare target without
a clear task needs clarification, not an automatic full review.

Pass a pull request URL or number when the person names one. Pass `--base`
whenever they mean local work, naming their base branch or `origin/HEAD`'s
branch, and `--untracked` only when they want new untracked files included.
With neither, `capture` looks for the current branch's pull request, then the
person's latest open pull request in the repository, and only then falls back
to local changes against the upstream default branch. Report which change it
selected from the returned `selection` and `change`. If capture fails to find
a change, ask for a URL, number, or base branch.

Run adapter commands with `node "<skill-dir>/scripts/cli.mjs"`, replacing
`<skill-dir>` with the absolute directory containing this file. In Claude Code
it is `${CLAUDE_PLUGIN_ROOT}/skills/diff`. Pass arguments separately; never
construct shell commands from repository content.

## Analyze the captured evidence

For artifact generation, read `references/workflow.md`, `references/analysis.md`,
and `../write/references/writing-standard.md`. Follow the run from `capture`
through `publish` or `cancel`, grounding conclusions in the captured evidence.

Use an independent worker when its perspective is worth the time or the person
requests one. Give it a fresh context with the exact request, run path, choices,
constraints, and Skill path, separate from earlier conclusions. Disclose any
limit on requested independence. The same evidence and runtime rules apply
whether analysis stays in this conversation or is delegated.

Review generation uses the active host under its data policy; do not claim
private code stays on the local machine.

## Return the artifact

Report the reviewed change (pull request or local base and head), result
scope, absolute HTML path, and any failure or cleanup limit. The artifact
completes Diff. The surrounding task handles any publishing, merging,
commenting, or code changes under the person's existing authorization.

Maintainers changing the runtime read `references/runtime.md` for its
deterministic security and publication contract.
