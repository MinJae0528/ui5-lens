// 예제 실행 규약. 앱과 검증 스크립트(scripts/verify-examples.mjs)가 같은 실행 방식을 쓴다.
// 예제는 전용 페이지(public/example-runner.html)를 sandbox iframe 으로 열고 postMessage 로 코드를 전달해 실행한다.
// (앱 본체에는 엄격한 CSP 를 걸고, 예제 페이지에만 UI5 CDN·eval 허용을 따로 준다.)

/** 예제를 검증하고 실행하는 UI5 버전(정확한 패치 버전) */
export const EXAMPLE_UI5_VERSION = '1.154.0';

export interface RunMessage { type: 'run'; code: string; version: string }
export const isSafeUi5Version = (v: string): boolean => /^1\.\d{1,3}\.\d{1,3}$/.test(v);

export function runMessage(code: string, version: string = EXAMPLE_UI5_VERSION): RunMessage {
  if (!isSafeUi5Version(version)) throw new Error(`허용되지 않는 UI5 버전 문자열: ${version}`);
  return { type: 'run', code, version };
}
