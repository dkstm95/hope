import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import { buildMicroworldSkeleton } from "../plugins/hope/skills/diff/scripts/index.mjs";
import {
  createMicroworldSkeleton,
  TEACHING_AID_DECISIONS,
  TEACHING_AID_NAMES,
} from "../plugins/hope/skills/diff/scripts/teaching-aids.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingAidDecisions,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

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

test("the runtime exposes deterministic teaching-aid enums", () => {
  assert.deepEqual(TEACHING_AID_NAMES, ["visual", "microworld", "quiz"]);
  assert.deepEqual(TEACHING_AID_DECISIONS, [
    "included",
    "omitted",
    "not-applicable",
  ]);
});

test("the runtime creates an exhaustive bounded microworld skeleton", () => {
  const skeleton = createMicroworldSkeleton({ controls: controls() });
  assert.equal(skeleton.version, 6);
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

test("the shared Diff boundary reads a private controls file for the skeleton", async () => {
  const root = await createTestTemporaryDirectory("hope-microworld-controls-");
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

test("the current analysis version records every teaching-aid decision and matches payloads", () => {
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
