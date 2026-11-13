// URL 해시 상태(순수 함수). 해시는 사용자가 직접 고칠 수 있는 입력이므로, 모든 값을 알려진 형식으로만 받아들인다.
// 예: #?v=1.154&m=name&q=setText&api=sap.m.Button&mem=method:setText&tab=musage

export const MODES = ['name', 'feature', 'browse', 'guide', 'abap'] as const;
export type Mode = (typeof MODES)[number];
export const KIND_FILTERS = ['all', 'c', 'm', 'p', 'e', 'a'] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

// 상위 구분(화면 맨 위 탭): UI5 안에서만 버전과 찾는 방법 4가지를 고르고, ABAP 은 문법 사전 하나다.
// 주소에 새 변수를 만들지 않고 모드(m)에서 계산하므로, 예전 주소(#?m=abap&ab=select 등)가 그대로 열린다.
export const PRODUCTS = ['ui5', 'abap'] as const;
export type Product = (typeof PRODUCTS)[number];
export const UI5_MODES = ['name', 'feature', 'browse', 'guide'] as const;
export type Ui5Mode = (typeof UI5_MODES)[number];
export const productOf = (m: Mode): Product => (m === 'abap' ? 'abap' : 'ui5');

/** 상위 탭을 눌렀을 때 열 모드. ABAP 은 'abap', UI5 는 직전에 쓰던 UI5 모드(없거나 UI5 모드가 아니면 이름 검색). */
export function modeForProduct(p: Product, lastUi5: string | null | undefined): Mode {
  if (p === 'abap') return 'abap';
  return (UI5_MODES as readonly string[]).includes(lastUi5 ?? '') ? (lastUi5 as Ui5Mode) : 'name';
}

export const ABAP_ZONES = ['', 'tcode'] as const;
export type AbapZone = (typeof ABAP_ZONES)[number];

export interface Route {
  v: string; q: string; api: string | null; tab: string; inh: boolean; mq: string;
  /** 찾는 방법: name 이름·메서드 / feature 기능 추천 / browse API 탐색 / guide 문서 가이드 / abap ABAP 기본 문법 */
  m: Mode;
  /** 이름 검색 결과의 종류 필터 */
  kf: KindFilter;
  /** API 탐색에서 펼친 라이브러리 */
  lib: string;
  /** 멤버 상세 페이지: "종류:이름" (예: method:setText). 비어 있으면 클래스 페이지 */
  mem: string;
  /** 문서 가이드에서 연 항목(32자리 키) */
  tp: string;
  /** ABAP 기본 문법에서 연 항목 id */
  ab: string;
  /** ABAP 기본 문법에서 고른 그룹 이름(예: 데이터베이스). 비어 있으면 전체 */
  ag: string;
  /** ABAP 안의 구역: '' 문법 사전 / 'tcode' tcode 사전. 항목(ab)·그룹(ag)은 두 구역이 같은 변수를 쓴다 */
  az: AbapZone;
}
export const DEFAULT_ROUTE: Route = { v: '', q: '', api: null, tab: 'overview', inh: false, mq: '', m: 'name', kf: 'all', lib: '', mem: '', tp: '', ab: '', ag: '', az: '' };

/**
 * 상위 탭(UI5/ABAP)을 바꿀 때 주소에 적용할 변경. 열려 있던 항목은 닫고 목록으로 돌아간다.
 * 검색어는 제품마다 뜻이 달라(UI5 클래스 이름 ↔ ABAP 문법 낱말) 기본은 비운다. 이름 검색의 "ABAP 에도 있어요" 안내처럼
 * 일부러 넘길 때만 keepQuery 로 유지한다.
 */
export function switchProduct(p: Product, lastUi5: string | null | undefined, opts: { keepQuery?: boolean } = {}): Partial<Route> {
  const patch: Partial<Route> = { m: modeForProduct(p, lastUi5), api: null, mem: '', mq: '', tab: 'overview', ab: '', az: '' };
  if (!opts.keepQuery) patch.q = '';
  else patch.ag = ''; // 검색어를 넘길 때는 그룹 필터 때문에 결과가 가려지지 않게 전체 그룹에서 찾는다
  return patch;
}

/** ABAP 안에서 문법 사전 ↔ tcode 사전을 바꿀 때. 열린 항목과 그룹은 두 구역의 뜻이 달라 비운다. */
export const switchAbapZone = (az: AbapZone): Partial<Route> => ({ az, ab: '', ag: '' });

// API 이름: 점으로 이어진 이름(sap.m.Button), module:경로(module:sap/base/i18n/ResourceBundle, module:/sap/...),
// 가끔 있는 #(모듈 내부 이름)과 끝의 제네릭 표기(<T, K>)만 허용한다. 경로 이탈(..)·이중 슬래시·역슬래시·태그는 거부한다.
const API_RE = /^(?:module:\/?)?[A-Za-z0-9_$][A-Za-z0-9_$.\/#-]*(?:<[A-Za-z0-9_, ]+>)?$/;
export function isSafeApiName(s: string): boolean {
  return s.length >= 1 && s.length <= 200 && API_RE.test(s) && !s.includes('..') && !s.includes('//');
}
const MEM_RE = /^(method|property|event|aggregation|association):[A-Za-z0-9_$.]{1,120}$/;
const LIB_RE = /^[A-Za-z0-9_.]{1,80}$/;
const ABAP_RE = /^[a-z0-9-]{1,40}$/;
// 그룹 이름은 한글·영문·숫자·가운뎃점·공백·하이픈만 받는다(태그·경로 문자는 거부). 실제 그룹과 맞는지는 화면에서 다시 확인한다.
const AG_RE = /^[가-힣A-Za-z0-9·\s-]{1,30}$/;
const TOPIC_RE = /^[0-9a-f]{32}$/;
const oneOf = <T extends string>(list: readonly T[], v: string | null, d: T): T => (list.includes(v as T) ? (v as T) : d);

export function parse(hash: string): Route {
  const p = new URLSearchParams(hash.replace(/^#\??/, ''));
  const api = p.get('api');
  const mem = p.get('mem') ?? '';
  const lib = p.get('lib') ?? '';
  const tp = p.get('tp') ?? '';
  const ab = p.get('ab') ?? '';
  const ag = p.get('ag') ?? '';
  return {
    v: p.get('v') ?? '', q: p.get('q') ?? '', api: api && isSafeApiName(api) ? api : null, tab: p.get('tab') ?? 'overview',
    inh: p.get('inh') === '1', mq: p.get('mq') ?? '',
    m: oneOf(MODES, p.get('m'), 'name'), kf: oneOf(KIND_FILTERS, p.get('kf'), 'all'),
    lib: LIB_RE.test(lib) ? lib : '', mem: MEM_RE.test(mem) ? mem : '', tp: TOPIC_RE.test(tp) ? tp : '', ab: ABAP_RE.test(ab) ? ab : '', ag: AG_RE.test(ag) ? ag : '', az: p.get('az') === 'tcode' ? 'tcode' : '',
  };
}

export function serialize(r: Route): string {
  const p = new URLSearchParams();
  if (r.v) p.set('v', r.v);
  if (r.m !== 'name') p.set('m', r.m);
  if (r.q) p.set('q', r.q);
  if (r.m === 'name' && r.kf !== 'all') p.set('kf', r.kf);
  if (r.m === 'browse' && r.lib) p.set('lib', r.lib);
  if (r.m === 'guide' && r.tp) p.set('tp', r.tp);
  if (r.m === 'abap' && r.az) p.set('az', r.az);
  if (r.m === 'abap' && r.ab) p.set('ab', r.ab);
  if (r.m === 'abap' && r.ag) p.set('ag', r.ag);
  if (r.api) p.set('api', r.api);
  if (r.api && r.mem) p.set('mem', r.mem);
  if (r.api && r.tab !== 'overview') p.set('tab', r.tab);
  if (r.api && r.inh) p.set('inh', '1');
  if (r.api && r.mq && !r.mem) p.set('mq', r.mq);
  const s = p.toString();
  return s ? `#?${s}` : '#';
}
