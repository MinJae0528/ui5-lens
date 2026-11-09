/** HTML 조각 → 평문(검색·미리보기용). 화면에 HTML 로 다시 넣지 않는다. */
export const plain = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** 평문을 단어 경계에서 max 자로 줄인다(낱말 중간에서 끊지 않는다). */
export const cutWords = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max) > max / 2 ? s.lastIndexOf(' ', max) : max)} …`);
export const fmtDate = (iso: string): string => iso.slice(0, 10);
