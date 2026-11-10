import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize, isSafeApiName, DEFAULT_ROUTE, type Route } from '../src/controller/routeState.ts';

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
