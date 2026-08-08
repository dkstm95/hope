import {
  createPrivateKey,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readBoundedJson } from "../work-snapshot/index.mjs";
import { digestHopeModelEvaluationEvidence } from "./evidence.mjs";

export const HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION = 1;
export const HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV =
  "HOPE_MODEL_EVALUATION_ATTESTATION_ADAPTER_MODULE";
export const HOPE_MODEL_EVALUATION_HOST_ADAPTER_CODE =
  "HOPE_MODEL_EVALUATION_HOST_ADAPTER_REQUIRED";
export const HOPE_MODEL_EVALUATION_HOST_ADAPTER_MESSAGE =
  `Host-attested model-evaluation evidence needs a trusted local adapter. Set ${HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV} to its module path.`;

export const hopeModelEvaluationHostAttestationLimits = Object.freeze({
  attestationBytes: 32 * 1024,
  issuerCharacters: 512,
  proofCharacters: 16 * 1024,
});

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const proofPattern = /^ed25519:([A-Za-z0-9_-]+)$/u;

function missingAdapter() {
  const error = new Error(HOPE_MODEL_EVALUATION_HOST_ADAPTER_MESSAGE);
  error.code = HOPE_MODEL_EVALUATION_HOST_ADAPTER_CODE;
  return error;
}

function invalidAdapter(message) {
  const error = new TypeError(
    `Hope model-evaluation host attestation adapter is invalid: ${message}`,
  );
  error.code = "HOPE_MODEL_EVALUATION_HOST_ADAPTER_INVALID";
  return error;
}

function boundedText(value, label, maximum = 4096) {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || [...value].length > maximum
  ) {
    throw invalidAdapter(`${label} must be text between 1 and ${maximum} characters`);
  }
  return value;
}

function exactObject(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidAdapter(`${label} must be an object`);
  }
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    throw invalidAdapter(`${label} must contain exactly ${keys.join(", ")}`);
  }
  return value;
}

function publicEd25519Key(value) {
  if (value?.type === "private") {
    throw invalidAdapter("publicKey must contain only public key material");
  }
  let privateKey;
  try {
    privateKey = createPrivateKey(value);
  } catch {
    // A public key cannot be loaded as a private key.
  }
  if (privateKey?.type === "private") {
    throw invalidAdapter("publicKey must contain only public key material");
  }
  let key;
  try {
    key = value?.type === "public" ? value : createPublicKey(value);
  } catch (error) {
    throw invalidAdapter(`publicKey could not be loaded: ${error.message}`);
  }
  if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") {
    throw invalidAdapter("publicKey must be an Ed25519 public key");
  }
  return key;
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  try {
    if (new Date(milliseconds).toISOString() !== value) return null;
  } catch {
    return null;
  }
  return Object.freeze({ milliseconds, value });
}

function requiredTimestamp(value, label) {
  const normalized = canonicalTimestamp(value);
  if (!normalized) {
    throw invalidAdapter(`${label} must be a canonical ISO 8601 timestamp`);
  }
  return normalized;
}

function hasUniqueEventIdentities(manifest) {
  if (!Array.isArray(manifest?.events)) return false;
  const eventIds = manifest.events.map((event) => event?.eventId);
  return eventIds.every((eventId) => (
    typeof eventId === "string" && eventId.trim().length > 0
  )) && new Set(eventIds).size === eventIds.length;
}

function signatureFromProof(value) {
  const match = typeof value === "string" ? value.match(proofPattern) : null;
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64url");
  } catch {
    return null;
  }
}

function signingPayload(domain, value) {
  return Buffer.from(
    `${domain}\n${digestHopeModelEvaluationEvidence(value)}\n`,
    "utf8",
  );
}

export function hopeModelEvaluationAttestationSigningPayload(value) {
  return signingPayload(
    "hope:model-evaluation:attempt:v1",
    {
      campaignId: value.campaignId,
      eventId: value.eventId,
      issuedAt: value.issuedAt,
      issuer: value.issuer,
      statementDigest: value.statementDigest,
      version: value.version,
    },
  );
}

export function hopeModelEvaluationLedgerSigningPayload(value) {
  return signingPayload(
    "hope:model-evaluation:complete-ledger:v1",
    {
      campaignId: value.campaignId,
      issuedAtRange: value.issuedAtRange,
      issuer: value.issuer,
      manifestDigest: value.manifestDigest,
      version: value.version,
    },
  );
}

function normalizeCompleteAttemptLedger(value, issuer) {
  exactObject(value, [
    "campaignId",
    "issuedAtRange",
    "issuer",
    "manifestDigest",
    "proof",
    "version",
  ], "completeAttemptLedger");
  exactObject(
    value.issuedAtRange,
    ["notAfter", "notBefore"],
    "completeAttemptLedger.issuedAtRange",
  );
  const notBefore = requiredTimestamp(
    value.issuedAtRange.notBefore,
    "completeAttemptLedger.issuedAtRange.notBefore",
  );
  const notAfter = requiredTimestamp(
    value.issuedAtRange.notAfter,
    "completeAttemptLedger.issuedAtRange.notAfter",
  );
  if (notBefore.milliseconds > notAfter.milliseconds) {
    throw invalidAdapter(
      "completeAttemptLedger.issuedAtRange.notBefore must not be after notAfter",
    );
  }
  const normalized = Object.freeze({
    campaignId: boundedText(value.campaignId, "completeAttemptLedger.campaignId"),
    issuedAtRange: Object.freeze({
      notAfter: notAfter.value,
      notBefore: notBefore.value,
    }),
    issuer: boundedText(
      value.issuer,
      "completeAttemptLedger.issuer",
      hopeModelEvaluationHostAttestationLimits.issuerCharacters,
    ),
    manifestDigest: value.manifestDigest,
    proof: boundedText(
      value.proof,
      "completeAttemptLedger.proof",
      hopeModelEvaluationHostAttestationLimits.proofCharacters,
    ),
    version: value.version,
  });
  if (normalized.version !== HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION) {
    throw invalidAdapter(
      `completeAttemptLedger.version must be ${HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION}`,
    );
  }
  if (normalized.issuer !== issuer) {
    throw invalidAdapter("completeAttemptLedger.issuer must match issuer");
  }
  if (!digestPattern.test(normalized.manifestDigest)) {
    throw invalidAdapter("completeAttemptLedger.manifestDigest is invalid");
  }
  if (!signatureFromProof(normalized.proof)) {
    throw invalidAdapter("completeAttemptLedger.proof must be an Ed25519 proof");
  }
  return normalized;
}

export function createHopeEd25519HostAttestationAdapter({
  completeAttemptLedger,
  issuer,
  publicKey,
}) {
  const normalizedIssuer = boundedText(
    issuer,
    "issuer",
    hopeModelEvaluationHostAttestationLimits.issuerCharacters,
  );
  const key = publicEd25519Key(publicKey);
  const ledger = normalizeCompleteAttemptLedger(
    completeAttemptLedger,
    normalizedIssuer,
  );
  const issuedAtNotBefore = canonicalTimestamp(
    ledger.issuedAtRange.notBefore,
  ).milliseconds;
  const issuedAtNotAfter = canonicalTimestamp(
    ledger.issuedAtRange.notAfter,
  ).milliseconds;
  return validateHopeModelEvaluationHostAttestationAdapter({
    capabilities: {
      completeAttemptLedger: true,
      hostInvocationIdentity: true,
    },
    issuer: normalizedIssuer,
    verifyAttestation(attestation, boundStatement) {
      if (attestation.issuer !== normalizedIssuer) return false;
      if (attestation.campaignId !== ledger.campaignId) return false;
      const attestationIssuedAt = canonicalTimestamp(attestation.issuedAt);
      if (
        !attestationIssuedAt
        || attestationIssuedAt.milliseconds < issuedAtNotBefore
        || attestationIssuedAt.milliseconds > issuedAtNotAfter
      ) {
        return false;
      }
      if (
        boundStatement?.statementDigest !== attestation.statementDigest
        || boundStatement?.invocation?.id !== attestation.eventId
      ) {
        return false;
      }
      const signature = signatureFromProof(attestation.proof);
      return signature !== null && verifySignature(
        null,
        hopeModelEvaluationAttestationSigningPayload(attestation),
        key,
        signature,
      );
    },
    verifyCompleteAttemptLedger(manifest) {
      if (manifest.issuer !== normalizedIssuer) return false;
      if (manifest.campaignId !== ledger.campaignId) return false;
      if (!hasUniqueEventIdentities(manifest)) return false;
      if (
        digestHopeModelEvaluationEvidence(manifest)
        !== ledger.manifestDigest
      ) {
        return false;
      }
      const signature = signatureFromProof(ledger.proof);
      return signature !== null && verifySignature(
        null,
        hopeModelEvaluationLedgerSigningPayload(ledger),
        key,
        signature,
      );
    },
    version: HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION,
  });
}

export function validateHopeModelEvaluationHostAttestationAdapter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidAdapter("the module must export an object");
  }
  if (value.version !== HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION) {
    throw invalidAdapter(
      `version must be ${HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION}`,
    );
  }
  const issuer = boundedText(
    value.issuer,
    "issuer",
    hopeModelEvaluationHostAttestationLimits.issuerCharacters,
  );
  const capabilities = value.capabilities;
  if (!capabilities || typeof capabilities !== "object") {
    throw invalidAdapter("capabilities are required");
  }
  for (const field of ["hostInvocationIdentity", "completeAttemptLedger"]) {
    if (capabilities[field] !== true) {
      throw invalidAdapter(`capabilities.${field} must be true`);
    }
  }
  for (const method of ["verifyAttestation", "verifyCompleteAttemptLedger"]) {
    if (typeof value[method] !== "function") {
      throw invalidAdapter(`the ${method} method is required`);
    }
  }
  return Object.freeze({
    capabilities: Object.freeze({
      completeAttemptLedger: true,
      hostInvocationIdentity: true,
    }),
    issuer,
    verifyAttestation: value.verifyAttestation.bind(value),
    verifyCompleteAttemptLedger:
      value.verifyCompleteAttemptLedger.bind(value),
    version: HOPE_MODEL_EVALUATION_HOST_ADAPTER_VERSION,
  });
}

export async function loadHopeModelEvaluationHostAttestationAdapter({
  cwd = process.cwd(),
  environment = process.env,
  importModule = (specifier) => import(specifier),
} = {}) {
  const configured = environment[HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV];
  if (!configured) throw missingAdapter();
  const path = isAbsolute(configured) ? configured : resolve(cwd, configured);
  let loaded;
  try {
    loaded = await importModule(pathToFileURL(path).href);
  } catch (error) {
    throw invalidAdapter(`could not load ${path}: ${error.message}`);
  }
  return validateHopeModelEvaluationHostAttestationAdapter(
    loaded.default ?? loaded.adapter,
  );
}

export function createHopeModelEvaluationHostVerificationDependencies(adapter) {
  const validated = validateHopeModelEvaluationHostAttestationAdapter(adapter);
  return Object.freeze({
    verifyModelEvaluationAttestation(attestation, bound) {
      if (attestation.issuer !== validated.issuer) return false;
      return validated.verifyAttestation(attestation, bound) === true;
    },
    verifyModelEvaluationSet(manifest) {
      if (manifest.issuer !== validated.issuer) return false;
      return validated.verifyCompleteAttemptLedger(manifest) === true;
    },
  });
}

export function hopeModelEvaluationHostAttestationStatus(adapter) {
  const validated = validateHopeModelEvaluationHostAttestationAdapter(adapter);
  return Object.freeze({
    capabilities: validated.capabilities,
    configured: true,
    issuer: validated.issuer,
    version: validated.version,
  });
}

export async function prepareHopeModelEvaluationEvidenceCommand(
  options,
  dependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  const configured = Boolean(
    environment[HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV],
  );
  const needsAttestation = Boolean(options.attestationPath);
  const hasVerifiers =
    typeof dependencies.verifyModelEvaluationAttestation === "function"
    && typeof dependencies.verifyModelEvaluationSet === "function";
  let resolvedDependencies = dependencies;
  if (!hasVerifiers && (configured || needsAttestation)) {
    const adapter = await (
      dependencies.loadHostAttestationAdapter
        ?? loadHopeModelEvaluationHostAttestationAdapter
    )({
      cwd: dependencies.cwd ?? process.cwd(),
      environment,
      importModule: dependencies.importModule,
    });
    resolvedDependencies = {
      ...dependencies,
      ...createHopeModelEvaluationHostVerificationDependencies(adapter),
    };
  }
  if (!needsAttestation) {
    return Object.freeze({
      dependencies: resolvedDependencies,
      options,
    });
  }
  if (
    typeof resolvedDependencies.verifyModelEvaluationAttestation !== "function"
  ) {
    throw missingAdapter();
  }
  const input = await (resolvedDependencies.readInput ?? readBoundedJson)(
    options.attestationPath,
    {
      label: "Hope model-evaluation host attestation",
      maximumBytes:
        hopeModelEvaluationHostAttestationLimits.attestationBytes,
    },
  );
  const { attestationPath, ...rest } = options;
  return Object.freeze({
    dependencies: resolvedDependencies,
    options: Object.freeze({ ...rest, attestation: input.value }),
  });
}
