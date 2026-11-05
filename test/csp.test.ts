import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CSP, RUNNER_CSP, PERMISSIONS_POLICY } from '../src/security/csp.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('앱 CSP: 기본 차단, 인라인 스크립트·eval·외부 출처 없음', () => {
  assert.match(APP_CSP, /default-src 'none'/);
  assert.doesNotMatch(APP_CSP, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(APP_CSP, /https?:/); // 외부 출처 허용 없음
  assert.match(APP_CSP, /object-src 'none'/);
  assert.match(APP_CSP, /base-uri 'none'/);
  assert.match(APP_CSP, /form-action 'none'/);
});

test('러너 CSP: UI5 CDN 외 출처 없음(eval 은 이 문서에 한정)', () => {
  const origins = RUNNER_CSP.match(/https?:\/\/[^\s;]+/g) ?? [];
  assert.ok(origins.length > 0 && origins.every((o) => o === 'https://ui5.sap.com'));
  assert.match(RUNNER_CSP, /default-src 'none'/);
  assert.match(RUNNER_CSP, /frame-src 'none'/);
});

test('예제 러너 HTML 의 meta CSP 가 단일 출처 값과 같다', () => {
  const html = read('public/example-runner.html');
  assert.ok(html.includes(`content="${RUNNER_CSP}"`), 'public/example-runner.html 의 CSP 가 src/security/csp.ts 와 다름');
});

test('public/_headers 의 CSP·보안 헤더가 단일 출처 값과 같다', () => {
  const h = read('public/_headers');
  assert.ok(h.includes(`Content-Security-Policy: ${APP_CSP}; frame-ancestors 'none'`));
  assert.ok(h.includes(`Content-Security-Policy: ${RUNNER_CSP}; frame-ancestors 'self'`));
  assert.ok(h.includes(`Permissions-Policy: ${PERMISSIONS_POLICY}`));
  assert.match(h, /X-Content-Type-Options: nosniff/);
  assert.match(h, /X-Frame-Options: DENY/);
});

test('vercel.json 의 헤더가 단일 출처 값과 같고, 러너만 같은 출처 iframe 을 허용한다', () => {
  const v = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const get = (src: string, key: string) => v.headers.find((x) => x.source === src)?.headers.find((x) => x.key === key)?.value;
  assert.equal(get('/', 'Content-Security-Policy'), `${APP_CSP}; frame-ancestors 'none'`);
  assert.equal(get('/index.html', 'Content-Security-Policy'), `${APP_CSP}; frame-ancestors 'none'`);
  assert.equal(get('/example-runner.html', 'Content-Security-Policy'), `${RUNNER_CSP}; frame-ancestors 'self'`);
  assert.equal(get('/', 'X-Frame-Options'), 'DENY');
  assert.equal(get('/example-runner.html', 'X-Frame-Options'), undefined); // 러너는 앱 안에서 열려야 하므로 DENY 를 걸면 안 된다
});

test('예제 iframe 의 sandbox 속성값은 정확히 allow-scripts 뿐이다(코드 확인)', () => {
  const src = read('src/detail/Examples.tsx');
  const values = [...src.matchAll(/sandbox="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(values.length >= 1);
  assert.deepEqual([...new Set(values)], ['allow-scripts']); // 주석에 같은 문자열이 있어도 값의 집합은 하나. allow-same-origin·allow-top-navigation·allow-popups 등이 없어야 한다
});

test('위험한 API 사용 지점이 정해진 한 곳에 한정된다', () => {
  // dangerouslySetInnerHTML 은 ui.tsx(정화 후) 한 곳, eval/new Function 은 앱 소스에 없다(러너 문서에만 있음).
  const files = ['App.tsx', 'Ask.tsx', 'ui.tsx', 'data.ts', 'detail/Detail.tsx', 'detail/Examples.tsx', 'detail/Life.tsx', 'detail/MemberTab.tsx', 'detail/Overview.tsx', 'detail/Versions.tsx', 'shell/Landing.tsx', 'shell/Scope.tsx', 'shell/Card.tsx'];
  const users = files.filter((f) => /dangerouslySetInnerHTML/.test(read(`src/${f}`)));
  assert.deepEqual(users, ['ui.tsx']);
  assert.match(read('src/ui.tsx'), /sanitizeHtml/);
  for (const f of files) assert.doesNotMatch(read(`src/${f}`), /\beval\(|new Function\(|document\.write\(|\.outerHTML\s*=/);
});
