import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Global, VersionData } from '../data';
import { countByKind, KIND_NAME, searchMembers, type KindChar, type MemberGroup, type MemberRow } from '../domain/memberIndex';
import { search, type Candidate } from '../domain/search';
import type { KindFilter, Mode, Route } from './route';
import { useMemberRec } from './useMemberRec';
import { useMemberRows } from './useMemberRows';
import { useRec } from './useRec';

export const MAX_RENDER = 200;
type SetRoute = (patch: Partial<Route>, push?: boolean) => void;
const KINDS_OF: Record<Exclude<KindFilter, 'all' | 'c'>, ReadonlySet<KindChar>> = { m: new Set<KindChar>(['m']), p: new Set<KindChar>(['p']), e: new Set<KindChar>(['e']), a: new Set<KindChar>(['a', 's']) };

/** 키보드로 오갈 수 있는 결과 한 줄(이름 검색 모드) */
export type Item = { type: 'class'; c: Candidate } | { type: 'member'; g: MemberGroup };

/**
 * 검색 화면의 컨트롤러: 모드(이름·메서드 / 기능 추천 / 탐색 / 문서), 입력 디바운스, 클래스·멤버 이름 검색,
 * 기능 추천(클래스 + 메서드), 키보드 이동, 선택, 스크롤 복원. 화면은 이 훅이 돌려주는 값을 그리기만 한다.
 */
export function useSearchController({ g, vd, route, setRoute }: { g: Global; vd: VersionData; route: Route; setRoute: SetRoute }) {
  const { meta } = vd;
  const mode: Mode = route.m;
  const searchable = useMemo(() => vd.index.filter((i) => i.p !== 0), [vd]);
  const known = useMemo(() => new Set(vd.index.map((i) => i.n)), [vd]);
  const [draft, setDraft] = useState(route.q);
  const [active, setActive] = useState(0);
  const [showAcc, setShowAcc] = useState(false);
  const [moreClasses, setMoreClasses] = useState(false);
  const [moreMembers, setMoreMembers] = useState(false);
  const [retry, setRetry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const q = route.q;
  const typed = mode === 'name' || mode === 'feature';

  // 입력 디바운스: 입력이 멈춘 뒤 URL(q)에 반영
  const pending = draft !== q;
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => { setRoute({ q: draft }); setActive(0); setMoreClasses(false); setMoreMembers(false); if (listRef.current) { listRef.current.scrollTop = 0; scrollTop.current = 0; } }, 120);
    return () => clearTimeout(t);
  }, [draft, q, setRoute]);
  useEffect(() => setDraft(q), [q]);

  // ---- 이름·메서드 검색 모드
  const results: Candidate[] = useMemo(() => (mode === 'name' ? search(searchable, g.aliases, q) : []), [mode, searchable, g.aliases, q]);
  const nameActive = mode === 'name' && !!q.trim() && !pending;
  const mem = useMemberRows(meta.minor, nameActive || (mode === 'feature' && !!q.trim()), retry);
  const allGroups: MemberGroup[] = useMemo(() => (nameActive && mem.rows ? searchMembers(mem.rows, q, { includeAccessors: showAcc, limit: 1000 }) : []), [nameActive, mem.rows, q, showAcc]);
  const kindCounts = useMemo(() => countByKind(allGroups), [allGroups]);
  const kf = route.kf;
  const groups = kf === 'all' ? allGroups : kf === 'c' ? [] : allGroups.filter((x) => KINDS_OF[kf].has(x.k));
  const classList = kf === 'all' || kf === 'c' ? results : [];
  const CLASS_SHOW = 12, MEMBER_SHOW = 25;
  const shownClasses = moreClasses ? classList.slice(0, MAX_RENDER) : classList.slice(0, CLASS_SHOW);
  const shownGroups = moreMembers ? groups : groups.slice(0, MEMBER_SHOW);
  const items: Item[] = useMemo(() => [...shownClasses.map((c): Item => ({ type: 'class', c })), ...shownGroups.map((x): Item => ({ type: 'member', g: x }))], [shownClasses, shownGroups]);
  const exact = results.filter((c) => c.tier <= 2);
  const siblings = exact.length > 1 ? exact : results.slice(0, 5);

  // ---- 기능 추천 모드: 컨트롤(클래스) + 메서드
  const featureOn = mode === 'feature' && !pending && !!q.trim();
  const rec = useRec(meta.minor, q, featureOn, retry);
  const memberRecState = useMemberRec(mem.rows, q, featureOn, retry);
  const memberRec = memberRecState.res;
  // 추천 자료(컨트롤 말뭉치·용어 사전·멤버 색인) 중 하나라도 못 불러왔으면 “결과 없음”이 아니라 실패다.
  const recFailed = featureOn && (rec.error || memberRecState.error || mem.error);

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

  const select = (name: string) => setRoute({ api: name, tab: 'overview', mem: '', mq: '', inh: route.inh }, true);
  const openMember = (r: Pick<MemberRow, 'c' | 'k' | 'n'>) => setRoute({ api: r.c, mem: `${KIND_NAME[r.k]}:${r.n}`, tab: 'mdesc', mq: '' }, true);
  const setMode = (m: Mode) => setRoute({ m, api: null, mem: '', mq: '', tab: 'overview' }, true);
  const setKind = (k: KindFilter) => { setActive(0); setRoute({ kf: k }); };
  const quick = (s: string, m?: Mode) => { setDraft(s); setRoute({ q: s, ...(m ? { m } : {}) }); inputRef.current?.focus(); };
  const openItem = (it: Item) => (it.type === 'class' ? select(it.c.entry.n) : openMember(it.g.rows[0]));
  const recTop = featureOn ? rec.res?.results[0]?.c.n : undefined;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (mode === 'name' && items[active]) openItem(items[active]); else if (mode === 'feature' && recTop) select(recTop); }
    else if (e.key === 'Escape') { setDraft(''); setRoute({ q: '' }); }
  };
  useEffect(() => { document.getElementById(`cand-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  return {
    mode, typed, searchable, known, draft, setDraft, pending, q, siblings,
    // 이름·메서드
    results, classList, groups, allGroups, kindCounts, kf, shownClasses, shownGroups, items, memberLoading: mem.loading, memberError: mem.error,
    showAcc, setShowAcc, moreClasses, setMoreClasses, moreMembers, setMoreMembers,
    // 기능 추천
    rec, memberRec, memberRows: mem.rows, recFailed, retryLoad: () => setRetry((n) => n + 1),
    active, setActive, inputRef, listRef, onScroll: (top: number) => { scrollTop.current = top; }, onKey,
    select, openMember, openItem, setMode, setKind, quick,
  };
}
