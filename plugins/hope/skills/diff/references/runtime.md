# Diff runtime contract

This maintainer reference records the deterministic guarantees enforced by
Diff's scripts. `SKILL.md` owns coordination, `workflow.md` owns the artifact
protocol, and `analysis.md` owns review judgment.

## Exact, current source

Diff captures one change from one of two sources. The GitHub source resolves a
pull request and captures its exact base, head, merge base, changed files,
patches, and commit titles. The local source compares the working tree
(committed, staged, and unstaged changes, plus untracked files only on request)
with `git merge-base HEAD <base>`, and captures commit titles since that merge
base. Both produce the same snapshot: `files`, `sources`, `limits`, `settings`,
`snapshot` revisions, a `change` descriptor of kind `github` or `local`, and a
digest over all of it.

Each changed source gets a stable identity, and validation checks every
analysis citation against it. The model selects a focused continuous interval;
the runtime validates and splits it into bounded rendered references without
dropping selected lines. It derives file use, scope, links, source excerpts,
and resource counters instead of trusting authored copies.

After rendering, `publish` rechecks the change. For a pull request, base, head,
and merge base must be unchanged. For local changes, the merge base, the set of
changed paths, a digest of every captured path's working-tree bytes (taken
before capture reads them and checked again after), and every head context
file must be unchanged. A changed target stops publication rather than presenting a
stale review as current.

## Untrusted, bounded input

Repository content, provider data, paths, URLs, and model output are untrusted.
The runtime bounds their size and structure, validates cross-references, and
escapes authored content into one self-contained HTML file under a strict
content security policy. The artifact needs neither repository dependencies nor
a network request.

Both sources apply the same limits: changed files, changed lines, commits,
per-file and total safe text, and patch size. Private file names and bodies
matching a credential pattern are redacted before their text enters the
snapshot. Binary, oversized, symlinked, and other special entries keep only
metadata. The local source reads Git objects for the merge base and working
files without following a symlink in any path component. It disables
`core.fsmonitor`, external diff, and text conversion; treats paths literally;
validates `--base` as a commit before use; and builds each patch with an
isolated `git diff --no-index` over the exact bytes that passed redaction, so
no repository configuration or code runs on that text.

Validation rejects malformed, ungrounded, duplicate, or over-budget authored
data where the scripts can decide that deterministically. Meaning,
proportionality, and overlapping-but-distinct claims remain analysis judgments.

Diff does not run CI, tests, builds, or lint. When analysis makes that absence
material, the runtime requires a linked verification item.

## The bundle

`capture` writes every source into Markdown bundle parts of at most
`--bundle-bytes` (192 KiB by default). A part never splits a source line and
starts a new part rather than splitting a source that fits a fresh one; only a
single line larger than the bound gets an oversize part of its own. Each part
starts with a warning to treat content as data. Each source chunk starts with
one JSON header line, and every content line is prefixed with
`sourceId:lineNumber`, so a path or line cannot forge a header or a citation.
`bundle/index.json` maps files, limits, and sources to parts.

`context` validates repository-relative paths, applies the same redaction and
per-run limits (12 requests, 256 KiB of context text), appends `context-file`
sources and `context-unavailable` limits, recomputes the digest, and writes new
parts. The run holds no state machine, lock, ledger, or checkpoint; the
output-side checks above carry the guarantees.

## Owned state and publication

Each run owns one directory with mode 0700 under the user's private run root.
Hope records ownership before writing source data and removes a run only after
confirming the directory identity it created, so it preserves a path whose
ownership is uncertain. Runs older than a day are removed on the next capture.

Publication creates a new artifact and never replaces an existing path. A
failed collection, validation, render, revalidation, or publication does not
publish a partial review. An invalid analysis, a render failure, and retryable
revalidation or publication failures keep the run so the same run can be
repaired or retried. A stale change removes it. After successful publication,
Diff removes the run; if cleanup then fails, Diff reports both the published
artifact and the remaining cleanup work instead of publishing again.

## One capture, analysis, and reader

Diff owns the reader under `scripts/reader`. It has no separate collector,
CLI, model document, publication boundary, or feature interface. A missing or
incomplete GitHub patch is reconstructed once from merge-base/head text with
the same isolated `git diff --no-index`. Only a complete patch enters the
bundle. Bodies are capped at 256 KiB; reconstructed patches allow up to 512 KiB
for diff framing, within the total capture budget.

Analysis v6 requires semantic groups, each with a kind. Validation checks
their claim evidence, unique IDs, code ownership, and complete coverage, and
derives each file's use from the strongest kind that owns its lines. It
prepares one row layout for rendering. Grouping and ordering are model
judgments; the runtime never infers purpose from filenames or mechanically
chooses explanation units.

The reader shares the review's document, locale, theme, CSP, revalidation, and
publication. It serializes only the small identity/path payload needed for
browser progress; code and explanations already exist in the DOM. Read status
is scoped to the snapshot and group fingerprint, is reversible, and can be
exported when local storage is unavailable. It conveys no PR approval.
A local review links evidence to GitHub only for merge-base sources of a
GitHub remote, because its head is working-tree text.
Files without a complete text patch retain an unavailable-content limit even
when the provider reports a rename; that status does not establish a pure rename.
Old HTML remains readable, but previous analysis and run formats are not
accepted by this runtime. Follow-up questions use the captured artifact;
changed code or a revised review requires a new publication, preserving the old
one.
