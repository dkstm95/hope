<p align="center">
  <img
    src="plugins/hope/assets/hope-protected-light.png"
    width="128"
    alt="Hope 프로텍티드 라이트 아이콘"
  >
</p>

<h1 align="center">Hope</h1>

<p align="center">
  <strong>
    Hope는 사람과 AI가 더 잘 협업하는 실용적인 방법을 찾습니다.
  </strong>
</p>

<p align="center"><a href="README.md">English</a></p>

## 설치

Hope 플러그인은 Codex와 Claude Code에 설치할 수 있습니다.

다음 항목들이 필요합니다.

- Node.js 20 이상
- Diff를 사용하려면 인증된 [GitHub CLI](https://cli.github.com/)가
  필요합니다. 필요하다면 먼저 `gh auth login`을 실행하세요.

가장 간단한 설치 방법은 ai에게 다음과 같이 요청하는 것입니다.

```text
https://github.com/dkstm95/hope 저장소의 Hope를 현재 AI 도구에 설치해 주세요.
저장소의 README에 따라 설치하고, 다시 시작해야 한다면 알려 주세요.
```

직접 설치하려면 사용 중인 도구의 명령을 실행하세요.

```bash
# Codex
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

```bash
# Claude Code
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

설치한 뒤 새 Codex 또는 Claude Code 세션을 시작하세요.

## 기능 고르기

| 필요한 순간 | 기능 | 얻는 결과 |
| --- | --- | --- |
| 구현 전에 작업을 확정해야 할 때 | **Align** | 보이는 공유 이해와 승인 경계 |
| 비판적으로 냉정하게 검토할 때 | **Toxic Review** | 근거와 우선순위가 있는 하나의 결과 |
| 변경 내역을 이해해 판단이나 다음 작업에 활용할 때 | **Diff** | 근거와 다음 확인 항목이 연결된 로컬 HTML 리뷰 |
| 완성한 작업물을 다듬을 때 | **Polish** | 범위와 검증 상태가 드러난 한 번의 정리 |
| 글을 작성하거나 고치거나 검토할 때 | **Write** | 의미를 보존한 명확한 초안, 수정, 검토 |
| 언어와 테마를 유지할 때 | **Settings** | 지원되는 Hope 결과물의 공통 기본값 |

## 기능

### Align

Align은 구현을 시작하기 전에 중요한 오해를 찾습니다.
확인할 수 있는 근거를 읽고, 위험에 맞춰 질문하며, 해결되지 않은 선택을 드러냅니다.

> 예시: “업로드 복구 동작을 구현하기 전에 합의할 내용을 정리해 주세요.”

![실패한 업로드 복구의 남은 결정, 현재 차단 항목, 범위, 성공 조건을 보여 주는 Hope Align 예시](assets/readme/hope-align-ko.png)

*실패한 업로드 복구 예시로 생성한 실제 Align HTML 결과물입니다.*

| 범위와 성공 조건 | 예상 동작 |
| --- | --- |
| [![Align 결과의 작업 범위와 성공 조건](assets/readme/hope-align-scope-ko.png)](assets/readme/hope-align-scope-ko.png) | [![Align 결과의 대표 시나리오와 예상 동작](assets/readme/hope-align-scenarios-ko.png)](assets/readme/hope-align-scenarios-ko.png) |
| 공유 이해와 다음 결정 | 검증 가능한 작업 |
| [![Align 결과의 열린 질문, 선택지, 추천, 확정된 결정](assets/readme/hope-align-understanding-ko.png)](assets/readme/hope-align-understanding-ko.png) | [![Align 결과의 사용자 변화, 범위, 검증, 실패 복구](assets/readme/hope-align-work-ko.png)](assets/readme/hope-align-work-ko.png) |

Align은 저장소 사실, 사용자 결정, AI 제안, 가정, 열린 질문을 구분합니다.
범위, 성공 조건, 대표 시나리오, 검증 가능한 작업 단위를 기록합니다.
후보가 준비되면 Align은 Polish를 한 번 호출하고 결과를 다시 확인합니다.
Align은 명시적인 승인을 기다리며 작업을 직접 구현하지 않습니다.

현재 공유된 이해는 하나의 자체 포함 HTML 파일로 만들 수 있습니다.
이 결과물은 최종 보고서로만 쓰이지 않고 인터뷰 중에도 현재 상태를 보여 줍니다.

---

### Toxic Review

Toxic Review는 이름을 붙인 작업물을 엄격하게 검토합니다.
작업을 만든 사람은 공격하지 않습니다.
대상, 단계, 근거, 위험에 맞는 관점만 선택합니다.

> 예시: “이 마이그레이션 계획의 중요한 위험을 찾아 주세요.”

> **산출물:** 별도 HTML 파일 없이 현재 대화에 하나의 판정된 리뷰를 반환합니다.

각 지적은 문제, 실제 영향, 제안 행동, 신뢰도, 근거를 담습니다.
주 리뷰어는 모든 지적을 수용, 부분 수용, 기각, 보류, 중복으로 판정합니다.
최종 결과는 여러 리뷰어의 의견을 붙이지 않고 하나의 판정된 목소리로 정리됩니다.
확인한 범위에서 중요한 문제가 없다는 것도 유효한 결과입니다.

Toxic Review는 Align이나 Diff를 자동으로 호출하지 않습니다.
사용자가 정확한 결과물을 제공하면 이를 근거로 사용할 수 있습니다.

---

### Diff

Diff는 하나의 정확한 스냅샷에서 수집한 근거로 GitHub PR을 설명합니다.
사용자가 다음 행동을 정하기 전에 변경을 이해하도록 돕습니다.

![nanoid PR 601의 목표, 이전과 이후 동작, 영향, 검증 항목을 보여 주는 Hope Diff 결과](assets/readme/hope-diff-ko.png)

*[nanoid PR #601](https://github.com/ai/nanoid/pull/601)로 생성한 실제 Diff HTML 결과물입니다.*

| 핵심 변경 | 동작 모델 |
| --- | --- |
| [![Diff 결과의 핵심 변경 설명](assets/readme/hope-diff-core-ko.png)](assets/readme/hope-diff-core-ko.png) | [![Diff 결과의 입력별 동작 비교와 흐름](assets/readme/hope-diff-behavior-ko.png)](assets/readme/hope-diff-behavior-ko.png) |
| 설명 도구 선택 | 근거가 연결된 코드 흐름 |
| [![Diff 결과가 설명 도구의 포함 여부와 이유를 보여 주는 화면](assets/readme/hope-diff-teaching-ko.png)](assets/readme/hope-diff-teaching-ko.png) | [![Diff 결과의 코드 단계와 근거 링크](assets/readme/hope-diff-code-ko.png)](assets/readme/hope-diff-code-ko.png) |
| 판단에 필요한 다음 확인 | 근거와 확인 범위 |
| [![Diff 결과의 다음 행동과 완료 조건](assets/readme/hope-diff-review-ko.png)](assets/readme/hope-diff-review-ko.png) | [![Diff 결과의 수집한 근거와 검토 범위](assets/readme/hope-diff-evidence-ko.png)](assets/readme/hope-diff-evidence-ko.png) |

Diff는 PR 본문, 커밋 제목, 변경된 텍스트 파일을 읽습니다.
근거가 확인된 관련 경로도 제한된 범위에서 읽을 수 있습니다.
라이트와 다크 테마를 지원하는 하나의 자체 포함 로컬 HTML 파일을 만듭니다.
변경을 이해하는 데 도움이 되면 동작 모델이나 이해 확인 문항을 포함할 수 있습니다.

URL 없이 실행하면 먼저 현재 브랜치의 PR을 찾습니다.
없으면 저장소에서 사용자가 만든 최신 열린 PR을 선택합니다.
PR이 바뀌면 Diff를 다시 실행하세요.

<details>
<summary><strong>Diff가 의도적으로 확인하거나 실행하지 않는 범위</strong></summary>

- 관련 없는 저장소 파일을 검색하지 않습니다.
- PR 토론, 리뷰 댓글, CI 결과를 확인하지 않습니다.
- 테스트, 빌드, 린터, 그 밖의 저장소 코드를 실행하지 않습니다.
- PR을 승인, 기각, 병합, 변경하거나 댓글을 남기지 않습니다.

</details>

---

### Polish

Polish는 이름을 붙인 완성 작업물을 한 번, 제한된 범위에서 정리합니다.
확정된 동작과 의미를 지키면서 결과를 개선합니다.

> 예시: “요구사항을 바꾸지 말고 이 완성된 지침을 짧게 만들어 주세요.”

> **산출물:** 별도 HTML 파일 없이 수정한 작업물과 검증 결과를 현재 작업 흐름에 남깁니다.

Polish는 고정 체크리스트 대신 정확한 대상에 맞는 계획을 만듭니다.
수집한 근거가 뒷받침하면 내용을 단순화하거나 리팩터링할 수 있습니다.
중복 내용을 합치거나 불필요한 내용을 제거할 수도 있습니다.
공개 계약, 동작, 의미, 사실, 불확실성, 인용, 말투를 보존합니다.
변경할 내용이 없다는 것도 유효한 결과입니다.

정리에 중요한 제품 결정이 필요하면 Polish는 `needs-alignment`를 반환합니다.
Align을 자동으로 호출하지는 않습니다.
문장이 포함된 변경에는 공유 Write 표준을 직접 사용합니다.

---

### Write

Write는 글을 작성하거나 고치거나 검토합니다.
그 과정에서 의미, 사실, 불확실성, 인용, 말투를 보존합니다.
같은 표준은 다른 Hope 기능의 문장도 일관되게 만듭니다.

> 예시: “확인하지 않은 원인은 추가하지 말고 이 저장 오류를 명확하게 고쳐 주세요.”

> **산출물:** 별도 HTML 파일 없이 초안, 수정문, 검토 결과를 현재 대화나 대상 파일에 반영합니다.

| 모드 | 용도 |
| --- | --- |
| `draft` | 요청과 문맥을 바탕으로 새 글을 만듭니다. |
| `edit` | 요청한 글이나 파일을 바꿉니다. |
| `review` | 파일을 바꾸지 않고 명료성, 의미, 흐름의 중요한 문제를 보고합니다. |

언어만 다루는 작업에는 Write를 사용하세요.
구조도 바꿀 수 있는 완성 작업물의 제한된 정리에는 Polish를 사용하세요.

---

### Settings

Settings는 지원되는 Hope 결과물이 사용할 언어와 초기 테마를 저장합니다.
하네스와 설치된 플러그인은 같은 설정을 사용합니다.

> **산출물:** 시각 산출물 대신 전역 설정 파일을 저장합니다.

저장된 언어가 없으면 Hope는 AI 도구, 운영체제, 기본 언어 순서로 선택합니다.
저장된 테마가 없으면 시스템 테마를 사용합니다.
Settings 변경은 새 결과물에 적용되며 기존 오프라인 파일은 바꾸지 않습니다.

## 라이선스

[MIT](LICENSE)
