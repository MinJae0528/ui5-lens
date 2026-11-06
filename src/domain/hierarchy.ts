// 상속 관계(extends)로 후손·조상 클래스를 구하는 순수 로직.
export interface HierEntry { n: string; x: string | null }

export function childrenMap(index: HierEntry[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of index) if (e.x) { const l = m.get(e.x); if (l) l.push(e.n); else m.set(e.x, [e.n]); }
  return m;
}

/** base 를 (직간접으로) 상속하는 모든 클래스. 순환이 있어도 끝난다. */
export function descendants(index: HierEntry[], base: string): string[] {
  const ch = childrenMap(index);
  const out: string[] = [], seen = new Set<string>([base]);
  const queue = [base];
  while (queue.length) {
    for (const c of ch.get(queue.shift() as string) ?? []) if (!seen.has(c)) { seen.add(c); out.push(c); queue.push(c); }
  }
  return out;
}

/** name 의 조상 체인(가까운 부모부터). 인덱스에 없는 부모에서 멈춘다. */
export function ancestors(index: HierEntry[], name: string): string[] {
  const by = new Map(index.map((e) => [e.n, e]));
  const out: string[] = [], seen = new Set<string>([name]);
  let cur = by.get(name)?.x ?? null;
  while (cur && !seen.has(cur)) { out.push(cur); seen.add(cur); cur = by.get(cur)?.x ?? null; }
  return out;
}
