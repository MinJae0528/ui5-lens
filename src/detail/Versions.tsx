import { fmtDate } from '../domain/text';
import type { Aggr, ApiDoc, Assoc, Evt, KoDoc, KoStatus, Meth, Prop } from '../types';
import { Html, KoBadge } from '../ui';
import { Availability, MissingHere } from './Life';
import type { DetailProps } from './props';

export function Versions({ chain, ko, koStatus, p }: { chain: ApiDoc[]; ko: KoDoc | null; koStatus: KoStatus; p: DetailProps }) {
  const { vd, g, known, onApi, onVersion } = p;
  const doc = chain[0];
  const meta = vd.meta;
  const depMembers = (['properties', 'methods', 'events', 'aggregations', 'associations'] as const).flatMap((pl) => (doc[pl] as (Prop | Meth | Evt | Aggr | Assoc)[]).filter((m) => m.deprecated).map((m) => ({ pl, m })));
  return (
    <div className="stack">
      <section><h3>버전별 존재 여부 <small className="muted">(공식 api.json 비교)</small></h3>
        <Availability name={doc.name} g={g} current={meta.minor} onVersion={onVersion} />
      </section>
      <section><h3>지금 버전({meta.version})에는 없지만 다른 버전에 있는 항목 <small className="muted">(이 클래스가 직접 선언한 속성·메서드·이벤트 등)</small></h3>
        <MissingHere symbol={doc.name} g={g} minor={meta.minor} />
        <p className="muted small">“이 버전 이전에 있다가 사라짐”은 더 과거 버전에만 있다는 뜻이고, “이 버전 이후 버전에서 도입됨”은 더 최신 버전에만 있다는 뜻입니다. 사라진 사유(제거/이름 변경)는 자료에 없어 추측하지 않으며, 서버에 없는 마이너 버전은 비교하지 못했습니다.</p>
      </section>
      <section><h3>이 버전({meta.version})에서의 정보</h3>
        <dl className="kv">
          <dt>도입 버전 (since)</dt><dd>{doc.since ?? '공식 자료에 표시 없음 — 미확인'}</dd>
          <dt>deprecated 여부</dt><dd>{doc.deprecated ? <>예 — {doc.deprecated.since ?? '버전 표시 없음'}</> : '이 버전의 공식 자료에 클래스 수준 deprecated 표시 없음'}</dd>
          <dt>공식 대체 안내</dt><dd>{doc.deprecated ? <Html html={doc.deprecated.text || '(안내 문구 없음 — 미확인)'} onApi={onApi} known={known} /> : '해당 없음'}</dd>
        </dl>
        <p className="muted small">대체 방법이 상황에 따라 다르면 공식 문구를 그대로 보여 주며, 하나의 API 로 단정하지 않습니다.</p>
      </section>
      <section><h3>세 가지 상태는 서로 다릅니다</h3>
        <ul className="tagged">
          <li><span className="badge b-dep">deprecated</span> 공식 자료에 “더 이상 사용하지 말라”고 표시됨. 해당 버전에서는 아직 존재함.</li>
          <li><span className="badge b-warn">제거됨 / 없음</span> 해당 버전 자료에 항목 자체가 없음. 위 “버전별 존재 여부”에서 클래스(심볼) 단위로 확인할 수 있습니다. 속성·메서드 단위의 존재 여부는 아래 “다른 버전에 있는 항목”과, 각 항목을 펼친 곳의 “버전별 사용 가능 여부”에서 확인할 수 있습니다.</li>
          <li><span className="badge">disabled</span> 실행 중 컨트롤의 상태(예: <code>enabled=false</code>)를 뜻하는 UI 개념이며 API 수명 주기와 무관합니다.</li>
        </ul>
      </section>
      <section><h3>이 클래스가 직접 선언한 deprecated 항목 ({depMembers.length})</h3>
        {depMembers.length === 0 ? <p className="muted">없음</p> : (
          <table className="tbl"><thead><tr><th>종류</th><th>이름</th><th>since</th><th>공식 안내 (원문)</th></tr></thead>
            <tbody>{depMembers.map(({ pl, m }) => <tr key={pl + m.name}><td>{pl}</td><td className="mono">{m.name}</td><td>{m.deprecated!.since ?? '—'}</td><td><Html html={m.deprecated!.text} onApi={onApi} known={known} /></td></tr>)}</tbody></table>
        )}
      </section>
      <section><h3>자료 출처와 갱신 상태</h3>
        <dl className="kv">
          <dt>공식 원문 갱신</dt><dd>조회 {fmtDate(meta.fetchedAt)} · 원문 해시 <code>{doc.officialHash}</code> · UI5 {meta.version}</dd>
          <dt>한국어 설명 상태</dt><dd><KoBadge status={koStatus} mt={!!doc.kd} /></dd>
          {ko && <>
            <dt>한국어 작성 기준 원문</dt><dd>UI5 {ko.baseMinor} · 해시 <code>{ko.basedOn.officialHash}</code> · 대조일 {ko.basedOn.stampedAt ?? ko.provenance.checkedAt} · {ko.provenance.generator}</dd>
            <dt>이 버전과의 일치</dt><dd>{koStatus === 'stale' ? <>⚠ 이 버전({meta.version})의 원문 해시 <code>{ko.hashes[meta.minor] ?? '—'}</code> 가 달라 재검토 필요</> : '일치 (한국어가 이 버전 원문 기준)'}</dd>
          </>}
          <dt>공식 원문 링크</dt><dd><a href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">{doc.sourceUrl} ↗</a></dd>
        </dl>
        <p className="muted small">원문 갱신(공식 자료를 다시 받아 오는 것)과 한국어 갱신(사람이 대조해 확인하는 것)은 별개입니다. 원문 해시가 달라지면 이 화면에 재검토 필요가 표시됩니다.</p>
      </section>
    </div>
  );
}
