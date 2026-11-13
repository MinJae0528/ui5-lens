import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_ROUTE as DEFAULT, parse, serialize, type Route } from './routeState';
export type { Route, Mode, KindFilter, Product, Ui5Mode, AbapZone } from './routeState';
export { PRODUCTS, UI5_MODES, productOf, modeForProduct, switchProduct, switchAbapZone } from './routeState';

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
