import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  CODE_THEME,
  COLORS,
  DESIGN_VERSION,
  LAYOUT,
  SPACE,
  TYPE,
} from "./design/tokens.mjs";
import { label, loadLocale } from "./locales/index.mjs";
import {
  LIMITS,
  RENDERER_VERSION,
} from "./constants.mjs";
import { renderCodeEvidence } from "./code-evidence.mjs";
import { sha256 } from "./hash.mjs";
import { TEACHING_AID_NAMES } from "./teaching-aids.mjs";
import { exposeBidiControls } from "./text.mjs";

const fontUrls = Object.freeze({
  code: new URL("../../../assets/fonts/HopeCode.woff2", import.meta.url),
  sansBold: new URL("../../../assets/fonts/HopeSansBold.woff2", import.meta.url),
  sansLight: new URL("../../../assets/fonts/HopeSansLight.woff2", import.meta.url),
  sansMedium: new URL("../../../assets/fonts/HopeSansMedium.woff2", import.meta.url),
});
const iconUrl = new URL("../../../assets/hope-icon.png", import.meta.url);
const renderedCodeSources = new Set([
  "after-file",
  "before-file",
  "context-file",
  "patch",
]);
const linkedCodeSources = new Set([
  "after-file",
  "before-file",
  "context-file",
]);

function html(value) {
  return exposeBidiControls(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlAttribute(value) {
  return html(value)
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\t", "&#9;");
}

function summaryLabelElement(value) {
  const text = String(value);
  const balanced = /^(\p{Script=Hangul}{2}) (\p{Script=Hangul}{2})$/u.exec(text);
  if (!balanced) return `<h3>${html(text)}</h3>`;
  return `<h3><span class="summary-label-stacked"><span>${html(
    balanced[1],
  )}</span> <span>${html(balanced[2])}</span></span></h3>`;
}

function hashSource(value) {
  return createHash("sha256").update(value).digest("base64");
}

function userText(value, className = "") {
  const text = String(value).split(/\r?\n/u).map(html).join("<br>");
  return `<bdi dir="auto"${className ? ` class="${className}"` : ""}>${text}</bdi>`;
}

function userParagraphs(value) {
  return String(value).split(/\r?\n+/u).map(
    (paragraph) => `<p>${userText(paragraph.trim())}</p>`,
  ).join("");
}

function basisKey(basis) {
  return {
    code: "basis.shownInCode",
    inferred: "basis.inferred",
    stated: "basis.stated",
    unknown: "basis.couldNotConfirm",
  }[basis];
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

function accessibleEvidenceLabel(context, count, dictionary) {
  const evidence = `${label(dictionary, "common.evidence")} · ${count}`;
  return accessibleControlLabel(context, evidence);
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
  { collapsible = true, context = "" } = {},
) {
  if (items.length === 0) return "";
  const content = `<div class="evidence-list">
    ${items.map((item) => {
      const seen = codeRenderer.evidenceTargets;
      const target = evidenceTarget(item);
      const url = trustedCodeUrl(review, item);
      const title = sourceTitle(item, dictionary);
      if (seen.has(target)) {
        return `<article class="evidence-reference">
          <a href="#${target}">${html(title)}</a>
        </article>`;
      }
      seen.add(target);
      const codeSource = renderedCodeSources.has(item.sourceKind);
      return `<article class="evidence-item" id="${target}">
        <div class="evidence-meta">
          ${url
            ? `<a href="${html(url)}">${html(title)}</a>`
            : `<span>${html(title)}</span>`}
        </div>
        <pre class="${codeSource ? "code-evidence" : "source-text"}"><code${codeSource
          ? ` aria-label="${htmlAttribute(item.excerpt)}"`
          : ""}>${codeSource
          ? codeRenderer.render(item)
          : html(item.excerpt)}</code></pre>
      </article>`;
    }).join("")}
  </div>`;
  if (!collapsible) {
    return `<div class="evidence evidence-inline" role="group" aria-label="${html(label(dictionary, "common.evidence"))}">${content}</div>`;
  }
  return `<details class="evidence">
    <summary aria-label="${html(accessibleEvidenceLabel(context, items.length, dictionary))}">${html(label(dictionary, "common.evidence"))} · ${items.length}</summary>
    ${content}
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
  return `<div class="claim ${html(className)}">
    ${userParagraphs(claim.text)}
    <div class="claim-meta">
      ${showBasis
        ? `<div class="claim-basis">${html(label(dictionary, basisKey(claim.basis)))}</div>`
        : ""}
      ${evidenceBlock(
        claim.evidence,
        dictionary,
        review,
        codeRenderer,
        { context: evidenceContext },
      )}
    </div>
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

function aidEvidence(aid, dictionary, review, codeRenderer) {
  return `<div class="claim-meta teaching-aid-meta">
    <div class="claim-basis">${html(label(dictionary, basisKey(aid.basis)))}</div>
    ${evidenceBlock(
      aid.evidence,
      dictionary,
      review,
      codeRenderer,
      { context: aid.title },
    )}
  </div>`;
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
  let content;
  if (visual.kind === "flow") {
    content = `<ol class="visual-flow">${visual.items.map((item) => (
      `<li>
        <strong>${userText(item.label)}</strong>
        ${userParagraphs(item.detail)}
      </li>`
    )).join("")}</ol>`;
  } else if (visual.kind === "decision-table") {
    content = `<div class="table-scroll visual-table" role="region" aria-label="${html(visual.title)}" tabindex="0">
      <table class="decision-table">
        <thead><tr>
          <th scope="col">${html(label(dictionary, "visual.case"))}</th>
          ${visual.columns.map((column) => `<th scope="col">${userText(column)}</th>`).join("")}
        </tr></thead>
        <tbody>${visual.rows.map((row) => `<tr>
          <th scope="row">${userText(row.case)}</th>
          ${row.cells.map((cell) => `<td>${userText(cell)}</td>`).join("")}
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
  return `<article class="behavior-visual visual-${html(visual.kind)}">
    <header>
      <h3>${userText(visual.title)}</h3>
      ${userParagraphs(visual.caption)}
    </header>
    ${content}
    ${aidEvidence(visual, dictionary, review, codeRenderer)}
  </article>`;
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

function microworldBlock(world, dictionary, review, codeRenderer) {
  const defaultKey = world.controls.map(
    (control) => `${control.id}=${control.defaultOptionId}`,
  ).join("|");
  const defaultScenario = world.scenarios.find(
    (scenario) => scenario.selectionKey === defaultKey,
  );
  const scenarioStatus = (scenario) => (
    `${label(dictionary, "microworld.before")}: ${scenario.before.outcome}. `
    + `${label(dictionary, "microworld.after")}: ${scenario.after.outcome}. `
    + scenario.lesson
  );
  return `<aside class="microworld" data-microworld aria-labelledby="microworld-title">
    <header>
      <p class="microworld-eyebrow">${html(label(dictionary, "microworld.tryIt"))}</p>
      <h3 id="microworld-title">${userText(world.title)}</h3>
      ${userParagraphs(world.instructions)}
      <p class="microworld-notice">${html(label(dictionary, "microworld.notice"))}</p>
    </header>
    <details class="microworld-disclosure">
      <summary>${html(label(dictionary, "microworld.controls"))}</summary>
      <div class="microworld-content">
        <div class="microworld-controls" role="group" aria-labelledby="microworld-controls-title">
          <p class="sr-only" id="microworld-controls-title">${html(label(dictionary, "microworld.controls"))}</p>
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
        <p class="sr-only" role="status" aria-live="polite" data-microworld-status>${html(
          scenarioStatus(defaultScenario),
        )}</p>
        <div class="microworld-scenarios" role="region" aria-label="${html(label(dictionary, "microworld.selection"))}">
          ${world.scenarios.map((scenario) => `<article
        class="microworld-scenario"
        data-selection-key="${html(scenario.selectionKey)}"
        data-status="${html(scenarioStatus(scenario))}"
        ${scenario.selectionKey === defaultKey ? "" : "hidden"}>
        <h4>${userText(scenario.title)}</h4>
        <div class="microworld-comparison">
          ${microworldTrace(
            scenario.before,
            label(dictionary, "microworld.before"),
            dictionary,
          )}
          ${microworldTrace(
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
        ${aidEvidence(world, dictionary, review, codeRenderer)}
      </div>
    </details>
  </aside>`;
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
  return `<article class="${className}" id="${html(id)}">
    <div class="item-head">
      <span class="status kind-${html(item.kind)}">${html(kindLabel(item.kind, dictionary))}</span>
      <span class="importance">${html(importanceLabel(item.importance, dictionary))}</span>
      ${compact ? "" : `<span class="item-basis">${html(label(dictionary, basisKey(item.basis)))}</span>`}
    </div>
    ${compact
      ? `<h4><a href="#${html(item.id)}">${userText(item.title)}</a></h4>`
      : `<h3>${userText(item.title)}</h3>`}
    ${compact ? "" : `
      ${userParagraphs(item.explanation)}
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
      ${evidenceBlock(item.evidence, dictionary, review, codeRenderer, {
        context: item.title,
      })}
    `}
  </article>`;
}

function sectionOrdinal(number) {
  return String(number).padStart(2, "0");
}

function tocHeading(dictionary, count) {
  return `<h2 class="toc-heading"><span>${html(label(dictionary, "common.menu"))}</span><span class="toc-progress"><span data-toc-current>1</span> / ${count}</span></h2>`;
}

function sectionHeading(title, number, id = "") {
  const idAttribute = id === "" ? "" : ` id="${html(id)}"`;
  return `<h2${idAttribute}><span class="section-number">${sectionOrdinal(number)}</span><span>${html(title)}</span></h2>`;
}

function documentTitle(title) {
  return `<header class="document-title">
    <h1 id="review-title">${userText(title)}</h1>
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

function collapsibleSubsection({ id, title, content }) {
  return `<details class="review-subsection review-subsection-collapsible" id="${html(id)}">
    <summary class="subsection-heading">
      <h3>${html(title)}</h3>
    </summary>
    <div class="subsection-content">${content}</div>
  </details>`;
}

function collapsibleSection({ id, title, content, number, initiallyOpen = false }) {
  return `<details class="review-section review-section-collapsible" id="${html(id)}"${initiallyOpen ? " open" : ""}>
    <summary class="section-heading">
      ${sectionHeading(title, number)}
    </summary>
    <div class="section-content">${content}</div>
  </details>`;
}

function beginnerPrimerBlock(review, dictionary, codeRenderer) {
  if (review.beginnerPrimer.length === 0) return "";
  const claims = review.beginnerPrimer.map(
    (item) => titledClaim(item, dictionary, review, codeRenderer),
  );
  return `<details class="beginner-primer" id="beginner-primer">
    <summary class="beginner-primer-summary" aria-label="${html(label(dictionary, "background.beginnerPrimer"))}">
      <span>${html(label(dictionary, "background.beginnerPrimer"))}</span>
      <span class="beginner-primer-hint">${html(label(dictionary, "background.beginnerPrimerHint"))}</span>
    </summary>
    <div class="beginner-primer-content">
      ${claims.length > 1
        ? `<ul class="titled-claim-list">${claims.map((claim) => `<li>${claim}</li>`).join("")}</ul>`
        : claims.join("")}
    </div>
  </details>`;
}

function teachingAidChoices(review, dictionary) {
  const choices = TEACHING_AID_NAMES.map((name) => {
    const choice = review.teachingAids[name];
    const teachingJob = choice.decision === "included"
      ? choice.teachingJob
      : undefined;
    const decisionLabel = label(
      dictionary,
      `teachingAid.decision.${choice.decision}`,
    );
    return `<li>
      <article class="teaching-aid-choice decision-${html(choice.decision)}">
        <header>
          <h3>${html(label(dictionary, `teachingAid.${name}`))}</h3>
          <span class="teaching-aid-decision">${html(decisionLabel)}</span>
        </header>
        <dl>
          <div>
            <dt>${html(label(dictionary, "teachingAid.reason"))}</dt>
            <dd>${userParagraphs(choice.reason)}</dd>
          </div>
          ${teachingJob === undefined ? "" : `<div>
            <dt>${html(label(dictionary, "teachingAid.teachingJob"))}</dt>
            <dd>${userParagraphs(teachingJob)}</dd>
          </div>`}
        </dl>
      </article>
    </li>`;
  }).join("");
  return collapsibleSubsection({
    content: `<p class="teaching-aid-summary">${html(label(
      dictionary,
      "teachingAid.summary",
    ))}</p>
      <ul class="teaching-aid-choices">${choices}</ul>`,
    id: "teaching-aids",
    title: label(dictionary, "section.teachingAids"),
  });
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

function contextCheck(
  check,
  dictionary,
  review,
  codeRenderer,
) {
  const relatedLimits = check.limitIds.map((limitId) => (
    review.limits.find((limit) => limit.id === limitId)
  )).filter(Boolean);
  return `<details class="context-check">
    <summary class="context-check-head">
      <h4>${userText(check.subject)}</h4>
      <span class="context-status context-${html(check.status)}">${html(label(dictionary, `context.${check.status === "not-applicable" ? "notApplicable" : check.status}`))}</span>
    </summary>
    <div class="disclosure-content">
      ${userParagraphs(check.explanation)}
      ${check.evidence.length === 0 ? "" : `<p class="claim-basis">${html(
        label(dictionary, basisKey(check.basis)),
      )}</p>`}
      ${relatedLimits.length === 0 ? "" : `<p class="related-limits">
        ${relatedLimits.map((limit) => {
          const displayed = limitText(limit, dictionary);
          return `<a href="#scope-${html(limit.id)}">${userText(displayed.subject)}</a>`;
        }).join(" · ")}
      </p>`}
      ${evidenceBlock(check.evidence, dictionary, review, codeRenderer, {
        context: check.subject,
      })}
    </div>
  </details>`;
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
    && review.beginnerPrimer.length === 0
    ? ""
    : `<section class="synopsis-background" id="background">
      <h3>${html(label(dictionary, "section.background"))}</h3>
      <div class="synopsis-background-content">
        ${backgroundClaims.length > 1
          ? `<ul class="titled-claim-list">${backgroundClaims.map(
            (claim) => `<li>${claim}</li>`,
          ).join("")}</ul>`
          : backgroundClaims.join("")
        }
        ${beginnerPrimerBlock(review, dictionary, codeRenderer)}
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
      ${background}
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
      <div class="synopsis-row synopsis-review">
        ${summaryLabelElement(label(dictionary, "synopsis.items"))}
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
  const implementationDetails = review.codeSteps.length === 0
    ? ""
    : `<details class="evidence-group" id="implementation-details">
      <summary><h3>${html(label(dictionary, "evidence.implementation"))}</h3></summary>
      <div class="evidence-group-content">
        <ol class="code-step-list">${review.codeSteps.map(
          (item) => `<li>${titledClaim(
            item,
            dictionary,
            review,
            codeRenderer,
          )}</li>`,
        ).join("")}</ol>
      </div>
    </details>`;
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
        ? `${html(review.snapshot.repository.owner)}/${html(review.snapshot.repository.name)} · PR #${review.snapshot.pullRequest.number}`
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
    const group = groupedLimits.get(key) ?? { checks: [], entries: [], key };
    group.entries.push(entry);
    groupedLimits.set(key, group);
  }
  const groupByLimitId = new Map();
  for (const group of groupedLimits.values()) {
    for (const entry of group.entries) {
      groupByLimitId.set(entry.limit.id, group);
    }
  }
  const crossGroupChecks = [];
  for (const check of review.contextChecks.filter(
    (entry) => entry.status === "limited",
  )) {
    const groups = [...new Set(check.limitIds.map(
      (limitId) => groupByLimitId.get(limitId),
    ).filter(Boolean))];
    if (groups.length === 1) {
      groups[0].checks.push(check);
    } else {
      crossGroupChecks.push(check);
    }
  }
  const renderContextNotes = (checks) => (
    checks.length === 0
      ? ""
      : `<div class="scope-context-notes">${checks.map((check) => (
        `<section class="scope-context-note">
          <h4>${userText(check.subject)}</h4>
          ${userParagraphs(check.explanation)}
          ${evidenceBlock(check.evidence, dictionary, review, codeRenderer, {
            context: check.subject,
          })}
        </section>`
      )).join("")}</div>`
  );
  const renderSingleLimit = ({ checks, entries }) => {
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
      ${renderContextNotes(checks)}
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
        ${renderContextNotes(group.checks)}
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
  const visibleContextChecks = review.contextChecks.filter(
    (check) => check.status !== "limited",
  );
  const snapshot = review.snapshot;
  const baseRows = snapshot.snapshot.base === snapshot.snapshot.mergeBase
    ? `<div><dt>${html(label(dictionary, "artifact.baseAndMergeBase"))}</dt><dd><code>${html(snapshot.snapshot.base)}</code></dd></div>`
    : `<div><dt>${html(label(dictionary, "artifact.base"))}</dt><dd><code>${html(snapshot.snapshot.base)}</code></dd></div>
          <div><dt>${html(label(dictionary, "artifact.mergeBase"))}</dt><dd><code>${html(snapshot.snapshot.mergeBase)}</code></dd></div>`;
  return collapsibleSection({
    content: `
      ${implementationDetails}
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
      ${visibleContextChecks.length === 0 ? "" : `<details class="evidence-group">
        <summary><h3>${html(label(dictionary, "evidence.context"))}</h3></summary>
        <div class="evidence-group-content">
          <div class="context-checks">${visibleContextChecks.map((check) => contextCheck(
            check,
            dictionary,
            review,
            codeRenderer,
          )).join("")}</div>
        </div>
      </details>`}
      ${crossGroupChecks.length === 0 ? "" : `<details class="evidence-group">
        <summary><h3>${html(label(dictionary, "evidence.limitedContext"))}</h3></summary>
        <div class="evidence-group-content">
          <div class="context-checks">${crossGroupChecks.map((check) => contextCheck(
            check,
            dictionary,
            review,
            codeRenderer,
          )).join("")}</div>
        </div>
      </details>`}
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
            ${baseRows}
            <div><dt>${html(label(dictionary, "artifact.head"))}</dt><dd><code>${html(snapshot.snapshot.head)}</code></dd></div>
            <div><dt>${html(label(dictionary, "artifact.capturedAt"))}</dt><dd><time datetime="${html(snapshot.capturedAt)}" title="${html(snapshot.capturedAt)}">${html(formatTimestamp(snapshot.capturedAt))}</time></dd></div>
            <div><dt>${html(label(dictionary, "artifact.provider"))}</dt><dd>GitHub</dd></div>
            <div><dt>${html(label(dictionary, "artifact.repository"))}</dt><dd>${html(snapshot.repository.owner)}/${html(snapshot.repository.name)}</dd></div>
            <div><dt>${html(label(dictionary, "artifact.pullRequestTitle"))}</dt><dd>${userText(snapshot.pullRequest.title)}</dd></div>
            <div><dt>${html(label(dictionary, "artifact.locale"))}</dt><dd>${html(snapshot.settings.locale)} · ${html(label(dictionary, `source.${snapshot.settings.localeSource}`))}</dd></div>
            <div><dt>${html(label(dictionary, "artifact.theme"))}</dt><dd>${html(label(dictionary, `theme.${snapshot.settings.theme}`))}</dd></div>
          </dl>
        </div>
      </details>`,
    id: "evidence-and-scope",
    initiallyOpen: true,
    number,
    title: label(dictionary, "section.evidence"),
  });
}

function buildSections(review, dictionary, codeRenderer) {
  const sections = [];
  const coreDetails = review.coreChange.details.map(
    (item) => claimBlock(item, dictionary, review, codeRenderer, "core-detail"),
  );
  const coreChange = subsection({
    content: `<div class="core-details">${
      coreDetails.length > 1
        ? `<ul class="claim-list core-detail-list">${coreDetails.map(
          (detail) => `<li>${detail}</li>`,
        ).join("")}</ul>`
        : coreDetails.join("")
    }</div>`,
    id: "core-change",
    title: label(dictionary, "section.core"),
  });
  let behavior = "";
  if (review.behavior) {
    behavior = subsection({
      content: `<div class="behavior-model"><div class="behavior-summary">${claimBlock(
        review.behavior.summary,
        dictionary,
        review,
        codeRenderer,
      )}</div>
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
          : ""}</div>`,
      id: "behavior-flow",
      title: label(dictionary, "section.behavior"),
    });
  }
  const quiz = review.quiz.length === 0
    ? ""
    : subsection({
      content: `<div class="quiz">${review.quiz.map((item) => `<details class="quiz-question" id="${html(item.id)}">
        <summary id="${html(`${item.id}-question`)}">${userText(item.question)}</summary>
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
              ${userParagraphs(item.answer)}
              ${evidenceBlock(item.evidence, dictionary, review, codeRenderer, {
                collapsible: false,
                context: item.question,
              })}
            </div>
          </details>
        </div>
      </details>`).join("")}</div>`,
      id: "quiz",
      title: label(dictionary, "section.quiz"),
    });
  let number = 2;
  sections.push({
    html: section({
      content: `${coreChange}${behavior}${quiz}${teachingAidChoices(
        review,
        dictionary,
      )}`,
      id: "explore",
      number,
      title: label(dictionary, "section.explore"),
    }),
    id: "explore",
    number,
    title: label(dictionary, "section.explore"),
  });
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
    `--visited:${colors.visited}`,
  ].join(";");
}

function codeThemeVariables(colors) {
  return [
    `--code-added-bg:${colors.addedBackground}`,
    `--code-bg:${colors.background}`,
    `--code-fg:${colors.foreground}`,
    `--code-hunk-bg:${colors.hunkBackground}`,
    `--code-removed-bg:${colors.removedBackground}`,
  ].join(";");
}

function css(fontBase64) {
  const [space1, space2, space3, space4, space5, space6, space7, space8, space9] = SPACE;
  const wide = TYPE.body.wide;
  const narrow = TYPE.body.narrow;
  const wideCode = TYPE.code.wide;
  const narrowCode = TYPE.code.narrow;
  const widePageTitle = TYPE.pageTitle.wide;
  const narrowPageTitle = TYPE.pageTitle.narrow;
  const wideSection = TYPE.sectionTitle.wide;
  const narrowSection = TYPE.sectionTitle.narrow;
  const wideSubsection = TYPE.subsectionTitle.wide;
  const narrowSubsection = TYPE.subsectionTitle.narrow;

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
@font-face {
  font-family: "Hope Code";
  src: url(data:font/woff2;base64,${fontBase64.code}) format("woff2");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

:root {
  color-scheme: light;
  ${themeVariables(COLORS.light)};
  ${codeThemeVariables(CODE_THEME.light)};
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    ${themeVariables(COLORS.dark)};
    ${codeThemeVariables(CODE_THEME.dark)};
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  ${themeVariables(COLORS.dark)};
  ${codeThemeVariables(CODE_THEME.dark)};
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 300 ${wide.fontSize}px/${wide.lineHeight} "Hope Sans", sans-serif;
  text-rendering: optimizeLegibility;
}
h1,
h2,
h3,
strong,
b { font-weight: 700; }
p,
ul,
ol,
dl { margin-block: 0; }
code,
pre {
  font-family: "Hope Code", ui-monospace, monospace;
  font-weight: 400;
}
a {
  color: var(--accent);
  text-underline-offset: .2em;
}
a:visited { color: var(--visited); }
[id]:target { scroll-margin-top: 76px; }
.evidence-item:target,
.scope-limit:target,
.scope-limit-item:target {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
button,
select,
textarea,
summary {
  font-family: "Hope Sans", sans-serif;
  font-weight: 500;
}
button,
select { color: inherit; }

.skip {
  position: fixed;
  z-index: 40;
  top: ${space2}px;
  left: ${space2}px;
  transform: translateY(-160%);
  padding: ${space2}px ${space3}px;
  border: 1px solid var(--border);
  background: var(--panel);
}
.skip:focus { transform: none; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
bdi[dir="auto"] { overflow-wrap: anywhere; }
.claim > p + p,
.behavior-visual header > p + p,
.microworld header > p + p,
.review-item > p + p,
.teaching-aid-choice dd > p + p,
.item-actions dd > p + p,
.scope-limit dd > p + p,
.quiz-answer-content > p + p { margin-top: ${space2}px; }

.topbar {
  position: sticky;
  z-index: 30;
  top: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.topbar-inner {
  display: flex;
  position: relative;
  max-width: ${LAYOUT.documentWidth}px;
  height: ${LAYOUT.topbarInnerHeight}px;
  margin: 0 auto;
  padding: 0 ${LAYOUT.topbarWideGutter}px;
  align-items: center;
  gap: ${space5}px;
}
.brand {
  display: flex;
  align-items: center;
  gap: ${space2}px;
  font: 700 ${TYPE.brand.wide.fontSize}px/${TYPE.brand.wide.lineHeight} "Hope Sans", sans-serif;
  letter-spacing: -.025em;
  white-space: nowrap;
}
.brand-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 6px;
}
.top-context {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: ${space2}px;
  color: var(--text);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
.repository-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  stroke: var(--muted);
}
.commit-status {
  flex: 0 0 auto;
  padding: ${space1}px ${space2}px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
  font-size: ${TYPE.micro.compactFontSize}px;
  font-weight: 700;
}
.commit-status code {
  font: inherit;
}
.topbar-actions {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: ${space2}px;
}
.pull-request-link {
  display: inline-flex;
  min-height: 44px;
  padding: 0 ${space1}px;
  align-items: center;
  gap: ${space1}px;
  color: var(--accent);
  flex: 0 0 auto;
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pull-request-link:hover,
.pull-request-link:focus-visible { color: var(--text); }
.external-link-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  stroke: currentColor;
}
.display-controls {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}
.locale-menu { position: relative; }
.locale-menu > summary {
  display: flex;
  height: 42px;
  min-width: 80px;
  padding: 0 ${space2}px 0 ${space3}px;
  align-items: center;
  justify-content: space-between;
  gap: ${space2}px;
  color: var(--text);
  cursor: pointer;
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
  list-style: none;
}
.locale-menu > summary::-webkit-details-marker { display: none; }
.locale-chevron {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  transition: transform 120ms ease;
}
.locale-menu[open] .locale-chevron { transform: rotate(180deg); }
.locale-options {
  position: absolute;
  z-index: 32;
  top: calc(100% + ${space1}px);
  right: 0;
  display: grid;
  min-width: 124px;
  margin: 0;
  padding: ${space1}px;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--text) 14%, transparent);
  list-style: none;
}
.locale-option,
.locale-current {
  display: flex;
  min-height: 44px;
  padding: ${space2}px ${space3}px;
  align-items: center;
  border-radius: 4px;
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
  text-decoration: none;
}
.locale-current { color: var(--muted); }
.locale-option,
.locale-option:visited { color: var(--text); }
.locale-option:hover,
.locale-option:focus-visible { background: var(--bg); }
.theme-button {
  display: inline-grid;
  width: 42px;
  height: 42px;
  padding: ${space1}px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}
.display-controls.has-locale-menu .theme-button {
  border-left: 1px solid var(--border);
  border-radius: 0 5px 5px 0;
}
.theme-button:hover { background: var(--panel); }
.theme-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}
.theme-icon[hidden] { display: none; }
.toc-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.layout {
  display: grid;
  max-width: ${LAYOUT.documentWidth}px;
  margin: auto;
  grid-template-columns: minmax(0, 1fr) ${LAYOUT.tableOfContentsWidth}px;
  gap: 0;
}
.main {
  width: 100%;
  min-width: 0;
  padding: ${space7}px ${space7}px 80px;
}
.locale-warning {
  margin: 0 0 ${space4}px;
  padding: ${space3}px ${space4}px;
  border: 1px solid var(--component-border);
  border-left: 4px solid var(--scope);
  background: var(--panel);
}
.toc-desktop {
  position: sticky;
  top: ${LAYOUT.topbarHeight}px;
  align-self: start;
  min-height: calc(100vh - ${LAYOUT.topbarHeight}px);
  padding: ${space7}px ${space5}px;
  border-left: 1px solid var(--border);
}
.toc-desktop h2,
.toc-mobile-panel h2 {
  margin: 0 0 ${space4}px;
  font-size: ${TYPE.menu.fontSize}px;
  line-height: ${TYPE.menu.lineHeight};
  font-weight: 700;
}
.toc-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space2}px;
}
.toc-progress {
  color: var(--muted);
  font-size: ${TYPE.micro.fontSize}px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.toc-list {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 2px;
  list-style: none;
}
.toc-link {
  display: grid;
  min-height: 36px;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: ${space2}px;
  padding: ${space1}px ${space2}px;
  border-left: 4px solid transparent;
  color: var(--muted);
  font-size: ${TYPE.body.wide.fontSize}px;
  font-weight: 500;
  text-decoration: none;
}
.toc-link:visited { color: var(--muted); }
.toc-number {
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: .02em;
}
.toc-link[aria-current="location"],
.toc-link[aria-current="location"]:visited {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-weight: 700;
}
.toc-link[aria-current="location"] .toc-number { color: var(--accent); }
.toc-link:hover,
.toc-link:focus { background: var(--panel); color: var(--text); }
.toc-mobile { display: none; }

.document-title { max-width: ${LAYOUT.proseWidth}; }
.document-title + .synopsis { margin-top: ${space5}px; padding-top: ${space4}px; }
.synopsis { margin: 0; }
.section-number {
  color: var(--accent);
  font-size: inherit;
  line-height: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: .02em;
}
.document-title h1 {
  min-width: 0;
  margin: 0;
  font-size: ${widePageTitle.fontSize}px;
  line-height: ${widePageTitle.lineHeight};
  letter-spacing: -.04em;
  overflow-wrap: anywhere;
}
.synopsis-grid > div > h3,
.synopsis-background > h3,
.synopsis-review-head > h3,
.before-after > div > h3 {
  margin: 0;
  color: var(--text);
  font-size: inherit;
  line-height: inherit;
  font-weight: 700;
}
.status-row,
.item-head {
  display: flex;
  flex-wrap: wrap;
  gap: ${space2}px;
  align-items: center;
}
.status,
.importance {
  display: inline-flex;
  padding: ${space1}px ${space2}px;
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: ${TYPE.micro.fontSize}px;
  line-height: ${TYPE.micro.lineHeight};
  font-weight: 500;
}
.status.kind-resolve { color: var(--resolve); }
.status.kind-decide { color: var(--decide); }
.status.kind-verify { color: var(--verify); }
.synopsis-grid {
  display: grid;
}
.before-after {
  display: grid;
  gap: 0;
}
.change-shift {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}
.change-shift > .shift-card {
  display: block;
  padding: ${space4}px ${space2}px ${space5}px;
}
.change-shift > .shift-card > h3 { margin-bottom: ${space2}px; }
.change-shift > .shift-card + .shift-card {
  padding-left: ${space5}px;
  border-left: 1px solid var(--border);
}
.synopsis-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: ${space5}px;
  align-items: start;
  padding: ${space3}px ${space2}px;
  border-bottom: 1px solid var(--border);
}
.synopsis-background {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: ${space5}px;
  padding: ${space3}px ${space2}px;
  border-bottom: 1px solid var(--border);
}
.synopsis-background > h3 {
  margin: 0;
  padding-top: 2px;
}
.synopsis-background-content { min-width: 0; }
.synopsis-row > h3 { padding-top: 2px; }
.summary-label-stacked { display: inline-flex; flex-direction: column; align-items: flex-start; }
.synopsis-value {
  min-width: 0;
}
.review-empty { margin: 0; }
.claim p,
.summary-line,
.synopsis-grid > div > p,
.item-actions dd,
.scope-limit dd,
.quiz p {
  max-width: ${LAYOUT.proseWidth};
}
.claim p,
.summary-line { margin: 0; }
.more-link { margin: ${space2}px 0 0; }
.claim-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0 ${space2}px;
  align-items: center;
}
.claim-basis {
  color: var(--muted);
  font-size: ${TYPE.micro.fontSize}px;
  line-height: ${TYPE.micro.lineHeight};
  font-weight: 500;
}
.claim-meta > .evidence {
  min-width: 0;
  max-width: 100%;
}
.claim-meta > .evidence[open] { flex: 1 1 100%; }
.item-basis {
  color: var(--muted);
  font-size: ${TYPE.micro.fontSize}px;
  line-height: ${TYPE.micro.lineHeight};
  font-weight: 500;
}

.evidence {
  min-width: 0;
  max-width: 100%;
  margin-top: ${space2}px;
}
.claim-meta > .evidence { margin-top: 0; }
.evidence > summary {
  display: flex;
  align-items: center;
  color: var(--muted);
  cursor: pointer;
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
.evidence-list {
  display: grid;
  min-width: 0;
  max-width: 100%;
  margin-top: ${space2}px;
  gap: ${space2}px;
}
.evidence-item {
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--component-border);
  background: var(--panel);
}
.evidence-reference {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.evidence-reference a {
  display: flex;
  min-height: 44px;
  padding: ${space2}px 0;
  align-items: center;
}
.evidence-meta a:visited,
.evidence-reference a:visited {
  color: var(--visited);
}
.evidence-meta {
  padding: ${space2}px;
  border-bottom: 1px solid var(--border);
  font: 400 ${TYPE.supporting.wide.fontSize}px/${TYPE.supporting.wide.lineHeight} "Hope Code", ui-monospace, monospace;
  overflow-wrap: anywhere;
}
.evidence pre {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: ${space3}px;
  background: var(--panel);
  color: var(--text);
  overflow: auto;
  font: 400 ${wideCode.fontSize}px/${wideCode.lineHeight} "Hope Code", ui-monospace, monospace;
}
.evidence code {
  display: block;
  width: max-content;
  min-width: 100%;
}
.evidence pre.code-evidence {
  background: var(--code-bg);
  color: var(--code-fg);
}
.code-line {
  display: inline;
}
.code-line-patch {
  display: inline;
}
.code-line-patch::before {
  display: inline-block;
  position: sticky;
  left: 0;
  width: 8ch;
  padding-right: 1ch;
  border-right: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--muted);
  content: attr(data-old-line) " " attr(data-new-line);
  text-align: right;
  user-select: none;
}
.code-line-patch.code-line-unlocated::before { display: none; }
.code-content { white-space: pre; }
.code-line-patch .code-content { padding-left: 1ch; }
.code-prefix {
  display: inline-block;
  width: 2ch;
  font-weight: 700;
}
.code-line-added { background: var(--code-added-bg); }
.code-line-removed { background: var(--code-removed-bg); }
.code-line-hunk { background: var(--code-hunk-bg); }

.review-section {
  margin: 0;
  padding: 0;
  border: 0;
}
.synopsis + .review-section,
.review-section + .review-section { margin-top: ${space6}px; padding-top: ${space4}px; }
.review-section-collapsible:not([open]) {
  padding-bottom: 0;
}
.review-section-collapsible > .section-heading {
  min-height: 44px;
  cursor: pointer;
  list-style: none;
}
.review-section-collapsible:not([open]) > .section-heading { margin-bottom: 0; }
.review-section-collapsible > .section-heading::-webkit-details-marker { display: none; }
.review-section-collapsible > .section-heading::after {
  display: inline-block;
  margin-left: auto;
  content: "›";
  flex: 0 0 auto;
  transition: transform 120ms ease;
}
.review-section-collapsible[open] > .section-heading::after {
  transform: rotate(90deg);
}
.beginner-primer {
  margin-top: ${space4}px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.beginner-primer-summary {
  display: flex;
  min-height: 44px;
  padding: ${space2}px ${space3}px;
  align-items: center;
  gap: ${space2}px;
  cursor: pointer;
  list-style: none;
  font-weight: 600;
}
.beginner-primer-summary::-webkit-details-marker { display: none; }
.beginner-primer-summary::after {
  margin-left: auto;
  content: "›";
  color: var(--accent);
  transition: transform 120ms ease;
}
.beginner-primer[open] > .beginner-primer-summary::after {
  transform: rotate(90deg);
}
.beginner-primer-hint {
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 400;
}
.beginner-primer-content {
  padding: 0 ${space3}px ${space3}px;
}
.beginner-primer-content > .titled-claim-list,
.beginner-primer-content > .explanation-step {
  margin-top: ${space2}px;
}
.section-heading {
  display: flex;
  position: relative;
  margin-bottom: ${space4}px;
  padding-bottom: ${space3}px;
  border-bottom: 2px solid var(--component-border);
  align-items: center;
  gap: ${space2}px;
}
.section-heading h2 {
  display: grid;
  width: 100%;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: baseline;
  gap: ${space2}px;
  margin: 0;
  color: var(--text);
  font-size: ${wideSection.fontSize}px;
  line-height: ${wideSection.lineHeight};
}
.review-subsection {
  margin-top: ${space5}px;
  padding-top: ${space4}px;
  border-top: 1px solid var(--border);
}
.review-section > .section-heading + .review-subsection {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
.subsection-heading {
  display: flex;
  min-height: 28px;
  margin-bottom: ${space3}px;
  align-items: center;
  gap: ${space2}px;
}
.subsection-heading h3 {
  margin: 0;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.review-subsection-collapsible > .subsection-heading {
  min-height: 44px;
  margin-bottom: 0;
  cursor: pointer;
  list-style: none;
}
.review-subsection-collapsible { padding-top: 0; }
.review-subsection-collapsible > .subsection-heading::-webkit-details-marker {
  display: none;
}
.review-subsection-collapsible > .subsection-heading::after {
  margin-left: auto;
  color: var(--muted);
  content: "›";
  transition: transform 120ms ease;
}
.review-subsection-collapsible[open] > .subsection-heading::after {
  transform: rotate(90deg);
}
.subsection-content {
  padding-top: ${space2}px;
}
.explanation-step + .explanation-step { margin-top: ${space4}px; }
.core-details { margin: 0; }
.claim-list,
.code-step-list,
.titled-claim-list,
.review-items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.claim-list > li {
  position: relative;
  padding-left: 20px;
}
.claim-list > li + li { margin-top: ${space2}px; }
.claim-list > li::before,
.titled-claim-list > li::before {
  position: absolute;
  top: .72em;
  left: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  content: "";
}
.titled-claim-list > li {
  position: relative;
  padding-left: 20px;
}
.titled-claim-list > li + li { margin-top: ${space4}px; }
.review-items-full > li + li { margin-top: ${space4}px; }
.scope-impact-list {
  margin: 0;
  padding-left: 20px;
}
.scope-impact-list > li {
  padding-left: ${space1}px;
}
.scope-impact-list > li + li { margin-top: ${space1}px; }
.scope-impact-list > li::marker { color: var(--scope); }
.code-step-list {
  counter-reset: code-step;
}
.code-step-list > li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: ${space2}px;
  counter-increment: code-step;
}
.code-step-list > li + li { margin-top: ${space4}px; }
.code-step-list > li::before {
  color: var(--muted);
  content: counter(code-step, decimal-leading-zero);
  font: 400 ${TYPE.supporting.wide.fontSize}px/${wideSubsection.lineHeight} "Hope Code", ui-monospace, monospace;
}
.code-step-list .explanation-step { min-width: 0; }
.explanation-step h3,
.review-item h3,
.scope-limit h3 {
  margin: 0 0 ${space2}px;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.evidence-group + .evidence-group,
.evidence-group + .scope-limits,
.scope-limits + .evidence-group { margin-top: ${space4}px; }
.evidence-group {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.evidence-group > summary {
  display: flex;
  min-height: 44px;
  padding: ${space3}px 0;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  list-style: none;
}
.evidence-group > summary h3 {
  margin: 0;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.evidence-group-content { padding: 0 0 ${space3}px ${space4}px; }
.flow {
  display: grid;
  margin: ${space3}px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: behavior-step;
}
.flow > li {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 56px;
  margin: 0;
  padding: 0 0 ${space4}px;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: ${space3}px;
  counter-increment: behavior-step;
}
.flow > li::before {
  position: relative;
  z-index: 1;
  width: 28px;
  background: var(--bg);
  color: var(--accent);
  content: counter(behavior-step, decimal-leading-zero);
  font: 700 ${TYPE.supporting.wide.fontSize}px/${wide.lineHeight} "Hope Sans", sans-serif;
  font-variant-numeric: tabular-nums;
}
.flow > li:not(:last-child)::after {
  position: absolute;
  top: 22px;
  bottom: ${space1}px;
  left: 13px;
  width: 1px;
  background: var(--border);
  content: "";
}

.behavior-visual,
.microworld {
  min-width: 0;
  margin: ${space4}px 0;
  padding: ${space4}px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  overflow-wrap: anywhere;
}
.behavior-summary {
  max-width: ${LAYOUT.proseWidth};
  font-size: 1.08em;
}
.teaching-aid-summary {
  max-width: ${LAYOUT.proseWidth};
  margin: 0 0 ${space3}px;
}
.teaching-aid-choices {
  display: grid;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${space3}px;
  list-style: none;
}
.teaching-aid-choice {
  height: 100%;
  padding: 0 ${space3}px;
}
.teaching-aid-choices > li + li { border-left: 1px solid var(--border); }
.teaching-aid-choice > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space2}px;
}
.teaching-aid-choice h3 {
  margin: 0;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.teaching-aid-decision {
  padding: ${space1}px ${space2}px;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--muted);
  font-size: ${TYPE.micro.fontSize}px;
  line-height: ${TYPE.micro.lineHeight};
  font-weight: 500;
  white-space: nowrap;
}
.decision-included .teaching-aid-decision { color: var(--accent); }
.decision-not-applicable .teaching-aid-decision { color: var(--scope); }
.teaching-aid-choice dl {
  display: grid;
  margin: ${space3}px 0 0;
  gap: ${space2}px;
}
.teaching-aid-choice dt {
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
.teaching-aid-choice dd {
  margin: ${space1}px 0 0;
}
.behavior-visual > header h3,
.microworld > header h3 {
  margin: 0;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.behavior-visual > header p,
.microworld > header > p {
  max-width: ${LAYOUT.proseWidth};
  margin: ${space2}px 0 0;
}
.teaching-aid-meta {
  margin-top: ${space3}px;
  padding-top: ${space3}px;
  border-top: 1px solid var(--border);
}
.visual-flow,
.visual-sequence {
  display: grid;
  margin: ${space3}px 0 0;
  padding: 0;
  gap: ${space2}px;
  list-style: none;
  counter-reset: visual-step;
}
.visual-flow > li,
.visual-sequence > li {
  position: relative;
  padding: ${space3}px ${space3}px ${space3}px 44px;
  border: 1px solid var(--border);
  counter-increment: visual-step;
}
.visual-flow > li::before,
.visual-sequence > li::before {
  position: absolute;
  top: ${space3}px;
  left: ${space3}px;
  color: var(--muted);
  content: counter(visual-step, decimal-leading-zero);
  font: 400 ${TYPE.supporting.wide.fontSize}px/${wide.lineHeight} "Hope Code", ui-monospace, monospace;
}
.visual-flow p,
.visual-sequence p {
  margin: ${space1}px 0 0;
}
.visual-table {
  min-width: 0;
  max-width: 100%;
  margin-top: ${space3}px;
}
.decision-table th {
  text-align: left;
  font-weight: 500;
}
.decision-table tbody th {
  overflow-wrap: anywhere;
}
.visual-participants {
  display: flex;
  margin: ${space3}px 0 0;
  padding: 0;
  flex-wrap: wrap;
  gap: ${space2}px;
  list-style: none;
}
.visual-participants li {
  padding: ${space1}px ${space2}px;
  border: 1px solid var(--component-border);
  border-radius: 999px;
  font-weight: 500;
}
.visual-route {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space2}px;
}
.visual-components {
  display: grid;
  margin-top: ${space3}px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${space2}px;
}
.visual-components article {
  padding: ${space3}px;
  border: 1px solid var(--border);
}
.visual-components h4,
.visual-connections h4 {
  margin: 0;
}
.visual-components p {
  margin: ${space1}px 0 0;
}
.visual-connections {
  margin-top: ${space3}px;
}
.visual-connections ul {
  display: grid;
  margin: ${space2}px 0 0;
  padding-left: 20px;
  gap: ${space2}px;
}
.visual-connections li > span + span {
  display: block;
  margin-top: ${space1}px;
}

.microworld {
  padding-left: ${space4}px;
  border-left: 3px solid var(--accent);
}
.microworld-eyebrow {
  color: var(--accent);
  font-size: ${TYPE.micro.fontSize}px;
  line-height: ${TYPE.micro.lineHeight};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.microworld-notice {
  padding: ${space2}px ${space3}px;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
.microworld-disclosure { margin-top: ${space3}px; }
.microworld-disclosure > summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--accent);
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}
.microworld-disclosure > summary::-webkit-details-marker { display: none; }
.microworld-disclosure > summary::after {
  margin-left: ${space2}px;
  content: "›";
  transition: transform 120ms ease;
}
.microworld-disclosure[open] > summary::after { transform: rotate(90deg); }
.microworld-content { padding-bottom: ${space2}px; }
.microworld-controls {
  min-width: 0;
  margin: ${space2}px 0 0;
  padding: 0;
  border: 0;
}
.microworld-control-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.microworld-control-group legend {
  margin-bottom: ${space2}px;
  font-weight: 500;
}
.microworld-controls > div {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${space3}px;
}
.microworld-options {
  display: grid;
  min-width: 0;
  gap: ${space1}px;
}
.microworld-option {
  display: grid;
  min-height: 44px;
  padding: ${space2}px ${space3}px;
  border: 1px solid var(--component-border);
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: ${space2}px;
  font-weight: 500;
}
.microworld-control {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--accent);
}
.microworld-noscript {
  margin: ${space3}px 0;
  color: var(--scope);
  font-weight: 500;
}
.microworld-scenarios {
  margin-top: ${space4}px;
}
.microworld-scenario[hidden] {
  display: none !important;
}
.microworld-scenario > h4 {
  margin: 0 0 ${space3}px;
  font-size: ${wideSubsection.fontSize}px;
  line-height: ${wideSubsection.lineHeight};
}
.microworld-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${space3}px;
}
.microworld-trace {
  padding: ${space3}px;
  border: 1px solid var(--border);
}
.microworld-trace h5 {
  margin: 0;
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  line-height: ${TYPE.supporting.wide.lineHeight};
  text-transform: uppercase;
  letter-spacing: .06em;
}
.microworld-trace ol {
  margin: ${space2}px 0;
  padding-left: 22px;
}
.microworld-outcome,
.microworld-lesson {
  margin: ${space2}px 0 0;
}
.microworld-outcome > p,
.microworld-lesson > p { margin-top: ${space1}px; }
.microworld-outcome > p + p,
.microworld-lesson > p + p { margin-top: ${space2}px; }
.microworld-boundary {
  display: grid;
  margin: ${space4}px 0 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${space3}px;
}
.microworld-boundary > div {
  padding-left: ${space3}px;
  border-left: 2px solid var(--border);
}
.microworld-boundary dt {
  color: var(--muted);
  font-weight: 500;
}
.microworld-boundary dd {
  margin: ${space1}px 0 0;
}

.review-item {
  padding: ${space5}px 0;
  border-top: 1px solid var(--border);
}
.review-items-full > li:last-child .review-item {
  border-bottom: 1px solid var(--border);
}
.review-item:not(.review-item-compact) .item-head {
  margin-bottom: ${space2}px;
}
.review-items-full > li + li { margin-top: 0; }
.review-item > p {
  max-width: ${LAYOUT.proseWidth};
  margin: ${space2}px 0;
}
.review-item-compact {
  padding: ${space2}px 0;
  border: 0;
  background: transparent;
}
.review-items-compact > li:first-child .review-item-compact { padding-top: 0; }
.review-items-compact > li + li { margin-top: ${space2}px; }
.review-item-compact .item-head {
  gap: ${space1}px;
}
.review-item-compact .status,
.review-item-compact .importance {
  padding: 0;
  border: 0;
  border-radius: 0;
  font-size: ${TYPE.supporting.wide.fontSize}px;
  line-height: ${TYPE.supporting.wide.lineHeight};
}
.review-item-compact .status {
  gap: ${space1}px;
}
.review-item-compact .status::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
  content: "";
}
.review-item-compact .importance {
  color: var(--muted);
}
.review-item-compact .importance::before {
  margin-right: ${space1}px;
  content: "·";
}
.review-item-compact h4 {
  margin: ${space1}px 0 0 14px;
  font-size: inherit;
  line-height: inherit;
  font-weight: 500;
}
.review-item-compact h4 a {
  color: var(--accent);
  text-decoration: underline;
}
.review-item-compact h4 a:hover,
.review-item-compact h4 a:focus-visible {
  color: var(--text);
}
.review-item-compact > p { display: none; }
.item-actions {
  display: grid;
  margin: ${space3}px 0;
  gap: ${space2}px;
}
.item-actions > div {
  display: grid;
  min-width: 0;
  padding: ${space3}px 0;
  gap: ${space1}px;
  border-top: 1px solid var(--border);
}
.item-actions > .item-next {
  border-top-color: var(--accent);
}
.scope-limit dl > div,
.artifact-details dl > div {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: ${space3}px;
}
.item-actions > div,
.scope-limit dl > div,
.artifact-details dl > div {
  overflow-wrap: anywhere;
}
.item-actions dt,
.scope-limit dt,
.artifact-details dt {
  color: var(--muted);
  font-weight: 500;
}
.item-actions dd,
.scope-limit dd,
.artifact-details dd { margin: 0; }
.related-limits {
  display: flex;
  flex-wrap: wrap;
  gap: ${space1}px;
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}

.scope-limits {
  display: grid;
  gap: ${space3}px;
}
.context-checks {
  display: grid;
  gap: ${space3}px;
}
.context-check,
.scope-limit {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.context-check-head,
.scope-limit-head {
  display: flex;
  min-height: 44px;
  padding: ${space3}px 0;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${space2}px;
  cursor: pointer;
  list-style: none;
}
.context-check h4,
.scope-limit-head h3 { margin: 0; }
.disclosure-content { padding: 0 0 ${space3}px ${space4}px; }
.disclosure-content > p { margin: 0 0 ${space2}px; }
.context-status,
.scope-impact {
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
.context-checked { color: var(--accent); }
.context-limited { color: var(--scope); }
.scope-limit dl { margin: 0; }
.scope-shared-reason { margin-bottom: ${space3}px !important; }
.scope-context-notes {
  display: grid;
  margin: ${space3}px 0;
  gap: ${space3}px;
}
.scope-context-note {
  padding-left: ${space3}px;
  border-left: 2px solid var(--border);
}
.scope-context-note h4 {
  margin: 0 0 ${space1}px;
}
.scope-context-note > p {
  margin: 0;
}
.scope-group-items {
  border: 1px solid var(--border);
  background: var(--panel);
}
.scope-limit-item + .scope-limit-item {
  border-top: 1px solid var(--border);
}
.scope-limit-item > summary {
  display: flex;
  min-height: 44px;
  padding: ${space2}px ${space3}px;
  align-items: center;
  cursor: pointer;
  list-style: none;
}
.scope-limit-item h4 {
  margin: 0;
  font-size: inherit;
}
.scope-limit-item-content {
  padding: 0 ${space3}px ${space3}px;
}
.table-scroll {
  overflow: auto;
  border: 1px solid var(--component-border);
}
table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
}
th,
td {
  padding: ${space2}px ${space3}px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
th {
  color: var(--muted);
  font-size: ${TYPE.supporting.wide.fontSize}px;
  font-weight: 500;
}
td:first-child {
  font-family: "Hope Code", ui-monospace, monospace;
  font-weight: 400;
  overflow-wrap: anywhere;
}
.artifact-details { margin-top: ${space3}px; }
.evidence > summary,
.evidence-group > summary,
.context-check > summary,
.scope-limit > summary,
.scope-limit-item > summary,
.artifact-details > summary,
.quiz > details > summary,
.quiz-answer > summary {
  display: flex;
  min-height: 44px;
  gap: ${space1}px;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  list-style: none;
}
.evidence > summary { min-height: ${space5}px; }
.evidence > summary::-webkit-details-marker,
.evidence-group > summary::-webkit-details-marker,
.context-check > summary::-webkit-details-marker,
.scope-limit > summary::-webkit-details-marker,
.scope-limit-item > summary::-webkit-details-marker,
.artifact-details > summary::-webkit-details-marker,
.quiz > details > summary::-webkit-details-marker,
.quiz-answer > summary::-webkit-details-marker {
  display: none;
}
.evidence > summary::before,
.evidence-group > summary::before,
.context-check > summary::before,
.scope-limit > summary::before,
.scope-limit-item > summary::before,
.artifact-details > summary::before,
.quiz > details > summary::before,
.quiz-answer > summary::before {
  content: "›";
  display: inline-block;
  flex: 0 0 auto;
  transition: transform 120ms ease;
}
.evidence[open] > summary::before,
.evidence-group[open] > summary::before,
.context-check[open] > summary::before,
.scope-limit[open] > summary::before,
.scope-limit-item[open] > summary::before,
.artifact-details[open] > summary::before,
.quiz > details[open] > summary::before,
.quiz-answer[open] > summary::before {
  transform: rotate(90deg);
}
.artifact-details dl {
  display: grid;
  gap: ${space2}px;
}
.quiz {
  display: grid;
  gap: ${space2}px;
}
.quiz > details {
  padding: 0;
  border-top: 1px solid var(--border);
}
.quiz > details:last-child { border-bottom: 1px solid var(--border); }
.quiz-workspace {
  display: grid;
  padding-top: ${space2}px;
  gap: ${space2}px;
}
.quiz textarea {
  width: 100%;
  max-width: ${LAYOUT.proseWidth};
  min-height: 96px;
  padding: ${space2}px ${space3}px;
  resize: vertical;
  border: 1px solid var(--component-border);
  background: var(--bg);
  color: var(--text);
  line-height: inherit;
}
.quiz textarea::placeholder {
  color: var(--muted);
  opacity: 1;
}
.quiz-answer {
  border-top: 1px solid var(--border);
}
.quiz-answer > summary {
  color: var(--accent);
}
.quiz-answer-content {
  padding: 0 0 ${space2}px ${space3}px;
}
.quiz-answer-content > p {
  max-width: ${LAYOUT.proseWidth};
  margin: 0 0 ${space2}px;
}
.quiz-answer-content > .evidence-inline {
  margin-top: ${space2}px;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: ${LAYOUT.tocBreakpoint - 1}px) {
  html:has(.toc-mobile[open]),
  body:has(.toc-mobile[open]) {
    overflow: hidden;
  }
  .layout {
    display: block;
  }
  .main { padding: ${space7}px ${space7}px 80px; }
  .toc-desktop { display: none; }
  .toc-mobile {
    display: block;
    position: relative;
  }
  .toc-mobile > summary {
    display: grid;
    width: 44px;
    height: 44px;
    padding: ${space1}px;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    list-style: none;
  }
  .toc-mobile > summary:hover {
    border-color: var(--border);
    background: var(--panel);
  }
  .toc-mobile > summary::-webkit-details-marker { display: none; }
  .toc-mobile-panel {
    position: fixed;
    z-index: 20;
    top: ${LAYOUT.topbarHeight}px;
    right: 0;
    width: min(360px, 100vw);
    max-height: calc(100vh - ${LAYOUT.topbarHeight}px);
    max-height: calc(100dvh - ${LAYOUT.topbarHeight}px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: ${space4}px;
    border-bottom: 1px solid var(--border);
    border-left: 1px solid var(--border);
    background: var(--panel);
    box-shadow: -16px 20px 36px rgb(0 0 0 / 12%);
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }
  .toc-mobile-panel .toc-link {
    min-height: 44px;
    padding: ${space2}px ${space3}px;
  }
  .toc-mobile .toc-link:hover,
  .toc-mobile .toc-link:focus-visible { color: var(--text); }
}

@media (max-width: ${LAYOUT.narrowBreakpoint - 1}px) {
  body {
    font-size: ${narrow.fontSize}px;
    line-height: ${narrow.lineHeight};
  }
  .topbar-inner {
    padding: 0 ${space4}px;
    gap: ${space3}px;
  }
  .brand {
    font-size: ${TYPE.brand.narrow.fontSize}px;
    line-height: ${TYPE.brand.narrow.lineHeight};
  }
  .top-context {
    overflow: hidden;
    font-size: ${TYPE.supporting.narrow.fontSize}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pull-request-link {
    font-size: ${TYPE.supporting.narrow.fontSize}px;
  }
  .document-title h1 {
    font-size: ${narrowPageTitle.fontSize}px;
    line-height: ${narrowPageTitle.lineHeight};
  }
  .main { padding: ${space8}px ${space4}px ${space9}px; }
  .document-title + .synopsis,
  .synopsis + .review-section,
  .review-section + .review-section { margin-top: ${space5}px; padding-top: ${space4}px; }
  .synopsis-grid > div > h3,
  .synopsis-background > h3,
  .before-after > div > h3,
  .evidence > summary {
    font-size: ${TYPE.supporting.narrow.fontSize}px;
    line-height: ${TYPE.supporting.narrow.lineHeight};
  }
  .evidence > summary { min-height: 44px; }
  .status-row { margin-top: ${space3}px; }
  .section-heading h2 {
    font-size: ${narrowSection.fontSize}px;
    line-height: ${narrowSection.lineHeight};
  }
  .explanation-step h3,
  .review-item h3 {
    font-size: ${narrowSubsection.fontSize}px;
    line-height: ${narrowSubsection.lineHeight};
  }
  .review-item-compact h4 {
    font-size: inherit;
    line-height: inherit;
  }
  .review-item-compact .status,
  .review-item-compact .importance,
  .review-empty,
  .beginner-primer-hint {
    font-size: ${TYPE.supporting.narrow.fontSize}px;
    line-height: ${TYPE.supporting.narrow.lineHeight};
  }
  .code-step-list > li::before,
  .flow > li::before {
    font-size: ${TYPE.supporting.narrow.fontSize}px;
  }
  .evidence pre {
    font-size: ${narrowCode.fontSize}px;
    line-height: ${narrowCode.lineHeight};
  }
  .change-shift,
  .visual-components,
  .teaching-aid-choices,
  .microworld-comparison,
  .microworld-boundary {
    grid-template-columns: 1fr;
  }
  .change-shift > .shift-card + .shift-card {
    padding-left: ${space2}px;
    border-top: 1px solid var(--border);
    border-left: 0;
  }
  .teaching-aid-choice { padding: ${space3}px 0; }
  .teaching-aid-choices > li + li {
    border-top: 1px solid var(--border);
    border-left: 0;
  }
  .item-actions > div,
  .scope-limit dl > div,
  .artifact-details dl > div {
    grid-template-columns: 1fr;
    gap: ${space1}px;
  }
  .toc-mobile-panel ol {
    grid-template-columns: 1fr;
  }
}

@media (max-width: ${LAYOUT.compactBreakpoint}px) {
  .behavior-visual,
  .microworld { padding: ${space3}px; }
  .topbar-inner {
    padding: 0 ${space3}px;
    gap: ${space2}px;
  }
  .brand { gap: ${space1}px; }
  .brand-icon {
    width: 20px;
    height: 20px;
    border-radius: 5px;
  }
  .brand-product { display: none; }
  .topbar-inner.has-locale-switch .commit-status { display: none; }
  .commit-status {
    max-width: 82px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
  .status,
  .importance,
  .claim-basis,
  .item-basis { font-size: ${TYPE.micro.compactFontSize}px; }
  .top-context {
    display: none;
  }
  .synopsis-row,
  .synopsis-background { grid-template-columns: 1fr; gap: ${space1}px; }
  .synopsis-row > h3 { padding-top: 0; }
  .synopsis-background > h3 { padding-top: 0; }
}

@media (max-width: ${LAYOUT.tightProductBarBreakpoint}px) {
  .topbar-inner {
    padding-inline: ${space2}px;
    gap: ${space1}px;
  }
  .topbar-actions { gap: ${space1}px; }
  .commit-status { padding: 2px ${space1}px; }
  .pull-request-link { padding-inline: 0; }
  .pull-request-link .external-link-icon { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * {
    animation: none !important;
    transition: none !important;
  }
}

@media (forced-colors: active) {
  .status,
  .commit-status,
  .display-controls,
  .locale-options,
  .locale-warning,
  .behavior-visual,
  .microworld,
  .review-item,
  .synopsis,
  .scope-limit { forced-color-adjust: auto; }
  .claim-list > li::before,
  .titled-claim-list > li::before {
    background: CanvasText;
  }
}

@media print {
  :root,
  :root[data-theme],
  :root:not([data-theme="light"]) {
    color-scheme: light;
    ${themeVariables(COLORS.light)};
    ${codeThemeVariables(CODE_THEME.light)};
    --bg: #fff;
    --border: #bbb;
    --muted: #555;
    --panel: #fff;
    --text: #000;
  }
  .toc-desktop,
  .toc-mobile,
  .theme-button,
  .microworld-controls,
  .microworld-noscript,
  .skip { display: none; }
  .layout {
    display: block;
    max-width: none;
    padding: 0;
  }
  .main { max-width: none; }
  .review-section,
  .review-item,
  .evidence-item,
  .behavior-visual,
  .teaching-aid-choice,
  .microworld,
  .quiz-question { break-inside: avoid; }
  .review-section-collapsible > .section-content,
  .review-subsection-collapsible > .subsection-content,
  .microworld-disclosure > .microworld-content,
  .beginner-primer > .beginner-primer-content,
  .evidence-group > .evidence-group-content,
  .context-check > .disclosure-content,
  .scope-limit > .disclosure-content,
  .scope-limit-item > .scope-limit-item-content {
    display: block !important;
  }
  .beginner-primer::details-content {
    content-visibility: visible;
  }
  .review-section-collapsible::details-content,
  .microworld-disclosure::details-content,
  .review-subsection-collapsible::details-content {
    content-visibility: visible;
  }
  .quiz-question > .quiz-workspace,
  .quiz-answer > .quiz-answer-content {
    display: block !important;
  }
  .quiz-question::details-content,
  .quiz-answer::details-content {
    content-visibility: visible;
  }
  .quiz textarea,
  .quiz-answer > summary {
    display: none !important;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
}
`;
}

function clientScript(dictionary) {
  const labels = JSON.stringify({
    dark: label(dictionary, "common.useDarkTheme"),
    light: label(dictionary, "common.useLightTheme"),
    microworldNoScenario: label(dictionary, "microworld.noScenario"),
    microworldSelection: label(dictionary, "microworld.selection"),
  });
  return `(()=>{"use strict";
const labels=${labels};
const root=document.documentElement;
const theme=document.getElementById("theme-toggle");
const toc=document.querySelector(".toc-mobile");
const navLinks=[...document.querySelectorAll('nav a[href^="#"]')];
const sections=[...document.querySelectorAll(".main > [id]")];
const progress=[...document.querySelectorAll("[data-toc-current]")];
let currentFrame=0;
const currentTheme=()=>root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
const syncTheme=()=>{if(!theme)return;const next=currentTheme()==="dark"?"light":"dark";theme.setAttribute("aria-label",labels[next]);theme.setAttribute("title",labels[next]);for(const icon of theme.querySelectorAll("[data-theme-icon]"))icon.toggleAttribute("hidden",icon.dataset.themeIcon!==next);};
const revealTarget=target=>{if(target.tagName==="DETAILS")target.open=true;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;};
const focusTarget=target=>{const hadTabindex=target.hasAttribute("tabindex");if(!hadTabindex)target.setAttribute("tabindex","-1");target.focus({preventScroll:true});if(!hadTabindex)target.addEventListener("blur",()=>target.removeAttribute("tabindex"),{once:true});};
const syncCurrent=()=>{if(sections.length===0)return;let current=sections[0];if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)current=sections[sections.length-1];else for(const section of sections){if(section.getBoundingClientRect().top<=96)current=section;else break;}const index=sections.indexOf(current);for(const item of progress)item.textContent=String(index+1);for(const link of navLinks){if(link.hash==="#"+current.id)link.setAttribute("aria-current","location");else link.removeAttribute("aria-current");}};
syncTheme();
theme?.addEventListener("click",()=>{root.dataset.theme=currentTheme()==="dark"?"light":"dark";syncTheme();});
toc?.addEventListener("click",event=>{const link=event.target.closest("a");if(!link)return;toc.open=false;const target=document.getElementById(link.hash.slice(1));if(!target)return;revealTarget(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({behavior:"instant",block:"start"});});});
addEventListener("keydown",event=>{if(event.key!=="Escape"||!toc?.open)return;event.preventDefault();toc.open=false;toc.querySelector(":scope > summary")?.focus();});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",syncTheme);
for(const world of document.querySelectorAll("[data-microworld]")){const groups=[...world.querySelectorAll(".microworld-control-group")];const controls=[...world.querySelectorAll(".microworld-control")];const scenarios=[...world.querySelectorAll(".microworld-scenario")];const status=world.querySelector("[data-microworld-status]");const updateWorld=()=>{const selectedControls=groups.map(group=>group.querySelector(".microworld-control:checked"));if(selectedControls.some(control=>!control)){if(status)status.textContent=labels.microworldNoScenario;return;}const key=selectedControls.map(control=>control.dataset.controlId+"="+control.value).join("|");let active;for(const scenario of scenarios){const selected=scenario.dataset.selectionKey===key;scenario.hidden=!selected;if(selected)active=scenario;}if(!status)return;if(!active){status.textContent=labels.microworldNoScenario;return;}const selection=selectedControls.map(control=>control.dataset.controlLabel+": "+control.dataset.optionLabel).join("; ");status.textContent=labels.microworldSelection+": "+selection+". "+active.dataset.status;};for(const control of controls){control.disabled=false;control.addEventListener("change",updateWorld);}updateWorld();}
const openTarget=()=>{if(!location.hash)return;const target=document.getElementById(location.hash.slice(1));if(!target)return;revealTarget(target);requestAnimationFrame(()=>{focusTarget(target);target.scrollIntoView({behavior:"instant",block:"start"});});};
addEventListener("hashchange",openTarget);
addEventListener("click",event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)requestAnimationFrame(openTarget);});
addEventListener("scroll",()=>{if(currentFrame)return;currentFrame=requestAnimationFrame(()=>{currentFrame=0;syncCurrent();});},{passive:true});
openTarget();
syncCurrent();
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
    <summary aria-label="${html(label(dictionary, "common.language"))}" title="${html(label(dictionary, "common.language"))}"><span lang="${html(currentLocale)}">${currentText}</span><svg class="locale-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m8 10 4 4 4-4"></path></svg></summary>
    <ul class="locale-options"><li><span class="locale-current" aria-current="page" lang="${html(currentLocale)}">${currentText}</span></li><li><a class="locale-option" href="${html(value.href)}" hreflang="${html(value.locale)}" lang="${html(value.locale)}">${alternateText}</a></li></ul>
  </details>`;
}

export async function renderReview(review, { alternateLocale, fonts } = {}) {
  const dictionary = await loadLocale(review.snapshot.settings.locale);
  const locale = localeMenu(alternateLocale, review.snapshot.settings.locale, dictionary);
  const fontBytes = fonts ?? Object.fromEntries(await Promise.all(
    Object.entries(fontUrls).map(async ([name, url]) => [name, await readFile(url)]),
  ));
  const iconBytes = await readFile(iconUrl);
  const iconDataUrl = `data:image/png;base64,${iconBytes.toString("base64")}`;
  const codeRenderer = Object.freeze({
    evidenceTargets: new Set(),
    render: renderCodeEvidence,
  });
  const script = clientScript(dictionary);
  const title = review.title.text;
  const sections = buildSections(review, dictionary, codeRenderer);
  const documentTitleHtml = documentTitle(title);
  const synopsisHtml = synopsis(review, dictionary, codeRenderer, { number: 1 });
  const styles = css(Object.fromEntries(Object.entries(fontBytes).map(
    ([name, bytes]) => [name, bytes.toString("base64")],
  )));
  const { owner, name } = review.snapshot.repository;
  const prUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
    + `/pull/${review.snapshot.pullRequest.number}`;
  const openPullRequestLabel = label(dictionary, "artifact.openPullRequest")
    .replace("{number}", String(review.snapshot.pullRequest.number));
  const localeWarning = review.snapshot.settings.localeSource === "default"
    ? `<aside class="locale-warning" role="note">${html(
      label(dictionary, "locale.fallbackWarning"),
    )}</aside>`
    : "";
  const theme = review.snapshot.settings.theme;
  const themeAttribute = theme === "system" ? "" : ` data-theme="${html(theme)}"`;
  const tocItems = [{
    id: "synopsis",
    number: 1,
    title: label(dictionary, "section.synopsis"),
  }, ...sections];
  const toc = `<ol class="toc-list">${tocItems.map(
    (item) => `<li><a class="toc-link" href="#${html(item.id)}"><span class="toc-number">${sectionOrdinal(item.number)}</span><span>${html(item.title)}</span></a></li>`,
  ).join("")}</ol>`;
  const document = `<!doctype html>
<html lang="${html(review.snapshot.settings.locale)}"${themeAttribute}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'sha256-${hashSource(styles)}'; script-src 'sha256-${hashSource(script)}'">
  <link rel="icon" type="image/png" sizes="128x128" href="${iconDataUrl}">
  <title>${html(title)} · Hope Diff</title>
  <style>${styles}</style>
</head>
<body>
  <a class="skip" href="#review">${html(label(dictionary, "common.skip"))}</a>
  <header class="topbar">
    <div class="topbar-inner${locale === "" ? "" : " has-locale-switch"}">
      <div class="brand"><img class="brand-icon" src="${iconDataUrl}" alt="" width="24" height="24"><span>HOPE</span><span class="brand-product">· DIFF</span></div>
      <div class="top-context">
        <svg class="repository-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <path d="M3 9.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>${html(owner)}/${html(name)}</span>
      </div>
      <span class="commit-status" title="${html(label(dictionary, "artifact.reviewedCommit"))} ${html(review.snapshot.snapshot.head)}"><code>${html(review.snapshot.snapshot.head.slice(0, 8))}</code></span>
      <div class="topbar-actions">
        <a class="pull-request-link" href="${html(prUrl)}" aria-label="${html(openPullRequestLabel)}" title="${html(openPullRequestLabel)}">
          <span>PR #${review.snapshot.pullRequest.number}</span>
          <svg class="external-link-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M14 5h5v5"></path>
            <path d="M19 5l-8 8"></path>
            <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>
          </svg>
        </a>
        <div class="display-controls${locale === "" ? "" : " has-locale-menu"}">
${locale === "" ? "" : `          ${locale}\n`}          <button class="theme-button" id="theme-toggle" type="button" aria-label="${html(label(dictionary, theme === "dark" ? "common.useLightTheme" : "common.useDarkTheme"))}" title="${html(label(dictionary, theme === "dark" ? "common.useLightTheme" : "common.useDarkTheme"))}">
          <svg class="theme-icon" data-theme-icon="dark" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${theme === "dark" ? " hidden" : ""}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"></path>
          </svg>
          <svg class="theme-icon" data-theme-icon="light" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${theme === "dark" ? "" : " hidden"}>
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>
          </svg>
          </button>
        </div>
        <details class="toc-mobile">
          <summary>
            <svg class="toc-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>
            </svg>
            <span class="sr-only">${html(label(dictionary, "common.menu"))}</span>
          </summary>
          <nav class="toc-mobile-panel" aria-label="${html(label(dictionary, "common.menu"))}">
            ${tocHeading(dictionary, tocItems.length)}
            ${toc}
          </nav>
        </details>
      </div>
    </div>
  </header>
  <div class="layout">
    <main class="main" id="review">
      ${localeWarning}
      ${documentTitleHtml}
      ${synopsisHtml}
      ${sections.map((item) => item.html).join("")}
    </main>
    <nav class="toc-desktop" aria-label="${html(label(dictionary, "common.menu"))}">
      ${tocHeading(dictionary, tocItems.length)}
      ${toc}
    </nav>
  </div>
  <script>${script}</script>
</body>
</html>
`;
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
