// ui5.sap.com API Reference 의 왼쪽 트리처럼 라이브러리 → 클래스 순으로 훑어보는 순수 로직.
import type { IndexEntry } from '../types.ts';
import { isCore } from './recommend.ts';

export interface LibGroup { lib: string; count: number; deprecated: number; core: boolean }
export const KIND_KO: Record<string, string> = { class: '클래스', interface: '인터페이스', namespace: '네임스페이스', enum: '열거형', typedef: '타입 정의', function: '함수' };
const KIND_ORDER: Record<string, number> = { class: 0, interface: 1, namespace: 2, enum: 3, typedef: 4, function: 5 };

/** 라이브러리 목록. 입문자가 먼저 보는 기본 라이브러리를 앞에, 나머지는 이름순. */
export function libraries(index: IndexEntry[]): LibGroup[] {
  const m = new Map<string, LibGroup>();
  for (const e of index) {
    if (e.p === 0) continue;
    let g = m.get(e.l);
    if (!g) { g = { lib: e.l, count: 0, deprecated: 0, core: isCore(e.l + '.') }; m.set(e.l, g); }
    g.count++;
    if (e.d) g.deprecated++;
  }
  return [...m.values()].sort((a, b) => Number(b.core) - Number(a.core) || a.lib.localeCompare(b.lib));
}

/** 한 라이브러리의 항목. 종류 → 이름순, 검색어가 있으면 이름 일부로 거른다. */
export function entriesOf(index: IndexEntry[], lib: string, filter = '', kinds: ReadonlySet<string> | null = null): IndexEntry[] {
  const f = filter.trim().toLowerCase();
  return index
    .filter((e) => e.p !== 0 && e.l === lib && (!kinds || kinds.has(e.k)) && (!f || e.n.toLowerCase().includes(f)))
    .sort((a, b) => (KIND_ORDER[a.k] ?? 9) - (KIND_ORDER[b.k] ?? 9) || a.n.localeCompare(b.n));
}
