import type { KoDoc } from '../types';
import { Origin } from '../ui';

export function Usage({ ko }: { ko: KoDoc | null }) {
  if (!ko) return <div className="notice">이 API 는 사용 조건·흐름 정리가 아직 없습니다. 모든 API 에 고정된 선행 체인이 있다고 가정하지 않으며, 공식 설명의 Note/must 문장은 “개요·구조” 탭의 영문 원문에서 확인하세요.</div>;
  const u = ko.usage;
  return (
    <div className="stack">
      <div className="notice">세 가지를 구분해서 보여 줍니다: <b>필수 선행 조건</b>(공식 문서 명시) · <b>대표 예제의 순서</b>(서비스에서 작성, 하나의 예) · <b>권장 사용 방식</b>. 항목마다 공식 명시 / 서비스 작성 여부를 표시합니다.</div>
      <section><h3>① 필수 선행 조건</h3>
        {u.prerequisites.length ? <ul className="tagged">{u.prerequisites.map((x, i) => <li key={i}><Origin kind={x.kind} /> {x.text}{x.basis && <div className="muted small">근거: {x.basis}</div>}</li>)}</ul> : <p className="muted">공식 자료로 확인된 필수 조건이 없습니다.</p>}
      </section>
      <section><h3>② 대표 예제의 순서 <small className="muted">(필수 체인이 아닙니다)</small></h3>
        <ol className="flow">{u.exampleFlow.map((x) => <li key={x.step}><Origin kind={x.kind} /> {x.text}</li>)}</ol>
      </section>
      <section><h3>③ 권장 사용 방식</h3>
        <ul className="tagged">{u.recommended.map((x, i) => <li key={i}><Origin kind={x.kind} /> {x.text}{x.basis && <div className="muted small">근거: {x.basis}</div>}</li>)}</ul>
      </section>
    </div>
  );
}
