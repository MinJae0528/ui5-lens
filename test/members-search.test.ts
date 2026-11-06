import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandMembers, searchMembers, parseMemberQuery, nameTier, countByKind, FLAG, type RawMembers, type KindChar } from '../src/domain/memberIndex.ts';
import { buildMemberRecIndex, recommendMembers } from '../src/domain/memberRecommend.ts';
import { descendants, ancestors } from '../src/domain/hierarchy.ts';
import type { IntentEntry } from '../src/domain/recommend.ts';

// 압축 형식: [클래스 번호, 종류, 이름, 플래그, since, 설명|접근자 대상]
const raw: RawMembers = {
  c: ['sap.m.Button', 'sap.m.Input', 'sap.ui.core.Control', 'sap.ui.vk.Viewer', 'sap.m.FeedInput', 'sap.m.OldThing'],
  m: [
    [0, 'm', 'setText', FLAG.accessor, 0, 'text'],
    [0, 'p', 'text', 0, 0, 'Defines the text of the button.'],
    [0, 'e', 'press', 0, 0, 'Fired when the button is pressed.'],
    [1, 'm', 'setValue', FLAG.accessor, 0, 'value'],
    [1, 'm', 'getValue', FLAG.accessor, 0, 'value'],
    [1, 'm', 'attachLiveChange', 0, 0, 'Attaches an event handler to the live change event.'],
    [2, 'm', 'placeAt', 0, '1.0', 'Puts this control into the specified container.'],
    [2, 'm', 'getValue', FLAG.accessor, 0, 'value'],
    [3, 'm', 'placeAt', 0, 0, 'Viewer version of placeAt.'],
    [4, 'm', 'attachPost', 0, 0, 'Attaches a handler for posting a feed entry.'],
    [4, 'e', 'post', 0, 0, 'The post event is fired when the user posts.'],
    [5, 'm', 'refresh', FLAG.deprecated, 0, 'Refreshes the old thing.'],
    [5, 'm', 'getText', FLAG.accessor, 0, 'text'],
  ],
};
const rows = expandMembers(raw);
const names = (q: string, o = {}) => searchMembers(rows, q, o).map((g) => g.key);

test('expandMembers: 접근자는 설명 대신 대상 속성 이름을 갖는다', () => {
  const acc = rows.find((r) => r.n === 'setText')!;
  assert.equal(acc.a, 'text'); assert.equal(acc.t, '');
  const p = rows.find((r) => r.n === 'text')!;
  assert.equal(p.a, null); assert.match(p.t, /Defines the text/);
  assert.equal(rows.find((r) => r.n === 'placeAt' && r.c === 'sap.ui.core.Control')!.s, '1.0');
});

test('이름 일치 단계: 정확히 > 접두 > 포함·낱말', () => {
  assert.equal(nameTier('setText', 'settext'), 1);
  assert.equal(nameTier('setText', 'set'), 2);
  assert.equal(nameTier('attachLiveChange', 'live'), 3);
  assert.equal(nameTier('attachLiveChange', 'attach change'), 3); // 낱말을 모두 포함
  assert.equal(nameTier('placeAt', 'zzz'), 0);
});

test('같은 이름은 한 묶음: getValue 는 두 클래스가 선언, placeAt 은 기본 라이브러리(sap.ui.core)가 앞', () => {
  const g = searchMembers(rows, 'getValue')[0];
  assert.equal(g.key, 'm:getValue'); assert.equal(g.rows.length, 2);
  const p = searchMembers(rows, 'placeAt')[0];
  assert.deepEqual(p.rows.map((r) => r.c), ['sap.ui.core.Control', 'sap.ui.vk.Viewer']);
});

test('접근자는 이름이 거의 일치할 때만 기본 포함, 옵션으로 모두 포함', () => {
  assert.ok(names('setText').includes('m:setText'));            // 정확히 일치 → 포함
  assert.ok(!names('text').includes('m:setText'));               // 포함 일치(3단계) 접근자는 숨김
  assert.ok(names('text', { includeAccessors: true }).includes('m:setText'));
  assert.ok(names('text').includes('p:text'));                   // 속성 자체는 보인다
});

test('종류 필터와 종류별 개수', () => {
  const g = searchMembers(rows, 'post');
  assert.deepEqual(new Set(g.map((x) => x.k)), new Set<KindChar>(['m', 'e']));
  assert.deepEqual(names('post', { kinds: new Set<KindChar>(['e']) }), ['e:post']);
  assert.equal(countByKind(g).e, 1);
});

test('클래스 지정 검색: Button#setText, Button.setText, sap.m.Button.setText', () => {
  const classes = new Set(rows.map((r) => r.c));
  assert.deepEqual(parseMemberQuery('Button#setText'), { cls: 'button', mem: 'setText' });
  assert.deepEqual(parseMemberQuery('Button.setText', classes), { cls: 'button', mem: 'setText' });
  assert.deepEqual(parseMemberQuery('sap.m.Button.setText', classes), { cls: 'sap.m.button', mem: 'setText' });
  assert.deepEqual(parseMemberQuery('sap.m', classes), { cls: null, mem: 'sap.m' }); // 네임스페이스는 클래스 필터가 아님
  assert.deepEqual(names('Input#getValue'), ['m:getValue']);
  assert.equal(searchMembers(rows, 'Input#getValue')[0].rows.length, 1);
  assert.deepEqual(names('Button#getValue'), []);
});

test('deprecated 만 있는 묶음은 뒤로 간다', () => {
  const g = searchMembers(rows, 'e', { includeAccessors: true });
  const iDep = g.findIndex((x) => x.n === 'refresh'), iOk = g.findIndex((x) => x.n === 'press');
  assert.ok(iOk >= 0 && iDep >= 0 && iOk < iDep);
});

test('빈 검색어와 없는 이름은 결과 없음(지어내지 않음)', () => {
  assert.deepEqual(names(''), []);
  assert.deepEqual(names('noSuchMethodAnywhere'), []);
});

// ---- 상속 ----
const idx = [
  { n: 'sap.ui.base.Object', x: null }, { n: 'sap.ui.core.Element', x: 'sap.ui.base.Object' }, { n: 'sap.ui.core.Control', x: 'sap.ui.core.Element' },
  { n: 'sap.m.Button', x: 'sap.ui.core.Control' }, { n: 'sap.m.ToggleButton', x: 'sap.m.Button' }, { n: 'sap.m.Input', x: 'sap.ui.core.Control' }, { n: 'loop.A', x: 'loop.B' }, { n: 'loop.B', x: 'loop.A' },
];
test('descendants/ancestors: 직간접 후손과 조상, 순환이 있어도 끝난다', () => {
  assert.deepEqual(descendants(idx, 'sap.m.Button'), ['sap.m.ToggleButton']);
  assert.deepEqual(new Set(descendants(idx, 'sap.ui.core.Element')), new Set(['sap.ui.core.Control', 'sap.m.Button', 'sap.m.Input', 'sap.m.ToggleButton']));
  assert.deepEqual(ancestors(idx, 'sap.m.ToggleButton'), ['sap.m.Button', 'sap.ui.core.Control', 'sap.ui.core.Element', 'sap.ui.base.Object']);
  assert.ok(descendants(idx, 'loop.A').length <= 2);
  assert.ok(ancestors(idx, 'loop.A').length <= 2);
});

// ---- 기능 → 추천 멤버 ----
const intents: IntentEntry[] = JSON.parse(readFileSync('data/intents.json', 'utf8')).intents;
test('기능 추천 멤버: 댓글 → FeedInput 의 attachPost/post 가 상위에 온다', () => {
  const idxRec = buildMemberRecIndex(rows);
  const r = recommendMembers(idxRec, '댓글을 다는 기능', intents, 5);
  const top = r.results.map((x) => `${x.r.c}#${x.r.n}`);
  assert.ok(top.slice(0, 3).some((t) => t.startsWith('sap.m.FeedInput#')), top.join(', '));
  assert.deepEqual(recommendMembers(idxRec, 'ZzzNotAnApi', intents).results, []);
});

test('기능 추천 멤버: 같은 이름은 한 줄로 묶고(선언 클래스 수 표시), 자동 생성 접근자도 후보가 된다', () => {
  const idxRec = buildMemberRecIndex(rows);
  const r = recommendMembers(idxRec, 'getValue', intents, 8);
  const gv = r.results.filter((x) => x.r.n === 'getValue');
  assert.equal(gv.length, 1, '같은 (종류, 이름)은 한 줄');
  assert.equal(gv[0].classes, 2, 'getValue 를 선언한 클래스 수');
  assert.ok(gv[0].r.f & FLAG.accessor, '접근자도 추천 대상');
});

test('기능 추천 멤버: 이름이 질문과 정확히 겹치는 멤버가, 낱말이 더 붙은 긴 이름보다 앞선다', () => {
  const rr = expandMembers({ c: ['sap.m.A', 'sap.m.B'], m: [[0, 'm', 'open', 0, 0, 'Opens the thing.'], [1, 'm', 'openValueStateMessageNow', 0, 0, 'Opens a message.']] });
  const r = recommendMembers(buildMemberRecIndex(rr), '열기', intents, 2);
  assert.equal(r.results[0].r.n, 'open');
});
