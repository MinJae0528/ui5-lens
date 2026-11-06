// 공식 메타데이터(이름·자료형)로 기계적으로 만든 호출 형태. 실행 검증을 거친 예제가 아니다.
import type { ApiDoc, Aggr, Assoc, Evt, Meth, Prop } from '../types.ts';

const inst = (doc: ApiDoc) => 'o' + doc.basename;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const placeholder = (type: string) => {
  if (type === 'boolean') return 'true';
  if (/^(int|float)/.test(type)) return '0';
  if (type === 'string' || type.startsWith('sap.ui.core.CSSSize') || type.startsWith('sap.ui.core.URI')) return '"…"';
  if (type.endsWith('[]')) return '[]';
  return `/* ${type} */`;
};
export function propSnippet(doc: ApiDoc, p: Prop) {
  const v = p.defaultValue != null && typeof p.defaultValue !== 'object' ? JSON.stringify(p.defaultValue) : placeholder(p.type);
  return `${inst(doc)}.set${cap(p.name)}(${v});   // 현재 값: ${inst(doc)}.get${cap(p.name)}()`;
}
export function aggrSnippet(doc: ApiDoc, a: Aggr) {
  const one = a.cardinality === '0..1';
  const m = one ? `set${cap(a.name)}` : `add${cap(a.singularName ?? a.name)}`;
  return `${inst(doc)}.${a.methods.includes(m) ? m : a.methods[0] ?? m}(/* ${a.type} */);`;
}
export function assocSnippet(doc: ApiDoc, a: Assoc) {
  const one = a.cardinality === '0..1';
  const m = one ? `set${cap(a.name)}` : `add${cap(a.singularName ?? a.name)}`;
  return `${inst(doc)}.${a.methods.includes(m) ? m : a.methods[0] ?? m}(/* ${a.type} 또는 그 ID */);`;
}
export function eventSnippet(doc: ApiDoc, e: Evt) {
  const lines = e.parameters.map((p) => `  var ${p.name} = oEvent.getParameter("${p.name}");   // ${p.type ?? ''}`);
  const prevent = e.allowPreventDefault ? '\n  // oEvent.preventDefault();   // 기본 동작 취소 가능' : '';
  return `${inst(doc)}.attach${cap(e.name)}(function (oEvent) {\n${lines.join('\n')}${prevent}\n});`;
}
export function methSnippet(doc: ApiDoc, m: Meth) {
  const args = m.parameters.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ');
  const call = m.static ? `${doc.name}.${m.name}(${args})` : `${inst(doc)}.${m.name}(${args})`;
  return m.returnValue && m.returnValue.type !== 'void' ? `var result = ${call};   // → ${m.returnValue.type}` : `${call};`;
}

// ---------- 불러오기·XML 뷰 사용 형태 (공식 메타데이터로 기계 생성, 실행 검증 안 함) ----------
/** 모듈 경로(공식 api.json 의 module)로 만든 sap.ui.define 사용 형태. 모듈 경로가 없으면 null. */
export function defineSnippet(doc: ApiDoc): string | null {
  if (!doc.module || !/^[A-Za-z0-9_/$.-]+$/.test(doc.module)) return null;
  const v = doc.basename;
  const body = doc.kind === 'namespace' || doc.stereotype === null && doc.kind !== 'class'
    ? `  // ${v} 는 함수 모음(싱글톤)입니다: ${v}.메서드(...) 형태로 호출합니다.`
    : `  var o${v} = new ${v}(/* mSettings: 속성·구성 요소·이벤트를 객체로 전달 */);`;
  return `sap.ui.define([\n  "${doc.module}"\n], function (${v}) {\n  "use strict";\n${body}\n});`;
}

const defaultNs = 'sap.m';
function xmlParts(doc: ApiDoc): { xmlns: string; tag: string; uses: string } | null {
  if (doc.stereotype !== 'control' && doc.stereotype !== 'element') return null;
  const dot = doc.name.lastIndexOf('.');
  if (dot <= 0 || doc.name.slice(dot + 1) !== doc.basename) return null; // 네임스페이스가 없거나 이름 규칙이 다르면 만들지 않는다
  const ns = doc.name.slice(0, dot);
  if (ns === defaultNs) return { xmlns: `xmlns="${ns}"`, tag: doc.basename, uses: '' };
  const prefix = (ns.split('.').pop() as string).replace(/[^a-z0-9]/gi, '') || 'x';
  const p = prefix === 'mvc' ? 'x' : prefix;
  return { xmlns: `xmlns:${p}="${ns}"`, tag: `${p}:${doc.basename}`, uses: ` xmlns:${p}="${ns}"` };
}
/** XML 뷰에서 컨트롤을 쓰는 형태. 컨트롤/엘리먼트가 아니면 null. */
export function xmlSnippet(doc: ApiDoc): string | null {
  const x = xmlParts(doc);
  if (!x) return null;
  const ns = x.xmlns === `xmlns="${defaultNs}"` ? `xmlns:mvc="sap.ui.core.mvc" xmlns="${defaultNs}"` : `xmlns:mvc="sap.ui.core.mvc" ${x.xmlns}`;
  return `<mvc:View ${ns}>\n  <${x.tag} />\n</mvc:View>`;
}
/** XML 뷰에서 속성·이벤트·구성 요소·참조를 쓰는 형태. 메서드는 XML 로 쓰지 않으므로 null. */
export function xmlMemberSnippet(kind: 'property' | 'method' | 'event' | 'aggregation' | 'association', doc: ApiDoc, m: Prop | Meth | Evt | Aggr | Assoc): string | null {
  const x = xmlParts(doc);
  if (!x || kind === 'method') return null;
  if (kind === 'property') return `<${x.tag} ${m.name}=${JSON.stringify(placeholder((m as Prop).type).replace(/^"|"$/g, '') || '…')} />`;
  if (kind === 'event') return `<${x.tag} ${m.name}=".on${cap(m.name)}" />   <!-- 컨트롤러에 onPress 같은 핸들러 함수 필요 -->`;
  if (kind === 'association') return `<${x.tag} ${m.name}="아이디" />`;
  const a = m as Aggr;
  return a.isDefault
    ? `<${x.tag}>\n  <!-- 기본 구성 요소(${m.name}): 태그 이름 없이 ${a.type} 를 바로 넣을 수 있음 -->\n</${x.tag}>`
    : `<${x.tag}>\n  <${m.name}>\n    <!-- ${a.type} -->\n  </${m.name}>\n</${x.tag}>`;
}
/** 생성자 호출 형태 */
export function newSnippet(doc: ApiDoc): string | null {
  if (doc.kind !== 'class' || !doc.ctor) return null;
  const v = doc.name;
  const sid = doc.constructorParams.some((p) => p.name === 'sId');
  const set = doc.constructorParams.some((p) => p.name === 'mSettings');
  const args = sid && set ? '"myId", { /* mSettings */ }' : set ? '{ /* mSettings */ }' : sid ? '"myId"' : '';
  return `var o${doc.basename} = new ${v}(${args});`;
}
