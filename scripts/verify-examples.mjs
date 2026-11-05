// data/ko/*.json 의 예제를 실제 UI5(CDN)에서 실행해 결과를 data/verification.json 에 기록한다.
// 통과 기준: ① 예제 실행 중 오류(console.error/pageerror) 없음 ② check 셀렉터가 expectCount 개 이상 렌더링됨.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { EXAMPLE_UI5_VERSION as UI5_VERSION, runMessage } from '../src/domain/example.ts';

// 앱과 같은 실행 방식: 전용 페이지(public/example-runner.html)를 열고 postMessage 로 코드를 전달한다.
const RUNNER = readFileSync('public/example-runner.html', 'utf8');

const only = process.argv[2];
const files = readdirSync('data/ko').filter((f) => f.endsWith('.json'));
const result = {};
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let failed = 0;
for (const f of files) {
  const ko = JSON.parse(readFileSync(`data/ko/${f}`, 'utf8'));
  if (only && ko.api !== only) continue;
  result[ko.api] = {};
  for (const ex of ko.examples || []) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    let status = 'passed', detail = '', actualVersion = null, count = 0;
    try {
      await page.route('http://ui5-lens.test/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: RUNNER }));
      await page.goto('http://ui5-lens.test/example-runner.html', { waitUntil: 'load' });
      // 최상위 문서에서는 window.parent === window 이므로 러너의 발신자 검사를 통과한다.
      await page.evaluate((m) => window.postMessage(m, '*'), runMessage(ex.code));
      await page.waitForFunction(() => window.sap && sap.ui && sap.ui.version, null, { timeout: 30000 });
      actualVersion = await page.evaluate(() => sap.ui.version);
      await page.waitForSelector(ex.check, { timeout: 20000 });
      await page.waitForTimeout(500);
      count = await page.locator(ex.check).count();
      if (count < (ex.expectCount ?? 1)) { status = 'failed'; detail = `${ex.check} ${count}개 (기대 ≥ ${ex.expectCount})`; }
      if (errors.length) { status = 'failed'; detail += ' ' + errors.join(' | '); }
    } catch (e) {
      status = 'failed'; detail = e.message.split('\n')[0] + (errors.length ? ' | ' + errors.join(' | ') : '');
    }
    await page.close();
    if (status !== 'passed') failed++;
    result[ko.api][ex.id] = { status, requestedVersion: UI5_VERSION, actualVersion, ranAt: new Date().toISOString(), check: `${ex.check} ≥ ${ex.expectCount ?? 1} (실제 ${count})`, detail: detail.trim() || undefined };
    console.log(`${status.toUpperCase()}  ${ko.api} / ${ex.id}  (sap.ui.version ${actualVersion}, ${ex.check}=${count}) ${detail}`);
  }
}
await browser.close();
let prev = {};
try { prev = JSON.parse(readFileSync('data/verification.json', 'utf8')); } catch {}
writeFileSync('data/verification.json', JSON.stringify({ ...prev, ...result }, null, 2) + '\n');
process.exit(failed ? 1 : 0);
