export const CONTRACT_VERSION = 1;
export const ANALYSIS_VERSION = 3;
export const RENDERER_VERSION = 19;
export const RUN_VERSION = 7;
export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_WINDOW_VERSION = 2;
export const MICROWORLD_SKELETON_VERSION = 6;

export const LIMITS = Object.freeze({
  analysisProseBytes: 48 * 1024,
  authoredEvidenceLines: 96,
  artifactBytes: 6 * 1024 * 1024,
  changedFiles: 500,
  changedLines: 20_000,
  checkpointBytes: 32 * 1024,
  checkpointEvidence: 8,
  checkpointEvidenceReferences: 32,
  checkpointEvidenceExcerptBytes: 8 * 1024,
  checkpointEvidenceLines: 24,
  checkpointEvidenceTotalBytes: 96 * 1024,
  checkpointEvidenceTotalLines: 1_200,
  checkpointObservations: 8,
  checkpointTextBytes: 4 * 1024,
  checkpointTextTotalBytes: 96 * 1024,
  checkpointTotalObservations: 256,
  checkpointTotalRequests: 12,
  checkpointWindowBytes: 128 * 1024,
  checkpointWindowPages: 4,
  commits: 250,
  contextBodyTotalBytes: 256 * 1024,
  contextFiles: 12,
  contextLineJsonBytes: 8 * 1024,
  contextPathJsonBytes: 4 * 1024,
  evidenceBytes: 96 * 1024,
  evidenceLines: 24,
  evidenceReferences: 192,
  evidenceTotalLines: 1_200,
  codeEvidenceLines: 600,
  inspectionPageBytes: 16 * 1024,
  inspectionTotalBytes: 1024 * 1024,
  inspectionWindowBytes: 32 * 1024,
  ledgerBytes: 1024 * 1024,
  ledgerPageBytes: 24 * 1024,
  ledgerStateBytes: 64 * 1024,
  manifestBytes: 128 * 1024,
  modelBytes: 128 * 1024,
  modelString: 32 * 1024,
  pullRequestBodyBytes: 32 * 1024,
  reviewTitleCharacters: 80,
  reviewItems: 80,
  safeBodyBytes: 256 * 1024,
  safeBodyTotalBytes: 768 * 1024,
  snapshotBytes: 8 * 1024 * 1024,
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
