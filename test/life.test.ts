import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLife, missingInVersion, sinceConflict, minorNum, type LifeContext, type LifeInfo } from '../src/domain/life.ts';

// 받아 둔 버전: 최신 → 과거. 1.153/1.154 는 연속, 1.84/1.71/1.38 사이에는 서버에 없는 마이너가 있다.
const order = ['1.154', '1.153', '1.152', '1.84', '1.71', '1.38'];
const ctx: LifeContext = { order, versions: order.map((minor) => ({ minor, version: `${minor}.0` })) };
const info = (row: string) => { const d = describeLife(row, ctx); assert.equal(d.none, false); return d as LifeInfo; };

test('가장 오래된 받아 둔 버전부터 있으면 "≤" 로 표기하고 정확한 도입 버전을 단정하지 않는다', () => {
  const d = info('111111');
  assert.match(d.intro, /^≤ 1\.38/);
  assert.equal(d.introExact, false);
  assert.equal(d.removed, null);
  assert.equal(d.dep, null);
  assert.equal(d.presentCount, 6);
});

test('직전 받아 둔 버전이 연속 마이너면 그 버전에서 도입된 것으로 확인', () => {
  const d = info('110000'); // 1.154, 1.153 에만 있고 1.152 에는 없음
  assert.equal(d.introExact, true);
  assert.match(d.intro, /^1\.153 에서 도입/);
});

test('직전 받아 둔 버전과 사이에 서버에 없는 마이너가 있으면 "사이에 도입" 으로 표기', () => {
  const d = info('111100'); // 1.84 부터 있고 1.71 에는 없음 (1.72~1.83 은 서버에 없음)
  assert.equal(d.introExact, false);
  assert.match(d.intro, /1\.71\(없음\)과 1\.84\(있음\) 사이에 도입/);
});

test('제거: 연속이면 정확히, 아니면 "사이에 사라짐"', () => {
  assert.match(info('011111').removed!, /1\.153 까지 있고 1\.154 부터 없음/);
  assert.match(info('000111').removed!, /1\.84\(있음\)과 1\.152\(없음\) 사이에 사라짐/);
});

test('deprecated 시작 시점', () => {
  assert.match(info('221111').dep!, /1\.153 에서 deprecated 로 표시되기 시작/);
  assert.match(info('222222').dep!, /받아 둔 버전 중 처음 deprecated/);
  assert.match(info('221111').dep!, /1\.153/); // 가장 과거의 deprecated 칸을 기준으로 한다
});

test('어떤 버전에도 없으면 none', () => {
  const d = describeLife('000000', ctx);
  assert.equal(d.none, true);
});

test('호스팅 목록에 없는 버전 칸은 무시한다', () => {
  const small: LifeContext = { order, versions: ctx.versions.filter((v) => v.minor !== '1.152') };
  const d = describeLife('111111', small);
  assert.equal(d.cells.length, 5);
});

test('공식 since 가 실제 첫 확인 버전보다 늦으면 충돌로 본다', () => {
  assert.equal(sinceConflict('1.52', '1.72.0'), true);
  assert.equal(sinceConflict('1.84', '1.72'), false);
  assert.equal(sinceConflict('1.84', null), false);
  assert.equal(minorNum('1.120'), 1120);
});

test('missingInVersion: 현재 버전에 없고 다른 버전에는 있는 멤버를 관계별로 분류', () => {
  // 인덱스: 0=1.154 1=1.153 2=1.152 3=1.84 4=1.71 5=1.38
  const life = {
    'm:removedLater': '011111', // 1.154 에서만 없음
    'm:onlyOld': '000111',      // 과거 버전에만 있음
    'p:introLater': '110000',   // 최신 두 버전에만 있음
    'e:gapOnly': '101011',      // 1.153·1.84 에서만 없음
    'e:alwaysThere': '111111',
  };
  const at = (minor: string) => Object.fromEntries(missingInVersion(life, order, minor).map((r) => [r.name, r.relation]));

  // 1.154: 과거에는 있었지만 지금은 없음 → removed
  assert.deepEqual(at('1.154'), { removedLater: 'removed', onlyOld: 'removed' });
  // 1.84: 최신 버전들에만 있는 항목은 "아직 도입 전" (이전에 라벨이 거꾸로 "이후 사라짐" 이었던 경우)
  assert.deepEqual(at('1.84'), { introLater: 'not-yet', gapOnly: 'gap' });
  // 1.153: gapOnly 는 새·옛 버전 양쪽에 있고 여기만 비어 있음 → gap, onlyOld 는 과거에만 → removed
  assert.deepEqual(at('1.153'), { onlyOld: 'removed', gapOnly: 'gap' });
  // 모든 버전에 있는 항목은 어디서도 "없는 항목"이 아님
  for (const m of order) assert.equal(at(m).alwaysThere, undefined);
});
