// 문서 가이드(ui5.sap.com Documentation) 목차: 트리를 펼쳐 목록으로 만들고, 제목으로 찾는 순수 로직.
// 본문은 복사하지 않는다 — 목차와 공식 문서 링크만 제공한다.
import type { TopicNode } from '../types.ts';

export interface FlatTopic { key: string; text: string; depth: number; path: string[]; hasChildren: boolean }
export const isTopicKey = (k: string): boolean => /^[0-9a-f]{32}$/.test(k);
export const topicUrl = (docBase: string, key: string): string => `${docBase}/#/topic/${key}`;

export function flattenTopics(tree: TopicNode[]): FlatTopic[] {
  const out: FlatTopic[] = [];
  const walk = (nodes: TopicNode[], depth: number, path: string[]) => {
    for (const [key, text, kids] of nodes) {
      out.push({ key, text, depth, path, hasChildren: !!kids && kids.length > 0 });
      if (kids) walk(kids, depth + 1, [...path, text]);
    }
  };
  walk(tree, 0, []);
  return out;
}

/** 제목(과 상위 제목 경로)에 검색어의 모든 낱말이 들어 있는 항목. 제목 일치를 경로 일치보다 위에 둔다. */
export function searchTopics(flat: FlatTopic[], query: string, limit = 80): FlatTopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: [number, FlatTopic][] = [];
  for (const t of flat) {
    const title = t.text.toLowerCase(), path = t.path.join(' ').toLowerCase();
    if (!words.every((w) => title.includes(w) || path.includes(w))) continue;
    const inTitle = words.filter((w) => title.includes(w)).length;
    const score = inTitle * 10 + (title.startsWith(words[0]) ? 5 : 0) - t.depth * 0.1 - Math.min(title.length, 80) * 0.01;
    scored.push([score, t]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map((x) => x[1]);
}

export function findTopic(flat: FlatTopic[], key: string): FlatTopic | undefined { return flat.find((t) => t.key === key); }

/** key 의 직계 하위 항목 */
export function childrenOf(tree: TopicNode[], key: string): { key: string; text: string }[] {
  const find = (nodes: TopicNode[]): TopicNode | undefined => {
    for (const n of nodes) { if (n[0] === key) return n; if (n[2]) { const r = find(n[2]); if (r) return r; } }
    return undefined;
  };
  const n = find(tree);
  return n && n[2] ? n[2].map(([k, t]) => ({ key: k, text: t })) : [];
}
