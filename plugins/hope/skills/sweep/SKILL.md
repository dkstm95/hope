---
name: sweep
description: Use only when someone explicitly invokes $hope:sweep in Codex, /hope:sweep in Claude Code, or the host's explicit Hope Sweep command to apply behavior-preserving maintenance across a codebase and its directly supporting material. Do not use for ordinary maintenance questions, reviews, planning, bug fixes, feature changes, or product decisions.
---

# Hope Sweep

Use the active host session to apply proven, behavior-preserving maintenance to
operating code and its directly supporting material.

Read `../../references/code-maintenance.md` before inspecting the target. Read
`../write/references/writing-standard.md` before drafting user-facing language.

## Require explicit invocation

Start only after the person explicitly invokes `$hope:sweep` in Codex,
`/hope:sweep` in Claude Code, or the host's namespaced Hope Sweep command.

Do not infer Sweep from a request to inspect a project, suggest improvements,
choose the next task, review work, fix a bug, or clean up code. A follow-up such
as “do that” is not an explicit invocation.

If an implicit selection reaches this Skill, stop before inspecting or editing
the target and continue the underlying request through the ordinary workflow.

## Bind the target

Use the named repository or, when none is named, the current repository. The
whole repository is the default; narrow it only when the person names a smaller
scope.

Include operating code and only the tests, configuration, build logic,
documentation, comments, examples, generation, and assets that directly
support it. Record the current revision and working-tree state, and preserve
unrelated changes and project instructions.

Explicit invocation authorizes reversible local edits inside this boundary. It
does not override host permissions or authorize commits, pushes, pull requests,
or merges.

## Apply proven cleanup

Follow the maintenance guidance to trace active consumers and form a candidate
frontier: evidence-backed cleanup opportunities whose prerequisites have been
inspected. Resolve each candidate by applying it, rejecting it when the evidence
does not prove safety, or leaving it outside the bound target. Inspect only
enough surrounding evidence to resolve the frontier; Sweep does not require a
complete file or category inventory.

Apply proven changes in small coherent batches. Do not fix or report suspected
bugs, customer-visible or public-contract changes, product or compatibility
decisions, or uncertain removals. Leave those signals outside Sweep without
turning them into recommendations or follow-up tasks.

After each batch, verify affected consumers and recompute only the affected
frontier. Correct or revert any regression introduced by Sweep. Do not fix a
pre-existing failure or widen the cleanup during verification.

Stop when the candidate frontier is empty and one evidence pass over the changed
scope finds no new proven candidate. Do not keep searching to fill a category or
justify having invoked Sweep.

## Report the result

Report the behavior-preserving cleanup, or that no proven cleanup was available;
the directly supporting material changed with it; and the checks that passed or
failed. Do not mention skipped out-of-scope signals.
