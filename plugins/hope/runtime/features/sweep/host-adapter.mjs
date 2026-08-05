// Generated from features/sweep/host-adapter.mjs. Do not edit.
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SWEEP_HOST_ADAPTER_CODE = "HOPE_SWEEP_HOST_ADAPTER_REQUIRED";
export const SWEEP_HOST_ADAPTER_MESSAGE =
  "Sweep subagent-hybrid needs a trusted host adapter. Set HOPE_SWEEP_HOST_ADAPTER_MODULE to a local module or use the active-session path.";

function missingAdapter() {
  const error = new Error(SWEEP_HOST_ADAPTER_MESSAGE);
  error.code = SWEEP_HOST_ADAPTER_CODE;
  return error;
}

function invalidAdapter(message) {
  const error = new TypeError(`Hope sweep host adapter is invalid: ${message}`);
  error.code = "HOPE_SWEEP_HOST_ADAPTER_INVALID";
  return error;
}

export function validateSweepHostAdapter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidAdapter("the module must export an object");
  }
  const capabilities = value.capabilities;
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    throw invalidAdapter("capabilities are required");
  }
  for (const field of ["independentContexts", "readOnly", "sourceAllowlist", "boundedOutput"]) {
    if (capabilities[field] !== true) {
      throw invalidAdapter(`capabilities.${field} must be true`);
    }
  }
  if (typeof value.activeSessionAvailable !== "boolean") {
    throw invalidAdapter("activeSessionAvailable must be a boolean");
  }
  if (typeof value.verifyCapabilities !== "function") {
    throw invalidAdapter("verifyCapabilities is required");
  }
  if (typeof value.verifyInvocation !== "function") {
    throw invalidAdapter("verifyInvocation is required");
  }
  return Object.freeze({
    activeSessionAvailable: value.activeSessionAvailable,
    verifyBatchCapabilities: value.verifyCapabilities.bind(value),
    verifyBatchInvocation: value.verifyInvocation.bind(value),
  });
}

export async function loadSweepHostAdapter({
  cwd = process.cwd(),
  environment = process.env,
  importModule = (specifier) => import(specifier),
} = {}) {
  const configured = environment.HOPE_SWEEP_HOST_ADAPTER_MODULE;
  if (!configured) throw missingAdapter();
  const path = isAbsolute(configured) ? configured : resolve(cwd, configured);
  let loaded;
  try {
    loaded = await importModule(pathToFileURL(path).href);
  } catch (error) {
    throw invalidAdapter(`could not load ${path}: ${error.message}`);
  }
  return validateSweepHostAdapter(loaded.default ?? loaded.adapter);
}

export function requireSweepHostAdapter(value) {
  if (!value) throw missingAdapter();
  return validateSweepHostAdapter(value);
}
