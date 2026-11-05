import type { KoDoc, KoStatus } from '../types.ts';

/** 선택한 버전의 원문 해시와 한국어가 대조된 해시를 비교해 상태를 계산한다. */
export function koStatusFor(ko: KoDoc | null, minor: string): KoStatus {
  if (!ko) return 'none';
  if (ko.hashes[minor] !== ko.basedOn.officialHash) return 'stale';
  return ko.provenance.review === 'reviewed' ? 'reviewed' : 'draft';
}
