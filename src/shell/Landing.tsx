import { useEffect, useState } from 'react';
import { loadRecEval, type Global, type RecEval, type VersionData } from '../data';
import { KoBadge } from '../ui';
import { FEATURE_QUICK, NAME_QUICK } from './quick';

/** 시작 화면: 무엇을 할 수 있는지, 예시, 한국어 지원 범위, 도구 소개(공식 문서와의 관계·정확도 공개). */
export function Landing({ vd, g, onQuick, onPick }: { vd: VersionData; g: Global; onQuick: (s: string) => void; onPick: (n: string) => void }) {
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  const [ev, setEv] = useState<RecEval | null>(null);
  useEffect(() => { loadRecEval().then(setEv).catch(() => setEv(null)); }, []);
  const { meta } = vd;
  return (
    <div className="landing">
      <h2>무엇을 만들고 싶으세요?</h2>
      <p className="lead">API 이름을 몰라도 됩니다. 하고 싶은 일을 적거나, 아는 이름을 검색하세요. 지금은 <b>UI5 {meta.version}</b> 기준이며 위쪽에서 버전을 바꿀 수 있습니다.</p>
      <div className="try">
        <h3>하고 싶은 일로 찾기</h3>
        <div className="chips">{FEATURE_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s)}>{s}</button>)}</div>
      </div>
      <div className="try">
        <h3>이름으로 찾기 <small className="muted">(전체 이름·짧은 이름·한국어 별칭)</small></h3>
        <div className="chips">{NAME_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s)}>{s}</button>)}</div>
      </div>
      <h3>한국어 설명이 준비된 API ({ko.length}개)</h3>
      <ul className="plain">{ko.map((k) => <li key={k.n}><button className="link" onClick={() => onPick(k.n)}>{k.n}</button> <KoBadge status={k.ko} /></li>)}</ul>
      <p className="muted small">나머지 {(meta.counts.searchable - ko.length).toLocaleString()}개는 검색과 공식 영문 구조(속성·메서드·이벤트 등)를 제공합니다. 전체 UI5 API 를 한국어로 지원하는 것이 아닙니다.</p>
      <section className="about" aria-label="UI5 Lens 소개">
        <h3>UI5 Lens 는 이런 도구입니다</h3>
        <ul>
          <li>공식 <code>api.json</code> 을 {g.versions.versions.length}개 UI5 버전에 걸쳐 정리해, <b>“이 API 를 내 버전에서 쓸 수 있나?”</b> 를 한국어로 빠르게 확인하게 돕는 학습자용 도구입니다.</li>
          <li>공식 문서를 대체하지 않습니다. 항목마다 공식 원문 링크가 있고, 한국어는 AI 초안인지·검토됐는지를 표시합니다.</li>
          <li>공식 Demo Kit(<a href="https://ui5.sap.com" target="_blank" rel="noreferrer noopener">ui5.sap.com</a>)도 since·deprecated 색인을 제공합니다. Lens 는 같은 공식 데이터를 한국어 검색과 버전 간 비교로 보완합니다. 코드를 대신 써 주는 AI 도구와 달리, 근거를 보며 직접 고르는 용도입니다.</li>
          {ev && <li>“하고 싶은 일로 찾기”는 AI 가 아니라 공식 이름·설명과의 일치로 고릅니다. 자체 평가에서 새 질문 {ev.fresh.n}개 중 {Math.round((ev.fresh.top3 / ev.fresh.n) * 100)}% 에서 상위 3개 안에 정답이 있었습니다(UI5 {ev.minor}). 못 찾는 표현도 많습니다.</li>}
        </ul>
        <p className="muted small">데이터 기준: UI5 {meta.version} · 공식 자료 수집 {meta.fetchedAt.slice(0, 10)} · 한국어 {ko.length}개 중 검토 완료 {meta.counts.reviewedKo}개</p>
      </section>
    </div>
  );
}
