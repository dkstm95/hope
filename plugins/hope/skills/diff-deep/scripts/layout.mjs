import { digest, parsePatch } from "./changes.mjs";

/** Project model-authored ranges onto the captured rows. Never rewrite source. */
export function buildLayout(snapshot, groups) {
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const parsed = new Map(snapshot.files.filter((file) => file.availability === "text")
    .map((file) => [file.id, parsePatch(file.patch).hunks]));
  const rowMaps = new Map([...parsed].map(([id, hunks]) => [id, new Map(hunks.flatMap((hunk) => hunk.rows.map((row) => [row.sourceLine, row])))]));
  const lineCounts = new Map(snapshot.files.filter((file) => file.availability === "text").map((file) => [file.id, file.patch.split("\n").length]));
  const owners = new Map(snapshot.files.map((file) => [file.id, new Map()]));
  const output = groups.map((group) => ({ ...group, parts: [], pending: false,
    fingerprint: digest(group), readable: group.parts.every((part) => files.get(part.fileId)?.availability !== "unavailable") }));
  for (const [groupIndex, group] of groups.entries()) {
    for (const [partIndex, reference] of group.parts.entries()) {
      const file = files.get(reference.fileId);
      if (!file) throw new Error("Group refers to an unknown file");
      const part = { ...reference, id: `part-${groupIndex}-${partIndex}`, file, segments: [] };
      const ownership = owners.get(file.id);
      if (file.availability !== "text") {
        if (reference.startLine !== undefined || reference.endLine !== undefined) throw new Error("Unavailable or metadata files cannot have code ranges");
        if (ownership.size) throw new Error("Group ranges overlap");
        ownership.set(0, part);
      } else {
        const rows = rowMaps.get(file.id);
        const start = reference.startLine ?? 1;
        const end = reference.endLine ?? lineCounts.get(file.id);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start
          || end > lineCounts.get(file.id)) throw new Error("Invalid group code range");
        let changed = false;
        for (let line = start; line <= end; line += 1) {
          const row = rows.get(line);
          if (!row) continue;
          if (ownership.has(line)) throw new Error("Group ranges overlap");
          ownership.set(line, part);
          if (row.kind !== "context") changed = true;
        }
        if (!changed) throw new Error("A group range must include a changed line");
      }
      output[groupIndex].parts.push(part);
    }
  }
  let pendingLines = 0;
  let pendingFiles = 0;
  for (const file of snapshot.files) {
    const ownership = owners.get(file.id);
    const pending = { id: `pending-${file.id}`, title: file.path, parts: [], pending: true, readable: false };
    const fallback = { id: `part-pending-${file.id}`, fileId: file.id, file, segments: [] };
    if (file.availability !== "text") {
      if (!ownership.has(0)) pending.parts.push(fallback);
    } else {
      for (const hunk of parsed.get(file.id)) {
        const rowOwners = hunk.rows.map((row) => {
          if (ownership.has(row.sourceLine)) return ownership.get(row.sourceLine);
          if (row.kind === "context") return null;
          pendingLines += 1;
          return fallback;
        });
        // Retain every context row once beside the nearest preceding change,
        // or the next change for leading context. Context does not add coverage.
        const firstOwner = rowOwners.findIndex(Boolean);
        for (let index = 0; index < firstOwner; index += 1) rowOwners[index] = rowOwners[firstOwner];
        let previous = fallback;
        let oldPosition = hunk.oldStart + (hunk.oldCount === 0 ? 1 : 0);
        let newPosition = hunk.newStart + (hunk.newCount === 0 ? 1 : 0);
        let segment;
        for (const [index, row] of hunk.rows.entries()) {
          const owner = rowOwners[index] ?? previous;
          if (owner !== previous || !segment) {
            segment = { oldStart: oldPosition, newStart: newPosition, context: hunk.header.slice(hunk.header.indexOf("@@", 2) + 2), rows: [] };
            owner.segments.push(segment);
          }
          segment.rows.push(row);
          if (row.kind !== "add") oldPosition += 1;
          if (row.kind !== "del") newPosition += 1;
          previous = owner;
        }
      }
      if (fallback.segments.length) pending.parts.push(fallback);
    }
    if (pending.parts.length) { output.push(pending); pendingFiles += 1; }
  }
  return { groups: output, pendingLines, pendingFiles };
}
