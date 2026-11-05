import type { DetailProps } from './props';

export function NotInThisVersion({ name, p, back }: { name: string; p: DetailProps; back: React.ReactNode }) {
  const row = p.g.availability.symbols[name];
  const order = p.g.availability.versions;
  const where = order.filter((_, i) => row?.[i] && row[i] !== '0');
  return (
    <div className="detail"><div className="detail-bar">{back}</div>
      <div className="notice warn" role="alert">
        <h3><span className="mono">{name}</span> 은(는) UI5 {p.vd.meta.version} 의 공식 자료에 없습니다.</h3>
        <p>{where.length ? <>이 이름이 있는 버전: {where.slice(0, 40).map((m) => p.g.versions.versions.find((v) => v.minor === m)?.version).filter(Boolean).join(', ')}.</> : '받아 둔 어떤 버전에도 없는 이름입니다.'} 이 버전에서는 사용할 수 없거나(아직 도입 전 / 제거됨) 이름이 다를 수 있습니다. 어느 쪽인지는 추측하지 않습니다.</p>
        <div className="row">{where.slice(0, 6).map((m) => <button key={m} className="btn small" onClick={() => p.onVersion(m)}>{m} 로 보기</button>)}</div>
      </div>
    </div>
  );
}
