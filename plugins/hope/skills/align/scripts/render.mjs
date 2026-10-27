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

function sectionTitle(id, title, number, suffix = "") {
  return `<h2 class="section-title" id="${escapeHtml(id)}"><span class="section-number">${sectionOrdinal(number)}</span><span>${escapeHtml(title)}${suffix}</span></h2>`;
}

function documentTitle(content, dictionary) {
  return `<header class="document-head">
    <h1 id="artifact-title">${authoredText(content.title)}</h1>
    <p class="document-state"><span class="document-state-dot" aria-hidden="true"></span>${escapeHtml(label(dictionary, "currentAgreement"))}</p>
  </header>`;
}

function intentList(source, dictionary, catalog, verification) {
  const entries = Array.isArray(source)
    ? source
    : source.intent.map((item, intentIndex) => ({ intentIndex, item }));
  return `<ul class="decision-list intent-list">${entries.map(({ item, intentIndex }) => {
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
    const decisionSource = item.decidedBy === undefined
      ? ""
      : `<span class="decision-source">${escapeHtml(label(
        dictionary,
        item.decidedBy === "user" ? "decidedByUser" : "decidedByDelegated",
      ))}</span>`;
    const reason = item.reason === undefined ? "" : `<div class="decision-reason">${catalog
        ? citedParagraphs(item.reason, catalog, dictionary)
        : authoredParagraphs(citedValue(item.reason))}</div>`;
    return `<li><div class="decision-copy"><span class="intent-statement">${statement}${marker}${compactVerification}${decisionSource}</span>${reason}</div></li>`;
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
    legacyIntentDetails(content, dictionary, catalog),
    evidenceDetails(catalog, dictionary),
  ].filter(Boolean).join("\n");
  return `<section class="body-section document-section" id="boundary-evidence" aria-labelledby="boundary-evidence-title">
    ${sectionTitle("boundary-evidence-title", label(dictionary, "boundaryEvidence"), number)}
    <div class="intent-groups">${groups}</div>
  </section>`;
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
  const details = current || data.revisions.length === 1 ? "" : `<details class="revision-disclosure" id="revision-${revision.number}${idSuffix}" name="align-revision" data-dismiss>
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

export function renderAlignArtifact(data, { alternateLocale, digest }) {
  const dictionary = loadDictionaries(localeDirectory, data.locale, ["align"]);
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
  const hasDecisions = content.intent.some((item) => item.decidedBy !== undefined);
  const hasBoundaryEvidence = content.exclusions.length > 0
    || content.legacy !== undefined
    || content.evidence.length > 0;
  const sections = [
    { id: "intent", title: label(dictionary, "intent"), include: true, render: (number) => intentSection(content, dictionary, number, catalog, verifications) },
    { id: "decisions", title: label(dictionary, "decisions"), include: hasDecisions, render: (number) => decisionsSection(content, dictionary, number, catalog, verifications) },
    { id: "design-directions", title: label(dictionary, "designDirections"), include: content.designDirections !== undefined, render: (number) => designDirectionsSection(content, dictionary, number, catalog) },
    { id: "boundary-evidence", title: label(dictionary, "boundaryEvidence"), include: hasBoundaryEvidence, render: (number) => boundaryEvidenceSection(content, dictionary, number, catalog) },
  ].filter((section) => section.include).map((section, index) => ({
    ...section,
    number: index + 1,
    html: section.render(index + 1),
  }));
  const record = `SPEC-${String(current.number).padStart(3, "0")}`;
  const repository = authoredText(data.repository);
  return renderDocument({
    alternateLocale,
    dataScripts: [{ id: "hope-align-data", value: data }],
    headMeta: [
      ["hope-align-id", data.alignId],
      ["hope-align-digest", digest],
      ["hope-align-design-version", String(ALIGN_DESIGN_VERSION)],
    ],
    identity: { name: "Align", product: "ALIGN", record },
    locale: data.locale,
    main: {
      content: `${documentTitle(content, dictionary)}${sections.map((section) => section.html).join("")}`,
      id: "agreement-document",
    },
    navigation: {
      extra: railHistory(presentationData, dictionary, "-mobile"),
      label: label(dictionary, "navigation"),
      lead: repositoryMark(repository, "mobile-repository"),
    },
    popover: catalog.entries.length === 0 && verifications.entries.length === 0
      ? undefined
      : { href: "#evidence", label: label(dictionary, "evidenceViewList") },
    printIdentity: [
      repository,
      `v${current.number} · ${escapeHtml(label(dictionary, "currentAgreement"))} · <time datetime="${escapeHtml(current.agreedAt)}">${escapeHtml(current.agreedAt.slice(0, 10))}</time>`,
    ],
    rail: {
      extra: railHistory(presentationData, dictionary),
      footer: repositoryMark(repository, "repository"),
    },
    skip: { label: label(dictionary, "skip"), target: "intent" },
    styles: [readStylesheet(stylesheetUrl)],
    theme: data.theme,
    title: content.title,
    toc: sections.length >= 2
      ? { items: sections, label: label(dictionary, "menu") }
      : undefined,
  });
}
