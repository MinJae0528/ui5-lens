import { useEffect, useMemo, useState } from 'react';
import { loadTopics } from '../data';
import { childrenOf, findTopic, flattenTopics, searchTopics, topicUrl, type FlatTopic } from '../domain/topics';
import type { TopicNode } from '../types';

/** 문서 가이드 목차를 불러온다. 목차가 없는 버전(1.38 등)은 tree=null. */
export function useTopics(minor: string, hasTopics: boolean): { tree: TopicNode[] | null; flat: FlatTopic[]; loading: boolean; error: boolean } {
  const [st, setSt] = useState<{ minor: string; tree: TopicNode[] | null; error: boolean; done: boolean }>({ minor, tree: null, error: false, done: false });
  useEffect(() => {
    let live = true;
    // 목차가 없는 버전(meta.counts.topics 가 0)은 요청하지 않는다: “없음”과 “조회 실패”를 구분하고, 없는 파일에 HTML 을 돌려주는 호스트에도 안전하다.
    if (!hasTopics) { setSt({ minor, tree: null, error: false, done: true }); return () => { live = false; }; }
    loadTopics(minor).then((tree) => live && setSt({ minor, tree, error: false, done: true })).catch(() => live && setSt({ minor, tree: null, error: true, done: true }));
    return () => { live = false; };
  }, [minor, hasTopics]);
  const mine = st.minor === minor && st.done;
  const flat = useMemo(() => (mine && st.tree ? flattenTopics(st.tree) : []), [mine, st.tree]);
  return { tree: mine ? st.tree : null, flat, loading: !mine, error: mine && st.error };
}

function Node({ node, depth, open, toggle, selected, onPick }: { node: TopicNode; depth: number; open: Set<string>; toggle: (k: string) => void; selected: string; onPick: (k: string) => void }) {
  const [key, text, kids] = node;
  const isOpen = open.has(key);
  return (
    <li>
      <div className={`tnode ${selected === key ? 'sel' : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
        {kids && kids.length ? <button className="tog" aria-expanded={isOpen} aria-label={`${text} ${isOpen ? '접기' : '펼치기'}`} onClick={() => toggle(key)}>{isOpen ? '▾' : '▸'}</button> : <span className="tog-sp" />}
        <button className="tlabel" onClick={() => onPick(key)}>{text}</button>
      </div>
      {isOpen && kids && kids.length > 0 && <ul>{kids.map((k) => <Node key={k[0]} node={k} depth={depth + 1} open={open} toggle={toggle} selected={selected} onPick={onPick} />)}</ul>}
    </li>
  );
}

/** 문서 가이드: 목차 트리와 제목 검색. 항목을 누르면 오른쪽에 소개와 공식 문서 링크가 열린다. */
export function Guide({ minor, hasTopics, tp, onTopic }: { minor: string; hasTopics: boolean; tp: string; onTopic: (key: string) => void }) {
  const { tree, flat, loading, error } = useTopics(minor, hasTopics);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  // 선택한 항목의 상위 항목을 자동으로 펼친다
  useEffect(() => {
    if (!tp || !tree) return;
    const t = findTopic(flat, tp);
    if (!t) return;
    const keys = new Set(open);
    let nodes: TopicNode[] = tree;
    for (const title of t.path) { const n = nodes.find((x) => x[1] === title); if (!n) break; keys.add(n[0]); nodes = n[2] || []; }
    setOpen(keys);
  }, [tp, tree]); // eslint-disable-line react-hooks/exhaustive-deps
  const hits = useMemo(() => (q.trim() ? searchTopics(flat, q) : []), [flat, q]);
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (loading) return <p className="muted pad" role="status">문서 목차를 불러오는 중…</p>;
  if (error) return <div className="notice warn" role="alert">문서 목차를 불러오지 못했습니다.</div>;
  if (!tree) return <div className="notice">UI5 {minor} 에는 받아 둔 문서 목차가 없습니다(이 버전의 공식 사이트가 목차를 제공하지 않거나 형식이 달랐습니다). 다른 버전을 고르거나 공식 사이트를 이용하세요.</div>;
  return (
    <div className="guide">
      <div className="search-box">
        <label htmlFor="gq" className="sr-only">문서 제목 검색</label>
        <input id="gq" type="search" placeholder="문서 제목으로 찾기 (예: data binding, routing)" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
        <div className="search-status" role="status">{q.trim() ? `${hits.length}개 일치` : `문서 ${flat.length.toLocaleString()}개 · 본문은 공식 사이트에서 읽습니다`}</div>
      </div>
      {q.trim() ? (
        <ul className="topic-hits">
          {hits.map((t) => (
            <li key={t.key}><button className={`class-row ${tp === t.key ? 'sel' : ''}`} onClick={() => onTopic(t.key)}><span className="cname">{t.text}</span><span className="csum">{t.path.join(' › ') || '최상위'}</span></button></li>
          ))}
          {hits.length === 0 && <li className="muted pad">일치하는 문서 제목이 없습니다.</li>}
        </ul>
      ) : (
        <ul className="tree" aria-label="문서 목차">{tree.map((n) => <Node key={n[0]} node={n} depth={0} open={open} toggle={toggle} selected={tp} onPick={onTopic} />)}</ul>
      )}
    </div>
  );
}

/** 오른쪽 칸: 선택한 문서 항목의 위치, 하위 항목, 공식 문서 링크. */
export function GuidePage({ minor, hasTopics, docBase, tp, onTopic, onBack }: { minor: string; hasTopics: boolean; docBase: string; tp: string; onTopic: (key: string) => void; onBack: () => void }) {
  const { tree, flat } = useTopics(minor, hasTopics);
  const t = tp ? findTopic(flat, tp) : undefined;
  if (!tp || !t || !tree) {
    return (
      <div className="landing">
        <h2>문서 가이드</h2>
        <p className="lead">ui5.sap.com 의 Documentation 목차를 그대로 훑어볼 수 있습니다. 왼쪽에서 항목을 고르면, 위치와 하위 문서, 그리고 <b>공식 문서 링크</b>가 여기에 나옵니다.</p>
        <p className="muted">문서 본문은 복사하지 않습니다. 본문은 SAP 가 관리하는 공식 사이트에서 읽고, Lens 는 “어디에 무슨 문서가 있는지” 찾는 것을 돕습니다. UI5 {minor} 기준 목차입니다.</p>
        <div className="about"><h3>이럴 때 쓰세요</h3><ul>
          <li>API 설명만으로는 감이 안 올 때, 개념 설명(데이터 바인딩, 라우팅, 컨트롤 개발 등)이 있는 문서를 찾을 때</li>
          <li>제목 검색: <code>binding</code>, <code>routing</code>, <code>XML view</code> 처럼 영어 제목 낱말로 찾습니다(문서 제목은 영어입니다).</li>
        </ul></div>
      </div>
    );
  }
  const kids = childrenOf(tree, tp);
  return (
    <div className="detail guide-page">
      <div className="detail-bar"><button className="btn back" onClick={onBack}>← 목차</button></div>
      <div className="eyebrow">{t.path.length ? t.path.join(' › ') : '문서 가이드'}</div>
      <h2 className="api-name">{t.text}</h2>
      <p><a className="btn primary" href={topicUrl(docBase, t.key)} target="_blank" rel="noreferrer noopener">공식 문서에서 읽기 ↗</a></p>
      <p className="muted small">이 화면은 목차만 보여 줍니다. 본문(영어)은 공식 사이트가 열립니다. 문서 번호: <code>{t.key}</code></p>
      {kids.length > 0 && (
        <section><h3>하위 문서 ({kids.length})</h3>
          <ul className="plain">{kids.map((k) => <li key={k.key}><button className="link" onClick={() => onTopic(k.key)}>{k.text}</button></li>)}</ul>
        </section>
      )}
      {t.path.length > 0 && (
        <section><h3>같은 위치의 다른 문서</h3>
          <ul className="plain">{flat.filter((x) => x.depth === t.depth && x.path.join('/') === t.path.join('/') && x.key !== t.key).slice(0, 15).map((x) => <li key={x.key}><button className="link" onClick={() => onTopic(x.key)}>{x.text}</button></li>)}</ul>
        </section>
      )}
    </div>
  );
}
