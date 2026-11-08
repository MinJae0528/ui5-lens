// 이름 앵커: 질문에 영어 클래스명(Dialog, BusyIndicator)이나 멤버명(nextStep, getRouter)이 직접 들어 있으면
// 공식 자료의 이름과 대조해 후보를 확정한다. 상속 사슬을 따라 올라가므로 Dialog 의 visible 은 Control#visible 로 찾는다.
// 한국어 설명만 있는 질문은 앵커가 없고, 기존 추천(recommend.ts, memberRecommend.ts)이 맡는다. AI 호출 없음.
import { buildMemberRecIndex, recommendMembers } from './memberRecommend.ts';
import { isCore, type IntentEntry } from './recommend.ts';
import { FLAG, type MemberRow } from './memberIndex.ts';

export interface AnchorRef { c: string; k: string | null; n: string | null }
export interface Anchor { strength: 'member' | 'class'; refs: AnchorRef[] }
export interface AnchorIndex { classByBase: Map<string, string[]>; ext: Map<string, string | null>; byClass: Map<string, MemberRow[]>; byName: Map<string, MemberRow[]> }

const KIND_ORDER: Record<string, number> = { m: 0, e: 1, p: 2, a: 3, s: 4 };
const KIND_NAME: Record<string, string> = { m: 'method', e: 'event', p: 'property', a: 'aggregation', s: 'association' };

export function buildAnchorIndex(entries: { n: string; b: string; x: string | null; k: string }[], rows: MemberRow[]): AnchorIndex {
  const classByBase = new Map<string, string[]>();
  const ext = new Map<string, string | null>();
  for (const e of entries) {
    ext.set(e.n, e.x ?? null);
    if (e.k !== 'class' && e.k !== 'namespace') continue;
    const key = e.b.toLowerCase();
    classByBase.set(key, [...(classByBase.get(key) ?? []), e.n]);
  }
  const byClass = new Map<string, MemberRow[]>();
  const byName = new Map<string, MemberRow[]>();
  for (const r of rows) {
    (byClass.get(r.c) ?? byClass.set(r.c, []).get(r.c)!).push(r);
    const key = r.n.toLowerCase();
    (byName.get(key) ?? byName.set(key, []).get(key)!).push(r);
  }
  return { classByBase, ext, byClass, byName };
}

const chainOf = (ix: AnchorIndex, c: string): string[] => {
  const out: string[] = [];
  for (let cur: string | null | undefined = c; cur && !out.includes(cur) && out.length < 12; cur = ix.ext.get(cur)) out.push(cur);
  return out;
};

const memberRef = (r: MemberRow): AnchorRef => ({ c: r.c, k: KIND_NAME[r.k], n: r.n });

export function anchor(ix: AnchorIndex, query: string, intents: IntentEntry[]): Anchor | null {
  const words = query.match(/[A-Za-z][A-Za-z0-9]+/g) ?? [];
  // 클래스명 후보: 대문자가 들어 있는 단어(일반 영어 단어 table, open 은 클래스로 보지 않는다)
  const classWords = words.filter((w) => /[A-Z]/.test(w) && ix.classByBase.has(w.toLowerCase()));
  let classes: string[] = [];
  let bestWord = '';
  for (const w of classWords) if (w.length > bestWord.length) { bestWord = w; classes = ix.classByBase.get(w.toLowerCase())!.filter((c, _i, l) => !l.some((o) => isCore(o)) || isCore(c)); }
  const classBase = bestWord.toLowerCase();
  const memberWords = words.filter((w) => w.length >= 2 && w.toLowerCase() !== classBase);

  if (classes.length) {
    const chain = [...new Set(classes.flatMap((c) => chainOf(ix, c)))];
    const chainRows = chain.flatMap((c) => ix.byClass.get(c) ?? []);
    const hits = memberWords.flatMap((w) => chainRows.filter((r) => r.n.toLowerCase() === w.toLowerCase()));
    if (hits.length) {
      // 같은 이름은 가장 가까운 선언을 쓴다(체인 순서), 종류는 메서드·이벤트·속성 순
      const seen = new Set<string>();
      const uniq = hits.filter((r) => { const key = `${r.k}:${r.n}`; return seen.has(key) ? false : (seen.add(key), true); })
        .sort((a, b) => KIND_ORDER[a.k] - KIND_ORDER[b.k]);
      return { strength: 'member', refs: uniq.slice(0, 3).map(memberRef) };
    }
    // 클래스만 있음: 클래스 자신 + 그 클래스(상속 포함) 안에서 기존 멤버 추천으로 고른 상위 멤버
    // 모든 클래스가 가진 기반 멤버(getMetadata, extend 등)와 자동 접근자는 빼고, 그 클래스 고유의 멤버 중에서 고른다
    const GENERIC = (c: string) => c.startsWith('sap.ui.base.') || c === 'sap.ui.core.Element' || c === 'sap.ui.core.Control' || c === 'sap.ui.core.Item';
    const own = chainRows.filter((r) => !GENERIC(r.c) && !(r.f & FLAG.accessor) && !(r.f & FLAG.static));
    const mem = recommendMembers(buildMemberRecIndex(own), query, intents, 2).results.map((m) => memberRef(m.r));
    return { strength: 'class', refs: [...mem, ...classes.slice(0, 1).map((c) => ({ c, k: null, n: null }))].slice(0, 3) };
  }
  // 클래스 없이 camelCase 멤버명이 직접 있음(nextStep, getRouter, onInit): 모든 클래스에서 같은 이름을 찾는다
  const camel = memberWords.filter((w) => /[a-z][A-Z]/.test(w) && ix.byName.has(w.toLowerCase()));
  if (camel.length) {
    const all = camel.flatMap((w) => ix.byName.get(w.toLowerCase())!).filter((r) => isCore(r.c));
    // 부모도 같은 멤버를 선언하면 자식은 재정의일 뿐이므로 가장 위에서 선언한 클래스만 남긴다
    const rows = all.filter((r) => !chainOf(ix, r.c).slice(1).some((p) => (ix.byClass.get(p) ?? []).some((q) => q.k === r.k && q.n === r.n)));
    const seen = new Set<string>();
    const uniq = rows.filter((r) => (seen.has(r.c) ? false : (seen.add(r.c), true)));
    if (uniq.length) return { strength: 'member', refs: uniq.slice(0, 3).map(memberRef) };
  }
  return null;
}
