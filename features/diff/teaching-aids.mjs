import {
  ANALYSIS_VERSION,
  LIMITS,
  TEACHING_AID_CONTRACT_VERSION,
} from "./constants.mjs";
import { containsBidiControl } from "./text.mjs";

export const TEACHING_AID_NAMES = Object.freeze([
  "visual",
  "microworld",
  "quiz",
]);

export const TEACHING_AID_DECISIONS = Object.freeze([
  "included",
  "omitted",
  "not-applicable",
]);

export const TEACHING_AID_EVALUATION_CASES = Object.freeze([
  Object.freeze({
    expectedDecisions: Object.freeze({
      microworld: "included",
      quiz: "omitted",
      visual: "omitted",
    }),
    id: "bounded-state",
    situation: "A small input or state has several bounded outcomes that the reader can compare.",
  }),
  Object.freeze({
    expectedDecisions: Object.freeze({
      microworld: "not-applicable",
      quiz: "omitted",
      visual: "included",
    }),
    id: "static-relationship",
    situation: "A fixed branch, sequence, or component relationship is harder to follow in prose; add concrete values only when the relationship has meaningful values to follow.",
  }),
  Object.freeze({
    expectedDecisions: Object.freeze({
      microworld: "not-applicable",
      quiz: "included",
      visual: "not-applicable",
    }),
    id: "single-prediction",
    situation: "One non-trivial condition or failure case is worth predicting without an interactive model.",
  }),
  Object.freeze({
    expectedDecisions: Object.freeze({
      microworld: "omitted",
      quiz: "omitted",
      visual: "omitted",
    }),
    id: "prose-sufficient",
    situation: "The change has no relationship or prediction that an aid makes easier to understand than prose.",
  }),
]);

const CONTROL_KINDS = Object.freeze(["input", "condition", "state"]);

function exactObject(value, name, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${name} has an unknown field: ${key}`);
    }
  }
  return value;
}

function identifier(value, name) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) {
    throw new TypeError(`${name} must be a lowercase identifier`);
  }
  return value;
}

function label(value, name) {
  if (
    typeof value !== "string"
    || value.length === 0
    || [...value].length > LIMITS.modelString
  ) {
    throw new TypeError(`${name} must be a non-empty bounded string`);
  }
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    || containsBidiControl(value)
  ) {
    throw new TypeError(`${name} contains an unsafe control character`);
  }
  return value.replace(/\r\n?/gu, "\n");
}

function boundedArray(value, name, minimum, maximum) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length < minimum || value.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} items`);
  }
  return value;
}

export function normalizeMicroworldControls(value, {
  name = "microworld.controls",
} = {}) {
  const controls = boundedArray(value, name, 1, 3).map((control, index) => {
    const controlName = `${name}[${index}]`;
    exactObject(control, controlName, [
      "id",
      "kind",
      "label",
      "defaultOptionId",
      "options",
    ]);
    const options = boundedArray(
      control.options,
      `${controlName}.options`,
      2,
      4,
    ).map((option, optionIndex) => {
      const optionName = `${controlName}.options[${optionIndex}]`;
      exactObject(option, optionName, ["id", "label"]);
      return Object.freeze({
        id: identifier(option.id, `${optionName}.id`),
        label: label(option.label, `${optionName}.label`),
      });
    });
    const optionIds = new Set();
    for (const option of options) {
      if (optionIds.has(option.id)) {
        throw new Error(`${controlName}.options contains a duplicate id`);
      }
      optionIds.add(option.id);
    }
    const defaultOptionId = identifier(
      control.defaultOptionId,
      `${controlName}.defaultOptionId`,
    );
    if (!optionIds.has(defaultOptionId)) {
      throw new Error(`${controlName}.defaultOptionId refers to an unknown option`);
    }
    if (!CONTROL_KINDS.includes(control.kind)) {
      throw new RangeError(
        `${controlName}.kind must be one of ${CONTROL_KINDS.join(", ")}`,
      );
    }
    return Object.freeze({
      defaultOptionId,
      id: identifier(control.id, `${controlName}.id`),
      kind: control.kind,
      label: label(control.label, `${controlName}.label`),
      options: Object.freeze(options),
    });
  });
  const controlIds = new Set();
  for (const control of controls) {
    if (controlIds.has(control.id)) {
      throw new Error(`${name} contains a duplicate id`);
    }
    controlIds.add(control.id);
  }
  return Object.freeze(controls);
}

export function microworldSelections(controls) {
  let combinations = [[]];
  for (const control of controls) {
    combinations = combinations.flatMap((combination) => (
      control.options.map((option) => Object.freeze([
        ...combination,
        Object.freeze({ controlId: control.id, optionId: option.id }),
      ]))
    ));
  }
  if (combinations.length > 12) {
    throw new RangeError("microworld.controls produce more than 12 combinations");
  }
  return Object.freeze(combinations);
}

export function createMicroworldSkeleton(value) {
  const input = exactObject(value, "microworld skeleton", ["controls"]);
  const controls = normalizeMicroworldControls(input.controls);
  const scenarios = microworldSelections(controls).map((when, index) => (
    Object.freeze({
      id: `scenario-${index + 1}`,
      when,
    })
  ));
  return Object.freeze({
    controls,
    scenarios: Object.freeze(scenarios),
    version: TEACHING_AID_CONTRACT_VERSION,
  });
}

export function createTeachingAidContract() {
  return Object.freeze({
    analysisVersion: ANALYSIS_VERSION,
    decisions: Object.freeze({
      aids: TEACHING_AID_NAMES,
      classificationOrder: Object.freeze([
        "First identify the distinct teaching job for this specific aid from the task and evidence. Do not infer a teaching job merely because the source contains a sequence, identifier, or technical term.",
        "Use not-applicable when this aid has no distinct teaching job, even if the change has behavior or another aid is useful.",
        "Use omitted when this aid has a distinct teaching job but prose or another selected aid already performs it clearly.",
        "Use included only when this aid still makes its distinct teaching job materially easier to understand.",
      ]),
      includedRequires: Object.freeze(["reason", "teachingJob"]),
      required: true,
      states: TEACHING_AID_DECISIONS,
    }),
    evaluationCases: TEACHING_AID_EVALUATION_CASES,
    selectionOrder: Object.freeze([
      Object.freeze({
        aid: "microworld",
        when: "Use for a small bounded input, condition, or state whose changes help the reader predict different outcomes.",
      }),
      Object.freeze({
        aid: "visual",
        when: "Use for a static flow, branch, interaction, or component relationship that prose alone makes hard to follow.",
      }),
      Object.freeze({
        aid: "quiz",
        when: "Use for one to five non-trivial predictions, preserved conditions, or failure cases that do not need an interactive model.",
      }),
    ]),
    visual: Object.freeze({
      authoring: Object.freeze({
        exampleValues: Object.freeze({
          fields: Object.freeze(["caption", "detail", "message label", "row cell"]),
          grounding: "Ground each concrete value in review evidence and mark simplified or inferred values in the surrounding explanation.",
          inclusion: "Use concrete example values when they make data movement or control flow easier to follow.",
          deduplication: "Record one underlying evidence value once. Do not repeat it in cardinal, ordinal, or paraphrased form or for another visual field.",
          minimum: "Use only the smallest set of concrete values needed for the visual's teaching job.",
          notValues: "Do not list code identifiers, component names, or prose step labels as concrete example values merely because they appear in evidence.",
          omission: "Do not invent example values for a static relationship that has no meaningful values.",
        }),
        kindSelection: Object.freeze({
          "component-map": "Use for fixed components, responsibilities, calls, or handoffs when structure is the teaching job. A call does not by itself make timing or order the teaching job.",
          "decision-table": "Use when comparing meaningful branches or conditions and their outcomes is the teaching job.",
          flow: "Use when runtime data movement or control flow is the teaching job.",
          sequence: "Use only when time order or ordered messages between participants are themselves the teaching job.",
        }),
        selection: Object.freeze({
          noDuplicate: "Do not add a visual when the task's only deeper need is a concept definition handled by the beginner primer.",
          presentationOnly: "Use not-applicable for a presentation-only change with no flow, branch, component relationship, interaction, state transition, or prediction to visualize. Do not use omitted merely because ordinary Background already explains that change.",
          proseSufficient: "Do not add a visual for a short relationship that the ordinary explanation already makes easy to follow.",
          taskFirst: "Choose a visual from the task's distinct teaching job, not from every relationship that happens to appear in the evidence.",
        }),
      }),
    }),
    omission: Object.freeze({
      notApplicable: "Use when this specific aid has no matching distinct teaching job in the task and evidence. A change may have behavior while one aid remains not-applicable.",
      omitted: "Use when this specific aid has a matching distinct teaching job, but prose or another selected aid already performs that job clearly.",
    }),
    beginnerPrimer: Object.freeze({
      grounding: Object.freeze({
        code: "Use code when the item paraphrases a mechanism directly established by code evidence. Plain-language explanation does not by itself make that mechanism inferred.",
        inferred: "Use inferred only when the item's material meaning goes beyond what the cited evidence directly establishes.",
        split: "Split direct behavior from a broader inferred definition when one basis cannot accurately cover both claims.",
      }),
      inclusion: "Include only when the task requires a named concept or deeper starting point that ordinary Background cannot supply.",
      omission: "Omit when ordinary Background, the main explanation, or a selected aid already gives a new reader enough context. A request written for a new reader does not by itself require a primer.",
    }),
    microworld: Object.freeze({
      authoring: Object.freeze({
        content: "Use declarative explanation text only.",
        forbidden: Object.freeze([
          "repository code",
          "commands",
          "expressions",
          "URLs",
          "scripts",
        ]),
        truthBoundary: "Never claim that the microworld ran repository code or produced a test result.",
      }),
      completeCoverage: true,
      maximumScenarios: 12,
      skeletonCommand: "microworld-skeleton --input <private-controls.json>",
    }),
    quiz: Object.freeze({
      maximumQuestions: 5,
      minimumQuestions: 1,
    }),
    version: TEACHING_AID_CONTRACT_VERSION,
  });
}
