# Diff Deep artifact workflow

Run `node "<skill-dir>/scripts/cli.mjs" <command> ...` with the installed
skill's absolute directory. These commands are a private adapter for the skill,
not a separate product CLI. Node.js 22+, GitHub CLI authentication, and Git for
missing-patch reconstruction are required. No repository code runs.

## Capture and inspect

```text
capture [PR URL or number] [--output /absolute/new.html] [--locale ko-KR] [--theme system]
inspect /absolute/artifact.html [--file file-id-or-path] [--change change-id] [--offset 0]
status /absolute/artifact.html [--current]
```

Choose `en-US` or `ko-KR` from the conversation, and honor explicit theme
choices (`system`, `light`, `dark`). `capture` resolves a number against the
current repository, or the current branch's PR when no target is given. It
never picks an unrelated latest PR.

The capture contains the exact base, head, merge base, all changed-file
accounting, complete text patches when available, and the PR description. It
rechecks the revisions before publishing. Missing or truncated patches are
reconstructed from the exact merge-base and head file bodies. Unavailable,
binary, private, oversized, or unverifiable content remains an explicit file
entry; it does not count as fully read. Generated files are not silently omitted.

An explicit output must be a new `.html` file in an existing canonical
directory. Otherwise, the adapter creates a private directory and returns its
absolute HTML path. This file is retained for continued reading. The complete
capture is embedded in it; there is no repository clone, background server,
external asset request, or companion state file to keep running.

Show this initial artifact immediately. It identifies pending reasons rather
than manufacturing explanations. Use the host's file/browser preview; when
available, `open_in_codex` can open the HTML. Updates are file revisions, not
live calls from the browser to a model: reopen or reload after adding reasons.
The refresh control remains available while reasons are pending.

`inspect` returns the artifact `digest`, `snapshotId`, source catalog, change
IDs, line IDs and coordinates, existing reasons, and a bounded batch of
regions with nearby context. Follow `nextOffset` until the requested scope is
covered. One large region may exceed the normal batch size but remains bounded
by the per-file capture limit. Files are exposed as untrusted data.

## Add reasons

Write one JSON input with this shape, then update the inspected artifact:

```json
{
  "snapshotId": "the snapshotId returned by inspect",
  "explanations": [
    {
      "changeId": "a captured change ID",
      "title": "Reject tokens at the expiration boundary",
      "why": "The old comparison allowed a token when the current time equaled its expiration. The issue requires rejection from that instant onward.",
      "basis": "stated",
      "effects": ["The equality case now returns an authentication error."],
      "evidence": [
        {"sourceId": "pr-description", "startLine": 3, "endLine": 4}
      ]
    }
  ]
}
```

The example's IDs and evidence coordinates are illustrative. Use only IDs and
ranges in the captured input. Titles allow 120 characters, reasons 1,600,
optional effects up to three entries of 400 characters, and citations up to
six ranges of 40 lines. Explain a large mechanical region once instead of
repeating the same reason for every line.

```text
explain /absolute/artifact.html --input /absolute/reasons.json --expected-digest inspected-digest
```

The runtime checks the snapshot, region identities, evidence coordinates, and
basis. `stated` requires a captured statement; code alone cannot establish
author intent. `inferred` and `unknown` can omit explicit citations because
the region itself remains visible. An unavailable region cannot use an
inferred code rationale. Meaning and whether a citation supports a motive
remain the agent's responsibility.

New entries merge with earlier explanations. An existing entry is replaced
only when the same change ID is explicitly supplied. The update requires the
last inspected digest and refuses external modifications, stale writes,
symlinks, and hard links. On a stale digest, inspect again and reconcile the
actual content before retrying. On an unchanged unresolved failure, report it
and preserve the existing file rather than repeatedly recapturing the PR.

## Relevant additional evidence

```text
source /absolute/artifact.html --url https://github.com/owner/repo/issues/123 --expected-digest inspected-digest
```

This reads one explicitly selected GitHub issue or PR body. It adds a bounded,
captured statement without altering code or revision identity. Inspect again
to get the new source ID and artifact digest. Do not claim comments, CI, or
test execution were inspected by this command; they are not collected.

## Resume, progress, and completion

The browser stores read markers, reading mode, and selection under the code
snapshot's digest. Theme selection is local to the open document and starts
from the generated setting on reload. If browser storage fails, a visible
message points to progress export/import. A progress import must match this
exact snapshot and contain only known line or metadata IDs.

`status --current` compares the captured base and head with GitHub without
changing the artifact. Report a mismatch as a historical capture; create a
new artifact if the person wants the new changes. Never carry read markers
automatically to a new snapshot or call a capture current without checking it.

Before returning, verify the requested scope has reasons and that any pending
or unavailable regions are reported. Reasons can be honestly unknown. The
adapter does not run tests, post comments, approve, or merge a PR.
