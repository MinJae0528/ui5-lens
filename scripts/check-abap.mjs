// data/abap/*.json 점검: 모든 공식 링크가 검증 목록에 있는지(verified-links.txt = SAP 공개 저장소에서 실제로 쓰인 주소,
// note-links.txt = 수업 정리노트에 실린 SAP 공식 주소 중 열리는 것), 항목 id 가 겹치지 않는지, 필수 칸이 있는지,
// tcode 사전의 연결(관련 tcode·개념 항목)이 실제로 있는지 확인한다. (주소가 지금도 열리는지까지는 검사하지 않는다)
// 수업 서버 정보(계정 형식·시스템 ID·주소 등)가 섞여 들어가지 않았는지도 막는다: 공개 저장소에 올라가므로.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const lines = (f) => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
const ok = new Set([...lines('data/abap/verified-links.txt'), ...lines('data/abap/note-links.txt')]);
// 일반 패턴만 저장소에 둔다. 수업 서버의 실제 이름·접두어는 공개되면 안 되므로 git 에 올리지 않는 로컬 파일(한 줄에 정규식 하나)에서 읽는다.
const LOCAL = 'data/abap/forbidden.local.txt';
const FORBIDDEN = [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, /초기\s*비밀번호/, /password/i, ...(existsSync(LOCAL) ? lines(LOCAL).map((l) => new RegExp(l, 'i')) : [])];
const errs = []; let n = 0;
const files = readdirSync('data/abap').filter((x) => x.endsWith('.json'));
const docs = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(`data/abap/${f}`, 'utf8'))]));
for (const f of files) {
  const d = docs[f]; const ids = new Set();
  for (const bad of FORBIDDEN) if (bad.test(JSON.stringify(d))) errs.push(`${f}: 수업 서버 정보로 보이는 값 (${bad})`);
  for (const e of d.entries) {
    n++;
    if (ids.has(e.id)) errs.push(`${f}: id 중복 ${e.id}`); ids.add(e.id);
    const req = f === 'tcodes.json' ? ['code', 'name', 'group', 'summary'] : ['term', 'group', 'summary', 'whenToUse', 'syntax'];
    for (const k of req) if (!e[k]) errs.push(`${f}/${e.id}: ${k} 없음`);
    if (!e.links?.length && !e.basis) errs.push(`${f}/${e.id}: 공식 링크도 근거(basis) 문구도 없음`);
    for (const l of e.links || []) { if (!ok.has(l.url)) errs.push(`${f}/${e.id}: 검증 목록에 없는 링크 ${l.url}`); if (!d.sites[l.site]) errs.push(`${f}/${e.id}: sites 에 없는 출처 ${l.site}`); }
  }
}
const tc = docs['tcodes.json'], basics = docs['basics.json'];
if (tc && basics) {
  const tids = new Set(tc.entries.map((e) => e.id)), bids = new Set(basics.entries.map((e) => e.id));
  for (const e of tc.entries) {
    if (!tc.groups.includes(e.group)) errs.push(`tcodes/${e.id}: groups 에 없는 그룹 ${e.group}`);
    if (!/^[a-z0-9-]{1,40}$/.test(e.id)) errs.push(`tcodes/${e.id}: 주소에 쓸 수 없는 id`);
    for (const r of e.related || []) if (!tids.has(r.id)) errs.push(`tcodes/${e.id}: 없는 관련 tcode ${r.id}`);
    if (e.concept && !bids.has(e.concept.id)) errs.push(`tcodes/${e.id}: 없는 개념 항목 ${e.concept.id}`);
  }
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`ABAP 항목 ${n}개 점검 통과`);
