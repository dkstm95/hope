import { readBoundedJson } from "../work-snapshot/index.mjs";

import {
  createHopeFeatureSelectionEvaluationReceipt,
  hopeFeatureSelectionEvaluationLimits,
  validateHopeFeatureSelectionEvaluationReceipt,
  validateHopeFeatureSelectionEvaluationReceiptSet,
} from "./feature-selection.mjs";
import {
  createHopeWriteExampleEvaluationReceipt,
  createHopeWriteProductionVerificationReceipt,
  hopeWriteExampleEvaluationLimits,
  validateHopeWriteExampleEvaluationReceipt,
  validateHopeWriteExampleEvaluationReceiptSet,
  validateHopeWriteProductionVerificationReceipt,
  validateHopeWriteProductionVerificationReceiptSet,
} from "./write-examples.mjs";

export * from "./feature-selection.mjs";
export * from "./write-examples.mjs";

export async function createHopeFeatureSelectionEvaluationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection model output",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.outputBytes,
  });
  return (dependencies.createReceipt
    ?? createHopeFeatureSelectionEvaluationReceipt)({
    ...options,
    output: input.value,
  });
}

export async function validateHopeFeatureSelectionEvaluationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection evaluation receipt",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.receiptBytes,
  });
  return (dependencies.validateReceipt
    ?? validateHopeFeatureSelectionEvaluationReceipt)(input.value);
}

export async function validateHopeFeatureSelectionEvaluationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection evaluation receipt set",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.receiptSetBytes,
  });
  return (dependencies.validateReceiptSet
    ?? validateHopeFeatureSelectionEvaluationReceiptSet)(input.value);
}

export async function createHopeWriteExampleEvaluationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return (dependencies.createReceipt
    ?? createHopeWriteExampleEvaluationReceipt)({
    ...options,
    output: input.value,
  });
}

export async function validateHopeWriteExampleEvaluationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation receipt",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptBytes,
  });
  return (dependencies.validateReceipt
    ?? validateHopeWriteExampleEvaluationReceipt)(input.value);
}

export async function validateHopeWriteExampleEvaluationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation receipt set",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptSetBytes,
  });
  return (dependencies.validateReceiptSet
    ?? validateHopeWriteExampleEvaluationReceiptSet)(input.value);
}

export async function createHopeWriteProductionVerificationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return (dependencies.createReceipt
    ?? createHopeWriteProductionVerificationReceipt)({
    ...options,
    output: input.value,
  });
}

export async function validateHopeWriteProductionVerificationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification receipt",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptBytes,
  });
  return (dependencies.validateReceipt
    ?? validateHopeWriteProductionVerificationReceipt)(input.value);
}

export async function validateHopeWriteProductionVerificationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification receipt set",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptSetBytes,
  });
  return (dependencies.validateReceiptSet
    ?? validateHopeWriteProductionVerificationReceiptSet)(input.value);
}
