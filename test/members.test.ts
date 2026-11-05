import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMembers, signature, filterMembers, memberKey, MEMBER_SPECS, type Item } from '../src/domain/members.ts';
import type { ApiDoc, Meth, Prop, Evt, Aggr } from '../src/types.ts';

const prop = (name: string, type = 'string', over: Partial<Prop> = {}): Prop => ({ name, since: null, deprecated: null, visibility: 'public', description: `${name} desc`, type, defaultValue: null, group: null, methods: [], ...over });
const meth = (name: string, over: Partial<Meth> = {}): Meth => ({ name, since: null, deprecated: null, visibility: 'public', description: `${name} desc`, static: false, accessorOf: null, parameters: [], returnValue: null, ...over });
const doc = (name: string, over: Partial<ApiDoc> = {}): ApiDoc => ({
  name, basename: name.split('.').pop()!, library: 'sap.m', kind: 'class', visibility: 'public', since: null, deprecated: null, extends: null, implements: [], stereotype: 'control',
  module: null, description: '', sourceUrl: '', properties: [], aggregations: [], associations: [], events: [], methods: [], enumValues: [], typedefProperties: [], constructorParams: [], officialHash: 'x', ...over,
});

test('mergeMembers: 하위 클래스가 다시 정의한 항목이 우선하고 상속 여부가 표시된다', () => {
  const child = doc('sap.m.Child', { properties: [prop('width', 'sap.ui.core.CSSSize'), prop('own')] });
  const parent = doc('sap.m.Parent', { properties: [prop('width', 'string'), prop('visible', 'boolean')] });
  const items = mergeMembers([child, parent], 'properties');
  assert.deepEqual(items.map((i) => [i.m.name, i.definedIn, i.inherited]), [
    ['width', 'sap.m.Child', false], ['own', 'sap.m.Child', false], ['visible', 'sap.m.Parent', true],
  ]);
  assert.equal((items[0].m as Prop).type, 'sap.ui.core.CSSSize'); // 부모의 width 가 아니라 자식의 width
});

test('mergeMembers: 체인이 한 개여도 동작하고 같은 이름은 한 번만', () => {
  const d = doc('a.B', { methods: [meth('go'), meth('go')] });
  assert.equal(mergeMembers([d], 'methods').length, 1);
});

test('signature: 종류별 표기', () => {
  assert.equal(signature('property', prop('count', 'int', { defaultValue: 3 })), ': int = 3');
  assert.equal(signature('property', prop('title', 'string')), ': string');
  const agg = { ...prop('items'), type: 'sap.m.Item', cardinality: '0..n', singularName: 'item', isDefault: true, methods: [] } as unknown as Aggr;
  assert.equal(signature('aggregation', agg), ': sap.m.Item [0..n]');
  const ev = { name: 'press', since: null, deprecated: null, visibility: 'public', description: '', allowPreventDefault: false, parameters: [{ name: 'id' }, { name: 'value' }] } as Evt;
  assert.equal(signature('event', ev), '(id, value)');
  const m = meth('add', { parameters: [{ name: 'a' }, { name: 'b', optional: true }], returnValue: { type: 'number', description: '' } });
  assert.equal(signature('method', m), '(a, [b]) → number');
});

test('memberKey: 버전별 가용성 자료의 키 규칙(속성 p, 구성 a, 참조 s, 이벤트 e, 메서드 m)', () => {
  assert.equal(memberKey('property', 'x'), 'p:x');
  assert.equal(memberKey('association', 'x'), 's:x');
  assert.equal(MEMBER_SPECS.length, 5);
});

const plain = (h: string) => h.replace(/<[^>]+>/g, ' ');
const rows = (): Item[] => [
  { m: meth('getX', { accessorOf: { kind: 'property', name: 'x' } }), definedIn: 'a.B', inherited: false },
  { m: meth('addColumn', { accessorOf: { kind: 'aggregation', name: 'columns' }, description: 'Adds a column' }), definedIn: 'a.B', inherited: false },
  { m: meth('refresh', { deprecated: { since: '1.50', text: 'x' } }), definedIn: 'a.B', inherited: false },
  { m: meth('render'), definedIn: 'a.B', inherited: false },
];
const base = { kind: 'method' as const, hideAccessors: true, hideDeprecated: false, koText: () => undefined, plain };

test('filterMembers: 접근자는 기본 숨기되 검색 중에는 찾을 수 있다', () => {
  assert.deepEqual(filterMembers(rows(), { ...base, mq: '' }).map((i) => i.m.name), ['refresh', 'render']);
  assert.deepEqual(filterMembers(rows(), { ...base, mq: 'addcolumn' }).map((i) => i.m.name), ['addColumn']);
});

test('filterMembers: deprecated 숨기기와 한국어 설명 검색', () => {
  assert.deepEqual(filterMembers(rows(), { ...base, mq: '', hideDeprecated: true }).map((i) => i.m.name), ['render']);
  const ko = (it: Item) => (it.m.name === 'render' ? '화면에 그린다' : undefined);
  assert.deepEqual(filterMembers(rows(), { ...base, mq: '그린다', koText: ko }).map((i) => i.m.name), ['render']);
});

test('filterMembers: 속성 탭에서는 접근자 규칙이 적용되지 않는다', () => {
  const r: Item[] = [{ m: prop('a'), definedIn: 'x', inherited: false }];
  assert.equal(filterMembers(r, { ...base, kind: 'property', mq: '' }).length, 1);
});
