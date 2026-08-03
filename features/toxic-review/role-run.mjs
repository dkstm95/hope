import { createHash } from "node:crypto";

import { createResultValidation } from "../result-validation/index.mjs";
import {
  serializedJsonBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  TOXIC_REVIEW_CONTRACT_VERSION,
  TOXIC_REVIEW_LIMITS,
  TOXIC_REVIEW_RISKS,
  TOXIC_REVIEW_ROLE_METHODS,
  TOXIC_REVIEW_STAGES,
  TOXIC_REVIEW_TARGETS,
} from "./constants.mjs";
import { validateToxicReview } from "./validate.mjs";

export const TOXIC_REVIEW_ROLE_RUN_VERSION = 1;

export const TOXIC_REVIEW_EXECUTION_MODES = Object.freeze([
  "single",
  "parallel",
  "isolated-sequential",
]);

export const TOXIC_REVIEW_ROLE_STATUSES = Object.freeze([
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

const digestPattern = /^sha256:[a-f0-9]{64}$/u;

const {
  array,
  boolean,
  choice,
  identifier,
  integer,
  object,
  references,
  stringList,
  text,
  unknownKeys,
} = createResultValidation({
  groupItems: TOXIC_REVIEW_LIMITS.groupItems,
  referenceItems: TOXIC_REVIEW_LIMITS.sources,
  stringCharacters: TOXIC_REVIEW_LIMITS.stringCharacters,
});

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function digestToxicReviewValue(value) {
  const encoded = JSON.stringify(canonicalValue(value)) ?? "null";
  return `sha256:${createHash("sha256")
    .update(encoded)
    .digest("hex")}`;
}

function sameValue(left, right) {
  return digestToxicReviewValue(left) === digestToxicReviewValue(right);
}

function runError(errors) {
  const error = new TypeError(
    `Hope toxic review role run is invalid:\n${errors
      .map((item) => `- ${item}`)
      .join("\n")}`,
  );
  error.code = "HOPE_TOXIC_REVIEW_ROLE_RUN_INVALID";
  error.issues = Object.freeze([...errors]);
  return error;
}

function validDigest(value, path, errors) {
  const result = text(value, path, errors);
  if (result && !digestPattern.test(result)) {
    errors.push(`${path} must be a sha256 digest`);
  }
  return result;
}

function normalizeTarget(value, path, errors) {
  const input = object(value, path, errors);
  unknownKeys(input, ["kind", "stage", "summary"], path, errors);
  return {
    kind: choice(input.kind, TOXIC_REVIEW_TARGETS, `${path}.kind`, errors),
    stage: choice(input.stage, TOXIC_REVIEW_STAGES, `${path}.stage`, errors),
    summary: text(input.summary, `${path}.summary`, errors),
  };
}

function normalizeRoles(value, snapshot, path, errors) {
  const knownSources = new Set(snapshot.sources.map((source) => source.id));
  const roleIds = new Set();
  const roles = array(
    value,
    path,
    errors,
    TOXIC_REVIEW_LIMITS.roles,
  ).map((entry, index) => {
    const rolePath = `${path}[${index}]`;
    const input = object(entry, rolePath, errors);
    unknownKeys(
      input,
      [
        "claimsToTest",
        "evidenceSourceIds",
        "excludedAreas",
        "expectedOutput",
        "focusRisks",
        "id",
        "method",
        "name",
        "target",
      ],
      rolePath,
      errors,
    );
    return {
      id: identifier(input.id, `${rolePath}.id`, errors, roleIds),
      name: text(input.name, `${rolePath}.name`, errors),
      ...(input.method === undefined
        ? {}
        : {
            method: choice(
              input.method,
              TOXIC_REVIEW_ROLE_METHODS,
              `${rolePath}.method`,
              errors,
            ),
          }),
      target: text(input.target, `${rolePath}.target`, errors),
      focusRisks: stringList(
        input.focusRisks,
        `${rolePath}.focusRisks`,
        errors,
        { minimum: 1 },
      ),
      evidenceSourceIds: references(
        input.evidenceSourceIds,
        `${rolePath}.evidenceSourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      ),
      excludedAreas: stringList(
        input.excludedAreas,
        `${rolePath}.excludedAreas`,
        errors,
      ),
      claimsToTest: stringList(
        input.claimsToTest,
        `${rolePath}.claimsToTest`,
        errors,
        { minimum: 1 },
      ),
      expectedOutput: text(
        input.expectedOutput,
        `${rolePath}.expectedOutput`,
        errors,
      ),
    };
  });
  if (roles.length === 0) {
    errors.push(`${path} must contain at least one role`);
  }
  if (roles.filter((role) => role.method === "causal-completeness").length > 1) {
    errors.push(`${path} may contain at most one causal-completeness role`);
  }
  return roles;
}

export function validateToxicReviewRunPlan(value) {
  const errors = [];
  const input = object(value, "plan", errors);
  unknownKeys(
    input,
    [
      "execution",
      "risk",
      "runId",
      "selection",
      "snapshot",
      "target",
      "title",
      "version",
    ],
    "plan",
    errors,
  );
  if (input.version !== TOXIC_REVIEW_ROLE_RUN_VERSION) {
    errors.push(`plan.version must be ${TOXIC_REVIEW_ROLE_RUN_VERSION}`);
  }
  const runIds = new Set();
  const runId = identifier(input.runId, "plan.runId", errors, runIds);
  let snapshot = { capturedAt: "", sources: [] };
  try {
    snapshot = validateWorkSnapshot(input.snapshot, {
      maximumSources: TOXIC_REVIEW_LIMITS.sources,
    });
  } catch (error) {
    errors.push(error.message);
  }
  const target = normalizeTarget(input.target, "plan.target", errors);
  const title = text(input.title, "plan.title", errors);
  const risk = choice(input.risk, TOXIC_REVIEW_RISKS, "plan.risk", errors);
  const selectionInput = object(input.selection, "plan.selection", errors);
  unknownKeys(
    selectionInput,
    ["maximumRoles", "reason", "roles"],
    "plan.selection",
    errors,
  );
  const maximumRoles = integer(
    selectionInput.maximumRoles,
    "plan.selection.maximumRoles",
    errors,
    { minimum: 1 },
  );
  const selectionReason = text(
    selectionInput.reason,
    "plan.selection.reason",
    errors,
  );
  if (maximumRoles > TOXIC_REVIEW_LIMITS.roles) {
    errors.push(
      `plan.selection.maximumRoles must be at most ${TOXIC_REVIEW_LIMITS.roles}`,
    );
  }
  const roles = normalizeRoles(
    selectionInput.roles,
    snapshot,
    "plan.selection.roles",
    errors,
  );
  if (roles.length > maximumRoles) {
    errors.push("plan selects more roles than plan.selection.maximumRoles");
  }
  const executionInput = object(input.execution, "plan.execution", errors);
  unknownKeys(
    executionInput,
    ["independentContexts", "mode"],
    "plan.execution",
    errors,
  );
  const mode = choice(
    executionInput.mode,
    TOXIC_REVIEW_EXECUTION_MODES,
    "plan.execution.mode",
    errors,
  );
  const independentContexts = boolean(
    executionInput.independentContexts,
    "plan.execution.independentContexts",
    errors,
  );
  if (roles.length === 1 && mode !== "single") {
    errors.push("a one-role plan must use single execution mode");
  }
  if (roles.length > 1 && mode === "single") {
    errors.push("a multi-role plan cannot use single execution mode");
  }
  if (roles.length > 1 && !independentContexts) {
    errors.push("a multi-role plan requires fresh independent contexts");
  }
  if (mode !== "single" && !independentContexts) {
    errors.push(`${mode} execution requires fresh independent contexts`);
  }
  let bytes = 0;
  try {
    bytes = serializedJsonBytes(value);
  } catch (error) {
    errors.push(error.message);
  }
  if (bytes > TOXIC_REVIEW_LIMITS.inputBytes) {
    errors.push(`plan exceeds ${TOXIC_REVIEW_LIMITS.inputBytes} bytes`);
  }
  if (errors.length > 0) throw runError(errors);
  return Object.freeze({
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    runId,
    title,
    risk,
    target: Object.freeze(target),
    snapshot,
    selection: Object.freeze({
      reason: selectionReason,
      maximumRoles,
      roles: Object.freeze(roles.map((role) => Object.freeze(role))),
    }),
    execution: Object.freeze({ mode, independentContexts }),
  });
}

function portableRoleProtocol(brief, role) {
  const protocol = {
    contractVersion: brief.version,
    reviewer: brief.roleRun.reviewer,
    findings: brief.findings,
    writingStandard: brief.writingStandard,
    ...(role.method === "causal-completeness"
      ? { causalCompleteness: brief.causalCompleteness }
      : {}),
  };
  return canonicalValue(protocol);
}

function filteredSnapshot(snapshot, role) {
  const assigned = new Set(role.evidenceSourceIds);
  return {
    capturedAt: snapshot.capturedAt,
    sources: snapshot.sources.filter((source) => assigned.has(source.id)),
  };
}

function roleBinding(plan, role, briefDigest, protocolDigest) {
  return digestToxicReviewValue({
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    runId: plan.runId,
    title: plan.title,
    risk: plan.risk,
    target: plan.target,
    snapshot: filteredSnapshot(plan.snapshot, role),
    role,
    briefDigest,
    protocolDigest,
  });
}

function attemptId({ bindingDigest, attempt, runId, roleId }) {
  return `attempt-${digestToxicReviewValue({
    bindingDigest,
    attempt,
    runId,
    roleId,
  }).slice(7, 31)}`;
}

function createRoleInput({
  attempt,
  bindingDigest,
  briefDigest,
  plan,
  protocol,
  role,
  runDigest,
}) {
  const protocolDigest = digestToxicReviewValue(protocol);
  const base = {
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    feature: "toxic-review-role",
    runId: plan.runId,
    runDigest,
    roleId: role.id,
    attempt,
    attemptId: attemptId({
      bindingDigest,
      attempt,
      runId: plan.runId,
      roleId: role.id,
    }),
    bindingDigest,
    briefDigest,
    protocolDigest,
    title: plan.title,
    risk: plan.risk,
    target: plan.target,
    snapshot: filteredSnapshot(plan.snapshot, role),
    role,
    protocol,
  };
  return Object.freeze({
    ...base,
    inputDigest: digestToxicReviewValue(base),
  });
}

function deriveRunStatus(roleStates) {
  if (roleStates.every((role) => role.status === "succeeded")) {
    return "ready-for-adjudication";
  }
  if (roleStates.some((role) => ["failed", "cancelled"].includes(role.status))) {
    return "incomplete";
  }
  return "prepared";
}

function withDerivedStatus(state) {
  return {
    ...state,
    status: deriveRunStatus(state.roleStates),
  };
}

export function prepareToxicReviewRun(value, { brief }) {
  const plan = validateToxicReviewRunPlan(value);
  if (!brief?.roleRun || !brief?.writingStandard) {
    throw runError(["the active Toxic Review brief is missing role-run rules"]);
  }
  if (
    brief.version !== TOXIC_REVIEW_CONTRACT_VERSION
    || brief.risk !== plan.risk
    || brief.target !== plan.target.kind
    || brief.stage !== plan.target.stage
  ) {
    throw runError(["the active brief does not match the role-run plan"]);
  }
  const protocols = new Map(plan.selection.roles.map((role) => [
    role.id,
    portableRoleProtocol(brief, role),
  ]));
  const briefDigest = digestToxicReviewValue({
    version: brief.version,
    roleRun: brief.roleRun.contract,
    findings: brief.findings,
    causalCompleteness: brief.causalCompleteness,
    writingStandard: brief.writingStandard,
  });
  const runDigest = digestToxicReviewValue({
    version: plan.version,
    runId: plan.runId,
    title: plan.title,
    risk: plan.risk,
    target: plan.target,
    snapshot: plan.snapshot,
    selection: plan.selection,
    execution: plan.execution,
    briefDigest,
  });
  const roleStates = plan.selection.roles.map((role) => {
    const protocol = protocols.get(role.id);
    const bindingDigest = roleBinding(
      plan,
      role,
      briefDigest,
      digestToxicReviewValue(protocol),
    );
    const input = createRoleInput({
      attempt: 1,
      bindingDigest,
      briefDigest,
      plan,
      protocol,
      role,
      runDigest,
    });
    return {
      roleId: role.id,
      bindingDigest,
      status: "pending",
      attempts: [{
        attempt: 1,
        attemptId: input.attemptId,
        inputDigest: input.inputDigest,
        status: "pending",
        input,
      }],
    };
  });
  return Object.freeze(withDerivedStatus({
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    feature: "toxic-review-run",
    runId: plan.runId,
    runDigest,
    briefDigest,
    title: plan.title,
    risk: plan.risk,
    target: plan.target,
    snapshot: plan.snapshot,
    selection: plan.selection,
    execution: plan.execution,
    roleStates,
  }));
}

function validateRoleSuccess(value, roleInput) {
  const errors = [];
  const input = object(value, "roleResult", errors);
  unknownKeys(
    input,
    [
      "attemptId",
      "bindingDigest",
      "causalAnalysis",
      "findings",
      "inputDigest",
      "roleId",
      "runId",
      "status",
      "version",
    ],
    "roleResult",
    errors,
  );
  if (input.version !== TOXIC_REVIEW_ROLE_RUN_VERSION) {
    errors.push(`roleResult.version must be ${TOXIC_REVIEW_ROLE_RUN_VERSION}`);
  }
  for (const [field, expected] of [
    ["runId", roleInput.runId],
    ["roleId", roleInput.roleId],
    ["attemptId", roleInput.attemptId],
    ["bindingDigest", roleInput.bindingDigest],
    ["inputDigest", roleInput.inputDigest],
  ]) {
    if (input[field] !== expected) {
      errors.push(`roleResult.${field} does not match the prepared role input`);
    }
  }
  if (input.status !== "succeeded") {
    errors.push("roleResult.status must be succeeded");
  }
  if (!Array.isArray(input.findings)) {
    errors.push("roleResult.findings must be an array");
  }
  if (errors.length > 0) throw runError(errors);

  const proposedFindings = Array.isArray(input.findings) ? input.findings : [];
  const auditReview = {
    version: TOXIC_REVIEW_CONTRACT_VERSION,
    title: roleInput.title,
    risk: roleInput.risk,
    target: roleInput.target,
    snapshot: roleInput.snapshot,
    roles: [roleInput.role],
    ...(input.causalAnalysis === undefined
      ? {}
      : { causalAnalysis: input.causalAnalysis }),
    findings: proposedFindings,
    adjudications: proposedFindings.map((finding) => ({
      findingId: finding.id,
      status: "rejected",
      rationale: "Role-result validation does not adjudicate findings.",
    })),
    summary: {
      assessment: "This temporary record validates one role result.",
      noMaterialIssueFound: true,
      scopeLimits: ["Adjudication happens only after every role succeeds."],
    },
  };
  const validated = validateToxicReview(auditReview);
  return Object.freeze({
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    runId: roleInput.runId,
    roleId: roleInput.roleId,
    attemptId: roleInput.attemptId,
    bindingDigest: roleInput.bindingDigest,
    inputDigest: roleInput.inputDigest,
    status: "succeeded",
    findings: validated.findings,
    ...(validated.causalAnalysis
      ? { causalAnalysis: validated.causalAnalysis }
      : {}),
  });
}

function currentAttempt(roleState) {
  return roleState.attempts.at(-1);
}

function planFromState(state) {
  return {
    version: state.version,
    runId: state.runId,
    title: state.title,
    risk: state.risk,
    target: state.target,
    snapshot: state.snapshot,
    selection: state.selection,
    execution: state.execution,
  };
}

export function validateToxicReviewRunState(value) {
  const errors = [];
  const input = object(value, "run", errors);
  unknownKeys(
    input,
    [
      "briefDigest",
      "execution",
      "feature",
      "risk",
      "roleStates",
      "runDigest",
      "runId",
      "selection",
      "snapshot",
      "status",
      "target",
      "title",
      "version",
    ],
    "run",
    errors,
  );
  let plan;
  try {
    plan = validateToxicReviewRunPlan(planFromState(input));
  } catch (error) {
    errors.push(...(error.issues ?? [error.message]));
  }
  const briefDigest = validDigest(input.briefDigest, "run.briefDigest", errors);
  const runDigest = validDigest(input.runDigest, "run.runDigest", errors);
  if (input.feature !== "toxic-review-run") {
    errors.push("run.feature must be toxic-review-run");
  }
  if (plan) {
    const expectedRunDigest = digestToxicReviewValue({
      version: plan.version,
      runId: plan.runId,
      title: plan.title,
      risk: plan.risk,
      target: plan.target,
      snapshot: plan.snapshot,
      selection: plan.selection,
      execution: plan.execution,
      briefDigest,
    });
    if (runDigest !== expectedRunDigest) {
      errors.push("run.runDigest does not match the prepared plan");
    }
  }
  const knownRoles = new Map(
    (plan?.selection.roles ?? []).map((role) => [role.id, role]),
  );
  const seenRoles = new Set();
  const roleStates = array(
    input.roleStates,
    "run.roleStates",
    errors,
    TOXIC_REVIEW_LIMITS.roles,
  ).map((entry, roleIndex) => {
    const path = `run.roleStates[${roleIndex}]`;
    const roleState = object(entry, path, errors);
    unknownKeys(
      roleState,
      ["attempts", "bindingDigest", "roleId", "status"],
      path,
      errors,
    );
    const roleId = text(roleState.roleId, `${path}.roleId`, errors);
    if (!knownRoles.has(roleId)) {
      errors.push(`${path}.roleId references an unknown selected role`);
    }
    if (seenRoles.has(roleId)) errors.push(`${path}.roleId is repeated`);
    seenRoles.add(roleId);
    const bindingDigest = validDigest(
      roleState.bindingDigest,
      `${path}.bindingDigest`,
      errors,
    );
    const role = knownRoles.get(roleId);
    if (plan && role) {
      const protocol = Array.isArray(roleState.attempts)
        ? roleState.attempts[0]?.input?.protocol
        : null;
      const expectedBinding = roleBinding(
        plan,
        role,
        briefDigest,
        digestToxicReviewValue(protocol),
      );
      if (bindingDigest !== expectedBinding) {
        errors.push(`${path}.bindingDigest does not match its role and sources`);
      }
    }
    const attempts = array(
      roleState.attempts,
      `${path}.attempts`,
      errors,
      TOXIC_REVIEW_LIMITS.groupItems,
    ).map((attemptEntry, attemptIndex) => {
      const attemptPath = `${path}.attempts[${attemptIndex}]`;
      const attemptInput = object(attemptEntry, attemptPath, errors);
      unknownKeys(
        attemptInput,
        [
          "attempt",
          "attemptId",
          "error",
          "hostInvocationId",
          "input",
          "inputDigest",
          "outputDigest",
          "result",
          "status",
        ],
        attemptPath,
        errors,
      );
      const attempt = integer(
        attemptInput.attempt,
        `${attemptPath}.attempt`,
        errors,
        { minimum: 1 },
      );
      if (attempt !== attemptIndex + 1) {
        errors.push(`${attemptPath}.attempt must be ${attemptIndex + 1}`);
      }
      const preparedInput = object(
        attemptInput.input,
        `${attemptPath}.input`,
        errors,
      );
      const preparedWithoutDigest = { ...preparedInput };
      delete preparedWithoutDigest.inputDigest;
      const expectedInputDigest = digestToxicReviewValue(preparedWithoutDigest);
      const inputDigest = validDigest(
        attemptInput.inputDigest,
        `${attemptPath}.inputDigest`,
        errors,
      );
      if (
        preparedInput.inputDigest !== inputDigest
        || inputDigest !== expectedInputDigest
      ) {
        errors.push(`${attemptPath}.inputDigest does not match its role input`);
      }
      if (
        preparedInput.version !== TOXIC_REVIEW_ROLE_RUN_VERSION
        || preparedInput.feature !== "toxic-review-role"
        || preparedInput.runId !== plan?.runId
        || preparedInput.runDigest !== runDigest
        || preparedInput.roleId !== roleId
        || preparedInput.bindingDigest !== bindingDigest
        || preparedInput.briefDigest !== briefDigest
        || preparedInput.protocolDigest
          !== digestToxicReviewValue(preparedInput.protocol)
        || preparedInput.attempt !== attempt
        || preparedInput.title !== plan?.title
        || preparedInput.risk !== plan?.risk
        || !sameValue(preparedInput.target, plan?.target)
        || !sameValue(
          preparedInput.snapshot,
          plan && role ? filteredSnapshot(plan.snapshot, role) : null,
        )
        || !sameValue(preparedInput.role, role)
      ) {
        errors.push(`${attemptPath}.input does not match its run binding`);
      }
      const expectedAttemptId = attemptId({
        bindingDigest,
        attempt,
        runId: plan?.runId,
        roleId,
      });
      const preparedAttemptId = text(
        attemptInput.attemptId,
        `${attemptPath}.attemptId`,
        errors,
      );
      if (
        preparedAttemptId !== expectedAttemptId
        || preparedInput.attemptId !== expectedAttemptId
      ) {
        errors.push(`${attemptPath}.attemptId does not match its binding`);
      }
      const status = choice(
        attemptInput.status,
        TOXIC_REVIEW_ROLE_STATUSES,
        `${attemptPath}.status`,
        errors,
      );
      const hostInvocationId = text(
        attemptInput.hostInvocationId,
        `${attemptPath}.hostInvocationId`,
        errors,
        { optional: true },
      );
      if (status === "pending") {
        if (
          hostInvocationId
          || attemptInput.outputDigest
          || attemptInput.result
          || attemptInput.error
        ) {
          errors.push(`${attemptPath} pending attempt cannot have a receipt`);
        }
      } else if (!hostInvocationId) {
        errors.push(`${attemptPath}.hostInvocationId is required after execution`);
      }
      let result;
      let outputDigest;
      let normalizedError;
      if (status === "succeeded") {
        if (attemptInput.error !== undefined) {
          errors.push(`${attemptPath}.error is not allowed for succeeded`);
        }
        try {
          result = validateRoleSuccess(attemptInput.result, preparedInput);
        } catch (error) {
          errors.push(...(error.issues ?? [error.message]));
        }
        outputDigest = validDigest(
          attemptInput.outputDigest,
          `${attemptPath}.outputDigest`,
          errors,
        );
        if (result && outputDigest !== digestToxicReviewValue(result)) {
          errors.push(`${attemptPath}.outputDigest does not match its result`);
        }
      }
      if (["failed", "cancelled"].includes(status)) {
        if (attemptInput.result !== undefined || attemptInput.outputDigest !== undefined) {
          errors.push(`${attemptPath} failed attempt cannot have a result`);
        }
        const errorInput = object(
          attemptInput.error,
          `${attemptPath}.error`,
          errors,
        );
        unknownKeys(
          errorInput,
          ["code", "message", "retryable"],
          `${attemptPath}.error`,
          errors,
        );
        normalizedError = {
          code: text(errorInput.code, `${attemptPath}.error.code`, errors),
          message: text(
            errorInput.message,
            `${attemptPath}.error.message`,
            errors,
          ),
          retryable: boolean(
            errorInput.retryable,
            `${attemptPath}.error.retryable`,
            errors,
          ),
        };
      }
      if (attemptIndex < roleState.attempts.length - 1 && status === "pending") {
        errors.push(`${attemptPath} cannot stay pending before a later attempt`);
      }
      return {
        attempt,
        attemptId: preparedAttemptId,
        inputDigest,
        status,
        input: preparedInput,
        ...(hostInvocationId ? { hostInvocationId } : {}),
        ...(result ? { result, outputDigest } : {}),
        ...(normalizedError ? { error: normalizedError } : {}),
      };
    });
    if (attempts.length === 0) errors.push(`${path}.attempts must not be empty`);
    const status = choice(
      roleState.status,
      TOXIC_REVIEW_ROLE_STATUSES,
      `${path}.status`,
      errors,
    );
    if (attempts.length > 0 && status !== attempts.at(-1).status) {
      errors.push(`${path}.status must match its latest attempt`);
    }
    return { roleId, bindingDigest, status, attempts };
  });
  if (roleStates.length !== knownRoles.size || seenRoles.size !== knownRoles.size) {
    errors.push("run.roleStates must contain every selected role exactly once");
  }
  const expectedStatus = deriveRunStatus(roleStates);
  if (input.status !== expectedStatus) {
    errors.push(`run.status must be ${expectedStatus}`);
  }
  if (errors.length > 0) throw runError(errors);
  return Object.freeze({
    version: plan.version,
    feature: "toxic-review-run",
    runId: plan.runId,
    runDigest,
    briefDigest,
    status: expectedStatus,
    title: plan.title,
    risk: plan.risk,
    target: plan.target,
    snapshot: plan.snapshot,
    selection: plan.selection,
    execution: plan.execution,
    roleStates,
  });
}

function cloneState(state) {
  return structuredClone(state);
}

function pendingRole(state, roleId) {
  const roleState = state.roleStates.find((role) => role.roleId === roleId);
  if (!roleState) throw runError([`unknown selected role: ${roleId}`]);
  const attempt = currentAttempt(roleState);
  if (attempt.status !== "pending") {
    throw runError([`role ${roleId} does not have a pending attempt`]);
  }
  return { attempt, roleState };
}

export function getToxicReviewRoleInput(value, roleId) {
  const state = validateToxicReviewRunState(value);
  return pendingRole(state, roleId).attempt.input;
}

export function completeToxicReviewRole(value, roleResult, {
  hostInvocationId,
} = {}) {
  const state = validateToxicReviewRunState(value);
  const invocation = text(hostInvocationId, "hostInvocationId", []);
  if (!invocation) throw runError(["hostInvocationId is required"]);
  const { attempt, roleState } = pendingRole(state, roleResult?.roleId);
  const result = validateRoleSuccess(roleResult, attempt.input);
  const next = cloneState(state);
  const nextRole = next.roleStates.find(
    (role) => role.roleId === roleState.roleId,
  );
  nextRole.status = "succeeded";
  nextRole.attempts[nextRole.attempts.length - 1] = {
    ...attempt,
    status: "succeeded",
    hostInvocationId: invocation,
    result,
    outputDigest: digestToxicReviewValue(result),
  };
  return validateToxicReviewRunState(withDerivedStatus(next));
}

export function failToxicReviewRole(value, {
  code,
  hostInvocationId,
  message,
  retryable,
  roleId,
  status = "failed",
}) {
  const state = validateToxicReviewRunState(value);
  const errors = [];
  if (!["failed", "cancelled"].includes(status)) {
    errors.push("role failure status must be failed or cancelled");
  }
  const normalized = {
    code: text(code, "roleFailure.code", errors),
    message: text(message, "roleFailure.message", errors),
    retryable: boolean(retryable, "roleFailure.retryable", errors),
    hostInvocationId: text(
      hostInvocationId,
      "roleFailure.hostInvocationId",
      errors,
    ),
  };
  if (errors.length > 0) throw runError(errors);
  const { attempt, roleState } = pendingRole(state, roleId);
  const next = cloneState(state);
  const nextRole = next.roleStates.find(
    (role) => role.roleId === roleState.roleId,
  );
  nextRole.status = status;
  nextRole.attempts[nextRole.attempts.length - 1] = {
    ...attempt,
    status,
    hostInvocationId: normalized.hostInvocationId,
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
    },
  };
  return validateToxicReviewRunState(withDerivedStatus(next));
}

export function retryToxicReviewRole(value, roleId) {
  const state = validateToxicReviewRunState(value);
  const roleState = state.roleStates.find((role) => role.roleId === roleId);
  if (!roleState) throw runError([`unknown selected role: ${roleId}`]);
  const previous = currentAttempt(roleState);
  if (!["failed", "cancelled"].includes(previous.status)) {
    throw runError([`role ${roleId} can be retried only after failure or cancellation`]);
  }
  if (!previous.error.retryable) {
    throw runError([`role ${roleId} failure is not retryable`]);
  }
  const plan = validateToxicReviewRunPlan(planFromState(state));
  const role = plan.selection.roles.find((entry) => entry.id === roleId);
  const attempt = previous.attempt + 1;
  const input = createRoleInput({
    attempt,
    bindingDigest: roleState.bindingDigest,
    briefDigest: state.briefDigest,
    plan,
    protocol: previous.input.protocol,
    role,
    runDigest: state.runDigest,
  });
  const next = cloneState(state);
  const nextRole = next.roleStates.find((entry) => entry.roleId === roleId);
  nextRole.status = "pending";
  nextRole.attempts.push({
    attempt,
    attemptId: input.attemptId,
    inputDigest: input.inputDigest,
    status: "pending",
    input,
  });
  return validateToxicReviewRunState(withDerivedStatus(next));
}

function roleAttemptReceipt(attempt) {
  return Object.freeze({
    attempt: attempt.attempt,
    attemptId: attempt.attemptId,
    inputDigest: attempt.inputDigest,
    status: attempt.status,
    ...(attempt.hostInvocationId
      ? { hostInvocationId: attempt.hostInvocationId }
      : {}),
    ...(attempt.outputDigest ? { outputDigest: attempt.outputDigest } : {}),
    ...(attempt.error
      ? { error: Object.freeze({ ...attempt.error }) }
      : {}),
  });
}

export function finalizeToxicReviewRun(value, decision) {
  const state = validateToxicReviewRunState(value);
  if (state.status !== "ready-for-adjudication") {
    throw runError([
      "every selected role must succeed before Toxic Review can be finalized",
    ]);
  }
  const errors = [];
  const input = object(decision, "decision", errors);
  unknownKeys(
    input,
    ["adjudications", "runId", "summary", "version"],
    "decision",
    errors,
  );
  if (input.version !== TOXIC_REVIEW_ROLE_RUN_VERSION) {
    errors.push(`decision.version must be ${TOXIC_REVIEW_ROLE_RUN_VERSION}`);
  }
  if (input.runId !== state.runId) {
    errors.push("decision.runId does not match the prepared run");
  }
  if (errors.length > 0) throw runError(errors);
  const roleResults = state.roleStates.map((role) => currentAttempt(role).result);
  const causalAnalyses = roleResults
    .map((result) => result.causalAnalysis)
    .filter(Boolean);
  const review = validateToxicReview({
    version: TOXIC_REVIEW_CONTRACT_VERSION,
    title: state.title,
    risk: state.risk,
    target: state.target,
    snapshot: state.snapshot,
    roles: state.selection.roles,
    ...(causalAnalyses.length === 0
      ? {}
      : { causalAnalysis: causalAnalyses[0] }),
    findings: roleResults.flatMap((result) => result.findings),
    adjudications: input.adjudications,
    summary: input.summary,
  });
  return Object.freeze({
    feature: "toxic-review",
    version: TOXIC_REVIEW_ROLE_RUN_VERSION,
    status: "completed",
    execution: Object.freeze({
      runId: state.runId,
      runDigest: state.runDigest,
      briefDigest: state.briefDigest,
      selection: Object.freeze({
        reason: state.selection.reason,
        maximumRoles: state.selection.maximumRoles,
        roleIds: Object.freeze(state.selection.roles.map((role) => role.id)),
      }),
      mode: state.execution.mode,
      independentContexts: state.execution.independentContexts,
      roles: Object.freeze(state.roleStates.map((role) => {
        const latestAttempt = currentAttempt(role);
        return Object.freeze({
          roleId: role.roleId,
          bindingDigest: role.bindingDigest,
          attempt: latestAttempt.attempt,
          attemptId: latestAttempt.attemptId,
          inputDigest: latestAttempt.inputDigest,
          status: latestAttempt.status,
          hostInvocationId: latestAttempt.hostInvocationId,
          outputDigest: latestAttempt.outputDigest,
          attempts: Object.freeze(role.attempts.map(roleAttemptReceipt)),
        });
      })),
      adjudication: Object.freeze({
        decisionDigest: digestToxicReviewValue({
          version: input.version,
          runId: input.runId,
          adjudications: input.adjudications,
          summary: input.summary,
        }),
      }),
    }),
    review,
  });
}
