import { useState } from 'react';
import type { KindFilter } from '../controller/route';
import type { Item } from '../controller/useSearchController';
import { FLAG, KIND_LABEL, type KindChar, type MemberGroup, type MemberRow } from '../domain/memberIndex';
import type { Candidate } from '../domain/search';
import { DepBadge } from '../ui';
import { Card } from './Card';

function hl(text: string, q: string) {
  const t = q.includes('#') ? q.split('#').pop()! : q;
  const i = t ? text.toLowerCase().indexOf(t.trim().toLowerCase()) : -1;
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + t.trim().length)}</mark>{text.slice(i + t.trim().length)}</>;
}

const PILLS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: '전체' }, { id: 'c', label: '클래스' }, { id: 'm', label: '메서드' }, { id: 'p', label: '속성' }, { id: 'e', label: '이벤트' }, { id: 'a', label: '구성 요소·참조' },
];

/** 메서드(멤버) 이름 한 묶음: 같은 이름을 선언한 클래스들을 칩으로 보여 주고, 누르면 그 클래스의 멤버 상세로 간다. */
function MemberCard({ g, i, q, active, onHover, onOpen }: { g: MemberGroup; i: number; q: string; active: boolean; onHover: () => void; onOpen: (r: MemberRow) => void }) {
  const [all, setAll] = useState(false);
  const rows = all ? g.rows : g.rows.slice(0, 4);
  return (
    <li id={`cand-${i}`} role="option" aria-selected={false} className={`card member-card ${active ? 'active' : ''}`} onMouseMove={onHover} onClick={() => onOpen(g.rows[0])}>
      <div className="card-head">
        <span className="card-name">{hl(g.n, q)}</span>
        <span className="badge b-kind">{KIND_LABEL[g.k]}</span>
      </div>
      <div className="badges">
        <span className="badge">{g.rows.length === 1 ? g.rows[0].c : `${g.rows.length}개 클래스가 선언`}</span>
        {g.allDeprecated && <DepBadge since={true} />}
        {g.rows.some((r) => r.f & FLAG.static) && <span className="badge">static</span>}
        {g.accessor && <span className="badge">자동 생성 접근자</span>}
        {g.rows.some((r) => r.f & FLAG.experimental) && <span className="badge b-warn">experimental</span>}
      </div>
      <p className="card-sum">
        {g.accessor ? <span className="muted">속성 “{g.rows[0].a}” 의 자동 생성 접근자</span> : g.sampleKo ? <>{g.sampleKo} <span className="badge" title="AI 가 번역한 초안입니다. 첫 문장만 번역하며 미검토입니다.">자동 번역</span></> : g.sample ? <><span className="lang">EN 원문</span> {g.sample}</> : <span className="muted">(공식 설명 없음)</span>}
      </p>
      {g.rows.length > 1 && (
        <div className="decl" onClick={(e) => e.stopPropagation()}>
          <span className="muted small">선언한 클래스(눌러서 열기):</span>
          {rows.map((r) => <button key={r.c} className="chip mono-chip" onClick={() => onOpen(r)}>{r.c}</button>)}
          {g.rows.length > 4 && <button className="link small" onClick={() => setAll((a) => !a)}>{all ? '접기' : `+${g.rows.length - 4}개 더`}</button>}
        </div>
      )}
    </li>
  );
}

interface Props {
  q: string; kf: KindFilter; setKind: (k: KindFilter) => void;
  classList: Candidate[]; shownClasses: Candidate[]; groups: MemberGroup[]; shownGroups: MemberGroup[]; kindCounts: Record<KindChar, number>; allGroupsCount: number; items: Item[];
  active: number; setActive: (i: number) => void; selected: string | null;
  showAcc: boolean; setShowAcc: (b: boolean) => void; moreClasses: boolean; setMoreClasses: (b: boolean) => void; moreMembers: boolean; setMoreMembers: (b: boolean) => void;
  memberLoading: boolean; memberError: boolean; select: (n: string) => void; openMember: (r: MemberRow) => void; allClassCount: number; toFeature: () => void;
}

/** 이름·메서드 검색 결과: 클래스와 멤버(메서드·속성·이벤트…)를 나눠서 보여 준다. */
export function NameResults(p: Props) {
  const classCount = p.allClassCount;
  const total = classCount + p.allGroupsCount;
  return (
    <>
      <div className="pills" role="group" aria-label="결과 종류">
        {PILLS.map((x) => {
          const n = x.id === 'all' ? total : x.id === 'c' ? classCount : x.id === 'a' ? p.kindCounts.a + p.kindCounts.s : p.kindCounts[x.id];
          return <button key={x.id} className={`pill ${p.kf === x.id ? 'on' : ''}`} aria-pressed={p.kf === x.id} onClick={() => p.setKind(x.id)}>{x.label} <b>{n}</b></button>;
        })}
        <label className="check small"><input type="checkbox" checked={p.showAcc} onChange={(e) => p.setShowAcc(e.target.checked)} /> 자동 생성 접근자도</label>
      </div>

      {p.memberLoading && <p className="muted pad" role="status">메서드·속성 색인을 불러오는 중…</p>}
      {p.memberError && <div className="notice warn" role="alert">멤버 색인을 불러오지 못했습니다. 클래스 이름 검색은 계속 쓸 수 있습니다.</div>}

      {(p.kf === 'all' || p.kf === 'c') && p.classList.length > 0 && (
        <section aria-label="클래스 결과">
          <h3 className="sec-title">클래스·네임스페이스 ({p.classList.length})</h3>
          <ul id="cands" role="listbox" aria-label="API 후보">
            {p.shownClasses.map((c, i) => <Card key={c.entry.n} c={c} i={i} q={p.q} active={i === p.active} selected={p.selected === c.entry.n} onHover={() => p.setActive(i)} onPick={() => p.select(c.entry.n)} />)}
          </ul>
          {p.classList.length > p.shownClasses.length || p.moreClasses ? <button className="btn" onClick={() => p.setMoreClasses(!p.moreClasses)}>{p.moreClasses ? '클래스 줄이기' : `클래스 ${p.classList.length - p.shownClasses.length}개 더 보기`}</button> : null}
        </section>
      )}

      {p.kf !== 'c' && p.groups.length > 0 && (
        <section aria-label="메서드·속성·이벤트 결과">
          <h3 className="sec-title">메서드·속성·이벤트 ({p.groups.length}) <small className="muted">— 같은 이름은 한 묶음</small></h3>
          <ul role="listbox" aria-label="멤버 후보" className="member-results">
            {p.shownGroups.map((g, j) => {
              const i = p.shownClasses.length + j;
              return <MemberCard key={g.key} g={g} i={i} q={p.q} active={i === p.active} onHover={() => p.setActive(i)} onOpen={p.openMember} />;
            })}
          </ul>
          {p.groups.length > p.shownGroups.length || p.moreMembers ? <button className="btn" onClick={() => p.setMoreMembers(!p.moreMembers)}>{p.moreMembers ? '멤버 줄이기' : `멤버 ${p.groups.length - p.shownGroups.length}개 더 보기`}</button> : null}
        </section>
      )}

      {!p.memberLoading && p.items.length === 0 && (
        <div className="empty" role="status">
          <b>“{p.q}”</b> 와 이름이 일치하는 클래스나 메서드가 UI5 지원 범위 안에 없습니다.
          <p className="muted">존재하지 않는 API 를 만들어 보여 주지 않습니다. 메서드 이름을 정확히 모르면 <b>“기능으로 추천”</b> 모드에서 하고 싶은 일을 적어 보세요. 클래스를 지정하려면 <code>Button#setText</code> 처럼 적습니다.</p>
          <button className="btn primary" onClick={p.toFeature}>“{p.q}” 를 기능으로 추천 받기</button>
        </div>
      )}
    </>
  );
}
