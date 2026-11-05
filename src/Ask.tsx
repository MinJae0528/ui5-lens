import { useEffect, useMemo, useState } from 'react';
import { loadIntents, loadRecIndex } from './data';
import { recommend, type IntentEntry, type RecIndex, type Rec } from '../shared/recommend.mjs';
import type { IndexEntry } from './types';
import { DepBadge, KoBadge } from './ui';

const EXAMPLES = ['댓글을 다는 기능을 추가하고 싶어', '날짜를 고르고 싶어', '삭제할 때 확인창을 띄우고 싶어', '잠깐 알림 메시지를 보여주고 싶어', '파일 업로드', '표에 데이터를 보여주고 싶어', '페이지 이동', '진행률 표시'];
const WHERE: Record<string, string> = { name: '이름', desc: '공식 설명', mem: '멤버(속성·메서드 등) 이름' };

interface Props { minor: string; version: string; ask: string; index: IndexEntry[]; selected: string | null; onAsk: (q: string) => void; onPick: (name: string) => void }

export function AskPanel({ minor, version, ask, index, selected, onAsk, onPick }: Props) {
  const [draft, setDraft] = useState(ask);
  const [data, setData] = useState<{ idx: RecIndex; intents: IntentEntry[] } | 'err' | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => setDraft(ask), [ask]);
  useEffect(() => {
    let live = true;
    setData(null);
    Promise.all([loadRecIndex(minor), loadIntents()]).then(([idx, intents]) => live && setData({ idx, intents })).catch(() => live && setData('err'));
    return () => { live = false; };
  }, [minor]);
  useEffect(() => setMore(false), [ask, minor]);
  const byName = useMemo(() => new Map(index.map((i) => [i.n, i])), [index]);
  const res = useMemo(() => (data && data !== 'err' && ask.trim() ? recommend(data.idx, ask, data.intents, 8) : null), [data, ask]);
  const submit = () => onAsk(draft.trim());
  const shown = res ? (more ? res.results : res.results.slice(0, 3)) : [];

  return (
    <div className="ask">
      <div className="search-box">
        <label htmlFor="ask" className="sr-only">하고 싶은 기능 설명</label>
        <input id="ask" type="search" autoComplete="off" spellCheck={false} value={draft} autoFocus
          placeholder="하고 싶은 기능을 적어 보세요  (예: 댓글을 다는 기능)"
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <div className="ask-actions">
          <button className="btn primary" onClick={submit} disabled={!draft.trim()}>추천 받기</button>
          <span className="muted small">UI5 {version} 의 공식 이름·설명으로 찾습니다 · AI 호출 없음</span>
        </div>
      </div>
      <div className="cands">
        {data === null && <p className="muted pad">추천용 자료 불러오는 중…</p>}
        {data === 'err' && <div className="notice warn" role="alert">추천용 자료를 불러오지 못했습니다. 이름으로 찾기는 계속 사용할 수 있습니다.</div>}
        {!ask.trim() && data && data !== 'err' && (
          <div className="intro">
            <h2>어떤 기능을 만들고 싶으세요?</h2>
            <p className="muted">메서드·컨트롤 이름을 몰라도 됩니다. 하고 싶은 일을 한국어나 영어로 적으면, UI5 {version} 공식 자료에서 가장 알맞아 보이는 API 를 3개 골라 이유와 함께 보여 줍니다.</p>
            <div className="chips">{EXAMPLES.map((s) => <button key={s} className="chip" onClick={() => { setDraft(s); onAsk(s); }}>{s}</button>)}</div>
            <p className="muted small">추천은 “공식 영문 이름·설명·멤버 이름과 질문이 얼마나 겹치는지”로 정한 후보입니다. 정답을 보증하지 않으니 상세 화면에서 속성·이벤트·예제를 확인하세요.</p>
          </div>
        )}
        {res && res.unknown && (
          <div className="empty" role="status">
            <b>“{ask}”</b> 에서 찾을 만한 기능 단어를 해석하지 못했습니다.
            <p className="muted">지원하는 한국어 표현이 한정되어 있습니다. 영어 키워드(예: <code>date picker</code>, <code>upload</code>)로 적거나, 아래 예시를 눌러 보세요. 모르는 것을 지어내서 추천하지 않습니다.</p>
            <div className="chips">{EXAMPLES.slice(0, 5).map((s) => <button key={s} className="chip" onClick={() => { setDraft(s); onAsk(s); }}>{s}</button>)}</div>
          </div>
        )}
        {res && !res.unknown && (
          <div className="ask-res" role="region" aria-label="추천 결과" aria-live="polite">
            <p className="muted small interp">
              {res.used.length > 0 && <>해석: {res.used.map((u) => `“${u.ko}” → ${u.en.join(', ')}`).join(' · ')}. </>}
              검색에 쓴 영어 용어: <code>{[...res.terms.keys()].join(' ')}</code>
            </p>
            {res.results.length === 0 && <div className="empty">UI5 {version} 공식 자료에서 이 용어와 겹치는 API 를 찾지 못했습니다. 다른 표현이나 다른 버전을 시도해 보세요.</div>}
            <ol className="rec-list">
              {shown.map((r, i) => <RecCard key={r.c.n} rank={i + 1} r={r} entry={byName.get(r.c.n)} selected={selected === r.c.n} onPick={() => onPick(r.c.n)} />)}
            </ol>
            {res.results.length > 3 && <button className="btn" onClick={() => setMore((m) => !m)}>{more ? '상위 3개만 보기' : `다음 후보 ${res.results.length - 3}개 더 보기`}</button>}
            <p className="muted small">기본 라이브러리(sap.m, sap.f, sap.ui.core, sap.ui.table 등)를 먼저 보여 주고, deprecated 는 순위를 낮췄습니다. 같은 기능이 여러 라이브러리에 있으면 후보를 모두 보고 고르세요.</p>
          </div>
        )}
      </div>
    </div>
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
