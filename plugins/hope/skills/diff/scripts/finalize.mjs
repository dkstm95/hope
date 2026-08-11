import {
  preflightArtifactOutput,
  publishArtifact,
} from "./artifact.mjs";
import { CONTRACT_VERSION } from "./constants.mjs";

export async function preflightReviewOutput(outputPath) {
  return await preflightArtifactOutput(outputPath, { noun: "output" });
}

export async function finalizeReview(bytes, {
  artifactDigest,
  linkFile,
  outputPath,
  revalidatedAt,
  runId,
  snapshotDigest,
  temporaryRoot,
} = {}) {
  const target = await publishArtifact(bytes, {
    directoryPrefix: "hope-review-",
    fileName: "hope-review.html",
    linkFile,
    noun: "output",
    outputPath,
    temporaryRoot,
  });
  return Object.freeze({
    artifactDigest,
    outputPath: target,
    publicationSchemaVersion: CONTRACT_VERSION,
    revalidatedAt,
    runId,
    snapshotDigest,
  });
}
