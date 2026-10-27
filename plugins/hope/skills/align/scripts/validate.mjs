// Validation for Align's current content (input schema v3), its draft input,
// and the repository record that holds the content with its short history.

const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const ALIGN_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const CONTENT_KEYS = Object.freeze([
  "title", "goal", "problem", "intent", "exclusions", "designDirections", "flow", "evidence",
]);

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

function intentItems(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length === 0) {
    throw new TypeError(`${path} must contain at least 1 item`);
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["statement", "verify", "by", "decidedBy", "reason"], itemPath);
    if (!["agent", "human"].includes(item.by)) {
      throw new TypeError(`${itemPath}.by must be agent or human`);
    }
    if (
      item.decidedBy !== undefined
      && !["user", "delegated"].includes(item.decidedBy)
    ) {
      throw new TypeError(`${itemPath}.decidedBy must be user or delegated`);
    }
    return Object.freeze({
      statement: citedText(item.statement, `${itemPath}.statement`),
      verify: text(item.verify, `${itemPath}.verify`),
      by: item.by,
      ...(item.decidedBy === undefined ? {} : { decidedBy: item.decidedBy }),
      ...(item.reason === undefined
        ? {}
        : { reason: citedText(item.reason, `${itemPath}.reason`) }),
    });
  });
}

function titledItems(value, path, { maximumItems, minimumItems }) {
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
      title: citedText(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : { detail: citedText(item.detail, `${itemPath}.detail`) }),
    });
  });
}

function outcomeItems(value, path, maximumItems) {
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
      title: citedText(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : { detail: citedText(item.detail, `${itemPath}.detail`) }),
      ...(item.kind === undefined ? {} : { kind: item.kind }),
    });
  });
}

function flowValue(value, path) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, ["steps", "outcomes"], path);
  return Object.freeze({
    steps: titledItems(value.steps, `${path}.steps`, { maximumItems: 8, minimumItems: 2 }),
    outcomes: outcomeItems(value.outcomes, `${path}.outcomes`, 6),
  });
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

function designDirections(value, path) {
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
      "imagePath",
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
      imagePath: text(item.imagePath, `${itemPath}.imagePath`),
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

function assertDesignReferenceEvidence(directions, evidence, path) {
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
function assertNoExactDuplicates(content) {
  const titled = (item) => JSON.stringify([
    citedTextIdentity(item.title),
    item.detail === undefined ? null : citedTextIdentity(item.detail),
    item.kind ?? null,
  ]);
  assertUniqueSiblings(
    content.evidence,
    "$.evidence",
    (item) => JSON.stringify([item.label, item.location]),
  );
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
    assertUniqueSiblings(content.flow.steps, "$.flow.steps", titled);
    assertUniqueSiblings(content.flow.outcomes, "$.flow.outcomes", titled);
  }
}

function contentFields(value, path) {
  const evidence = evidenceItems(value.evidence, `${path}.evidence`);
  const directions = value.designDirections === undefined
    ? undefined
    : designDirections(value.designDirections, `${path}.designDirections`);
  const flow = flowValue(value.flow, `${path}.flow`);
  const content = Object.freeze({
    title: text(value.title, `${path}.title`, 160),
    goal: citedText(value.goal, `${path}.goal`),
    problem: citedText(value.problem, `${path}.problem`),
    intent: Object.freeze(intentItems(value.intent, `${path}.intent`)),
    exclusions: Object.freeze(citedTextList(value.exclusions, `${path}.exclusions`)),
    ...(directions === undefined ? {} : { designDirections: directions }),
    ...(flow === undefined ? {} : { flow }),
    evidence,
  });
  assertDesignReferenceEvidence(directions, evidence, `${path}.designDirections`);
  assertCitations({
    goal: content.goal,
    problem: content.problem,
    intent: content.intent,
    exclusions: content.exclusions,
    flow: content.flow,
  }, evidence, path);
  assertNoExactDuplicates(content);
  return content;
}

function localeAndTheme(value, defaults) {
  const locale = value.locale ?? defaults.locale ?? "en-US";
  const theme = value.theme ?? defaults.theme ?? "system";
  if (!["en-US", "ko-KR"].includes(locale)) {
    throw new TypeError("$.locale must be en-US or ko-KR");
  }
  if (!["system", "light", "dark"].includes(theme)) {
    throw new TypeError("$.theme must be system, light, or dark");
  }
  return { locale, theme };
}

/** Validate the current Align content shape that records and drafts share. */
export function validateAlignContent(value, path = "$") {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, CONTENT_KEYS, path);
  return contentFields(value, path);
}

/** Validate a draft: schema v3 content plus locale, theme, and revisionSummary. */
export function validateAlignInput(value, defaults = {}) {
  if (!isRecord(value)) throw new TypeError("Align input must be an object");
  if (value.schemaVersion !== 3) throw new TypeError("$.schemaVersion must be 3");
  assertKeys(value, ["schemaVersion", "locale", "theme", ...CONTENT_KEYS, "revisionSummary"], "$");
  return Object.freeze({
    ...localeAndTheme(value, defaults),
    content: contentFields(value, "$"),
    revisionSummary: text(value.revisionSummary, "$.revisionSummary"),
  });
}

function timestamp(value, path) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${path} must be an ISO 8601 UTC timestamp`);
  }
  return value;
}

/** Validate a repository record: metadata, history entries, and current content. */
export function validateAlignRecord(value) {
  if (!isRecord(value)) throw new TypeError("Align record must be an object");
  assertKeys(value, [
    "schemaVersion", "alignId", "repository", "locale", "theme", "alternateLocale",
    "createdAt", "updatedAt", "history", "content",
  ], "$");
  if (value.schemaVersion !== 1) throw new TypeError("$.schemaVersion must be 1");
  if (typeof value.alignId !== "string" || !ALIGN_ID_PATTERN.test(value.alignId)) {
    throw new TypeError("$.alignId must be a lowercase UUID");
  }
  if (!["locale", "theme"].every((key) => value[key] !== undefined)) {
    throw new TypeError("$.locale and $.theme are required");
  }
  if (!Array.isArray(value.history) || value.history.length === 0) {
    throw new TypeError("$.history must contain at least 1 entry");
  }
  const history = value.history.map((entry, index) => {
    const path = `$.history[${index}]`;
    if (!isRecord(entry)) throw new TypeError(`${path} must be an object`);
    assertKeys(entry, ["at", "summary"], path);
    return Object.freeze({
      at: timestamp(entry.at, `${path}.at`),
      summary: text(entry.summary, `${path}.summary`),
    });
  });
  const content = validateAlignContent(value.content, "$.content");
  for (const [index, option] of (content.designDirections?.options ?? []).entries()) {
    if (option.imagePath.startsWith("/") || /^[a-z]:|\\/iu.test(option.imagePath)) {
      throw new TypeError(
        `$.content.designDirections.options[${index}].imagePath must be a relative path with / separators`,
      );
    }
  }
  const { locale, theme } = localeAndTheme(value, {});
  const alternate = value.alternateLocale;
  if (alternate !== undefined) {
    if (!isRecord(alternate)) throw new TypeError("$.alternateLocale must be an object");
    assertKeys(alternate, ["locale", "href"], "$.alternateLocale");
    if (
      !["en-US", "ko-KR"].includes(alternate.locale)
      || alternate.locale === locale
      || typeof alternate.href !== "string"
      || !/^[^/\\]+\.html$/u.test(alternate.href)
    ) {
      throw new TypeError("$.alternateLocale must name the other locale and a sibling .html file");
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    alignId: value.alignId,
    repository: text(value.repository, "$.repository", 200),
    locale,
    theme,
    ...(alternate === undefined
      ? {}
      : { alternateLocale: Object.freeze({ locale: alternate.locale, href: alternate.href }) }),
    createdAt: timestamp(value.createdAt, "$.createdAt"),
    updatedAt: timestamp(value.updatedAt, "$.updatedAt"),
    history: Object.freeze(history),
    content,
  });
}
