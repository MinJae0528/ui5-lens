import { useEffect, useMemo, useState } from 'react';
import { loadDetail, loadMemberLife, NotInVersion, type MemberLife, type Global, type VersionData, type Detail as DetailData } from './data';
import type { Candidate } from './search';
import type { Route } from './route';
import { koStatusFor, type ApiDoc, type KoDoc, type KoStatus, type MemberKind, type Meth, type Prop, type Aggr, type Assoc, type Evt } from './types';
import { aggrSnippet, assocSnippet, eventSnippet, methSnippet, propSnippet } from './snippets';
import { Code, CopyButton, DepBadge, Html, KoBadge, Origin, fmtDate, plain } from './ui';
import { buildHarness } from '../shared/harness.mjs';

type Setter = (patch: Partial<Route>, push?: boolean) => void;
interface Props {
  name: string; g: Global; vd: VersionData; known: Set<string>; route: Route; setRoute: Setter; onVersion: (m: string) => void;
  siblings: Candidate[]; onBack: () => void; onApi: (n: string) => void;
}
const MEMBER_TABS: { id: MemberKind; label: string; en: string; plural: 'properties' | 'methods' | 'events' | 'aggregations' | 'associations' }[] = [
  { id: 'property', label: '속성', en: 'Properties', plural: 'properties' },
  { id: 'method', label: '메서드', en: 'Methods', plural: 'methods' },
  { id: 'event', label: '이벤트', en: 'Events', plural: 'events' },
  { id: 'aggregation', label: '구성 요소', en: 'Aggregations', plural: 'aggregations' },
  { id: 'association', label: '참조 관계', en: 'Associations', plural: 'associations' },
];

export function Detail(p: Props) {
  const { name, route, setRoute } = p;
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; msg: string; notInVersion?: boolean } | { status: 'ok'; data: DetailData }>({ status: 'loading' });
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

  const { chain, ko, chainErrors } = state.data;
  const doc = chain[0];
  const koStatus = koStatusFor(ko, p.vd.meta.minor);
  const others = p.siblings.filter((c) => c.entry.n !== name);
  const validTabs = ['overview', ...MEMBER_TABS.map((k) => k.id), 'inheritance', 'usage', 'examples', 'versions'];
  const tab = validTabs.includes(route.tab) ? route.tab : 'overview';
  const goTab = (t: string) => setRoute({ tab: t, mq: '' }, true);

  const counts = (kind: (typeof MEMBER_TABS)[number]) => {
    const own = doc[kind.plural].length;
    const merged = mergeMembers(chain, kind.plural).length;
    return { own, merged };
  };

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
          <a className="btn small" href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">공식 원문 ↗</a>
        </div>
        {others.length > 0 && (
          <div className="siblings" aria-label="같은 검색어의 다른 후보">
            <span className="muted small">다른 후보:</span>
            {others.map((c) => <button key={c.entry.n} className="chip" onClick={() => p.onApi(c.entry.n)}>{c.entry.n}</button>)}
          </div>
        )}
      </header>
      {chainErrors.length > 0 && <div className="notice warn" role="alert">상속 부모 자료 일부를 불러오지 못해 상속 항목이 불완전할 수 있습니다: {chainErrors.join('; ')}</div>}

      <div className="tabs" role="tablist" aria-label="API 정보 종류">
        <TabBtn id="overview" cur={tab} onClick={goTab}>개요·구조</TabBtn>
        {MEMBER_TABS.map((k) => {
          const c = counts(k);
          return <TabBtn key={k.id} id={k.id} cur={tab} onClick={goTab}>{k.label} <small>{k.en} · {c.own}{c.merged > c.own ? `+${c.merged - c.own}` : ''}</small></TabBtn>;
        })}
        <TabBtn id="inheritance" cur={tab} onClick={goTab}>상속</TabBtn>
        <TabBtn id="usage" cur={tab} onClick={goTab}>사용 조건·흐름</TabBtn>
        <TabBtn id="examples" cur={tab} onClick={goTab}>예제</TabBtn>
        <TabBtn id="versions" cur={tab} onClick={goTab}>버전·deprecated</TabBtn>
      </div>

      <div className="tab-body" role="tabpanel">
        {tab === 'overview' && <Overview chain={chain} ko={ko} koStatus={koStatus} p={p} goTab={goTab} />}
        {MEMBER_TABS.filter((k) => k.id === tab).map((k) => (
          <MemberTab key={k.id} spec={k} chain={chain} ko={ko} route={route} setRoute={setRoute} onApi={p.onApi} known={p.known} g={p.g} minor={p.vd.meta.minor} onVersion={p.onVersion} />
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

/* ---------- 상속 병합 ---------- */
interface Item<T> { m: T; definedIn: string; inherited: boolean }
type Plural = (typeof MEMBER_TABS)[number]['plural'];
function mergeMembers(chain: ApiDoc[], plural: Plural): Item<Prop | Meth | Evt | Aggr | Assoc>[] {
  const seen = new Set<string>();
  const out: Item<Prop | Meth | Evt | Aggr | Assoc>[] = [];
  chain.forEach((d, i) => {
    for (const m of d[plural] as (Prop | Meth | Evt | Aggr | Assoc)[]) {
      if (seen.has(m.name)) continue; // 하위 클래스가 다시 정의한 항목이 우선
      seen.add(m.name);
      out.push({ m, definedIn: d.name, inherited: i > 0 });
    }
  });
  return out;
}

/* ---------- 개요 ---------- */
function Overview({ chain, ko, koStatus, p, goTab }: { chain: ApiDoc[]; ko: KoDoc | null; koStatus: KoStatus; p: Props; goTab: (t: string) => void }) {
  const doc = chain[0];
  const { known, onApi } = p;
  const firstP = doc.description.split(/\n\s*\n/)[0];
  return (
    <div className="stack">
      <section>
        <h3>한 줄 설명</h3>
        {ko ? (
          <>
            <p className="lead">{ko.overview.summary}</p>
            <p className="muted small">근거: {ko.overview.summaryBasis ?? '공식 설명'}</p>
            <ProvenanceNote ko={ko} status={koStatus} minor={p.vd.meta.minor} version={p.vd.meta.version} />
          </>
        ) : <div className="notice">한국어 설명이 아직 준비되지 않았습니다. 아래 영문 원문(공식)을 표시합니다.</div>}
        <details open={!ko}><summary>영문 원문 (공식 · {doc.name})</summary><Html html={firstP || '(공식 설명 없음)'} onApi={onApi} known={known} /></details>
      </section>

      {ko && ko.overview.whenToUse.length > 0 && (
        <section><h3>언제 사용하나요</h3>
          <ul className="tagged">{ko.overview.whenToUse.map((w, i) => <li key={i}><Origin kind={w.kind} /> {w.text}{w.basis && <div className="muted small">근거: {w.basis}</div>}</li>)}</ul>
        </section>
      )}

      {ko && ko.overview.compare.length > 0 && (
        <section><h3>비슷한 컴포넌트와 선택 기준</h3>
          {ko.overview.compare.map((c) => (
            <div key={c.api} className="compare">
              <div className="compare-head"><Origin kind={c.kind} /> <button className="link mono" onClick={() => onApi(c.api)}>{c.api}</button> 와 비교</div>
              <p>{c.text}</p><p className="muted small">근거: {c.basis}</p>
            </div>
          ))}
        </section>
      )}
      {!ko && <section><h3>비슷한 컴포넌트와 선택 기준</h3><p className="muted">공식 자료로 확인된 비교 정보가 아직 정리되지 않았습니다. (추측하지 않습니다)</p></section>}

      <section>
        <h3>전체 구조 한눈에</h3>
        <div className="struct">
          {MEMBER_TABS.map((k) => {
            const own = doc[k.plural].length, all = mergeMembers(chain, k.plural).length;
            return (
              <button key={k.id} className="struct-card" onClick={() => goTab(k.id)}>
                <span className="n">{own}</span><span className="l">{k.label}</span><span className="e">{k.en}</span>
                <span className="inh">{all > own ? `상속 포함 ${all}` : '상속 없음'}</span>
              </button>
            );
          })}
        </div>
        <p className="muted small">숫자는 이 클래스가 직접 선언한 항목 수입니다. 부모 클래스에서 물려받은 항목은 각 탭의 “상속 항목 포함”으로 볼 수 있습니다.</p>
        {doc.kind === 'enum' && doc.enumValues.length > 0 && (
          <div><h4>열거 값</h4><ul className="plain">{doc.enumValues.map((v) => <li key={v.name}><code>{v.name}</code> <span className="muted small">{plain(v.description)}</span></li>)}</ul></div>
        )}
        {doc.kind === 'typedef' && doc.typedefProperties.length > 0 && (
          <div><h4>필드</h4><ul className="plain">{doc.typedefProperties.map((v) => <li key={v.name}><code>{v.name}</code>: {v.type} <span className="muted small">{plain(v.description ?? '')}</span></li>)}</ul></div>
        )}
      </section>

      <section>
        <h3>기본 정보</h3>
        <dl className="kv">
          <dt>정식 이름</dt><dd className="mono">{doc.name}</dd>
          <dt>라이브러리 · 종류</dt><dd>{doc.library} · {doc.kind}</dd>
          <dt>대상 UI5 버전</dt><dd>{p.vd.meta.version}</dd>
          <dt>도입 버전</dt><dd>{doc.since ?? '공식 자료에 표시 없음 (미확인)'}</dd>
          <dt>부모 클래스</dt><dd>{doc.extends ? <button className="link mono" onClick={() => onApi(doc.extends!)}>{doc.extends}</button> : '없음'}</dd>
          <dt>공식 원문</dt><dd><a href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">{doc.sourceUrl} ↗</a></dd>
        </dl>
        {ko && ko.overview.related.length > 0 && (
          <><h4>관련 API</h4><ul className="plain">{ko.overview.related.map((r) => <li key={r.api}>{known.has(r.api) ? <button className="link mono" onClick={() => onApi(r.api)}>{r.api}</button> : <code>{r.api}</code>} — {r.role}</li>)}</ul></>
        )}
      </section>
    </div>
  );
}

function ProvenanceNote({ ko, status, minor, version }: { ko: KoDoc; status: KoStatus; minor: string; version: string }) {
  const stale = status === 'stale';
  return (
    <div className={`notice ${stale ? 'warn' : ''}`}>
      {stale
        ? <>⚠ 이 한국어 설명은 UI5 <b>{ko.baseMinor}</b> 원문을 기준으로 작성·대조했는데, 지금 보는 <b>{version}</b> 의 공식 원문과 <b>달라서 재검토가 필요</b>합니다. 한국어 문장이 이 버전과 맞지 않을 수 있으니 영문 원문과 공식 항목 목록을 기준으로 보세요. {minor === ko.baseMinor ? '(같은 버전인데 원문이 갱신됨)' : ''}</>
        : <>이 API 의 한국어 설명은 <b>{ko.provenance.generator}</b> 입니다 · 검토 상태: <b>{ko.provenance.review === 'reviewed' ? '검토 완료' : '미검토(초안)'}</b> · 공식 원문 대조: {ko.basedOn.stampedAt ?? ko.provenance.checkedAt} (UI5 {ko.baseMinor})</>}
    </div>
  );
}

/* ---------- 속성/메서드/이벤트/구성/참조 ---------- */
function MemberTab({ spec, chain, ko, route, setRoute, onApi, known, g, minor, onVersion }: { g: Global; minor: string; onVersion: (m: string) => void; spec: (typeof MEMBER_TABS)[number]; chain: ApiDoc[]; ko: KoDoc | null; route: Route; setRoute: Setter; onApi: (n: string) => void; known: Set<string> }) {
  const doc = chain[0];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [hideAcc, setHideAcc] = useState(true);
  const [hideDep, setHideDep] = useState(false);
  const inh = route.inh, mq = route.mq.trim().toLowerCase();
  const all = useMemo(() => mergeMembers(chain, spec.plural), [chain, spec.plural]);
  const own = all.filter((a) => !a.inherited);
  const base = inh ? all : own;
  const accCount = spec.id === 'method' ? base.filter((a) => (a.m as Meth).accessorOf).length : 0;

  const koText = (it: Item<{ name: string }>) => (it.inherited ? undefined : ko?.members[`${spec.id}:${it.m.name}`]?.text);
  const rows = base.filter((it) => {
    if (spec.id === 'method' && hideAcc && !mq && (it.m as Meth).accessorOf) return false; // 검색 중에는 접근자도 찾을 수 있게
    if (hideDep && it.m.deprecated) return false;
    if (!mq) return true;
    return (it.m.name + ' ' + (koText(it) ?? '') + ' ' + plain(it.m.description)).toLowerCase().includes(mq);
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input aria-label={`${spec.label} 안에서 검색`} type="search" className="inline-search" placeholder={`${spec.label} 이름·설명 검색 (한국어/영어)`} value={route.mq} onChange={(e) => setRoute({ mq: e.target.value })} />
        <label className="check"><input type="checkbox" checked={inh} onChange={(e) => setRoute({ inh: e.target.checked })} /> 상속 항목 포함 <small>(+{all.length - own.length})</small></label>
        {spec.id === 'method' && <label className="check"><input type="checkbox" checked={hideAcc} onChange={(e) => setHideAcc(e.target.checked)} /> 자동 생성 접근자 숨기기 <small>({accCount})</small></label>}
        <label className="check"><input type="checkbox" checked={hideDep} onChange={(e) => setHideDep(e.target.checked)} /> deprecated 숨기기</label>
        <span className="muted small">{rows.length} / {base.length}개</span>
        <button className="btn small" onClick={() => setOpen(open.size ? new Set() : new Set(rows.slice(0, 50).map((r) => r.definedIn + r.m.name)))}>{open.size ? '모두 접기' : '모두 펼치기(50개까지)'}</button>
      </div>
      {base.length === 0 && <div className="notice">이 클래스가 직접 선언한 {spec.label} 이(가) 없습니다.{all.length > 0 && !inh ? ' “상속 항목 포함”을 켜면 부모 클래스에서 물려받은 항목이 보입니다.' : ''}</div>}
      {base.length > 0 && rows.length === 0 && <div className="notice">조건에 맞는 항목이 없습니다.</div>}
      <ul className="members">
        {rows.map((it) => {
          const key = it.definedIn + it.m.name;
          const isOpen = open.has(key);
          const k = koText(it);
          return (
            <li key={key} className={`member ${isOpen ? 'open' : ''}`}>
              <button className="member-head" aria-expanded={isOpen} onClick={() => { const n = new Set(open); isOpen ? n.delete(key) : n.add(key); setOpen(n); }}>
                <span className="m-name">{spec.id === 'method' && (it.m as Meth).static ? <small>static </small> : null}{it.m.name}</span>
                <span className="m-sig">{signature(spec.id, it.m)}</span>
                <span className="m-badges">
                  {it.inherited ? <span className="badge b-inh" title="부모 클래스에서 물려받음">상속 · {it.definedIn}</span> : <span className="badge b-own">직접 선언</span>}
                  <DepBadge since={it.m.deprecated ? it.m.deprecated.since ?? true : null} />
                  {it.m.since && <span className="badge">since {it.m.since}</span>}
                </span>
                <span className="m-sum">{k ?? (it.inherited ? <span className="muted">정의: {it.definedIn} · 영문 원문</span> : <span className="muted">{plain(it.m.description).slice(0, 110) || '(공식 설명 없음)'}</span>)}</span>
              </button>
              {isOpen && <MemberBody kind={spec.id} it={it} doc={doc} koText={k} onApi={onApi} known={known} g={g} minor={minor} onVersion={onVersion} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function signature(kind: MemberKind, m: Prop | Meth | Evt | Aggr | Assoc): string {
  if (kind === 'property') { const p = m as Prop; return `: ${p.type}${p.defaultValue != null ? ` = ${JSON.stringify(p.defaultValue)}` : ''}`; }
  if (kind === 'aggregation' || kind === 'association') { const a = m as Aggr; return `: ${a.type} [${a.cardinality}]`; }
  if (kind === 'event') return `(${(m as Evt).parameters.map((p) => p.name).join(', ')})`;
  const me = m as Meth;
  return `(${me.parameters.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})${me.returnValue ? ` → ${me.returnValue.type}` : ''}`;
}

function MemberBody({ kind, it, doc, koText, onApi, known, g, minor, onVersion }: { g: Global; minor: string; onVersion: (m: string) => void; kind: MemberKind; it: Item<Prop | Meth | Evt | Aggr | Assoc>; doc: ApiDoc; koText?: string; onApi: (n: string) => void; known: Set<string> }) {
  const m = it.m;
  let snippet = '';
  if (kind === 'property') snippet = propSnippet(doc, m as Prop);
  if (kind === 'aggregation') snippet = aggrSnippet(doc, m as Aggr);
  if (kind === 'association') snippet = assocSnippet(doc, m as Assoc);
  if (kind === 'event') snippet = eventSnippet(doc, m as Evt);
  if (kind === 'method') snippet = methSnippet(doc, m as Meth);
  return (
    <div className="member-body">
      <div className="two">
        <div>
          <h5>한국어</h5>
          {koText ? <p>{koText}</p> : <p className="muted">한국어 설명이 아직 준비되지 않았습니다.</p>}
          {koText && <p className="muted small">AI 번역 초안 · 미검토 (공식 영문 원문과 대조해 작성)</p>}
        </div>
        <div>
          <h5>영문 원문 (공식)</h5>
          <Html html={m.description || '(공식 설명 없음)'} onApi={onApi} known={known} />
        </div>
      </div>
      <dl className="kv">
        <dt>정의된 곳</dt><dd className="mono">{it.definedIn}{it.inherited ? ' (상속)' : ' (직접 선언)'}</dd>
        {kind === 'property' && <>
          <dt>자료형</dt><dd className="mono">{(m as Prop).type}</dd>
          <dt>기본값</dt><dd className="mono">{(m as Prop).defaultValue != null ? JSON.stringify((m as Prop).defaultValue) : '공식 자료에 지정 없음'}</dd>
          {(m as Prop).group && <><dt>그룹</dt><dd>{(m as Prop).group}</dd></>}
          <dt>접근자</dt><dd className="mono">{(m as Prop).methods.join(', ') || '—'}</dd>
        </>}
        {(kind === 'aggregation' || kind === 'association') && <>
          <dt>허용 타입</dt><dd className="mono">{(m as Aggr).type}</dd>
          <dt>개수</dt><dd>{(m as Aggr).cardinality} ({(m as Aggr).cardinality.endsWith('n') ? '여러 개 허용' : '최대 1개'})</dd>
          {kind === 'aggregation' && (m as Aggr).isDefault && <><dt>기본 집합</dt><dd>예 (XML 뷰에서 태그 이름 없이 자식을 넣으면 여기에 들어감)</dd></>}
          <dt>관련 메서드</dt><dd className="mono">{(m as Aggr).methods.join(', ') || '—'}</dd>
        </>}
        {kind === 'event' && <dt>기본 동작 취소</dt>}
        {kind === 'event' && <dd>{(m as Evt).allowPreventDefault ? 'preventDefault() 로 취소 가능' : '불가/미표시'}</dd>}
        {kind === 'method' && <>
          <dt>구분</dt><dd>{(m as Meth).static ? '정적(static) 메서드' : '인스턴스 메서드'}{(m as Meth).accessorOf ? ` · ${(m as Meth).accessorOf!.kind} “${(m as Meth).accessorOf!.name}” 의 자동 생성 접근자` : ''}</dd>
          {(m as Meth).returnValue && <><dt>반환값</dt><dd><span className="mono">{(m as Meth).returnValue!.type}</span> <Html html={(m as Meth).returnValue!.description} onApi={onApi} known={known} /></dd></>}
        </>}
      </dl>
      {kind === 'event' && (m as Evt).parameters.length > 0 && <ParamTable title="전달되는 정보 (event parameters · oEvent.getParameter)" params={(m as Evt).parameters} onApi={onApi} known={known} />}
      {kind === 'method' && (m as Meth).parameters.length > 0 && <ParamTable title="인자" params={(m as Meth).parameters} onApi={onApi} known={known} />}
      {m.deprecated && (
        <div className="notice warn"><b>deprecated{m.deprecated.since ? ` (${m.deprecated.since})` : ''}</b> — 공식 안내 원문:
          <Html html={m.deprecated.text || '(안내 문구 없음)'} onApi={onApi} known={known} />
          <span className="muted small">대체 방법은 상황에 따라 다를 수 있어 원문 그대로 표시합니다.</span></div>
      )}
      <MemberLifeView symbol={it.definedIn} memberKey={KEYCHAR[kind] + ':' + m.name} since={m.since} g={g} minor={minor} onVersion={onVersion} />
      <Code code={snippet} label={kind === 'method' ? '호출 형태 (공식 메타데이터로 자동 생성 · 실행 검증 안 함)' : '사용 형태 (공식 메타데이터로 자동 생성 · 실행 검증 안 함)'} />
    </div>
  );
}

const KEYCHAR: Record<MemberKind, string> = { property: 'p', aggregation: 'a', association: 's', event: 'e', method: 'm' };

function summarize(row: string, g: Global) {
  const order = g.availability.versions;
  const cells = order.map((m, i) => ({ m, st: row[i] ?? '0', info: g.versions.versions.find((v) => v.minor === m) })).filter((c) => c.info);
  const present = cells.filter((c) => c.st !== '0');
  const firstDep = [...cells].reverse().find((c) => c.st === '2');
  return { cells, present, firstDep, oldest: present[present.length - 1], newest: present[0], latest: cells[0] };
}
/** 한 줄 판정 + 버전 칸. 멤버를 선언한 심볼(definedIn)의 공식 api.json 을 버전마다 비교한 결과. */
function MemberLifeView({ symbol, memberKey, since, g, minor, onVersion }: { symbol: string; memberKey: string; since: string | null; g: Global; minor: string; onVersion: (m: string) => void }) {
  const [life, setLife] = useState<MemberLife | null | 'err' | undefined>(undefined);
  useEffect(() => { setLife(undefined); loadMemberLife(symbol).then(setLife).catch(() => setLife('err')); }, [symbol]);
  if (life === undefined) return <p className="muted small">버전별 사용 가능 여부 불러오는 중…</p>;
  if (life === 'err') return <p className="muted small">버전별 비교 자료를 불러오지 못했습니다.</p>;
  const row = life?.[memberKey];
  if (!row) return <p className="muted small">이 항목의 버전별 비교 자료가 없습니다(미확인).</p>;
  const { cells, present, firstDep, oldest, newest, latest } = summarize(row, g);
  const cur = cells.find((c) => c.m === minor);
  return (
    <div className="life">
      <h5>버전별 사용 가능 여부 <small className="muted">(공식 api.json 비교 · 받아 둔 {cells.length}개 버전)</small></h5>
      <p>
        {cur && (cur.st === '0' ? <b className="life-no">지금 보는 {cur.info!.version}: 사용 불가(이 버전 자료에 없음). </b>
          : cur.st === '2' ? <b className="life-dep">지금 보는 {cur.info!.version}: 존재하지만 deprecated 표시. </b>
          : <b className="life-ok">지금 보는 {cur.info!.version}: 사용 가능. </b>)}
        {present.length > 0 && <>받아 둔 버전 중 가장 오래된 존재 <b>{oldest.info!.version}</b>{oldest.m === cells[cells.length - 1].m ? ' (받아 둔 가장 오래된 버전부터 있음)' : ' (그보다 오래된 받아 둔 버전에는 없음)'}, 가장 최신 존재 <b>{newest.info!.version}</b>.</>}
        {firstDep && <> <b>{firstDep.info!.version}</b> 에서 처음 deprecated 표시.</>}
        {present.length > 0 && latest.st === '0' && <> 최신 {latest.info!.version} 에는 <b>없음</b>(사유는 자료에 없음).</>}
        {since && <> 공식 since: <b>{since}</b>.</>}
        {since && oldest && (() => { const n = (x: string) => x.split('.').slice(0, 2).map(Number).reduce((q, w) => q * 1000 + w); return n(oldest.m) < n(since); })() && <span className="muted small"> ⚠ 공식 since 보다 이른 버전({oldest.info!.version})의 자료에도 있어 공식 표기와 실제가 다를 수 있습니다(둘 다 그대로 표시).</span>}
      </p>
      <div className="avail" role="group" aria-label="버전별 사용 가능 여부">
        {[...cells].reverse().map((c) => (
          <button key={c.m} className={`av av-${c.st} ${c.m === minor ? 'cur' : ''}`} onClick={() => onVersion(c.m)}
            title={`${c.info!.version}: ${c.st === '0' ? '없음' : c.st === '2' ? 'deprecated' : '사용 가능'}`}>
            <span className="av-v">{c.m}</span><span className="av-s">{c.st === '0' ? '없음' : c.st === '2' ? 'dep' : 'OK'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 지금 보는 버전에는 없지만 다른 받아 둔 버전에는 있던 멤버(제거됐거나 아직 도입 전). */
function MissingHere({ symbol, g, minor }: { symbol: string; g: Global; minor: string }) {
  const [life, setLife] = useState<MemberLife | null | 'err' | undefined>(undefined);
  useEffect(() => { setLife(undefined); loadMemberLife(symbol).then(setLife).catch(() => setLife('err')); }, [symbol]);
  if (life === undefined) return <p className="muted">불러오는 중…</p>;
  if (life === 'err' || !life) return <p className="muted">버전별 멤버 비교 자료를 불러오지 못했습니다.</p>;
  const order = g.availability.versions;
  const ci = order.indexOf(minor);
  const names: Record<string, string> = { p: '속성', a: '구성 요소', s: '참조', e: '이벤트', m: '메서드' };
  const rows = Object.entries(life).filter(([, r]) => r[ci] === '0' && /[12]/.test(r)).map(([k, r]) => {
    const vs = order.filter((_, i) => r[i] !== '0');
    return { k, kind: names[k[0]], name: k.slice(2), newest: vs[0], oldest: vs[vs.length - 1], n: vs.length };
  }).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  if (rows.length === 0) return <p className="muted">받아 둔 다른 버전에만 있는 항목이 없습니다.</p>;
  return (
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>종류</th><th>이름</th><th>존재하는 버전(받아 둔 것 중)</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.k}><td>{r.kind}</td><td className="mono">{r.name}</td><td>{r.n}개 버전 · {r.oldest} ~ {r.newest}{ci > order.indexOf(r.newest) ? ' (이후 사라짐)' : ci < order.indexOf(r.oldest) ? ' (이 버전보다 이전에 있었음)' : ' (중간 버전에서만)'}</td></tr>)}</tbody></table></div>
  );
}

function ParamTable({ title, params, onApi, known }: { title: string; params: { name: string; type?: string; optional?: boolean; description?: string }[]; onApi: (n: string) => void; known: Set<string> }) {
  return (
    <div className="tbl-wrap"><h5>{title}</h5>
      <table className="tbl"><thead><tr><th>이름</th><th>자료형</th><th>필수</th><th>설명 (공식 영문)</th></tr></thead>
        <tbody>{params.map((q) => <tr key={q.name}><td className="mono">{q.name}</td><td className="mono">{q.type ?? '—'}</td><td>{q.optional ? '선택' : '필수'}</td><td><Html html={q.description ?? ''} onApi={onApi} known={known} /></td></tr>)}</tbody></table>
    </div>
  );
}

/* ---------- 상속 ---------- */
function Inheritance({ chain, p }: { chain: ApiDoc[]; p: Props }) {
  return (
    <div className="stack">
      <section><h3>상속 구조</h3>
        <ol className="chain">
          {chain.map((d, i) => (
            <li key={d.name} className={i === 0 ? 'self' : ''}>
              {i === 0 ? <b className="mono">{d.name}</b> : p.known.has(d.name) ? <button className="link mono" onClick={() => p.onApi(d.name)}>{d.name}</button> : <span className="mono">{d.name}</span>}
              <span className="muted small"> {i === 0 ? '← 현재 선택 (직접 선언)' : '부모'} · 속성 {d.properties.length} · 메서드 {d.methods.length} · 이벤트 {d.events.length} · 구성 {d.aggregations.length} · 참조 {d.associations.length}</span>
            </li>
          ))}
        </ol>
        {chain[chain.length - 1].extends && <p className="muted small">체인 끝 클래스의 부모({chain[chain.length - 1].extends})는 조회하지 못했습니다.</p>}
      </section>
      <section><h3>직접 선언 vs 상속</h3>
        <table className="tbl"><thead><tr><th>종류</th><th>직접 선언</th><th>상속(중복 제외)</th></tr></thead>
          <tbody>{MEMBER_TABS.map((k) => { const all = mergeMembers(chain, k.plural); const own = all.filter((a) => !a.inherited).length; return <tr key={k.id}><td>{k.label} <small className="muted">{k.en}</small></td><td>{own}</td><td>{all.length - own}</td></tr>; })}</tbody></table>
        <p className="muted small">같은 이름을 하위 클래스가 다시 정의한 항목은 하위 클래스 쪽만 셉니다. 각 탭의 “상속 항목 포함”을 켜면 항목마다 정의된 클래스가 표시됩니다.</p>
      </section>
    </div>
  );
}

/* ---------- 사용 조건과 흐름 ---------- */
function Usage({ ko }: { ko: KoDoc | null }) {
  if (!ko) return <div className="notice">이 API 는 사용 조건·흐름 정리가 아직 없습니다. 모든 API 에 고정된 선행 체인이 있다고 가정하지 않으며, 공식 설명의 Note/must 문장은 “개요·구조” 탭의 영문 원문에서 확인하세요.</div>;
  const u = ko.usage;
  return (
    <div className="stack">
      <div className="notice">세 가지를 구분해서 보여 줍니다: <b>필수 선행 조건</b>(공식 문서 명시) · <b>대표 예제의 순서</b>(서비스에서 작성, 하나의 예) · <b>권장 사용 방식</b>. 항목마다 공식 명시 / 서비스 작성 여부를 표시합니다.</div>
      <section><h3>① 필수 선행 조건</h3>
        {u.prerequisites.length ? <ul className="tagged">{u.prerequisites.map((x, i) => <li key={i}><Origin kind={x.kind} /> {x.text}{x.basis && <div className="muted small">근거: {x.basis}</div>}</li>)}</ul> : <p className="muted">공식 자료로 확인된 필수 조건이 없습니다.</p>}
      </section>
      <section><h3>② 대표 예제의 순서 <small className="muted">(필수 체인이 아닙니다)</small></h3>
        <ol className="flow">{u.exampleFlow.map((x) => <li key={x.step}><Origin kind={x.kind} /> {x.text}</li>)}</ol>
      </section>
      <section><h3>③ 권장 사용 방식</h3>
        <ul className="tagged">{u.recommended.map((x, i) => <li key={i}><Origin kind={x.kind} /> {x.text}{x.basis && <div className="muted small">근거: {x.basis}</div>}</li>)}</ul>
      </section>
    </div>
  );
}

/* ---------- 예제 ---------- */
function Examples({ ko, minor }: { ko: KoDoc | null; minor: string }) {
  const [run, setRun] = useState<string | null>(null);
  if (!ko || !ko.examples?.length) return <div className="notice">이 API 의 검증된 예제가 아직 없습니다. “속성/메서드/이벤트” 탭에는 공식 메타데이터로 자동 생성한 호출 형태가 있지만, 실행 검증을 거치지 않았습니다.</div>;
  return (
    <div className="stack">
      {ko.examples.map((ex) => {
        const v = ex.verification;
        return (
          <article key={ex.id} className="example">
            <h3>{ex.title}</h3>
            <div className="badges">
              <span className="badge b-svc">서비스 작성{ex.ai ? ' · AI 초안' : ''}</span>
              {v.status === 'passed' && <span className="badge b-ok" title={v.check}>✓ UI5 {v.actualVersion} 에서 실행 확인 · {v.ranAt ? fmtDate(v.ranAt) : ''}</span>}
              {v.status === 'passed' && !String(v.actualVersion ?? '').startsWith(minor + '.') && <span className="badge b-warn">지금 보는 {minor} 에서는 미검증</span>}
              {v.status === 'failed' && <span className="badge b-warn" title={v.detail}>✗ 검증 실패</span>}
              {v.status === 'unverified' && <span className="badge b-warn">미검증 예제</span>}
            </div>
            <p>{ex.description}</p>
            {v.status === 'passed' && <p className="muted small">검증 방법: 실제 UI5 {v.actualVersion} 을 브라우저(Edge)에 로드해 예제를 실행했고, 오류 없이 {v.check} 가 렌더링됨을 확인했습니다. (화면 렌더링 확인이며 사용자 조작 시나리오까지 검증한 것은 아닙니다.)</p>}
            <Code code={ex.code} label="JavaScript (sap.ui.require)" />
            <div className="row">
              <button className="btn" onClick={() => setRun(run === ex.id ? null : ex.id)}>{run === ex.id ? '실행 닫기' : '▶ 실행해 보기 (UI5 CDN 사용, 인터넷 필요)'}</button>
            </div>
            {run === ex.id && <iframe title={`${ex.title} 실행 결과`} className="runframe" sandbox="allow-scripts" srcDoc={buildHarness(ex.code)} />}
          </article>
        );
      })}
    </div>
  );
}

/* ---------- 버전과 deprecated ---------- */
function Versions({ chain, ko, koStatus, p }: { chain: ApiDoc[]; ko: KoDoc | null; koStatus: KoStatus; p: Props }) {
  const { vd, g, known, onApi, onVersion } = p;
  const doc = chain[0];
  const meta = vd.meta;
  const depMembers = (['properties', 'methods', 'events', 'aggregations', 'associations'] as const).flatMap((pl) => (doc[pl] as (Prop | Meth | Evt | Aggr | Assoc)[]).filter((m) => m.deprecated).map((m) => ({ pl, m })));
  return (
    <div className="stack">
      <section><h3>버전별 존재 여부 <small className="muted">(공식 api.json 비교)</small></h3>
        <Availability name={doc.name} g={g} current={meta.minor} onVersion={onVersion} />
      </section>
      <section><h3>지금 버전({meta.version})에는 없지만 다른 버전에 있는 항목 <small className="muted">(이 클래스가 직접 선언한 속성·메서드·이벤트 등)</small></h3>
        <MissingHere symbol={doc.name} g={g} minor={meta.minor} />
        <p className="muted small">“이후 사라짐”은 더 최신 받아 둔 버전에서 빠졌다는 뜻이며 사유(제거/이름 변경)는 자료에 없어 추측하지 않습니다. 서버에 없는 마이너 버전은 비교하지 못했습니다.</p>
      </section>
      <section><h3>이 버전({meta.version})에서의 정보</h3>
        <dl className="kv">
          <dt>도입 버전 (since)</dt><dd>{doc.since ?? '공식 자료에 표시 없음 — 미확인'}</dd>
          <dt>deprecated 여부</dt><dd>{doc.deprecated ? <>예 — {doc.deprecated.since ?? '버전 표시 없음'}</> : '이 버전의 공식 자료에 클래스 수준 deprecated 표시 없음'}</dd>
          <dt>공식 대체 안내</dt><dd>{doc.deprecated ? <Html html={doc.deprecated.text || '(안내 문구 없음 — 미확인)'} onApi={onApi} known={known} /> : '해당 없음'}</dd>
        </dl>
        <p className="muted small">대체 방법이 상황에 따라 다르면 공식 문구를 그대로 보여 주며, 하나의 API 로 단정하지 않습니다.</p>
      </section>
      <section><h3>세 가지 상태는 서로 다릅니다</h3>
        <ul className="tagged">
          <li><span className="badge b-dep">deprecated</span> 공식 자료에 “더 이상 사용하지 말라”고 표시됨. 해당 버전에서는 아직 존재함.</li>
          <li><span className="badge b-warn">제거됨 / 없음</span> 해당 버전 자료에 항목 자체가 없음. 위 “버전별 존재 여부”에서 클래스(심볼) 단위로 확인할 수 있습니다. 속성·메서드 단위의 존재 여부는 아래 “다른 버전에 있는 항목”과, 각 항목을 펼친 곳의 “버전별 사용 가능 여부”에서 확인할 수 있습니다.</li>
          <li><span className="badge">disabled</span> 실행 중 컨트롤의 상태(예: <code>enabled=false</code>)를 뜻하는 UI 개념이며 API 수명 주기와 무관합니다.</li>
        </ul>
      </section>
      <section><h3>이 클래스가 직접 선언한 deprecated 항목 ({depMembers.length})</h3>
        {depMembers.length === 0 ? <p className="muted">없음</p> : (
          <table className="tbl"><thead><tr><th>종류</th><th>이름</th><th>since</th><th>공식 안내 (원문)</th></tr></thead>
            <tbody>{depMembers.map(({ pl, m }) => <tr key={pl + m.name}><td>{pl}</td><td className="mono">{m.name}</td><td>{m.deprecated!.since ?? '—'}</td><td><Html html={m.deprecated!.text} onApi={onApi} known={known} /></td></tr>)}</tbody></table>
        )}
      </section>
      <section><h3>자료 출처와 갱신 상태</h3>
        <dl className="kv">
          <dt>공식 원문 갱신</dt><dd>조회 {fmtDate(meta.fetchedAt)} · 원문 해시 <code>{doc.officialHash}</code> · UI5 {meta.version}</dd>
          <dt>한국어 설명 상태</dt><dd><KoBadge status={koStatus} /></dd>
          {ko && <>
            <dt>한국어 작성 기준 원문</dt><dd>UI5 {ko.baseMinor} · 해시 <code>{ko.basedOn.officialHash}</code> · 대조일 {ko.basedOn.stampedAt ?? ko.provenance.checkedAt} · {ko.provenance.generator}</dd>
            <dt>이 버전과의 일치</dt><dd>{koStatus === 'stale' ? <>⚠ 이 버전({meta.version})의 원문 해시 <code>{ko.hashes[meta.minor] ?? '—'}</code> 가 달라 재검토 필요</> : '일치 (한국어가 이 버전 원문 기준)'}</dd>
          </>}
          <dt>공식 원문 링크</dt><dd><a href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">{doc.sourceUrl} ↗</a></dd>
        </dl>
        <p className="muted small">원문 갱신(공식 자료를 다시 받아 오는 것)과 한국어 갱신(사람이 대조해 확인하는 것)은 별개입니다. 원문 해시가 달라지면 이 화면에 재검토 필요가 표시됩니다.</p>
      </section>
    </div>
  );
}

/** 심볼 × 버전 가용성: 0 없음 / 1 있음 / 2 deprecated. 칸을 누르면 그 버전으로 전환(같은 API 유지). */
function Availability({ name, g, current, onVersion }: { name: string; g: Global; current: string; onVersion: (m: string) => void }) {
  const row = g.availability.symbols[name];
  if (!row) return <p className="muted">버전 비교 자료에 없는 이름입니다.</p>;
  const order = g.availability.versions;
  const infoOf = (m: string) => g.versions.versions.find((v) => v.minor === m);
  const cells = order.map((m, i) => ({ m, st: row[i] ?? '0', info: infoOf(m) })).filter((c) => c.info);
  const present = cells.filter((c) => c.st !== '0');
  const oldest = present[present.length - 1], newest = present[0];
  const firstDep = [...cells].reverse().find((c) => c.st === '2');
  return (
    <div>
      <p>{present.length === 0 ? '받아 둔 어떤 버전에도 없습니다.' : <>받아 둔 {cells.length}개 버전 중 <b>{present.length}개</b>에 존재 — 가장 오래된 {oldest.info!.version}, 가장 최신 {newest.info!.version}.{firstDep ? <> <b>{firstDep.info!.version}</b> 에서 처음 deprecated 로 표시됨.</> : null}</>}</p>
      <div className="avail" role="group" aria-label="버전별 존재 여부">
        {[...cells].reverse().map((c) => (
          <button key={c.m} className={`av av-${c.st} ${c.m === current ? 'cur' : ''}`} onClick={() => onVersion(c.m)}
            title={`${c.info!.version}${c.info!.lts ? ' LTS' : ''}: ${c.st === '0' ? '없음' : c.st === '2' ? 'deprecated' : '있음'}`}>
            <span className="av-v">{c.m}</span><span className="av-s">{c.st === '0' ? '없음' : c.st === '2' ? 'dep' : '있음'}</span>
          </button>
        ))}
      </div>
      <p className="muted small">초록=있음 · 주황=deprecated 표시 · 회색=없음. 서버에 호스팅되지 않은 마이너 버전(예: 1.78)은 비교 대상이 아닙니다. 칸을 누르면 같은 API 를 그 버전으로 봅니다.</p>
    </div>
  );
}

function NotInThisVersion({ name, p, back }: { name: string; p: Props; back: React.ReactNode }) {
  const row = p.g.availability.symbols[name];
  const order = p.g.availability.versions;
  const where = order.filter((_, i) => row?.[i] && row[i] !== '0');
  return (
    <div className="detail"><div className="detail-bar">{back}</div>
      <div className="notice warn" role="alert">
        <h3><span className="mono">{name}</span> 은(는) UI5 {p.vd.meta.version} 의 공식 자료에 없습니다.</h3>
        <p>{where.length ? <>이 이름이 있는 버전: {where.slice(0, 40).map((m) => p.g.versions.versions.find((v) => v.minor === m)?.version).filter(Boolean).join(', ')}.</> : '받아 둔 어떤 버전에도 없는 이름입니다.'} 이 버전에서는 사용할 수 없거나(아직 도입 전 / 제거됨) 이름이 다를 수 있습니다. 어느 쪽인지는 추측하지 않습니다.</p>
        <div className="row">{where.slice(0, 6).map((m) => <button key={m} className="btn small" onClick={() => p.onVersion(m)}>{m} 로 보기</button>)}</div>
      </div>
    </div>
  );
}
