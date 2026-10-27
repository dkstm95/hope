import { loadDictionaries } from "../../../../assets/artifact-shell/locales.mjs";

const localeRoot = new URL("../locales/", import.meta.url);
const reasonPrefix = "reader.reason.";

/** The reader's labels in the shape its renderer and client use. */
export function dictionary(locale) {
  const entries = Object.entries(loadDictionaries(localeRoot, locale, ["reader"]));
  return Object.freeze({
    ...Object.fromEntries(entries
      .filter(([key]) => !key.startsWith(reasonPrefix))
      .map(([key, value]) => [key.slice("reader.".length), value])),
    reasons: Object.freeze(Object.fromEntries(entries
      .filter(([key]) => key.startsWith(reasonPrefix))
      .map(([key, value]) => [key.slice(reasonPrefix.length), value]))),
  });
}
