import type { Candidate } from '../domain/search';
import { DepBadge, KoBadge } from '../ui';

function hl(text: string, q: string) {
  const i = q ? text.toLowerCase().indexOf(q.trim().toLowerCase()) : -1;
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.trim().length)}</mark>{text.slice(i + q.trim().length)}</>;
}

export function Card({ c, i, q, active, selected, onHover, onPick }: { c: Candidate; i: number; q: string; active: boolean; selected: boolean; onHover: () => void; onPick: () => void }) {
  const e = c.entry;
  return (
    <li id={`cand-${i}`} role="option" aria-selected={selected} className={`card ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} onMouseMove={onHover} onClick={onPick}>
      <div className="card-head">
        <span className="card-name">{hl(e.n, q)}</span>
        {selected && <span className="badge b-sel">선택됨</span>}
      </div>
      <div className="badges">
        <span className="badge">{e.l}</span><span className="badge">{e.k}</span>
        <DepBadge since={e.d} /><KoBadge status={e.ko} />
      </div>
      <p className="card-sum">
        {e.kz ? e.kz : <><span className="lang">EN 원문</span> {e.t || '(공식 설명 없음)'}</>}
      </p>
      <p className="card-use"><b>주로 사용하는 상황</b> {e.ku ?? '한국어 설명 준비 안 됨 — 공식 영문 설명만 있습니다.'}</p>
      <p className="reasons">{c.reasons.join(' · ')}</p>
    </li>
  );
}
