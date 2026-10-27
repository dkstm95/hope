import {
  readStylesheet,
  renderDocument,
  repositoryMark,
  sectionOrdinal,
} from "../../../assets/artifact-shell/document.mjs";
import { label, loadDictionaries } from "../../../assets/artifact-shell/locales.mjs";
import {
  authoredParagraphs,
  authoredText,
  escapeHtml,
} from "../../../assets/artifact-shell/text.mjs";
import { ALIGN_DESIGN_VERSION } from "./design/tokens.mjs";

const localeDirectory = new URL("./locales/", import.meta.url);
const stylesheetUrl = new URL("./design/align.css", import.meta.url);

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
  const entries = content.intent.map((item, intentIndex) => {
    const human = item.by === "human";
    return Object.freeze({
      intent: item,
      intentIndex,
      label: label(dictionary, human ? "checkedByHuman" : "checkedByAgent"),
      marker: label(
        dictionary,
        human ? "verificationMarkerHuman" : "verificationMarkerAgent",
      ),
      target: `verification-${intentIndex + 1}`,
    });
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

function summaryLabelElement(tag, value) {
  const text = String(value);
  const balanced = /^(\p{Script=Hangul}{2}) (\p{Script=Hangul}{2})$/u.exec(text);
  if (!balanced) return `<${tag}>${escapeHtml(text)}</${tag}>`;
  return `<${tag}><span class="summary-label-stacked"><span>${escapeHtml(
    balanced[1],
  )}</span> <span>${escapeHtml(balanced[2])}</span></span></${tag}>`;
}

function textList(items, { className = "plain-list", catalog, dictionary } = {}) {
  return `<ul class="${className}">${items.map(
    (item) => `<li>${catalog
      ? citedInline(item, catalog, dictionary)
      : authoredText(citedValue(item))}</li>`,
  ).join("")}</ul>`;
}

function sectionTitle(id, title, number, suffix = "") {
  return `<h2 class="section-title" id="${escapeHtml(id)}"><span class="section-number">${sectionOrdinal(number)}</span><span>${escapeHtml(title)}${suffix}</span></h2>`;
}

function documentTitle(content, dictionary) {
  return `<header class="document-head">
    <h1 id="artifact-title">${authoredText(content.title)}</h1>
    <p class="document-state"><span class="document-state-dot" aria-hidden="true"></span>${escapeHtml(label(dictionary, "currentAgreement"))}</p>
  </header>`;
}

function intentList(entries, dictionary, catalog, verification) {
  return `<ul class="decision-list intent-list">${entries.map(({ item, intentIndex }) => {
    const marker = verificationMarker(verification.byIntentIndex.get(intentIndex), dictionary);
    const statement = citedInline(item.statement, catalog, dictionary);
    const decisionSource = item.decidedBy === undefined
      ? ""
      : `<span class="decision-source">${escapeHtml(label(
        dictionary,
        item.decidedBy === "user" ? "decidedByUser" : "decidedByDelegated",
      ))}</span>`;
    const reason = item.reason === undefined
      ? ""
      : `<div class="decision-reason">${citedParagraphs(item.reason, catalog, dictionary)}</div>`;
    return `<li><div class="decision-copy"><span class="intent-statement">${statement}${marker}${decisionSource}</span>${reason}</div></li>`;
  }).join("")}</ul>`;
}

function intentSection(content, dictionary, number, catalog, verification) {
  const goals = content.intent.flatMap((item, intentIndex) => (
    item.decidedBy === undefined ? [{ intentIndex, item }] : []
  ));
  const groups = [
    goals.length === 0 ? "" : `<div class="intent-group intent-record detailed-goal-list">
      <h3 class="subheading">${escapeHtml(label(dictionary, "outcomes"))}</h3>
      ${intentList(goals, dictionary, catalog, verification)}
    </div>`,
    flowBlock(content, dictionary, catalog),
    verificationDetails(verification, dictionary),
  ].filter(Boolean).join("\n");
  return `<section class="overview document-section" id="intent" aria-labelledby="intent-title">
    ${sectionTitle("intent-title", label(dictionary, "intent"), number)}
    <dl class="synopsis">
      <div>${summaryLabelElement("dt", label(dictionary, "goal"))}<dd>${citedParagraphs(content.goal, catalog, dictionary)}</dd></div>
      <div>${summaryLabelElement("dt", label(dictionary, "problem"))}<dd>${citedParagraphs(content.problem, catalog, dictionary)}</dd></div>
    </dl>
    ${groups === "" ? "" : `<div class="intent-groups intent-section-groups">${groups}</div>`}
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

function designDirectionsComparison(directions, images, dictionary, catalog) {
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
    const optionId = `design-direction-${option.id}`;
    const image = images[index];
    const rationaleHtml = rationale(option);
    return `<li class="design-direction" id="${escapeHtml(optionId)}">
    <header class="direction-head"><span class="direction-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div class="direction-title-line"><h3 id="${escapeHtml(optionId)}-title">${authoredText(option.title)}</h3><div class="direction-statuses">${status(option)}</div></div></header>
    <div class="direction-image"><img src="data:${image.mimeType};base64,${image.data}" alt="${escapeHtml(option.alt)}" width="${image.width}" height="${image.height}"></div>
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

function designDirectionsSection(content, images, dictionary, number, catalog) {
  return `<section class="body-section document-section" id="design-directions" aria-labelledby="design-directions-title">
    ${sectionTitle("design-directions-title", label(dictionary, "designDirections"), number)}
    ${designDirectionsComparison(content.designDirections, images, dictionary, catalog)}
  </section>`;
}

function flowBlock(content, dictionary, catalog) {
  const flow = content.flow;
  if (!flow) return "";
  const branches = flow.outcomes.length === 0 ? "" : `<ul class="flow-branches" aria-label="${escapeHtml(label(dictionary, "flowBranches"))}">${
    flow.outcomes.map((outcome) => `<li class="${outcome.kind === "cancel" ? "cancel" : "complete"}">
      <span class="outcome-mark" aria-hidden="true">${outcome.kind === "cancel" ? "×" : "✓"}</span>
      <div><strong>${citedInline(outcome.title, catalog, dictionary)}</strong>${outcome.detail
        ? citedParagraphs(outcome.detail, catalog, dictionary)
        : ""}</div>
    </li>`).join("")
  }</ul>`;
  return `<div class="intent-group intent-flow" id="flow">
    <h3 class="subheading">${escapeHtml(label(dictionary, "behavior"))}</h3>
    <ol class="behavior-steps">${flow.steps.map((step, index) => `<li>
      <span class="step-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <strong>${citedInline(step.title, catalog, dictionary)}</strong>${step.detail
        ? citedParagraphs(step.detail, catalog, dictionary)
        : ""}
    </li>`).join("")}</ol>
    ${branches}
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

function decisionsSection(content, dictionary, number, catalog, verification) {
  const decisions = content.intent.flatMap((item, intentIndex) => (
    item.decidedBy === undefined ? [] : [{ intentIndex, item }]
  ));
  const groups = `<div class="intent-group intent-record key-decision-list">${intentList(decisions, dictionary, catalog, verification)}</div>`;
  return `<section class="body-section document-section" id="decisions" aria-labelledby="decisions-title">
    ${sectionTitle("decisions-title", label(dictionary, "decisions"), number)}
    <div class="intent-groups">${groups}</div>
  </section>`;
}

function evidenceLocation(item) {
  if (/^https?:\/\//u.test(item.location)) {
    return `<a href="${escapeHtml(item.location)}">${authoredText(item.location)}</a>`;
  }
  return `<code>${authoredText(item.location)}</code>`;
}

function evidenceDetails(catalog, dictionary) {
  if (catalog.entries.length === 0) return "";
  return `<details class="intent-group section-disclosure" id="evidence">
    <summary class="nested-disclosure-summary">${escapeHtml(label(dictionary, "evidence"))} · ${catalog.entries.length}</summary>
    <div class="section-disclosure-content"><ol class="evidence-list">${catalog.entries.map((entry) => `<li id="${entry.target}" data-evidence-entry>
      <span class="evidence-number" aria-hidden="true">[${entry.number}]</span>
      <div class="reference-entry-copy evidence-entry-copy"><strong class="reference-entry-title evidence-entry-title">${authoredText(entry.item.label)}</strong><div class="evidence-entry-location">${evidenceLocation(entry.item)}</div></div>
    </li>`).join("")}</ol></div>
  </details>`;
}

function boundaryEvidenceSection(content, dictionary, number, catalog) {
  const exclusions = content.exclusions.length === 0 ? "" : `<div class="intent-group intent-exclusions" id="exclusions">
    <h3 class="subheading">${escapeHtml(label(dictionary, "excluded"))}</h3>
    ${textList(content.exclusions, { className: "exclusion-list", catalog, dictionary })}
  </div>`;
  const groups = [
    exclusions,
    evidenceDetails(catalog, dictionary),
  ].filter(Boolean).join("\n");
  return `<section class="body-section document-section" id="boundary-evidence" aria-labelledby="boundary-evidence-title">
    ${sectionTitle("boundary-evidence-title", label(dictionary, "boundaryEvidence"), number)}
    <div class="intent-groups">${groups}</div>
  </section>`;
}

function railEntry(entry, number, current, dictionary) {
  return `<li class="${current ? "current" : "past"}">
    <div class="revision-head"><span class="revision-dot" aria-hidden="true"></span><strong>v${number}${current ? ` · ${escapeHtml(label(dictionary, "currentAgreement"))}` : ""}</strong><time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.at.slice(0, 10))}</time></div>
    <p>${authoredText(entry.summary)}</p>
  </li>`;
}

/** The record's history entries, newest first; entries past the second fold away. */
function railHistory(history, dictionary, idSuffix = "") {
  const entries = history.map((entry, index) => ({ entry, number: index + 1 })).reverse();
  const item = ({ entry, number }) => railEntry(entry, number, number === history.length, dictionary);
  const older = entries.slice(2);
  const headingId = `rail-history-title${idSuffix}`;
  const olderHistory = older.length === 0 ? "" : `
    <details class="older-history"><summary>${older.length} ${escapeHtml(label(dictionary, "earlierRevisions"))}</summary><ol>${older.map(item).join("")}</ol></details>`;
  return `<section class="rail-history" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${escapeHtml(label(dictionary, "history"))}</h2>
    <ol>${entries.slice(0, 2).map(item).join("")}</ol>${olderHistory}
  </section>`;
}

/**
 * Render a validated Align record. `images` holds the decoded design-direction
 * PNGs in option order; `recordHref` names the JSON record beside the HTML.
 */
export function renderAlignArtifact(record, { images = [], recordHref }) {
  const dictionary = loadDictionaries(localeDirectory, record.locale, ["align"]);
  const content = record.content;
  if ((content.designDirections?.options.length ?? 0) !== images.length) {
    throw new Error("Align design directions need one image per option");
  }
  const current = record.history.at(-1);
  const revision = record.history.length;
  const catalog = evidenceCatalog(content);
  const verifications = verificationCatalog(content, dictionary);
  const hasDecisions = content.intent.some((item) => item.decidedBy !== undefined);
  const hasBoundaryEvidence = content.exclusions.length > 0 || content.evidence.length > 0;
  const sections = [
    { id: "intent", title: label(dictionary, "intent"), include: true, render: (number) => intentSection(content, dictionary, number, catalog, verifications) },
    { id: "decisions", title: label(dictionary, "decisions"), include: hasDecisions, render: (number) => decisionsSection(content, dictionary, number, catalog, verifications) },
    { id: "design-directions", title: label(dictionary, "designDirections"), include: content.designDirections !== undefined, render: (number) => designDirectionsSection(content, images, dictionary, number, catalog) },
    { id: "boundary-evidence", title: label(dictionary, "boundaryEvidence"), include: hasBoundaryEvidence, render: (number) => boundaryEvidenceSection(content, dictionary, number, catalog) },
  ].filter((section) => section.include).map((section, index) => ({
    ...section,
    number: index + 1,
    html: section.render(index + 1),
  }));
  const repository = authoredText(record.repository);
  return renderDocument({
    alternateLocale: record.alternateLocale,
    headMeta: [
      ["hope-align-id", record.alignId],
      ["hope-align-record", recordHref],
      ["hope-align-design-version", String(ALIGN_DESIGN_VERSION)],
    ],
    identity: { name: "Align", product: "ALIGN", record: `SPEC-${String(revision).padStart(3, "0")}` },
    locale: record.locale,
    main: {
      content: `${documentTitle(content, dictionary)}${sections.map((section) => section.html).join("")}`,
      id: "agreement-document",
    },
    navigation: {
      extra: railHistory(record.history, dictionary, "-mobile"),
      label: label(dictionary, "navigation"),
      lead: repositoryMark(repository, "mobile-repository"),
    },
    popover: catalog.entries.length === 0 && verifications.entries.length === 0
      ? undefined
      : { href: "#evidence", label: label(dictionary, "evidenceViewList") },
    printIdentity: [
      repository,
      `v${revision} · ${escapeHtml(label(dictionary, "currentAgreement"))} · <time datetime="${escapeHtml(current.at)}">${escapeHtml(current.at.slice(0, 10))}</time>`,
    ],
    rail: {
      extra: railHistory(record.history, dictionary),
      footer: repositoryMark(repository, "repository"),
    },
    skip: { label: label(dictionary, "skip"), target: "intent" },
    styles: [readStylesheet(stylesheetUrl)],
    theme: record.theme,
    title: content.title,
    toc: sections.length >= 2
      ? { items: sections, label: label(dictionary, "menu") }
      : undefined,
  });
}
