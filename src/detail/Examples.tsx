import { useRef, useState } from 'react';
import { runMessage } from '../domain/example';
import { fmtDate } from '../domain/text';
import type { KoDoc } from '../types';
import { Code } from '../ui';

/**
 * 격리된 예제 실행: 전용 페이지를 sandbox="allow-scripts"(allow-same-origin 없음) iframe 으로 열고,
 * 로드가 끝나면 코드를 postMessage 로 전달한다. 부모의 저장소·쿠키·DOM 에 접근할 수 없고 최상위 이동·팝업도 막혀 있다.
 */
function ExampleFrame({ code, title }: { code: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref} title={`${title} 실행 결과`} className="runframe"
      sandbox="allow-scripts" referrerPolicy="no-referrer"
      src={`${import.meta.env.BASE_URL}example-runner.html`}
      onLoad={() => ref.current?.contentWindow?.postMessage(runMessage(code), '*')}
    />
  );
}

export function Examples({ ko, minor }: { ko: KoDoc | null; minor: string }) {
  const [run, setRun] = useState<string | null>(null);
  if (!ko || !ko.examples?.length) return <div className="notice">이 API 의 검증된 예제가 아직 없습니다. “속성/메서드/이벤트” 탭에는 공식 메타데이터로 자동 생성한 호출 형태가 있지만, 실행 검증을 거치지 않았습니다.</div>;
  return (
    <div className="stack">
      {ko.examples.map((ex) => {
        const v = ex.verification;
        return (
          <article key={ex.id} className="example">
            <h3>{ex.title}</h3>
            <div className="badges">
              <span className="badge b-svc">서비스 작성{ex.ai ? ' · AI 초안' : ''}</span>
              {v.status === 'passed' && <span className="badge b-ok" title={v.check}>✓ UI5 {v.actualVersion} 에서 실행 확인 · {v.ranAt ? fmtDate(v.ranAt) : ''}</span>}
              {v.status === 'passed' && !String(v.actualVersion ?? '').startsWith(minor + '.') && <span className="badge b-warn">지금 보는 {minor} 에서는 미검증</span>}
              {v.status === 'failed' && <span className="badge b-warn" title={v.detail}>✗ 검증 실패</span>}
              {v.status === 'unverified' && <span className="badge b-warn">미검증 예제</span>}
            </div>
            <p>{ex.description}</p>
            {v.status === 'passed' && <p className="muted small">검증 방법: 실제 UI5 {v.actualVersion} 을 브라우저(Edge)에 로드해 예제를 실행했고, 오류 없이 {v.check} 가 렌더링됨을 확인했습니다. (화면 렌더링 확인이며 사용자 조작 시나리오까지 검증한 것은 아닙니다.)</p>}
            <Code code={ex.code} label="JavaScript (sap.ui.require)" />
            <div className="row">
              <button className="btn" onClick={() => setRun(run === ex.id ? null : ex.id)}>{run === ex.id ? '실행 닫기' : '▶ 실행해 보기 (UI5 CDN 사용, 인터넷 필요)'}</button>
            </div>
            {run === ex.id && <ExampleFrame code={ex.code} title={ex.title} />}
          </article>
        );
      })}
    </div>
  );
}
