export const DESIGN_VERSION = 3;

export const COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#5db8ff",
    background: "#101214",
    border: "#3a3e42",
    componentBorder: "#767b80",
    decide: "#f2a65a",
    muted: "#a4a7aa",
    panel: "#14171a",
    resolve: "#ef6b73",
    scope: "#94a8bc",
    text: "#f2f3f4",
    verify: "#65aaf2",
    visited: "#c4a7e7",
  }),
  light: Object.freeze({
    accent: "#006fbe",
    background: "#fbfaf7",
    border: "#d9d6d0",
    componentBorder: "#878580",
    decide: "#9a5700",
    muted: "#62615d",
    panel: "#fffefa",
    resolve: "#b4232c",
    scope: "#4f6578",
    text: "#171716",
    verify: "#145da0",
    visited: "#6b4f8a",
  }),
});

export const CODE_THEME = Object.freeze({
  dark: Object.freeze({
    addedBackground: "#12261e",
    background: "#0d1117",
    foreground: "#e6edf3",
    hunkBackground: "#121d2f",
    removedBackground: "#2d1618",
  }),
  light: Object.freeze({
    addedBackground: "#dafbe1",
    background: "#ffffff",
    foreground: "#1f2328",
    hunkBackground: "#ddf4ff",
    removedBackground: "#ffebe9",
  }),
  name: "hope",
});

export const SPACE = Object.freeze([4, 8, 12, 16, 24, 32]);

export const TYPE = Object.freeze({
  brand: Object.freeze({ fontSize: 17, lineHeight: 1 }),
  body: Object.freeze({
    narrow: Object.freeze({ fontSize: 16, lineHeight: 1.55 }),
    wide: Object.freeze({ fontSize: 14, lineHeight: 1.55 }),
  }),
  code: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.35 }),
    wide: Object.freeze({ fontSize: 13, lineHeight: 1.35 }),
  }),
  menu: Object.freeze({ fontSize: 13, lineHeight: 1.4 }),
  micro: Object.freeze({
    compactFontSize: 12,
    fontSize: 11,
    lineHeight: 1.4,
  }),
  pageTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 28, lineHeight: 1.2 }),
    wide: Object.freeze({ fontSize: 32, lineHeight: 1.2 }),
  }),
  sectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 21, lineHeight: 1.35 }),
    wide: Object.freeze({ fontSize: 20, lineHeight: 1.35 }),
  }),
  supporting: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.5 }),
    wide: Object.freeze({ fontSize: 12, lineHeight: 1.5 }),
  }),
  subsectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 17, lineHeight: 1.4 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1.4 }),
  }),
});

export const LAYOUT = Object.freeze({
  compactBreakpoint: 520,
  documentWidth: 1440,
  narrowBreakpoint: 900,
  proseWidth: "80ch",
  tableOfContentsWidth: 230,
  tocBreakpoint: 1100,
});
