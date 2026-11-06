import { useMemo, useState } from 'react';
import { entriesOf, KIND_KO, libraries } from '../domain/browse';
import type { IndexEntry } from '../types';
import { DepBadge, KoBadge } from '../ui';

const KIND_PILLS: { id: string; label: string; kinds: ReadonlySet<string> | null }[] = [
  { id: 'all', label: '전체', kinds: null },
  { id: 'class', label: '클래스', kinds: new Set(['class']) },
  { id: 'ns', label: '네임스페이스', kinds: new Set(['namespace']) },
  { id: 'enum', label: '열거형', kinds: new Set(['enum']) },
  { id: 'other', label: '인터페이스·타입', kinds: new Set(['interface', 'typedef', 'function']) },
];

/** API 탐색: ui5.sap.com 의 API Reference 트리처럼 라이브러리 → 클래스 순으로 훑어본다. */
export function Browse({ index, lib, selected, onLib, onPick }: { index: IndexEntry[]; lib: string; selected: string | null; onLib: (lib: string) => void; onPick: (name: string) => void }) {
  const libs = useMemo(() => libraries(index), [index]);
  const [filter, setFilter] = useState('');
  const [libFilter, setLibFilter] = useState('');
  const [pill, setPill] = useState('all');
  const [limit, setLimit] = useState(150);
  const kinds = KIND_PILLS.find((x) => x.id === pill)?.kinds ?? null;
  const entries = useMemo(() => (lib ? entriesOf(index, lib, filter, kinds) : []), [index, lib, filter, kinds]);

  if (!lib) {
    const lf = libFilter.trim().toLowerCase();
    const shown = libs.filter((l) => !lf || l.lib.toLowerCase().includes(lf));
    return (
      <div className="browse">
        <div className="search-box">
          <label htmlFor="libq" className="sr-only">라이브러리 찾기</label>
          <input id="libq" type="search" placeholder="라이브러리 이름으로 거르기 (예: sap.m)" value={libFilter} onChange={(e) => setLibFilter(e.target.value)} autoComplete="off" spellCheck={false} />
          <div className="search-status">라이브러리 {libs.length}개 · 눌러서 안의 클래스를 봅니다. 기본 라이브러리(sap.m, sap.f, sap.ui.core …)가 앞에 있습니다.</div>
        </div>
        <ul className="lib-list" aria-label="라이브러리 목록">
          {shown.map((l) => (
            <li key={l.lib}>
              <button className="lib-row" onClick={() => { setFilter(''); setLimit(150); onLib(l.lib); }}>
                <span className="mono">{l.lib}</span>
                {l.core && <span className="badge b-off">기본</span>}
                <span className="lib-count">{l.count.toLocaleString()}개{l.deprecated ? ` · deprecated ${l.deprecated}` : ''}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted pad">일치하는 라이브러리가 없습니다.</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="browse">
      <div className="search-box">
        <button className="btn small" onClick={() => onLib('')}>← 라이브러리 목록</button>
        <h3 className="lib-title mono">{lib}</h3>
        <label htmlFor="clsq" className="sr-only">{lib} 안에서 이름으로 거르기</label>
        <input id="clsq" type="search" placeholder={`${lib} 안에서 이름으로 거르기`} value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(150); }} autoComplete="off" spellCheck={false} />
        <div className="pills" role="group" aria-label="종류">
          {KIND_PILLS.map((x) => <button key={x.id} className={`pill ${pill === x.id ? 'on' : ''}`} aria-pressed={pill === x.id} onClick={() => { setPill(x.id); setLimit(150); }}>{x.label}</button>)}
        </div>
        <div className="search-status" role="status">{entries.length.toLocaleString()}개</div>
      </div>
      <ul className="class-list" aria-label={`${lib} 항목`}>
        {entries.slice(0, limit).map((e) => (
          <li key={e.n}>
            <button className={`class-row ${selected === e.n ? 'sel' : ''}`} onClick={() => onPick(e.n)}>
              <span className="mono cname">{e.b}</span>
              <span className="badge">{KIND_KO[e.k] ?? e.k}</span>
              <DepBadge since={e.d} />
              {e.ko !== 'none' && <KoBadge status={e.ko} />}
              <span className="csum">{e.kz ?? e.t}</span>
            </button>
          </li>
        ))}
      </ul>
      {entries.length > limit && <button className="btn" onClick={() => setLimit((n) => n + 300)}>{(entries.length - limit).toLocaleString()}개 더 보기</button>}
    </div>
  );
}
