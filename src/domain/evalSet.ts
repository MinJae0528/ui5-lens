// 외부(다른 AI)가 만든 평가 질문·학습 표현 파일의 형식 검증과 분할. 순수 함수.
import { parseRef } from './recipes.ts';

export interface ExtQuestion { q: string; answers: string[]; kind: 'task' | 'none'; area?: string }
export interface ExtTrain { paraphrases: Record<string, string[]>; negatives: string[] }

/** 같은 질문은 늘 같은 쪽으로: dev(기준 정하기·점검용)와 test(최종 한 번 측정용)로 가른다. 누가 열어도 결과가 같다. */
export function splitOf(q: string): 'dev' | 'test' {
  let h = 2166136261;
  for (let i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % 2 === 0 ? 'dev' : 'test';
}

export interface EvalIssue { index: number; problem: string }
export function validateEval(obj: unknown): { questions: ExtQuestion[]; issues: EvalIssue[] } {
  const issues: EvalIssue[] = [];
  const out: ExtQuestion[] = [];
  const list = (obj as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return { questions: [], issues: [{ index: -1, problem: 'questions 배열이 없음' }] };
  const seen = new Set<string>();
  list.forEach((it: any, index: number) => {
    const q = typeof it?.q === 'string' ? it.q.trim() : '';
    if (q.length < 2 || q.length > 200) { issues.push({ index, problem: '질문 길이가 2~200자가 아님' }); return; }
    if (seen.has(q)) { issues.push({ index, problem: '중복 질문' }); return; }
    const kind = it.kind === 'none' ? 'none' : it.kind === 'task' ? 'task' : null;
    if (!kind) { issues.push({ index, problem: 'kind 는 task 또는 none' }); return; }
    const answers: string[] = Array.isArray(it.answers) ? it.answers.filter((a: unknown) => typeof a === 'string') : [];
    if (kind === 'task' && (answers.length < 1 || answers.length > 3)) { issues.push({ index, problem: 'task 는 정답 후보 1~3개' }); return; }
    if (kind === 'none' && answers.length) { issues.push({ index, problem: 'none 은 정답이 없어야 함' }); return; }
    for (const a of answers) if (!parseRef(a)) { issues.push({ index, problem: `정답 형식 오류: ${a}` }); return; }
    seen.add(q);
    out.push({ q, answers, kind, area: typeof it.area === 'string' ? it.area : undefined });
  });
  return { questions: out, issues };
}

export function validateTrain(obj: unknown, recipeIds: Set<string>): { train: ExtTrain; issues: string[] } {
  const issues: string[] = [];
  const train: ExtTrain = { paraphrases: {}, negatives: [] };
  const p = (obj as { paraphrases?: Record<string, unknown> })?.paraphrases ?? {};
  for (const [id, list] of Object.entries(p)) {
    if (!recipeIds.has(id)) { issues.push(`알 수 없는 레시피 id: ${id}`); continue; }
    if (!Array.isArray(list)) { issues.push(`${id}: 배열이 아님`); continue; }
    train.paraphrases[id] = [...new Set(list.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 120))];
  }
  const n = (obj as { negatives?: unknown })?.negatives;
  if (Array.isArray(n)) train.negatives = [...new Set(n.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 120))];
  return { train, issues };
}
