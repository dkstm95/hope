# Hope releases

Hope publishes one verified plugin package and matching source tag for each
public version.

## Release intent

A change to the public version files records an intentional release.

Use a patch increase for compatible fixes, a minor increase for compatible
capability changes, and a major increase for incompatible public changes.

The same change must add a dated section for that version to `CHANGELOG.md`.

The public version files are:

- `package.json`;
- `package-lock.json`;
- `plugins/hope/.codex-plugin/plugin.json`; and
- `plugins/hope/.claude-plugin/plugin.json`.

Run the preparation command to update all four files from one version and
rebuild the generated plugin:

```bash
npm run release:prepare -- <version>
```

## Automatic release

The `Release` workflow starts when new public version files reach `main`.

The automatic run uses the exact commit that changed those files.

It publishes the version already recorded in that commit instead of choosing
another version.

If that version already has a GitHub Release, the automatic run exits without
publishing or increasing it.

The workflow installs locked dependencies, runs repository and browser checks,
verifies generated plugin files, creates an annotated tag, stages the approved
package files, records a checksum, and publishes the GitHub Release as latest.

## Manual release

A manual run uses the latest `main` commit and publishes the version already
recorded there when it has no release tag.

If its tag exists without a GitHub Release, the run resumes that exact tagged
commit.

If the recorded version already has a GitHub Release, the run exits without
changing or publishing anything.

The workflow never chooses or increases a version.

Prepare and commit the next version with
`npm run release:prepare -- <version>` before starting a manual run.

## Recovery

Only one release job runs at a time.

If a job creates the tag but stops before it creates the GitHub Release, rerun
the workflow.

The rerun restores the tagged commit, verifies it again, and publishes the
missing package without increasing the version.

Once a version tag exists, its plugin package is immutable.
