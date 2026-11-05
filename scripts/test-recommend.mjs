// 기능 추천 품질 점검: 질문 → 상위 N개가 기대한 API 를 포함하는지. (node scripts/test-recommend.mjs [minor] [-v])
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildIndex, recommend } from '../shared/recommend.mjs';

const minor = process.argv.find((a) => /^1\.\d+$/.test(a)) ?? '1.154';
const verbose = process.argv.includes('-v');
const corpus = JSON.parse(gunzipSync(readFileSync(`public/data/v/${minor}/intent.json.gz`)).toString('utf8'));
const intents = JSON.parse(readFileSync('public/data/intents.json', 'utf8')).intents;
const index = buildIndex(corpus);

// [질문, 상위 3개 안에 있어야 하는 API 중 하나 이상(any), 설명]
const CASES = [
  ['댓글을 다는 기능을 추가하고 싶어', ['sap.m.FeedInput', 'sap.m.FeedListItem'], '사용자 예시'],
  ['댓글', ['sap.m.FeedInput', 'sap.m.FeedListItem'], ''],
  ['날짜를 고르고 싶어', ['sap.m.DatePicker', 'sap.m.DateTimePicker'], ''],
  ['날짜 범위 선택', ['sap.m.DateRangeSelection'], ''],
  ['파일 업로드', ['sap.ui.unified.FileUploader', 'sap.m.upload.UploadSet', 'sap.m.UploadCollection'], ''],
  ['삭제할 때 확인창을 띄우고 싶어', ['sap.m.MessageBox'], ''],
  ['잠깐 알림 메시지를 보여주고 싶어', ['sap.m.MessageToast'], ''],
  ['팝업창', ['sap.m.Dialog', 'sap.m.Popover'], ''],
  ['표에 데이터를 보여주고 싶어', ['sap.m.Table', 'sap.ui.table.Table'], ''],
  ['페이지 이동', ['sap.m.NavContainer', 'sap.ui.core.routing.Router', 'sap.m.App'], ''],
  ['검색창', ['sap.m.SearchField', 'sap.f.SearchManager'], ''],
  ['드롭다운에서 하나 선택', ['sap.m.Select', 'sap.m.ComboBox'], ''],
  ['진행률 표시', ['sap.m.ProgressIndicator'], ''],
  ['별점', ['sap.m.RatingIndicator'], ''],
  ['탭으로 화면 나누기', ['sap.m.IconTabBar', 'sap.m.TabContainer', 'sap.ui.webc.main.TabContainer'], ''],
  ['json 데이터를 화면에 연결', ['sap.ui.model.json.JSONModel'], ''],
  ['달력', ['sap.ui.unified.Calendar', 'sap.m.Calendar', 'sap.m.DatePicker'], ''],
  ['datepicker for date selection', ['sap.m.DatePicker'], '영어 질문'],
  ['토글 스위치', ['sap.m.Switch', 'sap.m.ToggleButton'], ''],
  ['차트', ['sap.viz.ui5.controls.VizFrame', 'sap.chart.Chart', 'sap.suite.ui.microchart'], '(차트는 viz/microchart 라이브러리일 수 있음)'],
  // ---- 사전을 조정하기 전에 따로 만든 질문(튜닝에 쓰지 않은 것)
  ['목록에서 항목을 하나씩 보여주고 싶어', ['sap.m.List', 'sap.m.StandardListItem', 'sap.m.ListItemBase'], '보류 질문'],
  ['사용자 프로필 사진 보여주기', ['sap.m.Avatar', 'sap.f.Avatar'], '보류 질문'],
  ['버튼을 눌렀을 때 동작', ['sap.m.Button'], '보류 질문'],
  ['체크박스', ['sap.m.CheckBox'], '보류 질문'],
  ['긴 글 입력하는 칸', ['sap.m.TextArea'], '보류 질문'],
  ['트리 구조로 보여주기', ['sap.m.Tree', 'sap.ui.table.TreeTable'], '보류 질문'],
  ['슬라이더로 값 조절', ['sap.m.Slider', 'sap.m.RangeSlider'], '보류 질문'],
  ['이미지 넘겨보기 슬라이드', ['sap.m.Carousel'], '보류 질문'],
  ['단계별로 입력받는 마법사', ['sap.m.Wizard', 'sap.m.WizardStep'], '보류 질문'],
  ['상단 메뉴바 만들기', ['sap.m.Menu', 'sap.m.Toolbar', 'sap.m.Bar', 'sap.m.MenuButton'], '보류 질문'],
  ['새로고침', ['sap.m.PullToRefresh'], '보류 질문'],
  ['다국어 번역 텍스트', ['sap.ui.model.resource.ResourceModel', 'sap.base.i18n.ResourceBundle'], '보류 질문'],
  ['서버에서 OData 읽기', ['sap.ui.model.odata.v2.ODataModel', 'sap.ui.model.odata.v4.ODataModel'], '보류 질문'],
  ['숫자를 통화 형식으로 표시', ['sap.ui.model.type.Currency', 'sap.ui.core.format.NumberFormat'], '보류 질문'],
  ['화면 로딩 중 표시', ['sap.m.BusyIndicator', 'sap.m.BusyDialog'], '보류 질문'],
];
let ok = 0;
for (const [q, want, note] of CASES) {
  const r = recommend(index, q, intents, 8);
  const top3 = r.results.slice(0, 3).map((x) => x.c.n);
  const hit = want.some((w) => top3.some((n) => n === w || n.startsWith(w + '.')));
  if (hit) ok++;
  console.log(`${hit ? 'PASS' : 'FAIL'}  ${q}  →  ${top3.join(', ') || '(없음)'}${note ? '   // ' + note : ''}`);
  if (verbose || !hit) console.log('      해석:', r.used.map((u) => `${u.ko}→${u.en.join('/')}`).join(' · ') || '-', '| top8:', r.results.map((x) => x.c.n.split('.').pop()).join(', '));
}
console.log(`\n${ok}/${CASES.length} 통과 (상위 3개 안에 기대 API 포함)`);
