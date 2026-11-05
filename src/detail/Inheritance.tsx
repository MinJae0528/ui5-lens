import { mergeMembers, MEMBER_SPECS } from '../domain/members';
import type { ApiDoc } from '../types';
import type { DetailProps } from './props';

export function Inheritance({ chain, p }: { chain: ApiDoc[]; p: DetailProps }) {
  return (
    <div className="stack">
      <section><h3>상속 구조</h3>
        <ol className="chain">
          {chain.map((d, i) => (
            <li key={d.name} className={i === 0 ? 'self' : ''}>
              {i === 0 ? <b className="mono">{d.name}</b> : p.known.has(d.name) ? <button className="link mono" onClick={() => p.onApi(d.name)}>{d.name}</button> : <span className="mono">{d.name}</span>}
              <span className="muted small"> {i === 0 ? '← 현재 선택 (직접 선언)' : '부모'} · 속성 {d.properties.length} · 메서드 {d.methods.length} · 이벤트 {d.events.length} · 구성 {d.aggregations.length} · 참조 {d.associations.length}</span>
            </li>
          ))}
        </ol>
        {chain[chain.length - 1].extends && <p className="muted small">체인 끝 클래스의 부모({chain[chain.length - 1].extends})는 조회하지 못했습니다.</p>}
      </section>
      <section><h3>직접 선언 vs 상속</h3>
        <table className="tbl"><thead><tr><th>종류</th><th>직접 선언</th><th>상속(중복 제외)</th></tr></thead>
          <tbody>{MEMBER_SPECS.map((k) => { const all = mergeMembers(chain, k.plural); const own = all.filter((a) => !a.inherited).length; return <tr key={k.id}><td>{k.label} <small className="muted">{k.en}</small></td><td>{own}</td><td>{all.length - own}</td></tr>; })}</tbody></table>
        <p className="muted small">같은 이름을 하위 클래스가 다시 정의한 항목은 하위 클래스 쪽만 셉니다. 각 탭의 “상속 항목 포함”을 켜면 항목마다 정의된 클래스가 표시됩니다.</p>
      </section>
    </div>
  );
}
