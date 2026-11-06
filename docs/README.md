# UI5 Lens 프로젝트 문서

UI5 Lens는 UI5 API 후보를 검색하고, 선택한 API의 구조·사용 조건·예제를 한국어 설명과 함께 탐색하는 웹앱이다.

문서 버전: 1.0  
구현 확인 기준일: 2026-11-05

## 문서 목록

| 문서 | 내용 |
| --- | --- |
| [요구사항 정의서](requirements.md) | 기능 요구사항 24개, 품질 요구사항 8개, 인수 시나리오 8개 |
| [MVC 역할 설계](mvc-design.md) | 실제 React 파일에 대응한 View·Controller·Model 역할과 구조도 |
| [시스템 아키텍처](system-architecture.md) | 수집·빌드·정적 제공·브라우저 실행과 데이터 흐름 |
| [프로젝트 설계서](project-design.md) | 기술 구성, 데이터 모델, 인터페이스, 화면, 검증 및 확장 계획 |
| [구현 현황](implementation-status.md) | 확인한 기능, 지원 범위, 검증 결과와 남은 작업 |

## 읽는 기준

- 구현 상태와 데이터 개수는 기준일에 확인한 스냅샷이다. 모든 UI5 버전 또는 전체 문서의 한국어 제공을 의미하지 않는다.
- 구현된 기능, 부분 구현, 미검증 항목을 구분한다. 설계서의 개선안은 향후 제안이며 이미 구현된 기능으로 취급하지 않는다.
- 한국어 해설은 공식 사실 데이터와 분리한다. AI 작성 여부와 사람 검토 상태를 별도로 표시한다.
- UI5 API 탐색 대상과 앱의 구현 기술은 다르다. 앱은 React 기반이며 검색 시 외부 생성형 AI를 호출하지 않는다.

## 문서 배치

이 폴더를 프로젝트 루트의 `docs/`로 배치한다. 문서 간 링크와 그림 경로는 상대 경로를 사용한다.

```text
docs/
  README.md
  requirements.md
  mvc-design.md
  system-architecture.md
  project-design.md
  implementation-status.md
  assets/
    mvc-design.png
    mvc-design.svg
    system-architecture.png
    system-architecture.svg
```

PNG는 Markdown에 표시하는 그림이며, SVG는 확대 또는 수정에 사용할 벡터 원본이다. `assets/`를 함께 유지한다.

## 자료와 프로젝트의 관계

이 문서 묶음은 프로젝트의 기능과 자체 설계를 설명한다. SAP 공식 문서 원문, 수집한 API 데이터 번들, 인증정보 및 실행 로그는 포함하지 않는다.

UI5 Lens는 SAP가 보증하거나 후원하는 공식 제품이 아니다. 코드와 원본 데이터의 이용 조건은 문서 공개 여부와 별도로 각 자료의 안내를 따른다.
