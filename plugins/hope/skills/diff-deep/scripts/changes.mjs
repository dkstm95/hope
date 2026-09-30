import { createHash } from "node:crypto";

export const digest = (value) => createHash("sha256").update(
  typeof value === "string" ? value : JSON.stringify(value),
).digest("hex");

export const LIMITS = Object.freeze({
  files: 500,
  lines: 20_000,
  fileBytes: 256 * 1024,
  totalBytes: 1024 * 1024,
  sourceBytes: 64 * 1024,
  snapshotBytes: 8 * 1024 * 1024,
  artifactBytes: 24 * 1024 * 1024,
  inputBytes: 512 * 1024,
});

export function text(value, name, maximum = 4_000) {
  if (typeof value !== "string" || value.length > maximum || !value.trim()) {
    throw new TypeError(`${name} must be nonempty text of at most ${maximum} characters`);
  }
  if (!value.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${name} contains invalid text`);
  }
  return value;
}

export function safePath(value) {
  text(value, "file path", 4_096);
  if (/[\r\n\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    throw new TypeError("A file path contains display control characters");
  }
  return value;
}

export function exposeControls(value) {
  return String(value).replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,
    (character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function restriction(path, bodies = []) {
  const name = path.split("/").at(-1).toLowerCase();
  if (
    /^(?:\.env(?:\.|$)|(?:credentials|secrets?)(?:\.|$)|(?:id_|ssh_host_).*(?:rsa|dsa|ecdsa|ed25519))/u.test(name)
    && !/(?:example|sample|template)/u.test(name)
  ) return "private-file";
  if (bodies.some((body) => (
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u.test(body)
  ))) return "credential";
  return undefined;
}

function natural(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Parse a file's unified patch, including content beginning with +++ or ---. */
export function parsePatch(patch, expected) {
  if (typeof patch !== "string" || !patch.isWellFormed()) throw new TypeError("Invalid patch text");
  if (Buffer.byteLength(patch) > LIMITS.fileBytes) throw new Error("Patch exceeds the per-file limit");
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

/** Runtime owns the change inventory; explanations never decide which lines exist. */
export function indexChanges(files) {
  const changes = [];
  const indexed = files.map((file) => {
    const id = `f-${digest([file.path, file.previousPath ?? ""]).slice(0, 20)}`;
    if (file.availability !== "text") {
      const changeId = `c-${digest([id, file.status, file.reason]).slice(0, 20)}`;
      changes.push({ id: changeId, fileId: id, kind: file.availability, lineIds: [] });
      return { ...file, id, hunks: [], changeIds: [changeId] };
    }
    const parsed = parsePatch(file.patch, file);
    const changeIds = [];
    const hunks = parsed.hunks.map((hunk, hunkIndex) => {
      let active;
      const rows = hunk.rows.map((row, rowIndex) => {
        if (row.kind === "context") { active = undefined; return row; }
        const lineId = `l-${digest([id, row.kind, row.oldLine, row.newLine, row.text]).slice(0, 24)}`;
        if (!active) {
          active = {
            id: `c-${digest([id, hunkIndex, rowIndex, file.patch]).slice(0, 20)}`,
            fileId: id, kind: "text", hunkIndex, startRow: rowIndex, endRow: rowIndex, lineIds: [],
          };
          changes.push(active);
          changeIds.push(active.id);
        }
        active.endRow = rowIndex;
        active.lineIds.push(lineId);
        return { ...row, id: lineId, changeId: active.id };
      });
      return { ...hunk, rows };
    });
    // A complete empty patch still represents a file-level change (e.g. rename).
    if (changeIds.length === 0) {
      const changeId = `c-${digest([id, file.status]).slice(0, 20)}`;
      changes.push({ id: changeId, fileId: id, kind: "metadata", lineIds: [] });
      changeIds.push(changeId);
    }
    return { ...file, id, hunks, changeIds };
  });
  if (new Set(indexed.map((file) => file.id)).size !== indexed.length) {
    throw new Error("Changed files contain duplicate identities");
  }
  return { files: indexed, changes };
}
