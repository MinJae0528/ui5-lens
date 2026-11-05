import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koStatusFor } from '../src/domain/ko.ts';
import type { KoDoc } from '../src/types.ts';

const ko = (over: { review?: string; hashes?: Record<string, string>; base?: string } = {}) => ({
  basedOn: { officialHash: over.base ?? 'h154' },
  hashes: over.hashes ?? { '1.154': 'h154', '1.120': 'h120' },
  provenance: { review: over.review ?? 'draft' },
}) as unknown as KoDoc;

test('한국어가 없으면 none', () => assert.equal(koStatusFor(null, '1.154'), 'none'));
test('기준 원문과 같으면 draft(미검토) 또는 reviewed', () => {
  assert.equal(koStatusFor(ko(), '1.154'), 'draft');
  assert.equal(koStatusFor(ko({ review: 'reviewed' }), '1.154'), 'reviewed');
});
test('다른 버전의 원문 해시가 다르면 stale(재검토 필요)', () => assert.equal(koStatusFor(ko(), '1.120'), 'stale'));
test('해시가 없는 버전도 stale(일치를 단정하지 않음)', () => assert.equal(koStatusFor(ko(), '1.38'), 'stale'));
test('검토 완료라도 원문이 달라지면 stale 이 우선', () => assert.equal(koStatusFor(ko({ review: 'reviewed' }), '1.120'), 'stale'));
