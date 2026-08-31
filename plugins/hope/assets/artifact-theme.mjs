export const ARTIFACT_THEME_VERSION = 1;

export const ARTIFACT_COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#79d6b0",
    background: "#0e1112",
    border: "#303735",
    componentBorder: "#68736f",
    link: "#8bc9ff",
    muted: "#a5afab",
    panel: "#15191a",
    text: "#f1f4f2",
    visited: "#c5b0e8",
  }),
  light: Object.freeze({
    accent: "#006b52",
    background: "#f5f4ef",
    border: "#d8d8d2",
    componentBorder: "#7b837f",
    link: "#006aae",
    muted: "#5d6663",
    panel: "#fffdf8",
    text: "#171a19",
    visited: "#674ca1",
  }),
});

export const ARTIFACT_SPACE = Object.freeze([4, 8, 12, 16, 24, 32, 40, 48, 64]);

export const ARTIFACT_TYPE = Object.freeze({
  brand: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1 }),
    wide: Object.freeze({ fontSize: 18, lineHeight: 1 }),
  }),
  body: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.6 }),
    wide: Object.freeze({ fontSize: 14, lineHeight: 1.58 }),
  }),
  menu: Object.freeze({ fontSize: 14, lineHeight: 1.5 }),
  micro: Object.freeze({
    compactFontSize: 12,
    fontSize: 11,
    lineHeight: 1.45,
  }),
  pageTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 28, lineHeight: 1.2 }),
    wide: Object.freeze({ fontSize: 32, lineHeight: 1.2 }),
  }),
  sectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 16, lineHeight: 1.4 }),
    wide: Object.freeze({ fontSize: 18, lineHeight: 1.4 }),
  }),
  supporting: Object.freeze({
    narrow: Object.freeze({ fontSize: 12, lineHeight: 1.55 }),
    wide: Object.freeze({ fontSize: 12, lineHeight: 1.55 }),
  }),
  subsectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.45 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1.45 }),
  }),
});

export const ARTIFACT_LAYOUT = Object.freeze({
  compactBreakpoint: 520,
  documentWidth: 1440,
  narrowBreakpoint: 760,
  proseWidth: "78ch",
  tableOfContentsWidth: 236,
  tocBreakpoint: 1100,
  topbarHeight: 58,
  topbarInnerHeight: 57,
  topbarWideGutter: 34,
});
