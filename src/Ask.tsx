import { useEffect, useMemo, useState } from 'react';
import { loadIntents, loadRecIndex, loadRecEval, type RecEval } from './data';
import { recommend, type IntentEntry, type RecIndex, type Rec, type RecResult } from '../shared/recommend.mjs';
import type { IndexEntry } from './types';
import { DepBadge, KoBadge } from './ui';

/** 같은 영어 용어로 이어진 한국어 표현은 하나로 묶어 보여 준다. */
function groupUsed(used: { ko: string; en: string[] }[]): string[] {
  const m = new Map<string, string[]>();
  for (const u of used) { const k = u.en.join(', '); m.set(k, [...(m.get(k) ?? []), u.ko]); }
  return [...m].map(([en, kos]) => `${kos.map((k) => `“${k}”`).join(', ')} → ${en}`);
}

export const WHERE: Record<string, string> = { name: '이름', desc: '공식 설명', mem: '멤버(속성·메서드 등) 이름' };

/** 질문(q)을 기능 설명으로 보고 추천을 계산한다. enabled 가 false 면 아무것도 하지 않는다. */
export function useRec(minor: string, q: string, enabled: boolean): { loading: boolean; error: boolean; res: RecResult | null } {
  const [data, setData] = useState<{ idx: RecIndex; intents: IntentEntry[] } | 'err' | null>(null);
  const need = enabled && q.trim().length >= 2;
  useEffect(() => {
    if (!need) return;
    let live = true;
    setData(null);
    Promise.all([loadRecIndex(minor), loadIntents()]).then(([idx, intents]) => live && setData({ idx, intents })).catch(() => live && setData('err'));
    return () => { live = false; };
  }, [minor, need]);
  const res = useMemo(() => (need && data && data !== 'err' ? recommend(data.idx, q, data.intents, 8) : null), [need, data, q]);
  return { loading: need && data === null, error: need && data === 'err', res };
}

export function RecSection({ res, version, index, selected, onPick }: { res: RecResult; version: string; index: IndexEntry[]; selected: string | null; onPick: (name: string) => void }) {
  const [more, setMore] = useState(false);
  const [ev, setEv] = useState<RecEval | null>(null);
  useEffect(() => { loadRecEval().then(setEv).catch(() => setEv(null)); }, []);
  useEffect(() => setMore(false), [res]);
  const byName = useMemo(() => new Map(index.map((i) => [i.n, i])), [index]);
  const shown = more ? res.results : res.results.slice(0, 3);
  return (
    <section className="rec-sec" aria-label="기능 설명 기반 추천">
      <h3 className="rec-title">이런 기능이면 이 API 를 살펴보세요 <span className="badge b-off">추천 · AI 아님</span></h3>
      <p className="muted small interp">
        {res.used.length > 0 && <>해석: {groupUsed(res.used).join(' · ')}. </>}
        검색에 쓴 영어 용어: <code>{[...res.terms.keys()].join(' ')}</code>
      </p>
      <ol className="rec-list">
        {shown.map((r, i) => <RecCard key={r.c.n} rank={i + 1} r={r} entry={byName.get(r.c.n)} selected={selected === r.c.n} onPick={() => onPick(r.c.n)} />)}
      </ol>
      {res.results.length > 3 && <button className="btn" onClick={() => setMore((m) => !m)}>{more ? '상위 3개만 보기' : `다음 후보 ${res.results.length - 3}개 더 보기`}</button>}
      <p className="muted small rec-note">
        UI5 {version} 공식 이름·설명과 겹치는 정도로 고른 후보이며 정답을 보증하지 않습니다. 기본 라이브러리(sap.m, sap.f 등)를 먼저 보이고 deprecated 는 순위를 낮췄습니다.
        {ev && <> 자체 평가: 새 질문 {ev.fresh.n}개 중 {ev.fresh.top3}개({Math.round((ev.fresh.top3 / ev.fresh.n) * 100)}%)에서 상위 3개 안에 정답이 있었습니다 — 못 찾는 표현도 많으니 이름 검색과 함께 쓰세요.</>}
      </p>
    </section>
  );
}

function RecCard({ rank, r, entry, selected, onPick }: { rank: number; r: Rec; entry?: IndexEntry; selected: boolean; onPick: () => void }) {
  const where = (Object.keys(WHERE) as (keyof Rec['why'])[]).filter((k) => r.why[k].length).map((k) => `${WHERE[k]}: ${[...new Set(r.why[k])].join(', ')}`);
  return (
    <li className={`card rec ${selected ? 'selected' : ''}`}>
      <button className="rec-btn" onClick={onPick} aria-label={`${r.c.n} 열기`}>
        <div className="card-head">
          <span className="card-name"><span className="rank">{rank}</span>{r.c.n}</span>
          {selected && <span className="badge b-sel">선택됨</span>}
        </div>
        <div className="badges">
          <span className="badge">{r.c.c === 3 ? 'namespace(함수 모음)' : r.c.c === 1 ? 'control(화면 요소)' : r.c.c === 2 ? 'element' : 'class'}</span>
          {entry && <DepBadge since={entry.d} />}{!entry && r.c.dp ? <DepBadge since={typeof r.c.dp === 'string' ? r.c.dp : true} /> : null}
          {entry && <KoBadge status={entry.ko} />}
        </div>
        <p className="card-sum">
          {entry?.kz ? entry.kz : <><span className="lang">EN 원문</span> {entry?.t || r.c.t.slice(0, 200) || '(공식 설명 없음)'}</>}
        </p>
        <p className="reasons"><b>왜 추천?</b> 질문과 겹친 공식 용어 — {where.join(' · ')}</p>
      </button>
    </li>
  );
}
