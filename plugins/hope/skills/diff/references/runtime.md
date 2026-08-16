# Diff runtime contract

This document defines the deterministic guarantees enforced by Diff's scripts.

`SKILL.md` owns the host workflow.

`analysis.md` owns review judgment and teaching-aid guidance.

## Exact source

Diff resolves one GitHub pull request and captures its exact base, head, merge
base, changed files, patches, and bounded context.

It gives captured sources stable identifiers and validates every analysis
citation against those sources.

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
