import { useCallback, useEffect, useState } from 'react';

/** URL 해시(#?q=Table&api=sap.m.Table&tab=methods&inh=1&mq=add)에 화면 상태를 담는다. 새로고침·뒤로가기에도 유지된다. */
export interface Route { v: string; q: string; api: string | null; tab: string; inh: boolean; mq: string; mode: '' | 'ask'; ask: string }
const DEFAULT: Route = { v: '', q: '', api: null, tab: 'overview', inh: false, mq: '', mode: '', ask: '' };

export function parse(hash: string): Route {
  const p = new URLSearchParams(hash.replace(/^#\??/, ''));
  return { v: p.get('v') ?? '', q: p.get('q') ?? '', api: p.get('api'), tab: p.get('tab') ?? 'overview', inh: p.get('inh') === '1', mq: p.get('mq') ?? '', mode: p.get('mode') === 'ask' ? 'ask' : '', ask: p.get('ask') ?? '' };
}
function serialize(r: Route) {
  const p = new URLSearchParams();
  if (r.v) p.set('v', r.v);
  if (r.q) p.set('q', r.q);
  if (r.mode === 'ask') { p.set('mode', 'ask'); if (r.ask) p.set('ask', r.ask); }
  if (r.api) p.set('api', r.api);
  if (r.api && r.tab !== 'overview') p.set('tab', r.tab);
  if (r.api && r.inh) p.set('inh', '1');
  if (r.api && r.mq) p.set('mq', r.mq);
  const s = p.toString();
  return s ? `#?${s}` : '#';
}

export function useRoute(): [Route, (patch: Partial<Route>, push?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => ({ ...DEFAULT, ...parse(location.hash) }));
  useEffect(() => {
    const on = () => setRoute({ ...DEFAULT, ...parse(location.hash) });
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); };
  }, []);
  const update = useCallback((patch: Partial<Route>, push = false) => {
    setRoute((prev) => {
      const next = { ...prev, ...patch };
      const url = serialize(next);
      if (url !== (location.hash || '#')) (push ? history.pushState : history.replaceState).call(history, null, '', url);
      return next;
    });
  }, []);
  return [route, update];
}
