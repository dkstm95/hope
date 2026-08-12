#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  expectedPluginFile,
  normalizeLineEndings,
  pluginBuildEntries,
} from "./build-plugin.mjs";
import { pluginPackageFiles } from "./plugin-files.mjs";

const root = new URL("../", import.meta.url);
const fromRoot = (path) => new URL(path, root);
const read = async (path) => await readFile(fromRoot(path), "utf8");
const readBytes = async (path) => await readFile(fromRoot(path));
const readJson = async (path) => JSON.parse(await read(path));
const packageJson = await readJson("package.json");
const currentVersion = packageJson.version;

await Promise.all(pluginPackageFiles.map(
  async (path) => await readBytes(`plugins/hope/${path}`),
));

for (const entry of pluginBuildEntries) {
  const expected = await expectedPluginFile(entry);
  assert.equal(
    normalizeLineEndings(await read(entry.destination)),
    expected,
    `${entry.destination} must be rebuilt from ${entry.source}`,
  );
}

const [
  codexPlugin,
  claudePlugin,
  codexMarketplace,
  claudeMarketplace,
  packageLock,
] =
  await Promise.all([
    readJson("plugins/hope/.codex-plugin/plugin.json"),
    readJson("plugins/hope/.claude-plugin/plugin.json"),
    readJson(".agents/plugins/marketplace.json"),
    readJson(".claude-plugin/marketplace.json"),
    readJson("package-lock.json"),
  ]);

assert.equal(packageJson.version, currentVersion);
assert.equal(packageLock.version, currentVersion);
assert.equal(packageLock.packages[""].version, currentVersion);
assert.equal(packageJson.bin, undefined);
assert.equal(packageJson.scripts.hope, undefined);
assert.equal(codexPlugin.name, "hope");
assert.equal(codexPlugin.version, currentVersion);
assert.equal(codexPlugin.interface.defaultPrompt.length, 4);
assert.equal(claudePlugin.name, "hope");
assert.equal(claudePlugin.version, currentVersion);
if (process.env.GITHUB_REF_TYPE === "tag") {
  assert.equal(process.env.GITHUB_REF_NAME, `v${currentVersion}`);
}
assert.equal(codexPlugin.skills, "./skills/");
assert.equal(claudePlugin.skills, "./skills/");
assert.equal(
  codexPlugin.interface.composerIcon,
  "./skills/diff/assets/HopeFavicon.png",
);
assert.equal(
  codexPlugin.interface.logo,
  "./assets/hope-protected-light.png",
);
assert.ok(codexMarketplace.plugins.some(
  (entry) => entry.name === "hope" && entry.source.path === "./plugins/hope",
));
const claudeMarketplaceEntry = claudeMarketplace.plugins.find(
  (entry) => entry.name === "hope",
);
assert.equal(claudeMarketplaceEntry.source, "./plugins/hope");
assert.equal(claudeMarketplaceEntry.version, undefined);
assert.equal(packageJson.scripts["plugin:dev:install"], "node tools/install-plugin-dev.mjs");
assert.equal(
  packageJson.scripts["render:readme-assets"],
  "node tools/render-readme-assets.mjs",
);
assert.ok(
  packageJson.scripts.check
    .split("&&")
    .map((command) => command.trim())
    .includes("npm run release:check"),
  "npm run check must include release impact",
);
assert.equal(
  normalizeLineEndings(await read("tools/plugin-package-files.txt")),
  `${pluginPackageFiles.join("\n")}\n`,
);

console.log(`Hope ${currentVersion} package structure is consistent.`);
