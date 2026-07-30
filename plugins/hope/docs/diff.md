<!-- Generated from docs/diff.md. Do not edit. -->

# Hope diff

This file defines Hope diff.

It states what the feature must help a person understand and what it must not
claim.

The harness, plugins, skills, and future implementation must follow this
definition instead of creating their own.

The current implementation delivers this contract through the Claude and Codex
skill.

The independent harness shares collection, settings, validation, rendering, and
lifecycle code.

It stops honestly before AI analysis until a harness model adapter is added.

- [Purpose](#purpose)
- [Product boundary](#product-boundary)
- [Snapshot integrity](#snapshot-integrity)
- [One review artifact](#one-review-artifact)
- [First screen](#first-screen)
- [Reading order](#reading-order)
- [Context to inspect](#context-to-inspect)
- [Review result](#review-result)
- [Review items](#review-items)
- [Evidence and uncertainty](#evidence-and-uncertainty)
- [Coverage and failure](#coverage-and-failure)
- [Teaching aids](#teaching-aids)
- [Optional verification](#optional-verification)
- [Sharing and interaction](#sharing-and-interaction)
- [Language and design](#language-and-design)
- [Trust and lifecycle](#trust-and-lifecycle)
- [Source and Hope decisions](#source-and-hope-decisions)

## Purpose

Hope diff helps a person:

1. understand what a code change changes and how;
2. judge the current change from that understanding; and
3. use that understanding in later work.

After reading the review, the person should be able to predict the result of
the change, explain its important ideas and risks, and make an informed
judgment.

Understanding belongs to the person.

The review is not hidden, long-term AI memory.

## Product boundary

Hope reviews one exact change snapshot.

GitHub pull requests are the first input, but the contract is provider-neutral.

Local staged, unstaged, and untracked files are outside the review.

The normal artifact is the only user-visible local write.

Hope may use private temporary state while it works, but must remove that state
at the end.

Unless the person selects a repository path, Hope creates the artifact outside
the repository.

Hope does not merge the pull request, change other project files, post comments,
or update an external system without a separate, explicit action.

The artifact works offline, but generation may not be local-only.

Content needed for the review is processed in the active Claude or Codex session
under the person's host and account policy.

Hope must not imply that private source stays on the local machine.

## Snapshot integrity

An exact code snapshot includes:

- the provider and repository identity;
- immutable base and head revisions; and
- the exact merge base or comparison relation used to list the change.

A branch name, pull request number, or head revision alone is not enough.

A request for the current pull request fails if its target changes during
generation.

Hope revalidates the target immediately before the completed local artifact
becomes visible.

An explicitly requested historical snapshot remains valid as history, but Hope
must not describe it as the current pull request.

Pull request text, discussions, issues, linked documents, and CI state can
change without a code revision.

Bind claims from these sources to the captured content, source identity, and
collection time.

Do not present them as immutable parts of the code snapshot.

The first screen shows the reviewed head revision with the compact label
**Commit** and its capture time.

A short head hash identifies that commit; it must not be labeled as the whole
snapshot.

The full base, head, merge-base, repository, and capture details remain in
artifact details.

## One review artifact

The normal result is one self-contained `hope-review.html`.

It explains one snapshot.

It is not a cache, task database, or second project source of truth.

The default artifact lives in a new private temporary folder.

An explicit output target must not already exist, including as a symbolic link.

If it does, leave it untouched and explain how to select a new destination.

The review never recommends approval or rejection.

This remains true when a person asks for a recommendation.

Hope provides the facts, review items, evidence, and limits needed for the
person to decide.

These statements are not the same:

- “No important item was found in the checked scope” describes the review.
- “This pull request is safe to approve” is an approval recommendation and must
  not appear.

## First screen

The first screen shows the shape and limits of the change in about 30 seconds.

Its summary card starts with the pull request title, reviewed head commit, and
capture time.

The capture time is when Hope captured the pull request inputs, not the commit
date or HTML creation time.

Follow that identity with information in this order:

1. **Goal** — the result the change is trying to create.
2. **AS-IS and TO-BE** — a short previous and new explanation.
3. **Impact** — the effect on a person, caller, system, process, or
   data.
4. **Review items** — the top one to three items, or a clear empty result.
5. **Review limits** — each material effect, only when at least one exists.

The first screen is a short synopsis.

Do not show a separate visible **Summary** heading above the pull request title.

Keep **Summary** as the table of contents label and as an accessible section
name.

The main explanation lives in **Core change**.

Group long lists and link to their full explanation.

Make the change itself easy to compare.

On a wide screen, place **AS-IS** and **TO-BE** beside each other with one
directional cue between them.

On a narrow screen, stack the same content in the same order and turn the cue
downward.

The cue is visual help only; the headings and document order must carry the same
meaning without it.

Give **Goal** and **Impact** distinct visual weight without adding another
status, count, or dashboard layer.

Show repository and pull request identity once in the product bar.

Do not repeat it under the artifact title.

Each review-item preview already names its kind and importance, so do not add a
representative status, total, or kind counts above the previews.

Show `No important item found in the checked scope` only when there are no
items.

Show concrete material scope limits without a generic `limited` badge.

Omit the first-screen scope row when there are no limits.

A top-item preview contains kind, importance, and title.

Its explanation, effect, action, closing condition, and evidence belong in the
full item.

A change may intentionally leave runtime behavior unchanged.

For a refactor, documentation change, build change, dependency update, or
test-only change, say so and explain its maintenance, development, or
operational effect.

Do not invent a runtime before and after.

File counts, changed-line counts, commit counts, model names, and internal
processing facts are secondary details.

Internal reference IDs such as `source-7`, `file-2`, and `limit-1` belong only
to the analysis protocol.

User-facing prose names the file, component, behavior, or limitation instead.

## Reading order

Keep this order across reviews.

Omit a conditional section when it does not help this change.

| Order | Section | Show when |
| --- | --- | --- |
| 1 | Background | Existing behavior, terms, or components are needed. |
| 2 | Core change | Always. |
| 3 | Behavior flow | A flow, branch, state change, comparison, or experiment helps. |
| 4 | Teaching aid choices | Always. |
| 5 | Code flow | Selected implementation detail adds useful understanding. |
| 6 | Review items | At least one actionable review item exists. |
| 7 | Check understanding | Prediction questions add learning value. |
| 8 | Evidence and scope | Always. |

On a long review, the product bar and wide-screen contents may stay visible
while the document scrolls.

Mark the section currently being read in the contents.

This marker is navigation state, not review status.

A contents link must reveal a collapsed target when needed and move keyboard
focus to that target.

### Background

Explain only the existing behavior, ideas, and components needed for this
change.

Do not teach the whole system.

### Core change

Use the required core details to explain how the change works, which conditions
matter, and what result they create.

Do not repeat the synopsis's **Goal**, **AS-IS**, **TO-BE**, or **Impact**
claims.

Lead with behavior or practical effect, not file names.

### Behavior flow

Explain behavior before code.

Use a flow, conditions and results, state change, comparison, or small
experiment only when it makes the result easier to predict.

### Teaching aid choices

Show the visual, microworld, and quiz decisions in a fixed order.

Keep all three visible when none is included.

Show a reason for every current decision and the separate teaching job for each
included aid.

### Code flow

Explain code in the order that creates understanding, not file-name or diff
order.

Show only the excerpts needed for each step.

Do not repeat the full diff.

### Review items

Show actionable review items.

State what is known, why it matters, the next step, the closing condition, and
the evidence.

Avoid vague warnings.

### Check understanding

Ask the reader to predict behavior, preserve an important condition, or find a
failure case.

Do not ask for names, paths, or copied sentences.

The quiz is not a merge gate.

Each question uses a two-step self-check:

1. Opening the question shows an optional response box. Its placeholder gives
   the prompt, so the interface does not repeat a visible label such as **My
   answer** or **Selection**. The box still has an accessible name.
2. A separate **Show answer and evidence** disclosure reveals the answer,
   explanation, and supporting evidence.

The response stays only in the open document.

Hope does not submit or persist it, and print output omits it.

The reader can reveal the answer without typing or meeting a minimum length.

### Evidence and scope

Show the exact code snapshot, captured supporting sources, checked files,
material sources not checked, and resulting limits.

Keep important evidence beside the claim it supports.

This section is an index, not the only evidence location.

Treat this dense index as an appendix.

Keep the section open initially so its groups are visible without another
action.

Each source group, context check, scope limit, checked-file group, and
artifact-detail group starts closed and can be opened independently.

A direct link opens every control needed to reveal its target.

Do not list a changed file once as a captured patch and again as a checked file.

Join file sources to the changed-file row by stable file ID.

Keep pull request text, commit titles, and other sources without a changed-file
ID in a small separate source table.

Show checked and not-applicable context in the context group.

Show a limited context with the scope limits it accounts for instead of
repeating it in both groups.

Group limits that share the same stable reason and material state, while
preserving every subject, impact, link target, and file disposition in
independently expandable details.

## Context to inspect

A diff is not always enough.

Start with concrete questions:

- What did the author or change source say the goal was?
- How did the changed code work before and after?
- Can direct callers and callees handle the new state?
- Do related types, settings, tests, or examples change the meaning?
- What did CI actually run for this code snapshot?

Inspect only the relevant pull request text, commit titles, code versions, call
sites, types, settings, tests, examples, and exact-revision CI needed to answer
those questions.

The first inspection plan contains the change sources.

After reading it, the active host may request at most twelve concrete
repository-relative context files whose paths are grounded in those sources.

Hope collects each file from the captured head or merge-base revision and keeps
it in the private snapshot as context evidence.

It atomically replaces the inspection plan before analysis, and the host reads
the new plan from the beginning.

This bounded path does not search the repository or guess an ungrounded path.

Context that Hope still cannot collect remains an explicit scope limit.

When a material question remains, follow directly linked issues, specs, design
documents, discussions, one more relevant call step, migrations, schemas,
deployment settings, or project documents.

Do not explore unrelated code, unlinked history, arbitrary web results, local
uncommitted changes, or similar implementations without a grounded reason.

Compare source claims with the changed-file map and collected code.

The snapshot may contradict a claim about a file, behavior, or verification
result in a pull request description or commit title.

Make that mismatch a review item when it could change the reader's understanding
or decision.

Do not let a smooth code explanation hide stale or contradictory source text.

Keep two code-source roles distinct:

- **Change evidence** shows what this change modified.
- **Context evidence** shows unchanged code used to understand its effect.

Account for a relevant context category as checked, not applicable, or a scope
limit.

An issue or discussion can support intent or context.

It does not prove runtime behavior.

## Review result

A review can contain several item kinds at once.

Keep three things separate inside the validated review model:

- all review items;
- a review status derived from their kinds; and
- a scope status derived from known limits.

Derive the review status in this order:

```text
At least one Resolve item   -> Action needed
Else, at least one Decide   -> Decision needed
Else, at least one Verify   -> Verification needed
No items                    -> No important item found in the checked scope
```

The derived status and counts support validation and future integrations.

Do not show them as a first-screen dashboard.

Sort the visible item previews by importance and action.

Show up to three and link to the remaining count.

Limited scope must not hide a found item.

A found item must not make the scope look sufficient.

## Review items

Use only three user-facing kinds.

Classify by the next action.

- **Resolve** — current evidence shows that a concrete change is needed.
- **Decide** — a requirement, intent, policy, or trade-off must be chosen.
- **Verify** — a test, reproduction, code check, or other source is needed to
  resolve an uncertainty.

A known risk is not always Resolve.

Use Decide when accepting it is a human trade-off.

Use Verify when the risk itself is not established.

Every item identifies its kind, importance, issue, effect, next action, closing
condition, basis, and supporting evidence.

Finding a failure can meet the closing condition.

That closes the uncertainty and may create a new Resolve item.

Do not assign a decision owner.

Mention a responsible person only when a source clearly identifies one.

`CODEOWNERS` does not prove decision authority.

Importance means the effect of ignoring an item.

It does not mean confidence, effort, or item kind.

- **High** — possible security or privacy harm, data loss, core failure,
  difficult recovery, broad impact, or failure of the change's main goal.
- **Medium** — real but limited or recoverable impact, such as a conditional
  error, compatibility problem, important test gap, or maintenance cost.
- **Low** — a local issue with no effect on the core result.

Do not keep taste-based style comments as Low items.

Sort by importance, then Resolve before Decide before Verify, then closeness to
the main change.

Show only the top one to three items on the first screen.

## Evidence and uncertainty

Use one basis vocabulary for important claims:

- **Stated in source**
- **Shown in code**
- **Observed in execution**
- **Inferred from evidence**
- **Could not confirm**

A purpose uses **Stated in source**, **Inferred from evidence**, or **Could not
confirm**.

Always show the exact source, such as the pull request description or a commit
message.

Do not assign a statement to the pull request author unless that identity is
established.

Show a basis for each purpose, important behavior or effect claim, review item,
execution result, inference, and uncertainty.

Ordinary connecting sentences do not need a badge.

Keep the short basis beside the claim.

Let the reader expand it to see its source type, identity or path, capture time
when needed, and a small excerpt.

Each review item has its own evidence control.

One evidence excerpt contains at most 24 lines.

Reuse a stable evidence target when several claims cite the same source range
instead of embedding the same code repeatedly.

Keep these boundaries clear:

- Pull request text supports a stated goal, not actual behavior.
- Code supports an implementation claim, not an execution result.
- A test or execution supports observed conditions, not every condition.
- An excerpt must support every material part of the claim that cites it.

**Observed in execution** is reserved for a trusted execution or exact-revision
CI record collected by Hope.

The current model-authored analysis cannot create that basis.

Do not repeat one concern as both a review item and a question.

A scope limit is an inspection-boundary fact.

Add a Verify item only when a concrete, useful follow-up can resolve the
uncertainty.

The analysis references the limit by its internal ID, and the renderer creates
the user-facing link.

The item describes the action instead of restating the limit.

## Coverage and failure

A generated review has one of two scope statuses:

- **Scope sufficient** — no known omission limits a main explanation or
  judgment.
- **Scope limited** — at least one known omission limits a main explanation or
  judgment.

“Scope sufficient” does not mean Hope checked the whole repository, runtime,
discussion, or every possible execution.

Each scope limit states what Hope could not check, why, and what Hope therefore
cannot explain or judge.

The collector records every known unchecked input.

The analysis marks whether each omission materially limits a main explanation or
judgment.

It also explains why.

Only material omissions make the user-facing status **Scope limited**.

Non-material omissions remain visible in checked-scope details.

Account for every provider-reported changed file once as explained, supporting,
mechanical, metadata-only, or redacted.

A readable safe-text file must be explained, supporting, or mechanical.

No file may disappear silently.

Detected truncation, incomplete pagination, or a partial body counts as
unavailable content.

It cannot count as a fully inspected file.

When GitHub does not provide a text diff for a zero-line change, record the file
as metadata-only without requesting its body.

When a body is larger than Hope's safe text limit, record that deliberate safety
boundary as metadata-only.

Do not treat the file as inspected or abort an otherwise grounded review.

Both omissions remain visible.

The analysis must state whether they limit a main explanation or judgment.

A limited review can be created only when:

- the complete changed-file list is known;
- every readable changed file was fully collected and inspected;
- every unavailable body has a known, deliberate reason;
- checked and unchecked information stay separate;
- every claim stays within checked evidence; and
- missing information does not prevent a grounded explanation of the core
  change.

The review fails when:

- discovery or required collection is incomplete;
- a readable changed file was not inspected;
- the current target changed;
- Hope cannot tell what is missing; or
- the available evidence cannot explain the core change.

On failure, explain the cause and next step.

Do not create or expose an incomplete review, and do not replace an older valid
artifact.

Inspection pages may carry several short source chunks under one untrusted page
envelope.

Source IDs and line ranges remain distinct.

Hope reports these content-free processing details:

- planned inspection pages and serialized bytes;
- source bytes;
- actual analysis-file and canonical JSON bytes;
- evidence counts;
- the teaching-aid decision and per-aid inclusion counts; and
- artifact bytes.

These counters support comparison, diagnosis, and aggregate checks for an aid
that is never selected.

They are not model token counts or proof that a host received every planned
page.

Record exact input or output tokens only when the active host supplies them.

Reject an analysis before rendering when it exceeds any authoring limit:

- 128 KiB for the analysis file;
- 128 KiB for canonical JSON;
- 48 KiB of generated prose;
- 192 evidence references;
- 96 unique evidence ranges;
- 1,200 unique evidence lines;
- 96 KiB of unique excerpts; or
- 600 highlighted code-line occurrences across the distinct rendered ranges.

These are upper safety limits, not targets.

A useful review should stay substantially smaller and omit optional sections
that do not improve understanding.

Every run requires this resource policy.

## Teaching aids

Use a visual, interactive model, or quiz only when it makes a relationship
materially easier to understand.

Each aid needs a distinct teaching job.

Every analysis records one decision for the visual, microworld, and quiz.

Use `included` when the analysis contains the aid, `omitted` when the aid was
considered but prose or another aid already performs its teaching job, and
`not-applicable` when the change has no matching relationship or prediction.

Record a short reason for every decision.

An included aid also records its distinct teaching job.

The validator requires each decision to match the corresponding analysis
payload.

The artifact always shows all three decisions in **Teaching aid choices**.

It shows the reason for each decision and the distinct teaching job for each
included aid.

Keep this section when every aid is omitted so the person can distinguish an
intentional omission from a missing evaluation.

Choose the primary aid in this order:

1. Use a microworld for a small bounded input, condition, or state whose
   changes help the reader predict different outcomes.
2. Use a visual for a static flow, branch, interaction, or component
   relationship that prose alone makes hard to follow.
3. Use a quiz for one or more non-trivial predictions, preserved conditions,
   or failure cases that do not need an interactive model.

Several aids may appear only when each has a separate teaching job.

Do not add another aid to repeat the same relationship.

The runtime contract includes representative evaluation cases for bounded state,
a static relationship, a prediction without interaction, and prose-sufficient
behavior.

Generated plugin and harness preparation expose the same cases.

Aggregate the per-aid inclusion counters across evaluation runs so an aid that
is never selected is visible.

Use a flow for a sequence, a decision table for meaningful branches, a sequence
view for ordered interaction, and a component map for structure.

A visual clarifies prose; it does not decorate the page.

The review may contain one optional microworld as a visually separate **Try
it** block inside **Behavior flow**.

Use a microworld when changing an input, condition, or state helps the reader
predict the result.

State what evidence grounds it, what the model simplifies, and what it leaves
out.

The self-contained HTML uses a safe explanation model.

It does not execute repository code or present its output as a test result.

Use declarative explanation text only.

Do not put repository code, commands, expressions, URLs, or scripts in a
microworld.

Never claim that a microworld ran repository code or produced a test result.

The shared teaching-aid contract carries these authoring rules to every
supported host.

The model uses one to three controls and at most twelve complete control
combinations.

Before authoring scenario prose, give the controls to the shared runtime's
microworld-skeleton command.

It validates the controls and returns one stable scenario ID and condition list
for every combination.

The analysis adds the title, before and after traces, outcome, and lesson to
that skeleton.

An experiment that executes real code belongs to the harness, not this offline
artifact.

It needs its own isolated execution boundary.

Use one optional quiz with one to five evidence-backed questions only when
prediction adds value.

Give each answer a self-check explanation and evidence link.

Keep the reader's optional response separate from the answer.

Reveal the answer only through its own disclosure.

Do not add an aggregate score, pass threshold, or forced response.

## Optional verification

Test, build, and lint results can strengthen a review, but are not required for
every review.

Prefer exact-revision CI, then a targeted test, then lint or typecheck, and a
full test or build only when needed.

Identify the revision and source tree that actually ran.

A synthetic merge result is not a head-revision result.

A dirty, stale, or different tree cannot confirm a claim about the reviewed
snapshot.

Treat every repository-controlled command as untrusted, including standard test
scripts.

Run it only in an enforced disposable environment without ambient secrets,
external writes, or network access.

If Hope cannot enforce that boundary, ask for explicit approval of the concrete
exposure and effects.

Otherwise, do not run the command.

Normal read-only provider collection uses the authenticated host session.

Consent in this section applies to optional command execution and new external
effects.

Record the command, executed revision, environment, and result.

Distinguish not run, passed, failed, environment or tool failure, and a stale
result. “Failed” means the intended check ran and reported failure.

Setup, runner, and infrastructure problems do not prove a product failure.

Hope must not claim a test, build, lint, or CI result that it did not observe.

## Sharing and interaction

The first version supports shared understanding without becoming another work
tracker.

Provide one shareable HTML artifact, consistent terms, and stable section and
evidence IDs inside that artifact.

The first local-only version does not show a section-copy control because its
temporary path is not portable.

The review may let a person expand evidence, open a code location, use a
microworld, and answer a quiz.

The person can then share the artifact through an existing team space such as
GitHub or Notion.

Do not add Hope comments, assignments, completion state, checkboxes, or a task
database.

Do not publish automatically.

A future publish action must be explicit and show the exact content and
destination before changing an external system.

## Language and design

This file owns the diff review's information order and meaning.

[design.md](design.md) owns Hope's shared visual language.

The review uses one resolved locale:

1. an explicit one-run override;
2. the saved Hope setting;
3. a host or operating-system locale when no setting exists; or
4. `en-US`.

The first supported locales are `ko-KR` and `en-US`.

An ordinary request written in another language does not replace a saved
setting.

A one-run override does not update the setting.

Changing the locale of an existing artifact requires a new review.

Do not show a language badge in the header.

Record the resolved locale and its source in artifact details, set the HTML
`lang`, and show a visible warning only when Hope used a fallback.

Translate fixed labels through trusted shared locale files.

Preserve provider titles, paths, commands, code, and excerpts exactly in their
source and evidence surfaces.

Generated explanations use the resolved locale while keeping necessary source
terms unchanged.

Before analysis, the shared runtime returns Hope's current writing standard and
its version with the prepared run.

The active host follows that standard for every generated explanation, review
item, teaching aid, and quiz.

Diff's evidence, uncertainty, exact-source, and locale rules are more specific.

They take priority when simpler wording would change the meaning.

Generated explanations render as plain text.

Hope does not parse Markdown or HTML.

The analysis must not add formatting.

Analysis validation rejects backticks to prevent visible inline-code markers.

When exact syntax needs a backtick, show it in an evidence excerpt instead of
generated prose.

The review starts with the resolved `system`, `light`, or `dark` theme.

Its theme control changes only the open document and does not write Hope
settings or browser storage.

## Trust and lifecycle

Treat provider data, repository content, paths, excerpts, model output, and
URLs as untrusted.

The user-visible guarantees are:

- untrusted content stays inert;
- the artifact is self-contained and offline;
- the artifact never executes repository code;
- provider links use validated identity and trusted origins;
- an existing output is never overwritten;
- incomplete or stale current-target reviews are not exposed as current; and
- the same versioned and validated inputs render to the same bytes.

Revalidate a current target immediately before a completed local artifact
becomes visible and again before a later external publish action.

If the check fails, do not expose a new final artifact or change the external
destination.

Finalization needs the same authenticated provider access used for collection.

An entry adapter whose host grants network access per command must obtain that
access before its first finalization attempt.

If provider access fails during this pre-publication revalidation, keep the
exact private run and create no artifact.

After access is restored, finalization may retry from the same bound snapshot
and analysis.

It must not recollect the pull request, repeat inspection, or ask for a
rewritten analysis.

A confirmed snapshot change or invalid provider response remains terminal and
removes the run.

The retry error identifies the retained run and exact next operation so a later
session does not depend on conversation history.

Remove private collection and model files after normal success, terminal
failure, or cooperative cancellation.

A recoverable revalidation failure keeps the run only until finalization
succeeds, the person cancels, or expiry cleanup removes it.

A process crash or forced termination can prevent immediate cleanup.

Each run therefore needs an ownership record and restrictive permissions.

A later Hope invocation safely cleans up expired runs.

Never infer ownership from a directory name alone.

Validate drafted analysis before finalization.

This preflight is read-only: it does not render or publish an artifact.

It also does not change the run phase, consume a repair attempt, or delete the
run.

Correct clear contract errors and repeat the preflight without collecting the
pull request again.

Every run uses analysis contract version 2 and requires teaching-aid decisions.

Finalization validates the analysis again.

A failed final validation may keep the private run for one explicit repair
attempt.

The next final validation failure is terminal and removes it.

The HTML is a view of one snapshot.

After the pull request changes, its current status is unknown until an external
comparison is made.

Durable project knowledge is a separate, explicit workflow.

## Source and Hope decisions

This contract was influenced by Geoffrey Litt's [Understanding is the new
bottleneck](https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck.html).

The related [recorded talk](https://youtu.be/x3e_Yl4NNHY) is also a direct
source.

These sources support background before detail, intuition before code, literate
diffs, prediction questions, microworlds, and shared understanding.

Hope owns the product rules in this contract, including no approval
recommendation, the review and scope states, evidence language, failure
behavior, the offline artifact boundary, and the initial sharing scope.
