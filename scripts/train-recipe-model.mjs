// 작은 레시피 분류 모델 학습: node scripts/train-recipe-model.mjs
// 입력: data/recipes.json(문구) + data/recipe-train.json(표현). 출력: data/recipe-model.json
// 표현을 늘리는 방법(증강): 유의어 치환. 의미가 같은 흔한 한국어 표현끼리만 바꾼다.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { train, NONE_ID } from '../src/domain/recipeModel.ts';
import { validateTrain } from '../src/domain/evalSet.ts';
import { existsSync, readdirSync } from 'node:fs';

const recipes = JSON.parse(readFileSync('data/recipes.json', 'utf8')).recipes;
const para = JSON.parse(readFileSync('data/recipe-train.json', 'utf8')).paraphrases;
const SYN = [['열기', '오픈'], ['열기', '띄우기'], ['바꾸기', '변경'], ['바꾸기', '수정'], ['가져오기', '얻기'], ['가져오기', '읽기'], ['추가', '넣기'], ['삭제', '제거'], ['삭제', '지우기'],
  ['설정', '지정'], ['표시', '보여주기'], ['컨트롤', '요소'], ['화면', '페이지'], ['목록', '리스트'], ['대화상자', '다이얼로그'], ['팝업', '창'], ['이벤트', '핸들러']];
function augment(t) {
  const out = new Set([t]);
  for (const [a, b] of SYN) { if (t.includes(a)) out.add(t.replace(a, b)); if (t.includes(b)) out.add(t.replace(b, a)); }
  return [...out];
}
const samples = {};
for (const r of recipes) {
  const base = [...r.ko, ...(para[r.id] ?? [])];
  samples[r.id] = [...new Set(base.flatMap(augment))];
}
// 다른 AI 가 만든 학습 표현(data/external/train-*.json)과 “해당 없음” 질문을 합친다.
let extPara = 0, extNeg = 0;
const negatives = [];
if (existsSync('data/external')) {
  const ids = new Set(recipes.map((r) => r.id));
  for (const f of readdirSync('data/external').filter((f) => f.startsWith('train-') && f.endsWith('.json'))) {
    const { train: t, issues } = validateTrain(JSON.parse(readFileSync(`data/external/${f}`, 'utf8')), ids);
    for (const i of issues) console.warn(`[${f}] ${i}`);
    for (const [id, list] of Object.entries(t.paraphrases)) { samples[id] = [...new Set([...samples[id], ...list.flatMap(augment)])]; extPara += list.length; }
    negatives.push(...t.negatives); extNeg += t.negatives.length;
  }
}
if (negatives.length) samples[NONE_ID] = [...new Set(negatives)];
console.log(`외부 학습 표현 ${extPara}개, 해당 없음 ${extNeg}개 반영`);
const model = train(samples);
const json = JSON.stringify({ v: model.v, vocab: model.vocab, idf: model.idf.map((x) => +x.toFixed(3)), classes: model.classes.map((c) => ({ id: c.id, centroid: c.centroid.map(([i, w]) => [i, +w.toFixed(3)]), samples: c.samples.map((s) => s.map(([i, w]) => [i, +w.toFixed(3)])) })) });
writeFileSync('data/recipe-model.json', json);
const total = Object.values(samples).reduce((a, l) => a + l.length, 0);
console.log(`학습 표현 ${total}개(증강 포함), 레시피 ${model.classes.length}개, 특징 ${model.vocab.length}개`);
console.log(`모델 파일 ${(statSync('data/recipe-model.json').size / 1024).toFixed(0)}KB, gzip ${(gzipSync(json).length / 1024).toFixed(0)}KB`);
