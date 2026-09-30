/** Embedded as a fixed script. This function has no module or network dependencies. */
export function mount() {
  const model = JSON.parse(document.getElementById("diff-deep-document").textContent);
  const { labels, artifactPath } = JSON.parse(document.getElementById("diff-deep-view").textContent);
  const snapshot = model.snapshot;
  const $ = (id) => document.getElementById(id);
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const fileIds = [...files.keys()];
  const readable = new Set(snapshot.files.filter((file) => file.availability !== "unavailable").map((file) => file.id));
  const storageKey = `hope.diff-deep.v2:${snapshot.id}`;
  const narrow = matchMedia("(max-width: 760px)");
  let selected = fileIds[0] ?? null;
  let read = new Set();
  let storageOK = true;

  function restore(value) {
    if (!value || value.schemaVersion !== 2 || value.snapshotId !== snapshot.id
      || (fileIds.length ? !files.has(value.selected) : value.selected !== null)
      || !Array.isArray(value.read) || value.read.length > readable.size
      || value.read.some((id) => !readable.has(id))) throw new Error(labels.invalidProgress);
    selected = value.selected;
    read = new Set(value.read);
  }

  function progress() {
    return { schemaVersion: 2, snapshotId: snapshot.id, selected, read: [...read] };
  }

  function storageMessage() {
    $("storage-warning").textContent = storageOK ? "" : labels.storageUnavailable;
    $("storage-description").textContent = storageOK ? labels.restored : labels.storageUnavailable;
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(progress())); }
    catch { storageOK = false; }
    storageMessage();
  }

  try {
    const previous = localStorage.getItem(storageKey);
    if (previous) restore(JSON.parse(previous));
  } catch { storageOK = false; }

  function movePanel() {
    const panel = document.querySelector(".reason-aside");
    if (narrow.matches && selected) $(selected).querySelector(".file-heading").after(panel);
    else document.querySelector(".workspace").append(panel);
  }

  function updateRead(id) {
    $(id).querySelector(".file-read").textContent = read.has(id) ? "✓" : "";
    const checked = read.has(selected);
    $("read-file").disabled = !readable.has(selected);
    $("read-file").setAttribute("aria-pressed", String(checked));
    $("read-file").setAttribute("aria-label", checked ? labels.undoRead : labels.reviewed);
    $("read-file").dataset.tip = checked ? labels.undoRead : labels.reviewed;
    $("read-progress").textContent = `${read.size}/${readable.size} ${labels.read}`;
  }

  function select(id, scroll = false) {
    if (!files.has(id)) return;
    if (selected) {
      $(selected).classList.remove("selected-file");
      $(selected).querySelector(".file-select").setAttribute("aria-pressed", "false");
    }
    selected = id;
    $(id).classList.add("selected-file");
    $(id).querySelector(".file-select").setAttribute("aria-pressed", "true");
    const index = fileIds.indexOf(id);
    $("position").textContent = `${String(index + 1).padStart(2, "0")} / ${fileIds.length}`;
    $("previous-file").disabled = index === 0;
    $("next-file").disabled = index === fileIds.length - 1;
    const template = $(`reason-${id}`);
    const content = $("selected-reason");
    content.replaceChildren(...[...template.children].filter((element) => element.tagName !== "SUMMARY").map((element) => element.cloneNode(true)));
    const location = document.createElement("div");
    location.className = "reason-location";
    location.textContent = files.get(id).path;
    content.querySelector(".reason-copy").prepend(location);
    $("request-feedback").textContent = "";
    $("request-text").hidden = true;
    updateRead(id);
    movePanel();
    if (scroll) $(id).scrollIntoView({ block: "start", behavior: "instant" });
  }

  for (const id of fileIds) {
    $(id).querySelector(".file-select").addEventListener("click", () => { select(id); save(); });
    $(id).querySelector(".file-read").textContent = read.has(id) ? "✓" : "";
  }
  for (const [buttonId, delta] of [["previous-file", -1], ["next-file", 1]]) {
    $(buttonId).addEventListener("click", () => {
      const id = fileIds[fileIds.indexOf(selected) + delta];
      if (id) { select(id, true); save(); }
    });
  }
  $("read-file").addEventListener("click", () => {
    if (!readable.has(selected)) return;
    read.has(selected) ? read.delete(selected) : read.add(selected);
    updateRead(selected); save();
  });
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.addEventListener("click", () => {
      document.documentElement.dataset.theme = button.dataset.themeChoice;
      document.querySelectorAll("[data-theme-choice]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  }
  $("refresh").hidden = model.explanations.length === fileIds.length;
  $("refresh").addEventListener("click", () => location.reload());
  $("copy-request").addEventListener("click", async () => {
    const artifact = location.protocol === "file:" ? decodeURIComponent(location.pathname) : artifactPath;
    const prompt = `Use $hope:diff-deep to explain why ${JSON.stringify(files.get(selected).path)} (file ${selected}) changed in ${JSON.stringify(artifact)}. `
      + `Keep snapshot ${snapshot.id} (head ${snapshot.head}), mention before/after line numbers where helpful, and update this file's explanation in the artifact.`;
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
      for (const id of fileIds) $(id).querySelector(".file-read").textContent = read.has(id) ? "✓" : "";
      document.querySelectorAll(".selected-file").forEach((element) => {
        element.classList.remove("selected-file");
        element.querySelector(".file-select").setAttribute("aria-pressed", "false");
      });
      select(selected); save();
      $("storage-warning").textContent = storageOK ? labels.imported : labels.storageUnavailable;
    } catch { $("storage-warning").textContent = labels.invalidProgress; }
    event.target.value = "";
  });
  for (const link of document.querySelectorAll(".file-index a")) link.addEventListener("click", () => {
    select(link.hash.slice(1)); save();
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
  $("reason-panel").parentElement.hidden = fileIds.length === 0;
  select(selected);
  storageMessage();
}
