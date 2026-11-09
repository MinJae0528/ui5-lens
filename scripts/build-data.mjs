// 로컬 캐시(공식 api.json, 전 버전) + data/ko + data/aliases.json
//   → public/data/  (versions.json, availability.json, aliases.json, ko/*, v/<minor>/{meta.json,index.json.gz,lib/<lib>.json.gz})
// 원칙: 사실(이름·자료형·기본값·상속·deprecated)은 공식 자료에서만, 한국어는 별도 층에서 결합.
//   node scripts/build-data.mjs            # 캐시에 있는 모든 버전
//   node scripts/build-data.mjs 1.120 1.71 # 특정 마이너만 (빠른 개발용; availability 는 해당 버전 칸만 갱신)
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CACHE_DIR } from './paths.mjs';

const OUT = 'public/data';
const BASE_MINOR = '1.154'; // 한국어 층을 작성·대조한 기준 버전
const enc = (n) => encodeURIComponent(n);
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 12);

const allVersions = JSON.parse(readFileSync('data/versions.json', 'utf8')).versions.filter((v) => v.hosted);
const only = process.argv.slice(2);
const versions = allVersions.filter((v) => (!only.length || only.includes(v.minor)) && existsSync(join(CACHE_DIR, v.minor, 'manifest.json')));
if (!versions.length) { console.error(`캐시(${CACHE_DIR})에 받아 둔 버전이 없습니다. 먼저 npm run fetch:api`); process.exit(1); }
if (!only.length) rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/ko`, { recursive: true });
const errors = [];

// ---------- 설명 HTML 정리 ----------
const ALLOWED = new Set(['code', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'p', 'br', 'pre', 'a', 'h3', 'h4', 'table', 'tr', 'td', 'th', 'thead', 'tbody']);
function cleanHtml(s, known) {
  if (!s) return '';
  s = s.replace(/\{@link\s+([^\s}]+)(?:\s+([^}]*))?\}/g, (_, target, label) => {
    const text = (label || target).replace(/^#/, '');
    const t = target.replace(/^module:/, '').replace(/\//g, '.');
    return known.has(t) ? `<a data-api="${t}">${text}</a>` : `<code>${text}</code>`;
  });
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (m, slash, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED.has(tag)) return '';
    if (tag === 'a') {
      if (slash) return '</a>';
      const da = /data-api="([^"]+)"/.exec(attrs);
      if (da) return `<a data-api="${da[1]}">`;
      const href = /href="(https?:\/\/[^"]+)"/.exec(attrs);
      return href ? `<a href="${href[1]}" target="_blank" rel="noreferrer noopener">` : '<a>';
    }
    return `<${slash}${tag}>`;
  });
  return s.trim();
}
function plainFirstSentence(html) {
  const t = (html || '').replace(/<[^>]+>/g, ' ').replace(/\{@link\s+[^\s}]+(?:\s+([^}]*))?\}/g, '$1').replace(/\s+/g, ' ').trim();
  const m = /^(.{20,260}?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t.slice(0, 200);
}
const plainN = (html, max) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\{@link\s+[^\s}]+(?:\s+([^}]*))?\}/g, '$1').replace(/\s+/g, ' ').trim().slice(0, max);
const dep = (d) => (d ? { since: d.since ?? null, text: d.text ?? '' } : null);

// ---------- 추가 공식 정보 ----------
// 한국어 설명이 "원문 변경" 으로 잘못 판정되지 않도록 officialHash 에는 넣지 않고, 해시를 계산한 뒤에 붙인다.
function parseRef(raw) {
  const str = String(raw).trim();
  const link = /^\{@link\s+(\S+)(?:\s+([\s\S]*?))?\}$/.exec(str);
  const target = link ? link[1] : str;
  const label = link?.[2]?.trim();
  let m;
  if ((m = /^fiori:(.+)$/.exec(target))) {
    const u = m[1];
    const url = /^https?:\/\//.test(u) ? u : `https://experience.sap.com/fiori-design-web${u.startsWith('/') ? '' : '/'}${u}`;
    return { kind: 'fiori', text: label || u, url };
  }
  if ((m = /^topic:(.+)$/.exec(target))) return { kind: 'topic', text: label || m[1], key: m[1] };
  if (/^https?:\/\//.test(target)) return { kind: 'url', text: label || target, url: target };
  if ((m = /^([A-Za-z0-9_.$/:]+)(?:#([A-Za-z0-9_$.]+))?$/.exec(target))) return { kind: 'api', text: label || target, api: m[1].replace(/^module:/, '').replace(/\//g, '.'), member: m[2] ?? null };
  return { kind: 'text', text: label || str };
}
const cleanExamples = (arr) => (arr || []).map((e) => ({ caption: e.caption ?? null, text: String(e.text ?? '') })).filter((e) => e.text);
function memberExtras(m, known) {
  const r = {};
  if (m.experimental) r.experimental = { since: m.experimental.since ?? null, text: cleanHtml(m.experimental.text || '', known) };
  if (m.allowedFor?.length) r.allowedFor = m.allowedFor;
  if (m.references?.length) r.references = m.references.map(parseRef);
  if (m.examples?.length) r.examples = cleanExamples(m.examples);
  if (m.throws?.length) r.throws = m.throws.map((t) => ({ type: t.type ?? null, description: cleanHtml(t.description || '', known) }));
  if (m.bindable) r.bindable = true;
  return r;
}
function classExtras(s, known) {
  const r = {};
  if (s.abstract) r.abstract = true;
  if (s.final) r.final = true;
  if (s.experimental) r.experimental = { since: s.experimental.since ?? null, text: cleanHtml(s.experimental.text || '', known) };
  if (s.allowedFor?.length) r.allowedFor = s.allowedFor;
  if (s.references?.length) r.references = s.references.map(parseRef);
  if (s.examples?.length) r.examples = cleanExamples(s.examples);
  const c = s.constructor;
  if (c && typeof c === 'object') {
    r.ctor = {
      description: cleanHtml(c.description || '', known),
      references: (c.references || []).map(parseRef),
      examples: cleanExamples(c.examples),
      allowedFor: c.allowedFor || [],
    };
  }
  return r;
}

// ---------- 정규화 ----------
function normalize(name, s, lib, known, docBase) {
  const md = s['ui5-metadata'] || {};
  const pub = (m) => !m.name.startsWith('_') && (m.visibility === undefined || m.visibility === 'public' || m.visibility === 'protected');
  const mdEv = new Map((md.events || []).map((e) => [e.name, e]));
  const evTop = new Map((s.events || []).filter(pub).map((e) => [e.name, e]));
  for (const e of (md.events || []).filter(pub)) if (!evTop.has(e.name)) evTop.set(e.name, e);
  const eventParams = (e) => {
    const direct = mdEv.get(e.name)?.parameters;
    if (direct && typeof direct === 'object' && !Array.isArray(direct))
      return Object.entries(direct).map(([k, v]) => ({ name: k, type: v.type, description: cleanHtml(v.description, known) }));
    const pp = Object.values(e.parameters || {})[0]?.parameterProperties?.getParameters?.parameterProperties;
    return Object.values(pp || {}).map((v) => ({ name: v.name, type: v.type, description: cleanHtml(v.description, known) }));
  };
  const accessor = new Map();
  (md.events || []).forEach((e) => ['attach', 'detach', 'fire'].forEach((v) => accessor.set(v + e.name[0].toUpperCase() + e.name.slice(1), { kind: 'event', name: e.name })));
  const reg = (kind, arr) => (arr || []).forEach((m) => (m.methods || []).forEach((mn) => accessor.set(mn, { kind, name: m.name })));
  reg('property', md.properties); reg('aggregation', md.aggregations); reg('association', md.associations);
  const base = (m) => ({ name: m.name, since: m.since ?? null, deprecated: dep(m.deprecated), visibility: m.visibility || 'public', description: cleanHtml(m.description, known) });
  const out = {
    name, basename: s.basename ?? name.split('.').pop(), library: lib, kind: s.kind, visibility: s.visibility || 'public',
    since: s.since ?? null, deprecated: dep(s.deprecated), extends: s.extends ?? null,
    implements: s.implements ?? [], stereotype: md.stereotype ?? null, module: s.module ?? null, resource: s.resource ?? null,
    description: cleanHtml(s.description, known),
    sourceUrl: `${docBase}/#/api/${encodeURIComponent(name)}`,
    properties: (md.properties || []).filter(pub).map((p) => ({ ...base(p), type: p.type, defaultValue: p.defaultValue ?? null, group: p.group ?? null, methods: p.methods || [] })),
    aggregations: (md.aggregations || []).filter(pub).map((a) => ({ ...base(a), type: a.type, cardinality: a.cardinality, singularName: a.singularName ?? null, isDefault: md.defaultAggregation === a.name, methods: a.methods || [] })),
    associations: (md.associations || []).filter(pub).map((a) => ({ ...base(a), type: a.type, cardinality: a.cardinality, singularName: a.singularName ?? null, methods: a.methods || [] })),
    events: [...evTop.values()].map((e) => ({ ...base(e), allowPreventDefault: !!e.allowPreventDefault, parameters: eventParams(e) })),
    methods: (s.methods || []).filter(pub).map((m) => ({
      ...base(m), static: !!m.static, accessorOf: accessor.get(m.name) ?? null,
      parameters: (m.parameters || []).map((p) => ({ name: p.name, type: p.type, optional: !!p.optional, defaultValue: p.defaultValue ?? null, description: cleanHtml(p.description, known) })),
      returnValue: m.returnValue ? { type: m.returnValue.type, description: cleanHtml(m.returnValue.description, known) } : null,
    })),
    enumValues: s.kind === 'enum' ? (s.properties || []).map((p) => ({ name: p.name, value: p.value ?? null, description: cleanHtml(p.description, known) })) : [],
    typedefProperties: s.kind === 'typedef' ? (s.properties || []).map((p) => ({ name: p.name, type: p.type, optional: !!p.optional, description: cleanHtml(p.description, known) })) : [],
    constructorParams: (s.constructor?.parameters || []).map((p) => ({ name: p.name, type: p.type, optional: !!p.optional, description: cleanHtml(p.description, known) })),
  };
  out.officialHash = sha({ ...out, sourceUrl: undefined });
  Object.assign(out, classExtras(s, known));
  const srcOf = { properties: md.properties, aggregations: md.aggregations, associations: md.associations, events: [...evTop.values()], methods: s.methods };
  for (const [pl, arr] of Object.entries(srcOf)) {
    const byName = new Map((arr || []).map((x) => [x.name, x]));
    for (const m of out[pl]) { const src = byName.get(m.name); if (src) Object.assign(m, memberExtras(src, known)); }
  }
  return out;
}

// ---------- 한국어 층 ----------
const koByApi = new Map();
if (existsSync('data/ko')) for (const f of readdirSync('data/ko').filter((f) => f.endsWith('.json'))) { const k = JSON.parse(readFileSync(`data/ko/${f}`, 'utf8')); koByApi.set(k.api, k); }
const verification = existsSync('data/verification.json') ? JSON.parse(readFileSync('data/verification.json', 'utf8')) : {};
const koHashes = new Map(); // api → { minor: officialHash }
const koBaseDoc = new Map(); // api → 기준 버전 정규화 문서 (멤버 검증용)

// ---------- 버전별 처리 ----------
const memAvail = new Map(); // 심볼 → Map(멤버키 → { minor: 1|2 })
const avail = new Map(); // name → { minor: 1(있음) | 2(deprecated) }
const t0 = Date.now();
for (const v of versions) {
  const dir = join(CACHE_DIR, v.minor);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const docBase = `https://ui5.sap.com/${manifest.path}`;
  const symbols = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.api.json.gz'))) {
    const lib = f.replace('.api.json.gz', '');
    const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8'));
    for (const s of j.symbols || []) if (!symbols.has(s.name)) symbols.set(s.name, { s, lib });
  }
  const known = new Set(symbols.keys());
  const vOut = `${OUT}/v/${v.minor}`;
  rmSync(vOut, { recursive: true, force: true });
  mkdirSync(`${vOut}/lib`, { recursive: true });
  const byLib = new Map();
  const index = [];
  for (const [name, { s, lib }] of symbols) {
    const d = normalize(name, s, lib, known, docBase);
    (byLib.get(lib) ?? byLib.set(lib, []).get(lib)).push(d);
    avail.set(name, { ...(avail.get(name) ?? {}), [v.minor]: d.deprecated ? 2 : 1 });
    {
      const mm = memAvail.get(name) ?? memAvail.set(name, new Map()).get(name);
      for (const [pl, kc] of [['properties', 'p'], ['aggregations', 'a'], ['associations', 's'], ['events', 'e'], ['methods', 'm']])
        for (const m of d[pl] || []) { const k = kc + ':' + m.name; mm.set(k, { ...(mm.get(k) ?? {}), [v.minor]: m.deprecated ? 2 : 1 }); }
    }
    const ko = koByApi.get(name);
    let koStatus = 'none';
    if (ko) {
      (koHashes.get(name) ?? koHashes.set(name, {}).get(name))[v.minor] = d.officialHash;
      if (v.minor === BASE_MINOR) koBaseDoc.set(name, d);
      koStatus = ko.basedOn?.officialHash !== d.officialHash ? 'stale' : ko.provenance?.review === 'reviewed' ? 'reviewed' : 'draft';
    }
    index.push({
      n: name, b: d.basename, l: lib, k: d.kind, s: d.since, d: d.deprecated ? (d.deprecated.since ?? true) : null,
      x: d.extends, t: plainFirstSentence(d.description), ko: koStatus, ...(d.visibility !== 'public' ? { p: 0 } : {}),
      ...(ko ? { kz: ko.overview?.summary ?? null, ku: ko.overview?.whenToUse?.[0]?.text ?? null } : {}),
    });
  }
  for (const [lib, arr] of byLib) writeFileSync(`${vOut}/lib/${enc(lib)}.json.gz`, gzipSync(JSON.stringify(arr), { level: 9 }));
  // 기능 추천용 말뭉치: 공식 클래스(public)의 이름·설명 앞부분·멤버 이름. 한국어/AI 문장은 넣지 않는다.
  const intent = [];
  for (const arr of byLib.values()) for (const d of arr) {
    if (d.visibility !== 'public' || !(d.kind === 'class' || (d.kind === 'namespace' && d.methods.length > 0))) continue;
    const members = [...d.properties, ...d.aggregations, ...d.events, ...d.methods.filter((m) => !m.accessorOf && !m.static)].map((m) => m.name);
    intent.push({ n: d.name, c: d.kind === 'namespace' ? 3 : d.stereotype === 'control' ? 1 : d.stereotype === 'element' ? 2 : 0, ...(d.deprecated ? { dp: d.deprecated.since ?? 1 } : {}), t: plainN(d.description, 420), m: [...new Set(members)].slice(0, 90).join(' ') });
  }
  writeFileSync(`${vOut}/intent.json.gz`, gzipSync(JSON.stringify(intent), { level: 9 }));
  // 멤버 색인(메서드·속성·이벤트·구성 요소·참조 이름 검색 + 기능 추천용). [클래스 번호, 종류, 이름, 플래그, since, 설명|접근자 대상]
  {
    const classes = [], rows = [];
    for (const arr of byLib.values()) for (const d of arr) {
      if (d.visibility !== 'public' || !(d.kind === 'class' || d.kind === 'interface' || d.kind === 'namespace')) continue;
      let ci = -1;
      for (const [pl, kc] of [['properties', 'p'], ['aggregations', 'a'], ['associations', 's'], ['events', 'e'], ['methods', 'm']]) {
        for (const m of d[pl] || []) {
          if (ci < 0) { ci = classes.length; classes.push(d.name); }
          const flags = (m.deprecated ? 1 : 0) | (m.static ? 2 : 0) | (m.accessorOf ? 4 : 0) | (m.experimental ? 8 : 0);
          rows.push([ci, kc, m.name, flags, m.since ?? 0, m.accessorOf ? m.accessorOf.name : plainN(m.description, 140).replace(/^(.{20,140}?[.!?])\s.*$/, '$1')]);
        }
      }
    }
    writeFileSync(`${vOut}/members.json.gz`, gzipSync(JSON.stringify({ c: classes, m: rows }), { level: 9 }));
    var memberCount = rows.length;
  }
  // 문서 가이드 목차: [key, text, children|0]
  let topicCount = 0;
  {
    const tp = join(dir, 'topics.index.json.gz');
    if (existsSync(tp)) {
      const t = JSON.parse(gunzipSync(readFileSync(tp)).toString('utf8'));
      if (Array.isArray(t) && t.every((x) => x && typeof x.key === 'string' && /^[0-9a-f]{32}$/.test(x.key))) {
        const walk = (a) => a.filter((x) => x && typeof x.key === 'string' && /^[0-9a-f]{32}$/.test(x.key)).map((x) => { topicCount++; return [x.key, String(x.text ?? ''), x.links?.length ? walk(x.links) : 0]; });
        writeFileSync(`${vOut}/topics.json.gz`, gzipSync(JSON.stringify(walk(t)), { level: 9 }));
      }
    }
  }
  index.sort((a, b) => a.n.localeCompare(b.n));
  writeFileSync(`${vOut}/index.json.gz`, gzipSync(JSON.stringify(index), { level: 9 }));
  const pubCount = index.filter((i) => i.p !== 0).length;
  const libs = Object.fromEntries([...byLib].map(([l, a]) => [l, { symbols: a.length, apiJsonVersion: manifest.libraries[l]?.apiJsonVersion ?? null }]));
  const meta = {
    minor: v.minor, version: manifest.version, fetchedAt: manifest.fetchedAt, builtAt: new Date().toISOString(),
    docBase, libraries: libs, noApiJson: manifest.noApiJson ?? [],
    counts: { members: memberCount, topics: topicCount, searchable: pubCount, detailedKo: index.filter((i) => i.ko !== 'none' && i.p !== 0).length, reviewedKo: index.filter((i) => i.ko === 'reviewed').length },
    dataKind: 'official',
  };
  writeFileSync(`${vOut}/meta.json`, JSON.stringify(meta));
  console.log(`${v.minor} (${manifest.version}): 라이브러리 ${Object.keys(libs).length}, 심볼 ${symbols.size}, 검색 ${pubCount}  [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
}

// ---------- 한국어 층 검증·출력 ----------
for (const [name, ko] of koByApi) {
  const d = koBaseDoc.get(name);
  if (!d) { if (versions.some((v) => v.minor === BASE_MINOR)) errors.push(`${name}: 기준 버전 ${BASE_MINOR} 자료에 없는 API`); continue; }
  const has = (kind, n) => (d[{ property: 'properties', aggregation: 'aggregations', association: 'associations', event: 'events', method: 'methods' }[kind]] || []).some((m) => m.name === n);
  for (const key of Object.keys(ko.members || {})) {
    const [kind, n] = key.split(':');
    if (!has(kind, n)) errors.push(`${name}: ko.members["${key}"] 는 ${BASE_MINOR} 공식 자료에 없는 항목`);
  }
  for (const r of ko.overview?.related || []) if (!avail.has(r.api)) errors.push(`${name}: ko related ${r.api} 는 지원 범위에 없음`);
  if (!ko.basedOn?.officialHash) errors.push(`${name}: basedOn.officialHash 가 비어 있음 (npm run ko:stamp -- ${name})`);
  for (const ex of ko.examples || []) ex.verification = verification[name]?.[ex.id] ?? { status: 'unverified' };
  writeFileSync(`${OUT}/ko/${enc(name)}.json`, JSON.stringify({ ...ko, baseMinor: BASE_MINOR, hashes: koHashes.get(name) ?? {} }));
}

// ---------- 버전 가용성 (심볼 × 버전: 0 없음 / 1 있음 / 2 deprecated) ----------
const order = allVersions.map((v) => v.minor);
let prevAvail = {};
if (only.length && existsSync(`${OUT}/availability.json`)) prevAvail = JSON.parse(readFileSync(`${OUT}/availability.json`, 'utf8')).symbols;
const symbolsOut = { ...prevAvail };
for (const [name, m] of avail) {
  const chars = (symbolsOut[name] ?? '0'.repeat(order.length)).split('');
  for (const [minor, st] of Object.entries(m)) chars[order.indexOf(minor)] = String(st);
  symbolsOut[name] = chars.join('');
}
writeFileSync(`${OUT}/availability.json`, JSON.stringify({ versions: order, symbols: symbolsOut }));

// ---------- 멤버 가용성: 샤드(8) × 심볼 → 멤버키 → 버전별 문자열 ----------
const SHARDS = 8;
const shardOf = (n) => [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % SHARDS;
mkdirSync(`${OUT}/members`, { recursive: true });
const shardData = Array.from({ length: SHARDS }, (_, i) => (only.length && existsSync(`${OUT}/members/${i}.json.gz`)) ? JSON.parse(gunzipSync(readFileSync(`${OUT}/members/${i}.json.gz`)).toString('utf8')) : {});
for (const [name, mm] of memAvail) {
  const cur = shardData[shardOf(name)][name] ?? {};
  for (const [k, perV] of mm) {
    const chars = (cur[k] ?? '0'.repeat(order.length)).split('');
    for (const [minor, st] of Object.entries(perV)) chars[order.indexOf(minor)] = String(st);
    cur[k] = chars.join('');
  }
  if (only.length) for (const k of Object.keys(cur)) if (!mm.has(k)) { const ch = cur[k].split(''); for (const minor of only) ch[order.indexOf(minor)] = '0'; cur[k] = ch.join(''); }
  shardData[shardOf(name)][name] = cur;
}
shardData.forEach((d, i) => writeFileSync(`${OUT}/members/${i}.json.gz`, gzipSync(JSON.stringify(d))));

// ---------- 기능어 사전 (data/intents.json) ----------
if (existsSync('data/intents.json') && existsSync(`${OUT}/v/${BASE_MINOR}/intent.json.gz`)) {
  const src = JSON.parse(readFileSync('data/intents.json', 'utf8'));
  const corpus = JSON.parse(gunzipSync(readFileSync(`${OUT}/v/${BASE_MINOR}/intent.json.gz`)).toString('utf8'));
  const text = corpus.map((c) => (c.n + ' ' + c.t + ' ' + c.m).toLowerCase()).join('\n');
  for (const e of src.intents) for (const w of e.en) if (!text.includes(w.toLowerCase())) errors.push(`intents: "${e.ko[0]}" 의 영어 용어 "${w}" 가 ${BASE_MINOR} 공식 자료에 한 번도 나오지 않음`);
  writeFileSync(`${OUT}/intents.json`, JSON.stringify(src));
  if (existsSync('data/recommend-eval-result.json')) writeFileSync(`${OUT}/recommend-eval.json`, readFileSync('data/recommend-eval-result.json'));
  if (existsSync('data/recommend-members-eval-result.json')) writeFileSync(`${OUT}/recommend-members-eval.json`, readFileSync('data/recommend-members-eval-result.json'));
}

// ---------- 레시피 (data/recipes.json): 정답 API 가 기준 버전 공식 자료에 실제로 있는지 검증 ----------
if (existsSync('data/recipes.json') && existsSync(`${OUT}/v/${BASE_MINOR}/members.json.gz`)) {
  const src = JSON.parse(readFileSync('data/recipes.json', 'utf8'));
  const idx = JSON.parse(gunzipSync(readFileSync(`${OUT}/v/${BASE_MINOR}/index.json.gz`)).toString('utf8'));
  const mem = JSON.parse(gunzipSync(readFileSync(`${OUT}/v/${BASE_MINOR}/members.json.gz`)).toString('utf8'));
  const classes = new Set(idx.map((e) => e.n));
  const rows = new Set(mem.m.map(([ci, k, n]) => `${mem.c[ci]}#${k}:${n}`));
  const KC = { method: 'm', property: 'p', event: 'e', aggregation: 'a', association: 's' };
  const ids = new Set();
  for (const r of src.recipes) {
    if (ids.has(r.id)) errors.push(`recipes: id 중복 ${r.id}`);
    ids.add(r.id);
    if (!r.ko?.length) errors.push(`recipes: ${r.id} 질문 문구가 없음`);
    if (!r.answers?.length || r.answers.length > 3) errors.push(`recipes: ${r.id} 정답은 1~3개여야 함`);
    for (const a of r.answers || []) {
      const m = /^([A-Za-z0-9_$.]+)(?:#(method|property|event|aggregation|association):([A-Za-z0-9_$]+))?$/.exec(a.ref);
      if (!m) { errors.push(`recipes: ${r.id} 형식이 틀린 정답 ${a.ref}`); continue; }
      if (!classes.has(m[1])) errors.push(`recipes: ${r.id} 의 클래스 ${m[1]} 가 ${BASE_MINOR} 공식 자료에 없음`);
      else if (m[2] && !rows.has(`${m[1]}#${KC[m[2]]}:${m[3]}`)) errors.push(`recipes: ${r.id} 의 ${m[1]} 에 ${m[2]} ${m[3]} 선언이 ${BASE_MINOR} 공식 자료에 없음`);
      if (!a.why) errors.push(`recipes: ${r.id} 이유 문장이 없음`);
    }
  }
  writeFileSync(`${OUT}/recipes.json`, JSON.stringify(src));
  console.log(`레시피 ${src.recipes.length}개 검증`);
  // 소형 분류 모델(브라우저가 gzip 으로 내려받음)과 그 독립 평가 결과(화면에 정확도로 공개)
  if (existsSync('data/recipe-model.json')) writeFileSync(`${OUT}/recipe-model.json.gz`, gzipSync(readFileSync('data/recipe-model.json'), { level: 9 }));
  if (existsSync('data/external/test-result.json')) writeFileSync(`${OUT}/hybrid-eval.json`, readFileSync('data/external/test-result.json'));
}

// ---------- 버전 목록·별칭 ----------
const built = new Set(existsSync(`${OUT}/v`) ? readdirSync(`${OUT}/v`) : []);
writeFileSync(`${OUT}/versions.json`, JSON.stringify({
  discoveredAt: JSON.parse(readFileSync('data/versions.json', 'utf8')).discoveredAt,
  baseMinor: BASE_MINOR,
  versions: allVersions.filter((v) => built.has(v.minor)).map((v) => ({ minor: v.minor, version: v.version, support: v.support, lts: v.lts, eom: v.eom, eocp: v.eocp, sapuiversion: v.sapuiversion, frontendserver: v.frontendserver })),
}));
const aliasSrc = JSON.parse(readFileSync('data/aliases.json', 'utf8'));
for (const a of aliasSrc.aliases) for (const api of a.apis) if (!symbolsOut[api]) errors.push(`aliases: "${a.term}" → ${api} 는 어느 버전에도 없음`);
writeFileSync(`${OUT}/aliases.json`, JSON.stringify(aliasSrc));

if (errors.length) { console.error('데이터 검증 실패:\n - ' + errors.join('\n - ')); process.exit(1); }
console.log(`OK: 버전 ${versions.length}개 처리, 고유 심볼 ${avail.size}개, 한국어 ${koByApi.size}개 API (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
