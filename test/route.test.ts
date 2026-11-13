import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize, isSafeApiName, DEFAULT_ROUTE, MODES, UI5_MODES, productOf, modeForProduct, switchProduct, type Route } from '../src/controller/routeState.ts';

test('기본값: 빈 해시는 이름 검색 모드', () => {
  assert.deepEqual(parse(''), DEFAULT_ROUTE);
  assert.equal(serialize(DEFAULT_ROUTE), '#');
});

test('직렬화→파싱 왕복: 모드·질문·멤버 상세·탭이 보존된다', () => {
  const r: Route = { ...DEFAULT_ROUTE, v: '1.154', m: 'name', q: 'setText', kf: 'm', api: 'sap.m.Button', mem: 'method:setText', tab: 'musage' };
  const back = parse(serialize(r));
  assert.deepEqual(back, r);
  const f: Route = { ...DEFAULT_ROUTE, m: 'feature', q: '댓글을 다는 기능' };
  assert.deepEqual(parse(serialize(f)), f);
  const b: Route = { ...DEFAULT_ROUTE, m: 'browse', lib: 'sap.m' };
  assert.deepEqual(parse(serialize(b)), b);
  const g: Route = { ...DEFAULT_ROUTE, m: 'guide', tp: '0123456789abcdef0123456789abcdef' };
  assert.deepEqual(parse(serialize(g)), g);
  const ab: Route = { ...DEFAULT_ROUTE, m: 'abap', ab: 'select' };
  assert.deepEqual(parse(serialize(ab)), ab);
  assert.equal(parse('#?m=abap&ab=..%2Fx').ab, '');
});

test('이전 형식의 주소(모드 없음)는 그대로 열린다', () => {
  const r = parse('#?v=1.120&q=Table&api=sap.m.Table&tab=property&mq=autoPopinMode');
  assert.equal(r.m, 'name'); assert.equal(r.api, 'sap.m.Table'); assert.equal(r.tab, 'property'); assert.equal(r.mq, 'autoPopinMode');
});

test('해시는 사용자가 고칠 수 있는 입력: 알려지지 않은 값은 안전한 기본값으로', () => {
  assert.equal(parse('#?m=hack').m, 'name');
  assert.equal(parse('#?kf=zzz').kf, 'all');
  assert.equal(parse('#?api=<script>alert(1)</script>').api, null);
  assert.equal(parse('#?api=../../etc/passwd').api, null);
  assert.equal(parse('#?api=sap.m.Button').api, 'sap.m.Button');
  assert.equal(parse('#?api=sap.m.Button&mem=method:../x').mem, '');
  assert.equal(parse('#?api=sap.m.Button&mem=method:setText').mem, 'method:setText');
  assert.equal(parse('#?mem=evil:setText').mem, '');
  assert.equal(parse('#?m=guide&tp=not-a-key').tp, '');
  assert.equal(parse('#?m=browse&lib=sap.m/../x').lib, '');
});

test('관련 없는 모드의 값은 주소에 남기지 않는다', () => {
  const r: Route = { ...DEFAULT_ROUTE, m: 'feature', q: 'x', kf: 'm', lib: 'sap.m', tp: '0123456789abcdef0123456789abcdef', mem: 'method:a' };
  assert.equal(serialize(r), '#?m=feature&q=x'); // kf/lib/tp 는 해당 모드에서만, mem 은 api 가 있을 때만
});

test('API 이름 검증: 실제로 쓰는 식별자 형식은 받고, 경로 이탈·태그 같은 입력은 거부한다', () => {
  for (const ok of ['sap.m.Button', 'sap.ui.table.rowmodes.Fixed', 'module:sap/base/i18n/ResourceBundle', 'module:/sap/base/util/clamp', 'module:sap/ui/test/OpaBuilder#Actions', 'sap.fe.base.ClassSupport.ExtendWithObject<T, K>', 'jQuery.sap.global']) assert.equal(isSafeApiName(ok), true, ok);
  for (const bad of ['', '../../etc/passwd', 'a/../b', '..', '.', './x', '/etc/passwd', 'a//b', 'a\b', '<script>alert(1)</script>', 'sap.m.Button?x=1', 'sap m', 'x'.repeat(201)]) assert.equal(isSafeApiName(bad), false, bad);
  assert.equal(parse('#?api=%2e%2e%2f%2e%2e%2fetc').api, null); // 인코딩된 ../ 도 디코딩 후 거부
});

// ── 상위 구분(UI5 | ABAP) ──────────────────────────────────────────────

test('상위 구분: 모든 모드는 UI5 모드 4개 또는 abap 중 정확히 하나에 속한다', () => {
  assert.deepEqual([...UI5_MODES, 'abap'].sort(), [...MODES].sort());
  for (const m of UI5_MODES) assert.equal(productOf(m), 'ui5', m);
  assert.equal(productOf('abap'), 'abap');
});

test('상위 구분: 예전 ABAP 주소는 그대로 열리고 ABAP 으로 분류된다', () => {
  const r = parse('#?m=abap&ab=select');
  assert.equal(r.ab, 'select');
  assert.equal(productOf(r.m), 'abap');
  assert.equal(productOf(parse('#?v=1.120&q=Table&api=sap.m.Table').m), 'ui5'); // 모드 없는 옛 주소는 UI5
});

test('상위 탭을 누를 때 열 모드: ABAP 은 abap, UI5 는 직전 UI5 모드를 되살린다', () => {
  assert.equal(modeForProduct('abap', 'feature'), 'abap');
  assert.equal(modeForProduct('ui5', 'feature'), 'feature');
  assert.equal(modeForProduct('ui5', 'guide'), 'guide');
  assert.equal(modeForProduct('ui5', undefined), 'name');
  assert.equal(modeForProduct('ui5', null), 'name');
  assert.equal(modeForProduct('ui5', 'abap'), 'name'); // ABAP 이었던 기록은 UI5 모드가 아니다
  assert.equal(modeForProduct('ui5', 'hack'), 'name');
});

test('상위 탭 전환: 열린 항목은 닫히고, 검색어는 기본으로 비워진다', () => {
  const before: Route = { ...DEFAULT_ROUTE, v: '1.154', m: 'name', q: 'table', api: 'sap.m.Table', tab: 'property', mem: 'method:setText', mq: 'x' };
  const toAbap = { ...before, ...switchProduct('abap', 'name') };
  assert.equal(serialize(toAbap), '#?v=1.154&m=abap'); // 버전은 유지, 검색어·API·멤버·탭은 정리됨
  const back = { ...toAbap, ...switchProduct('ui5', 'name') };
  assert.equal(serialize(back), '#?v=1.154'); // 이름 검색(기본)으로 복귀
});

test('상위 탭 전환: keepQuery 는 이름 검색의 "ABAP 에도 있어요" 안내처럼 검색어를 넘길 때만 쓴다', () => {
  const before: Route = { ...DEFAULT_ROUTE, m: 'name', q: 'table', api: 'sap.m.Table' };
  const patch = switchProduct('abap', 'name', { keepQuery: true });
  assert.equal('q' in patch, false);
  assert.equal(serialize({ ...before, ...patch }), '#?m=abap&q=table');
});

test('상위 탭 전환: 직전 UI5 모드로 돌아가고 ABAP 에서 보던 항목은 닫힌다', () => {
  const inAbap: Route = { ...DEFAULT_ROUTE, m: 'abap', ab: 'select', q: 'sel' };
  const toUi5 = { ...inAbap, ...switchProduct('ui5', 'browse') };
  assert.equal(toUi5.m, 'browse');
  assert.equal(toUi5.ab, '');
  assert.equal(serialize(toUi5), '#?m=browse');
});

// ── ABAP 문법 그룹(ag) ────────────────────────────────────────────────

test('ABAP 그룹: 직렬화→파싱 왕복, 한글 이름과 가운뎃점·공백 보존', () => {
  for (const g of ['데이터베이스', '선언·데이터', '화면·프로그램 실행']) {
    const r: Route = { ...DEFAULT_ROUTE, m: 'abap', ag: g };
    assert.deepEqual(parse(serialize(r)), r, g);
  }
});

test('ABAP 그룹: 직접 고친 주소의 이상한 값은 비운다', () => {
  for (const bad of ['<script>', '../x', 'a/b', 'x'.repeat(31), 'a=b&c', '']) assert.equal(parse('#?m=abap&ag=' + encodeURIComponent(bad)).ag, '', bad);
  assert.equal(parse('#?m=abap&ag=%EC%A0%9C%EC%96%B4%EB%AC%B8').ag, '제어문');
});

test('ABAP 그룹: ABAP 모드가 아니면 주소에 남기지 않고, 검색어를 넘기는 전환은 그룹을 비운다', () => {
  assert.equal(serialize({ ...DEFAULT_ROUTE, m: 'name', ag: '제어문' }), '#');
  const inAbap: Route = { ...DEFAULT_ROUTE, m: 'abap', ag: '제어문' };
  const moved = { ...inAbap, ...switchProduct('abap', null, { keepQuery: true }), q: 'if' };
  assert.equal(moved.ag, ''); // 그룹 필터 때문에 넘긴 검색어의 결과가 가려지지 않게
  assert.equal(serialize(moved), '#?m=abap&q=if');
  assert.equal(parse(serialize({ ...DEFAULT_ROUTE, ...switchProduct('abap', null), ag: '제어문' })).ag, '제어문'); // 일반 전환은 그룹을 건드리지 않는다
});
