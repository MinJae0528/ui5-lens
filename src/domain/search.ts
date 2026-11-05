import type { Alias, IndexEntry } from '../types.ts';

export type MatchTier = 1 | 2 | 3;
export interface Candidate { entry: IndexEntry; tier: MatchTier; reasons: string[] }
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

/**
 * 순위: 1) 전체 이름 일치  2) 마지막 이름(basename) 일치  3) 이름 일부 또는 한국어 별칭 일치
 * 각 API 는 한 번만 나타난다 (식별자 = 정식 전체 이름, 버전은 데이터셋 단위로 하나).
 */
export function search(index: IndexEntry[], aliases: Alias[], query: string): Candidate[] {
  const q = norm(query);
  if (!q) return [];
  const aliasHits = new Map<string, string[]>(); // api → 일치한 별칭
  for (const a of aliases) {
    const t = norm(a.term);
    if (t === q || t.includes(q) || (q.length >= 2 && q.includes(t))) {
      for (const api of a.apis) {
        const list = aliasHits.get(api) ?? [];
        list.push(a.term);
        aliasHits.set(api, list);
      }
    }
  }
  const out: Candidate[] = [];
  for (const e of index) {
    const full = e.n.toLowerCase(), base = e.b.toLowerCase();
    const reasons: string[] = [];
    let tier: MatchTier | 0 = 0;
    if (full === q) { tier = 1; reasons.push('전체 이름 일치'); }
    else if (base === q) { tier = 2; reasons.push('이름 일치'); }
    else if (full.includes(q) || base.includes(q)) { tier = 3; reasons.push('이름 일부 일치'); }
    const al = aliasHits.get(e.n);
    if (al) { reasons.push(`별칭 “${al.join('”, “')}”`); if (!tier) tier = 3; }
    if (tier) out.push({ entry: e, tier, reasons });
  }
  const hasAlias = (c: Candidate) => c.reasons.some((r) => r.startsWith('별칭'));
  out.sort((a, b) =>
    a.tier - b.tier ||
    Number(!!a.entry.d) - Number(!!b.entry.d) ||
    // 같은 순위 안에서는 별칭 일치 > 이름 접두 일치 > 한국어 설명 있는 것 순
    Number(!hasAlias(a)) - Number(!hasAlias(b)) ||
    Number(!a.entry.b.toLowerCase().startsWith(q)) - Number(!b.entry.b.toLowerCase().startsWith(q)) ||
    Number(a.entry.ko === 'none') - Number(b.entry.ko === 'none') ||
    a.entry.n.length - b.entry.n.length || a.entry.n.localeCompare(b.entry.n));
  return out;
}
