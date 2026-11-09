import { mergeMembers, MEMBER_SPECS } from '../domain/members';
import { defineSnippet, newSnippet, xmlSnippet } from '../domain/snippets';
import { plain } from '../domain/text';
import type { ApiDoc, KoDoc, KoStatus } from '../types';
import { Code, Html, Origin } from '../ui';
import { OfficialExamples, RefList } from './Refs';
import type { DetailProps } from './props';

export function Overview({ chain, ko, koStatus, p, goTab }: { chain: ApiDoc[]; ko: KoDoc | null; koStatus: KoStatus; p: DetailProps; goTab: (t: string) => void }) {
  const doc = chain[0];
  const { known, onApi } = p;
  const firstP = doc.description.split(/\n\s*\n/)[0];
  return (
    <div className="stack">
      <section>
        <h3>한 줄 설명</h3>
        {ko ? (
          <>
            <p className="lead">{ko.overview.summary}</p>
            <p className="muted small">근거: {ko.overview.summaryBasis ?? '공식 설명'}</p>
            <ProvenanceNote ko={ko} status={koStatus} minor={p.vd.meta.minor} version={p.vd.meta.version} />
          </>
        ) : doc.kd ? (
          <>
            <p className="lead">{doc.kd}</p>
            <div className="notice">자동 번역 · AI 초안 · 미검토 — 공식 설명의 <b>첫 문장만</b> 번역했습니다. 전체 내용은 아래 영문 원문(공식)을 보세요.</div>
          </>
        ) : <div className="notice">한국어 설명이 아직 준비되지 않았습니다. 아래 영문 원문(공식)을 표시합니다.</div>}
        <details open={!ko}><summary>영문 원문 (공식 · {doc.name})</summary><Html html={firstP || '(공식 설명 없음)'} onApi={onApi} known={known} /></details>
      </section>

      {ko && ko.overview.whenToUse.length > 0 && (
        <section><h3>언제 사용하나요</h3>
          <ul className="tagged">{ko.overview.whenToUse.map((w, i) => <li key={i}><Origin kind={w.kind} /> {w.text}{w.basis && <div className="muted small">근거: {w.basis}</div>}</li>)}</ul>
        </section>
      )}

      {ko && ko.overview.compare.length > 0 && (
        <section><h3>비슷한 컴포넌트와 선택 기준</h3>
          {ko.overview.compare.map((c) => (
            <div key={c.api} className="compare">
              <div className="compare-head"><Origin kind={c.kind} /> <button className="link mono" onClick={() => onApi(c.api)}>{c.api}</button> 와 비교</div>
              <p>{c.text}</p><p className="muted small">근거: {c.basis}</p>
            </div>
          ))}
        </section>
      )}
      {!ko && <section><h3>비슷한 컴포넌트와 선택 기준</h3><p className="muted">공식 자료로 확인된 비교 정보가 아직 정리되지 않았습니다. (추측하지 않습니다)</p></section>}

      <section>
        <h3>전체 구조 한눈에</h3>
        <div className="struct">
          {MEMBER_SPECS.map((k) => {
            const own = doc[k.plural].length, all = mergeMembers(chain, k.plural).length;
            return (
              <button key={k.id} className="struct-card" onClick={() => goTab(k.id)}>
                <span className="n">{own}</span><span className="l">{k.label}</span><span className="e">{k.en}</span>
                <span className="inh">{all > own ? `상속 포함 ${all}` : '상속 없음'}</span>
              </button>
            );
          })}
        </div>
        <p className="muted small">숫자는 이 클래스가 직접 선언한 항목 수입니다. 부모 클래스에서 물려받은 항목은 각 탭의 “상속 항목 포함”으로 볼 수 있습니다.</p>
        {doc.kind === 'enum' && doc.enumValues.length > 0 && (
          <div><h4>열거 값</h4><ul className="plain">{doc.enumValues.map((v) => <li key={v.name}><code>{v.name}</code> <span className="muted small">{plain(v.description)}</span></li>)}</ul></div>
        )}
        {doc.kind === 'typedef' && doc.typedefProperties.length > 0 && (
          <div><h4>필드</h4><ul className="plain">{doc.typedefProperties.map((v) => <li key={v.name}><code>{v.name}</code>: {v.type} <span className="muted small">{plain(v.description ?? '')}</span></li>)}</ul></div>
        )}
      </section>

      <Howto doc={doc} />

      {(doc.experimental || doc.abstract || doc.final || (doc.allowedFor && doc.allowedFor.length > 0)) && (
        <section><h3>공식 자료의 표시</h3>
          <ul className="plain">
            {doc.experimental && <li><span className="badge b-warn">experimental</span> 실험적 기능으로 표시되어 이후 버전에서 바뀔 수 있습니다{doc.experimental.since ? ` (${doc.experimental.since} 부터)` : ''}.</li>}
            {doc.abstract && <li><span className="badge">abstract</span> 직접 만들지 않고 상속해서 쓰는 클래스입니다.</li>}
            {doc.final && <li><span className="badge">final</span> 상속할 수 없는 클래스입니다.</li>}
            {doc.allowedFor && doc.allowedFor.length > 0 && <li><span className="badge">공개 범위</span> {doc.allowedFor.join(', ')} 용도로만 공개된 항목입니다.</li>}
          </ul>
        </section>
      )}

      {doc.examples && doc.examples.length > 0 && <section><h3>공식 예제</h3><OfficialExamples examples={doc.examples} /></section>}
      {doc.references && doc.references.length > 0 && <section><h3>참고 링크 <small className="muted">(공식)</small></h3><RefList refs={doc.references} docBase={p.vd.meta.docBase} known={known} onRef={(a) => onApi(a)} /></section>}

      <section>
        <h3>기본 정보</h3>
        <dl className="kv">
          <dt>정식 이름</dt><dd className="mono">{doc.name}</dd>
          <dt>라이브러리 · 종류</dt><dd>{doc.library} · {doc.kind}</dd>
          <dt>대상 UI5 버전</dt><dd>{p.vd.meta.version}</dd>
          <dt>도입 버전</dt><dd>{doc.since ?? '공식 자료에 표시 없음 (미확인)'}</dd>
          <dt>부모 클래스</dt><dd>{doc.extends ? <button className="link mono" onClick={() => onApi(doc.extends!)}>{doc.extends}</button> : '없음'}</dd>
          <dt>공식 원문</dt><dd><a href={doc.sourceUrl} target="_blank" rel="noreferrer noopener">{doc.sourceUrl} ↗</a></dd>
        </dl>
        {ko && ko.overview.related.length > 0 && (
          <><h4>관련 API</h4><ul className="plain">{ko.overview.related.map((r) => <li key={r.api}>{known.has(r.api) ? <button className="link mono" onClick={() => onApi(r.api)}>{r.api}</button> : <code>{r.api}</code>} — {r.role}</li>)}</ul></>
        )}
      </section>
    </div>
  );
}

function ProvenanceNote({ ko, status, minor, version }: { ko: KoDoc; status: KoStatus; minor: string; version: string }) {
  const stale = status === 'stale';
  return (
    <div className={`notice ${stale ? 'warn' : ''}`}>
      {stale
        ? <>⚠ 이 한국어 설명은 UI5 <b>{ko.baseMinor}</b> 원문을 기준으로 작성·대조했는데, 지금 보는 <b>{version}</b> 의 공식 원문과 <b>달라서 재검토가 필요</b>합니다. 한국어 문장이 이 버전과 맞지 않을 수 있으니 영문 원문과 공식 항목 목록을 기준으로 보세요. {minor === ko.baseMinor ? '(같은 버전인데 원문이 갱신됨)' : ''}</>
        : <>이 API 의 한국어 설명은 <b>{ko.provenance.generator}</b> 입니다 · 검토 상태: <b>{ko.provenance.review === 'reviewed' ? '검토 완료' : '미검토(초안)'}</b> · 공식 원문 대조: {ko.basedOn.stampedAt ?? ko.provenance.checkedAt} (UI5 {ko.baseMinor})</>}
      {ko.provenance.depth === 'brief' && !stale && <div className="small"><b>간단 설명</b> — 요약·언제 쓰는가·핵심 항목만 있고, 검증된 예제와 사용 순서는 아직 없습니다. 자세한 내용은 아래 공식 영문 구조와 원문 링크를 보세요.</div>}
    </div>
  );
}

/** 사용 시작하기: 모듈 경로(sap.ui.define), 생성자, XML 뷰 사용 형태. 공식 메타데이터로 기계 생성한 것이라 실행 검증은 안 했다. */
function Howto({ doc }: { doc: ApiDoc }) {
  const def = defineSnippet(doc), xml = xmlSnippet(doc), ctor = newSnippet(doc);
  if (!def && !xml && !ctor) return null;
  return (
    <section><h3>사용 시작하기 <small className="muted">(공식 메타데이터로 자동 생성 · 실행 검증 안 함)</small></h3>
      {doc.module && <p className="muted small">공식 모듈 경로: <code>{doc.module}</code></p>}
      {def && <Code code={def} label="JavaScript — sap.ui.define 으로 불러오기" />}
      {ctor && !def && <Code code={ctor} label="JavaScript — 생성자" />}
      {xml && <Code code={xml} label="XML 뷰 — 네임스페이스와 태그" />}
    </section>
  );
}
