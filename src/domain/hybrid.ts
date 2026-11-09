// 화면용 하이브리드 추천: 질문에 적힌 영어 이름(앵커) → 학습한 소형 분류기의 레시피 → 둘 다 아니면 null(기존 추천이 맡는다).
// 기준값은 dev 로 고르고 test 에서 한 번 확인한 값이다(data/external/test-result.json). 생성형 AI 가 아니다.
import { anchor, type AnchorIndex, type AnchorRef } from './nameAnchor.ts';
import { decide, scoreModel, type PreparedModel } from './recipeModel.ts';
import { parseRef, type Recipe } from './recipes.ts';
import type { IntentEntry } from './recommend.ts';

export const MIN_SCORE = 0.35, MIN_MARGIN = 0.03;
export interface HybridCtx { pm: PreparedModel; recipes: Recipe[]; anchors: AnchorIndex; intents: IntentEntry[]; hasClass: (c: string) => boolean; hasMember: (c: string, kind: string, n: string) => boolean }
export interface HybridPick { ref: AnchorRef; why: string }
export type HybridResult = { source: 'name'; picks: HybridPick[] } | { source: 'recipe'; recipeId: string; score: number; picks: HybridPick[] } | null;

/** 선택한 버전에 실제로 있는 것만 남긴다(레시피 정답은 기준 버전에서만 검증되므로). */
const exists = (ctx: HybridCtx, r: AnchorRef) => (r.k && r.n ? ctx.hasMember(r.c, r.k, r.n) : ctx.hasClass(r.c));

export function recommendHybrid(ctx: HybridCtx, query: string): HybridResult {
  const q = query.trim();
  if (q.length < 2) return null;
  const an = anchor(ctx.anchors, q, ctx.intents);
  if (an?.strength === 'member') {
    const picks = an.refs.filter((r) => exists(ctx, r)).map((ref) => ({ ref, why: '질문에 적은 이름과 공식 자료의 이름이 일치합니다' }));
    if (picks.length) return { source: 'name', picks };
  }
  const d = decide(scoreModel(ctx.pm, q), MIN_SCORE, MIN_MARGIN);
  const recipe = d && ctx.recipes.find((r) => r.id === d.id);
  if (!d || !recipe) return null;
  const picks = recipe.answers.flatMap((a) => { const p = parseRef(a.ref); return p && exists(ctx, p) ? [{ ref: p, why: a.why }] : []; });
  return picks.length ? { source: 'recipe', recipeId: d.id, score: d.score, picks } : null;
}
