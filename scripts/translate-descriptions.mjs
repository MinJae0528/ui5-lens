// 공식 영문 설명(클래스·멤버의 첫 문장)을 Claude API 로 한국어로 번역해 캐시(data/mt/ko.jsonl)에 쌓는다.
// 같은 영어 문장은 한 번만 번역한다(버전·클래스가 달라도 재사용). 이미 번역한 문장은 다시 보내지 않는다.
//   node scripts/translate-descriptions.mjs --dry                  # 개수·글자 수만 센다(API 호출 없음)
//   node scripts/translate-descriptions.mjs --apis ko --limit 200  # 한국어 문서가 있는 API 만, 최대 200문장(시험 번역)
//   node scripts/translate-descriptions.mjs                        # 기준 버전(1.154) 전체
//   node scripts/translate-descriptions.mjs --all                  # 만들어 둔 모든 버전
// 필요: 환경변수 ANTHROPIC_API_KEY.  번역한 뒤 node scripts/build-data.mjs 를 다시 돌리면 화면 데이터에 붙는다.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { mtKey, mtUnit } from './mt-unit.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const has = (n) => process.argv.includes(n);
const BASE = '1.154', CACHE = arg('--cache') ?? 'data/mt/ko.jsonl';
const MODEL = arg('--model') ?? 'claude-haiku-5-5';
const LIMIT = arg('--limit') ? Number(arg('--limit')) : Infinity;
const CONC = Number(arg('--concurrency') ?? 4);
const BATCH_CHARS = 5000, BATCH_MAX = 40;

const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const koApis = existsSync('data/ko') ? new Set(readdirSync('data/ko').filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(`data/ko/${f}`, 'utf8')).api)) : new Set();

// 1) 번역할 문장 모으기
const minors = has('--all') ? readdirSync('public/data/v') : [BASE];
const units = new Map(); // key → text
for (const minor of minors) {
  const idx = gz(`public/data/v/${minor}/index.json.gz`);
  for (const lib of new Set(idx.map((e) => e.l))) {
    for (const d of gz(`public/data/v/${minor}/lib/${encodeURIComponent(lib)}.json.gz`)) {
      if (arg('--apis') === 'ko' && !koApis.has(d.name)) continue;
      const add = (html) => { const t = mtUnit(html); if (t) units.set(mtKey(t), t); };
      add(d.description);
      for (const k of ['properties', 'aggregations', 'associations', 'events', 'methods']) for (const m of d[k] || []) add(m.description);
    }
  }
}
const done = new Set();
if (existsSync(CACHE)) for (const line of readFileSync(CACHE, 'utf8').split('\n')) if (line.trim()) { try { done.add(JSON.parse(line).k); } catch { /* 깨진 줄은 무시 */ } }
const pending = [...units].filter(([k]) => !done.has(k));
const todo = pending.slice(0, LIMIT);
const chars = todo.reduce((a, [, t]) => a + t.length, 0);
console.log(`문장 ${units.size}개 중 이미 번역 ${units.size - pending.length}개, 남은 ${pending.length}개 중 이번에 ${todo.length}개(영어 ${chars.toLocaleString()}자) 번역`);
if (has('--dry') || !todo.length) process.exit(0);

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 환경변수가 없습니다. PowerShell: $env:ANTHROPIC_API_KEY="..."  (키를 파일·채팅에 적지 마세요)'); process.exit(1); }
mkdirSync('data/mt', { recursive: true });

const SYSTEM = `당신은 SAPUI5 공식 API 문서를 한국어로 옮기는 기술 번역가입니다.
규칙:
- 입력은 JSON 배열 [{"id":"..","text":".."}] 입니다. 같은 id 로 [{"id":"..","ko":".."}] 만 JSON 으로 출력하세요. 다른 말은 쓰지 마세요.
- 원문에 없는 내용을 추가하거나 빼지 마세요. 의미를 그대로 옮기고 문체는 "~합니다/~입니다"로 통일하세요.
- 코드 식별자는 번역하지 말고 원문 그대로 두세요: 클래스·속성·메서드·이벤트 이름(sap.m.Button, liveChange, setText 등), 값(true, false, "Start", 숫자), HTML 태그, 파일·형식 이름.
- 용어: control=컨트롤, aggregation=구성 요소(aggregation), association=참조 관계(association), property=속성, event=이벤트, method=메서드, binding=바인딩, model=모델, deprecated=deprecated(그대로), popup=팝업, dialog=대화상자, user=사용자.
- 문장이 "…" 로 끝나면 번역도 "…" 로 끝내세요.`;

async function translate(batch, attempt = 1) {
  // Haiku 5.5 는 생각(thinking)이 기본으로 켜져 출력 토큰으로 과금되므로, 단순 번역에서는 끈다(effort 기본값 medium 에서 허용됨)
  const body = { model: MODEL, max_tokens: 4096, thinking: { type: 'disabled' }, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(batch.map(([k, t]) => ({ id: k, text: t }))) }] };
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  if (res.status === 429 || res.status >= 500) { if (attempt > 5) throw new Error(`HTTP ${res.status}`); await new Promise((r) => setTimeout(r, 2000 * attempt)); return translate(batch, attempt + 1); }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  usage.in += j.usage?.input_tokens ?? 0; usage.out += j.usage?.output_tokens ?? 0;
  const text = j.content?.map((c) => c.text ?? '').join('') ?? '';
  const m = /\[[\s\S]*\]/.exec(text);
  const arr = m ? JSON.parse(m[0]) : [];
  const out = new Map(arr.filter((x) => x && typeof x.id === 'string' && typeof x.ko === 'string' && x.ko.trim()).map((x) => [x.id, x.ko.trim()]));
  const missing = batch.filter(([k]) => !out.has(k));
  if (missing.length && missing.length < batch.length && attempt <= 2) { const more = await translate(missing, attempt + 1); for (const [k, v] of more) out.set(k, v); }
  return out;
}

const usage = { in: 0, out: 0 };
const batches = [];
for (let i = 0, cur = [], n = 0; i <= todo.length; i++) {
  const it = todo[i];
  if (!it || cur.length >= BATCH_MAX || n + it[1].length > BATCH_CHARS) { if (cur.length) batches.push(cur); cur = []; n = 0; }
  if (it) { cur.push(it); n += it[1].length; }
}
let next = 0, ok = 0, fail = 0;
async function worker() {
  while (next < batches.length) {
    const b = batches[next++];
    try {
      const out = await translate(b);
      for (const [k, t] of out) { appendFileSync(CACHE, JSON.stringify({ k, t }) + '\n'); ok++; }
      fail += b.length - out.size;
    } catch (e) { fail += b.length; console.error(`배치 실패: ${e.message}`); }
    if (next % 10 === 0) console.log(`  진행 ${next}/${batches.length} 배치 · 번역 ${ok}개 · 실패 ${fail}개 · 토큰 입력 ${usage.in} 출력 ${usage.out}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`끝: 번역 ${ok}개, 실패 ${fail}개(다시 실행하면 이어서 번역) · 토큰 입력 ${usage.in.toLocaleString()} 출력 ${usage.out.toLocaleString()} · 모델 ${MODEL}`);
