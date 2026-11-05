import { buildIndex, type CorpusEntry, type IntentEntry, type RecIndex } from './domain/recommend';
import type { LifeContext } from './domain/life';
import type { Alias, ApiDoc, Availability, IndexEntry, KoDoc, Meta, VersionList } from './types';

const BASE = `${import.meta.env.BASE_URL}data`;
async function getJson<T>(url: string, allow404 = false): Promise<T | null> {
  const res = await fetch(url);
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`);
  return res.json();
}
/** .json.gz 를 브라우저에서 직접 푼다 (서버가 Content-Encoding 을 붙여 이미 풀린 경우도 처리). */
async function getGz<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

export interface Global { versions: VersionList; availability: Availability; aliases: Alias[] }
let globalP: Promise<Global> | null = null;
export function loadGlobal(force = false): Promise<Global> {
  if (!globalP || force) {
    globalP = Promise.all([getJson<VersionList>(`${BASE}/versions.json`), getGz<Availability>(`${BASE}/availability.json`).catch(() => getJson<Availability>(`${BASE}/availability.json`)), getJson<{ aliases: Alias[] }>(`${BASE}/aliases.json`)])
      .then(([versions, availability, al]) => ({ versions: versions!, availability: availability!, aliases: al!.aliases }))
      .catch((e) => { globalP = null; throw e; });
  }
  return globalP;
}

export interface VersionData { meta: Meta; index: IndexEntry[]; libOf: Map<string, string> }
const verCache = new Map<string, Promise<VersionData>>();
export function loadVersion(minor: string, force = false): Promise<VersionData> {
  let p = verCache.get(minor);
  if (!p || force) {
    p = Promise.all([getJson<Meta>(`${BASE}/v/${minor}/meta.json`), getGz<IndexEntry[]>(`${BASE}/v/${minor}/index.json.gz`)])
      .then(([meta, index]) => ({ meta: meta!, index, libOf: new Map(index.map((i) => [i.n, i.l])) }));
    p.catch(() => verCache.delete(minor));
    verCache.set(minor, p);
  }
  return p;
}

const libCache = new Map<string, Promise<Map<string, ApiDoc>>>();
function loadLib(minor: string, lib: string): Promise<Map<string, ApiDoc>> {
  const key = `${minor}/${lib}`;
  let p = libCache.get(key);
  if (!p) {
    p = getGz<ApiDoc[]>(`${BASE}/v/${minor}/lib/${encodeURIComponent(lib)}.json.gz`).then((arr) => new Map(arr.map((d) => [d.name, d])));
    p.catch(() => libCache.delete(key));
    libCache.set(key, p);
  }
  return p;
}
export class NotInVersion extends Error {}
export async function loadApi(v: VersionData, name: string): Promise<ApiDoc> {
  const lib = v.libOf.get(name);
  if (!lib) throw new NotInVersion(`${name} 은(는) UI5 ${v.meta.version} 의 공식 자료에 없습니다.`);
  const doc = (await loadLib(v.meta.minor, lib)).get(name);
  if (!doc) throw new Error(`${name}: ${lib} 번들에 없음`);
  return doc;
}
export async function loadKo(name: string): Promise<KoDoc | null> {
  return getJson<KoDoc>(`${BASE}/ko/${encodeURIComponent(name)}.json`, true);
}
export interface Detail { chain: ApiDoc[]; ko: KoDoc | null; chainErrors: string[] }
/** 선택한 API + 부모 체인 + 한국어 층. 자기 자신의 조회가 실패하면 throw (가짜 데이터로 대체하지 않음). */
export async function loadDetail(v: VersionData, name: string): Promise<Detail> {
  const self = await loadApi(v, name);
  const chain = [self];
  const chainErrors: string[] = [];
  let cur = self.extends;
  while (cur) {
    try { const p = await loadApi(v, cur); chain.push(p); cur = p.extends; }
    catch (e) { chainErrors.push(`${cur}: ${(e as Error).message}`); break; }
  }
  const ko = await loadKo(name).catch(() => null);
  return { chain, ko, chainErrors };
}

/** 멤버별 버전 가용성: "p:속성명" 등 -> 버전 순서(availability.versions)대로 0/1/2 문자열. 해시 샤드 8개. */
export type MemberLife = Record<string, string>;
const SHARDS = 8;
const shardCache = new Map<number, Promise<Record<string, MemberLife>>>();
export async function loadMemberLife(symbol: string): Promise<MemberLife | null> {
  const i = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) % SHARDS;
  let p = shardCache.get(i);
  if (!p) { p = getGz<Record<string, MemberLife>>(`${BASE}/members/${i}.json.gz`); p.catch(() => shardCache.delete(i)); shardCache.set(i, p); }
  return (await p)[symbol] ?? null;
}

/** 기능 추천용: 선택한 버전의 공식 클래스 말뭉치(이름·설명 앞부분·멤버 이름)와 한국어→영어 용어 사전. */
const intentCache = new Map<string, Promise<RecIndex>>();
export function loadRecIndex(minor: string): Promise<RecIndex> {
  let p = intentCache.get(minor);
  if (!p) { p = getGz<CorpusEntry[]>(`${BASE}/v/${minor}/intent.json.gz`).then(buildIndex); p.catch(() => intentCache.delete(minor)); intentCache.set(minor, p); }
  return p;
}
let intentsP: Promise<IntentEntry[]> | null = null;
export function loadIntents(): Promise<IntentEntry[]> {
  if (!intentsP) { intentsP = getJson<{ intents: IntentEntry[] }>(`${BASE}/intents.json`).then((j) => j!.intents); intentsP.catch(() => { intentsP = null; }); }
  return intentsP;
}

export interface RecEval { minor: string; at: string; fresh: { n: number; top1: number; top3: number; top8: number } }
let evalP: Promise<RecEval | null> | null = null;
export function loadRecEval(): Promise<RecEval | null> {
  if (!evalP) evalP = getJson<RecEval>(`${BASE}/recommend-eval.json`, true).catch(() => null);
  return evalP;
}

/** 버전별 존재 여부 해석(domain/life)에 필요한 정보만 뽑아 넘긴다. */
export const lifeCtx = (g: Global): LifeContext => ({ order: g.availability.versions, versions: g.versions.versions });
