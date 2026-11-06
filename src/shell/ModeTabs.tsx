import type { Mode } from '../controller/route';

const TABS: { id: Mode; label: string; hint: string }[] = [
  { id: 'name', label: '이름·메서드 검색', hint: '알고 있는 이름으로' },
  { id: 'feature', label: '기능으로 추천', hint: '하고 싶은 일로' },
  { id: 'browse', label: 'API 탐색', hint: '목록을 훑어보며' },
  { id: 'guide', label: '문서 가이드', hint: '공식 문서 목차' },
];

/** ui5.sap.com 상단 탭처럼, 무엇을 어떻게 찾을지 고르는 줄. 탭을 누르면 그 방식의 화면으로 바뀐다. */
export function ModeTabs({ mode, onMode, docBase }: { mode: Mode; onMode: (m: Mode) => void; docBase: string }) {
  return (
    <nav className="mode-nav" aria-label="찾는 방법">
      <div className="mode-tabs" role="tablist" aria-label="찾는 방법">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`mode-${t.id}`} aria-selected={mode === t.id} className={`mode-tab ${mode === t.id ? 'on' : ''}`} onClick={() => onMode(t.id)}>
            <span className="mt-label">{t.label}</span><span className="mt-hint">{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="mode-links">
        <span className="muted small">공식 사이트</span>
        <a href={`${docBase}/#/api`} target="_blank" rel="noreferrer noopener">API Reference ↗</a>
        <a href={`${docBase}/#/controls`} target="_blank" rel="noreferrer noopener">Samples ↗</a>
        <a href={`${docBase}/#/topic`} target="_blank" rel="noreferrer noopener">Documentation ↗</a>
      </div>
    </nav>
  );
}
