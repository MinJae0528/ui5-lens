// 사용: npm run ko:stamp -- sap.m.Table
// "한국어 설명을 기준 버전(1.154)의 현재 공식 원문과 대조·확인했다" 는 선언. basedOn.officialHash 를 현재 값으로 갱신한다.
// 다른 버전의 원문이 달라지면 해시가 달라 UI 에 '재검토 필요'가 표시된다.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const api = process.argv[2];
const BASE = '1.154';
if (!api) { console.error('API 이름을 지정하세요'); process.exit(1); }
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const idx = gz(`public/data/v/${BASE}/index.json.gz`).find((i) => i.n === api);
if (!idx) { console.error(`${api} 는 ${BASE} 자료에 없습니다`); process.exit(1); }
const cur = gz(`public/data/v/${BASE}/lib/${encodeURIComponent(idx.l)}.json.gz`).find((d) => d.name === api);
const f = `data/ko/${api}.json`;
const ko = JSON.parse(readFileSync(f, 'utf8'));
ko.basedOn = { officialHash: cur.officialHash, stampedAt: new Date().toISOString().slice(0, 10) };
writeFileSync(f, JSON.stringify(ko, null, 2) + '\n');
console.log(`${api}: officialHash=${cur.officialHash} (UI5 ${BASE})`);
