import { useEffect, useMemo, useState } from 'react';
import { loadIntents } from '../data';
import type { MemberRow } from '../domain/memberIndex';
import { buildMemberRecIndex, recommendMembers, type MemberRecResult } from '../domain/memberRecommend';
import type { IntentEntry } from '../domain/recommend';

/** 기능 설명 → 추천 멤버(메서드·이벤트·속성). rows 는 useMemberRows 가 준 멤버 색인. 사전 로딩 실패는 결과 없음과 구분해 error 로 알린다. */
export function useMemberRec(rows: MemberRow[] | null, q: string, enabled: boolean, retry = 0): { res: MemberRecResult | null; error: boolean } {
  const [st, setSt] = useState<{ intents: IntentEntry[] | null; error: boolean }>({ intents: null, error: false });
  const need = enabled && q.trim().length >= 2 && !!rows;
  useEffect(() => {
    if (!need || st.intents) return;
    let live = true;
    loadIntents().then((intents) => live && setSt({ intents, error: false })).catch(() => live && setSt({ intents: null, error: true }));
    return () => { live = false; };
  }, [need, st.intents, retry]);
  const index = useMemo(() => (rows && enabled ? buildMemberRecIndex(rows) : null), [rows, enabled]);
  const res = useMemo(() => (need && index && st.intents ? recommendMembers(index, q, st.intents, 8) : null), [need, index, st.intents, q]);
  return { res, error: need && st.error };
}
