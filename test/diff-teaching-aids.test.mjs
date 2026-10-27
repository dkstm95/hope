import assert from "node:assert/strict";
import test from "node:test";

import {
  microworldSelections,
  normalizeMicroworldControls,
} from "../plugins/hope/skills/diff/scripts/teaching-aids.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
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

test("the runtime derives every bounded microworld combination", () => {
  const selections = microworldSelections(normalizeMicroworldControls(controls()));
  assert.deepEqual(
    selections.map((when) => when.map(({ optionId }) => optionId).join("|")),
    ["option-1|option-1", "option-1|option-2", "option-2|option-1", "option-2|option-2"],
  );
  assert.throws(
    () => microworldSelections(normalizeMicroworldControls(controls({ controlCount: 3, optionCount: 3 }))),
    /more than 12 combinations/u,
  );
});

test("validation names each missing combination and accepts authored scenario ids", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.behavior = makeTeachingBehavior();
  const { scenarios } = analysis.behavior.microworld;
  scenarios.forEach((scenario, index) => { scenario.id = `case-${String.fromCharCode(97 + index)}`; });
  assert.equal(validateAnalysis(analysis, snapshot, { runId }).behavior.microworld.scenarios[0].id, "case-a");

  scenarios.splice(1, 2);
  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /missing control combinations: attempt=failed\|saved-error=present; attempt=succeeded\|saved-error=missing/u,
  );
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
