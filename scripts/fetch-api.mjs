// 호스팅된 모든 버전의 모든 라이브러리 api.json 을 받아 로컬 캐시(OneDrive 밖, gzip)에 저장한다. 중단 후 재실행하면 이어서 받는다.
//   node scripts/fetch-api.mjs                 # data/versions.json 의 전체 버전
//   node scripts/fetch-api.mjs 1.120 1.71      # 특정 마이너만
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CACHE_DIR } from './paths.mjs';

const vs = JSON.parse(await readFile('data/versions.json', 'utf8')).versions.filter((v) => v.hosted);
const only = process.argv.slice(2);
const targets = only.length ? vs.filter((v) => only.includes(v.minor)) : vs;
const exists = (p) => access(p).then(() => true, () => false);
const CONC = 12;
let done = 0, bytes = 0, missing = 0;

async function pool(items, fn) { let i = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) await fn(items[i++]); })); }
async function get(url, tries = 3) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    catch (e) { if (t >= tries) throw new Error(`${url}: ${e.message}`); await new Promise((s) => setTimeout(s, 800 * t)); }
  }
}

for (const v of targets) {
  const dir = join(CACHE_DIR, v.minor);
  await mkdir(dir, { recursive: true });
  const base = `https://ui5.sap.com/${v.path}`;
  const verJson = JSON.parse(await get(`${base}/resources/sap-ui-version.json`));
  // 원격이 준 라이브러리 이름이 파일 경로로 쓰이므로, 경로 이탈(../)·특수문자가 있는 이름은 거부한다.
  const libs = verJson.libraries.map((l) => l.name).filter((n) => { const ok = /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n) && !n.includes('..'); if (!ok) console.warn(`건너뜀: 허용되지 않는 라이브러리 이름 ${JSON.stringify(n)}`); return ok; });
  const manifestPath = join(dir, 'manifest.json');
  const manifest = { minor: v.minor, path: v.path, version: verJson.version, fetchedAt: new Date().toISOString(), libraries: {}, noApiJson: [] };
  if (await exists(manifestPath)) Object.assign(manifest, JSON.parse(await readFile(manifestPath, 'utf8')));
  await pool(libs, async (lib) => {
    const f = join(dir, `${lib}.api.json.gz`);
    if (await exists(f)) { done++; return; }
    const url = `${base}/test-resources/${lib.replaceAll('.', '/')}/designtime/api.json`;
    const text = await get(url);
    if (text === null) { missing++; if (!manifest.noApiJson.includes(lib)) manifest.noApiJson.push(lib); return; }
    const j = JSON.parse(text);
    await writeFile(f, gzipSync(text));
    manifest.libraries[lib] = { url, apiJsonVersion: j.version, symbols: j.symbols?.length ?? 0, sha256: createHash('sha256').update(text).digest('hex'), bytes: text.length };
    bytes += text.length; done++;
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`${v.minor} (${verJson.version}) 라이브러리 ${libs.length}개, api.json ${Object.keys(manifest.libraries).length}개 · 누적 ${(bytes / 1e6).toFixed(0)}MB`);
}
console.log(`완료: ${done}개 처리, api.json 없는 라이브러리 ${missing}개, 새로 받은 원본 ${(bytes / 1e6).toFixed(0)}MB, 캐시: ${CACHE_DIR}`);
