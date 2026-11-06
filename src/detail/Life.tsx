import { useEffect, useState } from 'react';
import { lifeCtx, loadMemberLife, type Global, type MemberLife } from '../data';
import { describeLife, missingInVersion, sinceConflict } from '../domain/life';
import { KEY_LABEL } from '../domain/members';

/** 심볼이 선언한 멤버들의 버전별 칸(공식 api.json 비교). undefined 로딩 / 'err' 실패 / null 자료 없음 */
export function useMemberLife(symbol: string) {
  const [life, setLife] = useState<MemberLife | null | 'err' | undefined>(undefined);
  useEffect(() => { setLife(undefined); loadMemberLife(symbol).then(setLife).catch(() => setLife('err')); }, [symbol]);
  return life;
}

const stLabel = (st: string, short = false) => (st === '0' ? '없음' : st === '2' ? (short ? 'dep' : 'deprecated') : short ? 'OK' : '있음');

/** 한 줄 판정 + 버전 칸. 멤버를 선언한 심볼(definedIn)의 공식 api.json 을 버전마다 비교한 결과. */
export function MemberLifeView({ symbol, memberKey, since, g, minor, onVersion }: { symbol: string; memberKey: string; since: string | null; g: Global; minor: string; onVersion: (m: string) => void }) {
  const life = useMemberLife(symbol);
  if (life === undefined) return <p className="muted small">버전별 사용 가능 여부 불러오는 중…</p>;
  if (life === 'err') return <p className="muted small">버전별 비교 자료를 불러오지 못했습니다.</p>;
  const row = life?.[memberKey];
  if (!row) return <p className="muted small">이 항목의 버전별 비교 자료가 없습니다(미확인).</p>;
  const d = describeLife(row, lifeCtx(g));
  const cells = d.cells;
  const cur = cells.find((c) => c.m === minor);
  return (
    <div className="life">
      <h5>버전별 사용 가능 여부 <small className="muted">(공식 api.json 을 Lens 가 비교해 계산 · 받아 둔 {cells.length}개 버전)</small></h5>
      <p>
        {cur && (cur.st === '0' ? <b className="life-no">지금 보는 {cur.version}: 사용 불가(이 버전 자료에 없음). </b>
          : cur.st === '2' ? <b className="life-dep">지금 보는 {cur.version}: 존재하지만 deprecated 표시. </b>
          : <b className="life-ok">지금 보는 {cur.version}: 사용 가능. </b>)}
      </p>
      {!d.none && (
        <ul className="life-list">
          <li><b>도입</b> {d.intro}{since && <> · 공식 since <b>{since}</b></>}</li>
          {d.dep && <li><b>deprecated</b> {d.dep}</li>}
          {d.removed && <li><b>제거</b> {d.removed}</li>}
          {since && sinceConflict(d.oldest.m, since) && <li className="muted small">⚠ 공식 since({since})보다 이른 {d.oldest.version} 자료에도 있어 공식 표기와 실제가 다를 수 있습니다(둘 다 그대로 표시).</li>}
        </ul>
      )}
      <div className="avail" role="group" aria-label="버전별 사용 가능 여부">
        {[...cells].reverse().map((c) => (
          <button key={c.m} className={`av av-${c.st} ${c.m === minor ? 'cur' : ''}`} onClick={() => onVersion(c.m)} title={`${c.version}: ${c.st === '0' ? '없음' : c.st === '2' ? 'deprecated' : '사용 가능'}`}>
            <span className="av-v">{c.m}</span><span className="av-s">{stLabel(c.st, true)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const RELATION_NOTE = { removed: '이 버전 이전에 있다가 사라짐', 'not-yet': '이 버전 이후 버전에서 도입됨', gap: '중간 버전에서만 있음' } as const;

/** 지금 보는 버전에는 없지만 다른 받아 둔 버전에는 있는 멤버(제거됐거나 아직 도입 전). */
export function MissingHere({ symbol, g, minor }: { symbol: string; g: Global; minor: string }) {
  const life = useMemberLife(symbol);
  if (life === undefined) return <p className="muted">불러오는 중…</p>;
  if (life === 'err' || !life) return <p className="muted">버전별 멤버 비교 자료를 불러오지 못했습니다.</p>;
  const rows = missingInVersion(life, g.availability.versions, minor).sort((a, b) => KEY_LABEL[a.kindChar].localeCompare(KEY_LABEL[b.kindChar]) || a.name.localeCompare(b.name));
  if (rows.length === 0) return <p className="muted">받아 둔 다른 버전에만 있는 항목이 없습니다.</p>;
  return (
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>종류</th><th>이름</th><th>존재하는 버전(받아 둔 것 중)</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.key} data-relation={r.relation}><td>{KEY_LABEL[r.kindChar]}</td><td className="mono">{r.name}</td>
          <td>{r.n}개 버전 · {r.oldest} ~ {r.newest} <span className="rel">({RELATION_NOTE[r.relation]})</span></td></tr>
      ))}</tbody></table></div>
  );
}

/** 상세 맨 위: “내 버전에서 쓸 수 있나?”를 한눈에. 31개 버전 점 + 한 줄 판정. */
export function VersionGlance({ name, g, current, deprecated, since, onVersion, onMore }: { name: string; g: Global; current: string; deprecated: { since: string | null } | null; since: string | null; onVersion: (m: string) => void; onMore: () => void }) {
  const row = g.availability.symbols[name];
  if (!row) return null;
  const d = describeLife(row, lifeCtx(g));
  if (d.none) return null;
  const cur = d.cells.find((c) => c.m === current);
  return (
    <div className="glance" aria-label="버전별 사용 가능 여부 요약">
      <div className="glance-line">
        {cur?.st === '0' ? <b className="life-no">지금 보는 {current} 에는 없음</b>
          : cur?.st === '2' ? <b className="life-dep">{current} 에서 사용 가능하지만 deprecated{deprecated?.since ? ` (${deprecated.since})` : ''}</b>
          : <b className="life-ok">{current} 에서 사용 가능</b>}
        <span className="muted small"> · {d.intro.startsWith('≤') ? `도입 ${d.intro.split(' — ')[0]}` : d.introExact ? `도입 ${d.oldest.m}` : '도입 시점은 “버전” 탭 참고'}{d.removed ? ' · 이후 사라짐' : ''}{since ? ` · 공식 since ${since}` : ''}</span>
        <button className="link small" onClick={onMore}>자세히</button>
      </div>
      <div className="dots" role="group" aria-label="버전별 존재 여부(오래된 버전 → 최신)">
        {[...d.cells].reverse().map((c) => (
          <button key={c.m} className={`dot av-${c.st} ${c.m === current ? 'cur' : ''}`} onClick={() => onVersion(c.m)}
            title={`${c.version}: ${stLabel(c.st)}`} aria-label={`${c.m} ${stLabel(c.st)}`} />
        ))}
      </div>
    </div>
  );
}

/** 심볼 × 버전 가용성: 0 없음 / 1 있음 / 2 deprecated. 칸을 누르면 그 버전으로 전환(같은 API 유지). */
export function Availability({ name, g, current, onVersion }: { name: string; g: Global; current: string; onVersion: (m: string) => void }) {
  const row = g.availability.symbols[name];
  if (!row) return <p className="muted">버전 비교 자료에 없는 이름입니다.</p>;
  const d = describeLife(row, lifeCtx(g));
  const cells = d.cells;
  return (
    <div>
      {d.none ? <p>받아 둔 어떤 버전에도 없습니다.</p> : (
        <ul className="life-list">
          <li>받아 둔 {cells.length}개 버전 중 <b>{d.presentCount}개</b>에 존재 (가장 오래된 {d.oldest.version} · 가장 최신 {d.newest.version})</li>
          <li><b>도입</b> {d.intro}</li>
          {d.dep && <li><b>deprecated</b> {d.dep}</li>}
          {d.removed && <li><b>제거</b> {d.removed}</li>}
        </ul>
      )}
      <div className="avail" role="group" aria-label="버전별 존재 여부">
        {[...cells].reverse().map((c) => (
          <button key={c.m} className={`av av-${c.st} ${c.m === current ? 'cur' : ''}`} onClick={() => onVersion(c.m)}
            title={`${c.version}${c.lts ? ' LTS' : ''}: ${stLabel(c.st)}`}>
            <span className="av-v">{c.m}</span><span className="av-s">{c.st === '2' ? 'dep' : stLabel(c.st)}</span>
          </button>
        ))}
      </div>
      <p className="muted small">초록=있음 · 주황=deprecated 표시 · 회색=없음. 이 표시는 공식 api.json 을 Lens 가 버전끼리 비교해 계산한 값입니다. 서버에 호스팅되지 않은 마이너 버전(예: 1.78)은 비교할 수 없어, 그 사이의 변경은 “사이에”로만 표기합니다. 칸을 누르면 같은 API 를 그 버전으로 봅니다.</p>
    </div>
  );
}

/** 멤버 상세 페이지 맨 위: 이 멤버가 31개 버전에서 어땠는지 한눈에. */
export function MemberGlance({ symbol, memberKey, since, g, current, onVersion, onMore }: { symbol: string; memberKey: string; since: string | null; g: Global; current: string; onVersion: (m: string) => void; onMore: () => void }) {
  const life = useMemberLife(symbol);
  const row = life && life !== 'err' ? life[memberKey] : undefined;
  if (life === undefined) return <div className="glance muted small">버전별 사용 가능 여부 불러오는 중…</div>;
  if (!row) return null;
  const d = describeLife(row, lifeCtx(g));
  if (d.none) return null;
  const cur = d.cells.find((c) => c.m === current);
  return (
    <div className="glance" aria-label="이 항목의 버전별 사용 가능 여부 요약">
      <div className="glance-line">
        {cur?.st === '0' ? <b className="life-no">지금 보는 {current} 에는 없음</b> : cur?.st === '2' ? <b className="life-dep">{current} 에서 사용 가능하지만 deprecated</b> : <b className="life-ok">{current} 에서 사용 가능</b>}
        <span className="muted small"> · {d.intro.startsWith('≤') ? `도입 ${d.intro.split(' — ')[0]}` : d.introExact ? `도입 ${d.oldest.m}` : '도입 시점은 “버전” 탭 참고'}{d.removed ? ' · 이후 사라짐' : ''}{since ? ` · 공식 since ${since}` : ''}</span>
        <button className="link small" onClick={onMore}>자세히</button>
      </div>
      <div className="dots" role="group" aria-label="버전별 존재 여부(오래된 버전 → 최신)">
        {[...d.cells].reverse().map((c) => (
          <button key={c.m} className={`dot av-${c.st} ${c.m === current ? 'cur' : ''}`} onClick={() => onVersion(c.m)} title={`${c.version}: ${stLabel(c.st)}`} aria-label={`${c.m} ${stLabel(c.st)}`} />
        ))}
      </div>
    </div>
  );
}
