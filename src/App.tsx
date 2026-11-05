import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RecSection, useRec } from './Ask';
import { loadGlobal, loadRecEval, loadVersion, type Global, type RecEval, type VersionData } from './data';
import { search, type Candidate } from './search';
import { useRoute, type Route } from './route';
import { DepBadge, KoBadge } from './ui';
import { Detail } from './Detail';

const MAX_RENDER = 200;
const NAME_QUICK = ['Table', 'sap.m.Table', 'Dialog', '표', '팝업'];
const FEATURE_QUICK = ['댓글을 다는 기능을 추가하고 싶어', '날짜를 고르고 싶어', '삭제할 때 확인창을 띄우고 싶어', '파일 업로드', '잠깐 알림 메시지 보여주기'];
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
  const exactN = results.filter((c) => c.tier <= 2).length;
  // 이름이 정확히 일치하는 후보가 없을 때만 “기능 설명”으로 해석해 추천한다(이름 검색을 가리지 않기 위해).
  const rec = useRec(meta.minor, q, !pending && !!q.trim() && exactN === 0);
  const recTop = !pending && exactN === 0 ? rec.res?.results[0]?.c.n : undefined;

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
    else if (e.key === 'Enter') { if (shown[active]) select(shown[active].entry.n); else if (recTop) select(recTop); }
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
          UI5 <b>{meta.version}</b>{verInfo?.lts ? ' LTS' : ''}<span className="chip-extra"> · 검색 {meta.counts.searchable.toLocaleString()}개 · 한국어 상세 <b>{meta.counts.detailedKo}</b>개</span>
          {meta.dataKind === 'demo' ? <span className="badge b-warn">데모 데이터</span> : <span className="badge b-off">공식 api.json</span>}
        </button>
      </header>
      {showScope && <Scope g={g} vd={vd} onVersion={(m) => { onVersion(m); setShowScope(false); }} onPick={(n) => { select(n); setShowScope(false); }} />}

      <div className="panes">
        <section className="pane list-pane" aria-label="검색과 후보 목록">
          <div className="search-box">
            <label htmlFor="q" className="sr-only">API 이름 또는 하고 싶은 일 검색</label>
            <input
              id="q" ref={inputRef} autoFocus type="search" autoComplete="off" spellCheck={false}
              placeholder="API 이름 또는 하고 싶은 일 …  ( / 로 이동 )"
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              role="combobox" aria-expanded={shown.length > 0} aria-controls="cands" aria-activedescendant={shown.length ? `cand-${active}` : undefined}
            />
            <div className="search-status" role="status" aria-live="polite">
              {pending ? '검색 중…' : q ? (results.length ? `UI5 ${meta.minor} 에서 이름 후보 ${results.length}개 · 정식 이름 기준 중복 없음${results.length > MAX_RENDER ? ` · 상위 ${MAX_RENDER}개 표시` : ''}` : rec.res?.results.length ? `이름과 일치하는 API 는 없어, 기능 설명으로 해석해 추천 ${Math.min(3, rec.res.results.length)}개를 골랐습니다` : '') : ''}
            </div>
          </div>

          <div className="cands" ref={listRef} onScroll={(e) => { scrollTop.current = e.currentTarget.scrollTop; }}>
            {!q && !pending && <div className="only-narrow"><Landing vd={vd} g={g} onQuick={(s) => { setDraft(s); setRoute({ q: s }); }} onPick={select} /></div>}
            {q && !pending && rec.loading && <p className="muted pad" role="status">기능 설명으로 해석하는 중…</p>}
            {q && !pending && exactN === 0 && rec.res && rec.res.results.length > 0 && (
              <RecSection res={rec.res} version={meta.version} index={searchable} selected={route.api} onPick={select} />
            )}
            {q && !pending && !rec.loading && results.length === 0 && !(rec.res && rec.res.results.length > 0) && (
              <div className="empty" role="status">
                <b>“{q}”</b> 와 일치하는 API 가 UI5 {meta.minor} 지원 범위 안에 없고, 기능 설명으로도 해석하지 못했습니다.
                <p className="muted">존재하지 않는 API 를 만들어 보여 주지 않습니다. 다른 버전에서는 있을 수 있으니 위의 버전 선택으로 바꿔 보거나, 정식 이름(예: <code>sap.m.Table</code>) 또는 영어 키워드(예: <code>date picker</code>)로 다시 검색해 보세요.</p>
                <div className="chips">{FEATURE_QUICK.slice(0, 4).map((x) => <button key={x} className="chip" onClick={() => { setDraft(x); setRoute({ q: x }); }}>{x}</button>)}</div>
              </div>
            )}
            {q && !pending && results.length > 0 && exactN === 0 && rec.res && rec.res.results.length > 0 && <h3 className="sec-title">이름이 비슷한 후보</h3>}
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
            <div className="detail-empty only-wide">
              <Landing vd={vd} g={g} onQuick={(s) => { setDraft(s); setRoute({ q: s }); inputRef.current?.focus(); }} onPick={select} />
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

function Landing({ vd, g, onQuick, onPick }: { vd: VersionData; g: Global; onQuick: (s: string) => void; onPick: (n: string) => void }) {
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  const [ev, setEv] = useState<RecEval | null>(null);
  useEffect(() => { loadRecEval().then(setEv).catch(() => setEv(null)); }, []);
  const { meta } = vd;
  return (
    <div className="landing">
      <h2>무엇을 만들고 싶으세요?</h2>
      <p className="lead">API 이름을 몰라도 됩니다. 하고 싶은 일을 적거나, 아는 이름을 검색하세요. 지금은 <b>UI5 {meta.version}</b> 기준이며 위쪽에서 버전을 바꿀 수 있습니다.</p>
      <div className="try">
        <h3>하고 싶은 일로 찾기</h3>
        <div className="chips">{FEATURE_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s)}>{s}</button>)}</div>
      </div>
      <div className="try">
        <h3>이름으로 찾기 <small className="muted">(전체 이름·짧은 이름·한국어 별칭)</small></h3>
        <div className="chips">{NAME_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s)}>{s}</button>)}</div>
      </div>
      <h3>한국어 설명이 준비된 API ({ko.length}개)</h3>
      <ul className="plain">{ko.map((k) => <li key={k.n}><button className="link" onClick={() => onPick(k.n)}>{k.n}</button> <KoBadge status={k.ko} /></li>)}</ul>
      <p className="muted small">나머지 {(meta.counts.searchable - ko.length).toLocaleString()}개는 검색과 공식 영문 구조(속성·메서드·이벤트 등)를 제공합니다. 전체 UI5 API 를 한국어로 지원하는 것이 아닙니다.</p>
      <section className="about" aria-label="UI5 Lens 소개">
        <h3>UI5 Lens 는 이런 도구입니다</h3>
        <ul>
          <li>공식 <code>api.json</code> 을 {g.versions.versions.length}개 UI5 버전에 걸쳐 정리해, <b>“이 API 를 내 버전에서 쓸 수 있나?”</b> 를 한국어로 빠르게 확인하게 돕는 학습자용 도구입니다.</li>
          <li>공식 문서를 대체하지 않습니다. 항목마다 공식 원문 링크가 있고, 한국어는 AI 초안인지·검토됐는지를 표시합니다.</li>
          <li>공식 Demo Kit(<a href="https://ui5.sap.com" target="_blank" rel="noreferrer noopener">ui5.sap.com</a>)도 since·deprecated 색인을 제공합니다. Lens 는 같은 공식 데이터를 한국어 검색과 버전 간 비교로 보완합니다. 코드를 대신 써 주는 AI 도구와 달리, 근거를 보며 직접 고르는 용도입니다.</li>
          {ev && <li>“하고 싶은 일로 찾기”는 AI 가 아니라 공식 이름·설명과의 일치로 고릅니다. 자체 평가에서 새 질문 {ev.fresh.n}개 중 {Math.round((ev.fresh.top3 / ev.fresh.n) * 100)}% 에서 상위 3개 안에 정답이 있었습니다(UI5 {ev.minor}). 못 찾는 표현도 많습니다.</li>}
        </ul>
        <p className="muted small">데이터 기준: UI5 {meta.version} · 공식 자료 수집 {meta.fetchedAt.slice(0, 10)} · 한국어 {ko.length}개 중 검토 완료 {meta.counts.reviewedKo}개</p>
      </section>
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
