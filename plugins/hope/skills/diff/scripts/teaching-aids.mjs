import {
  LIMITS,
  MICROWORLD_SKELETON_VERSION,
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
    || value.trim().length === 0
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
    version: MICROWORLD_SKELETON_VERSION,
  });
}
