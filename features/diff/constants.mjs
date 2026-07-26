export const CONTRACT_VERSION = 1;
export const RENDERER_VERSION = 2;
export const LEGACY_RUN_VERSION = 1;
export const RUN_VERSION = 2;

export const LIMITS = Object.freeze({
  analysisProseBytes: 48 * 1024,
  artifactBytes: 6 * 1024 * 1024,
  changedFiles: 200,
  changedLines: 20_000,
  commits: 250,
  evidenceBytes: 96 * 1024,
  evidenceLines: 24,
  evidenceReferences: 192,
  evidenceTotalLines: 1_200,
  highlightedLines: 600,
  inspectionPageBytes: 16 * 1024,
  inspectionTotalBytes: 1024 * 1024,
  legacyModelBytes: 512 * 1024,
  modelBytes: 128 * 1024,
  modelString: 32 * 1024,
  pullRequestBodyBytes: 32 * 1024,
  reviewItems: 80,
  safeBodyBytes: 256 * 1024,
  safeBodyTotalBytes: 768 * 1024,
  uniqueEvidenceRanges: 96,
});

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
