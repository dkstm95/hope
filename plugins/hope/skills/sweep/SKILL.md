---
name: sweep
description: Use only when someone explicitly invokes $hope:sweep in Codex, /hope:sweep in Claude Code, or the host's explicit Hope Sweep command to apply behavior-preserving maintenance across a codebase and its directly supporting material. Do not use for ordinary maintenance questions, reviews, planning, bug fixes, feature changes, or product decisions.
---

# Hope Sweep

Use the active host session to find and apply evidence-backed maintenance
changes to operating code and its directly supporting material without changing
customer-observed behavior.

Read `../../references/code-maintenance.md` before judging code, tests,
configuration, build logic, documentation, or other support material.

Read `../write/references/writing-standard.md` before drafting user-facing
language. Apply it without changing evidence, uncertainty, or the required
result.

## Confirm explicit invocation

Start Sweep only when the person explicitly invokes it through the active
host:

- `$hope:sweep` in Codex;
- `/hope:sweep` in Claude Code; or
- Hope Sweep's namespaced, explicit Skill command in another host.

Do not infer Sweep from a request to inspect a project, suggest improvements,
choose the next task, review work, fix a bug, or clean up code. A follow-up such
as “do that” is not an explicit invocation.

If an implicit selection reaches this Skill, stop before inspecting or editing
the target and continue the underlying request through the ordinary workflow.

## Bind the maintenance target

Use the repository named by the person. Otherwise use the current repository.
The entire repository is the default target. Narrow it only when the person
names a smaller scope inside that repository.

The target includes operating code and the tests, configuration, build logic,
documentation, comments, examples, generation, and assets that directly
support it. Do not widen into unrelated material or external directories.

Record the current revision and working-tree state. Preserve unrelated changes
and project-owned instructions.

Explicit invocation grants authority for reversible local edits within this
boundary. Do not ask for approval for each candidate. It does not override host
permissions or authorize commits, pushes, pull requests, or merges.

## Find and apply proven cleanup

Use the maintenance guidance to inspect only enough surrounding evidence
to prove a coherent cleanup. Sweep does not require an inventory of every
project file or a finding in every maintenance category.

Apply proven changes immediately in small, coherent batches. Recheck the
affected consumers before writing and keep each edit inside the bound target.

Do not fix or report suspected bugs, customer-behavior or public-contract
changes, product or compatibility decisions, or removals whose safety is
uncertain. Silently leave them outside Sweep. Do not turn an out-of-scope signal
into a recommendation or follow-up task.

## Verify the result

Use the maintenance guidance to verify the changed scope.

Inspect the final difference against the operating behavior and this Skill's
allowed categories. Correct or revert a regression introduced by Sweep. Do not
fix a pre-existing failure or use verification to widen the cleanup.

Report:

- the behavior-preserving cleanup that was applied, or that no proven cleanup
  was available;
- the supporting code, tests, documentation, configuration, generation, or
  assets changed with it; and
- the checks run and what passed or failed.

Do not mention skipped out-of-scope signals or propose work for them.
