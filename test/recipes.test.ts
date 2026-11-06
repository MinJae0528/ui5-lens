import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bigrams, dice, matchRecipes, normalize, parseRef, pickAnswers, type Recipe } from '../src/domain/recipes.ts';

const recipes: Recipe[] = [
  { id: 'dialog-open', ko: ['대화상자 열기', '팝업창 열기'], answers: [{ ref: 'sap.m.Dialog#method:open', why: 'a' }, { ref: 'sap.m.Dialog', why: 'b' }] },
  { id: 'toast', ko: ['잠깐 알림 메시지'], answers: [{ ref: 'sap.m.MessageToast#method:show', why: 'c' }, { ref: 'sap.m.Dialog', why: 'dup' }] },
];

test('parseRef: 클래스와 멤버 참조를 해석하고 이상한 형식은 거부한다', () => {
  assert.deepEqual(parseRef('sap.m.Button#event:press'), { c: 'sap.m.Button', k: 'event', n: 'press' });
  assert.deepEqual(parseRef('sap.m.Dialog'), { c: 'sap.m.Dialog', k: null, n: null });
  for (const bad of ['', 'sap.m.Button#bogus:x', 'sap.m.Button#method:', '../etc#method:a', 'a b', '<script>']) assert.equal(parseRef(bad), null, bad);
});

test('normalize: 공백·기호 제거와 군더더기 제거', () => {
  assert.equal(normalize('대화상자 열기 방법 알려줘!'), '대화상자열기');
  assert.equal(normalize('Date Picker'), 'datepicker');
});

test('dice: 같은 문구는 1, 무관한 문구는 0 에 가깝다', () => {
  assert.equal(dice('대화상자열기', '대화상자열기'), 1);
  assert.ok(dice('대화상자열기', '필터적용') < 0.2);
  assert.ok(bigrams('가').has('가'));
});

test('matchRecipes: 비슷한 문구만 점수순으로, 임계값 미만은 버린다', () => {
  const m = matchRecipes(recipes, '대화상자 열기');
  assert.equal(m[0].recipe.id, 'dialog-open');
  assert.equal(m[0].score, 1);
  assert.deepEqual(matchRecipes(recipes, '전혀 다른 이야기 오늘 날씨'), []);
  assert.deepEqual(matchRecipes(recipes, '가'), []);
});

test('pickAnswers: 가장 비슷한 레시피의 정답부터, 중복 제거, 최대 limit 개', () => {
  const m = matchRecipes(recipes, '대화상자 열기', 0.05);
  const p = pickAnswers(m, 3);
  assert.ok(p.length <= 3);
  assert.equal(p[0].ref, 'sap.m.Dialog#method:open');
  assert.equal(new Set(p.map((x) => x.ref)).size, p.length);
});

test('data/recipes.json: 형식(정답 1~3개, 이유·문구 있음, id 중복 없음)', () => {
  const j = JSON.parse(readFileSync('data/recipes.json', 'utf8')) as { recipes: Recipe[] };
  const ids = new Set<string>();
  for (const r of j.recipes) {
    assert.ok(!ids.has(r.id), `id 중복 ${r.id}`); ids.add(r.id);
    assert.ok(r.ko.length >= 1 && r.answers.length >= 1 && r.answers.length <= 3, r.id);
    for (const a of r.answers) { assert.ok(parseRef(a.ref), `${r.id}: ${a.ref}`); assert.ok(a.why.length > 3); }
  }
  assert.ok(j.recipes.length >= 50);
});
