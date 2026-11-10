/*
 * MES Schema 元数据 —— 唯一数据源
 * 来源：《MES应用需求文档》+《MES模块和字段设计文档》（v1.1，13 模块 / 41 功能项 / 约 75 张表）
 * 该文件同时被前端（浏览器）与 gen-sql.js（Node）使用，请勿在别处重复定义表结构。
 *
 * 字段类型 shorthand:
 *   s  = 字符串 VARCHAR
 *   i  = 整数 INT
 *   d  = 小数 DECIMAL(18,4)
 *   da = 日期 DATE
 *   dt = 时间 DATETIME
 *   x  = 长文本 TEXT
 *   j  = JSON
 *   b  = 布尔/标志 TINYINT
 */
(function (root) {
  'use strict';

  // —— 通用字段（所有业务表默认包含）——
  var COMMON = [
    { code: 'ID', label: '主键', type: 's', req: true, pk: true, sys: true },
    { code: 'ORG_ID', label: '组织', type: 's', req: true, sys: true },
    { code: 'CREATE_BY', label: '创建人', type: 's', req: true, sys: true },
    { code: 'CREATE_TIME', label: '创建时间', type: 'dt', req: true, sys: true },
    { code: 'UPDATE_BY', label: '修改人', type: 's', req: false, sys: true },
    { code: 'UPDATE_TIME', label: '修改时间', type: 'dt', req: false, sys: true },
    { code: 'DEL_FLAG', label: '删除标记', type: 'b', req: true, sys: true },
    { code: 'VER_NO', label: '数据版本', type: 'i', req: true, sys: true },
    { code: 'REMARK', label: '备注', type: 's', req: false, sys: true },
    { code: 'EXT_JSON', label: '扩展字段', type: 'j', req: false, sys: true }
  ];

  // —— 单据类实体额外必备 ——
  var DOC = [
    { code: 'DOC_NO', label: '单据号', type: 's', req: true, doc: true },
    { code: 'DOC_TYPE', label: '单别', type: 's', req: true, doc: true },
    { code: 'DOC_DATE', label: '单据日期', type: 'da', req: true, doc: true },
    { code: 'STATUS', label: '状态', type: 's', req: true, doc: true },
    /* 2026-10-19：原「制单人 MAKER / 制单时间 MAKE_TIME」已删除，与通用字段「创建人 CREATE_BY /
       创建时间 CREATE_TIME」语义重复。现全系统只保留一份创建人，且由服务端按 supOS 登录身份
       强制写入（见 server/auth.js），前端不可伪造。 */
    { code: 'AUDIT_STATUS', label: '审核状态', type: 's', req: false, doc: true },
    { code: 'AUDIT_BY', label: '审核人', type: 's', req: false, doc: true },
    { code: 'AUDIT_TIME', label: '审核时间', type: 'dt', req: false, doc: true },
    { code: 'PRINT_TIMES', label: '打印次数', type: 'i', req: false, doc: true },
    { code: 'ATTACH_URLS', label: '附件', type: 'j', req: false, doc: true }
  ];

  // 列构造器
  // ref: 引用主数据表名 —— 既用于表单下拉（新增时只能从被引用表选，形成限制），也用于导入校验（值必须已存在于被引用表）
  // opt（可选）: { filter: 'equipAvailable' | 'enable' | 'none', derive: '源列code', dict: '字典分类键' }
  //   dict  —— 本列改为「字典下拉」，候选来自 SYS_DICT 中 DICT_TYPE=该分类键 的项，存 ITEM_CODE（如 {dict:'NG_REASON'}）
  //   filter —— 下拉候选过滤（equipAvailable=剔除故障/停机设备；enable=只取启用的主数据；none=不过滤）
  //   derive —— 本列只读，值由「源列」选中的主数据行同名字段自动带出（如 STEP_NO → STEP_NAME）
  function c(code, label, type, req, ref, opt) {
    var o = { code: code, label: label, type: type || 's', req: !!req };
    if (ref) o.ref = ref;
    if (opt) for (var k in opt) if (opt[k] !== undefined && opt[k] !== null) o[k] = opt[k];
    return o;
  }

  // —— 业务表定义 ——
  // key: 表名; value: { label, domain, module, doc?, pk?(业务主键), cols:[...] }
  var T = {};

  /* ============ 工厂建模层（主数据地基） ============ */
  T.MD_CUSTOMER = { label: '客户资料', domain: 'MD', module: '客户资料', pk: 'CUSTOMER_CODE', cols: [
    c('CUSTOMER_CODE','客户编号','s',1), c('CUSTOMER_NAME','客户名称','s',1), c('SHORT_NAME','客户简称','s'),
    c('PART_NO_RULE','客户品番规则','s'), c('CONTACT','联系人','s'), c('TEL','公司电话','s'),
    c('FAX','公司传真','s'), c('ADDRESS','客户地址','s'), c('SETTLE_TYPE','结算方式','s'),
    c('CREDIT_LIMIT','信用额度','d'), c('LEAD_TIME_DAYS','默认交期(天)','i'), c('TAX_TYPE','税种','s'),
    c('TAX_RATE','税率','d'), c('CURRENCY','币种','s'), c('CUSTOMER_CLASS','客户分类','s'),
    c('SALES_OWNER','销售负责人','s'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_SUPPLIER = { label: '供应商资料', domain: 'MD', module: '供应商资料', pk: 'SUPPLIER_CODE', cols: [
    c('SUPPLIER_CODE','供应商编号','s',1), c('SUPPLIER_NAME','供应商名称','s',1), c('SUPPLY_CATEGORY','供货品类','s'),
    c('PAY_TERM','付款条件','s'), c('LEAD_TIME_DAYS','默认交期(天)','i'), c('GRADE','供应商评级','s'),
    c('QUALIFIED_FLAG','合格供方标识','b',1), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_SUPPLIER_PERF = { label: '供应商绩效(年度)', domain: 'MD', module: '供应商资料', report: true, pk: 'SUPPLIER_CODE', cols: [
    c('SUPPLIER_CODE', '供应商', 's', 1, 'MD_SUPPLIER'), c('YEAR','年度','i',1), c('ITEM_NAME','品名','s',1), c('PART_NO','品番','s'),
    c('SUBMIT_DATE','送检日期','da'), c('ARRIVAL_BATCH_QTY','到货数(批)','i'), c('QUALIFIED_BATCH_QTY','合格数(批)','i'),
    c('BATCH_PASS_RATE','批合格率','d'), c('MAKER','作成','s'), c('MAKE_DATE','日期','da')
  ]};
  /* 说明：原「到货及时率(MD_SUPPLIER_DELIVERY_RATE)」报表已按需求移除（该指标不再纳入 MES）。 */
  T.MD_PRODUCT = { label: '产品资料', domain: 'MD', module: '产品资料', pk: 'PRODUCT_NO', cols: [
    c('PRODUCT_NO','产品品号','s',1), c('PRODUCT_NAME','产品品名','s',1), c('CUSTOMER_PART_NO','客户品号','s'),
    c('CUSTOMER_CODE', '所属客户', 's', 0, 'MD_CUSTOMER'), c('INTERNAL_DRAWING_NO','社内图号','s'), c('PART_DRAWING_NO','零件图号','s'), c('SPEC','规格','s'),
    c('MODEL','型号','s'), c('UNIT','单位','s',1), c('PART_CATEGORY','零部件分类','s'), c('MACHINE_TYPE','机型','s'),
    c('LINE_CODE','生产线','s'), c('DEPT_CLASS','课别','s'), c('DRAWING_VER','图号版本','s'),
    c('OUTSOURCE_FLAG','是否外协件','b'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_BOM_HEAD = { label: 'BOM头', domain: 'MD', module: '产品资料', pk: 'BOM_NO', cols: [
    c('BOM_NO','BOM编号','s',1), c('CUSTOMER_NAME','客户名称','s'), c('PROJECT_NO','项目号','s'),
    c('PART_DRAWING_NO','零件图号','s'), c('PART_NAME','零件名称','s'), c('BOM_STATUS','BOM状态','s',1),
    c('BOM_VER','BOM版本','s',1), c('EFFECT_DATE','生效日期','da'), c('EXPIRE_DATE','失效日期','da'),
    c('AUDIT_STATUS','审核状态','s',1), c('FORM_NO','表单编号','s')
  ]};
  T.MD_BOM_LINE = { label: 'BOM行(多层级)', domain: 'MD', module: '产品资料', pk: 'BOM_NO', cols: [
    c('BOM_NO', 'BOM编号', 's', 1, 'MD_BOM_HEAD'), c('SEQ_NO','序号','i',1), c('PARENT_ITEM_CODE','父件物料','s',1,'MD_PRODUCT'),
    c('ITEM_NAME','子件物料名称','s',1), c('ITEM_CATEGORY','物料分类','s'), c('ERP_ITEM_CODE','ERP编号','s',1),
    c('UNIT','单位','s',1), c('NET_QTY','单件净用量','d',1), c('GROSS_QTY','单件毛用量','d'),
    c('LOSS_RATE','损耗率','d'), c('LEVEL_NO','层级','i',1), c('EFFECT_DATE','生效日期','da'), c('EXPIRE_DATE','失效日期','da')
  ]};
  T.MD_MATERIAL = { label: '物料资料', domain: 'MD', module: '物料资料', pk: 'ITEM_NO', barcode: 'ITEM_BARCODE', cols: [
    c('ITEM_NO','物料品号','s',1), c('ITEM_NAME','品名','s',1), c('SPEC','规格','s'), c('ITEM_CATEGORY','物料分类','s',1),
    c('ITEM_BARCODE','物料条码','s'), c('QR_CODE','二维码','s'),
    c('UNIT','单位','s',1), c('LOT_FLAG','是否批次管理','b',1), c('SN_FLAG','是否序列号管理','b',1),
    c('SAFETY_STOCK','安全库存','d'), c('MIN_STOCK','最小库存','d'), c('MAX_STOCK','最大库存','d'),
    c('PURCHASE_LEAD_TIME','采购提前期','i'), c('PRODUCE_LEAD_TIME','生产提前期','i'), c('DEFAULT_SUPPLIER','默认供应商','s'),
    c('STD_PRICE','标准单价','d'), c('PRICE_EXCL_TAX','不含税单价','d'), c('TAX_TYPE','税种','s'),
    c('TAX_RATE','税率','d'), c('CURRENCY','币种','s'), c('EXCHANGE_RATE','汇率','d'), c('CONV_RATE','库存换算','d'),
    c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_MATERIAL_CATEGORY = { label: '物料分类树', domain: 'MD', module: '物料资料', pk: 'CATEGORY_CODE', cols: [
    c('CATEGORY_CODE','分类编号','s',1), c('CATEGORY_NAME','分类名称','s'), c('PARENT_CODE','父编号','s'), c('LEVEL_NO','层级','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.MD_EQUIPMENT = { label: '设备资料', domain: 'MD', module: '设备资料', pk: 'EQUIP_NO', cols: [
    c('SEQ_NO','序号','i'), c('EQUIP_NAME','设备名称','s',1), c('EQUIP_MODEL','型号','s',1), c('MANUFACTURER','制造单位','s'),
    c('EQUIP_NO','本厂编号','s',1), c('EQUIP_TYPE','设备类型','s',1,null,{dict:'EQUIP_TYPE'}), c('TEAM_CODE', '所属班组', 's', 0, 'HR_TEAM'), c('LINE_CODE','所属产线','s'),
    c('FACTORY_DATE','出厂日期','da'), c('FACTORY_SN','出厂编号','s'), c('EQUIP_CLASS','设备类别','s',1),
    c('SYSTEM_CODE','所属系统','s'), c('CAPACITY','加工能力','s'), c('STD_CYCLE_TIME','标准节拍(s/件)','d'),
    c('EQUIP_STATUS','设备状态','s',1), c('IOT_FLAG','联网标识','b'), c('PROTOCOL','采集协议','s'),
    c('OWNER','责任人','s'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_GAUGE = { label: '量检具', domain: 'MD', module: '设备资料', pk: 'GAUGE_NO', cols: [
    c('SEQ_NO','序号','i'), c('GAUGE_NO','量具编号','s',1), c('GAUGE_NAME','量具名称','s',1), c('GAUGE_MODEL','规格型号','s'),
    c('MEASURE_RANGE','测量范围','s'), c('DIVISION','分度值','s'), c('ACCURACY','精度','s'), c('GAUGE_CLASS','管理类别','s'),
    c('LEGAL_CLASS','法制类别','s'), c('GAUGE_STATUS','量具状态','s',1), c('CALIB_DATE','检定日期','da'),
    c('EXPIRE_DATE','有效日期','da',1), c('ENABLE_DATE','启用日期','da'), c('USE_DEPT','使用部门','s'),
    c('USER_NAME','使用人','s'), c('USE_REMARK','使用备注','s')
  ]};
  T.RT_ROUTE = { label: '工艺路线主数据', domain: 'MD', module: '工艺资料', pk: 'ROUTE_NO', cols: [
    c('ROUTE_NO','工艺路线编号','s',1), c('ROUTE_NAME','工艺路线名称','s',1), c('PRODUCT_NO', '适用产品', 's', 1, 'MD_PRODUCT'),
    c('ROUTE_VER','版本','s',1), c('STEP_COUNT','工序数','i'), c('HAS_OUTSOURCE','是否含外协','b'),
    c('EFFECT_DATE','生效日期','da'), c('EXPIRE_DATE','失效日期','da'), c('STATUS','状态','s',1)
  ]};
  T.RT_ROUTE_STEP = { label: '工艺路线工序序列', domain: 'MD', module: '工艺资料', pk: 'ROUTE_NO', cols: [
    c('ROUTE_NO', '工艺路线编号', 's', 1, 'RT_ROUTE'), c('SEQ_NO','工序号','i',1), c('STEP_CODE', '工序编号', 's', 1, 'MD_STEP_DICT'), c('STEP_NAME', '工序名', 's', 0, null, {derive: 'STEP_CODE'}),
    c('WORK_CENTER','工作中心','s'), c('EQUIP_TYPE','设备类型要求','s'), c('STD_HOUR','标准工时','d'),
    c('OUTSOURCE_FLAG','外协标识','b'), c('IS_QC_POINT','是否检验点','b'), c('IS_KEY_STEP','关键工序','b')
  ]};
  T.HR_EMPLOYEE = { label: '人员资料', domain: 'MD', module: '人员/班组', pk: 'EMP_NO', cols: [
    c('EMP_NO','员工编号','s',1), c('EMP_NAME','姓名','s',1), c('POST', '岗位', 's', 1, 'MD_POSITION'), c('TEAM_CODE', '所属班组', 's', 1, 'HR_TEAM'),
    c('DEPT_CLASS','所属课别','s'), c('SKILL_LEVEL','技能等级','s'), c('AUTH_EQUIP','可操作设备','j'),
    c('PIECE_RATE_FLAG','是否计件','b'), c('PROBATION_END','试用期至','da'), c('STATUS','状态','s',1)
  ]};
  T.HR_TEAM = { label: '班组资料', domain: 'MD', module: '人员/班组', pk: 'TEAM_CODE', cols: [
    c('TEAM_CODE','班组编号','s',1), c('TEAM_NAME','班组名称','s'), c('DEPT_CLASS','课别','s'),
    c('LEADER_EMP_NO','班长','s'), c('SHIFT_MODEL','排班模式','s'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.HR_TEAM_MEMBER = { label: '班组成员', domain: 'MD', module: '人员/班组', pk: 'TEAM_CODE', cols: [
    c('TEAM_CODE', '班组编号', 's', 1, 'HR_TEAM'), c('EMP_NO', '员工编号', 's', 1, 'HR_EMPLOYEE'), c('JOIN_DATE','加入日期','da'), c('LEAVE_DATE','离开日期','da'), c('IS_LEADER','是否班长','b')
  ]};
  /* 班组排班（为 APS 排产提供「班组 × 日期 × 班次」的可用工时日历）
   * 本表是「谁、哪天、值哪个班」的花名册：班次的起止时间/工时/是否跨天不再冗余在本表，
   * 一律引用 HR_SHIFT_DEF.SHIFT_CODE（班次定义），避免两处口径不一致。 */
  T.HR_SHIFT_SCHEDULE = { label: '班组排班', domain: 'MD', module: '人员/班组', pk: 'SHIFT_ID', cols: [
    c('SHIFT_ID','排班编号','s',1), c('TEAM_CODE', '班组', 's', 1, 'HR_TEAM'), c('SHIFT_DATE','排班日期','da',1),
    c('SHIFT_CODE', '班次', 's', 1, 'HR_SHIFT_DEF'),
    c('STD_HOURS','当班工时(h)','d'), c('EQUIP_NO','负责设备','s'),
    c('REST_FLAG','是否休息','b'), c('STATUS','状态','s',1)
  ]};
  /* 班次定义（字典级主数据）：白班/中班/晚班… 的起止时间与标准工时，全局唯一、被排班与日历共同引用 */
  T.HR_SHIFT_DEF = { label: '班次定义', domain: 'SYS', module: '系统', pk: 'SHIFT_CODE', cols: [
    c('SHIFT_CODE','班次编号','s',1), c('SHIFT_NAME','班次名称','s',1), c('START_TIME','上班时间','s',1), c('END_TIME','下班时间','s',1),
    c('CROSS_DAY','是否跨天','b'), c('STD_HOURS','标准工时(h)','d',1), c('REST_MIN','休息时长(分)','i'),
    c('COLOR_TAG','显示颜色','s'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  /* 班次日历（业务事实）：某天某班组「上哪个班 / 是否休息 / 当天产能系数」，
   * 承载节假日、调休上班等特殊情况；APS 扣产能时用 HR_SHIFT_CALENDAR.CAP_RATIO 修正可用工时。 */
  T.HR_SHIFT_CALENDAR = { label: '班次日历', domain: 'MD', module: '人员/班组', pk: 'CAL_ID', cols: [
    c('CAL_ID','日历编号','s',1), c('CAL_DATE','日期','da',1), c('TEAM_CODE', '班组', 's', 1, 'HR_TEAM'),
    c('SHIFT_CODE','班次','s',1,'HR_SHIFT_DEF'), c('DAY_TYPE','日期类型','s',1), c('CAP_RATIO','产能系数','d'),
    c('WORK_HOURS','可用工时(h)','d'), c('MEMO','说明','s'), c('STATUS','状态','s',1)
  ]};
  /* 工序↔设备能力矩阵：把「工序能由哪些设备做」落到具体台号，并给出节拍与换型时间。
   * 上游 RT_ROUTE_STEP.EQUIP_TYPE 只到「设备类型」；APS 要精确排产必须知道「具体哪台、多快、换型多久」。 */
  T.MD_STEP_EQUIP_CAP = { label: '工序设备能力矩阵', domain: 'MD', module: '工艺资料', pk: 'CAP_ID', cols: [
    c('CAP_ID','能力编号','s',1), c('STEP_CODE', '工序编号', 's', 1, 'MD_STEP_DICT'), c('STEP_NAME', '工序名称', 's', 0, null, {derive: 'STEP_CODE'}),
    c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_TYPE','设备类型','s'), c('STD_CT_SEC','标准节拍(s/件)','d',1),
    c('SETUP_MIN','换型时间(min)','d'), c('CAP_QTY_H','小时产能(件/h)','d',1), c('PRIORITY','设备优先级','i'),
    c('QUALIFIED_FLAG','是否已认证','b'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_STEP_DICT = { label: '工序字典', domain: 'MD', module: '工艺资料', pk: 'STEP_CODE', cols: [
    c('STEP_CODE','工序编号','s',1), c('STEP_NAME','工序名称','s',1), c('STEP_DESC','工序说明','s'),
    c('WORK_CENTER','工作中心','s'), c('EQUIP_TYPE','设备类型要求','s'),
    c('IS_KEY_STEP','关键工序','b'), c('IS_QC_POINT','是否检验点','b'), c('STD_HOUR','标准工时','d'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.MD_POSITION = { label: '岗位资料', domain: 'MD', module: '人员/班组', pk: 'POSITION_CODE', cols: [
    c('POSITION_CODE','岗位编号','s',1), c('POSITION_NAME','岗位名称','s',1), c('POSITION_TYPE','岗位类别','s',1),
    c('GRADE','职级','s'), c('DEPT_CLASS','所属课别','s'), c('HEADCOUNT','编制人数','i'),
    c('DUTY','岗位职责','x'), c('ENABLE_FLAG','是否启用','b',1)
  ]};

  /* ============ ② 计划与工艺层 ============ */
  T.SD_QUOTATION = { label: '报价单', domain: 'SD', module: '订单管理', doc: true, pk: 'QUOTE_NO', cols: [
    c('QUOTE_NO','报价单号','s',1), c('DOC_TYPE','报价单别','s',1), c('EXCHANGE_RATE','汇率','d'),
    c('DELIVERY_DAYS','交货日(天)','i'), c('CUSTOMER_CODE', '客户', 's', 1, 'MD_CUSTOMER'), c('QUOTE_DATE','报价日期','da',1),
    c('VALID_UNTIL','报价有效期','da'), c('STATUS','状态','s',1), c('CUSTOMER_SIGN','客户签回','s')
  ]};
  T.SD_SALES_ORDER = { label: '销售订单', domain: 'SD', module: '订单管理', doc: true, pk: 'SO_NO', cols: [
    c('SO_NO','销售订单号','s',1), c('ORDER_TYPE','订单类型','s',1), c('CUSTOMER_PO_NO','客户单号','s'),
    c('CUSTOMER_CODE', '客户', 's', 1, 'MD_CUSTOMER'), c('TEL','公司电话','s'), c('FAX','公司传真','s'), c('DOC_DATE','制表日期','da',1),
    c('PAGE_NO','页次','s'), c('REVIEW_STATUS','订单评审状态','s',1), c('REVIEW_BY','评审人','s'),
    c('REVIEW_TIME','评审时间','dt'), c('DELIVERY_DATE','交期要求','da',1), c('STATUS','状态','s',1), c('MO_NO','关联生产订单','s')
  ]};
  T.SD_DELIVERY = { label: '销货单', domain: 'SD', module: '订单管理', doc: true, pk: 'DELIVERY_NO', cols: [
    c('DELIVERY_NO','销货单号','s',1), c('DOC_TYPE','销货单别','s',1), c('DOC_DATE','单据日期','da',1),
    c('MAKE_DATE','制表日期','da',1), c('CUSTOMER_CODE', '客户', 's', 1, 'MD_CUSTOMER'), c('WAREHOUSE_CODE','出库仓库','s',1),
    c('TOTAL_QTY','数量合计','d',1), c('STATUS','状态','s',1)
  ]};
  T.PD_PRICE_COMPARE = { label: '请购与比价选商', domain: 'PD', module: '订单管理', pk: 'PR_NO', cols: [
    c('PR_NO','请购单号','s',1), c('SOURCE_TYPE','请购来源','s',1), c('SOURCE_NO','来源单号','s'), c('SO_NO', '关联销售订单', 's', 0, 'SD_SALES_ORDER'), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'),
    c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}), c('SPEC','规格','s'), c('UNIT','单位','s'), c('REQ_QTY','请购数量','d',1),
    c('REQ_DATE','需求日期','da',1), c('SUGGEST_SUPPLIER','建议供应商','s'), c('COMPARE_RESULT','比价结果','s'),
    c('SELECTED_SUPPLIER','选定供应商','s',1), c('COMPARE_BY','比价人','s'), c('COMPARE_DATE','比价日期','da')
  ]};
  T.PD_PURCHASE_ORDER = { label: '采购订单', domain: 'PD', module: '订单管理', doc: true, pk: 'PO_NO', cols: [
    c('PO_NO','采购订单号','s',1), c('SO_NO', '关联销售订单', 's', 0, 'SD_SALES_ORDER'), c('DOC_DATE','制单日期','da',1), c('SUPPLIER_CODE', '供应商', 's', 1, 'MD_SUPPLIER'),
    c('RECV_WAREHOUSE','收货仓','s',1), c('DELIVERY_DATE','交货日期','da',1), c('SETTLE_TYPE','结算方式','s'),
    c('STATUS','状态','s',1), c('FORM_NO','表单编号','s')
  ]};
  T.PD_ARRIVAL = { label: '到货单', domain: 'PD', module: '订单管理', doc: true, pk: 'ARRIVAL_NO', cols: [
    c('ARRIVAL_NO','到货单号','s',1), c('DOC_TYPE','到货单别','s',1), c('ORG_ID','工厂','s',1), c('SUPPLIER_CODE', '供应商', 's', 1, 'MD_SUPPLIER'),
    c('PO_NO', '采购订单号', 's', 0, 'PD_PURCHASE_ORDER'), c('ARRIVAL_DATE','到货日期','da',1), c('SUPPLIER_DN_NO','送货单号','s'),
    c('IQC_FLAG','是否已报检','b',1), c('STATUS','状态','s',1),
    /* 来料检验进度：由检验记录（QC_TYPE=来料检验）按采购订单+供应商+批次重算 */
    c('WAIT_IQC_QTY','待来料检数量','d'), c('CHECKED_QTY','已检数量','d')
  ]};
  /* 说明：原「进货单(PD_RECEIPT / PD_RECEIPT_LINE)」环节已按需求取消——
     采购链路简化为：请购比价 → 采购订单 → 到货(+IQC) → 采购入库(WM_INBOUND)。 */
  T.PP_MASTER_PLAN = { label: '生产计划', domain: 'PP', module: '排产管理', pk: 'PLAN_NO', cols: [
    c('PLAN_NO','计划编号','s',1), c('SO_NO', '关联销售订单', 's', 0, 'SD_SALES_ORDER'), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}), c('DEPT_CLASS','课别','s'),
    c('WIP_QTY','待检及在制数量','d'), c('M1_QTY','3月计划','d'), c('M2_QTY','4月计划','d'), c('M3_QTY','5月计划','d'),
    c('TOTAL_QTY','合计计划数量','d'), c('DATA_SOURCE','数据源','s'), c('MAKER','整理人','s'), c('PUBLISH_DATE','更新发布日期','da'),
    c('PLAN_TYPE','计划类型','s',1), c('STATUS','状态','s',1)
  ]};
  T.PP_MASTER_PLAN_LINE = { label: '生产计划明细', domain: 'PP', module: '排产管理', detail: true, pk: 'PLAN_NO', cols: [
    c('PLAN_NO', '计划编号', 's', 1, 'PP_MASTER_PLAN'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_PRODUCT'), c('ITEM_NAME', '品名规格', 's', 1, null, {derive: 'ITEM_NO'}),
    c('PLAN_MONTH','计划月份','s',1), c('PLAN_QTY','计划数量','d',1), c('WO_QTY','已下达工单数量','d'),
    c('FINISHED_QTY','已完工数量','d'), c('REQ_DATE','需求交期','da'), c('LINE_STATUS','明细状态','s')
  ]};
  T.PP_ORDER_BOARD = { label: '订单+预测+在制在库一览', domain: 'PP', module: '排产管理', report: true, pk: null, cols: [
    c('DOC_DATE','制表日期','dt',1), c('BOARD_MARK','记号','s'), c('CATEGORY','类别','s'), c('ITEM_NO','品号','s',1),
    c('ITEM_NAME','品名','s',1), c('ORDER_QTY','订单数量','d'), c('DELIVERED_QTY','已交数量','d'), c('LENT_QTY','借出未销','d'),
    c('MONTH_IN_QTY','本月入库','d'), c('MONTH_OUT_QTY','本月出库','d'), c('WIP_QTY','在制数量','d'),
    c('STOCK_QTY','在库数量','d'), c('FORECAST_QTY','预测量','d'), c('SHORT_QTY','缺交数量','d')
  ]};
  /* 说明：原「MRP 展开结果(PP_MRP_RESULT)」环节已按需求取消——
     需求直接由销售订单 / 生产计划驱动请购，不再保留 MRP 展开这一独立环节。 */
  T.PP_CAPACITY_LOAD = { label: '产能/负荷(RCCP&CRP)', domain: 'PP', module: '排产管理', report: true, pk: null, cols: [
    c('CAP_LEVEL','计划层级','s',1), c('WORK_CENTER','工作中心','s',1), c('EQUIP_NO','设备','s',1), c('LOAD_DATE','日期','da',1),
    c('AVAILABLE_CAP','可用产能','d',1), c('LOAD_HOURS','负荷工时','d',1), c('LOAD_RATE','负荷率','d'),
    c('BOTTLENECK_FLAG','是否瓶颈','b'), c('SUGGEST_ADJ','建议调整','s')
  ]};
  T.PP_SCHEDULE = { label: '工序排程', domain: 'PP', module: '排产管理', pk: 'SCHEDULE_NO', cols: [
    c('SCHEDULE_NO','排程号','s',1), c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '工序号', 's', 1, 'MD_STEP_DICT'), c('EQUIP_NO','设备','s',1),
    c('EMP_NO', '人员', 's', 0, 'HR_EMPLOYEE'), /* 班组：外协行存量值 'WX' 不在 HR_TEAM 主数据内，暂不挂 ref（待定：外协工序的班组如何建模） */ c('TEAM_CODE','班组','s'), c('PLAN_START','计划开工','dt',1), c('PLAN_END','计划完工','dt',1),
    c('PRIORITY','优先级','i'), c('SCHEDULE_STATUS','排程状态','s',1), c('RUSH_FLAG','插单标识','b')
  ]};
  T.EX_WORK_ORDER = { label: '工序工单(成品工单)', domain: 'PP', module: '排产管理', doc: true, pk: 'WO_NO', barcode: 'WO_BARCODE', cols: [
    c('WO_NO','工单单号','s',1), c('WO_TYPE','工单类型','s',1), c('DOC_DATE','制表日期','da',1), c('PLAN_NO', '关联生产计划', 's', 0, 'PP_MASTER_PLAN'), c('PRODUCT_NO', '产品品号', 's', 1, 'MD_PRODUCT'),
    c('PRODUCT_NAME', '产品品名', 's', 1, null, {derive: 'PRODUCT_NO'}), c('PLAN_LOT_NO','计划批号','s'), c('OPEN_DATE','开单日期','da'),
    c('WO_BARCODE','工单条码','s'), c('QR_CODE','二维码','s'),
    c('PLAN_QTY','计划数量','d',1), c('PLAN_START','建议生产日期','da',1), c('PLAN_END','完工日期','da',1),
    c('ROUTE_NO', '工艺路线编号', 's', 1, 'RT_ROUTE'), c('ROUTE_VER','工艺路线版本','s',1), c('BOM_VER','BOM版本','s'),
    c('LINE_CODE','生产线','s'), c('DEPT_CLASS','课别','s'), c('SO_NO', '关联销售订单', 's', 0, 'SD_SALES_ORDER'), c('STATUS','状态','s',1),
    c('RELEASE_BY','下达人','s'), c('RELEASE_TIME','下达时间','dt'), c('FINISH_QTY','已完工数量','d'), c('IN_QTY','已入库数量','d')
  ]};
  T.RT_ROUTE_VERSION = { label: '工艺版本', domain: 'RT', module: '工艺资料', pk: 'ROUTE_NO', cols: [
    c('ROUTE_NO', '工艺路线编号', 's', 1, 'RT_ROUTE'), c('ROUTE_VER','版本','s',1), c('PRODUCT_NO', '适用产品', 's', 1, 'MD_PRODUCT'),
    c('EFFECT_DATE','生效日期','da'), c('STATUS','状态','s',1), c('CHANGE_REASON','变更原因','s'), c('APPROVED_BY','审批人','s')
  ]};
  T.RT_VERSION_LOG = { label: '工艺版本记录', domain: 'RT', module: '工艺资料', pk: null, cols: [
    c('ROUTE_NO', '工艺路线编号', 's', 1, 'RT_ROUTE'), c('FROM_VER','原版本','s'), c('TO_VER','新版本','s'), c('CHANGE_BY','变更人','s'),
    c('CHANGE_TIME','变更时间','dt'), c('ECN_NO','ECN号','s'), c('CHANGE_CONTENT','变更内容','s')
  ]};
  T.RT_SOP = { label: '作业指导书', domain: 'RT', module: '工艺资料', pk: 'SOP_NO', cols: [
    c('SOP_NO','SOP编号','s',1), c('ITEM_NAME','品名','s',1), c('PART_NO','品番','s'), c('ENGINEER_NAME','工程名','s',1),
    c('STEP_NO', '工序号', 's', 0, 'MD_STEP_DICT'), c('SOP_VER','版本','s',1), c('SOP_CONTENT','作业要领','x',1), c('KEY_POINTS','关键注意点','x'),
    c('IMAGE_URLS','图示','j'), c('EQUIP_NO', '适用设备', 's', 0, 'MD_EQUIPMENT'), c('EFFECT_DATE','生效日期','da'), c('STATUS','状态','s',1)
  ]};
  T.RT_OUTSOURCE_STEP = { label: '外协工序', domain: 'RT', module: '工艺资料', pk: 'STEP_CODE', cols: [
    c('STEP_CODE', '工序编号', 's', 1, 'MD_STEP_DICT'), c('OUTSOURCE_FLAG','外协标识','b'), c('SUPPLIER_CODE', '外协厂', 's', 0, 'MD_SUPPLIER'),
    c('PRICE','价格','d'), c('LEAD_TIME','交期(天)','i'), c('IQC_REQUIRED','需IQC','b'), c('HAS_INSPECTION_REPORT','有检验报告','b')
  ]};

  /* ============ ③ 生产执行层 ============ */
  T.EX_WO_STEP = { label: '工单工序明细', domain: 'EX', module: '生产执行', pk: 'WO_NO', cols: [
    c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '工序号', 's', 1, 'MD_STEP_DICT'), c('STEP_NAME', '工序名', 's', 1, null, {derive: 'STEP_NO'}), c('EQUIP_SPEC','设备规格','s'),
    c('EQUIP_COUNT','设备台数','i'), c('EQUIP_NO', '指定设备', 's', 0, 'MD_EQUIPMENT', {filter: 'equipAvailable'}), c('PROC_MODE','工序方式','s'), c('PLAN_QTY','计划数量','d',1),
    c('REPORT_QTY','报工数量','d',1), c('GOOD_QTY','合格数量','d',1), c('NG_QTY','不良数量','d',1), c('SCRAP_QTY','报废数量','d'),
    /* 待检数量：本工序已报工但尚未被检验记录覆盖的数量，由服务端按检验记录实时重算（rules.js） */
    c('WAIT_QC_QTY','待检数量','d'),
    c('REWORK_QTY','返工数量','d'), c('STD_HOUR','标准工时','d'), c('ACT_HOUR','实际工时','d'), c('OPERATOR','操作人','s'),
    c('LEADER', '班长', 's', 0, 'HR_EMPLOYEE'), c('SHIFT', '班次', 's', 0, 'HR_SHIFT_DEF'), c('PLAN_START','计划开工','dt'), c('PLAN_END','计划完工','dt'),
    c('ACT_START','实际开工','dt'), c('ACT_END','实际完工','dt'), c('STEP_STATUS','工序状态','s',1),
    c('IS_QC_POINT','是否检验点','b'), c('OUTSOURCE_FLAG','是否外协','b'), c('PREV_STEP_NO', '上道工序', 's', 0, 'MD_STEP_DICT'), c('NEXT_STEP_NO', '下道工序', 's', 0, 'MD_STEP_DICT')
  ]};
  T.EX_ISSUE_ORDER = { label: '领料单', domain: 'EX', module: '生产执行', doc: true, pk: 'ISSUE_NO', cols: [
    c('ISSUE_NO','领料单号','s',1), c('DOC_TYPE','领料单别','s',1), c('DOC_DATE','制表日期','da',1), c('ORG_ID','工厂','s',1),
    c('PAGE_NO','页次','s'), c('DEPT_CLASS','领料部门','s'), c('TEAM_CODE', '班组', 's', 0, 'HR_TEAM'), c('ISSUE_BY','领料人','s',1),
    c('STOREKEEPER','发料人','s',1), c('ISSUE_TYPE','领料类型','s',1), c('WO_NO', '关联工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '关联工序号', 's', 0, 'MD_STEP_DICT'),
    c('TOTAL_QTY','领料数量合计','d',1), c('STATUS','状态','s',1)
  ]};
  T.EX_MACHINE_DATA = { label: '加工采集数据', domain: 'EX', module: '生产执行', pk: 'COLLECT_NO', cols: [
    c('COLLECT_NO','采集记录号','s',1), c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '工序号', 's', 1, 'MD_STEP_DICT'), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT', {filter: 'equipAvailable'}),
    c('COLLECT_TIME','采集时间','dt',1), c('RUN_STATUS','运行状态','s',1), c('PROCESS_QTY','加工数量','i'),
    c('SPINDLE_SPEED','主轴转速','d'), c('FEED_RATE','进给','d'), c('CUT_PARAM','切削参数','s'), c('PROGRAM_NO','程序号','s'),
    c('TOOL_NO','刀具号','s'), c('TOOL_LIFE','刀具寿命','s'), c('ALARM_CODE','报警码','s'), c('ALARM_MSG','报警信息','s'),
    c('ENERGY_KWH','能耗(kWh)','d'), c('RAW_DATA','原始报文','j')
  ]};
  T.EX_LABOR_RECORD = { label: '工时/人工记录', domain: 'EX', module: '生产执行', pk: null, cols: [
    c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '工序号', 's', 1, 'MD_STEP_DICT'), c('EMP_NO', '员工', 's', 1, 'HR_EMPLOYEE'), c('SHIFT', '班次', 's', 1, 'HR_SHIFT_DEF'),
    c('START_TIME','开始时间','dt',1), c('END_TIME','结束时间','dt',1), c('DURATION_MIN','时长(分)','d'),
    c('MACHINE_NO','机台号','s'), c('QTY','数量','d'), c('TYPE','类型','s'), c('WORK_DATE','工作日期','da')
  ]};
  T.EX_REPORT = { label: '工序报工(核心)', domain: 'EX', module: '生产执行', pk: 'REPORT_NO', cols: [
    c('REPORT_NO','报工单号','s',1), c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('STEP_NO', '工序号', 's', 1, 'MD_STEP_DICT'), c('STEP_NAME', '工序名', 's', 1, null, {derive: 'STEP_NO'}),
    c('SUB_STEP_NO','工步号','s'), c('REPORT_DATE','报工日期','da',1), c('SHIFT', '班次', 's', 1, 'HR_SHIFT_DEF'), c('OPERATOR', '操作人', 's', 1, 'HR_EMPLOYEE'),
    c('LEADER', '班长', 's', 0, 'HR_EMPLOYEE'), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT', {filter: 'equipAvailable'}), c('REPORT_QTY','报工数量','d',1), c('GOOD_QTY','合格数量','d',1),
    c('NG_QTY','不良数量','d',1), c('SCRAP_QTY','报废数量','d'), c('REWORK_QTY','返工数量','d'), c('NG_REASON_CODE','不良原因码','s',0,null,{dict:'NG_REASON'}),
    c('LOT_NO','加工批次','s'), c('START_TIME','开始时间','dt',1), c('END_TIME','结束时间','dt',1), c('STD_HOUR','标准工时','d'),
    c('ACT_HOUR','实际工时','d'), c('DOWN_MIN','停机时间','d'), c('DOWN_REASON','停机原因','s'), c('PROC_MODE','工序方式','s'),
    c('QC_STATUS','检验状态','s'), c('QC_NO', '检验单号', 's', 0, 'QC_INSPECTION'), c('NEXT_STEP_NO', '下道工序', 's', 0, 'MD_STEP_DICT'), c('DATA_SOURCE','数据来源','s'),
    c('STATUS','状态','s',1), c('REVERSE_REASON','冲销原因','s'), c('REVERSE_BY','冲销人','s')
  ]};
  T.QC_INSPECTION = { label: '检验记录', domain: 'EX', module: '生产执行', doc: true, pk: 'QC_NO', cols: [
    c('QC_NO','检验单号','s',1), c('FORM_NO','文件编号','s'), c('QC_TYPE','检验类型','s',1), c('QC_STANDARD','检验依据','s'),
    /* 来料检的归属到货单：IQC 只有挂到这里，到货单的待检/已检数量才能算得出来 */
    c('ARRIVAL_NO', '关联到货单', 's', 0, 'PD_ARRIVAL'),
    c('WO_NO', '关联工单', 's', 0, 'EX_WORK_ORDER'), c('STEP_NO', '关联工序', 's', 0, 'MD_STEP_DICT'), c('CUSTOMER_NAME','客户名称','s'), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'),
    c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}), c('SPEC','规格','s'), c('PART_NO','品番','s'), c('INTERNAL_DRAWING_NO','社内图号','s'),
    c('QTY','数量','d',1), c('UNIT','单位','s',1), c('BATCH_QTY','本批数量','d'), c('SAMPLE_QTY','抽检数量','d'),
    c('PASS_QTY','合格数量','d',1), c('FAIL_QTY','不合格数量','d',1), c('DEFECT_DESC','不良现象','x'), c('QC_RESULT','判定','s',1),
    /* 不合格品去向拆分：返工 / 报废 / 待判定；三者由检验结果与返工单、报废单实时重算 */
    c('REWORK_QTY','返工数量','d'), c('SCRAP_QTY','报废数量','d'), c('PENDING_QTY','待判定数量','d'),
    c('GAUGE_NO', '量具编号', 's', 0, 'MD_GAUGE'), c('INSPECTOR','检查员','s',1), c('INSPECT_DATE','检查日期','da',1), c('STATUS','状态','s',1)
  ]};
  T.QC_REWORK_ORDER = { label: '返工工单', domain: 'EX', module: '生产执行', doc: true, pk: 'REWORK_NO', cols: [
    c('REWORK_NO','返工单号','s',1), c('DOC_TYPE','单据类型','s'), c('ORIGIN_WO_NO','原工单单号','s',1), c('REWORK_TYPE','返工类型','s'),
    c('RUSH_FLAG','急料标识','b'), c('OPEN_DATE','开单日期','da',1), c('STATUS_CODE','状态码','s'), c('PRODUCT_NO', '产品品号', 's', 1, 'MD_PRODUCT'),
    c('PRODUCT_NAME', '产品品名', 's', 1, null, {derive: 'PRODUCT_NO'}), c('SPEC','规格','s'), c('SET_QTY','套数','d'), c('PRODUCED_QTY','已生产量','d'),
    c('SCRAP_QTY','报废数量','d'), c('DESTROY_QTY','破坏数量','d'), c('REWORK_STEP','返工工序','s'), c('REWORK_REASON','返工原因','s'),
    c('NG_REASON_CODE','不良原因码','s',0,null,{dict:'NG_REASON'}), c('QC_NO', '关联检验单', 's', 0, 'QC_INSPECTION'), c('REWORK_PASS_QTY','返工后合格数','d'), c('STATUS','状态','s',1)
  ]};
  T.QC_SCRAP_ORDER = { label: '报废单', domain: 'EX', module: '生产执行', doc: true, pk: 'SCRAP_NO', cols: [
    c('SCRAP_NO','报废单号','s',1), c('DOC_NAME','单据名称','s',1), c('DOC_TYPE','单别','s',1), c('DOC_DATE','制表日期','da',1),
    c('PAGE_NO','页次','s'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}), c('SPEC','规格','s'),
    c('SCRAP_QTY','报废数量','d',1), c('TOTAL_SCRAP_QTY','报废总数量','d',1), c('SCRAP_TYPE','报废类别','s',1), c('SCRAP_REASON','报废原因','s'),
    c('NG_REASON_CODE','不良原因码','s',0,null,{dict:'NG_REASON'}), c('WO_NO', '关联工单', 's', 0, 'EX_WORK_ORDER'), c('STEP_NO', '关联工序', 's', 0, 'MD_STEP_DICT'), c('RESP_DEPT','责任部门','s'),
    c('RESP_EMP','责任人','s'), c('AUDIT_BY','审核人','s'), c('AUDIT_TIME','审核时间','dt'), c('STATUS','状态','s',1)
  ]};
  T.EX_WIP_BOARD = { label: 'WIP在制看板', domain: 'EX', module: '生产执行', report: true, pk: 'WO_NO', cols: [
    c('SNAPSHOT_TIME','快照时间','dt',1), c('WO_NO','工单号','s',1), c('PRODUCT_NO','产品品号','s',1), c('ITEM_NAME','品名','s',1),
    c('CURRENT_STEP_NO','当前工序编号','s',1), c('CURRENT_STEP_NAME','当前工序名','s'), c('GOOD_QTY','良品数量','d',1),
    c('WAIT_QC_QTY','待检数量','d'), c('WIP_QTY','在制数量','d',1), c('PLAN_QTY','计划数量','d',1), c('DONE_RATE','完成率','d',1),
    c('EST_FINISH_TIME','预计完工','dt'), c('WIP_STATUS','状态','s',1), c('STAGNANT_DAYS','停滞天数','i'), c('AREA_CODE','所在区域','s')
  ]};
  T.EX_FINISH_IN = { label: '完工入库申请', domain: 'EX', module: '生产执行', pk: 'IN_NO', cols: [
    c('IN_NO','入库申请号','s',1), c('WO_NO', '工单号', 's', 1, 'EX_WORK_ORDER'), c('PRODUCT_NO', '产品品号', 's', 1, 'MD_PRODUCT'), c('FINISH_QTY','完工数量','d'),
    c('GOOD_QTY','良品数量','d'), c('NG_QTY','不良数量','d'), c('QC_NO', '成品检验单', 's', 0, 'QC_INSPECTION'), c('WAREHOUSE_CODE','仓库','s'), c('LOCATION','库位','s'),
    c('LOT_NO','批次','s'), c('STATUS','状态','s',1), c('IN_TIME','入库时间','dt')
  ]};
  T.EX_SHIFT_HANDOVER = { label: '班组交接记录', domain: 'EX', module: '生产执行', doc: true, pk: 'HANDOVER_NO', cols: [
    c('HANDOVER_NO','交接记录号','s',1), c('WORK_DATE','日期','da',1), c('TEAM_CODE', '班组名称', 's', 1, 'HR_TEAM'), c('SHIFT', '班次', 's', 1, 'HR_SHIFT_DEF'),
    c('FROM_EMP','交班人','s',1), c('TO_EMP','接班人','s',1), c('ABSENT_EMP','缺勤人员','s'), c('HANDOVER_CONTENT','交接事项','x'), c('STATUS','状态','s',1)
  ]};
  T.EX_SHIFT_STATION_CHECK = { label: '工位点检明细', domain: 'EX', module: '生产执行', pk: 'HANDOVER_NO', cols: [
    c('HANDOVER_NO', '交接记录号', 's', 1, 'EX_SHIFT_HANDOVER'), c('MACHINE_NO','机台号','s',1), c('RUN_STATUS','生产状况','s'), c('REPAIR_NO','设备保修单编号','s'), c('REMARK','备注','s')
  ]};
  T.EX_DAILY_OUTPUT = { label: '生产线日报', domain: 'EX', module: '生产执行', report: true, pk: 'DAILY_NO', cols: [
    c('DAILY_NO','日报编号','s',1), c('LINE_CODE','生产线','s',1), c('MACHINE_TYPE','机型','s',1), c('DEPT_CLASS','课别','s'),
    c('WORK_DATE','日期','da',1), c('SEQ_NO','序号','i',1), c('STEP_NAME','工序','s',1), c('EQUIP_SPEC','设备规格','s'),
    c('EQUIP_COUNT','设备台数','i'), c('SHIFT','班次','s'), c('OPERATOR','作业员','s'), c('LEADER','班长','s'),
    c('PLAN_QTY','计划数量','d',1), c('ACT_QTY','实绩数量','d',1), c('DIFF_QTY','差异数量','d'), c('NG_QTY','不良数量','d'),
    c('TOTAL_QTY','合计','d'), c('PROC_MODE','工序方式','s'), c('EQUIP_ABNORMAL','设备异常记录','s'), c('REMARK','备注','s')
  ]};

  /* ============ ④ 资源支撑层 ============ */
  T.EQ_EQUIPMENT_LEDGER = { label: '设备台账', domain: 'EQ', module: '设备管理', pk: 'EQUIP_NO', cols: [
    c('EQUIP_NO', '设备主数据编号', 's', 1, 'MD_EQUIPMENT'), c('ASSET_NO','资产编号','s'), c('LOCATION','安装位置','s'), c('LINE_CODE','产线','s'),
    c('START_USE_DATE','投用日期','da'), c('WARRANTY_END','保修期至','da'), c('SPARE_PARTS','备品备件','j'),
    c('PM_CYCLE','保养周期(天)','i'), c('CHECK_CYCLE','点检周期','s'), c('EQUIP_STATUS','设备状态','s',1), c('TOTAL_RUN_HOUR','累计运行工时','d')
  ]};
  T.EQ_INSPECTION = { label: '日常点检', domain: 'EQ', module: '设备管理', doc: true, pk: 'INSPECT_NO', cols: [
    c('INSPECT_NO','点检单号','s',1), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_NAME', '设备名称', 's', 0, null, {derive: 'EQUIP_NO'}), c('USE_DEPT','使用单位','s'),
    c('INSPECT_DATE','点检日期','da',1), c('CYCLE_TYPE','点检周期','s'), c('SHIFT', '班次', 's', 0, 'HR_SHIFT_DEF'), c('CHECK_ITEM','点检项目','s',1),
    c('JUDGE_RESULT','判定','s',1), c('PHOTO_URLS','点检照片','j'), c('INSPECT_BY','点检人','s',1), c('CONFIRM_BY','确认人','s',1),
    c('ALLOW_START','是否允许开机','b',1), c('STATUS','状态','s',1)
  ]};
  T.EQ_INSPECTION_ITEM = { label: '点检项模板', domain: 'EQ', module: '设备管理', pk: 'TEMPLATE_CODE', cols: [
    c('TEMPLATE_CODE','模板编号','s',1), c('EQUIP_TYPE','设备类型','s'), c('CHECK_ITEM','点检项目','s'), c('METHOD','方法','s'),
    c('STANDARD','标准','s'), c('IS_KEY_ITEM','关键项','b'), c('SEQ_NO','序号','i')
  ]};
  /* 保养计划：除「计划保养日期」外，另给「计划起止时刻 + 预计停机分钟 + 是否占排产资源」，
   * 供 APS 把维保窗口当成不可用产能扣除（原来只有 PLAN_DATE 一天的粒度，无法落到小时）。 */
  T.EQ_MAINTENANCE_PLAN = { label: '保养计划(PM)', domain: 'EQ', module: '设备管理', doc: true, pk: 'PM_NO', cols: [
    c('PM_NO','保养计划号','s',1), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_NAME', '设备名称', 's', 1, null, {derive: 'EQUIP_NO'}), c('USE_DEPT','使用单位','s'),
    c('PM_LEVEL','保养级别','s',1), c('PLAN_DATE','计划保养日期','da',1),
    c('PLAN_START','计划开始','dt'), c('PLAN_END','计划结束','dt'), c('EST_DOWN_MIN','预计停机(分)','i'), c('AFFECT_CAPACITY','是否占排产资源','b'),
    c('ACT_DATE','实际保养日期','da'), c('PM_ITEM','保养项目','s',1),
    c('PM_CONTENT','保养内容','x'), c('PHOTO_URLS','保养照片','j'), c('ONTIME_FLAG','是否按期','b',1), c('EXEC_BY','执行人','s',1),
    c('SUPERVISE_BY','监督人','s',1), c('STATUS','状态','s',1)
  ]};
  T.EQ_MAINTENANCE_RECORD = { label: '保养记录', domain: 'EQ', module: '设备管理', pk: 'PM_NO', cols: [
    c('PM_NO', '保养计划号', 's', 0, 'EQ_MAINTENANCE_PLAN'), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_NAME', '设备名称', 's', 0, null, {derive: 'EQUIP_NO'}), c('USE_DEPT','使用单位','s'),
    c('PM_LEVEL','保养级别','s'), c('PLAN_DATE','计划保养日期','da'), c('ACT_DATE','实际保养日期','da'), c('PM_ITEM','保养项目','s'),
    c('PM_CONTENT','保养内容','x'), c('PHOTO_URLS','保养照片','j'), c('ONTIME_FLAG','是否按期','b'), c('EXEC_BY','执行人','s'),
    c('SUPERVISE_BY','监督人','s'), c('STATUS','状态','s')
  ]};
  T.EQ_PATROL = { label: '设备巡检', domain: 'EQ', module: '设备管理', doc: true, pk: 'PATROL_NO', cols: [
    c('PATROL_NO','巡检单号','s',1), c('PATROL_ROUTE','巡检路线','s'), c('PATROL_DATE','巡检日期','da',1), c('SHIFT', '班次', 's', 0, 'HR_SHIFT_DEF'),
    c('PATROL_BY','巡检人','s',1), c('EQUIP_NO', '设备/点位', 's', 1, 'MD_EQUIPMENT'), c('POINT_CODE','点位','s'), c('RESULT','巡检结果','s',1),
    c('ABNORMAL_DESC','异常描述','s'), c('TO_REPAIR_FLAG','触发报修','b'), c('PHOTO_URLS','照片','j')
  ]};
  T.EQ_FAULT_REPAIR = { label: '故障报修', domain: 'EQ', module: '设备管理', doc: true, pk: 'MANAGE_NO', cols: [
    c('FORM_NO','表单编号','s'), c('MANAGE_NO','管理No.','s',1), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_NAME', '设备名称', 's', 1, null, {derive: 'EQUIP_NO'}),
    c('DEPT_CLASS','加工部门','s'), c('FAULT_TIME','故障发生时间','dt',1), c('FAULT_DESC','故障现象','x',1), c('FAULT_TYPE','故障类别','s'),
    c('DOWN_MIN','停机时长(分)','d'), c('REPORT_BY','申报人','s',1), c('REPORT_TIME','申报时间','dt',1), c('REPAIR_BY','维修人','s'),
    c('REPAIR_START','维修开始','dt'), c('REPAIR_END','维修结束','dt'), c('SPARE_USED','更换备件','j'), c('REPAIR_COST','维修费用','d'),
    c('DISPOSE_RESULT','处置结果','s'), c('VERIFY_BY','验证人','s'), c('AFFECT_DELIVERY','影响交期','b'), c('STATUS','状态','s',1)
  ]};
  T.EQ_STATUS_MONITOR = { label: '状态监测', domain: 'EQ', module: '设备管理', report: true, pk: null, cols: [
    c('EQUIP_NO','设备编号','s',1), c('COLLECT_TIME','采集时间','dt',1), c('STATUS','状态','s',1), c('DURATION_MIN','持续时长(分)','d'),
    c('TO_RCCP','向排产可用','b'), c('WARN_MSG','异常预警','s')
  ]};
  T.EQ_OEE = { label: '设备综合效率(OEE)', domain: 'EQ', module: '设备管理', report: true, pk: null, cols: [
    c('STAT_DATE','统计日期','da',1), c('PERIOD','周期','s',1), c('EQUIP_NO','设备编号','s',1), c('PLANNED_MIN','计划运行(min)','d',1),
    c('PLANNED_DOWN_MIN','计划停机(min)','d',1), c('UNPLANNED_DOWN_MIN','非计划停机(min)','d',1), c('CHANGE_MIN','换型时间(min)','d',1), c('WAIT_MATERIAL_MIN','待料时间(min)','d',1),
    c('RUN_MIN','实际运行(min)','d',1), c('AVAILABILITY','可用率','d',1), c('IDEAL_CT','理论节拍','d'), c('ACT_CT','实际节拍','d'),
    c('PERFORMANCE','性能率','d',1), c('TOTAL_QTY','总产量','d',1), c('GOOD_QTY','良品数','d',1), c('QUALITY_RATE','良率','d',1),
    c('OEE_VALUE','OEE','d',1), c('OEE_TARGET','及格线','d'), c('EQUIP_GROUP','设备组','s')
  ]};
  /* 设备运行状态（实体表）：按「状态段」记录设备某段时间的运行/待机/故障/保养/停机，
   * 是设备可用性的唯一事实来源——APS 排产按 STATE_FROM~STATE_TO 扣除不可用时段，
   * OEE / 状态监测报表由此派生（原来只有实时派生视图，没有可落地的状态实体）。 */
  T.EQ_RUNTIME_STATUS = { label: '设备运行状态', domain: 'EQ', module: '设备管理', pk: 'STATUS_ID', cols: [
    c('STATUS_ID','状态记录号','s',1), c('EQUIP_NO', '设备编号', 's', 1, 'MD_EQUIPMENT'), c('EQUIP_NAME', '设备名称', 's', 0, null, {derive: 'EQUIP_NO'}),
    c('RUN_STATE','运行状态','s',1), c('STATE_FROM','开始时间','dt',1), c('STATE_TO','结束时间','dt'),
    c('DUR_MIN','持续时长(分)','d'), c('CUR_WO_NO','当前工单','s'), c('CUR_STEP_NO', '当前工序', 's', 0, 'MD_STEP_DICT'), c('CUR_ORDER_NO','当前订单','s'),
    c('SPEED_RATE','速率(%)','d'), c('SOURCE','数据来源','s'), c('MEMO','说明','s'), c('STATUS','状态','s',1)
  ]};
  T.WM_STOCK = { label: '库存主账', domain: 'WM', module: '出入库', pk: 'STOCK_ID', cols: [
    c('STOCK_ID','库存记录号','s',1), c('WAREHOUSE_CODE','仓库','s',1), c('LOCATION','库位','s',1), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'),
    c('ITEM_NAME', '品名', 's', 0, null, {derive: 'ITEM_NO'}), c('SPEC','规格','s'), c('UNIT','单位','s'), c('LOT_NO','批次号','s'), c('QC_STATUS','质检状态','s',1),
    c('ONHAND_QTY','在库数量','d',1), c('AVAILABLE_QTY','可用数量','d',1), c('FROZEN_QTY','冻结数量','d',1), c('INTRANSIT_QTY','在途数量','d'),
    /* 待检冻结数量：质检状态为「待检」的量，不计入可用量；由出入库与质检结果实时重算 */
    c('QC_HOLD_QTY','待检冻结数量','d'),
    c('SAFETY_STOCK','安全库存','d'), c('STOCK_AGE','库龄(天)','i'), c('PRODUCE_DATE','生产日期','da'), c('EXPIRE_DATE','有效期','da')
  ]};
  T.WM_STOCK_LOT = { label: '批次库存', domain: 'WM', module: '出入库', pk: 'STOCK_LOT_ID', cols: [
    c('STOCK_LOT_ID','批次库存号','s',1), c('WAREHOUSE_CODE','仓库','s',1), c('LOCATION','库位','s',1), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'),
    c('ITEM_NAME', '品名', 's', 0, null, {derive: 'ITEM_NO'}), c('SPEC','规格','s'), c('UNIT','单位','s'), c('LOT_NO','批次号','s',1), c('QC_STATUS','质检状态','s',1),
    c('ONHAND_QTY','在库数量','d',1), c('AVAILABLE_QTY','可用数量','d',1), c('FROZEN_QTY','冻结数量','d',1), c('INTRANSIT_QTY','在途数量','d'),
    /* 待检冻结数量：质检状态为「待检」的量，不计入可用量；由出入库与质检结果实时重算 */
    c('QC_HOLD_QTY','待检冻结数量','d'),
    c('SAFETY_STOCK','安全库存','d'), c('PRODUCE_DATE','生产日期','da'), c('EXPIRE_DATE','有效期','da')
  ]};
  T.WM_INBOUND = { label: '入库(采购/完工/退料)', domain: 'WM', module: '出入库', doc: true, pk: 'IN_NO', cols: [
    c('IN_NO','入库单号','s',1), c('IN_TYPE','入库类型','s',1), c('DOC_TYPE','单别','s'), c('SUPPLIER_CODE', '供应商', 's', 0, 'MD_SUPPLIER'),
    /* 品号是库存聚合的最小维度：缺了它，入库只能按批次猜，库存现有量算不准 */
    c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 0, null, {derive: 'ITEM_NO'}),
    c('ARRIVAL_NO', '关联到货单', 's', 0, 'PD_ARRIVAL'), c('WAREHOUSE_CODE','仓库','s',1), c('ACCEPT_QTY','验收数量','d',1), c('PRICE_QTY','计价数量','d'),
    c('LOT_NO','批次','s'), c('QC_NO', '检验单号', 's', 0, 'QC_INSPECTION'), c('QC_RESULT','检验结果','s'), c('STATUS','状态','s',1)
  ]};
  T.WM_OUTBOUND = { label: '出库(领料/销售/报废)', domain: 'WM', module: '出入库', doc: true, pk: 'OUT_NO', cols: [
    c('OUT_NO','出库单号','s',1), c('OUT_TYPE','出库类型','s',1), c('WO_NO', '关联工单', 's', 0, 'EX_WORK_ORDER'), c('STEP_NO', '关联工序', 's', 0, 'MD_STEP_DICT'),
    /* 品号 + 领料单号：库存扣减按品号算，领料行累计按领料单回填，两者都依赖这两个键 */
    c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 0, null, {derive: 'ITEM_NO'}),
    c('ISSUE_NO', '关联领料单', 's', 0, 'EX_ISSUE_ORDER'),
    c('WAREHOUSE_CODE','仓库','s',1), c('LOCATION','库位','s',1), c('LOT_NO','批次','s',1), c('OUT_QTY','出库数量','d',1),
    c('ISSUE_BY','领料人','s',1), c('STOREKEEPER','发料人','s',1), c('RETURN_QTY','余料退料数量','d')
  ]};
  T.WM_FINISH_IN = { label: '成品入库单', domain: 'WM', module: '出入库', doc: true, pk: 'IN_NO', cols: [
    c('IN_NO','入库单号','s',1), c('DOC_NAME','单据名称','s',1), c('DOC_DATE','制表日期','da',1), c('PAGE_NO','页次','s'),
    c('WO_NO', '关联工单', 's', 1, 'EX_WORK_ORDER'), c('WAREHOUSE_CODE','仓库','s',1), c('LOCATION','库位','s'), c('LOT_NO','批次','s'),
    c('QC_NO', '成品检验单号', 's', 0, 'QC_INSPECTION'), c('ACCEPT_QTY','入库验收数量','d',1), c('TOTAL_IN_QTY','总入库数量','d',1),
    c('GOOD_QTY','良品数量','d'), c('NG_QTY','不良数量','d'), c('REWORK_IN_FLAG','返修入库','b'), c('STATUS','状态','s',1)
  ]};
  T.WM_STOCKTAKING = { label: '盘点', domain: 'WM', module: '出入库', doc: true, pk: 'ST_NO', cols: [
    c('ST_NO','盘点单号','s',1), c('ST_TYPE','盘点类型','s',1), c('ST_DATE','盘点日期','da',1), /* 盘点对象含物料与成品：以全品号主数据 MD_MATERIAL 为候选（含 P-SF-001 等成品） */ c('PRODUCT_NO', '产品品号', 's', 1, 'MD_MATERIAL'),
    c('ITEM_NAME','品名','s',1, null, {derive: 'PRODUCT_NO'}), c('STEP_NO', '工序编号', 's', 0, 'MD_STEP_DICT'), c('BOOK_QTY','账面数量','d',1), c('ACTUAL_QTY','实盘数量','d',1),
    c('GOOD_QTY','良品数量','d'), c('DIFF_QTY','差异数量','d'), c('DIFF_REASON','差异原因','s'), c('COUNT_BY','盘点人','s',1),
    c('AUDIT_BY','审核人','s',1), c('STATUS','状态','s',1)
  ]};

  /* ============ 生产报表 · 追溯报表（由业务数据实时派生，只读） ============
   * 这两张表不落地人工录入：每次打开都按条码 / 批次 / 工单号从业务单据实时汇总，
   * 因此上游任何新增修改都会自动反映到追溯链上（见 app.js 的 RPT_DERIVE）。 */
  T.RPT_TRACE_MATERIAL = { label: '追溯报表-物料', domain: 'RPT', module: '生产报表', report: true, pk: 'MATERIAL_BARCODE', cols: [
    c('MATERIAL_BARCODE','物料条码','s'), c('ITEM_NO','物料品号','s',1), c('ITEM_NAME','品名','s'),
    c('LOT_NO','批次','s'), c('NODE_SEQ','环节序号','i'), c('NODE_NAME','流转环节','s'),
    c('DOC_TABLE','来源表','s'), c('DOC_NO','单据号','s'), c('QTY','数量','d'), c('UNIT','单位','s'),
    c('WORK_DATE','发生日期','da'), c('OPERATOR','责任人','s'), c('STATUS','状态','s')
  ]};
  T.RPT_TRACE_WORK = { label: '追溯报表-报工', domain: 'RPT', module: '生产报表', report: true, pk: 'TRACE_NO', cols: [
    c('TRACE_NO','追溯号','s',1), c('REPORT_NO','报工单号','s',1), c('WO_BARCODE','工单条码','s'), c('WO_NO','工单号','s',1),
    c('PRODUCT_NO','产品品号','s'), c('PRODUCT_NAME','产品品名','s'), c('STEP_NO','工序号','s',1), c('STEP_NAME','工序名','s'),
    c('EQUIP_NO','设备编号','s'), c('OPERATOR','操作人','s'), c('SHIFT','班次','s'), c('REPORT_DATE','报工日期','da',1),
    c('REPORT_QTY','报工数量','d'), c('GOOD_QTY','合格数量','d'), c('NG_QTY','不良数量','d'),
    c('LOT_NO','加工批次','s'), c('QC_NO','关联检验单','s'), c('QC_STATUS','检验状态','s'),
    c('NEXT_STEP_NO','下道工序','s'), c('DATA_SOURCE','数据来源','s')
  ]};

  /* ============ 系统 ============ */
  T.SYS_DICT = { label: '字典', domain: 'SYS', module: '系统', pk: 'DICT_CODE', cols: [
    c('DICT_CODE','字典编号','s',1), c('DICT_NAME','字典名称','s'), c('DICT_TYPE','字典类型','s'), c('ITEM_CODE','项编号','s'),
    c('ITEM_NAME','项名称','s'), c('ITEM_VALUE','项值','s'), c('SORT_NO','排序','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.SYS_CODE_RULE = { label: '编号规则', domain: 'SYS', module: '系统', pk: 'RULE_CODE', cols: [
    c('RULE_CODE','规则编号','s',1), c('BIZ_TYPE','业务类型','s'), c('PREFIX','前缀','s'), c('DATE_FMT','日期格式','s'),
    c('FLOW_LEN','流水长度','i'), c('CUR_NO','当前流水','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.SYS_AUDIT_LOG = { label: '审计日志', domain: 'SYS', module: '系统', pk: 'LOG_ID', cols: [
    c('LOG_ID','日志ID','s',1), c('TABLE_NAME','表名','s'), c('RECORD_ID','记录ID','s'), c('ACTION','操作','s'),
    c('FIELD_DIFF','字段差异','x'), c('OPERATOR','操作人','s'), c('OP_TIME','操作时间','dt'), c('REMARK','备注','s')
  ]};
  T.SYS_ATTACHMENT = { label: '附件', domain: 'SYS', module: '系统', pk: 'ATTACH_ID', cols: [
    c('ATTACH_ID','附件ID','s',1), c('BIZ_TYPE','业务类型','s'), c('BIZ_ID','业务ID','s'), c('FILE_NAME','文件名','s'),
    c('FILE_URL','文件URL','s'), c('FILE_SIZE','文件大小','i'), c('UPLOAD_BY','上传人','s'), c('UPLOAD_TIME','上传时间','dt')
  ]};
  /* 单据上下游关联台账：按业务流一键流转时记录「具体哪条来源单 → 哪条去向单」，
     供单据详情/使用说明的「业务流」区按具体单号定位（非仅类型级关系）。 */
  T.SYS_DOC_LINK = { label: '单据上下游关联', domain: 'SYS', module: '系统', pk: 'LINK_ID', cols: [
    c('LINK_ID','关联ID','s',1), c('FROM_TABLE','来源表','s',1), c('FROM_NO','来源单号','s',1),
    c('TO_TABLE','去向表','s',1), c('TO_NO','去向单号','s',1), c('FLOW_LABEL','流转动作','s'),
    c('LINK_TIME','关联时间','dt'), c('REMARK','备注','s')
  ]};

  /* ============ 单据明细子表（主子表结构） ============ */
  /* 这些子表在设计文档中以 “**XXX_LINE**” 形式定义，是单据表头的从表，
     通过 fk 列（如 SO_NO）挂到主表，构成「主表(合同/订单) → 子表(产品明细)」结构。 */
  T.SD_QUOTATION_LINE = { label: '报价单明细', domain: 'SD', module: '订单管理', detail: true, pk: 'QUOTE_NO', cols: [
    c('QUOTE_NO', '报价单号', 's', 1, 'SD_QUOTATION'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_PRODUCT'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}),
    c('QTY','数量','d',1), c('UNIT','单位','s',1), c('PRICE','单价','d'), c('TAX_TYPE','税种','s'),
    c('TAX_RATE','税率','d'), c('CURRENCY','币种','s'), c('AMOUNT','金额','d'), c('DELIVERY_DATE','交期','da'), c('REMARK','备注','s')
  ]};
  T.SD_SALES_ORDER_LINE = { label: '销售订单明细', domain: 'SD', module: '订单管理', detail: true, pk: 'SO_NO', cols: [
    c('SO_NO', '销售订单号', 's', 1, 'SD_SALES_ORDER'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_PRODUCT'), c('ITEM_NAME', '品名规格', 's', 1, null, {derive: 'ITEM_NO'}),
    c('SPEC','规格','s'), c('CUSTOMER_PART_NO','客户品号','s'), c('ORDER_QTY','订单数量','d',1), c('DELIVERED_QTY','已交数量','d',1),
    c('OPEN_QTY','未交数量','d'), c('PRICE','单价','d'), c('AMOUNT','金额','d'), c('DELIVERY_DATE','交期','da',1)
  ]};
  T.SD_DELIVERY_LINE = { label: '销货单明细', domain: 'SD', module: '订单管理', detail: true, pk: 'DELIVERY_NO', cols: [
    c('DELIVERY_NO', '销货单号', 's', 1, 'SD_DELIVERY'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_PRODUCT'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}),
    c('DELIVERY_QTY','销货数量','d',1), c('UNIT','单位','s',1), c('BOX_CNT','箱数','d'), c('SO_NO', '订单号', 's', 0, 'SD_SALES_ORDER'),
    c('CUSTOMER_PO_NO','客户单号','s'), c('LOT_NO','批次','s'), c('REMARK','备注','s')
  ]};
  T.PD_PURCHASE_ORDER_LINE = { label: '采购订单明细', domain: 'PD', module: '订单管理', detail: true, pk: 'PO_NO', cols: [
    c('PO_NO', '采购订单号', 's', 1, 'PD_PURCHASE_ORDER'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}),
    c('SPEC','规格','s'), c('UNIT','单位','s',1), c('ORDER_QTY','订单数量','d',1), c('PRICE','单价','d'),
    c('AMOUNT','金额','d'), c('TAX_RATE','税率','d'), c('ARRIVED_QTY','已到货数量','d'), c('OWING_QTY','尚欠数量','d'),
    c('DELIVERY_DATE','交期','da'), c('REMARK','备注','s')
  ]};
  T.PD_ARRIVAL_LINE = { label: '到货单明细', domain: 'PD', module: '订单管理', detail: true, pk: 'ARRIVAL_NO', cols: [
    c('ARRIVAL_NO', '到货单号', 's', 1, 'PD_ARRIVAL'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}),
    c('SPEC','规格','s'), c('ARRIVAL_QTY','到货数量','d',1), c('UNIT','单位','s',1), c('LOT_NO','批次','s'), c('REMARK','备注','s')
  ]};
  T.EX_ISSUE_LINE = { label: '领料单明细', domain: 'EX', module: '生产执行', detail: true, pk: 'ISSUE_NO', cols: [
    c('ISSUE_NO', '领料单号', 's', 1, 'EX_ISSUE_ORDER'), c('SEQ_NO','序号','i',1), c('ITEM_NO', '材料品号', 's', 1, 'MD_MATERIAL'), c('ITEM_NAME', '品名', 's', 1, null, {derive: 'ITEM_NO'}),
    c('SPEC','材料规格','s'), c('ISSUE_QTY','领料数量','d',1), c('PIECE_CNT','根数','d'), c('UNIT','单位','s',1),
    c('LOT_NO','批次','s'), c('LOCATION','库位','s'), c('ISSUED_QTY_ACC','已领数量(累计)','d'),
    c('LIMIT_QTY','限额用量','d'), c('OVER_RATIO','超领比例','d')
  ]};

  /* ============ 通用扩展（自动补字段，勿在业务 cols 里重复定义） ============
   * ① 审核三件套（为后续工作流预留）：审核状态 / 审核人 / 审核时间。
   *    单据表由 DOC 提供（含 AUDIT_STATUS）；非单据业务表在此自动补齐。
   * ② 启用绑定：凡有「是否启用(ENABLE_FLAG)」的表，自动补「启用时间 / 失效时间」，
   *    并与启用标志联动（启用→默认填启用时间；停用→默认填失效时间），见 app.js 表单逻辑。 */
  (function () {
    var AUDIT_EXTRA = [
      { code: 'AUDIT_STATUS', label: '审核状态', type: 's', req: false },
      { code: 'AUDIT_BY', label: '审核人', type: 's', req: false },
      { code: 'AUDIT_TIME', label: '审核时间', type: 'dt', req: false }
    ];
    Object.keys(T).forEach(function (t) {
      var cols = T[t].cols;
      if (!T[t].doc && !T[t].report) AUDIT_EXTRA.forEach(function (ac) {
        if (!cols.some(function (x) { return x.code === ac.code; })) cols.push(ac);
      });
      var ei = -1;
      cols.forEach(function (x, i) { if (x.code === 'ENABLE_FLAG') ei = i; });
      if (ei >= 0 && !cols.some(function (x) { return x.code === 'ENABLE_FROM'; })) {
        cols.splice(ei + 1, 0,
          { code: 'ENABLE_FROM', label: '启用时间', type: 'da', req: false },
          { code: 'ENABLE_TO', label: '失效时间', type: 'da', req: false });
      }
    });
  })();

  /* ============ 主子表关系映射 ============ */
  /* key: 主表; value: [{ table: 子表, fk: 关联字段 }]
     该映射同时驱动「导航树展示」与「主子表联动视图」。子表通过 detail:true 标记。 */
  var MASTER_DETAIL = {
    SD_QUOTATION:        [{ table: 'SD_QUOTATION_LINE',        fk: 'QUOTE_NO' }],
    SD_SALES_ORDER:      [{ table: 'SD_SALES_ORDER_LINE',      fk: 'SO_NO' }],
    SD_DELIVERY:         [{ table: 'SD_DELIVERY_LINE',         fk: 'DELIVERY_NO' }],
    PD_PURCHASE_ORDER:   [{ table: 'PD_PURCHASE_ORDER_LINE',   fk: 'PO_NO' }],
    PD_ARRIVAL:          [{ table: 'PD_ARRIVAL_LINE',          fk: 'ARRIVAL_NO' }],
    PP_MASTER_PLAN:      [{ table: 'PP_MASTER_PLAN_LINE',      fk: 'PLAN_NO' }],
    EX_ISSUE_ORDER:      [{ table: 'EX_ISSUE_LINE',            fk: 'ISSUE_NO' }],
    MD_BOM_HEAD:         [{ table: 'MD_BOM_LINE',              fk: 'BOM_NO' }],
    RT_ROUTE:            [{ table: 'RT_ROUTE_STEP',            fk: 'ROUTE_NO' }],
    HR_TEAM:             [{ table: 'HR_TEAM_MEMBER',           fk: 'TEAM_CODE' }],
    EX_WORK_ORDER:       [{ table: 'EX_WO_STEP',               fk: 'WO_NO' }],
    EX_SHIFT_HANDOVER:   [{ table: 'EX_SHIFT_STATION_CHECK',   fk: 'HANDOVER_NO' }]
  };

  /* ============ 导航归组（纯展示用，与主子表数据关系无关） ============
   * key: 父表; value: 数组（子表编号串）。用途：把「分类树 / 批次 / 版本记录 / 量检具」等
   * 逻辑上从属于某张主表的表，在左侧导航里挂在父表 ▸ 之下，避免顶级条目过多。
   * 与 MASTER_DETAIL 的区别：这里不产生「主」标记、不触发主子表合并表单 / 行级明细，
   * 仅做导航层归组（如 物料分类树 挂在 物料资料 下，但物料本身并无「明细子表」语义）。 */
  var NAV_SUB = {
    MD_MATERIAL:       ['MD_MATERIAL_CATEGORY'],   // 物料分类树 挂在 物料资料 下
    MD_EQUIPMENT:      ['MD_GAUGE','EQ_RUNTIME_STATUS'], // 量检具 / 设备运行状态 挂在 设备资料 下
    MD_STEP_DICT:      ['MD_STEP_EQUIP_CAP'],      // 工序设备能力矩阵 挂在 工序字典 下
    HR_TEAM:           ['HR_SHIFT_SCHEDULE','HR_SHIFT_CALENDAR'], // 班组排班 / 班次日历 挂在 班组资料 下
    RT_ROUTE_VERSION:  ['RT_VERSION_LOG'],         // 工艺版本记录 挂在 工艺版本 下
    WM_STOCK:          ['WM_STOCK_LOT'],           // 批次库存 挂在 库存主账 下
    EQ_INSPECTION:     ['EQ_INSPECTION_ITEM'],     // 点检项模板 挂在 日常点检 下
    EQ_MAINTENANCE_PLAN: ['EQ_MAINTENANCE_RECORD'] // 保养记录 挂在 保养计划 下
  };

  /* ============ 业务域 / 模块结构（保留给「总览」业务域分布使用） ============ */
  var DOMAINS = [
    { code: 'MD', name: '工厂建模', desc: '主数据地基：客户 / 供应商 / 产品(BOM) / 物料(分类树) / 岗位 / 设备 / 人员班组，统一编号', modules: [
      { name: '客户资料', tables: ['MD_CUSTOMER'] },
      { name: '供应商资料', tables: ['MD_SUPPLIER'] },
      { name: '产品资料', tables: ['MD_PRODUCT','MD_BOM_HEAD'] },
      { name: '物料资料', tables: ['MD_MATERIAL','MD_MATERIAL_CATEGORY'] },
      { name: '岗位人员', tables: ['HR_EMPLOYEE','MD_POSITION','HR_TEAM','HR_SHIFT_SCHEDULE','HR_SHIFT_CALENDAR'] },
      { name: '设备资料', tables: ['MD_EQUIPMENT','MD_GAUGE'] }
    ]},
    { code: 'RT', name: '工艺管理', desc: '工艺路线 / 工序字典 / SOP / 版本 / 外协工序（独立模块）', modules: [
      { name: '工艺管理', tables: ['RT_ROUTE','RT_ROUTE_STEP','MD_STEP_DICT','MD_STEP_EQUIP_CAP','RT_ROUTE_VERSION','RT_VERSION_LOG','RT_SOP','RT_OUTSOURCE_STEP'] }
    ]},
    { code: 'SD', name: '订单管理', desc: '报价 / 销售 / 采购全链路（采购链路：请购比价 → 采购订单 → 到货 → 采购入库）', modules: [
      { name: '订单管理', tables: ['SD_QUOTATION','SD_QUOTATION_LINE','SD_SALES_ORDER','SD_SALES_ORDER_LINE','SD_DELIVERY','SD_DELIVERY_LINE','PD_PRICE_COMPARE','PD_PURCHASE_ORDER','PD_PURCHASE_ORDER_LINE','PD_ARRIVAL','PD_ARRIVAL_LINE'] }
    ]},
    { code: 'PP', name: '计划排产', desc: '把需求转化为可执行的工序级计划（销售订单 → 生产计划 → 工序排程 / 工单下达）', modules: [
      { name: '排产管理', tables: ['PP_MASTER_PLAN','PP_MASTER_PLAN_LINE','PP_SCHEDULE','EX_WORK_ORDER'] }
    ]},
    { code: 'EX', name: '生产管理', desc: '按工艺路线逐工序报工的核心作业层', modules: [
      { name: '生产管理', tables: ['EX_WO_STEP','EX_MACHINE_DATA','EX_LABOR_RECORD','EX_REPORT','QC_INSPECTION','QC_REWORK_ORDER','QC_SCRAP_ORDER','EX_FINISH_IN','EX_SHIFT_HANDOVER','EX_SHIFT_STATION_CHECK'] }
    ]},
    { code: 'WM', name: '库存管理', desc: '物料枢纽：出入库 / 领料 / 库存账', modules: [
      { name: '库存管理', tables: ['WM_STOCK','WM_STOCK_LOT','WM_INBOUND','WM_OUTBOUND','WM_FINISH_IN','WM_STOCKTAKING','EX_ISSUE_ORDER','EX_ISSUE_LINE'] }
    ]},
    { code: 'EQ', name: '设备管理', desc: '设备台账 / 点检 / 保养 / 巡检 → 报修，并以「运行状态段」为 APS 提供可用产能', modules: [
      { name: '设备管理', tables: ['EQ_EQUIPMENT_LEDGER','EQ_INSPECTION','EQ_INSPECTION_ITEM','EQ_MAINTENANCE_PLAN','EQ_MAINTENANCE_RECORD','EQ_PATROL','EQ_FAULT_REPAIR','EQ_RUNTIME_STATUS'] }
    ]},
    { code: 'RPT', name: '生产报表', desc: '由业务数据实时汇集的统计报表与追溯报表（只读，随上游数据自动变化）', modules: [
      { name: '生产报表', tables: ['MD_SUPPLIER_PERF','EX_DAILY_OUTPUT','EQ_OEE','EQ_STATUS_MONITOR','RPT_TRACE_MATERIAL','RPT_TRACE_WORK'] }
    ]},
    { code: 'KAN', name: '生产看板', desc: '现场驾驶舱：多卡片实时状态视图（每次刷新/登录默认落地页）', modules: [
      { name: '生产看板', tables: [] }
    ]}
  ];

  /* ============ 左侧导航树（扁平功能域 → 表单，不分业务域/模块层次） ============
   * 对应需求里用户期望的「工厂建模 / 订单管理 / 库存管理 / 生产管理 …」结构。
   * 每个分组直接挂表单（表内容不变），不再有带小圆点序号的业务域层。 */
  var GROUPS = [
    { name: '工厂建模', tables: ['MD_CUSTOMER','MD_SUPPLIER','MD_PRODUCT','MD_BOM_HEAD','MD_MATERIAL','MD_MATERIAL_CATEGORY','MD_EQUIPMENT','MD_GAUGE','HR_EMPLOYEE','MD_POSITION','HR_TEAM','HR_SHIFT_SCHEDULE','HR_SHIFT_CALENDAR'] },
    { name: '工艺管理', tables: ['RT_ROUTE','RT_ROUTE_STEP','MD_STEP_DICT','MD_STEP_EQUIP_CAP','RT_ROUTE_VERSION','RT_VERSION_LOG','RT_SOP','RT_OUTSOURCE_STEP'] },
    { name: '订单管理', tables: ['SD_QUOTATION','SD_QUOTATION_LINE','SD_SALES_ORDER','SD_SALES_ORDER_LINE','SD_DELIVERY','SD_DELIVERY_LINE','PD_PRICE_COMPARE','PD_PURCHASE_ORDER','PD_PURCHASE_ORDER_LINE','PD_ARRIVAL','PD_ARRIVAL_LINE'] },
    { name: '计划排产', tables: ['PP_MASTER_PLAN','PP_MASTER_PLAN_LINE','PP_SCHEDULE','EX_WORK_ORDER'] },
    { name: '生产管理', tables: ['EX_WO_STEP','EX_MACHINE_DATA','EX_LABOR_RECORD','EX_REPORT','QC_INSPECTION','QC_REWORK_ORDER','QC_SCRAP_ORDER','EX_FINISH_IN','EX_SHIFT_HANDOVER','EX_SHIFT_STATION_CHECK'] },
    { name: '库存管理', tables: ['WM_STOCK','WM_STOCK_LOT','WM_INBOUND','WM_OUTBOUND','WM_FINISH_IN','WM_STOCKTAKING','EX_ISSUE_ORDER','EX_ISSUE_LINE'] },
    { name: '设备管理', tables: ['EQ_EQUIPMENT_LEDGER','EQ_INSPECTION','EQ_INSPECTION_ITEM','EQ_MAINTENANCE_PLAN','EQ_MAINTENANCE_RECORD','EQ_PATROL','EQ_FAULT_REPAIR','EQ_RUNTIME_STATUS'] },
    { name: '生产报表', tables: ['MD_SUPPLIER_PERF','EX_DAILY_OUTPUT','EQ_OEE','EQ_STATUS_MONITOR','RPT_TRACE_MATERIAL','RPT_TRACE_WORK'], report: true },
    { name: '生产看板', tables: [], views: ['board', 'wip', 'oee'] }
  ];

  /* ============ 模块介绍（仅用于「使用说明」展示，不进表单） ============
   * role: 这个模块是干什么的；data: 这个模块放的是什么数据。 */
  var GROUP_INTRO = {
    '工厂建模': { role: '整个 MES 的主数据地基：所有业务单据（订单、工单、库存、报工）都引用这里的编号，先建好这里，业务才跑得起来。', data: '客户资料、供应商资料、产品资料（BOM 头 + BOM 行）、物料资料（含物料分类树）、岗位资料、设备资料（含量检具、设备运行状态）、人员资料、班组资料（含班组成员、班组排班、班次日历）。' },
    '工艺管理': { role: '定义"产品怎么做"：工艺路线把标准工序串成顺序，工单按路线逐道展开报工；工序设备能力矩阵进一步说明"这道工序能由哪几台设备做、多快、换型多久"，是 APS 精确排产的依据；SOP 指导现场作业，版本管理保证变更可追溯。', data: '工艺路线主数据、工艺路线工序序列、工序字典（唯一标准工序，含工序设备能力矩阵）、工艺版本、版本记录、作业指导书(SOP)、外协工序。' },
    '订单管理': { role: '接单与采购的入口：从报价到销售订单，驱动生产工单与请购；采购侧为「请购比价 → 采购订单 → 到货(+IQC) → 采购入库」（已取消进货单环节）。', data: '报价单(含明细)、销售订单(含明细)、销货单(含明细)、请购与比价选商、采购订单(含明细)、到货单(含明细)。' },
    '计划排产': { role: '把销售订单需求直接变成可执行的工序级计划：销售订单 → 生产计划（含计划明细，可按品号逐条下达）→ 工序排程 / 工单下达（不再设 MRP 展开环节）。', data: '生产计划(含明细)、工序排程、工序工单(成品工单，含工单工序明细与条码/二维码)。' },
    '库存管理': { role: '工厂的物料枢纽：采购/完工入库、生产领料出库、销售发货出库，库存主账与批次账实时反映可用量。', data: '库存主账、批次库存、入库单、出库单、成品入库单、盘点单、领料单(含明细)。' },
    '生产管理': { role: 'MES 的核心作业层：按工艺路线逐工序报工，检验点判定合格/不合格，不合格走返工/报废闭环，交班点检保证连续生产。', data: '工单工序明细、加工采集数据、工时人工记录、工序报工、检验记录、返工工单、报废单、完工入库申请、班组交接记录、工位点检明细。' },
    '设备管理': { role: '保障设备可用：日常点检、保养计划、巡检，异常触发故障报修，形成设备健康闭环；「设备运行状态」按状态段记录运行/待机/故障/保养/停机，既派生 OEE 与状态监测，也是 APS 扣除不可用产能的依据（保养计划已细化到计划起止时刻与预计停机分钟）。', data: '设备台账、日常点检、点检项模板、保养计划(PM)、保养记录、设备巡检、故障报修、设备运行状态。' },
    '生产报表': { role: '只读的分析视图：报表不落地人工录入，每次打开都按业务数据实时汇总，因此上游任何新增 / 修改都会自动反映到这里；表格只保留「查询 / 导出」操作。', data: '供应商绩效(年度)、生产线日报、设备综合效率(OEE)、设备状态监测，以及追溯报表-物料、追溯报表-报工。' },
    '生产看板': { role: '现场状态视图集合：现场驾驶舱（多卡片实时状态，本周/上周/本月/上月/本年快捷切换 + 起止日期 + KPI + 产量趋势 + 工单/设备状态分布 + WIP 与订单缺口）、WIP 在制看板、设备综合效率(OEE)。每次打开 / 刷新系统默认落在「现场驾驶舱」。', data: '本身不存业务数据，指标全部由销售订单明细、工单、工序报工、成品入库、OEE、故障报修、检验记录等实时汇总。' }
  };

  /* ============ 单据流转关系（FOC 业务流） ============
   * key: 源单据主表; value: [{ to: 目标单据主表, label: 按钮文字 }]
   * 设计为「单向业务流、单源可多向」（如销售订单既可流转销货单，也可流转生产计划 / 生产工单）。
   * 由 openDoc 中的「业务流」区 / 核心流程页渲染，点击后按字段名匹配复制表头 + 明细行。
   * 已补全各模块上下游闭环：报价→销售→(生产计划 / 销货 / 工单 / 请购)；
   * 销售订单→生产计划(含明细)→(生产工单 / 工序排程)；销售订单 / 生产计划→请购→采购订单→到货→采购入库；
   * 工单→领料(→领料出库)/完工入库(→成品入库→销货)；到货/工序/成品→检验→返工/报废；巡检/点检→报修。
   * 注：已按需求取消「进货单」「MRP 展开结果」两个环节。原 MRP 承担的「计划→请购」与「计划→工单」两条边，
   *     已直接落到生产计划自身的流转上（生产计划→生产工单/工序排程/请购单），采购链路由到货单直接生成采购入库。 */
  var FLOW = {
    SD_QUOTATION:       [{ to: 'SD_SALES_ORDER', label: '生成销售订单' }],
    SD_SALES_ORDER:     [{ to: 'SD_DELIVERY', label: '生成销货单' }, { to: 'PP_MASTER_PLAN', label: '生成生产计划' }, { to: 'EX_WORK_ORDER', label: '生成生产工单' }, { to: 'PD_PRICE_COMPARE', label: '生成请购单' }],
    PD_PRICE_COMPARE:   [{ to: 'PD_PURCHASE_ORDER', label: '生成采购订单' }],
    PD_PURCHASE_ORDER:  [{ to: 'PD_ARRIVAL', label: '生成到货单' }],
    PD_ARRIVAL:         [{ to: 'QC_INSPECTION', label: '生成来料检验(IQC)' }, { to: 'WM_INBOUND', label: '生成采购入库' }],
    SD_DELIVERY:        [{ to: 'WM_OUTBOUND', label: '生成销售出库' }],
    PP_MASTER_PLAN:     [{ to: 'EX_WORK_ORDER', label: '生成生产工单' }, { to: 'PP_SCHEDULE', label: '生成工序排程' }, { to: 'PD_PRICE_COMPARE', label: '生成请购单' }],
    EX_WORK_ORDER:      [{ to: 'EX_ISSUE_ORDER', label: '生成领料单' }, { to: 'EX_FINISH_IN', label: '生成完工入库' }, { to: 'PP_SCHEDULE', label: '生成工序排程' }],
    EX_ISSUE_ORDER:    [{ to: 'WM_OUTBOUND', label: '生成领料出库' }],
    EX_REPORT:         [{ to: 'QC_INSPECTION', label: '生成工序检验' }],
    QC_INSPECTION:     [{ to: 'QC_REWORK_ORDER', label: '生成返工单' }, { to: 'QC_SCRAP_ORDER', label: '生成报废单' }],
    EX_FINISH_IN:      [{ to: 'WM_FINISH_IN', label: '生成成品入库单' }],
    WM_FINISH_IN:      [{ to: 'SD_DELIVERY', label: '生成销货单(发货)' }],
    EQ_PATROL:         [{ to: 'EQ_FAULT_REPAIR', label: '生成故障报修' }],
    EQ_INSPECTION:     [{ to: 'EQ_FAULT_REPAIR', label: '生成故障报修' }]
  };


  /* ============ 导入外键校验（父单存在性） ============ */
  var IMPORT_FK = {
    SD_QUOTATION_LINE:    { SO_NO: 'SD_QUOTATION' },
    SD_SALES_ORDER_LINE:  { SO_NO: 'SD_SALES_ORDER' },
    SD_DELIVERY_LINE:     { DELIVERY_NO: 'SD_DELIVERY', SO_NO: 'SD_SALES_ORDER' },
    PD_PURCHASE_ORDER_LINE: { PO_NO: 'PD_PURCHASE_ORDER' },
    PD_ARRIVAL_LINE:       { ARRIVAL_NO: 'PD_ARRIVAL' },
    PP_MASTER_PLAN_LINE:   { PLAN_NO: 'PP_MASTER_PLAN' },
    EX_ISSUE_LINE:         { ISSUE_NO: 'EX_ISSUE_ORDER' }
  };

  var SCHEMA = { COMMON: COMMON, DOC: DOC, TABLES: T, DOMAINS: DOMAINS, GROUPS: GROUPS, GROUP_INTRO: GROUP_INTRO, MASTER_DETAIL: MASTER_DETAIL, NAV_SUB: NAV_SUB, FLOW: FLOW, IMPORT_FK: IMPORT_FK };

  // 合并通用/单据字段，返回某表完整列定义
  // 「备注(REMARK)」统一后置到最末位（业务字段之后），便于阅读与录入。
  SCHEMA.columnsOf = function (table) {
    var def = T[table];
    if (!def) return [];
    var cols = COMMON.slice();
    if (def.doc) cols = cols.concat(DOC);
    def.cols.forEach(function (cc) {
      // 避免与单据字段重复（如 STATUS）
      if (!cols.some(function (x) { return x.code === cc.code; })) cols.push(cc);
    });
    return SCHEMA.moveRemarkLast(cols);
  };
  // 把列数组中的「备注」挪到末尾（返回新数组，不改原数组）
  SCHEMA.moveRemarkLast = function (cols) {
    var remark = cols.filter(function (c) { return c.code === 'REMARK'; });
    if (!remark.length) return cols.slice();
    var rest = cols.filter(function (c) { return c.code !== 'REMARK'; });
    return rest.concat(remark);
  };
  SCHEMA.allColumns = function (table) { return SCHEMA.columnsOf(table); };

  if (typeof module !== 'undefined' && module.exports) module.exports = SCHEMA;
  if (root) root.MES_SCHEMA = SCHEMA;
})(typeof window !== 'undefined' ? window : null);
