// 추천 메서드·이벤트(멤버) 정확도 평가: node scripts/eval-member-recommend.mjs [버전] [-v] [--json 경로]
// data/recommend-members-eval.json 의 질문마다 상위 3/8개 안에 정답 후보가 있는지 계산한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expandMembers } from '../src/domain/memberIndex.ts';
import { buildMemberRecIndex, recommendMembers } from '../src/domain/memberRecommend.ts';

const minor = process.argv.find((a) => /^1\.\d+$/.test(a)) ?? '1.154';
const verbose = process.argv.includes('-v');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const rows = expandMembers(JSON.parse(gunzipSync(readFileSync(`public/data/v/${minor}/members.json.gz`)).toString('utf8')));
const intents = JSON.parse(readFileSync('public/data/intents.json', 'utf8')).intents;
const index = buildMemberRecIndex(rows);
const { cases } = JSON.parse(readFileSync('data/recommend-members-eval.json', 'utf8'));

const base = (c) => c.split('.').pop();
const matches = (r, pat) => {
  const [cls, mem] = pat.includes('#') ? pat.split('#') : [null, pat];
  return r.n === mem && (!cls || base(r.c) === cls);
};
// 정답 후보가 말뭉치에 하나도 없으면 평가 오류(질문이 아니라 기대값 문제)로 따로 센다.
let n = 0, t3 = 0, t8 = 0, invalid = 0;
for (const c of cases) {
  if (!c.expect.some((p) => rows.some((r) => matches(r, p)))) { invalid++; console.log(`!! 정답 후보가 ${minor} 멤버 색인에 없음(평가 오류): ${c.q}`); continue; }
  const res = recommendMembers(index, c.q, intents, 8).results.map((x) => x.r);
  const hit = (k) => res.slice(0, k).some((r) => c.expect.some((p) => matches(r, p)));
  n++; if (hit(3)) t3++; if (hit(8)) t8++;
  if (verbose || !hit(3)) console.log(`${hit(3) ? 'PASS' : 'FAIL'} ${c.q} → ${res.slice(0, 3).map((r) => `${base(r.c)}#${r.n}`).join(', ') || '(없음)'}   기대: ${c.expect.join(' | ')}`);
}
const pct = (a) => (n ? `${Math.round((a / n) * 100)}%` : '-');
console.log(`\nUI5 ${minor} · 추천 멤버 평가 ${n}개 (평가 오류 ${invalid}개 제외)  상위3 ${t3}/${n} (${pct(t3)})  상위8 ${t8}/${n} (${pct(t8)})`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ minor, at: new Date().toISOString(), n, top3: t3, top8: t8, invalid }, null, 1));
