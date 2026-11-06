// 레시피: 자주 하는 작업과 정답 API 를 사람이(여기서는 AI 가) 정리한 표. 정답 API 가 공식 자료에 있는지는 빌드가 검증한다.
// 질문이 표의 문구와 비슷할 때만(문자 2-그램 유사도) 이 표로 추천하고, 아니면 호출한 쪽이 일반 추정(정확도 낮음)으로 되돌아간다.

export interface RecipeAnswer { ref: string; why: string }
export interface Recipe { id: string; ko: string[]; answers: RecipeAnswer[] }
export type RefKind = 'method' | 'property' | 'event' | 'aggregation' | 'association';
export interface ParsedRef { c: string; k: RefKind | null; n: string | null }

const KINDS = new Set(['method', 'property', 'event', 'aggregation', 'association']);

/** "sap.m.Button#event:press" → {c, k:'event', n:'press'}; "sap.m.Dialog" → {c, k:null, n:null}. 형식이 틀리면 null. */
export function parseRef(ref: string): ParsedRef | null {
  const m = /^([A-Za-z0-9_$.]+)(?:#(method|property|event|aggregation|association):([A-Za-z0-9_$]+))?$/.exec(ref);
  if (!m) return null;
  if (m[2] && !KINDS.has(m[2])) return null;
  return { c: m[1], k: (m[2] as RefKind) ?? null, n: m[3] ?? null };
}

// 질문 끝에 붙는 군더더기(문구 비교에서 뺀다)
const FILLER = ['하고싶어요', '하고싶어', '하고싶다', '싶어요', '싶어', '해주세요', '해줘', '알려줘', '어떻게', '방법'];
export function normalize(s: string): string {
  let t = s.toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
  for (const f of FILLER) t = t.split(f).join('');
  return t;
}
export function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  if (s.length === 1) out.add(s);
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
export function dice(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export interface RecipeMatch { recipe: Recipe; score: number; trigger: string }
/** 질문과 문구가 비슷한 레시피를 점수순으로. minScore 미만은 버린다(표에 없는 작업으로 본다). */
export function matchRecipes(recipes: Recipe[], query: string, minScore = 0.34): RecipeMatch[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out: RecipeMatch[] = [];
  for (const r of recipes) {
    let best = 0, bestT = '';
    for (const t of r.ko) { const s = dice(q, normalize(t)); if (s > best) { best = s; bestT = t; } }
    if (best >= minScore) out.push({ recipe: r, score: best, trigger: bestT });
  }
  return out.sort((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id));
}

export interface PickedAnswer extends RecipeAnswer { recipeId: string; score: number; trigger: string }
/** 가장 비슷한 레시피의 정답부터 모아 최대 limit 개(중복 제거). 정답이 모자라면 다음 레시피에서 채운다. */
export function pickAnswers(matches: RecipeMatch[], limit = 3): PickedAnswer[] {
  const out: PickedAnswer[] = [], seen = new Set<string>();
  for (const m of matches) {
    for (const a of m.recipe.answers) {
      if (seen.has(a.ref)) continue;
      seen.add(a.ref);
      out.push({ ...a, recipeId: m.recipe.id, score: m.score, trigger: m.trigger });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
