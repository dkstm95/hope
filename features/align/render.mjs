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
  code: new URL("../../design/fonts/HopeCode.woff2", import.meta.url),
  sansBold: new URL("../../design/fonts/HopeSansBold.woff2", import.meta.url),
  sansLight: new URL("../../design/fonts/HopeSansLight.woff2", import.meta.url),
  sansMedium: new URL("../../design/fonts/HopeSansMedium.woff2", import.meta.url),
});

const bidiControls = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const phaseOrder = Object.freeze([
  "interviewing",
  "ready-proposed",
  "approved",
]);
const blockerTargets = Object.freeze({
  "experience-design": "perspectives",
  goal: "overview",
  "in-scope": "scope",
  "open-assumptions": "assumptions",
  "open-proposals": "proposals",
  "open-questions": "records",
  "out-of-scope": "scope",
  "product-requirements": "perspectives",
  scenarios: "scenarios",
  "shared-understanding": "perspectives",
  "success-conditions": "scope",
  "vertical-slice-perspective": "perspectives",
  "vertical-slices": "slices",
});

function authoredDomId(kind, id) {
  return `${kind}-${id}`;
}

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

function formatLabel(dictionary, key, replacements = {}) {
  let text = label(dictionary, key);
  for (const [name, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function localizedValue(dictionary, namespace, value) {
  const key = `${namespace}.${value}`;
  return dictionary[key] ?? value;
}

function list(items, render, emptyText, className = "plain-list") {
  if (items.length === 0) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `<ul class="${escapeHtml(className)}">${items.map(
    (item) => `<li>${render(item)}</li>`,
  ).join("")}</ul>`;
}

function section(id, title, content, { collapsed = false } = {}) {
  if (collapsed) {
    return `<details class="section section-collapsible" id="${escapeHtml(id)}">
      <summary class="section-heading"><h2>${escapeHtml(title)}</h2></summary>
      <div class="section-content">${content}</div>
    </details>`;
  }
  return `<section class="section" id="${escapeHtml(id)}">
    <h2 class="section-heading">${escapeHtml(title)}</h2>
    <div class="section-content">${content}</div>
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
    `--decide:${colors.decide}`,
    `--muted:${colors.muted}`,
    `--panel:${colors.panel}`,
    `--resolve:${colors.resolve}`,
    `--scope:${colors.scope}`,
    `--text:${colors.text}`,
    `--verify:${colors.verify}`,
  ].join(";");
}

function phaseTrack(session, dictionary) {
  const currentIndex = phaseOrder.indexOf(session.readiness.state);
  return `<ol class="phase-track" aria-label="${escapeHtml(label(dictionary, "align.progress"))}">
    ${phaseOrder.map((phase, index) => {
      const state = index < currentIndex
        ? "complete"
        : index === currentIndex ? "current" : "upcoming";
      const stateText = label(dictionary, `align.progress.${state}`);
      return `<li class="phase-step phase-${state}"${state === "current" ? ' aria-current="step"' : ""}>
        <span class="phase-marker" aria-hidden="true">${state === "complete" ? "✓" : index + 1}</span>
        <span class="phase-copy">
          <strong>${escapeHtml(label(dictionary, `align.phase.${phase}`))}</strong>
          <span>${escapeHtml(stateText)}</span>
        </span>
      </li>`;
    }).join("")}
  </ol>`;
}

function blockerLinks(session, dictionary) {
  if (session.result.blockers.length === 0) {
    return `<p class="blocker-clear"><span aria-hidden="true">✓</span>${escapeHtml(
      label(dictionary, "align.noBlockers"),
    )}</p>`;
  }
  return `<ul class="blocker-links">${session.result.blockers.map((blocker) => {
    const target = blockerTargets[blocker] ?? "records";
    const key = `align.blocker.${blocker}`;
    return `<li><a href="#${escapeHtml(target)}">${escapeHtml(
      dictionary[key] ?? blocker,
    )}</a></li>`;
  }).join("")}</ul>`;
}

function nextAction(session, dictionary) {
  const question = session.records.openQuestions[0];
  if (question) {
    const more = session.records.openQuestions.length - 1;
    return `<article class="next-card next-decision">
      <div class="next-card-head">
        <span class="status-marker marker-decide">${escapeHtml(
          label(dictionary, "align.nextDecision"),
        )}</span>
        ${more > 0 ? `<span class="next-count">${escapeHtml(formatLabel(
          dictionary,
          "align.moreQuestions",
          { count: more },
        ))}</span>` : ""}
      </div>
      <h3>${userText(question.question)}</h3>
      <p>${userText(question.recommendation)}</p>
      <a class="next-link" href="#${escapeHtml(authoredDomId("question", question.id))}">${escapeHtml(
        label(dictionary, "align.reviewOptions"),
      )}<span aria-hidden="true"> →</span></a>
    </article>`;
  }

  const blocker = session.result.blockers[0];
  if (session.readiness.state === "interviewing" && blocker) {
    const target = blockerTargets[blocker] ?? "records";
    const actionKey = `align.action.${blocker}`;
    return `<article class="next-card next-interviewing">
      <div class="next-card-head">
        <span class="status-marker">${escapeHtml(statusText(
          session.readiness.state,
          dictionary,
        ))}</span>
      </div>
      <h3>${escapeHtml(dictionary[actionKey] ?? label(
        dictionary,
        "align.next.interviewing",
      ))}</h3>
      <p>${userText(session.readiness.rationale)}</p>
      <a class="next-link" href="#${escapeHtml(target)}">${escapeHtml(
        label(dictionary, "align.reviewBlocker"),
      )}<span aria-hidden="true"> →</span></a>
    </article>`;
  }

  const target = session.readiness.state === "approved" ? "slices" : "records";
  return `<article class="next-card next-${escapeHtml(session.readiness.state)}">
    <div class="next-card-head">
      <span class="status-marker">${escapeHtml(statusText(
        session.readiness.state,
        dictionary,
      ))}</span>
    </div>
    <h3>${escapeHtml(label(dictionary, `align.next.${session.readiness.state}`))}</h3>
    <p>${userText(session.readiness.rationale)}</p>
    <a class="next-link" href="#${escapeHtml(target)}">${escapeHtml(
      label(dictionary, `align.nextLink.${session.readiness.state}`),
    )}<span aria-hidden="true"> →</span></a>
  </article>`;
}

function overview(session, dictionary) {
  const successPreview = session.understanding.success.slice(0, 3);
  const moreSuccess = session.understanding.success.length - successPreview.length;
  return `<section class="overview" id="overview" aria-labelledby="overview-title">
    <header class="overview-head">
      <div class="overview-title-row">
        <div>
          <p class="eyebrow">${escapeHtml(label(dictionary, "align.currentAlignment"))}</p>
          <h1>${userText(session.title)}</h1>
        </div>
        <span class="phase-badge">${escapeHtml(statusText(
          session.readiness.state,
          dictionary,
        ))}</span>
      </div>
      <dl class="overview-meta">
        <div><dt>${escapeHtml(label(dictionary, "align.revision"))}</dt><dd>${escapeHtml(session.revision)}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.risk"))}</dt><dd>${escapeHtml(
          localizedValue(dictionary, "align.risk", session.taskRisk),
        )}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.captured"))}</dt><dd><time datetime="${escapeHtml(
          session.snapshot.capturedAt,
        )}">${escapeHtml(session.snapshot.capturedAt)}</time></dd></div>
      </dl>
    </header>
    <h2 class="sr-only" id="overview-title">${escapeHtml(
      label(dictionary, "align.overview"),
    )}</h2>
    ${phaseTrack(session, dictionary)}
    <div class="overview-grid">
      <article class="goal-card">
        <p class="eyebrow">${escapeHtml(label(dictionary, "align.goal"))}</p>
        <p class="goal">${userText(session.understanding.goal)}</p>
        <div class="ready-when">
          <h3>${escapeHtml(label(dictionary, "align.readyWhen"))}</h3>
          ${list(
            successPreview,
            userText,
            label(dictionary, "align.noItems"),
            "check-list",
          )}
          ${moreSuccess > 0 ? `<a href="#scope">${escapeHtml(formatLabel(
            dictionary,
            "align.moreConditions",
            { count: moreSuccess },
          ))}</a>` : ""}
        </div>
      </article>
      ${nextAction(session, dictionary)}
    </div>
    <aside class="open-state" aria-label="${escapeHtml(label(dictionary, "align.blockers"))}">
      <strong>${escapeHtml(label(dictionary, "align.blockers"))}</strong>
      ${blockerLinks(session, dictionary)}
    </aside>
  </section>`;
}

function renderRecords(session, dictionary, sourceLabels) {
  const questions = session.records.openQuestions.length === 0
    ? `<div class="decision-clear"><span aria-hidden="true">✓</span><p><strong>${escapeHtml(
      label(dictionary, "align.noOpenQuestions"),
    )}</strong><br>${escapeHtml(label(
      dictionary,
      `align.noOpenQuestionsDetail.${session.readiness.state}`,
    ))}</p></div>`
    : `<div class="decision-focus">
      <div class="group-heading">
        <p class="eyebrow">${escapeHtml(label(dictionary, "align.openQuestions"))}</p>
        <p>${escapeHtml(label(dictionary, "align.openQuestionIntro"))}</p>
      </div>
      ${session.records.openQuestions.map((item) => `<article class="question-card" id="${escapeHtml(
        authoredDomId("question", item.id),
      )}">
        <div class="question-heading">
          <span class="status-marker marker-decide">${escapeHtml(
            label(dictionary, "align.nextDecision"),
          )}</span>
          <h3>${userText(item.question)}</h3>
        </div>
        <dl class="question-context">
          <div><dt>${escapeHtml(label(dictionary, "align.why"))}</dt><dd>${userText(item.whyItMatters)}</dd></div>
          <div><dt>${escapeHtml(label(dictionary, "align.recommendation"))}</dt><dd>${userText(item.recommendation)}</dd></div>
        </dl>
        <h4>${escapeHtml(label(dictionary, "align.options"))}</h4>
        ${list(
          item.options,
          (option) => `<strong>${userText(option.label)}</strong><span>${userText(option.effect)}</span>`,
          label(dictionary, "align.noItems"),
          "option-list",
        )}
      </article>`).join("")}
    </div>`;

  const decisions = `<article class="record-primary">
    <div class="group-heading">
      <p class="eyebrow">${escapeHtml(label(dictionary, "align.decisions"))}</p>
      <p>${escapeHtml(label(dictionary, "align.decisionIntro"))}</p>
    </div>
    ${list(
      session.records.decisions,
      (item) => `<p>${userText(item.text)}</p><p class="meta">${userText(item.rationale)}</p>`,
      label(dictionary, "align.noItems"),
      "decision-list",
    )}
  </article>`;

  const proposals = `<details class="record-disclosure" id="proposals">
    <summary><h3><span>${escapeHtml(label(
      dictionary,
      "align.proposals",
    ))}</span><span class="disclosure-count">${escapeHtml(
      session.records.proposals.length,
    )}</span></h3></summary>
    <div class="record-disclosure-content">
      ${list(
        session.records.proposals,
        (item) => `<span class="status-marker status-${escapeHtml(item.status)}">${escapeHtml(
          localizedValue(dictionary, "align.value", item.status),
        )}</span><p>${userText(item.text)}</p><p class="meta">${userText(item.rationale)}</p>`,
        label(dictionary, "align.noItems"),
        "record-list",
      )}
    </div>
  </details>`;

  const facts = `<details class="record-disclosure">
    <summary><h3><span>${escapeHtml(label(
      dictionary,
      "align.facts",
    ))}</span><span class="disclosure-count">${escapeHtml(
      session.records.facts.length,
    )}</span></h3></summary>
    <div class="record-disclosure-content">
      ${list(
        session.records.facts,
        (item) => `<p>${userText(item.text)}</p><p class="meta">${item.sourceIds.map(
          (sourceId) => userText(sourceLabels.get(sourceId) ?? sourceId),
        ).join(" · ")}</p>`,
        label(dictionary, "align.noItems"),
        "record-list",
      )}
    </div>
  </details>`;

  return `${questions}${decisions}<div class="record-secondary">${proposals}${facts}</div>`;
}

function clientScript(dictionary) {
  const labels = JSON.stringify({
    dark: label(dictionary, "align.useDarkTheme"),
    light: label(dictionary, "align.useLightTheme"),
  });
  return `(()=>{"use strict";const labels=${labels};const root=document.documentElement;const theme=document.getElementById("theme-toggle");const toc=document.querySelector(".toc-mobile");const currentTheme=()=>root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";const syncTheme=()=>{if(!theme)return;const next=currentTheme()==="dark"?"light":"dark";theme.setAttribute("aria-label",labels[next]);theme.setAttribute("title",labels[next]);for(const icon of theme.querySelectorAll("[data-theme-icon]"))icon.toggleAttribute("hidden",icon.dataset.themeIcon!==next);};const revealTarget=target=>{if(target.tagName==="DETAILS")target.open=true;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;};const focusTarget=target=>{const hadTabindex=target.hasAttribute("tabindex");if(!hadTabindex)target.setAttribute("tabindex","-1");target.focus({preventScroll:true});if(!hadTabindex)target.addEventListener("blur",()=>target.removeAttribute("tabindex"),{once:true});};const openTarget=()=>{if(!location.hash)return;const target=document.getElementById(location.hash.slice(1));if(!target)return;revealTarget(target);requestAnimationFrame(()=>target.scrollIntoView({block:"start"}));};syncTheme();theme?.addEventListener("click",()=>{root.dataset.theme=currentTheme()==="dark"?"light":"dark";syncTheme();});toc?.addEventListener("click",event=>{const link=event.target.closest("a");if(!link)return;toc.open=false;const target=document.getElementById(link.hash.slice(1));if(!target)return;revealTarget(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({block:"start"});});});matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",syncTheme);addEventListener("hashchange",openTarget);addEventListener("click",event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)requestAnimationFrame(openTarget);});openTarget();})();`;
}

function styles(fonts) {
  const [space1, space2, space3, space4, space5, space6] = SPACE;
  return `
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansLight}) format("woff2");font-weight:300;font-style:normal;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansMedium}) format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansBold}) format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Hope Code";src:url(data:font/woff2;base64,${fonts.code}) format("woff2");font-weight:400;font-style:normal;font-display:swap}
:root{color-scheme:light;${themeVariables(COLORS.light)}}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${themeVariables(COLORS.dark)}}}
:root[data-theme="dark"]{color-scheme:dark;${themeVariables(COLORS.dark)}}
*{box-sizing:border-box}
html{background:var(--bg);scroll-behavior:smooth}
body{margin:0;color:var(--text);background:var(--bg);font:300 ${TYPE.body.wide.fontSize}px/${TYPE.body.wide.lineHeight} "Hope Sans",sans-serif;text-rendering:optimizeLegibility}
h1,h2,h3,h4,strong,b{font-weight:700}
code{font-family:"Hope Code",ui-monospace,monospace;font-weight:400;overflow-wrap:anywhere}
bdi{overflow-wrap:anywhere}
a{color:var(--accent);text-underline-offset:.2em}
button,summary{font:inherit;color:inherit}
[id]:target{scroll-margin-top:${space5}px}
.skip{position:fixed;z-index:20;top:${space2}px;left:${space2}px;transform:translateY(-160%);padding:${space2}px ${space3}px;border:1px solid var(--component-border);background:var(--panel)}
.skip:focus{transform:none}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.topbar{border-bottom:1px solid var(--border);background:var(--panel)}
.topbar-inner{display:flex;position:relative;max-width:${LAYOUT.documentWidth}px;min-height:52px;margin:auto;padding:${space1}px ${space5}px;align-items:center;gap:${space4}px}
.brand{font:500 ${TYPE.brand.fontSize}px/${TYPE.brand.lineHeight} "Hope Sans",sans-serif;letter-spacing:.12em;white-space:nowrap}
.top-context{min-width:0;flex:1;color:var(--muted);text-align:center;font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.topbar-actions{display:flex;margin-left:auto;align-items:center;gap:${space2}px}
.theme-button{display:inline-grid;width:44px;height:44px;padding:${space1}px;place-items:center;border:1px solid var(--component-border);border-radius:${space2}px;background:var(--panel);cursor:pointer}
.theme-icon,.toc-icon{width:18px;height:18px;stroke:currentColor}
.theme-icon[hidden]{display:none}
.layout{display:grid;max-width:${LAYOUT.documentWidth}px;margin:auto;padding:${space5}px;grid-template-columns:minmax(0,1fr) ${LAYOUT.tableOfContentsWidth}px;gap:${space6}px}
.main{width:100%;max-width:${LAYOUT.contentWidth}px;min-width:0;counter-reset:align-section}
.toc-desktop{position:sticky;top:${space5}px;align-self:start;padding-left:${space4}px;border-left:1px solid var(--border)}
.toc-desktop h2,.toc-mobile summary{font-size:${TYPE.menu.fontSize}px;line-height:${TYPE.menu.lineHeight};font-weight:500;text-transform:uppercase;letter-spacing:.08em}
.toc-desktop ol{padding-left:${space5}px}
.toc-desktop li{margin:${space2}px 0}
.toc-desktop a,.toc-overview a{color:var(--muted);text-decoration:none;font-weight:500}
.toc-desktop a:hover,.toc-desktop a:focus-visible{color:var(--text)}
.toc-overview{margin-top:${space3}px}
.toc-mobile{display:none}
.overview{padding:${space4}px;border:1px solid var(--border);background:var(--panel)}
.overview-head{padding-bottom:${space3}px;border-bottom:1px solid var(--border)}
.overview-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:${space4}px}
.eyebrow{margin:0 0 ${space1}px;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
h1{max-width:${LAYOUT.proseWidth};margin:0;font-size:${TYPE.pageTitle.wide.fontSize}px;line-height:${TYPE.pageTitle.wide.lineHeight}}
.phase-badge,.status-marker{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:2px ${space2}px;border:1px solid var(--component-border);border-radius:999px;font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.phase-badge{flex:none}
.overview-meta{display:flex;flex-wrap:wrap;gap:${space2}px ${space4}px;margin:${space3}px 0 0;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.overview-meta>div{display:flex;gap:${space1}px}
.overview-meta dt{font-weight:500}
.overview-meta dd{margin:0}
.phase-track{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${space3}px;margin:${space4}px 0;padding:0;list-style:none}
.phase-step{display:flex;position:relative;min-width:0;align-items:center;gap:${space2}px}
.phase-step:not(:last-child)::after{position:absolute;z-index:0;top:16px;left:32px;width:calc(100% + ${space3}px - 32px);border-top:1px solid var(--border);content:""}
.phase-marker{display:inline-grid;position:relative;z-index:1;width:32px;height:32px;flex:0 0 32px;place-items:center;border:1px solid var(--component-border);border-radius:50%;background:var(--panel);font-weight:700}
.phase-current .phase-marker{border-color:var(--accent);background:var(--accent);color:var(--panel)}
.phase-complete .phase-marker{border-color:var(--accent);color:var(--accent)}
.phase-copy{display:flex;position:relative;z-index:1;min-width:0;padding-right:${space2}px;flex-direction:column;background:var(--panel)}
.phase-copy strong{white-space:nowrap}
.phase-copy span{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.phase-upcoming{color:var(--muted)}
.overview-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:${space3}px}
.goal-card,.next-card{min-width:0;padding:${space4}px;border:1px solid var(--component-border)}
.goal-card{background:var(--bg)}
.goal{max-width:${LAYOUT.proseWidth};margin:0;font-size:1.12em;line-height:1.5}
.ready-when{margin-top:${space4}px;padding-top:${space3}px;border-top:1px solid var(--border)}
.ready-when h3{margin:0 0 ${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.check-list,.plain-list,.record-list,.decision-list,.option-list,.blocker-links{margin:0;padding:0;list-style:none}
.check-list>li{position:relative;padding-left:${space4}px}
.check-list>li+li{margin-top:${space1}px}
.check-list>li::before{position:absolute;left:0;color:var(--accent);font-weight:700;content:"✓"}
.ready-when>a{display:inline-block;margin-top:${space2}px;font-size:${TYPE.supporting.wide.fontSize}px}
.next-card{display:flex;position:relative;overflow:hidden;flex-direction:column;background:var(--panel)}
.next-card::before{position:absolute;inset:0 auto 0 0;width:4px;background:var(--accent);content:""}
.next-decision::before{background:var(--decide)}
.next-card-head{display:flex;align-items:center;justify-content:space-between;gap:${space2}px}
.marker-decide{border-color:var(--decide);color:var(--decide)}
.next-count{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.next-card h3{margin:${space3}px 0 ${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px;line-height:${TYPE.subsectionTitle.wide.lineHeight}}
.next-card p{margin:0}
.next-link{margin-top:auto;padding-top:${space4}px;font-weight:500}
.open-state{display:grid;margin-top:${space3}px;padding:${space2}px ${space3}px;grid-template-columns:120px minmax(0,1fr);gap:${space3}px;align-items:start;border:1px solid var(--border);background:var(--bg)}
.open-state>strong{font-size:${TYPE.supporting.wide.fontSize}px}
.blocker-links{display:flex;flex-wrap:wrap;gap:${space1}px ${space2}px}
.blocker-links li{display:flex;align-items:center;gap:${space1}px}
.blocker-links li::before{width:6px;height:6px;border-radius:50%;background:var(--decide);content:""}
.blocker-clear{display:flex;margin:0;align-items:center;gap:${space2}px;color:var(--muted)}
.blocker-clear span{color:var(--accent);font-weight:700}
.section{margin-top:${space6}px;padding-top:${space4}px;border-top:1px solid var(--border);counter-increment:align-section}
.section-heading{display:flex;margin:0 0 ${space4}px;align-items:baseline;gap:${space2}px;font-size:${TYPE.sectionTitle.wide.fontSize}px;line-height:${TYPE.sectionTitle.wide.lineHeight}}
.section-heading>h2{margin:0;font:inherit}
.section-heading::before{color:var(--accent);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500;content:counter(align-section,decimal-leading-zero)}
details.section>summary{min-height:44px;margin:0;padding:${space2}px 0;align-items:center;cursor:pointer;list-style:none}
details.section[open]>summary{margin-bottom:${space4}px}
details.section>summary::-webkit-details-marker{display:none}
details.section>summary::after{margin-left:auto;color:var(--muted);content:"+"}
details.section[open]>summary::after{content:"−"}
.section-content{min-width:0}
.subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${space3}px}
.panel{min-width:0;padding:${space4}px;border:1px solid var(--component-border);background:var(--panel)}
.panel h3,.card h3{margin:0 0 ${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.panel-success{margin-top:${space3}px}
.plain-list>li{position:relative;padding-left:${space3}px}
.plain-list>li+li{margin-top:${space2}px}
.plain-list>li::before{position:absolute;left:0;color:var(--accent);content:"•"}
.scenario-list{display:grid;gap:${space3}px}
.scenario{display:grid;padding:${space3}px ${space4}px;grid-template-columns:140px minmax(0,1fr);gap:${space3}px;border:1px solid var(--component-border);background:var(--panel)}
.scenario-label{display:flex;align-items:flex-start;gap:${space2}px;color:var(--muted);font-weight:500}
.scenario-label::before{width:8px;height:8px;margin-top:.45em;border-radius:50%;background:var(--accent);content:""}
.scenario h3{margin:0 0 ${space1}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.scenario p{margin:0}
.decision-focus{display:grid;gap:${space3}px;margin-bottom:${space5}px}
.group-heading{display:grid;grid-template-columns:180px minmax(0,1fr);gap:${space3}px;align-items:baseline}
.group-heading p{margin:0}
.question-card{padding:${space4}px;border:1px solid var(--decide);background:var(--panel)}
.question-card:target{outline:3px solid var(--accent);outline-offset:3px}
.question-heading{display:flex;align-items:flex-start;gap:${space3}px}
.question-heading h3{margin:0;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.question-context{display:grid;margin:${space3}px 0;gap:${space2}px}
.question-context>div{display:grid;grid-template-columns:140px minmax(0,1fr);gap:${space3}px}
.question-context dt{color:var(--muted);font-weight:500}
.question-context dd{margin:0}
.question-card h4{margin:${space3}px 0 ${space2}px;font-size:inherit}
.option-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:${space2}px}
.option-list li{display:flex;padding:${space3}px;border:1px solid var(--border);flex-direction:column;gap:${space1}px;background:var(--bg)}
.decision-clear{display:flex;margin-bottom:${space4}px;padding:${space3}px ${space4}px;align-items:center;gap:${space3}px;border:1px solid var(--border);background:var(--panel)}
.decision-clear>span{color:var(--accent);font-size:1.4em;font-weight:700}
.decision-clear p{margin:0}
.record-primary{padding:${space4}px;border:1px solid var(--component-border);background:var(--panel)}
.decision-list{margin-top:${space3}px;counter-reset:decision}
.decision-list>li{display:grid;position:relative;padding:${space3}px 0 ${space3}px 48px;border-top:1px solid var(--border);counter-increment:decision}
.decision-list>li::before{position:absolute;top:${space3}px;left:0;color:var(--accent);font-weight:700;content:counter(decision,decimal-leading-zero)}
.decision-list p{margin:0}
.decision-list .meta{margin-top:${space1}px}
.record-secondary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${space3}px;margin-top:${space3}px}
.record-disclosure{border:1px solid var(--component-border);background:var(--panel)}
.record-disclosure>summary{display:flex;min-height:48px;padding:${space2}px ${space3}px;align-items:center;cursor:pointer;list-style:none}
.record-disclosure>summary::-webkit-details-marker{display:none}
.record-disclosure>summary h3{display:flex;width:100%;min-width:0;margin:0;align-items:center;justify-content:space-between;gap:${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.record-disclosure>summary h3>span:first-child{min-width:0;overflow-wrap:anywhere}
.disclosure-count{display:inline-grid;min-width:24px;height:24px;padding:0 ${space1}px;flex:none;place-items:center;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.record-disclosure-content{padding:0 ${space3}px ${space3}px}
.record-list>li{padding:${space3}px 0;border-top:1px solid var(--border)}
.record-list p{margin:${space1}px 0 0}
.status-marker.status-accepted,.status-marker.status-confirmed{border-color:var(--accent);color:var(--accent)}
.status-marker.status-rejected{border-color:var(--scope);color:var(--muted)}
.status-marker.status-open{border-color:var(--decide);color:var(--decide)}
.meta{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.tag{display:inline-flex;margin-right:${space1}px;padding:2px ${space2}px;border:1px solid var(--border);border-radius:999px;font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.unknown-list{display:grid;gap:${space2}px;margin:0;padding:0;list-style:none}
.unknown-list>li{padding:${space3}px ${space4}px;border-left:3px solid var(--scope);background:var(--panel)}
.unknown-list p{margin:${space1}px 0 0}
.perspective-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${space3}px}
.perspective{padding:${space3}px;border:1px solid var(--component-border);background:var(--panel)}
.perspective h3{margin:0 0 ${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.perspective p{margin:${space1}px 0}
.perspective-skipped{color:var(--muted);border-color:var(--border)}
.slice-grid{display:grid;gap:${space3}px}
.slice-grid.slice-short{grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}
.slice{position:relative;min-width:0;padding:${space4}px;border:1px solid var(--component-border);background:var(--panel)}
.slice-short>.slice:not(:last-child)::after{position:absolute;top:50%;right:-23px;color:var(--accent);font-size:18px;font-weight:700;content:"→";transform:translateY(-50%)}
.slice-number{display:inline-block;margin-bottom:${space2}px;color:var(--accent);font-weight:700}
.slice h3{margin:0 0 ${space2}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}
.slice>p{margin:0}
.slice dl{margin:${space3}px 0 0;padding-top:${space2}px;border-top:1px solid var(--border)}
.slice dl>div{margin-top:${space2}px}
.slice dt{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.slice dd{margin:${space1}px 0 0}
.change-list{margin:0;padding:0;list-style:none}
.change-list>li{display:grid;position:relative;padding:0 0 ${space4}px 72px;grid-template-columns:1fr}
.change-list>li:not(:last-child)::before{position:absolute;top:24px;bottom:0;left:28px;border-left:1px solid var(--border);content:""}
.change-round{position:absolute;top:0;left:0;min-width:56px;padding:2px ${space2}px;border:1px solid var(--border);border-radius:999px;background:var(--panel);text-align:center;font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.audit-grid{display:grid;gap:${space3}px}
.audit-disclosure{border:1px solid var(--component-border);background:var(--panel)}
.audit-disclosure>summary{display:flex;min-height:48px;padding:${space2}px ${space3}px;align-items:center;cursor:pointer;list-style:none}
.audit-disclosure>summary::-webkit-details-marker{display:none}
.audit-disclosure>summary h3{width:100%;min-width:0;margin:0;font-size:${TYPE.subsectionTitle.wide.fontSize}px;overflow-wrap:anywhere}
.audit-disclosure-content{padding:0 ${space3}px ${space3}px}
.source-list{display:grid;gap:${space2}px}
.source{border:1px solid var(--border);background:var(--panel)}
.source>summary{display:flex;min-height:48px;padding:${space2}px ${space3}px;align-items:center;justify-content:space-between;gap:${space3}px;cursor:pointer;list-style:none}
.source>summary::-webkit-details-marker{display:none}
.source>summary strong{min-width:0;overflow-wrap:anywhere}
.source-kind{flex:none;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.source-content{padding:0 ${space3}px ${space3}px;border-top:1px solid var(--border)}
.source-content dl{margin:0}
.source-content dl>div{display:grid;padding-top:${space2}px;grid-template-columns:100px minmax(0,1fr);gap:${space2}px}
.source-content dt{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.source-content dd{min-width:0;margin:0;overflow-wrap:anywhere}
.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${space2}px;margin:0}
.metric-grid div{padding:${space2}px ${space3}px;border:1px solid var(--border);background:var(--panel)}
.metric-grid dt{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.metric-grid dd{margin:${space1}px 0 0;font-weight:500}
.empty{color:var(--muted);font-style:italic}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media(max-width:${LAYOUT.tocBreakpoint}px){
 .layout{display:block;max-width:${LAYOUT.contentWidth}px}
 .toc-desktop{display:none}
 .toc-mobile{display:block;position:relative}
 .toc-mobile>summary{display:flex;height:44px;padding:0 ${space3}px;align-items:center;gap:${space2}px;border:1px solid var(--component-border);border-radius:${space2}px;background:var(--panel);cursor:pointer;list-style:none}
 .toc-mobile>summary::-webkit-details-marker{display:none}
 .toc-mobile-panel{position:absolute;z-index:10;top:calc(100% + ${space2}px);right:0;width:min(520px,calc(100vw - ${space5}px * 2));max-height:calc(100vh - 76px);overflow:auto;padding:${space3}px;border:1px solid var(--component-border);background:var(--panel)}
 .toc-mobile-panel ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${space1}px ${space3}px;padding-left:${space4}px}
 .toc-mobile-panel a{color:var(--muted);text-decoration:none;font-weight:500}
}
@media(max-width:${LAYOUT.narrowBreakpoint}px){
 body{font-size:${TYPE.body.narrow.fontSize}px;line-height:${TYPE.body.narrow.lineHeight}}
 .layout{padding:${space4}px ${space3}px}
 .topbar-inner{padding:${space1}px ${space3}px}
 .top-context{display:none}
 h1{font-size:${TYPE.pageTitle.narrow.fontSize}px;line-height:${TYPE.pageTitle.narrow.lineHeight}}
 .section-heading{font-size:${TYPE.sectionTitle.narrow.fontSize}px;line-height:${TYPE.sectionTitle.narrow.lineHeight}}
 .overview{padding:${space3}px}
 .overview-title-row{flex-direction:column}
 .overview-grid,.subgrid,.record-secondary,.perspective-grid,.metric-grid{grid-template-columns:1fr}
 .goal-card,.next-card,.panel{padding:${space3}px}
 .phase-track{gap:${space1}px}
 .phase-step{align-items:flex-start}
 .phase-step:not(:last-child)::after{top:14px;left:28px;width:calc(100% + ${space1}px - 28px)}
 .phase-marker{width:28px;height:28px;flex-basis:28px}
 .phase-copy{padding-right:${space1}px}
 .phase-copy strong{font-size:${TYPE.supporting.narrow.fontSize}px;white-space:normal}
 .phase-copy span{font-size:${TYPE.micro.compactFontSize}px}
 .open-state,.group-heading,.scenario,.question-context>div{grid-template-columns:1fr;gap:${space1}px}
 .question-heading{flex-direction:column;gap:${space2}px}
 .option-list{grid-template-columns:1fr}
 .slice-grid.slice-short{grid-template-columns:1fr;gap:28px}
 .slice-short>.slice:not(:last-child)::after{top:auto;right:50%;bottom:-25px;content:"↓";transform:translateX(50%)}
 .source-content dl>div{grid-template-columns:1fr;gap:${space1}px}
 .eyebrow,.phase-badge,.status-marker,.meta,.overview-meta{font-size:${TYPE.supporting.narrow.fontSize}px}
}
@media(max-width:${LAYOUT.compactBreakpoint}px){
 .layout{padding:${space3}px}
 .topbar-inner{gap:${space2}px}
 .overview-meta>div:last-child{display:none}
 .phase-copy span{display:none}
 .toc-mobile-panel{width:calc(100vw - ${space3}px * 2)}
 .toc-mobile-panel ol{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
@media(forced-colors:active){.phase-marker,.overview,.goal-card,.next-card,.panel,.question-card,.record-primary,.record-disclosure,.audit-disclosure,.perspective,.slice,.source{forced-color-adjust:auto}.next-card::before,.scenario-label::before,.blocker-links li::before{background:CanvasText}}
@media print{
 :root,:root[data-theme],:root:not([data-theme="light"]){color-scheme:light;${themeVariables(COLORS.light)};--bg:#fff;--border:#bbb;--muted:#555;--panel:#fff;--text:#000}
 .toc-desktop,.toc-mobile,.theme-button,.skip{display:none}
 .layout{display:block;max-width:none;padding:0}
 .main{max-width:none}
 .overview,.section,.panel,.question-card,.record-primary,.record-disclosure,.audit-disclosure,.perspective,.slice,.source{break-inside:avoid}
 .section-collapsible>.section-content,.record-disclosure>.record-disclosure-content,.audit-disclosure>.audit-disclosure-content,.source>.source-content{display:block!important}
 details::details-content{content-visibility:visible}
 a{color:inherit;text-decoration:none}
}
`;
}

export async function renderAlignSession(session, { fonts } = {}) {
  const dictionary = await loadLocale(session.locale, ["common", "align"]);
  const fontBytes = fonts ?? Object.fromEntries(await Promise.all(
    Object.entries(fontUrls).map(async ([name, url]) => [name, await readFile(url)]),
  ));
  const script = clientScript(dictionary);
  const css = styles(Object.fromEntries(Object.entries(fontBytes).map(
    ([name, bytes]) => [name, bytes.toString("base64")],
  )));
  const sourceLabels = new Map(
    session.snapshot.sources.map((source) => [source.id, source.label]),
  );

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
  </div>
  <article class="panel panel-success"><h3>${escapeHtml(label(dictionary, "align.success"))}</h3>${list(
    session.understanding.success,
    userText,
    label(dictionary, "align.noItems"),
    "check-list",
  )}</article>`;

  const scenarios = session.understanding.scenarios.length === 0
    ? `<p class="empty">${escapeHtml(label(dictionary, "align.noItems"))}</p>`
    : `<div class="scenario-list">${session.understanding.scenarios.map((item) => `<article class="scenario">
      <div class="scenario-label">${escapeHtml(label(dictionary, `align.${item.kind}`))}</div>
      <div><h3>${userText(item.situation)}</h3><p><strong>${escapeHtml(
        label(dictionary, "align.expected"),
      )}:</strong> ${userText(item.expected)}</p></div>
    </article>`).join("")}</div>`;

  const assumptions = list(
    session.assumptions,
    (item) => `<span class="tag">${escapeHtml(localizedValue(
      dictionary,
      "align.origin",
      item.origin,
    ))}</span><span class="tag">${escapeHtml(localizedValue(
      dictionary,
      "align.value",
      item.status,
    ))}</span>${userText(item.text)}`,
    label(dictionary, "align.noItems"),
    "unknown-list",
  );
  const uncertainties = list(
    session.uncertainties,
    (item) => `<span class="tag">${escapeHtml(localizedValue(
      dictionary,
      "align.uncertainty",
      item.classification,
    ))}</span>${userText(item.text)}<p class="meta">${userText(item.nextStep)}</p>`,
    label(dictionary, "align.noItems"),
    "unknown-list",
  );
  const perspectives = `<div class="perspective-grid">${session.perspectives.map((item) => (
    `<article class="perspective${item.state === "skipped" ? " perspective-skipped" : ""}">
      <h3><span class="tag">${escapeHtml(localizedValue(
        dictionary,
        "align.value",
        item.state,
      ))}</span>${escapeHtml(localizedValue(
        dictionary,
        "align.perspective",
        item.kind,
      ))}</h3>
      <p>${userText(item.reason)}</p>
      ${list(
        item.items,
        (detail) => `<strong>${userText(detail.title)}</strong><p>${userText(detail.detail)}</p>`,
        label(dictionary, "align.noItems"),
      )}
    </article>`
  )).join("")}</div>`;
  const slices = session.slices.length === 0
    ? `<p class="empty">${escapeHtml(label(dictionary, "align.noItems"))}</p>`
    : `<div class="slice-grid${session.slices.length >= 2 && session.slices.length <= 3 ? " slice-short" : ""}">${session.slices.map((item, index) => `<article class="slice">
      <span class="slice-number">${String(index + 1).padStart(2, "0")}</span>
      <h3>${userText(item.title)}</h3>
      <p>${userText(item.userChange)}</p>
      <dl>
        <div><dt>${escapeHtml(label(dictionary, "align.workScope"))}</dt><dd>${userText(item.scope)}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.verification"))}</dt><dd>${userText(item.verification)}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.failureRecovery"))}</dt><dd>${userText(item.failureRecovery)}</dd></div>
      </dl>
    </article>`).join("")}</div>`;
  const changes = list(
    session.changes,
    (item) => `<span class="change-round">${escapeHtml(formatLabel(
      dictionary,
      "align.round",
      { round: item.round },
    ))}</span>${userText(item.summary)}`,
    label(dictionary, "align.noItems"),
    "change-list",
  );
  const sources = `<div class="source-list">${session.snapshot.sources.map((source) => `<details class="source" id="${escapeHtml(
    authoredDomId("source", source.id),
  )}">
    <summary><strong>${userText(source.label)}</strong><span class="source-kind">${escapeHtml(
      localizedValue(dictionary, "align.sourceKind", source.kind),
    )}</span></summary>
    <div class="source-content"><dl>
      <div><dt>${escapeHtml(label(dictionary, "align.sourceLocation"))}</dt><dd>${userText(source.locator)}</dd></div>
      ${source.revision ? `<div><dt>${escapeHtml(label(dictionary, "align.sourceRevision"))}</dt><dd><code>${userText(source.revision)}</code></dd></div>` : ""}
      ${source.digest ? `<div><dt>${escapeHtml(label(dictionary, "align.sourceDigest"))}</dt><dd><code>${userText(source.digest)}</code></dd></div>` : ""}
    </dl></div>
  </details>`).join("")}</div>`;
  const assumptionsAndUncertainty = `<div class="subgrid">
    <article class="panel"><h3>${escapeHtml(label(
      dictionary,
      "align.assumptions",
    ))}</h3>${assumptions}</article>
    <article class="panel"><h3>${escapeHtml(label(
      dictionary,
      "align.uncertainties",
    ))}</h3>${uncertainties}</article>
  </div>`;
  const auditTrail = `<div class="audit-grid">
    ${session.changes.length === 0 ? "" : `<details class="audit-disclosure" id="changes">
      <summary><h3>${escapeHtml(label(dictionary, "align.changes"))}</h3></summary>
      <div class="audit-disclosure-content">${changes}</div>
    </details>`}
    <details class="audit-disclosure" id="sources">
      <summary><h3>${escapeHtml(label(dictionary, "align.sources"))}</h3></summary>
      <div class="audit-disclosure-content">${sources}</div>
    </details>
    <details class="audit-disclosure" id="metrics">
      <summary><h3>${escapeHtml(label(dictionary, "align.metrics"))}</h3></summary>
      <div class="audit-disclosure-content">${metricRows(session, dictionary)}</div>
    </details>
  </div>`;

  const sections = [
    {
      html: section("scope", label(dictionary, "align.scope"), scope),
      id: "scope",
      title: label(dictionary, "align.scope"),
    },
    {
      html: section("scenarios", label(dictionary, "align.scenarios"), scenarios),
      id: "scenarios",
      title: label(dictionary, "align.scenarios"),
    },
    {
      html: section(
        "records",
        label(dictionary, "align.sharedState"),
        renderRecords(session, dictionary, sourceLabels),
      ),
      id: "records",
      title: label(dictionary, "align.sharedState"),
    },
    ...(session.assumptions.length === 0 && session.uncertainties.length === 0
      ? [] : [{
      html: section(
        "assumptions",
        label(dictionary, "align.assumptionsAndUncertainty"),
        assumptionsAndUncertainty,
      ),
      id: "assumptions",
      title: label(dictionary, "align.assumptionsAndUncertainty"),
    }]),
    {
      html: section("slices", label(dictionary, "align.slices"), slices),
      id: "slices",
      title: label(dictionary, "align.slices"),
    },
    {
      html: section(
        "perspectives",
        label(dictionary, "align.perspectives"),
        perspectives,
        { collapsed: true },
      ),
      id: "perspectives",
      title: label(dictionary, "align.perspectives"),
    },
    {
      html: section(
        "history",
        label(dictionary, "align.auditTrail"),
        auditTrail,
        { collapsed: true },
      ),
      id: "history",
      title: label(dictionary, "align.auditTrail"),
    },
  ];
  const themeAttribute = session.theme === "system"
    ? ""
    : ` data-theme="${escapeHtml(session.theme)}"`;
  const toc = `<div class="toc-overview"><a href="#overview">${escapeHtml(
    label(dictionary, "align.overview"),
  )}</a></div><ol>${sections.map(
    (item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></li>`,
  ).join("")}</ol>`;
  const document = `<!doctype html>
<html lang="${escapeHtml(session.locale)}"${themeAttribute}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'sha256-${sha256(css, "base64")}'; script-src 'sha256-${sha256(script, "base64")}'">
  <title>${escapeHtml(session.title)} · Hope align</title>
  <style>${css}</style>
</head>
<body>
  <a class="skip" href="#alignment">${escapeHtml(label(dictionary, "align.skip"))}</a>
  <header class="topbar"><div class="topbar-inner">
    <div class="brand">HOPE · ALIGN</div>
    <div class="top-context">${escapeHtml(label(dictionary, "align.revision"))} ${escapeHtml(session.revision)} · ${escapeHtml(statusText(session.readiness.state, dictionary))}</div>
    <div class="topbar-actions">
      <button class="theme-button" id="theme-toggle" type="button" aria-label="${escapeHtml(
        label(dictionary, session.theme === "dark" ? "align.useLightTheme" : "align.useDarkTheme"),
      )}" title="${escapeHtml(
        label(dictionary, session.theme === "dark" ? "align.useLightTheme" : "align.useDarkTheme"),
      )}">
        <svg class="theme-icon" data-theme-icon="dark" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${session.theme === "dark" ? " hidden" : ""}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path>
        </svg>
        <svg class="theme-icon" data-theme-icon="light" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${session.theme === "dark" ? "" : " hidden"}>
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>
        </svg>
      </button>
      <details class="toc-mobile">
        <summary>
          <svg class="toc-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>
          </svg>
          ${escapeHtml(label(dictionary, "align.contents"))}
        </summary>
        <nav class="toc-mobile-panel" aria-label="${escapeHtml(label(dictionary, "align.contents"))}">${toc}</nav>
      </details>
    </div>
  </div></header>
  <div class="layout">
    <main class="main" id="alignment">
      ${overview(session, dictionary)}
      ${sections.map((item) => item.html).join("")}
    </main>
    <nav class="toc-desktop" aria-label="${escapeHtml(label(dictionary, "align.contents"))}">
      <h2>${escapeHtml(label(dictionary, "align.contents"))}</h2>
      ${toc}
    </nav>
  </div>
  <script>${script}</script>
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
