// data/abap/*.json 점검: 모든 공식 링크가 verified-links.txt(SAP 공개 저장소에서 실제로 쓰인 주소)에 있는지,
// 항목 id 가 겹치지 않는지, 필수 칸이 있는지 확인한다. (주소가 지금도 열리는지까지는 검사하지 않는다)
import { readFileSync, readdirSync } from 'node:fs';
const ok = new Set(readFileSync('data/abap/verified-links.txt', 'utf8').split(/\r?\n/).filter(Boolean));
const errs = []; let n = 0;
for (const f of readdirSync('data/abap').filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(`data/abap/${f}`, 'utf8')); const ids = new Set();
  for (const e of d.entries) {
    n++;
    if (ids.has(e.id)) errs.push(`${f}: id 중복 ${e.id}`); ids.add(e.id);
    for (const k of ['term', 'group', 'summary', 'whenToUse', 'syntax']) if (!e[k]) errs.push(`${f}/${e.id}: ${k} 없음`);
    if (!e.links?.length) errs.push(`${f}/${e.id}: 공식 링크 없음`);
    for (const l of e.links || []) if (!ok.has(l.url)) errs.push(`${f}/${e.id}: 검증 목록에 없는 링크 ${l.url}`);
  }
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`ABAP 항목 ${n}개 점검 통과`);
