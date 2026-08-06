// Generated from features/record-compat/index.mjs. Do not edit.
const legacyWord = /receipt/giu;

function plainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function currentName(value) {
  return value
    .replaceAll("RECEIPT", "RECORD")
    .replaceAll("Receipt", "Record")
    .replaceAll("receipt", "record");
}

function normalizeValue(value, parentKey) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (!plainObject(value)) {
    if (parentKey === "feature" && typeof value === "string") {
      return value.replace(legacyWord, "record");
    }
    return value;
  }
  const normalized = {};
  const originalKeys = new Map();
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = currentName(key);
    if (Object.hasOwn(normalized, normalizedKey)) {
      throw new TypeError(
        `Legacy record compatibility input contains both ${originalKeys.get(normalizedKey)} and ${key}`,
      );
    }
    originalKeys.set(normalizedKey, key);
    normalized[normalizedKey] = normalizeValue(item, normalizedKey);
  }
  return normalized;
}

export function normalizeLegacyRecordKeys(value) {
  if (!plainObject(value)) return value;
  const normalized = {};
  const originalKeys = new Map();
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = currentName(key);
    if (Object.hasOwn(normalized, normalizedKey)) {
      throw new TypeError(
        `Legacy record compatibility input contains both ${originalKeys.get(normalizedKey)} and ${key}`,
      );
    }
    originalKeys.set(normalizedKey, key);
    normalized[normalizedKey] = normalizedKey === "feature"
      ? normalizeValue(item, normalizedKey)
      : item;
  }
  return normalized;
}

export function normalizeLegacyRecordTerms(value) {
  return normalizeValue(value);
}
