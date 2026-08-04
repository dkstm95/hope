// Generated from features/write/index.mjs. Do not edit.
import { readFile } from "node:fs/promises";

export const WRITE_BRIEF_VERSION = 4;
export const WRITE_STANDARD_VERSION = 4;
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
  Object.freeze({
    expectedDecision:
      "Apply only the repair that matches the diagnosed problem: name the actor when it is hidden and helpful, use familiar wording when it stays accurate, explain a necessary unfamiliar term, make an unclear relationship explicit, or split genuinely stacked ideas at a safe meaning boundary.",
    id: "simplify-hard-sentence",
    situation:
      "A passage may make its intended reader stop or reread because it hides a helpful actor or action, uses unfamiliar wording, stacks several relationships, leaves a necessary term unexplained, or makes a reference uncertain.",
  }),
]);

const RESPONSE_BY_MODE = Object.freeze({
  draft: "Return the finished prose.\n\nUse direct sentence structure and familiar wording where they stay accurate. Keep a precise specialist term when needed, and explain it when the intended reader may not know it.\n\nMention a factual gap or deliberate exception only when it helps the person judge the result.",
  edit: "Change the requested target and lead with the completed result.\n\nRevise passages that may make the intended reader stop or reread. Apply only the repair that matches the problem: name a hidden actor when helpful, explain an unfamiliar necessary term, make an unclear relationship explicit, or split genuinely stacked ideas at a safe meaning boundary.\n\nPreserve every material meaning and ambiguity instead of silently choosing a new one.",
  review: "Do not change files.\n\nReport only material clarity, meaning, or flow problems, including passages that may make the intended reader stop or reread. Pair each problem with a concrete, conditional revision that preserves the full meaning.",
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
