import { readFile } from "node:fs/promises";

export const WRITE_BRIEF_VERSION = 1;
export const WRITE_MODEL_ADAPTER_CODE = "HOPE_WRITE_MODEL_ADAPTER_REQUIRED";
export const WRITE_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope writing currently runs through the Claude or Codex skill.";
export const WRITE_MODES = Object.freeze(["draft", "edit", "review"]);

const RESPONSE_BY_MODE = Object.freeze({
  draft: "Return the finished prose.\n\nMention a factual gap or deliberate exception only when it helps the person judge the result.",
  edit: "Change the requested target and lead with the completed result.\n\nPreserve a material ambiguity instead of silently choosing a new meaning.",
  review: "Do not change files.\n\nReport only material clarity, meaning, or flow problems, and pair each problem with a concrete revision.",
});

function assertMode(mode) {
  if (!WRITE_MODES.includes(mode)) {
    throw new TypeError(`Unknown Hope write mode: ${mode}`);
  }
}

export async function loadWritingStandard({
  read = readFile,
  standardUrl = new URL("./standard.md", import.meta.url),
} = {}) {
  const value = String(await read(standardUrl, "utf8"))
    .replace(/\r\n?/gu, "\n")
    .trim();
  if (!value) throw new Error("Hope writing standard is empty");
  return `${value}\n`;
}

export async function createWritingBrief({ mode }, {
  loadStandard = loadWritingStandard,
} = {}) {
  assertMode(mode);
  return Object.freeze({
    feature: "write",
    mode,
    response: RESPONSE_BY_MODE[mode],
    standard: await loadStandard(),
    version: WRITE_BRIEF_VERSION,
  });
}

export async function createTaskWritingPass({
  createBrief = createWritingBrief,
} = {}) {
  const [input, response] = await Promise.all([
    createBrief({ mode: "edit" }),
    createBrief({ mode: "draft" }),
  ]);
  return Object.freeze({
    input,
    response,
  });
}

export function runWrite() {
  const error = new Error(WRITE_MODEL_ADAPTER_MESSAGE);
  error.code = WRITE_MODEL_ADAPTER_CODE;
  throw error;
}
