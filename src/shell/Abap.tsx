import { useEffect, useMemo, useState } from 'react';
import { loadAbap } from '../data';
import type { AbapDoc, AbapEntry } from '../types';
import { Code } from '../ui';

/** ABAP 기본 문법 자료를 불러온다. 실패와 "없음"을 구분한다. */
export function useAbap(on: boolean): { doc: AbapDoc | null; loading: boolean; error: boolean } {
  const [st, setSt] = useState<{ doc: AbapDoc | null; error: boolean; done: boolean }>({ doc: null, error: false, done: false });
  useEffect(() => {
    if (!on || st.done) return;
    let live = true;
    loadAbap().then((doc) => live && setSt({ doc, error: false, done: true })).catch(() => live && setSt({ doc: null, error: true, done: true }));
    return () => { live = false; };
  }, [on, st.done]);
  return { doc: st.doc, loading: on && !st.done, error: st.error };
}

export function matchAbap(e: AbapEntry, q: string): boolean {
  const t = q.trim().toLowerCase();
  return !t || [e.term, e.id, e.group, e.summary, e.whenToUse].some((x) => x.toLowerCase().includes(t));
}

/** 왼쪽: 주제별로 묶은 ABAP 항목 목록과 검색 */
export function AbapList({ res, ab, onPick }: { res: ReturnType<typeof useAbap>; ab: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const m = new Map<string, AbapEntry[]>();
    for (const e of res.doc?.entries ?? []) if (matchAbap(e, q)) (m.get(e.group) ?? m.set(e.group, []).get(e.group)!).push(e);
    return [...m];
  }, [res.doc, q]);
  const total = res.doc?.entries.length ?? 0;
  return (
    <div className="stack pad">
      <div className="notice">ABAP 기본 문법 사전 · <b>AI 초안 · 미검토 · 실행 검증 안 함</b>. 틀린 부분이 있을 수 있으니 항목마다 있는 공식 링크로 확인하세요.</div>
      <label className="sr-only" htmlFor="abap-q">ABAP 항목 검색</label>
      <input id="abap-q" type="search" className="inline-search" placeholder="키워드 검색 (예: SELECT, 반복, 내부 테이블)" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
      {res.loading && <p className="muted" role="status">불러오는 중…</p>}
      {res.error && <div className="notice warn" role="alert">ABAP 자료를 불러오지 못했습니다. “항목 없음”이 아니라 조회 실패입니다.</div>}
      {res.doc && <p className="muted small">{groups.reduce((a, [, v]) => a + v.length, 0)} / {total}개</p>}
      {res.doc && groups.length === 0 && <div className="empty">“{q}” 와 맞는 항목이 없습니다.</div>}
      {groups.map(([g, list]) => (
        <section key={g}>
          <h4>{g}</h4>
          <ul className="members">
            {list.map((e) => (
              <li key={e.id} className={`member ${ab === e.id ? 'open' : ''}`}>
                <button className="member-head" aria-current={ab === e.id} onClick={() => onPick(e.id)}>
                  <span className="m-name">{e.term}</span>
                  <span className="m-sum">{e.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** 오른쪽: 선택한 ABAP 항목의 설명 */
export function AbapDetail({ res, ab, onBack }: { res: ReturnType<typeof useAbap>; ab: string; onBack: () => void }) {
  const e = res.doc?.entries.find((x) => x.id === ab);
  if (!e || !res.doc) {
    return (
      <div className="detail-empty stack">
        <h2>ABAP 기본 문법</h2>
        <p className="muted">왼쪽에서 항목을 고르면 설명, 예제, 주의점, 공식 문서 링크를 보여 줍니다. ABAP 을 배우면서 자주 찾는 기본 문법부터 정리했고, RAP 같은 내용은 배우면서 추가할 예정입니다.</p>
        {res.doc && <div className="notice">{res.doc.provenance.note}</div>}
      </div>
    );
  }
  return (
    <div className="stack">
      <button className="btn small only-narrow" onClick={onBack}>← 목록</button>
      <header className="detail-head">
        <div className="eyebrow">ABAP · {e.group}</div>
        <h2 className="api-name">{e.term}</h2>
        <div className="badges"><span className="badge b-draft">AI 초안 · 미검토 · 실행 검증 안 함</span></div>
      </header>
      <section><h3>한 줄 설명</h3><p className="lead">{e.summary}</p></section>
      <section><h3>언제 사용하나요</h3><p>{e.whenToUse}</p></section>
      <section><h3>예제 <small className="muted">(설명용 · ABAP 시스템에서 실행해 검증하지 않음)</small></h3><Code code={e.syntax} label="ABAP" /></section>
      {e.notes.length > 0 && <section><h3>주의할 점</h3><ul className="plain">{e.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></section>}
      <section>
        <h3>공식 문서 <small className="muted">(SAP Help Portal)</small></h3>
        <ul className="plain">
          {e.links.map((l) => (
            <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer noopener">{l.label} ↗</a> <span className="muted small">{res.doc!.sites[l.site]}</span></li>
          ))}
        </ul>
        <p className="muted small">이 사전의 설명은 공식 문서를 번역한 것이 아니라 AI 가 쓴 요약입니다. 정확한 문법은 위 공식 문서가 기준입니다.</p>
      </section>
    </div>
  );
}
