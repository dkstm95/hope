import assert from "node:assert/strict";
import test from "node:test";

import {
  createHopeModelEvaluationProvenance,
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  validateHopeModelEvaluationProvenance,
  validateHopeModelEvaluationRecordSetProvenance,
} from "../features/model-evaluation/evidence.mjs";

function statement(eventId) {
  return Object.freeze({
    configuration: Object.freeze({ model: "test-model" }),
    evaluation: Object.freeze({ feature: "test-feature", version: 1 }),
    invocation: Object.freeze({ id: eventId }),
    specification: Object.freeze({ caseId: eventId }),
  });
}

function attestation(value) {
  return Object.freeze({
    campaignId: "campaign-1",
    eventId: value.invocation.id,
    issuedAt: "2026-08-04T00:00:00.000Z",
    issuer: "trusted-test-runner",
    proof: `proof-for-${value.invocation.id}`,
    statementDigest: digestHopeModelEvaluationEvidence(value),
    version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  });
}

test("model-evaluation evidence distinguishes synthetic and trusted runs", () => {
  const value = statement("event-1");
  assert.deepEqual(
    createHopeModelEvaluationProvenance({ statement: value }),
    { kind: "synthetic" },
  );
  assert.throws(
    () => createHopeModelEvaluationProvenance({
      attestation: attestation(value),
      statement: value,
    }),
    /requires a trusted attestation verifier/u,
  );
  const provenance = createHopeModelEvaluationProvenance({
    attestation: attestation(value),
    statement: value,
  }, {
      verifyModelEvaluationAttestation(received, bound) {
        return received.proof === "proof-for-event-1"
          && received.campaignId === "campaign-1"
        && bound.statementDigest === received.statementDigest;
    },
  });
  assert.equal(provenance.kind, "host-attested");
  assert.throws(
    () => validateHopeModelEvaluationProvenance(
      provenance,
      statement("event-2"),
      { verifyModelEvaluationAttestation: () => true },
    ),
    /statementDigest must bind/u,
  );
});

test("release evidence requires a trusted complete-attempt ledger", () => {
  const first = statement("event-1");
  const second = statement("event-2");
  const dependencies = { verifyModelEvaluationAttestation: () => true };
  const records = [first, second].map((value) => ({
    provenance: createHopeModelEvaluationProvenance({
      attestation: attestation(value),
      statement: value,
    }, dependencies),
    specification: value.specification,
  }));
  const metadata = {
    feature: "test-feature",
    plannedRunKeys: ["event-1", "event-2"],
    runKey: ({ caseId }) => caseId,
    version: 1,
  };
  assert.throws(
    () => validateHopeModelEvaluationRecordSetProvenance(
      records,
      metadata,
    ),
    /requires a trusted complete-attempt verifier/u,
  );
  let receivedManifest;
  const result = validateHopeModelEvaluationRecordSetProvenance(
    records,
    metadata,
    {
      verifyModelEvaluationSet(manifest) {
        receivedManifest = manifest;
        return manifest.events.length === 2
          && manifest.plannedRunKeys.length === 2;
      },
    },
  );
  assert.equal(result.kind, "host-attested");
  assert.match(result.manifestDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(receivedManifest.plannedRunKeys, ["event-1", "event-2"]);
  assert.equal(receivedManifest.campaignId, "campaign-1");
});

test("synthetic evidence is test-only unless the caller opts in", () => {
  const records = [{
    provenance: { kind: "synthetic" },
    specification: { caseId: "event-1" },
  }];
  const metadata = {
    feature: "test-feature",
    plannedRunKeys: ["event-1"],
    runKey: ({ caseId }) => caseId,
    version: 1,
  };
  assert.throws(
    () => validateHopeModelEvaluationRecordSetProvenance(records, metadata),
    /requires host-attested evidence/u,
  );
  assert.deepEqual(
    validateHopeModelEvaluationRecordSetProvenance(
      records,
      metadata,
      { allowSynthetic: true },
    ),
    { kind: "synthetic" },
  );
});
