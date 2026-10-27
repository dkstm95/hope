/**
 * Embedded as a fixed script after the shell client. It enhances each declarative
 * microworld; labels come from the microworld element, so the script is locale-free.
 */
export function mountDiff() {
  for (const world of document.querySelectorAll("[data-microworld]")) {
    const groups = [...world.querySelectorAll(".microworld-control-group")];
    const controls = [...world.querySelectorAll(".microworld-control")];
    const scenarios = [...world.querySelectorAll(".microworld-scenario")];
    const status = world.querySelector("[data-microworld-status]");
    const sentence = (value) => /[.!?。？！]$/u.test(value) ? value : `${value}.`;
    const scenarioStatus = (scenario) => {
      const traces = [...scenario.querySelectorAll(".microworld-trace")].map((trace) => {
        const heading = trace.querySelector("h5")?.textContent.trim() || "";
        const outcome = trace.querySelector(".microworld-outcome p, .microworld-unchanged")?.textContent.trim() || "";
        return `${heading}: ${sentence(outcome)}`;
      });
      const lesson = scenario.querySelector(".microworld-lesson p")?.textContent.trim() || "";
      return [...traces, lesson].filter(Boolean).join(" ");
    };
    const update = () => {
      const selected = groups.map((group) => group.querySelector(".microworld-control:checked"));
      if (selected.some((control) => !control)) {
        if (status) status.textContent = world.dataset.labelNoScenario;
        return;
      }
      const key = selected.map((control) => `${control.dataset.controlId}=${control.value}`).join("|");
      let active;
      for (const scenario of scenarios) {
        const match = scenario.dataset.selectionKey === key;
        scenario.hidden = !match;
        if (match) active = scenario;
      }
      if (!status) return;
      if (!active) { status.textContent = world.dataset.labelNoScenario; return; }
      const selection = selected.map((control) => `${control.dataset.controlLabel}: ${control.dataset.optionLabel}`).join("; ");
      status.textContent = `${world.dataset.labelSelection}: ${selection}. ${scenarioStatus(active)}`;
    };
    for (const control of controls) {
      control.disabled = false;
      control.addEventListener("change", update);
    }
    world.classList.add("microworld-enhanced");
    update();
  }
}
