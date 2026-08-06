import assert from "node:assert/strict";
import test from "node:test";

import { parseDiffArguments } from "../features/diff/cli.mjs";
import { parseModelEvaluationArguments } from "../features/model-evaluation/cli.mjs";
import { parsePolishArguments } from "../features/polish/cli.mjs";
import {
  POLISH_RECEIPT_VERSION,
  POLISH_RECORD_VERSION,
} from "../features/polish/constants.mjs";
import { parseSweepArguments } from "../features/sweep/cli.mjs";
import {
  SWEEP_APPROVAL_RECEIPT_VERSION,
  SWEEP_APPROVAL_RECORD_VERSION,
} from "../features/sweep/constants.mjs";
import { parseToxicReviewArguments } from "../features/toxic-review/cli.mjs";

test("deprecated receipt commands route to current record commands", () => {
  assert.equal(
    parsePolishArguments(["receipt", "--input", "run.json"]).command,
    "record",
  );
  assert.equal(
    parseSweepArguments(["approval-receipt", "--input", "approval.json"])
      .command,
    "approval-record",
  );
  assert.equal(
    parseDiffArguments([
      "invocation-evaluation-receipt",
      "--case", "basic",
      "--variant", "full",
      "--run", "1",
      "--input", "output.json",
      "--host", "host",
      "--model", "model",
      "--effort", "high",
      "--invocation", "invocation-1",
    ]).command,
    "invocation-evaluation-record",
  );
  assert.equal(
    parseModelEvaluationArguments([
      "feature-selection-receipt",
      "--case", "basic",
      "--variant", "full",
      "--run", "1",
      "--input", "output.json",
      "--host", "host",
      "--model", "model",
      "--effort", "high",
      "--invocation", "invocation-1",
    ]).command,
    "feature-selection-record",
  );
  assert.equal(
    parseToxicReviewArguments([
      "evaluation-receipt",
      "--case", "basic",
      "--variant", "full",
      "--run", "1",
      "--input", "review.json",
      "--model", "model",
      "--effort", "high",
      "--invocation", "invocation-1",
    ]).command,
    "evaluation-record",
  );
});

test("deprecated version constants remain aliases", () => {
  assert.equal(POLISH_RECEIPT_VERSION, POLISH_RECORD_VERSION);
  assert.equal(
    SWEEP_APPROVAL_RECEIPT_VERSION,
    SWEEP_APPROVAL_RECORD_VERSION,
  );
});

test("deprecated receipt entry points remain available", async () => {
  const modules = {
    "../features/diff/index.mjs": [
      "createDiffInvocationEvaluationReceiptFromFile",
      "createDiffInvocationExampleRemovalReceiptFromFile",
      "createDiffInvocationProductionVerificationReceiptFromFile",
    ],
    "../features/diff/invocation-evaluation.mjs": [
      "createDiffInvocationEvaluationReceipt",
      "validateDiffInvocationEvaluationReceipt",
      "validateDiffInvocationEvaluationReceiptSet",
    ],
    "../features/model-evaluation/index.mjs": [
      "createHopeFeatureSelectionEvaluationReceiptFromFile",
      "createHopePolishPreservationEvaluationReceiptFromFile",
      "createHopeWriteExampleEvaluationReceiptFromFile",
      "createHopeWriteProductionVerificationReceiptFromFile",
    ],
    "../features/polish/index.mjs": ["createPolishReceiptFile"],
    "../features/polish/validate.mjs": [
      "createPolishReceipt",
      "polishReceiptDigest",
      "validatePolishReceipt",
    ],
    "../features/sweep/index.mjs": [
      "createSweepApprovalReceiptFile",
      "createSweepModelEvaluationReceiptFile",
    ],
    "../features/sweep/validate.mjs": [
      "createSweepApprovalReceipt",
      "sweepApprovalReceiptDigest",
      "validateSweepApprovalReceipt",
    ],
    "../features/toxic-review/index.mjs": [
      "createCausalCompletenessEvaluationReceiptTemplateFromFile",
      "validateCausalCompletenessEvaluationReceiptFile",
    ],
  };
  for (const [specifier, names] of Object.entries(modules)) {
    const exports = await import(specifier);
    for (const name of names) {
      assert.equal(typeof exports[name], "function", `${specifier} exports ${name}`);
    }
  }
});
