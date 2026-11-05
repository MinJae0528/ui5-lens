import { join } from 'node:path';
import { homedir } from 'node:os';
// 원본 캐시는 OneDrive 동기화 대상이 아닌 위치에 둔다 (수백 MB). 환경변수 UI5_LENS_CACHE 로 바꿀 수 있다.
export const CACHE_DIR = process.env.UI5_LENS_CACHE ?? join(process.env.LOCALAPPDATA ?? join(homedir(), '.cache'), 'ui5-lens-cache');
