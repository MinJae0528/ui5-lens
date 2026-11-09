// 자동 번역 단위: 공식 설명(HTML)에서 "첫 문장"을 평문으로 뽑고, 번역 캐시의 키(해시)를 만든다.
// translate-descriptions.mjs(번역)와 build-data.mjs(화면 데이터에 붙이기)가 같은 규칙을 쓰도록 한 곳에 둔다.
import { createHash } from 'node:crypto';

const MAX = 300;

/** HTML 설명 → 번역할 첫 문장(평문). 비어 있으면 ''. */
export function mtUnit(html) {
  const t = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\{@link\s+[^\s}]+(?:\s+([^}]*))?\}/g, (m, label) => label || m.replace(/^\{@link\s+/, '').replace(/\}$/, ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  // 첫 문장: 마침표 뒤 공백 + 대문자/숫자로 이어지는 곳(약어 e.g. 에서 끊기지 않게 소문자 약어 뒤는 제외)
  const m = /^(.{12,}?[.!?])(?=\s+[A-Z0-9(<"'`]|\s*$)/.exec(t);
  let s = m && !/\b(e\.g|i\.e|etc|vs)\.$/i.test(m[1]) ? m[1] : t;
  if (s.length > MAX) { s = s.slice(0, MAX); s = s.slice(0, s.lastIndexOf(' ') > 150 ? s.lastIndexOf(' ') : MAX) + ' …'; }
  return s;
}

export const mtKey = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16);
