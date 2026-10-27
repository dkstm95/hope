export const ARTIFACT_THEME_VERSION = 6;

// Every text role keeps WCAG 2.2 AA contrast on `background`, `panel`, `rail`, and
// `accentSoft`; `componentBorder` keeps 3:1 against the same surfaces.
export const ARTIFACT_COLORS = Object.freeze({
  dark: Object.freeze({
    accent: "#6fdcae",
    accentSoft: "#17302a",
    background: "#0e1316",
    border: "#262f35",
    componentBorder: "#6c7a82",
    link: "#8cc8ff",
    muted: "#a5afb4",
    panel: "#151b1f",
    rail: "#0b0f12",
    text: "#eef2f1",
    visited: "#c8b4ea",
  }),
  light: Object.freeze({
    accent: "#00684f",
    accentSoft: "#e2f2eb",
    background: "#f4f6f4",
    border: "#dfe4e1",
    componentBorder: "#7b8681",
    link: "#0060a8",
    muted: "#56605b",
    panel: "#ffffff",
    rail: "#ecf0ed",
    text: "#141917",
    visited: "#6a4aa6",
  }),
});

export const ARTIFACT_SPACE = Object.freeze([4, 8, 12, 16, 24, 32, 40, 48, 64]);

export const ARTIFACT_TYPE = Object.freeze({
  body: Object.freeze({
    narrow: Object.freeze({ fontSize: 16, lineHeight: 1.6 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1.65 }),
  }),
  brand: Object.freeze({
    narrow: Object.freeze({ fontSize: 15, lineHeight: 1 }),
    wide: Object.freeze({ fontSize: 15, lineHeight: 1 }),
  }),
  code: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1.5 }),
    wide: Object.freeze({ fontSize: 13, lineHeight: 1.55 }),
  }),
  lead: Object.freeze({
    narrow: Object.freeze({ fontSize: 17, lineHeight: 1.55 }),
    wide: Object.freeze({ fontSize: 17, lineHeight: 1.55 }),
  }),
  micro: Object.freeze({
    narrow: Object.freeze({ fontSize: 12, lineHeight: 1.4 }),
    wide: Object.freeze({ fontSize: 12, lineHeight: 1.4 }),
  }),
  pageTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 27, lineHeight: 1.2 }),
    wide: Object.freeze({ fontSize: 36, lineHeight: 1.14 }),
  }),
  sectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 19, lineHeight: 1.3 }),
    wide: Object.freeze({ fontSize: 21, lineHeight: 1.3 }),
  }),
  subsectionTitle: Object.freeze({
    narrow: Object.freeze({ fontSize: 16, lineHeight: 1.4 }),
    wide: Object.freeze({ fontSize: 16, lineHeight: 1.4 }),
  }),
  supporting: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1.5 }),
    wide: Object.freeze({ fontSize: 13, lineHeight: 1.5 }),
  }),
});

// Stylesheets repeat the three breakpoints in `@media` rules, which cannot read
// custom properties; a test keeps those literals equal to these values.
export const ARTIFACT_LAYOUT = Object.freeze({
  compactBreakpoint: 520,
  documentWidth: 1040,
  narrowBreakpoint: 760,
  proseWidth: "70ch",
  railBreakpoint: 1100,
  railWidth: 248,
  topbarHeight: 56,
});
