import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildMicroworldSkeleton } from "../features/diff/index.mjs";
import {
  createMicroworldSkeleton,
  createTeachingAidContract,
} from "../features/diff/teaching-aids.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingAidDecisions,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "7".repeat(32);

function controls({
  controlCount = 2,
  optionCount = 2,
} = {}) {
  return Array.from({ length: controlCount }, (_, controlIndex) => ({
    defaultOptionId: "option-1",
    id: `control-${controlIndex + 1}`,
    kind: controlIndex === 0 ? "input" : "state",
    label: `Control ${controlIndex + 1}`,
    options: Array.from({ length: optionCount }, (_, optionIndex) => ({
      id: `option-${optionIndex + 1}`,
      label: `Option ${optionIndex + 1}`,
    })),
  }));
}

test("the shared teaching-aid contract owns selection and omission decisions", () => {
  const contract = createTeachingAidContract();
  assert.equal(contract.analysisVersion, 2);
  assert.deepEqual(contract.decisions.aids, ["visual", "microworld", "quiz"]);
  assert.deepEqual(
    contract.selectionOrder.map((item) => item.aid),
    ["microworld", "visual", "quiz"],
  );
  assert.deepEqual(
    contract.evaluationCases.map((item) => item.id),
    ["bounded-state", "static-relationship", "single-prediction", "prose-sufficient"],
  );
  const includedCounts = Object.fromEntries(
    contract.decisions.aids.map((aid) => [
      aid,
      contract.evaluationCases.filter(
        (item) => item.expectedDecisions[aid] === "included",
      ).length,
    ]),
  );
  assert.deepEqual(includedCounts, { microworld: 1, quiz: 1, visual: 1 });
  assert.deepEqual(
    contract.evaluationCases.at(-1).expectedDecisions,
    { microworld: "omitted", quiz: "omitted", visual: "omitted" },
  );
  assert.equal(contract.quiz.minimumQuestions, 1);
  assert.equal(contract.microworld.maximumScenarios, 12);
  assert.match(contract.microworld.skeletonCommand, /microworld-skeleton/u);
});

test("the runtime creates an exhaustive bounded microworld skeleton", () => {
  const skeleton = createMicroworldSkeleton({ controls: controls() });
  assert.equal(skeleton.scenarios.length, 4);
  assert.deepEqual(
    skeleton.scenarios.map((scenario) => scenario.when),
    [
      [
        { controlId: "control-1", optionId: "option-1" },
        { controlId: "control-2", optionId: "option-1" },
      ],
      [
        { controlId: "control-1", optionId: "option-1" },
        { controlId: "control-2", optionId: "option-2" },
      ],
      [
        { controlId: "control-1", optionId: "option-2" },
        { controlId: "control-2", optionId: "option-1" },
      ],
      [
        { controlId: "control-1", optionId: "option-2" },
        { controlId: "control-2", optionId: "option-2" },
      ],
    ],
  );
  assert.throws(
    () => createMicroworldSkeleton({
      controls: controls({ controlCount: 3, optionCount: 3 }),
    }),
    /more than 12 combinations/u,
  );
});

test("the shared Diff boundary reads a private controls file for the skeleton", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "hope-microworld-controls-"));
  context.after(async () => await rm(root, { force: true, recursive: true }));
  const inputPath = join(root, "controls.json");
  await writeFile(
    inputPath,
    `${JSON.stringify({ controls: controls() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  const skeleton = await buildMicroworldSkeleton(inputPath);
  assert.equal(skeleton.scenarios.length, 4);
  assert.equal(skeleton.controls[0].id, "control-1");
});

test("analysis version 2 records every teaching-aid decision and matches payloads", () => {
  const snapshot = makeSnapshot();
  const missing = makeAnalysis(snapshot, runId);
  delete missing.teachingAids;
  assert.throws(
    () => validateAnalysis(missing, snapshot, { runId }),
    /teachingAids must be an object/u,
  );

  const missingPayload = makeAnalysis(snapshot, runId);
  missingPayload.teachingAids.visual = {
    decision: "included",
    reason: "A branch is hard to follow.",
    teachingJob: "Show the branch.",
  };
  assert.throws(
    () => validateAnalysis(missingPayload, snapshot, { runId }),
    /must match the visual payload/u,
  );

  const unrecordedPayload = makeAnalysis(snapshot, runId);
  unrecordedPayload.behavior = makeTeachingBehavior({
    includeMicroworld: false,
  });
  assert.throws(
    () => validateAnalysis(unrecordedPayload, snapshot, { runId }),
    /must match the visual payload/u,
  );

  const repeatedJob = makeAnalysis(snapshot, runId);
  repeatedJob.behavior = makeTeachingBehavior();
  repeatedJob.quiz = [{
    answer: "The saved final failure reaches the caller.",
    evidence: [{ endLine: 4, sourceId: "source-3", startLine: 2 }],
    question: "Which failure reaches the caller after the final retry?",
  }];
  repeatedJob.teachingAids = makeTeachingAidDecisions({
    microworld: true,
    quiz: true,
    visual: true,
  });
  for (const aid of ["microworld", "quiz", "visual"]) {
    repeatedJob.teachingAids[aid].teachingJob = "  Explain the same outcome. ";
  }
  assert.throws(
    () => validateAnalysis(repeatedJob, snapshot, { runId }),
    /repeats the teaching job/u,
  );
});

test("one grounded quiz question is valid and contributes decision metrics", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.quiz = [{
    answer: "The saved final failure reaches the caller.",
    evidence: [{ endLine: 4, sourceId: "source-3", startLine: 2 }],
    question: "Which failure reaches the caller after the final retry?",
  }];
  analysis.teachingAids = makeTeachingAidDecisions({ quiz: true });

  const validated = validateAnalysis(analysis, snapshot, { runId });
  assert.equal(validated.quiz.length, 1);
  assert.equal(validated.resources.teachingAidDecisions, 3);
  assert.equal(validated.resources.teachingAidMicroworldIncluded, 0);
  assert.equal(validated.resources.teachingAidQuizIncluded, 1);
  assert.equal(validated.resources.teachingAidVisualIncluded, 0);
  assert.equal(validated.resources.teachingAidsIncluded, 1);
  assert.equal(validated.resources.teachingAidsOmitted, 2);
  assert.equal(validated.resources.teachingAidsNotApplicable, 0);
});

test("legacy analysis remains valid without a decision record", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.schemaVersion = 1;
  delete analysis.teachingAids;

  const validated = validateAnalysis(analysis, snapshot, {
    analysisVersion: 1,
    runId,
  });
  assert.equal(validated.analysisSchemaVersion, 1);
  assert.equal(validated.resources.teachingAidDecisions, 0);
  assert.equal(validated.resources.teachingAidsOmitted, 3);
});

test("legacy analysis keeps its original three-question quiz minimum", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.schemaVersion = 1;
  delete analysis.teachingAids;
  analysis.quiz = [{
    answer: "The saved final failure reaches the caller.",
    evidence: [{ endLine: 4, sourceId: "source-3", startLine: 2 }],
    question: "Which failure reaches the caller after the final retry?",
  }];

  assert.throws(
    () => validateAnalysis(analysis, snapshot, {
      analysisVersion: 1,
      runId,
    }),
    /at least 3 questions/u,
  );

  analysis.quiz = Array.from({ length: 3 }, (_, index) => ({
    ...analysis.quiz[0],
    question: `${analysis.quiz[0].question} ${index + 1}`,
  }));
  const validated = validateAnalysis(analysis, snapshot, {
    analysisVersion: 1,
    runId,
  });
  assert.equal(validated.quiz.length, 3);
});
