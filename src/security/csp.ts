// Content-Security-Policy 의 단일 출처. 같은 문자열이 vite 빌드(meta), public/_headers, vercel.json,
// public/example-runner.html 에 복사되므로, test/csp.test.ts 가 모두 이 값과 같은지 확인한다.

/** 앱 본체: 같은 출처만 허용. 인라인 스크립트·eval·외부 출처 없음. */
export const APP_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** 예제 실행 전용 문서(sandbox iframe 안에서만 열림): UI5 CDN 과 eval 만 이 문서에 한해 허용. */
export const RUNNER_CSP = [
  "default-src 'none'",
  "script-src https://ui5.sap.com 'unsafe-inline' 'unsafe-eval'",
  "style-src https://ui5.sap.com 'unsafe-inline'",
  "img-src https://ui5.sap.com data: blob:",
  "font-src https://ui5.sap.com data:",
  "connect-src https://ui5.sap.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';
