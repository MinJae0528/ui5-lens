// 완료 기준(9번) 사용자 흐름을 실제 브라우저(Edge)로 검증한다.  사용: 서버를 띄운 뒤  node scripts/e2e.mjs [URL] [스크린샷 폴더]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const names = (page) => page.$$eval('#cands .card-name', (els) => els.map((e) => e.textContent));
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };

const cspViolations = [];
async function fresh(viewport = { width: 1400, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && /Content[- ]Security[- ]Policy|Refused to (load|execute|apply|connect|frame)/i.test(m.text())) cspViolations.push(m.text().slice(0, 200)); });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.errs = errs;
  await page.goto(URL_);
  await page.waitForSelector('#q');
  return page;
}
async function type(page, text) {
  await page.fill('#q', text);
  // 디바운스가 끝나 검색어가 확정(URL 반영)되고 "검색 중…" 이 사라질 때까지 대기
  await page.waitForFunction((t) => new URLSearchParams(location.hash.replace(/^#\??/, '')).get('q') === t && !document.querySelector('.search-status')?.textContent.includes('검색 중'), text, { timeout: 5000 });
  await page.waitForSelector('#cands .card, .empty, .rec-list .rec', { timeout: 5000 });
}
async function inl(page, text) {
  await page.fill('.inline-search', text);
  await page.waitForFunction((t) => new URLSearchParams(location.hash.replace(/^#\??/, '')).get('mq') === (t || null), text);
}

// ---- 1. 검색 전 상태
let page = await fresh();
check('검색 전: 안내와 한국어 지원 범위 표시', (await page.textContent('.detail-empty .landing')).includes('한국어 설명이 준비된 API'));
check('범위 칩에 버전·개수 표시', /1\.154/.test(await page.textContent('.scope-chip')));
check('버전 선택: 호스팅된 31개 버전', (await page.$$eval('#ver option', (o) => o.length)) === 31);
await shot(page, '01-initial');

// ---- 2. Table 검색 → 동명 API 분리
await type(page, 'Table');
let list = await names(page);
check('Table: sap.m.Table 과 sap.ui.table.Table 이 각각 후보로 표시', list.includes('sap.m.Table') && list.includes('sap.ui.table.Table'), list.slice(0, 4).join(', '));
check('Table: 이름이 정확히 일치하는 두 후보가 상단 2개', new Set(list.slice(0, 2)).has('sap.m.Table') && new Set(list.slice(0, 2)).has('sap.ui.table.Table'));
check('후보 중복 없음', new Set(list).size === list.length);
const card0 = await page.textContent('#cands .card');
check('후보 카드: 라이브러리·종류·한국어 상태·용도 표시', /sap\.(m|ui\.table)/.test(card0) && card0.includes('class') && card0.includes('주로 사용하는 상황') && /AI 초안/.test(card0));
await shot(page, '02-table-candidates');

// ---- 3. 전체 이름/대소문자/별칭
await type(page, 'sap.m.table');
list = await names(page);
check('대소문자 변형 sap.m.table → 공식 표기 sap.m.Table 이 1순위', list[0] === 'sap.m.Table', list[0]);
check('1순위 사유: 전체 이름 일치', (await page.textContent('#cands .card .reasons')).includes('전체 이름 일치'));
await type(page, '표');
list = await names(page);
check('한국어 별칭 “표” → 두 Table', list.includes('sap.m.Table') && list.includes('sap.ui.table.Table'), list.join(', '));
await type(page, '팝업');
list = await names(page);
check('한국어 별칭 “팝업” → sap.m.Dialog 포함', list.includes('sap.m.Dialog'), list.join(', '));
await type(page, '입력창');
check('한국어 별칭 “입력창” → sap.m.Input', (await names(page))[0] === 'sap.m.Input');
await type(page, 'Dialog');
list = await names(page);
check('짧은 이름 Dialog → sap.m.Dialog 상단', list.slice(0, 3).includes('sap.m.Dialog'), list.slice(0, 3).join(', '));

// ---- 4. 없는 API
await type(page, 'ZzzNotAnApi');
check('결과 없음 상태: 안내 표시, 후보 0개', (await page.textContent('.empty')).includes('지원 범위 안에 없고') && (await names(page)).length === 0);
await shot(page, '03-empty');

// ---- 5. 상세: 섞임 없음
await type(page, 'Table');
await page.click('#cands .card:has-text("sap.ui.table.Table") >> nth=0');
await page.waitForSelector('.api-name');
check('sap.ui.table.Table 선택 → 상세 이름', (await page.textContent('.api-name')) === 'sap.ui.table.Table');
await page.click('role=tab[name=/^메서드/]');
await inl(page, 'bindRows');
check('ui.table.Table 메서드에 bindRows 있음', (await page.$$eval('.member .m-name', (e) => e.map((x) => x.textContent))).includes('bindRows'));
await inl(page, 'getPopinLayout');
check('ui.table.Table 에 sap.m.Table 의 getPopinLayout 이 섞이지 않음', (await page.$$('.member')).length === 0);
await page.click('role=tab[name=/^속성/]');
await inl(page, 'autoPopinMode');
check('ui.table.Table 속성에 sap.m.Table 의 autoPopinMode 없음', (await page.$$('.member')).length === 0);
await inl(page, 'fixedColumnCount');
check('ui.table.Table 속성에 fixedColumnCount 있음', (await page.$$('.member')).length === 1);
await page.click('.member-head');
check('항목 펼침: 한국어·영문 원문·자료형·기본값·예제 표시', await page.$eval('.member-body', (b) => ['한국어', '영문 원문', '자료형', '기본값', '복사'].every((t) => b.textContent.includes(t))));
await shot(page, '04-ui-table-property');

// 다른 후보로 이동 (상세 헤더 chip)
await page.click('.siblings .chip:has-text("sap.m.Table")');
await page.waitForFunction(() => document.querySelector('.api-name')?.textContent === 'sap.m.Table');
await page.click('role=tab[name=/^메서드/]');
await inl(page, 'bindRows');
check('sap.m.Table 메서드에 ui.table 전용 bindRows 없음', (await page.$$('.member')).length === 0);
await inl(page, 'addColumn');
check('sap.m.Table 메서드에 addColumn 있음', (await page.$$('.member')).length >= 1);
await page.click('role=tab[name=/^속성/]');
await inl(page, 'fixedColumnCount');
check('sap.m.Table 속성에 ui.table 의 fixedColumnCount 없음', (await page.$$('.member')).length === 0);

// ---- 6. 직접/상속
await inl(page, '');
const ownCount = (await page.$$('.member')).length;
check('직접 선언 기본: 모든 항목에 “직접 선언” 배지', (await page.$$eval('.member .b-inh', (e) => e.length)) === 0 && ownCount > 0, `직접 ${ownCount}개`);
await page.check('text=상속 항목 포함');
const withInh = (await page.$$('.member')).length;
const inhBadge = await page.$eval('.member .b-inh', (e) => e.textContent);
check('상속 포함: 항목 증가 및 정의된 클래스 표시', withInh > ownCount && inhBadge.startsWith('상속 · sap.'), `${ownCount} → ${withInh}, 예: ${inhBadge}`);
await page.click('role=tab[name=/^상속/]');
const chain = await page.textContent('.chain');
check('상속 탭: sap.m.Table > sap.m.ListBase > sap.ui.core.Control 체인', chain.includes('sap.m.ListBase') && chain.includes('sap.ui.core.Control'));
await shot(page, '05-inheritance');

// ---- 7. 이벤트·집합·참조
await page.click('role=tab[name=/^이벤트/]');
check('이벤트 탭에 popinChanged', (await page.textContent('.members')).includes('popinChanged'));
await page.click('role=tab[name=/^구성 요소/]');
check('구성 요소 탭에 columns', (await page.textContent('.members')).includes('columns'));
await page.click('role=tab[name=/^참조 관계/]');
check('참조 관계 탭 표시(직접 선언 없으면 안내)', (await page.textContent('.tab-body')).length > 0);

// ---- 8. 사용 조건·예제·버전
await page.click('role=tab[name=/^사용 조건/]');
const usage = await page.textContent('.tab-body');
check('사용 조건: 필수 선행 조건 / 대표 예제의 순서 / 권장 사용 방식 구분', ['필수 선행 조건', '대표 예제의 순서', '권장 사용 방식'].every((t) => usage.includes(t)));
check('사용 조건: 공식 명시와 서비스 작성 구분 배지', usage.includes('공식 문서에 명시') && usage.includes('서비스 작성'));
await page.click('role=tab[name=/^예제/]');
const ex = await page.textContent('.tab-body');
check('예제: 지원 버전에서 실행 확인 배지(검증 기록 연동)', /UI5 1\.154\.\d+ 에서 실행 확인/.test(ex));
await shot(page, '06-examples');
await page.click('role=tab[name=/^버전/]');
const ver = await page.textContent('.tab-body');
check('버전 탭: 대상 버전·출처·deprecated/제거됨/disabled 구분', ver.includes('1.154') && ver.includes('원문 해시') && ver.includes('제거됨') && ver.includes('disabled'));
await shot(page, '07-versions');

// ---- 9. 한국어 미준비 상태
await type(page, 'sap.m.Button');
await page.click('#cands .card >> nth=0');
await page.waitForFunction(() => document.querySelector('.api-name')?.textContent === 'sap.m.Button');
check('한국어 미준비 API: 안내 표시 + 영문 원문 제공', (await page.textContent('.tab-body')).includes('한국어 설명이 아직 준비되지 않았습니다') && (await page.textContent('.tab-body')).includes('영문 원문'));
await shot(page, '08-ko-missing');
check('콘솔/페이지 오류 없음(데스크톱 흐름)', page.errs.length === 0, page.errs.join('|'));
await page.context().close();

// ---- 10. 키보드
page = await fresh();
await type(page, 'Table');
await page.press('#q', 'ArrowDown');
const activeId = await page.getAttribute('#q', 'aria-activedescendant');
check('키보드: ArrowDown 으로 활성 후보 이동(aria-activedescendant)', activeId === 'cand-1', activeId);
const second = (await names(page))[1];
await page.press('#q', 'Enter');
await page.waitForFunction((n) => document.querySelector('.api-name')?.textContent === n, second);
check('키보드: Enter 로 활성 후보 선택', (await page.textContent('.api-name')) === second, second);
await page.context().close();

// ---- 11. 로딩·오류 상태
page = await fresh();
await page.route('**/data/v/1.154/lib/sap.m.json.gz', async (r) => { await new Promise((s) => setTimeout(s, 1200)); r.continue(); });
await type(page, 'Table');
await page.click('#cands .card:has-text("sap.m.Table") >> nth=0');
check('상세 로딩 상태 표시', await page.waitForSelector('text=상세 정보를 불러오는 중', { timeout: 1000 }).then(() => true, () => false));
await page.waitForSelector('.api-name');
await page.unroute('**/data/v/1.154/lib/sap.m.json.gz');
await page.route('**/data/v/1.154/lib/sap.ui.table.json.gz', (r) => r.abort());
await page.click('.siblings .chip:has-text("sap.ui.table.Table")');
await page.waitForSelector('[role=alert]:has-text("공식 자료를 조회하지 못했습니다")');
check('조회 실패 상태: 오류 안내 + 가짜 데이터 대체 안 함', (await page.textContent('[role=alert]')).includes('대신 채우지 않습니다'));
await shot(page, '09-error');
await page.unroute('**/data/v/1.154/lib/sap.ui.table.json.gz');
await page.click('text=다시 시도');
await page.waitForFunction(() => document.querySelector('.api-name')?.textContent === 'sap.ui.table.Table');
check('다시 시도하면 복구', true);
await page.context().close();

// ---- 12. 작은 화면: 목록 복귀 시 검색어·스크롤 유지
page = await fresh({ width: 420, height: 800 });
await type(page, 'a'); // 결과가 많은 검색
const n = (await names(page)).length;
await page.$eval('.cands', (el) => { el.scrollTop = 1500; });
await page.waitForTimeout(150);
const before = await page.$eval('.cands', (el) => el.scrollTop);
const target = await page.$eval('#cands .card:nth-child(14) .card-name', (e) => e.textContent).catch(() => null);
await page.evaluate(() => { const li = [...document.querySelectorAll('#cands .card')].find((c) => c.getBoundingClientRect().top > 100); li.click(); });
await page.waitForSelector('.api-name');
check('작은 화면: 상세 열면 목록 숨김, 내용 잘림 없음(가로 스크롤 없음)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await shot(page, '10-mobile-detail');
await page.click('text=← 후보 목록');
await page.waitForSelector('#cands .card');
const after = await page.$eval('.cands', (el) => el.scrollTop);
check('목록 복귀: 검색어 유지', (await page.inputValue('#q')) === 'a');
check('목록 복귀: 스크롤 위치 유지', before > 0 && Math.abs(after - before) < 3, `${before} → ${after} (후보 ${n}개)`);
await shot(page, '11-mobile-list');
await page.goBack().catch(() => {});
await page.context().close();

// ---- 13. 새로고침/URL 복원
page = await fresh();
await page.goto(URL_ + '#?q=Table&api=sap.ui.table.Table&tab=method&inh=1');
await page.waitForSelector('.api-name');
check('URL 해시로 상태 복원(검색어·API·탭·상속 포함)', (await page.inputValue('#q')) === 'Table' && (await page.textContent('.api-name')) === 'sap.ui.table.Table' && (await page.isChecked('text=상속 항목 포함')));
await page.context().close();


// ---- 14. 다중 버전
page = await fresh();
await page.selectOption('#ver', '1.71');
await page.waitForFunction(() => document.querySelector('.scope-chip')?.textContent.includes('1.71.'));
check('버전 전환: 1.71 로 바뀌고 URL(v) 반영', (await page.evaluate(() => location.hash)).includes('v=1.71'));
await type(page, 'Table');
list = await names(page);
check('1.71 에서도 Table 검색 → 두 후보', list.includes('sap.m.Table') && list.includes('sap.ui.table.Table'), list.slice(0, 3).join(', '));
await page.click('#cands .card:has-text("sap.m.Table") >> nth=0');
await page.waitForSelector('.api-name');
check('1.71 상세: 대상 버전 1.71.x 표시', /UI5 1\.71\./.test(await page.textContent('.detail-head')));
const note71 = await page.textContent('.tab-body');
check('1.71: 한국어(1.154 기준)가 이 버전 원문과 달라 재검토 필요 경고', note71.includes('달라서 재검토가 필요') && note71.includes('1.154'));
await page.click('role=tab[name=/^버전/]');
check('버전 탭: 버전별 존재 여부 매트릭스(31칸)', (await page.$$('.avail .av')).length === 31);
await page.reload();
await page.waitForSelector('.api-name');
check('새로고침 후에도 선택 버전 유지', /1\.71/.test(await page.inputValue('#ver')) );
await page.context().close();

// 선택한 버전 기억(localStorage) — 같은 컨텍스트에서 다시 열면 마지막 버전
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p1 = await ctx.newPage();
  await p1.goto(URL_); await p1.waitForSelector('#ver');
  await p1.selectOption('#ver', '1.96');
  await p1.waitForFunction(() => document.querySelector('.scope-chip')?.textContent.includes('1.96.'));
  const p2 = await ctx.newPage();
  await p2.goto(URL_); await p2.waitForSelector('#ver');
  check('마지막으로 고른 버전을 기억(새 탭에서 1.96)', (await p2.inputValue('#ver')) === '1.96');
  await ctx.close();
}

// 버전에 따라 없는 API: rowmodes.Fixed 는 1.120 에 있고 1.114 에는 없다
page = await fresh();
await page.goto(URL_ + '#?v=1.120&q=rowmodes&api=sap.ui.table.rowmodes.Fixed&tab=versions');
await page.waitForSelector('.avail');
const cell = async (m) => page.$eval(`.avail .av:has(.av-v:text-is("${m}"))`, (e) => e.className);
const c120 = await cell('1.120'), c114 = await cell('1.114');
check('가용성: 1.120 은 있음(초록), 1.114 는 없음', c120.includes('av-1') && c114.includes('av-0'), `${c120} / ${c114}`);
await page.click('.avail .av:has(.av-v:text-is("1.114"))');
await page.waitForSelector('[role=alert]:has-text("공식 자료에 없습니다")');
check('없는 버전으로 전환: “없음” 안내, 내용을 지어내지 않음', (await page.textContent('[role=alert]')).includes('추측하지 않습니다'));
await shot(page, '12-not-in-version');
await page.click('[role=alert] .btn:has-text("로 보기") >> nth=0');
await page.waitForSelector('.api-name');
check('“로 보기” 로 존재하는 버전에 복귀', (await page.textContent('.api-name')) === 'sap.ui.table.rowmodes.Fixed');
await page.context().close();

// 가장 오래된 버전(1.38)과 범위 패널
page = await fresh();
await page.selectOption('#ver', '1.38');
await page.waitForFunction(() => document.querySelector('.scope-chip')?.textContent.includes('1.38.'));
await type(page, 'Button');
check('1.38 에서 sap.m.Button 검색 가능', (await names(page)).includes('sap.m.Button'));
await page.click('.scope-chip');
check('범위 패널: 받아 둔 버전 31개와 미호스팅 안내', (await page.textContent('.scope')).includes('31개') && (await page.textContent('.scope')).includes('호스팅'));
await shot(page, '13-scope');
await page.context().close();

// ---- 15. 멤버 단위 버전 판정
page = await fresh();
// 1.71 에는 없는 sap.m.Table 의 autoPopinMode (since 1.52 가 아님 → 최근 도입)
await page.goto(URL_ + '#?v=1.120&q=Table&api=sap.m.Table&tab=property&mq=autoPopinMode');
await page.waitForSelector('.member-head');
await page.click('.member-head >> nth=0');
await page.waitForSelector('.life .avail .av');
const life120 = await page.textContent('.life');
check('멤버 판정: 1.120 에서 autoPopinMode 사용 가능', life120.includes('사용 가능'), life120.slice(0, 120));
check('멤버 판정: 받아 둔 31개 버전 칸', (await page.$$('.life .avail .av')).length === 31);
const c71 = await page.$eval('.life .av:has(.av-v:text-is("1.71"))', (e) => e.className);
const c154 = await page.$eval('.life .av:has(.av-v:text-is("1.154"))', (e) => e.className);
check('멤버 판정: autoPopinMode 1.71 없음 / 1.154 있음', c71.includes('av-0') && c154.includes('av-1'), `${c71} / ${c154}`);
await page.click('.life .av:has(.av-v:text-is("1.71"))');
await page.waitForFunction(() => document.querySelector('.scope-chip')?.textContent.includes('1.71.'));
// 1.71 로 바꾸면 이 항목은 목록에 없다(그 버전 자료에 없음) → 상세 탭에서 “다른 버전에 있는 항목” 확인
await page.goto(URL_ + '#?v=1.71&q=Table&api=sap.m.Table&tab=versions');
await page.waitForSelector('text=지금 버전');
await page.waitForFunction(() => document.querySelector('.tab-body')?.textContent.includes('autoPopinMode'));
{
  // 표의 해당 행을 직접 본다(설명 문단에도 같은 문구가 있어 페이지 전체 텍스트로는 검증이 안 된다).
  const row = page.locator('tr[data-relation]:has(td.mono:text-is("autoPopinMode"))');
  check('1.71 버전 탭: autoPopinMode 는 “이 버전 이후 버전에서 도입됨”(아직 도입 전)', (await row.getAttribute('data-relation')) === 'not-yet' && (await row.textContent()).includes('이 버전 이후 버전에서 도입됨'));
}
// 최신 1.154 에서 사라진 메서드: sap.m.Table.enhanceAccessibilityState (1.52~1.130)
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=versions');
await page.waitForFunction(() => document.querySelector('.tab-body')?.textContent.includes('enhanceAccessibilityState'));
{
  const row = page.locator('tr[data-relation]:has(td.mono:text-is("enhanceAccessibilityState"))');
  check('1.154: enhanceAccessibilityState 는 “이 버전 이전에 있다가 사라짐”(과거 버전에만 있음)', (await row.getAttribute('data-relation')) === 'removed' && (await row.textContent()).includes('이 버전 이전에 있다가 사라짐'));
}
await shot(page, '14-member-life');
await page.context().close();

// ---- 16. 기본 버전 = 한국어 기준 버전 1.154 (SAP CODE 아카데미 사용 버전)
page = await fresh();
check('기본 선택 버전이 1.154', (await page.inputValue('#ver')) === '1.154');
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=overview');
await page.waitForSelector('.api-name');
check('1.154 에서는 한국어 “재검토 필요” 경고가 없음', !(await page.textContent('.tab-body')).includes('달라서 재검토가 필요'));
await page.goto(URL_ + '#?v=1.120&q=Table&api=sap.m.Table&tab=overview');
await page.waitForFunction(() => document.querySelector('.scope-chip')?.textContent.includes('1.120.'));
check('1.120 에서는 기준(1.154)과 달라 경고', (await page.textContent('.tab-body')).includes('달라서 재검토가 필요'));
await page.context().close();

// ---- 17. 통합 검색: 이름이 없으면 기능 설명으로 해석해 추천
page = await fresh();
check('모드 탭이 없음(검색창 하나로 이름·기능 모두)', (await page.$$('.mode-tabs')).length === 0 && await page.isVisible('#q'));
await type(page, '댓글을 다는 기능을 추가하고 싶어');
await page.waitForSelector('.rec-list .rec');
const recs = await page.$$eval('.rec-list .rec .card-name', (e) => e.map((x) => x.textContent.replace(/^\d+/, '')));
check('추천: 기본 3개만 표시', recs.length === 3, recs.join(', '));
check('추천: 댓글 → FeedInput, FeedListItem 계열이 상위', recs.includes('sap.m.FeedInput') && recs.some((n) => n.startsWith('sap.m.Feed')), recs.join(', '));
const why = await page.textContent('.rec-list .rec .reasons');
check('추천: “왜 추천?” 근거(공식 용어와 위치) 표시', why.includes('왜 추천') && why.includes('이름'));
check('추천: 질문 해석(댓글 → feed …) 공개', (await page.textContent('.interp')).includes('댓글') && (await page.textContent('.interp')).includes('feed'));
check('추천: AI 아님·보증 안 함·자체 평가 정확도를 함께 표시', await (async () => { const t = await page.textContent('.rec-sec'); return t.includes('AI 아님') && t.includes('보증하지 않') && /\d+%/.test(t); })());
check('추천: 더 보기로 8개까지', await (async () => { await page.click('text=더 보기'); return (await page.$$('.rec-list .rec')).length === 8; })());
await page.click('.rec-list .rec >> nth=0');
await page.waitForSelector('.api-name');
check('추천 카드 선택 → 해당 API 상세 열림', (await page.textContent('.api-name')) === recs[0]);
await page.context().close();

page = await fresh();
await type(page, 'Table');
check('이름이 정확히 있으면 추천 상자를 띄우지 않음(이름 검색 우선)', (await page.$$('.rec-sec')).length === 0 && (await page.$$('.card')).length > 0);
await page.context().close();

page = await fresh();
await type(page, 'ㅁㄴㅇㄹ');
await page.waitForSelector('.empty');
check('해석 못 하는 질문: 지어내지 않고 안내', (await page.textContent('.empty')).includes('만들어 보여 주지 않습니다') && (await page.$$('.rec')).length === 0);
await page.context().close();

page = await fresh();
await page.goto(URL_ + '#?v=1.71&q=' + encodeURIComponent('날짜를 고르고 싶어'));
await page.waitForSelector('.rec-list .rec');
check('다른 버전(1.71)에서도 그 버전 자료로 추천', (await page.textContent('.rec-list')).includes('DatePicker'));
await page.context().close();

// ---- 18. 첫 화면·한눈에 보기·표기
page = await fresh();
check('첫 화면(데스크톱): 오른쪽에 시작 안내와 예시, 소개', await page.isVisible('.detail-empty .landing') && (await page.textContent('.detail-empty .about')).includes('학습자용') && (await page.textContent('.detail-empty .about')).includes('Demo Kit'));
check('첫 화면: 자체 평가 정확도 공개', /자체 평가에서 새 질문 \d+개 중 \d+%/.test(await page.textContent('.detail-empty .about')));
await page.click('.detail-empty .chip >> nth=0');
await page.waitForSelector('.rec-list .rec');
check('첫 화면 예시 클릭 → 바로 추천 결과', (await page.$$('.rec-list .rec')).length === 3);
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table');
await page.waitForSelector('.glance');
const gl = await page.textContent('.glance');
check('상세 맨 위 한눈에 보기: “1.154 에서 사용 가능”과 31개 점', gl.includes('1.154 에서 사용 가능') && (await page.$$('.glance .dot')).length === 31);
await page.click('.glance .dot >> nth=3');
await page.waitForFunction(() => !document.querySelector('.scope-chip')?.textContent.includes('1.154.'));
check('점을 누르면 그 버전으로 전환', !(await page.textContent('.scope-chip')).includes('1.154.'));
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=versions');
await page.waitForSelector('.life-list');
const vt = await page.textContent('.tab-body');
check('클래스 버전 탭: 도입 표기(≤ 또는 정확한 도입)와 계산값 고지', (vt.includes('≤') || vt.includes('에서 도입') || vt.includes('사이에 도입')) && vt.includes('Lens 가 버전끼리 비교해 계산'));
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=property&mq=autoPopinMode');
await page.waitForSelector('.member-head');
await page.click('.member-head >> nth=0');
await page.waitForSelector('.life .life-list');
const lt = await page.textContent('.life');
check('멤버: autoPopinMode 는 1.71(없음)·1.84(있음) 사이 도입으로 표기(그 사이 버전은 서버에 없음)', lt.includes('사이에 도입') && lt.includes('1.71') && lt.includes('1.84'), lt.slice(0, 220));
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=method&mq=enhanceAccessibilityState');
await page.context().close();

// ---- 19. 예제 실행(격리된 iframe + 전용 페이지) — 인터넷(UI5 CDN) 필요
page = await fresh();
await page.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table&tab=examples');
await page.waitForSelector('.example');
await page.click('.example >> nth=0 >> text=실행해 보기');
await page.waitForSelector('iframe.runframe');
const fe = await page.$eval('iframe.runframe', (f) => ({ sandbox: f.getAttribute('sandbox'), src: f.getAttribute('src') }));
check('예제 iframe: sandbox 는 allow-scripts 만(allow-same-origin 없음), 전용 페이지를 연다', fe.sandbox === 'allow-scripts' && /example-runner\.html$/.test(fe.src), JSON.stringify(fe));
const runner = await (async () => { for (let i = 0; i < 60; i++) { const f = page.frames().find((x) => /example-runner\.html/.test(x.url())); if (f) { try { if (await f.locator('.sapMListTbl tbody tr.sapMListTblRow').count() >= 1) return f; } catch {} } await page.waitForTimeout(500); } return null; })();
check('예제 iframe: 실제로 UI5 테이블이 렌더링됨(postMessage 로 코드 전달)', !!runner);
check('예제 iframe 안에서 부모 저장소에 접근 불가(opaque origin)', await (async () => { const f = page.frames().find((x) => /example-runner\.html/.test(x.url())); if (!f) return false; return f.evaluate(() => { try { return typeof window.parent.document.body === 'undefined'; } catch { return true; } }); })());
await page.context().close();

// 모바일: 탭은 한 줄(가로 스크롤), 머리글은 낮게
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const mp = await ctx.newPage();
  await mp.goto(URL_ + '#?v=1.154&q=Table&api=sap.m.Table');
  await mp.waitForSelector('.glance');
  const tabsH = await mp.$eval('.tabs', (e) => e.getBoundingClientRect().height);
  const topH = await mp.$eval('.top', (e) => e.getBoundingClientRect().height);
  check('모바일: 탭이 한 줄(높이 70px 이하)', tabsH <= 70, `${tabsH}`);
  check('모바일: 머리글이 낮음(높이 70px 이하)', topH <= 70, `${topH}`);
  const noScroll = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('모바일: 가로 스크롤 없음', noScroll);
  await ctx.close();
}

// ---- 20. 보안: CSP 가 적용된 빌드(preview)에서 위반이 없어야 한다
{
  const p = await fresh();
  const hasCsp = !!(await p.$('meta[http-equiv="Content-Security-Policy"]'));
  console.log(hasCsp ? '(이 서버는 CSP meta 가 적용된 빌드입니다)' : '(이 서버는 개발 모드라 CSP meta 가 없습니다 — 빌드 결과에서 다시 확인하세요)');
  if (hasCsp) {
    const csp = await p.$eval('meta[http-equiv="Content-Security-Policy"]', (e) => e.content);
    check('CSP meta: 인라인 스크립트·eval·외부 출처 없음', !/unsafe-inline|unsafe-eval|https?:/.test(csp) && /default-src 'none'/.test(csp), csp);
  }
  check(`전 과정에서 CSP 위반 0건${hasCsp ? '' : ' (개발 모드: 참고용)'}`, cspViolations.length === 0, cspViolations.slice(0, 3).join(' | '));
  await p.context().close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
