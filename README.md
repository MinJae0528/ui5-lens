# ERP Lens — 한국어 UI5 API 탐색 · ABAP 기본 문법

키워드 검색 → API 후보 목록 → 후보 선택 → 한국어로 구조·사용 조건·예제 확인.
ui5.sap.com 이 호스팅하는 **모든 UI5 버전(31개)** 의 공식 API 자료를 담고, 회사가 쓰는 버전을 골라 볼 수 있다.

프로젝트 문서(요구사항, MVC 역할 설계, 시스템 아키텍처, 설계서, 구현 현황)는 [docs/](docs/README.md) 에 있다.

## 실행

```bash
npm install
npm run discover:versions   # ui5.sap.com 에 실제 호스팅된 버전 탐색 → data/versions.json (최초/갱신 시)
npm run fetch:api           # 전 버전 api.json 다운로드 (약 1GB 원본 → gzip 캐시 약 110MB, 이어받기 가능)
npm run fetch:topics        # 버전별 문서 가이드 목차(약 140KB/버전). 문서 가이드 모드가 쓴다 — 본문은 받지 않는다
npm run dev                 # 데이터 빌드(약 30초) + 개발 서버 http://localhost:5173
npm run build               # 데이터 빌드 + 타입 검사 + 단위 테스트 + 정적 배포물 dist/ (약 105MB)
npm run app                 # (데이터가 이미 있을 때) 빌드 후 미리보기 서버를 띄우고 브라우저를 자동으로 연다
```

Windows 에서는 `open-ui5-lens.cmd` 를 더블클릭해도 같은 일을 합니다.

원본 캐시는 OneDrive 동기화를 피해 `%LOCALAPPDATA%\ui5-lens-cache` 에 저장된다 (`UI5_LENS_CACHE` 환경변수로 변경).
일부 버전만 빠르게 빌드: `node scripts/build-data.mjs 1.120 1.71`

검색창 하나로 **이름**(`Table`, `sap.m.Table`, 한국어 별칭)과 **하고 싶은 일**(“댓글을 다는 기능”)을 모두 찾는다. 이름이 정확히 일치하는 후보가 없으면 질문을 기능 설명으로 해석해 공식 이름·설명과 겹치는 API 3개를 이유와 함께 추천한다(AI 호출 없음).

추천 정확도 평가 (`data/recommend-eval.json`, 질문 110개):

```bash
node scripts/eval-recommend.mjs        # dev / test / fresh 별 상위1·상위3·상위8 적중률
node scripts/eval-recommend.mjs --json data/recommend-eval-result.json   # 앱에 공개하는 수치 갱신 후 npm run build:data
```

- dev(35): 점수 규칙·사전을 맞추는 데 사용. test(35): 처음엔 튜닝에 안 썼으나 실패 목록을 본 뒤 사전을 고쳐 **오염됨**(외운 결과라 성능 지표로 쓰면 안 됨).
- **fresh(40): 사전을 고친 뒤 작성해 한 번만 측정 — 상위 3개 적중률 55%** (1위 45%). 앱에 공개하는 수치는 이 값이다. 실패는 사전에 없는 표현과 화면 컨트롤이 아닌 프레임워크 기능(예: 화면 크기 감지)에 몰려 있다.
- 한국어→영어 용어 사전(`data/intents.json`)은 서비스가 작성한 것이며, 빌드 때 모든 영어 용어가 공식 자료에 실제로 나오는지 검증한다.

검증:

```bash
npm run typecheck           # 앱 + 테스트 타입 검사
npm test                    # 도메인 단위 테스트 42개(브라우저 불필요, 1초 이내)
npm run test:e2e            # (Edge + 서버 필요) 사용자 흐름 90개. 개발 서버 또는 vite preview 주소를 인자로
node scripts/test-sanitize.mjs   # (개발 서버 필요) HTML 정화기 공격 페이로드 30종
npm run verify:examples     # 예제를 실제 UI5 1.154.0 에서 실행(인터넷 필요) → data/verification.json
```

## 버전 범위

- `versionoverview.json` 의 마이너 112개 중 **31개만 ui5.sap.com 에 호스팅**되어 있다 (1.38, 1.52, 1.71, 1.84, 1.96, 1.102, 1.108, 1.114, 1.120, 1.124, 1.129 … 1.154).
  서버에 없는 나머지 81개(예: 1.78, 1.100)는 받을 방법이 없다 — 회사 버전이 없으면 가장 가까운 버전을 고른다.
- 버전마다 라이브러리 약 60개, 고유 심볼은 전 버전 합쳐 5,137개.
- 버전을 바꾸면 검색 결과·상세·상속이 그 버전의 공식 자료로 바뀐다. 마지막 선택은 브라우저에 기억된다.
- 상세의 “버전·deprecated” 탭에 **심볼 × 버전 존재 여부 매트릭스**(있음/deprecated/없음)가 있다.

## 구조

화면(View) · 컨트롤러 · 도메인/모델을 나눴다. 도메인은 화면·네트워크를 모르는 순수 함수라 브라우저 없이 테스트한다.

| 경로 | 층 | 역할 |
|---|---|---|
| `scripts/*.mjs` | 데이터 파이프라인 | 호스팅된 버전 탐색, 전 버전 `api.json` 수집(출처 manifest), 정규화·한국어 층 검증·가용성 계산. 한국어 층이 없는 항목을 가리키면 **빌드 실패** |
| `data/ko/<API>.json` | 데이터 | 한국어 설명 층(출처·AI 여부·검토 상태·예제). 사실(타입·기본값 등)은 담지 않음 |
| `data/aliases.json`, `data/intents.json` | 데이터 | 한국어 별칭 / 기능 추천용 한국어→영어 용어 사전(빌드 때 공식 자료에 실제로 나오는지 검증) |
| `data/recommend-eval*.json`, `data/verification.json` | 데이터 | 추천 평가 질문과 결과 / 예제 실행 검증 기록 |
| `src/domain/` | **도메인** | `life`(버전별 존재·도입·제거 해석) · `members`(상속 병합·필터·시그니처) · `search` · `recommend` · `ko`(한국어 상태) · `snippets` · `example` · `text` |
| `src/data.ts`, `src/types.ts` | **모델(자료 접근)** | gzip 번들 로드·캐시, 타입 |
| `src/controller/` | **컨트롤러** | `route`(URL 해시 상태) · `useSearchController`(입력 디바운스·검색·추천·키보드·선택) · `useRec` |
| `src/App.tsx`, `src/shell/`, `src/detail/`, `src/Ask.tsx`, `src/ui.tsx` | **뷰** | 조립과 그리기만 한다. 상세는 탭별 파일(`Overview`, `MemberTab`, `Life`, `Versions`, `Examples` …) |
| `src/security/` | 보안 | `sanitize`(브라우저 HTML 정화) · `csp`(CSP 단일 출처) |
| `public/example-runner.html` | 보안 | 예제 실행 전용 문서(자체 CSP, sandbox iframe 안에서만 열림) |
| `public/_headers`, `vercel.json` | 보안 | 배포 호스트용 보안 헤더(값은 `test/csp.test.ts` 가 `csp.ts` 와 일치 검사) |
| `test/` | 테스트 | 도메인·보안 설정 단위 테스트(Node 내장 러너) |

## 데이터 원칙

- 이름·자료형·기본값·상속·deprecated·since 는 **공식 api.json 에서만** 온다.
- 한국어는 별도 층. 항목마다 `kind`(official = 공식 문장 옮김 / service = 서비스 작성), AI 여부, 검토 상태를 가진다.
- 한국어는 기준 버전(1.154)에서 대조한다. 선택한 버전의 원문 해시가 기준과 다르면 **“원문과 다름 · 재검토 필요”** 로 표시한다.
  - 대조를 마친 뒤: `npm run ko:stamp -- sap.m.Table`
  - 사람이 검토했으면 해당 파일의 `provenance.review` 를 `"reviewed"` 로 바꾼다.
- 호출 형태(`o….setX()` 등)는 공식 메타데이터로 기계 생성한 것이며 “실행 검증 안 함”으로 표시한다. 실행 검증된 예제는 `data/ko` 의 `examples` 뿐이다.

## 고지

- ERP Lens(이전 이름 UI5 Lens, SAP Lens) 는 SAP 와 무관한 학생 프로젝트이며, SAP 가 보증하거나 후원하지 않습니다. SAP, SAPUI5, OpenUI5 는 SAP SE 의 상표입니다.
- 화면의 API 구조·영문 설명은 ui5.sap.com 이 공개한 `api.json` 에서 가져옵니다(이 저장소에는 그 원본을 담지 않고, `npm run fetch:api` 로 직접 받습니다). 원본의 저작권과 이용 조건은 SAP 에 있습니다. 가져온 자료를 담은 빌드 결과(`dist/`)를 웹에 배포하기 전에 해당 이용 조건을 확인하세요.
- 한국어 설명은 AI 가 작성한 초안이며 대부분 사람이 검토하지 않았습니다. 틀릴 수 있으니 항목마다 있는 공식 원문 링크로 확인하세요.
- 예제는 데이터 파일(`data/ko`)에 있는 코드만 격리된 iframe(`sandbox="allow-scripts"`)의 전용 문서에서 실행합니다. 보안 설계와 알려진 한계는 `SECURITY.md` 를 보세요.
- 코드 라이선스는 아직 정하지 않았습니다(라이선스 파일이 없으면 기본적으로 모든 권리가 작성자에게 있습니다).

