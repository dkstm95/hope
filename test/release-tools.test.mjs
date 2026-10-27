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

test("release preparation accepts only stable versions", () => {
  assert.equal(incrementVersion("2.4.6", "patch"), "2.4.7");
  assert.equal(incrementVersion("2.4.6", "minor"), "2.5.0");
  assert.equal(incrementVersion("2.4.6", "major"), "3.0.0");
  assert.throws(() => incrementVersion("2.4.6", "none"), /patch, minor, or major/u);
  assert.equal(
    replaceVersion('{\n  "version": "0.1.0",\n  "items": ["one", "two"]\n}\n', "1.0.0"),
    '{\n  "version": "1.0.0",\n  "items": ["one", "two"]\n}\n',
  );
  assert.throws(
    () => replaceVersion('{"version":"1.0.0"}', "1.0.1-rc.1"),
    /stable semantic version/u,
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
  assert.throws(
    () => withPackageLockVersion({ packages: { "": {} } }, "1.0.1+build.1"),
    /stable semantic version/u,
  );

  const prerelease = spawnSync(
    process.execPath,
    [join(root, "tools/prepare-release.mjs"), "2.2.0-rc.1"],
    { encoding: "utf8" },
  );
  assert.equal(prerelease.status, 1);
  assert.match(prerelease.stderr, /<patch\|minor\|major>/u);
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

test("CI keeps release decisions local and publishes a checked package", async () => {
  const verify = await readFile(join(root, ".github/workflows/verify.yml"), "utf8");
  const release = await readFile(join(root, ".github/workflows/release.yml"), "utf8");

  const verifyInstall = verify.indexOf("- run: npm ci");
  const releaseCheck = release.indexOf("node tools/check-release.mjs");
  const releaseStage = release.indexOf("node tools/stage-plugin.mjs");
  const releasePackageCheck = release.indexOf("unzip -t");
  const releasePublish = release.indexOf("- name: Publish recorded release");
  assert.ok(verifyInstall >= 0, "verify workflow must install dependencies");
  assert.ok(verifyInstall < verify.indexOf("- run: npm run check"));
  assert.match(verify, /name: Verify\n\s+runs-on: ubuntu-latest/u);
  assert.doesNotMatch(verify, /matrix|test:browser|playwright install/u);
  assert.match(release, /push:\s+branches:\s+- main\s+paths:\s+- package\.json/su);
  assert.match(release, /workflow_dispatch/u);
  assert.doesNotMatch(release, /workflow_run/u);
  assert.match(release, /queue: max/u);
  assert.match(release, /ref: \$\{\{ github\.sha \}\}/u);
  assert.match(release, /test "\$\{EVENT_REF\}" = "refs\/heads\/main"/u);
  assert.match(release, /test "\$\(git rev-parse HEAD\)" = "\$\{EVENT_SHA\}"/u);
  assert.match(release, /PREVIOUS_VERSION=.*BEFORE_SHA/u);
  assert.doesNotMatch(release, /npm ci|release:prepare|test:browser|playwright install/u);
  assert.match(release, /git tag "\$\{\{ steps\.plan\.outputs\.current-tag \}\}"/u);
  assert.doesNotMatch(release, /git tag -a/u);
  assert.match(release, /git push origin "\$\{\{ steps\.plan\.outputs\.current-tag \}\}"/u);
  assert.doesNotMatch(release, /HEAD:main|git commit|git add/u);
  assert.match(release, /gh release create/u);
  assert.ok(releaseCheck >= 0);
  assert.ok(releaseStage > releaseCheck);
  assert.ok(releasePackageCheck > releaseStage);
  assert.ok(releasePublish > releasePackageCheck);
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
