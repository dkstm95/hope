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
- [Invocation and execution](#invocation-and-execution)
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

## Invocation and execution

Loading the Hope Diff Skill does not by itself authorize a review.

The active host first reads the versioned invocation contract from the shared
Diff runtime.

That contract separates four outcomes:

- `answer` responds to a question or narrow request without starting a review;
- `confirm` asks one short question about a plausible but ambiguous full review;
- `execute` starts the complete Hope Diff workflow; and
- `cancel` clears a pending confirmation without starting a review.

The host decides from the meaning of the whole request and relevant
conversation state instead of matching one keyword, command mention, or
question mark.

The Claude and Codex plugins use the active host model for this decision.

They do not make a separate classifier call.

A harness natural-language entry may use a replaceable model adapter after the
harness has one.

It may use a different model from a plugin, but it must return the same decision
shape and pass the same evaluations.

A frontier model is not required for every classification.

Use a frontier-quality result as the initial baseline, then use the least costly
model that preserves the required multilingual and conversational behavior.

When the meaning remains uncertain, the classifier chooses `confirm` for a
plausible full review and otherwise chooses `answer` or `cancel`.

It does not guess `execute`.

Invocation classification needs the request, relevant conversation state,
pending confirmation state, and target metadata.

It does not need pull-request code.

A direct `$hope:diff` or `/hope:diff` invocation, a clear Hope Diff delegation,
or a clear request to review the whole pull request authorizes execution.

A pull-request number or URL identifies a target but does not by itself
authorize execution.

An explicit number resolves inside the current GitHub repository.

A feature question, capability question, quotation, documentation example,
narrow request, or explicit instruction not to run does not authorize a full
review.

Question grammar alone does not settle the result.

For example, a polite request to review a pull request can authorize execution,
while a question about whether Hope Diff supports that pull request does not.

A generic request to review a pull request first resolves one exact target with
the read-only `resolve-target` operation.

Target resolution does not collect the review snapshot or start Hope Diff.

The confirmation binds Hope Diff, that canonical pull-request target, a digest
of the source request, a digest of the target URL, and the confirmation count.

The Skill gives the exact source request and canonical target to the shared
`confirmation-create` command through one restricted private JSON input.

The command returns the pending state.

The Skill keeps that exact result and the source request in the current
conversation state instead of recreating the pending record.

After the person replies, the Skill gives the pending record, original source
request, classified decision, and any authorized new target to the shared
`confirmation-transition` command through a new restricted private input.

The transition re-hashes the original request and rejects pending state from a
different request.

The shared core therefore owns the pending-state shape and its deterministic
transitions on every supported entry path.

Every reply transition clears the pending state.

It then asks one question that names Hope Diff and the exact repository and pull
request number.

If the target cannot be resolved, Hope does not ask the execution confirmation
or start Diff.

It asks the person to make a new explicit request with a pull-request URL or
number.

A clear affirmative reply executes that pending review.

A rejection, unclear reply, topic change, or selection of another feature
cancels it without repeating the same confirmation.

A clear new Hope Diff delegation for another pull request clears the pending
confirmation and executes only the newly authorized target.

When that delegation supplies only a pull-request number, Hope keeps the
repository from the pending target and replaces only its number.

It passes one resulting canonical URL to `prepare`.

A failed `prepare` is reported without retrying another selector or repository.

A target-only reply clears the pending confirmation without execution or a
second confirmation.

After an affirmative reply, `prepare` receives the canonical URL stored in the
pending confirmation.

It must not run automatic target discovery and substitute another pull request.

The Skill must not call `prepare` or a snapshot, inspection, analysis, or
publication command before the decision is `execute`.

Each structured `hope diff` command explicitly selects its documented
operation and does not need natural-language classification.

The current independent harness reports that automatic natural-language work
is unavailable because it has no model adapter yet.

When that adapter is added, its natural-language entry must use this same
contract instead of adding a harness-specific policy.

### Invocation model evaluation

The version 3 evaluation baseline included representative decision cases in
`invocation-brief`.

Those examples were teaching input, not evidence that a model followed the
invocation contract.

Version 4 removed them from the active brief after the historical bounded
rules-only comparison and follow-up reported passing results.

The historical version 3 baseline keeps the examples so its records remain
auditable.

Diff therefore owns a separate blinded model-behavior evaluation for invocation
classification.

The evaluation checks only the model's `answer`, `confirm`, `execute`, or
`cancel` decision and a bounded reason.

Target resolution, pending-state transitions, and review authorization remain
separate deterministic boundaries.

The checked-in evaluation uses synthetic Korean and English requests, held-out
confirmation replies, and explicit non-execution cases.

It compares three instruction variants:

- `minimal` keeps the product boundary, decision vocabulary, confirmation
  boundary, failure policy, and output contract;
- `rules-only` adds the complete classification rules without published
  decision examples; and
- `full` uses the complete version 3 evaluation baseline with its published
  decision examples.

The conformance suite runs two complete-contract cases once.

The ablation suite runs three held-out cases twice under every variant.

The safety suite runs three complete-contract cases twice.

This produces 26 runs for one declared host, model, and effort.

List the exact matrix with:

```text
hope diff invocation-evaluation-plan
```

Prepare one blinded run with:

```text
hope diff invocation-evaluation-prepare \
  --case <id> --variant <minimal|rules-only|full> --run <number>
```

Give a fresh host only the returned `brief`, `hostInput`, and
`outputContract`.

Do not read the case oracle or give another variant to that host before it
returns one JSON object with `decision` and `reason`.

Bind that output to a record with:

```text
hope diff invocation-evaluation-record \
  --case <id> --variant <variant> --run <number> \
  --input <output.json> --host <id> --model <id> --effort <level> \
  --invocation <host-invocation-id>
```

Validate one record with `invocation-evaluation-validate` and the complete
array with `invocation-evaluation-validate-set`.

Record validation retains wrong decisions as failed model evidence instead of
discarding them.

A complete set must cover every planned run, use unique invocation identities,
and keep one host, model, and effort.

Store records under ignored `test-results/` or equivalent release evidence.

The repository's deterministic tests validate the protocol and record
bindings, but they do not claim to execute a host model.

Follow [model-evaluation.md](model-evaluation.md) before changing the production
invocation contract from these results.

When the first complete set makes `rules-only` a removal candidate, Diff uses a
separate example-removal follow-up instead of changing the original 26-run
evidence.

The first follow-up batch adds the eight conformance and safety runs that the
baseline did not execute under `rules-only`.

The second batch repeats all fourteen conformance, ablation, and safety runs
under `rules-only` in fresh contexts.

Together with the baseline's six `rules-only` runs, this gives 28 candidate
runs.

List and prepare the 22 new runs with
`invocation-example-removal-plan` and
`invocation-example-removal-prepare`.

Create and validate their records with the matching
`invocation-example-removal-record`, `-validate`, and `-validate-set`
commands.

`invocation-example-removal-validate-evidence` accepts one object containing
the original `baselineRecords` and new `followupRecords` arrays.

It returns `remove-examples` only when all 28 candidate runs pass under the same
declared host, model, effort, and contract version.

A valid failure returns `keep-examples` and remains part of the evidence.

The historical record calculation reported 28 rules-only candidate runs
without a failure, so version 4 became the production-verification candidate at
that time.

Those records predate the current trusted host-attestation and
complete-attempt gate and do not independently establish their Codex identity
or fresh-context execution.

Example-removal evidence does not verify the exact active brief because its
historical version 3 candidate includes evaluation-only control text.

Before release, list the eight exact-production runs with
`invocation-production-verification-plan`.

Prepare each run with `invocation-production-verification-prepare`, then create
and validate its record with the matching `-record`, `-validate`, and
`-validate-set` commands.

Each prepared run contains the exact active version 4 brief.

It contains neither published examples nor evaluation-only control text.

Release the active brief only when the complete set returns
`accept-active-brief`.

A failed decision returns `do-not-release` and remains part of the evidence.

The historical production record calculation reported all eight cases passing
with the exact active version 4 brief, so version 4 keeps the rules and omits
the examples as a historical product state.

That result is not release evidence under the current model-evaluation policy
and cannot authorize another prompt removal.

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

Private run storage protects against other local users, accidental corruption,
partial writes, and stale Hope processes.

Every state change uses one fenced lease.

Checkpoint records are immutable and joined by a digest chain.

This boundary trusts the local Hope process and operating-system account.

It does not claim to stop malicious code that already controls that same
account from rewriting both a record and its trusted state.

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

The first inspection generation contains the change sources.

The active host receives a byte-bounded window containing one or more ordered
pages.

It must submit one page-local checkpoint entry for every page in that window
before it can read another window.

A successful checkpoint-window transition returns the next inspection window
in the same runtime invocation.

Hope validates every entry in the submitted window before committing new
state.

It then commits each page as a separate immutable record and advances the digest
chain one page at a time.

If a process stops during those commits, a retry verifies the already committed
prefix and resumes only the uncommitted suffix.

The host uses that returned window for normal advancement instead of starting a
separate inspection invocation.

The explicit single-page inspection and checkpoint commands remain available
after repeated window truncation or for compatibility.

Repeating a committed checkpoint window verifies the committed prefix and
replays the outstanding next window when one exists.

A checkpoint may record page-local facts, risks, and questions.

Every observation cites lines delivered on that page.

Hope validates those references and stores the checkpoint as one private,
immutable, digest-chained record.

The observation text is model-authored and remains untrusted.

Hope extracts the cited text from the bound snapshot when it presents the
ledger, so later analysis does not depend only on the host retaining every old
page in model context.

Only a checkpoint question may propose a repository-relative context path.

The path must appear in that question's cited source excerpt.

The runtime assigns that proposal a context request ID.

The active host can collect at most twelve such requests across the run.

Hope collects each selected file from the captured head or merge-base revision
and keeps it in the private snapshot as context evidence.

It preserves the existing snapshot prefix and ledger, then appends a new
inspection generation that contains only the new context sources and limits.

The context transition returns the first page of that generation in the same
runtime invocation.

The host reads and checkpoints only those new pages.

The runtime does not keep a long-lived process between host commands.

Each checkpoint-window transition reads the manifest, a bounded page window,
and one bounded state summary.

It validates the whole window, adds one immutable checkpoint record per page,
hands off the next window, and exits.

It may repeat this question, request, and append cycle while the shared file and
byte limits permit it.

This bounded path does not search the repository or accept a path that is not
grounded in a checkpointed question.

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

A window keeps every page envelope and source boundary distinct.

Source IDs and line ranges remain distinct.

Before analysis, every delivered page must have one durable checkpoint.

The active host reads every bounded analysis-ledger page, including
Hope-extracted evidence excerpts, and checks its model-authored notes against
those excerpts.

The durable audit ledger keeps every checkpoint.

The model-facing analysis view reports complete checkpoint coverage but omits
empty checkpoint bodies.

It places each remaining checkpoint before its related evidence excerpts.

Each analysis-ledger page includes the excerpts cited by its checkpoints.

The view removes a repeated excerpt only within that page, so a later page does
not depend on an earlier page for the cited source text.

Context generations never remove earlier checkpoints or require earlier pages
to be read again.

Checkpoint and context transitions hand off their next window without a
separate inspection process.

This reduces process startup and repeated run loading while preserving explicit
page order, replay, and crash recovery.

Hope reports these content-free processing details:

- planned inspection pages and serialized bytes;
- source bytes;
- durable checkpoint, observation, and context-request bounds;
- actual analysis-file and canonical JSON bytes;
- evidence counts;
- the teaching-aid decision and per-aid inclusion counts; and
- artifact bytes.

These counters support comparison, diagnosis, and aggregate checks for an aid
that is never selected.

They are not model token counts or proof that a host received every planned
page.

Record exact input or output tokens only when the active host supplies them.

Durable review memory is also bounded:

- 32 KiB for one checkpoint submission;
- four pages and 32 KiB of serialized inspection data for one window;
- 128 KiB for one checkpoint-window submission;
- 8 observations per checkpoint and 256 across the run;
- 96 KiB of model-authored checkpoint notes;
- 96 KiB and 1,200 lines of cited checkpoint excerpts;
- 12 context requests;
- 256 KiB for the reconstructed ledger; and
- 24 KiB for one model-facing ledger page.

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

Snapshot and run identity errors fail immediately.

After identity succeeds, Hope returns independent analysis contract errors
together with stable codes and JSON paths.

Correct them together and repeat the preflight without collecting the pull
request again.

Hope derives each code step's exact file IDs from its validated code evidence
when the analysis omits the compatibility field.

A supplied field must still match the derived set exactly.

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
