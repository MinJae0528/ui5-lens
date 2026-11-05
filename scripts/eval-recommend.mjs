// 기능 추천 정확도 평가: node scripts/eval-recommend.mjs [버전] [-v] [--json 경로]
// data/recommend-eval.json 의 질문마다 상위 1/3 안에 정답 후보가 있는지 계산한다. dev/test 를 나눠 보고한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildIndex, recommend } from '../src/domain/recommend.ts';

const minor = process.argv.find((a) => /^1\.\d+$/.test(a)) ?? '1.154';
const verbose = process.argv.includes('-v');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const corpus = JSON.parse(gunzipSync(readFileSync(`public/data/v/${minor}/intent.json.gz`)).toString('utf8'));
const names = new Set(corpus.map((c) => c.n));
const intents = JSON.parse(readFileSync('public/data/intents.json', 'utf8')).intents;
const index = buildIndex(corpus);
const { cases } = JSON.parse(readFileSync('data/recommend-eval.json', 'utf8'));

const match = (n, w) => n === w || n.startsWith(w + '.');
const stat = Object.fromEntries(['dev', 'test', 'fresh'].map((k) => [k, { n: 0, top1: 0, top3: 0, top8: 0 }]));
const rows = [];
let invalid = 0;
for (const c of cases) {
  const alive = c.expect.filter((w) => [...names].some((n) => match(n, w)));
  if (!alive.length) { invalid++; console.log(`!! 정답 후보가 ${minor} 말뭉치에 없음(평가 오류): ${c.q} → ${c.expect.join(', ')}`); continue; }
  const r = recommend(index, c.q, intents, 8).results.map((x) => x.c.n);
  const hit = (k) => r.slice(0, k).some((n) => alive.some((w) => match(n, w)));
  const s = stat[c.split];
  s.n++; if (hit(1)) s.top1++; if (hit(3)) s.top3++; if (hit(8)) s.top8++;
  rows.push({ q: c.q, split: c.split, top3: hit(3), got: r.slice(0, 3) });
  if (verbose || !hit(3)) console.log(`${hit(3) ? 'PASS' : 'FAIL'} [${c.split}] ${c.q} → ${r.slice(0, 3).join(', ') || '(없음)'}   기대: ${alive.join(' | ')}`);
}
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : '-');
const all = Object.values(stat).reduce((a, s) => ({ n: a.n + s.n, top1: a.top1 + s.top1, top3: a.top3 + s.top3, top8: a.top8 + s.top8 }), { n: 0, top1: 0, top3: 0, top8: 0 });
console.log(`\nUI5 ${minor} · 평가 질문 ${all.n}개 (평가 오류 ${invalid}개 제외)`);
for (const [k, s] of [['dev (튜닝에 사용)', stat.dev], ['test (이후 오염됨)', stat.test], ['fresh (튜닝 후 작성)', stat.fresh], ['전체', all]])
  console.log(`${k.padEnd(18)} n=${String(s.n).padStart(2)}  1위 ${pct(s.top1, s.n).padStart(4)}  상위3 ${pct(s.top3, s.n).padStart(4)}  상위8 ${pct(s.top8, s.n).padStart(4)}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ minor, at: new Date().toISOString(), dev: stat.dev, test: stat.test, fresh: stat.fresh, all, invalid }, null, 1));
