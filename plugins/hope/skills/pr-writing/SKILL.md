---
name: pr-writing
description: Write or update PR and MR titles and descriptions when creating or editing a pull request or merge request, including when the agent reaches that step during implementation. Use for requested drafts too, not review-only requests or standalone commit messages.
---

# Hope PR Writing

Apply when preparing a PR or MR title and description, whether the person asks
directly or the current authorized workflow reaches creation or update. Explicit
invocation is also supported. Work in the current conversation under the
surrounding task's authority to publish, push, or merge.

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

Ground the explanation in the concrete problem or purpose, resulting behavior,
and evidence a reviewer needs. Include reasoning the diff cannot show and
material verification limits. Select further context for the change: before/after
evidence, measurements, compatibility or rollout implications, related links,
or review focus. Do not infer intent, successful tests, performance gains, or
compatibility guarantees from code alone. Use issue-closing keywords only when
the submitted change resolves that issue.

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
Describe the final implementation with detail proportional to the review needs.
Preserve required template fields and meaningful links; leave wording and
structure to Write within those constraints.

## Return to the task

Check the title and body against the final diff and evidence once. Refresh them
if the implementation changes before submission. Return the requested draft or
use it in the already-authorized creation or update flow. Preserve the existing
target and publication state; do not open a duplicate request or add a separate
approval step merely because this skill was selected.

The adapted sources and their limits are in [Sources](references/sources.md).
