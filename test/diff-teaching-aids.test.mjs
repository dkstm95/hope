import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import { buildMicroworldSkeleton } from "../plugins/hope/skills/diff/scripts/index.mjs";
import {
  createMicroworldSkeleton,
} from "../plugins/hope/skills/diff/scripts/teaching-aids.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
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

test("optional aids validate directly without a decision record", () => {
  const snapshot = makeSnapshot();
  for (const visual of [false, true]) {
    for (const microworld of [false, true]) {
      for (const quiz of [false, true]) {
        const analysis = makeAnalysis(snapshot, runId);
        if (visual || microworld) {
          analysis.behavior = makeTeachingBehavior({ includeMicroworld: microworld });
          if (!visual) delete analysis.behavior.visual;
        }
        if (quiz) {
          analysis.quiz = [{
            answer: "The saved final failure reaches the caller.",
            evidence: [{ endLine: 4, sourceId: "source-3", startLine: 2 }],
            question: "Which failure reaches the caller after the final retry?",
          }];
        }
        const validated = validateAnalysis(analysis, snapshot, { runId });
        assert.equal(Boolean(validated.behavior?.visual), visual);
        assert.equal(Boolean(validated.behavior?.microworld), microworld);
        assert.equal(validated.quiz.length, quiz ? 1 : 0);
      }
    }
  }
});

test("included aids still require captured evidence and complete scenarios", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.behavior = makeTeachingBehavior();
  analysis.behavior.visual.evidence[0].sourceId = "source-99";
  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /source-99/u,
  );

  analysis.behavior = makeTeachingBehavior();
  analysis.behavior.microworld.scenarios.pop();
  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /scenario|combination/u,
  );
});
