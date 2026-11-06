// 멤버 색인: 메서드·속성·이벤트·구성 요소·참조 관계를 이름으로 찾는 순수 로직(화면·네트워크 비의존).
import { isCore } from './recommend.ts';

export type KindChar = 'p' | 'a' | 's' | 'e' | 'm';
export const KIND_LABEL: Record<KindChar, string> = { m: '메서드', p: '속성', e: '이벤트', a: '구성 요소', s: '참조 관계' };
export const KIND_NAME: Record<KindChar, 'method' | 'property' | 'event' | 'aggregation' | 'association'> = { m: 'method', p: 'property', e: 'event', a: 'aggregation', s: 'association' };
export const KIND_CHAR_OF: Record<string, KindChar> = { method: 'm', property: 'p', event: 'e', aggregation: 'a', association: 's' };
const KIND_ORDER: Record<KindChar, number> = { m: 0, p: 1, e: 2, a: 3, s: 4 };

export const FLAG = { deprecated: 1, static: 2, accessor: 4, experimental: 8 } as const;

/** 빌드가 만든 압축 형식: c 클래스 이름표, m [클래스 번호, 종류, 이름, 플래그, since|0, 설명(접근자는 대상 속성 이름)] */
export interface RawMembers { c: string[]; m: [number, string, string, number, string | number, string][] }
/** t: 설명 첫 문장(접근자는 비어 있고 a 에 대상 속성 이름) */
export interface MemberRow { c: string; k: KindChar; n: string; f: number; s: string | null; t: string; a: string | null }

export function expandMembers(raw: RawMembers): MemberRow[] {
  return raw.m.map(([ci, k, n, f, s, t]) => ({
    c: raw.c[ci], k: k as KindChar, n, f, s: s ? String(s) : null,
    t: f & FLAG.accessor ? '' : t, a: f & FLAG.accessor ? t : null,
  }));
}

export interface MemberGroup {
  key: string; k: KindChar; n: string; tier: 1 | 2 | 3;
  /** 이 이름을 선언한 클래스들(기본 라이브러리 먼저, deprecated 는 뒤) */
  rows: MemberRow[]; allDeprecated: boolean; accessor: boolean; sample: string;
}

/**
 * 검색어 해석. "Button#setText", "Button.setText", "sap.m.Button.setText" 는 클래스 + 멤버로 본다.
 * 그 밖에는 멤버 이름만 본다(클래스 필터 없음).
 */
export function parseMemberQuery(q: string, classNames: Iterable<string> = []): { cls: string | null; mem: string } {
  const t = q.trim();
  const hash = t.lastIndexOf('#');
  if (hash > 0) return { cls: t.slice(0, hash).trim().toLowerCase(), mem: t.slice(hash + 1).trim() };
  const dot = t.lastIndexOf('.');
  if (dot > 0 && dot < t.length - 1) {
    const pre = t.slice(0, dot).toLowerCase(), post = t.slice(dot + 1);
    if (/^[a-z_$]/.test(post)) {
      for (const c of classNames) { const lc = c.toLowerCase(); if (lc === pre || lc.endsWith('.' + pre)) return { cls: pre, mem: post }; }
    }
  }
  return { cls: null, mem: t };
}

const camelTokens = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** 이름 일치 단계: 1 정확히 / 2 접두 / 3 포함 또는 낱말(camelCase) 모두 포함 / 0 아님 */
export function nameTier(name: string, query: string): 0 | 1 | 2 | 3 {
  const n = name.toLowerCase(), q = query.toLowerCase();
  if (!q) return 0;
  if (n === q) return 1;
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 3;
  const qt = camelTokens(query);
  if (qt.length > 1) { const nt = camelTokens(name); if (qt.every((t) => nt.some((x) => x.startsWith(t)))) return 3; }
  return 0;
}

export interface MemberSearchOptions { kinds?: ReadonlySet<KindChar>; includeAccessors?: boolean; limit?: number }

/** 같은 (종류, 이름) 은 한 묶음으로 묶어 돌려준다. 접근자(getX/setX 등 자동 생성)는 이름이 거의 일치할 때만 기본 포함한다. */
export function searchMembers(rows: MemberRow[], query: string, opts: MemberSearchOptions = {}): MemberGroup[] {
  const { cls, mem } = parseMemberQuery(query, new Set(rows.map((r) => r.c)));
  if (!mem) return [];
  const groups = new Map<string, MemberGroup>();
  for (const r of rows) {
    if (opts.kinds && !opts.kinds.has(r.k)) continue;
    if (cls) { const lc = r.c.toLowerCase(); if (!(lc === cls || lc.endsWith('.' + cls))) continue; }
    const tier = nameTier(r.n, mem);
    if (!tier) continue;
    const isAcc = !!(r.f & FLAG.accessor);
    if (isAcc && !opts.includeAccessors && tier > 2) continue;
    const key = `${r.k}:${r.n}`;
    let g = groups.get(key);
    if (!g) { g = { key, k: r.k, n: r.n, tier, rows: [], allDeprecated: true, accessor: isAcc, sample: '' }; groups.set(key, g); }
    g.rows.push(r);
    if (!(r.f & FLAG.deprecated)) g.allDeprecated = false;
    if (!g.sample && r.t) g.sample = r.t;
  }
  const out = [...groups.values()];
  for (const g of out) g.rows.sort((a, b) => Number(!isCore(a.c)) - Number(!isCore(b.c)) || (a.f & 1) - (b.f & 1) || a.c.length - b.c.length || a.c.localeCompare(b.c));
  out.sort((a, b) =>
    a.tier - b.tier || Number(a.allDeprecated) - Number(b.allDeprecated) || Number(a.accessor) - Number(b.accessor) ||
    KIND_ORDER[a.k] - KIND_ORDER[b.k] || b.rows.length - a.rows.length || a.n.length - b.n.length || a.n.localeCompare(b.n));
  return out.slice(0, opts.limit ?? 400);
}

/** 종류별 묶음 수(필터 알약 옆 숫자용) */
export function countByKind(groups: MemberGroup[]): Record<KindChar, number> {
  const c: Record<KindChar, number> = { m: 0, p: 0, e: 0, a: 0, s: 0 };
  for (const g of groups) c[g.k]++;
  return c;
}
