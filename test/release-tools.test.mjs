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
  incrementVersion,
  isSemanticVersion,
  releaseTypeForCommit,
  releaseTypeForCommits,
  replaceVersion,
  withPackageLockVersion,
  withVersion,
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
  assert.deepEqual(withVersion({ name: "hope", version: "old" }, "1.0.0"), {
    name: "hope",
    version: "1.0.0",
  });
  assert.throws(() => withVersion({}, "next"), /semantic version/u);
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

test("automatic releases derive the largest semantic change from commits", () => {
  assert.equal(releaseTypeForCommit("fix: keep the cache bounded"), "patch");
  assert.equal(releaseTypeForCommit("README wording"), "patch");
  assert.equal(releaseTypeForCommit("feat(diff): add a focused view"), "minor");
  assert.equal(releaseTypeForCommit("feat!: replace the public input\n"), "major");
  assert.equal(
    releaseTypeForCommit("refactor: simplify the boundary\n\nBREAKING CHANGE: remove v1"),
    "major",
  );
  assert.equal(
    releaseTypeForCommits([
      "fix: correct an error",
      "feat: add a capability",
      "docs: explain it",
    ]),
    "minor",
  );
  assert.equal(
    releaseTypeForCommits([
      "feat: add a capability",
      "refactor!: remove the old boundary",
    ]),
    "major",
  );
  assert.throws(() => releaseTypeForCommit(""), /non-empty commit/u);
  assert.throws(() => releaseTypeForCommits([]), /at least one commit/u);

  assert.equal(incrementVersion("2.4.6", "patch"), "2.4.7");
  assert.equal(incrementVersion("2.4.6", "minor"), "2.5.0");
  assert.equal(incrementVersion("2.4.6", "major"), "3.0.0");
  assert.throws(() => incrementVersion("2.4.6-rc.1", "patch"), /stable/u);
  assert.throws(() => incrementVersion("2.4.6", "unknown"), /Unknown release type/u);
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

  const verifyInstall = verify.indexOf("- run: npm ci");
  const releaseInstall = release.indexOf("run: npm ci");
  const releasePrepare = release.indexOf("npm run release:prepare");
  assert.ok(verifyInstall >= 0, "verify workflow must install dependencies");
  assert.ok(releaseInstall >= 0, "release workflow must install dependencies");
  assert.ok(releasePrepare >= 0, "release workflow must prepare the release");
  assert.ok(verifyInstall < verify.indexOf("- run: npm run check"));
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
  assert.match(release, /push:\s+branches:\s+- main/su);
  assert.match(
    release,
    /ref: \$\{\{ github\.event_name == 'workflow_dispatch' && 'main' \|\| github\.sha \}\}/u,
  );
  assert.match(release, /test "\$\(git rev-parse HEAD\)" = "\$\{EVENT_SHA\}"/u);
  assert.match(release, /MODE=increment/u);
  assert.match(release, /BASE_TAG="\$\{CURRENT_TAG\}"/u);
  assert.match(release, /npm run release:prepare -- --automatic "\$\{BASE_TAG\}"/u);
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
  assert.match(release, /git push --atomic origin HEAD:main/u);
  assert.match(
    release,
    /git diff --exit-code -- plugins\/hope tools\/plugin-package-files\.txt/u,
  );
  assert.match(
    release,
    /git add package\.json [^\n]*tools\/plugin-package-files\.txt/u,
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
