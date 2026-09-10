---
name: diff
description: Explain or review a GitHub pull request as an evidence-linked, self-contained offline HTML record. Answer narrow PR questions directly when they do not need a full artifact.
---

# Hope Diff

Resolve one exact GitHub pull request, analyze its captured evidence, and
report its artifact. Diff covers the captured PR snapshot; local staged,
unstaged, and untracked changes are outside its scope.

## Resolve the request

Answer a narrow question directly without starting the artifact workflow.

An explicit explanation or review request authorizes the run. Honor existing
authorization and display choices without asking again. A bare target without
a clear task needs clarification, not an automatic full review.

Use `resolve-target [GitHub PR URL or PR number]` to resolve the target before
asking any needed question. Name the repository and PR number. If resolution
fails, ask for a URL or number. Once selected, pass that exact target; do not
fall back to automatic discovery.

Run adapter commands with `node "<skill-dir>/scripts/cli.mjs"`, replacing
`<skill-dir>` with the absolute directory containing this file. In Claude Code
it is `${CLAUDE_PLUGIN_ROOT}/skills/diff`. Pass arguments separately; never
construct shell commands from PR content.

## Analyze the captured evidence

For artifact generation, read `references/workflow.md`, `references/analysis.md`, and
`../write/references/writing-standard.md`. Follow the run from `prepare` through
`finish` or `cancel`, grounding conclusions in the captured evidence.

Use an independent worker when its perspective is worth the time or the person
requests one. Give it a fresh context with the exact request, target, choices,
constraints, and Skill path, separate from earlier conclusions. Disclose any
limit on requested independence. The same evidence and runtime rules apply
whether analysis stays in this conversation or is delegated.

Review generation uses the active host under its data policy; do not claim
private PR content stays on the local machine.

## Return the artifact

Report the PR, exact head, result scope, absolute HTML path, and any failure or
cleanup limit. The artifact completes Diff. The surrounding task handles any
publishing, merging, commenting, or code changes under the person's existing
authorization.

Maintainers changing the runtime read `references/runtime.md` for its
deterministic security and publication contract.
