# Hope releases

This document defines the release of Hope's current plugin distribution.

It does not define feature behavior.

Hope publishes one verified package and matching source tag for each public
version.

## Automatic release

Every push to `main` starts `Verify`.

When Verify succeeds, it starts the `Release` workflow for the tested commit.

Failed or cancelled verification does not start a release.

If commits follow the current release, the workflow prepares and publishes the
next version without waiting for a separate release decision.

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

The workflow asks the preparation command to classify those commits, update all
four files, and rebuild the generated plugin:

```bash
npm run release:prepare -- --automatic <current-tag>
```

The automatic run starts from the exact `main` commit that passed Verify.

If that commit is already part of the current GitHub Release, the run exits
without changing or publishing anything.

The release workflow installs locked dependencies, prepares and rechecks the
versioned package, creates an annotated tag, stages the approved package files,
records a checksum, and publishes the GitHub Release as latest.

GitHub Release notes are the public version history.

GitHub generates them from the commits and merged pull requests since the
previous tag.

## Manual retry

A manual run retries the same automatic process against the latest `main`
commit.

Use it when the automatic run did not start or needs recovery.

When no commit follows the current release, the run exits without changing or
publishing anything.

If the current version's tag exists without a GitHub Release, the workflow
resumes that exact tagged commit.

The person starting the run does not choose a version or increase type.

## Recovery

Only one release job runs at a time.

If a job creates the tag but stops before it creates the GitHub Release, rerun
the workflow.

The rerun restores the tagged commit, verifies it again, and publishes the
missing package without increasing the version.

Once a version tag exists, its plugin package is immutable.

If the version recorded in the source has no matching tag, the workflow stops.
Normal contributions must not prepare public version files by hand.

If `main` advances while the workflow is preparing a release, the atomic push
fails without publishing the new tag.

Rerun against the new `main` state.
