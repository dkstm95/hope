# Hope sweep

Hope sweep starts one full-codebase maintenance task when a person asks for it.

It captures an exact repository inventory, inspects that inventory in batches,
shows one merged plan, and changes only the work units that the person approves.

Sweep owns discovery, category status, prioritization, approval binding, and
the final session result.

Polish owns each approved behavior-preserving revision.

Sweep does not hide behavior, public-contract, or dependency changes inside a
cleanup.

## Product boundary

One invocation starts an inventory-backed discovery session and produces one
plan before any repository file changes.

The person does not choose a daily, weekly, monthly, yearly, or other public
profile.

Sweep adapts its plan to the repository while keeping the same category,
evidence, approval, and result contract.

The current automatic mode covers every Git-tracked and unignored untracked
regular file in the repository worktree.

This includes hidden files, production code, tests, documentation, configuration,
generated sources, package metadata, and other repository content.

Ignored dependencies, ignored build output, and `.git` metadata are outside this
inventory boundary.

Generated files may be inspected, but Sweep changes their editable source and
uses the repository build when the generated copy must change.

The current Sweep contract supports every check in the codebase maintenance
catalog.

The catalog is fixed by the shared runtime so every entry path uses the same
checks, evidence requirements, and execution boundary.

## Codebase maintenance categories

Every plan records these versioned categories in this order:

1. `integrity` for broken references, invalid configuration, and inconsistent
   generated outputs;
2. `unused-stale` for dead code and obsolete files, tests, documentation, and
   configuration;
3. `abstraction-structure` for repeated abstractions and missing or premature
   shared boundaries;
4. `tests-docs` for missing, stale, or misleading verification and guidance;
5. `dependencies-security-license-compatibility` for dependency, security,
   license, support, and compatibility lifecycle work;
6. `performance-package-ci` for performance, package, build, and CI waste; and
7. `architecture-support-release-recovery` for architecture drift, support
   policy, release safety, and recovery readiness.

A category records each check result, the ordered union of its evidence, and
every remaining gap.

Version 1 includes these checks:

| Category | Checks |
| --- | --- |
| `integrity` | `broken-references`, `configuration-drift`, `generated-drift` |
| `unused-stale` | `dead-code`, `stale-content` |
| `abstraction-structure` | `repeated-abstraction`, `missing-abstraction`, `premature-abstraction` |
| `tests-docs` | `test-gap`, `documentation-drift` |
| `dependencies-security-license-compatibility` | `dependency-risk`, `security-risk`, `license-risk`, `compatibility-risk` |
| `performance-package-ci` | `performance-waste`, `package-waste`, `ci-waste` |
| `architecture-support-release-recovery` | `architecture-drift`, `support-gap`, `release-gap`, `recovery-gap` |

Every check is `checked`, `partial`, `not-checked`, or `failed` within the
declared scope.

A category is `checked` only when all of its checks are `checked`.

`unsupported`, `not-checked`, `partial`, and `failed` are visible results rather
than aliases for success.

## Initial discovery and plan

The initial call captures an exact inventory before inspection.

The host inspects every inventory file in deterministic batches and merges the
batch coverage into one plan.

Candidate and change budgets remain explicit, but the host cannot lower a file
budget to stop the full-codebase inspection early.

It does not modify the repository during this phase.

The shared runtime validates one version 1 plan with:

- an exact work snapshot;
- one session ID, scope, state, and budget;
- an inventory digest, every inventory file source ID, and ordered inspection
  batches;
- every versioned category, check, support state, and inspection state;
- zero or more bounded candidates;
- exact target and evidence source IDs for each candidate;
- an exact change preview and maximum change count;
- the exact evidence contract for each candidate's maintenance check;
- verification steps and unresolved gaps; and
- an honest summary of the inventory count, checked scope, and remaining gaps.

`filesChecked` is the number of distinct file sources cited by inspected
checks.

The runtime derives that number and rejects a smaller or larger claim.

In the current `entire-codebase` scope, `maximumFiles` and `filesInInventory`
must equal the exact inventory file count, and complete coverage requires every
inventory file to appear in inspected-check evidence.

The runtime keeps the plan `blocked` while any inventory batch is partial,
not-checked, or failed.

The plan state is `awaiting-approval` only when at least one candidate is safe
for Polish.

It is `complete-with-findings` when findings remain but none can enter Polish.

It is `complete-no-change` only when every catalog check completed and found no
candidate.

It is `blocked` whenever full-codebase coverage is incomplete or discovery has
not produced enough evidence for an actionable result.

### Inventory and batches

The shared `inventory` command records one Git worktree source and one content
identity for every tracked or unignored untracked regular file.

The inventory digest binds the source list and identities without depending on
the capture time.

The host may divide the file source IDs into as many ordered batches as the
runtime allows, but every file must occur in exactly one batch.

If the repository exceeds the shared inventory resource limit, Sweep fails
without truncating the inventory or presenting a partial scan as complete.

The host merges all batch results into one plan instead of starting a separate
Sweep session for each batch.

If a file changes while the host is reading it, the inventory is stale and the
host captures a new inventory before continuing.

### Subagent hybrid inspection

Subagent hybrid is an optional host mode for the read-only discovery phase.

The host chooses it, or the active-session mode, before dispatching any batch.

It never mixes the two modes in one session.

The host may select subagent hybrid only when it can enforce the version 1
capability contract:

- each subagent runs in an independent context;
- each subagent receives only its assigned inventory files and a read-only
  source allowlist;
- repository text is untrusted data and cannot become host instructions;
- output size, concurrency, timeout, and retry count are bounded;
- cancellation and failed attempts remain in the attempt ledger; and
- the host can fall back to active-session inspection before dispatch when a
  capability is unavailable.

The JSON capability declaration is not proof of those controls by itself.

Subagent hybrid requires a trusted host adapter that verifies the declared capabilities and every batch invocation.

Configure that adapter through an absolute `HOPE_SWEEP_HOST_ADAPTER_MODULE` path outside the inspected repository, or use a host-provided adapter dependency.

The adapter must expose read-only, independent-context, source-allowlist, and bounded-output capabilities, report whether active-session inspection is available, verify the capability payload, and verify every report or attempt invocation.

The runtime fails closed for hybrid reports, merges, and plans when that adapter is absent or rejects a record.

The host records this pre-dispatch choice through the shared
`select-inspection-mode` command.

A capability failure returns the active session fallback before any subagent
starts.

The host never silently mixes modes.

The shared runtime exposes four versioned boundaries:

- a capability declaration bound to a trusted host adapter that proves the host
  selected the bounded, read-only mode;
- one batch report that binds its run, inventory, pre-dispatch manifest, batch,
  capability, input, invocation, output, and attempt identities;
- one report set that retains every successful, failed, or cancelled attempt;
  and
- one merge that orders every batch, derives every catalog check, and preserves
  relationships, observations, conflicts, and gaps.

Each batch report includes a result for every assigned file, every catalog
check, and relationship coverage.

A batch report may cite only its assigned inventory files and may keep a
relationship `unresolved`; the merge does not discard that relationship or its
evidence.

The report set also carries a host-verified pre-dispatch manifest, and every
report and attempt must match its manifest digest and one manifest batch.

Each successful report carries an output digest, each attempt carries an output
or failure-outcome digest, and the trusted adapter verifies those bindings with
the invocation receipt instead of trusting an invocation ID by itself.

A manifest batch may have no report only when all of its recorded attempts
failed or were cancelled; the merge creates a visible failed batch gap for that
case, so a missing report can never make a hybrid plan complete.

The main session must produce a host-verified cross-batch synthesis artifact
that reviews all inventory files, records every relationship that crosses two
or more manifest batches, cites the complete file evidence when checked, and is
preserved with batch-local relationships before the one Sweep plan is written.

A subagent never edits a repository file, requests approval, or creates a
Polish receipt.

The host bounds the synthesis input to the report and merge limits in the
brief.

It confirms active-session fallback before dispatch, keeps every trusted retry
attempt tied to the manifest and batch binding, enforces the retry budget, and
reruns the live inventory before validation and approval.

An incomplete, stale, untrusted, or capability-mismatched report keeps the plan
blocked.

## Maintenance evidence

Every catalog check declares exactly five evidence dimensions and identifies
which dimensions must pass for executable work.

The evidence dimensions match the work instead of forcing dead-code signals onto
abstraction, documentation, security, performance, release, or recovery work.

A passed or not-applicable evidence item cites at least one exact candidate
evidence source.

`not-applicable` also needs a concrete reason.

A status without evidence is not accepted as proof.

Dependency, security, license, support, and compatibility claims use current
authoritative external evidence when the claim can change over time.

When that evidence is unavailable, the check is partial rather than guessed.

An executable candidate has no unresolved evidence gap and states that the
change preserves behavior, public contracts, and dependencies.

Sweep classifies those three impacts separately.

The impact describes the proposed action, not the defect that exposed it.

Behavior covers intended runtime, user-visible, build, test, and release
outcomes rather than implementation shape alone.

Public contracts cover supported APIs, commands, schemas, configuration, and
documented promises.

Correcting stale wording to an authoritative unchanged contract preserves that
contract.

Dependencies cover declared external package, runtime, platform, and support
relationships rather than ordinary internal import rewrites.

`changing` means the action is known to change that dimension, `uncertain`
means the available evidence cannot decide, and `preserving` needs evidence
that it stays unchanged.

A fully evidenced candidate that preserves all three uses `polish`.

An uncertain candidate is `report-only`.

A candidate that changes or may change behavior, a public contract, or a
dependency uses `handoff` and requires a separately approved implementation
task.

The absence of a static reference is not enough evidence by itself.

## Exact approval

The shared runtime creates an approval candidate from one validated plan and
one executable candidate ID.

The approval candidate binds:

- the session and plan digest;
- the complete candidate record;
- every target and evidence source identity;
- the exact preview;
- the change budget; and
- one derived execution contract containing the action, target, preservation
  conditions, evidence checks, and verification methods.

The runtime hashes that normalized payload and returns one candidate digest.

The host shows the exact work unit and digest before asking the person to
approve it.

An approval applies only to that digest in the same Sweep session.

After the person decides, the host resolves the exact role-authenticated
conversation event and asks the shared runtime to create an approval receipt.

The receipt binds the normalized candidate, decision, conversation identity,
host event ID, execution contract, and opaque or signed host proof.

The proof verifier is a trusted host dependency outside model-authored JSON.

The runtime rejects an absent or invalid proof and never treats a self-authored
decision, conversation digest, or receipt hash as user authority.

A boolean or free-form completion field cannot substitute for this receipt.

If a target, evidence source, preview, or budget changes, the approval is stale
and the host must create a new plan and ask again.

## Polish composition

Sweep invokes Polish only for a candidate whose disposition is `polish` and
only after the person approves its exact digest.

The dependency direction is `Sweep -> Polish`.

Polish does not import or invoke Sweep.

Sweep supplies the approved target, preservation conditions, preview, change
budget, and conversation-backed authority to one normal Polish run.

The Polish version 2 run records a generic composition block that binds the
Sweep session, candidate, execution contract, and approval receipt digests.

Polish may return a revision, no change, or a need for alignment under its own
contract.

Sweep records the runtime-created Polish receipt in its completion record.

The completion runtime revalidates the embedded Polish version 2 run.

Its target, action, preview, preservation conditions, verification methods,
source identities, change budget, approval authority, output, removed targets,
and changes must match the approved Sweep candidate and final result.

If safe composition requires a broader Polish calling contract or a different
cleanup structure, Hope may change Polish while preserving its standalone
boundary.

## Work that changes behavior

Sweep and Polish do not execute a finding that changes behavior, a public
contract, or a dependency, or whose preservation is uncertain.

Sweep records that finding as a handoff to a separately approved ordinary
implementation task.

The handoff is not another public Hope feature.

That task may use Align when it contains a material product or design choice.

## Completion and verification

One version 1 completion binds a validated approval receipt, the current
pre-change identities, a validated Polish receipt when execution reached
Polish, the output identities, and every final verification receipt.

Deleted targets are listed in `removedSourceIds`.

Every surviving target appears in the output snapshot, so a deleted file never
receives an invented content identity.

The shared runtime accepts these terminal outcomes:

- `applied` for a changed target whose required checks passed;
- `no-change` for a valid Polish no-change result;
- `stale` when any approved identity changed before execution;
- `rejected` when the person declined the candidate;
- `failed` when a required check failed;
- `inconclusive` when the checked scope cannot support a safe conclusion; and
- `handed-off` when the work belongs to an ordinary implementation task.

An applied result cannot exceed the approved change count.

Every changed target must appear in a cited Polish change and in a linked,
passed final verification.

Every recorded verification must pass on the final snapshot.

A no-change result keeps every target identity unchanged.

Failed or inconclusive work is not reported as applied.

Files that must change together form one work unit and are preserved only when
their individual and integrated verification both pass.

Version 1 performs one approved candidate per completion record.

The session may produce more than one completion record, but each needs its own
exact approval.

One version 1 session result closes the invocation.

It embeds the normalized plan and every completion, binds their canonical
digests, and records every plan candidate in order.

`complete` is valid only when no candidate remains pending.

Its remaining gaps are the ordered union of unresolved plan, check, candidate,
and completion gaps, so a caller cannot omit unfinished work while claiming the
session completed.

## Model and deterministic boundaries

The shared core fixes category order, supported checks, states, source links,
budgets, candidate digests, approval conditions, and result validation.

The active Claude or Codex host decides what evidence to inspect, whether it
supports a candidate, and how to explain the plan.

Repository tests validate the deterministic envelope without claiming that a
host model made a sound maintenance judgment.

The shared runtime prepares blinded synthetic cases for every maintenance
category plus uncertain dynamic reachability, public contracts, and untrusted
repository instructions.

Each fresh host receives only the portable active brief, one synthetic
repository, and the bounded output contract.

The runtime then creates a versioned receipt that binds the evaluation version,
case, suite, run, host, model, effort, Sweep contract version, brief, prepared
input, invocation, and model output.

The complete-set validator requires every case exactly once under one declared
configuration and keeps failed judgments visible.

A direct receipt factory marks its evidence as synthetic.

Only the evaluation runner can attach the bounded host events and raw output
that produce `codex-runner` provenance.

The release validator rejects a synthetic receipt set.

The oracle stays hidden until the fresh host returns its output.

## Two entry paths

The Claude and Codex Skills use the active host to capture the inventory, inspect
every file in batches, author the merged plan, ask for exact approval, invoke
Polish, and verify the completion.

When the host selects subagent hybrid, the Skill is the thin dispatcher and the
shared Sweep runtime remains the authority for report validation, merge,
cross-batch evidence, live inventory, plan state, and approval binding.

They call the generated Sweep runtime for inventory capture, the brief, plan
validation, approval candidate, approval receipt, completion validation, and
session-result validation.

Approval receipt creation and validation require the active host's trusted
attestation verifier.

They call the same generated Polish runtime for the Polish receipt.

The same Sweep runtime exposes model-evaluation plan, preparation, oracle,
receipt, and receipt-set validation commands.

The independent harness exposes the same operations as `hope sweep`.

Automatic discovery reports that the harness model adapter is unavailable
until one exists.

The Skill is a thin adapter and does not own a second category, approval, or
result contract.
