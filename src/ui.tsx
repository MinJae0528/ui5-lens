import { useState } from 'react';
import type { KoStatus } from './types';

/** 공식 자료에서 가져온 HTML(빌드 시 허용 태그만 남김). data-api 링크는 앱 내 이동으로 처리. */
export function Html({ html, onApi, known }: { html: string; onApi?: (name: string) => void; known?: Set<string> }) {
  return (
    <div
      className="rich"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a[data-api]') as HTMLElement | null;
        if (a) { e.preventDefault(); const n = a.getAttribute('data-api')!; if (!known || known.has(n)) onApi?.(n); }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
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

export function KoBadge({ status }: { status: KoStatus }) {
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

export function fmtDate(iso: string) { return iso.slice(0, 10); }
export const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
