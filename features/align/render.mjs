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
const blockerTargets = Object.freeze({
  "experience-design": "agreement",
  goal: "overview",
  "in-scope": "scope",
  "open-assumptions": "agreement",
  "open-proposals": "agreement",
  "open-questions": "agreement",
  "out-of-scope": "scope",
  "preview-required": "preview",
  "product-requirements": "agreement",
  scenarios: "behavior",
  "shared-understanding": "agreement",
  "success-conditions": "scope",
  "vertical-slice-perspective": "work",
  "vertical-slices": "work",
});

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

function localizedValue(dictionary, namespace, value) {
  return dictionary[`${namespace}.${value}`] ?? value;
}

function statusText(session, dictionary) {
  return label(dictionary, `align.status.${session.readiness.state}`);
}

function list(items, render, className = "plain-list") {
  if (items.length === 0) return "";
  return `<ul class="${escapeHtml(className)}">${items.map(
    (item) => `<li>${render(item)}</li>`,
  ).join("")}</ul>`;
}

function disclosureChevron() {
  return '<span class="disclosure-chevron" aria-hidden="true">›</span>';
}

function agreementRecords(session) {
  const sourceLabels = new Map(
    session.snapshot.sources.map((source) => [source.id, source.label]),
  );
  return [
    ...session.records.decisions.map((item) => ({
      basis: item.sourceIds.map((sourceId) => sourceLabels.get(sourceId) ?? sourceId),
      detail: item.rationale,
      id: item.id,
      kind: "decision",
      status: "accepted",
      text: item.text,
    })),
    ...session.records.proposals
      .filter((item) => ["accepted", "delegated", "open"].includes(item.status))
      .map((item) => ({
        basis: [],
        detail: item.rationale,
        id: item.id,
        kind: "proposal",
        status: item.status,
        text: item.text,
      })),
  ];
}

function primaryAgreementRecords(session, agreements) {
  const settled = agreements.filter((item) => item.status !== "open");
  if (!session.presentation) return settled;
  const primaryIds = new Set(session.presentation.primaryAgreementIds);
  return settled.filter((item) => primaryIds.has(item.id));
}

function agreementKind(item, dictionary) {
  if (item.kind === "decision") return label(dictionary, "align.decision");
  return `${label(dictionary, "align.proposals")} · ${localizedValue(
    dictionary,
    "align.value",
    item.status,
  )}`;
}

function overviewPrimaryAgreements(session, dictionary) {
  if (!session.presentation) return "";
  const agreements = primaryAgreementRecords(session, agreementRecords(session));
  if (agreements.length === 0) return "";
  return `<div class="overview-agreements">
    <h3>${escapeHtml(label(dictionary, "align.primaryAgreements"))}</h3>
    <ol>${agreements.map((item) => `<li><a href="#agreement-${escapeHtml(
      item.id,
    )}">${userText(item.text)}</a></li>`).join("")}</ol>
  </div>`;
}

function section(id, title, content) {
  if (!content) return "";
  return `<section class="section" id="${escapeHtml(id)}">
    <h2><span class="section-number" aria-hidden="true"></span>${escapeHtml(title)}</h2>
    <div class="section-body">${content}</div>
  </section>`;
}

function nextAction(session, dictionary) {
  const question = session.records.openQuestions[0];
  if (question) {
    return `<aside class="next-action next-action-question">
      <p class="kicker">${escapeHtml(label(dictionary, "align.nextDecision"))}</p>
      <h2>${userText(question.question)}</h2>
      <p>${userText(question.recommendation)}</p>
      <a href="#question-${escapeHtml(question.id)}">${escapeHtml(
        label(dictionary, "align.reviewOptions"),
      )}<span aria-hidden="true"> →</span></a>
    </aside>`;
  }
  const blocker = session.result.blockers[0];
  if (session.readiness.state === "interviewing" && blocker) {
    const target = blockerTargets[blocker] ?? "agreement";
    return `<aside class="next-action">
      <p class="kicker">${escapeHtml(label(dictionary, "align.nextAction"))}</p>
      <h2>${escapeHtml(dictionary[`align.action.${blocker}`] ?? blocker)}</h2>
      <p>${userText(session.readiness.rationale)}</p>
      <a href="#${target}">${escapeHtml(label(
        dictionary,
        "align.reviewBlocker",
      ))}<span aria-hidden="true"> →</span></a>
    </aside>`;
  }
  const key = `align.next.${session.readiness.state}`;
  const target = session.readiness.state === "approved" ? "work" : "agreement";
  return `<aside class="next-action">
    <p class="kicker">${escapeHtml(label(dictionary, "align.nextAction"))}</p>
    <h2>${escapeHtml(label(dictionary, key))}</h2>
    <p>${userText(session.readiness.rationale)}</p>
    ${overviewPrimaryAgreements(session, dictionary)}
    <a href="#${target}">${escapeHtml(label(
      dictionary,
      `align.nextLink.${session.readiness.state}`,
    ))}<span aria-hidden="true"> →</span></a>
  </aside>`;
}

function overview(session, dictionary) {
  return `<section class="overview" id="overview" aria-labelledby="page-title">
    <p class="status"><span aria-hidden="true"></span>${escapeHtml(
      statusText(session, dictionary),
    )}</p>
    <h1 id="page-title">${userText(session.title)}</h1>
    <p class="goal">${userText(session.understanding.goal)}</p>
    ${nextAction(session, dictionary)}
  </section>`;
}

function scopeMarkup(session, dictionary) {
  return `<div class="scope-grid">
    <div><h3>${escapeHtml(label(dictionary, "align.inScope"))}</h3>${list(
      session.understanding.inScope,
      userText,
    )}</div>
    <div><h3>${escapeHtml(label(dictionary, "align.outOfScope"))}</h3>${list(
      session.understanding.outOfScope,
      userText,
    )}</div>
  </div>
  <div class="success"><h3>${escapeHtml(label(dictionary, "align.success"))}</h3>${list(
    session.understanding.success,
    userText,
    "check-list",
  )}</div>`;
}

function scenariosMarkup(session, dictionary) {
  return `<ol class="scenario-list">${session.understanding.scenarios.map(
    (item) => `<li>
      <p class="kicker">${escapeHtml(label(dictionary, `align.${item.kind}`))}</p>
      <h3>${userText(item.situation)}</h3>
      <p>${userText(item.expected)}</p>
    </li>`,
  ).join("")}</ol>`;
}

function previewNode(node, frameId) {
  const id = `preview-${frameId}-${node.id}`;
  const emphasis = node.emphasis ? ` preview-${node.emphasis}` : "";
  if (node.type === "group") {
    return `<div class="preview-node preview-group preview-${escapeHtml(
      node.layout,
    )}${emphasis}" id="${escapeHtml(id)}"${node.label ? ` aria-label="${escapeHtml(node.label)}"` : ""}>${
      node.children.map((child) => previewNode(child, frameId)).join("")
    }</div>`;
  }
  if (node.type === "heading") {
    return `<p class="preview-node preview-heading preview-heading-${escapeHtml(
      node.level,
    )}${emphasis}" id="${escapeHtml(id)}">${userText(node.text)}</p>`;
  }
  if (node.type === "text") {
    return `<p class="preview-node preview-text-node${emphasis}" id="${escapeHtml(id)}">${userText(
      node.text,
    )}</p>`;
  }
  if (node.type === "list") {
    return `<div class="preview-node preview-list${emphasis}" id="${escapeHtml(id)}">${
      node.label ? `<p class="preview-label">${userText(node.label)}</p>` : ""
    }${list(node.items, userText)}</div>`;
  }
  if (node.type === "status") {
    return `<p class="preview-node preview-status${emphasis}" id="${escapeHtml(id)}"><span aria-hidden="true"></span>${userText(
      node.text,
    )}</p>`;
  }
  if (node.type === "action") {
    return `<p class="preview-node preview-action${emphasis}" id="${escapeHtml(id)}"><span>${userText(
      node.text,
    )}</span></p>`;
  }
  return `<hr class="preview-node preview-divider" id="${escapeHtml(id)}"${
    node.label ? ` aria-label="${escapeHtml(node.label)}"` : ""
  }>`;
}

function flattenPreview(node, depth = 0) {
  const prefix = "—".repeat(Math.min(depth, 3));
  const own = [];
  if (node.label) own.push(`${prefix}${node.label}`);
  if (node.text) own.push(`${prefix}${node.text}`);
  if (node.items) own.push(...node.items.map((item) => `${prefix}${item}`));
  if (node.children) {
    for (const child of node.children) own.push(...flattenPreview(child, depth + 1));
  }
  return own;
}

function previewFrameMarkup(frame, screen, instance) {
  const frameId = `${frame.id}-${instance}`;
  const captionId = `preview-caption-${frameId}`;
  return `<figure class="preview-frame preview-frame-${escapeHtml(
    frame.viewport,
  )}" aria-labelledby="${escapeHtml(captionId)}">
    <figcaption id="${escapeHtml(captionId)}">
      <strong>${userText(frame.label)}</strong>
      <span>${escapeHtml(localizedValue(
        screen.dictionary,
        "align.viewport",
        frame.viewport,
      ))} · ${userText(screen.state)}</span>
    </figcaption>
    <div class="preview-canvas" aria-hidden="true">
      ${previewNode(screen.root, frameId)}
    </div>
  </figure>`;
}

function previewMarkup(session, dictionary) {
  const preview = session.preview;
  if (!preview) return "";
  if (preview.disposition === "not-required") {
    if (!session.ui) return "";
    return `<p class="preview-not-required"><strong>${escapeHtml(
      label(dictionary, "align.previewNotRequired"),
    )}</strong> ${userText(preview.rationale)}</p>`;
  }
  if (preview.disposition === "required") {
    return `<div class="preview-missing">
      <strong>${escapeHtml(label(dictionary, "align.previewRequired"))}</strong>
      <p>${userText(preview.rationale)}</p>
    </div>`;
  }
  const comparisons = preview.screens.map((screenValue) => {
    const screen = { ...screenValue, dictionary };
    const frames = preview.frames.filter((frame) => frame.screenId === screen.id);
    const wide = frames.find((frame) => frame.viewport === "wide");
    const narrow = frames.find((frame) => frame.viewport === "narrow");
    return `<div class="preview-screen-group">
      <div class="preview-frames preview-desktop">
        ${previewFrameMarkup(wide, screen, "desktop")}
        ${previewFrameMarkup(narrow, screen, "desktop")}
      </div>
      <div class="preview-mobile">
        ${previewFrameMarkup(narrow, screen, "mobile-current")}
        <details class="preview-other">
          <summary>${disclosureChevron()}<span>${escapeHtml(
            label(dictionary, "align.showWidePreview"),
          )} · ${userText(screen.label)}</span></summary>
          <div class="disclosure-content">${previewFrameMarkup(
            wide,
            screen,
            "mobile-other",
          )}</div>
        </details>
      </div>
    </div>`;
  }).join("");
  const descriptions = preview.screens.map((screen) => `<details class="preview-description">
    <summary>${disclosureChevron()}<span>${escapeHtml(
      label(dictionary, "align.previewTextView"),
    )} · ${userText(screen.label)}</span></summary>
    <div class="disclosure-content">
      <ol>${flattenPreview(screen.root).map((item) => `<li>${userText(item)}</li>`).join("")}</ol>
      ${screen.annotations.length === 0 ? "" : `<h3>${escapeHtml(
        label(dictionary, "align.previewAnnotations"),
      )}</h3>${list(screen.annotations, (item) => userText(item.text))}`}
    </div>
  </details>`).join("");
  return `<p class="preview-note"><strong>${escapeHtml(
    label(dictionary, "align.previewLabel"),
  )}</strong> ${userText(preview.rationale)}</p>${comparisons}${descriptions}`;
}

function agreementSupporting(item) {
  return `<p class="supporting">${userText(item.detail)}${
    item.basis.length === 0 ? "" : ` · ${item.basis.map(userText).join(" · ")}`
  }</p>`;
}

function secondaryGroup({ className, content, count, id, labelText, open = false }) {
  return `<details class="secondary-group ${escapeHtml(className)}" id="${escapeHtml(id)}"${open ? " open" : ""}>
    <summary>${disclosureChevron()}<span>${escapeHtml(labelText)}</span><small>${count}</small></summary>
    <div class="disclosure-content">${content}</div>
  </details>`;
}

function agreementMarkup(session, dictionary) {
  const sourceLabels = new Map(session.snapshot.sources.map(
    (source) => [source.id, source.label],
  ));
  const questions = session.records.openQuestions.map((item) => `<article class="question" id="question-${escapeHtml(item.id)}">
    <p class="kicker">${escapeHtml(label(dictionary, "align.nextDecision"))}</p>
    <h3>${userText(item.question)}</h3>
    <p><strong>${escapeHtml(label(dictionary, "align.why"))}:</strong> ${userText(item.whyItMatters)}</p>
    <p><strong>${escapeHtml(label(dictionary, "align.recommendation"))}:</strong> ${userText(item.recommendation)}</p>
    <ul>${item.options.map((option) => `<li><strong>${userText(option.label)}</strong><span>${userText(option.effect)}</span></li>`).join("")}</ul>
  </article>`).join("");
  const agreements = agreementRecords(session);
  const primary = primaryAgreementRecords(session, agreements);
  const primaryIds = new Set(primary.map((item) => item.id));
  const openProposals = agreements.filter((item) => item.status === "open");
  const additional = agreements.filter(
    (item) => item.status !== "open" && !primaryIds.has(item.id),
  );
  const agreementList = primary.length === 0 ? "" : `<ol class="agreement-list agreement-list-primary">${primary.map((item) => `<li>
    <details class="agreement-detail" id="agreement-${escapeHtml(item.id)}">
      <summary>${disclosureChevron()}<span><small class="agreement-kind">${escapeHtml(
        agreementKind(item, dictionary),
      )}</small>${userText(item.text)}</span></summary>
      <div class="disclosure-content">${agreementSupporting(item)}</div>
    </details>
  </li>`).join("")}</ol>`;
  const unresolvedProposals = openProposals.length === 0 ? "" : `<section class="unresolved-proposals" aria-labelledby="unresolved-proposals-title">
    <h3 id="unresolved-proposals-title">${escapeHtml(
      label(dictionary, "align.unresolvedProposals"),
    )}</h3>
    <ol>${openProposals.map((item) => `<li id="agreement-${escapeHtml(item.id)}">
      <small class="agreement-kind">${escapeHtml(agreementKind(item, dictionary))}</small>
      <p>${userText(item.text)}</p>${agreementSupporting(item)}
    </li>`).join("")}</ol>
  </section>`;
  const additionalAgreements = additional.length === 0 ? "" : secondaryGroup({
    className: "additional-agreements",
    content: `<ol class="agreement-list agreement-list-secondary">${additional.map((item) => `<li id="agreement-${escapeHtml(item.id)}">
      <small class="agreement-kind">${escapeHtml(agreementKind(item, dictionary))}</small>
      <p>${userText(item.text)}</p>${agreementSupporting(item)}
    </li>`).join("")}</ol>`,
    count: additional.length,
    id: "additional-agreements",
    labelText: label(dictionary, "align.additionalAgreements"),
  });
  const evidence = session.records.facts.length === 0 ? "" : secondaryGroup({
    className: "evidence-group",
    content: `<ul class="plain-list">${session.records.facts.map((item) => `<li id="fact-${escapeHtml(item.id)}"><span>${userText(item.text)}</span><small>${item.sourceIds.map(
      (sourceId) => userText(sourceLabels.get(sourceId) ?? sourceId),
    ).join(" · ")}</small></li>`).join("")}</ul>`,
    count: session.records.facts.length,
    id: "evidence",
    labelText: label(dictionary, "align.readableEvidence"),
  });
  const assumptions = session.assumptions.length === 0 ? "" : secondaryGroup({
    className: "assumption-group",
    content: `<ul class="plain-list">${session.assumptions.map((item) => `<li id="assumption-${escapeHtml(item.id)}">${userText(item.text)} <small>${escapeHtml(
      localizedValue(dictionary, "align.value", item.status),
    )}</small></li>`).join("")}</ul>`,
    count: session.assumptions.length,
    id: "assumptions",
    labelText: label(dictionary, "align.assumptions"),
    open: session.assumptions.some((item) => item.status === "open"),
  });
  const uncertainties = session.uncertainties.length === 0 ? "" : secondaryGroup({
    className: "uncertainty-group",
    content: `<ul class="plain-list">${session.uncertainties.map((item) => `<li id="uncertainty-${escapeHtml(item.id)}">${userText(item.text)}<small>${userText(item.nextStep)}</small></li>`).join("")}</ul>`,
    count: session.uncertainties.length,
    id: "uncertainties",
    labelText: label(dictionary, "align.uncertainties"),
    open: session.uncertainties.some(
      (item) => item.classification !== "deferred",
    ),
  });
  return `${questions}${unresolvedProposals}${agreementList}${additionalAgreements}${evidence}${assumptions}${uncertainties}`;
}

function workMarkup(session, dictionary) {
  return `<ol class="work-list">${session.slices.map((item) => `<li>
    <details class="work-item" id="work-${escapeHtml(item.id)}">
      <summary>${disclosureChevron()}<span><strong>${userText(item.title)}</strong>${userText(item.userChange)}</span></summary>
      <div class="disclosure-content"><dl>
        <div><dt>${escapeHtml(label(dictionary, "align.workScope"))}</dt><dd>${userText(item.scope)}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.verification"))}</dt><dd>${userText(item.verification)}</dd></div>
        <div><dt>${escapeHtml(label(dictionary, "align.failureRecovery"))}</dt><dd>${userText(item.failureRecovery)}</dd></div>
      </dl></div>
    </details>
  </li>`).join("")}</ol>`;
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
    `--scope:${colors.scope}`,
    `--text:${colors.text}`,
  ].join(";");
}

function styles(fonts) {
  const s = SPACE;
  return `
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansLight}) format("woff2");font-weight:300;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansMedium}) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Hope Sans";src:url(data:font/woff2;base64,${fonts.sansBold}) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Hope Code";src:url(data:font/woff2;base64,${fonts.code}) format("woff2");font-weight:400;font-display:swap}
:root{color-scheme:light;${themeVariables(COLORS.light)}}
:root[data-theme="dark"]{color-scheme:dark;${themeVariables(COLORS.dark)}}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${themeVariables(COLORS.dark)}}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Hope Sans",sans-serif;font-size:${TYPE.body.wide.fontSize}px;font-weight:300;line-height:${TYPE.body.wide.lineHeight}}
a{color:var(--accent);font-weight:500}
.skip{position:fixed;z-index:20;top:8px;left:8px;transform:translateY(-160%);padding:${s[2]}px ${s[3]}px;background:var(--text);color:var(--panel)}
.skip:focus{transform:none}
.topbar{position:sticky;z-index:10;top:0;border-bottom:1px solid var(--border);background:var(--panel)}
.topbar-inner{display:flex;max-width:${LAYOUT.documentWidth}px;min-height:52px;margin:auto;padding:4px ${s[4]}px;align-items:center;justify-content:space-between;gap:${s[3]}px}
.brand{font-weight:700;letter-spacing:.08em}
.top-actions{display:flex;align-items:center;gap:${s[2]}px}
.theme-button,.toc-mobile>summary{display:flex;min-height:44px;padding:0 ${s[3]}px;align-items:center;border:1px solid var(--component-border);border-radius:${s[2]}px;background:var(--panel);color:var(--text);font:inherit;font-weight:500;cursor:pointer}
.theme-button{width:44px;height:44px;padding:0;justify-content:center}.theme-button[hidden]{display:none}
.theme-icon,.toc-icon{width:20px;height:20px;stroke:currentColor}
.toc-mobile{display:none;position:relative}
.toc-mobile-panel{position:absolute;top:calc(100% + ${s[2]}px);right:0;width:min(420px,calc(100vw - 32px));padding:${s[3]}px;border:1px solid var(--component-border);background:var(--panel)}
.layout{display:grid;max-width:${LAYOUT.documentWidth}px;margin:auto;padding:${s[5]}px ${s[4]}px;grid-template-columns:minmax(0,${LAYOUT.contentWidth}px) minmax(160px,1fr);gap:${s[5]}px}
.main{min-width:0}
.toc{position:sticky;top:76px;align-self:start;padding-left:${s[3]}px;border-left:1px solid var(--border)}
.toc h2{font-size:${TYPE.supporting.wide.fontSize}px;color:var(--muted)}
.toc ol{padding-left:20px}.toc li{margin:${s[2]}px 0}.toc a{color:var(--muted);text-decoration:none}.toc a[aria-current="location"]{color:var(--text)}.toc a[aria-current="location"]::before{display:inline-block;width:6px;height:6px;margin:0 ${s[2]}px 2px -14px;border-radius:50%;background:var(--accent);content:""}
.overview{padding-bottom:${s[5]}px;border-bottom:1px solid var(--border)}
.status{display:inline-flex;margin:0 0 ${s[3]}px;align-items:center;gap:${s[2]}px;color:var(--accent);font-weight:500}
.status span{width:8px;height:8px;border-radius:50%;background:currentColor}
h1{max-width:28ch;margin:0;font-size:${TYPE.pageTitle.wide.fontSize}px;line-height:${TYPE.pageTitle.wide.lineHeight}}
.goal{max-width:68ch;margin:${s[3]}px 0 0;color:var(--muted);font-size:1.125em}
.next-action{margin-top:${s[4]}px;padding:${s[3]}px ${s[4]}px;border-left:4px solid var(--accent);background:var(--panel)}
.next-action-question{border-color:var(--decide)}
.next-action h2{margin:${s[1]}px 0 ${s[2]}px;font-size:${TYPE.sectionTitle.wide.fontSize}px}.next-action p{margin:${s[1]}px 0}.next-action a{display:inline-block;margin-top:${s[2]}px}
.overview-agreements{margin-top:${s[3]}px;padding-top:${s[3]}px;border-top:1px solid var(--border)}.overview-agreements h3{margin:0 0 ${s[2]}px;font-size:1em}.overview-agreements ol{margin:0;padding-left:22px}.overview-agreements li{margin:${s[1]}px 0}.overview-agreements a{color:var(--text);font-weight:500;text-decoration:none}.overview-agreements a:hover{text-decoration:underline}
.kicker{margin:0;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}
.section{padding:${s[5]}px 0;border-bottom:1px solid var(--border)}
.section>h2{display:flex;margin:0 0 ${s[4]}px;align-items:center;gap:${s[2]}px;font-size:${TYPE.sectionTitle.wide.fontSize}px}
.section-number::before{color:var(--accent);content:counter(section,decimal-leading-zero)}
.main{counter-reset:section}.section{counter-increment:section}
.scope-grid{display:grid;grid-template-columns:1fr 1fr;gap:${s[4]}px}.scope-grid>div+div{padding-left:${s[4]}px;border-left:1px solid var(--border)}
.section h3{margin:0 0 ${s[2]}px;font-size:${TYPE.subsectionTitle.wide.fontSize}px}.plain-list,.check-list{margin:0;padding-left:20px}.plain-list li,.check-list li{margin:${s[2]}px 0}.check-list li::marker{color:var(--accent);content:"✓  "}
.success{margin-top:${s[4]}px;padding-top:${s[3]}px;border-top:1px solid var(--border)}
.scenario-list,.agreement-list,.work-list{margin:0;padding:0;list-style:none}.scenario-list>li,.agreement-list>li,.work-list>li{padding:${s[3]}px 0}.scenario-list>li+li,.agreement-list>li+li,.work-list>li+li{border-top:1px solid var(--border)}
.scenario-list h3,.agreement-list p{margin:${s[1]}px 0}.supporting,.secondary-group small{display:block;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.question{padding:${s[4]}px;border-left:4px solid var(--decide);background:var(--panel)}.question h3{margin:${s[1]}px 0 ${s[2]}px}.question ul{display:grid;gap:${s[2]}px;padding:0;list-style:none}.question li{display:grid;grid-template-columns:minmax(120px,.4fr) 1fr;gap:${s[3]}px}
.agreement-detail>summary,.secondary-group>summary,.work-item>summary,.preview-description>summary,.preview-other>summary{display:flex;min-height:44px;align-items:center;gap:${s[2]}px;cursor:pointer;font-weight:500;list-style:none}
.agreement-detail>summary::-webkit-details-marker,.secondary-group>summary::-webkit-details-marker,.work-item>summary::-webkit-details-marker,.preview-description>summary::-webkit-details-marker,.preview-other>summary::-webkit-details-marker{display:none}
.disclosure-chevron{display:inline-block;flex:0 0 auto;transition:transform 120ms ease}.agreement-detail[open]>summary>.disclosure-chevron,.secondary-group[open]>summary>.disclosure-chevron,.work-item[open]>summary>.disclosure-chevron,.preview-description[open]>summary>.disclosure-chevron,.preview-other[open]>summary>.disclosure-chevron{transform:rotate(90deg)}
.agreement-detail>summary{padding:${s[2]}px 0}.agreement-detail>summary>span{min-width:0}.agreement-kind{display:block;margin-bottom:${s[1]}px;color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px;font-weight:500}.agreement-detail>.disclosure-content{padding:0 0 ${s[2]}px 22px}.agreement-list-primary>li{padding:0}.agreement-list-secondary>li:first-child{padding-top:0}
.unresolved-proposals{margin-bottom:${s[3]}px;padding:${s[3]}px;border-left:4px solid var(--decide);background:var(--panel)}.unresolved-proposals h3{margin:0 0 ${s[2]}px}.unresolved-proposals ol{margin:0;padding-left:22px}.unresolved-proposals li+li{margin-top:${s[3]}px;padding-top:${s[3]}px;border-top:1px solid var(--border)}.unresolved-proposals p{margin:${s[1]}px 0}
.secondary-group{margin-top:${s[3]}px;border-top:1px solid var(--border)}.secondary-group>summary{justify-content:flex-start}.secondary-group>summary small{display:inline;color:var(--muted)}.secondary-group>.disclosure-content{padding:0 0 ${s[2]}px 22px}.secondary-group li{margin:${s[2]}px 0}.secondary-group li>small{margin-top:${s[1]}px}
.work-list{counter-reset:work}.work-list>li{position:relative;padding-left:42px}.work-list>li::before{position:absolute;top:${s[3]}px;left:0;color:var(--accent);font-weight:700;content:counter(work,decimal-leading-zero);counter-increment:work}.work-item>summary>span{min-width:0}.work-item>summary strong,.work-item>summary span>bdi{display:block}.work-item>summary span>bdi{margin-top:${s[1]}px;color:var(--muted);font-weight:300}.work-item>.disclosure-content{padding:0 0 ${s[2]}px 22px}.work-list dl{margin:${s[2]}px 0 0}.work-list dl>div{display:grid;margin-top:${s[2]}px;grid-template-columns:120px 1fr;gap:${s[2]}px}.work-list dt{color:var(--muted);font-weight:500}.work-list dd{margin:0}
.preview-note,.preview-not-required,.preview-missing{margin:0 0 ${s[3]}px;padding:${s[3]}px;border-left:4px solid var(--accent);background:var(--panel)}
.preview-screen-group+.preview-screen-group{margin-top:${s[4]}px}.preview-frames{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,.7fr);gap:${s[3]}px;align-items:start}.preview-mobile{display:none}
.preview-frame{min-width:0;margin:0;border:1px solid var(--component-border);border-radius:${s[2]}px;overflow:hidden;background:var(--bg)}
.preview-frame>figcaption{display:flex;min-height:44px;padding:${s[2]}px ${s[3]}px;align-items:center;justify-content:space-between;gap:${s[2]}px;border-bottom:1px solid var(--border);background:var(--panel)}.preview-frame>figcaption span{color:var(--muted);font-size:${TYPE.supporting.wide.fontSize}px}
.preview-frame-narrow{max-width:360px;justify-self:center}.preview-canvas{padding:${s[3]}px}.preview-node{min-width:0}.preview-group{display:grid;gap:${s[2]}px}.preview-group.preview-row{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-group.preview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-group.preview-stack{grid-template-columns:1fr}.preview-frame-narrow .preview-row,.preview-frame-narrow .preview-grid{grid-template-columns:1fr}
.preview-heading{margin:0;font-weight:500}.preview-heading-1{font-size:20px}.preview-heading-2{font-size:16px}.preview-heading-3{font-size:14px}.preview-text-node{margin:0;color:var(--muted)}.preview-strong{color:var(--text);font-weight:500}.preview-quiet{color:var(--muted)}
.preview-status{display:flex;margin:0;align-items:center;gap:6px;color:var(--accent);font-size:12px;font-weight:500}.preview-status span{width:7px;height:7px;border-radius:50%;background:currentColor}.preview-action{margin:0;padding:${s[2]}px ${s[3]}px;border-left:3px solid var(--accent);background:var(--panel);font-weight:500}.preview-list .preview-label{margin:0;color:var(--muted);font-size:12px;font-weight:500}.preview-list ul{margin:${s[1]}px 0 0;padding-left:18px}.preview-divider{width:100%;margin:${s[1]}px 0;border:0;border-top:1px solid var(--border)}
.preview-description,.preview-other{margin-top:${s[3]}px;border-top:1px solid var(--border)}.preview-description>summary,.preview-other>summary{padding:${s[2]}px 0}.preview-description>.disclosure-content,.preview-other>.disclosure-content{padding-left:22px}.preview-description ol{margin-top:0}.preview-description h3{margin-top:${s[3]}px}.preview-other .preview-frame{margin-top:${s[2]}px}
:where(.goal,.section-body,.supporting,.preview-canvas,bdi){overflow-wrap:anywhere}
[id]{scroll-margin-top:72px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media(max-width:${LAYOUT.tocBreakpoint}px){.layout{display:block;max-width:${LAYOUT.contentWidth}px}.toc{display:none}.toc-mobile{display:block}.toc-mobile>summary{list-style:none}.toc-mobile>summary::-webkit-details-marker{display:none}}
@media(max-width:${LAYOUT.narrowBreakpoint}px){body{font-size:${TYPE.body.narrow.fontSize}px;line-height:${TYPE.body.narrow.lineHeight}}.topbar-inner{padding:4px ${s[3]}px}.layout{padding:${s[4]}px ${s[3]}px}h1{font-size:${TYPE.pageTitle.narrow.fontSize}px;line-height:${TYPE.pageTitle.narrow.lineHeight}}.section>h2{font-size:${TYPE.sectionTitle.narrow.fontSize}px}.scope-grid{grid-template-columns:1fr}.scope-grid>div+div{padding:${s[3]}px 0 0;border-top:1px solid var(--border);border-left:0}.preview-desktop{display:none}.preview-mobile{display:block}.preview-mobile>.preview-frame-narrow{width:min(100%,360px);margin:auto}.preview-other .preview-frame-wide{width:100%}.question li,.work-list dl>div{grid-template-columns:1fr;gap:${s[1]}px}.work-list>li{padding-left:34px}.work-item>.disclosure-content{padding-left:18px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
@media(forced-colors:active){.status span,.preview-status span{forced-color-adjust:auto}.next-action,.question,.preview-note,.preview-frame{border-color:CanvasText}}
@media print{:root,:root[data-theme]{color-scheme:light;${themeVariables(COLORS.light)};--bg:#fff;--panel:#fff;--text:#000}.topbar,.toc,.toc-mobile,.skip{display:none}.layout{display:block;max-width:none;padding:0}.section,.preview-frame,.work-list>li{break-inside:avoid}.preview-desktop{display:grid!important}.preview-mobile{display:none!important}.disclosure-content{display:block!important}details::details-content{content-visibility:visible}a{color:inherit;text-decoration:none}}
`;
}

function clientScript(dictionary) {
  const labels = JSON.stringify({
    dark: label(dictionary, "align.useDarkTheme"),
    light: label(dictionary, "align.useLightTheme"),
  });
  return `(()=>{"use strict";const labels=${labels};const root=document.documentElement;const button=document.getElementById("theme-toggle");const toc=document.querySelector(".toc-mobile");const navLinks=[...document.querySelectorAll('nav a[href^="#"]')];const sections=[...document.querySelectorAll(".section[id]")];let currentFrame=0;const current=()=>root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";const sync=()=>{if(!button)return;const next=current()==="dark"?"light":"dark";button.setAttribute("aria-label",labels[next]);button.setAttribute("title",labels[next]);for(const icon of button.querySelectorAll("[data-theme-icon]"))icon.toggleAttribute("hidden",icon.dataset.themeIcon!==next)};const revealTarget=target=>{if(target.tagName==="DETAILS")target.open=true;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;};const focusTarget=target=>{const hadTabindex=target.hasAttribute("tabindex");if(!hadTabindex)target.setAttribute("tabindex","-1");target.focus({preventScroll:true});if(!hadTabindex)target.addEventListener("blur",()=>target.removeAttribute("tabindex"),{once:true});};const syncCurrent=()=>{let active;if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)active=sections[sections.length-1];else for(const section of sections){if(section.getBoundingClientRect().top<=96)active=section;else break;}for(const link of navLinks){if(active&&link.hash==="#"+active.id)link.setAttribute("aria-current","location");else link.removeAttribute("aria-current");}};const openTarget=()=>{if(!location.hash)return;const target=document.getElementById(location.hash.slice(1));if(!target)return;revealTarget(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({block:"start"});syncCurrent();});};if(button){button.hidden=false;sync()}button?.addEventListener("click",()=>{root.dataset.theme=current()==="dark"?"light":"dark";sync()});toc?.addEventListener("click",event=>{if(event.target.closest("a"))toc.open=false});addEventListener("hashchange",openTarget);addEventListener("click",event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)requestAnimationFrame(openTarget);});addEventListener("scroll",()=>{if(currentFrame)return;currentFrame=requestAnimationFrame(()=>{currentFrame=0;syncCurrent();});},{passive:true});openTarget();syncCurrent();})();`;
}

export async function renderAlignSession(session, { fonts } = {}) {
  const dictionary = await loadLocale(session.locale, ["common", "align"]);
  const fontBytes = fonts ?? Object.fromEntries(await Promise.all(
    Object.entries(fontUrls).map(async ([name, url]) => [name, await readFile(url)]),
  ));
  const css = styles(Object.fromEntries(Object.entries(fontBytes).map(
    ([name, bytes]) => [name, bytes.toString("base64")],
  )));
  const script = clientScript(dictionary);
  const preview = previewMarkup(session, dictionary);
  const sections = [
    { id: "scope", title: label(dictionary, "align.scopeAndSuccess"), body: scopeMarkup(session, dictionary) },
    { id: "behavior", title: label(dictionary, "align.scenarios"), body: scenariosMarkup(session, dictionary) },
    ...(preview ? [{ id: "preview", title: label(dictionary, "align.preview"), body: preview }] : []),
    { id: "agreement", title: label(dictionary, "align.agreement"), body: agreementMarkup(session, dictionary) },
    { id: "work", title: label(dictionary, "align.slices"), body: workMarkup(session, dictionary) },
  ];
  const toc = `<ol>${sections.map((item) => `<li><a href="#${item.id}">${escapeHtml(item.title)}</a></li>`).join("")}</ol>`;
  const themeAttribute = session.theme === "system" ? "" : ` data-theme="${escapeHtml(session.theme)}"`;
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
    <div class="top-actions">
      <button class="theme-button" id="theme-toggle" type="button" hidden aria-label="${escapeHtml(label(dictionary, session.theme === "dark" ? "align.useLightTheme" : "align.useDarkTheme"))}" title="${escapeHtml(label(dictionary, session.theme === "dark" ? "align.useLightTheme" : "align.useDarkTheme"))}">
        <svg class="theme-icon" data-theme-icon="dark" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${session.theme === "dark" ? " hidden" : ""}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path></svg>
        <svg class="theme-icon" data-theme-icon="light" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${session.theme === "dark" ? "" : " hidden"}><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>
      </button>
      <details class="toc-mobile"><summary><svg class="toc-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>${escapeHtml(label(dictionary, "align.contents"))}</summary><nav class="toc-mobile-panel" aria-label="${escapeHtml(label(dictionary, "align.contents"))}">${toc}</nav></details>
    </div>
  </div></header>
  <div class="layout">
    <main class="main" id="alignment">
      ${overview(session, dictionary)}
      ${sections.map((item) => section(item.id, item.title, item.body)).join("")}
    </main>
    <nav class="toc" aria-label="${escapeHtml(label(dictionary, "align.contents"))}"><h2>${escapeHtml(label(dictionary, "align.contents"))}</h2>${toc}</nav>
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
