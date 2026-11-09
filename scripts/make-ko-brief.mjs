// 간단 설명 원고(scripts/ko-brief-spec.mjs)로 data/ko/<api>.json 을 만든다. 이미 있는 상세 문서(간단판이 아닌 것)는 덮어쓰지 않는다.
//   node scripts/make-ko-brief.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BRIEF } from './ko-brief-spec.mjs';

const BASE = '1.154';
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const idx = gz(`public/data/v/${BASE}/index.json.gz`);
const today = new Date().toISOString().slice(0, 10);
let made = 0;
for (const b of BRIEF) {
  const f = `data/ko/${b.api}.json`;
  if (existsSync(f) && JSON.parse(readFileSync(f, 'utf8')).provenance?.depth !== 'brief') { console.log(`건너뜀(상세 문서 있음): ${b.api}`); continue; }
  const e = idx.find((i) => i.n === b.api);
  if (!e) { console.error(`${b.api} 는 ${BASE} 자료에 없음`); process.exit(1); }
  const cur = gz(`public/data/v/${BASE}/lib/${encodeURIComponent(e.l)}.json.gz`).find((d) => d.name === b.api);
  const doc = {
    api: b.api,
    provenance: {
      ui5Version: '1.154.0', checkedAt: today, generator: 'AI(Claude) 간단 설명 초안', ai: true, review: 'draft', depth: 'brief',
      reviewNote: '간단 설명: 요약·언제 쓰는가·핵심 항목만 있고 예제와 사용 순서는 없습니다. 사람이 검토하지 않은 AI 초안입니다.',
      versionNote: '공식 api.json(1.154) 설명을 바탕으로 작성했고 예제는 실행 검증을 하지 않았습니다(예제 없음).',
    },
    basedOn: { officialHash: cur.officialHash, stampedAt: today },
    overview: {
      summary: b.summary, summaryBasis: b.basis,
      whenToUse: b.when.map(([text, basis]) => ({ text, kind: 'service', basis })),
      compare: [], related: b.related.map(([api, role]) => ({ api, role })),
    },
    members: Object.fromEntries(Object.entries(b.members).map(([k, text]) => [k, { text }])),
    usage: { prerequisites: [], exampleFlow: [], recommended: [] },
    examples: [],
  };
  writeFileSync(f, JSON.stringify(doc, null, 2) + '\n');
  made++;
}
console.log(`간단 설명 ${made}개 생성`);
