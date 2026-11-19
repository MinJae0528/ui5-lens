import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_KEY, parseTheme, resolveTheme } from '../src/domain/theme.ts';

test('저장값 해석: light·dark 만 인정하고 나머지는 "고른 적 없음"', () => {
  assert.equal(parseTheme('light'), 'light');
  assert.equal(parseTheme('dark'), 'dark');
  for (const bad of [null, undefined, '', 'system', 'Dark', 'LIGHT', ' dark', 0, {}, []]) assert.equal(parseTheme(bad), null, String(bad));
});

test('모드 결정: 고른 값이 있으면 그것, 없으면 시스템 설정', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
  assert.equal(resolveTheme('light', true), 'light'); // 시스템이 다크여도 라이트를 고르면 라이트
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('저장 키는 다른 저장값(버전)과 겹치지 않는다', () => {
  assert.equal(THEME_KEY, 'ui5lens.theme');
  assert.notEqual(THEME_KEY, 'ui5lens.version');
});

test('저장할 값: 시스템과 다른 모드는 고정, 시스템과 같은 모드는 저장 삭제(시스템 따르기로 복귀)', async () => {
  const { nextStored } = await import('../src/domain/theme.ts');
  assert.equal(nextStored('light', true), 'light');  // 시스템 다크에서 라이트 → 고정
  assert.equal(nextStored('dark', false), 'dark');   // 시스템 라이트에서 다크 → 고정
  assert.equal(nextStored('dark', true), null);      // 시스템과 같음 → 복귀
  assert.equal(nextStored('light', false), null);
});
