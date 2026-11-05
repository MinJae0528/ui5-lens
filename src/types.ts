export type KoStatus = 'none' | 'draft' | 'reviewed' | 'stale';
export interface IndexEntry { p?: 0; n: string; b: string; l: string; k: string; s: string | null; d: string | true | null; x: string | null; t: string; ko: KoStatus; kz?: string | null; ku?: string | null }
export interface Alias { term: string; apis: string[] }
export interface Meta {
  minor: string; version: string; fetchedAt: string; builtAt: string; docBase: string; dataKind: 'official' | 'demo';
  libraries: Record<string, { symbols: number; apiJsonVersion: string | null }>; noApiJson: string[];
  counts: { searchable: number; detailedKo: number; reviewedKo: number };
}
export interface VersionInfo { minor: string; version: string; support: string | null; lts: boolean; eom: string | null; eocp: string | null; sapuiversion: string | null; frontendserver: string | null }
export interface VersionList { baseMinor: string; discoveredAt: string; versions: VersionInfo[] }
export interface Availability { versions: string[]; symbols: Record<string, string> }
export interface Deprecation { since: string | null; text: string }
interface Base { name: string; since: string | null; deprecated: Deprecation | null; visibility: string; description: string }
export interface Param { name: string; type?: string; optional?: boolean; defaultValue?: string | null; description?: string }
export interface Prop extends Base { type: string; defaultValue: unknown; group: string | null; methods: string[] }
export interface Aggr extends Base { type: string; cardinality: string; singularName: string | null; isDefault: boolean; methods: string[] }
export interface Assoc extends Base { type: string; cardinality: string; singularName: string | null; methods: string[] }
export interface Evt extends Base { allowPreventDefault: boolean; parameters: Param[] }
export interface Meth extends Base { static: boolean; accessorOf: { kind: string; name: string } | null; parameters: Param[]; returnValue: { type: string; description: string } | null }
export interface ApiDoc {
  name: string; basename: string; library: string; kind: string; visibility: string; since: string | null; deprecated: Deprecation | null;
  extends: string | null; implements: string[]; stereotype: string | null; module: string | null; description: string; sourceUrl: string;
  properties: Prop[]; aggregations: Aggr[]; associations: Assoc[]; events: Evt[]; methods: Meth[];
  enumValues: { name: string; value: unknown; description: string }[];
  typedefProperties: Param[]; constructorParams: Param[]; officialHash: string;
}
export interface Tagged { text: string; kind?: 'official' | 'service'; basis?: string }
export interface KoExample {
  id: string; title: string; kind: string; ai: boolean; description: string; code: string; check: string;
  verification: { status: 'passed' | 'failed' | 'unverified'; requestedVersion?: string; actualVersion?: string | null; ranAt?: string; check?: string; detail?: string };
}
export interface KoDoc {
  api: string; baseMinor: string; hashes: Record<string, string>;
  provenance: { ui5Version: string; checkedAt: string; generator: string; ai: boolean; review: string; reviewNote?: string };
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

/** 선택한 버전의 원문 해시와 한국어가 대조된 해시를 비교해 상태를 계산한다. */
export function koStatusFor(ko: KoDoc | null, minor: string): KoStatus {
  if (!ko) return 'none';
  if (ko.hashes[minor] !== ko.basedOn.officialHash) return 'stale';
  return ko.provenance.review === 'reviewed' ? 'reviewed' : 'draft';
}
