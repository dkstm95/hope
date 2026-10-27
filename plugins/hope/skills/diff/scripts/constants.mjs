export const CONTRACT_VERSION = 2;
export const ANALYSIS_VERSION = 6;
export const RENDERER_VERSION = 25;
export const RUN_VERSION = 9;

export const LIMITS = Object.freeze({
  analysisProseBytes: 48 * 1024,
  authoredEvidenceLines: 96,
  bundleBytes: 192 * 1024,
  artifactBytes: 24 * 1024 * 1024,
  changedFiles: 500,
  changedLines: 20_000,
  commits: 250,
  contextBodyTotalBytes: 256 * 1024,
  contextFiles: 12,
  contextPathJsonBytes: 4 * 1024,
  evidenceBytes: 96 * 1024,
  evidenceLines: 24,
  evidenceReferences: 192,
  evidenceTotalLines: 1_200,
  codeEvidenceLines: 600,
  modelBytes: 128 * 1024,
  modelString: 32 * 1024,
  pullRequestBodyBytes: 32 * 1024,
  reviewTitleCharacters: 80,
  reviewItems: 80,
  safePatchBytes: 512 * 1024,
  safeBodyBytes: 256 * 1024,
  safeBodyTotalBytes: 768 * 1024,
  snapshotBytes: 8 * 1024 * 1024,
  uniqueEvidenceRanges: 96,
});

// Every capture starts with these two limits; file and context limits follow.
export const BASE_LIMITS = Object.freeze([
  Object.freeze({
    id: "limit-1",
    kind: "unchanged-context",
    reason: "Hope collects only exact-revision context files explicitly requested during the review; other unchanged code remains unchecked",
    subject: "Other unchanged code outside collected context",
  }),
  Object.freeze({
    id: "limit-2",
    kind: "verification",
    reason: "Hope Diff does not collect or execute CI, tests, builds, or lint",
    subject: "Execution and CI results",
  }),
]);

export const FILE_DISPOSITIONS = Object.freeze([
  "explained",
  "supporting",
  "mechanical",
  "metadata-only",
  "redacted",
]);

export const REVIEW_KINDS = Object.freeze(["resolve", "decide", "verify"]);
export const IMPORTANCE = Object.freeze(["high", "medium", "low"]);
export const BASIS = Object.freeze(["stated", "code", "inferred", "unknown"]);
