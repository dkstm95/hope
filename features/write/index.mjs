import { readFile } from "node:fs/promises";

export const WRITE_BRIEF_VERSION = 2;
export const WRITE_STANDARD_VERSION = 2;
export const WRITE_MODEL_ADAPTER_CODE = "HOPE_WRITE_MODEL_ADAPTER_REQUIRED";
export const WRITE_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope writing currently runs through the Claude or Codex skill.";
export const WRITE_MODES = Object.freeze(["draft", "edit", "review"]);

export const WRITE_DECISION_EXAMPLES = Object.freeze([
  Object.freeze({
    expectedDecision: "Put each independent point in its own paragraph.",
    id: "separate-independent-points",
    situation:
      "A prose paragraph contains two independent points, and the target format supports separate paragraphs.",
  }),
  Object.freeze({
    expectedDecision:
      "Consolidate the repeated framing, keep the version that best serves the target, and preserve standalone comprehension.",
    id: "remove-repeated-framing",
    situation:
      "The intended reading path always presents a heading, quote, and opening sentence together; they repeat the same problem and add no distinct meaning or voice.",
  }),
  Object.freeze({
    expectedDecision:
      "Use the least disruptive established semantic structure, and use a callout only when that convention supports one.",
    id: "surface-important-boundary",
    situation:
      "A prerequisite or limitation must be noticed, and the target or project already has an established semantic emphasis convention.",
  }),
  Object.freeze({
    expectedDecision:
      "Keep the claim or surface the choice instead of silently removing it.",
    id: "preserve-material-claim",
    situation:
      "An edit would delete, demote, or reorder a unique product claim, and the request does not explicitly authorize that content change.",
  }),
]);

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

export async function createWritingStandard({
  loadStandard = loadWritingStandard,
} = {}) {
  return Object.freeze({
    decisionExamples: WRITE_DECISION_EXAMPLES,
    text: await loadStandard(),
    version: WRITE_STANDARD_VERSION,
  });
}

export async function createWritingBrief({ mode }, {
  createStandard = createWritingStandard,
  loadStandard = loadWritingStandard,
} = {}) {
  assertMode(mode);
  const writingStandard = await createStandard({ loadStandard });
  return Object.freeze({
    decisionExamples: writingStandard.decisionExamples,
    feature: "write",
    mode,
    response: RESPONSE_BY_MODE[mode],
    standard: writingStandard.text,
    standardVersion: writingStandard.version,
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
