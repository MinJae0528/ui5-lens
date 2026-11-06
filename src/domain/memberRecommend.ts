// 기능 설명 → 추천 멤버(메서드·이벤트·속성). 클래스 추천(recommend.ts)과 같은 해석(한국어→영어 용어)을 쓰고,
// 멤버 이름·설명 첫 문장·소속 클래스 이름과의 겹침으로 점수를 매긴다. AI 호출 없음.
import { interpret, isCore, tokens, type IntentEntry, type UsedIntent } from './recommend.ts';
import { FLAG, type MemberRow } from './memberIndex.ts';

interface Doc { r: MemberRow; name: Set<string>; desc: string[]; cls: Set<string> }
export interface MemberRecIndex { docs: Doc[]; df: Map<string, number>; N: number }
export interface MemberRec { r: MemberRow; score: number; why: { name: string[]; desc: string[]; cls: string[] } }
export interface MemberRecResult { results: MemberRec[]; used: UsedIntent[]; terms: Map<string, number> }

/** 자동 생성 접근자는 제외한다(속성 쪽에서 이미 다뤄지고, 설명이 없어 점수가 의미 없음). */
export function buildMemberRecIndex(rows: MemberRow[]): MemberRecIndex {
  const docs: Doc[] = [];
  for (const r of rows) {
    if (r.f & FLAG.accessor) continue;
    docs.push({ r, name: new Set([...tokens(r.n), r.n.toLowerCase()]), desc: tokens(r.t), cls: new Set(tokens(r.c.split('.').pop() as string)) });
  }
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.name, ...d.desc, ...d.cls])) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df, N: docs.length };
}

export function recommendMembers(index: MemberRecIndex, query: string, intents: IntentEntry[], limit = 8): MemberRecResult {
  const { terms, used } = interpret(query, intents);
  if (terms.size === 0) return { results: [], used, terms };
  const out: MemberRec[] = [];
  for (const d of index.docs) {
    let score = 0, matched = 0, nameHits = 0;
    const why = { name: [] as string[], desc: [] as string[], cls: [] as string[] };
    for (const [t, w] of terms) {
      const idf = Math.log(1 + index.N / (1 + (index.df.get(t) ?? 0)));
      let s = 0;
      if (d.name.has(t)) { nameHits++; s += 3; why.name.push(t); }
      const tf = d.desc.filter((x) => x === t).length;
      if (tf) { s += 0.8 * Math.min(tf, 2); why.desc.push(t); }
      if (d.cls.has(t)) { s += 1.2; why.cls.push(t); }
      if (s) { matched++; score += idf * w * s; }
    }
    if (!matched || (used.length === 0 && terms.size >= 3 && matched < 2)) continue;
    score *= 0.5 + 0.5 * (matched / terms.size);
    score *= 1 + 0.6 * (nameHits / terms.size);
    if (d.r.f & FLAG.deprecated) score *= 0.35;
    if (!isCore(d.r.c)) score *= 0.7;
    if (d.r.k === 'm' || d.r.k === 'e') score *= 1.1; // 하고 싶은 일에는 메서드·이벤트가 속성보다 직접적인 경우가 많다
    out.push({ r: d.r, score, why });
  }
  out.sort((a, b) => b.score - a.score || a.r.c.localeCompare(b.r.c) || a.r.n.localeCompare(b.r.n));
  return { results: out.slice(0, limit), used, terms };
}
