import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyRecordTerms } from "../features/record-compat/index.mjs";

test("legacy record compatibility normalizes structural names only", () => {
  const normalized = normalizeLegacyRecordTerms({
    feature: "polish-receipt",
    polishReceipt: {
      receiptDigest: "sha256:legacy",
      summary: "Keep the word receipt in authored prose.",
    },
    receiptVersion: 1,
  });
  assert.deepEqual(normalized, {
    feature: "polish-record",
    polishRecord: {
      recordDigest: "sha256:legacy",
      summary: "Keep the word receipt in authored prose.",
    },
    recordVersion: 1,
  });
});

test("legacy record compatibility rejects ambiguous old and new fields", () => {
  assert.throws(
    () => normalizeLegacyRecordTerms({
      receiptDigest: "sha256:old",
      recordDigest: "sha256:new",
    }),
    /both receiptDigest and recordDigest/u,
  );
});
