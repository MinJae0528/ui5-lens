/** HTML 조각 → 평문(검색·미리보기용). 화면에 HTML 로 다시 넣지 않는다. */
export const plain = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export const fmtDate = (iso: string): string => iso.slice(0, 10);
