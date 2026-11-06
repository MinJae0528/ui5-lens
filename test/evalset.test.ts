import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitOf, validateEval, validateTrain } from '../src/domain/evalSet.ts';

test('splitOf: 같은 질문은 늘 같은 쪽, 대략 반반으로 나뉜다', () => {
  assert.equal(splitOf('팝업 닫아줘'), splitOf('팝업 닫아줘'));
  const n = Array.from({ length: 400 }, (_, i) => `질문 ${i} 번 표현`);
  const dev = n.filter((q) => splitOf(q) === 'dev').length;
  assert.ok(dev > 150 && dev < 250, `dev ${dev}`);
});

test('validateEval: 올바른 항목은 받고, 정답 형식·종류·중복·길이 문제는 이유와 함께 거른다', () => {
  const r = validateEval({ questions: [
    { q: '대화상자 열기', answers: ['sap.m.Dialog#method:open'], kind: 'task' },
    { q: '오늘 날씨', answers: [], kind: 'none' },
    { q: '대화상자 열기', answers: ['sap.m.Dialog'], kind: 'task' },        // 중복
    { q: '정답 없음', answers: [], kind: 'task' },                          // task 는 정답 필요
    { q: '정답 있는 none', answers: ['sap.m.Button'], kind: 'none' },       // none 은 정답 금지
    { q: '이상한 정답', answers: ['sap.m.Button#bogus:x'], kind: 'task' },  // 형식 오류
    { q: '가', answers: ['sap.m.Button'], kind: 'task' },                   // 너무 짧음
    { q: '종류 없음', answers: ['sap.m.Button'] },
    { q: '정답 4개', answers: ['a.B', 'a.C', 'a.D', 'a.E'], kind: 'task' },
  ] });
  assert.deepEqual(r.questions.map((x) => x.q), ['대화상자 열기', '오늘 날씨']);
  assert.equal(r.issues.length, 7);
  assert.deepEqual(validateEval({}).questions, []);
  assert.equal(validateEval({}).issues.length, 1);
});

test('validateTrain: 알 수 없는 id 는 거르고 표현은 중복·길이를 정리한다', () => {
  const ids = new Set(['a', 'b']);
  const r = validateTrain({ paraphrases: { a: ['하나', '하나', '둘둘', 'x', 7], zzz: ['모름'], b: 'x' }, negatives: ['날씨', '날씨', '', '가'.repeat(200)] }, ids);
  assert.deepEqual(r.train.paraphrases, { a: ['하나', '둘둘'] });
  assert.deepEqual(r.train.negatives, ['날씨']);
  assert.equal(r.issues.length, 2);
});
