import {
  ARTIFACT_COLORS,
  ARTIFACT_LAYOUT,
  ARTIFACT_SPACE,
  ARTIFACT_TYPE,
} from "../../../../assets/artifact-theme.mjs";

export const DESIGN_VERSION = 24;

export const COLORS = Object.freeze({
  dark: Object.freeze({
    ...ARTIFACT_COLORS.dark,
    decide: "#ffb65c",
    resolve: "#ff7b85",
    scope: "#a8b5c1",
    verify: "#82b8f4",
  }),
  light: Object.freeze({
    ...ARTIFACT_COLORS.light,
    decide: "#8a4d00",
    resolve: "#b4232c",
    scope: "#536878",
    verify: "#145da0",
  }),
});

export const CODE_THEME = Object.freeze({
  dark: Object.freeze({
    addedBackground: "#102820",
    background: "#0a0d0e",
    foreground: "#e6ece9",
    hunkBackground: "#102234",
    removedBackground: "#32171b",
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

export const SPACE = ARTIFACT_SPACE;

export const TYPE = Object.freeze({
  ...ARTIFACT_TYPE,
  code: Object.freeze({
    narrow: Object.freeze({ fontSize: 13, lineHeight: 1.35 }),
    wide: Object.freeze({ fontSize: 12, lineHeight: 1.35 }),
  }),
});

export const LAYOUT = Object.freeze({
  ...ARTIFACT_LAYOUT,
  tightProductBarBreakpoint: 340,
});
