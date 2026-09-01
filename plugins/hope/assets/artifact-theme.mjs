export const ARTIFACT_THEME_VERSION = 5;

export const ARTIFACT_COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#79ddb1",
    background: "#0c1115",
    border: "#2b343b",
    componentBorder: "#68757e",
    link: "#8bc9ff",
    muted: "#a8b1b8",
    panel: "#12181d",
    rail: "#0c0f11",
    text: "#f2f4f5",
    visited: "#c5b0e8",
  }),
  light: Object.freeze({
    accent: "#006b52",
    background: "#fafafa",
    border: "#e1e4e2",
    componentBorder: "#818a86",
    link: "#006aae",
    muted: "#5d6663",
    panel: "#ffffff",
    rail: "#f3f5f4",
    text: "#171a19",
    visited: "#674ca1",
  }),
});

export const ARTIFACT_SPACE = Object.freeze([4, 8, 12, 16, 24, 32, 40, 48, 64]);

export const ARTIFACT_TYPE = Object.freeze({
  brand: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1 }),
    wide: Object.freeze({ fontSize: 16, lineHeight: 1 }),
  }),
  body: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1.6 }),
    wide: Object.freeze({ fontSize: 14, lineHeight: 1.58 }),
  }),
  menu: Object.freeze({ fontSize: 13, lineHeight: 1.5 }),
  micro: Object.freeze({
    compactFontSize: 12,
    fontSize: 11,
    lineHeight: 1.45,
  }),
  pageTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 24, lineHeight: 1.2 }),
    wide: Object.freeze({ fontSize: 28, lineHeight: 1.16 }),
  }),
  sectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 15, lineHeight: 1.4 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1.45 }),
  }),
  supporting: Object.freeze({
    narrow: Object.freeze({ fontSize: 12, lineHeight: 1.55 }),
    wide: Object.freeze({ fontSize: 12, lineHeight: 1.55 }),
  }),
  subsectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1.45 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1.45 }),
  }),
});

export const ARTIFACT_LAYOUT = Object.freeze({
  compactBreakpoint: 520,
  documentWidth: 1536,
  narrowBreakpoint: 760,
  proseWidth: "72ch",
  tableOfContentsWidth: 256,
  tocBreakpoint: 1100,
  topbarHeight: 58,
  topbarInnerHeight: 57,
  topbarWideGutter: 34,
});
