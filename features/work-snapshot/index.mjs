import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";

export const WORK_SOURCE_KINDS = Object.freeze([
  "conversation",
  "git",
  "file",
  "url",
  "artifact",
]);

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const gitObjectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const isoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u;

export const WORK_STRUCTURE_LIMITS = Object.freeze({
  depth: 128,
  nodes: 65_536,
});

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${label} has an unknown field: ${key}`);
    }
  }
}

function nonEmptyString(value, label, maximum = 4_096) {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || [...value].length > maximum
  ) {
    throw new TypeError(
      `${label} must be a non-empty string within ${maximum} characters`,
    );
  }
  return value;
}

function validIsoDateTime(value) {
  const match = isoDateTimePattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= days[month - 1]
    && Number(hourText) <= 23
    && Number(minuteText) <= 59
    && Number(secondText) <= 59
    && (offsetHourText === undefined || Number(offsetHourText) <= 23)
    && (offsetMinuteText === undefined || Number(offsetMinuteText) <= 59);
}

export function validateWorkSnapshot(value, {
  maximumSources = 128,
} = {}) {
  if (!plainObject(value)) {
    throw new TypeError("Work snapshot must be an object");
  }
  exactKeys(value, new Set(["capturedAt", "sources"]), "Work snapshot");
  const capturedAt = nonEmptyString(value.capturedAt, "Work snapshot capturedAt", 128);
  if (!validIsoDateTime(capturedAt)) {
    throw new TypeError("Work snapshot capturedAt must be an ISO date-time");
  }
  if (
    !Array.isArray(value.sources)
    || value.sources.length === 0
    || value.sources.length > maximumSources
  ) {
    throw new TypeError(
      `Work snapshot sources must contain 1 to ${maximumSources} items`,
    );
  }

  const ids = new Set();
  const sources = value.sources.map((source, index) => {
    const label = `Work snapshot source ${index + 1}`;
    if (!plainObject(source)) throw new TypeError(`${label} must be an object`);
    exactKeys(
      source,
      new Set(["digest", "id", "kind", "label", "locator", "revision"]),
      label,
    );
    const id = nonEmptyString(source.id, `${label} id`, 64);
    if (!idPattern.test(id)) throw new TypeError(`${label} ID is invalid`);
    if (ids.has(id)) {
      throw new TypeError(`Work snapshot source ID is repeated: ${id}`);
    }
    ids.add(id);
    if (!WORK_SOURCE_KINDS.includes(source.kind)) {
      throw new TypeError(`${label} kind is unsupported: ${String(source.kind)}`);
    }
    const normalized = {
      id,
      kind: source.kind,
      label: nonEmptyString(source.label, `${label} label`),
      locator: nonEmptyString(source.locator, `${label} locator`, 8_192),
    };
    if (source.revision !== undefined) {
      normalized.revision = nonEmptyString(
        source.revision,
        `${label} revision`,
        1_024,
      );
    }
    if (source.digest !== undefined) {
      normalized.digest = nonEmptyString(source.digest, `${label} digest`, 80);
      if (!digestPattern.test(normalized.digest)) {
        throw new TypeError(`${label} digest must use the sha256: format`);
      }
    }
    if (
      source.kind === "git"
      && !normalized.digest
      && !gitObjectIdPattern.test(normalized.revision ?? "")
    ) {
      throw new TypeError(
        `${label} requires either a full Git object ID or a content digest`,
      );
    }
    if (
      source.kind !== "git"
      && !normalized.digest
    ) {
      throw new TypeError(`${label} requires a content digest`);
    }
    return Object.freeze(normalized);
  });

  return Object.freeze({
    capturedAt: new Date(capturedAt).toISOString(),
    sources: Object.freeze(sources),
  });
}

export function serializedJsonBytes(value) {
  inspectStructuredValue(value);
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function stringBytes(value) {
  return inspectStructuredValue(value).stringBytes;
}

export function inspectStructuredValue(value, {
  maximumDepth = WORK_STRUCTURE_LIMITS.depth,
  maximumNodes = WORK_STRUCTURE_LIMITS.nodes,
} = {}) {
  let total = 0;
  let nodes = 0;
  const seen = new WeakSet();
  const stack = [{ depth: 0, item: value }];
  while (stack.length > 0) {
    const { depth, item } = stack.pop();
    nodes += 1;
    if (nodes > maximumNodes) {
      throw new TypeError(
        `Hope structured input exceeds ${maximumNodes} values`,
      );
    }
    if (depth > maximumDepth) {
      throw new TypeError(
        `Hope structured input exceeds ${maximumDepth} nesting levels`,
      );
    }
    if (typeof item === "string") {
      total += Buffer.byteLength(item, "utf8");
      continue;
    }
    if (!item || typeof item !== "object") continue;
    if (seen.has(item)) {
      throw new TypeError("Hope structured input contains a cycle");
    }
    seen.add(item);
    const entries = Array.isArray(item) ? item : Object.values(item);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, item: entries[index] });
    }
  }
  return Object.freeze({ nodes, stringBytes: total });
}

export async function readBoundedJson(path, {
  label = "Hope structured input",
  maximumBytes = 128 * 1024,
} = {}) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
  if (info.size > maximumBytes) {
    throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== info.dev
      || opened.ino !== info.ino
      || opened.size !== info.size
    ) {
      throw new Error(`${label} changed while being opened`);
    }
    const bytes = await handle.readFile();
    const completed = await handle.stat();
    if (
      !completed.isFile()
      || completed.dev !== opened.dev
      || completed.ino !== opened.ino
      || completed.size !== opened.size
      || completed.mtimeMs !== opened.mtimeMs
      || completed.ctimeMs !== opened.ctimeMs
      || bytes.length !== completed.size
    ) {
      throw new Error(`${label} changed while being read`);
    }
    if (bytes.length > maximumBytes) {
      throw new Error(`${label} exceeds ${maximumBytes} bytes`);
    }
    try {
      const value = JSON.parse(bytes.toString("utf8"));
      inspectStructuredValue(value);
      return Object.freeze({
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        fileBytes: bytes.length,
        value,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${label} is not valid JSON`, { cause: error });
      }
      throw error;
    }
  } finally {
    await handle.close();
  }
}
