import { topicUrl } from '../domain/topics';
import type { ExampleCode, Ref } from '../types';
import { Code } from '../ui';

const isHttp = (u: string | undefined): u is string => !!u && /^https?:\/\/[^\s"'<>]+$/.test(u);

/** 공식 참고 링크(문서 가이드·Fiori 디자인 가이드·다른 API). 외부 주소는 http(s) 만 링크로 만든다. */
export function RefList({ refs, docBase, known, onRef }: { refs: Ref[] | undefined; docBase: string; known: Set<string>; onRef: (api: string, member: string | null) => void }) {
  if (!refs || refs.length === 0) return null;
  return (
    <ul className="plain refs">
      {refs.map((r, i) => {
        if (r.kind === 'topic' && r.key && /^[0-9a-f]{32}$/.test(r.key)) return <li key={i}><span className="badge">문서 가이드</span> <a href={topicUrl(docBase, r.key)} target="_blank" rel="noreferrer noopener">{r.text} ↗</a></li>;
        if (r.kind === 'fiori' && isHttp(r.url)) return <li key={i}><span className="badge">Fiori 디자인 가이드</span> <a href={r.url} target="_blank" rel="noreferrer noopener">{r.text} ↗</a></li>;
        if (r.kind === 'url' && isHttp(r.url)) return <li key={i}><span className="badge">외부 링크</span> <a href={r.url} target="_blank" rel="noreferrer noopener">{r.text} ↗</a></li>;
        if (r.kind === 'api' && r.api) {
          const label = r.member ? `${r.api}#${r.member}` : r.api;
          return <li key={i}><span className="badge">다른 API</span> {known.has(r.api) ? <button className="link mono" onClick={() => onRef(r.api as string, r.member ?? null)}>{label}</button> : <code>{label}</code>}</li>;
        }
        return <li key={i}>{r.text}</li>;
      })}
    </ul>
  );
}

/** 공식 api.json 에 실린 예제 코드(있을 때만). */
export function OfficialExamples({ examples }: { examples: ExampleCode[] | undefined }) {
  if (!examples || examples.length === 0) return null;
  return (
    <div className="stack">
      {examples.map((e, i) => <Code key={i} code={e.text} label={`공식 예제${e.caption ? ` — ${e.caption}` : ''} (api.json 원문)`} />)}
    </div>
  );
}
