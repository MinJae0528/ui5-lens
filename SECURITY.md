# 보안 정책

UI5 Lens 는 서버·로그인·사용자 데이터 저장이 없는 정적 웹앱입니다(브라우저에 저장하는 것은 선택한 UI5 버전 문자열 하나뿐).

## 취약점 신고
취약점을 발견하면 공개 이슈 대신 GitHub 의 **Security → Report a vulnerability**(비공개 신고)로 알려 주세요.
학생 프로젝트라 응답 시간을 보장하지는 못하지만, 확인되면 수정하고 기록합니다.

## 이미 적용한 방어
- 공식 자료의 HTML 은 빌드 때 한 번, 브라우저에서 허용 목록으로 한 번 더 정화합니다(`src/security/sanitize.ts`, 공격 페이로드 30종 시험).
- 앱 본체는 Content-Security-Policy(인라인 스크립트·eval·외부 출처 없음)로 보호합니다(`src/security/csp.ts`).
- 예제 실행은 `sandbox="allow-scripts"` iframe 안의 전용 문서에서만 일어나며, 그 문서만 UI5 CDN 과 eval 을 허용합니다.
- 의존성은 Dependabot 이 점검하고, CI 가 `npm audit` 을 실행합니다.

## 알려진 한계
- 예제는 UI5 CDN(ui5.sap.com)의 스크립트를 무결성 검증(SRI) 없이 불러옵니다(UI5 는 수백 개 모듈을 동적으로 불러와 SRI 적용이 어렵습니다). 격리된 iframe 안에서만 실행됩니다.
- 배포 호스트에서 보안 헤더가 실제로 적용되는지는 호스트별로 직접 확인해야 합니다(`public/_headers`, `vercel.json` 제공).
