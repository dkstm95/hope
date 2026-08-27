# Diff runtime contract

This maintainer reference records the deterministic guarantees enforced by
Diff's scripts. `SKILL.md` owns coordination, `workflow.md` owns the worker
protocol, and `analysis.md` owns review judgment.

## Exact, current source

Diff resolves one GitHub pull request and captures its exact base, head, merge
base, changed files, patches, and bounded context. It gives captured sources
stable identities and validates every analysis citation against them.

The model selects a focused continuous interval. The runtime validates and
splits it into bounded rendered references without dropping selected lines. It
derives file accounting, scope, links, source excerpts, and resource counters
instead of trusting authored copies.

After rendering, Diff rechecks the pull-request revisions. A changed target
stops publication rather than presenting a stale review as current.

## Untrusted, bounded input

Repository content, provider data, paths, URLs, and model output are untrusted.
The runtime bounds their size and structure, validates cross-references, and
escapes authored content into one self-contained HTML file. The artifact needs
neither repository dependencies nor a network request.

Validation rejects malformed, ungrounded, duplicate, or over-budget authored
data where the scripts can decide that deterministically. Meaning,
proportionality, and overlapping-but-distinct claims remain analysis judgments.

Each successful adapter step returns `next`, a structured description of the
state transitions allowed by the current run. Mandatory inspection,
checkpointing, ledger, validation, and finish transitions are runtime-owned.
The only model choice is whether a grounded pending context request would close
a material review question. These descriptors are state data, not shell command
strings, and remain valid only for the run identity that returned them.

Diff does not run CI, tests, builds, or lint. When analysis makes that absence
material, the runtime requires a linked verification item.

## Owned state and publication

Each run owns one restricted temporary directory and records the identity
needed to remove it. Cleanup rechecks that identity and preserves a path whose
ownership is uncertain.

Publication creates a new artifact and never replaces an existing path. A
failed collection, validation, render, revalidation, or publication does not
publish a partial review.

A retryable publication failure preserves the validated run. After successful
publication, Diff removes it. If cleanup then fails, Diff reports both the
published artifact and the remaining cleanup work instead of publishing again.
