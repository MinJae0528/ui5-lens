// 기능 설명 → 추천 API. 외부 AI 없이, 선택한 버전의 "공식" 이름·설명·멤버 이름과의 일치로 점수를 매긴다.
// 한국어 질문은 data/intents.json(한국어→영어 용어 사전)으로 영어 용어에 연결한다.
// 순수 함수(브라우저·네트워크 비의존)라 앱, Node 평가 스크립트, 단위 테스트가 같은 코드를 쓴다.

export interface IntentEntry { ko: string[]; en: string[] }
/** c: 0 class / 1 control / 2 element / 3 namespace(함수 모음). dp: deprecated 표시(버전 또는 1). t: 설명 앞부분. m: 멤버 이름들. */
export interface CorpusEntry { n: string; c: 0 | 1 | 2 | 3; dp?: string | number; t: string; m: string }
export interface Rec { c: CorpusEntry; score: number; why: { name: string[]; desc: string[]; mem: string[] }; matched: number }
export interface UsedIntent { ko: string; en: string[] }
export interface RecResult { results: Rec[]; used: UsedIntent[]; terms: Map<string, number>; unknown: boolean; hasKorean: boolean }
interface Doc { c: CorpusEntry; base: string; name: Set<string>; desc: string[]; mem: Set<string> }
export interface RecIndex { docs: Doc[]; df: Map<string, number>; N: number }

const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'how', 'do', 'i', 'want', 'add', 'make', 'create', 'show', 'use', 'can', 'is', 'it', 'my', 'that', 'this', 'when', 'user', 'users', 'which', 'what', 'need', 'api', 'ui5', 'not', 'no', 'be', 'are', 'was', 'you', 'your', 'from', 'but', 'if', 'as', 'at', 'by', 'so', 'any', 'all', 'will', 'should', 'would', 'has', 'have', 'had', 'get', 'put', 'out', 'up', 'one']);

export const stem = (w: string): string => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export function tokens(text: string): string[] {
  return (text || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .map(stem);
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 질문 → 검색 용어(가중치) + 해석 설명 */
export function interpret(query: string, intents: IntentEntry[]): { terms: Map<string, number>; used: UsedIntent[]; hasKorean: boolean } {
  const q = norm(query);
  const terms = new Map<string, number>();
  const used: UsedIntent[] = [];
  const add = (t: string, w: number) => terms.set(t, Math.max(terms.get(t) ?? 0, w));
  for (const it of intents) {
    const hit = it.ko.find((k) => q.includes(norm(k)));
    if (!hit) continue;
    used.push({ ko: hit, en: it.en });
    for (const w of it.en) for (const t of tokens(w)) add(t, 1);
  }
  // 질문에 직접 쓴 영어 단어
  const eng = query.match(/[A-Za-z][A-Za-z0-9]+/g) || [];
  for (const w of eng) for (const t of tokens(w)) if (!STOP.has(t)) add(t, 1.2);
  return { terms, used, hasKorean: /[가-힣]/.test(query) };
}

// 입문자가 먼저 쓰는 기본 라이브러리를 우선한다(특수 라이브러리는 감점). 점수 설명에도 이 사실을 밝힌다.
export const CORE_PREFIXES = ['sap.m.', 'sap.f.', 'sap.ui.core.', 'sap.ui.table.', 'sap.ui.layout.', 'sap.ui.unified.', 'sap.uxap.', 'sap.tnt.', 'sap.ui.model.', 'sap.ui.codeeditor.', 'sap.ui.integration.', 'sap.viz.', 'sap.chart.', 'sap.suite.ui.microchart.'];
export const isCore = (name: string): boolean => CORE_PREFIXES.some((p) => name.startsWith(p));

export function buildIndex(corpus: CorpusEntry[]): RecIndex {
  const docs: Doc[] = corpus.map((c) => {
    const base = c.n.split('.').pop() as string;
    return { c, base: base.toLowerCase(), name: new Set([...tokens(base), base.toLowerCase()]), desc: tokens(c.t), mem: new Set(tokens(c.m)) };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.name, ...d.desc, ...d.mem])) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df, N: docs.length };
}

export function recommend(index: RecIndex, query: string, intents: IntentEntry[], limit = 8): RecResult {
  const { terms, used, hasKorean } = interpret(query, intents);
  if (terms.size === 0) return { results: [], used, terms, unknown: true, hasKorean };
  const out: Rec[] = [];
  for (const d of index.docs) {
    let score = 0, matched = 0, nameHits = 0;
    const why = { name: [] as string[], desc: [] as string[], mem: [] as string[] };
    for (const [t, w] of terms) {
      const idf = Math.log(1 + index.N / (1 + (index.df.get(t) ?? 0)));
      let s = 0;
      if (d.name.has(t)) { nameHits++; s += 3; why.name.push(t); if (t === d.base) s += 3; }
      const tf = d.desc.filter((x) => x === t).length;
      if (tf) { s += 0.8 * Math.min(tf, 2); why.desc.push(t); }
      if (d.mem.has(t)) { s += 0.6; why.mem.push(t); }
      if (s) { matched++; score += idf * w * s; }
    }
    // 사전이 붙인 용어는 서로 대체 가능한 동의어라 하나만 겹쳐도 된다. 사전 해석이 없는 자유 영어 입력(3단어 이상)만 최소 2개 겹침을 요구한다.
    if (!matched || (used.length === 0 && terms.size >= 3 && matched < 2)) continue;
    score *= 0.5 + 0.5 * (matched / terms.size);
    score *= 1 + 0.6 * (nameHits / terms.size);
    score *= d.c.c === 1 ? 1.25 : d.c.c === 2 || d.c.c === 3 ? 1 : 0.7;
    if (d.c.dp) score *= 0.35;
    if (!isCore(d.c.n)) score *= 0.7;
    out.push({ c: d.c, score, why, matched });
  }
  out.sort((a, b) => b.score - a.score || a.c.n.localeCompare(b.c.n));
  return { results: out.slice(0, limit), used, terms, unknown: false, hasKorean };
}
