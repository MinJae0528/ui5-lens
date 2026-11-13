import { buildIndex, type CorpusEntry, type IntentEntry, type RecIndex } from './domain/recommend';
import { buildAnchorIndex } from './domain/nameAnchor';
import { prepareModel, type RecipeModel } from './domain/recipeModel';
import type { HybridCtx } from './domain/hybrid';
import type { Recipe } from './domain/recipes';
import type { LifeContext } from './domain/life';
import { expandMembers, KIND_NAME, type MemberRow, type RawMembers } from './domain/memberIndex';
import type { AbapDoc, Alias, ApiDoc, Availability, IndexEntry, KoDoc, Meta, TcodeDoc, TopicNode, VersionList } from './types';

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
/** koError: 한국어 자료를 불러오다 실패한 이유(없으면 null). ko 가 null 이고 koError 도 null 이면 “아직 준비되지 않음”이다. */
export interface Detail { chain: ApiDoc[]; ko: KoDoc | null; koError: string | null; chainErrors: string[] }
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
  // 한국어 파일이 있는지는 색인(ko 상태)이 알려 준다. 파일이 없는 API 는 요청하지 않으므로, 개발 서버처럼 없는 파일에 HTML 을 돌려주는
  // 호스트에서도 “준비 안 됨”을 “조회 실패”로 오해하지 않는다. 파일이 있어야 하는데 못 읽으면 그때만 실패로 알린다.
  let ko: KoDoc | null = null, koError: string | null = null;
  const hasKo = (v.index.find((e) => e.n === name)?.ko ?? 'none') !== 'none';
  if (hasKo) { try { ko = await loadKo(name); if (!ko) koError = '한국어 파일이 색인에는 있지만 서버에 없습니다'; } catch (e) { koError = String((e as Error).message ?? e); } }
  return { chain, ko, koError, chainErrors };
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

/** 추천 메서드·이벤트(멤버) 자체 평가 결과. 없으면 null. */
/** fresh2: 마지막 개선 뒤 한 번만 잰 질문 세트(공개 수치). dev·fresh 는 개선에 참고한 세트라 공개하지 않는다. */
export interface MemberRecEval { minor: string; at: string; fresh2: { n: number; top3: number; top8: number } }
let memberEvalP: Promise<MemberRecEval | null> | null = null;
export function loadMemberRecEval(): Promise<MemberRecEval | null> {
  if (!memberEvalP) memberEvalP = getJson<MemberRecEval>(`${BASE}/recommend-members-eval.json`, true).catch(() => null);
  return memberEvalP;
}

/** 버전별 존재 여부 해석(domain/life)에 필요한 정보만 뽑아 넘긴다. */
export const lifeCtx = (g: Global): LifeContext => ({ order: g.availability.versions, versions: g.versions.versions });

async function getGzOptional<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  return JSON.parse(new TextDecoder().decode(buf));
}

/** 선택한 버전의 멤버 색인(메서드·속성·이벤트 이름 검색, 기능 추천 멤버용). 처음 필요할 때 한 번만 불러온다. */
const memberCache = new Map<string, Promise<MemberRow[]>>();
export function loadMemberRows(minor: string): Promise<MemberRow[]> {
  let p = memberCache.get(minor);
  if (!p) {
    p = Promise.all([getGz<RawMembers>(`${BASE}/v/${minor}/members.json.gz`), getGz<string[]>(`${BASE}/v/${minor}/members-ko.json.gz`).catch(() => null)]).then(([raw, ko]) => expandMembers(raw, ko));
    p.catch(() => memberCache.delete(minor));
    memberCache.set(minor, p);
  }
  return p;
}

/** 문서 가이드 목차. 버전에 목차가 없으면 null(1.38 등). */
let abapP: Promise<AbapDoc> | null = null;
/** ABAP 기본 문법 사전(버전과 무관) */
export function loadAbap(): Promise<AbapDoc> {
  if (!abapP) { const p = getJson<AbapDoc>(`${BASE}/abap/basics.json`).then((d) => d as AbapDoc); p.catch(() => { abapP = null; }); abapP = p; }
  return abapP;
}

let tcodeP: Promise<TcodeDoc> | null = null;
/** ABAP tcode 사전(버전과 무관) */
export function loadTcodes(): Promise<TcodeDoc> {
  if (!tcodeP) { const p = getJson<TcodeDoc>(`${BASE}/abap/tcodes.json`).then((d) => d as TcodeDoc); p.catch(() => { tcodeP = null; }); tcodeP = p; }
  return tcodeP;
}

const topicCache = new Map<string, Promise<TopicNode[] | null>>();
export function loadTopics(minor: string): Promise<TopicNode[] | null> {
  let p = topicCache.get(minor);
  if (!p) { p = getGzOptional<TopicNode[]>(`${BASE}/v/${minor}/topics.json.gz`); p.catch(() => topicCache.delete(minor)); topicCache.set(minor, p); }
  return p;
}

/** 하이브리드 추천 자료: 소형 분류 모델 + 레시피 + 이름 앵커 색인. 처음 필요할 때 한 번만 불러온다. */
const hybridCache = new Map<string, Promise<HybridCtx>>();
export function loadHybrid(minor: string): Promise<HybridCtx> {
  let p = hybridCache.get(minor);
  if (!p) {
    p = Promise.all([
      getGz<RecipeModel>(`${BASE}/recipe-model.json.gz`),
      getJson<{ recipes: Recipe[] }>(`${BASE}/recipes.json`),
      getGz<{ n: string; b: string; x: string | null; k: string }[]>(`${BASE}/v/${minor}/index.json.gz`),
      loadMemberRows(minor), loadIntents(),
    ]).then(([model, rj, idx, rows, intents]) => {
      const classes = new Set(idx.map((e) => e.n));
      const members = new Set(rows.map((r) => `${r.c}#${KIND_NAME[r.k]}:${r.n}`));
      return {
        pm: prepareModel(model), recipes: rj!.recipes, anchors: buildAnchorIndex(idx, rows), intents,
        hasClass: (c: string) => classes.has(c), hasMember: (c: string, k: string, n: string) => members.has(`${c}#${k}:${n}`),
      };
    });
    p.catch(() => hybridCache.delete(minor));
    hybridCache.set(minor, p);
  }
  return p;
}

export interface HybridEval { minor: string; covered: { n: number; hit: number; accepted: number; acceptedHit: number }; uncovered: { n: number; hit: number } }
export function loadHybridEval(): Promise<HybridEval | null> { return getJson<HybridEval>(`${BASE}/hybrid-eval.json`, true); }
