<!-- Generated from docs/polish.md. Do not edit. -->

# Hope polish

Hope polish refines a named work product after its main decisions are settled.

It can simplify code, tests, documentation, comments, examples, error messages,
and other results.

It may merge duplicates or remove content when the run can show why the content
is unnecessary.

Polish changes the work product.

Toxic Review reports material problems.

Write owns the shared language standard.

These features may inform one another, but they do not share the same result or
state.

## Product boundary

Polish works on one exact snapshot.

The target may contain one or more conversation, Git, file, URL, or artifact
sources.

A Git source needs a full object ID or content digest.

Every other source needs a content digest.

Mutable names such as `main`, `latest`, and `current` are not identities.

Each run records:

- the target purpose and exact source identities;
- what is in and out of scope;
- a maximum number of changes;
- conditions that the revision must preserve;
- one run-specific edit plan;
- the evidence, reason, risk, and verification for every change;
- an exact output snapshot or an exact list of removed target IDs;
- a change summary and unresolved items;
- verification receipts with their checked scope; and
- whether a revision is proposed, applied, or not needed.

A version 2 run may also record one generic composition block supplied by a
caller such as Sweep.

The block binds the caller, session, work unit, execution contract, and
authority receipt digests without making Polish import that caller.

Polish does not intentionally change observable behavior, a public contract,
core meaning, facts, uncertainty, citations, or voice.

A person may request one of those changes, but that is a new task rather than
hidden polishing.

When the boundary is ambiguous, Polish stops with `needs-alignment`.

## Run-specific plan

The active AI builds the plan from the target purpose, the person's intent,
authoritative project rules, and available verification.

Version 2 does not ship separate code, document, or comment checklists.

Those lists can anchor a model on finding work even when no change is needed.

They also duplicate rules owned by a repository, formatter, linter, or Write.

Common cleanup ideas remain useful as examples and evaluation cases.

They are not required work.

Repeated heuristics may become optional, versioned profiles after real runs show
that they improve results.

Every planned change names:

- the exact part to change;
- the proposed action and reason;
- supporting source IDs;
- the preservation conditions it affects;
- the verification that will check it; and
- the change risk.

The completed change keeps those links.

A revision has exactly one completed change per plan item.

The validator rejects a plan or result that exceeds the run's change budget.

## Removal and consolidation

Removing or merging content is allowed only when the captured evidence supports
the claim that it is unnecessary or duplicative.

Similar-looking tests may cover different edges.

Repeated documentation may be deliberate.

Apparently unused code may serve compatibility or an external caller.

When the run cannot establish the reason for removal, it keeps the content or
returns `needs-alignment`.

Visible reduction is not a success measure.

`no-change` is a complete and valid result.

## Revision and application

Polish performs one plan and one modification round for an exact snapshot.

It produces a new revision and summary before application.

A revised result contains every surviving target in its output snapshot and
lists every deleted target in `removedSourceIds`.

The output snapshot is `null` when all targets were removed.

Polish never invents an output identity for deleted content.

A no-change output keeps every target identity unchanged.

Applying a revision needs explicit authority, a before-and-after comparison, and
identity checks before and after application.

An applied result cites at least one conversation source that authorizes the
write.

A proposed result records the comparison but does not claim that the revision is
present in the target.

A host stops when the locator changes, when a digest-backed target loses its
digest, or when the target content changed after capture.

The application record is an auditable host claim, not cryptographic proof that
a write occurred.

Version 2 does not automatically commit, push, open a pull request, or merge.

It does not attempt to roll back later edits that it cannot prove it owns.

## Verification

Each receipt records a method, status, scope, detail, and evidence sources.

Statuses are:

- `passed`;
- `failed`;
- `inconclusive`; and
- `not-run`.

The runtime derives one of these results:

- `verified-in-checked-scope` when every recorded check passed;
- `incomplete` when any check was inconclusive or not run;
- `failed` when any check failed; or
- `not-completed` when the run needs alignment.

Passing tests or inspection do not prove complete semantic preservation.

The result names only the scope it checked and keeps missing coverage visible.

The shared runtime can create one version 1 Polish receipt from a validated
version 2 run.

The receipt embeds the normalized run, derives its result, and binds both with
a digest.

Composition callers revalidate that receipt instead of accepting a
caller-authored summary of Polish work.

Version 1 run records remain readable for compatibility, but only version 2 can
represent deletion and produce a composition receipt.

## Timing and composition

General Polish runs when a person asks for it.

The best default time is after the main implementation or drafting work and
before final approval.

That placement gives Polish a stable target while keeping its cleanup separate
from new behavior.

Align and Sweep are the deliberate composition callers.

After Align has closed its material questions and the runtime reports a
contract-ready approval candidate, the Align host invokes Polish once for that
exact candidate.

The pass may clarify, deduplicate, or reorganize the candidate, but it must
preserve facts, sources, decisions, uncertainties, and meaning.

Align validates the revised state again before asking for approval.

A user change creates a new candidate and may receive one new pass.

Sweep invokes Polish only after the person approves one exact, digest-bound,
behavior-preserving work unit.

Its completion validator requires the Polish composition block and checks the
approved action, preview, preservation conditions, and verification methods
against the run.

Sweep owns repository discovery, category status, prioritization, the approval
candidate, and the final session result.

Polish owns the bounded revision and its preservation and verification record.

If Polish returns `needs-alignment`, Sweep does not apply the candidate and
records a handoff or another honest terminal state.

The dependency directions are `Align -> Polish` and `Sweep -> Polish`.

Polish never invokes Align or Sweep.

It returns `needs-alignment` when it discovers a material choice.

Diff and Toxic Review do not automatically polish their own outputs.

A person may start a separate Polish run and use an exact Diff snapshot or
adjudicated Toxic Review result as evidence.

A standalone language-only drafting, editing, or review request belongs to Write
unless the person explicitly asks for the full Polish contract.

Polish owns a bounded revision of a named completed work product, including
structural cleanup, refactoring, consolidation, and supported removal.

It consumes Write's shared standard when that revision contains language.

Write does not invoke Polish, and Polish does not add a second standalone Write
pass.

## Two entry paths

The Claude and Codex Skills use the active host session to inspect a target,
create the run-specific plan, make one bounded revision, and verify it.

They ask the generated runtime for the complete contract and validate one
private run record before presenting the result.

The independent harness exposes the same feature as `hope polish`.

Its internal `brief`, `validate`, and `receipt` commands reach the shared core.

Automatic polishing reports that the harness model adapter is unavailable until
one exists.

Version 2 has no separate graphical interface.

## Design sources

Spring Boot uses follow-up commits named “Polish” for changes such as tightening
an earlier fix, improving Javadoc, and strengthening tests.

That history influenced the placement of Polish after the main work, not its
target scope.

Examples include [tightening a zero-length buffer fix][spring-buffer], [refining
Javadoc][spring-javadoc], and [strengthening AOT tests][spring-tests].

Google's [code review guidance][google-review] influenced the separation of
functional changes from broad style changes and the refusal to treat personal
style preferences as blockers.

GitHub's [Copilot code review workflow][github-review] shows that review can run
manually or on pushes and that suggested fixes remain separately applicable.

Hope uses those sources as context, not as product authority.

[google-review]: https://google.github.io/eng-practices/review/reviewer/looking-for.html
[github-review]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review
[spring-buffer]: https://github.com/spring-projects/spring-boot/commit/c5a50cb7f66124dbc1f3070ca429d174b2dc7a9b
[spring-javadoc]: https://github.com/spring-projects/spring-boot/commit/08e2cab6b0aedd9ffa8536b9725cd809f4793df7
[spring-tests]: https://github.com/spring-projects/spring-boot/commit/d489aa685c6270773026daebd83ebb7b3f3acb06
