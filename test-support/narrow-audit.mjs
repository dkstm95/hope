/**
 * Run in a page at a narrow width: list visible controls smaller than 44 by 44
 * pixels and visible text smaller than 12 pixels. Inline evidence and judgment
 * markers follow their own 24-pixel rule, and code keeps the code scale.
 */
export function narrowAudit() {
  const visible = (element) => element.checkVisibility({ visibilityProperty: true });
  const name = (element) => `${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`;
  const targets = [];
  for (const element of document.querySelectorAll("a, button, summary, label, textarea")) {
    if (!visible(element) || element.closest(".sr-only, .code-row, pre")) continue;
    if (element.matches(".reference-marker")) continue;
    // Links that run inside a sentence or list item are inline text, not standalone targets.
    if (element instanceof HTMLAnchorElement && getComputedStyle(element).display === "inline") continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0) continue;
    if (box.height < 43.5 || box.width < 43.5) targets.push(`${name(element)} ${Math.round(box.width)}x${Math.round(box.height)}`);
  }
  const text = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const element = walker.currentNode.parentElement;
    if (!walker.currentNode.textContent.trim() || !visible(element)) continue;
    if (element.closest(".sr-only, .code-row, pre, .line-number")) continue;
    const size = Number.parseFloat(getComputedStyle(element).fontSize);
    if (size < 12) text.add(`${name(element)} ${size}px`);
  }
  return { targets: [...new Set(targets)], text: [...text] };
}
