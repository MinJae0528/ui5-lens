import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Global, VersionData } from '../data';
import { search, type Candidate } from '../domain/search';
import type { Route } from './route';
import { useRec } from './useRec';

export const MAX_RENDER = 200;
type SetRoute = (patch: Partial<Route>, push?: boolean) => void;

/**
 * 검색 화면의 컨트롤러: 입력 디바운스, 이름 검색, (이름이 없을 때) 기능 추천, 키보드 이동, 선택, 스크롤 복원.
 * 화면(App/Shell)은 이 훅이 돌려주는 값을 그리기만 한다.
 */
export function useSearchController({ g, vd, route, setRoute }: { g: Global; vd: VersionData; route: Route; setRoute: SetRoute }) {
  const { meta } = vd;
  const searchable = useMemo(() => vd.index.filter((i) => i.p !== 0), [vd]);
  const known = useMemo(() => new Set(vd.index.map((i) => i.n)), [vd]);
  const [draft, setDraft] = useState(route.q);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const q = route.q;

  // 입력 디바운스: 입력이 멈춘 뒤 URL(q)에 반영
  const pending = draft !== q;
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => { setRoute({ q: draft }); setActive(0); if (listRef.current) { listRef.current.scrollTop = 0; scrollTop.current = 0; } }, 120);
    return () => clearTimeout(t);
  }, [draft, q, setRoute]);
  useEffect(() => setDraft(q), [q]);

  const results: Candidate[] = useMemo(() => search(searchable, g.aliases, q), [searchable, g.aliases, q]);
  const shown = results.slice(0, MAX_RENDER);
  const exact = results.filter((c) => c.tier <= 2);
  const exactN = exact.length;
  // 이름이 정확히 일치하는 후보가 없을 때만 “기능 설명”으로 해석해 추천한다(이름 검색을 가리지 않기 위해).
  const rec = useRec(meta.minor, q, !pending && !!q.trim() && exactN === 0);
  const recTop = !pending && exactN === 0 ? rec.res?.results[0]?.c.n : undefined;
  const siblings = exact.length > 1 ? exact : results.slice(0, 5);

  // 상세에서 목록으로 돌아오면(작은 화면에서는 목록이 숨겨져 있었음) 스크롤 위치 복원
  useLayoutEffect(() => { if (listRef.current && !route.api) listRef.current.scrollTop = scrollTop.current; }, [route.api]);

  // "/" 로 검색창 포커스
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const select = (name: string) => setRoute({ api: name, tab: 'overview', mq: '', inh: route.inh }, true);
  const quick = (s: string) => { setDraft(s); setRoute({ q: s }); inputRef.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (shown[active]) select(shown[active].entry.n); else if (recTop) select(recTop); }
    else if (e.key === 'Escape') { setDraft(''); setRoute({ q: '' }); }
  };
  useEffect(() => { document.getElementById(`cand-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  return {
    searchable, known, draft, setDraft, pending, q, results, shown, exactN, rec, siblings,
    active, setActive, inputRef, listRef, onScroll: (top: number) => { scrollTop.current = top; }, onKey, select, quick,
  };
}
