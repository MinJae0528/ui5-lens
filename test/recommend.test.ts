import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, recommend, tokens, interpret, isCore, type CorpusEntry, type IntentEntry } from '../src/domain/recommend.ts';

const corpus: CorpusEntry[] = [
  { n: 'sap.m.FeedInput', c: 1, t: 'The Feed Input allows the user to enter text for a new feed entry and then post it.', m: 'value post enabled' },
  { n: 'sap.m.FeedListItem', c: 1, t: 'The control provides a set of properties for text, sender information, time stamp.', m: 'text sender' },
  { n: 'sap.ui.ux3.FeedChunk', c: 1, dp: '1.38', t: 'Feed chunk for the old ux3 library', m: 'feeder' },
  { n: 'sap.collaboration.components.feed.Component', c: 0, t: 'Social collaboration feed component', m: '' },
  { n: 'sap.m.DatePicker', c: 1, t: 'Enables users to select a localized date using touch, mouse, or keyboard input.', m: 'dateValue' },
  { n: 'sap.ui.unified.Calendar', c: 1, t: 'Calendar with dates.', m: 'selectedDates' },
  { n: 'sap.m.Dialog', c: 1, t: 'The Dialog control is used to interrupt the current processing of an application.', m: 'open close' },
  { n: 'sap.m.MessageBox', c: 3, t: 'Provides easy-to-use functions to display messages in a modal dialog.', m: 'show confirm' },
];
const intents: IntentEntry[] = JSON.parse(readFileSync('data/intents.json', 'utf8')).intents;
const idx = buildIndex(corpus);
const top = (q: string, n = 3) => recommend(idx, q, intents, n).results.map((r) => r.c.n);

test('사용자 예시: 댓글 기능 → FeedInput 이 먼저, FeedListItem 도 상위에', () => {
  const r = top('댓글을 다는 기능을 추가하고 싶어', 4);
  assert.equal(r[0], 'sap.m.FeedInput');
  assert.ok(r.includes('sap.m.FeedListItem'));
});

test('사전이 붙인 동의어는 하나만 겹쳐도 후보가 된다(조건이 아니라 대체 가능한 용어)', () => {
  // "댓글" → feed, comment, post. FeedListItem 은 feed 한 개만 겹친다.
  assert.ok(top('댓글', 8).includes('sap.m.FeedListItem'));
});

test('의미 없는 입력은 아무것도 추천하지 않는다(지어내지 않음)', () => {
  assert.deepEqual(top('ZzzNotAnApi'), []);
  assert.deepEqual(top('asdf qwer zxcv'), []);
  assert.equal(recommend(idx, 'ㅁㄴㅇㄹ', intents).unknown, true);
});

test('deprecated 와 기본 라이브러리 밖 후보는 순위가 내려간다', () => {
  const r = top('feed', 8);
  assert.ok(r.indexOf('sap.m.FeedInput') < r.indexOf('sap.ui.ux3.FeedChunk'));
  assert.ok(r.indexOf('sap.m.FeedInput') < r.indexOf('sap.collaboration.components.feed.Component'));
  assert.equal(isCore('sap.m.Button'), true);
  assert.equal(isCore('sap.ui.vk.Notifications'), false);
});

test('이름이 정확히 일치하는 컨트롤은 부분 일치보다 위', () => {
  assert.equal(top('dialog')[0], 'sap.m.Dialog');
});

test('namespace(MessageBox)도 추천 대상이다', () => {
  assert.ok(top('삭제할까 확인 대화상자', 3).includes('sap.m.MessageBox'));
});

test('영어 질문과 대문자 연속 이름의 토큰 분리', () => {
  assert.deepEqual(tokens('JSONModel'), ['json', 'model']);
  assert.deepEqual(tokens('DatePicker'), ['date', 'picker']);
  assert.deepEqual(top('date picker')[0], 'sap.m.DatePicker');
});

test('해석 결과를 그대로 돌려줘 화면이 “왜”를 설명할 수 있다', () => {
  const r = interpret('댓글을 다는 기능', intents);
  assert.ok(r.used.some((u) => u.ko.includes('댓글')));
  assert.ok(r.terms.has('feed'));
  const why = recommend(idx, 'feed', intents).results[0].why;
  assert.ok(why.name.includes('feed'));
});
