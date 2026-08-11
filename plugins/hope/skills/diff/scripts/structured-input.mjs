// Diff owns this bounded reader for private structured input.
import { lstat, open } from "node:fs/promises";

const STRUCTURE_LIMITS = Object.freeze({
  depth: 128,
  nodes: 65_536,
});

function inspectStructuredValue(value, {
  maximumDepth = STRUCTURE_LIMITS.depth,
  maximumNodes = STRUCTURE_LIMITS.nodes,
} = {}) {
  let nodes = 0;
  const stack = [{ depth: 0, item: value }];
  while (stack.length > 0) {
    const { depth, item } = stack.pop();
    nodes += 1;
    if (nodes > maximumNodes) {
      throw new TypeError(
        `Hope structured input exceeds ${maximumNodes} values`,
      );
    }
    if (depth > maximumDepth) {
      throw new TypeError(
        `Hope structured input exceeds ${maximumDepth} nesting levels`,
      );
    }
    if (!item || typeof item !== "object") continue;
    const entries = Array.isArray(item) ? item : Object.values(item);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, item: entries[index] });
    }
  }
}

export async function readBoundedJson(path, {
  label = "Hope structured input",
  maximumBytes = 128 * 1024,
} = {}) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
  if (info.size > maximumBytes) {
    throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== info.dev
      || opened.ino !== info.ino
      || opened.size !== info.size
    ) {
      throw new Error(`${label} changed while being opened`);
    }
    const bytes = await handle.readFile();
    const completed = await handle.stat();
    if (
      !completed.isFile()
      || completed.dev !== opened.dev
      || completed.ino !== opened.ino
      || completed.size !== opened.size
      || completed.mtimeMs !== opened.mtimeMs
      || completed.ctimeMs !== opened.ctimeMs
      || bytes.length !== completed.size
    ) {
      throw new Error(`${label} changed while being read`);
    }
    if (bytes.length > maximumBytes) {
      throw new Error(`${label} exceeds ${maximumBytes} bytes`);
    }
    try {
      const value = JSON.parse(bytes.toString("utf8"));
      inspectStructuredValue(value);
      return Object.freeze({
        fileBytes: bytes.length,
        value,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${label} is not valid JSON`, { cause: error });
      }
      throw error;
    }
  } finally {
    await handle.close();
  }
}
