const bidiControls = /[؜‎‏‪-‮⁦-⁩]/gu;

/** Show invisible direction controls as escapes so authored text cannot reorder a line. */
export function exposeBidiControls(value) {
  return String(value ?? "").replace(bidiControls, (character) => (
    `\\u${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`
  ));
}

export function escapeHtml(value) {
  return exposeBidiControls(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escape a value for an attribute while keeping its line structure readable to assistive technology. */
export function escapeAttribute(value) {
  return escapeHtml(value)
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\t", "&#9;");
}

/** Authored text as one isolated run; line breaks stay visible. */
export function authoredText(value, className = "") {
  const text = String(value ?? "").split(/\r?\n/u).map(escapeHtml).join("<br>");
  return `<bdi dir="auto"${className ? ` class="${className}"` : ""}>${text}</bdi>`;
}

/** Each authored line becomes its own paragraph; the suffix follows the last one. */
export function authoredParagraphs(value, suffix = "") {
  const paragraphs = String(value ?? "").split(/\r?\n+/u);
  return paragraphs.map(
    (paragraph, index) => `<p>${authoredText(paragraph.trim())}${
      index === paragraphs.length - 1 ? suffix : ""
    }</p>`,
  ).join("");
}

/** JSON that cannot close its script element or break a line in JavaScript. */
export function embeddedJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}
