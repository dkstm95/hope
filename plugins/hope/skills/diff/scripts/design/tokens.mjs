export const DESIGN_VERSION = 10;

export const COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#5db8ff",
    background: "#101214",
    border: "#3a3e42",
    componentBorder: "#737980",
    decide: "#f2a65a",
    muted: "#a8adb2",
    panel: "#14171a",
    resolve: "#ef6b73",
    scope: "#94a8bc",
    text: "#f2f3f4",
    verify: "#65aaf2",
    visited: "#c6a7e8",
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
    visited: "#6246a7",
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

export const SPACE = Object.freeze([4, 8, 12, 16, 24, 32, 40, 48, 64]);

export const TYPE = Object.freeze({
  brand: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1 }),
    wide: Object.freeze({ fontSize: 18, lineHeight: 1 }),
  }),
  body: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.6 }),
    wide: Object.freeze({ fontSize: 14, lineHeight: 1.58 }),
  }),
  code: Object.freeze({
    narrow: Object.freeze({ fontSize: 14, lineHeight: 1.35 }),
    wide: Object.freeze({ fontSize: 13, lineHeight: 1.35 }),
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

export const LAYOUT = Object.freeze({
  compactBreakpoint: 520,
  documentWidth: 1440,
  narrowBreakpoint: 760,
  proseWidth: "78ch",
  tableOfContentsWidth: 236,
  tightProductBarBreakpoint: 340,
  tocBreakpoint: 1100,
  topbarHeight: 58,
  topbarInnerHeight: 57,
  topbarWideGutter: 34,
});
