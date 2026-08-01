#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "../entrypoint/index.mjs";
import { buildPlugin } from "./build-plugin.mjs";
import { readPackageFileList } from "./stage-plugin.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const pluginRoot = resolve(root, "plugins/hope");
const sourceManifest = resolve(
  pluginRoot,
  ".codex-plugin/plugin.json",
);

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(
      detail ? `${command} failed: ${detail}` : `${command} failed`,
    );
  }
  return result;
}

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listFiles(path, base));
    } else {
      paths.push(relative(base, path).split(sep).join("/"));
    }
  }
  return paths.sort();
}

function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === "" || (
    !isAbsolute(pathFromParent)
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
  );
}

export function parseInstallResult(stdout, expectedVersion) {
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error("Codex did not return a JSON plugin install result");
  }
  if (
    result.pluginId !== "hope@hope"
    || result.name !== "hope"
    || result.marketplaceName !== "hope"
    || result.version !== expectedVersion
    || typeof result.installedPath !== "string"
  ) {
    throw new Error("Codex installed an unexpected Hope plugin result");
  }
  return result;
}

export async function verifyInstalledPlugin(installedPath) {
  const resolvedInstalledPath = resolve(installedPath);
  if (isInside(pluginRoot, resolvedInstalledPath)) {
    throw new Error("Codex reported the editable plugin source as its cache");
  }

  const expectedFiles = await readPackageFileList();
  const actualFiles = await listFiles(resolvedInstalledPath);
  if (
    actualFiles.length !== expectedFiles.length
    || actualFiles.some((path, index) => path !== expectedFiles[index])
  ) {
    throw new Error("The installed Hope cache has an unexpected file list");
  }

  for (const path of expectedFiles) {
    const source = resolve(pluginRoot, path);
    const installed = resolve(resolvedInstalledPath, path);
    const installedInfo = await lstat(installed);
    if (!installedInfo.isFile() || installedInfo.isSymbolicLink()) {
      throw new Error(`Installed Hope file is not a regular file: ${path}`);
    }
    const [sourceBytes, installedBytes] = await Promise.all([
      readFile(source),
      readFile(installed),
    ]);
    if (!sourceBytes.equals(installedBytes)) {
      throw new Error(`Installed Hope file does not match its source: ${path}`);
    }
  }
  return expectedFiles;
}

export async function installDevPlugin({ codexCommand = "codex" } = {}) {
  await buildPlugin();
  run(process.execPath, ["tools/check-plugin-version.mjs"]);
  run(process.execPath, ["tools/check-release.mjs"]);

  const manifest = JSON.parse(await readFile(sourceManifest, "utf8"));
  const install = run(codexCommand, [
    "plugin",
    "add",
    "hope@hope",
    "--json",
  ]);
  const result = parseInstallResult(install.stdout, manifest.version);
  await verifyInstalledPlugin(result.installedPath);
  process.stdout.write(
    `Installed and verified Hope ${result.version}. Start a new Codex task to use it.\n`,
  );
  return result;
}

if (isEntrypoint(import.meta.url)) {
  if (process.argv.length !== 2) {
    process.stderr.write("Usage: npm run plugin:dev:install\n");
    process.exitCode = 1;
  } else {
    installDevPlugin().catch((error) => {
      process.stderr.write(`plugin-dev-install: ${error.message}\n`);
      process.exitCode = 1;
    });
  }
}
