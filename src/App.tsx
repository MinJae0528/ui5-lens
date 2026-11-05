import { useEffect, useMemo, useState } from 'react';
import { RecSection } from './Ask';
import { MAX_RENDER, useSearchController } from './controller/useSearchController';
import { useRoute, type Route } from './controller/route';
import { loadGlobal, loadVersion, type Global, type VersionData } from './data';
import { Detail } from './detail/Detail';
import { Card } from './shell/Card';
import { Landing } from './shell/Landing';
import { FEATURE_QUICK } from './shell/quick';
import { Scope } from './shell/Scope';

const LS_KEY = 'ui5lens.version';
const lsGet = () => { try { return localStorage.getItem(LS_KEY) ?? ''; } catch { return ''; } };
const lsSet = (v: string) => { try { localStorage.setItem(LS_KEY, v); } catch { /* 저장 불가 환경이면 무시 */ } };

/** 최상위: 버전 목록과 선택한 버전의 인덱스를 불러오는 단계(로딩·오류 상태)만 맡는다. */
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

/** 화면 조립: 상태와 동작은 useSearchController 가 갖고, 여기서는 배치와 그리기만 한다. */
function Shell({ g, vd, route, setRoute, onVersion }: { g: Global; vd: VersionData; route: Route; setRoute: ReturnType<typeof useRoute>[1]; onVersion: (m: string) => void }) {
  const { meta } = vd;
  const c = useSearchController({ g, vd, route, setRoute });
  const [showScope, setShowScope] = useState(false);
  const { q, pending, results, shown, exactN, rec } = c;
  const verInfo = g.versions.versions.find((v) => v.minor === meta.minor);
  const recReady = !!(rec.res && rec.res.results.length > 0);

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
      {showScope && <Scope g={g} vd={vd} onVersion={(m) => { onVersion(m); setShowScope(false); }} onPick={(n) => { c.select(n); setShowScope(false); }} />}

      <div className="panes">
        <section className="pane list-pane" aria-label="검색과 후보 목록">
          <div className="search-box">
            <label htmlFor="q" className="sr-only">API 이름 또는 하고 싶은 일 검색</label>
            <input
              id="q" ref={c.inputRef} autoFocus type="search" autoComplete="off" spellCheck={false}
              placeholder="API 이름 또는 하고 싶은 일 …  ( / 로 이동 )"
              value={c.draft} onChange={(e) => c.setDraft(e.target.value)} onKeyDown={c.onKey}
              role="combobox" aria-expanded={shown.length > 0} aria-controls="cands" aria-activedescendant={shown.length ? `cand-${c.active}` : undefined}
            />
            <div className="search-status" role="status" aria-live="polite">
              {pending ? '검색 중…' : q ? (results.length ? `UI5 ${meta.minor} 에서 이름 후보 ${results.length}개 · 정식 이름 기준 중복 없음${results.length > MAX_RENDER ? ` · 상위 ${MAX_RENDER}개 표시` : ''}` : recReady ? `이름과 일치하는 API 는 없어, 기능 설명으로 해석해 추천 ${Math.min(3, rec.res!.results.length)}개를 골랐습니다` : '') : ''}
            </div>
          </div>

          <div className="cands" ref={c.listRef} onScroll={(e) => c.onScroll(e.currentTarget.scrollTop)}>
            {!q && !pending && <div className="only-narrow"><Landing vd={vd} g={g} onQuick={c.quick} onPick={c.select} /></div>}
            {q && !pending && rec.loading && <p className="muted pad" role="status">기능 설명으로 해석하는 중…</p>}
            {q && !pending && exactN === 0 && recReady && (
              <RecSection res={rec.res!} version={meta.version} index={c.searchable} selected={route.api} onPick={c.select} />
            )}
            {q && !pending && !rec.loading && results.length === 0 && !recReady && (
              <div className="empty" role="status">
                <b>“{q}”</b> 와 일치하는 API 가 UI5 {meta.minor} 지원 범위 안에 없고, 기능 설명으로도 해석하지 못했습니다.
                <p className="muted">존재하지 않는 API 를 만들어 보여 주지 않습니다. 다른 버전에서는 있을 수 있으니 위의 버전 선택으로 바꿔 보거나, 정식 이름(예: <code>sap.m.Table</code>) 또는 영어 키워드(예: <code>date picker</code>)로 다시 검색해 보세요.</p>
                <div className="chips">{FEATURE_QUICK.slice(0, 4).map((x) => <button key={x} className="chip" onClick={() => c.quick(x)}>{x}</button>)}</div>
              </div>
            )}
            {q && !pending && results.length > 0 && exactN === 0 && recReady && <h3 className="sec-title">이름이 비슷한 후보</h3>}
            <ul id="cands" role="listbox" aria-label="API 후보">
              {shown.map((r, i) => (
                <Card key={r.entry.n} c={r} i={i} q={q} active={i === c.active} selected={route.api === r.entry.n}
                  onHover={() => c.setActive(i)} onPick={() => c.select(r.entry.n)} />
              ))}
            </ul>
          </div>
        </section>

        <section className="pane detail-pane" aria-label="API 상세">
          {route.api ? (
            <Detail
              key={`${meta.minor}/${route.api}`} name={route.api} g={g} vd={vd} known={c.known} route={route} setRoute={setRoute} siblings={c.siblings}
              onBack={() => setRoute({ api: null, mq: '', tab: 'overview' }, true)}
              onApi={c.select} onVersion={onVersion}
            />
          ) : (
            <div className="detail-empty only-wide">
              <Landing vd={vd} g={g} onQuick={c.quick} onPick={c.select} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
