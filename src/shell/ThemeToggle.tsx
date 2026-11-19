import { useTheme } from '../controller/useTheme';

const Sun = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4.2" fill="currentColor" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" fill="currentColor" />
  </svg>
);

/** 낮/밤 버튼 2개. 눌린 버튼이 지금 보이는 모드이고, 상태는 aria-pressed 로도 알린다. */
export function ThemeToggle() {
  const { theme, choose } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="화면 모드">
      <button type="button" className="tt-btn" id="theme-light" aria-pressed={theme === 'light'} aria-label="라이트 모드" title="라이트 모드" onClick={() => choose('light')}><Sun /></button>
      <button type="button" className="tt-btn" id="theme-dark" aria-pressed={theme === 'dark'} aria-label="다크 모드" title="다크 모드" onClick={() => choose('dark')}><Moon /></button>
    </div>
  );
}
