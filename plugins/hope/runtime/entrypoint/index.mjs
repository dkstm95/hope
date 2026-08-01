// Generated from entrypoint/index.mjs. Do not edit.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isEntrypoint(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entryPath);
  } catch {
    return false;
  }
}
