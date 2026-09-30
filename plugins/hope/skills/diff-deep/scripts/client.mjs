/** Embedded as a fixed script. This function has no module or network dependencies. */
export function mount() {
  const model = JSON.parse(document.getElementById("diff-deep-document").textContent);
  const view = JSON.parse(document.getElementById("diff-deep-view").textContent);
  const labels = view.labels;
  const snapshot = model.snapshot;
  const $ = (id) => document.getElementById(id);
  const changes = new Map(snapshot.changes.map((change) => [change.id, change]));
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const lines = new Map(snapshot.files.flatMap((file) => file.hunks.flatMap((hunk) => hunk.rows))
    .filter((row) => row.id).map((row) => [row.id, row]));
  const steps = snapshot.changes.flatMap((change) => change.lineIds.length
    ? change.lineIds.map((lineId) => ({ changeId: change.id, lineId }))
    : [{ changeId: change.id, lineId: null }]);
  const allowedRead = new Set(snapshot.changes.flatMap((change) => change.kind === "unavailable"
    ? [] : change.lineIds.length ? change.lineIds : [`meta:${change.id}`]));
  const rowElements = [...document.querySelectorAll("[data-line]")];
  const markerElements = [...document.querySelectorAll("[data-select]")];
  const storageKey = `hope.diff-deep.v1:${snapshot.id}`;
  const narrow = matchMedia("(max-width: 760px)");
  let selected = snapshot.changes[0]?.id ?? null;
  let selectedLine = changes.get(selected)?.lineIds[0] ?? null;
  let mode = "change";
  let read = new Set();
  let storageOK = true;

  function restore(value) {
    if (!value || value.schemaVersion !== 1 || value.snapshotId !== snapshot.id
      || !["change", "line"].includes(value.mode) || !changes.has(value.selected)
      || (changes.get(value.selected).lineIds.length ? !changes.get(value.selected).lineIds.includes(value.line) : value.line !== null)
      || !Array.isArray(value.read) || value.read.length > allowedRead.size
      || value.read.some((id) => !allowedRead.has(id))) throw new Error(labels.invalidProgress);
    selected = value.selected;
    selectedLine = value.line;
    mode = value.mode;
    read = new Set(value.read);
  }

  function progress() {
    return { schemaVersion: 1, snapshotId: snapshot.id, selected, line: selectedLine, mode, read: [...read] };
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(progress())); }
    catch { storageOK = false; }
    $("storage-warning").textContent = storageOK ? "" : labels.storageUnavailable;
    $("storage-description").textContent = storageOK ? labels.restored : labels.storageUnavailable;
  }

  try {
    const previous = localStorage.getItem(storageKey);
    if (previous) restore(JSON.parse(previous));
  } catch { storageOK = false; }

  function itemIds(change) {
    return change.kind === "unavailable" ? [] : change.lineIds.length ? change.lineIds : [`meta:${change.id}`];
  }

  function currentIds() {
    const change = changes.get(selected);
    if (!change) return [];
    return mode === "line" && selectedLine ? [selectedLine] : itemIds(change);
  }

  function movePanel() {
    const panel = document.querySelector(".reason-aside");
    if (narrow.matches && selected) {
      const change = changes.get(selected);
      const anchor = change.lineIds.length
        ? document.querySelector(`[data-line="${mode === "line" && selectedLine ? selectedLine : change.lineIds.at(-1)}"]`)
        : document.querySelector(`[data-select="${selected}"]`);
      anchor?.after(panel);
    } else document.querySelector(".workspace").append(panel);
  }

  function selectedLocation(change) {
    const file = files.get(change.fileId);
    const path = file.path.split("/").at(-1);
    if (!change.lineIds.length) return path;
    if (mode === "line" && selectedLine) {
      const row = lines.get(selectedLine);
      return `${path} · ${row.kind === "del" ? labels.before : labels.after} L${row.oldLine ?? row.newLine}`;
    }
    const rows = change.lineIds.map((id) => lines.get(id));
    const after = rows.filter((row) => row.newLine !== undefined).map((row) => row.newLine);
    const before = rows.filter((row) => row.oldLine !== undefined).map((row) => row.oldLine);
    const span = (values) => values.length ? `${values[0]}${values.at(-1) === values[0] ? "" : `–${values.at(-1)}`}` : "—";
    return `${path} · ${span(before)} → ${span(after)}`;
  }

  function position() {
    return mode === "line"
      ? steps.findIndex((step) => step.changeId === selected && step.lineId === selectedLine)
      : snapshot.changes.findIndex((change) => change.id === selected);
  }

  function render() {
    const change = changes.get(selected);
    if (!change) {
      document.querySelector(".reason-aside").hidden = true;
      return;
    }
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    const count = mode === "line" ? steps.length : snapshot.changes.length;
    const index = position();
    $("position").textContent = `${String(index + 1).padStart(2, "0")} / ${count}`;
    $("previous-change").disabled = index <= 0;
    $("next-change").disabled = index >= count - 1;
    const content = $("selected-reason");
    const template = $(`reason-${selected}`);
    content.replaceChildren(...[...template.children].filter((element) => element.tagName !== "SUMMARY").map((element) => element.cloneNode(true)));
    const anchor = document.createElement("div");
    anchor.className = "reason-location";
    anchor.textContent = selectedLocation(change);
    content.querySelector(".reason-copy").prepend(anchor);
    const current = currentIds();
    const checked = current.length > 0 && current.every((id) => read.has(id));
    $("read-change").disabled = current.length === 0;
    $("read-change").setAttribute("aria-pressed", String(checked));
    $("read-change").setAttribute("aria-label", checked ? labels.undoRead : labels.reviewed);
    $("read-change").dataset.tip = checked ? labels.undoRead : labels.reviewed;
    $("refresh").hidden = model.explanations.length === snapshot.changes.length;
    $("request-feedback").textContent = "";
    $("request-text").hidden = true;
    $("read-progress").textContent = `${read.size}/${allowedRead.size} ${labels.read}`;
    for (const button of markerElements) {
      const id = button.dataset.select;
      const ids = itemIds(changes.get(id));
      const done = ids.length > 0 && ids.every((key) => read.has(key));
      const partial = ids.some((key) => read.has(key));
      button.setAttribute("aria-pressed", String(id === selected));
      button.querySelector(".change-state").textContent = done ? "✓" : partial ? "◐" : id === selected ? "↗" : "";
    }
    for (const row of rowElements) {
      row.classList.toggle("selected", row.dataset.change === selected);
      row.classList.toggle("selected-line", mode === "line" && row.dataset.line === selectedLine);
      row.setAttribute("aria-pressed", String(mode === "line" ? row.dataset.line === selectedLine : row.dataset.change === selected));
      row.querySelector(".line-read").textContent = read.has(row.dataset.line) ? "✓" : "";
    }
    $("storage-warning").textContent = storageOK ? "" : labels.storageUnavailable;
    movePanel();
  }

  function select(changeId, lineId, scroll = false) {
    if (!changes.has(changeId)) return;
    selected = changeId;
    selectedLine = lineId ?? changes.get(selected).lineIds[0] ?? null;
    render();
    save();
    if (scroll) {
      const selector = mode === "line" && selectedLine ? `[data-line="${selectedLine}"]` : `[data-select="${selected}"]`;
      document.querySelector(selector)?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }

  function step(delta) {
    const list = mode === "line" ? steps : snapshot.changes.map((change) => ({ changeId: change.id, lineId: change.lineIds[0] ?? null }));
    const index = Math.max(0, Math.min(list.length - 1, position() + delta));
    const item = list[index];
    if (item) select(item.changeId, item.lineId, true);
  }

  for (const marker of markerElements) marker.addEventListener("click", () => select(marker.dataset.select));
  for (const row of rowElements) row.addEventListener("click", () => select(row.dataset.change, row.dataset.line));
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      if (mode === "line" && !selectedLine) selectedLine = changes.get(selected)?.lineIds[0] ?? null;
      render(); save();
    });
  }
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.addEventListener("click", () => {
      document.documentElement.dataset.theme = button.dataset.themeChoice;
      document.querySelectorAll("[data-theme-choice]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  }
  $("previous-change").addEventListener("click", () => step(-1));
  $("next-change").addEventListener("click", () => step(1));
  $("read-change").addEventListener("click", () => {
    const ids = currentIds();
    const remove = ids.every((id) => read.has(id));
    for (const id of ids) remove ? read.delete(id) : read.add(id);
    render(); save();
  });
  $("refresh").addEventListener("click", () => location.reload());
  $("copy-request").addEventListener("click", async () => {
    const artifact = location.protocol === "file:" ? decodeURIComponent(location.pathname) : view.artifactPath;
    const prompt = `Use $hope:diff-deep to explain why change ${selected}${mode === "line" && selectedLine ? ` (line ${selectedLine})` : ""} was made in ${JSON.stringify(artifact)}. `
      + `Keep the captured snapshot ${snapshot.id} (head ${snapshot.head}) and add the explanation to this artifact.`;
    try {
      await navigator.clipboard.writeText(prompt);
      $("request-feedback").textContent = labels.copied;
    } catch {
      $("request-feedback").textContent = labels.copyFailed;
      $("request-text").value = prompt;
      $("request-text").hidden = false;
      $("request-text").focus();
      $("request-text").select();
    }
  });
  $("export-progress").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress(), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `diff-deep-${snapshot.head.slice(0, 12)}-progress.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  });
  $("import-progress").addEventListener("click", () => $("progress-file").click());
  $("progress-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(labels.invalidProgress);
      restore(JSON.parse(await file.text()));
      render(); save();
      $("storage-warning").textContent = storageOK ? labels.imported : labels.storageUnavailable;
    } catch { $("storage-warning").textContent = labels.invalidProgress; }
    event.target.value = "";
  });
  for (const link of document.querySelectorAll(".file-index a")) link.addEventListener("click", () => {
    const file = files.get(link.hash.slice(1));
    if (file?.changeIds.length) select(file.changeIds[0]);
    link.closest("details").open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      for (const details of document.querySelectorAll(".capture-info[open], .file-index[open]")) {
        details.open = false;
        details.querySelector("summary").focus();
      }
    }
  });
  narrow.addEventListener("change", movePanel);
  document.documentElement.classList.add("enhanced");
  render();
}
