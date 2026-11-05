import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_CSP, PERMISSIONS_POLICY } from './src/security/csp.ts';

// 앱 본체 CSP 는 src/security/csp.ts 가 단일 출처다(개발 서버는 HMR 이 인라인 스크립트를 쓰므로 빌드 결과에만 meta 로 넣는다).
// frame-ancestors·X-Frame-Options 같은 헤더 전용 항목은 public/_headers 와 vercel.json 에 있다.
const cspPlugin = (): Plugin => ({
  name: 'ui5-lens-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${APP_CSP}" />`);
  },
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  server: { port: 5173 },
  preview: {
    // 배포 호스트의 헤더와 같은 효과를 로컬 미리보기에서도 확인하기 위한 기본 헤더(CSP 는 빌드된 meta 가 담당)
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': PERMISSIONS_POLICY,
    },
  },
});
