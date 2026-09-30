import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { ARTIFACT_COLORS } from "../../../assets/artifact-theme.mjs";
import { exposeControls, LIMITS } from "./changes.mjs";
import { mount } from "./client.mjs";
import { buildLayout } from "./layout.mjs";
import { dictionary } from "./locales.mjs";
import { evidenceSources } from "./model.mjs";

const html = (value) => exposeControls(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

// Fixed, feature-owned UI marks. No authored markup enters an icon or script.
const marks = {
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M19 9a7 7 0 0 0-12-3L4 9m1 6a7 7 0 0 0 12 3l3-3"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${marks[name]}</svg>`;
}

function button(id, mark, label, attributes = "") {
  return `<button type="button" class="icon-button" ${id ? `id="${id}"` : ""} aria-label="${html(label)}" data-tip="${html(label)}" ${attributes}>${icon(mark)}</button>`;
}

function evidenceHtml(explanation, sources, labels, budget) {
  if (explanation.evidence.length === 0) return "";
  return `<details class="evidence"><summary>${icon("link")}<span>${html(labels.source)}</span>${icon("right")}</summary>${explanation.evidence.map((reference) => {
    const source = sources.get(reference.sourceId);
    const excerpt = html(source.lines.slice(reference.startLine - 1, reference.endLine).join("\n"));
    budget.bytes += Buffer.byteLength(excerpt);
    if (budget.bytes > LIMITS.artifactBytes) throw new Error("Rendered evidence exceeds the artifact size limit");
    return `<div class="evidence-entry" data-source="${html(reference.sourceId)}" data-start="${reference.startLine}" data-end="${reference.endLine}">${source.kind === "code" ? `<button type="button" class="source-jump js-control" data-reference-file="${source.id}" data-reference-line="${reference.startLine}">${html(labels.showCode)}</button>` : ""}<a href="${html(source.url)}" rel="noreferrer">${html(source.label)} · ${source.kind === "code" ? "diff " : ""}L${reference.startLine}–${reference.endLine}</a><pre dir="auto">${excerpt}</pre></div>`;
  }).join("")}</details>`;
}

function explanationHtml(explanation, sources, labels, budget) {
  if (!explanation) return `<div class="reason-copy"><h3>${html(labels.pendingTitle)}</h3><p>${html(labels.pendingBody)}</p></div>`;
  return `<div class="reason-copy"><h3>${html(explanation.title)}</h3><p>${html(explanation.why)}</p>
    <span class="basis" data-basis="${explanation.basis}">${html(labels[explanation.basis])}</span></div>${evidenceHtml(explanation, sources, labels, budget)}`;
}

function codeRow(row, labels) {
  const location = `${labels[row.kind === "add" ? "added" : row.kind === "del" ? "removed" : "context"]} ${row.oldLine === undefined ? "" : `${labels.before} L${row.oldLine}`} ${row.newLine === undefined ? "" : `${labels.after} L${row.newLine}`}`;
  return `<span class="code-row ${row.kind}" data-source-line="${row.sourceLine}"><span class="sr-only">${html(location)}: </span><span class="line-number" aria-hidden="true">${row.oldLine ?? ""}</span><span class="line-number" aria-hidden="true">${row.newLine ?? ""}</span><span class="line-sign" aria-hidden="true">${{ add: "+", del: "−", context: " " }[row.kind]}</span><code dir="ltr">${html(row.text)}</code></span>${row.noNewline ? `<span class="newline-note">\\ ${html(labels.noNewline)}</span>` : ""}\n`;
}

/** Render a validated document supplied by the artifact boundary. */
export async function renderArtifact(input, { artifactPath = "", digest: seal = "0".repeat(64) } = {}) {
  const document = input;
  const { snapshot } = document;
  const labels = dictionary(document.locale);
  const sources = new Map([...evidenceSources(snapshot)].map(([id, source]) => [id, { ...source, lines: source.text.split("\n") }]));
  const evidenceBudget = { bytes: 0 };
  const layout = buildLayout(snapshot, document.groups);
  const unavailable = snapshot.files.filter((file) => file.availability === "unavailable");
  const colors = Object.entries(ARTIFACT_COLORS.light).map(([name, light]) => (
    `--hope-${name}:light-dark(${light},${ARTIFACT_COLORS.dark[name]});`
  )).join("");
  const css = `:root{${colors}}\n${await readFile(new URL("./style.css", import.meta.url), "utf8")}`;
  const script = `(${mount.toString()})();`;
  const scriptHash = createHash("sha256").update(script).digest("base64");
  const title = `diff-deep · ${snapshot.target.owner}/${snapshot.target.repo} #${snapshot.target.number}`;
  const firstPart = new Map();
  const groups = layout.groups.map((group, index) => {
    const note = `<details class="inline-reason" id="reason-${group.id}"><summary>${html(labels.reason)}</summary>${explanationHtml(group.pending ? null : group, sources, labels, evidenceBudget)}</details>`;
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
    return `<section class="change-group${group.pending ? " pending-group" : ""}" id="${group.id}" data-fingerprint="${group.fingerprint ?? ""}" data-readable="${group.readable}"><div class="group-heading"><span class="group-number">${String(index + 1).padStart(2, "0")}</span><h2><button type="button" class="group-select" aria-controls="reason-panel" aria-pressed="false">${group.pending ? `${html(labels.ungrouped)} · ` : ""}${html(group.title)}</button></h2><span class="group-read" aria-hidden="true"></span></div>${parts}${note}</section>`;
  }).join("\n");
  const total = snapshot.files.reduce((sum, file) => ({ add: sum.add + file.additions, del: sum.del + file.deletions }), { add: 0, del: 0 });
  const output = `<!doctype html>
<html lang="${document.locale}" dir="ltr" data-theme="${document.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="hope-diff-deep-digest" content="${seal}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; object-src 'none'; connect-src 'none'"><title>${html(title)}</title><style>${css}</style></head>
<body><a class="skip-link" href="#changes">${html(labels.skip)}</a><header class="topbar"><div class="identity"><h1>diff<span>-deep</span></h1><a href="${html(snapshot.target.url)}" rel="noreferrer" class="pr-link">${html(snapshot.target.owner)}/${html(snapshot.target.repo)} · #${snapshot.target.number}</a></div><div class="top-actions"><details class="capture-info"><summary aria-label="${html(labels.scope)}" data-tip="${html(labels.scope)}">${icon("info")}</summary><div class="capture-content"><p dir="auto">${html(snapshot.title)}</p><dl><dt>${html(labels.head)}</dt><dd>${snapshot.head}</dd><dt>${html(labels.mergeBase)}</dt><dd>${snapshot.mergeBase}</dd><dt>${html(labels.base)}</dt><dd>${snapshot.base}</dd><dt>${html(labels.captured)}</dt><dd>${html(snapshot.capturedAt)}</dd><dt>${html(labels.revision)}</dt><dd>${document.revision}</dd></dl><p>${html(labels.readOnly)}</p><p id="storage-description">${html(labels.restored)}</p></div></details><div class="themes js-control" role="group" aria-label="${html(labels.theme)}">${["light", "dark", "system"].map((theme) => button("", { light: "sun", dark: "moon", system: "monitor" }[theme], labels[theme], `data-theme-choice="${theme}" aria-pressed="${document.theme === theme}"`)).join("")}</div></div></header>
<main class="workspace"><section class="changes" id="changes" aria-label="${html(labels.changes)}"><div class="changes-toolbar"><details class="file-index"><summary>${layout.groups.length} ${html(labels.groups)} · ${snapshot.files.length} ${html(labels.files)}</summary><nav aria-label="${html(labels.groupJump)}">${layout.groups.map((group) => `<a href="#${group.id}" dir="auto">${html(group.title)}</a>`).join("")}</nav></details><span class="file-count">+${total.add} −${total.del}</span></div>${unavailable.length ? `<details class="limits"><summary>${unavailable.length} ${html(labels.limited)}</summary><ul>${unavailable.map((file) => `<li><a href="#${firstPart.get(file.id)}" dir="auto">${html(file.path)}</a> — ${html(labels.reasons[file.reason])}</li>`).join("")}</ul></details>` : ""}${groups || `<p>${html(labels.empty)}</p>`}</section>
<aside class="reason-aside js-control" aria-label="${html(labels.reason)}"><div class="reason-panel" id="reason-panel"><div class="panel-toolbar"><div class="navigation">${button("previous-group", "left", labels.previous)}<span id="position"></span>${button("next-group", "right", labels.next)}</div>${button("read-group", "check", labels.reviewed, 'aria-pressed="false"')}</div><div id="selected-reason"></div><div class="request-actions">${button("copy-request", "copy", labels.request)}${button("refresh", "refresh", labels.refresh)}<span id="request-feedback" role="status" aria-live="polite"></span></div><textarea id="request-text" readonly hidden aria-label="${html(labels.request)}"></textarea></div><div class="progress-bar"><span id="read-progress" role="status" aria-live="polite"></span><div class="progress-actions">${button("export-progress", "download", labels.export)}${button("import-progress", "upload", labels.import)}<input type="file" id="progress-file" accept="application/json,.json" hidden></div></div><p id="storage-warning" class="status-note" role="status"></p></aside></main>
<footer><span>${html(labels.head)} · <code>${snapshot.head.slice(0, 12)}</code></span><span>${layout.pendingFiles} ${html(labels.pending)}</span></footer>
<script id="diff-deep-document" type="application/json">${json(document)}</script><script id="diff-deep-view" type="application/json">${json({ labels, artifactPath })}</script><script>${script}</script></body></html>`;
  if (Buffer.byteLength(output) > LIMITS.artifactBytes) throw new Error("Rendered artifact exceeds its size limit");
  return output;
}
