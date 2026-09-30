---
name: pr-writing
description: Write or update PR and MR titles and descriptions when creating or editing a pull request or merge request, including when the agent reaches that step during implementation. Use for requested drafts too, not review-only requests or standalone commit messages.
---

# Hope PR Writing

Apply when preparing a PR or MR title and description, whether the person asks
directly or the current authorized workflow reaches creation or update. Explicit
invocation is also supported. Work in the current conversation and return to the
surrounding task after writing; a request to create a PR still ends with creation.
This skill supplies the text, not independent authority to publish, push, or merge.

## Ground the description

Read applicable repository instructions, including `AGENTS.md` and
`CONTRIBUTING.md` when present, and the relevant PR or MR template. Check hidden
template locations such as `.github` and `.gitlab/merge_request_templates`;
an empty file-search result does not establish that these known paths are absent.
Honor the person's language, scope, and project conventions. Without a project
rule, use a descriptive title and proportionate prose; do not impose Conventional
Commits, a character limit, or mandatory headings. Do not create project settings
just to apply this skill.

Identify the actual proposed change against its target branch. Use the current
diff, relevant code, conversation decisions, and observed verification results.
Distinguish committed changes from local work that will not be submitted. Use
existing PR or MR text as context, then reconcile it with the final change.
Resolve scope from available evidence; ask only if remaining ambiguity changes
what the description would claim.

Explain the concrete problem or purpose and resulting behavior. Include the
trigger and before/after outcome when they clarify a fix. Preserve reasoning
that the diff cannot show, including meaningful trade-offs or limitations.
Link related issues or designs and summarize the essential context inline.
Do not infer intent, successful tests, performance gains, or compatibility
guarantees from code alone.

## Write with Hope Write

Use Hope Write for drafting or editing the title and body through its public
contract at [Write](../write/SKILL.md). Load that skill and follow it in this
conversation; use the host's skill invocation mechanism when available. This
handoff is permitted without a separate user command. Provide the grounded
change, repository format, language, verification evidence, and any review focus.
PR Writing owns factual scope and completeness; Write owns clear expression
without changing those facts. Do not substitute reading only Write's shared
standard for using the skill.

The title should identify the changed behavior or repository result on its own.
Prefer a concrete action and target, including a condition when it matters.
Internal changes can name a dependency removed or responsibility moved. Avoid
generic summaries such as "Fix bugs" or "Improve performance". Use English
imperative wording when appropriate; write other languages naturally.

Keep the body proportional to the change. A small change can take a short
paragraph and relevant validation. Add detail when needed for a reviewer to
judge the approach, reproduce the change, or understand its consequences:

- Verification performed, its result, and material unverified behavior.
- UI before/after evidence and setup steps when helpful or required.
- Measured performance changes with workload, environment, and costs.
- Compatibility, migration, rollout, or release implications when applicable.
- A specific feedback request or reading order when review needs guidance.

Describe the final implementation, not the conversation chronology or a list
of every changed file. Preserve required template fields and meaningful links.
Use issue-closing keywords only when the submitted change resolves that issue.

## Return to the task

Check the title and body against the final diff and evidence once. Refresh them
if the implementation changes before submission. Return the requested draft or
use it in the already-authorized creation or update flow. Preserve the existing
target and publication state; do not open a duplicate request or add a separate
approval step merely because this skill was selected.

The adapted sources and their limits are in [Sources](references/sources.md).
