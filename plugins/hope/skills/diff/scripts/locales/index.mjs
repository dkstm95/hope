import {
  checkDictionaryParity,
  label,
  loadDictionaries,
  SUPPORTED_LOCALES,
} from "../../../../assets/artifact-shell/locales.mjs";

export { label, SUPPORTED_LOCALES };
export const THEMES = Object.freeze(["system", "light", "dark"]);

const localeRoot = new URL("./", import.meta.url);
export function normalizeLocale(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "ko" || normalized.startsWith("ko-")) return "ko-KR";
  if (normalized === "en" || normalized.startsWith("en-")) return "en-US";
  return undefined;
}
function systemLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}
export function resolveDisplayOptions({
  hostLocale,
  locale,
  theme,
} = {}) {
  const explicitLocale = locale === undefined
    ? undefined
    : normalizeLocale(locale);
  if (locale !== undefined && !explicitLocale) {
    throw new RangeError(`Unsupported Hope locale: ${String(locale)}`);
  }
  if (theme !== undefined && !THEMES.includes(theme)) {
    throw new RangeError(`Unsupported Hope theme: ${String(theme)}`);
  }

  const host = normalizeLocale(hostLocale);
  const operatingSystem = normalizeLocale(systemLocale());
  return Object.freeze({
    locale: explicitLocale ?? host ?? operatingSystem ?? "en-US",
    localeSource: explicitLocale
      ? "override"
      : host
        ? "host"
        : operatingSystem
          ? "system"
          : "default",
    theme: theme ?? "system",
    themeSource: theme === undefined ? "default" : "override",
  });
}

export async function loadLocale(locale, files = ["common", "diff"]) {
  return loadDictionaries(localeRoot, locale, files);
}

export async function checkLocaleParity(files = ["common", "diff"]) {
  return checkDictionaryParity(localeRoot, files);
}
