import type { Global, VersionData } from '../data';
import type { Candidate } from '../domain/search';
import type { Route } from '../controller/route';

export type Setter = (patch: Partial<Route>, push?: boolean) => void;

/** 상세 화면의 모든 탭이 공유하는 입력. 화면은 이 값을 읽기만 하고, 상태 변경은 setRoute/onApi/onVersion 으로 위임한다. */
export interface DetailProps {
  name: string; g: Global; vd: VersionData; known: Set<string>; route: Route; setRoute: Setter; onVersion: (m: string) => void;
  siblings: Candidate[]; onBack: () => void; onApi: (n: string) => void;
}
