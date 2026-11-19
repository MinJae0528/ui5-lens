// 실제 앱 화면을 라이트·다크 두 벌로 docs/assets/screens 에 캡처한다(문서용). 개발 서버가 떠 있어야 한다.  사용: npm run docs:screens
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'docs/assets/screens';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'msedge', headless: true });
const U = 'http://localhost:5173/';
for (const scheme of ['light', 'dark']) {
  const sfx = scheme === 'dark' ? '-dark' : '';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto(U); await p.waitForSelector('#q'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/01-home${sfx}.png` });
  await p.fill('#q', 'Table');
  await p.waitForSelector('#cands .card', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/02-candidates${sfx}.png` });
  await p.click('#cands .card >> nth=0');
  await p.waitForSelector('.api-name'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/03-detail${sfx}.png` });
  await p.goto(U + '#m=abap'); await p.reload(); await p.waitForSelector('.member-head', { timeout: 15000 }); await p.waitForTimeout(500);
  await p.click('.member-head >> nth=0'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/04-abap-syntax${sfx}.png` });
  await p.goto(U + '#m=abap&az=tcode'); await p.reload(); await p.waitForSelector('.member-head', { timeout: 15000 }); await p.waitForTimeout(500);
  await p.click('.member-head >> nth=0'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/05-abap-tcode${sfx}.png` });
  await ctx.close();
}
await b.close();
console.log('done');
