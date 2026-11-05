import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../src/domain/search.ts';
import type { Alias, IndexEntry } from '../src/types.ts';

const e = (n: string, over: Partial<IndexEntry> = {}): IndexEntry => ({ n, b: n.split('.').pop()!, l: n.split('.').slice(0, -1).join('.'), k: 'class', s: null, d: null, x: null, t: '', ko: 'none', ...over });
const index: IndexEntry[] = [
  e('sap.m.Table', { ko: 'draft' }), e('sap.ui.table.Table'), e('sap.ui.table', { k: 'namespace' }),
  e('sap.m.TableSelectDialog'), e('sap.m.Dialog'), e('sap.m.Button'), e('sap.m.ButtonOld', { d: '1.30' }),
];
const aliases: Alias[] = [{ term: '표', apis: ['sap.m.Table', 'sap.ui.table.Table'] }, { term: '팝업', apis: ['sap.m.Dialog'] }];
const names = (q: string) => search(index, aliases, q).map((c) => c.entry.n);

test('같은 이름(Table)의 API 는 라이브러리가 달라도 각각 별도 후보로 나온다', () => {
  const r = names('Table');
  assert.ok(r.includes('sap.m.Table') && r.includes('sap.ui.table.Table'));
  assert.equal(new Set(r).size, r.length); // 중복 없음
});

test('순위: 전체 이름 일치 > 짧은 이름 일치 > 일부 일치', () => {
  const full = search(index, aliases, 'sap.m.Table');
  assert.equal(full[0].entry.n, 'sap.m.Table');
  assert.equal(full[0].tier, 1);
  const short = search(index, aliases, 'table');
  assert.equal(short[0].tier, 2);
  assert.ok(short.some((c) => c.entry.n === 'sap.m.TableSelectDialog' && c.tier === 3));
});

test('대소문자와 공백은 무시한다', () => {
  assert.deepEqual(names('SAP.M.table'), names('sap.m.Table'));
  assert.deepEqual(names('  Dialog '), names('dialog'));
});

test('한국어 별칭: 사전에 있는 표현만 연결하고, 일치 이유를 알려 준다', () => {
  const r = search(index, aliases, '표');
  assert.deepEqual(r.map((c) => c.entry.n).sort(), ['sap.m.Table', 'sap.ui.table.Table']);
  assert.match(r[0].reasons.join(' '), /별칭/);
  assert.deepEqual(names('없는말'), []); // 지어내지 않는다
});

test('deprecated 는 같은 순위 안에서 뒤로 간다', () => {
  const r = names('Button');
  assert.ok(r.indexOf('sap.m.Button') < r.indexOf('sap.m.ButtonOld'));
});

test('빈 검색어는 후보가 없다', () => {
  assert.deepEqual(names(''), []);
  assert.deepEqual(names('   '), []);
});
