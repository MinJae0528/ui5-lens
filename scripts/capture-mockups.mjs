// docs/mockups/screens.html 의 화면별 목업을 라이트·다크 두 벌 docs/assets/mockups/*.png 로 만든다. 서버 필요 없음.  사용: npm run docs:mockups
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const OUT = 'docs/assets/mockups';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const names = { m1: '01-home', m2: '02-detail', m3: '03-abap-syntax', m4: '04-abap-tcode', m5: '05-theme-toggle', m6: '06-compare-list', m7: '07-compare-link', m8: '08-compare-states' };
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(pathToFileURL(resolve('docs/mockups/screens.html')).href);
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  const suffix = theme === 'dark' ? '-dark' : '';
  for (const [id, name] of Object.entries(names)) {
    await page.locator(`#${id}`).screenshot({ path: `${OUT}/${name}${suffix}.png` });
    console.log('저장', `${OUT}/${name}${suffix}.png`);
  }
  await page.close();
}
await browser.close();
