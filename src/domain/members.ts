// 클래스의 속성·메서드·이벤트·구성 요소·참조 관계를 다루는 순수 로직(화면 비의존).
import type { ApiDoc, Aggr, Assoc, Evt, MemberKind, Meth, Prop } from '../types.ts';

export type AnyMember = Prop | Meth | Evt | Aggr | Assoc;
export type Plural = 'properties' | 'methods' | 'events' | 'aggregations' | 'associations';
export interface MemberSpec { id: MemberKind; label: string; en: string; plural: Plural }
export interface Item<T = AnyMember> { m: T; definedIn: string; inherited: boolean }

// ui5.sap.com API Reference 의 탭 순서(Properties → Aggregations → Associations → Events → Methods)
export const MEMBER_SPECS: MemberSpec[] = [
  { id: 'property', label: '속성', en: 'Properties', plural: 'properties' },
  { id: 'aggregation', label: '구성 요소', en: 'Aggregations', plural: 'aggregations' },
  { id: 'association', label: '참조 관계', en: 'Associations', plural: 'associations' },
  { id: 'event', label: '이벤트', en: 'Events', plural: 'events' },
  { id: 'method', label: '메서드', en: 'Methods', plural: 'methods' },
];

/** 버전별 가용성 자료(member shard)의 키 접두: p 속성 / a 구성 요소 / s 참조 / e 이벤트 / m 메서드 */
export const KEY_CHAR: Record<MemberKind, string> = { property: 'p', aggregation: 'a', association: 's', event: 'e', method: 'm' };
export const memberKey = (kind: MemberKind, name: string): string => `${KEY_CHAR[kind]}:${name}`;
export const KEY_LABEL: Record<string, string> = { p: '속성', a: '구성 요소', s: '참조', e: '이벤트', m: '메서드' };

/** 상속 체인(자기 자신 → 부모 → …)을 합친다. 하위 클래스가 같은 이름을 다시 정의하면 하위 쪽이 우선한다. */
export function mergeMembers(chain: ApiDoc[], plural: Plural): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  chain.forEach((d, i) => {
    for (const m of d[plural] as AnyMember[]) {
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      out.push({ m, definedIn: d.name, inherited: i > 0 });
    }
  });
  return out;
}

/** 목록 한 줄에 보이는 시그니처 */
export function signature(kind: MemberKind, m: AnyMember): string {
  if (kind === 'property') { const p = m as Prop; return `: ${p.type}${p.defaultValue != null ? ` = ${JSON.stringify(p.defaultValue)}` : ''}`; }
  if (kind === 'aggregation' || kind === 'association') { const a = m as Aggr; return `: ${a.type} [${a.cardinality}]`; }
  if (kind === 'event') return `(${(m as Evt).parameters.map((p) => p.name).join(', ')})`;
  const me = m as Meth;
  return `(${me.parameters.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})${me.returnValue ? ` → ${me.returnValue.type}` : ''}`;
}

export interface MemberFilter {
  kind: MemberKind;
  /** 검색어(소문자·trim 된 값). 비어 있으면 검색 안 함 */
  mq: string;
  hideAccessors: boolean;
  hideDeprecated: boolean;
  /** 항목의 한국어 설명(없으면 undefined). 검색 대상에 포함 */
  koText: (it: Item) => string | undefined;
  /** HTML → 평문 */
  plain: (html: string) => string;
}

/** 목록 필터: 접근자 숨김(검색 중에는 접근자도 찾을 수 있게 해제) · deprecated 숨김 · 이름/한국어/영문 설명 검색 */
export function filterMembers(rows: Item[], f: MemberFilter): Item[] {
  return rows.filter((it) => {
    if (f.kind === 'method' && f.hideAccessors && !f.mq && (it.m as Meth).accessorOf) return false;
    if (f.hideDeprecated && it.m.deprecated) return false;
    if (!f.mq) return true;
    return (it.m.name + ' ' + (f.koText(it) ?? '') + ' ' + f.plain(it.m.description)).toLowerCase().includes(f.mq);
  });
}
