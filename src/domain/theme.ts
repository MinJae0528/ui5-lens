// 화면 모드(라이트·다크) 결정 규칙. 브라우저와 무관한 순수 함수라 단위 테스트로 확인한다.
export type Theme = 'light' | 'dark';

/** 사용자가 버튼으로 고른 값을 저장하는 localStorage 키 */
export const THEME_KEY = 'ui5lens.theme';

/** 저장된 값이 'light' 또는 'dark' 일 때만 인정한다. 그 외(없음·손상·다른 값)는 "고른 적 없음". */
export const parseTheme = (v: unknown): Theme | null => (v === 'light' || v === 'dark' ? v : null);

/** 고른 값이 있으면 그것, 없으면 시스템 설정을 따른다. */
export const resolveTheme = (stored: Theme | null, systemDark: boolean): Theme => stored ?? (systemDark ? 'dark' : 'light');

/**
 * 버튼을 눌렀을 때 저장할 값. 시스템과 다른 모드를 고르면 그 값을 저장하고(고정),
 * 지금 시스템과 같은 모드를 고르면 null(저장 삭제 = 시스템 설정 따르기로 되돌림).
 */
export const nextStored = (choice: Theme, systemDark: boolean): Theme | null => (choice === (systemDark ? 'dark' : 'light') ? null : choice);
