import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { makeAnalysis, makeSnapshot } from "../test-support/diff-fixture.mjs";
import { normalizeLineEndings } from "../tools/build-plugin.mjs";
import {
  parseInstallResult,
  verifyInstalledPlugin,
} from "../tools/install-plugin-dev.mjs";
import { pluginPackageFiles } from "../tools/plugin-files.mjs";
import {
  compareVersions,
  incrementVersion,
  packageDigest,
  releaseTypeBetween,
  validateReleaseImpact,
} from "../tools/release-impact.mjs";
import {
  isSemanticVersion,
  replaceVersion,
  withPackageLockVersion,
} from "../tools/prepare-release.mjs";
import {
  parsePackageFileList,
  readPackageFileList,
  stagePlugin,
} from "../tools/stage-plugin.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(root, "plugins/hope");

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listFiles(path, base));
    } else {
      paths.push(relative(base, path).split("\\").join("/"));
    }
  }
  return paths.sort();
}

test("release versions use one supported form", () => {
  assert.equal(isSemanticVersion("0.4.1-alpha"), true);
  assert.equal(isSemanticVersion("1.0.0-rc.1+build.2"), true);
  assert.equal(isSemanticVersion("v1.0.0"), false);
  assert.equal(isSemanticVersion("1.0"), false);
  assert.equal(isSemanticVersion("01.0.0"), false);
  assert.equal(isSemanticVersion("1.0.0-01"), false);
  assert.equal(isSemanticVersion("1.0.0-alpha..1"), false);
  assert.equal(
    replaceVersion('{\n  "version": "0.1.0",\n  "items": ["one", "two"]\n}\n', "1.0.0"),
    '{\n  "version": "1.0.0",\n  "items": ["one", "two"]\n}\n',
  );
  assert.throws(() => replaceVersion('{"name":"hope"}', "1.0.0"), /does not declare/u);
  assert.deepEqual(
    withPackageLockVersion({
      name: "hope",
      version: "0.5.0-alpha",
      packages: {
        "": { name: "hope", version: "0.5.0-alpha" },
        "node_modules/example": { version: "2.0.0" },
      },
    }, "1.0.0"),
    {
      name: "hope",
      version: "1.0.0",
      packages: {
        "": { name: "hope", version: "1.0.0" },
        "node_modules/example": { version: "2.0.0" },
      },
    },
  );
  assert.throws(
    () => withPackageLockVersion({ packages: {} }, "1.0.0"),
    /root package/u,
  );
});

test("release impact requires one exact version step for package changes and debt", () => {
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareVersions("2.0.0", "2.0.1"), -1);
  assert.equal(compareVersions("3.0.0", "2.9.9"), 1);
  assert.equal(incrementVersion("2.4.6", "patch"), "2.4.7");
  assert.equal(incrementVersion("2.4.6", "minor"), "2.5.0");
  assert.equal(incrementVersion("2.4.6", "major"), "3.0.0");
  assert.equal(releaseTypeBetween("2.4.6", "2.4.7"), "patch");
  assert.equal(releaseTypeBetween("2.4.6", "2.5.0"), "minor");
  assert.equal(releaseTypeBetween("2.4.6", "3.0.0"), "major");
  assert.equal(releaseTypeBetween("2.4.6", "2.4.6"), "none");
  assert.equal(releaseTypeBetween("2.4.6", "2.4.8"), undefined);

  assert.deepEqual(
    validateReleaseImpact({
      baseDigest: "released",
      baseVersion: "2.0.0",
      headDigest: "released",
      headVersion: "2.0.0",
      releasedDigest: "released",
      releasedVersion: "2.0.0",
    }),
    {
      inheritedPackageDebt: false,
      localPackageChange: false,
      releaseRequired: false,
      selectedType: "none",
    },
  );

  assert.deepEqual(
    validateReleaseImpact({
      baseDigest: "changed-before-this-pr",
      baseVersion: "2.0.0",
      headDigest: "changed-before-this-pr",
      headVersion: "2.0.1",
      releasedDigest: "released",
      releasedVersion: "2.0.0",
    }),
    {
      inheritedPackageDebt: true,
      localPackageChange: false,
      releaseRequired: true,
      selectedType: "patch",
    },
  );

  assert.deepEqual(
    validateReleaseImpact({
      baseDigest: "base",
      baseVersion: "2.0.0",
      headDigest: "head",
      headVersion: "2.1.0",
      releasedDigest: "base",
      releasedVersion: "2.0.0",
    }),
    {
      inheritedPackageDebt: false,
      localPackageChange: true,
      releaseRequired: true,
      selectedType: "minor",
    },
  );

  assert.throws(
    () => validateReleaseImpact({
      baseDigest: "base",
      baseVersion: "2.0.0",
      headDigest: "head",
      headVersion: "2.0.0",
      releasedDigest: "base",
      releasedVersion: "2.0.0",
    }),
    /release is required/u,
  );
  assert.throws(
    () => validateReleaseImpact({
      baseDigest: "same",
      baseVersion: "2.0.0",
      headDigest: "same",
      headVersion: "2.0.1",
      releasedDigest: "same",
      releasedVersion: "2.0.0",
    }),
    /version changes without/u,
  );
  assert.throws(
    () => validateReleaseImpact({
      baseDigest: "base",
      baseVersion: "2.0.0",
      headDigest: "head",
      headVersion: "2.0.2",
      releasedDigest: "base",
      releasedVersion: "2.0.0",
    }),
    /not one patch, minor, or major step/u,
  );
});

test("package impact ignores only manifest versions", () => {
  const manifest = (version) => Buffer.from(
    `{\n  "name": "hope",\n  "version": "${version}",\n  "skills": "./skills/"\n}\n`,
  );
  const entries = (version, { mode = "100644", skill = "one\n" } = {}) => [
    { bytes: manifest(version), mode: "100644", path: ".codex-plugin/plugin.json" },
    { bytes: Buffer.from(skill), mode, path: "skills/write/SKILL.md" },
  ];
  const baseline = packageDigest(entries("2.0.0"));

  assert.equal(packageDigest(entries("9.8.7")), baseline);
  assert.notEqual(packageDigest(entries("2.0.0", { skill: "two\n" })), baseline);
  assert.notEqual(packageDigest(entries("2.0.0", { mode: "100755" })), baseline);
  assert.notEqual(
    packageDigest([
      ...entries("2.0.0"),
      { bytes: Buffer.from("new\n"), mode: "100644", path: "skills/new/SKILL.md" },
    ]),
    baseline,
  );
});

test("development installation verifies the selected plugin and cache", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-dev-cache-test-"));
  context.after(async () => await rm(temporaryRoot, { recursive: true, force: true }));

  const manifest = JSON.parse(await readFile(
    join(pluginRoot, ".codex-plugin/plugin.json"),
    "utf8",
  ));
  const installResult = parseInstallResult(JSON.stringify({
    pluginId: "hope@hope",
    name: "hope",
    marketplaceName: "hope",
    version: manifest.version,
    installedPath: temporaryRoot,
  }), manifest.version);
  assert.equal(installResult.version, manifest.version);
  assert.throws(
    () => parseInstallResult("not json", manifest.version),
    /did not return/u,
  );
  assert.throws(
    () => parseInstallResult(JSON.stringify({
      ...installResult,
      version: "0.0.0",
    }), manifest.version),
    /unexpected/u,
  );

  await rm(temporaryRoot, { recursive: true, force: true });
  await stagePlugin(temporaryRoot);
  assert.deepEqual(
    await verifyInstalledPlugin(temporaryRoot),
    await readPackageFileList(),
  );
  await writeFile(
    join(temporaryRoot, "skills/diff/SKILL.md"),
    "changed\n",
    "utf8",
  );
  await assert.rejects(
    verifyInstalledPlugin(temporaryRoot),
    /does not match/u,
  );
});

test("the package file list rejects ambiguous or unsafe paths", () => {
  assert.throws(() => parsePackageFileList("b\na\n"), /sorted/u);
  assert.throws(() => parsePackageFileList("a\na\n"), /duplicate/u);
  assert.throws(() => parsePackageFileList("../secret\n"), /unsafe/iu);
  assert.throws(() => parsePackageFileList("folder\\file\n"), /unsafe/iu);
  assert.throws(() => parsePackageFileList("folder/./file\n"), /unsafe/iu);
});

test("release file lists compare across platform line endings", () => {
  const expected = `${pluginPackageFiles.join("\n")}\n`;
  const windowsCheckout = expected.replace(/\n/gu, "\r\n");

  assert.equal(normalizeLineEndings(windowsCheckout), expected);
});

test("CI installs locked dependencies before running checks or builds", async () => {
  const verify = await readFile(join(root, ".github/workflows/verify.yml"), "utf8");
  const release = await readFile(join(root, ".github/workflows/release.yml"), "utf8");
  const releasePlan = release.match(
    /- name: Choose release mode\n([\s\S]*?)\n      - name: Restore interrupted release commit/u,
  )?.[1];

  const verifyInstall = verify.indexOf("- run: npm ci");
  const releaseInstall = release.indexOf("run: npm ci");
  const releasePrepare = release.indexOf("npm run release:prepare");
  assert.ok(verifyInstall >= 0, "verify workflow must install dependencies");
  assert.ok(releaseInstall >= 0, "release workflow must install dependencies");
  assert.ok(releasePrepare >= 0, "release workflow must prepare the release");
  assert.ok(releasePlan, "release workflow must choose a release mode");
  assert.ok(verifyInstall < verify.indexOf("- run: npm run check"));
  assert.match(verify, /node tools\/release-impact\.mjs "\$\{BASE_REF\}"/u);
  assert.match(
    verify,
    /BASE_REF: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/u,
  );
  assert.match(
    verify,
    /if: matrix\.node == 22 && \(github\.event_name == 'pull_request' \|\| github\.ref == 'refs\/heads\/main'\)/u,
  );
  assert.ok(releaseInstall < releasePrepare);
  const checkJob = verify.match(/\n  check:\n([\s\S]*?)\n  platform-smoke:\n/u)?.[1];
  const platformSmokeJob = verify.match(
    /\n  platform-smoke:\n([\s\S]*?)\n  browser:\n/u,
  )?.[1];
  assert.ok(checkJob, "verify workflow must define the deterministic check job");
  assert.ok(platformSmokeJob, "verify workflow must define the platform smoke job");
  assert.match(checkJob, /node: \[22, 24\]/u);
  assert.match(checkJob, /runs-on: ubuntu-latest/u);
  assert.doesNotMatch(checkJob, /macos-latest|windows-latest/u);
  assert.match(platformSmokeJob, /os: \[macos-latest, windows-latest\]/u);
  assert.match(platformSmokeJob, /node-version: 22/u);
  assert.match(platformSmokeJob, /npm run build:plugin/u);
  assert.match(platformSmokeJob, /node --test test\/platform-smoke\.test\.mjs/u);
  assert.match(verify, /needs: \[check, platform-smoke, browser\]/u);
  assert.match(verify, /BROWSER_RESULT: \$\{\{ needs\.browser\.result \}\}/u);
  assert.match(
    verify,
    /PLATFORM_SMOKE_RESULT: \$\{\{ needs\.platform-smoke\.result \}\}/u,
  );
  assert.match(release, /npx playwright install --with-deps chromium/u);
  assert.match(release, /npm run test:browser/u);
  assert.doesNotMatch(release, /run: npm run check\s*$/mu);
  assert.match(release, /workflow_dispatch/u);
  assert.match(
    release,
    /workflow_run:\s+workflows:\s+- Verify\s+types:\s+- completed\s+branches:\s+- main/su,
  );
  assert.doesNotMatch(release, /^\s+paths:/mu);
  assert.match(
    release,
    /ref: \$\{\{ github\.event_name == 'workflow_dispatch' && 'main' \|\| github\.event\.workflow_run\.head_sha \}\}/u,
  );
  assert.match(release, /github\.event\.workflow_run\.event == 'push'/u);
  assert.match(release, /github\.event\.workflow_run\.conclusion == 'success'/u);
  assert.match(release, /test "\$\{VERIFY_EVENT\}" = "push"/u);
  assert.match(release, /test "\$\{EVENT_CONCLUSION\}" = "success"/u);
  assert.match(release, /test "\$\(git rev-parse HEAD\)" = "\$\{EVENT_SHA\}"/u);
  assert.match(release, /MODE=recorded/u);
  assert.doesNotMatch(releasePlan, /EVENT_NAME|workflow_dispatch/u);
  assert.doesNotMatch(release, /MODE=increment|BASE_TAG|--automatic/u);
  assert.match(
    release,
    /npm run release:prepare -- "\$\{\{ steps\.plan\.outputs\.current-version \}\}"/u,
  );
  assert.match(release, /steps\.plan\.outputs\.publish == 'true'/u);
  assert.doesNotMatch(release, /workflow_dispatch:\s+inputs:/su);
  assert.match(release, /echo "current-version=\$\{CURRENT_VERSION\}"/u);
  assert.match(release, /echo "version=\$\{RELEASE_VERSION\}"/u);
  assert.match(release, /gh release view/u);
  assert.match(release, /git checkout --detach/u);
  assert.match(release, /already exists unexpectedly/u);
  assert.match(
    release,
    /test "\$\(git rev-parse HEAD\)" = "\$\(git rev-parse "\$\{RELEASE_TAG\}\^\{commit\}"\)"/u,
  );
  assert.match(release, /steps\.plan\.outputs\.mode \}\}.*!= "resume"/u);
  assert.match(release, /git push origin "\$\{\{ steps\.release\.outputs\.tag \}\}"/u);
  assert.doesNotMatch(release, /HEAD:main|git commit|git add/u);
  assert.match(
    release,
    /git diff --exit-code -- package\.json package-lock\.json plugins\/hope tools\/plugin-package-files\.txt/u,
  );
  assert.match(release, /gh release create/u);
  assert.match(release, /--fail-on-no-commits/u);
  assert.match(release, /--latest/u);
  assert.doesNotMatch(release, /--prerelease/u);
  assert.ok(releasePrepare < release.indexOf("npm run test:browser"));
  assert.ok(
    release.indexOf("npm run test:browser") < release.indexOf("git diff --exit-code"),
  );
});

test("the release package contains exactly the approved plugin files", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-package-test-"));
  const destination = join(temporaryRoot, "hope");
  context.after(async () => await rm(temporaryRoot, { recursive: true, force: true }));

  const expected = await readPackageFileList();
  assert.deepEqual(await listFiles(pluginRoot), expected);
  assert.deepEqual(await stagePlugin(destination), expected);
  assert.deepEqual(await listFiles(destination), expected);

  for (const entry of expected) {
    assert.deepEqual(
      await readFile(resolve(destination, entry)),
      await readFile(resolve(pluginRoot, entry)),
      entry,
    );
  }

  const outsideRepository = join(temporaryRoot, "outside");
  await mkdir(outsideRepository);
  const diffHelp = spawnSync(
    process.execPath,
    [join(destination, "skills/diff/scripts/cli.mjs"), "--help"],
    {
      cwd: outsideRepository,
      encoding: "utf8",
    },
  );
  assert.equal(diffHelp.status, 0, diffHelp.stderr);
  assert.match(diffHelp.stdout, /Use Hope Diff through its private Skill adapter/u);

  const stagedValidate = await import(pathToFileURL(
    join(destination, "skills/diff/scripts/validate.mjs"),
  ));
  const stagedRender = await import(pathToFileURL(
    join(destination, "skills/diff/scripts/render.mjs"),
  ));
  const stagedCodeEvidence = await import(pathToFileURL(
    join(destination, "skills/diff/scripts/code-evidence.mjs"),
  ));
  const runId = "5".repeat(32);
  const snapshot = makeSnapshot();
  const review = stagedValidate.validateAnalysis(
    makeAnalysis(snapshot, runId),
    snapshot,
    { runId },
  );
  const artifact = await stagedRender.renderReview(review);
  assert.match(artifact.bytes.toString("utf8"), /<!doctype html>/u);
  assert.match(
    stagedCodeEvidence.renderCodeEvidence({
      excerpt: "const staged = true;",
      sourceKind: "file",
    }),
    /class="code-line"/u,
  );

  await assert.rejects(stagePlugin(destination), /already exists/u);
  await assert.rejects(
    stagePlugin(resolve(pluginRoot, "release-stage")),
    /outside plugins\/hope/u,
  );
});
