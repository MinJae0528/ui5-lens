import { useMemo, useState } from 'react';
import { useMemberRows } from '../controller/useMemberRows';
import { descendants } from '../domain/hierarchy';
import { KIND_CHAR_OF } from '../domain/memberIndex';
import { memberKey, mergeMembers, MEMBER_SPECS, signature, type Item } from '../domain/members';
import { defineSnippet } from '../domain/snippets';
import type { ApiDoc, KoDoc, MemberKind, Meth, Prop, Aggr, Assoc } from '../types';
import { Code, CopyButton, DepBadge } from '../ui';
import { MemberGlance, MemberLifeView } from './Life';
import { MemberDescription, MemberUsage } from './MemberTab';
import type { DetailProps } from './props';

const TABS = [
  { id: 'mdesc', label: '설명' },
  { id: 'musage', label: '사용법·예제' },
  { id: 'mver', label: '버전' },
  { id: 'mclasses', label: '쓸 수 있는 클래스' },
] as const;
const SECTION: Record<MemberKind, string> = { method: 'methods', property: 'controlProperties', event: 'events', aggregation: 'aggregations', association: 'associations' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** 한 메서드(또는 속성·이벤트·구성 요소·참조)의 상세 페이지. ui5.sap.com 처럼 탭으로 설명·사용법·버전·쓸 수 있는 클래스를 오간다. */
export function MemberPage({ p, chain, ko, kind, name, back }: { p: DetailProps; chain: ApiDoc[]; ko: KoDoc | null; kind: MemberKind; name: string; back: React.ReactNode }) {
  const { route, setRoute, vd, g } = p;
  const doc = chain[0];
  const spec = MEMBER_SPECS.find((s) => s.id === kind)!;
  const items = useMemo(() => mergeMembers(chain, spec.plural), [chain, spec.plural]);
  const it = items.find((i) => i.m.name === name);
  const tab = TABS.some((t) => t.id === route.tab) ? route.tab : 'mdesc';
  const goClass = () => setRoute({ mem: '', tab: spec.id, mq: name }, true);
  const goTab = (t: string) => setRoute({ tab: t }, true);
  const openMem = (k: MemberKind, n: string) => setRoute({ mem: `${k}:${n}`, tab: 'mdesc' }, true);
  const onRef = (api: string, member: string | null) => (member ? setRoute({ api, mem: '', tab: 'method', mq: member }, true) : p.onApi(api));

  if (!it) {
    return (
      <div className="detail"><div className="detail-bar">{back}</div>
        <div className="notice warn" role="alert">
          <h3><span className="mono">{doc.name}</span> 에는 UI5 {vd.meta.version} 공식 자료에 {spec.label} <span className="mono">{name}</span> 이(가) 없습니다.</h3>
          <p>이 버전에서 사용할 수 없거나(아직 도입 전 / 제거됨) 이름이 다를 수 있습니다. 어느 쪽인지는 추측하지 않습니다. 다른 버전에서는 있는지 아래에서 확인하세요.</p>
          <div className="row"><button className="btn" onClick={() => setRoute({ mem: '', tab: spec.id, mq: name }, true)}>{doc.name} 의 {spec.label} 목록 보기</button>
            <button className="btn" onClick={() => setRoute({ m: 'name', q: name, api: null, mem: '' }, true)}>“{name}” 이름으로 다시 검색</button></div>
        </div>
      </div>
    );
  }

  const m = it.m;
  const koText = it.inherited ? undefined : ko?.members[`${kind}:${name}`]?.text;
  const officialUrl = `${vd.meta.docBase}/#/api/${encodeURIComponent(it.definedIn)}%23${SECTION[kind]}/${encodeURIComponent(name)}`;
  const sh = { onApi: p.onApi, known: p.known, docBase: vd.meta.docBase, onRef };

  // 관련 항목: 속성/구성 요소/참조 → 접근자, 이벤트 → attach/detach/fire, 접근자 → 대상 속성
  const methodNames = new Set(mergeMembers(chain, 'methods').map((x) => x.m.name));
  let related: { kind: MemberKind; name: string; note: string }[] = [];
  if (kind === 'property' || kind === 'aggregation' || kind === 'association') related = (m as Prop | Aggr | Assoc).methods.filter((n) => methodNames.has(n)).map((n) => ({ kind: 'method', name: n, note: '접근자' }));
  if (kind === 'event') related = ['attach', 'detach', 'fire'].map((v) => v + cap(name)).filter((n) => methodNames.has(n)).map((n) => ({ kind: 'method' as const, name: n, note: n.startsWith('attach') ? '핸들러 연결' : n.startsWith('detach') ? '핸들러 해제' : '발생시키기' }));
  const acc = kind === 'method' ? (m as Meth).accessorOf : null;
  if (acc && (acc.kind === 'property' || acc.kind === 'aggregation' || acc.kind === 'association' || acc.kind === 'event')) related = [{ kind: acc.kind as MemberKind, name: acc.name, note: `이 메서드가 다루는 ${spec.id === 'method' ? '대상' : ''}` }];

  return (
    <div className="detail member-page">
      <div className="detail-bar">{back}</div>
      <header className="detail-head">
        <div className="crumb" aria-label="위치">
          <button className="link mono" onClick={() => setRoute({ mem: '', tab: 'overview', mq: '' }, true)}>{doc.name}</button>
          <span aria-hidden="true"> › </span>
          <button className="link" onClick={goClass}>{spec.label}</button>
          <span aria-hidden="true"> › </span><b>{name}</b>
        </div>
        <h2 className="api-name">{name}<span className="sig">{signature(kind, m)}</span></h2>
        <div className="badges">
          <span className="badge b-sel">UI5 {vd.meta.version}</span>
          <span className="badge b-kind">{spec.label}</span>
          {kind === 'method' && (m as Meth).static && <span className="badge">static</span>}
          {acc && <span className="badge">자동 생성 접근자</span>}
          {it.inherited ? <span className="badge b-inh">상속 · {it.definedIn}</span> : <span className="badge b-own">직접 선언</span>}
          <DepBadge since={m.deprecated ? m.deprecated.since ?? true : null} />
          {m.experimental && <span className="badge b-warn">experimental</span>}
          <CopyButton text={name} label="이름 복사" />
          <a className="btn small" href={officialUrl} target="_blank" rel="noreferrer noopener">공식 원문 ↗</a>
        </div>
        <MemberGlance symbol={it.definedIn} memberKey={memberKey(kind, name)} since={m.since} g={g} current={vd.meta.minor} onVersion={p.onVersion} onMore={() => goTab('mver')} />
      </header>

      <div className="tabs" role="tablist" aria-label="항목 정보 종류">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => goTab(t.id)}>{t.label}</button>)}
      </div>

      <div className="tab-body" role="tabpanel">
        {tab === 'mdesc' && (
          <div className="stack">
            <MemberDescription kind={kind} it={it} koText={koText} {...sh} />
            {related.length > 0 && (
              <section><h3>관련 항목</h3>
                <ul className="plain">{related.map((r) => <li key={r.kind + r.name}><span className="badge">{r.note}</span> <button className="link mono" onClick={() => openMem(r.kind, r.name)}>{r.name}</button></li>)}</ul></section>
            )}
          </div>
        )}
        {tab === 'musage' && <Usage kind={kind} it={it} doc={doc} p={p} />}
        {tab === 'mver' && (
          <div className="stack">
            <MemberLifeView symbol={it.definedIn} memberKey={memberKey(kind, name)} since={m.since} g={g} minor={vd.meta.minor} onVersion={p.onVersion} />
            <p className="muted small">선언한 클래스({it.definedIn})의 공식 api.json 을 받아 둔 버전마다 비교한 결과입니다. 서버에 없는 마이너 버전은 비교하지 못해 “사이에”로 표기합니다.</p>
          </div>
        )}
        {tab === 'mclasses' && <Classes p={p} it={it} kind={kind} name={name} onOpen={(cls) => setRoute({ api: cls, mem: `${kind}:${name}`, tab: 'mclasses' }, true)} />}
      </div>
    </div>
  );
}

function Usage({ kind, it, doc, p }: { kind: MemberKind; it: Item; doc: ApiDoc; p: DetailProps }) {
  const def = defineSnippet(doc);
  return (
    <div className="stack">
      <MemberUsage kind={kind} it={it} doc={doc} />
      {def && <section><h3>{doc.basename} 불러오는 법</h3><Code code={def} label="sap.ui.define (공식 모듈 경로로 자동 생성 · 실행 검증 안 함)" /></section>}
      <p className="muted small">공식 api.json 에 이 항목의 예제가 없으면 위 코드는 이름·자료형으로 기계가 만든 호출 형태입니다. 실제로 돌려 본 예제가 아니므로 <button className="link" onClick={() => p.setRoute({ mem: '', tab: 'examples' }, true)}>{doc.basename} 의 검증된 예제</button>가 있는지도 확인하세요.</p>
    </div>
  );
}

/** 이 멤버를 쓸 수 있는 클래스: 선언한 클래스 + 상속받는 후손 + 같은 이름을 선언한 다른 클래스 */
function Classes({ p, it, kind, name, onOpen }: { p: DetailProps; it: Item; kind: MemberKind; name: string; onOpen: (cls: string) => void }) {
  const { rows } = useMemberRows(p.vd.meta.minor, true);
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(60);
  const desc = useMemo(() => descendants(p.vd.index, it.definedIn), [p.vd.index, it.definedIn]);
  const same = useMemo(() => (rows ? rows.filter((r) => r.n === name && r.k === KIND_CHAR_OF[kind] && r.c !== it.definedIn).map((r) => r.c) : []), [rows, name, kind, it.definedIn]);
  const f = filter.trim().toLowerCase();
  const list = desc.filter((c) => !f || c.toLowerCase().includes(f));
  return (
    <div className="stack">
      <section><h3>선언한 클래스</h3>
        <p><button className="link mono" onClick={() => onOpen(it.definedIn)}>{it.definedIn}</button> <span className="muted small">— 이 클래스가 {name} 을(를) 직접 선언합니다.</span></p>
      </section>
      <section><h3>상속받아 쓸 수 있는 클래스 ({desc.length})</h3>
        <p className="muted small">{it.definedIn} 을(를) 상속하는 클래스는 같은 이름으로 호출할 수 있습니다(재정의 여부는 확인하지 않았습니다). 이름을 누르면 그 클래스 기준의 상세가 열립니다.</p>
        {desc.length === 0 ? <p className="muted">받아 둔 자료에서 이 클래스를 상속하는 클래스가 없습니다.</p> : <>
          <input type="search" className="inline-search" aria-label="클래스 거르기" placeholder="클래스 이름으로 거르기" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(60); }} />
          <ul className="plain two-col">{list.slice(0, limit).map((c) => <li key={c}><button className="link mono" onClick={() => onOpen(c)}>{c}</button></li>)}</ul>
          {list.length > limit && <button className="btn small" onClick={() => setLimit((n) => n + 200)}>{list.length - limit}개 더 보기</button>}
        </>}
      </section>
      <section><h3>같은 이름을 따로 선언한 다른 클래스 ({same.length})</h3>
        {same.length === 0 ? <p className="muted">{rows ? '없음' : '불러오는 중…'}</p> : <ul className="plain two-col">{same.slice(0, 80).map((c) => <li key={c}><button className="link mono" onClick={() => onOpen(c)}>{c}</button></li>)}</ul>}
        {same.length > 80 && <p className="muted small">상위 80개만 표시했습니다. 전체는 이름·메서드 검색에서 “{name}”을 검색하세요.</p>}
      </section>
    </div>
  );
}
