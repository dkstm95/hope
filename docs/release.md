# Hope releases

This document defines the release of Hope's current plugin distribution.

It does not define feature behavior.

Hope publishes one verified package and matching source tag for each public
version.

## Release decision

Every completed change records one release decision in its pull request:

- `none` when the change does not alter the public package;
- `patch` for a backward-compatible correction;
- `minor` for a backward-compatible capability; or
- `major` for an incompatible public change.

Judge the delivered behavior, not the commit type.

Documentation and internal maintenance can still require a release when they
change a Skill, package content, or another public contract.

A `none` decision changes no version file solely to record the decision.

## Prepare a version

Before preparing a version, update the branch from the latest `main` so another
merged release cannot make the chosen version stale.

The public version files are:

- `package.json`;
- `package-lock.json`;
- `plugins/hope/.codex-plugin/plugin.json`; and
- `plugins/hope/.claude-plugin/plugin.json`.

For a `patch`, `minor`, or `major` decision, choose the exact next version and
run:

```bash
npm run release:prepare -- <version>
```

The command updates all four files, rebuilds the generated plugin, and checks
the versioned package.

Commit those changes with the work they release.

The pull request therefore contains both the product change and its release
decision before review and merge.

## Publish the recorded version

Merging a pull request that changes the public version starts `Verify` for the
new `main` commit.

When Verify succeeds, the `Release` workflow reads that exact commit and
publishes its recorded version.

Failed or cancelled verification does not publish a release.

The workflow does not choose or change a version.

It installs locked dependencies, prepares the already recorded version again,
checks that preparation creates no tracked difference, runs the browser suite,
creates an annotated tag for the merge commit, stages the approved package
files, records a checksum, and publishes the GitHub Release as latest.

The workflow never commits or pushes a change to `main`.

GitHub Release notes are the public version history.

GitHub generates them from the commits and merged pull requests since the
previous tag.

## Manual retry and recovery

A manual run reads the version already recorded on the latest `main`.

If its tag and GitHub Release both exist, the run exits without publishing
anything.

If neither exists, the run verifies and publishes that recorded version.

If the tag exists without a GitHub Release, the run restores that exact tagged
commit, verifies it again, and publishes the missing package.

Only one release job runs at a time.

Once a version tag exists, its source and plugin package are immutable.
