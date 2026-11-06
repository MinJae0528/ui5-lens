import { useEffect, useState } from 'react';
import { loadDetail, NotInVersion, type Detail as DetailData } from '../data';
import { koStatusFor } from '../domain/ko';
import { mergeMembers, MEMBER_SPECS, type MemberSpec } from '../domain/members';
import type { MemberKind } from '../types';
import { CopyButton, DepBadge, KoBadge } from '../ui';
import { Constructor } from './Constructor';
import { Examples } from './Examples';
import { Inheritance } from './Inheritance';
import { VersionGlance } from './Life';
import { MemberPage } from './MemberPage';
import { MemberTab } from './MemberTab';
import { NotInThisVersion } from './NotInVersion';
import { Overview } from './Overview';
import type { DetailProps } from './props';
import { Usage } from './Usage';
import { Versions } from './Versions';

type LoadState = { status: 'loading' } | { status: 'error'; msg: string; notInVersion?: boolean } | { status: 'ok'; data: DetailData };
const VALID_TABS = ['overview', 'ctor', ...MEMBER_SPECS.map((k) => k.id), 'inheritance', 'usage', 'examples', 'versions'];

/** 상세 화면의 뼈대: 자료 로딩 상태, 머리, 탭 줄, 탭 본문 선택. 각 탭의 내용은 같은 폴더의 파일이 맡는다. */
export function Detail(p: DetailProps) {
  const { name, route, setRoute } = p;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadDetail(p.vd, name).then((data) => alive && setState({ status: 'ok', data })).catch((e) => alive && setState({ status: 'error', msg: String(e.message ?? e), notInVersion: e instanceof NotInVersion }));
    return () => { alive = false; };
  }, [name, attempt]);

  const back = <button className="btn back" onClick={p.onBack}>← 후보 목록</button>;

  if (state.status === 'loading') return (
    <div className="detail"><div className="detail-bar">{back}</div>
      <div className="center-state" role="status"><div className="spinner" />{name} 상세 정보를 불러오는 중…</div></div>
  );
  if (state.status === 'error' && state.notInVersion) return <NotInThisVersion name={name} p={p} back={back} />;
  if (state.status === 'error') return (
    <div className="detail"><div className="detail-bar">{back}</div>
      <div className="center-state" role="alert">
        <h2>공식 자료를 조회하지 못했습니다</h2>
        <p><code>{name}</code> · {state.msg}</p>
        <p className="muted">조회에 실패해도 임의의 내용으로 대신 채우지 않습니다.</p>
        <div className="row"><button className="btn" onClick={() => setAttempt((a) => a + 1)}>다시 시도</button>
          <a className="btn" href={`${p.vd.meta.docBase}/#/api/${encodeURIComponent(name)}`} target="_blank" rel="noreferrer noopener">공식 사이트에서 열기 ↗</a></div>
      </div></div>
  );

  const { chain, ko, koError, chainErrors } = state.data;
  const doc = chain[0];
  const koStatus = koStatusFor(ko, p.vd.meta.minor);
  const others = p.siblings.filter((c) => c.entry.n !== name);
  const hasCtor = doc.kind === 'class' && !!doc.ctor;
  const tab = VALID_TABS.includes(route.tab) && (route.tab !== 'ctor' || hasCtor) ? route.tab : 'overview';
  const goTab = (t: string) => setRoute({ tab: t, mq: '' }, true);
  const onRef = (api: string, member: string | null) => (member ? setRoute({ api, mem: '', tab: 'method', mq: member }, true) : p.onApi(api));
  // 멤버 상세 페이지(예: mem=method:setText)
  if (route.mem) {
    const [mk, ...rest] = route.mem.split(':');
    return <MemberPage p={p} chain={chain} ko={ko} kind={mk as MemberKind} name={rest.join(':')} back={back} />;
  }
  const counts = (kind: MemberSpec) => ({ own: doc[kind.plural].length, merged: mergeMembers(chain, kind.plural).length });

  return (
    <div className="detail">
      <div className="detail-bar">{back}</div>
      <header className="detail-head">
        <div className="eyebrow">현재 선택한 API · {doc.library} · {doc.kind}</div>
        <h2 className="api-name">{doc.name}</h2>
        <div className="badges">
          <span className="badge b-sel">UI5 {p.vd.meta.version}</span>
          <DepBadge since={doc.deprecated ? doc.deprecated.since ?? true : null} />
          <KoBadge status={koStatus} />
          <CopyButton text={doc.name} label="이름 복사" />
          {doc.abstract && <span className="badge" title="직접 만들 수 없고 상속해서 쓰는 클래스">abstract</span>}
          {doc.final && <span className="badge">final</span>}
          {doc.experimental && <span className="badge b-warn" title="공식 자료에 실험적 기능으로 표시됨">experimental</span>}
          <a className="btn small" href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">공식 원문 ↗</a>
          <a className="btn small" href={`${p.vd.meta.docBase}/#/entity/${encodeURIComponent(doc.name)}`} target="_blank" rel="noreferrer noopener" title="ui5.sap.com 의 이 컨트롤 샘플 목록">공식 샘플 ↗</a>
        </div>
        <VersionGlance name={doc.name} g={p.g} current={p.vd.meta.minor} deprecated={doc.deprecated} since={doc.since} onVersion={p.onVersion} onMore={() => goTab('versions')} />
        {others.length > 0 && (
          <div className="siblings" aria-label="같은 검색어의 다른 후보">
            <span className="muted small">다른 후보:</span>
            {others.map((c) => <button key={c.entry.n} className="chip" onClick={() => p.onApi(c.entry.n)}>{c.entry.n}</button>)}
          </div>
        )}
      </header>
      {koError && <div className="notice warn" role="alert">한국어 설명 자료를 <b>불러오지 못했습니다</b>({koError}). 이 화면의 “한국어 설명 준비 안 됨” 표시는 자료가 없어서가 아니라 조회 실패 때문일 수 있습니다. <button className="btn small" onClick={() => setAttempt((a) => a + 1)}>다시 시도</button></div>}
      {chainErrors.length > 0 && <div className="notice warn" role="alert">상속 부모 자료 일부를 불러오지 못해 상속 항목이 불완전할 수 있습니다: {chainErrors.join('; ')}</div>}

      <div className="tabs" role="tablist" aria-label="API 정보 종류">
        <TabBtn id="overview" cur={tab} onClick={goTab}>개요·구조</TabBtn>
        {hasCtor && <TabBtn id="ctor" cur={tab} onClick={goTab}>생성자 <small><span className="en">Constructor</span></small></TabBtn>}
        {MEMBER_SPECS.map((k) => {
          const c = counts(k);
          return <TabBtn key={k.id} id={k.id} cur={tab} onClick={goTab}>{k.label} <small><span className="en">{k.en} · </span>{c.own}{c.merged > c.own ? `+${c.merged - c.own}` : ''}</small></TabBtn>;
        })}
        <TabBtn id="inheritance" cur={tab} onClick={goTab}>상속</TabBtn>
        <TabBtn id="usage" cur={tab} onClick={goTab}>사용 조건·흐름</TabBtn>
        <TabBtn id="examples" cur={tab} onClick={goTab}>예제</TabBtn>
        <TabBtn id="versions" cur={tab} onClick={goTab}>버전·deprecated</TabBtn>
      </div>

      <div className="tab-body" role="tabpanel">
        {tab === 'overview' && <Overview chain={chain} ko={ko} koStatus={koStatus} p={p} goTab={goTab} />}
        {tab === 'ctor' && <Constructor doc={doc} p={p} goTab={goTab} />}
        {MEMBER_SPECS.filter((k) => k.id === tab).map((k) => (
          <MemberTab key={k.id} spec={k} chain={chain} ko={ko} route={route} setRoute={setRoute} onApi={p.onApi} known={p.known} g={p.g} minor={p.vd.meta.minor} onVersion={p.onVersion} docBase={p.vd.meta.docBase} onRef={onRef} />
        ))}
        {tab === 'inheritance' && <Inheritance chain={chain} p={p} />}
        {tab === 'usage' && <Usage ko={ko} />}
        {tab === 'examples' && <Examples ko={ko} minor={p.vd.meta.minor} />}
        {tab === 'versions' && <Versions chain={chain} ko={ko} koStatus={koStatus} p={p} />}
      </div>
    </div>
  );
}

function TabBtn({ id, cur, onClick, children }: { id: string; cur: string; onClick: (t: string) => void; children: React.ReactNode }) {
  return <button role="tab" aria-selected={cur === id} className={`tab ${cur === id ? 'on' : ''}`} onClick={() => onClick(id)}>{children}</button>;
}
