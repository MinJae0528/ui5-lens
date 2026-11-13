import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cmdExplain, matchTcode, parseCmdQuery, searchTcodes } from '../src/controller/tcodeSearch.ts';
import type { AbapDoc, TcodeDoc } from '../src/types.ts';

const tc = JSON.parse(readFileSync('data/abap/tcodes.json', 'utf8')) as TcodeDoc;
const basics = JSON.parse(readFileSync('data/abap/basics.json', 'utf8')) as AbapDoc;
const ids = (q: string, g = '') => searchTcodes(tc.entries, q, g).map((e) => e.id);

test('명령 해석: /nse38 은 명령 /n + tcode se38, /n 은 명령만, 그냥 se38 은 명령이 아니다', () => {
  assert.deepEqual(parseCmdQuery('/nse38'), { cmd: '/n', rest: 'se38' });
  assert.deepEqual(parseCmdQuery('/ose11'), { cmd: '/o', rest: 'se11' });
  assert.deepEqual(parseCmdQuery('/n'), { cmd: '/n', rest: '' });
  assert.deepEqual(parseCmdQuery('/nend'), { cmd: '/nend', rest: '' });
  assert.deepEqual(parseCmdQuery(' /NEX '), { cmd: '/nex', rest: '' });
  assert.equal(parseCmdQuery('se38'), null);
  assert.equal(parseCmdQuery('테이블 보기'), null);
  assert.equal(parseCmdQuery('/n se38'), null);
});

test('이름으로 찾기: 정확히 같은 tcode 를 맨 위로 올린다', () => {
  assert.equal(ids('se11')[0], 'se11');
  assert.equal(ids('SE38')[0], 'se38');
  assert.ok(ids('se11').includes('se80')); // SE80 설명에 "SE11 같은 다른 도구"가 있어 함께 나오되 뒤에
});

test('하고 싶은 일로 찾기: 띄어 쓴 낱말은 각각 들어 있으면 맞는다', () => {
  assert.deepEqual(ids('테이블 보기').sort(), ['se11', 'se16', 'se84'].sort());
  for (const id of ['se09', 'se10', 'stms']) assert.ok(ids('이관').includes(id), id);
  assert.ok(ids('tcode 만들기').includes('se93'));
  assert.deepEqual(ids('존재하지않는말'), []);
});

test('명령을 붙여 적으면 명령 항목이 맨 위, 그 tcode 가 그 아래에 나온다', () => {
  assert.deepEqual(ids('/nse38'), ['cmd', 'se38']);
  assert.deepEqual(ids('/ose11'), ['cmd', 'se11']);
  assert.deepEqual(ids('/n'), ['cmd']);
  assert.deepEqual(ids('/nend'), ['cmd']);
  assert.deepEqual(ids('/nxyz'), ['cmd']); // 사전에 없는 tcode 는 명령 항목만(설명 줄에서 "이 사전에 없는 tcode" 안내)
});

test('명령 설명 줄: /nse38 = /n + se38', () => {
  const x = cmdExplain(tc.entries, '/nse38');
  assert.equal(x?.cmd, '/n'); assert.equal(x?.rest, 'se38');
  assert.match(x?.cmdDoes ?? '', /지금 창에서/);
  assert.match(x?.tcodeName ?? '', /^SE38 · ABAP Editor/);
  assert.equal(cmdExplain(tc.entries, '/nxyz')?.tcodeName, null);
  assert.equal(cmdExplain(tc.entries, '/n'), null);
  assert.equal(cmdExplain(tc.entries, 'se38'), null);
});

test('그룹 필터: 그룹 안에서만 찾고, 빈 검색어는 그룹 전체', () => {
  assert.deepEqual(ids('', '이관·설정').sort(), ['se09', 'se10', 'stms', 'su3'].sort());
  assert.deepEqual(ids('se11', '이관·설정'), []);
  assert.equal(matchTcode(tc.entries[0], ''), true);
});

test('자료 구조: 그룹 수, 관련 tcode·개념 항목 연결이 모두 실제로 있다', () => {
  assert.equal(tc.entries.length, 11);
  const tids = new Set(tc.entries.map((e) => e.id)), bids = new Set(basics.entries.map((e) => e.id));
  for (const e of tc.entries) {
    assert.ok(tc.groups.includes(e.group), e.id);
    for (const r of e.related) assert.ok(tids.has(r.id), `${e.id} → ${r.id}`);
    if (e.concept) assert.ok(bids.has(e.concept.id), `${e.id} → 개념 ${e.concept.id}`);
    if (e.kind !== 'command') assert.ok(e.routes.length > 0 && e.does.length > 0, e.id);
  }
  assert.equal(tc.entries.find((e) => e.kind === 'command')?.commands?.length, 7);
});

test('개념·환경 그룹과 새 문법 항목이 문법 사전에 들어 있다', () => {
  const g = (name: string) => basics.entries.filter((e) => e.group === name).length;
  assert.equal(g('개념·환경'), 9);
  for (const id of ['builtin-types-fixed', 'builtin-types-length', 'like-global-type', 'initial-default', 'text-symbol', 'arithmetic-assign', 'chained-comments']) assert.ok(basics.entries.some((e) => e.id === id), id);
});

test('수업 서버 정보는 자료에 없다 (공개 저장소에 올라가므로)', () => {
  const all = JSON.stringify(basics) + JSON.stringify(tc);
  // 수업 서버 고유 이름은 git 밖 로컬 파일에만 둔다 (없으면 일반 패턴만 검사)
  const local = existsSync('data/abap/forbidden.local.txt') ? readFileSync('data/abap/forbidden.local.txt', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => new RegExp(l, 'i')) : [];
  for (const bad of [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, /초기\s*비밀번호/, /password/i, ...local]) assert.equal(bad.test(all), false, String(bad));
});
