/**
 * Embedded as a fixed script in every Technical Record. It has no module or network
 * dependencies and reads its labels from the controls it enhances.
 */
export function mountShell() {
  const root = document.documentElement;
  const theme = document.getElementById("theme-toggle");
  const popover = document.getElementById("reference-popover");
  const popoverTitle = document.getElementById("reference-popover-title");
  const popoverBody = popover?.querySelector("[data-reference-popover-body]");
  const popoverMore = popover?.querySelector("[data-reference-popover-more]");
  const popoverClose = popover?.querySelector(".reference-popover-close");
  const navLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  const sections = [...new Set(navLinks.map((link) => link.hash))]
    .map((hash) => document.getElementById(hash.slice(1)))
    .filter(Boolean);
  const progress = [...document.querySelectorAll("[data-toc-current]")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let currentFrame = 0;
  let popoverFrame = 0;
  let activeMarker;

  const currentTheme = () => root.dataset.theme === "dark"
    || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  const syncTheme = () => {
    if (!theme) return;
    const next = currentTheme() === "dark" ? "light" : "dark";
    const text = theme.dataset[next === "dark" ? "labelDark" : "labelLight"];
    theme.setAttribute("aria-label", text);
    theme.setAttribute("title", text);
    for (const icon of theme.querySelectorAll("[data-theme-icon]")) icon.toggleAttribute("hidden", icon.dataset.themeIcon !== next);
  };
  const reveal = (target) => {
    for (let item = target; item; item = item.parentElement) if (item.tagName === "DETAILS") item.open = true;
  };
  const focusTarget = (target) => {
    const had = target.hasAttribute("tabindex");
    if (!had) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (!had) target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  };
  const goTo = (target) => {
    reveal(target);
    requestAnimationFrame(() => { focusTarget(target); target.scrollIntoView({ behavior: "instant", block: "start" }); });
  };
  const openTarget = () => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) goTo(target);
  };
  const syncCurrent = () => {
    if (sections.length === 0) return;
    let current = sections[0];
    if (innerHeight + scrollY >= root.scrollHeight - 2) current = sections.at(-1);
    else for (const section of sections) { if (section.getBoundingClientRect().top <= 96) current = section; else break; }
    const index = sections.indexOf(current);
    for (const item of progress) item.textContent = String(index + 1);
    for (const link of navLinks) {
      if (link.hash === `#${current.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    const span = Math.max(1, root.scrollHeight - innerHeight);
    root.style.setProperty("--reading-progress", String(Math.min(1, Math.max(0, scrollY / span))));
  };
  const positionPopover = () => {
    if (!activeMarker || !popover?.matches(":popover-open")) return;
    const marker = activeMarker.getBoundingClientRect();
    if (marker.bottom < 0 || marker.top > innerHeight) { popover.hidePopover(); return; }
    const margin = 12;
    const gap = 10;
    const width = Math.min(480, innerWidth - margin * 2);
    popover.style.width = `${width}px`;
    popover.style.maxHeight = "none";
    const natural = popover.scrollHeight;
    const below = innerHeight - marker.bottom - gap - margin;
    const above = marker.top - gap - margin;
    let placement;
    let available;
    if (innerWidth < 760 && Math.max(below, above) < 200) { placement = "sheet"; available = innerHeight - margin * 2; }
    else if (below >= Math.min(natural, 200) || below >= above) { placement = "below"; available = below; }
    else { placement = "above"; available = above; }
    popover.dataset.placement = placement;
    popover.style.maxHeight = `${Math.max(80, Math.min(available, 640))}px`;
    const height = popover.getBoundingClientRect().height;
    let left = Math.min(Math.max(marker.left + marker.width / 2 - width / 2, margin), innerWidth - margin - width);
    let top;
    if (placement === "sheet") { left = margin; top = innerHeight - margin - height; }
    else if (placement === "above") top = marker.top - gap - height;
    else top = marker.bottom + gap;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(Math.max(margin, top))}px`;
    popover.style.setProperty("--popover-arrow-x", `${Math.min(Math.max(marker.left + marker.width / 2 - left, 20), width - 20)}px`);
    popover.style.visibility = "";
  };
  const schedulePopover = () => {
    if (popoverFrame || !popover?.matches(":popover-open")) return;
    popoverFrame = requestAnimationFrame(() => { popoverFrame = 0; positionPopover(); });
  };

  syncTheme();
  theme?.addEventListener("click", () => {
    const apply = () => { root.dataset.theme = currentTheme() === "dark" ? "light" : "dark"; syncTheme(); };
    if (!document.startViewTransition || reducedMotion.matches) { apply(); return; }
    const box = theme.getBoundingClientRect();
    root.style.setProperty("--theme-origin-x", `${Math.round(box.left + box.width / 2)}px`);
    root.style.setProperty("--theme-origin-y", `${Math.round(box.top + box.height / 2)}px`);
    document.startViewTransition(apply);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncTheme);

  for (const panel of document.querySelectorAll(".toc-mobile")) {
    panel.addEventListener("click", (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      panel.open = false;
      const target = document.getElementById(link.hash.slice(1));
      if (target) goTo(target);
    });
  }

  document.addEventListener("click", (event) => {
    const marker = event.target.closest?.(".reference-marker");
    if (!marker || !popover?.showPopover) return;
    const target = document.getElementById(marker.dataset.referenceTarget);
    if (!target) return;
    event.preventDefault();
    if (activeMarker && activeMarker !== marker) activeMarker.setAttribute("aria-expanded", "false");
    activeMarker = marker;
    marker.setAttribute("aria-expanded", "true");
    popoverTitle.textContent = marker.dataset.referenceTitle || marker.textContent;
    const preview = (target.querySelector("[data-reference-body]") ?? target).cloneNode(true);
    for (const item of [preview, ...preview.querySelectorAll("[id]")]) item.removeAttribute("id");
    popoverBody.replaceChildren(preview);
    popoverMore.href = `#${target.id}`;
    if (marker.dataset.referenceListLabel) popoverMore.textContent = marker.dataset.referenceListLabel;
    popover.style.visibility = "hidden";
    if (!popover.matches(":popover-open")) popover.showPopover();
    positionPopover();
    popoverClose?.focus();
  });
  popoverClose?.addEventListener("click", () => { popover.hidePopover(); activeMarker?.focus(); });
  popoverMore?.addEventListener("click", () => { if (popover.matches(":popover-open")) popover.hidePopover(); });
  popover?.addEventListener("toggle", (event) => {
    if (event.newState !== "closed" || !activeMarker) return;
    activeMarker.setAttribute("aria-expanded", "false");
    activeMarker = undefined;
    popover.removeAttribute("data-placement");
    popover.removeAttribute("style");
  });

  // Escape closes the innermost open panel that asks for it and returns focus to its control.
  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || popover?.matches(":popover-open")) return;
    const open = [...document.querySelectorAll("details[data-dismiss][open]")];
    const target = open.findLast((item) => !open.some((other) => other !== item && item.contains(other)));
    if (!target) return;
    event.preventDefault();
    target.open = false;
    target.querySelector(":scope > summary")?.focus();
  });
  addEventListener("hashchange", openTarget);
  addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (link && link.hash === location.hash) requestAnimationFrame(openTarget);
  });
  addEventListener("resize", schedulePopover);
  addEventListener("scroll", () => {
    schedulePopover();
    if (currentFrame) return;
    currentFrame = requestAnimationFrame(() => { currentFrame = 0; syncCurrent(); });
  }, { passive: true });
  openTarget();
  syncCurrent();
}
