// Generated from features/toxic-review/constants.mjs. Do not edit.
export const TOXIC_REVIEW_CONTRACT_VERSION = 1;

export const TOXIC_REVIEW_LIMITS = Object.freeze({
  findings: 96,
  groupItems: 32,
  inputBytes: 128 * 1024,
  proseBytes: 64 * 1024,
  runStateBytes: 1024 * 1024,
  roles: 6,
  sources: 128,
  stringCharacters: 16 * 1024,
});

export const TOXIC_REVIEW_RISKS = Object.freeze(["low", "medium", "high"]);
export const TOXIC_REVIEW_TARGETS = Object.freeze([
  "idea",
  "requirements",
  "ui",
  "prototype",
  "plan",
  "implementation",
  "patch",
  "pull-request",
  "align",
  "diff",
  "incident",
  "recovery-plan",
  "document",
  "other",
]);
export const TOXIC_REVIEW_STAGES = Object.freeze([
  "idea",
  "design",
  "implementation",
  "completed",
  "operation",
]);
export const TOXIC_REVIEW_PRIORITIES = Object.freeze([
  "critical",
  "high",
  "medium",
  "low",
]);
export const TOXIC_REVIEW_CONFIDENCE = Object.freeze([
  "established",
  "supported",
  "uncertain",
]);
export const TOXIC_REVIEW_JUDGMENTS = Object.freeze([
  "accepted",
  "partially-accepted",
  "rejected",
  "deferred",
  "duplicate",
]);

export const TOXIC_REVIEW_ROLE_METHODS = Object.freeze([
  "causal-completeness",
]);

export const TOXIC_REVIEW_CAUSAL_CLAIM_ASSESSMENTS = Object.freeze([
  "supported",
  "unsupported",
  "honest-uncertainty",
]);

export const TOXIC_REVIEW_CAUSAL_LEVELS = Object.freeze([
  "structural",
  "local",
  "mixed",
  "inconclusive",
]);

export const TOXIC_REVIEW_CAUSAL_CANDIDATE_LEVELS = Object.freeze([
  "structural",
  "local",
  "mixed",
]);

export const TOXIC_REVIEW_CAUSAL_NEXT_CHECKS = Object.freeze([
  "form-candidate",
  "disconfirm",
  "discriminate",
  "no-safe-check",
]);
