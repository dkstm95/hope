import assert from "node:assert/strict";
import test from "node:test";

import {
  causalCompletenessEvaluationCases,
  causalCompletenessEvaluationProtocol,
  causalCompletenessEvaluationReceiptLimits,
  causalCompletenessRubric,
  createCausalCompletenessEvaluationPlan,
  createCausalCompletenessEvaluationReceiptTemplate,
  digestCausalEvaluationValue,
  getCausalCompletenessEvaluationOracle,
  prepareCausalCompletenessEvaluationRun,
  validateCausalCompletenessEvaluationReceipt,
  validateCausalCompletenessEvaluationReceiptSet,
} from "../features/toxic-review/causal-evaluation.mjs";
import {
  createCausalCompletenessEvaluationReceiptTemplateFromFile,
  createToxicReviewBrief,
} from "../features/toxic-review/index.mjs";
import { validateToxicReview } from "../features/toxic-review/validate.mjs";
import {
  makeCausalToxicReview,
  makeToxicReview,
} from "../test-support/toxic-review-fixture.mjs";

const evaluatedAt = "2026-08-02T00:00:00.000Z";

async function makeBrief() {
  return await createToxicReviewBrief(
    { risk: "high", stage: "completed", target: "document" },
    { loadWritingStandard: async () => "shared standard\n" },
  );
}

function findCase(caseId) {
  return causalCompletenessEvaluationCases.find(
    (evaluationCase) => evaluationCase.id === caseId,
  );
}

function makeBoundReview(prepared, { noMaterialIssueFound = false } = {}) {
  const sourceIds = prepared.hostInput.reviewBinding.sources.map(
    (source) => source.id,
  );
  const base = makeToxicReview();
  const common = {
    ...base,
    target: structuredClone(prepared.hostInput.reviewBinding.target),
    snapshot: {
      capturedAt: evaluatedAt,
      sources: structuredClone(prepared.hostInput.reviewBinding.sources),
    },
    roles: [
      {
        id: "role-1",
        name: "Causal evidence reviewer",
        target: "The named work product and its captured causal claim.",
        focusRisks: ["A local explanation may not match the measured outcome."],
        evidenceSourceIds: [...sourceIds],
        excludedAreas: ["Uncaptured implementation behavior."],
        claimsToTest: ["The work product stays within the captured evidence."],
        expectedOutput: "One evidence-linked causal-completeness result.",
      },
    ],
  };
  if (noMaterialIssueFound) {
    return validateToxicReview({
      ...common,
      findings: [],
      adjudications: [],
      summary: {
        assessment: "The work product keeps its claim within the measured scope.",
        biggestRisk: "A reader could still ignore the stated scope limit.",
        nextMove: "Preserve the existing scope statement and captured baseline.",
        noMaterialIssueFound: true,
        scopeLimits: ["Only the synthetic captured sources were reviewed."],
      },
    });
  }
  const findings = base.findings.map((finding) => ({
    ...finding,
    roleId: "role-1",
    sourceIds: [...sourceIds],
  }));
  const adjudications = base.adjudications.map((adjudication) => ({
    ...adjudication,
    sourceIds: [...sourceIds],
  }));
  return validateToxicReview({
    ...common,
    findings,
    adjudications,
    summary: {
      assessment: "The work product does not bind its causal claim to the measured outcome.",
      biggestRisk: "A local improvement may be mistaken for an end-to-end cause.",
      nextMove: "Capture the lowest-cost observation that separates the supported candidates.",
      noMaterialIssueFound: false,
      scopeLimits: ["Only the synthetic captured sources were reviewed."],
    },
  });
}

function makeBoundCausalReview(prepared) {
  const input = makeCausalToxicReview();
  const sourceIds = prepared.hostInput.reviewBinding.sources.map(
    (source) => source.id,
  );
  input.target = structuredClone(prepared.hostInput.reviewBinding.target);
  input.snapshot = {
    capturedAt: evaluatedAt,
    sources: structuredClone(prepared.hostInput.reviewBinding.sources),
  };
  input.roles[0].evidenceSourceIds = [...sourceIds];
  for (const flowItem of input.causalAnalysis.flow) {
    flowItem.sourceIds = [...sourceIds];
  }
  for (const candidate of input.causalAnalysis.candidates) {
    candidate.sourceIds = [...sourceIds];
  }
  for (const finding of input.findings) {
    finding.sourceIds = [...sourceIds];
  }
  for (const adjudication of input.adjudications) {
    adjudication.sourceIds = [...sourceIds];
  }
  return validateToxicReview(input);
}

function rubricResults(review) {
  const fields = [
    ["/summary/assessment", review.summary.assessment],
    ["/summary/biggestRisk", review.summary.biggestRisk],
    ["/summary/nextMove", review.summary.nextMove],
    ["/summary/scopeLimits/0", review.summary.scopeLimits[0]],
    ["/roles/0/target", review.roles[0].target],
    ["/roles/0/focusRisks/0", review.roles[0].focusRisks[0]],
    ["/roles/0/claimsToTest/0", review.roles[0].claimsToTest[0]],
    ["/roles/0/expectedOutput", review.roles[0].expectedOutput],
  ];
  return causalCompletenessRubric.map((criterion, index) => ({
    criterionId: criterion.id,
    passed: true,
    rationale: `Criterion ${criterion.id} is supported by its cited decoded field.`,
    evidence: [
      {
        pointer: fields[index][0],
        excerpt: fields[index][1],
      },
    ],
  }));
}

function makeReceipt({
  brief,
  caseId = "repeated-boundary-conformance",
  variant = "full",
  run = 1,
  invocationId = `invocation-${caseId}-${variant}-${run}`,
}) {
  const prepared = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId,
    variant,
    run,
  });
  const oracle = findCase(caseId).oracle;
  const review = makeBoundReview(prepared, {
    noMaterialIssueFound: oracle.expectedNoMaterialIssueFound,
  });
  return {
    receiptVersion: 1,
    caseId,
    suite: prepared.suite,
    variant,
    run,
    configuration: {
      model: "test-model",
      effort: "test-effort",
      briefVersion: String(prepared.brief.version),
      briefDigest: prepared.briefDigest,
    },
    invocation: {
      id: invocationId,
      inputDigest: prepared.inputDigest,
      outputDigest: digestCausalEvaluationValue(review),
    },
    validatedReview: review,
    assessment: {
      claimAssessment: oracle.expectedClaimAssessment,
      causeLevel: oracle.expectedCauseLevels[0],
      candidateCount: oracle.expectedCandidateCounts[0],
      noMaterialIssueFound: oracle.expectedNoMaterialIssueFound,
    },
    rubricResults: rubricResults(review),
    evaluator: "test evaluator",
    evaluatedAt,
    sanitized: true,
  };
}

test("causal evaluation separates conformance, ablation, and safety", () => {
  assert.deepEqual(
    Object.keys(causalCompletenessEvaluationProtocol.suites),
    ["conformance", "ablation", "safety"],
  );
  assert.deepEqual(
    causalCompletenessEvaluationProtocol.suites.ablation.variants,
    ["legacy", "rules-only", "full"],
  );
  assert.equal(
    causalCompletenessEvaluationProtocol.suites.ablation.runsPerVariant,
    2,
  );
  assert.deepEqual(
    causalCompletenessEvaluationCases.map((evaluationCase) => evaluationCase.suite),
    ["conformance", "conformance", "ablation", "safety", "safety"],
  );
  assert.deepEqual(
    new Set(causalCompletenessEvaluationCases.map(
      (evaluationCase) => evaluationCase.oracle.expectedClaimAssessment,
    )),
    new Set(["supported", "unsupported"]),
  );
  assert.deepEqual(
    new Set(causalCompletenessEvaluationCases.map(
      (evaluationCase) => evaluationCase.oracle.expectedCandidateCounts,
    ).flat()),
    new Set([0, 1, 2, 3]),
  );
});

test("causal evaluation cases stay blinded and cover every rubric criterion", () => {
  const rubricIds = new Set(causalCompletenessRubric.map((criterion) => criterion.id));
  assert.equal(rubricIds.size, causalCompletenessRubric.length);
  for (const evaluationCase of causalCompletenessEvaluationCases) {
    const blindedInput = JSON.stringify(evaluationCase.target).toLowerCase();
    for (const forbidden of evaluationCase.oracle.forbiddenInputTerms) {
      assert.equal(blindedInput.includes(forbidden.toLowerCase()), false);
    }
    assert.deepEqual(
      [...evaluationCase.oracle.requiredRubricIds].sort(),
      [...rubricIds].sort(),
    );
  }
  const ablation = findCase("critical-path-ablation");
  assert.equal(ablation.target.sources.length, 2);
  assert.match(ablation.target.sources[0].text, /29 evidence pages/u);
  assert.match(ablation.target.sources[1].text, /must not be added/u);
  assert.deepEqual(ablation.oracle.expectedCauseLevels, ["structural", "mixed"]);
  assert.deepEqual(ablation.oracle.expectedCandidateCounts, [2, 3]);
});

test("evaluation preparation binds variants and synthetic sources", async () => {
  const brief = await makeBrief();
  const plan = createCausalCompletenessEvaluationPlan({ brief });
  assert.equal(plan.totalRuns, 12);
  assert.equal(plan.runs.length, 12);
  assert.equal(Object.hasOwn(plan.runs[0], "oracle"), false);
  const legacy = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: "critical-path-ablation",
    variant: "legacy",
    run: 1,
  });
  const rulesOnly = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: "critical-path-ablation",
    variant: "rules-only",
    run: 1,
  });
  const full = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: "critical-path-ablation",
    variant: "full",
    run: 1,
  });
  assert.equal(legacy.brief.causalCompleteness, undefined);
  assert.match(legacy.brief.evaluationControl[0], /legacy review behavior/u);
  assert.match(legacy.brief.evaluationControl[0], /Do not select role method/u);
  assert.equal(rulesOnly.brief.evaluationControl, undefined);
  assert.deepEqual(rulesOnly.brief.causalCompleteness.decisionExamples, []);
  assert.equal(full.brief.causalCompleteness.decisionExamples.length, 3);
  assert.notEqual(legacy.briefDigest, rulesOnly.briefDigest);
  assert.notEqual(rulesOnly.briefDigest, full.briefDigest);
  assert.equal(full.hostInput.reviewBinding.sources.length, 2);
  assert.match(
    full.hostInput.reviewBinding.sources[0].digest,
    /^sha256:[a-f0-9]{64}$/u,
  );
  assert.equal(Object.hasOwn(full, "oracle"), false);
  const oracle = getCausalCompletenessEvaluationOracle(
    "critical-path-ablation",
  );
  assert.deepEqual(oracle.oracle.expectedCandidateCounts, [2, 3]);
  assert.equal(oracle.rubric.length, causalCompletenessRubric.length);
  assert.throws(
    () => prepareCausalCompletenessEvaluationRun({
      brief,
      caseId: "repeated-boundary-conformance",
      variant: "legacy",
      run: 1,
    }),
    /does not support variant legacy/u,
  );
});

test("evaluation receipts bind the case, invocation, output, and decoded evidence", async () => {
  const brief = await makeBrief();
  const receipt = makeReceipt({ brief });
  const prepared = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: receipt.caseId,
    variant: receipt.variant,
    run: receipt.run,
  });
  const template = createCausalCompletenessEvaluationReceiptTemplate({
    brief,
    caseId: receipt.caseId,
    variant: receipt.variant,
    run: receipt.run,
    model: receipt.configuration.model,
    effort: receipt.configuration.effort,
    invocationId: receipt.invocation.id,
    validatedReview: receipt.validatedReview,
  });
  assert.equal(template.receipt.invocation.inputDigest, prepared.inputDigest);
  assert.equal(
    template.receipt.invocation.outputDigest,
    digestCausalEvaluationValue(receipt.validatedReview),
  );
  assert.equal(template.receipt.assessment, null);
  assert.equal(template.receipt.rubricResults[0].passed, null);
  const {
    observedMetrics: _observedMetrics,
    result: _result,
    resources: _resources,
    ...reviewInput
  } = receipt.validatedReview;
  const fromFile = await createCausalCompletenessEvaluationReceiptTemplateFromFile(
    {
      caseId: receipt.caseId,
      variant: receipt.variant,
      run: receipt.run,
      model: receipt.configuration.model,
      effort: receipt.configuration.effort,
      invocationId: receipt.invocation.id,
      inputPath: "synthetic-review.json",
    },
    {
      loadWritingStandard: async () => "shared standard\n",
      readInput: async () => ({ value: reviewInput, fileBytes: 777 }),
    },
  );
  assert.equal(fromFile.receipt.validatedReview.resources.inputFileBytes, 777);
  const validated = validateCausalCompletenessEvaluationReceipt(receipt, { brief });
  assert.equal(validated.evaluation.runPassed, true);
  assert.equal(validated.evaluation.oracleMatched, true);
  assert.ok(
    Buffer.byteLength(JSON.stringify(receipt), "utf8")
      < causalCompletenessEvaluationReceiptLimits.bytes,
  );

  const wrongInput = structuredClone(receipt);
  wrongInput.invocation.inputDigest = `sha256:${"a".repeat(64)}`;
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(wrongInput, { brief }),
    /inputDigest does not match/u,
  );

  const unrelated = structuredClone(receipt);
  unrelated.validatedReview = validateToxicReview(makeToxicReview());
  unrelated.invocation.outputDigest = digestCausalEvaluationValue(
    unrelated.validatedReview,
  );
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(unrelated, { brief }),
    /target does not match the prepared case/u,
  );

  const wrongOutput = structuredClone(receipt);
  wrongOutput.invocation.outputDigest = `sha256:${"b".repeat(64)}`;
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(wrongOutput, { brief }),
    /outputDigest does not match/u,
  );

  const serializedEvidence = structuredClone(receipt);
  serializedEvidence.rubricResults[0].evidence[0] = {
    pointer: "/summary/noMaterialIssueFound",
    excerpt: "noMaterialIssueFound",
  };
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(
      serializedEvidence,
      { brief },
    ),
    /pointer must resolve to text/u,
  );

  const duplicateRationale = structuredClone(receipt);
  duplicateRationale.rubricResults[1].rationale =
    duplicateRationale.rubricResults[0].rationale;
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(
      duplicateRationale,
      { brief },
    ),
    /rationale must explain this criterion/u,
  );
});

test("evaluation receipts bind a structured causal assessment", async () => {
  const brief = await makeBrief();
  const prepared = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: "critical-path-ablation",
    variant: "full",
    run: 1,
  });
  const review = makeBoundCausalReview(prepared);
  const template = createCausalCompletenessEvaluationReceiptTemplate({
    brief,
    caseId: prepared.caseId,
    variant: prepared.variant,
    run: prepared.run,
    model: "test-model",
    effort: "test-effort",
    invocationId: "structured-causal-run",
    validatedReview: review,
  });
  assert.deepEqual(template.receipt.assessment, {
    claimAssessment: "unsupported",
    causeLevel: "mixed",
    candidateCount: 2,
    noMaterialIssueFound: false,
  });

  const receipt = structuredClone(template.receipt);
  receipt.rubricResults = rubricResults(review);
  receipt.evaluator = "test evaluator";
  receipt.evaluatedAt = evaluatedAt;
  const validated = validateCausalCompletenessEvaluationReceipt(
    receipt,
    { brief },
  );
  assert.equal(validated.evaluation.oracleMatched, true);
  assert.equal(validated.evaluation.runPassed, true);

  const mismatched = structuredClone(receipt);
  mismatched.assessment.candidateCount = 1;
  assert.throws(
    () => validateCausalCompletenessEvaluationReceipt(mismatched, { brief }),
    /assessment must match validatedReview\.causalAnalysis/u,
  );
});

test("valid failed runs remain auditable instead of disappearing", async () => {
  const brief = await makeBrief();
  const receipt = makeReceipt({ brief });
  receipt.rubricResults[0] = {
    criterionId: receipt.rubricResults[0].criterionId,
    passed: false,
    rationale: "The result did not identify a captured baseline.",
    evidence: [],
  };
  const validated = validateCausalCompletenessEvaluationReceipt(receipt, { brief });
  assert.equal(validated.evaluation.runPassed, false);
  assert.deepEqual(validated.evaluation.failedCriteria, ["binds-outcome"]);

  const wrongAssessment = makeReceipt({ brief });
  wrongAssessment.assessment.causeLevel = "inconclusive";
  const assessed = validateCausalCompletenessEvaluationReceipt(
    wrongAssessment,
    { brief },
  );
  assert.equal(assessed.evaluation.oracleMatched, false);
  assert.equal(assessed.evaluation.runPassed, false);
});

test("ablation oracle accepts evidence-supported phase grouping", async () => {
  const brief = await makeBrief();
  const grouped = makeReceipt({
    brief,
    caseId: "critical-path-ablation",
    variant: "full",
    run: 1,
  });
  grouped.assessment.causeLevel = "mixed";
  grouped.assessment.candidateCount = 3;
  const accepted = validateCausalCompletenessEvaluationReceipt(
    grouped,
    { brief },
  );
  assert.equal(accepted.evaluation.oracleMatched, true);
  assert.equal(accepted.evaluation.runPassed, true);

  grouped.assessment.candidateCount = 4;
  const rejected = validateCausalCompletenessEvaluationReceipt(
    grouped,
    { brief },
  );
  assert.equal(rejected.evaluation.oracleMatched, false);
  assert.equal(rejected.evaluation.runPassed, false);
});

test("evaluation receipt sets cover every paired run and reject reused invocations", async () => {
  const brief = await makeBrief();
  const receipts = causalCompletenessEvaluationCases.flatMap((evaluationCase) => {
    const suite = causalCompletenessEvaluationProtocol.suites[evaluationCase.suite];
    return suite.variants.flatMap((variant) => Array.from(
      { length: suite.runsPerVariant },
      (_, index) => makeReceipt({
        brief,
        caseId: evaluationCase.id,
        variant,
        run: index + 1,
      }),
    ));
  });
  const validated = validateCausalCompletenessEvaluationReceiptSet(
    receipts,
    { brief },
  );
  assert.deepEqual(validated.summary, {
    totalRuns: 12,
    passedRuns: 12,
    failedRuns: 0,
    totalCriteria: 96,
    passedCriteria: 96,
    failedCriteria: 0,
  });

  const reusedInvocation = structuredClone(receipts);
  reusedInvocation.at(-1).invocation.id = reusedInvocation[0].invocation.id;
  assert.throws(
    () => validateCausalCompletenessEvaluationReceiptSet(
      reusedInvocation,
      { brief },
    ),
    /repeats invocation/u,
  );

  const mixedModel = structuredClone(receipts);
  mixedModel.at(-1).configuration.model = "different-model";
  assert.throws(
    () => validateCausalCompletenessEvaluationReceiptSet(
      mixedModel,
      { brief },
    ),
    /one model and effort/u,
  );
});
