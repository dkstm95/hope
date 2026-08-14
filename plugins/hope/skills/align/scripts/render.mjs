import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  ALIGN_DESIGN_VERSION,
  COLORS,
  LAYOUT,
  SPACE,
  TYPE,
} from "./design/tokens.mjs";

const fontUrls = Object.freeze({
  sansBold: new URL("../../../assets/fonts/HopeSansBold.woff2", import.meta.url),
  sansLight: new URL("../../../assets/fonts/HopeSansLight.woff2", import.meta.url),
  sansMedium: new URL("../../../assets/fonts/HopeSansMedium.woff2", import.meta.url),
});
const iconUrl = new URL("../../../assets/hope-icon.png", import.meta.url);

const dictionaries = Object.freeze({
  "en-US": Object.freeze({
    agreement: "Decisions and implementation choices",
    agreedDecisions: "Agreed decisions",
    behavior: "Agreed behavior",
    boundary: "Boundary",
    cancelOutcome: "cancel",
    completeOutcome: "complete",
    currentAgreement: "Current agreement",
    earlierRevisions: "earlier revisions",
    evidence: "Basis",
    excluded: "Out of scope",
    history: "Intent history",
    included: "In scope",
    menu: "Contents",
    navigation: "Contents and intent history",
    noExcluded: "No explicit exclusion was needed.",
    noIncluded: "No separate included item was needed.",
    openChoices: "Choose during implementation",
    overview: "Summary",
    problem: "Problem",
    revisionDetails: "View changes",
    scope: "Scope",
    skip: "Skip to agreement",
    success: "Success",
    toc: "Contents",
    useDarkTheme: "Switch to dark mode",
    useLightTheme: "Switch to light mode",
  }),
  "ko-KR": Object.freeze({
    agreement: "결정과 구현 선택",
    agreedDecisions: "합의된 결정",
    behavior: "합의된 동작",
    boundary: "경계",
    cancelOutcome: "취소",
    completeOutcome: "완료",
    currentAgreement: "현재 합의",
    earlierRevisions: "개의 이전 리비전",
    evidence: "근거",
    excluded: "제외 범위",
    history: "의도 이력",
    included: "포함 범위",
    menu: "목차",
    navigation: "목차와 의도 이력",
    noExcluded: "명시적으로 제외한 범위가 없습니다.",
    noIncluded: "별도로 포함한 범위가 없습니다.",
    openChoices: "구현 중 선택",
    overview: "요약",
    problem: "문제",
    revisionDetails: "변경 내용 보기",
    scope: "범위",
    skip: "합의 내용으로 건너뛰기",
    success: "성공",
    toc: "목차",
    useDarkTheme: "다크 모드로 전환",
    useLightTheme: "라이트 모드로 전환",
  }),
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function authoredText(value) {
  return `<bdi dir="auto">${escapeHtml(value)}</bdi>`;
}

function embeddedJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function hashSource(value) {
  return createHash("sha256").update(value).digest("base64");
}

function label(dictionary, key) {
  return dictionary[key];
}

function textList(items, { empty, className = "plain-list" } = {}) {
  if (items.length === 0) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<ul class="${className}">${items.map(
    (item) => `<li>${authoredText(item)}</li>`,
  ).join("")}</ul>`;
}

function summaryValue(items) {
  if (items.length === 1) return `<p>${authoredText(items[0])}</p>`;
  return textList(items, { className: "summary-list" });
}

function overview(content, dictionary) {
  return `<section class="overview document-section" id="overview" aria-labelledby="artifact-title">
    <header class="document-head">
      <h1 id="artifact-title">${authoredText(content.title)}</h1>
      <p class="intent">${authoredText(content.intent)}</p>
    </header>
    <dl class="synopsis">
      <div><dt>${escapeHtml(label(dictionary, "problem"))}</dt><dd><p>${authoredText(content.problem)}</p></dd></div>
      <div><dt>${escapeHtml(label(dictionary, "success"))}</dt><dd>${summaryValue(content.success)}</dd></div>
      <div><dt>${escapeHtml(label(dictionary, "boundary"))}</dt><dd><p>${authoredText(content.boundary)}</p></dd></div>
    </dl>
  </section>`;
}

function scopeSection(content, dictionary) {
  return `<section class="scope document-section" id="scope" aria-labelledby="scope-title">
    <h2 class="sr-only" id="scope-title">${escapeHtml(label(dictionary, "scope"))}</h2>
    <div class="scope-column">
      <h3>${escapeHtml(label(dictionary, "included"))}</h3>
      ${textList(content.scope.included, { empty: label(dictionary, "noIncluded") })}
    </div>
    <div class="scope-column">
      <h3>${escapeHtml(label(dictionary, "excluded"))}</h3>
      ${textList(content.scope.excluded, { empty: label(dictionary, "noExcluded") })}
    </div>
  </section>`;
}

function behaviorConnector(outcomeCount) {
  if (outcomeCount === 0) return "";
  const positions = Array.from(
    { length: outcomeCount },
    (_, index) => ((index + 0.5) * 100) / outcomeCount,
  );
  const branches = positions.map((position) => `M32 ${position} H64`).join(" ");
  const trunk = outcomeCount === 1
    ? ""
    : `M32 ${positions[0]} V${positions.at(-1)}`;
  return `<svg class="behavior-connector" viewBox="0 0 64 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 50 H32 ${trunk} ${branches}" vector-effect="non-scaling-stroke"></path></svg>`;
}

function behaviorSection(content, dictionary) {
  if (!content.behavior) return undefined;
  const outcomeCount = content.behavior.outcomes.length;
  const outcomes = outcomeCount === 0 ? "" : `<ul class="behavior-outcomes">${
    content.behavior.outcomes.map((outcome) => `<li class="${outcome.kind === "cancel" ? "cancel" : "complete"}">
      <span class="outcome-mark" aria-hidden="true">${outcome.kind === "cancel" ? "×" : "✓"}</span>
      <div><strong>${authoredText(outcome.title)}</strong>${outcome.detail
        ? `<p>${authoredText(outcome.detail)}</p>`
        : ""}</div>
    </li>`).join("")
  }</ul>`;
  return `<section class="body-section document-section" id="behavior" aria-labelledby="behavior-title">
    <h2 id="behavior-title">${escapeHtml(label(dictionary, "behavior"))}</h2>
    <div class="behavior-layout${outcomeCount === 0 ? " behavior-layout-single" : ""}">
      <ol class="behavior-steps">${content.behavior.steps.map((step, index) => `<li>
        <span class="step-number">${index + 1}</span>
        <strong>${authoredText(step.title)}</strong>
        ${step.detail ? `<p>${authoredText(step.detail)}</p>` : ""}
      </li>`).join("")}</ol>
      ${behaviorConnector(outcomeCount)}
      ${outcomes}
    </div>
  </section>`;
}

function agreementSection(content, dictionary) {
  if (content.decisions.length === 0 && content.openChoices.length === 0) return undefined;
  const decisionColumn = content.decisions.length === 0 ? "" : `<div>
    <h3 class="subheading">${escapeHtml(label(dictionary, "agreedDecisions"))}</h3>
    <ol class="decision-list">${content.decisions.map((decision, index) => `<li>
      <span class="decision-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <h3>${authoredText(decision.decision)}</h3>
      <p>${authoredText(decision.reason)}</p>
    </li>`).join("")}</ol>
  </div>`;
  const choiceColumn = content.openChoices.length === 0 ? "" : `<div>
    <h3 class="subheading">${escapeHtml(label(dictionary, "openChoices"))}</h3>
    ${textList(content.openChoices)}
  </div>`;
  const singleColumn = content.decisions.length === 0 || content.openChoices.length === 0;
  return `<section class="body-section document-section" id="agreement" aria-labelledby="agreement-title">
    <h2 id="agreement-title">${escapeHtml(label(dictionary, "agreement"))}</h2>
    <div class="agreement-grid${singleColumn ? " agreement-grid-single" : ""}">${decisionColumn}${choiceColumn}</div>
  </section>`;
}

function evidenceLocation(item) {
  if (/^https?:\/\//u.test(item.location)) {
    return `<a href="${escapeHtml(item.location)}">${authoredText(item.location)}</a>`;
  }
  return `<code>${authoredText(item.location)}</code>`;
}

function evidenceSection(content, dictionary) {
  if (content.evidence.length === 0) return undefined;
  return `<section class="body-section document-section" id="evidence" aria-labelledby="evidence-title">
    <h2 id="evidence-title">${escapeHtml(label(dictionary, "evidence"))}</h2>
    <dl class="evidence-list">${content.evidence.map((item) => `<div>
      <dt>${authoredText(item.label)}</dt>
      <dd>${evidenceLocation(item)}</dd>
    </div>`).join("")}</dl>
  </section>`;
}

function compactRevisionContent(content, dictionary) {
  const detail = (title, value) => `${authoredText(title)}${value
    ? ` <span aria-hidden="true">—</span> ${authoredText(value)}`
    : ""}`;
  const behavior = content.behavior ? `<div>
    <dt>${escapeHtml(label(dictionary, "behavior"))}</dt>
    <dd><ul class="plain-list">${content.behavior.steps.map(
      (step) => `<li>${detail(step.title, step.detail)}</li>`,
    ).join("")}${content.behavior.outcomes.map((outcome) => `<li>${detail(
      `${outcome.title} (${label(
        dictionary,
        outcome.kind === "cancel" ? "cancelOutcome" : "completeOutcome",
      )})`,
      outcome.detail,
    )}</li>`).join("")}</ul></dd>
  </div>` : "";
  const decisions = content.decisions.length === 0 ? "" : `<div>
    <dt>${escapeHtml(label(dictionary, "agreedDecisions"))}</dt>
    <dd><ul class="plain-list">${content.decisions.map(
      (decision) => `<li>${detail(decision.decision, decision.reason)}</li>`,
    ).join("")}</ul></dd>
  </div>`;
  const openChoices = content.openChoices.length === 0 ? "" : `<div><dt>${escapeHtml(label(dictionary, "openChoices"))}</dt><dd>${textList(content.openChoices)}</dd></div>`;
  const evidence = content.evidence.length === 0 ? "" : `<div>
    <dt>${escapeHtml(label(dictionary, "evidence"))}</dt>
    <dd><ul class="plain-list">${content.evidence.map((item) => `<li><strong>${authoredText(item.label)}</strong><br>${evidenceLocation(item)}</li>`).join("")}</ul></dd>
  </div>`;
  return `<dl class="revision-content">
    <div><dt>${escapeHtml(label(dictionary, "overview"))}</dt><dd><strong>${authoredText(content.title)}</strong><p>${authoredText(content.intent)}</p></dd></div>
    <div><dt>${escapeHtml(label(dictionary, "problem"))}</dt><dd>${authoredText(content.problem)}</dd></div>
    <div><dt>${escapeHtml(label(dictionary, "success"))}</dt><dd>${textList(content.success)}</dd></div>
    <div><dt>${escapeHtml(label(dictionary, "boundary"))}</dt><dd>${authoredText(content.boundary)}</dd></div>
    <div><dt>${escapeHtml(label(dictionary, "included"))}</dt><dd>${textList(content.scope.included, { empty: label(dictionary, "noIncluded") })}</dd></div>
    <div><dt>${escapeHtml(label(dictionary, "excluded"))}</dt><dd>${textList(content.scope.excluded, { empty: label(dictionary, "noExcluded") })}</dd></div>
    ${behavior}${decisions}${openChoices}${evidence}
  </dl>`;
}

function railRevision(revision, index, data, dictionary, idSuffix) {
  const current = index === 0;
  const details = current || data.revisions.length === 1 ? "" : `<details class="revision-disclosure" id="revision-${revision.number}${idSuffix}">
    <summary>${escapeHtml(label(dictionary, "revisionDetails"))}</summary>
    <div class="revision-popup">${compactRevisionContent(revision.content, dictionary)}</div>
  </details>`;
  return `<li class="${current ? "current" : "past"}">
    <div class="revision-head"><span class="revision-dot" aria-hidden="true"></span><strong>r${revision.number} · ${current ? escapeHtml(label(dictionary, "currentAgreement")) : authoredText(revision.summary)}</strong><time datetime="${escapeHtml(revision.agreedAt)}">${escapeHtml(revision.agreedAt.slice(0, 10))}</time></div>
    <p>${authoredText(revision.summary)}</p>${details ? `
    ${details}` : ""}
  </li>`;
}

function railHistory(data, dictionary, idSuffix = "") {
  const reversed = [...data.revisions].reverse();
  const shown = reversed.slice(0, 2);
  const older = reversed.slice(shown.length);
  const headingId = `rail-history-title${idSuffix}`;
  return `<section class="rail-history" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${escapeHtml(label(dictionary, "history"))}</h2>
    <ol>${shown.map((revision, index) => railRevision(
      revision,
      index,
      data,
      dictionary,
      idSuffix,
    )).join("")}</ol>
    ${older.length === 0 ? "" : `<details class="older-history"><summary>${older.length} ${escapeHtml(label(dictionary, "earlierRevisions"))}</summary><ol>${older.map((revision, index) => railRevision(
      revision,
      index + shown.length,
      data,
      dictionary,
      idSuffix,
    )).join("")}</ol></details>`}
  </section>`;
}

function repositoryMark(repository, className) {
  return `<span class="${className}"><svg class="repository-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${authoredText(repository)}</span></span>`;
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
    `--visited:${colors.visited}`,
  ].join(";");
}

function css(fontBase64) {
  const [space1, space2, space3, space4, space5, space6, space7, space8, space9] = SPACE;
  return `@font-face {
  font-family: "Hope Sans";
  src: url(data:font/woff2;base64,${fontBase64.sansLight}) format("woff2");
  font-style: normal;
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: "Hope Sans";
  src: url(data:font/woff2;base64,${fontBase64.sansMedium}) format("woff2");
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: "Hope Sans";
  src: url(data:font/woff2;base64,${fontBase64.sansBold}) format("woff2");
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}
:root {
  color-scheme: light;
  ${themeVariables(COLORS.light)};
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    ${themeVariables(COLORS.dark)};
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  ${themeVariables(COLORS.dark)};
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 300 ${TYPE.body.wide.fontSize}px/${TYPE.body.wide.lineHeight} "Hope Sans", sans-serif;
  text-rendering: optimizeLegibility;
}
h1, h2, h3, strong { font-weight: 700; }
p, ul, ol, dl { margin-block: 0; }
a { color: var(--accent); text-underline-offset: .2em; }
a:visited { color: var(--visited); }
code { font: 500 .92em/1.5 "Hope Sans", sans-serif; overflow-wrap: anywhere; }
button, summary { font-family: "Hope Sans", sans-serif; font-weight: 500; }
[id]:target { scroll-margin-top: 76px; }
[id]:focus { outline: 2px solid var(--accent); outline-offset: ${space1}px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.skip { position: fixed; z-index: 20; top: ${space2}px; left: ${space2}px; transform: translateY(-200%); padding: ${space2}px ${space3}px; background: var(--text); color: var(--bg); }
.skip:focus { transform: none; }
.topbar { position: sticky; z-index: 10; top: 0; border-bottom: 1px solid var(--border); background: var(--bg); }
.topbar-inner { max-width: ${LAYOUT.documentWidth}px; height: ${LAYOUT.topbarInnerHeight}px; margin: 0 auto; padding: 0 ${LAYOUT.topbarWideGutter}px; display: flex; align-items: center; gap: ${space5}px; }
.brand { flex: none; display: flex; align-items: center; gap: ${space2}px; font-size: ${TYPE.brand.wide.fontSize}px; line-height: ${TYPE.brand.wide.lineHeight}; font-weight: 700; letter-spacing: -.025em; white-space: nowrap; }
.brand-icon { flex: none; width: 24px; height: 24px; border-radius: 6px; }
.repository, .mobile-repository { min-width: 0; display: flex; align-items: center; gap: ${space2}px; color: var(--text); }
.repository > span, .mobile-repository > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repository-icon { flex: none; width: 16px; height: 16px; stroke: var(--muted); }
.status { flex: none; padding: ${space1}px ${space2}px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: 4px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent); font-size: ${TYPE.micro.compactFontSize}px; font-weight: 700; }
.top-actions { margin-left: auto; display: flex; align-items: center; gap: ${space2}px; }
.theme-button, .mobile-navigation > summary { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; }
.theme-button:hover, .mobile-navigation > summary:hover { border-color: var(--border); background: var(--panel); }
.theme-button:focus-visible, .mobile-navigation > summary:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.theme-icon, .navigation-icon { width: 20px; height: 20px; stroke: currentColor; }
.theme-icon[hidden] { display: none; }
.mobile-navigation { display: none; }
.mobile-repository { display: none; }
.mobile-navigation > summary { list-style: none; }
.mobile-navigation > summary::-webkit-details-marker { display: none; }
.layout { max-width: ${LAYOUT.documentWidth}px; min-height: calc(100vh - ${LAYOUT.topbarHeight}px); margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) ${LAYOUT.tableOfContentsWidth}px; }
.main { min-width: 0; padding: ${space7}px ${space7}px 80px; }
.rail { border-left: 1px solid var(--border); padding: ${space7}px ${space5}px; }
.rail-inner { position: sticky; top: ${LAYOUT.topbarHeight + 40}px; display: grid; gap: ${space6}px; }
.toc h2, .rail-history h2 { margin: 0 0 ${space4}px; font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.toc ol, .rail-history ol { list-style: none; padding: 0; }
.toc a { display: block; padding: ${space2}px 0; color: var(--text); text-decoration: none; }
.toc a[aria-current="location"] { color: var(--accent); font-weight: 700; }
.rail-history { padding-top: ${space5}px; border-top: 1px solid var(--border); }
.rail-history li { position: relative; padding: 0 0 ${space5}px ${space4}px; border-left: 1px solid var(--border); }
.rail-history li:last-child { padding-bottom: ${space3}px; }
.revision-dot { position: absolute; left: -5px; top: 7px; width: 9px; height: 9px; border: 1px solid var(--component-border); border-radius: 50%; background: var(--bg); }
.rail-history .current .revision-dot { border-color: var(--accent); background: var(--accent); }
.revision-head { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: ${space2}px; align-items: baseline; }
.revision-head strong { font-size: ${TYPE.menu.fontSize}px; }
.revision-head time { color: var(--muted); font-size: ${TYPE.micro.fontSize}px; }
.rail-history p { margin: ${space2}px 0; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.revision-disclosure, .older-history { position: relative; }
.revision-disclosure > summary, .older-history > summary { min-height: 32px; display: flex; align-items: center; color: var(--text); cursor: pointer; font-size: ${TYPE.supporting.wide.fontSize}px; }
.revision-disclosure > summary::marker, .older-history > summary::marker { color: var(--muted); }
.revision-popup { position: absolute; z-index: 12; top: 100%; right: 0; width: min(560px, calc(100vw - ${LAYOUT.tableOfContentsWidth + 80}px)); max-height: min(70vh, 680px); overflow: auto; padding: ${space4}px; border: 1px solid var(--border); background: var(--panel); box-shadow: 0 12px 32px color-mix(in srgb, var(--text) 14%, transparent); }
.older-history > ol { list-style: none; padding: ${space3}px 0 0; }
.document-section + .document-section { margin-top: ${space9}px; }
.document-head { max-width: 78ch; }
.document-head h1 { margin: 0; font-size: ${TYPE.pageTitle.wide.fontSize}px; line-height: ${TYPE.pageTitle.wide.lineHeight}; letter-spacing: -.04em; overflow-wrap: anywhere; }
.intent { margin-top: ${space3}px; font-size: ${TYPE.intent.wide.fontSize}px; line-height: ${TYPE.intent.wide.lineHeight}; }
.synopsis { margin-top: ${space5}px; border-top: 1px solid var(--border); }
.synopsis > div { display: grid; grid-template-columns: 80px minmax(0,1fr); gap: ${space5}px; padding: ${space3}px ${space2}px; border-bottom: 1px solid var(--border); }
.synopsis dt { font-weight: 700; }
.synopsis dd { margin: 0; }
.summary-list { padding-left: ${space4}px; }
.overview + .scope { margin-top: ${space7}px; }
.scope { display: grid; grid-template-columns: minmax(0,.45fr) minmax(0,.55fr); }
.scope-column { padding: ${space4}px ${space2}px ${space5}px; }
.scope-column + .scope-column { padding-left: ${space6}px; border-left: 1px solid var(--border); }
.scope h3, .body-section > h2 { margin: 0 0 ${space4}px; color: var(--accent); font-size: ${TYPE.sectionTitle.wide.fontSize}px; }
.plain-list { padding-left: ${space4}px; display: grid; gap: ${space2}px; }
.empty { color: var(--muted); }
.behavior-layout { display: grid; grid-template-columns: minmax(0, 1fr) 64px minmax(190px, .34fr); align-items: stretch; }
.behavior-layout-single { grid-template-columns: minmax(0,1fr); }
.behavior-steps { list-style: none; padding: 0; display: flex; gap: ${space5}px; }
.behavior-steps li { position: relative; flex: 1 1 0; min-width: 0; padding-right: ${space4}px; }
.behavior-steps li:not(:last-child)::after { content: "→"; position: absolute; right: -${space3}px; top: 4px; color: var(--muted); }
.step-number { display: grid; width: 24px; height: 24px; margin-bottom: ${space3}px; place-items: center; border-radius: 50%; background: var(--accent); color: var(--bg); font-size: ${TYPE.micro.compactFontSize}px; font-weight: 700; }
.behavior-steps strong, .behavior-outcomes strong { display: block; font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.behavior-steps p, .behavior-outcomes p { margin-top: ${space2}px; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.behavior-connector { width: 64px; height: 100%; min-height: 96px; overflow: visible; color: var(--component-border); }
.behavior-connector path { fill: none; stroke: currentColor; stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
.behavior-outcomes { list-style: none; padding: 0; display: grid; grid-auto-rows: 1fr; }
.behavior-outcomes li { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: ${space3}px; align-items: center; padding: ${space2}px 0; }
.outcome-mark { display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid var(--accent); border-radius: 50%; color: var(--accent); font-weight: 700; }
.agreement-grid { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(220px, .8fr); border-top: 1px solid var(--border); }
.agreement-grid-single { grid-template-columns: 1fr; }
.agreement-grid > div { padding: ${space4}px ${space2}px 0; }
.agreement-grid > div + div { padding-left: ${space6}px; border-left: 1px solid var(--border); }
.subheading { margin: 0 0 ${space3}px; color: var(--accent); font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.decision-list { list-style: none; padding: 0; }
.decision-list li { display: grid; grid-template-columns: 28px minmax(180px, .44fr) minmax(0,1fr); gap: ${space4}px; padding: ${space3}px 0; border-top: 1px solid var(--border); }
.decision-number { color: var(--accent); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; }
.decision-list li:first-child { border-top: 0; }
.decision-list h3 { margin: 0; font-size: inherit; }
.decision-list p { color: var(--muted); }
.evidence-list > div { display: grid; grid-template-columns: minmax(140px,.35fr) minmax(0,1fr); gap: ${space4}px; padding: ${space3}px ${space2}px; border-top: 1px solid var(--border); }
.evidence-list dt { font-weight: 700; }
.evidence-list dd { margin: 0; overflow-wrap: anywhere; }
.revision-content { padding: ${space4}px 0 ${space5}px; }
.revision-content > div { display: grid; grid-template-columns: 110px minmax(0,1fr); gap: ${space4}px; padding: ${space2}px 0; }
.revision-content dt { font-weight: 700; }
.revision-content dd { margin: 0; }
.revision-content dd p { margin-top: ${space1}px; }
@media (max-width: ${LAYOUT.tocBreakpoint - 1}px) {
  .layout { display: block; }
  .rail { display: none; }
  .mobile-navigation { display: block; }
  .mobile-navigation-panel { position: fixed; z-index: 11; top: ${LAYOUT.topbarHeight}px; right: 0; width: min(360px, 100vw); max-height: calc(100dvh - ${LAYOUT.topbarHeight}px); overflow: auto; padding: ${space5}px; border-bottom: 1px solid var(--border); border-left: 1px solid var(--border); background: var(--panel); box-shadow: -12px 16px 32px color-mix(in srgb, var(--text) 14%, transparent); }
  .mobile-navigation-panel .toc { padding-bottom: ${space5}px; }
  .mobile-navigation-panel .mobile-repository { margin-bottom: ${space5}px; padding-bottom: ${space4}px; border-bottom: 1px solid var(--border); }
  .mobile-navigation-panel .toc ol { display: grid; gap: ${space1}px; }
  .mobile-navigation-panel .toc a { padding-block: ${space1}px; }
  .mobile-navigation-panel .rail-history { padding-top: ${space5}px; }
  .mobile-navigation-panel .revision-popup { position: static; width: auto; max-height: none; margin-top: ${space2}px; padding: ${space3}px; box-shadow: none; }
}
@media (max-width: ${LAYOUT.narrowBreakpoint - 1}px) {
  body { font-size: ${TYPE.body.narrow.fontSize}px; line-height: ${TYPE.body.narrow.lineHeight}; }
  .topbar-inner { padding: 0 ${space4}px; gap: ${space3}px; }
  .brand { font-size: ${TYPE.brand.narrow.fontSize}px; line-height: ${TYPE.brand.narrow.lineHeight}; }
  .repository { max-width: 30vw; }
  .main { padding: ${space8}px ${space4}px ${space9}px; }
  .document-section + .document-section { margin-top: 48px; }
  .document-head h1 { font-size: ${TYPE.pageTitle.narrow.fontSize}px; line-height: ${TYPE.pageTitle.narrow.lineHeight}; }
  .intent { font-size: ${TYPE.intent.narrow.fontSize}px; line-height: ${TYPE.intent.narrow.lineHeight}; }
  .scope { grid-template-columns: 1fr; }
  .scope-column + .scope-column { padding-left: ${space2}px; border-top: 1px solid var(--border); border-left: 0; }
  .behavior-layout { grid-template-columns: 1fr; }
  .behavior-connector { display: none; }
  .behavior-steps { flex-direction: column; gap: ${space5}px; }
  .behavior-steps li { padding: 0 0 ${space4}px ${space6}px; }
  .behavior-steps li:not(:last-child)::after { content: "↓"; right: auto; top: auto; bottom: -${space3}px; left: 10px; }
  .step-number { position: absolute; left: 0; top: 0; }
  .behavior-outcomes { margin-top: ${space4}px; padding-top: ${space4}px; border-top: 1px solid var(--border); gap: ${space4}px; }
  .behavior-outcomes li { align-items: start; padding: 0; }
  .agreement-grid { grid-template-columns: 1fr; }
  .agreement-grid > div + div { padding: ${space5}px ${space2}px 0; border-top: 1px solid var(--border); border-left: 0; }
  .decision-list li { grid-template-columns: 28px minmax(0,1fr); gap: ${space2}px ${space3}px; }
  .decision-number { grid-row: 1 / span 2; }
  .decision-list p { grid-column: 2; }
  .revision-content > div, .evidence-list > div { grid-template-columns: 1fr; gap: ${space1}px; }
}
@media (max-width: ${LAYOUT.compactBreakpoint}px) {
  .topbar-inner { padding-inline: ${space3}px; gap: ${space2}px; }
  .brand { gap: ${space1}px; }
  .brand-icon { width: 20px; height: 20px; border-radius: 5px; }
  .brand-product { display: none; }
  .repository { display: none; }
  .mobile-navigation-panel .mobile-repository { display: flex; }
  .status { max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .synopsis > div { grid-template-columns: 1fr; gap: ${space1}px; padding-inline: 0; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
@media (forced-colors: active) {
  .status, .theme-button, .mobile-navigation > summary, .outcome-mark { border: 1px solid ButtonText; }
  .step-number { border: 1px solid ButtonText; background: Canvas; color: CanvasText; }
  .revision-dot, .rail-history .current .revision-dot { border-color: CanvasText; background: Canvas; }
}
@media print {
  :root, :root[data-theme], :root:not([data-theme="light"]) { color-scheme: light; ${themeVariables(COLORS.light)}; }
  .topbar, .rail, .mobile-navigation, .skip { display: none !important; }
  .layout { display: block; }
  .main { padding: 0; }
  a { color: inherit; text-decoration: none; }
}
`;
}

function clientScript(dictionary) {
  const labels = JSON.stringify({
    dark: label(dictionary, "useDarkTheme"),
    light: label(dictionary, "useLightTheme"),
  });
  return `(()=>{"use strict";
const labels=${labels};
const root=document.documentElement;
const theme=document.getElementById("theme-toggle");
const navigation=document.querySelector(".mobile-navigation");
const links=[...document.querySelectorAll('nav a[href^="#"]')];
const sections=[...document.querySelectorAll(".document-section[id]")];
let frame=0;
const currentTheme=()=>root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
const syncTheme=()=>{if(!theme)return;const next=currentTheme()==="dark"?"light":"dark";theme.setAttribute("aria-label",labels[next]);theme.setAttribute("title",labels[next]);for(const icon of theme.querySelectorAll("[data-theme-icon]"))icon.toggleAttribute("hidden",icon.dataset.themeIcon!==next);};
const focusTarget=target=>{const had=target.hasAttribute("tabindex");if(!had)target.setAttribute("tabindex","-1");target.focus({preventScroll:true});if(!had)target.addEventListener("blur",()=>target.removeAttribute("tabindex"),{once:true});};
const reveal=target=>{for(let item=target;item;item=item.parentElement)if(item.tagName==="DETAILS")item.open=true;};
const openTarget=()=>{if(!location.hash)return;const target=document.getElementById(location.hash.slice(1));if(!target)return;reveal(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({block:"start"});});};
const syncCurrent=()=>{if(sections.length===0)return;let current=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=96)current=section;else break;}for(const link of links){if(link.hash==="#"+current.id)link.setAttribute("aria-current","location");else link.removeAttribute("aria-current");}};
syncTheme();
theme?.addEventListener("click",()=>{root.dataset.theme=currentTheme()==="dark"?"light":"dark";syncTheme();});
navigation?.addEventListener("click",event=>{if(event.target.closest?.('a[href^="#"]'))navigation.open=false;});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",syncTheme);
addEventListener("hashchange",openTarget);
addEventListener("click",event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)requestAnimationFrame(openTarget);});
addEventListener("keydown",event=>{if(event.key==="Escape"&&navigation?.open){navigation.open=false;navigation.querySelector("summary")?.focus();}});
addEventListener("scroll",()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;syncCurrent();});},{passive:true});
openTarget();syncCurrent();
})();`;
}

export function renderAlignArtifact(data, { digest }) {
  const dictionary = dictionaries[data.locale];
  const current = data.revisions.at(-1);
  const content = current.content;
  const sections = [
    { id: "overview", title: label(dictionary, "overview"), html: overview(content, dictionary) },
    { id: "scope", title: label(dictionary, "scope"), html: scopeSection(content, dictionary) },
    { id: "behavior", title: label(dictionary, "behavior"), html: behaviorSection(content, dictionary) },
    { id: "agreement", title: label(dictionary, "agreement"), html: agreementSection(content, dictionary) },
    { id: "evidence", title: label(dictionary, "evidence"), html: evidenceSection(content, dictionary) },
  ].filter((section) => section.html !== undefined);
  const showToc = sections.length >= 3;
  const toc = showToc ? `<ol>${sections.map(
    (section) => `<li><a href="#${section.id}">${escapeHtml(section.title)}</a></li>`,
  ).join("")}</ol>` : "";
  const mobileNavigation = `<details class="mobile-navigation">
    <summary aria-label="${escapeHtml(label(dictionary, "navigation"))}" title="${escapeHtml(label(dictionary, "navigation"))}"><svg class="navigation-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h10"></path><circle cx="18" cy="18" r="2.5"></circle></svg></summary>
    <div class="mobile-navigation-panel">
      ${repositoryMark(data.repository, "mobile-repository")}
      ${showToc ? `<nav class="toc" aria-label="${escapeHtml(label(dictionary, "toc"))}"><h2>${escapeHtml(label(dictionary, "toc"))}</h2>${toc}</nav>` : ""}
      ${railHistory(data, dictionary, "-mobile")}
    </div>
  </details>`;
  const fontBytes = Object.fromEntries(Object.entries(fontUrls).map(
    ([name, url]) => [name, readFileSync(url).toString("base64")],
  ));
  const iconBase64 = readFileSync(iconUrl).toString("base64");
  const iconDataUrl = `data:image/png;base64,${iconBase64}`;
  const styles = css(fontBytes);
  const script = clientScript(dictionary);
  const themeAttribute = data.theme === "system" ? "" : ` data-theme="${data.theme}"`;
  return `<!doctype html>
<html lang="${escapeHtml(data.locale)}"${themeAttribute}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="hope-align-id" content="${escapeHtml(data.alignId)}">
  <meta name="hope-align-digest" content="${escapeHtml(digest)}">
  <meta name="hope-align-design-version" content="${ALIGN_DESIGN_VERSION}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'sha256-${hashSource(styles)}'; script-src 'sha256-${hashSource(script)}'">
  <link rel="icon" type="image/png" sizes="128x128" href="${iconDataUrl}">
  <title>${escapeHtml(content.title)} · Hope Align</title>
  <style>${styles}</style>
</head>
<body>
  <a class="skip" href="#overview">${escapeHtml(label(dictionary, "skip"))}</a>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><img class="brand-icon" src="${iconDataUrl}" alt="" width="24" height="24"><span>HOPE</span><span class="brand-product">· ALIGN</span></div>
      ${repositoryMark(data.repository, "repository")}
      <span class="status">r${current.number} · ${escapeHtml(label(dictionary, "currentAgreement"))}</span>
      <div class="top-actions">
        <button class="theme-button" id="theme-toggle" type="button" aria-label="${escapeHtml(data.theme === "dark" ? label(dictionary, "useLightTheme") : label(dictionary, "useDarkTheme"))}" title="${escapeHtml(data.theme === "dark" ? label(dictionary, "useLightTheme") : label(dictionary, "useDarkTheme"))}">
          <svg class="theme-icon" data-theme-icon="dark" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${data.theme === "dark" ? " hidden" : ""}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path></svg>
          <svg class="theme-icon" data-theme-icon="light" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${data.theme === "dark" ? "" : " hidden"}><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>
        </button>
        ${mobileNavigation}
      </div>
    </div>
  </header>
  <div class="layout">
    <main class="main" id="agreement-document">${sections.map((section) => section.html).join("")}</main>
    <aside class="rail"><div class="rail-inner">
      ${showToc ? `<nav class="toc" aria-label="${escapeHtml(label(dictionary, "toc"))}"><h2>${escapeHtml(label(dictionary, "toc"))}</h2>${toc}</nav>` : ""}
      ${railHistory(data, dictionary)}
    </div></aside>
  </div>
  <script id="hope-align-data" type="application/json">${embeddedJson(data)}</script>
  <script>${script}</script>
</body>
</html>
`;
}
