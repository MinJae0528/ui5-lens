// HTML 정화기(src/security/sanitize.ts) 공격 페이로드 시험. dev 서버(npm run dev 또는 vite)가 떠 있어야 한다.
//   node scripts/test-sanitize.mjs [http://localhost:5173/]
// 방식: 정화 결과를 "실제 DOM 에 넣어" 스크립트가 실행되는지(window.__xss)까지 확인한다.
import { chromium } from 'playwright-core';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const X = 'window.__xss=1';
const ATTACKS = [
  `<img src=x onerror="${X}">`,
  `<script>${X}</script>`,
  `<svg onload="${X}"><circle/></svg>`,
  `<iframe srcdoc="<script>parent.${X}</script>"></iframe>`,
  `<a href="javascript:${X}">x</a>`,
  `<a href="  javascript:${X}">x</a>`,
  `<a href="JaVaScRiPt:${X}">x</a>`,
  `<a href="java&#x73;cript:${X}">x</a>`,
  `<a href="data:text/html,<script>${X}</script>">x</a>`,
  `<a href="vbscript:${X}">x</a>`,
  `<b onclick="${X}" onmouseover="${X}">b</b>`,
  `<a data-api="x&quot; onclick=&quot;${X}">x</a>`,
  `<a data-api='x" onclick="${X}'>x</a>`,
  `<p style="background:url(javascript:${X})">p</p>`,
  `<math><mtext><table><mglyph><style><img src=x onerror="${X}">`,
  `<form><math><mtext></form><form><mglyph><style></math><img src onerror="${X}">`,
  `<noscript><p title="</noscript><img src=x onerror=${X}>">`,
  `<svg><style><img src=x onerror="${X}"></style></svg>`,
  `<object data="javascript:${X}"></object><embed src="javascript:${X}">`,
  `<input autofocus onfocus="${X}">`,
  `<details open ontoggle="${X}">d</details>`,
  `<video><source onerror="${X}"></video>`,
  `<link rel=stylesheet href="javascript:${X}"><meta http-equiv=refresh content="0;url=javascript:${X}">`,
  `<base href="javascript:${X}//"><a href="x">x</a>`,
  `<b <img src=x onerror="${X}">>t</b>`,
  `<textarea><img src=x onerror="${X}"></textarea>`,
  `<xmp><img src=x onerror="${X}"></xmp>`,
  `<!--><img src=x onerror="${X}">-->`,
  `<![CDATA[<img src=x onerror="${X}">]]>`,
  `<a href="http://ok.example/x" onclick="${X}">정상 링크지만 이벤트는 제거</a>`,
];
const KEEP = [
  ['<code>sap.m.Table</code>', '<code>sap.m.Table</code>'],
  ['<a data-api="sap.m.Table">Table</a>', '<a data-api="sap.m.Table">Table</a>'],
  ['<ul><li>one</li><li>two</li></ul>', '<ul><li>one</li><li>two</li></ul>'],
  ['<p>a <b>b</b> &amp; c</p>', '<p>a <b>b</b> &amp; c</p>'],
  ['<pre>var a = 1 &lt; 2;</pre>', '<pre>var a = 1 &lt; 2;</pre>'],
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto(URL_);
let failed = 0;
const pass = (ok, msg, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : '  ' + extra}`); };

const results = await page.evaluate(async ({ attacks, keep }) => {
  const { sanitizeHtml } = await import('/src/security/sanitize.ts');
  const ALLOWED = new Set(['code', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'p', 'br', 'pre', 'a', 'h3', 'h4', 'table', 'tr', 'td', 'th', 'thead', 'tbody']);
  const out = [];
  for (const a of attacks) {
    delete window.__xss;
    const clean = sanitizeHtml(a);
    // 1) 실제 DOM 에 넣어 실행 여부 확인
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = clean;
    await new Promise((r) => setTimeout(r, 120));
    const executed = window.__xss === 1;
    // 2) 구조 검사: 허용 태그만, 허용 속성만
    const bad = [];
    host.querySelectorAll('*').forEach((el) => {
      const t = el.tagName.toLowerCase();
      if (!ALLOWED.has(t)) bad.push('tag:' + t);
      for (const at of el.attributes) {
        const n = at.name.toLowerCase();
        const okAttr = t === 'a' && (n === 'href' || n === 'data-api' || n === 'target' || n === 'rel');
        if (!okAttr) bad.push('attr:' + n);
        if (n === 'href' && !/^https?:\/\//i.test(at.value)) bad.push('href:' + at.value);
      }
    });
    // 3) 멱등성(mXSS 징후): 한 번 더 정화해도 같아야 한다
    const stable = sanitizeHtml(clean) === clean;
    host.remove();
    out.push({ a, clean, executed, bad, stable });
  }
  const kept = keep.map(([i, exp]) => ({ i, exp, got: sanitizeHtml(i) }));
  return { out, kept, empty: [sanitizeHtml(''), sanitizeHtml('plain text')] };
}, { attacks: ATTACKS, keep: KEEP });

for (const r of results.out) {
  const ok = !r.executed && r.bad.length === 0 && r.stable;
  pass(ok, `차단: ${r.a.slice(0, 70)}`, `→ ${JSON.stringify(r.clean)} executed=${r.executed} bad=${r.bad.join(',')} stable=${r.stable}`);
}
for (const k of results.kept) pass(k.got === k.exp, `보존: ${k.i}`, `→ ${k.got}`);
pass(results.empty[0] === '' && results.empty[1] === 'plain text', '빈 문자열·평문 처리');
// 링크 보강: 정상 http 링크는 target/rel 이 강제된다
const link = await page.evaluate(async () => (await import('/src/security/sanitize.ts')).sanitizeHtml('<a href="https://ui5.sap.com/x">u</a>'));
pass(/target="_blank"/.test(link) && /rel="noreferrer noopener"/.test(link), '정상 링크에 target=_blank, rel=noreferrer noopener 강제', link);

// 대조 실험: 정화하지 않은 원본을 넣으면 실제로 실행이 감지되는지(= 이 테스트가 공격을 볼 수 있는지)
const control = await page.evaluate(async (attacks) => {
  let ran = 0;
  for (const a of attacks.slice(0, 5)) {
    delete window.__xss;
    const host = document.createElement('div'); document.body.appendChild(host);
    host.innerHTML = a; // 정화 없음
    await new Promise((r) => setTimeout(r, 150));
    if (window.__xss === 1) ran++;
    host.remove();
  }
  return ran;
}, ATTACKS);
pass(control >= 1, `대조 실험: 정화 없이 넣은 원본 페이로드 ${control}/5 개가 실제로 실행됨(감지 가능한 테스트임을 확인)`);

await browser.close();
console.log(`\n${failed ? `실패 ${failed}건` : `공격 페이로드 ${ATTACKS.length}개 모두 차단, 정상 HTML ${KEEP.length}종 보존`}`);
process.exit(failed ? 1 : 0);
