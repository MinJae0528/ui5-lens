// 예제 실행용 HTML. 앱의 "실행해 보기"(iframe srcdoc)와 scripts/verify-examples.mjs 가 같은 문서를 쓴다.
export const UI5_VERSION = '1.154.0';
export function buildHarness(code, version = UI5_VERSION) {
  const safe = code.replace(/<\/script/gi, '<\/script');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:8px;font-family:system-ui,sans-serif}</style>
<script id="sap-ui-bootstrap" src="https://ui5.sap.com/${version}/resources/sap-ui-core.js"
  data-sap-ui-theme="sap_horizon" data-sap-ui-libs="sap.m,sap.ui.table" data-sap-ui-async="true"
  data-sap-ui-compatVersion="edge"></script>
</head><body class="sapUiBody"><div id="content"></div>
<script>
window.addEventListener('error', function (e) { console.error('[example-error] ' + e.message); });
sap.ui.getCore().attachInit(function () {
${safe}
});
</script></body></html>`;
}
