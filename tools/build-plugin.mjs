#!/usr/bin/env node

import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "./entrypoint.mjs";
import {
  generatedPluginFiles,
  pluginPackageFiles,
} from "./plugin-files.mjs";

const root = new URL("../", import.meta.url);
const fromRoot = (path) => new URL(path, root);

export const normalizeLineEndings = (content) => content.replace(/\r\n?/gu, "\n");

export async function expectedPluginFile(entry) {
  return normalizeLineEndings(
    await readFile(fromRoot(entry.source), "utf8"),
  );
}

export async function buildPlugin() {
  for (const entry of generatedPluginFiles) {
    const destination = fileURLToPath(fromRoot(entry.destination));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await expectedPluginFile(entry), "utf8");
  }
  await writeFile(
    fromRoot("tools/plugin-package-files.txt"),
    `${pluginPackageFiles.join("\n")}\n`,
    "utf8",
  );
}

if (isEntrypoint(import.meta.url)) {
  buildPlugin().catch((error) => {
    process.stderr.write(`build-plugin: ${error.message}\n`);
    process.exitCode = 1;
  });
}
