// 작은 모델 평가.
//   node scripts/eval-model.mjs calibrate data/recommend-hybrid-eval.json        # 확신도 기준을 고르기 위한 표(이미 본 세트로만)
//   node scripts/eval-model.mjs final data/recommend-hybrid-eval2.json 0.35 0.05 [--json out]  # 기준을 고정하고 한 번만 측정
// 적중 = 화면이 보여 줄 상위 3개 안에 정답 후보가 있음. 모델이 확신하면 그 레시피의 정답, 아니면 일반 추정(클래스 3 + 메서드 3 중 하나라도).
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expandMembers } from '../src/domain/memberIndex.ts';
import { buildMemberRecIndex, recommendMembers } from '../src/domain/memberRecommend.ts';
import { buildIndex, recommend } from '../src/domain/recommend.ts';
import { parseRef } from '../src/domain/recipes.ts';
import { decide, prepareModel, scoreModel } from '../src/domain/recipeModel.ts';

const [mode, file, minScoreArg, minMarginArg] = process.argv.slice(2);
const minor = '1.154';
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const memIdx = buildMemberRecIndex(expandMembers(gz(`public/data/v/${minor}/members.json.gz`)));
const clsIdx = buildIndex(gz(`public/data/v/${minor}/intent.json.gz`));
const intents = JSON.parse(readFileSync('public/data/intents.json', 'utf8')).intents;
const recipes = new Map(JSON.parse(readFileSync('public/data/recipes.json', 'utf8')).recipes.map((r) => [r.id, r]));
const pm = prepareModel(JSON.parse(readFileSync('data/recipe-model.json', 'utf8')));
const { cases } = JSON.parse(readFileSync(file, 'utf8'));
const base = (c) => c.split('.').pop();
const hit = (pat, c, n) => {
  if (n) { const [pc, pm2] = pat.includes('#') ? pat.split('#') : [null, pat]; return pm2 === n && (!pc || base(c) === pc || c === pc); }
  return pat === c || pat === base(c);
};
const refsOf = (id, scores) => {
  const out = [], seen = new Set();
  for (const sc of [scores.find((s) => s.id === id), ...scores.filter((s) => s.id !== id)]) {
    for (const a of recipes.get(sc.id).answers) { if (!seen.has(a.ref)) { seen.add(a.ref); out.push(parseRef(a.ref)); if (out.length >= 3) return out; } }
  }
  return out;
};
const fallbackOk = (c) => {
  const cls = recommend(clsIdx, c.q, intents, 3).results.map((r) => ({ c: r.c.n, n: null }));
  const mem = recommendMembers(memIdx, c.q, intents, 3).results.map((r) => ({ c: r.r.c, n: r.r.n }));
  return [...cls, ...mem].some((r) => c.expect.some((p) => hit(p, r.c, r.n)));
};
// 질문마다: 모델 1등 점수·여유, 그 레시피가 맞는지(정답 후보와 겹치는지)
const rows = cases.map((c) => {
  const scores = scoreModel(pm, c.q);
  const top = scores[0], second = scores[1];
  const recipeRight = top ? refsOf(top.id, scores).some((r) => c.expect.some((p) => hit(p, r.c, r.n))) : false;
  return { c, scores, top, margin: top && second ? top.score - second.score : top?.score ?? 0, recipeRight, fb: fallbackOk(c) };
});
const evaluate = (minScore, minMargin) => {
  const st = { covered: { n: 0, hit: 0, accepted: 0, acceptedHit: 0 }, uncovered: { n: 0, hit: 0, accepted: 0, acceptedHit: 0 } };
  const fails = [];
  for (const r of rows) {
    const s = st[r.c.kind]; s.n++;
    const d = decide(r.scores, minScore, minMargin);
    const ok = d ? r.recipeRight : r.fb;
    if (d) { s.accepted++; if (r.recipeRight) s.acceptedHit++; }
    if (ok) s.hit++; else fails.push(`FAIL [${r.c.kind}/${d ? '레시피 ' + d.id + ' ' + d.score.toFixed(2) : '일반 추정'}] ${r.c.q}   기대: ${r.c.expect.join(' | ')}`);
  }
  return { st, fails };
};
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
if (mode === 'calibrate') {
  console.log('minScore minMargin | covered 적중 / 레시피 채택(정확) | uncovered 적중 / 레시피 채택(오채택)');
  for (const ms of [0.2, 0.25, 0.3, 0.35, 0.4, 0.5]) for (const mg of [0, 0.03, 0.06, 0.1]) {
    const { st } = evaluate(ms, mg);
    console.log(`${ms.toFixed(2)}     ${mg.toFixed(2)}     | ${pct(st.covered.hit, st.covered.n)} (${st.covered.hit}/${st.covered.n})  채택 ${st.covered.accepted} 정확 ${st.covered.acceptedHit} | ${pct(st.uncovered.hit, st.uncovered.n)} (${st.uncovered.hit}/${st.uncovered.n})  채택 ${st.uncovered.accepted} (오채택)`);
  }
} else {
  const minScore = Number(minScoreArg), minMargin = Number(minMarginArg);
  const { st, fails } = evaluate(minScore, minMargin);
  for (const f of fails) console.log(f);
  console.log(`\nUI5 ${minor} · 작은 모델 평가 (기준 minScore=${minScore}, minMargin=${minMargin}, ${cases.length}개, 한 번 측정)`);
  for (const [k, v] of Object.entries(st)) console.log(`${k.padEnd(10)} n=${String(v.n).padStart(2)}  적중 ${v.hit} (${pct(v.hit, v.n)})  레시피 채택 ${v.accepted}개 중 정확 ${v.acceptedHit}`);
  const jo = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  if (jo) writeFileSync(jo, JSON.stringify({ minor, at: new Date().toISOString(), minScore, minMargin, covered: st.covered, uncovered: st.uncovered }, null, 1));
}
