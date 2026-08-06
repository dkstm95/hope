// Generated from features/model-evaluation/evidence.mjs. Do not edit.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const digestPattern = /^sha256:[a-f0-9]{64}$/u;

export const HOPE_MODEL_EVALUATION_EVIDENCE_VERSION = 1;

function fail(message) {
  throw new TypeError(`Invalid Hope model evaluation evidence: ${message}`);
}

function assertEvidence(condition, message) {
  if (!condition) fail(message);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    canonicalValue(value[key]),
  ]));
}

export function digestHopeModelEvaluationEvidence(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
}

function exactKeys(value, expected, label) {
  assertEvidence(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assertEvidence(
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort()),
    `${label} must contain exactly ${expected.join(", ")}`,
  );
}

function boundedText(value, label, maximum = 4096) {
  assertEvidence(
    typeof value === "string"
      && value.trim().length > 0
      && [...value].length <= maximum,
    `${label} must be text between 1 and ${maximum} characters`,
  );
  return value;
}

function normalizeStatement(value) {
  exactKeys(value, [
    "configuration",
    "evaluation",
    "invocation",
    "specification",
  ], "statement");
  assertEvidence(
    value.evaluation && typeof value.evaluation === "object",
    "statement.evaluation must be an object",
  );
  assertEvidence(
    value.configuration && typeof value.configuration === "object",
    "statement.configuration must be an object",
  );
  assertEvidence(
    value.invocation && typeof value.invocation === "object",
    "statement.invocation must be an object",
  );
  assertEvidence(
    value.specification && typeof value.specification === "object",
    "statement.specification must be an object",
  );
  return Object.freeze(structuredClone(value));
}

function normalizeAttestation(value, statement, {
  verifyModelEvaluationAttestation,
} = {}) {
  exactKeys(value, [
    "campaignId",
    "eventId",
    "issuedAt",
    "issuer",
    "proof",
    "statementDigest",
    "version",
  ], "attestation");
  const attestation = Object.freeze({
    campaignId: boundedText(value.campaignId, "attestation.campaignId"),
    eventId: boundedText(value.eventId, "attestation.eventId"),
    issuedAt: boundedText(value.issuedAt, "attestation.issuedAt"),
    issuer: boundedText(value.issuer, "attestation.issuer"),
    proof: boundedText(value.proof, "attestation.proof", 16 * 1024),
    statementDigest: value.statementDigest,
    version: value.version,
  });
  assertEvidence(
    attestation.version === HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
    `attestation.version must be ${HOPE_MODEL_EVALUATION_EVIDENCE_VERSION}`,
  );
  assertEvidence(
    !Number.isNaN(Date.parse(attestation.issuedAt)),
    "attestation.issuedAt must be an ISO date-time",
  );
  const statementDigest = digestHopeModelEvaluationEvidence(statement);
  assertEvidence(
    digestPattern.test(attestation.statementDigest)
      && attestation.statementDigest === statementDigest,
    "attestation.statementDigest must bind the exact evaluation statement",
  );
  assertEvidence(
    attestation.eventId === statement.invocation.id,
    "attestation.eventId must match the host invocation identity",
  );
  assertEvidence(
    typeof verifyModelEvaluationAttestation === "function",
    "host-attested evidence requires a trusted attestation verifier",
  );
  let verified = false;
  try {
    verified = verifyModelEvaluationAttestation(
      attestation,
      Object.freeze({ ...statement, statementDigest }),
    ) === true;
  } catch (error) {
    fail(`host attestation verification failed: ${error.message}`);
  }
  assertEvidence(verified, "host attestation was not verified");
  return attestation;
}

export function createHopeModelEvaluationProvenance({
  attestation,
  statement,
}, dependencies = {}) {
  if (attestation === undefined) {
    return Object.freeze({ kind: "synthetic" });
  }
  const normalizedStatement = normalizeStatement(statement);
  return Object.freeze({
    attestation: normalizeAttestation(
      attestation,
      normalizedStatement,
      dependencies,
    ),
    kind: "host-attested",
  });
}

export function validateHopeModelEvaluationProvenance(
  value,
  statement,
  dependencies = {},
) {
  if (value?.kind === "synthetic") {
    exactKeys(value, ["kind"], "provenance");
    return Object.freeze({ kind: "synthetic" });
  }
  exactKeys(value, ["attestation", "kind"], "provenance");
  assertEvidence(
    value.kind === "host-attested",
    "provenance.kind is not supported",
  );
  const normalizedStatement = normalizeStatement(statement);
  return Object.freeze({
    attestation: normalizeAttestation(
      value.attestation,
      normalizedStatement,
      dependencies,
    ),
    kind: "host-attested",
  });
}

export function validateHopeModelEvaluationRecordSetProvenance(
  records,
  {
    feature,
    plannedRunKeys,
    runKey,
    version,
  },
  {
    allowSynthetic = false,
    verifyModelEvaluationSet,
  } = {},
) {
  const provenances = new Set(records.map(
    (record) => record.provenance.kind,
  ));
  assertEvidence(
    provenances.size === 1,
    "record set must not mix synthetic and host-attested evidence",
  );
  if (provenances.has("synthetic")) {
    assertEvidence(
      allowSynthetic === true,
      "release record set requires host-attested evidence",
    );
    return Object.freeze({ kind: "synthetic" });
  }
  assertEvidence(
    typeof verifyModelEvaluationSet === "function",
    "release record set requires a trusted complete-attempt verifier",
  );
  const campaignIds = new Set(records.map(
    (record) => record.provenance.attestation.campaignId,
  ));
  assertEvidence(
    campaignIds.size === 1,
    "record set must use one trusted runner campaign",
  );
  const issuers = new Set(records.map(
    (record) => record.provenance.attestation.issuer,
  ));
  assertEvidence(
    issuers.size === 1,
    "record set must use one trusted attestation issuer",
  );
  const manifest = Object.freeze({
    campaignId: records[0].provenance.attestation.campaignId,
    events: Object.freeze(records.map((record) => Object.freeze({
      eventId: record.provenance.attestation.eventId,
      issuedAt: record.provenance.attestation.issuedAt,
      issuer: record.provenance.attestation.issuer,
      runKey: runKey(record.specification),
      statementDigest: record.provenance.attestation.statementDigest,
    }))),
    feature,
    issuer: records[0].provenance.attestation.issuer,
    plannedRunKeys: Object.freeze([...plannedRunKeys]),
    version,
  });
  let verified = false;
  try {
    verified = verifyModelEvaluationSet(manifest) === true;
  } catch (error) {
    fail(`complete-attempt verification failed: ${error.message}`);
  }
  assertEvidence(
    verified,
    "trusted runner did not verify the complete attempt history",
  );
  return Object.freeze({
    kind: "host-attested",
    manifestDigest: digestHopeModelEvaluationEvidence(manifest),
  });
}
