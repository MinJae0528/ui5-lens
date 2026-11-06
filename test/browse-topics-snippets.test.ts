import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraries, entriesOf } from '../src/domain/browse.ts';
import { flattenTopics, searchTopics, childrenOf, topicUrl, isTopicKey } from '../src/domain/topics.ts';
import { defineSnippet, xmlSnippet, xmlMemberSnippet, newSnippet } from '../src/domain/snippets.ts';
import type { ApiDoc, IndexEntry, Prop, Evt, Aggr, TopicNode } from '../src/types.ts';

const e = (n: string, l: string, k = 'class', d: string | null = null, p?: 0): IndexEntry => ({ n, b: n.split('.').pop()!, l, k, s: null, d, x: null, t: '', ko: 'none', ...(p === 0 ? { p } : {}) });
const index = [e('sap.m.Table', 'sap.m'), e('sap.m.Button', 'sap.m'), e('sap.m.OldList', 'sap.m', 'class', '1.20'), e('sap.m.library', 'sap.m', 'namespace'), e('sap.m.Hidden', 'sap.m', 'class', null, 0), e('sap.vk.Viewer', 'sap.ui.vk'), e('sap.ui.core.Control', 'sap.ui.core')];

test('libraries: 기본 라이브러리가 앞, 숨김 항목은 세지 않음, deprecated 개수', () => {
  const l = libraries(index);
  assert.deepEqual(l.map((x) => x.lib), ['sap.m', 'sap.ui.core', 'sap.ui.vk']);
  assert.equal(l[0].count, 4); assert.equal(l[0].deprecated, 1); assert.equal(l[0].core, true);
  assert.equal(l[2].core, false);
});
test('entriesOf: 종류 → 이름순, 검색어 필터, 종류 제한', () => {
  assert.deepEqual(entriesOf(index, 'sap.m').map((x) => x.n), ['sap.m.Button', 'sap.m.OldList', 'sap.m.Table', 'sap.m.library']);
  assert.deepEqual(entriesOf(index, 'sap.m', 'tab').map((x) => x.n), ['sap.m.Table']);
  assert.deepEqual(entriesOf(index, 'sap.m', '', new Set(['namespace'])).map((x) => x.n), ['sap.m.library']);
});

const K = '0123456789abcdef0123456789abcdef';
const key = (n: number) => K.slice(0, 31) + n.toString(16);
const tree: TopicNode[] = [
  [key(1), 'Developing Apps', [[key(2), 'Data Binding', [[key(3), 'Binding Syntax', 0], [key(4), 'List Binding', 0]]], [key(5), 'Routing and Navigation', 0]]],
  [key(6), 'Get Started', 0],
];
test('문서 목차: 평탄화·경로·검색(제목 일치가 경로 일치보다 위)', () => {
  const flat = flattenTopics(tree);
  assert.equal(flat.length, 6);
  assert.deepEqual(flat.find((t) => t.key === key(3))!.path, ['Developing Apps', 'Data Binding']);
  assert.equal(flat.find((t) => t.key === key(2))!.hasChildren, true);
  const r = searchTopics(flat, 'binding');
  assert.equal(r[0].text.toLowerCase().includes('binding'), true);
  assert.ok(r.some((t) => t.key === key(4)));
  assert.deepEqual(searchTopics(flat, 'zzzz'), []);
  assert.deepEqual(searchTopics(flat, ''), []);
  assert.deepEqual(childrenOf(tree, key(2)).map((c) => c.text), ['Binding Syntax', 'List Binding']);
  assert.deepEqual(childrenOf(tree, key(6)), []);
});
test('문서 링크는 공식 문서 주소로만 만들고 키 형식을 검사한다', () => {
  assert.equal(topicUrl('https://ui5.sap.com/1.154.0', key(1)), `https://ui5.sap.com/1.154.0/#/topic/${key(1)}`);
  assert.equal(isTopicKey(key(1)), true);
  assert.equal(isTopicKey('../../x'), false);
  assert.equal(isTopicKey('<script>'), false);
});

const doc = (over: Partial<ApiDoc>): ApiDoc => ({
  name: 'sap.m.Button', basename: 'Button', library: 'sap.m', kind: 'class', visibility: 'public', since: null, deprecated: null, extends: null, implements: [], stereotype: 'control', module: 'sap/m/Button',
  description: '', sourceUrl: '', properties: [], aggregations: [], associations: [], events: [], methods: [], enumValues: [], typedefProperties: [],
  constructorParams: [{ name: 'sId', optional: true }, { name: 'mSettings', optional: true }], officialHash: 'x', ctor: { description: '', references: [], examples: [], allowedFor: [] }, ...over,
});
const base = { since: null, deprecated: null, visibility: 'public', description: '' };

test('sap.ui.define / new 사용 형태', () => {
  assert.match(defineSnippet(doc({}))!, /sap\.ui\.define\(\[\s+"sap\/m\/Button"\s+\], function \(Button\)/);
  assert.match(defineSnippet(doc({}))!, /new Button\(/);
  assert.equal(defineSnippet(doc({ module: null })), null);
  assert.equal(defineSnippet(doc({ module: 'sap/m/<script>' })), null); // 이상한 모듈 경로는 만들지 않는다
  assert.match(defineSnippet(doc({ kind: 'namespace', stereotype: null, basename: 'MessageBox', module: 'sap/m/MessageBox' }))!, /싱글톤/);
  assert.equal(newSnippet(doc({})), 'var oButton = new sap.m.Button("myId", { /* mSettings */ });');
  assert.equal(newSnippet(doc({ ctor: undefined })), null);
});
test('XML 뷰 사용 형태: sap.m 은 기본 네임스페이스, 다른 라이브러리는 접두사', () => {
  assert.match(xmlSnippet(doc({}))!, /<mvc:View xmlns:mvc="sap\.ui\.core\.mvc" xmlns="sap\.m">\s+<Button \/>/);
  const t = xmlSnippet(doc({ name: 'sap.ui.table.Table', basename: 'Table', library: 'sap.ui.table' }))!;
  assert.match(t, /xmlns:table="sap\.ui\.table"/); assert.match(t, /<table:Table \/>/);
  assert.equal(xmlSnippet(doc({ stereotype: null })), null);
  assert.equal(xmlSnippet(doc({ stereotype: 'control', name: 'Button', basename: 'Button' })), null); // 네임스페이스가 없으면 만들지 않음
});
test('XML 멤버 사용 형태: 속성·이벤트·참조·구성 요소, 메서드는 없음', () => {
  const d = doc({});
  const prop = { ...base, name: 'enabled', type: 'boolean', defaultValue: true, group: null, methods: [] } as Prop;
  assert.equal(xmlMemberSnippet('property', d, prop), '<Button enabled="true" />');
  const ev = { ...base, name: 'press', allowPreventDefault: false, parameters: [] } as Evt;
  assert.match(xmlMemberSnippet('event', d, ev)!, /<Button press="\.onPress" \/>/);
  const ag = { ...base, name: 'items', type: 'sap.m.Item', cardinality: '0..n', singularName: 'item', isDefault: false, methods: [] } as Aggr;
  assert.match(xmlMemberSnippet('aggregation', d, ag)!, /<items>/);
  assert.match(xmlMemberSnippet('aggregation', d, { ...ag, isDefault: true })!, /기본 구성 요소/);
  assert.equal(xmlMemberSnippet('method', d, ev), null);
});
