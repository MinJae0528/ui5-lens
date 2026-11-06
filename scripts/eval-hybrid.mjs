// 하이브리드 추천(레시피 → 아니면 일반 추정) 평가: node scripts/eval-hybrid.mjs [-v] [--json 경로]
// 화면이 보여 주는 것과 같은 규칙: 레시피가 맞으면 레시피 상위 3개, 아니면 클래스 추천 3개와 메서드 추천 3개 중 하나라도 맞으면 적중.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expandMembers } from '../src/domain/memberIndex.ts';
import { buildMemberRecIndex, recommendMembers } from '../src/domain/memberRecommend.ts';
import { buildIndex, recommend } from '../src/domain/recommend.ts';
import { matchRecipes, parseRef, pickAnswers } from '../src/domain/recipes.ts';

const minor = '1.154', verbose = process.argv.includes('-v');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const rows = expandMembers(gz(`public/data/v/${minor}/members.json.gz`));
const memIdx = buildMemberRecIndex(rows);
const clsIdx = buildIndex(gz(`public/data/v/${minor}/intent.json.gz`));
const intents = JSON.parse(readFileSync('public/data/intents.json', 'utf8')).intents;
const recipes = JSON.parse(readFileSync('public/data/recipes.json', 'utf8')).recipes;
const { cases } = JSON.parse(readFileSync('data/recommend-hybrid-eval.json', 'utf8'));

const base = (c) => c.split('.').pop();
// 정답 후보(pat) 와 화면에 나온 항목(ref: 클래스 또는 클래스#종류:이름) 비교
const hit = (pat, c, k, n) => {
  if (n) { const [pc, pm] = pat.includes('#') ? pat.split('#') : [null, pat]; return pm === n && (!pc || base(c) === pc || c === pc); }
  return pat === c || pat === base(c);
};
const stat = { covered: { n: 0, hit: 0, viaRecipe: 0, recipeHit: 0 }, uncovered: { n: 0, hit: 0, viaRecipe: 0, recipeHit: 0 } };
for (const c of cases) {
  const s = stat[c.kind]; s.n++;
  const picks = pickAnswers(matchRecipes(recipes, c.q), 3).map((a) => parseRef(a.ref));
  let ok, via;
  if (picks.length) { via = 'recipe'; ok = picks.some((r) => c.expect.some((p) => hit(p, r.c, r.k, r.n))); s.viaRecipe++; if (ok) s.recipeHit++; }
  else {
    via = 'fallback';
    const cls = recommend(clsIdx, c.q, intents, 3).results.map((r) => ({ c: r.c.n, n: null }));
    const mem = recommendMembers(memIdx, c.q, intents, 3).results.map((r) => ({ c: r.r.c, n: r.r.n }));
    ok = [...cls, ...mem].some((r) => c.expect.some((p) => hit(p, r.c, null, r.n)));
  }
  if (ok) s.hit++;
  if (verbose || !ok) console.log(`${ok ? 'PASS' : 'FAIL'} [${c.kind}/${via}] ${c.q}   기대: ${c.expect.join(' | ')}${picks.length ? '   레시피 정답: ' + picks.map((r) => `${base(r.c)}${r.n ? '#' + r.n : ''}`).join(', ') : ''}`);
}
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
console.log(`\nUI5 ${minor} · 하이브리드 추천 평가 (질문 ${cases.length}개, 한 번 측정)`);
for (const [k, v] of Object.entries(stat)) console.log(`${k.padEnd(10)} n=${String(v.n).padStart(2)}  적중 ${v.hit} (${pct(v.hit, v.n)})  레시피 적용 ${v.viaRecipe}개 중 적중 ${v.recipeHit}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ minor, at: new Date().toISOString(), covered: stat.covered, uncovered: stat.uncovered }, null, 1));
