import { useCallback, useEffect, useState } from 'react';
import { THEME_KEY, parseTheme, resolveTheme, type Theme } from '../domain/theme';

const MQ = '(prefers-color-scheme: dark)';
const readStored = (): Theme | null => { try { return parseTheme(localStorage.getItem(THEME_KEY)); } catch { return null; } };
const writeStored = (t: Theme) => { try { localStorage.setItem(THEME_KEY, t); } catch { /* 저장 불가 환경이면 이번 방문에서만 유지 */ } };
const systemDark = () => { try { return window.matchMedia(MQ).matches; } catch { return false; } };
const apply = (t: Theme) => { document.documentElement.dataset.theme = t; };

/** 첫 화면이 그려지기 전에 호출해 저장된 선택(없으면 시스템 설정)을 적용한다. 인라인 스크립트가 아니라 CSP 를 건드리지 않는다. */
export function initTheme() { apply(resolveTheme(readStored(), systemDark())); }

/** 현재 모드와 선택 함수. 고르기 전에는 시스템 설정 변화를 따라가고, 고른 뒤에는 고른 값이 우선한다. */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(readStored);
  const [sysDark, setSysDark] = useState<boolean>(systemDark);
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia(MQ); } catch { return; }
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const theme = resolveTheme(stored, sysDark);
  useEffect(() => { apply(theme); }, [theme]);
  const choose = useCallback((t: Theme) => { setStored(t); writeStored(t); }, []);
  return { theme, choose };
}
