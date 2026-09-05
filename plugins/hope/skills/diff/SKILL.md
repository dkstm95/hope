---
name: diff
description: Explain or review a GitHub pull request as an evidence-linked, self-contained offline HTML record. Answer narrow PR questions directly when they do not need a full artifact.
---

# Hope Diff

Resolve one exact GitHub pull request, give a fresh worker the analysis, and
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

## Assign one independent worker

Start a subagent with no inherited conversation. Independence protects review
judgment; if the host cannot provide it, explain that limit without claiming
to have completed Diff.

Give the worker only the exact request, selected repository and PR, explicit
locale/theme/output choices, review focus or exclusions, and the absolute Skill
path and adapter command. Exclude earlier reasoning, drafts, implementation
narrative, prior conclusions, and other agents' output.

Tell it to read `references/workflow.md`, `references/analysis.md`, and
`../write/references/writing-standard.md`. The worker owns evidence inspection,
analysis, repairs, and the run from `prepare` through `finish` or `cancel`.
Tell the person which PR is selected before starting it.

Review generation uses the active host under its data policy; do not claim
private PR content stays on the local machine.

## Return the artifact

Report the PR, exact head, result scope, absolute HTML path, and any failure or
cleanup limit. The artifact completes Diff. The parent task handles any
publishing, merging, commenting, or code changes under the person's existing
authorization.

Maintainers changing the runtime read `references/runtime.md` for its
deterministic security and publication contract.
