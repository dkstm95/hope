# Diff runtime contract

This maintainer reference records the deterministic guarantees enforced by
Diff's scripts. `SKILL.md` owns coordination, `workflow.md` owns the artifact
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

## One capture, analysis, and reader

Diff owns the reader under `scripts/reader`. It has no separate collector,
CLI, model document, publication boundary, or feature interface. A missing or
incomplete provider patch is reconstructed once from merge-base/head text with
isolated `git diff --no-index`; no repository configuration or code runs. Only
the complete patch enters inspection. Bodies are capped at 256 KiB; reconstructed
patches allow up to 512 KiB for diff framing, within the total capture budget.

Analysis v5 requires semantic groups. Validation checks their claim evidence,
unique IDs, code ownership, and complete coverage. It prepares one row layout
for rendering. Grouping and ordering are model judgments; the runtime never
infers purpose from filenames or mechanically chooses explanation units.

The reader shares the review's document, locale, theme, CSP, revalidation, and
publication. It serializes only the small identity/path payload needed for
browser progress; code and explanations already exist in the DOM. Read status
is scoped to the snapshot and group fingerprint, is reversible, and can be
exported when local storage is unavailable. It conveys no PR approval.
Old HTML remains readable, but previous analysis/run formats are not accepted
by this runtime. Follow-up questions use the captured artifact; changed code
or a revised review requires a new publication, preserving the old one.
