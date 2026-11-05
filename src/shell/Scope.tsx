import type { Global, VersionData } from '../data';
import { KoBadge } from '../ui';

/** 지원 범위 패널: 지금 보는 버전의 자료 정보, 받아 둔 31개 버전과 SAP 제품 매핑. */
export function Scope({ g, vd, onVersion, onPick }: { g: Global; vd: VersionData; onVersion: (m: string) => void; onPick: (n: string) => void }) {
  const { meta } = vd;
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  const hosted = g.versions.versions.length;
  const apiVers = [...new Set(Object.values(meta.libraries).map((l) => l.apiJsonVersion).filter(Boolean))].join(', ');
  return (
    <div className="scope" role="region" aria-label="지원 범위">
      <div className="scope-grid">
        <div>
          <h3>지금 보는 버전</h3>
          <ul className="plain">
            <li><b>UI5</b> {meta.version} (마이너 {meta.minor}) · 공식 <code>api.json</code> 기준{apiVers && apiVers !== meta.version ? <span className="muted small"> · api.json 파일 내부 표기 버전 {apiVers} (서버가 그렇게 제공함)</span> : null}</li>
            <li><b>자료 조회 시점</b>: {meta.fetchedAt.slice(0, 16).replace('T', ' ')} (UTC)</li>
            <li><b>① 검색·공식 구조</b>: {meta.counts.searchable.toLocaleString()}개 · 라이브러리 {Object.keys(meta.libraries).length}개</li>
            <li><b>② 한국어 상세</b>: {ko.length}개 (검토 완료 {meta.counts.reviewedKo}개, 나머지 AI 초안)</li>
            <li><b>데이터 종류</b>: {meta.dataKind === 'official' ? '공식 자료만 (데모 데이터 없음)' : '⚠ 데모 데이터'}</li>
          </ul>
          <p className="muted small">한국어 상세 대상</p>
          <ul className="plain">{ko.map((k) => <li key={k.n}><button className="link" onClick={() => onPick(k.n)}>{k.n}</button> <KoBadge status={k.ko} /></li>)}</ul>
        </div>
        <div>
          <h3>받아 둔 UI5 버전 {hosted}개</h3>
          <p className="muted small">ui5.sap.com 이 호스팅하는 버전만 받을 수 있습니다. 서버에 없는 마이너 버전(예: 1.78, 1.100)은 가져올 방법이 없으니, 회사 버전이 목록에 없으면 가장 가까운 버전을 고르세요.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>버전</th><th>지원 상태</th><th>SAP 제품 매핑 (공식 안내)</th></tr></thead>
            <tbody>{g.versions.versions.map((v) => (
              <tr key={v.minor} className={v.minor === meta.minor ? 'cur' : ''}>
                <td><button className="link mono" onClick={() => onVersion(v.minor)}>{v.version}</button>{v.lts && <span className="badge b-ok"> LTS</span>}</td>
                <td>{v.support ?? '—'}</td><td>{[v.sapuiversion, v.frontendserver].filter(Boolean).join(' / ') || '—'}</td>
              </tr>))}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
