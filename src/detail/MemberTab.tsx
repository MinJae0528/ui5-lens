import { useMemo, useState } from 'react';
import type { Global } from '../data';
import { aggrSnippet, assocSnippet, eventSnippet, methSnippet, propSnippet } from '../domain/snippets';
import { filterMembers, mergeMembers, memberKey, signature, type AnyMember, type Item, type MemberSpec } from '../domain/members';
import { plain } from '../domain/text';
import type { ApiDoc, Aggr, Assoc, Evt, KoDoc, MemberKind, Meth, Prop } from '../types';
import { Code, DepBadge, Html } from '../ui';
import type { Route } from '../controller/route';
import type { Setter } from './props';
import { MemberLifeView } from './Life';

interface Shared { onApi: (n: string) => void; known: Set<string>; g: Global; minor: string; onVersion: (m: string) => void }

/** 속성/메서드/이벤트/구성 요소/참조 관계 탭. 필터 규칙은 domain/members(filterMembers)에 있고 여기서는 상태와 그리기만 한다. */
export function MemberTab({ spec, chain, ko, route, setRoute, ...sh }: { spec: MemberSpec; chain: ApiDoc[]; ko: KoDoc | null; route: Route; setRoute: Setter } & Shared) {
  const doc = chain[0];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [hideAcc, setHideAcc] = useState(true);
  const [hideDep, setHideDep] = useState(false);
  const inh = route.inh, mq = route.mq.trim().toLowerCase();
  const all = useMemo(() => mergeMembers(chain, spec.plural), [chain, spec.plural]);
  const own = all.filter((a) => !a.inherited);
  const base = inh ? all : own;
  const accCount = spec.id === 'method' ? base.filter((a) => (a.m as Meth).accessorOf).length : 0;

  const koText = (it: Item) => (it.inherited ? undefined : ko?.members[memberKeyKo(spec.id, it.m.name)]?.text);
  const rows = filterMembers(base, { kind: spec.id, mq, hideAccessors: hideAcc, hideDeprecated: hideDep, koText, plain });

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
              {isOpen && <MemberBody kind={spec.id} it={it} doc={doc} koText={k} {...sh} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 한국어 층의 멤버 키는 "종류:이름" (예: property:width). 버전별 가용성 키(p:width)와 다르다.
const memberKeyKo = (kind: MemberKind, name: string) => `${kind}:${name}`;

function snippetFor(kind: MemberKind, doc: ApiDoc, m: AnyMember): string {
  if (kind === 'property') return propSnippet(doc, m as Prop);
  if (kind === 'aggregation') return aggrSnippet(doc, m as Aggr);
  if (kind === 'association') return assocSnippet(doc, m as Assoc);
  if (kind === 'event') return eventSnippet(doc, m as Evt);
  return methSnippet(doc, m as Meth);
}

function MemberBody({ kind, it, doc, koText, onApi, known, g, minor, onVersion }: { kind: MemberKind; it: Item; doc: ApiDoc; koText?: string } & Shared) {
  const m = it.m;
  const snippet = snippetFor(kind, doc, m);
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
      <MemberLifeView symbol={it.definedIn} memberKey={memberKey(kind, m.name)} since={m.since} g={g} minor={minor} onVersion={onVersion} />
      <Code code={snippet} label={kind === 'method' ? '호출 형태 (공식 메타데이터로 자동 생성 · 실행 검증 안 함)' : '사용 형태 (공식 메타데이터로 자동 생성 · 실행 검증 안 함)'} />
    </div>
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
