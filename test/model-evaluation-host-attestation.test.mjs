import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { parseDiffArguments } from "../features/diff/cli.mjs";
import {
  parseDiffArguments as parseGeneratedDiffArguments,
} from "../plugins/hope/runtime/features/diff/cli.mjs";
import {
  createHopeModelEvaluationProvenance,
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  validateHopeModelEvaluationRecordSetProvenance,
} from "../features/model-evaluation/evidence.mjs";
import {
  createHopeEd25519HostAttestationAdapter,
  createHopeModelEvaluationHostVerificationDependencies,
  HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV,
  hopeModelEvaluationAttestationSigningPayload,
  hopeModelEvaluationLedgerSigningPayload,
  loadHopeModelEvaluationHostAttestationAdapter,
  prepareHopeModelEvaluationEvidenceCommand,
  validateHopeModelEvaluationHostAttestationAdapter,
} from "../features/model-evaluation/host-attestation.mjs";
import {
  main as runModelEvaluationCommand,
  parseModelEvaluationArguments,
} from "../features/model-evaluation/cli.mjs";
import {
  main as runGeneratedModelEvaluationCommand,
} from "../plugins/hope/runtime/features/model-evaluation/cli.mjs";
import { main as runHarness } from "../harness/hope.mjs";

const issuer = "trusted-test-runner";
const campaignId = "campaign-2026-08-07";
const issuedAt = "2026-08-07T00:00:00.000Z";
const issuedAtRange = Object.freeze({
  notAfter: "2026-08-07T23:59:59.999Z",
  notBefore: issuedAt,
});

function statement(eventId) {
  return Object.freeze({
    configuration: Object.freeze({
      effort: "high",
      host: "test-host",
      model: "test-model",
    }),
    evaluation: Object.freeze({
      feature: "test-feature",
      version: 1,
    }),
    invocation: Object.freeze({ id: eventId }),
    specification: Object.freeze({ caseId: eventId, run: 1 }),
  });
}

function signedProof(payload, privateKey) {
  return `ed25519:${signPayload(null, payload, privateKey).toString("base64url")}`;
}

function signedAttestation(value, privateKey, overrides = {}) {
  const unsigned = {
    campaignId,
    eventId: value.invocation.id,
    issuedAt,
    issuer,
    statementDigest: digestHopeModelEvaluationEvidence(value),
    version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
    ...overrides,
  };
  return Object.freeze({
    ...unsigned,
    proof: signedProof(
      hopeModelEvaluationAttestationSigningPayload(unsigned),
      privateKey,
    ),
  });
}

function manifestFor(attestations) {
  return Object.freeze({
    campaignId,
    events: Object.freeze(attestations.map((attestation) => Object.freeze({
      eventId: attestation.eventId,
      issuedAt: attestation.issuedAt,
      issuer: attestation.issuer,
      runKey: attestation.eventId,
      statementDigest: attestation.statementDigest,
    }))),
    feature: "test-feature",
    issuer,
    plannedRunKeys: Object.freeze(attestations.map(({ eventId }) => eventId)),
    version: 1,
  });
}

function adapterFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const statements = [statement("event-1"), statement("event-2")];
  const attestations = statements.map((value) => (
    signedAttestation(value, privateKey)
  ));
  const manifest = manifestFor(attestations);
  const unsignedLedger = {
    campaignId,
    issuedAtRange,
    issuer,
    manifestDigest: digestHopeModelEvaluationEvidence(manifest),
    version: 1,
  };
  const completeAttemptLedger = Object.freeze({
    ...unsignedLedger,
    proof: signedProof(
      hopeModelEvaluationLedgerSigningPayload(unsignedLedger),
      privateKey,
    ),
  });
  const adapter = createHopeEd25519HostAttestationAdapter({
    completeAttemptLedger,
    issuer,
    publicKey,
  });
  return {
    adapter,
    attestations,
    completeAttemptLedger,
    manifest,
    privateKey,
    publicKey,
    statements,
  };
}

test("the Ed25519 adapter verifies attempts and one exact complete ledger", () => {
  const fixture = adapterFixture();
  const dependencies = createHopeModelEvaluationHostVerificationDependencies(
    fixture.adapter,
  );
  const records = fixture.statements.map((value, index) => ({
    provenance: createHopeModelEvaluationProvenance({
      attestation: fixture.attestations[index],
      statement: value,
    }, dependencies),
    specification: value.specification,
  }));

  const provenance = validateHopeModelEvaluationRecordSetProvenance(records, {
    feature: "test-feature",
    plannedRunKeys: ["event-1", "event-2"],
    runKey: ({ caseId }) => caseId,
    version: 1,
  }, dependencies);

  assert.equal(provenance.kind, "host-attested");
  assert.equal(
    provenance.manifestDigest,
    fixture.completeAttemptLedger.manifestDigest,
  );
});

test("the Ed25519 adapter accepts only public trust-root material", () => {
  const fixture = adapterFixture();
  for (const privateKey of [
    fixture.privateKey,
    fixture.privateKey.export({ format: "pem", type: "pkcs8" }),
  ]) {
    assert.throws(
      () => createHopeEd25519HostAttestationAdapter({
        completeAttemptLedger: fixture.completeAttemptLedger,
        issuer,
        publicKey: privateKey,
      }),
      /publicKey must contain only public key material/u,
    );
  }
});

test("the Ed25519 adapter enforces its signed issuance window", () => {
  const fixture = adapterFixture();
  const boundStatement = {
    ...fixture.statements[0],
    statementDigest: fixture.attestations[0].statementDigest,
  };
  const beforeWindow = signedAttestation(
    fixture.statements[0],
    fixture.privateKey,
    { issuedAt: "2026-08-06T23:59:59.999Z" },
  );
  const afterWindow = signedAttestation(
    fixture.statements[0],
    fixture.privateKey,
    { issuedAt: "2026-08-08T00:00:00.000Z" },
  );

  assert.equal(
    fixture.adapter.verifyAttestation(fixture.attestations[0], boundStatement),
    true,
  );
  assert.equal(
    fixture.adapter.verifyAttestation(fixture.attestations[0], boundStatement),
    true,
  );
  assert.equal(
    fixture.adapter.verifyAttestation(beforeWindow, boundStatement),
    false,
  );
  assert.equal(
    fixture.adapter.verifyAttestation(afterWindow, boundStatement),
    false,
  );

  assert.throws(
    () => createHopeEd25519HostAttestationAdapter({
      completeAttemptLedger: {
        ...fixture.completeAttemptLedger,
        issuedAtRange: {
          notAfter: issuedAtRange.notBefore,
          notBefore: issuedAtRange.notAfter,
        },
      },
      issuer,
      publicKey: fixture.publicKey,
    }),
    /notBefore must not be after notAfter/u,
  );
});

test("the adapter rejects forged, replayed, and incomplete evidence", () => {
  const fixture = adapterFixture();
  const [valid] = fixture.attestations;
  const forged = { ...valid, proof: `ed25519:${Buffer.alloc(64).toString("base64url")}` };
  const replayedAsAnotherEvent = { ...valid, eventId: "event-2" };
  const replayedManifest = {
    ...fixture.manifest,
    events: [fixture.manifest.events[0], fixture.manifest.events[0]],
  };
  const incompleteManifest = {
    ...fixture.manifest,
    events: fixture.manifest.events.slice(0, 1),
  };

  assert.equal(fixture.adapter.verifyAttestation(valid), false);
  assert.equal(fixture.adapter.verifyAttestation(valid, {
    ...fixture.statements[1],
    statementDigest: valid.statementDigest,
  }), false);
  assert.equal(fixture.adapter.verifyAttestation(forged), false);
  assert.equal(fixture.adapter.verifyAttestation(replayedAsAnotherEvent), false);
  assert.equal(
    fixture.adapter.verifyAttestation({ ...valid, issuedAt: "2026-08-08T00:00:00.000Z" }),
    false,
  );
  assert.equal(fixture.adapter.verifyCompleteAttemptLedger(replayedManifest), false);
  assert.equal(fixture.adapter.verifyCompleteAttemptLedger(incompleteManifest), false);

  const replayedLedger = {
    campaignId,
    issuedAtRange,
    issuer,
    manifestDigest: digestHopeModelEvaluationEvidence(replayedManifest),
    version: 1,
  };
  const adapterWithSignedReplay = createHopeEd25519HostAttestationAdapter({
    completeAttemptLedger: {
      ...replayedLedger,
      proof: signedProof(
        hopeModelEvaluationLedgerSigningPayload(replayedLedger),
        fixture.privateKey,
      ),
    },
    issuer,
    publicKey: fixture.publicKey,
  });
  assert.equal(
    adapterWithSignedReplay.verifyCompleteAttemptLedger(replayedManifest),
    false,
  );

  const otherKeys = generateKeyPairSync("ed25519");
  const wrongTrustRoot = createHopeEd25519HostAttestationAdapter({
    completeAttemptLedger: fixture.completeAttemptLedger,
    issuer,
    publicKey: otherKeys.publicKey,
  });
  assert.equal(wrongTrustRoot.verifyAttestation(valid), false);
  assert.equal(
    wrongTrustRoot.verifyCompleteAttemptLedger(fixture.manifest),
    false,
  );
});

test("adapter loading is explicit and validates required capabilities", async () => {
  const { adapter } = adapterFixture();
  await assert.rejects(
    () => loadHopeModelEvaluationHostAttestationAdapter({ environment: {} }),
    /needs a trusted local adapter/u,
  );
  let loadedSpecifier;
  const loaded = await loadHopeModelEvaluationHostAttestationAdapter({
    cwd: "/trusted/config",
    environment: {
      [HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV]: "runner-adapter.mjs",
    },
    async importModule(specifier) {
      loadedSpecifier = specifier;
      return { default: adapter };
    },
  });
  assert.equal(loaded.issuer, issuer);
  assert.equal(
    loadedSpecifier,
    pathToFileURL(resolve(
      "/trusted/config",
      "runner-adapter.mjs",
    )).href,
  );
  assert.throws(
    () => validateHopeModelEvaluationHostAttestationAdapter({
      ...adapter,
      capabilities: { completeAttemptLedger: true },
    }),
    /capabilities.hostInvocationIdentity must be true/u,
  );
});

test("the command boundary reads attestations separately and fails closed", async () => {
  const fixture = adapterFixture();
  const inputOptions = Object.freeze({
    attestationPath: "/private/runner-attestation.json",
    command: "test-record",
  });
  await assert.rejects(
    () => prepareHopeModelEvaluationEvidenceCommand(inputOptions, {
      environment: {},
      readInput: async () => ({ value: fixture.attestations[0] }),
    }),
    /needs a trusted local adapter/u,
  );
  const prepared = await prepareHopeModelEvaluationEvidenceCommand(
    inputOptions,
    {
      environment: {
        [HOPE_MODEL_EVALUATION_HOST_ADAPTER_ENV]: "/trusted/adapter.mjs",
      },
      loadHostAttestationAdapter: async () => fixture.adapter,
      readInput: async (path, limits) => {
        assert.equal(path, inputOptions.attestationPath);
        assert.equal(limits.maximumBytes, 32 * 1024);
        return { value: fixture.attestations[0] };
      },
    },
  );
  assert.equal(prepared.options.attestationPath, undefined);
  assert.deepEqual(prepared.options.attestation, fixture.attestations[0]);
  assert.equal(
    prepared.dependencies.verifyModelEvaluationAttestation(
      fixture.attestations[0],
      {
        ...fixture.statements[0],
        statementDigest: fixture.attestations[0].statementDigest,
      },
    ),
    true,
  );
});

test("the harness, feature, and generated plugin share the adapter boundary", async () => {
  const { adapter } = adapterFixture();
  assert.deepEqual(
    parseModelEvaluationArguments(["host-attestation-status"]),
    { command: "host-attestation-status" },
  );
  const genericRecord = parseModelEvaluationArguments([
    "feature-selection-record",
    "--case", "answer-vs-execute",
    "--variant", "full",
    "--run", "1",
    "--input", "/private/output.json",
    "--host", "codex",
    "--model", "test-model",
    "--effort", "high",
    "--invocation", "event-1",
    "--attestation", "/private/attestation.json",
  ]);
  assert.equal(genericRecord.attestationPath, "/private/attestation.json");

  const teachingRecord = parseDiffArguments([
    "teaching-evaluation-record",
    "--case", "teaching-ko-data-flow-value",
    "--run", "1",
    "--attempt", "1",
    "--input", "/private/output.json",
    "--host", "codex",
    "--model", "test-model",
    "--effort", "high",
    "--invocation", "event-1",
    "--attestation", "/private/attestation.json",
  ]);
  assert.equal(teachingRecord.attestationPath, "/private/attestation.json");
  assert.deepEqual(
    parseGeneratedDiffArguments([
      "teaching-evaluation-record",
      "--case", "teaching-ko-data-flow-value",
      "--run", "1",
      "--attempt", "1",
      "--input", "/private/output.json",
      "--host", "codex",
      "--model", "test-model",
      "--effort", "high",
      "--invocation", "event-1",
      "--attestation", "/private/attestation.json",
    ]),
    teachingRecord,
  );

  for (const run of [
    runModelEvaluationCommand,
    runGeneratedModelEvaluationCommand,
    runHarness,
  ]) {
    let output = "";
    const prefix = run === runHarness ? ["model-evaluation"] : [];
    const result = await run(
      [...prefix, "host-attestation-status"],
      {
        loadHostAttestationAdapter: async () => adapter,
        stdout: { write(value) { output += value; } },
      },
    );
    assert.equal(result.configured, true);
    assert.equal(result.issuer, issuer);
    assert.deepEqual(JSON.parse(output), result);
  }
});
