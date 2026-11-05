import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AskPanel } from './Ask';
import { loadGlobal, loadVersion, type Global, type VersionData } from './data';
import { search, type Candidate } from './search';
import { useRoute, type Route } from './route';
import { DepBadge, KoBadge } from './ui';
import { Detail } from './Detail';

const MAX_RENDER = 200;
const QUICK = ['Table', 'sap.m.Table', '표', 'Dialog', '팝업', '입력창'];
const LS_KEY = 'ui5lens.version';
const lsGet = () => { try { return localStorage.getItem(LS_KEY) ?? ''; } catch { return ''; } };
const lsSet = (v: string) => { try { localStorage.setItem(LS_KEY, v); } catch { /* 저장 불가 환경이면 무시 */ } };

export function App() {
  const [g, setG] = useState<Global | null>(null);
  const [gErr, setGErr] = useState<string | null>(null);
  const [route, setRoute] = useRoute();
  const [vd, setVd] = useState<VersionData | null>(null);
  const [vErr, setVErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { setGErr(null); loadGlobal(attempt > 0).then(setG).catch((e) => setGErr(String(e.message ?? e))); }, [attempt]);

  // 현재 버전: URL(v) → 마지막 선택(localStorage) → 한국어 기준 버전. 목록에 없는 값이면 기준 버전.
  const minor = useMemo(() => {
    if (!g) return '';
    const ok = (m: string) => g.versions.versions.some((x) => x.minor === m);
    return [route.v, lsGet(), g.versions.baseMinor].find((m) => m && ok(m)) ?? g.versions.versions[0]?.minor ?? '';
  }, [g, route.v]);

  useEffect(() => {
    if (!minor) return;
    let alive = true;
    setVd(null); setVErr(null);
    loadVersion(minor, attempt > 0).then((d) => alive && setVd(d)).catch((e) => alive && setVErr(String(e.message ?? e)));
    return () => { alive = false; };
  }, [minor, attempt]);

  const err = gErr ?? vErr;
  if (err) return (
    <div className="center-state" role="alert">
      <h1>공식 자료 인덱스를 불러오지 못했습니다</h1>
      <p>{err}</p>
      <p className="muted">가짜 데이터로 대신 보여 주지 않습니다. <code>npm run fetch:api && npm run build:data</code> 로 데이터를 생성했는지 확인하세요.</p>
      <button className="btn" onClick={() => setAttempt((a) => a + 1)}>다시 시도</button>
    </div>
  );
  if (!g || !vd) return <div className="center-state" role="status"><div className="spinner" />{g ? `UI5 ${minor} 인덱스를 불러오는 중…` : '버전 목록을 불러오는 중…'}</div>;

  return <Shell key={minor} g={g} vd={vd} route={route} setRoute={setRoute} onVersion={(m) => { lsSet(m); setRoute({ v: m }); }} />;
}

function Shell({ g, vd, route, setRoute, onVersion }: { g: Global; vd: VersionData; route: Route; setRoute: ReturnType<typeof useRoute>[1]; onVersion: (m: string) => void }) {
  const { meta } = vd;
  const searchable = useMemo(() => vd.index.filter((i) => i.p !== 0), [vd]);
  const known = useMemo(() => new Set(vd.index.map((i) => i.n)), [vd]);
  const [draft, setDraft] = useState(route.q);
  const [active, setActive] = useState(0);
  const [showScope, setShowScope] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const q = route.q;

  const pending = draft !== q;
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => { setRoute({ q: draft }); setActive(0); if (listRef.current) { listRef.current.scrollTop = 0; scrollTop.current = 0; } }, 120);
    return () => clearTimeout(t);
  }, [draft, q, setRoute]);
  useEffect(() => setDraft(q), [q]);

  const results: Candidate[] = useMemo(() => search(searchable, g.aliases, q), [searchable, g.aliases, q]);
  const shown = results.slice(0, MAX_RENDER);

  // 상세에서 목록으로 돌아오면(작은 화면에서는 목록이 숨겨져 있었음) 스크롤 위치 복원
  useLayoutEffect(() => { if (listRef.current && !route.api) listRef.current.scrollTop = scrollTop.current; }, [route.api]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const select = (name: string) => setRoute({ api: name, tab: 'overview', mq: '', inh: route.inh }, true);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (shown[active]) select(shown[active].entry.n); }
    else if (e.key === 'Escape') { setDraft(''); setRoute({ q: '' }); }
  };
  useEffect(() => { document.getElementById(`cand-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const exact = results.filter((c) => c.tier <= 2);
  const siblings = exact.length > 1 ? exact : results.slice(0, 5);
  const verInfo = g.versions.versions.find((v) => v.minor === meta.minor);

  return (
    <div className={`app ${route.api ? 'has-detail' : ''}`}>
      <header className="top">
        <div className="brand"><span className="logo">UI5 Lens</span><span className="tag">한국어 UI5 API 탐색</span></div>
        <div className="ver-pick">
          <label htmlFor="ver">UI5 버전</label>
          <select id="ver" value={meta.minor} onChange={(e) => onVersion(e.target.value)} aria-label="UI5 버전 선택">
            {g.versions.versions.map((v) => (
              <option key={v.minor} value={v.minor}>{v.minor} ({v.version}){v.lts ? ' · LTS' : ''}{v.sapuiversion ? ` · SAP 매핑 ${v.sapuiversion}` : ''}</option>
            ))}
          </select>
        </div>
        <button className="scope-chip" onClick={() => setShowScope((s) => !s)} aria-expanded={showScope}>
          UI5 <b>{meta.version}</b>{verInfo?.lts ? ' LTS' : ''} · 검색 {meta.counts.searchable.toLocaleString()}개 · 한국어 상세 <b>{meta.counts.detailedKo}</b>개
          {meta.dataKind === 'demo' ? <span className="badge b-warn">데모 데이터</span> : <span className="badge b-off">공식 api.json</span>}
        </button>
      </header>
      {showScope && <Scope g={g} vd={vd} onVersion={(m) => { onVersion(m); setShowScope(false); }} onPick={(n) => { select(n); setShowScope(false); }} />}

      <div className="panes">
        <section className="pane list-pane" aria-label="검색과 후보 목록">
          <div className="mode-tabs" role="tablist" aria-label="찾는 방법">
            <button role="tab" aria-selected={route.mode !== 'ask'} className={route.mode !== 'ask' ? 'on' : ''} onClick={() => setRoute({ mode: '' })}>이름으로 찾기</button>
            <button role="tab" aria-selected={route.mode === 'ask'} className={route.mode === 'ask' ? 'on' : ''} onClick={() => setRoute({ mode: 'ask' })}>기능으로 찾기 <small>추천 3개</small></button>
          </div>
          {route.mode === 'ask' && (
            <AskPanel minor={meta.minor} version={meta.version} ask={route.ask} index={searchable} selected={route.api}
              onAsk={(t) => setRoute({ ask: t })} onPick={(n) => setRoute({ api: n, tab: 'overview', mq: '', inh: route.inh }, true)} />
          )}
          <div className="search-box" hidden={route.mode === 'ask'}>
            <label htmlFor="q" className="sr-only">API 검색</label>
            <input
              id="q" ref={inputRef} autoFocus type="search" autoComplete="off" spellCheck={false}
              placeholder="Table · sap.m.table · 표 · 팝업 …   ( / 로 이동 )"
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              role="combobox" aria-expanded={shown.length > 0} aria-controls="cands" aria-activedescendant={shown.length ? `cand-${active}` : undefined}
            />
            <div className="search-status" role="status" aria-live="polite">
              {pending ? '검색 중…' : q ? (results.length ? `UI5 ${meta.minor} 에서 후보 ${results.length}개 · 정식 이름 기준 중복 없음${results.length > MAX_RENDER ? ` · 상위 ${MAX_RENDER}개 표시` : ''}` : '') : ''}
            </div>
          </div>

          <div className="cands" hidden={route.mode === 'ask'} ref={listRef} onScroll={(e) => { scrollTop.current = e.currentTarget.scrollTop; }}>
            {!q && !pending && <Intro vd={vd} onQuick={(s) => { setDraft(s); setRoute({ q: s }); }} onPick={select} />}
            {q && !pending && results.length === 0 && (
              <div className="empty" role="status">
                <b>“{q}”</b> 와 일치하는 API 가 UI5 {meta.minor} 지원 범위 안에 없습니다.
                <p className="muted">다른 버전에서는 있을 수 있습니다 — 위의 버전 선택으로 바꿔 보세요. 존재하지 않는 API 를 만들어 보여 주지 않습니다. 정식 이름(예: <code>sap.m.Table</code>)이나 짧은 이름, 등록된 한국어 별칭으로 다시 검색해 보세요.</p>
              </div>
            )}
            <ul id="cands" role="listbox" aria-label="API 후보">
              {shown.map((c, i) => (
                <Card key={c.entry.n} c={c} i={i} q={q} active={i === active} selected={route.api === c.entry.n}
                  onHover={() => setActive(i)} onPick={() => select(c.entry.n)} />
              ))}
            </ul>
          </div>
        </section>

        <section className="pane detail-pane" aria-label="API 상세">
          {route.api ? (
            <Detail
              key={`${meta.minor}/${route.api}`} name={route.api} g={g} vd={vd} known={known} route={route} setRoute={setRoute} siblings={siblings}
              onBack={() => setRoute({ api: null, mq: '', tab: 'overview' }, true)}
              onApi={select} onVersion={onVersion}
            />
          ) : (
            <div className="detail-empty">
              <h2>API 를 선택하세요</h2>
              <p className="muted">왼쪽에서 키워드를 검색하고 후보 중 하나를 고르면, UI5 {meta.version} 의 공식 자료 기반 구조와 한국어 설명이 여기에 열립니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function hl(text: string, q: string) {
  const i = q ? text.toLowerCase().indexOf(q.trim().toLowerCase()) : -1;
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.trim().length)}</mark>{text.slice(i + q.trim().length)}</>;
}

function Card({ c, i, q, active, selected, onHover, onPick }: { c: Candidate; i: number; q: string; active: boolean; selected: boolean; onHover: () => void; onPick: () => void }) {
  const e = c.entry;
  return (
    <li id={`cand-${i}`} role="option" aria-selected={selected} className={`card ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} onMouseMove={onHover} onClick={onPick}>
      <div className="card-head">
        <span className="card-name">{hl(e.n, q)}</span>
        {selected && <span className="badge b-sel">선택됨</span>}
      </div>
      <div className="badges">
        <span className="badge">{e.l}</span><span className="badge">{e.k}</span>
        <DepBadge since={e.d} /><KoBadge status={e.ko} />
      </div>
      <p className="card-sum">
        {e.kz ? e.kz : <><span className="lang">EN 원문</span> {e.t || '(공식 설명 없음)'}</>}
      </p>
      <p className="card-use"><b>주로 사용하는 상황</b> {e.ku ?? '한국어 설명 준비 안 됨 — 공식 영문 설명만 있습니다.'}</p>
      <p className="reasons">{c.reasons.join(' · ')}</p>
    </li>
  );
}

function Intro({ vd, onQuick, onPick }: { vd: VersionData; onQuick: (s: string) => void; onPick: (n: string) => void }) {
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  return (
    <div className="intro">
      <h2>무엇을 찾으세요?</h2>
      <p className="muted">전체 이름(<code>sap.m.Table</code>), 대소문자 무관(<code>sap.m.table</code>), 짧은 이름(<code>Table</code>), 한국어 별칭(<code>표</code>, <code>팝업</code>)으로 검색할 수 있습니다. 지금 보는 버전은 <b>UI5 {vd.meta.version}</b> 입니다 (위에서 변경).</p>
      <div className="chips">{QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s)}>{s}</button>)}</div>
      <h3>한국어 상세 설명이 준비된 API ({ko.length}개)</h3>
      <ul className="plain">{ko.map((k) => <li key={k.n}><button className="link" onClick={() => onPick(k.n)}>{k.n}</button> <KoBadge status={k.ko} /></li>)}</ul>
      <p className="muted small">나머지 {(vd.meta.counts.searchable - ko.length).toLocaleString()}개는 검색과 공식 영문 구조(속성·메서드·이벤트 등)만 제공합니다. 전체 UI5 API 를 한국어로 지원하는 것이 아닙니다.</p>
    </div>
  );
}

function Scope({ g, vd, onVersion, onPick }: { g: Global; vd: VersionData; onVersion: (m: string) => void; onPick: (n: string) => void }) {
  const { meta } = vd;
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  const hosted = g.versions.versions.length;
  const apiVers = [...new Set(Object.values(meta.libraries).map((l) => l.apiJsonVersion).filter(Boolean))].join(', ');
  return (
    <div className="scope" role="region" aria-label="지원 범위">
      <div className="scope-grid">
        <div>
          <h3>지금 보는 버전</h3>
          <ul className="plain">
            <li><b>UI5</b> {meta.version} (마이너 {meta.minor}) · 공식 <code>api.json</code> 기준{apiVers && apiVers !== meta.version ? <span className="muted small"> · api.json 파일 내부 표기 버전 {apiVers} (서버가 그렇게 제공함)</span> : null}</li>
            <li><b>자료 조회 시점</b>: {meta.fetchedAt.slice(0, 16).replace('T', ' ')} (UTC)</li>
            <li><b>① 검색·공식 구조</b>: {meta.counts.searchable.toLocaleString()}개 · 라이브러리 {Object.keys(meta.libraries).length}개</li>
            <li><b>② 한국어 상세</b>: {ko.length}개 (검토 완료 {meta.counts.reviewedKo}개, 나머지 AI 초안)</li>
            <li><b>데이터 종류</b>: {meta.dataKind === 'official' ? '공식 자료만 (데모 데이터 없음)' : '⚠ 데모 데이터'}</li>
          </ul>
          <p className="muted small">한국어 상세 대상</p>
          <ul className="plain">{ko.map((k) => <li key={k.n}><button className="link" onClick={() => onPick(k.n)}>{k.n}</button> <KoBadge status={k.ko} /></li>)}</ul>
        </div>
        <div>
          <h3>받아 둔 UI5 버전 {hosted}개</h3>
          <p className="muted small">ui5.sap.com 이 호스팅하는 버전만 받을 수 있습니다. 서버에 없는 마이너 버전(예: 1.78, 1.100)은 가져올 방법이 없으니, 회사 버전이 목록에 없으면 가장 가까운 버전을 고르세요.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>버전</th><th>지원 상태</th><th>SAP 제품 매핑 (공식 안내)</th></tr></thead>
            <tbody>{g.versions.versions.map((v) => (
              <tr key={v.minor} className={v.minor === meta.minor ? 'cur' : ''}>
                <td><button className="link mono" onClick={() => onVersion(v.minor)}>{v.version}</button>{v.lts && <span className="badge b-ok"> LTS</span>}</td>
                <td>{v.support ?? '—'}</td><td>{[v.sapuiversion, v.frontendserver].filter(Boolean).join(' / ') || '—'}</td>
              </tr>))}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
