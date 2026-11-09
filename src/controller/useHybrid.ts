import { useEffect, useMemo, useState } from 'react';
import { loadHybrid } from '../data';
import { recommendHybrid, type HybridCtx, type HybridResult } from '../domain/hybrid';

/** 질문 → 이름 일치 또는 학습한 레시피의 정답. 자료를 못 불러와도 기존 추천은 그대로 쓰므로 실패는 조용히 결과 없음으로 둔다(알림은 기존 추천 쪽). */
export function useHybrid(minor: string, q: string, enabled: boolean, retry = 0): { loading: boolean; res: HybridResult } {
  const [ctx, setCtx] = useState<HybridCtx | 'err' | null>(null);
  const need = enabled && q.trim().length >= 2;
  useEffect(() => {
    if (!need) return;
    let live = true;
    loadHybrid(minor).then((c) => live && setCtx(c)).catch(() => live && setCtx('err'));
    return () => { live = false; };
  }, [minor, need, retry]);
  const res = useMemo(() => (need && ctx && ctx !== 'err' ? recommendHybrid(ctx, q) : null), [need, ctx, q]);
  return { loading: need && ctx === null, res };
}
