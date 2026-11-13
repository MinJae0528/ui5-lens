import { useEffect, useMemo, useRef, useState } from 'react';
import { HybridSection, MemberRecSection, RecSection } from './Ask';
import { productOf, switchProduct, useRoute, type Product, type Route, type Ui5Mode } from './controller/route';
import { useSearchController } from './controller/useSearchController';
import { loadGlobal, loadVersion, type Global, type VersionData } from './data';
import { Detail } from './detail/Detail';
import { Browse } from './shell/Browse';
import { Guide, GuidePage } from './shell/Guide';
import { Landing } from './shell/Landing';
import { ModeTabs } from './shell/ModeTabs';
import { ProductTabs } from './shell/ProductTabs';
import { AbapDetail, AbapGroups, AbapList, abapGroupCounts, abapNameHits, useAbap } from './shell/Abap';
import { NameResults } from './shell/NameResults';
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

const PLACEHOLDER = {
  name: '클래스·메서드 이름 (예: Table, setText, Button#setText)   ( / 로 이동 )',
  feature: '하고 싶은 일 (예: 댓글을 다는 기능, 날짜를 고르기)   ( / 로 이동 )',
};

/** 화면 조립: 상태와 동작은 컨트롤러 훅이 갖고, 여기서는 모드별 배치와 그리기만 한다. */
function Shell({ g, vd, route, setRoute, onVersion }: { g: Global; vd: VersionData; route: Route; setRoute: ReturnType<typeof useRoute>[1]; onVersion: (m: string) => void }) {
  const { meta } = vd;
  const c = useSearchController({ g, vd, route, setRoute });
  const [showScope, setShowScope] = useState(false);
  const { q, pending, mode, rec } = c;
  const verInfo = g.versions.versions.find((v) => v.minor === meta.minor);
  const recReady = !!(rec.res && rec.res.results.length > 0);
  const memberRecReady = !!(c.memberRec && c.memberRec.results.length > 0);
  const hybridReady = !!c.hybrid;
  const abap = useAbap(mode === 'abap' || (mode === 'name' && !!q));
  const abapHits = mode === 'name' && q && abap.doc ? abapNameHits(abap.doc.entries, q) : [];
  // 상위 구분(UI5 | ABAP). 주소의 모드에서 계산하고, UI5 로 돌아올 때를 위해 직전 UI5 모드를 기억한다.
  const product = productOf(mode);
  const lastUi5 = useRef<Ui5Mode>('name');
  useEffect(() => { if (product === 'ui5') lastUi5.current = mode as Ui5Mode; }, [product, mode]);
  const onProduct = (p: Product) => { if (p !== product) setRoute(switchProduct(p, lastUi5.current), true); };
  const abapGroups = useMemo(() => abapGroupCounts(abap.doc?.entries ?? []), [abap.doc]);
  const abapGroup = abapGroups.some(([name]) => name === route.ag) ? route.ag : ''; // 알 수 없는 그룹 이름(직접 고친 주소)은 전체로
  const hasDetail = !!route.api || (mode === 'guide' && !!route.tp) || (mode === 'abap' && !!route.ab);
  const landing = <Landing vd={vd} g={g} mode={mode} onQuick={c.quick} onMode={c.setMode} onLib={(lib) => setRoute({ m: 'browse', lib, api: null }, true)} onPick={c.select} />;

  const status = (() => {
    if (pending) return '검색 중…';
    if (!q) return '';
    if (mode === 'name') return `UI5 ${meta.minor} · 클래스 ${c.results.length}개 · 메서드·속성·이벤트 ${c.allGroups.length}개`;
    if (mode === 'feature') return recReady || memberRecReady || hybridReady ? '하고 싶은 일을 공식 이름·설명과 비교해 골랐습니다' : '';
    return '';
  })();

  return (
    <div className={`app ${hasDetail ? 'has-detail' : ''}`} data-product={product}>
      <header className="top">
        <div className="brand"><span className="logo">ERP Lens</span><span className="tag">한국어 UI5 API 탐색 · ABAP 기본</span></div>
      </header>
      <ProductTabs product={product} onProduct={onProduct} abapCount={abap.doc?.entries.length} />
      <section className="ctx" id="ctx" role="tabpanel" aria-labelledby={`ptab-${product}`}>
        {product === 'ui5' ? (
          <>
            {/* 버전은 UI5 에만 있다. ABAP 에는 UI5 버전이 없어서 아래 ABAP 맥락 바에서는 보이지 않는다. */}
            <div className="ctx-row">
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
            </div>
            <ModeTabs mode={mode} onMode={c.setMode} docBase={meta.docBase} />
          </>
        ) : (
          <>
            <div className="ctx-row"><span className="ctx-note">버전 구분 없음 · 기본 문법</span></div>
            <AbapGroups groups={abapGroups} total={abap.doc?.entries.length ?? 0} active={abapGroup} onPick={(ag) => setRoute({ ag, ab: '' })} />
          </>
        )}
      </section>
      {product === 'ui5' && showScope && <Scope g={g} vd={vd} onVersion={(m) => { onVersion(m); setShowScope(false); }} onPick={(n) => { c.select(n); setShowScope(false); }} />}

      <div className="panes">
        <section className="pane list-pane" aria-label="검색과 후보 목록" role="tabpanel" aria-labelledby={mode === 'abap' ? 'ptab-abap' : `mode-${mode}`}>
          {c.typed && (
            <div className="search-box">
              <label htmlFor="q" className="sr-only">{mode === 'name' ? '클래스·메서드 이름 검색' : '하고 싶은 일 검색'}</label>
              <input
                id="q" ref={c.inputRef} autoFocus type="search" autoComplete="off" spellCheck={false}
                placeholder={PLACEHOLDER[mode as 'name' | 'feature']}
                value={c.draft} onChange={(e) => c.setDraft(e.target.value)} onKeyDown={c.onKey}
                role="combobox" aria-expanded={c.items.length > 0} aria-controls="cands" aria-activedescendant={c.items.length ? `cand-${c.active}` : undefined}
              />
              <div className="search-status" role="status" aria-live="polite">{status}</div>
            </div>
          )}

          {c.typed && (
            <div className="cands" ref={c.listRef} onScroll={(e) => c.onScroll(e.currentTarget.scrollTop)}>
              {!q && !pending && <div className="only-narrow">{landing}</div>}

              {abapHits.length > 0 && !pending && (
                <div className="notice"><b>ABAP 기본</b> 에도 있습니다: {abapHits.map((e) => <button key={e.id} className="chip" onClick={() => setRoute({ ...switchProduct('abap', lastUi5.current), ab: e.id, ag: '' }, true)}>{e.term}</button>)}</div>
              )}

              {mode === 'name' && q && !pending && (
                <NameResults
                  q={q} kf={c.kf} setKind={c.setKind}
                  classList={c.classList} shownClasses={c.shownClasses} groups={c.groups} shownGroups={c.shownGroups} kindCounts={c.kindCounts} allGroupsCount={c.allGroups.length} allClassCount={c.results.length} items={c.items}
                  active={c.active} setActive={c.setActive} selected={route.api}
                  showAcc={c.showAcc} setShowAcc={c.setShowAcc} moreClasses={c.moreClasses} setMoreClasses={c.setMoreClasses} moreMembers={c.moreMembers} setMoreMembers={c.setMoreMembers}
                  memberLoading={c.memberLoading} memberError={c.memberError} select={c.select} openMember={c.openMember} toFeature={() => c.quick(q, 'feature')}
                />
              )}

              {mode === 'feature' && q && !pending && (
                <>
                  {(rec.loading || c.memberLoading) && !c.recFailed && <p className="muted pad" role="status">기능 설명으로 해석하는 중…</p>}
                  {c.recFailed && (
                    <div className="notice warn" role="alert">
                      <b>추천용 자료를 불러오지 못했습니다.</b> “추천 결과 없음”이 아니라 자료 조회 실패입니다(네트워크 또는 데이터 파일 문제). 이름·메서드 검색은 계속 쓸 수 있습니다.
                      <div className="row"><button className="btn small" onClick={c.retryLoad}>다시 시도</button> <button className="btn small" onClick={() => c.quick(q, 'name')}>이름으로 검색</button></div>
                    </div>
                  )}
                  {c.hybrid && <HybridSection res={c.hybrid} onPick={c.select} onOpen={c.openMember} />}
                  {recReady && <RecSection res={rec.res!} version={meta.version} index={c.searchable} selected={route.api} onPick={c.select} />}
                  {memberRecReady && <MemberRecSection res={c.memberRec!} onOpen={c.openMember} />}
                  {!rec.loading && !c.memberLoading && !c.recFailed && !recReady && !memberRecReady && !hybridReady && (
                    <div className="empty" role="status">
                      <b>“{q}”</b> 을(를) 기능 설명으로 해석하지 못했거나, UI5 {meta.minor} 공식 자료에서 겹치는 API 를 찾지 못했습니다.
                      <p className="muted">존재하지 않는 API 를 만들어 보여 주지 않습니다. 영어 키워드(예: <code>date picker</code>)로 다시 적거나, 이름을 안다면 <b>이름·메서드 검색</b> 모드를 쓰세요. 다른 버전에서는 있을 수 있습니다.</p>
                      <div className="chips">{FEATURE_QUICK.slice(0, 4).map((x) => <button key={x} className="chip" onClick={() => c.quick(x, 'feature')}>{x}</button>)}</div>
                      <button className="btn" onClick={() => c.quick(q, 'name')}>“{q}” 를 이름으로 검색</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mode === 'browse' && <div className="cands"><Browse index={c.searchable} lib={route.lib} selected={route.api} onLib={(lib) => setRoute({ lib })} onPick={c.select} /></div>}
          {mode === 'abap' && <div className="cands"><AbapList res={abap} ab={route.ab} group={abapGroup} onPick={(ab) => setRoute({ ab }, true)} /></div>}
          {mode === 'guide' && <div className="cands"><Guide minor={meta.minor} hasTopics={!!meta.counts.topics} tp={route.tp} onTopic={(tp) => setRoute({ tp, api: null }, true)} /></div>}
        </section>

        <section className="pane detail-pane" aria-label="상세">
          {route.api ? (
            <Detail
              key={`${meta.minor}/${route.api}`} name={route.api} g={g} vd={vd} known={c.known} route={route} setRoute={setRoute} siblings={c.siblings}
              onBack={() => setRoute({ api: null, mem: '', mq: '', tab: 'overview' }, true)}
              onApi={c.select} onVersion={onVersion}
            />
          ) : mode === 'abap' ? (
            <div className="detail-empty guide-wrap"><AbapDetail res={abap} ab={route.ab} onBack={() => setRoute({ ab: '' }, true)} /></div>
          ) : mode === 'guide' ? (
            <div className="detail-empty guide-wrap"><GuidePage minor={meta.minor} hasTopics={!!meta.counts.topics} docBase={meta.docBase} tp={route.tp} onTopic={(tp) => setRoute({ tp }, true)} onBack={() => setRoute({ tp: '' }, true)} /></div>
          ) : (
            <div className="detail-empty only-wide">{landing}</div>
          )}
        </section>
      </div>
    </div>
  );
}
