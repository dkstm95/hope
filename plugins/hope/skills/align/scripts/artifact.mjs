import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { embeddedImage, IMAGE_MAXIMUM_BYTES, rasterImage } from "./image.mjs";
import { renderAlignArtifact } from "./render.mjs";

const execFileAsync = promisify(execFile);
const INPUT_MAXIMUM_BYTES = 256 * 1024;
const ARTIFACT_MAXIMUM_BYTES = 12 * 1024 * 1024;
const IMAGE_TOTAL_MAXIMUM_BYTES = 1024 * 1024;
const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const DIGEST_PLACEHOLDER = "0".repeat(64);
const DIGEST_META_PATTERN = /(<meta name="hope-align-digest" content=")[a-f0-9]{64}(">)/u;
const ALIGN_ID_META_PATTERN = /<meta name="hope-align-id" content="([a-f0-9-]{36})">/u;
const DATA_PATTERN = /<script id="hope-align-data" type="application\/json">([\s\S]*?)<\/script>/u;

const contentKeysBySchema = Object.freeze({
  1: Object.freeze([
    "title", "intent", "problem", "success", "boundary", "scope",
    "designDirections", "behavior", "decisions", "openChoices", "evidence",
  ]),
  2: Object.freeze([
    "title", "goal", "problem", "checks", "boundary", "scope",
    "designDirections", "behavior", "decisions", "openChoices", "evidence",
  ]),
  3: Object.freeze([
    "title", "goal", "problem", "intent", "exclusions",
    "designDirections", "flow", "evidence",
  ]),
});
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(value, allowed, path) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new TypeError(`${path} contains unsupported field: ${extras[0]}`);
  }
}

function text(value, path, maximumLength = 4_000) {
  if (typeof value !== "string") throw new TypeError(`${path} must be text`);
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${path} must not be empty`);
  if ([...normalized].length > maximumLength) {
    throw new TypeError(`${path} exceeds ${maximumLength} characters`);
  }
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = normalized.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError(`${path} contains malformed Unicode`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(`${path} contains malformed Unicode`);
    }
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`${path} contains unsupported control characters`);
  }
  if (BIDI_CONTROLS.test(normalized)) {
    throw new TypeError(`${path} contains a bidirectional control character`);
  }
  return normalized;
}

function textList(value, path, maximumItems = 30) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length > maximumItems) {
    throw new TypeError(`${path} exceeds ${maximumItems} items`);
  }
  return value.map((item, index) => text(item, `${path}[${index}]`));
}

function evidenceId(value, path) {
  const id = text(value, path, 48);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(id)) {
    throw new TypeError(`${path} must use lowercase letters, numbers, and hyphens`);
  }
  return id;
}

function evidenceIdList(value, path) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) {
    throw new TypeError(`${path} must contain between 1 and 10 evidence ids`);
  }
  const ids = value.map((item, index) => evidenceId(item, `${path}[${index}]`));
  if (new Set(ids).size !== ids.length) {
    throw new TypeError(`${path} must not repeat an evidence id`);
  }
  return Object.freeze(ids);
}

function citedText(value, path, maximumLength = 4_000) {
  if (typeof value === "string") return text(value, path, maximumLength);
  if (!isRecord(value)) throw new TypeError(`${path} must be text or cited text`);
  assertKeys(value, ["text", "evidenceIds"], path);
  return Object.freeze({
    text: text(value.text, `${path}.text`, maximumLength),
    evidenceIds: evidenceIdList(value.evidenceIds, `${path}.evidenceIds`),
  });
}

function citedTextList(value, path, maximumItems = 30) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length > maximumItems) {
    throw new TypeError(`${path} exceeds ${maximumItems} items`);
  }
  return value.map((item, index) => citedText(item, `${path}[${index}]`));
}

function citedTextIdentity(value) {
  return JSON.stringify(typeof value === "string"
    ? [value]
    : [value.text, [...value.evidenceIds].sort()]);
}

function assertUniqueSiblings(values, path, identity) {
  const firstIndexByIdentity = new Map();
  for (const [index, value] of values.entries()) {
    const key = identity(value);
    const firstIndex = firstIndexByIdentity.get(key);
    if (firstIndex !== undefined) {
      throw new TypeError(`${path}[${index}] duplicates ${path}[${firstIndex}]`);
    }
    firstIndexByIdentity.set(key, index);
  }
}

function assertNoExactInputDuplicates(content) {
  assertUniqueSiblings(
    content.evidence,
    "$.evidence",
    (item) => JSON.stringify([item.label, item.location]),
  );
  if (content.schemaVersion === 3) {
    assertUniqueSiblings(
      content.intent,
      "$.intent",
      (item) => JSON.stringify([
        citedTextIdentity(item.statement),
        item.verify,
        item.by,
        item.reason === undefined ? null : citedTextIdentity(item.reason),
      ]),
    );
    assertUniqueSiblings(content.exclusions, "$.exclusions", citedTextIdentity);
    if (content.flow !== undefined) {
      assertUniqueSiblings(
        content.flow.steps,
        "$.flow.steps",
        (item) => JSON.stringify([
          citedTextIdentity(item.title),
          item.detail === undefined ? null : citedTextIdentity(item.detail),
        ]),
      );
      assertUniqueSiblings(
        content.flow.outcomes,
        "$.flow.outcomes",
        (item) => JSON.stringify([
          citedTextIdentity(item.title),
          item.detail === undefined ? null : citedTextIdentity(item.detail),
          item.kind ?? null,
        ]),
      );
    }
    return;
  }
  assertUniqueSiblings(
    content.checks,
    "$.checks",
    (item) => JSON.stringify([
      citedTextIdentity(item.condition),
      item.verify,
      item.by,
    ]),
  );
  for (const name of ["included", "excluded"]) {
    assertUniqueSiblings(
      content.scope[name],
      `$.scope.${name}`,
      citedTextIdentity,
    );
  }
  if (content.behavior !== undefined) {
    assertUniqueSiblings(
      content.behavior.steps,
      "$.behavior.steps",
      (item) => JSON.stringify([
        citedTextIdentity(item.title),
        item.detail === undefined ? null : citedTextIdentity(item.detail),
      ]),
    );
    assertUniqueSiblings(
      content.behavior.outcomes,
      "$.behavior.outcomes",
      (item) => JSON.stringify([
        citedTextIdentity(item.title),
        item.detail === undefined ? null : citedTextIdentity(item.detail),
        item.kind ?? null,
      ]),
    );
  }
  assertUniqueSiblings(
    content.decisions,
    "$.decisions",
    (item) => JSON.stringify([
      citedTextIdentity(item.decision),
      citedTextIdentity(item.reason),
    ]),
  );
  assertUniqueSiblings(content.openChoices, "$.openChoices", citedTextIdentity);
}

function intentItems(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length === 0) {
    throw new TypeError(`${path} must contain at least 1 item`);
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["statement", "verify", "by", "reason"], itemPath);
    if (!["agent", "human"].includes(item.by)) {
      throw new TypeError(`${itemPath}.by must be agent or human`);
    }
    return Object.freeze({
      statement: citedText(item.statement, `${itemPath}.statement`),
      verify: text(item.verify, `${itemPath}.verify`),
      by: item.by,
      ...(item.reason === undefined
        ? {}
        : { reason: citedText(item.reason, `${itemPath}.reason`) }),
    });
  });
}

function checkItems(value, path, maximumItems = 12) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length === 0 || value.length > maximumItems) {
    throw new TypeError(`${path} must contain between 1 and ${maximumItems} items`);
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["condition", "verify", "by"], itemPath);
    if (!["agent", "human"].includes(item.by)) {
      throw new TypeError(`${itemPath}.by must be agent or human`);
    }
    return Object.freeze({
      condition: citedText(item.condition, `${itemPath}.condition`),
      verify: text(item.verify, `${itemPath}.verify`),
      by: item.by,
    });
  });
}

function titledItems(value, path, {
  cited = false,
  maximumItems,
  minimumItems = 0,
} = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length < minimumItems || value.length > maximumItems) {
    throw new TypeError(
      `${path} must contain between ${minimumItems} and ${maximumItems} items`,
    );
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["title", "detail"], itemPath);
    return Object.freeze({
      title: cited
        ? citedText(item.title, `${itemPath}.title`, 160)
        : text(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : {
          detail: cited
            ? citedText(item.detail, `${itemPath}.detail`)
            : text(item.detail, `${itemPath}.detail`),
        }),
    });
  });
}

function outcomeItems(value, path, { cited = false, maximumItems } = {}) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new TypeError(`${path} must be an array with at most ${maximumItems} items`);
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["title", "detail", "kind"], itemPath);
    if (item.kind !== undefined && !["complete", "cancel"].includes(item.kind)) {
      throw new TypeError(`${itemPath}.kind must be complete or cancel`);
    }
    return Object.freeze({
      title: cited
        ? citedText(item.title, `${itemPath}.title`, 160)
        : text(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : {
          detail: cited
            ? citedText(item.detail, `${itemPath}.detail`)
            : text(item.detail, `${itemPath}.detail`),
        }),
      ...(item.kind === undefined ? {} : { kind: item.kind }),
    });
  });
}

function scopeValue(value, path, { cited = false } = {}) {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, ["included", "excluded"], path);
  const validateList = cited ? citedTextList : textList;
  return Object.freeze({
    included: Object.freeze(validateList(value.included, `${path}.included`)),
    excluded: Object.freeze(validateList(value.excluded, `${path}.excluded`)),
  });
}

function behaviorValue(value, path, { cited = false } = {}) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, ["steps", "outcomes"], path);
  return Object.freeze({
    steps: titledItems(value.steps, `${path}.steps`, {
      cited,
      maximumItems: 8,
      minimumItems: 2,
    }),
    outcomes: outcomeItems(value.outcomes, `${path}.outcomes`, {
      cited,
      maximumItems: 6,
    }),
  });
}

function decisionItems(value, path, { cited = false } = {}) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new TypeError(`${path} must be an array with at most 20 items`);
  }
  return Object.freeze(value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["decision", "reason"], itemPath);
    return Object.freeze({
      decision: cited
        ? citedText(item.decision, `${itemPath}.decision`, 160)
        : text(item.decision, `${itemPath}.decision`, 160),
      reason: cited
        ? citedText(item.reason, `${itemPath}.reason`)
        : text(item.reason, `${itemPath}.reason`),
    });
  }));
}

function evidenceItems(value, path) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 30) {
    throw new TypeError(`${path} must be an array with at most 30 items`);
  }
  const items = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["id", "label", "location"], itemPath);
    return Object.freeze({
      ...(item.id === undefined ? {} : { id: evidenceId(item.id, `${itemPath}.id`) }),
      label: text(item.label, `${itemPath}.label`, 160),
      location: text(item.location, `${itemPath}.location`),
    });
  });
  for (const [index, item] of items.entries()) {
    if (item.id !== undefined && items.findIndex((candidate) => candidate.id === item.id) !== index) {
      throw new TypeError(`${path} must use unique evidence ids`);
    }
  }
  return Object.freeze(items);
}

function assertCitations(value, evidence, path) {
  const ids = new Set(evidence.flatMap((item) => item.id === undefined ? [] : [item.id]));
  const visit = (item, itemPath) => {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${itemPath}[${index}]`));
      return;
    }
    if (!isRecord(item)) return;
    if (typeof item.text === "string" && Array.isArray(item.evidenceIds)) {
      for (const id of item.evidenceIds) {
        if (!ids.has(id)) {
          throw new TypeError(`${itemPath}.evidenceIds refers to unknown evidence id: ${id}`);
        }
      }
      return;
    }
    for (const [key, entry] of Object.entries(item)) visit(entry, `${itemPath}.${key}`);
  };
  visit(value, path);
}

function optionId(value, path) {
  const id = text(value, path, 48);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(id)) {
    throw new TypeError(`${path} must use lowercase letters, numbers, and hyphens`);
  }
  return id;
}

function httpUrl(value, path) {
  const source = text(value, path);
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new TypeError(`${path} must be an http or https URL`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`${path} must be an http or https URL without credentials`);
  }
  return source;
}

function directionDecision(value, path, { selection = false } = {}) {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, selection ? ["optionId", "reason", "decidedBy"] : ["optionId", "reason"], path);
  if (selection && !["user", "delegated"].includes(value.decidedBy)) {
    throw new TypeError(`${path}.decidedBy must be user or delegated`);
  }
  return Object.freeze({
    optionId: optionId(value.optionId, `${path}.optionId`),
    reason: text(value.reason, `${path}.reason`),
    ...(selection ? { decidedBy: value.decidedBy } : {}),
  });
}

function designDirections(value, path, { imageField, validateImage }) {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, ["options", "recommendation", "selection"], path);
  if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 3) {
    throw new TypeError(`${path}.options must contain between 2 and 3 items`);
  }
  const options = value.options.map((item, index) => {
    const itemPath = `${path}.options[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, [
      "id",
      "title",
      imageField,
      "alt",
      "summary",
      "strengths",
      "tradeoffs",
      "references",
    ], itemPath);
    if (!Array.isArray(item.references) || item.references.length > 5) {
      throw new TypeError(`${itemPath}.references must contain at most 5 items`);
    }
    const strengths = textList(item.strengths, `${itemPath}.strengths`, 4);
    const tradeoffs = textList(item.tradeoffs, `${itemPath}.tradeoffs`, 4);
    if (strengths.length === 0 || tradeoffs.length === 0) {
      throw new TypeError(`${itemPath} must include at least one strength and trade-off`);
    }
    return Object.freeze({
      id: optionId(item.id, `${itemPath}.id`),
      title: text(item.title, `${itemPath}.title`, 160),
      [imageField]: validateImage(item[imageField], `${itemPath}.${imageField}`),
      alt: text(item.alt, `${itemPath}.alt`),
      summary: text(item.summary, `${itemPath}.summary`),
      strengths: Object.freeze(strengths),
      tradeoffs: Object.freeze(tradeoffs),
      references: Object.freeze(item.references.map((reference, referenceIndex) => {
        const referencePath = `${itemPath}.references[${referenceIndex}]`;
        if (!isRecord(reference)) throw new TypeError(`${referencePath} must be an object`);
        const influence = text(reference.influence, `${referencePath}.influence`);
        if (reference.evidenceId !== undefined) {
          assertKeys(reference, ["evidenceId", "influence"], referencePath);
          return Object.freeze({
            evidenceId: evidenceId(reference.evidenceId, `${referencePath}.evidenceId`),
            influence,
          });
        }
        assertKeys(reference, ["label", "url", "influence"], referencePath);
        return Object.freeze({
          label: text(reference.label, `${referencePath}.label`, 160),
          url: httpUrl(reference.url, `${referencePath}.url`),
          influence,
        });
      })),
    });
  });
  if (options.some((option, index) => options.findIndex((item) => item.id === option.id) !== index)) {
    throw new TypeError(`${path}.options must use unique ids`);
  }
  const recommendation = directionDecision(value.recommendation, `${path}.recommendation`);
  const selection = directionDecision(value.selection, `${path}.selection`, { selection: true });
  const ids = new Set(options.map((option) => option.id));
  if (!ids.has(recommendation.optionId)) {
    throw new TypeError(`${path}.recommendation.optionId must name an option`);
  }
  if (!ids.has(selection.optionId)) {
    throw new TypeError(`${path}.selection.optionId must name an option`);
  }
  return Object.freeze({ options: Object.freeze(options), recommendation, selection });
}

function assertDesignReferenceEvidence(
  directions,
  evidence,
  path,
  { rejectCopiedUrls = true } = {},
) {
  if (directions === undefined) return;
  const byId = new Map(evidence.flatMap((item, index) => (
    item.id === undefined ? [] : [[item.id, { index, item }]]
  )));
  for (const [optionIndex, option] of directions.options.entries()) {
    for (const [referenceIndex, reference] of option.references.entries()) {
      const referencePath = `${path}.options[${optionIndex}].references[${referenceIndex}]`;
      if (reference.evidenceId !== undefined) {
        const entry = byId.get(reference.evidenceId);
        if (entry === undefined) {
          throw new TypeError(
            `${referencePath}.evidenceId refers to unknown evidence id: ${reference.evidenceId}`,
          );
        }
        httpUrl(entry.item.location, `${referencePath}.evidenceId location`);
        continue;
      }
      if (!rejectCopiedUrls) continue;
      const duplicateIndex = evidence.findIndex((item) => item.location === reference.url);
      if (duplicateIndex !== -1) {
        const duplicate = evidence[duplicateIndex];
        if (duplicate.id === undefined) {
          throw new TypeError(
            `${referencePath}.url duplicates ${path.replace(/\.designDirections$/u, "")}.evidence[${duplicateIndex}].location; give that evidence an id and reference it`,
          );
        }
        throw new TypeError(
          `${referencePath}.url duplicates evidence location; use evidenceId: ${duplicate.id}`,
        );
      }
    }
  }
}

export function validateAlignInput(value, defaults = {}) {
  if (!isRecord(value)) throw new TypeError("Align input must be an object");
  if (value.schemaVersion !== 3) {
    throw new TypeError("$.schemaVersion must be 3");
  }
  return validateAlignInputV3(value, defaults);
}

function validateAlignInputV3(value, defaults = {}) {
  const allowed = [
    "schemaVersion",
    "locale",
    "theme",
    ...contentKeysBySchema[3],
    "revisionSummary",
  ];
  assertKeys(value, allowed, "$");

  const locale = value.locale ?? defaults.locale ?? "en-US";
  const theme = value.theme ?? defaults.theme ?? "system";
  if (!["en-US", "ko-KR"].includes(locale)) {
    throw new TypeError("$.locale must be en-US or ko-KR");
  }
  if (!["system", "light", "dark"].includes(theme)) {
    throw new TypeError("$.theme must be system, light, or dark");
  }
  const evidence = evidenceItems(value.evidence, "$.evidence");
  const validatedDesignDirections = value.designDirections === undefined
    ? undefined
    : designDirections(value.designDirections, "$.designDirections", {
      imageField: "imagePath",
      validateImage: (imagePath, path) => {
        const normalized = text(imagePath, path);
        if (!isAbsolute(normalized)) throw new TypeError(`${path} must be an absolute path`);
        return normalized;
      },
    });
  const intent = intentItems(value.intent, "$.intent");
  const flow = behaviorValue(value.flow, "$.flow", { cited: true });
  const content = {
    schemaVersion: 3,
    locale,
    theme,
    title: text(value.title, "$.title", 160),
    goal: citedText(value.goal, "$.goal"),
    problem: citedText(value.problem, "$.problem"),
    intent: Object.freeze(intent),
    exclusions: Object.freeze(citedTextList(value.exclusions, "$.exclusions")),
    ...(validatedDesignDirections === undefined
      ? {}
      : { designDirections: validatedDesignDirections }),
    ...(flow === undefined ? {} : { flow }),
    evidence,
    revisionSummary: text(value.revisionSummary, "$.revisionSummary"),
  };
  assertDesignReferenceEvidence(validatedDesignDirections, evidence, "$.designDirections");
  assertCitations({
    goal: content.goal,
    problem: content.problem,
    intent: content.intent,
    exclusions: content.exclusions,
    flow: content.flow,
  }, evidence, "$");
  assertNoExactInputDuplicates(content);
  return Object.freeze(content);
}

async function readStableFile(path, maximumBytes, label) {
  const first = await lstat(path);
  if (!first.isFile() || first.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (first.size > maximumBytes) {
    throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (!sameFile(first, opened)) throw new Error(`${label} changed while opening`);
    const bytes = await handle.readFile();
    const completed = await handle.stat();
    if (
      !sameFile(opened, completed)
      || completed.size !== bytes.length
      || completed.mtimeMs !== opened.mtimeMs
      || completed.ctimeMs !== opened.ctimeMs
    ) {
      throw new Error(`${label} changed while reading`);
    }
    return { bytes, identity: completed };
  } finally {
    await handle.close();
  }
}

async function hydrateDesignDirections(value) {
  if (!value) return undefined;
  let totalBytes = 0;
  const options = [];
  for (const [index, option] of value.options.entries()) {
    const label = `Design direction image ${index + 1}`;
    const { bytes } = await readStableFile(option.imagePath, IMAGE_MAXIMUM_BYTES, label);
    totalBytes += bytes.length;
    if (totalBytes > IMAGE_TOTAL_MAXIMUM_BYTES) {
      throw new Error(`Design direction images exceed ${IMAGE_TOTAL_MAXIMUM_BYTES} bytes`);
    }
    const image = rasterImage(bytes, label);
    const { imagePath: _imagePath, ...content } = option;
    options.push(Object.freeze({
      ...content,
      image: Object.freeze({ ...image, data: bytes.toString("base64") }),
    }));
  }
  return Object.freeze({ ...value, options: Object.freeze(options) });
}

async function readInputJson(path) {
  const { bytes } = await readStableFile(path, INPUT_MAXIMUM_BYTES, "Align input");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Align input is not valid JSON", { cause: error });
  }
}

export async function readAlignInput(path, defaults) {
  const value = await readInputJson(path);
  const input = validateAlignInput(value, defaults);
  const hydratedDirections = await hydrateDesignDirections(input.designDirections);
  return hydratedDirections === undefined
    ? input
    : Object.freeze({ ...input, designDirections: hydratedDirections });
}

function sameFile(actual, expected) {
  return actual.isFile()
    && !actual.isSymbolicLink()
    && actual.dev === expected.dev
    && actual.ino === expected.ino
    && actual.size === expected.size;
}

function artifactContent(input) {
  const keys = contentKeysBySchema[input.schemaVersion];
  return Object.freeze(Object.fromEntries(
    keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]),
  ));
}

function artifactRevision(number, agreedAt, input) {
  return Object.freeze({
    number,
    agreedAt,
    summary: input.revisionSummary,
    content: artifactContent(input),
  });
}

export function sealAlignHtml(source) {
  const matches = source.match(new RegExp(DIGEST_META_PATTERN.source, "gu")) ?? [];
  if (matches.length !== 1 || !source.includes(DIGEST_PLACEHOLDER)) {
    throw new Error("Align renderer did not produce one digest placeholder");
  }
  const digest = sha256(Buffer.from(source, "utf8"));
  return Object.freeze({
    bytes: Buffer.from(source.replace(DIGEST_META_PATTERN, `$1${digest}$2`), "utf8"),
    digest,
  });
}

function assertArtifactSize(bytes) {
  if (bytes.length > ARTIFACT_MAXIMUM_BYTES) {
    throw new Error(`Align artifact exceeds ${ARTIFACT_MAXIMUM_BYTES} bytes`);
  }
}

export function verifyAlignHtml(source) {
  const match = source.match(DIGEST_META_PATTERN);
  if (!match || !DIGEST_PATTERN.test(match[0].slice(match[1].length, -match[2].length))) {
    throw new Error("This file is not a Hope Align artifact");
  }
  const digest = match[0].slice(match[1].length, -match[2].length);
  const normalized = source.replace(DIGEST_META_PATTERN, `$1${DIGEST_PLACEHOLDER}$2`);
  if (sha256(Buffer.from(normalized, "utf8")) !== digest) {
    throw new Error(
      "Hope did not revise this Align artifact because it was changed outside Hope",
    );
  }
  return digest;
}

function validateArtifactData(value) {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Align artifact data has an unsupported schema");
  }
  if (typeof value.alignId !== "string" || !/^[a-f0-9-]{36}$/u.test(value.alignId)) {
    throw new Error("Align artifact identity is invalid");
  }
  if (typeof value.repository !== "string" || value.repository.length === 0) {
    throw new Error("Align artifact repository is invalid");
  }
  if (
    typeof value.repositoryIdentity !== "string"
    || value.repositoryIdentity.length === 0
    || value.repositoryIdentity.length > 4_000
  ) {
    throw new Error("Align artifact repository identity is invalid");
  }
  if (!["en-US", "ko-KR"].includes(value.locale)) {
    throw new Error("Align artifact locale is invalid");
  }
  if (!["system", "light", "dark"].includes(value.theme)) {
    throw new Error("Align artifact theme is invalid");
  }
  if (!Array.isArray(value.revisions) || value.revisions.length === 0) {
    throw new Error("Align artifact has no revisions");
  }
  for (const [index, revision] of value.revisions.entries()) {
    if (
      !isRecord(revision)
      || revision.number !== index + 1
      || typeof revision.agreedAt !== "string"
      || typeof revision.summary !== "string"
      || !isRecord(revision.content)
    ) {
      throw new Error("Align artifact revision history is invalid");
    }
    const contentPath = `$.revisions[${index}].content`;
    const hasLegacyGoal = typeof revision.content.intent === "string"
      || revision.content.success !== undefined;
    const hasCurrentGoal = revision.content.checks !== undefined;
    const hasCanonicalIntent = Array.isArray(revision.content.intent)
      || revision.content.exclusions !== undefined
      || revision.content.flow !== undefined;
    if ([hasLegacyGoal, hasCurrentGoal, hasCanonicalIntent].filter(Boolean).length !== 1) {
      throw new Error("Align artifact intent record is invalid");
    }
    const contentSchema = hasCanonicalIntent ? 3 : hasCurrentGoal ? 2 : 1;
    assertKeys(revision.content, contentKeysBySchema[contentSchema], contentPath);
    text(revision.content.title, `${contentPath}.title`, 160);
    const retainedEvidence = evidenceItems(
      revision.content.evidence,
      `${contentPath}.evidence`,
    );
    if (hasCurrentGoal || hasCanonicalIntent) {
      citedText(revision.content.problem, `${contentPath}.problem`);
    } else {
      text(revision.content.problem, `${contentPath}.problem`);
    }
    if (hasCanonicalIntent) {
      citedText(revision.content.goal, `${contentPath}.goal`);
      intentItems(revision.content.intent, `${contentPath}.intent`);
      citedTextList(revision.content.exclusions, `${contentPath}.exclusions`);
      behaviorValue(revision.content.flow, `${contentPath}.flow`, { cited: true });
    } else if (hasCurrentGoal) {
      citedText(revision.content.goal, `${contentPath}.goal`);
      checkItems(revision.content.checks, `${contentPath}.checks`);
    } else {
      text(revision.content.intent, `${contentPath}.intent`);
      const success = textList(revision.content.success, `${contentPath}.success`, 12);
      if (success.length === 0) throw new Error("Align artifact success list is empty");
    }
    if (hasCanonicalIntent) {
      assertCitations({
        goal: revision.content.goal,
        problem: revision.content.problem,
        intent: revision.content.intent,
        exclusions: revision.content.exclusions,
        flow: revision.content.flow,
      }, retainedEvidence, contentPath);
    } else if (hasCurrentGoal) {
      citedText(revision.content.boundary, `${contentPath}.boundary`);
    } else if (hasLegacyGoal) {
      text(revision.content.boundary, `${contentPath}.boundary`);
    }
    if (!hasCanonicalIntent) {
      scopeValue(revision.content.scope, `${contentPath}.scope`, { cited: hasCurrentGoal });
      behaviorValue(revision.content.behavior, `${contentPath}.behavior`, {
        cited: hasCurrentGoal,
      });
      decisionItems(revision.content.decisions, `${contentPath}.decisions`, {
        cited: hasCurrentGoal,
      });
    }
    if (hasCurrentGoal) {
      citedTextList(revision.content.openChoices, `${contentPath}.openChoices`);
      assertCitations({
        goal: revision.content.goal,
        problem: revision.content.problem,
        checks: revision.content.checks,
        boundary: revision.content.boundary,
        scope: revision.content.scope,
        behavior: revision.content.behavior,
        decisions: revision.content.decisions,
        openChoices: revision.content.openChoices,
      }, retainedEvidence, contentPath);
    } else if (hasLegacyGoal) {
      textList(revision.content.openChoices, `${contentPath}.openChoices`);
    }
    if (revision.content.designDirections !== undefined) {
      const directions = designDirections(
        revision.content.designDirections,
        `$.revisions[${index}].content.designDirections`,
        { imageField: "image", validateImage: embeddedImage },
      );
      assertDesignReferenceEvidence(
        directions,
        retainedEvidence,
        `${contentPath}.designDirections`,
        { rejectCopiedUrls: false },
      );
      const totalBytes = directions.options.reduce(
        (total, option) => total + Buffer.byteLength(option.image.data, "base64"),
        0,
      );
      if (totalBytes > IMAGE_TOTAL_MAXIMUM_BYTES) {
        throw new Error("Align artifact design direction images exceed their total limit");
      }
    }
  }
  return value;
}

async function readAlignArtifactFile(path) {
  const absolutePath = isAbsolute(path) ? path : resolve(path);
  const { bytes, identity } = await readStableFile(
    absolutePath,
    ARTIFACT_MAXIMUM_BYTES,
    "Align artifact",
  );
  const source = bytes.toString("utf8");
  const digest = verifyAlignHtml(source);
  const alignId = source.match(ALIGN_ID_META_PATTERN)?.[1];
  const dataSource = source.match(DATA_PATTERN)?.[1];
  if (!alignId || dataSource === undefined) {
    throw new Error("This file is not a complete Hope Align artifact");
  }
  let data;
  try {
    data = validateArtifactData(JSON.parse(dataSource));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Align artifact data is not valid JSON", { cause: error });
    }
    throw error;
  }
  if (data.alignId !== alignId) throw new Error("Align artifact identity does not match");
  return Object.freeze({ absolutePath, data, digest, identity });
}

function gitEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(
    ([name, value]) => !name.toUpperCase().startsWith("GIT_") && value !== undefined,
  ));
}

async function runGit(root, argumentsList) {
  return await execFileAsync("git", ["-c", "core.hooksPath=/dev/null", ...argumentsList], {
    cwd: root,
    encoding: "utf8",
    env: gitEnvironment(),
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 10_000,
  });
}

async function repositoryRoot(requestedRoot) {
  const requested = await realpath(requestedRoot);
  const { stdout } = await runGit(requested, ["rev-parse", "--show-toplevel"]);
  return await realpath(stdout.trim());
}

function repositoryPath(value) {
  return value.replace(/^\/+|\/+$/gu, "").replace(/\.git$/iu, "");
}

function repositoryDisplay(path, root) {
  const parts = path.split(/[\\/]/u).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join("/") : basename(root);
}

function normalizedPort(url) {
  if (!url.port) return "";
  const defaults = new Map([
    ["http:", "80"],
    ["https:", "443"],
    ["ssh:", "22"],
  ]);
  return defaults.get(url.protocol) === url.port ? "" : `:${url.port}`;
}

async function repositoryFromRemote(remote, root) {
  const normalized = remote.trim();
  const scp = normalized.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/u);
  if (scp && !normalized.includes("://")) {
    const path = repositoryPath(scp[2]);
    return Object.freeze({
      identity: `remote://${scp[1].toLowerCase()}/${path}`,
      label: repositoryDisplay(path, root),
    });
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "file:") {
      const path = repositoryPath(url.pathname);
      const authority = `${url.hostname.toLowerCase()}${normalizedPort(url)}`;
      return Object.freeze({
        identity: `remote://${authority}/${path}`,
        label: repositoryDisplay(path, root),
      });
    }
    const local = await realpath(url);
    return Object.freeze({
      identity: pathToFileURL(local).href,
      label: repositoryDisplay(local, root),
    });
  } catch {
    const local = await realpath(resolve(root, normalized));
    return Object.freeze({
      identity: pathToFileURL(local).href,
      label: repositoryDisplay(local, root),
    });
  }
}

async function repositoryMetadata(root) {
  try {
    const { stdout } = await runGit(root, ["remote", "get-url", "origin"]);
    return await repositoryFromRemote(stdout, root);
  } catch {
    return Object.freeze({
      identity: pathToFileURL(root).href,
      label: basename(root),
    });
  }
}

function insideRoot(root, target) {
  const fromRoot = relative(root, target);
  return fromRoot !== ".."
    && !fromRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromRoot);
}

function sameDirectory(actual, expected) {
  return actual.isDirectory()
    && !actual.isSymbolicLink()
    && actual.dev === expected.dev
    && actual.ino === expected.ino;
}

async function ensureSafeParent(root, target, { create = false } = {}) {
  const parent = dirname(target);
  if (!insideRoot(root, parent)) {
    throw new Error("Align artifact output must stay inside the target repository");
  }
  const fromRoot = relative(root, parent);
  let current = root;
  const components = [];
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Hope could not verify the target repository directory");
  }
  components.push(Object.freeze({ identity: rootInfo, path: root }));
  for (const part of fromRoot.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("Align artifact output path contains a non-directory or link");
      }
    } catch (error) {
      if (error?.code !== "ENOENT" || !create) throw error;
      await mkdir(current, { mode: 0o755 });
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("Hope could not verify the Align artifact directory");
      }
      components.push(Object.freeze({ identity: info, path: current }));
      continue;
    }
    components.push(Object.freeze({ identity: await lstat(current), path: current }));
  }
  const canonicalRoot = await realpath(root);
  const canonicalParent = await realpath(parent);
  if (canonicalRoot !== root || !insideRoot(root, canonicalParent)) {
    throw new Error("Align artifact output must stay inside the target repository");
  }
  return Object.freeze({ components: Object.freeze(components), path: parent });
}

async function verifySafeParent(root, target, expected) {
  const current = await ensureSafeParent(root, target);
  if (
    current.path !== expected.path
    || current.components.length !== expected.components.length
    || current.components.some((component, index) => (
      component.path !== expected.components[index].path
      || !sameDirectory(component.identity, expected.components[index].identity)
    ))
  ) {
    throw new Error("Align artifact output directory changed during publication");
  }
}

async function publicationCheckpoint(root, target, parent, dependencies, step) {
  await dependencies.publicationCheckpoint?.(step);
  await verifySafeParent(root, target, parent);
}

function resolveArtifactTarget(root, requested, requestedRoot = root) {
  let target;
  if (isAbsolute(requested)) {
    const unresolvedRoot = resolve(requestedRoot);
    const unresolvedTarget = resolve(requested);
    const fromRequestedRoot = relative(unresolvedRoot, unresolvedTarget);
    target = insideRoot(unresolvedRoot, unresolvedTarget)
      ? resolve(root, fromRequestedRoot)
      : unresolvedTarget;
  } else {
    target = resolve(root, requested);
  }
  if (extname(target).toLowerCase() !== ".html") {
    throw new Error("Align artifact output must use an .html extension");
  }
  return target;
}

async function syncDirectory(path) {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    if (
      process.platform !== "win32"
      && !["EINVAL", "ENOTSUP", "EISDIR"].includes(error?.code)
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function writeStaging(path, bytes) {
  const handle = await open(path, "wx", 0o644);
  let identity;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    identity = await handle.stat();
  } finally {
    await handle.close();
  }
  return identity;
}

async function unlinkIfOwned(path, expected) {
  if (!expected) return;
  try {
    const current = await lstat(path);
    if (sameFile(current, expected)) await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNew(root, target, parent, bytes, dependencies) {
  await publicationCheckpoint(root, target, parent, dependencies, "before-stage");
  try {
    await lstat(target);
    throw new Error(`Hope did not replace the existing file: ${target}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const staging = join(
    dirname(target),
    `.${basename(target)}.hope-${randomBytes(12).toString("hex")}.tmp`,
  );
  let identity;
  let linked = false;
  try {
    identity = await writeStaging(staging, bytes);
    await publicationCheckpoint(root, target, parent, dependencies, "before-link");
    await link(staging, target);
    linked = true;
    await publicationCheckpoint(root, target, parent, dependencies, "after-link");
    const published = await lstat(target);
    if (!sameFile(published, identity) || published.nlink !== 2) {
      throw new Error("The Align artifact changed during publication");
    }
    await unlink(staging);
    const final = await lstat(target);
    if (!sameFile(final, identity) || final.nlink !== 1) {
      throw new Error("The Align artifact changed during publication");
    }
    await publicationCheckpoint(root, target, parent, dependencies, "after-publication");
    await syncDirectory(dirname(target));
  } catch (error) {
    if (linked) await unlinkIfOwned(target, identity).catch(() => {});
    await unlinkIfOwned(staging, identity).catch(() => {});
    throw error;
  }
}

async function replaceOwned(root, target, parent, original, bytes, dependencies) {
  const staging = join(
    dirname(target),
    `.${basename(target)}.hope-${randomBytes(12).toString("hex")}.tmp`,
  );
  let stagingIdentity;
  try {
    await publicationCheckpoint(root, target, parent, dependencies, "before-stage");
    stagingIdentity = await writeStaging(staging, bytes);
    await publicationCheckpoint(root, target, parent, dependencies, "before-reread");
    const current = await readAlignArtifactFile(target);
    if (!sameFile(current.identity, original.identity) || current.digest !== original.digest) {
      throw new Error("Align artifact changed before Hope could revise it");
    }
    await publicationCheckpoint(root, target, parent, dependencies, "before-replace");
    await rename(staging, target);
    await publicationCheckpoint(root, target, parent, dependencies, "after-replace");
    const final = await lstat(target);
    if (!sameFile(final, stagingIdentity) || final.nlink !== 1) {
      throw new Error("Hope could not verify the revised Align artifact");
    }
    await syncDirectory(dirname(target));
  } catch (error) {
    await unlinkIfOwned(staging, stagingIdentity).catch(() => {});
    throw error;
  }
}

function resultFor(path, data, digest) {
  const current = data.revisions.at(-1);
  return Object.freeze({
    alignId: data.alignId,
    artifactPath: path,
    digest,
    repository: data.repository,
    revision: current.number,
    title: current.content.title,
  });
}

export async function createAlignArtifact({ inputPath, outputPath, root }, dependencies = {}) {
  if (!inputPath || !outputPath) throw new TypeError("inputPath and outputPath are required");
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const input = await readAlignInput(inputPath);
  const target = resolveArtifactTarget(
    resolvedRoot,
    outputPath,
    requestedRoot,
  );
  const now = dependencies.now?.() ?? new Date();
  const agreedAt = now.toISOString();
  const repository = await repositoryMetadata(resolvedRoot);
  const data = Object.freeze({
    schemaVersion: 1,
    alignId: (dependencies.randomUUID ?? randomUUID)(),
    repository: repository.label,
    repositoryIdentity: repository.identity,
    locale: input.locale,
    theme: input.theme,
    createdAt: agreedAt,
    revisions: Object.freeze([artifactRevision(1, agreedAt, input)]),
  });
  const sealed = sealAlignHtml(renderAlignArtifact(data, { digest: DIGEST_PLACEHOLDER }));
  assertArtifactSize(sealed.bytes);
  const parent = await ensureSafeParent(resolvedRoot, target, { create: true });
  await publishNew(resolvedRoot, target, parent, sealed.bytes, dependencies);
  return resultFor(target, data, sealed.digest);
}

export async function inspectAlignArtifact(artifactPath) {
  if (!artifactPath) throw new TypeError("artifactPath is required");
  const artifact = await readAlignArtifactFile(artifactPath);
  const current = artifact.data.revisions.at(-1);
  return Object.freeze({
    ...resultFor(artifact.absolutePath, artifact.data, artifact.digest),
    agreedAt: current.agreedAt,
    content: current.content,
    history: Object.freeze(artifact.data.revisions.map((revision) => Object.freeze({
      agreedAt: revision.agreedAt,
      number: revision.number,
      summary: revision.summary,
    }))),
    locale: artifact.data.locale,
    theme: artifact.data.theme,
  });
}

export async function reviseAlignArtifact({
  artifactPath,
  expectedDigest,
  inputPath,
  root,
}, dependencies = {}) {
  if (!artifactPath || !inputPath || !expectedDigest) {
    throw new TypeError("artifactPath, expectedDigest, and inputPath are required");
  }
  if (!DIGEST_PATTERN.test(expectedDigest)) {
    throw new TypeError("expectedDigest must be a lowercase SHA-256 digest");
  }
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const target = resolveArtifactTarget(
    resolvedRoot,
    artifactPath,
    requestedRoot,
  );
  const parent = await ensureSafeParent(resolvedRoot, target);
  const original = await readAlignArtifactFile(target);
  if (original.identity.nlink !== 1) {
    throw new Error("Hope did not revise a hard-linked Align artifact");
  }
  if (original.digest !== expectedDigest) {
    throw new Error("Align artifact digest does not match the inspected revision");
  }
  const currentRepository = await repositoryMetadata(resolvedRoot);
  if (original.data.repositoryIdentity !== currentRepository.identity) {
    throw new Error("Align artifact belongs to a different repository");
  }
  const input = await readAlignInput(inputPath, {
    locale: original.data.locale,
    theme: original.data.theme,
  });
  const now = dependencies.now?.() ?? new Date();
  const revision = artifactRevision(
    original.data.revisions.length + 1,
    now.toISOString(),
    input,
  );
  const data = Object.freeze({
    ...original.data,
    locale: input.locale,
    theme: input.theme,
    revisions: Object.freeze([...original.data.revisions, revision]),
  });
  const sealed = sealAlignHtml(renderAlignArtifact(data, { digest: DIGEST_PLACEHOLDER }));
  assertArtifactSize(sealed.bytes);
  await replaceOwned(
    resolvedRoot,
    target,
    parent,
    original,
    sealed.bytes,
    dependencies,
  );
  return resultFor(target, data, sealed.digest);
}
