import {
  ARTIFACT_COLORS,
  ARTIFACT_LAYOUT,
  ARTIFACT_SPACE,
  ARTIFACT_TYPE,
} from "../../../../assets/artifact-theme.mjs";

export const DESIGN_VERSION = 29;

// Status roles keep 4.5:1 text contrast on the shared surfaces in both themes.
export const COLORS = Object.freeze({
  dark: Object.freeze({
    ...ARTIFACT_COLORS.dark,
    decide: "#ffb65c",
    resolve: "#ff8a92",
    scope: "#a8b5c1",
    verify: "#86bcf6",
  }),
  light: Object.freeze({
    ...ARTIFACT_COLORS.light,
    decide: "#8a4b00",
    resolve: "#b4232c",
    scope: "#4f6474",
    verify: "#145da0",
  }),
});

export const CODE_THEME = Object.freeze({
  dark: Object.freeze({
    addedBackground: "#10291f",
    addedMark: "#4fc98f",
    background: "#0b1013",
    foreground: "#e3ebe8",
    hunkBackground: "#13222f",
    removedBackground: "#331a1d",
    removedMark: "#ff8a92",
  }),
  light: Object.freeze({
    addedBackground: "#e3f7e8",
    addedMark: "#1a7f37",
    background: "#ffffff",
    foreground: "#1b2124",
    hunkBackground: "#e8f3fb",
    removedBackground: "#fdecea",
    removedMark: "#b4232c",
  }),
  name: "hope",
});

export const SPACE = ARTIFACT_SPACE;
export const TYPE = ARTIFACT_TYPE;
export const LAYOUT = ARTIFACT_LAYOUT;
