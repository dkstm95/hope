function command(command, runPath, details = {}) {
  return Object.freeze({
    command,
    runPath,
    ...details,
  });
}

function checkpoint(runPath, window) {
  return Object.freeze({
    checkpointPath: window.checkpointPath,
    kind: "write-checkpoint",
    then: command("checkpoint-window", runPath, {
      page: window.startPage,
    }),
  });
}

export function nextAfterPrepare(runPath) {
  return Object.freeze({
    kind: "required",
    transition: command("inspect-window", runPath, { page: 1 }),
  });
}

export function nextAfterInspection(runPath, window) {
  return Object.freeze({
    kind: "required",
    transition: checkpoint(runPath, window),
  });
}

export function nextAfterCheckpoint(
  runPath,
  nextWindow,
  pendingContextRequests,
) {
  if (nextWindow) return nextAfterInspection(runPath, nextWindow);

  const ledger = command("ledger", runPath, { page: 1 });
  if (pendingContextRequests.length === 0) {
    return Object.freeze({ kind: "required", transition: ledger });
  }

  return Object.freeze({
    kind: "choose",
    transitions: Object.freeze([
      command("context", runPath, {
        eligibleRequestIds: Object.freeze(
          pendingContextRequests.map((request) => request.id),
        ),
        when: "A pending request would close a material review-frontier question",
      }),
      Object.freeze({
        ...ledger,
        when: "No pending request is needed for the material review frontier",
      }),
    ]),
  });
}

export function nextAfterLedger(runPath, ledger, analysisPath) {
  if (ledger.page < ledger.totalPages) {
    return Object.freeze({
      kind: "required",
      transition: command("ledger", runPath, { page: ledger.page + 1 }),
    });
  }
  return Object.freeze({
    kind: "required",
    transition: Object.freeze({
      analysisPath,
      kind: "write-analysis",
      then: command("validate", runPath),
    }),
  });
}

export function nextAfterValidation(runPath) {
  return Object.freeze({
    kind: "required",
    transition: command("finish", runPath),
  });
}
