// URL 해시 상태(순수 함수). 해시는 사용자가 직접 고칠 수 있는 입력이므로, 모든 값을 알려진 형식으로만 받아들인다.
// 예: #?v=1.154&m=name&q=setText&api=sap.m.Button&mem=method:setText&tab=musage

export const MODES = ['name', 'feature', 'browse', 'guide', 'abap'] as const;
export type Mode = (typeof MODES)[number];
export const KIND_FILTERS = ['all', 'c', 'm', 'p', 'e', 'a'] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

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
}
export const DEFAULT_ROUTE: Route = { v: '', q: '', api: null, tab: 'overview', inh: false, mq: '', m: 'name', kf: 'all', lib: '', mem: '', tp: '', ab: '' };

// API 이름: 점으로 이어진 이름(sap.m.Button), module:경로(module:sap/base/i18n/ResourceBundle, module:/sap/...),
// 가끔 있는 #(모듈 내부 이름)과 끝의 제네릭 표기(<T, K>)만 허용한다. 경로 이탈(..)·이중 슬래시·역슬래시·태그는 거부한다.
const API_RE = /^(?:module:\/?)?[A-Za-z0-9_$][A-Za-z0-9_$.\/#-]*(?:<[A-Za-z0-9_, ]+>)?$/;
export function isSafeApiName(s: string): boolean {
  return s.length >= 1 && s.length <= 200 && API_RE.test(s) && !s.includes('..') && !s.includes('//');
}
const MEM_RE = /^(method|property|event|aggregation|association):[A-Za-z0-9_$.]{1,120}$/;
const LIB_RE = /^[A-Za-z0-9_.]{1,80}$/;
const ABAP_RE = /^[a-z0-9-]{1,40}$/;
const TOPIC_RE = /^[0-9a-f]{32}$/;
const oneOf = <T extends string>(list: readonly T[], v: string | null, d: T): T => (list.includes(v as T) ? (v as T) : d);

export function parse(hash: string): Route {
  const p = new URLSearchParams(hash.replace(/^#\??/, ''));
  const api = p.get('api');
  const mem = p.get('mem') ?? '';
  const lib = p.get('lib') ?? '';
  const tp = p.get('tp') ?? '';
  const ab = p.get('ab') ?? '';
  return {
    v: p.get('v') ?? '', q: p.get('q') ?? '', api: api && isSafeApiName(api) ? api : null, tab: p.get('tab') ?? 'overview',
    inh: p.get('inh') === '1', mq: p.get('mq') ?? '',
    m: oneOf(MODES, p.get('m'), 'name'), kf: oneOf(KIND_FILTERS, p.get('kf'), 'all'),
    lib: LIB_RE.test(lib) ? lib : '', mem: MEM_RE.test(mem) ? mem : '', tp: TOPIC_RE.test(tp) ? tp : '', ab: ABAP_RE.test(ab) ? ab : '',
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
  if (r.m === 'abap' && r.ab) p.set('ab', r.ab);
  if (r.api) p.set('api', r.api);
  if (r.api && r.mem) p.set('mem', r.mem);
  if (r.api && r.tab !== 'overview') p.set('tab', r.tab);
  if (r.api && r.inh) p.set('inh', '1');
  if (r.api && r.mq && !r.mem) p.set('mq', r.mq);
  const s = p.toString();
  return s ? `#?${s}` : '#';
}
