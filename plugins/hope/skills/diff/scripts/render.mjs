import { createHash } from "node:crypto";

import {
  readStylesheet,
  renderDocument,
  sectionOrdinal,
} from "../../../assets/artifact-shell/document.mjs";
import {
  authoredParagraphs as userParagraphs,
  authoredText as userText,
  escapeAttribute as htmlAttribute,
  escapeHtml as html,
} from "../../../assets/artifact-shell/text.mjs";
import { mountDiff } from "./client.mjs";
import { renderCodeEvidence } from "./code-evidence.mjs";
import { LIMITS, RENDERER_VERSION } from "./constants.mjs";
import { CODE_THEME, COLORS, DESIGN_VERSION } from "./design/tokens.mjs";
import { sha256 } from "./hash.mjs";
import { label, loadLocale } from "./locales/index.mjs";
import { renderReader } from "./reader/render.mjs";

const stylesheetUrl = new URL("./design/diff.css", import.meta.url);
const renderedCodeSources = new Set([
  "context-file",
  "patch",
]);
const linkedCodeSources = new Set([
  "context-file",
]);

function summaryLabelElement(value) {
  const text = String(value);
  const balanced = /^(\p{Script=Hangul}{2}) (\p{Script=Hangul}{2})$/u.exec(text);
  if (!balanced) return `<h3>${html(text)}</h3>`;
  return `<h3><span class="summary-label-stacked"><span>${html(
    balanced[1],
  )}</span> <span>${html(balanced[2])}</span></span></h3>`;
}

function basisKey(basis) {
  return {
    code: "basis.shownInCode",
    inferred: "basis.inferred",
    stated: "basis.stated",
    unknown: "basis.couldNotConfirm",
  }[basis];
}

function visibleBasisLabel(basis, dictionary) {
  if (basis === "code") return "";
  return label(dictionary, basisKey(basis));
}

function sourceTitle(evidence, dictionary) {
  const lines = `${evidence.startLine}–${evidence.endLine}`;
  if (evidence.path) {
    return `${evidence.path} · ${label(dictionary, `source.${evidence.sourceKind}`)} ${lines}`;
  }
  return `${label(dictionary, `source.${evidence.sourceKind}`)} ${lines}`;
}

function trustedCodeUrl(review, evidence) {
  if (
    !evidence.path
    || !evidence.revision
    || !linkedCodeSources.has(evidence.sourceKind)
  ) {
    return undefined;
  }
  const snapshot = review.snapshot.snapshot;
  const repository = review.snapshot.repository;
  if (!repository) return undefined;
  // A local head source is working-tree text, so only the merge base has a stable remote blob.
  if (review.snapshot.change.kind === "local" && evidence.revision !== snapshot.mergeBase) {
    return undefined;
  }
  const selected = evidence.revision === snapshot.head
    ? repository.head ?? repository
    : evidence.revision === snapshot.mergeBase
      ? repository.base ?? repository
      : repository;
  const { owner, name } = selected;
  const path = evidence.path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
    + `/blob/${encodeURIComponent(evidence.revision)}/${path}`
    + `#L${evidence.startLine}-L${evidence.endLine}`;
}

function changeRecord(change) {
  return change.kind === "github"
    ? `PR-${change.number}`
    : `LOCAL-${change.baseRevision.slice(0, 7)}`;
}

function repositoryLabel(snapshot) {
  return snapshot.change.kind === "local"
    ? snapshot.change.repositoryLabel
    : `${snapshot.repository.owner}/${snapshot.repository.name}`;
}

function changeReference(change) {
  return change.kind === "github" ? `PR #${change.number}` : changeRecord(change);
}

function accessibleControlLabel(context, action) {
  const normalized = String(context ?? "").replace(/\s+/gu, " ").trim();
  if (!normalized) return action;
  const shortened = [...normalized].slice(0, 160).join("");
  return `${shortened}${shortened.length < normalized.length ? "…" : ""} · ${action}`;
}

function evidenceTarget(evidence) {
  const key = `${evidence.sourceId}:${evidence.startLine}:${evidence.endLine}`;
  return `evidence-${createHash("sha256").update(key).digest("hex").slice(0, 12)}`;
}

function evidenceBlock(
  items,
  dictionary,
  review,
  codeRenderer,
  { context = "" } = {},
) {
  if (items.length === 0) return "";
  const records = items.map((item) => {
    const target = evidenceTarget(item);
    let record = codeRenderer.evidenceRecords.get(target);
    if (!record) {
      record = Object.freeze({
        item,
        number: codeRenderer.evidenceRecords.size + 1,
        target,
        title: sourceTitle(item, dictionary),
      });
      codeRenderer.evidenceRecords.set(target, record);
    }
    return record;
  }).sort((left, right) => left.number - right.number);
  return `<sup class="evidence-markers">${records.map((record) => {
    const accessible = accessibleControlLabel(
      context,
      `${label(dictionary, "common.evidence")} [${record.number}]: ${record.title}`,
    );
    return `<a class="reference-marker evidence-marker" href="#${record.target}" data-reference-target="${record.target}" data-reference-title="${html(`[${record.number}] ${record.title}`)}" aria-controls="reference-popover" aria-expanded="false" aria-haspopup="dialog" aria-label="${html(accessible)}">[${record.number}]</a>`;
  }).join("")}</sup>`;
}

function evidenceFootnotes(review, dictionary, codeRenderer) {
  const records = [...codeRenderer.evidenceRecords.values()];
  if (records.length === 0) return "";
  return `<details class="evidence-group evidence-footnotes" id="evidence-references">
    <summary><h3>${html(countedLabel(dictionary, "evidence.references", records.length))}</h3></summary>
    <div class="evidence-group-content"><ol class="evidence-footnote-list">${records.map((record) => {
      const url = trustedCodeUrl(review, record.item);
      const codeSource = renderedCodeSources.has(record.item.sourceKind);
      return `<li>
        <span class="evidence-number" aria-hidden="true">[${record.number}]</span>
        <article class="evidence-item" id="${record.target}" data-evidence-entry>
          <div class="evidence-meta">
            ${url
              ? `<a href="${html(url)}">${html(record.title)}</a>`
              : `<span>${html(record.title)}</span>`}
          </div>
          <pre class="${codeSource ? "code-evidence" : "source-text"}"><code${codeSource
            ? ` aria-label="${htmlAttribute(record.item.excerpt)}"`
            : ""}>${codeSource
            ? codeRenderer.render(record.item)
            : html(record.item.excerpt)}</code></pre>
        </article>
      </li>`;
    }).join("")}</ol></div>
  </details>`;
}

function claimBlock(
  claim,
  dictionary,
  review,
  codeRenderer,
  className = "",
  evidenceContext = claim.text,
  showBasis = true,
) {
  const basis = showBasis
    ? visibleBasisLabel(claim.basis, dictionary)
    : "";
  const markers = evidenceBlock(
    claim.evidence,
    dictionary,
    review,
    codeRenderer,
    { context: evidenceContext },
  );
  const suffix = `${markers}${basis
    ? `<span class="claim-basis">${html(basis)}</span>`
    : ""}`;
  return `<div class="claim ${html(className)}">
    ${userParagraphs(claim.text, suffix)}
  </div>`;
}

function titledClaim(
  item,
  dictionary,
  review,
  codeRenderer,
  showBasis = true,
) {
  return `<article class="explanation-step">
    <h3>${userText(item.title)}</h3>
    ${claimBlock(
      item,
      dictionary,
      review,
      codeRenderer,
      "",
      `${item.title}: ${item.text}`,
      showBasis,
    )}
  </article>`;
}

function aidEvidenceSuffix(aid, dictionary, review, codeRenderer) {
  const basis = visibleBasisLabel(aid.basis, dictionary);
  const markers = evidenceBlock(
    aid.evidence,
    dictionary,
    review,
    codeRenderer,
    { context: aid.title },
  );
  return `${markers}${basis
    ? `<span class="claim-basis">${html(basis)}</span>`
    : ""}`;
}

function visualRoute(from, to, dictionary, { block = false } = {}) {
  const tag = block ? "div" : "span";
  const accessible = label(dictionary, "visual.route")
    .replace("{from}", () => from)
    .replace("{to}", () => to);
  return `<${tag} class="visual-route">
    <span class="sr-only">${html(accessible)}</span>
    <strong aria-hidden="true">${userText(from)}</strong>
    <span aria-hidden="true">→</span>
    <strong aria-hidden="true">${userText(to)}</strong>
  </${tag}>`;
}

function visualBlock(visual, dictionary, review, codeRenderer) {
  const evidenceSuffix = aidEvidenceSuffix(
    visual,
    dictionary,
    review,
    codeRenderer,
  );
  let content;
  if (visual.kind === "flow") {
    content = `<ol class="visual-flow">${visual.items.map((item) => (
      `<li>
        <strong>${userText(item.label)}</strong>
        ${userParagraphs(item.detail)}
      </li>`
    )).join("")}</ol>`;
  } else if (visual.kind === "decision-table") {
    const caseLabel = label(dictionary, "visual.case");
    content = `<div class="table-scroll visual-table" role="region" aria-label="${html(visual.title)}" tabindex="0">
      <table class="decision-table">
        <thead><tr>
          <th scope="col">${html(caseLabel)}</th>
          ${visual.columns.map((column) => `<th scope="col">${userText(column)}</th>`).join("")}
        </tr></thead>
        <tbody>${visual.rows.map((row) => `<tr>
          <th scope="row" data-label="${htmlAttribute(caseLabel)}">${userText(row.case)}</th>
          ${row.cells.map((cell, index) => `<td data-label="${htmlAttribute(visual.columns[index])}">${userText(cell)}</td>`).join("")}
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
  } else if (visual.kind === "sequence") {
    const participants = new Map(visual.participants.map((item) => [item.id, item.label]));
    content = `<ul class="visual-participants" aria-label="${html(label(dictionary, "visual.participants"))}">${visual.participants.map(
      (participant) => `<li>${userText(participant.label)}</li>`,
    ).join("")}</ul>
      <ol class="visual-sequence">${visual.messages.map((message) => `<li>
        ${visualRoute(
          participants.get(message.from),
          participants.get(message.to),
          dictionary,
          { block: true },
        )}
        <p>${userText(message.label)}</p>
      </li>`).join("")}</ol>`;
  } else {
    const components = new Map(visual.components.map((item) => [item.id, item.label]));
    content = `<div class="visual-components">${visual.components.map((component) => (
      `<article>
        <h4>${userText(component.label)}</h4>
        ${userParagraphs(component.detail)}
      </article>`
    )).join("")}</div>
      <div class="visual-connections">
        <h4>${html(label(dictionary, "visual.connections"))}</h4>
        <ul>${visual.connections.map((connection) => `<li>
          ${visualRoute(
            components.get(connection.from),
            components.get(connection.to),
            dictionary,
          )}
          <span>${userText(connection.label)}</span>
        </li>`).join("")}</ul>
      </div>`;
  }
  return `<figure class="behavior-visual visual-${html(visual.kind)}">
    <figcaption>
      <strong class="visual-title">${userText(visual.title)}</strong>
      ${userParagraphs(visual.caption, evidenceSuffix)}
    </figcaption>
    ${content}
  </figure>`;
}

function microworldTrace(trace, title, dictionary) {
  return `<section class="microworld-trace">
    <h5>${html(title)}</h5>
    <ol>${trace.steps.map((step) => `<li>${userText(step)}</li>`).join("")}</ol>
    <div class="microworld-outcome">
      <strong>${html(label(dictionary, "microworld.outcome"))}:</strong>
      ${userParagraphs(trace.outcome)}
    </div>
  </section>`;
}

function unchangedMicroworldTrace(dictionary) {
  return `<section class="microworld-trace microworld-trace-unchanged">
    <h5>${html(label(dictionary, "microworld.after"))}</h5>
    <p class="microworld-unchanged">${html(label(dictionary, "microworld.unchanged"))}</p>
  </section>`;
}

function microworldBlock(world, dictionary, review, codeRenderer) {
  const evidenceSuffix = aidEvidenceSuffix(
    world,
    dictionary,
    review,
    codeRenderer,
  );
  const defaultKey = world.controls.map(
    (control) => `${control.id}=${control.defaultOptionId}`,
  ).join("|");
  return `<section class="microworld" data-microworld aria-labelledby="microworld-title" data-label-no-scenario="${html(label(dictionary, "microworld.noScenario"))}" data-label-selection="${html(label(dictionary, "microworld.selection"))}">
    <header>
      <p class="microworld-eyebrow">${html(label(dictionary, "microworld.tryIt"))}</p>
      <h3 id="microworld-title">${userText(world.title)}</h3>
      ${userParagraphs(world.instructions, evidenceSuffix)}
    </header>
    <div class="microworld-stage">
        <div class="microworld-controls" role="group" aria-labelledby="microworld-controls-title">
          <p class="microworld-controls-title" id="microworld-controls-title">${html(label(dictionary, "microworld.controls"))}</p>
          <div>${world.controls.map((control) => `<fieldset
        class="microworld-control-group"
        data-control-id="${html(control.id)}"
        data-control-kind="${html(control.kind)}"
        data-control-label="${html(control.label)}">
        <legend>${userText(control.label)}</legend>
        <div class="microworld-options">
          ${control.options.map((option) => {
            const optionId = `microworld-control-${control.id}-${option.id}`;
            return `<label class="microworld-option" for="${html(optionId)}">
              <input
                class="microworld-control"
                id="${html(optionId)}"
                name="microworld-${html(control.id)}"
                type="radio"
                value="${html(option.id)}"
                data-control-id="${html(control.id)}"
                data-control-label="${html(control.label)}"
                data-option-label="${html(option.label)}"
                ${option.id === control.defaultOptionId ? "checked " : ""}disabled>
              <span>${userText(option.label)}</span>
            </label>`;
          }).join("")}
        </div>
      </fieldset>`).join("")}</div>
        </div>
        <noscript><p class="microworld-noscript">${html(label(dictionary, "microworld.noScript"))}</p></noscript>
        <p class="sr-only" role="status" aria-live="polite" data-microworld-status></p>
        <div class="microworld-scenarios" role="region" aria-label="${html(label(dictionary, "microworld.selection"))}">
          ${world.scenarios.map((scenario) => `<article
        class="microworld-scenario"
        data-selection-key="${html(scenario.selectionKey)}"
        ${scenario.selectionKey === defaultKey ? "" : "hidden"}>
        <h4>${userText(scenario.title)}</h4>
        <div class="microworld-comparison">
          ${microworldTrace(
            scenario.before,
            label(dictionary, "microworld.before"),
            dictionary,
          )}
          ${scenario.unchanged
            ? unchangedMicroworldTrace(dictionary)
            : microworldTrace(
              scenario.after,
              label(dictionary, "microworld.after"),
              dictionary,
            )}
        </div>
        <div class="microworld-lesson">
          <strong>${html(label(dictionary, "microworld.lesson"))}:</strong>
          ${userParagraphs(scenario.lesson)}
        </div>
      </article>`).join("")}
        </div>
      </div>
      <p class="microworld-notice">${html(label(dictionary, "microworld.notice"))}</p>
      <details class="microworld-disclosure">
        <summary>${html(label(dictionary, "microworld.limits"))}</summary>
        <dl class="microworld-boundary">
          <div>
            <dt>${html(label(dictionary, "microworld.simplifies"))}</dt>
            <dd>${userParagraphs(world.simplifies)}</dd>
          </div>
          <div>
            <dt>${html(label(dictionary, "microworld.omits"))}</dt>
            <dd>${userParagraphs(world.omits)}</dd>
          </div>
        </dl>
      </details>
  </section>`;
}

function kindLabel(kind, dictionary) {
  return label(dictionary, `item.${kind}`);
}

function importanceLabel(importance, dictionary) {
  return label(dictionary, `importance.${importance}`);
}

function countedLabel(dictionary, key, count) {
  return label(dictionary, key).replace("{count}", String(count));
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    + ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function reviewItem(item, dictionary, review, codeRenderer, { compact = false } = {}) {
  const className = `review-item kind-${html(item.kind)}${compact ? " review-item-compact" : ""}`;
  const id = compact ? `summary-${item.id}` : item.id;
  const relatedLimits = item.limitIds.map((limitId) => (
    review.limits.find((limit) => limit.id === limitId)
  )).filter(Boolean);
  const markers = compact ? "" : evidenceBlock(
    item.evidence,
    dictionary,
    review,
    codeRenderer,
    { context: item.title },
  );
  const basis = compact ? "" : visibleBasisLabel(item.basis, dictionary);
  return `<article class="${className}" id="${html(id)}" data-importance="${html(item.importance)}">
    <div class="item-head">
      <span class="status kind-${html(item.kind)}">${html(kindLabel(item.kind, dictionary))}</span>
      <span class="importance">${html(importanceLabel(item.importance, dictionary))}</span>
      ${basis ? `<span class="item-basis">${html(basis)}</span>` : ""}
    </div>
    ${compact
      ? `<h4><a href="#${html(item.id)}">${userText(item.title)}</a></h4>`
      : `<h3>${userText(item.title)}</h3>`}
    ${compact ? "" : `
      ${userParagraphs(item.explanation, markers)}
      ${relatedLimits.length === 0 ? "" : `<p class="related-limits">
        <span>${html(label(dictionary, "item.relatedLimits"))}</span>
        ${relatedLimits.map((limit) => {
          const displayed = limitText(limit, dictionary);
          return `<a href="#scope-${html(limit.id)}">${userText(displayed.subject)}</a>`;
        }).join(" · ")}
      </p>`}
      <dl class="item-actions">
        <div class="item-effect"><dt>${html(label(dictionary, "item.effect"))}</dt><dd>${userParagraphs(item.effect)}</dd></div>
        <div class="item-next"><dt>${html(label(dictionary, "item.nextStep"))}</dt><dd>${userParagraphs(item.nextStep)}</dd></div>
        <div class="item-done"><dt>${html(label(dictionary, "item.doneWhen"))}</dt><dd>${userParagraphs(item.doneWhen)}</dd></div>
      </dl>
    `}
  </article>`;
}

function sectionHeading(title, number, id = "") {
  const idAttribute = id === "" ? "" : ` id="${html(id)}"`;
  return `<h2${idAttribute}><span class="section-number">${sectionOrdinal(number)}</span><span>${html(title)}</span></h2>`;
}

function documentTitle(claim, dictionary, review, codeRenderer) {
  const markers = evidenceBlock(
    claim.evidence,
    dictionary,
    review,
    codeRenderer,
    { context: claim.text },
  );
  return `<header class="document-title">
    <h1 id="review-title">${userText(claim.text)}${markers === "" ? "" : `&nbsp;<span class="title-evidence">${markers}</span>`}</h1>
    <div class="document-title-meta">
      <p class="document-state"><span class="document-state-dot" aria-hidden="true"></span>${html(changeReference(review.snapshot.change))} · <code>${html(review.snapshot.snapshot.head.slice(0, 8))}</code></p>
    </div>
  </header>`;
}

function section({ id, title, content, number }) {
  return `<section class="review-section" id="${html(id)}">
    <div class="section-heading">
      ${sectionHeading(title, number)}
    </div>
    ${content}
  </section>`;
}

function subsection({ id, title, content }) {
  return `<section class="review-subsection" id="${html(id)}">
    <div class="subsection-heading">
      <h3>${html(title)}</h3>
    </div>
    ${content}
  </section>`;
}

function collapsibleSection({ id, title, content, number, initiallyOpen = false }) {
  return `<details class="review-section review-section-collapsible" id="${html(id)}"${initiallyOpen ? " open" : ""}>
    <summary class="section-heading">
      ${sectionHeading(title, number)}
    </summary>
    <div class="section-content">${content}</div>
  </details>`;
}

function limitText(limit, dictionary) {
  if (limit.kind === "unchanged-context") {
    return {
      reason: label(dictionary, "scope.unchanged.reason"),
      subject: label(dictionary, "scope.unchanged.subject"),
    };
  }
  if (limit.kind === "verification") {
    return {
      reason: label(dictionary, "scope.verification.reason"),
      subject: label(dictionary, "scope.verification.subject"),
    };
  }
  if (limit.kind === "file-unavailable" && limit.reasonKind) {
    return {
      reason: label(dictionary, `scope.fileUnavailable.${limit.reasonKind}`),
      subject: limit.subject,
    };
  }
  if (limit.kind === "context-unavailable" && limit.reasonKind) {
    return {
      reason: label(dictionary, `scope.contextUnavailable.${limit.reasonKind}`),
      subject: limit.subject,
    };
  }
  return { reason: limit.reason, subject: limit.subject };
}

const changeMapKinds = Object.freeze(["explained", "supporting", "mechanical", "pending"]);

function changedLines(group) {
  return group.parts.reduce((total, part) => total + (part.file.availability === "text"
    ? part.segments.reduce((sum, segment) => sum + segment.rows.filter((row) => row.kind !== "context").length, 0)
    : part.file.additions + part.file.deletions), 0);
}

/**
 * One bar per review: each segment is a code-reader group, sized by its changed
 * lines and colored by group kind. Geometry uses SVG attributes so the CSP needs
 * no inline style; every segment is a link with a text name.
 */
function changeMap(review, dictionary) {
  const groups = review.reader?.layout.groups ?? [];
  if (groups.length === 0) return "";
  const files = review.reader.snapshot.files;
  const lines = groups.map((group) => changedLines(group));
  const width = 1000;
  const gap = 6;
  const usable = width - gap * (groups.length - 1);
  const minimum = Math.min(28, usable / groups.length);
  const total = lines.reduce((sum, value) => sum + Math.max(1, value), 0);
  const raw = lines.map((value) => Math.max(minimum, (usable * Math.max(1, value)) / total));
  const scale = usable / raw.reduce((sum, value) => sum + value, 0);
  let x = 0;
  const segments = groups.map((group, index) => {
    const kind = group.pending ? "pending" : group.kind;
    const segmentWidth = raw[index] * scale;
    const name = label(dictionary, "synopsis.shapeGroup")
      .replace("{number}", () => String(index + 1).padStart(2, "0"))
      .replace("{title}", () => group.title)
      .replace("{lines}", () => String(lines[index]));
    const segment = `<a class="change-map-link" href="#${html(group.id)}" aria-label="${html(name)}"><title>${html(name)}</title><rect class="change-map-hit" x="${x.toFixed(1)}" y="0" width="${segmentWidth.toFixed(1)}" height="44"></rect><rect class="change-map-segment kind-${html(kind)}" x="${x.toFixed(1)}" y="14" width="${segmentWidth.toFixed(1)}" height="16"></rect></a>`;
    x += segmentWidth + gap;
    return segment;
  }).join("");
  const kinds = changeMapKinds.map((kind) => ({
    count: groups.filter((group) => (group.pending ? "pending" : group.kind) === kind).length,
    kind,
  })).filter((entry) => entry.count > 0);
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const counts = label(dictionary, "synopsis.shapeCounts")
    .replace("{groups}", () => String(groups.length))
    .replace("{files}", () => String(files.length));
  return `<div class="synopsis-row synopsis-shape">
        ${summaryLabelElement(label(dictionary, "synopsis.shape"))}
        <div class="synopsis-value change-map">
          <svg class="change-map-bar" viewBox="0 0 ${width} 44" preserveAspectRatio="none" role="group" aria-label="${html(label(dictionary, "synopsis.shapeMap"))}">${segments}</svg>
          <div class="change-map-summary">
            <span class="change-map-counts">${html(counts)} <span class="change-map-lines"><span class="added">+${additions}</span> <span class="removed">−${deletions}</span></span></span>
            <ul class="change-map-legend">${kinds.map(({ count, kind }) => (
              `<li class="kind-${kind}"><span class="change-map-swatch" aria-hidden="true"></span>${html(kind === "pending" ? label(dictionary, "synopsis.shapePending") : label(dictionary, `file.use.${kind}`))} ${count}</li>`
            )).join("")}</ul>
          </div>
        </div>
      </div>`;
}

function synopsis(review, dictionary, codeRenderer, { number }) {
  const visibleItems = review.reviewItems.slice(0, 3);
  const hiddenItems = review.reviewItems.length - visibleItems.length;
  const materialLimits = review.limits.filter((limit) => limit.material);
  const visibleLimits = materialLimits.slice(0, 3);
  const hiddenLimits = materialLimits.length - visibleLimits.length;
  const backgroundClaims = review.background.map(
    (item) => titledClaim(item, dictionary, review, codeRenderer, false),
  );
  const background = backgroundClaims.length === 0
    ? ""
    : `<section class="synopsis-background" id="background">
      <h3>${html(label(dictionary, "section.background"))}</h3>
      <div class="synopsis-background-content">
        ${backgroundClaims.join("")}
      </div>
    </section>`;
  return `<section class="synopsis" id="synopsis" aria-labelledby="synopsis-title">
    <div class="section-heading">
      ${sectionHeading(label(dictionary, "section.synopsis"), number, "synopsis-title")}
    </div>
    <div class="synopsis-grid">
      <div class="synopsis-row synopsis-purpose">
        ${summaryLabelElement(label(dictionary, "synopsis.purpose"))}
        <div class="synopsis-value">${claimBlock(
          review.purpose,
          dictionary,
          review,
          codeRenderer,
          "",
          review.purpose.text,
          false,
        )}</div>
      </div>
      <div class="before-after change-shift" role="group" aria-labelledby="synopsis-before-title synopsis-now-title">
        <div class="synopsis-row shift-card shift-before">
          <h3 id="synopsis-before-title">${html(label(dictionary, "synopsis.before"))}</h3>
          <div class="synopsis-value">${claimBlock(
            review.coreChange.before,
            dictionary,
            review,
            codeRenderer,
            "",
            review.coreChange.before.text,
            false,
          )}</div>
        </div>
        <div class="synopsis-row shift-card shift-now">
          <h3 id="synopsis-now-title">${html(label(dictionary, "synopsis.now"))}</h3>
          <div class="synopsis-value">${claimBlock(
            review.coreChange.after,
            dictionary,
            review,
            codeRenderer,
            "",
            review.coreChange.after.text,
            false,
          )}</div>
        </div>
      </div>
      <div class="synopsis-row synopsis-impact">
        ${summaryLabelElement(label(dictionary, "synopsis.why"))}
        <div class="synopsis-value">${claimBlock(
          review.coreChange.why,
          dictionary,
          review,
          codeRenderer,
          "",
          review.coreChange.why.text,
          false,
        )}</div>
      </div>
      ${background}
      ${changeMap(review, dictionary)}
      <div class="synopsis-row synopsis-review${review.reviewItems.length === 0 ? " synopsis-review-empty" : ""}">
        <div class="synopsis-value synopsis-review-value">
          ${review.reviewItems.length === 0
            ? `<p class="review-empty">${html(label(dictionary, "review.noItems"))}</p>`
            : `<ul class="review-items review-items-compact" role="list">${visibleItems.map(
            (item) => `<li>${reviewItem(
              item,
              dictionary,
              review,
              codeRenderer,
              { compact: true },
            )}</li>`,
          ).join("")}</ul>`}
          ${hiddenItems > 0
            ? `<p class="more-link"><a href="#judge">${html(countedLabel(dictionary, "review.moreItems", hiddenItems))}</a></p>`
            : ""}
        </div>
      </div>
      ${materialLimits.length === 0 ? "" : `<div class="synopsis-row">
        ${summaryLabelElement(label(dictionary, "synopsis.scope"))}
        <div class="synopsis-value">
          <ul class="scope-impact-list">${visibleLimits.map(
            (limit) => `<li><a href="#scope-${html(limit.id)}">${userText(limit.impact)}</a></li>`,
          ).join("")}</ul>
          ${hiddenLimits > 0
            ? `<p class="more-link"><a href="#evidence-and-scope">${html(countedLabel(dictionary, "scope.moreLimits", hiddenLimits))}</a></p>`
            : ""}
        </div>
      </div>`}
    </div>
  </section>`;
}

function evidenceSection(review, dictionary, codeRenderer, number) {
  const knownFileIds = new Set(review.files.map((file) => file.id));
  const sourcesByFile = new Map();
  for (const source of review.sourceIndex) {
    if (!source.fileId) continue;
    if (!knownFileIds.has(source.fileId)) {
      throw new Error("Source index refers to an unknown file");
    }
    const sources = sourcesByFile.get(source.fileId) ?? [];
    sources.push(source);
    sourcesByFile.set(source.fileId, sources);
  }
  const otherSources = review.sourceIndex.filter(
    (source) => !source.fileId,
  );
  const sourceRows = otherSources.map((source) => {
    const pullRequestSource = [
      "pull-request-title",
      "pull-request-description",
    ].includes(source.kind);
    const location = source.path
      ? userText(source.path)
      : pullRequestSource
        ? `${html(review.snapshot.repository.owner)}/${html(review.snapshot.repository.name)} · ${html(changeReference(review.snapshot.change))}`
        : "—";
    return `<tr>
      <td>${html(label(dictionary, `source.${source.kind}`))}</td>
      <td>${location}</td>
      <td>${source.revision ? `<code>${html(source.revision.slice(0, 12))}</code>` : "—"}</td>
      <td>${html(countedLabel(dictionary, "source.lines", source.lineCount))}</td>
    </tr>`;
  }).join("");
  const files = review.files.map((file) => {
    const sources = sourcesByFile.get(file.id) ?? [];
    const captured = sources.length > 0
      ? `${[...new Set(sources.map(
        (source) => label(dictionary, `source.${source.kind}`),
      ))].join(" · ")} · ${countedLabel(
        dictionary,
        "source.lines",
        sources.reduce((total, source) => total + source.lineCount, 0),
      )}`
      : file.bodyState === "metadata-only"
        ? label(dictionary, "file.body.metadataOnly")
        : label(dictionary, "file.body.redacted");
    return `<tr>
      <td>${userText(file.path)}</td>
      <td>${html(label(dictionary, `file.status.${file.providerStatus}`))}</td>
      <td>${html(label(dictionary, `file.use.${file.disposition}`))}</td>
      <td>${html(captured)}</td>
      <td>+${file.additions} −${file.deletions}</td>
    </tr>`;
  }).join("");
  const displayedLimits = review.limits.map((limit) => ({
    displayed: limitText(limit, dictionary),
    limit,
  }));
  const groupedLimits = new Map();
  for (const entry of displayedLimits) {
    const stableReason = entry.limit.reasonKind
      ? `${entry.limit.kind}:${entry.limit.reasonKind}`
      : `${entry.limit.kind}:${entry.limit.reason.normalize("NFC").replace(/\s+/gu, " ").trim()}`;
    const key = JSON.stringify([entry.limit.material, stableReason]);
    const group = groupedLimits.get(key) ?? { entries: [], key };
    group.entries.push(entry);
    groupedLimits.set(key, group);
  }
  const renderSingleLimit = ({ entries }) => {
    const { displayed, limit } = entries[0];
    return (
    `<details class="scope-limit" id="scope-${html(limit.id)}">
    <summary class="scope-limit-head">
      <h3>${userText(displayed.subject)}</h3>
      <span class="scope-impact">${html(label(dictionary, limit.material ? "scope.material" : "scope.nonMaterial"))}</span>
    </summary>
    <div class="disclosure-content">
      <dl>
        <div><dt>${html(label(dictionary, "scope.reason"))}</dt><dd>${userParagraphs(displayed.reason)}</dd></div>
        <div><dt>${html(label(dictionary, "scope.result"))}</dt><dd>${userParagraphs(limit.impact)}</dd></div>
      </dl>
    </div>
  </details>`
    );
  };
  const renderLimitGroup = (group) => {
    if (group.entries.length === 1) return renderSingleLimit(group);
    const material = group.entries[0].limit.material;
    return `<details class="scope-limit scope-limit-group">
      <summary class="scope-limit-head">
        <h3>${html(countedLabel(dictionary, "scope.groupedItems", group.entries.length))}</h3>
        <span class="scope-impact">${html(label(dictionary, material ? "scope.material" : "scope.nonMaterial"))}</span>
      </summary>
      <div class="disclosure-content">
        <dl class="scope-shared-reason">
          <div><dt>${html(label(dictionary, "scope.reason"))}</dt><dd>${userParagraphs(group.entries[0].displayed.reason)}</dd></div>
        </dl>
        <div class="scope-group-items">${group.entries.map(({ displayed, limit }) => (
          `<details class="scope-limit-item" id="scope-${html(limit.id)}">
            <summary><h4>${userText(displayed.subject)}</h4></summary>
            <div class="scope-limit-item-content">
              <dl>
                <div><dt>${html(label(dictionary, "scope.result"))}</dt><dd>${userParagraphs(limit.impact)}</dd></div>
              </dl>
            </div>
          </details>`
        )).join("")}</div>
      </div>
    </details>`;
  };
  const limitGroups = [...groupedLimits.values()];
  const limitCategory = (material) => {
    const groups = limitGroups.filter(
      (group) => group.entries[0].limit.material === material,
    );
    const count = groups.reduce(
      (total, group) => total + group.entries.length,
      0,
    );
    if (count === 0) return "";
    const key = material
      ? "evidence.materialLimits"
      : "evidence.nonMaterialLimits";
    return `<details class="evidence-group scope-category">
      <summary><h3>${html(countedLabel(dictionary, key, count))}</h3></summary>
      <div class="evidence-group-content">
        <div class="scope-limits">${groups.map(renderLimitGroup).join("")}</div>
      </div>
    </details>`;
  };
  const snapshot = review.snapshot;
  const { change } = snapshot;
  const changeRows = change.kind === "github"
    ? `<div><dt>${html(label(dictionary, "artifact.pullRequest"))}</dt><dd>${html(changeRecord(change))}</dd></div>`
    : `<div><dt>${html(label(dictionary, "artifact.baseRef"))}</dt><dd><code>${html(change.baseRef)}</code></dd></div>
          <div><dt>${html(label(dictionary, "artifact.workingTree"))}</dt><dd>${html(label(dictionary, change.dirty ? "artifact.workingTreeDirty" : "artifact.workingTreeClean"))}</dd></div>`;
  const baseRows = snapshot.snapshot.base === snapshot.snapshot.mergeBase
    ? `<div><dt>${html(label(dictionary, "artifact.baseAndMergeBase"))}</dt><dd><code>${html(snapshot.snapshot.base)}</code></dd></div>`
    : `<div><dt>${html(label(dictionary, "artifact.base"))}</dt><dd><code>${html(snapshot.snapshot.base)}</code></dd></div>
          <div><dt>${html(label(dictionary, "artifact.mergeBase"))}</dt><dd><code>${html(snapshot.snapshot.mergeBase)}</code></dd></div>`;
  return collapsibleSection({
    content: `
      <details class="evidence-group">
        <summary><h3>${html(label(dictionary, "evidence.sources"))}</h3></summary>
        <div class="evidence-group-content">
          <div class="table-scroll">
            <table>
              <caption class="sr-only">${html(label(dictionary, "evidence.sources"))}</caption>
              <thead><tr><th>${html(label(dictionary, "common.evidence"))}</th><th>${html(label(dictionary, "source.location"))}</th><th>${html(label(dictionary, "source.revision"))}</th><th>${html(label(dictionary, "source.lineCount"))}</th></tr></thead>
              <tbody>${sourceRows}</tbody>
            </table>
          </div>
        </div>
      </details>
      ${limitCategory(true)}
      ${limitCategory(false)}
      <details class="evidence-group">
        <summary><h3>${html(label(dictionary, "evidence.checkedFiles"))}</h3></summary>
        <div class="evidence-group-content">
          <div class="table-scroll">
            <table>
              <caption class="sr-only">${html(label(dictionary, "evidence.checkedFiles"))}</caption>
              <thead><tr><th>${html(label(dictionary, "file.name"))}</th><th>${html(label(dictionary, "file.change"))}</th><th>${html(label(dictionary, "file.use"))}</th><th>${html(label(dictionary, "file.captured"))}</th><th>${html(label(dictionary, "file.lines"))}</th></tr></thead>
              <tbody>${files}</tbody>
            </table>
          </div>
        </div>
      </details>
      <details class="evidence-group artifact-details">
        <summary><h3>${html(label(dictionary, "artifact.details"))}</h3></summary>
        <div class="evidence-group-content">
          <dl>
            ${changeRows}
            ${baseRows}
            <div><dt>${html(label(dictionary, "artifact.head"))}</dt><dd><code>${html(snapshot.snapshot.head)}</code></dd></div>
            <div><dt>${html(label(dictionary, "artifact.capturedAt"))}</dt><dd><time datetime="${html(snapshot.capturedAt)}" title="${html(snapshot.capturedAt)}">${html(formatTimestamp(snapshot.capturedAt))}</time></dd></div>
            <div><dt>${html(label(dictionary, "artifact.provider"))}</dt><dd>${html(change.kind === "github" ? "GitHub" : label(dictionary, "artifact.localProvider"))}</dd></div>
            <div><dt>${html(label(dictionary, "artifact.repository"))}</dt><dd>${html(repositoryLabel(snapshot))}</dd></div>
            ${change.kind === "github" ? `<div><dt>${html(label(dictionary, "artifact.pullRequestTitle"))}</dt><dd>${userText(change.title)}</dd></div>` : ""}
            <div><dt>${html(label(dictionary, "artifact.locale"))}</dt><dd>${html(snapshot.settings.locale)} · ${html(label(dictionary, `source.${snapshot.settings.localeSource}`))}</dd></div>
            <div><dt>${html(label(dictionary, "artifact.theme"))}</dt><dd>${html(label(dictionary, `theme.${snapshot.settings.theme}`))}</dd></div>
          </dl>
        </div>
      </details>
      ${evidenceFootnotes(review, dictionary, codeRenderer)}`,
    id: "evidence-and-scope",
    number,
    title: label(dictionary, "section.evidence"),
  });
}

function buildSections(review, dictionary, codeRenderer, reader) {
  const sections = [];
  const coreDetails = review.coreChange.details.map(
    (item) => claimBlock(item, dictionary, review, codeRenderer, "core-detail"),
  );
  const coreChange = `<div class="core-change" id="core-change">
    <div class="core-details">${
      coreDetails.length > 1
        ? `<ul class="claim-list core-detail-list">${coreDetails.map(
          (detail) => `<li>${detail}</li>`,
        ).join("")}</ul>`
        : coreDetails.join("")
    }</div>
  </div>`;
  let behaviorLead = "";
  let behaviorModel = "";
  if (review.behavior) {
    behaviorLead = `<div class="behavior-summary">${claimBlock(
      review.behavior.summary,
      dictionary,
      review,
      codeRenderer,
    )}</div>`;
    behaviorModel = subsection({
      id: "behavior-flow",
      title: label(dictionary, "section.behaviorFlow"),
      content: `<div class="behavior-model">
      ${review.behavior.visual
          ? visualBlock(
            review.behavior.visual,
            dictionary,
            review,
            codeRenderer,
          )
          : ""}
        <ol class="flow">${review.behavior.steps.map(
          (step) => `<li>${claimBlock(
            step,
            dictionary,
            review,
            codeRenderer,
          )}</li>`,
        ).join("")}</ol>
        ${review.behavior.microworld
          ? microworldBlock(
            review.behavior.microworld,
            dictionary,
            review,
            codeRenderer,
          )
          : ""}
    </div>`,
    });
  }
  const changeOverview = subsection({
    content: `<div class="change-overview-content">
      ${behaviorLead}
      ${coreChange}
    </div>`,
    id: "change-overview",
    title: label(dictionary, "section.changeOverview"),
  });
  const quiz = review.quiz.length === 0
    ? ""
    : subsection({
      content: `<div class="quiz">${review.quiz.map((item) => `<article class="quiz-question" id="${html(item.id)}">
        <h4 id="${html(`${item.id}-question`)}">${userText(item.question)}</h4>
        <div class="quiz-workspace">
          <label class="sr-only" id="${html(`${item.id}-response-label`)}" for="${html(`${item.id}-response`)}">${html(label(dictionary, "quiz.responseLabel"))}</label>
          <textarea
            aria-labelledby="${html(`${item.id}-question`)} ${html(`${item.id}-response-label`)}"
            id="${html(`${item.id}-response`)}"
            placeholder="${html(label(dictionary, "quiz.responsePlaceholder"))}"
            rows="3"></textarea>
          <details class="quiz-answer">
            <summary aria-label="${html(accessibleControlLabel(
              item.question,
              label(dictionary, "quiz.showAnswer"),
            ))}">${html(label(dictionary, "quiz.showAnswer"))}</summary>
            <div class="quiz-answer-content">
              ${userParagraphs(item.answer, evidenceBlock(
                item.evidence,
                dictionary,
                review,
                codeRenderer,
                { context: item.question },
              ))}
            </div>
          </details>
        </div>
      </article>`).join("")}</div>`,
      id: "quiz",
      title: label(dictionary, "section.quiz"),
    });
  let number = 2;
  sections.push({
    html: section({
      content: `${changeOverview}${behaviorModel}`,
      id: "explore",
      number,
      title: label(dictionary, "section.explore"),
    }),
    id: "explore",
    number,
    title: label(dictionary, "section.explore"),
  });
  number += 1;
  sections.push({ id: "changes", number, title: label(dictionary, "section.changes"),
    html: section({ id: "changes", number, title: label(dictionary, "section.changes"), content: `${reader.content}${quiz}` }) });
  number += 1;
  if (review.reviewItems.length > 0) {
    sections.push({
      html: collapsibleSection({
        content: `<ul class="review-items review-items-full" role="list">${review.reviewItems.map(
          (item) => `<li>${reviewItem(
            item,
            dictionary,
            review,
            codeRenderer,
          )}</li>`,
        ).join("")}</ul>`,
        id: "judge",
        number,
        title: label(dictionary, "section.judge"),
      }),
      id: "judge",
      number,
      title: label(dictionary, "section.judge"),
    });
    number += 1;
  }
  sections.push({
    html: evidenceSection(review, dictionary, codeRenderer, number),
    id: "evidence-and-scope",
    number,
    title: label(dictionary, "section.evidence"),
  });
  return sections;
}

function railFooter(review, dictionary) {
  const { change } = review.snapshot;
  const head = review.snapshot.snapshot.head;
  return `<div class="top-context">${repositoryIcon()}<span>${html(repositoryLabel(review.snapshot))}</span></div>
        <span class="commit-status" title="${html(label(dictionary, "artifact.reviewedCommit"))} ${html(head)}"><code>${html(head.slice(0, 8))}</code></span>
        ${pullRequestLink(change, dictionary)}`;
}

function repositoryIcon() {
  return '<svg class="repository-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M3 9.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"></path></svg>';
}

function pullRequestLink(change, dictionary, className = "") {
  if (change.kind !== "github") return "";
  const text = label(dictionary, "artifact.openPullRequest").replace("{number}", String(change.number));
  return `<a class="pull-request-link${className}" href="${html(change.url)}" aria-label="${html(text)}" title="${html(text)}"><span>PR #${change.number}</span><svg class="external-link-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 5h5v5"></path><path d="M19 5l-8 8"></path><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg></a>`;
}

function featureColors(theme) {
  const { decide, resolve, scope, verify } = COLORS[theme];
  const code = Object.entries(CODE_THEME[theme]).map(([name, value]) => [
    `code-${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`,
    value,
  ]);
  return { decide, resolve, scope, verify, ...Object.fromEntries(code) };
}

export async function renderReview(review, { alternateLocale, fonts } = {}) {
  const settings = review.snapshot.settings;
  const dictionary = await loadLocale(settings.locale);
  const codeRenderer = Object.freeze({
    evidenceRecords: new Map(),
    render: renderCodeEvidence,
  });
  const reader = await renderReader(review);
  const documentTitleHtml = documentTitle(review.title, dictionary, review, codeRenderer);
  const synopsisHtml = synopsis(review, dictionary, codeRenderer, { number: 1 });
  const sections = buildSections(review, dictionary, codeRenderer, reader);
  const { change } = review.snapshot;
  const head = review.snapshot.snapshot.head;
  const localeWarning = settings.localeSource === "default"
    ? `<aside class="locale-warning" role="note">${html(label(dictionary, "locale.fallbackWarning"))}</aside>`
    : "";
  const tocItems = [{ id: "synopsis", number: 1, title: label(dictionary, "section.synopsis") }, ...sections];
  const document = renderDocument({
    alternateLocale,
    colors: { dark: featureColors("dark"), light: featureColors("light") },
    fonts,
    identity: { name: "Diff", product: "DIFF", record: changeRecord(change) },
    locale: settings.locale,
    main: {
      content: `${localeWarning}${documentTitleHtml}${synopsisHtml}${sections.map((item) => item.html).join("")}`,
      id: "review",
    },
    navigation: { label: label(dictionary, "common.menu") },
    popover: codeRenderer.evidenceRecords.size === 0
      ? undefined
      : { href: "#evidence-references", label: label(dictionary, "evidence.viewList") },
    printIdentity: [
      html(repositoryLabel(review.snapshot)),
      `${html(changeReference(change))} · <code>${html(head.slice(0, 12))}</code> · <time datetime="${html(review.snapshot.capturedAt)}">${html(formatTimestamp(review.snapshot.capturedAt))}</time>`,
    ],
    rail: {
      actions: pullRequestLink(change, dictionary, " mobile-pull-request-link"),
      footer: railFooter(review, dictionary),
    },
    scripts: [`(${mountDiff.toString()})();`, reader.script],
    skip: { label: label(dictionary, "common.skip"), target: "review" },
    styles: [readStylesheet(stylesheetUrl), reader.styles],
    theme: settings.theme,
    title: review.title.text,
    toc: { items: tocItems, label: label(dictionary, "common.menu") },
  });
  const bytes = Buffer.from(document, "utf8");
  if (bytes.length > LIMITS.artifactBytes) {
    throw new Error(`Hope review exceeds ${LIMITS.artifactBytes} bytes`);
  }
  return Object.freeze({
    bytes,
    designVersion: DESIGN_VERSION,
    digest: sha256(bytes),
    rendererVersion: RENDERER_VERSION,
  });
}
