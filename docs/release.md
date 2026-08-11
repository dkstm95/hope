# Hope releases

This document defines the release of Hope's current plugin distribution.

It does not define feature behavior.

Hope publishes one verified package and matching source tag for each public
version.

## Release intent

A manual `Release` run records the normal release intent.

Use a concise, outcome-focused Conventional Commit subject for each change that
reaches `main`.

Add a commit body only when the reason or trade-off is not clear from the
change.

The workflow chooses the version increase from every commit after the current
release:

- a `!` after the commit type or a `BREAKING CHANGE` footer selects major;
- `feat` selects minor; and
- every other commit selects patch.

The largest increase wins.

Use a patch increase for compatible fixes, a minor increase for compatible
capability changes, and a major increase for incompatible public changes.

The public version files are:

- `package.json`;
- `package-lock.json`;
- `plugins/hope/.codex-plugin/plugin.json`; and
- `plugins/hope/.claude-plugin/plugin.json`.

The workflow passes its selected version to the preparation command, which
updates all four files and rebuilds the generated plugin:

```bash
npm run release:prepare -- <version>
```

## Automatic release

The `Release` workflow also starts when an explicitly prepared, untagged public
version reaches `main`.

The automatic run uses the exact commit that changed those files.

It publishes the version already recorded in that commit.

If that version already has a GitHub Release, the automatic run exits without
publishing or increasing it.

The workflow installs locked dependencies, runs repository and browser checks,
verifies generated plugin files, creates an annotated tag, stages the approved
package files, records a checksum, and publishes the GitHub Release as latest.

GitHub Release notes are the public version history.

GitHub generates them from the commits and merged pull requests since the
previous tag.

## Manual release

A manual run uses the latest `main` commit.

When the recorded version already has a GitHub Release, the workflow classifies
the commits after its tag, chooses the next version, and commits the prepared
release files.

When no commit follows the current release, the run exits without changing or
publishing anything.

When the recorded version has no release tag, the workflow publishes that
version without increasing it.

If its tag exists without a GitHub Release, the run resumes that exact tagged
commit.

The person starting the run does not choose a version or increase type.

## Recovery

Only one release job runs at a time.

If a job creates the tag but stops before it creates the GitHub Release, rerun
the workflow.

The rerun restores the tagged commit, verifies it again, and publishes the
missing package without increasing the version.

Once a version tag exists, its plugin package is immutable.

If `main` advances while the workflow is preparing a release, the atomic push
fails without publishing the new tag.

Rerun against the new `main` state.
