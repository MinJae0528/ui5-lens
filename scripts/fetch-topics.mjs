// 호스팅된 버전별 "문서 가이드" 목차(docs/topics/index.json)를 받아 캐시에 둔다. (본문은 받지 않는다: 목차 + 공식 문서 링크만 제공)
//   node scripts/fetch-topics.mjs [1.154 1.120 ...]
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { CACHE_DIR } from './paths.mjs';

const vs = JSON.parse(await readFile('data/versions.json', 'utf8')).versions.filter((v) => v.hosted);
const only = process.argv.slice(2);
const exists = (p) => access(p).then(() => true, () => false);
const targets = only.length ? vs.filter((v) => only.includes(v.minor)) : vs;
let ok = 0, none = 0;
for (const v of targets) {
  const dir = join(CACHE_DIR, v.minor);
  await mkdir(dir, { recursive: true });
  const f = join(dir, 'topics.index.json.gz');
  if (await exists(f)) { ok++; continue; }
  const url = `https://ui5.sap.com/${v.path}/docs/topics/index.json`;
  try {
    const r = await fetch(url);
    if (r.status === 404) { none++; console.log(`${v.minor}: 문서 목차 없음(404)`); await writeFile(join(dir, 'topics.none'), ''); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    const j = JSON.parse(text);
    if (!Array.isArray(j)) throw new Error('예상하지 못한 형식');
    await writeFile(f, gzipSync(text));
    ok++;
    console.log(`${v.minor}: ${url}  ${(text.length / 1e3).toFixed(0)}KB`);
  } catch (e) { console.log(`${v.minor}: 실패 ${e.message}`); }
}
console.log(`\n목차 받음 ${ok}개 · 없음 ${none}개`);
