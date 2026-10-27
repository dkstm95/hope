// One-way migration from a sealed Align HTML artifact (Hope 8 and earlier) to a
// repository JSON record. This is the only place the v1 and v2 content schemas
// and the embedded data format remain.
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import {
  assertAbsent,
  readBoundedFile,
  repositoryRoot,
  writeAtomic,
  writeRecordFiles,
} from "./artifact.mjs";
import { pngImage } from "./image.mjs";
import { validateAlignRecord } from "./validate.mjs";

const LEGACY_MAXIMUM_BYTES = 12 * 1024 * 1024;
const DIGEST_META = /(<meta name="hope-align-digest" content=")([a-f0-9]{64})(">)/u;
const ID_META = /<meta name="hope-align-id" content="([a-f0-9-]{36})">/u;
const DATA_SCRIPT = /<script id="hope-align-data" type="application\/json">([\s\S]*?)<\/script>/u;
const ALTERNATE_LINK = /<a class="locale-option" href="([^"]+)" hreflang="([^"]+)"/u;

// v1 success items and every legacy item other than a v2 check had no judgment
// method; v3 requires one, so migration names the gap instead of inventing a method.
const UNRECORDED_VERIFY = Object.freeze({
  "en-US": "No judgment method was recorded before migration; the person judges this item.",
  "ko-KR": "마이그레이션 전 기록에 판단 방법이 없어 사람이 이 항목을 판단한다.",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Return the embedded data of a legacy artifact whose seal still matches. */
export function readLegacyArtifact(source) {
  const digest = source.match(DIGEST_META);
  const alignId = source.match(ID_META)?.[1];
  const data = source.match(DATA_SCRIPT)?.[1];
  if (!digest || !alignId || data === undefined) {
    throw new Error("This file is not a sealed legacy Hope Align artifact");
  }
  const unsealed = source.replace(DIGEST_META, `$1${"0".repeat(64)}$3`);
  if (createHash("sha256").update(unsealed, "utf8").digest("hex") !== digest[2]) {
    throw new Error("Hope did not migrate this Align artifact because it was changed outside Hope");
  }
  let value;
  try {
    value = JSON.parse(data);
  } catch (error) {
    throw new Error("Legacy Align artifact data is not valid JSON", { cause: error });
  }
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || value.alignId !== alignId
    || !Array.isArray(value.revisions)
    || value.revisions.length === 0
    || !value.revisions.every((revision) => isRecord(revision) && isRecord(revision.content))
  ) {
    throw new Error("Legacy Align artifact data has an unsupported shape");
  }
  return value;
}

function legacySchema(content) {
  if (Array.isArray(content.intent)) return 3;
  return content.checks === undefined ? 1 : 2;
}

/**
 * Convert one legacy revision's content to the current shape. Fields without a
 * current home become intent items or exclusions; `moved` reports each one.
 */
export function convertLegacyContent(content, locale) {
  const schema = legacySchema(content);
  const moved = {};
  const note = (field, count, destination) => {
    if (count > 0) moved[field] = destination;
  };
  let converted;
  if (schema === 3) {
    converted = content;
  } else {
    const verify = UNRECORDED_VERIFY[locale];
    const unjudged = (statement, extra = {}) => ({ statement, verify, by: "human", ...extra });
    const checks = schema === 2
      ? (content.checks ?? []).map((check) => ({
        statement: check.condition,
        verify: check.verify,
        by: check.by,
      }))
      : (content.success ?? []).map((statement) => unjudged(statement));
    const boundary = content.boundary === undefined ? [] : [unjudged(content.boundary)];
    const included = (content.scope?.included ?? []).map((statement) => unjudged(statement));
    const decisions = (content.decisions ?? []).map(
      (decision) => unjudged(decision.decision, { reason: decision.reason }),
    );
    const excluded = content.scope?.excluded ?? [];
    const openChoices = content.openChoices ?? [];
    if (schema === 1) note("intent", 1, "goal");
    note(schema === 2 ? "checks" : "success", checks.length, schema === 2
      ? "intent"
      : "intent, judged by the person");
    note("boundary", boundary.length, "intent, judged by the person");
    note("scope.included", included.length, "intent, judged by the person");
    note("decisions", decisions.length, "intent with its reason, judged by the person");
    note("scope.excluded", excluded.length, "exclusions");
    note("openChoices", openChoices.length, "exclusions");
    note("behavior", content.behavior === undefined ? 0 : 1, "flow");
    converted = {
      title: content.title,
      goal: schema === 2 ? content.goal : content.intent,
      problem: content.problem,
      intent: [...checks, ...boundary, ...included, ...decisions],
      exclusions: [...excluded, ...openChoices],
      ...(content.designDirections === undefined ? {} : { designDirections: content.designDirections }),
      ...(content.behavior === undefined ? {} : { flow: content.behavior }),
      evidence: content.evidence ?? [],
    };
  }
  return { content: converted, moved, schema };
}

/** Move embedded design-direction images out to PNG bytes named beside the record. */
function extractImages(content, stem) {
  const directions = content.designDirections;
  if (directions === undefined) return { content, images: [] };
  const images = directions.options.map((option, index) => {
    if (!isRecord(option?.image) || typeof option.image.data !== "string") {
      throw new Error(`Legacy design direction ${index + 1} has no embedded image`);
    }
    const bytes = Buffer.from(option.image.data, "base64");
    pngImage(bytes, `Legacy design direction image ${index + 1}`);
    return { bytes, fileName: `${stem}.${option.id}.png` };
  });
  const options = directions.options.map(({ image: _image, ...option }, index) => ({
    ...option,
    imagePath: images[index].fileName,
  }));
  return { content: { ...content, designDirections: { ...directions, options } }, images };
}

export async function migrateAlignArtifact({ artifactPath }) {
  if (!artifactPath) throw new TypeError("artifactPath is required");
  const directory = await realpath(dirname(artifactPath));
  const legacyPath = join(directory, basename(artifactPath));
  if (extname(legacyPath).toLowerCase() !== ".html") {
    throw new Error("Legacy Align artifact path must use an .html extension");
  }
  const root = await repositoryRoot(directory);
  const source = (await readBoundedFile(legacyPath, LEGACY_MAXIMUM_BYTES, "Legacy Align artifact"))
    .toString("utf8");
  const legacy = readLegacyArtifact(source);
  const stem = basename(legacyPath, extname(legacyPath));
  const recordPath = join(directory, `${stem}.json`);
  await assertAbsent(recordPath);

  const latest = legacy.revisions.at(-1);
  const converted = convertLegacyContent(latest.content, legacy.locale);
  const { content, images } = extractImages(converted.content, stem);
  const alternate = source.match(ALTERNATE_LINK);
  const record = validateAlignRecord({
    schemaVersion: 1,
    alignId: legacy.alignId,
    repository: legacy.repository,
    locale: legacy.locale,
    theme: legacy.theme,
    ...(alternate ? { alternateLocale: { locale: alternate[2], href: alternate[1] } } : {}),
    createdAt: legacy.createdAt,
    updatedAt: latest.agreedAt,
    history: legacy.revisions.map((revision) => ({ at: revision.agreedAt, summary: revision.summary })),
    content,
  });

  const imagePaths = images.map((image) => join(directory, image.fileName));
  for (const path of imagePaths) await assertAbsent(path);
  for (const [index, image] of images.entries()) {
    await writeAtomic(imagePaths[index], image.bytes, { exclusive: true });
  }
  const result = await writeRecordFiles(root, recordPath, record);
  return Object.freeze({
    ...result,
    legacySchema: converted.schema,
    moved: Object.freeze(converted.moved),
    images: Object.freeze(imagePaths),
  });
}
