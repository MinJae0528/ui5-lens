import { useEffect, useMemo, useState } from 'react';
import { loadHybridEval, loadMemberRecEval, loadRecEval, type HybridEval, type MemberRecEval, type RecEval } from './data';
import type { HybridResult } from './domain/hybrid';
import { FLAG, KIND_CHAR_OF, KIND_LABEL, type MemberRow } from './domain/memberIndex';
import type { MemberRecResult } from './domain/memberRecommend';
import type { Rec, RecResult } from './domain/recommend';
import type { IndexEntry } from './types';
import { DepBadge, KoBadge } from './ui';

/** 같은 영어 용어로 이어진 한국어 표현은 하나로 묶어 보여 준다. */
function groupUsed(used: { ko: string; en: string[] }[]): string[] {
  const m = new Map<string, string[]>();
  for (const u of used) { const k = u.en.join(', '); m.set(k, [...(m.get(k) ?? []), u.ko]); }
  return [...m].map(([en, kos]) => `${kos.map((k) => `“${k}”`).join(', ')} → ${en}`);
}

export const WHERE: Record<string, string> = { name: '이름', desc: '공식 설명', mem: '멤버(속성·메서드 등) 이름' };

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
          {entry && <KoBadge status={entry.ko} mt={!!entry.tk} />}
        </div>
        <p className="card-sum">
          {entry?.kz ? entry.kz : entry?.tk ? <>{entry.tk} <span className="badge" title="AI 가 번역한 초안입니다. 첫 문장만 번역하며 미검토입니다.">자동 번역</span></> : <><span className="lang">EN 원문</span> {entry?.t || r.c.t.slice(0, 200) || '(공식 설명 없음)'}</>}
        </p>
        <p className="reasons"><b>왜 추천?</b> 질문과 겹친 공식 용어 — {where.join(' · ')}</p>
      </button>
    </li>
  );
}

/** 기능 설명으로 고른 추천 멤버(메서드·이벤트·속성). 눌러서 멤버 상세 페이지로 간다. */
export function MemberRecSection({ res, onOpen }: { res: MemberRecResult; onOpen: (r: MemberRow) => void }) {
  const [more, setMore] = useState(false);
  const [ev, setEv] = useState<MemberRecEval | null>(null);
  useEffect(() => { loadMemberRecEval().then(setEv).catch(() => setEv(null)); }, []);
  useEffect(() => setMore(false), [res]);
  if (res.results.length === 0) return null;
  const shown = more ? res.results : res.results.slice(0, 5);
  return (
    <section className="rec-sec" aria-label="추천 메서드">
      <h3 className="rec-title">이런 메서드·이벤트를 쓰게 될 거예요 <span className="badge b-off">추천 · AI 아님</span></h3>
      <ol className="rec-list">
        {shown.map((x, i) => {
          const where = (['name', 'desc', 'cls'] as const).filter((k) => x.why[k].length).map((k) => `${{ name: '이름', desc: '공식 설명', cls: '클래스 이름' }[k]}: ${[...new Set(x.why[k])].join(', ')}`);
          return (
            <li key={`${x.r.c}#${x.r.n}`} className="card rec">
              <button className="rec-btn" onClick={() => onOpen(x.r)} aria-label={`${x.r.c} ${x.r.n} 열기`}>
                <div className="card-head"><span className="card-name"><span className="rank">{i + 1}</span>{x.r.n}</span><span className="badge">{KIND_LABEL[x.r.k]}</span></div>
                <div className="badges"><span className="badge mono-badge">{x.r.c}</span>{x.classes > 1 && <span className="badge">같은 이름을 {x.classes}개 클래스가 선언</span>}{x.r.f & FLAG.accessor ? <span className="badge">자동 생성 접근자</span> : null}{x.r.f & FLAG.deprecated ? <DepBadge since={true} /> : null}</div>
                <p className="card-sum">{x.r.a ? <span className="muted">속성 “{x.r.a}” 의 자동 생성 접근자</span> : x.r.tk ? <>{x.r.tk} <span className="badge" title="AI 가 번역한 초안입니다. 첫 문장만 번역하며 미검토입니다.">자동 번역</span></> : <><span className="lang">EN 원문</span> {x.r.t || '(공식 설명 없음)'}</>}</p>
                <p className="reasons"><b>왜 추천?</b> 질문과 겹친 공식 용어 — {where.join(' · ')}</p>
              </button>
            </li>
          );
        })}
      </ol>
      {res.results.length > 5 && <button className="btn" onClick={() => setMore((m) => !m)}>{more ? '상위 5개만 보기' : `다음 후보 ${res.results.length - 5}개 더 보기`}</button>}
      <p className="muted small">멤버 이름·공식 설명 첫 문장·소속 클래스 이름과 질문이 겹치는 정도로 고른 후보입니다. 같은 이름은 한 줄로 묶고 대표 클래스를 보여 줍니다. 자동 생성 접근자(getX/setX)도 후보에 포함합니다.</p>
      <div className="notice warn" role="note"><b>정확도가 낮은 실험적 기능입니다.</b>{ev ? <> 자체 평가에서 새 질문 {ev.fresh2.n}개 중 상위 3개 안에 정답이 있었던 것은 {ev.fresh2.top3}개({Math.round((ev.fresh2.top3 / ev.fresh2.n) * 100)}%)입니다(UI5 {ev.minor}). 컨트롤 추천보다 훨씬 낮으니 참고만 하고, 정확한 이름을 알면 이름·메서드 검색을 쓰세요.</> : <> 컨트롤 추천보다 정확도가 낮을 수 있으니 참고만 하고, 정확한 이름을 알면 이름·메서드 검색을 쓰세요.</>}</div>
    </section>
  );
}

/** 질문에 적은 이름과 일치하거나, 미리 정리한 작업표(레시피)에서 학습한 분류기가 골라 낸 정답. 가장 먼저 보여 준다. */
export function HybridSection({ res, onPick, onOpen }: { res: NonNullable<HybridResult>; onPick: (name: string) => void; onOpen: (r: Pick<MemberRow, 'c' | 'k' | 'n'>) => void }) {
  const [ev, setEv] = useState<HybridEval | null>(null);
  useEffect(() => { loadHybridEval().then(setEv).catch(() => setEv(null)); }, []);
  const pct = (a: number, b: number) => Math.round((a / b) * 100);
  return (
    <section className="rec-sec" aria-label="가장 가능성 높은 정답">
      <h3 className="rec-title">가장 가능성 높은 정답 <span className="badge b-off">{res.source === 'name' ? '이름 일치' : '학습한 작업표 · 생성형 AI 아님'}</span></h3>
      <ol className="rec-list">
        {res.picks.map((p, i) => {
          const label = p.ref.n ? `${p.ref.c.split('.').pop()}#${p.ref.n}` : p.ref.c;
          const open = () => (p.ref.k && p.ref.n && KIND_CHAR_OF[p.ref.k] ? onOpen({ c: p.ref.c, k: KIND_CHAR_OF[p.ref.k], n: p.ref.n }) : onPick(p.ref.c));
          return (
            <li key={`${p.ref.c}#${p.ref.k}:${p.ref.n}`} className="card rec">
              <button className="rec-btn" onClick={open} aria-label={`${p.ref.c} ${p.ref.n ?? ''} 열기`}>
                <div className="card-head"><span className="card-name"><span className="rank">{i + 1}</span>{label}</span>{p.ref.k && <span className="badge">{KIND_LABEL[KIND_CHAR_OF[p.ref.k]]}</span>}</div>
                <div className="badges"><span className="badge mono-badge">{p.ref.c}</span></div>
                <p className="reasons"><b>왜 추천?</b> {p.why}</p>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="muted small">
        {res.source === 'recipe' ? '작업표에 있는 흔한 작업으로 판단했습니다. ' : ''}이 목록은 선택한 버전의 공식 자료에 실제로 있는 것만 보여 줍니다.
        {ev && <> 별도로 만든 평가 질문(UI5 {ev.minor})에서 작업표에 있는 작업은 {ev.covered.n}개 중 {ev.covered.hit}개({pct(ev.covered.hit, ev.covered.n)}%)를 맞혔지만, 그 밖의 질문은 {ev.uncovered.n}개 중 {ev.uncovered.hit}개({pct(ev.uncovered.hit, ev.uncovered.n)}%)만 맞혔습니다. 아래 일반 추천도 함께 확인하세요.</>}
      </p>
    </section>
  );
}
