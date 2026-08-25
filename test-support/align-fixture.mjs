import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

import { sealAlignHtml } from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";

export function makeLegacyAlignInputV2(overrides = {}) {
  return {
    schemaVersion: 2,
    locale: "ko-KR",
    theme: "system",
    title: "실패한 업로드 복구",
    goal: "중단된 업로드를 감지해 사용자가 데이터 손실 없이 이어서 완료하거나 안전하게 취소할 수 있게 한다.",
    problem: "업로드 중단 시 파일이 손실되거나 불완전한 상태로 남는다.",
    checks: [
      {
        condition: "중단 지점부터 이어서 완료할 수 있다.",
        verify: "중단된 업로드를 다시 열어 이어서 완료한 뒤 원본과 같은 파일을 받을 수 있는지 확인한다.",
        by: "agent",
      },
      {
        condition: "복구를 취소해도 관련 없는 데이터가 바뀌지 않는다.",
        verify: "복구 취소 전후에 관련 없는 업로드 항목과 파일이 그대로 남는지 비교한다.",
        by: "agent",
      },
      {
        condition: "복구 취소 결과와 안내를 이해할 수 있다.",
        verify: "복구 화면에서 취소 결과와 안내가 이해되는지 사용자가 확인한다.",
        by: "human",
      },
    ],
    boundary: "사용자 기기와 서버가 협력하는 범위에서만 복구를 보장한다.",
    scope: {
      included: [
        "중단된 업로드 감지 및 항목 제공",
        "중단 지점부터 이어 업로드",
        "보관 기간 내 임시 데이터 유지",
      ],
      excluded: [
        "다른 사용자의 업로드 인계",
        "서버 보관 기간 만료 항목 복구",
        "암호화 키 분실 시 복구",
      ],
    },
    behavior: {
      steps: [
        { title: "중단 감지", detail: "업로드 중단을 감지한다." },
        { title: "복구 항목 유지", detail: "항목과 상태를 목록에 유지한다." },
        { title: "사용자 선택", detail: "이어 완료하거나 취소한다." },
      ],
      outcomes: [
        { title: "이어 완료", detail: "중단 지점부터 업로드를 완료한다.", kind: "complete" },
        { title: "안전하게 취소", detail: "임시 데이터를 제거한다.", kind: "cancel" },
      ],
    },
    decisions: [
      {
        decision: "자동 감지 기반 복구 우선",
        reason: "사용자 개입 없이 중단 항목을 감지해 복구 기회를 제공한다.",
      },
      {
        decision: "복구 항목은 제한된 기간만 제공",
        reason: "사용자가 복구 가능 기간을 알고 오래된 항목을 완료된 작업으로 오해하지 않게 한다.",
      },
    ],
    openChoices: [
      "복구 가능 항목을 별도로 알릴지 여부",
      "복구 항목을 보여 줄 기간",
      "이어 하기와 취소 중 어느 선택을 먼저 보여 줄지",
    ],
    evidence: [
      { label: "업로드 중단 고객 문의", location: "docs/research/upload-interruptions.md" },
      { label: "제품 요구", location: "https://example.com/requirements" },
    ],
    revisionSummary: "최초 합의",
    ...overrides,
  };
}

export function makeAlignInput(overrides = {}) {
  return {
    schemaVersion: 3,
    locale: "ko-KR",
    theme: "system",
    title: "실패한 업로드 복구",
    goal: "중단된 업로드를 감지해 사용자가 데이터 손실 없이 이어서 완료하거나 안전하게 취소할 수 있게 한다.",
    problem: "업로드 중단 시 파일이 손실되거나 불완전한 상태로 남는다.",
    intent: [
      {
        statement: "중단 지점부터 이어서 완료할 수 있다.",
        verify: "중단된 업로드를 다시 열어 이어서 완료한 뒤 원본과 같은 파일을 받을 수 있는지 확인한다.",
        by: "agent",
        reason: "중단된 작업을 처음부터 반복하지 않고도 데이터 손실을 피해야 한다.",
      },
      {
        statement: "복구를 취소해도 관련 없는 데이터가 바뀌지 않는다.",
        verify: "복구 취소 전후에 관련 없는 업로드 항목과 파일이 그대로 남는지 비교한다.",
        by: "agent",
      },
      {
        statement: "복구 취소 결과와 안내를 이해할 수 있다.",
        verify: "복구 화면에서 취소 결과와 안내가 이해되는지 사용자가 확인한다.",
        by: "human",
        reason: "취소가 어떤 임시 데이터에 영향을 주는지 오해하면 안전한 선택을 할 수 없다.",
      },
    ],
    exclusions: [
      "다른 사용자의 업로드 인계",
      "서버 보관 기간 만료 항목 복구",
      "암호화 키 분실 시 복구",
    ],
    flow: {
      steps: [
        { title: "중단 감지", detail: "업로드 중단을 감지한다." },
        { title: "복구 항목 유지", detail: "항목과 상태를 목록에 유지한다." },
        { title: "사용자 선택", detail: "이어 완료하거나 취소한다." },
      ],
      outcomes: [
        { title: "이어 완료", detail: "중단 지점부터 업로드를 완료한다.", kind: "complete" },
        { title: "안전하게 취소", detail: "임시 데이터를 제거한다.", kind: "cancel" },
      ],
    },
    evidence: [
      { label: "업로드 중단 고객 문의", location: "docs/research/upload-interruptions.md" },
      { label: "제품 요구", location: "https://example.com/requirements" },
    ],
    revisionSummary: "최초 합의",
    ...overrides,
  };
}

async function embedLegacyDesignDirections(value) {
  if (value === undefined) return undefined;
  return {
    ...value,
    options: await Promise.all(value.options.map(async (option) => {
      const bytes = await readFile(option.imagePath);
      const { imagePath: _imagePath, ...content } = option;
      return {
        ...content,
        image: {
          mimeType: "image/png",
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
          data: bytes.toString("base64"),
        },
      };
    })),
  };
}

export async function writeLegacyAlignArtifact({
  artifactPath,
  content: contentOverrides = {},
  createdAt = "2026-08-14T00:00:00.000Z",
  alignId = "11111111-1111-4111-8111-111111111111",
  repository = "acme/storage",
  repositoryIdentity = "remote://github.com/acme/storage",
}) {
  const current = makeLegacyAlignInputV2();
  const {
    goal,
    checks,
    schemaVersion: _schemaVersion,
    locale,
    theme,
    revisionSummary,
    ...shared
  } = current;
  const content = {
    ...shared,
    intent: goal,
    success: checks.map((check) => check.condition),
    ...contentOverrides,
  };
  const designDirections = await embedLegacyDesignDirections(content.designDirections);
  if (designDirections === undefined) {
    delete content.designDirections;
  } else {
    content.designDirections = designDirections;
  }
  const data = {
    schemaVersion: 1,
    alignId,
    repository,
    repositoryIdentity,
    locale,
    theme,
    createdAt,
    revisions: [{
      number: 1,
      agreedAt: createdAt,
      summary: revisionSummary,
      content,
    }],
  };
  const sealed = sealAlignHtml(renderAlignArtifact(data, { digest: "0".repeat(64) }));
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, sealed.bytes);
  return Object.freeze({
    alignId,
    artifactPath,
    digest: sealed.digest,
    repository,
    revision: 1,
    title: content.title,
  });
}

export function makeDesignDirections(imagePaths) {
  if (!Array.isArray(imagePaths) || imagePaths.length < 2 || imagePaths.length > 3) {
    throw new TypeError("imagePaths must contain two or three paths");
  }
  const options = imagePaths.map((imagePath, index) => ({
    id: `direction-${index + 1}`,
    title: index === 0 ? "차분한 작업 공간" : index === 1 ? "선명한 진행 흐름" : "밀도 높은 대시보드",
    imagePath,
    alt: `업로드 복구 화면 시안 ${index + 1}`,
    summary: index === 0
      ? "현재 작업과 복구 선택에 집중하는 차분한 구성이다."
      : index === 1
        ? "복구 진행 단계와 다음 행동을 강하게 드러내는 구성이다."
        : "여러 복구 항목과 상태를 한 번에 비교하는 구성이다.",
    strengths: [index === 0 ? "핵심 선택을 빠르게 찾을 수 있다." : "현재 단계가 분명하다."],
    tradeoffs: [index === 0 ? "여러 항목을 한눈에 보기 어렵다." : "정보가 적을 때는 강조가 과할 수 있다."],
    references: index === 0
      ? [{
          label: "복구 요구 참고",
          url: "https://example.com/recovery-reference",
          influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
        }]
      : [],
  }));
  return {
    options,
    recommendation: {
      optionId: "direction-1",
      reason: "복구 선택을 이해하는 데 필요한 정보만 먼저 보여 준다.",
    },
    selection: {
      optionId: "direction-2",
      reason: "진행 단계를 더 분명하게 보여 주는 방향을 선택했다.",
      decidedBy: "user",
    },
  };
}
