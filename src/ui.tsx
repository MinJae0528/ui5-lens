import { useMemo, useState } from 'react';
import { sanitizeHtml } from './security/sanitize';
import type { KoStatus } from './types';

/** 공식 자료에서 가져온 HTML(빌드 시 + 브라우저에서 이중으로 허용 태그만 남김). data-api 링크는 앱 내 이동으로 처리. */
export function Html({ html, onApi, known }: { html: string; onApi?: (name: string) => void; known?: Set<string> }) {
  // 빌드 때 한 번 걸러진 HTML 이지만, 브라우저에서 허용 목록으로 한 번 더 거른다(이중 방어).
  const safe = useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div
      className="rich"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a[data-api]') as HTMLElement | null;
        if (a) { e.preventDefault(); const n = a.getAttribute('data-api')!; if (!known || known.has(n)) onApi?.(n); }
      }}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); }
        catch {
          const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
        }
        setDone(true); setTimeout(() => setDone(false), 1500);
      }}
    >{done ? '복사됨 ✓' : label}</button>
  );
}

export function Code({ code, label }: { code: string; label?: string }) {
  return (
    <div className="code">
      <div className="code-bar"><span>{label ?? ''}</span><CopyButton text={code} label="코드 복사" /></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

/** mt: 손으로 쓴 한국어 문서는 없지만 자동 번역(첫 문장)이 있을 때 */
export function KoBadge({ status, mt }: { status: KoStatus; mt?: boolean }) {
  if (status === 'none' && mt) return <span className="badge b-draft" title="공식 설명의 첫 문장을 AI 로 번역했습니다">자동 번역 · AI 초안 · 미검토</span>;
  const map: Record<KoStatus, [string, string]> = {
    none: ['한국어 설명 준비 안 됨', 'b-none'],
    draft: ['한국어 · AI 초안 · 미검토', 'b-draft'],
    reviewed: ['한국어 · 검토 완료', 'b-ok'],
    stale: ['원문 변경됨 · 재검토 필요', 'b-warn'],
  };
  const [t, c] = map[status];
  return <span className={`badge ${c}`}>{t}</span>;
}

export function DepBadge({ since }: { since: string | true | null | undefined }) {
  if (!since) return null;
  return <span className="badge b-dep" title="공식 자료에 deprecated 로 표시됨">deprecated{since === true ? '' : ` ${since}`}</span>;
}

export function Origin({ kind }: { kind?: string }) {
  if (kind === 'official') return <span className="badge b-off">공식 문서에 명시</span>;
  return <span className="badge b-svc">서비스 작성 (공식 아님)</span>;
}

