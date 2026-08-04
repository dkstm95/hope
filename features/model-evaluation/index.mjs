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
import {
  createHopePolishPreservationEvaluationReceipt,
  hopePolishPreservationEvaluationLimits,
  validateHopePolishPreservationEvaluationReceipt,
  validateHopePolishPreservationEvaluationReceiptSet,
} from "./polish-preservation.mjs";

export * from "./feature-selection.mjs";
export * from "./evidence.mjs";
export * from "./polish-preservation.mjs";
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
  }, dependencies);
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
    ?? validateHopeFeatureSelectionEvaluationReceipt)(
    input.value,
    dependencies,
  );
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
    ?? validateHopeFeatureSelectionEvaluationReceiptSet)(
    input.value,
    dependencies,
  );
}

export async function createHopePolishPreservationEvaluationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation model output",
    maximumBytes: hopePolishPreservationEvaluationLimits.outputBytes,
  });
  return await (dependencies.createReceipt
    ?? createHopePolishPreservationEvaluationReceipt)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopePolishPreservationEvaluationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation evaluation receipt",
    maximumBytes: hopePolishPreservationEvaluationLimits.receiptBytes,
  });
  return await (dependencies.validateReceipt
    ?? validateHopePolishPreservationEvaluationReceipt)(
    input.value,
    dependencies,
  );
}

export async function validateHopePolishPreservationEvaluationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation evaluation receipt set",
    maximumBytes: hopePolishPreservationEvaluationLimits.receiptSetBytes,
  });
  return await (dependencies.validateReceiptSet
    ?? validateHopePolishPreservationEvaluationReceiptSet)(
    input.value,
    dependencies,
  );
}

export async function createHopeWriteExampleEvaluationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return await (dependencies.createReceipt
    ?? createHopeWriteExampleEvaluationReceipt)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopeWriteExampleEvaluationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation receipt",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptBytes,
  });
  return await (dependencies.validateReceipt
    ?? validateHopeWriteExampleEvaluationReceipt)(
    input.value,
    dependencies,
  );
}

export async function validateHopeWriteExampleEvaluationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation receipt set",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptSetBytes,
  });
  return await (dependencies.validateReceiptSet
    ?? validateHopeWriteExampleEvaluationReceiptSet)(
    input.value,
    dependencies,
  );
}

export async function createHopeWriteProductionVerificationReceiptFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return await (dependencies.createReceipt
    ?? createHopeWriteProductionVerificationReceipt)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopeWriteProductionVerificationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification receipt",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptBytes,
  });
  return await (dependencies.validateReceipt
    ?? validateHopeWriteProductionVerificationReceipt)(
    input.value,
    dependencies,
  );
}

export async function validateHopeWriteProductionVerificationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification receipt set",
    maximumBytes: hopeWriteExampleEvaluationLimits.receiptSetBytes,
  });
  return await (dependencies.validateReceiptSet
    ?? validateHopeWriteProductionVerificationReceiptSet)(
    input.value,
    dependencies,
  );
}
