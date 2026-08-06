<!-- Generated from docs/sweep.md. Do not edit. -->

# Hope sweep

Hope sweep starts one project-wide codebase maintenance session when a person
asks for it.

It inspects an exact repository snapshot, shows a plan, and changes only the
work units that the person approves.

Sweep owns discovery, category status, prioritization, approval binding, and
the final session result.

Polish owns each approved behavior-preserving revision.

Sweep does not hide behavior, public-contract, or dependency changes inside a
cleanup.

## Product boundary

One invocation inventories the complete project-owned worktree and produces a
plan before any repository file changes.

The person does not choose a daily, weekly, monthly, yearly, or other public
profile.

Sweep adapts its plan to the repository while keeping the same category,
evidence, approval, and result contract.

The inventory covers tracked files and relevant untracked files owned by the
project.

It records ignored cache, dependency, build-output, and other excluded paths
with a reason.

An excluded path is explicit coverage information; it is not silently treated
as inspected.

Symbolic links are inventory entries in their own right.

Discovery records the link target text and never reads the target file.

This remains true when the target is outside the repository.

The plan covers production code, tests, documentation, configuration, generated
sources, package metadata, and other repository content across every inventory
batch.

Generated files may be inspected, but Sweep changes their editable source and
uses the repository build when the generated copy must change.

Sweep version 1 supports every check in the codebase maintenance catalog.

The catalog is fixed by the shared runtime so every entry path uses the same
checks, evidence requirements, and execution boundary.

## Project inventory and batch execution

The shared runtime creates one version 1 inventory from a verified Git worktree
enumeration.

It stores the exact Git snapshot, discovery record, file identities, exclusions,
batch assignments, worker reports, and remaining gaps.

The inventory includes both tracked files and relevant untracked files.

The host excludes only paths that are not project-owned or are generated cache,
dependency, or build output.

It records each exclusion and its reason.

The runtime's source limit applies to one batch.

Inventory and plan files still have transport and parser safety limits, but no
fixed file, exclusion, or batch count limits the project inventory.

Every inventory file belongs to exactly one batch, and a whole-project session
cannot become complete until every batch is complete.

Each batch may run in `parallel` mode when the host can provide independent
contexts, or in `sequential` mode when it cannot.

The shared runtime owns assignment, coverage, state, and merge records.

A started batch keeps the digest of its pending input and the execution identity
used to assign files.

Completion requires that digest, the same execution, and one worker report for
every worker assignment.

Workers receive only their exact batch input, inspect and return a worker report
with evidence, and never edit files or redefine the project scope.

Use `discover-inventory`, `validate-inventory`, `batch-input`, `start-batch`,
and `complete-batch` for the shared inventory boundary.

`discover-inventory` must enumerate the repository.

`validate-inventory --root` rechecks that the worktree has not changed.

A whole-project plan binds `session.inventoryDigest` to the normalized complete
inventory.

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

The initial call creates the complete project inventory before category
inspection.

File, candidate, and change budgets still apply to the plan and approved work
units; the per-batch inventory limit is a separate execution limit.

The host inspects repository rules and available evidence across every assigned
batch and records any remaining gap.

It does not modify the repository during this phase.

The shared runtime validates one version 1 plan with:

- an exact work snapshot;
- a complete inventory and its digest-bound session identity;
- one session ID, scope, state, and budget;
- every versioned category, check, support state, and inspection state;
- zero or more bounded candidates;
- exact target and evidence source IDs for each candidate;
- an exact change preview and maximum change count;
- the exact evidence contract for each candidate's maintenance check;
- verification steps and unresolved gaps; and
- an honest summary of checked scope and remaining gaps.

`filesChecked` is the number of distinct file sources cited by inspected checks.

It is a plan evidence metric, while the inventory summary records project-wide
file coverage.

The runtime derives that number and rejects a smaller or larger claim.

The plan state is `awaiting-approval` only when at least one candidate is safe
for Polish.

It is `complete-with-findings` when findings remain but none can enter Polish.

It is `complete-no-change` only when every catalog check completed and found no
candidate.

For a bounded legacy plan, it is `blocked` only when incomplete discovery
produced no finding that the person can act on.

For a whole-project plan, it is also `blocked` whenever the inventory is missing
or not `complete`.

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
conversation event and asks the shared runtime to create an approval record.

The record binds the normalized candidate, decision, conversation identity,
host event ID, execution contract, and opaque or signed host proof.

The proof verifier is a trusted host dependency outside model-authored JSON.

The runtime rejects an absent or invalid proof and never treats a self-authored
decision, conversation digest, or record hash as user authority.

A boolean or free-form completion field cannot substitute for this record.

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
Sweep session, candidate, execution contract, and approval record digests.

Polish may return a revision, no change, or a need for alignment under its own
contract.

Sweep records the runtime-created Polish record in its completion record.

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

One version 1 completion binds a validated approval record, the current
pre-change identities, a validated Polish record when execution reached
Polish, the output identities, and every final verification result.

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

The runtime then creates a versioned record that binds the evaluation version,
case, suite, run, host, model, effort, Sweep contract version, brief, prepared
input, invocation, and model output.

The complete-set validator requires every case exactly once under one declared
configuration and keeps failed judgments visible.

A direct record factory marks its evidence as synthetic.

Only the evaluation runner can attach the bounded host events and raw output
that produce `codex-runner` provenance.

The release validator rejects a synthetic record set.

The oracle stays hidden until the fresh host returns its output.

## Two entry paths

The Claude and Codex Skills use the active host to inspect a repository, author
the plan, ask for exact approval, invoke Polish, and verify the completion.

They call the generated Sweep runtime for the brief, plan validation, approval
candidate, approval record, completion validation, and session-result
validation.

Approval record creation and validation require the active host's trusted
attestation verifier.

They call the same generated Polish runtime for the Polish record.

The same Sweep runtime exposes model-evaluation plan, preparation, oracle,
record, and record-set validation commands.

The independent harness exposes the same operations as `hope sweep`.

Automatic discovery reports that the harness model adapter is unavailable
until one exists.

The Skill is a thin adapter and does not own a second category, approval, or
result contract.
