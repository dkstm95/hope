import { LIMITS } from "./constants.mjs";

function natural(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Parse a file's unified patch, including content beginning with +++ or ---. */
export function parsePatch(patch, expected) {
  if (typeof patch !== "string" || !patch.isWellFormed()) throw new TypeError("Invalid patch text");
  if (Buffer.byteLength(patch) > LIMITS.safePatchBytes) throw new Error("Patch exceeds the per-file limit");
  const lines = patch.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const hunks = [];
  let current;
  let oldLine = 0;
  let newLine = 0;
  let additions = 0;
  let deletions = 0;
  const finish = () => {
    if (current && (oldLine !== current.oldStart + current.oldCount
      || newLine !== current.newStart + current.newCount)) {
      throw new Error("Patch hunk is incomplete or has invalid line counts");
    }
  };
  for (const [index, line] of lines.entries()) {
    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/u);
    if (header) {
      finish();
      const [oldStart, oldCount, newStart, newCount] = [
        Number(header[1]), Number(header[2] ?? 1), Number(header[3]), Number(header[4] ?? 1),
      ];
      if (![oldStart, oldCount, newStart, newCount].every(natural)
        || !natural(oldStart + oldCount) || !natural(newStart + newCount)
        || (oldCount > 0 && oldStart === 0) || (newCount > 0 && newStart === 0)) {
        throw new Error("Invalid patch coordinates");
      }
      if (hunks.length > 0) {
        const previous = hunks.at(-1);
        if (oldStart < previous.oldStart + previous.oldCount
          || newStart < previous.newStart + previous.newCount) {
          throw new Error("Patch hunks overlap or are out of order");
        }
      }
      current = { header: line, oldStart, oldCount, newStart, newCount, rows: [] };
      hunks.push(current);
      oldLine = oldStart;
      newLine = newStart;
      continue;
    }
    if (!current) throw new Error("Patch must begin with a hunk header");
    if (line === "\\ No newline at end of file") {
      const last = current.rows.at(-1);
      if (!last || last.noNewline) throw new Error("Unexpected end-of-file marker");
      last.noNewline = true;
      continue;
    }
    const kind = { "+": "add", "-": "del", " ": "context" }[line[0]];
    if (!kind) throw new Error("Patch contains an invalid line prefix");
    const row = { kind, text: line.slice(1), sourceLine: index + 1 };
    if (kind !== "add") row.oldLine = oldLine++;
    if (kind !== "del") row.newLine = newLine++;
    if (kind === "add") additions += 1;
    if (kind === "del") deletions += 1;
    current.rows.push(row);
    if (current.rows.length > LIMITS.lines * 4) throw new Error("Patch has too many context lines");
  }
  finish();
  if (expected && (additions !== expected.additions || deletions !== expected.deletions)) {
    throw new Error("Patch does not account for every reported changed line");
  }
  return { hunks, additions, deletions };
}

