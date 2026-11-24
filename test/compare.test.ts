import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, serialize } from '../src/controller/routeState.ts';
import type { AbapDoc, CompareDoc } from '../src/types.ts';

const cmp = JSON.parse(readFileSync('data/abap/compare.json', 'utf8')) as CompareDoc;
const basics = JSON.parse(readFileSync('data/abap/basics.json', 'utf8')) as AbapDoc;

test('헷갈리는 짝: 10개이고 표 모양과 연결된 문법 항목이 맞는다', () => {
  assert.equal(cmp.entries.length, 10);
  const bids = new Set(basics.entries.map((e) => e.id));
  const ids = new Set<string>();
  for (const e of cmp.entries) {
    assert.ok(/^[a-z0-9-]{1,40}$/.test(e.id), e.id);
    assert.ok(!ids.has(e.id), `id 중복 ${e.id}`); ids.add(e.id);
    assert.ok(e.heads.length >= 2 && e.heads.length <= 3, e.id);
    assert.ok(e.rows.length > 0 && e.rows.every((r) => r.length === e.heads.length + 1 && r.every(Boolean)), `${e.id} 표 칸 수`);
    assert.ok(e.related.length > 0 && e.related.every(([id]) => bids.has(id)), `${e.id} 연결`);
  }
});

test('주소: az=compare 를 읽고 쓴다, 알 수 없는 값은 문법 사전으로, 옛 주소는 그대로', () => {
  const r = parse('#?m=abap&az=compare&ab=into-vs-appending');
  assert.equal(r.az, 'compare'); assert.equal(r.ab, 'into-vs-appending');
  assert.equal(serialize(r), '#?m=abap&az=compare&ab=into-vs-appending');
  assert.equal(parse('#?m=abap&az=zzz').az, '');
  assert.equal(parse('#?m=abap&az=tcode&ab=se11').az, 'tcode');
  const old = parse('#?m=abap&ab=select');
  assert.equal(old.az, ''); assert.equal(old.ab, 'select');
});
