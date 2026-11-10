/*
 * 本文件由 tools/gen-tables.js 从 poc/aps_system/js/schema.js 原样同步，请勿手工编辑。
 * 要改表结构，改 aps_system 那份然后 node tools/gen-tables.js。
 * 存在两份是因为浏览器必须按静态路径加载，但真值只有 aps_system 那一份。
 */
/*
 * APS Schema 元数据 —— 唯一数据源
 * 来源：《APS产品功能需求文档 V5（汽配行业·轻量化三核心）》 + 《APS产品功能知识库》 + 《MES模块和字段设计文档6.0》
 * V5 口径：7 功能域 / 28 功能点；三核心 = 物料需求计算 + 物料齐套计算 + 生产排程（不含 ECN）；
 *          术语统一「换型时间」；主数据零重建——原始 MES 数据一律在 supOS UNS「工厂建模」内，按需直读。
 * 该文件同时被前端（浏览器）与 gen-sql.js（Node）使用，请勿在别处重复定义表结构。
 * 命名与结构口径与现有 MES 4.0 保持一致（同域代码体系 / 同主子表 / 同导入校验 / 同模块介绍），
 * 便于用户在两套系统间无缝切换、降低学习成本。
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
    { code: 'MAKER', label: '制单人', type: 's', req: true, doc: true },
    { code: 'MAKE_TIME', label: '制单时间', type: 'dt', req: true, doc: true },
    { code: 'AUDIT_STATUS', label: '审核状态', type: 's', req: false, doc: true },
    { code: 'AUDIT_BY', label: '审核人', type: 's', req: false, doc: true },
    { code: 'AUDIT_TIME', label: '审核时间', type: 'dt', req: false, doc: true },
    { code: 'PRINT_TIMES', label: '打印次数', type: 'i', req: false, doc: true },
    { code: 'ATTACH_URLS', label: '附件', type: 'j', req: false, doc: true }
  ];

  // 列构造器
  // ref: 引用主数据表名 —— 既用于表单下拉（新增时只能从被引用表选，形成限制），也用于导入校验（值必须已存在于被引用表）
  // opt: 附加选项对象，常用 { dict: '字典类型' }（渲染为字典下拉，选项来自 SYS_DICT.ITEM_CODE）
  //      / { sel: ['A','B'] }（直接写死候选值）
  function c(code, label, type, req, ref, opt) {
    var o = { code: code, label: label, type: type || 's', req: !!req };
    if (ref) o.ref = ref;
    if (opt) for (var k in opt) o[k] = opt[k];
    return o;
  }

  // —— 业务表定义 ——
  // key: 表名; value: { label, domain, module, doc?, detail?, report?, pk?(业务主键), cols:[...] }
  var T = {};

  /* ==================================================================
   * ① 计划基础数据（BAS）——  APS 自有的计划参数与资源日历
   * ================================================================== */
  T.BAS_DEMAND = { label: '需求源', domain: 'BAS', module: '需求管理', doc: true, pk: 'DEMAND_NO', lead: ['SOURCE_TYPE','SOURCE_NO'], upRef: ['RF_SO'], cols: [
    c('DEMAND_NO','需求单号','s',1), c('SOURCE_TYPE','需求来源','s',1,null,{dict:'DEMAND_SOURCE'}), c('SOURCE_NO','来源单据号','s'),
    c('CUSTOMER_CODE','客户','s'), c('PLAN_HORIZON','计划展望期(天)','i'),
    c('FREEZE_FLAG','是否冻结','b'), c('FREEZE_DAYS','冻结窗口(天)','i'), c('FREEZE_UNTIL','冻结至','da'),
    c('APPROVE_BY','变更审批人','s')
  ]};
  /* 需求明细节：lineCols=6 → 行编辑器显示「序号/品号/品名/需求数量/需求日期/来源单据号」，保证「来源单据号」不会被默认 7 列截断。 */
  T.BAS_DEMAND_LINE = { label: '需求明细', domain: 'BAS', module: '需求管理', detail: true, pk: 'DEMAND_NO', lineCols: 6, cols: [
    c('DEMAND_NO','需求单号','s',1), c('SEQ_NO','序号','i',1), c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1),
    c('DEMAND_QTY','需求数量','d',1),
    c('REQ_DATE','需求日期','da',1), c('SRC_DOC_NO','来源单据号','s'), c('LOCK_FLAG','是否锁定','b'), c('LINE_STATUS','明细状态','s')
  ]};
  T.BAS_ITEM_PLAN_ATTR = { label: '物料计划属性', domain: 'BAS', module: '计划基础数据', pk: 'ITEM_NO', cols: [
    c('ITEM_NO','物料品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1), c('PLAN_TYPE','计划类型','s',1),
    c('PRODUCE_LEAD_TIME','生产提前期(天)','i'), c('PURCHASE_LEAD_TIME','采购提前期(天)','i'),
    c('MIN_BATCH','最小批量','d'), c('BATCH_MULTIPLE','批量倍数','d'), c('SCH_BATCH','排产批量','d'),
    c('SAFETY_STOCK','安全库存','d'), c('MIN_STOCK','补充下限(min)','d'), c('MAX_STOCK','补充上限(max)','d'),
    c('KEY_ITEM_FLAG','关键件标识','b'), c('LONG_CYCLE_FLAG','长周期件标识','b'), c('SUBSTITUTE_RULE','替代料规则','s'),
    c('DEFAULT_RES_GROUP','默认资源组','s'), c('GROUP_CYCLE','组批周期(天)','i'), c('FROM_MES_FLAG','取MES默认值','b'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.BAS_RESOURCE = { label: '排产资源', domain: 'BAS', module: '计划基础数据', pk: 'RES_NO', cols: [
    c('RES_NO','资源编号','s',1), c('RES_NAME','资源名称','s',1), c('RES_TYPE','资源类型','s',1),
    c('WORK_CENTER','工作中心','s',1), c('RES_GROUP','资源分组','s'), c('STD_CYCLE','标准节拍(s/件)','d'),
    c('STD_CAP','班次能力(件)','d'), c('SUPPORTED_STEP','可加工工序','s'), c('LOCATION','机台位置','s'),
    c('HOUR_MODE','工时处理方式','s'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.BAS_RESOURCE_GROUP = { label: '资源分组(一工序多机)', domain: 'BAS', module: '计划基础数据', pk: 'GROUP_CODE', cols: [
    c('GROUP_CODE','分组编码','s',1), c('GROUP_NAME','分组名称','s',1), c('WORK_CENTER','工作中心','s'),
    c('MEMBER_RES','成员资源','s'), c('STEP_SCOPE','可加工工序范围','s'), c('PRIORITY','优选优先级','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.BAS_CHANGEOVER = { label: '换型时间', domain: 'BAS', module: '计划基础数据', pk: 'CV_ID', cols: [
    c('CV_ID','换型ID','s',1), c('RES_GROUP','资源分组','s',1), c('FROM_PRODUCT','前置产品','s'), c('TO_PRODUCT','后置产品','s',1),
    c('CHANGE_MIN','换型时间(分)','d',1), c('IS_WILDCARD','通配配置(任意→某产品)','b'), c('SAME_SPEC_ZERO','同规格记0','b'),
    c('EXPR_FORMULA','表达式','s'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.BAS_CALENDAR = { label: '工厂日历(三级)', domain: 'BAS', module: '计划基础数据', pk: 'CAL_ID', cols: [
    c('CAL_ID','日历ID','s',1), c('CAL_LEVEL','日历层级','s',1), c('OWNER_CODE','所属对象','s',1),
    c('WORK_DATE','日期','da',1), c('SHIFT','班次','s',1), c('WORK_START','工作开始','dt'), c('WORK_END','工作结束','dt'),
    c('CAP_HOURS','可用工时','d'), c('IS_HOLIDAY','是否节假日','b'), c('IS_OVERTIME','加班窗口','b'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.BAS_MAINTENANCE = { label: '维保/故障占用', domain: 'BAS', module: '计划基础数据', pk: 'OCCUPY_NO', cols: [
    c('OCCUPY_NO','占用编号','s',1), c('RES_NO','资源','s',1,'BAS_RESOURCE'), c('OCCUPY_TYPE','占用类型','s',1),
    c('START_TIME','开始时间','dt',1), c('END_TIME','结束时间','dt',1), c('SOURCE_SYS','数据来源','s'),
    c('STATUS','状态','s',1)
  ]};

  /* ==================================================================
   * ② 物料需求计算（MRP）——  核心① 净需求 + 齐套 + 补料建议
   * ================================================================== */
  /* 需求计算版本：APS 的「计算心脏」。一次运行 = 选规则 + 纳入需求源 → 产出净需求 / 齐套 / 补料 / 排程等
     平级派生结果（结果之间不是 MES 的「单转单」，而是同一次计算的分叉产物）。 */
  T.MRP_BATCH = { label: '需求计算版本', domain: 'MRP', module: '物料需求计算', calc: true, detail: false, pk: 'BATCH_NO', cols: [
    c('BATCH_NO','版本号','s',1), c('BATCH_TYPE','版本类型','s',1), c('RULE_NO','排程规则','s',null,'SCH_RULE'),
    c('CALC_TIME','计算时间','dt',1), c('CALC_BY','计算人','s'),
    c('REQ_ROWS','需求行数','i'), c('NET_ROWS','净需求行数','i'), c('DURATION_SEC','耗时(秒)','d'),
    c('STATUS','版本状态','s',1), c('IDEMPOTENT_KEY','幂等键','s')
  ]};
  T.MRP_NET_REQ = { label: '净需求', domain: 'MRP', module: '物料需求计算', calc: true, pk: 'NET_ID', cols: [
    c('NET_ID','净需求ID','s',1), c('BATCH_NO','计算版本','s',1), c('LEVEL_NO','BOM层级','i',1),
    c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1), c('ITEM_TYPE','建议类型','s',1),
    c('PARENT_ITEM','父项物料','s'), c('BOM_VER','BOM版本','s'), c('GROSS_QTY','毛需求','d',1),
    c('SAFE_STOCK','安全库存','d'),
    c('AVAIL_STOCK','可用库存','d'), c('WIP_QTY','在制','d'), c('ON_ORDER_QTY','在途','d'),
    c('NET_QTY','净需求','d',1), c('ADJ_QTY','批量调整后','d'), c('SUBSTITUTE_ITEM','替代料','s'),
    c('REQ_DATE','需求日期','da',1), c('SUGGEST_DATE','建议开工/下达日期','da'), c('STATUS','状态','s')
  ]};
  T.MRP_KIT_CHECK = { label: '齐套检查', domain: 'MRP', module: '物料需求计算', calc: true, pk: 'CHECK_NO', cols: [
    c('CHECK_NO','齐套单号','s',1), c('BATCH_NO','计算版本','s',1), c('CHECK_TYPE','检查口径','s',1),
    c('CHECK_DATE','检查日期','da',1), c('ORDER_NO','销售订单/工单','s',1), c('ITEM_NO','品号','s',1,'RF_ITEM'),
    c('ITEM_NAME','品名','s',1), c('LEVEL_NO','层级','i'), c('DEMAND_QTY','需求数量','d',1),
    c('KIT_QTY','齐套数量','d'), c('SHORT_QTY','缺料数量','d'), c('KIT_RATE','齐套率','d'),
    c('KIT_DATE','齐套日期','da'), c('KEY_ITEM_FLAG','是否关键件','b'), c('PERIOD_TYPE','按日/按周/时段','s'), c('STATUS','状态','s')
  ]};
  T.MRP_KIT_SHORT = { label: '缺料明细', domain: 'MRP', module: '物料需求计算', calc: true, detail: true, pk: 'SHORT_ID', cols: [
    c('SHORT_ID','缺料ID','s',1), c('CHECK_NO','齐套单号','s',1), c('ORDER_NO','销售订单/工单','s',1),
    c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1), c('SHORT_QTY','缺料数量','d',1),
    c('REQ_DATE','需求日期','da'), c('RECOVER_DATE','预计恢复日','da'), c('SUPPLY_TYPE','供应方式','s'),
    c('KEY_ITEM_FLAG','是否关键件','b'), c('BLOCK_FLAG','是否阻断','b'), c('STATUS','状态','s')
  ]};
  T.PR_SUGGEST = { label: '补料建议', domain: 'MRP', module: '物料需求计算', calc: true, doc: true, pk: 'PR_NO', cols: [
    c('PR_NO','补料建议号','s',1), c('BATCH_NO','计算版本','s',1), c('ITEM_NO','品号','s',1,'RF_ITEM'),
    c('ITEM_NAME','品名','s',1), c('ITEM_TYPE','供应方式','s',1), c('NET_QTY','建议数量','d',1),
    c('REQ_DATE','需求日期','da',1), c('SUGGEST_DATE','建议下达日期','da'), c('SUGGEST_SUPPLIER','建议供应商','s'),
    c('CONFIRM_BY','确认人','s'), c('CONFIRM_TIME','确认时间','dt'), c('LINK_PR_NO','回写MES请购与比价选商单号','s')
  ]};
  T.PP_PLAN_SUGGEST = { label: '生产计划建议', domain: 'MRP', module: '物料需求计算', calc: true, doc: true, pk: 'SUGGEST_NO', cols: [
    c('SUGGEST_NO','计划建议号','s',1), c('BATCH_NO','计算版本','s',1), c('ITEM_NO','品号','s',1,'RF_ITEM'),
    c('ITEM_NAME','品名','s',1), c('NET_QTY','建议数量','d',1), c('SUGGEST_START','建议开工','da'),
    c('SUGGEST_END','建议完工','da'), c('REQ_DATE','需求日期','da',1), c('LINK_PLAN_NO','回写MES生产计划号','s')
  ]};

  /* ==================================================================
   * ③ 生产排程（SCH）——  核心③ 规则 + 版本 + 甘特 + 滚动（不含 ECN）
   * ================================================================== */
  T.SCH_RULE = { label: '排程规则', domain: 'SCH', module: '生产排程', pk: 'RULE_NO', cols: [
    c('RULE_NO','规则编号','s',1), c('RULE_NAME','规则名称','s',1), c('ORDER_SORT','订单排序规则','s',1),
    c('RES_SELECT','资源优选规则','s',1), c('OPT_TARGET','优化目标','s',1), c('FINITE_CAP','有限产能','b',1),
    c('SCH_DIR','排程方向','s',1), c('BOTTLENECK_STEP','瓶颈工序','s'), c('TRANSFER_BATCH','转移批量','d'),
    c('KIT_CONSTRAINT','启用齐套约束','b'), c('FREEZE_FIRST','冻结优先','b'), c('IS_DEFAULT','是否默认规则','b'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.SCH_VERSION = { label: '排程版本', domain: 'SCH', module: '生产排程', calc: true, doc: true, pk: 'VERSION_NO', cols: [
    c('VERSION_NO','版本号','s',1), c('RULE_NO','排程规则','s',1,'SCH_RULE'), c('VERSION_TYPE','版本类型','s',1),
    c('RANGE_FROM','计划起始','da',1), c('RANGE_TO','计划截止','da',1), c('GEN_TIME','生成时间','dt'),
    c('GEN_BY','生成人','s'), c('PUBLISH_TIME','发布时间','dt'), c('PUBLISH_BY','发布人','s'),
    c('TOTAL_TASK','任务数','i'), c('DELAY_TASK','延期任务数','i'), c('TOTAL_CHANGE_MIN','总换型时间(分)','d'),
    c('UTIL_RATE','资源利用率','d'), c('ROLLBACK_FLAG','发布回滚','b')
  ]};
  T.SCH_TASK = { label: '排程任务', domain: 'SCH', module: '生产排程', calc: true, detail: true, pk: 'TASK_ID', cols: [
    c('TASK_ID','任务ID','s',1), c('VERSION_NO','版本号','s',1), c('WO_NO','工单号','s',1,'RF_WORK_ORDER'),
    c('SO_NO','销售订单','s'), c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1),
    c('STEP_NO','工序号','s',1), c('STEP_NAME','工序名','s',1), c('RES_NO','资源','s',1,'BAS_RESOURCE'),
    c('RES_GROUP','资源分组','s'), c('START_TIME','计划开工','dt',1), c('END_TIME','计划完工','dt',1),
    c('PLAN_QTY','计划数量','d',1), c('DONE_QTY','已完工数量','d'), c('CHANGE_MIN','换型时间(分)','d'),
    c('KIT_DATE','齐套日期','da'), c('LOCK_FLAG','锁定','b'), c('RUSH_FLAG','插单','b'),
    c('DELAY_FLAG','延期','b'), c('TASK_STATUS','任务状态','s',1)
  ]};
  T.SCH_DAY_PLAN = { label: '日排产(3~7天)', domain: 'SCH', module: '生产排程', calc: true, pk: 'DP_ID', cols: [
    c('DP_ID','日排产ID','s',1), c('VERSION_NO','版本号','s',1), c('WO_NO','工单号','s',1,'RF_WORK_ORDER'),
    c('STEP_NO','工序号','s',1), c('STEP_NAME','工序名','s',1), c('PLAN_DATE','生产日期','da',1),
    c('RES_NO','资源','s',1,'BAS_RESOURCE'), c('SHIFT','班次','s'), c('PLAN_QTY','计划量','d',1),
    c('PLAN_START','计划开始','dt'), c('PLAN_END','计划结束','dt'), c('STATUS','状态','s')
  ]};
  T.SCH_ADJUST = { label: '人工调整记录', domain: 'SCH', module: '生产排程', pk: 'ADJ_ID', cols: [
    c('ADJ_ID','调整ID','s',1), c('VERSION_NO','版本号','s',1), c('TASK_ID','任务ID','s'), c('WO_NO','工单号','s'),
    c('STEP_NO','工序号','s'), c('ADJ_TYPE','调整类型','s',1), c('FROM_RES','原资源','s'), c('TO_RES','新资源','s'),
    c('FROM_TIME','原时间','s'), c('TO_TIME','新时间','s'), c('RUSH_MODE','插单模式','s'),
    c('IMPACT_ORDERS','受影响订单','x'), c('CONFLICT_MSG','冲突校验提示','x'), c('ADJ_BY','调整人','s'), c('ADJ_TIME','调整时间','dt'), c('STATUS','状态','s')
  ]};
  T.SCH_EXCEPTION = { label: '排产异常', domain: 'SCH', module: '生产排程', calc: true, pk: 'EXC_ID', cols: [
    c('EXC_ID','异常ID','s',1), c('VERSION_NO','版本号','s',1), c('TASK_ID','任务ID','s'), c('WO_NO','工单号','s',1,'RF_WORK_ORDER'),
    c('EXC_TYPE','异常类型','s',1), c('EXC_LEVEL','异常级别','s'), c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s'),
    c('EXC_DESC','异常说明','s'), c('RES_NO','相关资源','s','BAS_RESOURCE'), c('REQ_DATE','需求交期','da'),
    c('PLAN_END','计划完工','dt'), c('DELAY_DAYS','延期天数','i'), c('SUGGEST_ACTION','建议处置','s'), c('HANDLE_STATUS','处置状态','s',1)
  ]};
  /* V5 口径：本期生产排程不含工程变更（ECN），原 SCH_ECN_ALERT 表已移除。
     BOM / 工艺版本变更引起的重排与在制物料替换列入后续版本评估（见 V5 第 12 章）。 */

  /* ==================================================================
   * ④ 计划分析与预警（RPT）——  全部只读·实时派生（由业务数据实时汇总）
   * ================================================================== */
  /* 注：「产能负荷看板」「齐套率看板」原为 RPT 报表表，2026-10-15 起改为**看板视图**
     （左侧树「计划看板 → 产能负荷看板 / 齐套率看板」，卡片 + 图形 + 明细，见 app.js 的
     viewCapLoad / viewKitRate），不再作为列表型报表表存在，故不在此定义表结构。 */
  T.RPT_DELIVERY_ALERT = { label: '交期预警表', domain: 'RPT', module: '计划分析与预警', report: true, pk: 'ALERT_ID', cols: [
    c('ALERT_ID','预警ID','s',1), c('SO_NO','销售订单','s',1), c('CUSTOMER_CODE','客户','s'),
    c('ITEM_NO','品号','s',1), c('ITEM_NAME','品名','s'), c('REQ_DATE','需求交期','da',1),
    c('SCH_END','排程完工','da'), c('DELAY_DAYS','延期天数','i'), c('DELAY_FLAG','是否延期','b'),
    c('RISK_LEVEL','风险级别','s'), c('CUSTOMER_SUM','客户汇总','s')
  ]};
  T.RPT_SCHEDULE_KPI = { label: '排程KPI', domain: 'RPT', module: '计划分析与预警', report: true, pk: 'KPI_ID', cols: [
    c('KPI_ID','KPI_ID','s',1), c('STAT_DATE','统计日期','da',1), c('VERSION_NO','排程版本','s',1),
    c('RULE_NO','排程规则','s'), c('DELAY_TASK','延期任务数','i'), c('DELAY_DAYS','总延期天数','i'),
    c('TOTAL_CHANGE_MIN','总换型时间(分)','d'), c('UTIL_RATE','资源利用率','d'),
    c('ONTIME_TASK','准时任务数','i'), c('OTD_RATE','准时率','d')
  ]};
  T.RPT_NET_REQ_SUM = { label: '物料需求计划表', domain: 'RPT', module: '计划分析与预警', report: true, pk: 'SUM_ID', cols: [
    c('SUM_ID','汇总ID','s',1), c('ITEM_NO','品号','s',1), c('ITEM_NAME','品名','s'), c('ITEM_TYPE','建议类型','s'),
    c('LEVEL_NO','层级','i'), c('REQ_DATE','需求日期','da',1), c('GROSS_QTY','毛需求','d'), c('NET_QTY','净需求','d'),
    c('STOCK_QTY','库存','d'), c('ON_ORDER_QTY','在途','d'), c('WIP_QTY','在制','d'), c('SHORT_QTY','缺口','d')
  ]};
  T.RPT_SHORT_DETAIL = { label: '缺料明细表', domain: 'RPT', module: '计划分析与预警', report: true, pk: 'DETAIL_ID', cols: [
    c('DETAIL_ID','明细ID','s',1), c('SO_NO','销售订单/工单','s',1), c('ITEM_NO','品号','s',1),
    c('ITEM_NAME','品名','s'), c('SHORT_QTY','缺料数量','d'), c('RECOVER_DATE','预计恢复日','da'),
    c('KEY_ITEM_FLAG','是否关键件','b'), c('SUPPLY_TYPE','供应方式','s'), c('ORDER_DRILL','订单下钻','s'), c('RISK_LEVEL','风险级别','s')
  ]};

  /* ==================================================================
   * ⑤ 集成接口（IF）——  一期预留：ERP / EDI / SRM / MES 对接框架
   * ================================================================== */
  T.IF_CONFIG = { label: '集成配置', domain: 'IF', module: '系统与集成', pk: 'IF_CODE', cols: [
    c('IF_CODE','接口编码','s',1), c('SYS_NAME','对接系统','s',1), c('IF_TYPE','接口方式','s',1),
    c('DIRECTION','数据方向','s',1), c('DATA_SCOPE','数据范围','s'), c('FREQ','同步频次','s'),
    c('IS_RESERVED','是否预留未启用','b'), c('ENABLE_FLAG','是否启用','b',1)
  ]};
  T.IF_RUN_LOG = { label: '集成运行日志', domain: 'IF', module: '系统与集成', pk: 'LOG_ID', cols: [
    c('LOG_ID','日志ID','s',1), c('IF_CODE','接口编码','s',1), c('RUN_TIME','运行时间','dt',1),
    c('DIRECTION','数据方向','s'), c('RECORDS','记录数','i'), c('STATUS','运行状态','s',1),
    c('ERROR_MSG','错误信息','s'), c('RETRY_FLAG','已重试','b'), c('MANUAL_FALLBACK','手工兜底','b')
  ]};

  /* ==================================================================
   * ⑥ UNS 主数据快照（RF）——  APS 只读，不入导航
   *   V5 口径：主数据真源在 supOS UNS「MES制造管理系统/工厂建模」等节点，APS 按需直读；
   *   本组表不由左侧导航暴露（见 HIDDEN），仅作为取数层的数据载体：
   *     · 连上 flash01 UNS 时 → 取数层用 UNS 实时数据填充（UNS_MAP 声明别名映射）；
   *     · 本地开发 / 离线演示 → 用内置快照兜底，保证需求源、MRP、齐套、排程可完整跑通。
   *   APS 内不提供这些表的新增 / 编辑入口（无重复维护）。
   * ================================================================== */
  T.RF_ITEM = { label: '物料主数据(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'ITEM_NO', cols: [
    c('ITEM_NO','物料品号','s',1), c('ITEM_NAME','品名','s',1), c('SPEC','规格','s'), c('UNIT','单位','s',1),
    c('ITEM_TYPE','自制/外购/外协','s',1), c('ITEM_CATEGORY','物料分类','s'), c('CUSTOMER_PART_NO','客户品号','s'),
    c('SAFETY_STOCK','安全库存','d'), c('PURCHASE_LEAD_TIME','采购提前期(天)','i'), c('PRODUCE_LEAD_TIME','生产提前期(天)','i'),
    c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_BOM = { label: 'BOM(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'BOM_NO', cols: [
    c('BOM_NO','BOM编号','s',1), c('BOM_VER','版本','s',1), c('SEQ_NO','序号','i',1),
    c('PARENT_ITEM','父件品号','s',1,'RF_ITEM'), c('ITEM_NO','子件品号','s',1,'RF_ITEM'), c('ITEM_NAME','子件品名','s',1),
    c('NET_QTY','单件用量','d',1), c('LOSS_RATE','损耗率','d'), c('LEVEL_NO','层级','i',1), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_ROUTE = { label: '工艺路线(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'ROUTE_NO', cols: [
    c('ROUTE_NO','工艺路线','s',1), c('ROUTE_VER','版本','s',1), c('STEP_NO','工序号','s',1),
    c('STEP_NAME','工序名','s',1), c('WORK_CENTER','工作中心','s'), c('RES_GROUP','资源分组','s'),
    c('STD_HOUR','标准工时','d'), c('IS_KEY_STEP','关键工序','b'), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_EQUIPMENT = { label: '设备(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'EQUIP_NO', cols: [
    c('EQUIP_NO','设备编号','s',1), c('EQUIP_NAME','设备名称','s',1), c('EQUIP_TYPE','设备类型','s'),
    c('WORK_CENTER','工作中心','s'), c('STD_CYCLE','标准节拍(s/件)','d'), c('EQUIP_STATUS','设备状态','s'), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_SO = { label: '销售订单(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'SO_NO', cols: [
    c('SO_NO','销售订单号','s',1), c('SEQ_NO','序号','i',1), c('CUSTOMER_CODE','客户','s',1),
    c('ITEM_NO','品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1), c('ORDER_QTY','订单数量','d',1),
    c('DELIVERED_QTY','已交数量','d'), c('OPEN_QTY','未交数量','d'), c('DELIVERY_DATE','交期要求','da',1),
    c('PRIORITY','客户优先级','s'), c('STATUS','状态','s'), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_STOCK = { label: '库存(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'STOCK_ID', cols: [
    c('STOCK_ID','库存ID','s',1), c('ITEM_NO','物料品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s'),
    c('WAREHOUSE','仓库','s'), c('LOT_NO','批次','s'), c('ONHAND_QTY','在库数量','d',1),
    c('AVAILABLE_QTY','可用数量','d'), c('QC_QTY','质检状态库存','d'), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_PO_ONWAY = { label: '采购在途(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'PO_NO', cols: [
    c('PO_NO','采购订单号','s',1), c('SEQ_NO','序号','i',1), c('SUPPLIER_CODE','供应商','s'),
    c('ITEM_NO','物料品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s'), c('ORDER_QTY','订单数量','d',1),
    c('ARRIVED_QTY','已到货数量','d'), c('OWING_QTY','在途数量','d'), c('DELIVERY_DATE','交货日期','da',1), c('SOURCE_SYS','数据来源','s')
  ]};
  T.RF_WORK_ORDER = { label: '工单/报工实绩(MES引用)', domain: 'RF', module: 'MES主数据(UNS直读)', pk: 'WO_NO', cols: [
    c('WO_NO','工单号','s',1), c('ITEM_NO','产品品号','s',1,'RF_ITEM'), c('ITEM_NAME','品名','s',1),
    c('ROUTE_NO','工艺路线','s'), c('PLAN_QTY','计划数量','d',1), c('FINISH_QTY','完工数量','d'),
    c('PLAN_START','计划开工','da'), c('PLAN_END','计划完工','da'), c('DEPT_CLASS','课别','s'),
    c('PRIORITY','优先级','i'), c('STATUS','状态','s'), c('SOURCE_SYS','数据来源','s')
  ]};

  /* ==================================================================
   * ⑦ 系统（SYS）
   * ================================================================== */
  T.SYS_DICT = { label: '字典', domain: 'SYS', module: '系统与集成', pk: 'DICT_CODE', cols: [
    c('DICT_CODE','字典编码','s',1), c('DICT_NAME','字典名称','s'), c('DICT_TYPE','字典类型','s'), c('ITEM_CODE','项编码','s'),
    c('ITEM_NAME','项名称','s'), c('ITEM_VALUE','项值','s'), c('SORT_NO','排序','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.SYS_CODE_RULE = { label: '编码规则', domain: 'SYS', module: '系统与集成', pk: 'RULE_CODE', cols: [
    c('RULE_CODE','规则编码','s',1), c('BIZ_TYPE','业务类型','s'), c('PREFIX','前缀','s'), c('DATE_FMT','日期格式','s'),
    c('FLOW_LEN','流水长度','i'), c('CUR_NO','当前流水','i'), c('ENABLE_FLAG','是否启用','b')
  ]};
  T.SYS_AUDIT_LOG = { label: '审计日志', domain: 'SYS', module: '系统与集成', pk: 'LOG_ID', cols: [
    c('LOG_ID','日志ID','s',1), c('TABLE_NAME','表名','s'), c('RECORD_ID','记录ID','s'), c('ACTION','操作','s'),
    c('FIELD_DIFF','字段差异','x'), c('OPERATOR','操作人','s'), c('OP_TIME','操作时间','dt'), c('REMARK','备注','s')
  ]};
  T.SYS_ATTACHMENT = { label: '附件', domain: 'SYS', module: '系统与集成', pk: 'ATTACH_ID', cols: [
    c('ATTACH_ID','附件ID','s',1), c('BIZ_TYPE','业务类型','s'), c('BIZ_ID','业务ID','s'), c('FILE_NAME','文件名','s'),
    c('FILE_URL','文件URL','s'), c('FILE_SIZE','文件大小','i'), c('UPLOAD_BY','上传人','s'), c('UPLOAD_TIME','上传时间','dt')
  ]};
  /* 单据上下游关联台账：按业务流一键流转时记录「具体哪条来源单 → 哪条去向单」，
     供单据详情/使用说明的「业务流」区按具体单号定位（非仅类型级关系）。 */
  T.SYS_DOC_LINK = { label: '单据上下游关联', domain: 'SYS', module: '系统与集成', pk: 'LINK_ID', cols: [
    c('LINK_ID','关联ID','s',1), c('FROM_TABLE','来源表','s',1), c('FROM_NO','来源单号','s',1),
    c('TO_TABLE','去向表','s',1), c('TO_NO','去向单号','s',1), c('FLOW_LABEL','流转动作','s'),
    c('LINK_TIME','关联时间','dt'), c('REMARK','备注','s')
  ]};

  /* ============ 通用扩展（自动补字段，勿在业务 cols 里重复定义） ============
   * ① 审核三件套（为后续工作流预留）：审核状态 / 审核人 / 审核时间。
   *    单据表由 DOC 提供（含 AUDIT_STATUS）；非单据业务表在此自动补齐。
   *    ⚠️ 计算结果表（calc:true）例外：数据由计算工作台系统写入，没有人工审核概念，
   *       故既不补审核字段，columnsOf 里也会把 DOC 自带的审核字段过滤掉（见文件末尾）。
   * ② 启用绑定：凡有「是否启用(ENABLE_FLAG)」的表，自动补「启用时间 / 失效时间」。 */
  var AUDIT_CODES = ['AUDIT_STATUS', 'AUDIT_BY', 'AUDIT_TIME'];
  (function () {
    var AUDIT_EXTRA = [
      { code: 'AUDIT_STATUS', label: '审核状态', type: 's', req: false },
      { code: 'AUDIT_BY', label: '审核人', type: 's', req: false },
      { code: 'AUDIT_TIME', label: '审核时间', type: 'dt', req: false }
    ];
    Object.keys(T).forEach(function (t) {
      var cols = T[t].cols;
      if (!T[t].doc && !T[t].calc) AUDIT_EXTRA.forEach(function (ac) {
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
    BAS_DEMAND:     [{ table: 'BAS_DEMAND_LINE',  fk: 'DEMAND_NO'  }],
    MRP_BATCH:      [{ table: 'MRP_NET_REQ',      fk: 'BATCH_NO'   }],
    MRP_KIT_CHECK:  [{ table: 'MRP_KIT_SHORT',    fk: 'CHECK_NO'   }],
    SCH_VERSION:    [{ table: 'SCH_TASK',         fk: 'VERSION_NO' }]
  };

  /* ============ 导航归组（纯展示用，与主子表数据关系无关） ============
   * 把逻辑上从属于某张主表的表，在左侧导航里挂在父表 ▸ 之下，避免顶级条目过多。 */
  var NAV_SUB = {
    BAS_RESOURCE: ['BAS_MAINTENANCE']    // 维保/故障占用 挂在 排产资源 下
  };

  /* ============ MES 主数据（UNS 直读）============
   * V5 口径：APS 不复制 MES 主数据；物料 / BOM / 工艺 / 设备 / 销售订单 / 库存 / 采购在途 / 工单实绩
   * 的真源在 supOS UNS「MES制造管理系统/工厂建模」等节点，APS 按需直读。
   * 下方 HIDDEN 为「不由导航暴露、但内部仍承载 UNS 快照（离线兜底 / 演示）」的表，
   * 它们不占功能域、不出现在左侧树，仅在取数层被引用。 */
  var HIDDEN = ['RF_ITEM','RF_BOM','RF_ROUTE','RF_EQUIPMENT','RF_SO','RF_STOCK','RF_PO_ONWAY','RF_WORK_ORDER'];

  /* ============ UNS 数据源映射（APS 取数 → supOS UNS 别名）============
   * 本地演示：先用内置快照；连上 flash01 UNS 后由取数层替换为实时数据。 */
  var UNS_MAP = {
    RF_ITEM:       { alias: 'mes_md_material',            node: 'MES制造管理系统/工厂建模' },
    RF_BOM:        { alias: 'mes_md_bom_line',            node: 'MES制造管理系统/工厂建模' },
    RF_ROUTE:      { alias: 'mes_rt_route_step',          node: 'MES制造管理系统/工艺管理' },
    RF_EQUIPMENT:  { alias: 'mes_md_equipment',           node: 'MES制造管理系统/工厂建模' },
    RF_SO:         { alias: 'mes_sd_sales_order_line',    node: 'MES制造管理系统/订单管理' },
    RF_STOCK:      { alias: 'mes_wm_stock',               node: 'MES制造管理系统/库存管理' },
    RF_PO_ONWAY:   { alias: 'mes_pd_purchase_order_line', node: 'MES制造管理系统/订单管理' },
    RF_WORK_ORDER: { alias: 'mes_ex_wo_step',             node: 'MES制造管理系统/生产管理' }
  };

  /* ============ 业务域 / 模块结构（7 功能域 · V5） ============ */
  var DOMAINS = [
    { code: 'BAS', name: '计划基础数据', desc: '排程前提：计划参数 + 资源建模 + 规则配置（F1.1~F1.5）', modules: [
      { name: '计划基础数据', tables: ['BAS_ITEM_PLAN_ATTR','BAS_RESOURCE','BAS_RESOURCE_GROUP','BAS_CHANGEOVER','BAS_CALENDAR','BAS_MAINTENANCE'] }
    ]},
    { code: 'DEM', name: '需求管理', desc: '业务源头：四类需求源 + 预测冲减 + 时界（F2.1~F2.4）', modules: [
      { name: '需求管理', tables: ['BAS_DEMAND','BAS_DEMAND_LINE'] }
    ]},
    { code: 'MRP', name: '物料需求计算', desc: '核心①：净需求展开 → 判断当前是否缺料 + 建议流转（F3.1~F3.3）', modules: [
      { name: '物料需求计算', tables: ['MRP_BATCH','MRP_NET_REQ','PR_SUGGEST','PP_PLAN_SUGGEST'] }
    ]},
    { code: 'KIT', name: '物料齐套计算', desc: '核心②：逐层配套 → 齐套数量 / 齐套率 / 齐套日期（F4.1~F4.2）', modules: [
      { name: '物料齐套计算', tables: ['MRP_KIT_CHECK','MRP_KIT_SHORT'] }
    ]},
    { code: 'SCH', name: '生产排程', desc: '核心③：有限产能排程 + 人机协同 + 日排产 + 异常预警（不含 ECN）（F5.1~F5.7）', modules: [
      { name: '生产排程', tables: ['SCH_RULE','SCH_VERSION','SCH_TASK','SCH_DAY_PLAN','SCH_ADJUST','SCH_EXCEPTION'] }
    ]},
    { code: 'RPT', name: '计划分析与预警', desc: '全部只读派生：交期 / KPI / 物料需求 / 缺料（F6.1~F6.4）', modules: [
      { name: '计划分析与预警', tables: ['RPT_DELIVERY_ALERT','RPT_SCHEDULE_KPI','RPT_NET_REQ_SUM','RPT_SHORT_DETAIL'] }
    ]},
    { code: 'SYS', name: '系统与集成', desc: '接口 / 字典 / 权限 / 审计（F7.1~F7.3）', modules: [
      { name: '系统与集成', tables: ['IF_CONFIG','IF_RUN_LOG','SYS_DICT','SYS_CODE_RULE','SYS_AUDIT_LOG','SYS_ATTACHMENT','SYS_DOC_LINK'] }
    ]}
  ];

  /* ============ 左侧导航树（扁平功能域 → 表单，7 域与 V5 同构） ============
   * 三个核心域（物料需求计算 / 物料齐套计算 / 生产排程）以 **计算工作台（views）** 作为
   * 域内第一入口，其下的表是「计算结果明细」——进入即算、算完即看，不再是单纯的增删改查列表。
   * 原「应用工具」域已下线：计算版本工作台拆入「物料需求计算」，一键演练 8 步按域拆解
   * （选规则→排程域；需求计算/计划建议→物料需求计算；齐套→物料齐套计算；自动排程/甘特/滚动→生产排程），
   * UNS 数据源映射归入「系统与集成」。 */
  var GROUPS = [
    { name: '计划基础数据', tables: ['BAS_ITEM_PLAN_ATTR','BAS_RESOURCE','BAS_RESOURCE_GROUP','BAS_CHANGEOVER','BAS_CALENDAR','BAS_MAINTENANCE'] },
    { name: '需求管理', tables: ['BAS_DEMAND','BAS_DEMAND_LINE'] },
    /* 核心①：进入即「MRP 计算工作台」，下方为其派生结果明细表 */
    { name: '物料需求计算', views: ['mrp'], tables: ['MRP_BATCH','MRP_NET_REQ','PR_SUGGEST','PP_PLAN_SUGGEST'] },
    /* 核心②：进入即「齐套计算工作台」，下方为其派生结果明细表 + 齐套率看板 */
    { name: '物料齐套计算', views: ['kit', 'kitrate'], tables: ['MRP_KIT_CHECK','MRP_KIT_SHORT'] },
    /* 核心③：进入即「排程工作台」，下方为规则 / 版本 / 任务 / 日排产 / 调整 / 异常 + 排产甘特图 */
    { name: '生产排程', views: ['sched', 'gantt'], tables: ['SCH_RULE','SCH_VERSION','SCH_TASK','SCH_DAY_PLAN','SCH_ADJUST','SCH_EXCEPTION'] },
    { name: '计划分析与预警', tables: ['RPT_DELIVERY_ALERT','RPT_SCHEDULE_KPI','RPT_NET_REQ_SUM','RPT_SHORT_DETAIL'], report: true },
    { name: '计划看板', tables: [], views: ['board', 'capload'] },
    { name: '系统与集成', views: ['uns'], tables: ['IF_CONFIG','IF_RUN_LOG','SYS_DICT','SYS_CODE_RULE','SYS_AUDIT_LOG','SYS_ATTACHMENT','SYS_DOC_LINK'] }
  ];

  /* ============ 模块介绍（仅用于「使用说明」展示，不进表单） ============
   * role: 这个模块是干什么的；data: 这个模块放的是什么数据。 */
  var GROUP_INTRO = {
    '计划基础数据': { role: 'APS 的输入地基（F1.1~F1.5）：把「物料按什么规则计划、设备/产线什么时候能用、换型要多久、按什么规则排」这些计划前提维护清楚，净需求计算与排程才有正确依据。物料 / BOM / 工艺 / 设备等主数据本身不在 APS 维护，真源在 supOS UNS「MES制造管理系统/工厂建模」，此处只配置 APS 特有的计划参数与资源日历。', data: '物料计划属性（提前期/批量/安全库存/补充上下限/关键件与长周期件标识/替代料规则/默认资源组）、排产资源、资源分组（一工序多机候选）、换型时间（序列相关准备时间，支持任意→某产品通配）、工厂日历（三级：工厂/工作中心/资源）、维保与故障占用。' },
    '需求管理': { role: '业务源头（F2.1~F2.4）：统一管理两类需求来源（销售订单 / 库存补充），做需求时界标注，并在物料需求计算前生成需求池快照。需求全部来自 MES（销售订单明细、库存、采购在途），不在 APS 侧凭空造需求。', data: '需求源单据（两类来源，含来源单据号自动聚合）、需求明细（品号/需求数量/需求日期/来源单据号）、冻结与时界字段（冻结窗口/冻结至/变更审批人）。' },
    '物料需求计算': { role: '核心①（F3.1~F3.3）：回答「当前是否缺料」——进入该域即落在「MRP 计算工作台」：选定计算口径（排程规则）→ 勾选本次纳入的需求源 → 点「运行 MRP 计算」，一次算出净需求、补料建议与生产计划建议。算法按 BOM 自成品向下逐层展开，扣减库存/在制/在途生成净需求并做缺料判定（关键件=阻断级、非关键件=提示级）。域内下表为本次计算的结果明细，由工作台自动写入，不需要逐条手工录入。', data: '需求计算版本、净需求（毛需求/安全库存/库存/在制/在途/净需求/批量调整后/建议下达日期）、补料建议（外购外协 → 确认流转 MES 请购与比价选商 PD_PRICE_COMPARE）、生产计划建议（自制 → 回写 PP_MASTER_PLAN）。' },
    '物料齐套计算': { role: '核心②（F4.1~F4.2）：回答「配不配得齐」——进入该域即落在「齐套计算工作台」：选择要检查的计算版本 → 点「运行齐套检查」，对订单/工单/计划逐层齐套检查（整机←部件←零件关键件），输出齐套数量、齐套率、齐套日期与缺料明细；齐套日期作为排程的最早开工约束。关键件缺料标为阻断级，非关键件为提示级。域内下表为结果明细，由工作台自动写入。', data: '齐套检查（检查口径/检查日期/需求数量/齐套数量/缺料数量/齐套率/齐套日期/是否关键件）、缺料明细（缺什么/缺多少/预计恢复日/供应方式/是否阻断）。' },
    '生产排程': { role: '核心③（F5.1~F5.7）：用有限产能自动排程替代人工 Excel 排产。进入该域即落在「排程工作台」：选定排程规则（工作台会显示该规则的订单排序、资源优选、优化目标与约束）→ 点「运行自动排程」，按规则把工单的每道工序排到「资源 × 起止时间 × 数量」颗粒度，产出排程版本 + 任务 + 日排产；同日历、换型、齐套日期为约束。域内下表为规则/版本/任务/日排产/调整/异常的明细与留痕。排产只按「日」进行（客户按每天排产），不设周计划；排程后出现延期、插单冲突、超负荷等会沉淀到「排产异常」表。', data: '排程规则（订单排序/资源优选/优化目标/正倒排/瓶颈工序/齐套约束）、排程版本（草稿→已发布，含换型时间与利用率）、排程任务（工序级）、日排产（3~7天）、人工调整记录（含插单影响预览与冲突提示）、排产异常（延期/冲突/超负荷及建议处置）。' },
    '计划分析与预警': { role: '只读的分析视图（F6.1~F6.4）：报表不落地人工录入，每次打开都按业务数据实时汇总，因此上游任何新增/修改都会自动反映到这里；表格只保留「查询 / 导出」操作，口径对齐 MES 现有报表机制（不落库、随业务数据实时变化、可查询导出）。作为分析视图，报表列也不含通用主键 ID 与「审核状态 / 审核人 / 审核时间」（无录入与审核概念）。注：产能负荷 / 齐套率已改为**看板视图**，见「计划看板」域。', data: '交期预警表（需求交期 vs 排程完工、延期高亮、按客户汇总）、排程 KPI（延期任务数/总延期天数/总换型时间/资源利用率）、物料需求计划表、缺料明细表。' },
    '计划看板': { role: '计划状态视图集合（全部只读·实时派生）：计划驾驶舱（多卡片实时状态，本周/上周/本月/上月/本年快捷切换 + 起止日期 + KPI + 负荷与齐套分布 + 延期明细）、产能负荷看板（按 资源×日期 的负荷率卡片 + 日负荷趋势 + 机台负荷排行 + 瓶颈识别）、齐套率看板（齐套率卡片 + 各订单齐套率条 + 缺料 Top-N + 长周期件专项）、排产甘特图（订单/工序/机台视角，与实际进度对比）。每次打开 / 刷新默认落在「计划驾驶舱」。', data: '本身不存业务数据，指标全部由排程任务、负荷、齐套、交期、补料建议等实时汇总。' },
    '系统与集成': { role: '平台级配置与支撑（F7.1~F7.3）：字典与编码规则统一编码，审计日志留痕，附件与单据关联台账支撑追溯；集成接口一期仅预留框架（ERP / EDI 830·862·856 / SRM / MES 对接配置化 + 运行日志 + 手工兜底），不实现实际对接。', data: '字典、编码规则、审计日志、附件、单据上下游关联台账；集成配置（对接系统/接口方式/数据方向/数据范围/同步频次）、集成运行日志（时间/方向/记录数/成功失败/错误原因/是否重试/是否手工兜底）。' }
  };

  /* ============ 单据流转关系（FOC 业务流） ============
   * key: 源单据主表; value: [{ to: 目标单据主表, label: 按钮文字 }]
   * 设计为「单向业务流、单源可多向」。对应需求第 3 章业务流程：
   *   需求 → 物料需求计算（净需求+齐套）→ 补料建议 / 生产计划建议 → 排程 → 发布回写 → 滚动重排。 */
  var FLOW = {
    BAS_DEMAND:      [{ to: 'MRP_BATCH',         label: '纳入需求计算' }],
    MRP_BATCH:       [{ to: 'MRP_KIT_CHECK',     label: '执行齐套检查' }, { to: 'PR_SUGGEST', label: '生成补料建议' }, { to: 'PP_PLAN_SUGGEST', label: '生成生产计划建议' }],
    MRP_KIT_CHECK:   [{ to: 'MRP_KIT_SHORT',     label: '生成缺料明细' }],
    PP_PLAN_SUGGEST: [{ to: 'SCH_VERSION',       label: '执行自动排程' }],
    SCH_RULE:        [{ to: 'SCH_VERSION',       label: '按规则排程' }],
    SCH_VERSION:     [{ to: 'SCH_DAY_PLAN', label: '细化日排产' }, { to: 'SCH_ADJUST', label: '登记人工调整' }, { to: 'SCH_EXCEPTION', label: '生成排产异常' }],
    IF_CONFIG:       [{ to: 'IF_RUN_LOG',        label: '生成运行日志' }]
  };

  /* ============ 计算版本 → 派生结果（APS 核心血缘，与 MES 的「单转单」区分） ============
   * 语义：一次「需求计算版本」运行，以需求源为输入、以排程规则为口径，**同时产出**下列结果；
   *       这些结果是**同一次计算的平级产物**（互为兄弟），不是「净需求流转成齐套」那种单向单据链。
   *       因此工作台按「版本 → 输入（需求源）/ 输出（派生结果）」两栏组织，而不是「上游单 / 下游单」。
   *   表名: 派生结果表；label: 在工作台中的分组名；kind: input=输入 / output=输出；
   *   via:  与版本关联的字段（用于按版本号取结果行）。 */
  var BATCH_RESULT = [
    { table: 'BAS_DEMAND',    label: '需求源（本次纳入）', kind: 'input',  via: null },
    { table: 'MRP_NET_REQ',   label: '净需求（逐层展开）', kind: 'output', via: 'BATCH_NO' },
    { table: 'MRP_KIT_CHECK', label: '齐套检查',          kind: 'output', via: 'BATCH_NO' },
    { table: 'PR_SUGGEST',    label: '补料建议',          kind: 'output', via: 'BATCH_NO' },
    { table: 'PP_PLAN_SUGGEST', label: '生产计划建议',    kind: 'output', via: 'BATCH_NO' },
    { table: 'SCH_VERSION',   label: '排程版本',          kind: 'output', via: null }
  ];

  /* ============ 导入外键校验（父单存在性） ============ */
  var IMPORT_FK = {
    BAS_DEMAND_LINE:  { DEMAND_NO: 'BAS_DEMAND' },
    MRP_NET_REQ:      { BATCH_NO: 'MRP_BATCH' },
    MRP_KIT_SHORT:    { CHECK_NO: 'MRP_KIT_CHECK' },
    PR_SUGGEST:       { BATCH_NO: 'MRP_BATCH' },
    PP_PLAN_SUGGEST:  { BATCH_NO: 'MRP_BATCH' },
    SCH_TASK:         { VERSION_NO: 'SCH_VERSION' },
    SCH_DAY_PLAN:     { VERSION_NO: 'SCH_VERSION' },
    SCH_ADJUST:       { VERSION_NO: 'SCH_VERSION' },
    IF_RUN_LOG:       { IF_CODE: 'IF_CONFIG' }
  };

  /* ============ 需求来源 → 数据来源（F2.1 需求源管理） ============
   * 作用：录入需求明细时，「需求来源」一经选定，品号候选即限定在该来源的可用数据内（来源约束），
   *       并在选中品号后自动带出「品名 / 来源单据号 / 需求日期 / 需求数量」。
   * ref 为空 = 无外部来源表（人工录入），此时品号不做限制、来源单据号按 docPrefix 规则自动生成。
   *   docCol 来源单据号取值字段；docPrefix/period 无来源表时的自动单号规则；
   *   qtyCol 需求数量取值字段（qtyFallback 为无值时回退）；dateCol 需求日期取值字段；
   *   stockRef/stockCol 库存余额来源（用于「库存补充」建议补充量 = 补充上限 − 可用库存）。 */
  var DEMAND_SOURCE = {
    '销售订单': {
      ref: 'RF_SO', docCol: 'SO_NO', itemCol: 'ITEM_NO', nameCol: 'ITEM_NAME',
      qtyCol: 'OPEN_QTY', qtyFallback: 'ORDER_QTY', dateCol: 'DELIVERY_DATE', custCol: 'CUSTOMER_CODE',
      poolFilter: function (r) { return (+((r.OPEN_QTY === undefined || r.OPEN_QTY === null || r.OPEN_QTY === '') ? r.ORDER_QTY : r.OPEN_QTY) || 0) > 0; },
      desc: '品号候选 = supOS UNS「MES制造管理系统/订单管理/销售订单明细」(mes_sd_sales_order_line) 中「未交数量 > 0」的订单行；选中品号自动带出该订单号与交期，需求数量默认取未交数量'
    },
    '库存补充': {
      ref: 'BAS_ITEM_PLAN_ATTR', docCol: null, itemCol: 'ITEM_NO', nameCol: 'ITEM_NAME',
      qtyCol: 'MAX_STOCK', stockRef: 'RF_STOCK', stockCol: 'AVAILABLE_QTY', onwayRef: 'RF_PO_ONWAY', onwayCol: 'OWING_QTY', dateCol: null,
      docPrefix: 'AUTO', period: 'day',
      desc: '品号候选 = 已维护「补充下限(min)/补充上限(max)」的物料；建议补充量 = 补充上限 − 可用库存 − 采购在途（可用库存取自 MES WM_STOCK、在途取自 MES 采购订单明细，均实时直读）'
    }
  };

  /* 「需求来源」的来源约束落到哪张子表的哪个品号字段（供前端渲染下拉时收窄候选） */
  var DEMAND_TARGET = { table: 'BAS_DEMAND_LINE', itemCol: 'ITEM_NO' };

  /* ============ 表级使用说明补充 ============
   * 只用于解释「有特殊交互 / 特殊口径」的表，渲染在「使用说明 · 当前表」卡片内。 */
  var TABLE_TIPS = {
    BAS_DEMAND: [
      '「需求来源」是字典下拉（销售订单 / 库存补充）。选定后，下方「需求明细」的<b>品号候选会自动收窄到该来源的可用数据</b>：销售订单 → 未交量 > 0 的销售订单行；库存补充 → 已维护补充上下限(min/max)的物料（可用库存取自 MES、在途取自 MES 采购订单）。',
      '「来源单据号」是<b>由明细实时聚合</b>出来的：取明细里实际用到的来源单号，<b>多条用「；」拼接、单条原样显示，并自动去重</b>。新增 / 修改 / 删除（含导入）明细后自动重算回写，不会出现重复单号。',
      '工具栏「从销售订单生成」可<b>多选销售订单、合并生成一张需求源单</b>；也可以在本表单里逐行录入明细，两者口径一致。'
    ],
    BAS_DEMAND_LINE: [
      '在「品号」下拉选定物料后，系统按表头「需求来源」自动带出<b>品名 / 来源单据号 / 需求日期 / 需求数量</b>——只在对应字段为空时填入，不覆盖已填内容。',
      '从「需求源」单据详情进入时，明细品号候选与表头来源保持一致。若中途切换来源、原品号已不属于新来源，该值会保留并标注「不在当前来源范围内」，不会被静默清空。'
    ]
  };

  /* ============ 主表聚合字段（由子表实时汇总后回写主表） ============
   * 需求：新增 / 修改 / 删除需求明细后，主表「来源单据号」要按明细里实际用到的来源单号重算——
   *       多条用「；」拼接、单条原样，且不得重复。 */
  var MASTER_AGG = {
    BAS_DEMAND: [{ field: 'SOURCE_NO', table: 'BAS_DEMAND_LINE', fk: 'DEMAND_NO', col: 'SRC_DOC_NO', sep: '；' }]
  };

  /* ============ 子表行内公式（任一来源字段变化即重算目标字段） ============ */
  var LINE_CALC = {};

  var SCHEMA = { COMMON: COMMON, DOC: DOC, TABLES: T, DOMAINS: DOMAINS, GROUPS: GROUPS, GROUP_INTRO: GROUP_INTRO, MASTER_DETAIL: MASTER_DETAIL, NAV_SUB: NAV_SUB, HIDDEN: HIDDEN, UNS_MAP: UNS_MAP, FLOW: FLOW, BATCH_RESULT: BATCH_RESULT, IMPORT_FK: IMPORT_FK, DEMAND_SOURCE: DEMAND_SOURCE, DEMAND_TARGET: DEMAND_TARGET, MASTER_AGG: MASTER_AGG, LINE_CALC: LINE_CALC, TABLE_TIPS: TABLE_TIPS };

  // 合并通用/单据字段，返回某表完整列定义
  // 「备注(REMARK)」统一后置到最末位（业务字段之后），便于阅读与录入。
  SCHEMA.columnsOf = function (table) {
    var def = T[table];
    if (!def) return [];
    var cols = COMMON.slice();
    if (def.doc) cols = cols.concat(DOC);
    def.cols.forEach(function (cc) {
      if (!cols.some(function (x) { return x.code === cc.code; })) cols.push(cc);
    });
    /* 计算结果表（calc:true）：由计算工作台系统写入，不参与人工审核 —— 去掉审核三件套 */
    if (def.calc) cols = cols.filter(function (c) { return AUDIT_CODES.indexOf(c.code) < 0; });
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
  if (root) root.APS_SCHEMA = SCHEMA;
})(typeof window !== 'undefined' ? window : null);
