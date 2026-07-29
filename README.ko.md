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

가장 간단한 설치 방법은 Codex나 Claude Code에 다음과 같이 요청하는
것입니다.

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

## 기능

### Align

Align은 구현 전에 중요한 오해를 찾습니다. 작업 위험에 맞게 질문을
조절하고, 사용자 결정과 저장소 사실, AI 제안을 구분하며, 다음 단계로
가기 전에 명시적인 승인을 기다립니다.

```text
Codex
$hope:align 이 기능을 구현하기 전에 이해를 맞춰 주세요.

Claude Code
/hope:align 이 기능을 구현하기 전에 이해를 맞춰 주세요.
```

각 라운드는 목표, 범위, 기대 동작과 주요 가정을 짧게 되짚으며 시작합니다.
Align은 저장소에서 확인할 수 있는 사실을 다시 묻지 않고, 열린 질문과
미확정 가정을 드러냅니다. 범위, 성공 조건, 시나리오와 검증 가능한 작업
단위가 정리되고 중요한 질문이나 가정이 더는 열려 있지 않을 때만 준비
상태를 제안합니다.

Align은 현재 공유된 이해를 자체 포함 HTML로 만들 수 있습니다. HTML에는
범위, 사례, 가정, 남은 질문, 설계 관점과 검증 가능한 작업 단위가
표시됩니다.

승인을 요청하기 전에 Align은 정확한 후보를 한 번만 Polish하고 결과를
다시 검증합니다.

### Toxic Review

Toxic Review는 사람을 공격하지 않으면서 아이디어, 요구사항, UI, 계획,
구현, PR 또는 다른 작업물을 엄격하게 검토합니다. 현재 위험에 필요한
역할만 선택하고, 지적을 판정한 뒤 우선순위에 따라 하나의 결과로
정리합니다.

```text
Codex
$hope:toxic-review 이 계획을 시작하기 전에 냉정하게 검토해 주세요.

Claude Code
/hope:toxic-review 이 계획을 시작하기 전에 냉정하게 검토해 주세요.
```

각 지적은 문제, 실제 영향, 제안 행동, 신뢰도와 근거를 포함합니다. 주
리뷰어는 각 지적을 수용, 부분 수용, 기각, 보류, 중복 중 하나로
판정합니다. 보류된 위험은 해결되지 않은 일로 계속 표시됩니다.

확인한 범위에서 중요한 문제가 없다는 것도 유효한 결과입니다. 지적 수를
채우기 위해 문제를 만들지 않습니다.

### Polish

Polish는 이름을 붙인 완성 작업물을 한 번, 제한된 범위에서 다듬습니다.
코드, 테스트, 문서, 주석, 예시와 오류 메시지를 단순화하거나
리팩터링할 수 있습니다. 수집한 근거로 불필요하거나 중복이라고 확인한
내용은 합치거나 제거할 수도 있습니다.

```text
Codex
$hope:polish 동작을 바꾸지 말고 이 구현을 정리해 주세요.

Claude Code
/hope:polish 동작을 바꾸지 말고 이 구현을 정리해 주세요.
```

Polish는 고정 체크리스트 대신 정확한 대상에 맞는 계획을 만듭니다. 공개
계약, 동작, 의미, 사실, 불확실성, 인용과 말투를 보존합니다. 정리에 제품
결정이 필요하면 멈추고 이해를 맞추도록 요청합니다. 근거 있는 변경점을
찾지 못한 결과도 유효합니다.

### Diff

Diff는 코드 변경을 근거와 함께 설명합니다. 사용자는 이를 바탕으로 스스로
판단하고, 이해한 내용을 이후 작업에 활용할 수 있습니다.

Diff는 하나의 로컬 HTML 파일을 만듭니다.

> URL 없이 실행하면 대상 저장소에서 사용자가 만든 열린 PR을 찾습니다.
> 특정 PR을 고르려면 해당 GitHub PR URL을 함께 입력하세요.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

<p align="center">
  <img
    src="assets/readme/hope-diff-light-horizontal.png"
    alt="요약, 동작 흐름, 코드 흐름, 검토 항목, 이해 확인 문항을 보여주는 라이트 모드 Hope Diff 결과"
  >
</p>

<p align="center">
  <img
    src="assets/readme/hope-diff-dark-horizontal.png"
    alt="요약, 동작 흐름, 코드 흐름, 검토 항목, 이해 확인 문항을 보여주는 다크 모드 Hope Diff 결과"
  >
</p>

Diff는 PR 설명, 커밋 제목, 수집할 수 있는 변경 파일의 본문을 읽습니다.
출처에서 관련 경로를 확인하면 검토 대상의 정확한 head 또는 merge-base
커밋에서 제한된 수의 파일을 추가로 읽을 수 있습니다.

관련 없는 저장소 파일을 검색하지 않으며, PR 토론, 리뷰 댓글, CI 결과는
확인하지 않습니다.

테스트, 빌드, 린트 명령이나 그 밖의 저장소 코드도 실행하지 않습니다.

> PR이 바뀌면 Diff를 다시 실행하세요.

### Write

Write는 더 명확한 언어가 필요한 모든 작업에 조지 오웰의 글쓰기 원칙을
적용합니다. 프롬프트, 문서, 응답, 화면 문구, 오류, 주석, 이름처럼
구현에 들어가는 문장도 다듬습니다. 익숙한 단어와 직접적인 문장을 쓰되
뜻, 사실, 불확실성, 인용, 말투는 보존합니다.

```text
Codex
$hope:write 이 wiki 문서를 한 번에 이해할 수 있도록 고쳐 주세요.

Claude Code
/hope:write 이 wiki 문서를 한 번에 이해할 수 있도록 고쳐 주세요.
```

Write는 현재 대화의 언어와 더 구체적인 프로젝트 규칙을 따릅니다. 단독
작업 또는 다른 작업 안의 글쓰기 단계로 다음 모드를 사용할 수 있습니다.

- `draft`는 요청과 문맥을 바탕으로 새 글을 작성합니다.
- `edit`은 요청한 글이나 파일을 고칩니다.
- `review`는 파일을 바꾸지 않고 명료성, 의미, 흐름의 중요한 문제를
  알려 줍니다.

언어만 다루는 작업에는 Write를 사용하세요. 구조도 바꿀 수 있는 완성
작업물의 제한된 정리에는 Polish를 사용하세요.

### Settings

Hope에서 사용할 언어와 테마 설정을 저장할 수 있습니다.

저장된 설정이 없으면 Hope는 현재 도구나 운영체제의 언어를 따르고 시스템
테마를 사용합니다.

## 라이선스

[MIT](LICENSE)
