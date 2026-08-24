# Diff runtime contract

This document defines the deterministic guarantees enforced by Diff's scripts.

`SKILL.md` owns the host workflow.

`analysis.md` owns review judgment and teaching-aid guidance.

## Exact source

Diff resolves one GitHub pull request and captures its exact base, head, merge
base, changed files, patches, and bounded context.

It gives captured sources stable identifiers and validates every analysis
citation against those sources.

The renderer assigns one document number to each distinct validated source
interval, places that `[n]` after every claim that cites it, and keeps the full
code or source excerpt in one folded list at the document bottom. Activating a
marker previews the same canonical entry; its fragment link remains the
no-JavaScript fallback. When one claim cites several intervals, the renderer
displays that marker group in ascending document-number order without changing
the canonical entries.

Validation rejects exact duplicate authored items within one sibling list
after treating their evidence ranges as an unordered set. It does not compare
items that serve different document roles, and it permits them to reuse one
source interval. Meaning and overlapping-but-distinct support remain analysis
judgments rather than deterministic failures.

A microworld scenario writes `"after": "unchanged"` when its represented
steps and outcome are identical to `before`. Validation rejects a copied trace,
and the renderer shows one compact unchanged state instead of repeating the
same trace. Its live accessibility status is derived from the rendered
scenario instead of storing a second copy in an HTML data attribute.

The model selects one focused source interval. The runtime validates that
interval and splits it into bounded evidence references without dropping any
selected line. This keeps reference-size arithmetic out of the host workflow
while preserving exact source binding and resource accounting.

Inspection keeps deterministic processed-page coverage separate from sparse,
model-authored notes. The final ledger combines that coverage, the grounded
notes and excerpts, and bounded file and limit accounting in one analysis
handoff.

It rechecks the pull-request revisions after rendering and before publication.

A changed revision stops publication instead of presenting the review as
current.

## Untrusted and bounded input

Repository content, provider data, paths, model output, and URLs are untrusted
input.

The runtime bounds input size, structure depth, generated prose, evidence,
snapshots, and the final artifact.

When code evidence exceeds its rendered-line allowance, validation reports the
actual and target totals, field contributions, largest ranges, and a bounded
list of overlapping intervals. The limit remains fail-closed, while the
analysis worker gets enough information to make one focused repair.

It renders authored content as escaped text into one self-contained HTML file.

The renderer needs no repository `node_modules/` directory or network request.

## Private state and publication

Each run owns a restricted temporary directory and records the identity needed
to remove it safely.

The runtime rechecks that identity before cleanup and preserves a path whose
ownership is uncertain.

Publication creates a new file and never replaces an existing artifact.

A failed collection, validation, render, revalidation, or publication does not
publish a partial review.

The standard absence of CI, test, build, and lint execution does not limit a
review by itself. When the analysis treats that absence as material, the
runtime requires a linked verification item so the uncertainty and its closing
evidence remain actionable.

A publication failure preserves the validated private run so `finish` can be
retried after the publication problem is fixed.

After successful publication, Diff removes the private run. If that cleanup
fails, Diff reports the published artifact and the remaining cleanup work
instead of telling the caller to publish again.
