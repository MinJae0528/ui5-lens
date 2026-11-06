import { useEffect, useMemo, useState } from 'react';
import { loadIntents, loadRecIndex } from '../data';
import { recommend, type IntentEntry, type RecIndex, type RecResult } from '../domain/recommend';

/** 질문(q)을 기능 설명으로 보고 추천을 계산한다. enabled 가 false 면 자료도 불러오지 않는다. */
export function useRec(minor: string, q: string, enabled: boolean, retry = 0): { loading: boolean; error: boolean; res: RecResult | null } {
  const [data, setData] = useState<{ idx: RecIndex; intents: IntentEntry[] } | 'err' | null>(null);
  const need = enabled && q.trim().length >= 2;
  useEffect(() => {
    if (!need) return;
    let live = true;
    setData(null);
    Promise.all([loadRecIndex(minor), loadIntents()]).then(([idx, intents]) => live && setData({ idx, intents })).catch(() => live && setData('err'));
    return () => { live = false; };
  }, [minor, need, retry]);
  const res = useMemo(() => (need && data && data !== 'err' ? recommend(data.idx, q, data.intents, 8) : null), [need, data, q]);
  return { loading: need && data === null, error: need && data === 'err', res };
}
