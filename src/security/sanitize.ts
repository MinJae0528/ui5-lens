// 공식 자료에서 온 HTML 조각을 화면에 넣기 전의 마지막 방어선(브라우저 쪽).
// 빌드 때 정규식으로 한 번 걸러 두지만, 정규식 정화는 구조적으로 우회에 취약하므로
// 실제 브라우저 파서(비활성 <template>)로 다시 파싱해 "허용 목록에 있는 태그·속성만" 남긴다.
//  - 스크립트·스타일·iframe·SVG·MathML 같은 위험 요소는 내용째 버린다.
//  - 모르는 태그는 껍데기만 벗기고 글자만 남긴다.
//  - 속성은 허용한 것만 남긴다: a[href](http/https 만), a[data-api](기호 문자만). on* 이벤트·style 등은 모두 제거.
//  - 결과를 다시 파싱해도 같아질 때까지 확인해(mXSS 방지) 불안정하면 평문으로 대체한다.

const ALLOWED_TAGS = new Set(['code', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'p', 'br', 'pre', 'a', 'h3', 'h4', 'table', 'tr', 'td', 'th', 'thead', 'tbody']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'textarea', 'select', 'option', 'form', 'input', 'button', 'link', 'meta', 'base', 'title', 'head', 'xmp', 'plaintext', 'noembed', 'noframes', 'applet', 'audio', 'video', 'source', 'track', 'canvas', 'img', 'image', 'picture']);
const SAFE_URL = /^https?:\/\/[^\s"'<>`]+$/i;
const SAFE_API_NAME = /^[A-Za-z0-9_.$/:-]+$/;

function clean(parent: ParentNode): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) { node.parentNode?.removeChild(node); continue; } // 주석·CDATA 등
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) { el.remove(); continue; }
    clean(el); // 자식부터 정리
    if (!ALLOWED_TAGS.has(tag)) { el.replaceWith(...Array.from(el.childNodes)); continue; } // 껍데기만 제거
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const ok = tag === 'a' && ((name === 'href' && SAFE_URL.test(attr.value.trim())) || (name === 'data-api' && SAFE_API_NAME.test(attr.value)));
      if (!ok) el.removeAttribute(attr.name);
    }
    if (tag === 'a' && el.hasAttribute('href')) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noreferrer noopener'); }
  }
}

function parse(html: string): HTMLTemplateElement {
  const tpl = document.createElement('template'); // 내용이 비활성(스크립트 실행·이미지 로딩 없음)
  tpl.innerHTML = html;
  return tpl;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const tpl = parse(html);
  clean(tpl.content);
  const out = tpl.innerHTML;
  // 직렬화 → 재파싱에서 구조가 바뀌면(mXSS 징후) 평문으로만 보여 준다.
  const again = parse(out);
  clean(again.content);
  if (again.innerHTML !== out) return escapeText(tpl.content.textContent ?? '');
  return out;
}

const escapeText = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
