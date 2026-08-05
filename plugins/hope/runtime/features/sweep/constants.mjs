// Generated from features/sweep/constants.mjs. Do not edit.
export const SWEEP_CONTRACT_VERSION = 3;
export const SWEEP_PLAN_VERSION = 1;
export const SWEEP_COMPLETION_VERSION = 1;
export const SWEEP_APPROVAL_RECEIPT_VERSION = 1;
export const SWEEP_SESSION_RESULT_VERSION = 1;
export const SWEEP_INVENTORY_VERSION = 1;
export const SWEEP_BATCH_REPORT_VERSION = 1;
export const SWEEP_BATCH_MERGE_VERSION = 1;
export const SWEEP_BATCH_CAPABILITY_VERSION = 1;
export const SWEEP_FULL_CODEBASE_SCOPE = "entire-codebase";
export const SWEEP_COVERAGE_MODE = "full-codebase";

export const SWEEP_LIMITS = Object.freeze({
  candidates: 32,
  categories: 7,
  checks: 21,
  changes: 96,
  coverageBatches: 256,
  batchReports: 256,
  batchAttempts: 1024,
  batchRelationships: 4096,
  batchObservations: 1024,
  batchReportBytes: 512 * 1024,
  batchMergeBytes: 4 * 1024 * 1024,
  evidenceChecks: 5,
  groupItems: 256,
  inputBytes: 2 * 1024 * 1024,
  inventoryBytes: 4 * 1024 * 1024,
  proseBytes: 512 * 1024,
  sessionInputBytes: 8 * 1024 * 1024,
  sessionProseBytes: 2 * 1024 * 1024,
  sources: 4096,
  stringCharacters: 16 * 1024,
  verifications: 64,
});

export const SWEEP_RISKS = Object.freeze(["low", "medium", "high"]);

function maintenanceCheck({
  categoryId,
  evidenceChecks,
  id,
  label,
  requiredPassed = evidenceChecks,
}) {
  return Object.freeze({
    categoryId,
    evidenceChecks: Object.freeze(evidenceChecks),
    id,
    label,
    requiredPassed: Object.freeze(requiredPassed),
  });
}

export const SWEEP_CHECK_CATALOG = Object.freeze([
  maintenanceCheck({
    id: "broken-references",
    categoryId: "integrity",
    label: "Broken references",
    evidenceChecks: [
      "references",
      "path-resolution",
      "entrypoints",
      "configuration",
      "tests",
    ],
    requiredPassed: [
      "references",
      "path-resolution",
      "entrypoints",
      "configuration",
    ],
  }),
  maintenanceCheck({
    id: "configuration-drift",
    categoryId: "integrity",
    label: "Configuration drift",
    evidenceChecks: [
      "declared-config",
      "runtime-use",
      "schemas",
      "generation",
      "tests",
    ],
    requiredPassed: [
      "declared-config",
      "runtime-use",
      "schemas",
      "generation",
    ],
  }),
  maintenanceCheck({
    id: "generated-drift",
    categoryId: "integrity",
    label: "Generated-source drift",
    evidenceChecks: [
      "generation-source",
      "generated-output",
      "reproduction",
      "ownership",
      "tests",
    ],
    requiredPassed: [
      "generation-source",
      "generated-output",
      "reproduction",
      "ownership",
    ],
  }),
  maintenanceCheck({
    id: "dead-code",
    categoryId: "unused-stale",
    label: "Dead code and unused content",
    evidenceChecks: [
      "references",
      "exports-entrypoints",
      "configuration-generation",
      "external-contracts",
      "tests-docs",
    ],
    requiredPassed: [
      "references",
      "exports-entrypoints",
      "configuration-generation",
    ],
  }),
  maintenanceCheck({
    id: "stale-content",
    categoryId: "unused-stale",
    label: "Stale codebase content",
    evidenceChecks: [
      "current-use",
      "ownership",
      "history",
      "external-contracts",
      "tests-docs",
    ],
    requiredPassed: ["current-use", "ownership", "history"],
  }),
  maintenanceCheck({
    id: "repeated-abstraction",
    categoryId: "abstraction-structure",
    label: "Repeated abstraction",
    evidenceChecks: [
      "structural-similarity",
      "semantic-equivalence",
      "variation",
      "ownership",
      "tests",
    ],
    requiredPassed: [
      "structural-similarity",
      "semantic-equivalence",
      "variation",
      "ownership",
    ],
  }),
  maintenanceCheck({
    id: "missing-abstraction",
    categoryId: "abstraction-structure",
    label: "Missing abstraction",
    evidenceChecks: [
      "repetition",
      "change-coupling",
      "stable-boundary",
      "ownership",
      "tests",
    ],
    requiredPassed: [
      "repetition",
      "change-coupling",
      "stable-boundary",
      "ownership",
    ],
  }),
  maintenanceCheck({
    id: "premature-abstraction",
    categoryId: "abstraction-structure",
    label: "Premature abstraction",
    evidenceChecks: [
      "call-sites",
      "variation",
      "indirection-cost",
      "public-contracts",
      "tests",
    ],
    requiredPassed: [
      "call-sites",
      "variation",
      "indirection-cost",
      "public-contracts",
    ],
  }),
  maintenanceCheck({
    id: "test-gap",
    categoryId: "tests-docs",
    label: "Test gap or drift",
    evidenceChecks: [
      "behavior-source",
      "existing-tests",
      "failure-paths",
      "public-contracts",
      "verification",
    ],
    requiredPassed: [
      "behavior-source",
      "existing-tests",
      "failure-paths",
      "public-contracts",
    ],
  }),
  maintenanceCheck({
    id: "documentation-drift",
    categoryId: "tests-docs",
    label: "Documentation drift",
    evidenceChecks: [
      "implementation-source",
      "public-contracts",
      "examples-links",
      "generation",
      "verification",
    ],
    requiredPassed: [
      "implementation-source",
      "public-contracts",
      "examples-links",
      "generation",
    ],
  }),
  maintenanceCheck({
    id: "dependency-risk",
    categoryId: "dependencies-security-license-compatibility",
    label: "Dependency lifecycle risk",
    evidenceChecks: [
      "manifest-lockfile",
      "runtime-use",
      "upstream-support",
      "compatibility",
      "tests",
    ],
    requiredPassed: [
      "manifest-lockfile",
      "runtime-use",
      "upstream-support",
      "compatibility",
    ],
  }),
  maintenanceCheck({
    id: "security-risk",
    categoryId: "dependencies-security-license-compatibility",
    label: "Security exposure",
    evidenceChecks: [
      "advisories",
      "reachability",
      "exposure",
      "mitigation",
      "tests",
    ],
    requiredPassed: ["advisories", "reachability", "exposure", "mitigation"],
  }),
  maintenanceCheck({
    id: "license-risk",
    categoryId: "dependencies-security-license-compatibility",
    label: "License conflict",
    evidenceChecks: [
      "declared-licenses",
      "transitive-licenses",
      "distribution",
      "policy",
      "compatibility",
    ],
  }),
  maintenanceCheck({
    id: "compatibility-risk",
    categoryId: "dependencies-security-license-compatibility",
    label: "Support and compatibility drift",
    evidenceChecks: [
      "support-policy",
      "runtime-matrix",
      "dependency-constraints",
      "ci-coverage",
      "release-contract",
    ],
  }),
  maintenanceCheck({
    id: "performance-waste",
    categoryId: "performance-package-ci",
    label: "Measured performance waste",
    evidenceChecks: [
      "measurement",
      "hot-path",
      "workload",
      "tradeoffs",
      "regression-check",
    ],
  }),
  maintenanceCheck({
    id: "package-waste",
    categoryId: "performance-package-ci",
    label: "Package waste",
    evidenceChecks: [
      "package-contents",
      "consumer-contract",
      "build-output",
      "size-measurement",
      "tests",
    ],
  }),
  maintenanceCheck({
    id: "ci-waste",
    categoryId: "performance-package-ci",
    label: "Build and CI waste",
    evidenceChecks: [
      "workflow-graph",
      "cache-inputs",
      "duplicate-work",
      "failure-signal",
      "timing",
    ],
  }),
  maintenanceCheck({
    id: "architecture-drift",
    categoryId: "architecture-support-release-recovery",
    label: "Architecture drift",
    evidenceChecks: [
      "documented-boundary",
      "dependency-direction",
      "entrypoints",
      "ownership",
      "tests",
    ],
  }),
  maintenanceCheck({
    id: "support-gap",
    categoryId: "architecture-support-release-recovery",
    label: "Support-policy gap",
    evidenceChecks: [
      "declared-policy",
      "runtime-config",
      "ci-matrix",
      "dependency-support",
      "documentation",
    ],
  }),
  maintenanceCheck({
    id: "release-gap",
    categoryId: "architecture-support-release-recovery",
    label: "Release-readiness gap",
    evidenceChecks: [
      "versioning",
      "package-contents",
      "generated-consistency",
      "release-checks",
      "rollback",
    ],
  }),
  maintenanceCheck({
    id: "recovery-gap",
    categoryId: "architecture-support-release-recovery",
    label: "Recovery-readiness gap",
    evidenceChecks: [
      "failure-modes",
      "state-ownership",
      "backup-restore",
      "rollback",
      "recovery-test",
    ],
  }),
]);

export function sweepChecksForCategory(categoryId) {
  return SWEEP_CHECK_CATALOG.filter((check) => check.categoryId === categoryId);
}

export const SWEEP_CATEGORY_CATALOG = Object.freeze([
  Object.freeze({
    id: "integrity",
    label: "Integrity",
    support: "supported",
    checks: Object.freeze([
      "broken-references",
      "configuration-drift",
      "generated-drift",
    ]),
  }),
  Object.freeze({
    checks: Object.freeze(["dead-code", "stale-content"]),
    id: "unused-stale",
    label: "Unused and stale work",
    support: "supported",
  }),
  Object.freeze({
    id: "abstraction-structure",
    label: "Abstraction and structure",
    support: "supported",
    checks: Object.freeze([
      "repeated-abstraction",
      "missing-abstraction",
      "premature-abstraction",
    ]),
  }),
  Object.freeze({
    id: "tests-docs",
    label: "Tests and documentation",
    support: "supported",
    checks: Object.freeze(["test-gap", "documentation-drift"]),
  }),
  Object.freeze({
    id: "dependencies-security-license-compatibility",
    label: "Dependencies, security, licenses, and compatibility",
    support: "supported",
    checks: Object.freeze([
      "dependency-risk",
      "security-risk",
      "license-risk",
      "compatibility-risk",
    ]),
  }),
  Object.freeze({
    id: "performance-package-ci",
    label: "Performance, packaging, and CI",
    support: "supported",
    checks: Object.freeze([
      "performance-waste",
      "package-waste",
      "ci-waste",
    ]),
  }),
  Object.freeze({
    id: "architecture-support-release-recovery",
    label: "Architecture, support, release, and recovery",
    support: "supported",
    checks: Object.freeze([
      "architecture-drift",
      "support-gap",
      "release-gap",
      "recovery-gap",
    ]),
  }),
]);

export const SWEEP_CATEGORY_SUPPORT = Object.freeze([
  "supported",
  "unsupported",
]);

export const SWEEP_INSPECTION_STATES = Object.freeze([
  "checked",
  "partial",
  "not-checked",
  "failed",
]);

export const SWEEP_PLAN_STATES = Object.freeze([
  "awaiting-approval",
  "complete-with-findings",
  "complete-no-change",
  "blocked",
]);

export const SWEEP_CANDIDATE_DISPOSITIONS = Object.freeze([
  "polish",
  "report-only",
  "handoff",
]);

export const SWEEP_BEHAVIOR_IMPACTS = Object.freeze([
  "preserving",
  "changing",
  "uncertain",
]);

export const SWEEP_EVIDENCE_STATUSES = Object.freeze([
  "passed",
  "not-applicable",
  "inconclusive",
  "not-run",
]);

export const SWEEP_APPROVAL_STATUSES = Object.freeze([
  "approved",
  "rejected",
]);

export const SWEEP_COMPLETION_STATUSES = Object.freeze([
  "applied",
  "no-change",
  "stale",
  "rejected",
  "failed",
  "inconclusive",
  "handed-off",
]);

export const SWEEP_SESSION_STATES = Object.freeze([
  "complete",
  "incomplete",
  "cancelled",
]);

export const SWEEP_CANDIDATE_RESULT_STATUSES = Object.freeze([
  ...SWEEP_COMPLETION_STATUSES,
  "reported",
  "pending",
]);

export const SWEEP_VERIFICATION_STATUSES = Object.freeze([
  "passed",
  "failed",
  "inconclusive",
  "not-run",
]);
