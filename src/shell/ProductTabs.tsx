import { useRef } from 'react';
import type { Product } from '../controller/route';

const TABS: { id: Product; label: string; sub: (n?: number, t?: number) => string }[] = [
  { id: 'ui5', label: 'UI5', sub: () => '한국어 API 탐색' },
  { id: 'abap', label: 'ABAP', sub: (n, t) => (n ? `기본 문법${t ? ' · tcode' : ''} · ${n}개${t ? `+${t}개` : ''}` : '기본 문법 · tcode') },
];

/**
 * 맨 위 상위 탭: 먼저 UI5 인지 ABAP 인지 고른다. 선택한 탭은 아래 맥락 바와 이어져 보인다.
 * 탭은 "제품 전환"이라 닫기 버튼이 없고, 좌우 화살표·Home·End 로 옮길 수 있다.
 */
export function ProductTabs({ product, onProduct, abapCount, tcodeCount }: { product: Product; onProduct: (p: Product) => void; abapCount?: number; tcodeCount?: number }) {
  const refs = useRef<Partial<Record<Product, HTMLButtonElement | null>>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    else return;
    e.preventDefault();
    onProduct(TABS[n].id);
    refs.current[TABS[n].id]?.focus();
  };
  return (
    <nav className="ptabs" aria-label="무엇을 찾나요">
      <div className="ptab-list" role="tablist" aria-label="무엇을 찾나요">
        {TABS.map((t, i) => (
          <button
            key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" id={`ptab-${t.id}`} data-id={t.id}
            aria-selected={product === t.id} aria-controls="ctx" tabIndex={product === t.id ? 0 : -1}
            className={`ptab ${product === t.id ? 'on' : ''}`} onClick={() => onProduct(t.id)} onKeyDown={(e) => onKey(e, i)}
          >
            <b>{t.label}</b><small>{t.sub(abapCount, tcodeCount)}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}
