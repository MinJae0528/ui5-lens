export type KoStatus = 'none' | 'draft' | 'reviewed' | 'stale';
export interface IndexEntry { p?: 0; n: string; b: string; l: string; k: string; s: string | null; d: string | true | null; x: string | null; t: string; ko: KoStatus; kz?: string | null; ku?: string | null; tk?: string }
export interface Alias { term: string; apis: string[] }
export interface Meta {
  minor: string; version: string; fetchedAt: string; builtAt: string; docBase: string; dataKind: 'official' | 'demo';
  libraries: Record<string, { symbols: number; apiJsonVersion: string | null }>; noApiJson: string[];
  counts: { searchable: number; detailedKo: number; reviewedKo: number; members?: number; topics?: number };
}
export interface VersionInfo { minor: string; version: string; support: string | null; lts: boolean; eom: string | null; eocp: string | null; sapuiversion: string | null; frontendserver: string | null }
export interface VersionList { baseMinor: string; discoveredAt: string; versions: VersionInfo[] }
export interface Availability { versions: string[]; symbols: Record<string, string> }
export interface Deprecation { since: string | null; text: string }
/** 공식 참고 링크. kind: fiori 디자인 가이드 / topic 문서 가이드 / url 외부 / api 다른 API / text 설명만 */
export interface Ref { kind: 'fiori' | 'topic' | 'url' | 'api' | 'text'; text: string; url?: string; key?: string; api?: string; member?: string | null }
export interface ExampleCode { caption: string | null; text: string }
export interface Experimental { since: string | null; text: string }
export interface Throws { type: string | null; description: string }
/** 정규화 때 해시 밖에 덧붙이는 공식 추가 정보(없으면 생략) */
interface Extras { experimental?: Experimental; allowedFor?: string[]; references?: Ref[]; examples?: ExampleCode[] }
interface Base extends Extras { kd?: string; name: string; since: string | null; deprecated: Deprecation | null; visibility: string; description: string }
export interface Param { name: string; type?: string; optional?: boolean; defaultValue?: string | null; description?: string }
export interface Prop extends Base { type: string; defaultValue: unknown; group: string | null; methods: string[]; bindable?: boolean }
export interface Aggr extends Base { type: string; cardinality: string; singularName: string | null; isDefault: boolean; methods: string[] }
export interface Assoc extends Base { type: string; cardinality: string; singularName: string | null; methods: string[] }
export interface Evt extends Base { allowPreventDefault: boolean; parameters: Param[] }
export interface Meth extends Base { static: boolean; accessorOf: { kind: string; name: string } | null; parameters: Param[]; returnValue: { type: string; description: string } | null; throws?: Throws[] }
export interface ApiDoc {
  kd?: string; name: string; basename: string; library: string; kind: string; visibility: string; since: string | null; deprecated: Deprecation | null;
  extends: string | null; implements: string[]; stereotype: string | null; module: string | null; description: string; sourceUrl: string;
  properties: Prop[]; aggregations: Aggr[]; associations: Assoc[]; events: Evt[]; methods: Meth[];
  enumValues: { name: string; value: unknown; description: string }[];
  typedefProperties: Param[]; constructorParams: Param[]; officialHash: string;
  abstract?: boolean; final?: boolean; experimental?: Experimental; allowedFor?: string[]; references?: Ref[]; examples?: ExampleCode[];
  ctor?: { description: string; references: Ref[]; examples: ExampleCode[]; allowedFor: string[] };
}
export interface AbapLink { label: string; site: string; url: string }
export interface AbapEntry { id: string; term: string; group: string; summary: string; whenToUse: string; syntax: string; notes: string[]; links: AbapLink[]; /** 공식 링크가 없는 항목의 근거 문구 */ basis?: string }
export interface AbapDoc { category: string; title: string; provenance: { generator: string; review: string; executed: boolean; note: string; linkSource: string; checkedAt: string }; sites: Record<string, string>; entries: AbapEntry[] }
/** tcode 사전: 입력 → 열리는 화면, 할 수 있는 일, 이어서 쓰는 tcode */
export interface TcodeRoute { input: string; opens: string; when: string }
export interface TcodeCommand { cmd: string; does: string; confirm: string }
export interface Tcode {
  id: string; code: string; name: string; group: string; summary: string; keywords: string; kind?: 'command';
  routes: TcodeRoute[]; does: string[]; inClass: string; notes: string[]; related: { id: string; why: string }[];
  concept?: { id: string; label: string }; commands?: TcodeCommand[]; links: AbapLink[];
}
export interface TcodeDoc { category: string; title: string; provenance: AbapDoc['provenance']; sites: Record<string, string>; groups: string[]; entries: Tcode[] }
/** 문서 가이드 목차: [key, 제목, 하위 목록 | 0] */
export type TopicNode = [string, string, TopicNode[] | 0];
export interface Tagged { text: string; kind?: 'official' | 'service'; basis?: string }
export interface KoExample {
  id: string; title: string; kind: string; ai: boolean; description: string; code: string; check: string;
  verification: { status: 'passed' | 'failed' | 'unverified'; requestedVersion?: string; actualVersion?: string | null; ranAt?: string; check?: string; detail?: string };
}
export interface KoDoc {
  api: string; baseMinor: string; hashes: Record<string, string>;
  provenance: { ui5Version: string; checkedAt: string; generator: string; ai: boolean; review: string; reviewNote?: string; depth?: 'brief' };
  basedOn: { officialHash: string; stampedAt?: string };
  overview: {
    summary: string; summaryBasis?: string; whenToUse: Tagged[];
    compare: { api: string; text: string; basis: string; kind: string }[];
    related: { api: string; role: string }[];
  };
  members: Record<string, { text: string }>;
  usage: { prerequisites: Tagged[]; exampleFlow: (Tagged & { step: number })[]; recommended: Tagged[] };
  examples: KoExample[];
}
export type MemberKind = 'property' | 'method' | 'event' | 'aggregation' | 'association';
