export interface IntentEntry { ko: string[]; en: string[] }
export interface CorpusEntry { n: string; c: 0 | 1 | 2 | 3; dp?: string | number; t: string; m: string }
export interface Rec { c: CorpusEntry; score: number; why: { name: string[]; desc: string[]; mem: string[] }; matched: number }
export interface RecResult { results: Rec[]; used: { ko: string; en: string[] }[]; terms: Map<string, number>; unknown: boolean; hasKorean: boolean }
export interface RecIndex { docs: unknown[]; df: Map<string, number>; N: number }
export function stem(w: string): string;
export function tokens(text: string): string[];
export function interpret(query: string, intents: IntentEntry[]): { terms: Map<string, number>; used: { ko: string; en: string[] }[]; hasKorean: boolean };
export function buildIndex(corpus: CorpusEntry[]): RecIndex;
export function recommend(index: RecIndex, query: string, intents: IntentEntry[], limit?: number): RecResult;
