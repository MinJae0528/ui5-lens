import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, features, prepare, prepareModel, scoreModel, train, vectorize, type RecipeModel } from '../src/domain/recipeModel.ts';

test('prepare: 낱말 끝 조사와 군더더기를 떼고 영어 낱말을 따로 뽑는다', () => {
  assert.equal(prepare('버튼을 눌러').flat, '버튼눌러'); // 낱말 끝 조사(을)를 뗀다
  assert.ok(prepare('버튼을 눌렀을 때').flat.startsWith('버튼눌렀')); // 끝 글자 하나를 조사로 보는 단순 규칙이라 학습·질문에 똑같이 적용된다
  assert.equal(prepare('대화상자 열기 방법 알려줘').flat, '대화상자열기');
  assert.deepEqual(prepare('Dialog open 호출').words, ['dialog', 'open']);
});

test('features: 글자 2·3-그램과 영어 낱말 특징', () => {
  const f = features('열기 dialog');
  assert.ok(f.includes('열기') && f.includes('기d'));
  assert.ok(f.includes('w:dialog'));
  assert.deepEqual(features('가'), ['가']);
});

const samples = {
  open: ['대화상자 열기', '팝업창 띄우기', '다이얼로그 오픈', '모달 창 보여주기'],
  close: ['대화상자 닫기', '팝업창 종료', '다이얼로그 끝내기', '모달 창 숨기기'],
  filter: ['목록 필터 적용', '조건으로 걸러내기', '데이터 필터링', '검색 조건 거르기'],
};
const pm = prepareModel(train(samples));

test('train/score: 같은 뜻의 다른 표현이 맞는 레시피 1등', () => {
  assert.equal(scoreModel(pm, '팝업 오픈')[0].id, 'open');
  assert.equal(scoreModel(pm, '창 종료하기')[0].id, 'close');
  assert.equal(scoreModel(pm, '리스트 필터링 하기')[0].id, 'filter');
});

test('score: 사전에 없는 글자뿐이면 점수 없음, 점수는 0~1', () => {
  assert.deepEqual(scoreModel(pm, 'zzzqqq'), []);
  for (const s of scoreModel(pm, '대화상자 열기')) assert.ok(s.score >= 0 && s.score <= 1.0001);
});

test('decide: 낮은 점수·근소한 차이는 거절한다(모르면 모른다고)', () => {
  const sc = scoreModel(pm, '팝업 오픈');
  assert.equal(decide(sc, 0.0, 0)!.id, 'open');
  assert.equal(decide(sc, 0.99, 0), null, '점수 기준 미달');
  assert.equal(decide(sc, 0, 0.99), null, '2등과 차이 부족');
  assert.equal(decide([], 0, 0), null);
});

test('vectorize: 정규화된 희소 벡터(길이 1)', () => {
  const m = pm.m;
  const v = vectorize('대화상자 열기', pm.vocabIndex, m.idf);
  const norm = Math.sqrt(v.reduce((a, [, w]) => a + w * w, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test('data/recipe-model.json: 형식과 크기(1MB 미만), 모든 레시피 포함', () => {
  const raw = readFileSync('data/recipe-model.json');
  assert.ok(raw.length < 1024 * 1024, `모델 파일 ${raw.length} 바이트`);
  const m = JSON.parse(raw.toString('utf8')) as RecipeModel;
  const ids = (JSON.parse(readFileSync('data/recipes.json', 'utf8')).recipes as { id: string }[]).map((r) => r.id);
  assert.deepEqual(m.classes.map((c) => c.id).filter((id) => id !== '__none__').sort(), [...ids].sort()); // 해당 없음 분류는 있을 수도 없을 수도 있다
  assert.equal(m.vocab.length, m.idf.length);
});
