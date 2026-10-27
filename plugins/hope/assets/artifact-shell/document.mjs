import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  ARTIFACT_COLORS,
  ARTIFACT_LAYOUT,
  ARTIFACT_SPACE,
  ARTIFACT_TYPE,
} from "../artifact-theme.mjs";
import { mountShell } from "./client.mjs";
import { label, localeName, shellDictionary, SUPPORTED_LOCALES } from "./locales.mjs";
import { embeddedJson, escapeHtml } from "./text.mjs";

const fontUrls = Object.freeze({
  code: new URL("../fonts/HopeCode.woff2", import.meta.url),
  sansBold: new URL("../fonts/HopeSansBold.woff2", import.meta.url),
  sansMedium: new URL("../fonts/HopeSansMedium.woff2", import.meta.url),
});
const iconUrl = new URL("../hope-icon.png", import.meta.url);
const shellCssUrl = new URL("./shell.css", import.meta.url);
const THEMES = Object.freeze(["system", "light", "dark"]);

let cachedAssets;

function bundledAssets() {
  cachedAssets ??= Object.freeze({
    css: readFileSync(shellCssUrl, "utf8"),
    fonts: Object.freeze(Object.fromEntries(Object.entries(fontUrls).map(
      ([name, url]) => [name, readFileSync(url)],
    ))),
    icon: readFileSync(iconUrl),
  });
  return cachedAssets;
}

/** Read a feature's stylesheet from disk once per process. */
const cachedStyles = new Map();
export function readStylesheet(url) {
  const key = String(url);
  if (!cachedStyles.has(key)) cachedStyles.set(key, readFileSync(url, "utf8"));
  return cachedStyles.get(key);
}

function hashSource(value) {
  return createHash("sha256").update(value).digest("base64");
}

function kebab(name) {
  return name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

/** Shared Technical Record colors as CSS custom properties, plus feature-local roles. */
function themeDeclarations(theme, extra) {
  const shared = Object.entries(ARTIFACT_COLORS[theme]).map(([name, value]) => [kebab(name), value]);
  return [...shared, ...Object.entries(extra?.[theme] ?? {})]
    .map(([name, value]) => `--${name}:${value}`).join(";");
}

/** Space, type, and layout tokens; narrow type applies at the shared narrow breakpoint. */
function scaleCss() {
  const type = (width) => Object.entries(ARTIFACT_TYPE).map(([role, sizes]) => (
    `--type-${kebab(role)}:${sizes[width].fontSize}px;--leading-${kebab(role)}:${sizes[width].lineHeight}`
  )).join(";");
  const space = ARTIFACT_SPACE.map((value, index) => `--space-${index + 1}:${value}px`).join(";");
  const layout = [
    `--rail-width:${ARTIFACT_LAYOUT.railWidth}px`,
    `--topbar-height:${ARTIFACT_LAYOUT.topbarHeight}px`,
    `--prose:${ARTIFACT_LAYOUT.proseWidth}`,
    `--document-width:${ARTIFACT_LAYOUT.documentWidth}px`,
  ].join(";");
  return `:root{${space};${layout};${type("wide")}}
@media (max-width: ${ARTIFACT_LAYOUT.narrowBreakpoint}px){:root{${type("narrow")}}}`;
}

function themeCss(extra) {
  const light = themeDeclarations("light", extra);
  const dark = themeDeclarations("dark", extra);
  return `:root{color-scheme:light;${light}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;${dark}}}
:root[data-theme="dark"]{color-scheme:dark;${dark}}
@media print{:root,:root[data-theme="dark"],:root:not([data-theme="light"]){color-scheme:light;${light}}}`;
}

function fontCss(fonts) {
  const face = (family, bytes, weight) => `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");font-style:normal;font-weight:${weight};font-display:swap}`;
  return [
    face("Hope Sans", fonts.sansMedium, 500),
    face("Hope Sans", fonts.sansBold, 700),
    face("Hope Code", fonts.code, 400),
  ].join("\n");
}

const icons = Object.freeze({
  contents: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>',
  dark: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path>',
  light: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>',
  repository: '<path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M3 9.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"></path>',
  chevron: '<path d="m8 10 4 4 4-4"></path>',
  external: '<path d="M14 5h5v5"></path><path d="M19 5l-8 8"></path><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>',
});

/** A fixed shell icon. Authored content never reaches an icon. */
export function shellIcon(name, className) {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

export function sectionOrdinal(number) {
  return String(number).padStart(2, "0");
}

/** Repository identity shown in the rail or navigation panel. */
export function repositoryMark(repositoryHtml, className = "repository") {
  return `<span class="${className}">${shellIcon("repository", "repository-icon")}<span>${repositoryHtml}</span></span>`;
}

function localeMenu(alternate, locale, dictionary) {
  if (alternate === undefined) return "";
  if (
    alternate === null
    || typeof alternate !== "object"
    || !SUPPORTED_LOCALES.includes(alternate.locale)
    || typeof alternate.href !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/u.test(alternate.href)
  ) {
    throw new TypeError("alternateLocale must name a supported locale and sibling HTML file");
  }
  const language = escapeHtml(label(dictionary, "shell.language"));
  return `<details class="locale-menu" data-dismiss>
          <summary aria-label="${language}" title="${language}"><span lang="${locale}">${localeName(locale)}</span>${shellIcon("chevron", "locale-chevron")}</summary>
          <ul class="locale-options"><li><span class="locale-current" aria-current="page" lang="${locale}">${localeName(locale)}</span></li><li><a class="locale-option" href="${escapeHtml(alternate.href)}" hreflang="${alternate.locale}" lang="${alternate.locale}">${localeName(alternate.locale)}</a></li></ul>
        </details>`;
}

function themeButton(theme, dictionary) {
  const dark = escapeHtml(label(dictionary, "shell.useDarkTheme"));
  const light = escapeHtml(label(dictionary, "shell.useLightTheme"));
  const initial = theme === "dark" ? light : dark;
  return `<button class="theme-button" id="theme-toggle" type="button" aria-label="${initial}" title="${initial}" data-label-dark="${dark}" data-label-light="${light}">
          ${shellIcon("dark", "theme-icon").replace("<svg ", `<svg data-theme-icon="dark"${theme === "dark" ? " hidden" : ""} `)}
          ${shellIcon("light", "theme-icon").replace("<svg ", `<svg data-theme-icon="light"${theme === "dark" ? "" : " hidden"} `)}
        </button>`;
}

function tableOfContents(toc, dictionary, className) {
  if (!toc || toc.items.length === 0) return "";
  const heading = `<h2 class="toc-heading"><span>${escapeHtml(label(dictionary, "shell.index"))}</span><span class="toc-progress"><span data-toc-current>1</span> / ${toc.items.length}</span></h2>`;
  const items = toc.items.map((item) => (
    `<li><a class="toc-link" href="#${escapeHtml(item.id)}"><span class="toc-number">${sectionOrdinal(item.number)}</span><span>${escapeHtml(item.title)}</span></a></li>`
  )).join("");
  return `<nav class="toc ${className}" aria-label="${escapeHtml(toc.label)}">${heading}<ol class="toc-list">${items}</ol></nav>`;
}

/**
 * The reference preview shared by evidence and judgment markers. A marker names its
 * target with `data-reference-target`; the target's `[data-reference-body]` (or the
 * whole target) is copied into the preview as inert DOM.
 */
function referencePopover(dictionary, more) {
  const close = escapeHtml(label(dictionary, "shell.closePreview"));
  return `<aside class="reference-popover" id="reference-popover" popover="auto" role="dialog" aria-labelledby="reference-popover-title">
    <header class="reference-popover-head"><strong id="reference-popover-title"></strong><button class="reference-popover-close" type="button" aria-label="${close}" title="${close}">×</button></header>
    <div class="reference-popover-body" data-reference-popover-body></div>
    <a class="reference-popover-more" data-reference-popover-more href="${escapeHtml(more.href)}">${escapeHtml(more.label)}</a>
  </aside>`;
}

/**
 * Assemble one self-contained Technical Record: head, CSP, fonts, icon, rail, main,
 * reference preview, and the fixed scripts. Features own everything inside `main`
 * and the named rail slots; every slot value is already-escaped HTML.
 */
export function renderDocument({
  locale,
  theme,
  title,
  identity,
  headMeta = [],
  colors,
  styles = [],
  scripts = [],
  dataScripts = [],
  skip,
  main,
  toc,
  rail = {},
  navigation,
  popover,
  printIdentity = [],
  alternateLocale,
  fonts,
}) {
  if (!SUPPORTED_LOCALES.includes(locale)) throw new RangeError(`Unsupported Hope locale: ${locale}`);
  if (!THEMES.includes(theme)) throw new RangeError(`Unsupported Hope theme: ${theme}`);
  const dictionary = shellDictionary(locale);
  const assets = bundledAssets();
  const localeHtml = localeMenu(alternateLocale, locale, dictionary);
  const styleSource = [fontCss(fonts ?? assets.fonts), scaleCss(), themeCss(colors), assets.css, ...styles].join("\n");
  const scriptSource = [`(${mountShell.toString()})();`, ...scripts].join("\n");
  const themeAttribute = theme === "system" ? "" : ` data-theme="${theme}"`;
  const brand = `<span class="brand-product">${escapeHtml(identity.product)}</span><span class="brand-separator">/</span><span class="brand-record">${escapeHtml(identity.record)}</span>`;
  const navigationLabel = escapeHtml(navigation.label);
  // Omit empty slots entirely so the document has no blank, indented lines.
  const lines = (...items) => items.filter(Boolean).join("\n");
  const printHeader = printIdentity.length === 0 ? "" : `<header class="print-identity"><strong>${escapeHtml(identity.product)} / ${escapeHtml(identity.record)}</strong>${printIdentity.map((item) => `<span>${item}</span>`).join("")}</header>`;
  return `${lines(
    "<!doctype html>",
    `<html lang="${locale}"${themeAttribute}>`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width,initial-scale=1">',
    ...headMeta.map(([name, content]) => `  <meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`),
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'sha256-${hashSource(styleSource)}'; script-src 'sha256-${hashSource(scriptSource)}'">`,
    `  <link rel="icon" type="image/png" sizes="128x128" href="data:image/png;base64,${assets.icon.toString("base64")}">`,
    `  <title>${escapeHtml(title)} · Hope ${escapeHtml(identity.name)}</title>`,
    `  <style>${styleSource}</style>`,
    "</head>",
    "<body>",
    `  <a class="skip" href="#${escapeHtml(skip.target)}">${escapeHtml(skip.label)}</a>`,
    '  <div class="layout">',
    '    <aside class="rail topbar">',
    `    <div class="topbar-inner${localeHtml === "" ? "" : " has-locale-switch"}">`,
    `      <div class="brand">${brand}</div>`,
    '      <div class="rail-divider" aria-hidden="true"></div>',
    '      <div class="rail-navigation">',
    tableOfContents(toc, dictionary, "toc-desktop"),
    rail.extra,
    "      </div>",
    `      <div class="rail-footer">${rail.footer ?? ""}</div>`,
    '      <div class="topbar-actions">',
    rail.actions,
    `        <div class="display-controls${localeHtml === "" ? "" : " has-locale-menu"}">`,
    localeHtml,
    themeButton(theme, dictionary),
    "        </div>",
    '        <details class="toc-mobile" data-dismiss>',
    `          <summary aria-label="${navigationLabel}" title="${navigationLabel}">${shellIcon("contents", "toc-icon")}</summary>`,
    '          <div class="toc-mobile-panel">',
    navigation.lead,
    tableOfContents(toc, dictionary, "toc-panel"),
    navigation.extra,
    "          </div>",
    "        </details>",
    "      </div>",
    "    </div>",
    "    </aside>",
    `    <main class="main" id="${escapeHtml(main.id)}">${printHeader}${main.content}</main>`,
    "  </div>",
    popover ? referencePopover(dictionary, popover) : "",
    ...dataScripts.map(({ id, value }) => `  <script id="${escapeHtml(id)}" type="application/json">${embeddedJson(value)}</script>`),
    `  <script>${scriptSource}</script>`,
    "</body>",
    "</html>",
  )}\n`;
}

