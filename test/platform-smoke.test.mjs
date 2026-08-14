import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { pluginPackageFiles } from "../tools/plugin-files.mjs";
import { stagePlugin } from "../tools/stage-plugin.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the staged plugin runs from an external platform path", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope platform smoke-"));
  context.after(async () => {
    await rm(temporaryRoot, { force: true, recursive: true });
  });

  const destination = join(temporaryRoot, "installed plugin", "hope");
  const stagedFiles = await stagePlugin(destination);
  assert.deepEqual(
    stagedFiles,
    pluginPackageFiles.map((path) => path.replace(/^plugins\/hope\//u, "")),
  );

  const manifest = JSON.parse(await readFile(
    join(destination, ".codex-plugin", "plugin.json"),
    "utf8",
  ));
  assert.equal(manifest.name, "hope");
  assert.equal(manifest.skills, "./skills/");

  const outsideRepository = join(temporaryRoot, "outside repository");
  await mkdir(outsideRepository);
  const alignHelp = spawnSync(
    process.execPath,
    [join(destination, "skills", "align", "scripts", "cli.mjs"), "--help"],
    {
      cwd: outsideRepository,
      encoding: "utf8",
    },
  );
  assert.equal(alignHelp.status, 0, alignHelp.stderr);
  assert.match(alignHelp.stdout, /Use Hope Align through its private Skill adapter/u);
  assert.doesNotMatch(alignHelp.stderr, /\S/u);

  const diffHelp = spawnSync(
    process.execPath,
    [join(destination, "skills", "diff", "scripts", "cli.mjs"), "--help"],
    {
      cwd: outsideRepository,
      encoding: "utf8",
    },
  );
  assert.equal(diffHelp.status, 0, diffHelp.stderr);
  assert.match(diffHelp.stdout, /Use Hope Diff through its private Skill adapter/u);
  assert.doesNotMatch(diffHelp.stderr, /\S/u);

  assert.notEqual(resolve(destination), resolve(root, "plugins", "hope"));
});
