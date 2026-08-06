#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationRecord,
  prepareSweepModelEvaluationRun,
  validateSweepModelEvaluationRecordSet,
} from "../features/sweep/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = process.env.HOPE_SWEEP_EVALUATION_MODEL ?? "gpt-5.6-terra";
const effort = process.env.HOPE_SWEEP_EVALUATION_EFFORT ?? "high";
const runStamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  process.env.HOPE_SWEEP_EVALUATION_OUTPUT
    ?? join(root, "test-results", `sweep-model-evaluation-${runStamp}`),
);
const schemaPath = join(
  root,
  "features",
  "sweep",
  "evaluation-output-v1.schema.json",
);

async function privateWrite(path, value) {
  await mkdir(dirname(path), { mode: 0o700, recursive: true });
  await writeFile(path, value, { mode: 0o600 });
  await chmod(path, 0o600);
}

function runProcess(command, arguments_, { cwd = root, input } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolveRun({ status, stdout, stderr }));
    child.stdin.end(input);
  });
}

function parseEvents(stdout) {
  return stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function invocationIdentity(events) {
  const started = events.find((event) => event.type === "thread.started");
  const identity = started?.thread_id ?? started?.threadId ?? started?.id;
  if (typeof identity !== "string" || !identity.trim()) {
    throw new TypeError("Codex did not report a fresh thread identity");
  }
  return identity;
}

async function codexVersion() {
  const result = await runProcess("codex", ["--version"]);
  if (result.status !== 0) {
    throw new Error(result.stderr || "Could not read the Codex CLI version");
  }
  return result.stdout.trim();
}

async function runCase(specification, host) {
  const prepared = await prepareSweepModelEvaluationRun(specification);
  const caseRoot = join(outputRoot, specification.caseId);
  const preparedPath = join(caseRoot, "prepared.json");
  const outputPath = join(caseRoot, "output.json");
  const eventsPath = join(caseRoot, "events.jsonl");
  const stderrPath = join(caseRoot, "stderr.txt");
  await privateWrite(preparedPath, `${JSON.stringify(prepared, null, 2)}\n`);

  const prompt = [
    "Evaluate one blinded synthetic Hope Sweep case.",
    "Use only the prepared JSON below.",
    "Do not inspect the filesystem, call tools, infer an oracle, or modify anything.",
    "Follow the prepared brief and output contract.",
    "Return exactly the JSON object required by the supplied response schema.",
    "",
    JSON.stringify(prepared),
  ].join("\n");
  const result = await runProcess("codex", [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--model",
    model,
    "--config",
    `model_reasoning_effort=\"${effort}\"`,
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "--json",
    "-",
  ], {
    cwd: tmpdir(),
    input: prompt,
  });
  await privateWrite(eventsPath, result.stdout);
  await privateWrite(stderrPath, result.stderr);
  if (result.status !== 0) {
    throw new Error(
      `Fresh Codex run failed for ${specification.caseId}: ${result.stderr}`,
    );
  }
  await chmod(outputPath, 0o600);
  const events = parseEvents(result.stdout);
  const rawOutput = await readFile(outputPath, "utf8");
  const output = JSON.parse(rawOutput);
  const created = await createSweepModelEvaluationRecord({
    ...specification,
    host,
    model,
    effort,
    invocationId: invocationIdentity(events),
    output,
    runnerEvidence: {
      runner: "hope-codex-evaluation-runner-v1",
      events,
      rawOutput,
    },
  });
  await privateWrite(
    join(caseRoot, "record.json"),
    `${JSON.stringify(created.record, null, 2)}\n`,
  );
  process.stdout.write(
    `${specification.caseId}: ${created.evaluation.runPassed ? "pass" : "fail"}\n`,
  );
  return created.record;
}

await mkdir(outputRoot, { mode: 0o700, recursive: true });
const host = await codexVersion();
const plan = createSweepModelEvaluationPlan();
await privateWrite(join(outputRoot, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

const records = [];
for (const specification of plan.runs) {
  records.push(await runCase(specification, host));
}
await privateWrite(
  join(outputRoot, "records.json"),
  `${JSON.stringify(records, null, 2)}\n`,
);
const result = await validateSweepModelEvaluationRecordSet(records);
await privateWrite(
  join(outputRoot, "result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);

process.stdout.write(`${JSON.stringify({ outputRoot, result }, null, 2)}\n`);
