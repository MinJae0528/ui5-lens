import { useEffect, useState } from 'react';
import type { Mode } from '../controller/route';
import { loadRecEval, type Global, type RecEval, type VersionData } from '../data';
import { libraries } from '../domain/browse';
import { FEATURE_QUICK, METHOD_QUICK, NAME_QUICK, POPULAR } from './quick';

/** 시작 화면: 지금 고른 찾기 방식을 설명하고 예시를 눌러 바로 써 보게 한다. 한국어 지원 범위와 도구 소개(공식 문서와의 관계·정확도 공개)도 함께 보여 준다. */
export function Landing({ vd, g, mode, onQuick, onMode, onLib, onPick }: { vd: VersionData; g: Global; mode: Mode; onQuick: (s: string, m?: Mode) => void; onMode: (m: Mode) => void; onLib: (lib: string) => void; onPick: (n: string) => void }) {
  const ko = vd.index.filter((i) => i.ko !== 'none' && i.p !== 0);
  const [ev, setEv] = useState<RecEval | null>(null);
  useEffect(() => { loadRecEval().then(setEv).catch(() => setEv(null)); }, []);
  const { meta } = vd;
  const koSet = new Set(ko.map((k) => k.n));
  const have = new Set(vd.index.map((i) => i.n));
  const popular = POPULAR.map((g2) => ({ title: g2.title, apis: g2.apis.filter((a) => have.has(a)) })).filter((g2) => g2.apis.length);
  const topLibs = libraries(vd.index).filter((l) => l.core).slice(0, 8);
  return (
    <div className="landing">
      {mode === 'name' && <>
        <h2>알고 있는 이름으로 찾기</h2>
        <p className="lead">클래스 이름이나 <b>메서드·속성·이벤트 이름</b>을 적으면, 어디에 있는지와 <b>어떻게 쓰는지</b>(설명·인자·사용 형태·버전)를 자세히 보여 줍니다. 지금은 <b>UI5 {meta.version}</b> 기준입니다.</p>
        <div className="try"><h3>메서드·속성·이벤트 이름으로</h3>
          <div className="chips">{METHOD_QUICK.map((s) => <button key={s} className="chip mono-chip" onClick={() => onQuick(s, 'name')}>{s}</button>)}</div>
          <p className="muted small">클래스를 지정하려면 <code>Button#setText</code> 또는 <code>Button.setText</code> 처럼 적습니다. 같은 이름을 여러 클래스가 선언하면 한 묶음으로 보이고, 클래스를 골라 들어갑니다.</p></div>
        <div className="try"><h3>클래스 이름으로 <small className="muted">(전체 이름·짧은 이름·한국어 별칭)</small></h3>
          <div className="chips">{NAME_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s, 'name')}>{s}</button>)}</div></div>
      </>}
      {mode === 'feature' && <>
        <h2>무엇을 만들고 싶으세요?</h2>
        <p className="lead">이름을 몰라도 됩니다. <b>하고 싶은 일</b>을 한국어나 영어로 적으면, UI5 {meta.version} 공식 자료에서 알맞아 보이는 <b>컨트롤 3개</b>와 <b>메서드·이벤트</b>를 이유와 함께 추천합니다. 항목을 누르면 자세한 설명이 열립니다.</p>
        <div className="try"><h3>이런 식으로 물어보세요</h3>
          <div className="chips">{FEATURE_QUICK.map((s) => <button key={s} className="chip" onClick={() => onQuick(s, 'feature')}>{s}</button>)}</div></div>
      </>}
      {mode === 'browse' && <>
        <h2>API 탐색</h2>
        <p className="lead">ui5.sap.com 의 API Reference 처럼 라이브러리 → 클래스 순으로 훑어봅니다. 왼쪽에서 라이브러리를 고르고, 클래스를 누르면 탭(개요·생성자·속성·구성 요소·참조·이벤트·메서드·상속·버전)으로 오가며 볼 수 있습니다.</p>
        <div className="try"><h3>자주 쓰는 라이브러리</h3>
          <div className="chips">{topLibs.map((l) => <button key={l.lib} className="chip mono-chip" onClick={() => onLib(l.lib)}>{l.lib} <small>{l.count}</small></button>)}</div></div>
      </>}

      <p className="muted small">다른 방법: {mode !== 'name' && <button className="link" onClick={() => onMode('name')}>이름·메서드 검색</button>}{mode !== 'name' && mode !== 'feature' ? ' · ' : ''}{mode !== 'feature' && <button className="link" onClick={() => onMode('feature')}>기능으로 추천</button>} · <button className="link" onClick={() => onMode('guide')}>문서 가이드</button></p>

      <section className="popular" aria-label="많이 쓰는 API">
        <h3>많이 쓰는 API 바로가기</h3>
        {popular.map((g2) => (
          <div key={g2.title} className="try"><h4 className="muted small">{g2.title}</h4>
            <div className="chips">{g2.apis.map((a) => <button key={a} className="chip mono-chip" onClick={() => onPick(a)}>{a.split('.').pop()}{koSet.has(a) && <small title="한국어 설명(AI 초안)이 있습니다"> 한</small>}</button>)}</div></div>
        ))}
        <p className="muted small">누르면 공식 영문 구조(속성·메서드·이벤트·상속·버전)가 열립니다. ‘한’ 표시가 붙은 {ko.length}개에는 한국어 설명(AI 초안·미검토)이 있고, 나머지는 영문 원문과 공식 링크를 제공합니다.</p>
      </section>
      <section className="about" aria-label="SAP Lens 소개">
        <h3>SAP Lens 는 이런 도구입니다</h3>
        <ul>
          <li>공식 <code>api.json</code> 을 {g.versions.versions.length}개 UI5 버전에 걸쳐 정리해, <b>“이 API 를 내 버전에서 쓸 수 있나?”</b> 를 한국어로 빠르게 확인하게 돕는 학습자용 도구입니다.</li>
          <li>SAP 와 무관한 학생 프로젝트이며 SAP 가 보증하거나 후원하지 않습니다. 현재 UI5 는 API 탐색 전체를, ABAP 은 기본 문법 사전(AI 초안)만 제공합니다.</li>
          <li>공식 문서를 대체하지 않습니다. 항목마다 공식 원문 링크가 있고, 한국어는 AI 초안인지·검토됐는지를 표시합니다.</li>
          <li>공식 Demo Kit(<a href="https://ui5.sap.com" target="_blank" rel="noreferrer noopener">ui5.sap.com</a>)도 since·deprecated 색인을 제공합니다. Lens 는 같은 공식 데이터를 한국어 검색과 버전 간 비교로 보완합니다. 코드를 대신 써 주는 AI 도구와 달리, 근거를 보며 직접 고르는 용도입니다.</li>
          {ev && <li>“기능으로 추천”은 AI 가 아니라 공식 이름·설명과의 일치로 고릅니다. 자체 평가에서 새 질문 {ev.fresh.n}개 중 {Math.round((ev.fresh.top3 / ev.fresh.n) * 100)}% 에서 상위 3개 안에 정답이 있었습니다(UI5 {ev.minor}, 컨트롤 기준). 못 찾는 표현도 많습니다.</li>}
        </ul>
        <p className="muted small">데이터 기준: UI5 {meta.version} · 공식 자료 수집 {meta.fetchedAt.slice(0, 10)} · 메서드·속성 {meta.counts.members?.toLocaleString() ?? '—'}개 · 문서 가이드 {meta.counts.topics ? meta.counts.topics.toLocaleString() + '개' : '없음'} · 한국어 {ko.length}개 중 검토 완료 {meta.counts.reviewedKo}개</p>
      </section>
    </div>
  );
}
