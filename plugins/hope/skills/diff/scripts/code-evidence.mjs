import { exposeBidiControls } from "./text.mjs";

function escapeHtml(value) {
  return exposeBidiControls(String(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function diffLineKind(content) {
  if (content.startsWith("+") && !content.startsWith("+++")) return "added";
  if (content.startsWith("-") && !content.startsWith("---")) return "removed";
  if (content.startsWith("@@")) return "hunk";
  if (content.startsWith(" ")) return "context";
  return "meta";
}

function diffCoordinates(lines) {
  let oldLine;
  let newLine;
  return lines.map((content) => {
    const hunk = content.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      return Object.freeze({ content, kind: "hunk" });
    }

    const kind = diffLineKind(content);
    if (oldLine === undefined || newLine === undefined) {
      return Object.freeze({ content, kind });
    }
    if (kind === "added") {
      const result = Object.freeze({ content, kind, newLine });
      newLine += 1;
      return result;
    }
    if (kind === "removed") {
      const result = Object.freeze({ content, kind, oldLine });
      oldLine += 1;
      return result;
    }
    if (kind === "context") {
      const result = Object.freeze({ content, kind, newLine, oldLine });
      newLine += 1;
      oldLine += 1;
      return result;
    }
    return Object.freeze({ content, kind });
  });
}

function sourceLine(content) {
  return "<span class=\"code-line\"><span class=\"code-content\">"
    + `${escapeHtml(content)}</span></span>`;
}

export function renderCodeEvidence(evidence) {
  const excerpt = String(evidence.excerpt ?? "");
  if (evidence.sourceKind !== "patch") {
    return excerpt.split("\n").map(sourceLine).join("\n");
  }

  return diffCoordinates(excerpt.split("\n")).map((line) => {
    const codeLine = ["added", "removed", "context"].includes(line.kind);
    const prefix = codeLine ? line.content.slice(0, 1) : "";
    const content = codeLine ? line.content.slice(1) : line.content;
    const coordinates = line.oldLine === undefined && line.newLine === undefined
      ? ""
      : ` data-old-line="${line.oldLine ?? ""}" data-new-line="${line.newLine ?? ""}"`;
    const coordinateClass = coordinates ? "" : " code-line-unlocated";
    const prefixHtml = prefix
      ? `<span class="code-prefix">${escapeHtml(prefix)}</span>`
      : "";
    return `<span class="code-line code-line-patch code-line-${line.kind}${coordinateClass}"${coordinates}>`
      + `<span class="code-content">${prefixHtml}${escapeHtml(content)}</span></span>`;
  }).join("\n");
}
