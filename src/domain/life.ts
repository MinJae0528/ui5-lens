// 버전별 존재 여부(공식 api.json 을 버전끼리 비교한 값)를 해석하는 순수 로직.
// 칸 문자열: 버전 순서(최신 → 과거)대로 0 없음 / 1 있음 / 2 deprecated.

/** 받아 둔 버전 순서와 표시 이름. 화면의 Global 에서 만들어 넘긴다(이 모듈은 화면·네트워크를 모른다). */
export interface LifeContext { order: string[]; versions: { minor: string; version: string; lts?: boolean }[] }
export interface LifeCell { m: string; st: string; version: string; lts: boolean }

export interface LifeNone { none: true; cells: LifeCell[] }
export interface LifeInfo {
  none: false; cells: LifeCell[]; oldest: LifeCell; newest: LifeCell;
  intro: string; introExact: boolean; removed: string | null; dep: string | null; presentCount: number;
}

export const minorNum = (m: string): number => { const [a, b] = m.split('.').map(Number); return a * 1000 + b; };
const adjacent = (a: string, b: string) => Math.abs(minorNum(a) - minorNum(b)) === 1;

export function cellsOf(row: string, ctx: LifeContext): LifeCell[] {
  const out: LifeCell[] = [];
  ctx.order.forEach((m, i) => {
    const v = ctx.versions.find((x) => x.minor === m);
    if (v) out.push({ m, st: row[i] ?? '0', version: v.version, lts: !!v.lts });
  });
  return out;
}

/**
 * 도입·deprecated·제거 시점을 설명한다.
 * 서버에 없는 마이너 버전(예: 1.78)은 비교할 수 없으므로, 인접한 받아 둔 버전이 연속 마이너가 아니면
 * 정확한 시점이 아니라 “두 버전 사이”로, 가장 오래된 받아 둔 버전에서 이미 있으면 “≤”로 표기한다.
 * 이 값은 공식 api.json 을 Lens 가 비교해 계산한 파생 판단이다(공식이 명시한 값이 아님).
 */
export function describeLife(row: string, ctx: LifeContext): LifeNone | LifeInfo {
  const cells = cellsOf(row, ctx);
  const firstPresent = cells.findIndex((c) => c.st !== '0'); // 가장 최신 존재
  if (firstPresent < 0) return { none: true, cells };
  const lastPresent = cells.length - 1 - [...cells].reverse().findIndex((c) => c.st !== '0'); // 가장 과거 존재
  const oldest = cells[lastPresent], newest = cells[firstPresent];
  const older = cells[lastPresent + 1]; // 그 직전(더 과거) 받아 둔 버전
  const newer = firstPresent > 0 ? cells[firstPresent - 1] : null;

  let intro: string, introExact = false;
  if (!older) intro = `≤ ${oldest.version.replace(/\.\d+$/, '')} — 받아 둔 가장 오래된 버전부터 있어, 그 이전 도입 여부는 확인할 수 없음`;
  else if (adjacent(older.m, oldest.m)) { intro = `${oldest.m} 에서 도입된 것으로 확인`; introExact = true; }
  else intro = `${older.m}(없음)과 ${oldest.m}(있음) 사이에 도입 — 그 사이 마이너 버전은 서버에 없어 정확한 시점은 알 수 없음`;

  let removed: string | null = null;
  if (newer) removed = adjacent(newer.m, newest.m) ? `${newest.m} 까지 있고 ${newer.m} 부터 없음` : `${newest.m}(있음)과 ${newer.m}(없음) 사이에 사라짐 — 정확한 시점은 알 수 없음`;

  let dep: string | null = null;
  if (cells.some((c) => c.st === '2')) {
    const depIdx = cells.length - 1 - [...cells].reverse().findIndex((c) => c.st === '2'); // 가장 과거의 deprecated 칸
    const d = cells[depIdx], before = cells[depIdx + 1];
    dep = !before || before.st === '2' ? `${d.m} 이(가) 받아 둔 버전 중 처음 deprecated 로 표시됨` : adjacent(before.m, d.m) ? `${d.m} 에서 deprecated 로 표시되기 시작` : `${before.m} 과 ${d.m} 사이에 deprecated 표시 시작`;
  }
  return { none: false, cells, oldest, newest, intro, introExact, removed, dep, presentCount: cells.filter((c) => c.st !== '0').length };
}

/** 공식 since(예: "1.16.3")가 실제 첫 확인 버전보다 늦은 경우(= 공식 표기보다 이른 버전에도 있음) */
export function sinceConflict(oldestMinor: string, since: string | null): boolean {
  if (!since) return false;
  return minorNum(oldestMinor) < minorNum(since.split('.').slice(0, 2).join('.'));
}

export interface MissingRow { key: string; kindChar: string; name: string; newest: string; oldest: string; n: number; relation: 'removed' | 'not-yet' | 'gap' } // removed: 이 버전보다 과거에만 있음 / not-yet: 이 버전보다 최신에만 있음

/** 지금 보는 버전(minor)에는 없지만 다른 받아 둔 버전에는 있던 멤버. life: 멤버키 → 칸 문자열 */
export function missingInVersion(life: Record<string, string>, order: string[], minor: string): MissingRow[] {
  const ci = order.indexOf(minor);
  return Object.entries(life)
    .filter(([, r]) => r[ci] === '0' && /[12]/.test(r))
    .map(([key, r]) => {
      const vs = order.filter((_, i) => r[i] !== '0');
      const newest = vs[0], oldest = vs[vs.length - 1];
      // 인덱스가 작을수록 최신. 있는 버전이 전부 현재보다 과거면 "사라짐", 전부 현재보다 최신이면 "아직 도입 전", 걸쳐 있으면 "중간".
      const relation = ci < order.indexOf(newest) ? 'removed' : ci > order.indexOf(oldest) ? 'not-yet' : 'gap';
      return { key, kindChar: key[0], name: key.slice(2), newest, oldest, n: vs.length, relation } as MissingRow;
    });
}
