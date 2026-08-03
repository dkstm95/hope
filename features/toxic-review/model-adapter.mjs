import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TOXIC_REVIEW_MODEL_ADAPTER_CODE =
  "HOPE_TOXIC_REVIEW_MODEL_ADAPTER_REQUIRED";

export const TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope toxic review needs a configured model adapter. Set HOPE_TOXIC_REVIEW_ADAPTER_MODULE to a trusted local module or use the Claude or Codex Skill.";

function missingAdapter() {
  const error = new Error(TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE);
  error.code = TOXIC_REVIEW_MODEL_ADAPTER_CODE;
  return error;
}

function invalidAdapter(message) {
  const error = new TypeError(`Hope toxic review model adapter is invalid: ${message}`);
  error.code = "HOPE_TOXIC_REVIEW_MODEL_ADAPTER_INVALID";
  return error;
}

export function validateToxicReviewModelAdapter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidAdapter("the module must export an object");
  }
  for (const method of ["plan", "review", "adjudicate"]) {
    if (typeof value[method] !== "function") {
      throw invalidAdapter(`the ${method} method is required`);
    }
  }
  const capabilities = value.capabilities;
  if (!capabilities || typeof capabilities !== "object") {
    throw invalidAdapter("capabilities are required");
  }
  for (const field of ["independentContexts", "parallel"]) {
    if (typeof capabilities[field] !== "boolean") {
      throw invalidAdapter(`capabilities.${field} must be a boolean`);
    }
  }
  return Object.freeze({
    capabilities: Object.freeze({
      independentContexts: capabilities.independentContexts,
      parallel: capabilities.parallel,
    }),
    plan: value.plan.bind(value),
    review: value.review.bind(value),
    adjudicate: value.adjudicate.bind(value),
  });
}

export async function loadToxicReviewModelAdapter({
  cwd = process.cwd(),
  environment = process.env,
  importModule = (specifier) => import(specifier),
} = {}) {
  const configured = environment.HOPE_TOXIC_REVIEW_ADAPTER_MODULE;
  if (!configured) throw missingAdapter();
  const path = isAbsolute(configured) ? configured : resolve(cwd, configured);
  let loaded;
  try {
    loaded = await importModule(pathToFileURL(path).href);
  } catch (error) {
    throw invalidAdapter(`could not load ${path}: ${error.message}`);
  }
  return validateToxicReviewModelAdapter(loaded.default ?? loaded.adapter);
}

export function requireToxicReviewModelAdapter(value) {
  if (!value) throw missingAdapter();
  return validateToxicReviewModelAdapter(value);
}
