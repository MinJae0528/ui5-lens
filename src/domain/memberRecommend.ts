// 기능 설명 → 추천 멤버(메서드·이벤트·속성). 클래스 추천(recommend.ts)과 같은 해석(한국어→영어 용어)을 쓰고,
// 멤버 이름·설명 첫 문장·소속 클래스 이름과의 겹침으로 점수를 매긴다. AI 호출 없음.
// 같은 (종류, 이름) 은 한 줄로 묶어 가장 점수가 높은 클래스를 대표로 보여 주고, 같은 이름을 선언한 클래스 수를 함께 알려 준다.
import { interpret, isCore, tokens, type IntentEntry, type UsedIntent } from './recommend.ts';
import { FLAG, type MemberRow } from './memberIndex.ts';

interface Doc { r: MemberRow; name: Set<string>; nameList: string[]; desc: string[]; cls: Set<string>; key: string }
export interface MemberRecIndex { docs: Doc[]; df: Map<string, number>; N: number; declCount: Map<string, number> }
export interface MemberRec { r: MemberRow; score: number; why: { name: string[]; desc: string[]; cls: string[] }; classes: number }
export interface MemberRecResult { results: MemberRec[]; used: UsedIntent[]; terms: Map<string, number> }

/**
 * 말뭉치에는 자동 생성 접근자(setX/getX…)도 넣는다. 접근자는 공식 설명이 없으므로, 대상 속성 이름을 설명 대신 쓴다
 * (setVisible → 속성 visible). 사용자가 흔히 찾는 것이 접근자인 경우가 많기 때문이다.
 */
export function buildMemberRecIndex(rows: MemberRow[]): MemberRecIndex {
  const docs: Doc[] = [];
  const declCount = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.k}:${r.n}`;
    declCount.set(key, (declCount.get(key) ?? 0) + 1);
    const accessor = !!(r.f & FLAG.accessor);
    const nameList = tokens(r.n);
    docs.push({ r, key, nameList, name: new Set([...nameList, r.n.toLowerCase()]), desc: accessor ? tokens(r.a ?? '') : tokens(r.t), cls: new Set(tokens(r.c.split('.').pop() as string)) });
  }
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.name, ...d.desc, ...d.cls])) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df, N: docs.length, declCount };
}

export function recommendMembers(index: MemberRecIndex, query: string, intents: IntentEntry[], limit = 8): MemberRecResult {
  const { terms, used } = interpret(query, intents);
  if (terms.size === 0) return { results: [], used, terms };
  const best = new Map<string, MemberRec>();
  for (const d of index.docs) {
    let score = 0, matched = 0, nameHits = 0, tokenHits = 0;
    const why = { name: [] as string[], desc: [] as string[], cls: [] as string[] };
    for (const [t, w] of terms) {
      const idf = Math.log(1 + index.N / (1 + (index.df.get(t) ?? 0)));
      let s = 0;
      if (d.name.has(t)) { nameHits++; s += 3; why.name.push(t); }
      if (d.nameList.includes(t)) tokenHits++;
      const tf = d.desc.filter((x) => x === t).length;
      if (tf) { s += 0.8 * Math.min(tf, 2); why.desc.push(t); }
      if (d.cls.has(t)) { s += 1.2; why.cls.push(t); }
      if (s) { matched++; score += idf * w * s; }
    }
    if (!matched || (used.length === 0 && terms.size >= 3 && matched < 2)) continue;
    score *= 0.5 + 0.5 * (matched / terms.size);
    score *= 1 + 0.6 * (nameHits / terms.size);
    // 이름 정밀도: 이름을 이루는 낱말 중 질문과 겹치는 비율. 질문과 무관한 낱말이 많이 붙은 긴 이름(isActionAreaAlwaysVisible)보다 setVisible 이 앞서게 한다.
    score *= 0.4 + 0.6 * (tokenHits / Math.max(1, d.nameList.length));
    // 공통 API 가산: 여러 클래스가 같은 이름을 선언하면 흔히 쓰는 API 일 가능성이 높다.
    score *= 1 + 0.12 * Math.log(index.declCount.get(d.key) ?? 1);
    if (d.r.f & FLAG.deprecated) score *= 0.35;
    if (!isCore(d.r.c)) score *= 0.7;
    if (d.r.k === 'm' || d.r.k === 'e') score *= 1.1; // 하고 싶은 일에는 메서드·이벤트가 속성보다 직접적인 경우가 많다
    const cur = best.get(d.key);
    if (!cur || score > cur.score) best.set(d.key, { r: d.r, score, why, classes: index.declCount.get(d.key) ?? 1 });
  }
  const out = [...best.values()].sort((a, b) => b.score - a.score || a.r.n.localeCompare(b.r.n) || a.r.c.localeCompare(b.r.c));
  return { results: out.slice(0, limit), used, terms };
}
