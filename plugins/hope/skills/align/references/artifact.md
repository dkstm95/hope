# Align artifact runtime

This reference records the deterministic guarantees enforced by Align's
scripts. `SKILL.md` owns the interview, readiness judgment, artifact timing,
and revision judgment.

## Input and rendering

Align accepts one bounded JSON input that follows
`scripts/align-input-v1.schema.json`. The runtime validates the same boundary
without making a model call.

The renderer escapes authored text and produces one self-contained HTML file.
It makes no network request and keeps the current agreement readable without
JavaScript. JavaScript adds only theme switching, current-section indication,
and focused in-page navigation.

## Project publication

The caller chooses an HTML path inside the target Git repository after applying
the project-location guidance in `SKILL.md`.

Creation makes missing ordinary directories inside the repository and publishes
through a new staging file. It never replaces an existing path and never stages,
commits, pushes, or opens the artifact.

## Identity and revisions

Each artifact contains a generated Align ID, its complete revision data, and a
SHA-256 digest over the whole HTML file. `inspect` verifies that identity and
digest before returning the current implementation basis.

`revise` requires the digest returned by `inspect`. It verifies the artifact
again immediately before an atomic same-directory replacement. A symbolic
link, different repository identity, stale digest, unknown file, or file changed
outside Hope stops revision and leaves the existing path in place.

One artifact keeps one intent. Revisions append complete agreed snapshots so
the latest agreement is prominent and earlier intent remains recoverable.

## Commands

Run the adapter with Node.js 22 or newer:

```text
create --input <draft.json> --output <artifact.html> [--root <repository>]
inspect --artifact <artifact.html>
revise --input <draft.json> --artifact <artifact.html> --expect <digest> [--root <repository>]
```

The adapter prints structured JSON. `create` and `revise` return the absolute
artifact path, Align ID, current revision, and artifact digest. `inspect` also
returns the current agreed content and compact revision index.
