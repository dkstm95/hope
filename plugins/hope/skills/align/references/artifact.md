# Align artifact runtime

This reference records the deterministic guarantees enforced by Align's
scripts. `SKILL.md` owns the interview, readiness judgment, artifact timing,
and revision judgment.

## Input and rendering

`create` and `revise` accept one bounded JSON input that follows
`scripts/align-input-v2.schema.json`. Its `goal` names the agreed result. Every
item in `checks` binds one passing condition to its verification method and to
the `agent` or `human` that decides whether it passes.

`inspect` still validates existing artifact histories that contain the earlier
`intent` and `success` contract. `revise` preserves those revisions while
appending a v2 revision. The artifact's internal schema version is separate
from the accepted input version. The runtime revalidates both current inputs
and retained history without making a model call, then applies filesystem, URL,
and image checks that JSON Schema cannot express safely.

String limits count Unicode code points. Dangerous bidirectional controls and
malformed Unicode are rejected before rendering. A finished artifact must fit
the same 12 MiB bound used by `inspect`; an oversized revision fails without
changing the last readable artifact.

The renderer escapes authored text and produces one self-contained HTML file.
It makes no network request and keeps the current agreement readable without
JavaScript. JavaScript adds only theme switching, current-section indication,
and focused in-page navigation.

An optional design-direction comparison may read two or three raster images
from absolute local paths in the structured input. Each path must identify a
stable ordinary file, not a symbolic link. Align limits each image to 512 KiB,
limits all images in one revision to 1 MiB, and rejects an image wider or taller
than 4,096 pixels or larger than 8 megapixels.

Align accepts non-interlaced PNG for its first image boundary. It validates the
complete chunk sequence and checksums, decompresses the bounded image data, and
checks its row structure and dimensions before embedding its bytes.
The published artifact contains no source path and loads no image from the
network. Authored HTML, CSS, JavaScript, SVG, and data URLs remain unsupported.

## Project publication

The caller chooses an HTML path inside the target Git repository after applying
the project-location guidance in `SKILL.md`.

Creation makes missing ordinary directories inside the repository and publishes
through a new staging file. It never replaces an existing path. Version-control
handling belongs to the surrounding project workflow.

Hope records the verified output-directory identity and checks it throughout
publication. A detected ancestor replacement stops publication and removes an
outside file only when Hope can prove that it owns that exact file. This is a
fail-closed check for observable path changes, not isolation from a same-user
process that can keep changing the filesystem between operating-system calls.

## Identity and revisions

Each artifact contains a generated Align ID, its complete revision data, and a
SHA-256 digest over the whole HTML file. `inspect` verifies that identity and
digest before returning the current implementation basis.

The repository name shown in the artifact is only a display label. Revision
authorization uses a separate canonical identity: normalized remote host,
port, and path when an origin exists, or the canonical repository path when it
does not.

`revise` requires the digest returned by `inspect`. It verifies the artifact
again immediately before an atomic same-directory replacement. A symbolic
link, different repository identity, stale digest, unknown file, or file changed
outside Hope stops revision and leaves the existing path in place.

One artifact keeps one goal. Revisions append complete agreed snapshots so the
latest agreement is prominent and earlier goal contracts remain recoverable.

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
