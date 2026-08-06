// Generated from features/toxic-review/index.mjs. Do not edit.
import { fileURLToPath } from "node:url";

import {
  createWritingStandard,
  loadWritingStandard,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import {
  TOXIC_REVIEW_CONTRACT_VERSION,
  TOXIC_REVIEW_LIMITS,
  TOXIC_REVIEW_RISKS,
  TOXIC_REVIEW_STAGES,
  TOXIC_REVIEW_TARGETS,
} from "./constants.mjs";
import {
  causalCompletenessEvaluationRecordLimits,
  createCausalCompletenessEvaluationPlan,
  createCausalCompletenessEvaluationRecordTemplate,
  getCausalCompletenessEvaluationOracle,
  prepareCausalCompletenessEvaluationRun,
  validateCausalCompletenessEvaluationRecord,
  validateCausalCompletenessEvaluationRecordSet,
} from "./causal-evaluation.mjs";
import { validateToxicReview } from "./validate.mjs";
import {
  loadToxicReviewModelAdapter,
  requireToxicReviewModelAdapter,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE,
} from "./model-adapter.mjs";
import {
  completeToxicReviewRole,
  failToxicReviewRole,
  finalizeToxicReviewRun,
  getToxicReviewRoleInput,
  prepareToxicReviewRun,
  retryToxicReviewRole,
  validateToxicReviewRunPlan,
  validateToxicReviewRunState,
} from "./role-run.mjs";

export {
  causalCompletenessEvaluationCases,
  causalCompletenessEvaluationProtocol,
  causalCompletenessEvaluationRecordLimits,
  causalCompletenessRubric,
  createCausalCompletenessEvaluationPlan,
  createCausalCompletenessEvaluationRecordTemplate,
  digestCausalEvaluationValue,
  getCausalCompletenessEvaluationOracle,
  prepareCausalCompletenessEvaluationRun,
  validateCausalCompletenessEvaluationRecord,
  validateCausalCompletenessEvaluationRecordSet,
} from "./causal-evaluation.mjs";

export {
  completeToxicReviewRole,
  digestToxicReviewValue,
  failToxicReviewRole,
  finalizeToxicReviewRun,
  getToxicReviewRoleInput,
  prepareToxicReviewRun,
  retryToxicReviewRole,
  TOXIC_REVIEW_EXECUTION_MODES,
  TOXIC_REVIEW_ROLE_RUN_VERSION,
  TOXIC_REVIEW_ROLE_STATUSES,
  validateToxicReviewRunPlan,
  validateToxicReviewRunState,
} from "./role-run.mjs";

export {
  loadToxicReviewModelAdapter,
  requireToxicReviewModelAdapter,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE,
  validateToxicReviewModelAdapter,
} from "./model-adapter.mjs";

const causalCompletenessDecisionExamples = Object.freeze([
  Object.freeze({
    id: "repeated-boundary-dominates",
    situation:
      "One local function is slow, but captured end-to-end measurements show repeated state loading at a process boundary dominates the critical path.",
    expectedDecision:
      "Prefer the supported boundary-level candidate, state what would disconfirm it, and do not prioritize the off-path local function.",
  }),
  Object.freeze({
    id: "local-stage-dominates",
    situation:
      "The captured flow crosses each boundary once, while one measured local stage dominates the critical path and scales with the observed outcome.",
    expectedDecision:
      "Prefer the supported local candidate and do not invent a structural alternative merely to create competition.",
  }),
  Object.freeze({
    id: "missing-discriminating-evidence",
    situation:
      "The work product claims a cause, but the captured sources contain no baseline or observation that distinguishes it from another material explanation.",
    expectedDecision:
      "Treat the missing evidence as material, keep causation inconclusive, and defer the finding with the lowest-cost safe next check.",
  }),
]);

const causalCompleteness = Object.freeze({
  activation:
    "Select this perspective only when a named work product makes or relies on a material causal claim. Do not select it only because the target kind is incident.",
  role: Object.freeze([
    "Assign this sequence to one selected role and set that role's method to causal-completeness. Other roles keep independent targets, evidence, exclusions, and claims.",
    "Bind the claimed outcome and any captured baseline before reviewing a cause. Treat a missing baseline as an evidence gap instead of inventing one.",
    "Map only the end-to-end flow, state owners, I/O, and process boundaries relevant to the claimed outcome before judging a local explanation.",
    "Compare only materially distinct candidates supported by captured sources. A candidate is a still-plausible explanation for a material share of the outcome at the highest phase or boundary level the evidence supports. Zero or one supported candidate is valid; never manufacture an alternative.",
    "Remove a proposed cause from the candidate set when a captured upper bound or contrary observation disconfirms material contribution. Keep its rejection in the flow or finding instead of counting it as a live candidate.",
    "A long serial phase on the captured critical path can remain a phase-level candidate even when its internal implementation cause is unresolved. Keep independently bounded, non-overlapping material phases as distinct candidates; do not merge them only because one unresolved cross-cutting aggregate spans them. Do not reduce the candidate count to zero only because the source cannot split work inside a phase.",
    "For each candidate, record its evidence, assumptions, and one prediction that could disconfirm it.",
    "Choose the next check from the candidate count: with zero candidates, name the minimum observation needed to form one; with one, name the lowest-cost safe check that could disconfirm it; with two or more, name the lowest-cost safe discriminator.",
    "Do not execute a new check or mix later evidence into this run. If no safe check exists, state that limit instead of inventing one.",
  ]),
  record: Object.freeze([
    "When the causal-completeness method is selected, include one top-level causalAnalysis object for that role. Validation rejects a selected causal role without this record.",
    "Record the outcome, captured baseline or its absence, claim assessment, cause level, candidate count, mapped flow, candidates, and next check defined by schemaPath.",
    "Map every material observed phase or boundary before selecting candidates. Link each flow item to one or more candidates, or give a concrete exclusion reason.",
    "For every candidate, record its structural, local, or mixed level; location; statement; evidence; assumptions; disconfirming prediction; and source IDs.",
    "Treat an inseparable aggregate as one uncertainty boundary. Do not promote its named subcomponents to separate candidates unless a captured observation distinguishes them. When separately observed material phases partition that aggregate, link the aggregate flow item to those phase candidates instead of replacing them with one aggregate candidate.",
    "Do not keep a disconfirmed claimed cause as a candidate merely to document it. Do not exclude a material serial phase merely because its internal mechanism remains uncertain.",
    "candidateCount must equal the candidates array. Every candidate must be linked from the mapped flow, and nextCheck must reference every candidate.",
  ]),
  outcome: Object.freeze([
    "Set finding confidence from the evidence for the work product's defect, not from confidence in a root cause. An unsupported causal claim can be an established finding even when causation remains inconclusive.",
    "Defer a finding with a concrete nextStep only when new evidence or follow-up is required before the adjudication can close.",
    "For an inconclusive causal review, say so in the summary and name the missing evidence in scopeLimits.",
    "noMaterialIssueFound describes the checked work product, not whether Hope disproved a root cause. Do not manufacture a finding when the work product already represents uncertainty honestly.",
  ]),
  stopping: Object.freeze([
    "With zero candidates, stop after naming the minimum evidence needed to form one.",
    "With one candidate, stop after recording its disconfirming prediction and lowest-cost safe check.",
    "With two or more candidates, stop after each has a distinguishing prediction and the lowest-cost safe discriminator is known.",
    "When no safe check exists, state that limit and stop.",
    "Exclude branches outside the captured outcome and source set instead of expanding into an unbounded diagnosis.",
    "Changed evidence starts a new snapshot and review run.",
  ]),
  decisionExamples: causalCompletenessDecisionExamples,
});

export async function createToxicReviewBrief({
  risk = "medium",
  stage = "implementation",
  target = "other",
} = {}, dependencies = {}) {
  if (!TOXIC_REVIEW_RISKS.includes(risk)) {
    throw new TypeError(`Unknown Hope toxic review risk: ${risk}`);
  }
  if (!TOXIC_REVIEW_STAGES.includes(stage)) {
    throw new TypeError(`Unknown Hope toxic review stage: ${stage}`);
  }
  if (!TOXIC_REVIEW_TARGETS.includes(target)) {
    throw new TypeError(`Unknown Hope toxic review target: ${target}`);
  }
  const writingStandard = await (
    dependencies.createWritingStandard ?? createWritingStandard
  )({
    loadStandard: dependencies.loadWritingStandard ?? loadWritingStandard,
  });
  return Object.freeze({
    feature: "toxic-review",
    version: TOXIC_REVIEW_CONTRACT_VERSION,
    risk,
    stage,
    target,
    schemaPath: fileURLToPath(
      new URL("./review-v1.schema.json", import.meta.url),
    ),
    roleRun: Object.freeze({
      planSchemaPath: fileURLToPath(
        new URL("./run-plan-v1.schema.json", import.meta.url),
      ),
      roleResultSchemaPath: fileURLToPath(
        new URL("./role-result-v1.schema.json", import.meta.url),
      ),
      adjudicationSchemaPath: fileURLToPath(
        new URL("./adjudication-v1.schema.json", import.meta.url),
      ),
      contract: Object.freeze([
        "The host model chooses the smallest useful role set. The core validates, normalizes, and binds that choice to the target and snapshot.",
        "Record why the roles are needed and the person's maximum role count before execution.",
        "Every role keeps one stable binding digest across retries. Every attempt gets a new attempt ID and input digest.",
        "Do not finalize until every selected role has one valid successful completion record.",
      ]),
      reviewer: Object.freeze([
        "Review exactly one prepared role input. Do not widen its target, sources, exclusions, or claims.",
        "Return one version 1 role result with the exact runId, roleId, attemptId, bindingDigest, and inputDigest from the prepared input.",
        "Return findings and the conditional causalAnalysis only. Do not adjudicate, summarize the whole review, edit the target, or write the final response.",
        "Use a fresh context for every role in a multi-role run. Do not read another role's input or output.",
      ]),
      completion: Object.freeze([
        "The trusted host records succeeded, failed, or cancelled for every attempt and includes its invocation identity.",
        "A failed or cancelled role may be retried only with the same target, role, sources, and brief binding.",
        "Never turn an unstarted, failed, cancelled, stale, or mismatched role into an empty successful finding set.",
        "The completed execution record keeps every attempt record in order, including failure or cancellation details and the successful output digest.",
      ]),
      independence: Object.freeze([
        "One role uses single mode.",
        "Multiple roles require parallel or isolated-sequential mode and a fresh context for every role.",
        "Sequential scheduling in one shared context is not independent execution. Reduce to one role or stop when fresh contexts are unavailable.",
      ]),
      harnessAdapter: Object.freeze([
        "A harness adapter exports capabilities plus plan, review, and adjudicate functions.",
        "Set HOPE_TOXIC_REVIEW_ADAPTER_MODULE only to a trusted local module. The module runs with the harness process permissions.",
        "The adapter must declare independentContexts and parallel capabilities. Hope rejects a plan that the adapter cannot execute honestly.",
      ]),
    }),
    snapshot: Object.freeze([
      "Capture only sources needed to answer the selected claims.",
      "Use a full Git object ID or a `sha256:` content digest for Git. Use a `sha256:` content digest for every other source.",
      "Do not mix later content into the snapshot. Changed evidence starts a new run and result.",
    ]),
    roleSelection: Object.freeze([
      "Select one to six roles from the target, stage, evidence, and material risk. Do not use a fixed panel.",
      "Give every role an explicit target, focus risks, evidence source IDs, exclusions, claims to test, and expected output.",
      "Give each independent reviewer only the smallest source bundle needed for its claims.",
    ]),
    findings: Object.freeze([
      "A role may cite only its assigned evidence source IDs.",
      "Each finding records a concrete issue, practical impact, proposed action, priority, confidence, and source IDs.",
      "A review with no findings is valid. Do not manufacture criticism or turn uncertainty into an established defect.",
    ]),
    adjudication: Object.freeze([
      "Judge every finding as accepted, partially-accepted, rejected, deferred, or duplicate.",
      "Use evidence, impact, current scope, feasibility, and duplication. Do not count reviewer votes.",
      "For accepted and partially accepted findings, record the final action, impact, priority, confidence, and source IDs. Keep the role's original proposal only in the audit record.",
      "A deferred finding needs a next step and remains unresolved. It cannot set noMaterialIssueFound to true.",
      "A duplicate points to its owning finding. Rejected findings stay in the audit but not in actionable work.",
    ]),
    resultPreparation: Object.freeze([
      "Write one version 1 result that follows schemaPath to a private temporary JSON file outside the repository with restricted permissions.",
      "If a role uses method causal-completeness, include the schema's causalAnalysis record before validation.",
      "Do not put elapsed time or token claims in reviewer-authored JSON. A trusted host may supply observed metrics separately.",
      "Validate the result, fix only clear contract errors, and remove the private JSON after validation or cancellation.",
    ]),
    causalCompleteness,
    finalVoice:
      "Present the adjudicated result in one strict, competent voice. Lead with the highest-priority accepted issue, keep deferred risk visible, or say no material issue was found in the checked scope. Never attack a person.",
    stopping: Object.freeze([
      "Version 1 performs one round per run.",
      "Start a new run with a new snapshot only when changed evidence or an accepted high-impact finding creates a different material question.",
      "Stop when another run would repeat evidence or only increase the criticism count.",
    ]),
    limits: TOXIC_REVIEW_LIMITS,
    writingStandard,
  });
}

export async function validateToxicReviewFile(inputPath, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review",
    maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes,
  });
  return (dependencies.validate ?? validateToxicReview)(input.value, {
    inputFileBytes: input.fileBytes,
    observedMetrics: dependencies.observedMetrics,
  });
}

async function readRoleRunFile(inputPath, label, dependencies = {}, {
  maximumBytes = TOXIC_REVIEW_LIMITS.runStateBytes,
} = {}) {
  return await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label,
    maximumBytes,
  });
}

export async function prepareToxicReviewRunFile(inputPath, dependencies = {}) {
  const input = await readRoleRunFile(
    inputPath,
    "Hope toxic review role-run plan",
    dependencies,
    { maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes },
  );
  const plan = validateToxicReviewRunPlan(input.value);
  const brief = await createToxicReviewBrief({
    risk: plan.risk,
    stage: plan.target.stage,
    target: plan.target.kind,
  }, dependencies);
  return prepareToxicReviewRun(plan, { brief });
}

export async function getToxicReviewRoleInputFile(
  statePath,
  roleId,
  dependencies = {},
) {
  const state = await readRoleRunFile(
    statePath,
    "Hope toxic review role-run state",
    dependencies,
  );
  return getToxicReviewRoleInput(state.value, roleId);
}

export async function completeToxicReviewRoleFile({
  hostInvocationId,
  resultPath,
  statePath,
}, dependencies = {}) {
  const [state, result] = await Promise.all([
    readRoleRunFile(
      statePath,
      "Hope toxic review role-run state",
      dependencies,
    ),
    readRoleRunFile(
      resultPath,
      "Hope toxic review role result",
      dependencies,
      { maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes },
    ),
  ]);
  return completeToxicReviewRole(state.value, result.value, {
    hostInvocationId,
  });
}

export async function failToxicReviewRoleFile(options, dependencies = {}) {
  const state = await readRoleRunFile(
    options.statePath,
    "Hope toxic review role-run state",
    dependencies,
  );
  return failToxicReviewRole(state.value, options);
}

export async function retryToxicReviewRoleFile(
  statePath,
  roleId,
  dependencies = {},
) {
  const state = await readRoleRunFile(
    statePath,
    "Hope toxic review role-run state",
    dependencies,
  );
  return retryToxicReviewRole(state.value, roleId);
}

export async function finalizeToxicReviewRunFile({
  decisionPath,
  statePath,
}, dependencies = {}) {
  const [state, decision] = await Promise.all([
    readRoleRunFile(
      statePath,
      "Hope toxic review role-run state",
      dependencies,
    ),
    readRoleRunFile(
      decisionPath,
      "Hope toxic review adjudication",
      dependencies,
      { maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes },
    ),
  ]);
  return finalizeToxicReviewRun(state.value, decision.value);
}

async function activeCausalEvaluationBrief(dependencies) {
  return await createToxicReviewBrief(
    { risk: "high", stage: "completed", target: "document" },
    dependencies,
  );
}

export async function createCausalCompletenessEvaluationPlanForActiveBrief(
  dependencies = {},
) {
  const brief = await activeCausalEvaluationBrief(dependencies);
  return createCausalCompletenessEvaluationPlan({ brief });
}

export async function createCausalCompletenessEvaluationRun(
  options,
  dependencies = {},
) {
  const brief = await activeCausalEvaluationBrief(dependencies);
  return prepareCausalCompletenessEvaluationRun({ ...options, brief });
}

export async function createCausalCompletenessEvaluationRecordTemplateFromFile(
  options,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(
    options.inputPath,
    {
      label: "Hope toxic review causal evaluation output",
      maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes,
    },
  );
  const validatedReview = (dependencies.validate ?? validateToxicReview)(
    input.value,
    { inputFileBytes: input.fileBytes },
  );
  const brief = await activeCausalEvaluationBrief(dependencies);
  return createCausalCompletenessEvaluationRecordTemplate({
    ...options,
    brief,
    validatedReview,
  });
}

export async function validateCausalCompletenessEvaluationRecordFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review causal evaluation record",
    maximumBytes: causalCompletenessEvaluationRecordLimits.bytes,
  });
  const brief = await activeCausalEvaluationBrief(dependencies);
  return validateCausalCompletenessEvaluationRecord(input.value, { brief });
}

export async function validateCausalCompletenessEvaluationRecordSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review causal evaluation record set",
    maximumBytes: 2 * 1024 * 1024,
  });
  const brief = await activeCausalEvaluationBrief(dependencies);
  return validateCausalCompletenessEvaluationRecordSet(input.value, { brief });
}

function adapterCapabilityError(message) {
  const error = new Error(`Hope toxic review cannot execute this plan: ${message}`);
  error.code = "HOPE_TOXIC_REVIEW_ADAPTER_CAPABILITY_MISMATCH";
  return error;
}

async function resolveModelAdapter(dependencies) {
  if (dependencies.modelAdapter) {
    return requireToxicReviewModelAdapter(dependencies.modelAdapter);
  }
  const loaded = await (dependencies.loadModelAdapter
    ?? loadToxicReviewModelAdapter)({
    cwd: dependencies.cwd,
    environment: dependencies.environment,
    importModule: dependencies.importModule,
  });
  return requireToxicReviewModelAdapter(loaded);
}

async function reviewPreparedRole(adapter, roleInput, run) {
  try {
    const response = await adapter.review(Object.freeze({
      roleInput,
      run: Object.freeze({
        runId: run.runId,
        runDigest: run.runDigest,
        mode: run.execution.mode,
      }),
    }));
    return Object.freeze({
      ok: true,
      roleId: roleInput.roleId,
      hostInvocationId: response?.invocationId,
      result: response?.result ?? response,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      roleId: roleInput.roleId,
      hostInvocationId:
        error.hostInvocationId ?? `adapter-error-${roleInput.attemptId}`,
      error,
    });
  }
}

export async function runToxicReview(arguments_ = [], dependencies = {}) {
  const adapter = await resolveModelAdapter(dependencies);
  const planningBrief = await createToxicReviewBrief({}, dependencies);
  const proposedPlan = await adapter.plan(Object.freeze({
    request: Object.freeze([...arguments_]),
    brief: planningBrief,
    writingPass: dependencies.writingPass,
  }));
  const plan = validateToxicReviewRunPlan(proposedPlan);
  const exactBrief = await createToxicReviewBrief({
    risk: plan.risk,
    stage: plan.target.stage,
    target: plan.target.kind,
  }, dependencies);
  let run = prepareToxicReviewRun(plan, { brief: exactBrief });
  const roleCount = run.selection.roles.length;
  if (roleCount > 1 && !adapter.capabilities.independentContexts) {
    throw adapterCapabilityError(
      "multiple roles require an adapter that creates a fresh context for every role",
    );
  }
  if (run.execution.mode === "parallel" && !adapter.capabilities.parallel) {
    throw adapterCapabilityError(
      "parallel mode requires an adapter that supports parallel calls",
    );
  }
  const roleInputs = run.roleStates.map((role) =>
    getToxicReviewRoleInput(run, role.roleId));
  let executions;
  if (run.execution.mode === "parallel") {
    executions = await Promise.all(
      roleInputs.map((roleInput) =>
        reviewPreparedRole(adapter, roleInput, run)),
    );
  } else {
    executions = [];
    for (const roleInput of roleInputs) {
      executions.push(await reviewPreparedRole(adapter, roleInput, run));
    }
  }
  for (const execution of executions) {
    if (execution.ok) {
      run = completeToxicReviewRole(run, execution.result, {
        hostInvocationId: execution.hostInvocationId,
      });
    } else {
      run = failToxicReviewRole(run, {
        roleId: execution.roleId,
        status: execution.error.cancelled ? "cancelled" : "failed",
        code: execution.error.code ?? "MODEL_ADAPTER_ERROR",
        message: execution.error.message ?? "The model adapter failed.",
        retryable: execution.error.retryable === true,
        hostInvocationId: execution.hostInvocationId,
      });
    }
  }
  if (run.status !== "ready-for-adjudication") {
    return Object.freeze({
      feature: "toxic-review",
      version: 1,
      status: "incomplete",
      run,
    });
  }
  const adjudicated = await adapter.adjudicate(Object.freeze({
    run,
    roleResults: Object.freeze(run.roleStates.map(
      (role) => role.attempts.at(-1).result,
    )),
  }));
  return finalizeToxicReviewRun(run, adjudicated?.decision ?? adjudicated);
}
