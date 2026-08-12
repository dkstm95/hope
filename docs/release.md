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

AI or the reviewer chooses `patch`, `minor`, or `major` when a release is
required.

The repository determines whether the working tree changes the public package
and calculates the exact version.

Documentation and internal maintenance can still require a release when they
change a Skill or another packaged contract.

A `none` decision changes no version file solely to record the decision.

## Local completion gate

Every file-changing task ends with:

```bash
npm run check
```

The command checks the package structure, the current working tree's release
impact, and the deterministic tests.

The release-impact check compares the approved package at the latest stable
release, the latest `origin/main`, and the current working tree.

It compares the exact package allowlist, file modes, and file contents after
replacing only the two manifest version values with one neutral value.

When the working tree changes the package, it must increase the base version by
exactly one patch, minor, or major step.

When the base already records an unreleased version, unrelated work keeps that
version.

When the base has unversioned package changes, the next completed task records
their release unless it restores the package to the released state.

A branch must include the latest `origin/main` before the check can pass.

The same command runs in normal CI as a safety net, but local completion owns
the version decision.

## Prepare a version

Before preparing a version, update the branch from the latest `main`.

The public version files are:

- `package.json`;
- `package-lock.json`;
- `plugins/hope/.codex-plugin/plugin.json`; and
- `plugins/hope/.claude-plugin/plugin.json`.

For a `patch`, `minor`, or `major` decision, run:

```bash
npm run release:prepare -- <patch|minor|major>
```

The command reads the version from `origin/main`, calculates the exact next
version, updates all four files, rebuilds the package, and runs its checks.

Pass another base ref as a second argument only when `origin/main` is not the
task base.

Run `npm run check` again and commit the version with the work it releases.

The pull request therefore contains both the product change and its release
decision before review and merge.

## Publish the recorded version

A push to `main` that changes `package.json` starts the `Release` workflow.

The workflow checks out that event's exact commit.

If the push did not change the recorded version, the workflow exits without
publishing.

For a new version, it checks the recorded package, stages and verifies the
archive, and then creates the tag and GitHub Release.

The workflow never chooses a version, changes `main`, or lets a later unchanged
commit claim an earlier version.

Release jobs share one queue so two releases never publish at the same time.

GitHub generates the public release notes from the commits and merged pull
requests since the previous tag.

## Manual retry and recovery

A manual run uses the selected `main` commit, not a moving branch reference.

If its tag and GitHub Release both exist, the run exits without publishing.

If neither exists, the run checks and publishes that recorded version.

If the tag exists without a GitHub Release, the run restores the tagged commit,
checks its package again, and publishes the missing release.

Once a version tag exists, its source and plugin package are immutable.
