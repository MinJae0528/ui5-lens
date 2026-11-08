import test from 'node:test';
import assert from 'node:assert/strict';
import { anchor, buildAnchorIndex } from '../src/domain/nameAnchor.ts';
import { FLAG, type MemberRow } from '../src/domain/memberIndex.ts';

const entries = [
  { n: 'sap.ui.core.Control', b: 'Control', x: null, k: 'class' },
  { n: 'sap.m.Dialog', b: 'Dialog', x: 'sap.ui.core.Control', k: 'class' },
  { n: 'sap.ui.core.BusyIndicator', b: 'BusyIndicator', x: null, k: 'namespace' },
];
const row = (c: string, k: MemberRow['k'], n: string): MemberRow => ({ c, k, n, f: 0, s: null, t: '', a: null });
const rows = [row('sap.ui.core.Control', 'p', 'visible'), row('sap.m.Dialog', 'm', 'open'), row('sap.ui.core.BusyIndicator', 'm', 'hide'), row('sap.m.Dialog', 'p', 'title')];
const ix = buildAnchorIndex(entries, rows);

test('클래스명+멤버명: 상속 멤버는 선언한 부모 클래스로 확정', () => {
  const a = anchor(ix, 'Dialog visible 설정', [])!;
  assert.equal(a.strength, 'member');
  assert.deepEqual(a.refs[0], { c: 'sap.ui.core.Control', k: 'property', n: 'visible' });
});
test('namespace(싱글톤)도 클래스명으로 잡는다', () => {
  assert.equal(anchor(ix, 'BusyIndicator 로딩 끄기 hide 함수', [])!.refs[0].n, 'hide');
});
test('영어 이름이 없으면 앵커 없음, 소문자 일반 단어는 클래스로 보지 않음', () => {
  assert.equal(anchor(ix, '팝업 창 띄우기', []), null);
  assert.equal(anchor(ix, 'dialog open', []), null);
});
void FLAG;
