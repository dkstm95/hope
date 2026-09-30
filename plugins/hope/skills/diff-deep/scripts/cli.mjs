#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { addStatement, artifactStatus, captureArtifact, explainArtifact, inspectArtifact } from "./artifact.mjs";

const help = `Use Hope Diff Deep through its private Skill adapter.

  capture [PR URL or number] [--output new.html] [--locale en-US|ko-KR] [--theme system|light|dark]
  inspect artifact.html [--file id-or-path] [--offset number]
  explain artifact.html --input reasons.json --expected-digest digest
  source artifact.html --url issue-or-PR-URL --expected-digest digest
  status artifact.html [--current]

Capture writes all available changes before explanations. Explain revises only
the inspected owned artifact. No repository code, CI, or AI service is executed.
`;

function argumentsFor(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    const name = value.slice(2);
    if (Object.hasOwn(options, name)) throw new Error(`Repeated option --${name}`);
    if (name === "current") { options.current = true; continue; }
    if (!["output", "locale", "theme", "file", "offset", "input", "expected-digest", "url"].includes(name)) {
      throw new Error(`Unknown option --${name}`);
    }
    const next = argv[++index];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${name}`);
    options[name] = next;
  }
  return { positional, options };
}

export async function main(argv, dependencies = {}) {
  if (argv.length === 0 || ["--help", "help", "-h"].includes(argv[0])) return { help };
  const [command, ...remaining] = argv;
  const { positional, options } = argumentsFor(remaining);
  const allowed = {
    capture: ["output", "locale", "theme"], inspect: ["file", "offset"],
    explain: ["input", "expected-digest"], source: ["url", "expected-digest"], status: ["current"],
  }[command];
  if (!allowed) throw new Error(`Unknown command: ${command}`);
  if (Object.keys(options).some((key) => !allowed.includes(key))) throw new Error("Option does not apply to this command");
  if (positional.length > 1 || (command !== "capture" && positional.length !== 1)) throw new Error("Expected exactly one artifact path");
  const [target] = positional;
  if (command === "capture") return await captureArtifact(target, { ...dependencies, ...options });
  if (command === "inspect") {
    if (options.offset !== undefined && !/^(?:0|[1-9][0-9]*)$/u.test(options.offset)) throw new Error("Offset must be nonnegative");
    return await inspectArtifact(target, { fileId: options.file, offset: Number(options.offset ?? 0) });
  }
  if (command === "status") return await artifactStatus(target, { ...dependencies, current: options.current ?? false });
  if (!options["expected-digest"]) throw new Error("--expected-digest is required");
  if (command === "explain") {
    if (!options.input) throw new Error("--input is required");
    return await explainArtifact(target, options.input, options["expected-digest"], dependencies);
  }
  if (!options.url) throw new Error("--url is required");
  return await addStatement(target, options.url, options["expected-digest"], dependencies);
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isEntrypoint()) {
  main(process.argv.slice(2)).then((result) => {
    process.stdout.write(result.help ?? `${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`diff-deep: ${error.message}\n`);
    process.exitCode = 1;
  });
}
