// Generated from features/model-evaluation/index.mjs. Do not edit.
import { readBoundedJson } from "../work-snapshot/index.mjs";

import {
  createHopeFeatureSelectionEvaluationRecord,
  hopeFeatureSelectionEvaluationLimits,
  validateHopeFeatureSelectionEvaluationRecord,
  validateHopeFeatureSelectionEvaluationRecordSet,
} from "./feature-selection.mjs";
import {
  createHopeWriteExampleEvaluationRecord,
  createHopeWriteProductionVerificationRecord,
  hopeWriteExampleEvaluationLimits,
  validateHopeWriteExampleEvaluationRecord,
  validateHopeWriteExampleEvaluationRecordSet,
  validateHopeWriteProductionVerificationRecord,
  validateHopeWriteProductionVerificationRecordSet,
} from "./write-examples.mjs";
import {
  createHopePolishPreservationEvaluationRecord,
  hopePolishPreservationEvaluationLimits,
  validateHopePolishPreservationEvaluationRecord,
  validateHopePolishPreservationEvaluationRecordSet,
} from "./polish-preservation.mjs";

export * from "./feature-selection.mjs";
export * from "./evidence.mjs";
export * from "./polish-preservation.mjs";
export * from "./write-examples.mjs";

export async function createHopeFeatureSelectionEvaluationRecordFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection model output",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.outputBytes,
  });
  return (dependencies.createRecord
    ?? createHopeFeatureSelectionEvaluationRecord)({
    ...options,
    output: input.value,
  }, dependencies);
}

// Deprecated version 1 compatibility aliases.
export {
  createHopeFeatureSelectionEvaluationRecordFromFile as createHopeFeatureSelectionEvaluationReceiptFromFile,
  validateHopeFeatureSelectionEvaluationRecordFile as validateHopeFeatureSelectionEvaluationReceiptFile,
  validateHopeFeatureSelectionEvaluationRecordSetFile as validateHopeFeatureSelectionEvaluationReceiptSetFile,
  createHopePolishPreservationEvaluationRecordFromFile as createHopePolishPreservationEvaluationReceiptFromFile,
  validateHopePolishPreservationEvaluationRecordFile as validateHopePolishPreservationEvaluationReceiptFile,
  validateHopePolishPreservationEvaluationRecordSetFile as validateHopePolishPreservationEvaluationReceiptSetFile,
  createHopeWriteExampleEvaluationRecordFromFile as createHopeWriteExampleEvaluationReceiptFromFile,
  validateHopeWriteExampleEvaluationRecordFile as validateHopeWriteExampleEvaluationReceiptFile,
  validateHopeWriteExampleEvaluationRecordSetFile as validateHopeWriteExampleEvaluationReceiptSetFile,
  createHopeWriteProductionVerificationRecordFromFile as createHopeWriteProductionVerificationReceiptFromFile,
  validateHopeWriteProductionVerificationRecordFile as validateHopeWriteProductionVerificationReceiptFile,
  validateHopeWriteProductionVerificationRecordSetFile as validateHopeWriteProductionVerificationReceiptSetFile,
};

export async function validateHopeFeatureSelectionEvaluationRecordFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection evaluation record",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.recordBytes,
  });
  return (dependencies.validateRecord
    ?? validateHopeFeatureSelectionEvaluationRecord)(
    input.value,
    dependencies,
  );
}

export async function validateHopeFeatureSelectionEvaluationRecordSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope feature-selection evaluation record set",
    maximumBytes: hopeFeatureSelectionEvaluationLimits.recordSetBytes,
  });
  return (dependencies.validateRecordSet
    ?? validateHopeFeatureSelectionEvaluationRecordSet)(
    input.value,
    dependencies,
  );
}

export async function createHopePolishPreservationEvaluationRecordFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation model output",
    maximumBytes: hopePolishPreservationEvaluationLimits.outputBytes,
  });
  return await (dependencies.createRecord
    ?? createHopePolishPreservationEvaluationRecord)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopePolishPreservationEvaluationRecordFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation evaluation record",
    maximumBytes: hopePolishPreservationEvaluationLimits.recordBytes,
  });
  return await (dependencies.validateRecord
    ?? validateHopePolishPreservationEvaluationRecord)(
    input.value,
    dependencies,
  );
}

export async function validateHopePolishPreservationEvaluationRecordSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Polish preservation evaluation record set",
    maximumBytes: hopePolishPreservationEvaluationLimits.recordSetBytes,
  });
  return await (dependencies.validateRecordSet
    ?? validateHopePolishPreservationEvaluationRecordSet)(
    input.value,
    dependencies,
  );
}

export async function createHopeWriteExampleEvaluationRecordFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return await (dependencies.createRecord
    ?? createHopeWriteExampleEvaluationRecord)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopeWriteExampleEvaluationRecordFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation record",
    maximumBytes: hopeWriteExampleEvaluationLimits.recordBytes,
  });
  return await (dependencies.validateRecord
    ?? validateHopeWriteExampleEvaluationRecord)(
    input.value,
    dependencies,
  );
}

export async function validateHopeWriteExampleEvaluationRecordSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write example evaluation record set",
    maximumBytes: hopeWriteExampleEvaluationLimits.recordSetBytes,
  });
  return await (dependencies.validateRecordSet
    ?? validateHopeWriteExampleEvaluationRecordSet)(
    input.value,
    dependencies,
  );
}

export async function createHopeWriteProductionVerificationRecordFromFile({
  inputPath,
  ...options
}, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification output",
    maximumBytes: hopeWriteExampleEvaluationLimits.outputBytes,
  });
  return await (dependencies.createRecord
    ?? createHopeWriteProductionVerificationRecord)({
    ...options,
    output: input.value,
  }, dependencies);
}

export async function validateHopeWriteProductionVerificationRecordFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification record",
    maximumBytes: hopeWriteExampleEvaluationLimits.recordBytes,
  });
  return await (dependencies.validateRecord
    ?? validateHopeWriteProductionVerificationRecord)(
    input.value,
    dependencies,
  );
}

export async function validateHopeWriteProductionVerificationRecordSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope Write production verification record set",
    maximumBytes: hopeWriteExampleEvaluationLimits.recordSetBytes,
  });
  return await (dependencies.validateRecordSet
    ?? validateHopeWriteProductionVerificationRecordSet)(
    input.value,
    dependencies,
  );
}
