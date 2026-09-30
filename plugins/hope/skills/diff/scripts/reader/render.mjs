import { readFile } from "node:fs/promises";
import { ARTIFACT_COLORS } from "../../../../assets/artifact-theme.mjs";
import { exposeBidiControls } from "../text.mjs";
import { dictionary } from "./locales.mjs";
import { mount } from "./client.mjs";

const html = (value) => exposeBidiControls(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;").replaceAll("\t", "&#9;");
const json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

// Fixed, feature-owned UI marks. No authored markup enters an icon or script.
const marks = {
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${marks[name]}</svg>`;
}

function button(id, mark, label, attributes = "") {
  return `<button type="button" class="icon-button" ${id ? `id="${id}"` : ""} aria-label="${html(label)}" data-tip="${html(label)}" ${attributes}>${icon(mark)}</button>`;
}

function evidenceHtml(explanation, review, labels) {
  if (!explanation.evidence.length) return "";
  return `<details class="evidence"><summary>${icon("link")}<span>${html(labels.source)}</span>${icon("right")}</summary>${explanation.evidence.map((reference) => {
    const code = reference.sourceKind === "patch";
    const repository = reference.revision === review.snapshot.snapshot.mergeBase
      ? review.snapshot.repository.base : review.snapshot.repository.head;
    const owner = repository?.owner ?? review.snapshot.repository.owner;
    const name = repository?.name ?? review.snapshot.repository.name;
    const url = reference.path && reference.revision
      ? `https://github.com/${owner}/${name}/blob/${reference.revision}/${reference.path.split("/").map(encodeURIComponent).join("/")}`
      : review.snapshot.pullRequest.url;
    return `<div class="evidence-entry" data-source="${html(reference.fileId ?? reference.sourceId)}" data-start="${reference.startLine}" data-end="${reference.endLine}">${code ? `<button type="button" class="source-jump js-control" data-reference-file="${html(reference.fileId)}" data-reference-line="${reference.startLine}">${html(labels.showCode)}</button>` : ""}<a href="${html(url)}" rel="noreferrer">${html(reference.path ?? reference.sourceKind)} · ${code ? "diff " : ""}L${reference.startLine}–${reference.endLine}</a><pre dir="auto">${html(reference.excerpt)}</pre></div>`;
  }).join("")}</details>`;
}

function explanationHtml(explanation, sources, labels) {
  return `<div class="reason-copy"><h3>${html(explanation.title)}</h3>${explanation.text.split(/\n\s*\n/u).map((paragraph) => `<p>${html(paragraph)}</p>`).join("")}
    <span class="basis" data-basis="${explanation.basis}">${html(labels[explanation.basis])}</span></div>${evidenceHtml(explanation, sources, labels)}`;
}

function codeRow(row, labels) {
  const location = `${labels[row.kind === "add" ? "added" : row.kind === "del" ? "removed" : "context"]} ${row.oldLine === undefined ? "" : `${labels.before} L${row.oldLine}`} ${row.newLine === undefined ? "" : `${labels.after} L${row.newLine}`}`;
  return `<span class="code-row ${row.kind}" data-source-line="${row.sourceLine}"><span class="sr-only">${html(location)}: </span><span class="line-number" aria-hidden="true">${row.oldLine ?? ""}</span><span class="line-number" aria-hidden="true">${row.newLine ?? ""}</span><span class="line-sign" aria-hidden="true">${{ add: "+", del: "−", context: " " }[row.kind]}</span><code dir="ltr">${html(row.text)}</code></span>${row.noNewline ? `<span class="newline-note">\\ ${html(labels.noNewline)}</span>` : ""}\n`;
}

/** Render the already validated/projected reader; do not parse or copy patches again. */
export async function renderReader(review) {
  const { snapshot, layout } = review.reader;
  const labels = dictionary(review.snapshot.settings.locale);
  const sources = review;
  const unavailable = snapshot.files.filter((file) => file.availability === "unavailable");
  const colors = Object.entries(ARTIFACT_COLORS.light).map(([name, light]) => (
    `--hope-${name}:light-dark(${light},${ARTIFACT_COLORS.dark[name]});`
  )).join("");
  const styles = `.diff-reader{${colors}}\n${await readFile(new URL("./style.css", import.meta.url), "utf8")}`;
  const script = `(${mount.toString()})();`;
  const firstPart = new Map();
  const groups = layout.groups.map((group, index) => {
    const note = `<details class="inline-reason" id="reason-${group.id}"><summary>${html(labels.reason)}</summary>${explanationHtml(group, sources, labels)}</details>`;
    const parts = group.parts.map((part) => {
      const { file } = part;
      if (!firstPart.has(file.id)) firstPart.set(file.id, part.id);
      const rows = part.segments.flatMap((segment) => segment.rows);
      const counts = file.availability !== "text" ? { add: file.additions, del: file.deletions } : { add: rows.filter((row) => row.kind === "add").length, del: rows.filter((row) => row.kind === "del").length };
      const code = file.availability === "text" ? part.segments.map((segment) => {
        const oldCount = segment.rows.filter((row) => row.kind !== "add").length;
        const newCount = segment.rows.filter((row) => row.kind !== "del").length;
        const header = `@@ -${segment.oldStart - (oldCount === 0 ? 1 : 0)},${oldCount} +${segment.newStart - (newCount === 0 ? 1 : 0)},${newCount} @@${segment.context}`;
        return `<div class="hunk"><div class="hunk-header"><code>${html(header)}</code></div>${segment.rows.map((row) => codeRow(row, labels)).join("")}</div>`;
      }).join("") : `<p class="file-limit">${html(labels.reasons[file.reason])}</p>`;
      return `<section class="file diff-part" id="${part.id}" data-file="${file.id}" data-group="${group.id}" data-first-line="${rows[0]?.sourceLine ?? 0}"><div class="file-heading"><h3><button type="button" class="part-select" aria-controls="reason-panel" dir="auto">${file.previousPath ? `<span class="previous-path">${html(file.previousPath)} → </span>` : ""}${html(file.path)}</button></h3><span class="file-count">+${counts.add} −${counts.del}</span></div>${code}${part.note ? `<p class="part-note">${html(part.note)}</p>` : ""}</section>`;
    }).join("\n");
    return `<section class="change-group" id="${group.id}" data-fingerprint="${group.fingerprint ?? ""}" data-readable="${group.readable}"><details class="group-disclosure"><summary class="group-heading group-select"><span class="group-chevron">${icon("right")}</span><span class="group-number">${String(index + 1).padStart(2, "0")}</span><span class="group-title">${html(group.title)}</span><span class="group-read" aria-hidden="true"></span></summary><div class="group-content">${parts}${note}</div></details></section>`;
  }).join("\n");
  const total = snapshot.files.reduce((sum, file) => ({ add: sum.add + file.additions, del: sum.del + file.deletions }), { add: 0, del: 0 });
  // Only browser state identity and paths are serialized. Code and reasons already exist in the DOM.
  const state = { snapshot: { id: snapshot.id, head: snapshot.head, files: snapshot.files.map(({ id, path }) => ({ id, path })) } };
  const content = `<div class="diff-reader" id="diff-reader"><div class="workspace"><section class="changes" id="reader-changes" aria-label="${html(labels.changes)}"><div class="changes-toolbar"><details class="file-index"><summary>${layout.groups.length} ${html(labels.groups)} · ${snapshot.files.length} ${html(labels.files)}</summary><nav aria-label="${html(labels.groupJump)}">${layout.groups.map((group) => `<a href="#${group.id}" dir="auto">${html(group.title)}</a>`).join("")}</nav></details><span class="file-count">+${total.add} −${total.del}</span></div>${unavailable.length ? `<details class="limits"><summary>${unavailable.length} ${html(labels.limited)}</summary><ul>${unavailable.map((file) => `<li><a href="#${firstPart.get(file.id)}" dir="auto">${html(file.path)}</a> — ${html(labels.reasons[file.reason])}</li>`).join("")}</ul></details>` : ""}<p class="code-navigation-help js-control" id="reader-code-help">${html(labels.codeKeys)}</p>${groups || `<p>${html(labels.empty)}</p>`}</section>
<aside class="reason-aside js-control" aria-label="${html(labels.reason)}"><div class="reason-panel" id="reason-panel"><div class="panel-toolbar"><div class="navigation">${button("previous-group", "left", labels.previous)}<span id="position"></span>${button("next-group", "right", labels.next)}</div>${button("read-group", "check", labels.reviewed, 'aria-pressed="false"')}</div><div id="selected-reason"></div><div class="request-actions">${button("copy-request", "copy", labels.request)}<span id="request-feedback" role="status" aria-live="polite"></span></div><textarea id="request-text" readonly hidden aria-label="${html(labels.request)}"></textarea></div><div class="progress-bar"><span id="read-progress" role="status" aria-live="polite"></span><div class="progress-actions">${button("export-progress", "download", labels.export)}${button("import-progress", "upload", labels.import)}<input type="file" id="progress-file" accept="application/json,.json" hidden></div></div><p id="storage-warning" class="status-note" role="status"></p></aside></div>
<p class="reader-storage-note">${html(labels.readOnly)} ${html(labels.restored)}</p>
<script id="diff-reader-document" type="application/json">${json(state)}</script><script id="diff-reader-view" type="application/json">${json({ labels, artifactPath: "" })}</script></div>`;
  return { content, styles, script };
}
