// ui5.sap.com 에 실제로 호스팅된 UI5 버전을 찾아 data/versions.json 에 기록한다.
// versionoverview.json 의 마이너 112개 중, 별칭(/1.108/) 또는 패치 번호로 응답하는 것만 남긴다.
import { writeFileSync, mkdirSync } from 'node:fs';
const vo = await (await fetch('https://ui5.sap.com/versionoverview.json')).json();
const by = new Map();
for (const p of vo.patches) { const m = p.version.match(/^(\d+\.\d+)\./); if (m) (by.get(m[1]) ?? by.set(m[1], []).get(m[1])).push(p.version); }
const meta = new Map(vo.versions.map((v) => [v.version.replace('.*', ''), v]));
const head = async (u) => { try { return (await fetch(u, { method: 'HEAD' })).status; } catch { return 0; } };
const minors = [...by.keys()]; const out = []; let i = 0;
async function worker() {
  while (i < minors.length) {
    const mn = minors[i++];
    const vs = by.get(mn).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    let hit = null;
    for (const c of [mn, ...vs]) if (await head(`https://ui5.sap.com/${c}/resources/sap-ui-version.json`) === 200) { hit = c; break; }
    if (!hit) { out.push({ minor: mn, hosted: false }); continue; }
    const vj = await (await fetch(`https://ui5.sap.com/${hit}/resources/sap-ui-version.json`)).json();
    const m = meta.get(mn) ?? {};
    out.push({ minor: mn, hosted: true, path: hit, version: vj.version, support: m.support ?? null, lts: !!m.lts, eom: m.eom || null, eocp: m.eocp || null, sapuiversion: m.sapuiversion || null, frontendserver: m.frontendserver || null, label: m.version_label ?? mn });
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
out.sort((a, b) => b.minor.localeCompare(a.minor, undefined, { numeric: true }));
mkdirSync('data', { recursive: true });
writeFileSync('data/versions.json', JSON.stringify({ discoveredAt: new Date().toISOString(), versions: out }, null, 1));
const hosted = out.filter((o) => o.hosted);
console.log(`마이너 ${out.length}개 중 호스팅 ${hosted.length}개 → data/versions.json`);
console.log(hosted.map((o) => `${o.minor}(${o.version})`).join(' '));
