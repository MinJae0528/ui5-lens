import { newSnippet } from '../domain/snippets';
import type { ApiDoc } from '../types';
import { Code, Html } from '../ui';
import { OfficialExamples, RefList } from './Refs';
import type { DetailProps } from './props';

/** 생성자(Constructor) 탭: ui5.sap.com 의 Constructor 섹션처럼 설명·인자·사용 형태·참고를 보여 준다. */
export function Constructor({ doc, p, goTab }: { doc: ApiDoc; p: DetailProps; goTab: (t: string) => void }) {
  const c = doc.ctor;
  const snippet = newSnippet(doc);
  const settingNames = [...doc.properties, ...doc.aggregations, ...doc.associations, ...doc.events].filter((m) => !m.deprecated).map((m) => m.name);
  return (
    <div className="stack">
      <section><h3>생성자 설명 <small className="muted">(공식 api.json 원문)</small></h3>
        <Html html={c?.description || '(공식 설명 없음)'} onApi={p.onApi} known={p.known} />
        {c?.allowedFor && c.allowedFor.length > 0 && <p className="muted small">공식 자료 표시: 이 생성자는 {c.allowedFor.join(', ')} 용도로만 공개된 항목입니다.</p>}
      </section>
      <section><h3>인자</h3>
        {doc.constructorParams.length === 0 ? <p className="muted">공식 자료에 인자가 없습니다.</p> : (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>이름</th><th>자료형</th><th>필수</th><th>설명 (공식 영문)</th></tr></thead>
            <tbody>{doc.constructorParams.map((q) => <tr key={q.name}><td className="mono">{q.name}</td><td className="mono">{q.type ?? '—'}</td><td>{q.optional ? '선택' : '필수'}</td><td><Html html={q.description ?? ''} onApi={p.onApi} known={p.known} /></td></tr>)}</tbody></table></div>
        )}
      </section>
      {snippet && <section><h3>만드는 형태</h3><Code code={snippet} label="생성자 호출 (공식 메타데이터로 자동 생성 · 실행 검증 안 함)" />
        <p className="muted small">mSettings 객체에는 이 클래스의 속성·구성 요소·참조·이벤트 핸들러를 키로 넘길 수 있습니다. 예: <code>{`{ ${settingNames.slice(0, 3).join(': …, ') || '속성'}: … }`}</code></p>
        {settingNames.length > 0 && <p className="muted small">쓸 수 있는 설정 이름 {settingNames.length}개: <button className="link" onClick={() => goTab('property')}>속성</button> · <button className="link" onClick={() => goTab('aggregation')}>구성 요소</button> · <button className="link" onClick={() => goTab('event')}>이벤트</button> 탭에서 확인</p>}
      </section>}
      {c?.examples && c.examples.length > 0 && <section><h3>공식 예제</h3><OfficialExamples examples={c.examples} /></section>}
      {c?.references && c.references.length > 0 && <section><h3>참고 링크 <small className="muted">(공식)</small></h3><RefList refs={c.references} docBase={p.vd.meta.docBase} known={p.known} onRef={(a) => p.onApi(a)} /></section>}
    </div>
  );
}
