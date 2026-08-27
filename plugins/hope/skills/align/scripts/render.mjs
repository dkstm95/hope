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
  sansMedium: new URL("../../../assets/fonts/HopeSansMedium.woff2", import.meta.url),
});
const iconUrl = new URL("../../../assets/hope-icon.png", import.meta.url);

const dictionaries = Object.freeze({
  "en-US": Object.freeze({
    behavior: "User flow",
    boundary: "Boundary",
    cancelOutcome: "cancel",
    checkedByAgent: "Agent assessment",
    checkedByHuman: "Person judgment",
    completeOutcome: "complete",
    currentAgreement: "Current intent",
    decidedByDelegated: "AI choice delegated by the person",
    decidedByUser: "Selected by the person",
    decidedIntent: "Decided intent",
    designDirections: "Design directions",
    earlierRevisions: "earlier versions",
    evidence: "Basis",
    evidenceClose: "Close preview",
    evidenceViewList: "View in the evidence list",
    excluded: "Not included",
    history: "Version history",
    goal: "Goal",
    influence: "Influence",
    included: "Additional included intent",
    language: "Language",
    menu: "Contents",
    navigation: "Contents and version history",
    openChoices: "Retained questions from an earlier version",
    outcomes: "Expected outcomes",
    overview: "Summary",
    problem: "Problem",
    recommendation: "AI recommendation",
    recommended: "Recommended",
    references: "References",
    revisionDetails: "View changes",
    skip: "Skip to decided intent",
    selected: "Selected",
    selection: "Selection",
    strengths: "Strengths",
    toc: "Contents",
    useDarkTheme: "Switch to dark mode",
    useLightTheme: "Switch to light mode",
    tradeoffs: "Trade-offs",
    verification: "Ways to judge",
    verificationMarkerAgent: "AI",
    verificationMarkerHuman: "User",
    verificationViewList: "View in the judgment list",
  }),
  "ko-KR": Object.freeze({
    behavior: "사용 흐름",
    boundary: "경계",
    cancelOutcome: "취소",
    checkedByAgent: "AI 판단 가능",
    checkedByHuman: "사용자 판단",
    completeOutcome: "완료",
    currentAgreement: "현재 의도",
    decidedByDelegated: "사용자가 AI에 선택을 위임함",
    decidedByUser: "사용자가 선택함",
    decidedIntent: "결정된 의도",
    designDirections: "디자인 시안",
    earlierRevisions: "개의 이전 버전",
    evidence: "근거",
    evidenceClose: "미리보기 닫기",
    evidenceViewList: "근거 목록에서 보기",
    excluded: "포함하지 않음",
    history: "버전 이력",
    goal: "목표",
    influence: "반영한 점",
    included: "추가 포함 내용",
    language: "언어",
    menu: "목차",
    navigation: "목차와 버전 이력",
    openChoices: "이전 버전에서 유지된 질문",
    outcomes: "기대 결과",
    overview: "요약",
    problem: "문제",
    recommendation: "AI 추천",
    recommended: "추천",
    references: "참고 자료",
    revisionDetails: "변경 내용 보기",
    skip: "결정된 의도로 건너뛰기",
    selected: "선택",
    selection: "선택 결과",
    strengths: "장점",
    toc: "목차",
    useDarkTheme: "다크 모드로 전환",
    useLightTheme: "라이트 모드로 전환",
    tradeoffs: "고려 사항",
    verification: "판단 방법",
    verificationMarkerAgent: "AI",
    verificationMarkerHuman: "유저",
    verificationViewList: "판단 방법 목록에서 보기",
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
  return `<bdi dir="auto">${String(value).split(/\r?\n/u).map(escapeHtml).join("<br>")}</bdi>`;
}

function authoredParagraphs(value) {
  return String(value).split(/\r?\n+/u).map(
    (paragraph) => `<p>${authoredText(paragraph.trim())}</p>`,
  ).join("");
}

function citedValue(value) {
  return typeof value === "string" ? value : value.text;
}

function evidenceCatalog(content) {
  const entries = content.evidence.map((item, index) => {
    const key = item.id ?? `item-${index + 1}`;
    return Object.freeze({
      item,
      number: index + 1,
      target: `evidence-${key}`,
    });
  });
  return Object.freeze({
    byId: new Map(entries.flatMap((entry) => (
      entry.item.id === undefined ? [] : [[entry.item.id, entry]]
    ))),
    entries: Object.freeze(entries),
  });
}

function evidenceMarkers(value, catalog, dictionary) {
  if (typeof value === "string" || value.evidenceIds.length === 0) return "";
  const entries = value.evidenceIds.flatMap((id) => {
    const entry = catalog.byId.get(id);
    return entry === undefined ? [] : [entry];
  }).sort((left, right) => left.number - right.number);
  return `<sup class="reference-markers evidence-markers">${entries.map((entry) => {
    const accessible = `${label(dictionary, "evidence")} [${entry.number}]: ${entry.item.label}`;
    return `<a class="reference-marker evidence-marker" href="#${entry.target}" data-reference-target="${entry.target}" data-reference-title="[${entry.number}] ${escapeHtml(entry.item.label)}" data-reference-list-label="${escapeHtml(label(dictionary, "evidenceViewList"))}" aria-controls="reference-popover" aria-expanded="false" aria-haspopup="dialog" aria-label="${escapeHtml(accessible)}">[${entry.number}]</a>`;
  }).join("")}</sup>`;
}

function verificationCatalog(content, dictionary) {
  const entries = content.intent.flatMap((item, intentIndex) => {
    if (item.verify === undefined) return [];
    const human = item.by === "human";
    return [Object.freeze({
      intent: item,
      intentIndex,
      label: label(dictionary, human ? "checkedByHuman" : "checkedByAgent"),
      marker: label(
        dictionary,
        human ? "verificationMarkerHuman" : "verificationMarkerAgent",
      ),
      target: `verification-${intentIndex + 1}`,
    })];
  });
  return Object.freeze({
    byIntentIndex: new Map(entries.map((entry) => [entry.intentIndex, entry])),
    entries: Object.freeze(entries),
  });
}

function verificationMarker(entry, dictionary) {
  if (!entry) return "";
  const visible = `[${entry.marker}]`;
  const accessible = `${entry.label}: ${entry.intent.verify}`;
  return `<sup class="reference-markers verification-markers"><a class="reference-marker verification-marker" href="#${entry.target}" data-reference-target="${entry.target}" data-reference-title="${escapeHtml(`${visible} ${entry.label}`)}" data-reference-list-label="${escapeHtml(label(dictionary, "verificationViewList"))}" aria-controls="reference-popover" aria-expanded="false" aria-haspopup="dialog" aria-label="${escapeHtml(accessible)}">${escapeHtml(visible)}</a></sup>`;
}

function citedInline(value, catalog, dictionary) {
  return `${authoredText(citedValue(value))}${evidenceMarkers(value, catalog, dictionary)}`;
}

function citedParagraphs(value, catalog, dictionary) {
  const paragraphs = String(citedValue(value)).split(/\r?\n+/u);
  return paragraphs.map((paragraph, index) => `<p>${authoredText(paragraph.trim())}${
    index === paragraphs.length - 1 ? evidenceMarkers(value, catalog, dictionary) : ""
  }</p>`).join("");
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

function summaryLabelElement(tag, value) {
  const text = String(value);
  const balanced = /^(\p{Script=Hangul}{2}) (\p{Script=Hangul}{2})$/u.exec(text);
  if (!balanced) return `<${tag}>${escapeHtml(text)}</${tag}>`;
  return `<${tag}><span class="summary-label-stacked"><span>${escapeHtml(
    balanced[1],
  )}</span> <span>${escapeHtml(balanced[2])}</span></span></${tag}>`;
}

function textList(items, {
  empty,
  className = "plain-list",
  catalog,
  dictionary,
} = {}) {
  if (items.length === 0) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<ul class="${className}">${items.map(
    (item) => `<li>${catalog
      ? citedInline(item, catalog, dictionary)
      : authoredText(citedValue(item))}</li>`,
  ).join("")}</ul>`;
}

function presentationContent(content) {
  if (Array.isArray(content.intent)) {
    return Object.freeze({
      ...content,
      flow: content.flow,
      legacy: undefined,
    });
  }
  const checks = content.checks ?? content.success.map((condition) => ({ condition }));
  const conditions = checks.map((check) => ({
    statement: check.condition,
    ...(check.verify === undefined ? {} : { verify: check.verify, by: check.by }),
  }));
  const decisions = (content.decisions ?? []).map((decision) => ({
    statement: decision.decision,
    reason: decision.reason,
  }));
  return Object.freeze({
    ...content,
    goal: content.goal ?? content.intent,
    intent: Object.freeze([...conditions, ...decisions]),
    exclusions: content.scope?.excluded ?? [],
    flow: content.behavior,
    legacy: Object.freeze({
      boundary: content.boundary,
      included: content.scope?.included ?? [],
      openChoices: content.openChoices ?? [],
    }),
  });
}

function sectionOrdinal(number) {
  return String(number).padStart(2, "0");
}

function tocHeading(dictionary, count) {
  return `<h2 class="toc-heading"><span>${escapeHtml(label(dictionary, "toc"))}</span><span class="toc-progress"><span data-toc-current>1</span> / ${count}</span></h2>`;
}

function sectionTitle(id, title, number, suffix = "") {
  return `<h2 class="section-title" id="${escapeHtml(id)}"><span class="section-number">${sectionOrdinal(number)}</span><span>${escapeHtml(title)}${suffix}</span></h2>`;
}

function documentTitle(content) {
  return `<header class="document-head">
    <h1 id="artifact-title">${authoredText(content.title)}</h1>
  </header>`;
}

function intentList(content, dictionary, catalog, verification) {
  return `<ol class="decision-list intent-list">${content.intent.map((item, intentIndex) => {
    const marker = verificationMarker(
      verification?.byIntentIndex.get(intentIndex),
      dictionary,
    );
    const compactMarker = item.by === "human"
      ? label(dictionary, "verificationMarkerHuman")
      : label(dictionary, "verificationMarkerAgent");
    const compactVerification = verification === undefined && item.verify !== undefined
      ? `<span class="compact-check-verification"><strong>[${escapeHtml(compactMarker)}]</strong> ${authoredText(item.verify)}</span>`
      : "";
    const statement = catalog
      ? citedInline(item.statement, catalog, dictionary)
      : authoredText(citedValue(item.statement));
    const reason = item.reason === undefined ? "" : `<details class="decision-disclosure intent-reason">
      <summary><span>${statement}${marker}${compactVerification}</span></summary>
      <div class="decision-reason">${catalog
        ? citedParagraphs(item.reason, catalog, dictionary)
        : authoredParagraphs(citedValue(item.reason))}</div>
    </details>`;
    return `<li><span class="decision-number" aria-hidden="true">${String(intentIndex + 1).padStart(2, "0")}</span>${reason || `<span class="intent-statement">${statement}${marker}${compactVerification}</span>`}</li>`;
  }).join("")}</ol>`;
}

function overview(content, dictionary, number, catalog) {
  return `<section class="overview document-section" id="overview" aria-labelledby="overview-title">
    ${sectionTitle("overview-title", label(dictionary, "overview"), number)}
    <dl class="synopsis">
      <div>${summaryLabelElement("dt", label(dictionary, "goal"))}<dd>${citedParagraphs(content.goal, catalog, dictionary)}</dd></div>
      <div>${summaryLabelElement("dt", label(dictionary, "problem"))}<dd>${citedParagraphs(content.problem, catalog, dictionary)}</dd></div>
    </dl>
  </section>`;
}

function directionReferences(references, dictionary, catalog) {
  if (references.length === 0) return "";
  return `<details class="direction-references">
    <summary>${escapeHtml(label(dictionary, "references"))} · ${references.length}</summary>
    <div class="direction-reference-content"><ul>${references.map(
    (reference) => {
      const evidence = reference.evidenceId === undefined
        ? undefined
        : catalog?.byId.get(reference.evidenceId)?.item;
      const url = evidence?.location ?? reference.url;
      const title = evidence?.label ?? reference.label;
      return `<li><a href="${escapeHtml(url)}">${authoredText(title)}</a><p><strong>${escapeHtml(label(dictionary, "influence"))}:</strong> ${authoredText(reference.influence)}</p></li>`;
    },
  ).join("")}</ul></div>
  </details>`;
}

function designDirectionsComparison(directions, dictionary, idPrefix = "", catalog) {
  const status = (option) => [
    option.id === directions.recommendation.optionId
      ? `<span class="direction-status recommended">${escapeHtml(label(dictionary, "recommended"))}</span>`
      : "",
    option.id === directions.selection.optionId
      ? `<span class="direction-status selected">${escapeHtml(label(dictionary, "selected"))}</span>`
      : "",
  ].join("");
  const rationale = (option) => {
    const rows = [];
    if (option.id === directions.recommendation.optionId) {
      rows.push(`<div><dt>${escapeHtml(label(dictionary, "recommendation"))}</dt><dd>${authoredParagraphs(directions.recommendation.reason)}</dd></div>`);
    }
    if (option.id === directions.selection.optionId) {
      const decidedBy = directions.selection.decidedBy === "delegated"
        ? label(dictionary, "decidedByDelegated")
        : label(dictionary, "decidedByUser");
      rows.push(`<div><dt>${escapeHtml(label(dictionary, "selection"))}<span class="selection-source">${escapeHtml(decidedBy)}</span></dt><dd>${authoredParagraphs(directions.selection.reason)}</dd></div>`);
    }
    return rows.length === 0 ? "" : `<dl class="direction-rationales">${rows.join("")}</dl>`;
  };
  const optionList = directions.options.map((option, index) => {
    const optionId = `${idPrefix}design-direction-${option.id}`;
    const rationaleHtml = rationale(option);
    return `<li class="design-direction" id="${escapeHtml(optionId)}">
    <header class="direction-head"><span class="direction-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div class="direction-title-line"><h3 id="${escapeHtml(optionId)}-title">${authoredText(option.title)}</h3><div class="direction-statuses">${status(option)}</div></div></header>
    <div class="direction-image"><img src="data:${option.image.mimeType};base64,${option.image.data}" alt="${escapeHtml(option.alt)}" width="${option.image.width}" height="${option.image.height}"></div>
    <div class="direction-summary">${authoredParagraphs(option.summary)}</div>
    <div class="direction-details">
      <div><h4>${escapeHtml(label(dictionary, "strengths"))}</h4>${textList(option.strengths)}</div>
      <div><h4>${escapeHtml(label(dictionary, "tradeoffs"))}</h4>${textList(option.tradeoffs)}</div>
    </div>
${rationaleHtml === "" ? "" : `    ${rationaleHtml}\n`}    ${directionReferences(option.references, dictionary, catalog)}
  </li>`;
  }).join("");
  return `<ol class="design-direction-list design-direction-count-${directions.options.length}">${optionList}</ol>`;
}

function designDirectionsSection(content, dictionary, number, catalog) {
  if (!content.designDirections) return undefined;
  return `<section class="body-section document-section" id="design-directions" aria-labelledby="design-directions-title">
    ${sectionTitle("design-directions-title", label(dictionary, "designDirections"), number)}
    ${designDirectionsComparison(content.designDirections, dictionary, "", catalog)}
  </section>`;
}

function flowBlock(content, dictionary, catalog) {
  const flow = content.flow;
  if (!flow) return "";
  const outcomes = flow.outcomes.length === 0 ? "" : `<div class="behavior-outcomes-block">
    <h3 class="behavior-outcomes-title">${escapeHtml(label(dictionary, "outcomes"))}</h3>
    <ul class="behavior-outcomes">${
    flow.outcomes.map((outcome) => `<li class="${outcome.kind === "cancel" ? "cancel" : "complete"}">
      <span class="outcome-mark" aria-hidden="true">${outcome.kind === "cancel" ? "×" : "✓"}</span>
      <div><strong>${citedInline(outcome.title, catalog, dictionary)}</strong>${outcome.detail
        ? citedParagraphs(outcome.detail, catalog, dictionary)
        : ""}</div>
    </li>`).join("")
  }</ul></div>`;
  return `<div class="intent-group intent-flow" id="flow">
    <h3 class="subheading">${escapeHtml(label(dictionary, "behavior"))}</h3>
    <ol class="behavior-steps">${flow.steps.map((step, index) => `<li>
      <span class="step-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <strong>${citedInline(step.title, catalog, dictionary)}</strong>${step.detail
        ? citedParagraphs(step.detail, catalog, dictionary)
        : ""}
    </li>`).join("")}</ol>
    ${outcomes}
  </div>`;
}

function verificationDetails(catalog, dictionary) {
  if (catalog.entries.length === 0) return "";
  return `<details class="intent-group section-disclosure intent-verification" id="verification">
    <summary>${escapeHtml(label(dictionary, "verification"))} · ${catalog.entries.length}</summary>
    <div class="section-disclosure-content"><ol class="verification-list">${catalog.entries.map((entry) => `<li id="${entry.target}" data-verification-entry>
      <span class="verification-symbol" aria-hidden="true">[${escapeHtml(entry.marker)}]</span>
      <div class="reference-entry-copy verification-entry-copy"><strong class="reference-entry-title verification-entry-title">${authoredText(citedValue(entry.intent.statement))}</strong><span class="verification-source">${escapeHtml(entry.label)}</span>${authoredParagraphs(entry.intent.verify)}</div>
    </li>`).join("")}</ol></div>
  </details>`;
}

function legacyIntentDetails(content, dictionary, catalog) {
  if (content.legacy === undefined) return "";
  const boundary = content.legacy.boundary === undefined ? "" : `<div class="legacy-intent-group">
    <h3 class="subheading">${escapeHtml(label(dictionary, "boundary"))}</h3>
    ${citedParagraphs(content.legacy.boundary, catalog, dictionary)}
  </div>`;
  const includedHtml = content.legacy.included.length === 0 ? "" : `<div class="legacy-intent-group">
    <h3 class="subheading">${escapeHtml(label(dictionary, "included"))}</h3>
    ${textList(content.legacy.included, { catalog, dictionary })}
  </div>`;
  const questions = content.legacy.openChoices.length === 0 ? "" : `<div class="legacy-intent-group">
    <h3 class="subheading">${escapeHtml(label(dictionary, "openChoices"))}</h3>
    ${textList(content.legacy.openChoices, { catalog, dictionary })}
  </div>`;
  return `${boundary}${includedHtml}${questions}`;
}

function intentSection(content, dictionary, number, catalog, verification) {
  const exclusions = content.exclusions;
  const exclusionBlock = exclusions.length === 0 ? "" : `<div class="intent-group intent-exclusions" id="exclusions">
    <h3 class="subheading">${escapeHtml(label(dictionary, "excluded"))}</h3>
    ${textList(exclusions, { className: "exclusion-list", catalog, dictionary })}
  </div>`;
  const groups = [
    `<div class="intent-group intent-record">${intentList(content, dictionary, catalog, verification)}</div>`,
    flowBlock(content, dictionary, catalog),
    exclusionBlock,
    legacyIntentDetails(content, dictionary, catalog),
    verificationDetails(verification, dictionary),
  ].filter(Boolean).join("\n");
  return `<section class="body-section document-section" id="intent" aria-labelledby="intent-title">
    ${sectionTitle("intent-title", label(dictionary, "decidedIntent"), number)}
    <div class="intent-groups">${groups}</div>
  </section>`;
}

function evidenceLocation(item) {
  if (/^https?:\/\//u.test(item.location)) {
    return `<a href="${escapeHtml(item.location)}">${authoredText(item.location)}</a>`;
  }
  return `<code>${authoredText(item.location)}</code>`;
}

function evidenceSection(catalog, dictionary, number) {
  if (catalog.entries.length === 0) return undefined;
  return `<details class="body-section document-section section-disclosure" id="evidence">
    <summary class="section-disclosure-summary">${sectionTitle("evidence-title", label(dictionary, "evidence"), number, ` · ${catalog.entries.length}`)}</summary>
    <div class="section-disclosure-content"><ol class="evidence-list">${catalog.entries.map((entry) => `<li id="${entry.target}" data-evidence-entry>
      <span class="evidence-number" aria-hidden="true">[${entry.number}]</span>
      <div class="reference-entry-copy evidence-entry-copy"><strong class="reference-entry-title evidence-entry-title">${authoredText(entry.item.label)}</strong><div class="evidence-entry-location">${evidenceLocation(entry.item)}</div></div>
    </li>`).join("")}</ol></div>
  </details>`;
}

function referencePopover(dictionary) {
  return `<aside class="reference-popover" id="reference-popover" popover="auto" role="dialog" aria-labelledby="reference-popover-title">
    <header class="reference-popover-head"><strong id="reference-popover-title"></strong><button class="reference-popover-close" type="button" aria-label="${escapeHtml(label(dictionary, "evidenceClose"))}" title="${escapeHtml(label(dictionary, "evidenceClose"))}">×</button></header>
    <div class="reference-popover-body" data-reference-popover-body></div>
    <a class="reference-popover-more" data-reference-popover-more href="#evidence">${escapeHtml(label(dictionary, "evidenceViewList"))}</a>
  </aside>`;
}

function compactRevisionContent(content, dictionary, idPrefix) {
  const catalog = evidenceCatalog(content);
  const flow = content.flow;
  const flowHtml = flow ? `<div>
    <dt>${escapeHtml(label(dictionary, "behavior"))}</dt>
    <dd><ul class="plain-list">${flow.steps.map(
      (step) => `<li>${authoredText(citedValue(step.title))}${step.detail ? ` <span aria-hidden="true">—</span> ${authoredText(citedValue(step.detail))}` : ""}</li>`,
    ).join("")}${flow.outcomes.map((outcome) => `<li>${authoredText(`${citedValue(outcome.title)} (${label(
        dictionary,
        outcome.kind === "cancel" ? "cancelOutcome" : "completeOutcome",
      )})`)}${outcome.detail ? ` <span aria-hidden="true">—</span> ${authoredText(citedValue(outcome.detail))}` : ""}</li>`).join("")}</ul></dd>
  </div>` : "";
  const designDirectionsHtml = content.designDirections ? `<div>
    <dt>${escapeHtml(label(dictionary, "designDirections"))}</dt>
    <dd>${designDirectionsComparison(content.designDirections, dictionary, idPrefix, catalog)}</dd>
  </div>` : "";
  const exclusions = content.exclusions;
  const excluded = exclusions.length === 0 ? "" : `<div><dt>${escapeHtml(label(dictionary, "excluded"))}</dt><dd>${textList(exclusions)}</dd></div>`;
  const legacyBoundary = content.legacy?.boundary === undefined ? "" : `<div><dt>${escapeHtml(label(dictionary, "boundary"))}</dt><dd>${authoredText(citedValue(content.legacy.boundary))}</dd></div>`;
  const legacyIncluded = !content.legacy || content.legacy.included.length === 0 ? "" : `<div><dt>${escapeHtml(label(dictionary, "included"))}</dt><dd>${textList(content.legacy.included)}</dd></div>`;
  const openChoices = !content.legacy || content.legacy.openChoices.length === 0 ? "" : `<div><dt>${escapeHtml(label(dictionary, "openChoices"))}</dt><dd>${textList(content.legacy.openChoices)}</dd></div>`;
  const evidence = content.evidence.length === 0 ? "" : `<div>
    <dt>${escapeHtml(label(dictionary, "evidence"))}</dt>
    <dd><ul class="plain-list">${content.evidence.map((item) => `<li><strong>${authoredText(item.label)}</strong><br>${evidenceLocation(item)}</li>`).join("")}</ul></dd>
  </div>`;
  return `<dl class="revision-content">
    <div><dt>${escapeHtml(label(dictionary, "goal"))}</dt><dd><strong>${authoredText(content.title)}</strong><p>${authoredText(citedValue(content.goal))}</p></dd></div>
    <div><dt>${escapeHtml(label(dictionary, "problem"))}</dt><dd>${authoredText(citedValue(content.problem))}</dd></div>
    <div><dt>${escapeHtml(label(dictionary, "decidedIntent"))}</dt><dd>${intentList(content, dictionary)}</dd></div>
    ${excluded}${designDirectionsHtml}${flowHtml}${legacyBoundary}${legacyIncluded}${openChoices}${evidence}
  </dl>`;
}

function railRevision(revision, index, data, dictionary, idSuffix) {
  const current = index === 0;
  const details = current || data.revisions.length === 1 ? "" : `<details class="revision-disclosure" id="revision-${revision.number}${idSuffix}">
    <summary>${escapeHtml(label(dictionary, "revisionDetails"))}</summary>
    <div class="revision-popup">${compactRevisionContent(revision.content, dictionary, `revision-${revision.number}${idSuffix}-`)}</div>
  </details>`;
  return `<li class="${current ? "current" : "past"}">
    <div class="revision-head"><span class="revision-dot" aria-hidden="true"></span><strong>v${revision.number}${current ? ` · ${escapeHtml(label(dictionary, "currentAgreement"))}` : ""}</strong><time datetime="${escapeHtml(revision.agreedAt)}">${escapeHtml(revision.agreedAt.slice(0, 10))}</time></div>
    <p>${authoredText(revision.summary)}</p>${details ? `
    ${details}` : ""}
  </li>`;
}

function railHistory(data, dictionary, idSuffix = "") {
  const reversed = [...data.revisions].reverse();
  const shown = reversed.slice(0, 2);
  const older = reversed.slice(shown.length);
  const headingId = `rail-history-title${idSuffix}`;
  const olderHistory = older.length === 0 ? "" : `
    <details class="older-history"><summary>${older.length} ${escapeHtml(label(dictionary, "earlierRevisions"))}</summary><ol>${older.map((revision, index) => railRevision(
      revision,
      index + shown.length,
      data,
      dictionary,
      idSuffix,
    )).join("")}</ol></details>`;
  return `<section class="rail-history" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${escapeHtml(label(dictionary, "history"))}</h2>
    <ol>${shown.map((revision, index) => railRevision(
      revision,
      index,
      data,
      dictionary,
      idSuffix,
    )).join("")}</ol>${olderHistory}
  </section>`;
}

function repositoryMark(repository, className) {
  return `<span class="${className}"><svg class="repository-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M3 9.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"></path></svg><span>${authoredText(repository)}</span></span>`;
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
  font: 500 ${TYPE.body.wide.fontSize}px/${TYPE.body.wide.lineHeight} "Hope Sans", sans-serif;
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
.repository, .mobile-repository { min-width: 0; display: flex; align-items: center; gap: ${space2}px; color: var(--text); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 500; }
.repository > span, .mobile-repository > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repository-icon { flex: none; width: 16px; height: 16px; stroke: var(--muted); }
.status { flex: none; padding: ${space1}px ${space2}px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: 4px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent); font-size: ${TYPE.micro.compactFontSize}px; font-weight: 700; }
.top-actions { margin-left: auto; display: flex; align-items: center; gap: ${space2}px; }
.display-controls { flex: none; display: flex; align-items: center; height: 44px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
.locale-menu { position: relative; }
.locale-menu > summary { height: 42px; min-width: 80px; display: flex; align-items: center; justify-content: space-between; gap: ${space2}px; padding: 0 ${space2}px 0 ${space3}px; color: var(--text); cursor: pointer; font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 500; list-style: none; }
.locale-menu > summary::-webkit-details-marker { display: none; }
.locale-chevron { width: 14px; height: 14px; stroke: currentColor; transition: transform 120ms ease; }
.locale-menu[open] .locale-chevron { transform: rotate(180deg); }
.locale-options { position: absolute; z-index: 13; top: calc(100% + ${space1}px); right: 0; min-width: 124px; display: grid; gap: 2px; margin: 0; padding: ${space1}px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); box-shadow: 0 10px 28px color-mix(in srgb, var(--text) 14%, transparent); list-style: none; }
.locale-option, .locale-current { min-height: 44px; display: flex; align-items: center; padding: ${space2}px ${space3}px; border-radius: 4px; font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 500; text-decoration: none; }
.locale-current { color: var(--muted); }
.locale-option { color: var(--text); }
.locale-option:visited { color: var(--text); }
.locale-option:hover, .locale-option:focus-visible { background: var(--bg); }
.theme-button, .mobile-navigation > summary { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; }
.display-controls .theme-button { width: 42px; height: 42px; border: 0; border-radius: 5px; }
.display-controls.has-locale-menu .theme-button { border-left: 1px solid var(--border); border-radius: 0 5px 5px 0; }
.theme-button:hover, .mobile-navigation > summary:hover { background: var(--panel); }
.mobile-navigation > summary:hover { border-color: var(--border); }
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
.toc-heading { display: flex; align-items: baseline; justify-content: space-between; gap: ${space2}px; }
.toc-progress { color: var(--muted); font-size: ${TYPE.micro.fontSize}px; font-weight: 500; font-variant-numeric: tabular-nums; }
.toc-list, .rail-history ol { list-style: none; padding: 0; }
.toc-list { display: grid; gap: 2px; }
.toc-link { min-height: 36px; display: grid; grid-template-columns: 28px minmax(0,1fr); gap: ${space2}px; align-items: center; padding: ${space1}px ${space2}px; border-left: 4px solid transparent; color: var(--muted); font-size: ${TYPE.body.wide.fontSize}px; font-weight: 500; text-decoration: none; }
.toc-link:visited { color: var(--muted); }
.toc-number { color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.toc-link[aria-current="location"], .toc-link[aria-current="location"]:visited { border-left-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); font-weight: 700; }
.toc-link[aria-current="location"] .toc-number { color: var(--accent); }
.toc-link:hover, .toc-link:focus-visible { background: var(--panel); color: var(--text); }
.rail-history { padding-top: ${space5}px; border-top: 1px solid var(--border); }
.rail-history > ol > li, .older-history > ol > li { position: relative; padding: 0 0 ${space5}px ${space4}px; border-left: 1px solid var(--border); }
.rail-history > ol > li:last-child, .older-history > ol > li:last-child { padding-bottom: ${space3}px; }
.revision-dot { position: absolute; left: -5px; top: 7px; width: 9px; height: 9px; border: 1px solid var(--component-border); border-radius: 50%; background: var(--bg); }
.rail-history > ol > .current .revision-dot { border-color: var(--accent); background: var(--accent); }
.revision-head { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: ${space2}px; align-items: baseline; }
.revision-head strong { font-size: ${TYPE.menu.fontSize}px; }
.revision-head time { color: var(--muted); font-size: ${TYPE.micro.fontSize}px; }
.revision-head + p { margin: ${space2}px 0; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.revision-disclosure, .older-history { position: relative; }
.revision-disclosure > summary, .older-history > summary { min-height: 32px; display: flex; align-items: center; color: var(--text); cursor: pointer; font-size: ${TYPE.supporting.wide.fontSize}px; }
.revision-disclosure > summary::marker, .older-history > summary::marker { color: var(--muted); }
.revision-popup { position: absolute; z-index: 12; top: 100%; right: 0; width: min(560px, calc(100vw - ${LAYOUT.tableOfContentsWidth + 80}px)); max-height: min(70vh, 680px); overflow: auto; padding: ${space4}px; border: 1px solid var(--border); background: var(--panel); box-shadow: 0 12px 32px color-mix(in srgb, var(--text) 14%, transparent); }
.revision-popup .design-direction-list { grid-template-columns: 1fr; }
.revision-popup .design-direction { padding-inline: ${space2}px; }
.revision-popup .design-direction + .design-direction { border-top: 1px solid var(--border); border-left: 0; }
.older-history > ol { list-style: none; padding: ${space3}px 0 0; }
.document-head { max-width: 78ch; }
.document-head + .document-section { margin-top: ${space5}px; padding-top: ${space4}px; }
.document-section + .document-section { margin-top: ${space6}px; padding-top: ${space4}px; }
.section-title { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: ${space2}px; align-items: baseline; }
.section-number { color: var(--accent); font-size: inherit; line-height: inherit; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.document-head h1 { margin: 0; font-size: ${TYPE.pageTitle.wide.fontSize}px; line-height: ${TYPE.pageTitle.wide.lineHeight}; letter-spacing: -.04em; overflow-wrap: anywhere; }
.synopsis dd p + p { margin-top: ${space2}px; }
.synopsis > div { display: grid; grid-template-columns: 80px minmax(0,1fr); gap: ${space5}px; padding: ${space3}px ${space2}px; border-bottom: 1px solid var(--border); }
.synopsis dt { font-weight: 700; }
.summary-label-stacked { display: inline-flex; flex-direction: column; align-items: flex-start; }
.synopsis dd { margin: 0; }
.compact-check-verification { margin-left: ${space2}px; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.section-title { width: 100%; margin: 0 0 ${space4}px; padding-bottom: ${space3}px; border-bottom: 2px solid var(--component-border); color: var(--text); font-size: ${TYPE.sectionTitle.wide.fontSize}px; }
.plain-list { padding-left: ${space4}px; display: grid; gap: ${space2}px; }
.empty { color: var(--muted); }
.design-direction-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.design-direction-list.design-direction-count-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.design-direction { min-width: 0; padding: ${space4}px ${space4}px ${space5}px; }
.design-direction + .design-direction { border-left: 1px solid var(--border); }
.direction-head { min-height: ${space6}px; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: ${space2}px; align-items: start; }
.direction-head h3 { margin: 0; font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.direction-number { color: var(--accent); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; }
.direction-title-line { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: ${space1}px ${space2}px; }
.direction-statuses { display: flex; flex-wrap: wrap; gap: ${space1}px; }
.direction-status { padding: 2px ${space2}px; border: 1px solid var(--component-border); border-radius: 999px; font-size: ${TYPE.micro.compactFontSize}px; font-weight: 700; }
.direction-status.selected { border-color: var(--accent); color: var(--accent); }
.direction-image { margin-top: ${space3}px; display: grid; min-height: 180px; place-items: center; overflow: hidden; border: 1px solid var(--component-border); background: var(--panel); }
.direction-image img { display: block; width: 100%; height: auto; max-height: 440px; object-fit: contain; }
.direction-summary { margin-top: ${space4}px; }
.direction-summary p + p { margin-top: ${space2}px; }
.direction-details { display: grid; gap: ${space4}px; margin-top: ${space4}px; padding-top: ${space3}px; border-top: 1px solid var(--border); }
.direction-details h4 { margin: 0 0 ${space2}px; color: var(--accent); font-size: ${TYPE.supporting.wide.fontSize}px; }
.direction-details .plain-list, .direction-references ul { padding-left: ${space4}px; display: grid; gap: ${space1}px; }
.direction-references { margin-top: ${space4}px; padding-top: ${space3}px; border-top: 1px solid var(--border); }
.direction-references > summary { min-height: 32px; display: flex; align-items: center; color: var(--accent); cursor: pointer; font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; list-style: none; }
.direction-references > summary::-webkit-details-marker { display: none; }
.direction-references > summary::after { margin-left: ${space2}px; content: "›"; transition: transform 120ms ease; }
.direction-references[open] > summary::after { transform: rotate(90deg); }
.direction-reference-content { min-width: 0; padding-top: ${space2}px; }
.direction-references li p { margin: ${space1}px 0 0; font-size: ${TYPE.supporting.wide.fontSize}px; }
.direction-rationales { margin: ${space4}px 0 0; border-top: 1px solid var(--border); }
.direction-rationales > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: ${space3}px; padding: ${space3}px 0; }
.direction-rationales > div + div { border-top: 1px solid var(--border); }
.direction-rationales dt { color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; }
.direction-rationales dd { margin: 0; }
.direction-rationales p + p { margin-top: ${space2}px; }
.selection-source { display: block; margin-top: ${space1}px; color: var(--muted); font-size: ${TYPE.micro.fontSize}px; font-weight: 500; }
@supports (grid-template-rows: subgrid) {
  .design-direction { display: grid; grid-row: span 6; grid-template-rows: subgrid; }
  .direction-head { grid-row: 1; }
  .direction-image { grid-row: 2; }
  .direction-summary { grid-row: 3; }
  .direction-details { grid-row: 4; }
  .direction-rationales { grid-row: 5; }
  .direction-references { grid-row: 6; }
}
.behavior-steps { list-style: none; padding: 0; display: grid; }
.behavior-steps li { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr); column-gap: ${space3}px; min-width: 0; min-height: 56px; padding-bottom: ${space4}px; }
.step-number { position: relative; z-index: 1; display: block; width: 28px; background: var(--bg); color: var(--accent); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; font-variant-numeric: tabular-nums; }
.behavior-steps strong, .behavior-outcomes strong { display: block; font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.behavior-steps p { grid-column: 2; margin-top: ${space1}px; }
.behavior-steps p + p, .behavior-outcomes p + p, .decision-list p + p { margin-top: ${space2}px; }
.behavior-outcomes-block { margin-top: ${space2}px; padding-top: ${space4}px; }
.behavior-outcomes-title { display: flex; align-items: center; gap: ${space3}px; margin: 0 0 ${space4}px; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.behavior-outcomes-title::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--border); }
.behavior-outcomes { list-style: none; padding: 0; display: grid; }
.behavior-outcomes li { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: ${space3}px; align-items: start; min-width: 0; }
.behavior-outcomes li + li { margin-top: ${space4}px; padding-top: ${space4}px; border-top: 1px solid var(--border); }
.outcome-mark { display: grid; width: 24px; height: 24px; place-items: center; border: 1px solid var(--accent); border-radius: 50%; color: var(--accent); font-weight: 700; }
.behavior-outcomes .cancel .outcome-mark { border-color: var(--component-border); color: var(--muted); }
.intent-groups > .intent-group, .intent-groups > .legacy-intent-group { padding: ${space4}px ${space2}px 0; }
.intent-groups > .intent-group + .intent-group,
.intent-groups > .intent-group + .legacy-intent-group,
.intent-groups > .legacy-intent-group + .legacy-intent-group,
.intent-groups > .legacy-intent-group + .intent-group { margin-top: ${space5}px; padding-top: ${space5}px; border-top: 1px solid var(--border); }
.subheading { margin: 0 0 ${space3}px; color: var(--accent); font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.decision-list { list-style: none; padding: 0; }
.decision-list li { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: ${space1}px ${space4}px; padding: ${space2}px 0; border-top: 1px solid var(--border); }
.decision-number { color: var(--accent); font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; }
.decision-list li:first-child { border-top: 0; }
.intent-statement { display: block; min-width: 0; padding-block: ${space2}px; font-size: ${TYPE.subsectionTitle.wide.fontSize}px; }
.decision-disclosure { min-width: 0; }
.decision-disclosure > summary { min-height: 32px; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: ${space2}px; cursor: pointer; list-style: none; }
.decision-disclosure > summary::-webkit-details-marker { display: none; }
.decision-disclosure > summary::after { content: "›"; transition: transform 120ms ease; }
.decision-disclosure[open] > summary::after { transform: rotate(90deg); }
.decision-reason { padding: 0 ${space5}px ${space1}px 0; }
.decision-number { padding-top: ${space2}px; }
.exclusion-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${space2}px ${space6}px; padding-left: ${space4}px; }
.intent-verification > summary { min-height: 44px; display: flex; align-items: center; color: var(--muted); cursor: pointer; font-size: ${TYPE.supporting.wide.fontSize}px; font-weight: 700; list-style: none; }
.intent-verification > summary::-webkit-details-marker { display: none; }
.intent-verification > summary::after { margin-left: ${space2}px; color: var(--text); content: "›"; transition: transform 120ms ease; }
.intent-verification[open] > summary::after { transform: rotate(90deg); }
.section-disclosure { border: 0; }
.section-disclosure-summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; list-style: none; }
.section-disclosure-summary::-webkit-details-marker { display: none; }
.section-disclosure-summary .section-title { flex: 1 1 auto; }
.section-disclosure-summary::after { margin-left: ${space2}px; color: var(--text); content: "›"; transition: transform 120ms ease; }
.section-disclosure[open] > .section-disclosure-summary::after { transform: rotate(90deg); }
.section-disclosure:not([open]) > .section-disclosure-summary .section-title { margin-bottom: 0; }
.reference-markers { display: inline-flex; margin-left: ${space1}px; white-space: nowrap; font-size: .78em; line-height: 1; vertical-align: .4em; }
.reference-marker { display: inline-grid; min-width: 24px; min-height: 24px; place-items: center; margin-block: -6px; color: var(--accent); font-weight: 700; text-decoration: none; }
.reference-marker:visited { color: var(--accent); }
.reference-marker:hover { text-decoration: underline; }
.verification-marker { min-width: 32px; color: var(--text); }
.verification-marker:visited { color: var(--text); }
.evidence-list { margin: 0; padding: 0; list-style: none; }
.evidence-list > li { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: ${space3}px; padding: ${space4}px ${space2}px; border-top: 1px solid var(--border); }
.evidence-number { color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; }
.evidence-entry-title { display: block; }
.evidence-entry-location { margin-top: ${space1}px; overflow-wrap: anywhere; }
.verification-list { margin: 0; padding: 0; list-style: none; }
.verification-list > li { display: grid; grid-template-columns: 56px minmax(0,1fr); gap: ${space3}px; padding: ${space4}px ${space2}px; border-top: 1px solid var(--border); }
.verification-symbol { color: var(--text); font-weight: 700; }
.verification-entry-title { display: block; }
.verification-source { display: block; margin-top: ${space1}px; color: var(--muted); font-size: ${TYPE.supporting.wide.fontSize}px; }
.verification-entry-copy p { margin-top: ${space2}px; }
.reference-popover { position: fixed; inset: unset; top: 0; left: 0; width: min(420px, calc(100vw - ${space6}px)); max-height: min(68vh, 620px); margin: 0; padding: 0; overflow: visible; border: 1px solid var(--component-border); border-radius: 8px; background: var(--panel); color: var(--text); box-shadow: 0 18px 48px color-mix(in srgb, var(--text) 22%, transparent); }
.reference-popover:popover-open { display: flex; flex-direction: column; }
.reference-popover::backdrop { background: transparent; }
.reference-popover::before { position: absolute; left: var(--popover-arrow-x, 50%); width: 12px; height: 12px; border: 1px solid var(--component-border); background: var(--panel); content: ""; transform: translateX(-50%) rotate(45deg); }
.reference-popover[data-placement="below"]::before { top: -7px; border-right: 0; border-bottom: 0; }
.reference-popover[data-placement="above"]::before { bottom: -7px; border-top: 0; border-left: 0; }
.reference-popover[data-placement="sheet"]::before { display: none; }
.reference-popover-head { position: relative; z-index: 1; flex: none; display: flex; align-items: center; justify-content: space-between; gap: ${space3}px; padding: ${space3}px ${space4}px; border-bottom: 1px solid var(--border); border-radius: 8px 8px 0 0; background: var(--panel); }
.reference-popover-head strong { min-width: 0; }
.reference-popover-close { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--text); cursor: pointer; font-size: 20px; }
.reference-popover-close:hover { background: var(--bg); }
.reference-popover-body { min-height: 0; padding: ${space4}px; overflow: auto; }
.reference-popover-body .evidence-entry-location { margin-top: ${space2}px; }
.reference-popover-more { flex: none; display: flex; min-height: 44px; align-items: center; margin: 0 ${space4}px ${space4}px; font-weight: 700; }
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
  .mobile-navigation-panel .toc-list { display: grid; gap: ${space1}px; }
  .mobile-navigation-panel .toc-link { min-height: 44px; }
  .mobile-navigation-panel .rail-history { padding-top: ${space5}px; }
  .mobile-navigation-panel .revision-popup { position: static; width: auto; max-height: none; margin-top: ${space2}px; padding: ${space3}px; box-shadow: none; }
}
@media (max-width: ${LAYOUT.narrowBreakpoint - 1}px) {
  body { font-size: ${TYPE.body.narrow.fontSize}px; line-height: ${TYPE.body.narrow.lineHeight}; }
  .topbar-inner { padding: 0 ${space4}px; gap: ${space3}px; }
  .brand { font-size: ${TYPE.brand.narrow.fontSize}px; line-height: ${TYPE.brand.narrow.lineHeight}; }
  .repository { max-width: 30vw; }
  .main { padding: ${space8}px ${space4}px ${space9}px; }
  .document-head + .document-section,
  .document-section + .document-section { margin-top: ${space5}px; padding-top: ${space4}px; }
  .document-head h1 { font-size: ${TYPE.pageTitle.narrow.fontSize}px; line-height: ${TYPE.pageTitle.narrow.lineHeight}; }
  .direction-references > summary, .decision-disclosure > summary { min-height: 44px; }
  .exclusion-list { grid-template-columns: 1fr; }
  .design-direction-list, .design-direction-list.design-direction-count-3 { grid-template-columns: 1fr; }
  .design-direction { display: block; grid-row: auto; padding-inline: ${space2}px; }
  .design-direction + .design-direction { border-top: 1px solid var(--border); border-left: 0; }
  .direction-rationales > div { grid-template-columns: 1fr; gap: ${space1}px; }
  .revision-content > div { grid-template-columns: 1fr; gap: ${space1}px; }
  .reference-popover { width: min(420px, calc(100vw - ${space6}px)); max-height: 72vh; }
}
@media (max-width: ${LAYOUT.compactBreakpoint}px) {
  .topbar-inner { padding-inline: ${space3}px; gap: ${space2}px; }
  .brand { gap: ${space1}px; }
  .brand-icon { width: 20px; height: 20px; border-radius: 5px; }
  .brand-product { display: none; }
  .repository { display: none; }
  .mobile-navigation-panel .mobile-repository { display: flex; }
  .topbar-inner.has-locale-switch .status { display: none; }
  .status { max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .synopsis > div { grid-template-columns: 1fr; gap: ${space1}px; padding-inline: 0; }
  .behavior-steps li { min-height: 0; padding-bottom: ${space5}px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
@media (forced-colors: active) {
  .status, .display-controls, .mobile-navigation > summary, .locale-options, .outcome-mark, .direction-status, .direction-image { border: 1px solid ButtonText; }
  .step-number { background: Canvas; color: CanvasText; }
  .revision-dot, .rail-history .current .revision-dot { border-color: CanvasText; background: Canvas; }
}
@media print {
  :root, :root[data-theme], :root:not([data-theme="light"]) { color-scheme: light; ${themeVariables(COLORS.light)}; }
  .topbar, .rail, .mobile-navigation, .skip, .reference-popover { display: none !important; }
  .layout { display: block; }
  .main { padding: 0; }
  .design-direction { break-inside: avoid; }
  .direction-reference-content,
  .decision-reason,
  .section-disclosure-content { display: block !important; }
  .direction-references::details-content,
  .decision-disclosure::details-content,
  .section-disclosure::details-content { content-visibility: visible; }
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
const referencePopover=document.getElementById("reference-popover");
const referencePopoverTitle=document.getElementById("reference-popover-title");
const referencePopoverBody=document.querySelector("[data-reference-popover-body]");
const referencePopoverMore=document.querySelector("[data-reference-popover-more]");
const referencePopoverClose=referencePopover?.querySelector(".reference-popover-close");
const links=[...document.querySelectorAll('nav a[href^="#"]')];
const sections=[...document.querySelectorAll(".document-section[id]")];
const progress=[...document.querySelectorAll("[data-toc-current]")];
let frame=0;
let popoverFrame=0;
let activeReferenceMarker;
const currentTheme=()=>root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
const syncTheme=()=>{if(!theme)return;const next=currentTheme()==="dark"?"light":"dark";theme.setAttribute("aria-label",labels[next]);theme.setAttribute("title",labels[next]);for(const icon of theme.querySelectorAll("[data-theme-icon]"))icon.toggleAttribute("hidden",icon.dataset.themeIcon!==next);};
const focusTarget=target=>{const had=target.hasAttribute("tabindex");if(!had)target.setAttribute("tabindex","-1");target.focus({preventScroll:true});if(!had)target.addEventListener("blur",()=>target.removeAttribute("tabindex"),{once:true});};
const reveal=target=>{for(let item=target;item;item=item.parentElement)if(item.tagName==="DETAILS")item.open=true;};
const openTarget=()=>{if(!location.hash)return;const target=document.getElementById(location.hash.slice(1));if(!target)return;reveal(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({block:"start"});});};
const syncCurrent=()=>{if(sections.length===0)return;let current=sections[0];if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)current=sections[sections.length-1];else for(const section of sections){if(section.getBoundingClientRect().top<=96)current=section;else break;}const index=sections.indexOf(current);for(const item of progress)item.textContent=String(index+1);for(const link of links){if(link.hash==="#"+current.id)link.setAttribute("aria-current","location");else link.removeAttribute("aria-current");}};
const positionReferencePopover=()=>{if(!activeReferenceMarker||!referencePopover?.matches(":popover-open"))return;const marker=activeReferenceMarker.getBoundingClientRect();if(marker.bottom<0||marker.top>innerHeight){referencePopover.hidePopover();return;}const margin=12;const gap=10;const width=Math.min(420,innerWidth-margin*2);referencePopover.style.width=width+"px";referencePopover.style.maxHeight="none";const naturalHeight=referencePopover.scrollHeight;const below=innerHeight-marker.bottom-gap-margin;const above=marker.top-gap-margin;let placement;let available;if(innerWidth<${LAYOUT.narrowBreakpoint}&&Math.max(below,above)<180){placement="sheet";available=innerHeight-margin*2;}else if(below>=Math.min(naturalHeight,180)||below>=above){placement="below";available=below;}else{placement="above";available=above;}referencePopover.dataset.placement=placement;referencePopover.style.maxHeight=Math.max(80,Math.min(available,620))+"px";const height=referencePopover.getBoundingClientRect().height;let left=Math.min(Math.max(marker.left+marker.width/2-width/2,margin),innerWidth-margin-width);let top;if(placement==="sheet"){left=margin;top=innerHeight-margin-height;}else if(placement==="above")top=marker.top-gap-height;else top=marker.bottom+gap;referencePopover.style.left=Math.round(left)+"px";referencePopover.style.top=Math.round(Math.max(margin,top))+"px";const arrow=Math.min(Math.max(marker.left+marker.width/2-left,20),width-20);referencePopover.style.setProperty("--popover-arrow-x",arrow+"px");referencePopover.style.visibility="";};
const schedulePopoverPosition=()=>{if(popoverFrame||!referencePopover?.matches(":popover-open"))return;popoverFrame=requestAnimationFrame(()=>{popoverFrame=0;positionReferencePopover();});};
syncTheme();
theme?.addEventListener("click",()=>{root.dataset.theme=currentTheme()==="dark"?"light":"dark";syncTheme();});
navigation?.addEventListener("click",event=>{if(event.target.closest?.('a[href^="#"]'))navigation.open=false;});
document.addEventListener("click",event=>{const marker=event.target.closest?.(".reference-marker");if(!marker||!referencePopover?.showPopover)return;const target=document.getElementById(marker.dataset.referenceTarget);const copy=target?.querySelector(".reference-entry-copy");if(!target||!copy)return;event.preventDefault();if(activeReferenceMarker&&activeReferenceMarker!==marker)activeReferenceMarker.setAttribute("aria-expanded","false");activeReferenceMarker=marker;marker.setAttribute("aria-expanded","true");referencePopoverTitle.textContent=marker.dataset.referenceTitle||marker.textContent;referencePopoverBody.replaceChildren(copy.cloneNode(true));referencePopoverMore.href="#"+target.id;referencePopoverMore.textContent=marker.dataset.referenceListLabel||"";referencePopover.style.visibility="hidden";if(!referencePopover.matches(":popover-open"))referencePopover.showPopover();positionReferencePopover();referencePopoverClose?.focus();});
referencePopoverClose?.addEventListener("click",()=>{referencePopover.hidePopover();activeReferenceMarker?.focus();});
referencePopoverMore?.addEventListener("click",()=>{if(referencePopover.matches(":popover-open"))referencePopover.hidePopover();});
referencePopover?.addEventListener("toggle",event=>{if(event.newState==="closed"&&activeReferenceMarker){activeReferenceMarker.setAttribute("aria-expanded","false");activeReferenceMarker=undefined;referencePopover.removeAttribute("data-placement");referencePopover.removeAttribute("style");}});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",syncTheme);
addEventListener("hashchange",openTarget);
addEventListener("click",event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)requestAnimationFrame(openTarget);});
addEventListener("keydown",event=>{if(event.key==="Escape"&&navigation?.open){navigation.open=false;navigation.querySelector("summary")?.focus();}});
addEventListener("resize",schedulePopoverPosition);
addEventListener("scroll",()=>{schedulePopoverPosition();if(frame)return;frame=requestAnimationFrame(()=>{frame=0;syncCurrent();});},{passive:true});
openTarget();syncCurrent();
})();`;
}

function localeMenu(value, currentLocale, dictionary) {
  if (value === undefined) return "";
  if (
    value === null
    || typeof value !== "object"
    || !["en-US", "ko-KR"].includes(value.locale)
    || typeof value.href !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/u.test(value.href)
  ) {
    throw new TypeError("alternateLocale must name a supported locale and sibling HTML file");
  }
  const currentText = currentLocale === "ko-KR" ? "한국어" : "English";
  const alternateText = value.locale === "ko-KR" ? "한국어" : "English";
  return `<details class="locale-menu">
    <summary aria-label="${escapeHtml(label(dictionary, "language"))}" title="${escapeHtml(label(dictionary, "language"))}"><span lang="${escapeHtml(currentLocale)}">${currentText}</span><svg class="locale-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m8 10 4 4 4-4"></path></svg></summary>
    <ul class="locale-options"><li><span class="locale-current" aria-current="page" lang="${escapeHtml(currentLocale)}">${currentText}</span></li><li><a class="locale-option" href="${escapeHtml(value.href)}" hreflang="${escapeHtml(value.locale)}" lang="${escapeHtml(value.locale)}">${alternateText}</a></li></ul>
  </details>`;
}

export function renderAlignArtifact(data, { alternateLocale, digest }) {
  const dictionary = dictionaries[data.locale];
  const locale = localeMenu(alternateLocale, data.locale, dictionary);
  const presentationData = Object.freeze({
    ...data,
    revisions: Object.freeze(data.revisions.map((revision) => Object.freeze({
      ...revision,
      content: presentationContent(revision.content),
    }))),
  });
  const current = presentationData.revisions.at(-1);
  const content = current.content;
  const catalog = evidenceCatalog(content);
  const verifications = verificationCatalog(content, dictionary);
  const sections = [
    { id: "overview", title: label(dictionary, "overview"), include: true, render: (number) => overview(content, dictionary, number, catalog) },
    { id: "intent", title: label(dictionary, "decidedIntent"), include: true, render: (number) => intentSection(content, dictionary, number, catalog, verifications) },
    { id: "design-directions", title: label(dictionary, "designDirections"), include: content.designDirections !== undefined, render: (number) => designDirectionsSection(content, dictionary, number, catalog) },
    { id: "evidence", title: label(dictionary, "evidence"), include: content.evidence.length > 0, render: (number) => evidenceSection(catalog, dictionary, number) },
  ].filter((section) => section.include).map((section, index) => ({
    ...section,
    number: index + 1,
    html: section.render(index + 1),
  }));
  const showToc = sections.length >= 3;
  const toc = showToc ? `<ol class="toc-list">${sections.map(
    (section) => `<li><a class="toc-link" href="#${section.id}"><span class="toc-number">${sectionOrdinal(section.number)}</span><span>${escapeHtml(section.title)}</span></a></li>`,
  ).join("")}</ol>` : "";
  const mobileNavigation = `<details class="mobile-navigation">
    <summary aria-label="${escapeHtml(label(dictionary, "navigation"))}" title="${escapeHtml(label(dictionary, "navigation"))}"><svg class="navigation-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h10"></path><circle cx="18" cy="18" r="2.5"></circle></svg></summary>
    <div class="mobile-navigation-panel">
      ${repositoryMark(data.repository, "mobile-repository")}
      ${showToc ? `<nav class="toc" aria-label="${escapeHtml(label(dictionary, "toc"))}">${tocHeading(dictionary, sections.length)}${toc}</nav>` : ""}
      ${railHistory(presentationData, dictionary, "-mobile")}
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
    <div class="topbar-inner${locale === "" ? "" : " has-locale-switch"}">
      <div class="brand"><img class="brand-icon" src="${iconDataUrl}" alt="" width="24" height="24"><span>HOPE</span><span class="brand-product">· ALIGN</span></div>
      ${repositoryMark(data.repository, "repository")}
      <span class="status">v${current.number} · ${escapeHtml(label(dictionary, "currentAgreement"))}</span>
      <div class="top-actions">
        <div class="display-controls${locale === "" ? "" : " has-locale-menu"}">
${locale === "" ? "" : `          ${locale}\n`}          <button class="theme-button" id="theme-toggle" type="button" aria-label="${escapeHtml(data.theme === "dark" ? label(dictionary, "useLightTheme") : label(dictionary, "useDarkTheme"))}" title="${escapeHtml(data.theme === "dark" ? label(dictionary, "useLightTheme") : label(dictionary, "useDarkTheme"))}">
          <svg class="theme-icon" data-theme-icon="dark" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${data.theme === "dark" ? " hidden" : ""}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path></svg>
          <svg class="theme-icon" data-theme-icon="light" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${data.theme === "dark" ? "" : " hidden"}><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>
          </button>
        </div>
        ${mobileNavigation}
      </div>
    </div>
  </header>
  <div class="layout">
    <main class="main" id="agreement-document">${documentTitle(content)}${sections.map((section) => section.html).join("")}</main>
    <aside class="rail"><div class="rail-inner">
      ${showToc ? `<nav class="toc" aria-label="${escapeHtml(label(dictionary, "toc"))}">${tocHeading(dictionary, sections.length)}${toc}</nav>` : ""}
      ${railHistory(presentationData, dictionary)}
    </div></aside>
  </div>
  ${catalog.entries.length === 0 && verifications.entries.length === 0 ? "" : referencePopover(dictionary)}
  <script id="hope-align-data" type="application/json">${embeddedJson(data)}</script>
  <script>${script}</script>
</body>
</html>
`;
}
