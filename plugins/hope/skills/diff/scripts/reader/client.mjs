/** Embedded as a fixed script. This function has no module or network dependencies. */
export function mount() {
  const root = document.getElementById("diff-reader");
  history.scrollRestoration = "manual";
  const model = JSON.parse(document.getElementById("diff-reader-document").textContent);
  const { labels, artifactPath } = JSON.parse(document.getElementById("diff-reader-view").textContent);
  const snapshot = model.snapshot;
  const $ = (id) => document.getElementById(id);
  const groups = [...root.querySelectorAll(".change-group")];
  const groupIds = groups.map((group) => group.id);
  const parts = [...root.querySelectorAll(".diff-part")];
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const rows = new Map();
  for (const part of parts) {
    if (!rows.has(part.dataset.file)) rows.set(part.dataset.file, new Map());
    const index = rows.get(part.dataset.file);
    if (!part.querySelector(".code-row")) index.set(0, part);
    for (const row of part.querySelectorAll(".code-row")) index.set(Number(row.dataset.sourceLine), row);
  }
  const readable = new Set(groups.filter((group) => group.dataset.readable === "true").map((group) => group.dataset.fingerprint));
  const storageKey = `hope.diff.reader.v1:${snapshot.id}`;
  const narrow = matchMedia("(max-width: 760px)");
  const reference = (element) => {
    const part = element.closest(".diff-part");
    return { fileId: part.dataset.file, sourceLine: Number(element.dataset.sourceLine ?? part.dataset.firstLine) };
  };
  const elementFor = (anchor) => anchor && rows.get(anchor.fileId)?.get(anchor.sourceLine);
  let selected = groupIds[0] ?? null;
  let anchor = parts[0] ? reference(parts[0]) : null;
  let detail = false;
  let viewport = null;
  let read = new Set();
  let storageOK = true;

  function restore(value) {
    if (!value || value.schemaVersion !== 1 || value.snapshotId !== snapshot.id
      || (parts.length ? !elementFor(value.anchor) : value.anchor !== null)
      || typeof value.detail !== "boolean" || !Array.isArray(value.read)
      || value.read.length > 20_500 || value.read.some((id) => typeof id !== "string" || !/^[a-f0-9]{64}$/u.test(id))
      || (value.viewport !== null && (!elementFor(value.viewport?.anchor) || !Number.isFinite(value.viewport?.offset)))) {
      throw new Error(labels.invalidProgress);
    }
    const expanded = value.expanded;
    if (!Array.isArray(expanded) || expanded.length > 20_500 || expanded.some((entry) => !elementFor(entry))) throw new Error(labels.invalidProgress);
    const openGroups = new Set(expanded.map((entry) => elementFor(entry).closest(".change-group").id));
    for (const group of groups) group.querySelector(".group-disclosure").open = openGroups.has(group.id);
    anchor = value.anchor;
    detail = value.detail;
    viewport = value.viewport;
    selected = elementFor(anchor)?.closest(".change-group").id ?? null;
    read = new Set(value.read.filter((id) => readable.has(id)));
  }
  function progress() {
    const expanded = groups.filter((group) => group.querySelector(".group-disclosure").open)
      .map((group) => reference(group.querySelector(".diff-part")));
    return { schemaVersion: 1, snapshotId: snapshot.id, anchor, detail, viewport, expanded, read: [...read] };
  }
  function storageMessage() {
    $("storage-warning").textContent = storageOK ? "" : labels.storageUnavailable;
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(progress())); } catch { storageOK = false; }
    storageMessage();
  }
  try {
    const previous = localStorage.getItem(storageKey);
    if (previous) restore(JSON.parse(previous));
  } catch { storageOK = false; }

  function movePanel() {
    const panel = root.querySelector(".reason-aside");
    if (narrow.matches && selected) {
      const disclosure = $(selected).querySelector(".group-disclosure");
      (disclosure.open ? disclosure.querySelector(".group-heading") : disclosure).after(panel);
    }
    else root.querySelector(".workspace").append(panel);
  }
  function updateRead() {
    for (const group of groups) group.querySelector(".group-read").textContent = read.has(group.dataset.fingerprint) ? "✓" : "";
    const fingerprint = $(selected)?.dataset.fingerprint;
    const checked = read.has(fingerprint);
    $("read-group").disabled = !readable.has(fingerprint);
    $("read-group").setAttribute("aria-pressed", String(checked));
    $("read-group").setAttribute("aria-label", checked ? labels.undoRead : labels.reviewed);
    $("read-group").dataset.tip = checked ? labels.undoRead : labels.reviewed;
    $("read-progress").textContent = `${read.size}/${readable.size} ${labels.read}`;
  }
  function select(id, element = null, scroll = false) {
    if (!groupIds.includes(id)) return;
    root.querySelectorAll(".selected-group, .selected-part, .selected-code").forEach((item) => {
      item.classList.remove("selected-group", "selected-part", "selected-code");
    });
    for (const group of groups) group.querySelector(".group-select").setAttribute("aria-current", String(group.id === id));
    selected = id;
    const group = $(id);
    group.classList.add("selected-group");
    if (element && scroll) group.querySelector(".group-disclosure").open = true;
    detail = Boolean(element);
    anchor = reference(element ?? group.querySelector(".diff-part"));
    const index = groupIds.indexOf(id);
    $("position").textContent = `${String(index + 1).padStart(2, "0")} / ${groupIds.length}`;
    $("previous-group").disabled = index === 0;
    $("next-group").disabled = index === groupIds.length - 1;
    const content = $("selected-reason");
    content.replaceChildren(...[...$(`reason-${id}`).children].filter((item) => item.tagName !== "SUMMARY").map((item) => item.cloneNode(true)));
    if (element) {
      const part = element.closest(".diff-part");
      part.classList.add("selected-part");
      if (element.matches(".code-row")) element.classList.add("selected-code");
      const context = document.createElement("div");
      context.className = "selected-context";
      const location = document.createElement("div");
      location.className = "reason-location";
      location.textContent = `${labels.selectedCode} · ${files.get(anchor.fileId).path}`
        + (element.matches(".code-row") ? ` · ${element.querySelector(".sr-only").textContent.replace(/: $/u, "")}` : "");
      context.append(location);
      const note = part.querySelector(".part-note");
      if (note) { const paragraph = document.createElement("p"); paragraph.textContent = note.textContent; context.append(paragraph); }
      content.querySelector(".reason-copy").append(context);
      for (const entry of content.querySelectorAll(".evidence-entry")) {
        if (entry.dataset.source === anchor.fileId && Number(entry.dataset.start) <= anchor.sourceLine && Number(entry.dataset.end) >= anchor.sourceLine) entry.classList.add("related-evidence");
      }
    }
    $("request-feedback").textContent = "";
    $("request-text").hidden = true;
    updateRead(); movePanel();
    if (scroll) (element ?? group).scrollIntoView({ block: "start", behavior: "instant" });
  }
  for (const group of groups) {
    group.querySelector(".group-select").addEventListener("click", () => { select(group.id); save(); });
    group.querySelector(".group-disclosure").addEventListener("toggle", () => { movePanel(); save(); });
  }
  for (const part of parts) {
    part.querySelector(".part-select").addEventListener("click", () => { select(part.dataset.group, part); save(); });
    part.addEventListener("click", (event) => {
      const row = event.target.closest(".code-row");
      if (row && !window.getSelection()?.toString()) { select(part.dataset.group, row); save(); }
    });
  }
  for (const [buttonId, delta] of [["previous-group", -1], ["next-group", 1]]) $(buttonId).addEventListener("click", () => {
    const id = groupIds[groupIds.indexOf(selected) + delta];
    if (id) { select(id, null, true); save(); }
  });
  $("read-group").addEventListener("click", () => {
    const key = $(selected)?.dataset.fingerprint;
    if (!readable.has(key)) return;
    read.has(key) ? read.delete(key) : read.add(key);
    updateRead(); save();
  });
  $("copy-request").addEventListener("click", async () => {
    const artifact = location.protocol === "file:" ? decodeURIComponent(location.pathname) : artifactPath;
    const prompt = `Use $hope:diff to explain group ${JSON.stringify(selected)} in ${JSON.stringify(artifact)}. `
      + `Selected code: ${JSON.stringify(anchor)}. Keep snapshot ${snapshot.id} (head ${snapshot.head}), mention before/after line numbers where helpful,. Answer using the captured review; create a new review if code or grouping must change.`;
    try { await navigator.clipboard.writeText(prompt); $("request-feedback").textContent = labels.copied; }
    catch { $("request-feedback").textContent = labels.copyFailed; $("request-text").value = prompt; $("request-text").hidden = false; $("request-text").focus(); $("request-text").select(); }
  });
  $("export-progress").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress(), null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `diff-${snapshot.head.slice(0, 12)}-progress.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  });
  $("import-progress").addEventListener("click", () => $("progress-file").click());
  function restoreViewport() {
    if (viewport) {
      const element = elementFor(viewport.anchor);
      if (element.closest(".group-disclosure").open) window.scrollBy(0, element.getBoundingClientRect().top - viewport.offset);
    }
  }
  $("progress-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(labels.invalidProgress);
      restore(JSON.parse(await file.text()));
      select(selected, detail ? elementFor(anchor) : null); restoreViewport(); save();
      $("storage-warning").textContent = storageOK ? labels.imported : labels.storageUnavailable;
    } catch { $("storage-warning").textContent = labels.invalidProgress; }
    event.target.value = "";
  });
  document.addEventListener("click", (event) => {
    const source = event.target.closest("[data-reference-file]");
    if (source && root.contains(source)) {
      const entries = [...(rows.get(source.dataset.referenceFile)?.entries() ?? [])];
      const row = entries.filter(([line]) => line >= Number(source.dataset.referenceLine)).sort((a, b) => a[0] - b[0])[0]?.[1];
      if (row) { select(row.closest(".change-group").id, row, true); row.tabIndex = -1; row.focus({ preventScroll: true }); save(); }
    }
    const link = event.target.closest('.file-index a, .limits a');
    if (link) {
      const target = $(link.hash.slice(1));
      if (target) { event.preventDefault(); select(target.closest(".change-group").id, target.matches(".diff-part") ? target : null, true); save(); link.closest("details").open = false; }
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") for (const details of root.querySelectorAll(".file-index[open]")) { details.open = false; details.querySelector("summary").focus(); }
  });
  let scrollTimer;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const box = $("reader-changes").getBoundingClientRect();
      const element = document.elementFromPoint(box.left + box.width / 2, 24)?.closest(".code-row, .diff-part");
      if (element) { viewport = { anchor: reference(element), offset: element.getBoundingClientRect().top }; save(); }
    }, 120);
  }, { passive: true });
  narrow.addEventListener("change", movePanel);
  root.classList.add("enhanced");
  $("reason-panel").parentElement.hidden = groupIds.length === 0;
  select(selected, detail ? elementFor(anchor) : null);
  requestAnimationFrame(restoreViewport); storageMessage();
}
