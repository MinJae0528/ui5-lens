// 다른 AI(Codex·Gemini 등)가 만든 평가 질문·학습 표현 파일을 검증하고 합친다.
//   node scripts/import-external.mjs eval    # data/external/eval-*.json → data/external/eval-set.json (정답이 1.154 에 실제로 있는지 검사, dev/test 분할, 레시피 적용 범위 자동 분류)
//   node scripts/import-external.mjs train   # data/external/train-*.json 형식 검사와 개수 요약
// test 쪽 질문 문장은 화면에 출력하지 않는다(최종 한 번 측정의 독립성을 지키려는 것).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseRef } from '../src/domain/recipes.ts';
import { splitOf, validateEval, validateTrain } from '../src/domain/evalSet.ts';

const mode = process.argv[2];
const DIR = 'data/external';
const files = (prefix) => (existsSync(DIR) ? readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.json') && f !== 'eval-set.json') : []);
const recipes = JSON.parse(readFileSync('data/recipes.json', 'utf8')).recipes;

if (mode === 'eval') {
  const minor = '1.154';
  const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
  const idx = gz(`public/data/v/${minor}/index.json.gz`), mem = gz(`public/data/v/${minor}/members.json.gz`);
  const classes = new Set(idx.map((e) => e.n));
  const KC = { method: 'm', property: 'p', event: 'e', aggregation: 'a', association: 's' };
  const rows = new Set(mem.m.map(([ci, k, n]) => `${mem.c[ci]}#${k}:${n}`));
  const memberNames = new Map(); // 멤버 이름만 쓴 정답을 허용하지 않으므로(형식 고정) 사용하지 않음
  void memberNames;
  const base = (c) => c.split('.').pop();
  const recipeRefs = recipes.flatMap((r) => r.answers.map((a) => parseRef(a.ref)));
  const same = (a, b) => a.c === b.c && (a.k ?? '') === (b.k ?? '') && (a.n ?? '') === (b.n ?? '');

  const all = [];
  let badFormat = 0, badRef = 0;
  for (const f of files('eval-')) {
    const { questions, issues } = validateEval(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));
    badFormat += issues.length;
    for (const i of issues) console.log(`  [${f}] #${i.index} 형식 문제: ${i.problem}`);
    for (const q of questions) {
      const good = [];
      for (const a of q.answers) {
        const r = parseRef(a);
        const exists = r.k ? rows.has(`${r.c}#${KC[r.k]}:${r.n}`) : classes.has(r.c);
        if (exists) good.push(a); else badRef++;
      }
      if (q.kind === 'task' && !good.length) continue; // 정답이 하나도 확인되지 않으면 평가에서 뺀다
      const covered = q.kind === 'task' && good.some((a) => recipeRefs.some((r) => same(parseRef(a), r)));
      all.push({ q: q.q, expect: good, kind: q.kind, coverage: q.kind === 'none' ? 'none' : covered ? 'covered' : 'uncovered', split: splitOf(q.q), area: q.area ?? null, source: f });
    }
  }
  const seen = new Set(); const dedup = all.filter((x) => (seen.has(x.q) ? false : (seen.add(x.q), true)));
  writeFileSync(`${DIR}/eval-set.json`, JSON.stringify({ note: '외부 AI 가 만든 평가 질문(검증·분할 완료). 직접 고치지 않는다.', cases: dedup }, null, 1));
  const cnt = (f) => dedup.filter(f).length;
  console.log(`\n파일 ${files('eval-').length}개 · 질문 ${dedup.length}개 사용 (형식 문제 ${badFormat}건, 공식 자료에 없는 정답 후보 ${badRef}개는 제외)`);
  for (const sp of ['dev', 'test']) console.log(`${sp.padEnd(4)}  표에 있는 작업 ${cnt((x) => x.split === sp && x.coverage === 'covered')} · 표에 없는 작업 ${cnt((x) => x.split === sp && x.coverage === 'uncovered')} · 해당 없음 ${cnt((x) => x.split === sp && x.coverage === 'none')}`);
} else if (mode === 'train') {
  const ids = new Set(recipes.map((r) => r.id));
  let tp = 0, tn = 0;
  for (const f of files('train-')) {
    const { train, issues } = validateTrain(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')), ids);
    for (const i of issues) console.log(`  [${f}] ${i}`);
    const n = Object.values(train.paraphrases).reduce((a, l) => a + l.length, 0);
    tp += n; tn += train.negatives.length;
    const few = [...ids].filter((id) => (train.paraphrases[id]?.length ?? 0) < 10);
    console.log(`${f}: 표현 ${n}개(레시피 ${Object.keys(train.paraphrases).length}/${ids.size}개), 해당 없음 ${train.negatives.length}개${few.length ? `, 표현 10개 미만 레시피 ${few.length}개` : ''}`);
  }
  console.log(`합계: 표현 ${tp}개, 해당 없음 ${tn}개`);
} else {
  console.log('사용법: node scripts/import-external.mjs eval|train');
}
