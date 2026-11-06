import { useEffect, useState } from 'react';
import { loadMemberRows } from '../data';
import type { MemberRow } from '../domain/memberIndex';

/** 멤버 색인(수만 개)은 필요할 때 한 번만 불러온다. enabled 가 false 면 아무것도 하지 않는다. */
export function useMemberRows(minor: string, enabled: boolean, retry = 0): { rows: MemberRow[] | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ rows: MemberRow[] | null; error: boolean; minor: string }>({ rows: null, error: false, minor });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setState((prev) => (prev.error ? { rows: null, error: false, minor } : prev));
    loadMemberRows(minor).then((rows) => live && setState({ rows, error: false, minor })).catch(() => live && setState({ rows: null, error: true, minor }));
    return () => { live = false; };
  }, [minor, enabled, retry]);
  const mine = state.minor === minor;
  return { rows: mine ? state.rows : null, error: mine && state.error, loading: enabled && !(mine && (state.rows || state.error)) };
}
