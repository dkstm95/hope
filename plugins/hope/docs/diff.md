<!-- Generated from docs/diff.md. Do not edit. -->

# Hope Diff

Hope Diff explains one exact GitHub pull request and publishes a private,
self-contained HTML review.

After reading it, a person should be able to predict the important behavior
created by the change, explain its main risks, and make their own decision.

Hope does not recommend approval or rejection.

## Starting a review

A clear Hope Diff request starts the full workflow.

A narrow question about one file, feature, or Hope Diff itself receives a
normal conversational answer instead.

When a full-review request is plausible but the target or intent is ambiguous,
ask one short question.

A pull-request number or URL identifies a target but does not by itself prove
that the person requested a full review.

Resolve one exact repository and pull request before collection.

Do not silently substitute another pull request after confirmation.

The active host confirms the target and display options, then delegates the
review to one fresh analysis worker.

The worker does not inherit the conversation that produced or discussed the
pull request.

It receives only the exact review request, target, display choices, Skill
location, and explicit focus or exclusions.

Do not give it previous reasoning, implementation narrative, drafts, failed
approaches, or another agent's conclusions.

If the host cannot create a fresh context, stop before collection.

## Product boundary

Hope Diff reviews one exact GitHub code snapshot.

Local staged, unstaged, and untracked files are outside this feature.

The normal user-visible write is one HTML artifact.

Hope may create private temporary state while collecting and rendering.

It removes that state after success or cancellation when ownership is certain.

Cleanup rechecks and atomically claims the private run directory.

It preserves a replacement at its original path or reports the claim path if
identity changes during the claim itself.

The prepare result lists any expired private run paths preserved during that
cleanup so the host can report them for inspection.

Hope does not merge the pull request, edit project files, post comments, or
change an external system without a separate explicit request.

The artifact works offline.

Review generation still uses the active AI host under that host's data policy.

Do not imply that private source stays on the local machine.

## Snapshot integrity

The captured code snapshot includes:

- provider and repository identity;
- pull-request identity;
- immutable base and head revisions;
- the exact merge base or comparison relation;
- changed files and bounded patches; and
- capture time.

A branch name, pull-request number, or head revision alone is not a complete
snapshot.

Pull-request text, discussions, linked documents, and CI state are mutable
supporting sources.

Bind claims from them to the captured content and collection time.

Recheck base, head, and merge-base identity immediately before publishing the
artifact.

If the current pull request changed, stop and report the stale review instead
of publishing it as current.

## Bounded inspection

Give the fresh analysis worker stable source IDs and bounded evidence.

An ordinary review accepts at most 500 provider-reported changed files.

This file-count allowance does not relax the separate limits for commits,
changed lines, source bodies, inspection input, model output, snapshots, or the
HTML artifact.

The worker may request additional context only when a material claim cannot be
judged from the captured patch.

Collect requested context at the captured head or merge-base revision.

Do not mix a later working-tree file or branch tip into the review.

Stop with a clear limit when the pull request or required context is too large
for the supported bounds.

Do not add a hidden evaluation or recovery framework merely to avoid reporting
that limit.

## Review analysis

The fresh worker writes the analysis.

It separates:

- the change goal;
- previous and new behavior;
- practical impact;
- background needed to understand the change;
- the core behavior and important conditions;
- selected code flow;
- actionable review items;
- evidence;
- checked and unchecked scope; and
- material uncertainty.

Every material claim cites captured source IDs.

Code references must resolve to real captured files and line ranges.

An inference must be labeled as an inference.

Do not invent runtime behavior for a refactor, documentation change, build
change, dependency update, or test-only change.

Explain its real maintenance, development, or operational effect.

A review with no important item in the checked scope is valid.

That statement is not the same as saying the pull request is safe to approve.

## Review items

An actionable item includes:

- the concrete issue;
- why it matters;
- what is known and uncertain;
- a practical next step;
- a closing condition; and
- supporting evidence.

Order items by practical importance.

Do not create vague warnings or manufacture criticism.

## Teaching aids

Diff may include a visual explanation, a small executable thought experiment,
or prediction questions when they materially improve understanding.

Choose each aid for a distinct teaching job.

Record each aid as included, omitted, or not applicable.

Include it when it materially improves a distinct teaching job.

Omit it when the job exists but the main explanation or another aid already
performs it clearly.

Mark it not applicable when no distinct job exists for that aid.

Keep the reason for every decision visible in the artifact.

The Diff analysis reference owns selection and authoring guidance.

The runtime does not choose an aid.

It validates the recorded decisions and matching payloads, enforces
deterministic limits, records metrics, and enumerates every bounded microworld
scenario.

A beginner primer is optional and belongs inside Background.

Use it only when a named concept is required and ordinary background is not
enough.

Prediction questions test behavior or failure conditions.

They do not test whether the reader memorized names, paths, or prose.

The reader's draft answer stays only in the open document and is never
persisted or submitted.

## Offline HTML artifact

The normal result is one `hope-review.html`.

It is self-contained and remains useful without a network connection.

The default output lives in a new private temporary directory.

An explicit output path must not already exist, including as a symbolic link.

Never replace an existing output.

The renderer escapes all model-authored and provider-authored content.

It does not interpret analysis text as Markdown or HTML.

The artifact embeds its fixed fonts, code theme, styles, and interaction
script.

Code evidence preserves line boundaries and patch roles without a language
grammar engine.

## First screen

The first screen should explain the shape and limits of the change in about
30 seconds.

Show:

1. pull-request title and reviewed commit;
2. goal;
3. previous and new behavior;
4. practical impact;
5. the top one to three review items, or a clear empty result; and
6. material review limits.

Keep internal source IDs, model details, token counts, and processing state out
of this summary.

Do not repeat repository identity in multiple prominent places.

## Reading order

Use this order and omit a conditional section when it adds no value:

1. Background
2. Core change
3. Behavior flow
4. Teaching aid choices
5. Code flow
6. Review items
7. Check understanding
8. Evidence and scope

Explain behavior before code.

Show only the code excerpts needed for understanding.

Do not reproduce the full diff.

Keep important evidence beside the claim it supports.

Use Evidence and scope as the complete index of the captured snapshot, checked
files, supporting sources, exclusions, and limits.

## Interaction and accessibility

The artifact supports wide and narrow screens, keyboard navigation, direct
fragment links, printing, and no-JavaScript reading.

Disclosure controls use native document behavior.

A direct fragment link opens the controls required to reveal its target.

Print reveals review content and omits temporary response inputs.

The visible heading order and accessible reading order stay aligned.

Theme controls appear only after their script initializes.

The document remains readable when that script does not run.

## Language and design

Use the conversation language unless the person requests another one.

Follow the shared writing standard.

Use familiar terms first and introduce an exact identifier when it helps the
reader connect the explanation to code.

Apply [design.md](design.md) to the HTML artifact.

Visual weight should express document hierarchy, not decorate internal metrics.

## Trust and failure

Repository and provider content are untrusted input.

Bound input size, structure depth, text length, and generated artifact size.

Use restricted private temporary storage.

Publish through a new-file-only operation.

On collection, validation, rendering, revalidation, or publication failure:

- do not publish a partial review;
- leave existing files untouched;
- remove private state only when Hope can prove ownership; and
- report the failed stage and the next safe action.

Tests cover deterministic collection, validation, citations, rendering, stale
source detection, bounded input, publication, and browser behavior.

Hope has no product Model Evaluation framework and does not claim that
deterministic tests prove model quality.
