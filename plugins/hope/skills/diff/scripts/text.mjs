import { exposeBidiControls } from "../../../assets/artifact-shell/text.mjs";
import { LIMITS } from "./constants.mjs";

export { exposeBidiControls };

export function containsBidiControl(value) {
  return /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(String(value ?? ""));
}

export function cleanText(value) {
  return exposeBidiControls(String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "\uFFFD"));
}

export function unavailableReason(kind, detail) {
  return {
    "credential-pattern": "The file body matched a high-confidence credential pattern",
    "invalid-text": "The body is not UTF-8 text",
    "no-text-diff": "No text diff was reported for this changed file",
    "private-path": "The file name commonly contains private configuration",
    "safe-size-limit": `The file exceeds Hope's ${LIMITS.safeBodyBytes}-byte safe-text limit`,
    "special-entry": `The source reported a ${String(detail ?? "special")} entry`,
  }[kind];
}
