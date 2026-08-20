export const ALIGN_DESIGN_VERSION = 15;

// Align owns this palette. Values follow the approved Align implementation brief.
export const COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#5db8ff",
    background: "#101214",
    border: "#3a3e42",
    componentBorder: "#737980",
    muted: "#a8adb2",
    panel: "#14171a",
    text: "#f2f3f4",
    visited: "#c6a7e8",
  }),
  light: Object.freeze({
    accent: "#006fbe",
    background: "#fbfaf7",
    border: "#d9d6d0",
    componentBorder: "#878580",
    muted: "#62615d",
    panel: "#fffefa",
    text: "#171716",
    visited: "#6246a7",
  }),
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
  tableOfContentsWidth: 236,
  tocBreakpoint: 1100,
  topbarHeight: 58,
  topbarInnerHeight: 57,
  topbarWideGutter: 34,
});
