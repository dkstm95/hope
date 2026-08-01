#!/usr/bin/env node

import { isEntrypoint } from "../../entrypoint/index.mjs";

import {
  createWritingBrief,
  runWrite,
  WRITE_MODEL_ADAPTER_CODE,
  WRITE_MODES,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope write feature.",
    "",
    "Automatic writing currently runs through the Hope Write Skill for Claude or Codex.",
    "",
    "Usage:",
    "  hope write",
    "",
    "Internal host protocol:",
    "  hope write brief --mode <draft|edit|review>",
  ].join("\n");
}

export function parseWriteArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  if (argv[0] !== "brief") {
    return { arguments: argv, command: "automatic" };
  }
  if (
    argv.length !== 3
    || argv[1] !== "--mode"
    || !WRITE_MODES.includes(argv[2])
  ) {
    throw new TypeError(usage());
  }
  return { command: "brief", mode: argv[2] };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseWriteArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runWrite ?? runWrite)(
      options.arguments,
      dependencies,
    );
  }
  const brief = await (
    dependencies.createWritingBrief ?? createWritingBrief
  )({ mode: options.mode });
  stdout.write(`${JSON.stringify(brief, null, 2)}\n`);
  return brief;
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`hope write: ${error.message}\n`);
    process.exitCode = error.code === WRITE_MODEL_ADAPTER_CODE ? 2 : 1;
  });
}
