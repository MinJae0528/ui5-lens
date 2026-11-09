export const NAME_QUICK = ['Table', 'sap.m.Table', 'Dialog', '표', '팝업'];
export const METHOD_QUICK = ['setText', 'bindRows', 'attachPress', 'Button#setText', 'placeAt', 'setModel'];
export const FEATURE_QUICK = ['댓글을 다는 기능을 추가하고 싶어', '날짜를 고르고 싶어', '삭제할 때 확인창을 띄우고 싶어', '파일 업로드', '잠깐 알림 메시지 보여주기'];

/** 많이 쓰는 API 바로가기(분류별). 선택한 버전에 없는 것은 화면에서 자동으로 뺀다. */
export const POPULAR: { title: string; apis: string[] }[] = [
  { title: '입력', apis: ['sap.m.Input', 'sap.m.TextArea', 'sap.m.ComboBox', 'sap.m.Select', 'sap.m.MultiInput', 'sap.m.CheckBox', 'sap.m.RadioButton', 'sap.m.Switch', 'sap.m.DatePicker', 'sap.m.DateRangeSelection', 'sap.m.TimePicker', 'sap.m.StepInput', 'sap.m.Slider', 'sap.ui.unified.FileUploader'] },
  { title: '버튼·표시', apis: ['sap.m.Button', 'sap.m.Text', 'sap.m.Label', 'sap.m.Title', 'sap.m.Link', 'sap.m.Image', 'sap.m.Avatar', 'sap.ui.core.Icon', 'sap.m.ObjectStatus', 'sap.m.ProgressIndicator', 'sap.m.BusyIndicator'] },
  { title: '목록·표', apis: ['sap.m.List', 'sap.m.StandardListItem', 'sap.m.Table', 'sap.m.ColumnListItem', 'sap.ui.table.Table', 'sap.ui.table.TreeTable', 'sap.m.Tree'] },
  { title: '팝업·알림', apis: ['sap.m.Dialog', 'sap.m.Popover', 'sap.m.MessageBox', 'sap.m.MessageToast', 'sap.m.BusyDialog', 'sap.m.ResponsivePopover', 'sap.m.SelectDialog'] },
  { title: '화면 구성', apis: ['sap.m.App', 'sap.m.Page', 'sap.m.Panel', 'sap.m.VBox', 'sap.m.HBox', 'sap.m.IconTabBar', 'sap.m.Toolbar', 'sap.f.DynamicPage', 'sap.f.FlexibleColumnLayout', 'sap.ui.layout.form.SimpleForm', 'sap.ui.layout.Grid', 'sap.m.Wizard', 'sap.m.Carousel'] },
  { title: '데이터·이동·기반', apis: ['sap.ui.model.json.JSONModel', 'sap.ui.model.odata.v2.ODataModel', 'sap.ui.model.Filter', 'sap.ui.model.Sorter', 'sap.ui.core.mvc.Controller', 'sap.ui.core.mvc.XMLView', 'sap.ui.core.UIComponent', 'sap.ui.core.routing.Router', 'sap.ui.core.Fragment', 'sap.ui.core.Control', 'sap.ui.core.format.DateFormat', 'sap.ui.core.format.NumberFormat', 'sap.ui.core.BusyIndicator'] },
];
