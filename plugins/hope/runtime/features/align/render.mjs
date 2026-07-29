// Generated from features/align/render.mjs. Do not edit.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  COLORS,
  DESIGN_VERSION,
  LAYOUT,
  SPACE,
  TYPE,
} from "../../design/tokens.mjs";
import { label, loadLocale } from "../../locales/index.mjs";
import { ALIGN_LIMITS, ALIGN_RENDERER_VERSION } from "./constants.mjs";

const fontUrls = Object.freeze({
  sansBold: new URL("../../design/fonts/HopeSansBold.woff2", import.meta.url),
  sansLight: new URL("../../design/fonts/HopeSansLight.woff2", import.meta.url),
  sansMedium: new URL("../../design/fonts/HopeSansMedium.woff2", import.meta.url),
});

const bidiControls = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(bidiControls, (character) => (
      `\\u${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`
    ))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function userText(value) {
  return `<bdi dir="auto">${escapeHtml(value)}</bdi>`;
}

function sha256(value, encoding = "hex") {
  return createHash("sha256").update(value).digest(encoding);
}

function list(items, render, emptyText) {
  if (items.length === 0) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `<ul class="plain-list">${items.map(
    (item) => `<li>${render(item)}</li>`,
  ).join("")}</ul>`;
}

function section(id, title, content) {
  return `<section class="section" id="${escapeHtml(id)}">
    <h2>${escapeHtml(title)}</h2>
    ${content}
  </section>`;
}

function statusText(state, dictionary) {
  return label(dictionary, `align.status.${state}`);
}

function metricRows(session, dictionary) {
  const rows = [
    [label(dictionary, "align.interviewRounds"), session.resources.interviewRounds],
    [label(dictionary, "align.sources"), session.resources.sources],
    [label(dictionary, "align.jsonBytes"), session.resources.jsonBytes],
    [
      label(dictionary, "align.authoredTextBytes"),
      session.resources.authoredStringBytes,
    ],
    [
      label(dictionary, "align.activePerspectives"),
      session.resources.activePerspectives,
    ],
    [label(dictionary, "align.openQuestions"), session.resources.openQuestions],
    [label(dictionary, "align.slices"), session.resources.slices],
  ];
  if (session.observedMetrics) {
    for (const [key, value] of Object.entries(session.observedMetrics)) {
      rows.push([key, value]);
    }
  }
  return `<dl class="metric-grid">${rows.map(([name, value]) => (
    `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`
  )).join("")}</dl>`;
}

function themeVariables(colors) {
  return [
    `--accent:${colors.accent}`,
    `--bg:${colors.background}`,
    `--border:${colors.border}`,
    `--component-border:${colors.componentBorder}`,
    `--muted:${colors.muted}`,
    `--panel:${colors.panel}`,
    `--text:${colors.text}`,
  ].join(";");
}

function styles(fonts) {
  return `
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansLight}) format("woff2");font-weight:300;font-style:normal;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansMedium}) format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansBold}) format("woff2");font-weight:700;font-style:normal;font-display:swap}
:root{color-scheme:light;${themeVariables(COLORS.light)}}
:root[data-theme="dark"]{color-scheme:dark;${themeVariables(COLORS.dark)}}
@media(prefers-color-scheme:dark){:root:not([data-theme]){color-scheme:dark;${themeVariables(COLORS.dark)}}}
*{box-sizing:border-box}
html{background:var(--bg);scroll-behavior:smooth}
body{margin:0;color:var(--text);background:var(--bg);font:300 ${TYPE.body.wide.fontSize}px/${TYPE.body.wide.lineHeight} "Hope Sans",sans-serif}
a{color:inherit}
.skip{position:absolute;left:${SPACE[3]}px;top:-100px;padding:${SPACE[2]}px;background:var(--panel);z-index:5}
.skip:focus{top:${SPACE[2]}px}
.topbar{position:sticky;top:0;border-bottom:1px solid var(--border);background:var(--panel);z-index:2}
.topbar-inner{display:flex;align-items:center;justify-content:space-between;max-width:${LAYOUT.documentWidth}px;margin:auto;padding:${SPACE[2]}px ${SPACE[4]}px}
.brand{font-weight:700;letter-spacing:.08em}
.phase{padding:${SPACE[1]}px ${SPACE[2]}px;border:1px solid var(--component-border);border-radius:999px;font-weight:500}
.layout{max-width:${LAYOUT.contentWidth}px;margin:auto;padding:${SPACE[5]}px ${SPACE[4]}px}
.hero{padding:${SPACE[4]}px;border:1px solid var(--component-border);background:var(--panel)}
h1{max-width:${LAYOUT.proseWidth};margin:0 0 ${SPACE[2]}px;font-size:${TYPE.pageTitle.wide.fontSize}px;line-height:${TYPE.pageTitle.wide.lineHeight}}
.hero-meta,.source-meta{display:flex;flex-wrap:wrap;gap:${SPACE[2]}px;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.goal{max-width:${LAYOUT.proseWidth};margin:${SPACE[3]}px 0 0;font-size:1.1em}
.blockers{margin-top:${SPACE[3]}px;padding:${SPACE[2]}px ${SPACE[3]}px;border-left:3px solid var(--accent);background:var(--bg)}
.section{margin-top:${SPACE[5]}px;padding-top:${SPACE[4]}px;border-top:1px solid var(--border)}
.section h2{margin:0 0 ${SPACE[3]}px;font-size:${TYPE.sectionTitle.wide.fontSize}px;line-height:${TYPE.sectionTitle.wide.lineHeight}}
.section h2::before{content:"";display:block;width:32px;margin-bottom:${SPACE[2]}px;border-top:3px solid var(--accent)}
.subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${SPACE[3]}px}
.panel{padding:${SPACE[3]}px;border:1px solid var(--component-border);background:var(--panel)}
.panel h3,.card h3{margin:0 0 ${SPACE[2]}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.plain-list{list-style:none;margin:0;padding:0}
.plain-list>li{position:relative;padding-left:${SPACE[3]}px}
.plain-list>li+li{margin-top:${SPACE[2]}px}
.plain-list>li::before{position:absolute;left:0;content:"•";color:var(--accent)}
.record-grid,.slice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${SPACE[3]}px}
.card{padding:${SPACE[3]}px;border:1px solid var(--component-border);background:var(--panel)}
.card p{margin:${SPACE[1]}px 0 0}
.meta{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.tag{display:inline-block;margin-right:${SPACE[1]}px;padding:2px ${SPACE[1]}px;border:1px solid var(--border);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.scenario+.scenario,.perspective+.perspective{margin-top:${SPACE[3]}px}
.scenario h3,.perspective h3{margin:0 0 ${SPACE[1]}px}
.scenario p,.perspective p{margin:${SPACE[1]}px 0}
.perspective-skipped{color:var(--muted)}
.source{padding:${SPACE[2]}px 0;border-bottom:1px solid var(--border)}
.source:last-child{border-bottom:0}
.source p{margin:${SPACE[1]}px 0;overflow-wrap:anywhere}
.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${SPACE[2]}px;margin:0}
.metric-grid div{padding:${SPACE[2]}px;background:var(--panel);border:1px solid var(--border)}
.metric-grid dt{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.metric-grid dd{margin:${SPACE[1]}px 0 0;font-weight:500}
.empty{color:var(--muted);font-style:italic}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media(max-width:${LAYOUT.narrowBreakpoint}px){
 body{font-size:${TYPE.body.narrow.fontSize}px;line-height:${TYPE.body.narrow.lineHeight}}
 .layout{padding:${SPACE[4]}px ${SPACE[3]}px}
 .topbar-inner{padding:${SPACE[2]}px ${SPACE[3]}px}
 h1{font-size:${TYPE.pageTitle.narrow.fontSize}px;line-height:${TYPE.pageTitle.narrow.lineHeight}}
 .section h2{font-size:${TYPE.sectionTitle.narrow.fontSize}px;line-height:${TYPE.sectionTitle.narrow.lineHeight}}
 .subgrid,.record-grid,.slice-grid,.metric-grid{grid-template-columns:1fr}
 .hero{padding:${SPACE[3]}px}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media(forced-colors:active){.section h2::before,.blockers{border-color:Highlight}.tag,.panel,.card{forced-color-adjust:auto}}
@media print{
 :root,:root[data-theme]{color-scheme:light;${themeVariables(COLORS.light)};--bg:#fff;--panel:#fff;--text:#000}
 .topbar{position:static}
 .layout{max-width:none;padding:${SPACE[3]}px}
 .card,.panel,.scenario,.perspective{break-inside:avoid}
}
`;
}

export async function renderAlignSession(session, { fonts } = {}) {
  const dictionary = await loadLocale(session.locale, ["common", "align"]);
  const fontBytes = fonts ?? Object.fromEntries(await Promise.all(
    Object.entries(fontUrls).map(async ([name, url]) => [name, await readFile(url)]),
  ));
  const css = styles(Object.fromEntries(Object.entries(fontBytes).map(
    ([name, bytes]) => [name, bytes.toString("base64")],
  )));
  const scope = `<div class="subgrid">
    <article class="panel"><h3>${escapeHtml(label(dictionary, "align.inScope"))}</h3>${list(
      session.understanding.inScope,
      userText,
      label(dictionary, "align.noItems"),
    )}</article>
    <article class="panel"><h3>${escapeHtml(label(dictionary, "align.outOfScope"))}</h3>${list(
      session.understanding.outOfScope,
      userText,
      label(dictionary, "align.noItems"),
    )}</article>
  </div>`;
  const success = list(
    session.understanding.success,
    userText,
    label(dictionary, "align.noItems"),
  );
  const scenarios = session.understanding.scenarios.length === 0
    ? `<p class="empty">${escapeHtml(label(dictionary, "align.noItems"))}</p>`
    : session.understanding.scenarios.map((item) => `<article class="scenario card">
      <h3><span class="tag">${escapeHtml(label(dictionary, `align.${item.kind}`))}</span>${userText(item.situation)}</h3>
      <p><strong>${escapeHtml(label(dictionary, "align.expected"))}:</strong> ${userText(item.expected)}</p>
    </article>`).join("");

  const recordGroup = (items, title, render) => `<article class="panel">
    <h3>${escapeHtml(title)}</h3>
    ${list(items, render, label(dictionary, "align.noItems"))}
  </article>`;
  const sourceLabels = new Map(
    session.snapshot.sources.map((source) => [source.id, source.label]),
  );
  const records = `<div class="record-grid">
    ${recordGroup(session.records.decisions, label(dictionary, "align.decisions"), (item) => (
      `<p>${userText(item.text)}</p><p class="meta">${userText(item.rationale)}</p>`
    ))}
    ${recordGroup(session.records.facts, label(dictionary, "align.facts"), (item) => (
      `<p>${userText(item.text)}</p><p class="meta">${item.sourceIds.map(
        (sourceId) => userText(sourceLabels.get(sourceId) ?? sourceId),
      ).join(" · ")}</p>`
    ))}
    ${recordGroup(session.records.proposals, label(dictionary, "align.proposals"), (item) => (
      `<p><span class="tag">${escapeHtml(item.status)}</span>${userText(item.text)}</p><p class="meta">${userText(item.rationale)}</p>`
    ))}
    ${recordGroup(session.records.openQuestions, label(dictionary, "align.openQuestions"), (item) => (
      `<p><strong>${userText(item.question)}</strong></p>
      <p class="meta">${escapeHtml(label(dictionary, "align.why"))}: ${userText(item.whyItMatters)}</p>
      <p>${userText(item.recommendation)}</p>
      ${list(item.options, (option) => `<strong>${userText(option.label)}</strong> — ${userText(option.effect)}`, "")}`
    ))}
  </div>`;

  const assumptions = list(
    session.assumptions,
    (item) => `<span class="tag">${escapeHtml(item.origin)}</span><span class="tag">${escapeHtml(item.status)}</span>${userText(item.text)}`,
    label(dictionary, "align.noItems"),
  );
  const uncertainties = list(
    session.uncertainties,
    (item) => `<span class="tag">${escapeHtml(item.classification)}</span>${userText(item.text)}<p class="meta">${userText(item.nextStep)}</p>`,
    label(dictionary, "align.noItems"),
  );
  const perspectives = session.perspectives.map((item) => (
    `<article class="perspective card${item.state === "skipped" ? " perspective-skipped" : ""}">
      <h3><span class="tag">${escapeHtml(item.state)}</span>${escapeHtml(item.kind)}</h3>
      <p>${userText(item.reason)}</p>
      ${list(item.items, (detail) => `<strong>${userText(detail.title)}</strong><p>${userText(detail.detail)}</p>`, label(dictionary, "align.noItems"))}
    </article>`
  )).join("");
  const slices = session.slices.length === 0
    ? `<p class="empty">${escapeHtml(label(dictionary, "align.noItems"))}</p>`
    : `<div class="slice-grid">${session.slices.map((item) => `<article class="card">
      <h3>${userText(item.title)}</h3>
      <p><strong>${escapeHtml(label(dictionary, "align.userChange"))}:</strong> ${userText(item.userChange)}</p>
      <p><strong>${escapeHtml(label(dictionary, "align.workScope"))}:</strong> ${userText(item.scope)}</p>
      <p><strong>${escapeHtml(label(dictionary, "align.verification"))}:</strong> ${userText(item.verification)}</p>
      <p><strong>${escapeHtml(label(dictionary, "align.failureRecovery"))}:</strong> ${userText(item.failureRecovery)}</p>
    </article>`).join("")}</div>`;
  const sources = session.snapshot.sources.map((source) => `<article class="source">
    <strong>${userText(source.label)}</strong>
    <div class="source-meta"><span>${escapeHtml(source.kind)}</span><span>${userText(source.locator)}</span></div>
    ${source.revision ? `<p class="meta">revision: ${userText(source.revision)}</p>` : ""}
    ${source.digest ? `<p class="meta">${escapeHtml(source.digest)}</p>` : ""}
  </article>`).join("");
  const changes = list(
    session.changes,
    (item) => `<span class="tag">Round ${item.round}</span>${userText(item.summary)}`,
    label(dictionary, "align.noItems"),
  );
  const blockers = session.result.blockers.length === 0
    ? escapeHtml(label(dictionary, "align.noBlockers"))
    : session.result.blockers.map(escapeHtml).join(" · ");
  const themeAttribute = session.theme === "system"
    ? ""
    : ` data-theme="${escapeHtml(session.theme)}"`;
  const document = `<!doctype html>
<html lang="${escapeHtml(session.locale)}"${themeAttribute}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'sha256-${sha256(css, "base64")}'">
  <title>${escapeHtml(session.title)} · Hope align</title>
  <style>${css}</style>
</head>
<body>
  <a class="skip" href="#alignment">${escapeHtml(label(dictionary, "align.skip"))}</a>
  <header class="topbar"><div class="topbar-inner">
    <div class="brand">HOPE · ALIGN</div>
    <div class="phase">${escapeHtml(statusText(session.readiness.state, dictionary))}</div>
  </div></header>
  <main class="layout" id="alignment">
    <header class="hero">
      <h1>${userText(session.title)}</h1>
      <div class="hero-meta">
        <span>${escapeHtml(label(dictionary, "align.revision"))} ${session.revision}</span>
        <span>${escapeHtml(session.taskRisk)} risk</span>
        <span>${escapeHtml(label(dictionary, "align.captured"))} <time datetime="${escapeHtml(session.snapshot.capturedAt)}">${escapeHtml(session.snapshot.capturedAt)}</time></span>
      </div>
      <p class="goal"><strong>${escapeHtml(label(dictionary, "align.goal"))}:</strong> ${userText(session.understanding.goal)}</p>
      <div class="blockers"><strong>${escapeHtml(label(dictionary, "align.blockers"))}:</strong> ${blockers}</div>
    </header>
    ${section("scope", label(dictionary, "align.scope"), `${scope}<div class="panel"><h3>${escapeHtml(label(dictionary, "align.success"))}</h3>${success}</div>`)}
    ${section("scenarios", label(dictionary, "align.scenarios"), scenarios)}
    ${section("records", label(dictionary, "align.sharedState"), records)}
    ${section("assumptions", label(dictionary, "align.assumptions"), assumptions)}
    ${section("uncertainties", label(dictionary, "align.uncertainties"), uncertainties)}
    ${section("perspectives", label(dictionary, "align.perspectives"), perspectives)}
    ${section("slices", label(dictionary, "align.slices"), slices)}
    ${section("changes", label(dictionary, "align.changes"), changes)}
    ${section("sources", label(dictionary, "align.sources"), sources)}
    ${section("metrics", label(dictionary, "align.metrics"), metricRows(session, dictionary))}
  </main>
</body>
</html>`;
  const bytes = Buffer.from(document, "utf8");
  if (bytes.length > ALIGN_LIMITS.artifactBytes) {
    throw new Error(`Hope align artifact exceeds ${ALIGN_LIMITS.artifactBytes} bytes`);
  }
  return Object.freeze({
    bytes,
    designVersion: DESIGN_VERSION,
    digest: sha256(bytes),
    rendererVersion: ALIGN_RENDERER_VERSION,
  });
}
