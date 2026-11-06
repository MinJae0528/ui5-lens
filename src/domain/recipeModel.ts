// 작은 레시피 분류 모델(직접 학습, 외부 모델·라이브러리 없음). 질문 → 어느 레시피인지 점수.
// 특징: 조사를 뗀 글자 2·3-그램 + 영어 낱말. 가중치: 학습 표현에서 센 역문서빈도(idf). 점수: 레시피별 "가장 비슷한 표현"과 "평균 표현(중심)"의 코사인 유사도 평균.
// 모델 파일은 수백 KB 이고 브라우저에서 바로 계산한다. 학습은 scripts/train-recipe-model.mjs.

export interface RecipeModel {
  v: 1;
  vocab: string[];
  idf: number[];
  /** 레시피별: id, 중심 벡터(희소), 표현 벡터들(희소) */
  classes: { id: string; centroid: [number, number][]; samples: [number, number][][] }[];
}
/** “해당 없음” 학습용 특수 분류. 1등이 이것이면 레시피를 쓰지 않는다(모르는 질문 거절). */
export const NONE_ID = '__none__';
export interface ModelScore { id: string; score: number; nearest: number; centroid: number }

const PARTICLES = ['으로', '에서', '에게', '까지', '부터', '이나', '으로써', '을', '를', '이', '가', '은', '는', '에', '로', '의', '도', '만', '과', '와'];
const FILLER = ['하고싶어요', '하고싶어', '하고싶다', '싶어요', '싶어', '해주세요', '해줘', '알려줘', '어떻게', '방법'];

/** 낱말 끝 조사를 떼고, 군더더기를 지운 뒤 공백 없는 문자열과 영어 낱말을 돌려준다. */
export function prepare(text: string): { flat: string; words: string[] } {
  let s = text.toLowerCase();
  for (const f of FILLER) s = s.split(f).join(' ');
  const toks = s.split(/[^0-9a-z가-힣]+/).filter(Boolean).map((t) => {
    if (/^[a-z0-9]+$/.test(t)) return t;
    for (const p of PARTICLES) if (t.length > p.length + 1 && t.endsWith(p)) return t.slice(0, -p.length);
    return t;
  });
  return { flat: toks.join(''), words: toks.filter((t) => /^[a-z0-9]+$/.test(t)) };
}

export function features(text: string): string[] {
  const { flat, words } = prepare(text);
  const out: string[] = [];
  for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= flat.length; i++) out.push(flat.slice(i, i + n));
  if (flat.length === 1) out.push(flat);
  for (const w of words) out.push('w:' + w);
  return out;
}

/** 희소 벡터(특징 번호 → tf-idf, L2 정규화). 사전에 없는 특징은 버린다. */
export function vectorize(text: string, vocabIndex: Map<string, number>, idf: number[]): [number, number][] {
  const tf = new Map<number, number>();
  for (const f of features(text)) { const i = vocabIndex.get(f); if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1); }
  let norm = 0;
  const out: [number, number][] = [];
  for (const [i, c] of tf) { const w = (1 + Math.log(c)) * idf[i]; out.push([i, w]); norm += w * w; }
  norm = Math.sqrt(norm) || 1;
  return out.map(([i, w]): [number, number] => [i, w / norm]).sort((a, b) => a[0] - b[0]);
}

function cosine(a: [number, number][], b: Map<number, number>): number {
  let s = 0;
  for (const [i, w] of a) { const x = b.get(i); if (x) s += w * x; }
  return s;
}

export interface Trained { model: RecipeModel }
/** 학습: 표현(레시피 id → 문장들)으로 사전·idf·중심·표현 벡터를 만든다. */
export function train(samples: Record<string, string[]>): RecipeModel {
  const docs: { id: string; feats: string[] }[] = [];
  for (const [id, list] of Object.entries(samples)) for (const t of new Set(list)) docs.push({ id, feats: features(t) });
  const df = new Map<string, number>();
  for (const d of docs) for (const f of new Set(d.feats)) df.set(f, (df.get(f) ?? 0) + 1);
  const vocab = [...df.keys()].sort();
  const vocabIndex = new Map(vocab.map((f, i) => [f, i]));
  const N = docs.length;
  const idf = vocab.map((f) => Math.log((1 + N) / (1 + (df.get(f) as number))) + 1);
  const byId = new Map<string, [number, number][][]>();
  for (const [id, list] of Object.entries(samples)) {
    const vecs = [...new Set(list)].map((t) => vectorize(t, vocabIndex, idf)).filter((v) => v.length);
    byId.set(id, vecs);
  }
  const classes = [...byId.entries()].map(([id, vecs]) => {
    const sum = new Map<number, number>();
    for (const v of vecs) for (const [i, w] of v) sum.set(i, (sum.get(i) ?? 0) + w / vecs.length);
    let norm = 0; for (const w of sum.values()) norm += w * w; norm = Math.sqrt(norm) || 1;
    const centroid = [...sum.entries()].map(([i, w]): [number, number] => [i, w / norm]).filter(([, w]) => w > 0.01).sort((a, b) => a[0] - b[0]);
    return { id, centroid, samples: vecs };
  });
  return { v: 1, vocab, idf, classes };
}

/** 모델을 쓰기 좋게 풀어 둔 것(가장 느린 부분인 Map 변환을 한 번만 한다). */
export function prepareModel(m: RecipeModel) {
  return { m, vocabIndex: new Map(m.vocab.map((f, i) => [f, i])), classes: m.classes.map((c) => ({ id: c.id, centroid: c.centroid, samples: c.samples })) };
}
export type PreparedModel = ReturnType<typeof prepareModel>;

/** 질문에 대한 레시피별 점수(높은 순). 점수 = (가장 비슷한 표현 + 중심) / 2. */
export function scoreModel(pm: PreparedModel, query: string): ModelScore[] {
  const q = vectorize(query, pm.vocabIndex, pm.m.idf);
  if (!q.length) return [];
  const qm = new Map(q);
  const out = pm.classes.map((c) => {
    let nearest = 0;
    for (const s of c.samples) { const x = cosine(s, qm); if (x > nearest) nearest = x; }
    const centroid = cosine(c.centroid, qm);
    return { id: c.id, nearest, centroid, score: (nearest + centroid) / 2 };
  });
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** 확신 판단: 1등 점수가 minScore 이상이고 2등과 minMargin 이상 벌어져야 “이 레시피”라고 본다. */
export function decide(scores: ModelScore[], minScore: number, minMargin: number): ModelScore | null {
  if (!scores.length) return null;
  const [a, b] = scores;
  if (a.id === NONE_ID) return null;
  if (a.score < minScore) return null;
  if (b && a.score - b.score < minMargin) return null;
  return a;
}
