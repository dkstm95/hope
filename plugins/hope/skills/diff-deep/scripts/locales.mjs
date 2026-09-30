const en = {
  skip: "Skip to changes", changes: "Changes", reason: "Selected group details", files: "files",
  light: "Light", dark: "Dark", system: "System", theme: "Theme", previous: "Previous group",
  next: "Next group", reviewed: "Mark read", undoRead: "Mark unread", read: "groups read",
  source: "Evidence", stated: "Stated", inferred: "≈ Inferred", unknown: "Unknown",
  pendingTitle: "Reason not added yet", pendingBody: "This code is not assigned to an explained group yet.",
  request: "Copy explanation request", copied: "Request copied", copyFailed: "Copy the request below",
  refresh: "Reload explanations", noNewline: "No newline at end of file", context: "Unchanged context",
  before: "Before", after: "After", removed: "Removed", added: "Added",
  scope: "Capture details", limited: "files have unavailable content", empty: "No changed files", pending: "files awaiting grouping", head: "Captured head", base: "Base",
  mergeBase: "Merge base", captured: "Captured", revision: "Explanation revision",
  storageUnavailable: "Progress is not saved in this browser. Export it to resume later.",
  export: "Export progress", import: "Import progress", invalidProgress: "Progress belongs to another snapshot or is invalid.",
  imported: "Progress restored", readOnly: "Read markers do not approve the PR.",
  groupJump: "Jump to group", groups: "groups", ungrouped: "Not grouped yet", showCode: "Show captured code", selectedCode: "Selected code",
  restored: "Progress is saved in this browser for this snapshot.",
  reasons: {
    "private-file": "Private configuration is not embedded.",
    credential: "Content matching a credential pattern is not embedded.",
    "repository-unavailable": "The source repository is unavailable.",
    "source-unavailable": "The exact-revision source could not be read.",
    "special-entry": "This entry is not a regular text file.",
    "size-limit": "This file exceeds the safe text size limit.",
    binary: "This is a binary file; text before and after cannot be displayed.",
    "no-text-diff": "GitHub provided no text diff; binary or mode-only details are unavailable.",
    "rename-only": "The file path changed without text changes.",
    "patch-incomplete": "A complete patch could not be reconstructed and verified.",
  },
};

const ko = {
  skip: "변경 내역으로 이동", changes: "변경 내역", reason: "선택한 묶음의 상세 설명", files: "개 파일",
  light: "라이트", dark: "다크", system: "시스템", theme: "화면 테마", previous: "이전 묶음",
  next: "다음 묶음", reviewed: "확인 표시", undoRead: "확인 취소", read: "개 묶음 확인",
  source: "근거", stated: "명시", inferred: "≈ 추정", unknown: "확인 필요",
  pendingTitle: "아직 설명이 없습니다", pendingBody: "이 코드는 아직 설명 묶음에 배정되지 않았습니다.",
  request: "설명 요청 복사", copied: "요청을 복사했습니다", copyFailed: "아래 요청을 복사하세요",
  refresh: "설명 새로고침", noNewline: "파일 끝에 줄바꿈 없음", context: "변경되지 않은 맥락",
  before: "변경 전", after: "변경 후", removed: "삭제", added: "추가",
  scope: "수집 정보", limited: "개 파일의 내용을 확인할 수 없습니다", empty: "변경된 파일이 없습니다", pending: "개 파일 묶음 대기", head: "수집한 head", base: "base",
  mergeBase: "merge base", captured: "수집 시각", revision: "설명 버전",
  storageUnavailable: "이 브라우저에서는 진행 상태가 저장되지 않습니다. 내보내기로 보관할 수 있습니다.",
  export: "진행 상태 내보내기", import: "진행 상태 가져오기", invalidProgress: "다른 변경의 기록이거나 올바르지 않은 파일입니다.",
  imported: "진행 상태를 복원했습니다", readOnly: "확인 표시는 PR 승인이 아닙니다.",
  groupJump: "묶음으로 이동", groups: "개 묶음", ungrouped: "아직 묶이지 않은 변경", showCode: "수집한 코드 보기", selectedCode: "선택한 코드",
  restored: "이 브라우저에 현재 변경의 진행 상태를 저장합니다.",
  reasons: {
    "private-file": "비공개 설정 파일의 내용은 포함하지 않았습니다.",
    credential: "인증 정보 패턴이 포함된 내용은 표시하지 않습니다.",
    "repository-unavailable": "원본 저장소에 접근할 수 없습니다.",
    "source-unavailable": "해당 커밋의 원문을 읽을 수 없습니다.",
    "special-entry": "일반 텍스트 파일이 아닌 항목입니다.",
    "size-limit": "안전하게 수집할 수 있는 텍스트 크기를 초과했습니다.",
    binary: "바이너리 파일이므로 텍스트 변경 전후를 표시할 수 없습니다.",
    "no-text-diff": "GitHub가 텍스트 변경을 제공하지 않았습니다. 바이너리나 권한 변경의 세부 정보는 확인할 수 없습니다.",
    "rename-only": "내용 변경 없이 파일 경로가 바뀌었습니다.",
    "patch-incomplete": "모든 변경 줄을 포함한 patch를 복원·검증하지 못했습니다.",
  },
};

export function dictionary(locale) {
  if (locale === "ko-KR") return ko;
  if (locale === "en-US") return en;
  throw new Error("Supported locales: en-US, ko-KR");
}
