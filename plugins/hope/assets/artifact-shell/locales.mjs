import { readFileSync } from "node:fs";

export const SUPPORTED_LOCALES = Object.freeze(["en-US", "ko-KR"]);

const LOCALE_NAMES = Object.freeze({ "en-US": "English", "ko-KR": "한국어" });
const KEY_PATTERN = /^[a-z][a-zA-Z]*(?:[.-][a-zA-Z][a-zA-Z0-9]*)*$/u;

export function localeName(locale) {
  return LOCALE_NAMES[locale];
}

function assertPlainDictionary(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  for (const [key, text] of Object.entries(value)) {
    if (!KEY_PATTERN.test(key)) throw new TypeError(`${name} has an invalid key: ${key}`);
    if (typeof text !== "string" || text.length === 0) {
      throw new TypeError(`${name}.${key} must be a non-empty string`);
    }
  }
  return value;
}

/**
 * Read flat JSON dictionaries from `<directory>/<locale>/<file>.json` and merge them.
 * A later file may not redefine a key from an earlier one.
 */
export function loadDictionaries(directory, locale, files) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new RangeError(`Unsupported Hope locale: ${locale}`);
  }
  const merged = {};
  for (const file of files) {
    const url = new URL(`${locale}/${file}.json`, directory);
    const dictionary = assertPlainDictionary(
      JSON.parse(readFileSync(url, "utf8")),
      `${locale}/${file}`,
    );
    for (const key of Object.keys(dictionary)) {
      if (Object.hasOwn(merged, key)) throw new Error(`Duplicate locale key: ${key}`);
    }
    Object.assign(merged, dictionary);
  }
  return Object.freeze(merged);
}

/** Every supported locale must define the same keys; returns them sorted. */
export function checkDictionaryParity(directory, files) {
  const [reference, ...others] = SUPPORTED_LOCALES.map(
    (locale) => Object.keys(loadDictionaries(directory, locale, files)).sort(),
  );
  for (const [index, keys] of others.entries()) {
    if (JSON.stringify(keys) !== JSON.stringify(reference)) {
      throw new Error(`Locale keys do not match for ${SUPPORTED_LOCALES[index + 1]}`);
    }
  }
  return reference;
}

export function label(dictionary, key) {
  const value = dictionary[key];
  if (typeof value !== "string") throw new Error(`Missing locale key: ${key}`);
  return value;
}

const shellLocales = new URL("./locales/", import.meta.url);

/** The shell's own control and navigation labels. */
export function shellDictionary(locale) {
  return loadDictionaries(shellLocales, locale, ["shell"]);
}

export function checkShellParity() {
  return checkDictionaryParity(shellLocales, ["shell"]);
}
