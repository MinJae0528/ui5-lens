// tcode 사전 검색(순수 함수). 이름(se11)·하고 싶은 일(테이블 보기)·명령(/nse38)을 같은 입력칸에서 찾는다.
import type { Tcode } from '../types';

export interface CmdQuery { /** 명령 부분: '/', '/n', '/o', '/i', '/nend', '/nex' */ cmd: string; /** 뒤에 붙인 tcode(없으면 빈 문자열) */ rest: string }

/** "/nse38" 처럼 명령(/n /o /i /nend /nex)과 tcode 를 붙여 적었는지 해석한다. 아니면 null. */
export function parseCmdQuery(q: string): CmdQuery | null {
  const m = /^\/(nend|nex|n|o|i)?([a-z0-9_]*)$/.exec(q.trim().toLowerCase());
  return m ? { cmd: m[1] ? `/${m[1]}` : '/', rest: m[2] } : null;
}

function haystack(e: Tcode): string {
  return [e.id, e.code, e.name, e.summary, e.group, e.keywords, ...e.does, ...e.routes.map((r) => `${r.input} ${r.opens}`), ...(e.commands ?? []).map((c) => `${c.cmd} ${c.does}`)].join(' ').toLowerCase();
}

/** 띄어 쓴 낱말은 모두 들어 있어야 맞다(테이블 보기 → "테이블 … 보기"). 명령을 붙여 적으면 명령 항목과 그 tcode 항목이 맞는다. */
export function matchTcode(e: Tcode, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const pc = parseCmdQuery(t);
  if (pc) return e.kind === 'command' || (!!pc.rest && e.id.startsWith(pc.rest));
  return t.split(/\s+/).every((w) => haystack(e).includes(w));
}

/** 검색 결과. 이름이 정확히 같은 tcode 를 맨 위로, 명령을 붙여 적었으면 명령 항목을 맨 위로 올린다. */
export function searchTcodes(entries: Tcode[], q: string, group = ''): Tcode[] {
  const t = q.trim().toLowerCase();
  const pc = parseCmdQuery(t);
  const out = entries.filter((e) => (!group || e.group === group) && matchTcode(e, q));
  const rank = (e: Tcode) => (pc ? (e.kind === 'command' ? 0 : e.id === pc.rest ? 1 : 2) : e.id === t ? 0 : e.id.startsWith(t) && t ? 1 : 2);
  return out.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e);
}

/** "/nse38 = /n (…) + se38 (…)" 설명 줄에 쓸 값. 명령을 붙여 적지 않았거나 tcode 가 비어 있으면 null. */
export function cmdExplain(entries: Tcode[], q: string): { cmd: string; rest: string; cmdDoes: string; tcodeName: string | null } | null {
  const pc = parseCmdQuery(q);
  if (!pc || !pc.rest) return null;
  const cmdEntry = entries.find((e) => e.kind === 'command');
  const key = pc.cmd === '/' ? '' : pc.cmd;
  const row = cmdEntry?.commands?.find((c) => c.cmd === `${key} + tcode`) ?? cmdEntry?.commands?.find((c) => c.cmd === key);
  const tc = entries.find((e) => e.kind !== 'command' && e.id === pc.rest);
  return { cmd: pc.cmd, rest: pc.rest, cmdDoes: row?.does ?? '', tcodeName: tc ? `${tc.code} · ${tc.name}` : null };
}
