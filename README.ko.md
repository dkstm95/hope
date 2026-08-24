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
    Hope는 사람이 AI와 함께 일하면서도 작업을 보고, 이해하고, 통제할 수 있도록 돕습니다.
  </strong>
</p>

<p align="center"><a href="README.md">English</a></p>

<br>

## 기능

### 🤝 Align — 구현 전 작업 이해를 맞추고 `의도 부채`를 방지합니다

Align은 확인 가능한 근거로 검토하고, 결과를 바꿀 수 있는 중요한 누락·모순·위험·검증되지 않은 가정·예외·더 단순한 대안 등에 대해 인터뷰합니다.

후속 작업이나 검토에서 다시 확인할 기록이 필요하거나 사용자가 산출물을 요청하면,
Align은 프로젝트 안에 하나의 HTML 문서를 만듭니다. 현재 세션에서 계속 진행할
작고 명확한 일은 파일을 만들지 않고 합의를 대화에 남길 수 있습니다.

이 문서에는 합의된 목표 하나와 완료 기준이 담깁니다.
각 완료 기준에는 확인 방법과 AI와 사용자 중 누가 판단할지가 포함됩니다.
중요한 변경은 동일 파일의 새 버전으로 남기며, 이 문서를 구현 계약으로 사용합니다.

첨부 자료가 없는 중요한 UI 작업에서는 프로젝트를 먼저 살피고, 필요하면 웹 서치로 조사해 2~3개의 이미지 시안을 제시합니다.

> [!IMPORTANT]
> 생성된 Align 문서는 프로젝트 문서입니다. 사용자가 제외하지 않는 한 관련
> 변경과 함께 버전 관리에 포함합니다.

**전체 HTML 예시:** [출처 충돌·변경·취소와 확인 책임을 합의한 한국어 팬 일정 Align 문서를 엽니다.](docs/alignments/rescene-fan-calendar.ko.html)

![신뢰 가능한 팬 일정의 목표, 완료 기준, 경계를 보여 주는 한국어 Hope Align 예시](assets/readme/hope-align-ko.png)

<details>
<summary>Align 세부 이미지 보기</summary>

| 비교한 UI 방향 | 출처와 데이터 운영 결정 |
| --- | --- |
| [![한국어 Align 문서에서 비교한 신뢰 가능한 팬 일정 UI 두 가지](assets/readme/hope-align-directions-ko.png)](assets/readme/hope-align-directions-ko.png) | [![한국어 Align 문서의 출처 우선순위, 충돌, 최신성, 취소 결정](assets/readme/hope-align-decisions-ko.png)](assets/readme/hope-align-decisions-ko.png) |

</details>

---

### 🔎 Diff — 무엇이 바뀌었고 어떻게 판단할지 이해하여 `인지 부채`를 방지합니다

코드는 바뀌었지만 담당자가 동작을 예측하거나 설명하고 판단하지 못한다면 그 간극은 인지 부채로 남습니다.

Diff는 하나의 HTML 문서를 만들어 코드보다 동작을 먼저 설명하고 중요한 주장에 근거를 연결합니다.

능동적인 이해를 돕기 위해 시각 자료, 마이크로월드, 퀴즈를 활용하기도 합니다.

이를 통해 변경을 이해하고 판단한 뒤 그 이해를 후속 결정과 작업에 활용하도록 돕습니다.

> [!NOTE]
> URL 없이 실행하면 먼저 현재 브랜치의 PR을 찾습니다.
> 없으면 저장소에서 사용자가 만든 최신 열린 PR을 선택합니다.
> PR이 바뀌면 Diff를 다시 실행하세요.

아래 이미지는 [Ky PR #867](https://github.com/sindresorhus/ky/pull/867)을 바탕으로
고정된 한국어 Diff 예시에서 만들었습니다.

**전체 HTML 예시:** [Ky PR #867의 재시도 설정을 마이크로월드와 퀴즈로 설명한 한국어 Diff 결과물을 엽니다.](docs/diffs/ky-867-retry-extend.ko.html)

![Ky PR 867의 목표, 이전과 이후 동작, 검증 항목을 보여 주는 한국어 Hope Diff 예시](assets/readme/hope-diff-ko.png)

<details>
<summary>Diff 세부 이미지 보기</summary>

| 핵심 변경 | 인터랙티브 마이크로월드 |
| --- | --- |
| [![한국어 Diff 문서의 재시도 설정 핵심 변경 설명](assets/readme/hope-diff-core-ko.png)](assets/readme/hope-diff-core-ko.png) | [![한국어 Diff 문서의 인터랙티브 재시도 설정 마이크로월드](assets/readme/hope-diff-microworld-ko.png)](assets/readme/hope-diff-microworld-ko.png) |

[![한국어 Diff 문서의 재시도 동작 이해 퀴즈](assets/readme/hope-diff-quiz-ko.png)](assets/readme/hope-diff-quiz-ko.png)

</details>

---

### ⚖️ Toxic Review — Red–Blue 방식으로 결과물을 냉정하게 검토합니다

Red가 찾고, Blue가 검증하고, 메인 에이전트가 판정합니다.

Red 리뷰어들은 서로 독립적으로 서로 다른 중요한 위험을 파고듭니다. 우선순위가
높거나 광범위하고 되돌리기 어려운 조치를 제안하거나 실질적으로 불확실한 모든 지적
사항에는 새로운 Blue 검증 에이전트가 붙습니다. Blue는 봉인된 지적 사항과 범위 안의
근거를 바탕으로 문제, 영향, 범위, 제안 조치를 각각 반증합니다.

메인 에이전트는 각 후보의 최종 판정과 실행 가능한 후보의 최종 우선순위를 기록하고,
근거가 뒷받침하는 수준을 넘지 않는 지적 사항만 실행 항목으로 보고합니다.

> [!TIP]
> 일상적인 실행 규모를 줄이려면 Hope에 Red 리뷰어 수를 제한해 달라고 요청하세요.
> 규모만으로 Blue를 추가하지는 않지만, 우선순위가 높거나 광범위한 조치를 제안하거나
> 실질적으로 불확실한 지적 사항에는 반드시 Blue가 붙습니다.

---

### ✨ Polish — 구현된 결과물을 다듬습니다

서로 독립된 검토 에이전트가 가치 있는 개선을 찾습니다.

코드에서는 기존 헬퍼 재사용, 단순성, 효율, 추상화 수준 등을 확인합니다.

메인 에이전트는 결과를 판정하고, 적용할 수 있는 변경만 반영하고 검증합니다.

버그 탐색, 기능 개발, 마이그레이션, 광범위한 유지보수는 하지 않습니다.

---

### 🧹 Sweep — 코드베이스를 청소합니다

코드베이스를 읽기 전용으로 검토하며,
깨진 참조, 오래된 코드, 근거 없는 추상화, 검증 공백, 의존성·라이선스 위험, 전달 과정의 낭비, 불분명한 소유권 등이 대상입니다.

검토 결과 목록에서 후보를 선택하면 작업을 시작합니다.

---

### ✍️ Write — 의미를 보존하며 명확하게 글을 작성합니다

Hope는 구현과 다른 Skill을 포함한 작업 안에서도 Write를 사용합니다.

Write의 공통 기준은 조지 오웰의
[「Politics and the English Language」](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/)에
담긴 여섯 가지 원칙을 바탕으로 합니다.

<br>

## 설치

다음 항목들이 필요합니다.
- Node.js 22 이상
- Diff를 사용하려면 인증된 [GitHub CLI](https://cli.github.com/)가 필요합니다. 필요하다면 먼저 `gh auth login`을 실행하세요.

> [!TIP]
> 가장 간단한 설치 방법은 AI에게 다음과 같이 요청하는 것입니다.
>
> ```text
> https://github.com/dkstm95/hope 저장소의 Hope를 현재 AI 도구에 설치해 주세요.
> 저장소의 README에 따라 설치하고, 다시 시작해야 한다면 알려 주세요.
> ```

직접 설치하려면 사용 중인 도구의 명령을 실행하세요.

예시:
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

## 라이선스

[MIT](LICENSE)
