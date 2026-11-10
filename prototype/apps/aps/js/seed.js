/*
 * seed.js —— 演示种子数据（汽配车间 APS 场景 · V5 轻量化三核心）
 * 设定 window.APS_SEED = { 表名: [记录...] }
 * 行业剧本：汽配一厂（焊装车间）为 常州蓝驰新能源 / 合肥众驰变速器 生产
 *   前副车架总成 P-SF-001 / 后副车架总成 P-SF-002 / 电驱动悬置支架 P-MB-003，
 *   需求源(订单/预测/叫料/库存补充) → 物料需求计算(逐层净需求 + 齐套检查) → 补料建议 / 生产计划建议
 *   → 齐套检查 → 排程版本(周计划 + 日排产) → 甘特人工调整 / 插单 / 锁定 → 版本对比发布 → 回写MES / 滚动重排（不含 ECN）。
 *   主数据(物料/BOM/工艺/设备/订单/库存/在途/工单实绩)真源在 supOS UNS「MES制造管理系统/工厂建模」，
 *   APS 不重建；下方 RF_* 为 UNS 主数据快照（离线兜底），字段对齐 UNS 表结构，保证取数口径一致。
 * 单据日期跨 2026-08-29 ~ 2026-10-30：一条完整的「上月（9 月）历史周期」+ 当前（10 月）在途周期，
 *   保证看板「上月 / 本月 / 本周」三个区间都有数据；9 月周期的销售订单锚点与 MES 完全对齐（下单 8/28 → 发货 9/15）。
 * 每条记录已补全通用字段（ID/ORG_ID/审计/DEL_FLAG/VER_NO/REMARK/EXT_JSON）。
 */
(function (root) {
  'use strict';
  var ORG = 'ORG1'; // 汽配一厂
  var n = 0;
  function id(p) { n++; return (p || 'ID') + String(200000 + n); }
  /* 主数据 / 配置类记录的落库日：APS 上线并首次同步 UNS 主数据（物料 / BOM / 工艺 / 设备 / 日历 / 字典…）。
   * 没有业务日期的记录才用它，避免全库几百条记录显示成同一秒创建。 */
  var MASTER_TIME = '2026-08-28 09:00:00';
  /* 让「创建 / 更新时间」跟随记录自身的业务日期：单据跟随单据日期、计算结果跟随计算时间、关联跟随流转时间。
   * 这样列表里看到的是「这条数据是什么时候因为什么业务产生的」，而不是全库一个时间戳。 */
  function bizTime(r) {
    var seq = ['GEN_TIME', 'CALC_TIME', 'MAKE_TIME', 'ADJ_TIME', 'OP_TIME', 'RUN_TIME', 'UPLOAD_TIME', 'LINK_TIME'];
    for (var i = 0; i < seq.length; i++) if (r[seq[i]]) return r[seq[i]];
    if (r.DOC_DATE) return r.DOC_DATE + ' 08:00:00';
    if (r.CHECK_DATE) return r.CHECK_DATE + ' 09:00:00';
    return '';
  }
  function base(extra) {
    var r = {
      ID: id('SEED'), ORG_ID: ORG, CREATE_BY: 'SYS', CREATE_TIME: MASTER_TIME,
      UPDATE_BY: null, UPDATE_TIME: null, DEL_FLAG: 0, VER_NO: 1, REMARK: '', EXT_JSON: null
    };
    if (extra) for (var k in extra) r[k] = extra[k];
    var st = bizTime(r);
    if (st) { r.CREATE_TIME = st; r.UPDATE_TIME = st; }
    return r;
  }
  /* 单据类记录：在 base 之上补 DOC 默认值（extra 可覆盖） */
  function doc(extra) {
    var r = base(extra);
    var dd = r.DOC_DATE || '2026-08-28';
    if (r.AUDIT_STATUS === undefined) r.AUDIT_STATUS = '已审核';
    if (r.AUDIT_BY === undefined) r.AUDIT_BY = '周杰';
    if (r.AUDIT_TIME === undefined) r.AUDIT_TIME = dd + ' 09:00:00';
    if (r.PRINT_TIMES === undefined) r.PRINT_TIMES = 0;
    if (r.ATTACH_URLS === undefined) r.ATTACH_URLS = null;
    if (r.MAKER === undefined) r.MAKER = '孙倩';
    if (r.MAKE_TIME === undefined) r.MAKE_TIME = dd + ' 08:30:00';
    return r;
  }
  var S = {};

  /* ==================================================================
   * ① 计划基础数据（BAS）
   * ================================================================== */
  /* 需求源：只保留「来自 MES」的需求 —— ① 销售订单（MES 销售订单明细，未交量>0）② 库存补充（可用库存/在途均取自 MES）。
   * ⚠️ 建单日不得早于 MES 销售订单日 2026-08-28（SO-2026-001 下单日 / 评审完成时点）。 */
  S.BAS_DEMAND = [
    /* —— 销售订单：随 MES 下达，逐条可对账 —— */
    doc({ DEMAND_NO: 'DEM-2026-0831', SOURCE_TYPE: '销售订单', SOURCE_NO: 'SO-2026-001', CUSTOMER_CODE: 'C001', PLAN_HORIZON: 60, FREEZE_FLAG: 1, FREEZE_DAYS: 7, FREEZE_UNTIL: '2026-09-07', APPROVE_BY: '周杰', DOC_TYPE: 'DEM', DOC_DATE: '2026-08-31', STATUS: '已生效' }),
    doc({ DEMAND_NO: 'DEM-2026-0928', SOURCE_TYPE: '销售订单', SOURCE_NO: 'SO-2026-002', CUSTOMER_CODE: 'C002', PLAN_HORIZON: 60, FREEZE_FLAG: 1, FREEZE_DAYS: 7, FREEZE_UNTIL: '2026-10-05', APPROVE_BY: '周杰', DOC_TYPE: 'DEM', DOC_DATE: '2026-09-28', STATUS: '已生效' }),
    /* —— 库存补充：可用库存(MES WM_STOCK) + 采购在途(MES 采购订单) 触发，不在 APS 凭空造需求 —— */
    doc({ DEMAND_NO: 'DEM-2026-0928-S', SOURCE_TYPE: '库存补充', SOURCE_NO: 'AUTO-2026-0928', CUSTOMER_CODE: '', PLAN_HORIZON: 30, FREEZE_FLAG: 0, DOC_TYPE: 'DEM', DOC_DATE: '2026-09-28', STATUS: '已生效' }),
    doc({ DEMAND_NO: 'DEM-2026-1005-S', SOURCE_TYPE: '库存补充', SOURCE_NO: 'AUTO-2026-1005', CUSTOMER_CODE: '', PLAN_HORIZON: 30, FREEZE_FLAG: 0, DOC_TYPE: 'DEM', DOC_DATE: '2026-10-05', STATUS: '已生效' })
  ];
  S.BAS_DEMAND_LINE = [
    /* ⓪ 上月（9 月）销售订单来源：SO-2026-001 前副车架 1000 件，要货日 = MES 销售订单交期 2026-09-30，
     *    生产按周分批投产（9/06、9/14、9/21 三周），9/23 全部完工入库 → 明细状态「已完成」。 */
    base({ DEMAND_NO: 'DEM-2026-0831', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', DEMAND_QTY: 1000, REQ_DATE: '2026-09-30', SRC_DOC_NO: 'SO-2026-001', LOCK_FLAG: 0, LINE_STATUS: '已完成' }),
    /* ① 销售订单来源：SO-2026-002 未交 800(悬置支架) + 500(后副车架)，逐条对账 MES 销售订单明细 */
    base({ DEMAND_NO: 'DEM-2026-0928', SEQ_NO: 1, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', DEMAND_QTY: 800, REQ_DATE: '2026-10-15', SRC_DOC_NO: 'SO-2026-002', LOCK_FLAG: 1, LINE_STATUS: '已锁定' }),
    base({ DEMAND_NO: 'DEM-2026-0928', SEQ_NO: 2, ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', DEMAND_QTY: 500, REQ_DATE: '2026-10-20', SRC_DOC_NO: 'SO-2026-002', LOCK_FLAG: 0, LINE_STATUS: '已生效' }),
    /* ② 库存补充（9/28 轮次）：只对**长周期件**（LONG_CYCLE_FLAG=1）按 min/max 补货 —— 可用量 < 下限即补到上限；
     *    需求日期 = 建单日 + 采购提前期(15 天)。M-BUSH-01 可用 3600 < 下限 4000 → 补 8000−3600 = 4400 → 10/13。
     *    可用库存取自 MES WM_STOCK（RF_STOCK 快照），口径与引擎 mrpAvail 一致。 */
    base({ DEMAND_NO: 'DEM-2026-0928-S', SEQ_NO: 1, ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', DEMAND_QTY: 4400, REQ_DATE: '2026-10-13', SRC_DOC_NO: 'AUTO-2026-0928', LOCK_FLAG: 0, LINE_STATUS: '已生效' }),
    /* ③ 库存补充（10/05 轮次）：M-BOLT-M12 可用 0 < 下限 15000 → 补 24000−0 = 24000 → 到货 10/20。
     *    MES WM_STOCK 中确无该品号库存记录（与 RF_STOCK 快照一致），故补到上限；采购提前期 15 天为长周期件。 */
    base({ DEMAND_NO: 'DEM-2026-1005-S', SEQ_NO: 1, ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', DEMAND_QTY: 24000, REQ_DATE: '2026-10-20', SRC_DOC_NO: 'AUTO-2026-1005', LOCK_FLAG: 0, LINE_STATUS: '已生效' })
  ];
  S.BAS_ITEM_PLAN_ATTR = [
    base({ ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', PLAN_TYPE: '自制', PRODUCE_LEAD_TIME: 15, PURCHASE_LEAD_TIME: 0, MIN_BATCH: 100, BATCH_MULTIPLE: 50, SCH_BATCH: 200, SAFETY_STOCK: 500, MIN_STOCK: 300, MAX_STOCK: 2000, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 0, SUBSTITUTE_RULE: '', DEFAULT_RES_GROUP: 'GRP-RBT', GROUP_CYCLE: 5, FROM_MES_FLAG: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', PLAN_TYPE: '自制', PRODUCE_LEAD_TIME: 15, PURCHASE_LEAD_TIME: 0, MIN_BATCH: 100, BATCH_MULTIPLE: 50, SCH_BATCH: 200, SAFETY_STOCK: 400, MIN_STOCK: 300, MAX_STOCK: 1500, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 0, DEFAULT_RES_GROUP: 'GRP-RBT', GROUP_CYCLE: 5, FROM_MES_FLAG: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', PLAN_TYPE: '自制', PRODUCE_LEAD_TIME: 8, PURCHASE_LEAD_TIME: 0, MIN_BATCH: 100, BATCH_MULTIPLE: 50, SCH_BATCH: 200, SAFETY_STOCK: 0, MIN_STOCK: 200, MAX_STOCK: 1200, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 0, DEFAULT_RES_GROUP: 'GRP-RBT', GROUP_CYCLE: 5, FROM_MES_FLAG: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', PLAN_TYPE: '自制', PRODUCE_LEAD_TIME: 3, PURCHASE_LEAD_TIME: 0, MIN_BATCH: 100, BATCH_MULTIPLE: 50, SCH_BATCH: 200, SAFETY_STOCK: 300, MIN_STOCK: 200, MAX_STOCK: 1200, KEY_ITEM_FLAG: 0, LONG_CYCLE_FLAG: 0, DEFAULT_RES_GROUP: 'GRP-RBT', GROUP_CYCLE: 5, FROM_MES_FLAG: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', PLAN_TYPE: '外购', PRODUCE_LEAD_TIME: 0, PURCHASE_LEAD_TIME: 7, MIN_BATCH: 5000, BATCH_MULTIPLE: 1000, SAFETY_STOCK: 8000, MIN_STOCK: 4000, MAX_STOCK: 60000, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 0, SUBSTITUTE_RULE: '指定供方不可替代', DEFAULT_RES_GROUP: '', GROUP_CYCLE: 10, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 7, MIN_BATCH: 2000, BATCH_MULTIPLE: 500, SAFETY_STOCK: 2000, MIN_STOCK: 1000, MAX_STOCK: 20000, KEY_ITEM_FLAG: 0, LONG_CYCLE_FLAG: 0, GROUP_CYCLE: 10, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 10, MIN_BATCH: 500, BATCH_MULTIPLE: 100, SAFETY_STOCK: 300, MIN_STOCK: 200, MAX_STOCK: 2000, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 0, GROUP_CYCLE: 15, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 5, MIN_BATCH: 200, BATCH_MULTIPLE: 50, SAFETY_STOCK: 400, MIN_STOCK: 300, MAX_STOCK: 3000, KEY_ITEM_FLAG: 0, LONG_CYCLE_FLAG: 0, GROUP_CYCLE: 10, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 15, MIN_BATCH: 2000, BATCH_MULTIPLE: 500, SAFETY_STOCK: 2000, MIN_STOCK: 4000, MAX_STOCK: 8000, KEY_ITEM_FLAG: 1, LONG_CYCLE_FLAG: 1, GROUP_CYCLE: 20, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 15, MIN_BATCH: 5000, BATCH_MULTIPLE: 1000, SAFETY_STOCK: 12000, MIN_STOCK: 15000, MAX_STOCK: 24000, KEY_ITEM_FLAG: 0, LONG_CYCLE_FLAG: 1, GROUP_CYCLE: 20, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', PLAN_TYPE: '外购', PURCHASE_LEAD_TIME: 5, MIN_BATCH: 10, BATCH_MULTIPLE: 5, SAFETY_STOCK: 20, MIN_STOCK: 10, MAX_STOCK: 200, KEY_ITEM_FLAG: 0, LONG_CYCLE_FLAG: 0, GROUP_CYCLE: 30, FROM_MES_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' })
  ];
  /* 排产资源：取 MES 汽配车间 6 区 17 台生产/检测设备，节拍与 MD_EQUIPMENT.STD_CYCLE_TIME 一致 */
  S.BAS_RESOURCE = [
    base({ RES_NO: 'CNC-001', RES_NAME: 'CNC-001 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-01', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'CNC-002', RES_NAME: 'CNC-002 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-02', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'CNC-003', RES_NAME: 'CNC-003 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-03', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'CNC-004', RES_NAME: 'CNC-004 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-04', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'CNC-005', RES_NAME: 'CNC-005 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-05', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'CNC-006', RES_NAME: 'CNC-006 立式数控加工中心', RES_TYPE: '机台', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_CYCLE: 180, STD_CAP: 160, SUPPORTED_STEP: '数控粗加工/数控精加工', LOCATION: '数控加工区-06', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'RBT-008', RES_NAME: 'RBT-008 六轴焊接机器人', RES_TYPE: '机台', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_CYCLE: 95, STD_CAP: 300, SUPPORTED_STEP: '机器人焊接', LOCATION: '机器人焊接区-01', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'RBT-009', RES_NAME: 'RBT-009 六轴焊接机器人', RES_TYPE: '机台', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_CYCLE: 95, STD_CAP: 300, SUPPORTED_STEP: '机器人焊接', LOCATION: '机器人焊接区-02', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'RBT-011', RES_NAME: 'RBT-011 六轴焊接机器人', RES_TYPE: '机台', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_CYCLE: 95, STD_CAP: 300, SUPPORTED_STEP: '机器人焊接', LOCATION: '机器人焊接区-03', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'RBT-012', RES_NAME: 'RBT-012 六轴焊接机器人', RES_TYPE: '机台', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_CYCLE: 95, STD_CAP: 300, SUPPORTED_STEP: '机器人焊接', LOCATION: '机器人焊接区-04', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'ASM-013', RES_NAME: 'ASM-013 滚筒装配输送线', RES_TYPE: '产线', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-ASM', STD_CYCLE: 60, STD_CAP: 480, SUPPORTED_STEP: '总成装配', LOCATION: '装配区-01', HOUR_MODE: '有限开放共享式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'ASM-016', RES_NAME: 'ASM-016 滚筒装配输送线', RES_TYPE: '产线', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-ASM', STD_CYCLE: 60, STD_CAP: 480, SUPPORTED_STEP: '总成装配', LOCATION: '装配区-02', HOUR_MODE: '有限开放共享式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'ASM-014', RES_NAME: 'ASM-014 自动拧紧机器人', RES_TYPE: '机台', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-TORK', STD_CYCLE: 45, STD_CAP: 640, SUPPORTED_STEP: '自动拧紧', LOCATION: '装配区-03', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'ASM-015', RES_NAME: 'ASM-015 自动拧紧机器人', RES_TYPE: '机台', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-TORK', STD_CYCLE: 45, STD_CAP: 640, SUPPORTED_STEP: '自动拧紧', LOCATION: '装配区-04', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'QMS-019', RES_NAME: 'QMS-019 三坐标精密测量机', RES_TYPE: '机台', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_CYCLE: 240, STD_CAP: 120, SUPPORTED_STEP: '三坐标检测', LOCATION: '检测区-01', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'QMS-020', RES_NAME: 'QMS-020 三坐标精密测量机', RES_TYPE: '机台', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_CYCLE: 240, STD_CAP: 120, SUPPORTED_STEP: '三坐标检测', LOCATION: '检测区-02', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RES_NO: 'QMS-021', RES_NAME: 'QMS-021 在线视觉检测站', RES_TYPE: '机台', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_CYCLE: 30, STD_CAP: 960, SUPPORTED_STEP: '在线视觉检测', LOCATION: '检测区-03', HOUR_MODE: '独占式', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' })
  ];
  S.BAS_RESOURCE_GROUP = [
    base({ GROUP_CODE: 'GRP-CNC', GROUP_NAME: '数控加工资源组(一工序多机)', WORK_CENTER: '数控加工区', MEMBER_RES: 'CNC-001,CNC-002,CNC-003,CNC-004,CNC-005,CNC-006', STEP_SCOPE: '数控粗加工/数控精加工', PRIORITY: 1, ENABLE_FLAG: 1 }),
    base({ GROUP_CODE: 'GRP-RBT', GROUP_NAME: '机器人焊接资源组', WORK_CENTER: '机器人焊接区', MEMBER_RES: 'RBT-008,RBT-009,RBT-011,RBT-012', STEP_SCOPE: '机器人焊接', PRIORITY: 1, ENABLE_FLAG: 1 }),
    base({ GROUP_CODE: 'GRP-ASM', GROUP_NAME: '总成装配资源组', WORK_CENTER: '动力总成装配区', MEMBER_RES: 'ASM-013,ASM-016', STEP_SCOPE: '总成装配', PRIORITY: 1, ENABLE_FLAG: 1 }),
    base({ GROUP_CODE: 'GRP-TORK', GROUP_NAME: '自动拧紧资源组', WORK_CENTER: '动力总成装配区', MEMBER_RES: 'ASM-014,ASM-015,ASM-017,ASM-018', STEP_SCOPE: '自动拧紧', PRIORITY: 1, ENABLE_FLAG: 1 }),
    base({ GROUP_CODE: 'GRP-QMS', GROUP_NAME: '精密检测资源组', WORK_CENTER: '精密检测区', MEMBER_RES: 'QMS-019,QMS-020,QMS-021,QMS-022', STEP_SCOPE: '三坐标检测/在线视觉检测', PRIORITY: 1, ENABLE_FLAG: 1 }),
    base({ GROUP_CODE: 'GRP-WH', GROUP_NAME: '入库上架资源组', WORK_CENTER: '智能仓储区', MEMBER_RES: 'WH-025,WH-026', STEP_SCOPE: '入库上架', PRIORITY: 1, ENABLE_FLAG: 1 })
  ];
  /* 换型矩阵：按 MES MD_STEP_EQUIP_CAP 的换型时间口径（CNC 25~30min、RBT 20min、ASM 15/10min） */
  S.BAS_CHANGEOVER = [
    base({ CV_ID: 'CV-0001', RES_GROUP: 'GRP-CNC', FROM_PRODUCT: 'P-SF-001', TO_PRODUCT: 'P-SF-002', CHANGE_MIN: 30, IS_WILDCARD: 0, SAME_SPEC_ZERO: 1, EXPR_FORMULA: '', ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0002', RES_GROUP: 'GRP-CNC', FROM_PRODUCT: 'P-SF-002', TO_PRODUCT: 'P-SF-001', CHANGE_MIN: 30, IS_WILDCARD: 0, SAME_SPEC_ZERO: 1, ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0003', RES_GROUP: 'GRP-CNC', FROM_PRODUCT: '*', TO_PRODUCT: 'P-MB-003', CHANGE_MIN: 25, IS_WILDCARD: 1, SAME_SPEC_ZERO: 1, ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0004', RES_GROUP: 'GRP-RBT', FROM_PRODUCT: 'P-SF-001', TO_PRODUCT: 'P-SF-002', CHANGE_MIN: 20, IS_WILDCARD: 0, SAME_SPEC_ZERO: 1, ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0005', RES_GROUP: 'GRP-RBT', FROM_PRODUCT: '*', TO_PRODUCT: 'P-MB-003', CHANGE_MIN: 20, IS_WILDCARD: 1, SAME_SPEC_ZERO: 1, ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0006', RES_GROUP: 'GRP-ASM', FROM_PRODUCT: '*', TO_PRODUCT: 'P-SF-001', CHANGE_MIN: 15, IS_WILDCARD: 1, SAME_SPEC_ZERO: 0, ENABLE_FLAG: 1 }),
    base({ CV_ID: 'CV-0007', RES_GROUP: 'GRP-TORK', FROM_PRODUCT: '*', TO_PRODUCT: 'P-SF-001', CHANGE_MIN: 10, IS_WILDCARD: 1, SAME_SPEC_ZERO: 0, ENABLE_FLAG: 1 })
  ];
  /* 工厂日历（班次日历）：自 APS 上线日 8/28 起逐日维护到 10/31，常规为「周一至周六 · 白班 08:00-16:00 + 中班 16:00-24:00」双班制，
   * 周日休班；叠加例外：9/6 周日赶 SO-2026-001 交期开双班加班、10/1~10/3 国庆停产。
   * ⚠️ 排程引擎按「资源 > 工作中心 > 工厂」三级取日历，取不到才用「缺省双班」兜底 —— 所以把日历铺满是「有限产能」算得准的前提。 */
  S.BAS_CALENDAR = (function () {
    var out = [], p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    var ds = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
    var HOLIDAY = { '2026-10-01': 1, '2026-10-02': 1, '2026-10-03': 1 };   /* 国庆停产 */
    var OT = { '2026-09-06': 1 };                                           /* 周日加班赶交期 */
    var d = new Date(2026, 7, 28), end = new Date(2026, 9, 31);
    while (d.getTime() <= end.getTime()) {
      var k = ds(d), dow = d.getDay(), nx = ds(new Date(d.getTime() + 86400000)), tag = k.slice(5).replace('-', '');
      if (HOLIDAY[k]) {
        out.push(base({ CAL_ID: 'CAL-F-' + tag + '-H', CAL_LEVEL: '工厂', OWNER_CODE: ORG, WORK_DATE: k, SHIFT: '白班', WORK_START: '', WORK_END: '', CAP_HOURS: 0, IS_HOLIDAY: 1, IS_OVERTIME: 0, ENABLE_FLAG: 1 }));
      } else if (dow !== 0 || OT[k]) {
        var ot = (dow === 0 && OT[k]) ? 1 : 0;
        out.push(base({ CAL_ID: 'CAL-F-' + tag + '-D', CAL_LEVEL: '工厂', OWNER_CODE: ORG, WORK_DATE: k, SHIFT: '白班', WORK_START: k + ' 08:00:00', WORK_END: k + ' 16:00:00', CAP_HOURS: 8, IS_HOLIDAY: 0, IS_OVERTIME: ot, ENABLE_FLAG: 1 }));
        out.push(base({ CAL_ID: 'CAL-F-' + tag + '-M', CAL_LEVEL: '工厂', OWNER_CODE: ORG, WORK_DATE: k, SHIFT: '中班', WORK_START: k + ' 16:00:00', WORK_END: nx + ' 00:00:00', CAP_HOURS: 8, IS_HOLIDAY: 0, IS_OVERTIME: ot, ENABLE_FLAG: 1 }));
      }
      d = new Date(d.getTime() + 86400000);
    }
    /* 工作中心 / 资源级例外：数控加工区、机器人焊接区 9/28 全员白班；CNC-001 9/29 只开白班 */
    out.push(base({ CAL_ID: 'CAL-W-928-D', CAL_LEVEL: '工作中心', OWNER_CODE: '数控加工区', WORK_DATE: '2026-09-28', SHIFT: '白班', WORK_START: '2026-09-28 08:00:00', WORK_END: '2026-09-28 16:00:00', CAP_HOURS: 8, IS_HOLIDAY: 0, IS_OVERTIME: 0, ENABLE_FLAG: 1 }));
    out.push(base({ CAL_ID: 'CAL-W-928-RBT', CAL_LEVEL: '工作中心', OWNER_CODE: '机器人焊接区', WORK_DATE: '2026-09-28', SHIFT: '白班', WORK_START: '2026-09-28 08:00:00', WORK_END: '2026-09-28 16:00:00', CAP_HOURS: 8, IS_HOLIDAY: 0, IS_OVERTIME: 0, ENABLE_FLAG: 1 }));
    out.push(base({ CAL_ID: 'CAL-R-929-D', CAL_LEVEL: '资源', OWNER_CODE: 'CNC-001', WORK_DATE: '2026-09-29', SHIFT: '白班', WORK_START: '2026-09-29 08:00:00', WORK_END: '2026-09-29 16:00:00', CAP_HOURS: 8, IS_HOLIDAY: 0, IS_OVERTIME: 0, ENABLE_FLAG: 1 }));
    return out;
  })();
  S.BAS_MAINTENANCE = [
    base({ OCCUPY_NO: 'MT-0001', RES_NO: 'CNC-006', OCCUPY_TYPE: '保养', START_TIME: '2026-09-29 08:00:00', END_TIME: '2026-09-29 12:00:00', SOURCE_SYS: 'MES', STATUS: '已计划' }),
    base({ OCCUPY_NO: 'MT-0002', RES_NO: 'QMS-020', OCCUPY_TYPE: '维修', START_TIME: '2026-09-28 14:00:00', END_TIME: '2026-09-28 16:00:00', SOURCE_SYS: 'MES', STATUS: '执行中' })
  ];

  /* ==================================================================
   * ② 物料需求计算（MRP）
   * ================================================================== */
  /* 需求计算版本按**周**节奏跑：APS 上线后自 8/31（第一个滚动日）起，每个**周一**跑一次
   * （确认需求源 → 选排程规则 → 跑一次计算），平级产出净需求 / 齐套 / 补料建议 / 生产建议。
   * ⚠️ 批次之间不是逐级流转，而是「同一条计算链在不同时点各留一份快照」；同一批需求源会在多轮版本里被反复重算。
   * 8/31（首版全量）→ 9/07、9/14、9/21（周滚动复核，多数物料无需补充）→ 9/28（SO-2026-002 下达，全量重算）
   * → 10/05（库存补充轮次 + 月度复核）→ 10/12（本周滚动，最新一版）。 */
  S.MRP_BATCH = [
    base({ BATCH_NO: 'MRP-2026-0831', BATCH_TYPE: '全量', RULE_NO: 'RULE-01', CALC_TIME: '2026-08-31 09:20:00', CALC_BY: '孙倩', REQ_ROWS: 1, NET_ROWS: 6, DURATION_SEC: 12.7, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20260831-00' }),
    base({ BATCH_NO: 'MRP-2026-0907', BATCH_TYPE: '试算', RULE_NO: 'RULE-01', CALC_TIME: '2026-09-07 09:05:00', CALC_BY: '孙倩', REQ_ROWS: 1, NET_ROWS: 2, DURATION_SEC: 9.3, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20260907-00' }),
    base({ BATCH_NO: 'MRP-2026-0914', BATCH_TYPE: '试算', RULE_NO: 'RULE-02', CALC_TIME: '2026-09-14 09:00:00', CALC_BY: '孙倩', REQ_ROWS: 1, NET_ROWS: 2, DURATION_SEC: 8.1, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20260914-00' }),
    base({ BATCH_NO: 'MRP-2026-0921', BATCH_TYPE: '试算', RULE_NO: 'RULE-01', CALC_TIME: '2026-09-21 09:15:00', CALC_BY: '孙倩', REQ_ROWS: 1, NET_ROWS: 1, DURATION_SEC: 7.4, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20260921-00' }),
    base({ BATCH_NO: 'MRP-2026-0928', BATCH_TYPE: '全量', RULE_NO: 'RULE-01', CALC_TIME: '2026-09-28 09:20:00', CALC_BY: '孙倩', REQ_ROWS: 3, NET_ROWS: 5, DURATION_SEC: 31.4, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20260928-01' }),
    base({ BATCH_NO: 'MRP-2026-1005', BATCH_TYPE: '全量', RULE_NO: 'RULE-02', CALC_TIME: '2026-10-05 09:10:00', CALC_BY: '孙倩', REQ_ROWS: 1, NET_ROWS: 1, DURATION_SEC: 9.4, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20261005-00' }),
    base({ BATCH_NO: 'MRP-2026-1012', BATCH_TYPE: '全量', RULE_NO: 'RULE-03', CALC_TIME: '2026-10-12 08:30:00', CALC_BY: '孙倩', REQ_ROWS: 2, NET_ROWS: 3, DURATION_SEC: 11.6, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-20261012-00' })
  ];
  /* 净需求：按低阶码逐层展开（LEVEL 1 = 成品/独立需求；LEVEL 2 = 焊接分总成/直用原料；LEVEL 3 = 分总成下阶原料）
   * 口径：毛需求 = 独立需求 + 上层相关需求；净需求 = 毛需求 + 安全库存 − 可用库存 − 在制(WIP) − 采购在途 */
  S.MRP_NET_REQ = [
    /* ================= 上月（9 月）批次 MRP-2026-0901 =================
     * 输入：DEM-2026-0831 明细分销订单 SO-2026-001 的 1000 件 P-SF-001。
     * 上月版本按**倒排**：成品要货日 9/15 → 按生产提前期倒推投产/投料日 9/05，
     * 故本批净需求行的「需求日期」统一落在 2026-09-05（与 MES 请购单 PR-2026-0001/0003 的需求日 9/05 一致）。
     * 备料口径（9/1 时点快照，与 10 月当前快照 RF_STOCK 不同属正常）：
     *   P-SF-001 可用 500 / M-BUSH-01 可用 6000 / M-BOLT-M12 可用 25000 / M-Q345B 可用 7000 / M-WIRE-ER50 可用 900。
     * ⭐ 对账锚点：M-Q345B 调整后 19000 = MES 请购单 PR-2026-0001 的 19000 kg。 */
    base({ NET_ID: 'NR-0831-01', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 1, SAFE_STOCK: 500, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ITEM_TYPE: '自制', PARENT_ITEM: '', BOM_VER: 'V2', GROSS_QTY: 1000, AVAIL_STOCK: 500, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 1000, ADJ_QTY: 1000, REQ_DATE: '2026-09-05', SUGGEST_DATE: '2026-09-05', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-0831-02', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 2, SAFE_STOCK: 300, ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', ITEM_TYPE: '自制', PARENT_ITEM: 'P-SF-001', BOM_VER: 'V2', GROSS_QTY: 1000, AVAIL_STOCK: 0, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 1300, ADJ_QTY: 1300, REQ_DATE: '2026-09-05', SUGGEST_DATE: '2026-09-05', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-0831-03', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 2, SAFE_STOCK: 2000, ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', ITEM_TYPE: '外购', PARENT_ITEM: 'P-SF-001', BOM_VER: 'V2', GROSS_QTY: 4000, AVAIL_STOCK: 6000, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-05', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0831-04', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 2, SAFE_STOCK: 12000, ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', ITEM_TYPE: '外购', PARENT_ITEM: 'P-SF-001', BOM_VER: 'V2', GROSS_QTY: 12240, AVAIL_STOCK: 25000, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-05', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0831-05', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 3, SAFE_STOCK: 8000, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 17850, AVAIL_STOCK: 7000, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 18850, ADJ_QTY: 19000, REQ_DATE: '2026-09-05', SUGGEST_DATE: '2026-08-29', STATUS: '已转补料' }),
    base({ NET_ID: 'NR-0831-06', BATCH_NO: 'MRP-2026-0831', LEVEL_NO: 3, SAFE_STOCK: 400, ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 432, AVAIL_STOCK: 900, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-05', SUGGEST_DATE: '', STATUS: '无需补充' }),
    /* —— 同批次内的线边叫料（DEM-2026-0831-K，要货 9/04） —— */
    /* ================= 9 月周批次：看板叫料（原料独立需求，无下阶爆炸） =================
     * 备料快照随周推进（每周计算时点的实际可用量，故逐周不同）：
     *   M-Q345B（钢板）：9/3 PO-2026-0001 到货 19000 → SO-001 消耗 17850 → 9/21 起约 8150；
     *   M-WIRE-ER50（焊丝）：期初 900 − SO-001 消耗 432 = 468，再加每周叫料到货（150/200/220）→ 618 / 818 / 1038，
     *     始终未跌破安全库存 400，故 9 月焊丝全部「无需补充」（净需求 0），采购只发生在钢板。 */
    /* —— LEVEL 1：独立需求（销售订单/预测/叫料/库存补充） —— */
    base({ NET_ID: 'NR-0928-01', BATCH_NO: 'MRP-2026-0928', LEVEL_NO: 1, SAFE_STOCK: 0, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', ITEM_TYPE: '自制', PARENT_ITEM: '', BOM_VER: 'V1', GROSS_QTY: 800, AVAIL_STOCK: 790, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 10, ADJ_QTY: 100, REQ_DATE: '2026-10-15', SUGGEST_DATE: '2026-10-07', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-0928-02', BATCH_NO: 'MRP-2026-0928', LEVEL_NO: 1, SAFE_STOCK: 400, ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', ITEM_TYPE: '自制', PARENT_ITEM: '', BOM_VER: 'V1', GROSS_QTY: 500, AVAIL_STOCK: 500, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 400, ADJ_QTY: 400, REQ_DATE: '2026-10-20', SUGGEST_DATE: '2026-10-05', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-0928-07', BATCH_NO: 'MRP-2026-0928', LEVEL_NO: 1, SAFE_STOCK: 2000, ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', ITEM_TYPE: '外购', PARENT_ITEM: '', BOM_VER: '', GROSS_QTY: 4400, AVAIL_STOCK: 3600, WIP_QTY: 0, ON_ORDER_QTY: 16000, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-10-13', SUGGEST_DATE: '', STATUS: '无需补充' }),
    /* —— LEVEL 2：P-SF-001 下阶（相关需求） —— */
    base({ NET_ID: 'NR-0928-09', BATCH_NO: 'MRP-2026-0928', LEVEL_NO: 2, SAFE_STOCK: 300, ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', ITEM_TYPE: '外购', PARENT_ITEM: 'P-MB-003', BOM_VER: 'V1', GROSS_QTY: 101, AVAIL_STOCK: 88, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 313, ADJ_QTY: 500, REQ_DATE: '2026-10-12', SUGGEST_DATE: '2026-10-02', STATUS: '已转补料' }),
    /* —— P-SF-002 下阶原料（钢板/钢管/焊丝） —— */
    base({ NET_ID: 'NR-0928-10', BATCH_NO: 'MRP-2026-0928', LEVEL_NO: 2, SAFE_STOCK: 2000, ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', ITEM_TYPE: '外购', PARENT_ITEM: 'P-SF-002', BOM_VER: 'V1', GROSS_QTY: 3255, AVAIL_STOCK: 4900, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 355, ADJ_QTY: 2000, REQ_DATE: '2026-10-15', SUGGEST_DATE: '2026-10-08', STATUS: '已转补料' }),
    /* —— LEVEL 3：焊接分总成下阶原料（钢板/焊丝，按低阶码归到最底层集中算） —— */
    /* ================= 本月（10 月）批次 MRP-2026-1005：10/05 叫料 + 10/05 库存补充轮次 ================= */
    base({ NET_ID: 'NR-1005-03', BATCH_NO: 'MRP-2026-1005', LEVEL_NO: 1, SAFE_STOCK: 12000, ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', ITEM_TYPE: '外购', PARENT_ITEM: '', BOM_VER: '', GROSS_QTY: 24000, AVAIL_STOCK: 0, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 36000, ADJ_QTY: 36000, REQ_DATE: '2026-10-08', SUGGEST_DATE: '2026-10-05', STATUS: '已转补料' }),
    /* ================= 9 月第 3、4 周的周滚动复核（MRP-2026-0907 / 0914 / 0921）=================
     * 每周一跑一次计算链：SO-2026-001 的物料 9/3 已到货齐全，逐周滚动复核多为「无需补充」，
     * 只有钢板（M-Q345B）与焊丝需要按周确认可用量 —— 这正是「滚动」的意义：算过还要再算。 */
    base({ NET_ID: 'NR-0907-01', BATCH_NO: 'MRP-2026-0907', LEVEL_NO: 3, SAFE_STOCK: 8000, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 3570, AVAIL_STOCK: 8150, WIP_QTY: 0, ON_ORDER_QTY: 3500, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-14', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0907-02', BATCH_NO: 'MRP-2026-0907', LEVEL_NO: 3, SAFE_STOCK: 400, ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 86, AVAIL_STOCK: 618, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-14', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0914-01', BATCH_NO: 'MRP-2026-0914', LEVEL_NO: 2, SAFE_STOCK: 300, ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', ITEM_TYPE: '自制', PARENT_ITEM: 'P-SF-001', BOM_VER: 'V2', GROSS_QTY: 200, AVAIL_STOCK: 260, WIP_QTY: 0, ON_ORDER_QTY: 300, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-14', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0914-02', BATCH_NO: 'MRP-2026-0914', LEVEL_NO: 3, SAFE_STOCK: 8000, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 3570, AVAIL_STOCK: 8150, WIP_QTY: 0, ON_ORDER_QTY: 3500, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-21', SUGGEST_DATE: '', STATUS: '无需补充' }),
    base({ NET_ID: 'NR-0921-01', BATCH_NO: 'MRP-2026-0921', LEVEL_NO: 3, SAFE_STOCK: 8000, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ITEM_TYPE: '外购', PARENT_ITEM: 'M-SF-WELD', BOM_VER: 'V2', GROSS_QTY: 1785, AVAIL_STOCK: 8150, WIP_QTY: 0, ON_ORDER_QTY: 1800, NET_QTY: 0, ADJ_QTY: 0, REQ_DATE: '2026-09-21', SUGGEST_DATE: '', STATUS: '无需补充' }),
    /* ================= 10/12 本周滚动（MRP-2026-1012）：10 月两张工单齐套复核 ================= */
    base({ NET_ID: 'NR-1012-01', BATCH_NO: 'MRP-2026-1012', LEVEL_NO: 1, SAFE_STOCK: 0, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', ITEM_TYPE: '自制', PARENT_ITEM: '', BOM_VER: 'V1', GROSS_QTY: 800, AVAIL_STOCK: 790, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 10, ADJ_QTY: 100, REQ_DATE: '2026-10-15', SUGGEST_DATE: '2026-10-12', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-1012-02', BATCH_NO: 'MRP-2026-1012', LEVEL_NO: 1, SAFE_STOCK: 400, ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', ITEM_TYPE: '自制', PARENT_ITEM: '', BOM_VER: 'V1', GROSS_QTY: 500, AVAIL_STOCK: 500, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 400, ADJ_QTY: 400, REQ_DATE: '2026-10-20', SUGGEST_DATE: '2026-10-12', STATUS: '已转计划建议' }),
    base({ NET_ID: 'NR-1012-03', BATCH_NO: 'MRP-2026-1012', LEVEL_NO: 2, SAFE_STOCK: 2000, ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', ITEM_TYPE: '外购', PARENT_ITEM: 'P-SF-002', BOM_VER: 'V1', GROSS_QTY: 3255, AVAIL_STOCK: 4900, WIP_QTY: 0, ON_ORDER_QTY: 0, NET_QTY: 355, ADJ_QTY: 2000, REQ_DATE: '2026-10-15', SUGGEST_DATE: '2026-10-08', STATUS: '已转补料' })
  ];
  S.MRP_KIT_CHECK = [
    /* —— 上月（9 月）齐套检查：9/02 首检时钢板（PO-2026-0001，9/3 到货）未入库 → 缺料；9/03 到货后复检基本齐套 —— */
    base({ CHECK_NO: 'KIT-2026-0831-A', BATCH_NO: 'MRP-2026-0831', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-02', ORDER_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', LEVEL_NO: 1, DEMAND_QTY: 1000, KIT_QTY: 400, SHORT_QTY: 600, KIT_RATE: 0.4, KIT_DATE: '2026-09-05', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-0831-B', BATCH_NO: 'MRP-2026-0831', CHECK_TYPE: '整单', CHECK_DATE: '2026-09-02', ORDER_NO: 'WO-2026-0001', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', LEVEL_NO: 2, DEMAND_QTY: 200, KIT_QTY: 200, SHORT_QTY: 0, KIT_RATE: 1, KIT_DATE: '2026-09-05', KEY_ITEM_FLAG: 0, PERIOD_TYPE: '按周', STATUS: '已齐套' }),
    base({ CHECK_NO: 'KIT-2026-0831-C', BATCH_NO: 'MRP-2026-0831', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-03', ORDER_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', LEVEL_NO: 1, DEMAND_QTY: 1000, KIT_QTY: 990, SHORT_QTY: 10, KIT_RATE: 0.99, KIT_DATE: '2026-09-10', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-0928-A', BATCH_NO: 'MRP-2026-0928', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-28', ORDER_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', LEVEL_NO: 1, DEMAND_QTY: 800, KIT_QTY: 790, SHORT_QTY: 10, KIT_RATE: 0.9875, KIT_DATE: '2026-10-14', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-0928-B', BATCH_NO: 'MRP-2026-0928', CHECK_TYPE: '整单', CHECK_DATE: '2026-09-28', ORDER_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', LEVEL_NO: 1, DEMAND_QTY: 500, KIT_QTY: 200, SHORT_QTY: 300, KIT_RATE: 0.4, KIT_DATE: '2026-10-18', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-0928-C', BATCH_NO: 'MRP-2026-0928', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-28', ORDER_NO: 'WO-2026-0007', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', LEVEL_NO: 2, DEMAND_QTY: 500, KIT_QTY: 500, SHORT_QTY: 0, KIT_RATE: 1, KIT_DATE: '2026-10-15', KEY_ITEM_FLAG: 0, PERIOD_TYPE: '按周', STATUS: '已齐套' }),
    /* —— 9 月每周齐套滚动检查 + 10 月首周滚动检查（保证每周都有齐套数据） —— */
    base({ CHECK_NO: 'KIT-2026-0908-A', BATCH_NO: 'MRP-2026-0831', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-08', ORDER_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', LEVEL_NO: 1, DEMAND_QTY: 1000, KIT_QTY: 850, SHORT_QTY: 150, KIT_RATE: 0.85, KIT_DATE: '2026-09-10', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-1006-A', BATCH_NO: 'MRP-2026-1005', CHECK_TYPE: '按订单', CHECK_DATE: '2026-10-06', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', LEVEL_NO: 1, DEMAND_QTY: 800, KIT_QTY: 624, SHORT_QTY: 176, KIT_RATE: 0.78, KIT_DATE: '2026-10-14', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按周', STATUS: '存在缺料' }),
    base({ CHECK_NO: 'KIT-2026-1013-A', BATCH_NO: 'MRP-2026-1005', CHECK_TYPE: '按订单', CHECK_DATE: '2026-10-13', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', LEVEL_NO: 1, DEMAND_QTY: 800, KIT_QTY: 680, SHORT_QTY: 120, KIT_RATE: 0.85, KIT_DATE: '2026-10-14', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按周', STATUS: '存在缺料' }),
    /* —— 9 月第 3、4 周 + 10 月第 2 周的滚动齐套检查（与当周排程版本同周，体现「每周一检」） —— */
    base({ CHECK_NO: 'KIT-2026-0914-A', BATCH_NO: 'MRP-2026-0914', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-14', ORDER_NO: 'WO-2026-0005', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', LEVEL_NO: 1, DEMAND_QTY: 200, KIT_QTY: 200, SHORT_QTY: 0, KIT_RATE: 1, KIT_DATE: '2026-09-21', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按周', STATUS: '已齐套' }),
    base({ CHECK_NO: 'KIT-2026-0921-A', BATCH_NO: 'MRP-2026-0921', CHECK_TYPE: '按订单', CHECK_DATE: '2026-09-21', ORDER_NO: 'WO-2026-0005', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', LEVEL_NO: 1, DEMAND_QTY: 200, KIT_QTY: 200, SHORT_QTY: 0, KIT_RATE: 1, KIT_DATE: '2026-09-21', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按周', STATUS: '已齐套' }),
    base({ CHECK_NO: 'KIT-2026-1012-A', BATCH_NO: 'MRP-2026-1012', CHECK_TYPE: '按订单', CHECK_DATE: '2026-10-12', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', LEVEL_NO: 1, DEMAND_QTY: 800, KIT_QTY: 690, SHORT_QTY: 110, KIT_RATE: 0.8625, KIT_DATE: '2026-10-14', KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按周', STATUS: '存在缺料' })
  ];
  S.MRP_KIT_SHORT = [
    /* —— 上月（9 月）缺料明细：钢板 9/3 到货即解阻断；10 件焊缝返工/报废缺口由成品复检带出 —— */
    base({ SHORT_ID: 'SH-2026-0831-01', CHECK_NO: 'KIT-2026-0831-A', ORDER_NO: 'SO-2026-001', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SHORT_QTY: 18850, REQ_DATE: '2026-09-05', RECOVER_DATE: '2026-09-03', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    base({ SHORT_ID: 'SH-2026-0831-02', CHECK_NO: 'KIT-2026-0831-A', ORDER_NO: 'SO-2026-001', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', SHORT_QTY: 1300, REQ_DATE: '2026-09-05', RECOVER_DATE: '2026-09-05', SUPPLY_TYPE: '自制补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    base({ SHORT_ID: 'SH-2026-0831-03', CHECK_NO: 'KIT-2026-0831-C', ORDER_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SHORT_QTY: 10, REQ_DATE: '2026-09-30', RECOVER_DATE: '2026-09-10', SUPPLY_TYPE: '自制补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 0, STATUS: '记录缺口' }),
    base({ SHORT_ID: 'SH-2026-0928-01', CHECK_NO: 'KIT-2026-0928-B', ORDER_NO: 'SO-2026-002', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SHORT_QTY: 12400, REQ_DATE: '2026-10-17', RECOVER_DATE: '2026-10-10', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    base({ SHORT_ID: 'SH-2026-0928-02', CHECK_NO: 'KIT-2026-0928-B', ORDER_NO: 'SO-2026-002', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SHORT_QTY: 355, REQ_DATE: '2026-10-15', RECOVER_DATE: '2026-10-08', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 0, BLOCK_FLAG: 0, STATUS: '记录缺口' }),
    base({ SHORT_ID: 'SH-2026-0928-03', CHECK_NO: 'KIT-2026-0928-A', ORDER_NO: 'SO-2026-002', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SHORT_QTY: 413, REQ_DATE: '2026-10-12', RECOVER_DATE: '2026-10-02', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    /* —— 9 月每周 + 10 月首周缺料（按周滚动，需求日落在各周） —— */
    base({ SHORT_ID: 'SH-2026-0908-01', CHECK_NO: 'KIT-2026-0908-A', ORDER_NO: 'SO-2026-001', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', SHORT_QTY: 150, REQ_DATE: '2026-09-10', RECOVER_DATE: '2026-09-10', SUPPLY_TYPE: '自制补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 0, STATUS: '记录缺口' }),
    base({ SHORT_ID: 'SH-2026-1006-01', CHECK_NO: 'KIT-2026-1006-A', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SHORT_QTY: 2400, REQ_DATE: '2026-10-08', RECOVER_DATE: '2026-10-10', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    base({ SHORT_ID: 'SH-2026-1013-01', CHECK_NO: 'KIT-2026-1013-A', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SHORT_QTY: 120, REQ_DATE: '2026-10-13', RECOVER_DATE: '2026-10-12', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 1, STATUS: '阻断预警' }),
    /* —— 10 月第 2 周滚动检查带出的缺料（冲压毛坯在途 500 件 10/12 部分到货，仍差 110 件） —— */
    base({ SHORT_ID: 'SH-2026-1012-01', CHECK_NO: 'KIT-2026-1012-A', ORDER_NO: 'WO-2026-0006', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SHORT_QTY: 110, REQ_DATE: '2026-10-15', RECOVER_DATE: '2026-10-13', SUPPLY_TYPE: '采购补料', KEY_ITEM_FLAG: 1, BLOCK_FLAG: 0, STATUS: '记录缺口' })
  ];
  /* 补料建议按**批次计算日**归属区间（驾驶舱口径）：每周批次都会带出 1~2 条采购补料建议。 */
  S.PR_SUGGEST = [
    /* —— 9 月 —— */
    doc({ PR_NO: 'PR-2026-0001', BATCH_NO: 'MRP-2026-0831', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ITEM_TYPE: '外购', NET_QTY: 19000, REQ_DATE: '2026-09-05', SUGGEST_DATE: '2026-08-29', SUGGEST_SUPPLIER: 'S001', CONFIRM_BY: '孙倩', CONFIRM_TIME: '2026-08-29 15:20:00', LINK_PR_NO: 'PO-2026-0001', DOC_TYPE: 'PR', DOC_DATE: '2026-08-29', STATUS: '已流转MES' }),
    /* —— 10 月 —— */
    doc({ PR_NO: 'PR-2026-0006', BATCH_NO: 'MRP-2026-0928', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', ITEM_TYPE: '外购', NET_QTY: 500, REQ_DATE: '2026-10-12', SUGGEST_DATE: '2026-10-02', SUGGEST_SUPPLIER: 'S002', CONFIRM_BY: '', CONFIRM_TIME: null, LINK_PR_NO: '', DOC_TYPE: 'PR', DOC_DATE: '2026-10-02', STATUS: '待确认' }),
    doc({ PR_NO: 'PR-2026-0007', BATCH_NO: 'MRP-2026-1005', ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', ITEM_TYPE: '外购', NET_QTY: 36000, REQ_DATE: '2026-10-20', SUGGEST_DATE: '2026-10-05', SUGGEST_SUPPLIER: 'S004', CONFIRM_BY: '孙倩', CONFIRM_TIME: '2026-10-05 15:20:00', LINK_PR_NO: 'PR-MES-2026-0002', DOC_TYPE: 'PR', DOC_DATE: '2026-10-05', STATUS: '已流转MES' }),
  ];
  S.PP_PLAN_SUGGEST = [
    /* —— 上月（9 月）：P-SF-001 1000 件（交期 9/30）已下达至 MES 主生产计划 MP-2026-09-01，
     *    按周分批投产（9/06、9/14、9/21 三周），9/23 全部完工入库 —— */
    doc({ SUGGEST_NO: 'PS-2026-0001', BATCH_NO: 'MRP-2026-0831', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', NET_QTY: 1000, SUGGEST_START: '2026-09-06', SUGGEST_END: '2026-09-23', REQ_DATE: '2026-09-30', LINK_PLAN_NO: 'MP-2026-09-01', DOC_TYPE: 'PS', DOC_DATE: '2026-08-31', STATUS: '已转排程' }),
    doc({ SUGGEST_NO: 'PS-2026-0002', BATCH_NO: 'MRP-2026-0831', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', NET_QTY: 1300, SUGGEST_START: '2026-09-05', SUGGEST_END: '2026-09-06', REQ_DATE: '2026-09-05', LINK_PLAN_NO: '', DOC_TYPE: 'PS', DOC_DATE: '2026-08-31', STATUS: '已转排程' }),
    /* —— 本月（10 月）—— */
    doc({ SUGGEST_NO: 'PS-2026-0004', BATCH_NO: 'MRP-2026-0928', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', NET_QTY: 400, SUGGEST_START: '2026-10-05', SUGGEST_END: '2026-10-20', REQ_DATE: '2026-10-20', LINK_PLAN_NO: '', DOC_TYPE: 'PS', DOC_DATE: '2026-10-05', STATUS: '已转排程' }),
  ];

  /* ==================================================================
   * ③ 生产排程（SCH）
   * ================================================================== */
  S.SCH_RULE = [
    base({ RULE_NO: 'RULE-01', RULE_NAME: '交期优先·换型最小', ORDER_SORT: '交期优先→冻结优先', RES_SELECT: '换型最小化', OPT_TARGET: '任务延期最小化', FINITE_CAP: 1, SCH_DIR: '正排', BOTTLENECK_STEP: '机器人焊接', TRANSFER_BATCH: 50, KIT_CONSTRAINT: 1, FREEZE_FIRST: 1, IS_DEFAULT: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RULE_NO: 'RULE-02', RULE_NAME: '同规格聚簇·负载均衡', ORDER_SORT: '同规格聚簇→交期优先', RES_SELECT: '负载均衡', OPT_TARGET: '设置时间最小化', FINITE_CAP: 1, SCH_DIR: '正排', BOTTLENECK_STEP: '', TRANSFER_BATCH: 50, KIT_CONSTRAINT: 0, FREEZE_FIRST: 0, IS_DEFAULT: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ RULE_NO: 'RULE-03', RULE_NAME: '瓶颈前倒排·后正排', ORDER_SORT: '交期优先', RES_SELECT: '节拍最快', OPT_TARGET: '在制品最小化', FINITE_CAP: 1, SCH_DIR: '双向', BOTTLENECK_STEP: '机器人焊接', TRANSFER_BATCH: 30, KIT_CONSTRAINT: 1, FREEZE_FIRST: 1, IS_DEFAULT: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' })
  ];
  S.SCH_VERSION = [
    /* 排程版本 = 「每周一滚动重排」的产物：每版都用**当周生效的排程规则**把当时已下达的工单重排一遍
     * （已完工的工序锁定、其余重排），所以版本号里的日期 = 生成日，版本区间跨当周与次周。
     *   8/31 ~ 9/21 四版 → 9 月历史周期（WO-2026-0001~0005 分三周投产，任务全部已完工）；
     *   9/28 ~ 10/12 三版 → 10 月在途周期（WO-2026-0006/0007）；其中 10/12 那版是当前生效、尚未发布的一版。 */
    doc({ VERSION_NO: 'SCHV-2026-0831-A', RULE_NO: 'RULE-01', VERSION_TYPE: '日排产', RANGE_FROM: '2026-09-06', RANGE_TO: '2026-09-23', GEN_TIME: '2026-08-31 08:40:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-08-31 09:20:00', PUBLISH_BY: '周杰', TOTAL_TASK: 35, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.0764, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-08-31', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-0907-A', RULE_NO: 'RULE-01', VERSION_TYPE: '日排产', RANGE_FROM: '2026-09-14', RANGE_TO: '2026-09-23', GEN_TIME: '2026-09-07 08:30:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-09-07 09:10:00', PUBLISH_BY: '周杰', TOTAL_TASK: 21, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.1009, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-09-07', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-0914-A', RULE_NO: 'RULE-02', VERSION_TYPE: '日排产', RANGE_FROM: '2026-09-21', RANGE_TO: '2026-09-23', GEN_TIME: '2026-09-14 08:30:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-09-14 09:10:00', PUBLISH_BY: '周杰', TOTAL_TASK: 7, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.2245, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-09-14', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-0921-A', RULE_NO: 'RULE-01', VERSION_TYPE: '日排产', RANGE_FROM: '2026-09-21', RANGE_TO: '2026-09-23', GEN_TIME: '2026-09-21 08:30:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-09-21 09:10:00', PUBLISH_BY: '周杰', TOTAL_TASK: 7, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.2245, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-09-21', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-0928-A', RULE_NO: 'RULE-01', VERSION_TYPE: '日排产', RANGE_FROM: '2026-10-15', RANGE_TO: '2026-10-28', GEN_TIME: '2026-09-28 07:30:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-09-28 08:10:00', PUBLISH_BY: '周杰', TOTAL_TASK: 11, DELAY_TASK: 11, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.2457, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-09-28', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-1005-A', RULE_NO: 'RULE-02', VERSION_TYPE: '日排产', RANGE_FROM: '2026-10-05', RANGE_TO: '2026-10-13', GEN_TIME: '2026-10-05 17:30:00', GEN_BY: '孙倩', PUBLISH_TIME: '2026-10-05 18:10:00', PUBLISH_BY: '周杰', TOTAL_TASK: 11, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0.3445, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-10-05', STATUS: '已发布' }),
    doc({ VERSION_NO: 'SCHV-2026-1012-A', RULE_NO: 'RULE-03', VERSION_TYPE: '日排产', RANGE_FROM: '2026-10-15', RANGE_TO: '2026-10-28', GEN_TIME: '2026-10-12 08:30:00', GEN_BY: '孙倩', PUBLISH_TIME: null, PUBLISH_BY: '', TOTAL_TASK: 11, DELAY_TASK: 11, TOTAL_CHANGE_MIN: 80, UTIL_RATE: 0.367, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: '2026-10-12', STATUS: '已确认' })
  ];
  /* 排程明细（SCH_TASK / SCH_DAY_PLAN）由「排程工作台」的自动排程引擎逐版产出后固化：
   * 口径 = 数量 × BAS_RESOURCE.STD_CYCLE 节拍机时，按 BAS_CALENDAR 班次日历逐日推演（跨天 / 跳假日 / 避维保），
   * 有限产能同机台串行、换型时间计入占用；排产只按「日」进行（不设周计划）。 */
  S.SCH_TASK = [];
/* ---------- SCHV-2026-0831-A（RULE-01 · 基准日 2026-08-31 · 任务 35）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-0831A-001', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-06 08:00:00', END_TIME: '2026-09-06 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-002', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-06 18:00:00', END_TIME: '2026-09-07 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-003', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-07 12:00:00', END_TIME: '2026-09-07 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-004', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-07 17:16:40', END_TIME: '2026-09-07 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-005', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-07 20:36:40', END_TIME: '2026-09-07 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-006', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-07 23:06:40', END_TIME: '2026-09-08 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-007', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-08 20:26:40', END_TIME: '2026-09-08 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-008', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-06 08:00:00', END_TIME: '2026-09-06 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-009', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-06 18:00:00', END_TIME: '2026-09-07 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-010', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-009', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-07 12:00:00', END_TIME: '2026-09-07 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-011', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-016', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-07 17:16:40', END_TIME: '2026-09-07 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-012', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-015', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-07 20:36:40', END_TIME: '2026-09-07 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-013', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-020', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-07 23:06:40', END_TIME: '2026-09-08 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-014', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-08 22:06:40', END_TIME: '2026-09-08 23:46:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-015', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-003', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 08:00:00', END_TIME: '2026-09-14 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-016', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-003', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 18:00:00', END_TIME: '2026-09-15 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-017', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-011', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-15 12:00:00', END_TIME: '2026-09-15 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-018', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-15 17:16:40', END_TIME: '2026-09-15 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-019', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-15 20:36:40', END_TIME: '2026-09-15 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-020', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-15 23:06:40', END_TIME: '2026-09-16 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-021', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-16 20:26:40', END_TIME: '2026-09-16 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-022', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-004', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 08:00:00', END_TIME: '2026-09-14 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-023', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-004', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 18:00:00', END_TIME: '2026-09-15 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-024', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-012', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-15 12:00:00', END_TIME: '2026-09-15 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-025', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-016', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-15 17:16:40', END_TIME: '2026-09-15 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-026', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-015', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-15 20:36:40', END_TIME: '2026-09-15 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-027', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-020', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-15 23:06:40', END_TIME: '2026-09-16 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-028', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-16 22:06:40', END_TIME: '2026-09-16 23:46:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-029', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-005', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 08:00:00', END_TIME: '2026-09-21 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-030', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-005', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 18:00:00', END_TIME: '2026-09-22 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-031', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-22 12:00:00', END_TIME: '2026-09-22 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-032', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-22 17:16:40', END_TIME: '2026-09-22 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-033', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-22 20:36:40', END_TIME: '2026-09-22 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-034', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-22 23:06:40', END_TIME: '2026-09-23 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0831A-035', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-23 20:26:40', END_TIME: '2026-09-23 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0907-A（RULE-01 · 基准日 2026-09-07 · 任务 21）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-0907A-001', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 08:00:00', END_TIME: '2026-09-14 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-002', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 18:00:00', END_TIME: '2026-09-15 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-003', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-15 12:00:00', END_TIME: '2026-09-15 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-004', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-15 17:16:40', END_TIME: '2026-09-15 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-005', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-15 20:36:40', END_TIME: '2026-09-15 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-006', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-15 23:06:40', END_TIME: '2026-09-16 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-007', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-16 20:26:40', END_TIME: '2026-09-16 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-008', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 08:00:00', END_TIME: '2026-09-14 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-009', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-14 18:00:00', END_TIME: '2026-09-15 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-010', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-009', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-15 12:00:00', END_TIME: '2026-09-15 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-011', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-016', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-15 17:16:40', END_TIME: '2026-09-15 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-012', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-015', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-15 20:36:40', END_TIME: '2026-09-15 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-013', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-020', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-15 23:06:40', END_TIME: '2026-09-16 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-014', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-16 22:06:40', END_TIME: '2026-09-16 23:46:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-015', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-003', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 08:00:00', END_TIME: '2026-09-21 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-016', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-003', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 18:00:00', END_TIME: '2026-09-22 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-017', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-011', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-22 12:00:00', END_TIME: '2026-09-22 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-018', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-22 17:16:40', END_TIME: '2026-09-22 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-019', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-22 20:36:40', END_TIME: '2026-09-22 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-020', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-22 23:06:40', END_TIME: '2026-09-23 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0907A-021', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-23 20:26:40', END_TIME: '2026-09-23 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0914-A（RULE-02 · 基准日 2026-09-14 · 任务 7）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-0914A-001', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 08:00:00', END_TIME: '2026-09-21 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-002', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 18:00:00', END_TIME: '2026-09-22 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-003', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-22 12:00:00', END_TIME: '2026-09-22 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-004', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-22 17:16:40', END_TIME: '2026-09-22 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-005', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-22 20:36:40', END_TIME: '2026-09-22 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-006', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-22 23:06:40', END_TIME: '2026-09-23 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0914A-007', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-23 20:26:40', END_TIME: '2026-09-23 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0921-A（RULE-01 · 基准日 2026-09-21 · 任务 7）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-0921A-001', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 08:00:00', END_TIME: '2026-09-21 18:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-002', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-09-21 18:00:00', END_TIME: '2026-09-22 12:00:00', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-003', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-09-22 12:00:00', END_TIME: '2026-09-22 17:16:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-004', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-09-22 17:16:40', END_TIME: '2026-09-22 20:36:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-005', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-09-22 20:36:40', END_TIME: '2026-09-22 23:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-006', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-22 23:06:40', END_TIME: '2026-09-23 20:26:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
    base({ TASK_ID: 'T-0921A-007', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-09-23 20:26:40', END_TIME: '2026-09-23 22:06:40', PLAN_QTY: 200, DONE_QTY: 200, CHANGE_MIN: 0, KIT_DATE: '2026-09-05', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0928-A（RULE-01 · 基准日 2026-09-28 · 任务 11）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-0928A-001', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-15 08:00:00', END_TIME: '2026-10-17 16:00:00', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 1, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-002', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-17 16:00:00', END_TIME: '2026-10-19 21:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-003', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-19 21:06:40', END_TIME: '2026-10-23 10:26:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-004', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-23 10:26:40', END_TIME: '2026-10-23 17:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-005', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-20 08:00:00', END_TIME: '2026-10-21 17:00:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 1, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-006', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-21 17:00:00', END_TIME: '2026-10-23 10:00:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-007', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-009', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-23 10:00:00', END_TIME: '2026-10-23 23:11:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-008', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-10-23 23:11:40', END_TIME: '2026-10-24 15:31:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-009', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-10-24 15:31:40', END_TIME: '2026-10-24 21:46:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-010', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-020', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-24 21:46:40', END_TIME: '2026-10-27 23:06:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-0928A-011', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-27 23:06:40', END_TIME: '2026-10-28 11:16:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
  );

/* ---------- SCHV-2026-1005-A（RULE-02 · 基准日 2026-10-05 · 任务 11）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-1005A-001', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-05 08:00:00', END_TIME: '2026-10-07 16:00:00', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-002', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-07 16:00:00', END_TIME: '2026-10-08 21:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-003', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-08 21:06:40', END_TIME: '2026-10-13 10:26:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-004', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-13 10:26:40', END_TIME: '2026-10-13 17:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-005', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-05 08:00:00', END_TIME: '2026-10-06 17:00:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-006', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-002', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-06 17:00:00', END_TIME: '2026-10-08 10:00:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-007', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-009', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-08 10:00:00', END_TIME: '2026-10-08 23:11:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-008', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-10-08 23:11:40', END_TIME: '2026-10-09 15:31:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-009', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-10-09 15:31:40', END_TIME: '2026-10-09 21:46:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-010', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-020', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-09 21:46:40', END_TIME: '2026-10-12 23:06:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1005A-011', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-13 17:06:40', END_TIME: '2026-10-13 21:16:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 0, TASK_STATUS: '已排' }),
  );

/* ---------- SCHV-2026-1012-A（RULE-03 · 基准日 2026-10-12 · 任务 11）---------- */
  S.SCH_TASK.push(
    base({ TASK_ID: 'T-1012A-001', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-15 08:00:00', END_TIME: '2026-10-17 16:00:00', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 1, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-002', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-17 16:00:00', END_TIME: '2026-10-19 21:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-003', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-19 21:06:40', END_TIME: '2026-10-23 10:26:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-004', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-23 10:26:40', END_TIME: '2026-10-23 17:06:40', PLAN_QTY: 800, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-15', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-005', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '10', STEP_NAME: '数控粗加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-20 08:00:00', END_TIME: '2026-10-21 17:30:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 30, KIT_DATE: '2026-10-20', LOCK_FLAG: 1, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-006', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '20', STEP_NAME: '数控精加工', RES_NO: 'CNC-001', RES_GROUP: 'GRP-CNC', START_TIME: '2026-10-21 17:30:00', END_TIME: '2026-10-23 11:00:00', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 30, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-007', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '30', STEP_NAME: '机器人焊接', RES_NO: 'RBT-008', RES_GROUP: 'GRP-RBT', START_TIME: '2026-10-23 11:00:00', END_TIME: '2026-10-24 08:31:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 20, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-008', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '40', STEP_NAME: '总成装配', RES_NO: 'ASM-013', RES_GROUP: 'GRP-ASM', START_TIME: '2026-10-24 08:31:40', END_TIME: '2026-10-24 16:51:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-009', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '50', STEP_NAME: '自动拧紧', RES_NO: 'ASM-014', RES_GROUP: 'GRP-TORK', START_TIME: '2026-10-24 16:51:40', END_TIME: '2026-10-24 23:06:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-010', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '60', STEP_NAME: '三坐标检测', RES_NO: 'QMS-019', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-24 23:06:40', END_TIME: '2026-10-28 08:26:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
    base({ TASK_ID: 'T-1012A-011', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', SO_NO: 'SO-2026-002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', STEP_NO: '70', STEP_NAME: '在线视觉检测', RES_NO: 'QMS-021', RES_GROUP: 'GRP-QMS', START_TIME: '2026-10-28 08:26:40', END_TIME: '2026-10-28 12:36:40', PLAN_QTY: 500, DONE_QTY: 0, CHANGE_MIN: 0, KIT_DATE: '2026-10-20', LOCK_FLAG: 0, RUSH_FLAG: 0, DELAY_FLAG: 1, TASK_STATUS: '已排' }),
  );
  S.SCH_DAY_PLAN = [];
/* ---------- SCHV-2026-0831-A（日排产 60 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-0831A-001', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-06 08:00:00', PLAN_END: '2026-09-06 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-002', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-06 16:00:00', PLAN_END: '2026-09-06 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-003', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-06 18:00:00', PLAN_END: '2026-09-07 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-004', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-07', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-07 08:00:00', PLAN_END: '2026-09-07 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-005', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-07', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-07 12:00:00', PLAN_END: '2026-09-07 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-006', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-07', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-07 16:00:00', PLAN_END: '2026-09-07 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-007', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-07', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-07 17:16:40', PLAN_END: '2026-09-07 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-008', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-07', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-07 20:36:40', PLAN_END: '2026-09-07 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-009', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-07', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-07 23:06:40', PLAN_END: '2026-09-08 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-010', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-08 08:00:00', PLAN_END: '2026-09-08 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-011', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-08 16:00:00', PLAN_END: '2026-09-08 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-012', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0001', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-08 20:26:40', PLAN_END: '2026-09-08 22:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-013', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-06 08:00:00', PLAN_END: '2026-09-06 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-014', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-06 16:00:00', PLAN_END: '2026-09-06 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-015', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-06', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-06 18:00:00', PLAN_END: '2026-09-07 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-016', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-07', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-07 08:00:00', PLAN_END: '2026-09-07 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-017', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-07', RES_NO: 'RBT-009', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-07 12:00:00', PLAN_END: '2026-09-07 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-018', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-07', RES_NO: 'RBT-009', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-07 16:00:00', PLAN_END: '2026-09-07 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-019', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-07', RES_NO: 'ASM-016', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-07 17:16:40', PLAN_END: '2026-09-07 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-020', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-07', RES_NO: 'ASM-015', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-07 20:36:40', PLAN_END: '2026-09-07 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-021', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-07', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-07 23:06:40', PLAN_END: '2026-09-08 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-022', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-08 08:00:00', PLAN_END: '2026-09-08 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-023', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-08 16:00:00', PLAN_END: '2026-09-08 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-024', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0002', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-08', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-08 22:06:40', PLAN_END: '2026-09-08 23:46:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-025', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-003', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-14 08:00:00', PLAN_END: '2026-09-14 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-026', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-003', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-14 16:00:00', PLAN_END: '2026-09-14 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-027', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-003', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-14 18:00:00', PLAN_END: '2026-09-15 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-028', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-15', RES_NO: 'CNC-003', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-15 08:00:00', PLAN_END: '2026-09-15 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-029', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-011', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-15 12:00:00', PLAN_END: '2026-09-15 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-030', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-011', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-15 16:00:00', PLAN_END: '2026-09-15 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-031', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 17:16:40', PLAN_END: '2026-09-15 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-032', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 20:36:40', PLAN_END: '2026-09-15 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-033', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-15', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-15 23:06:40', PLAN_END: '2026-09-16 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-034', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-16 08:00:00', PLAN_END: '2026-09-16 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-035', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-16 16:00:00', PLAN_END: '2026-09-16 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-036', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0003', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-16 20:26:40', PLAN_END: '2026-09-16 22:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-037', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-004', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-14 08:00:00', PLAN_END: '2026-09-14 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-038', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-004', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-14 16:00:00', PLAN_END: '2026-09-14 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-039', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-004', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-14 18:00:00', PLAN_END: '2026-09-15 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-040', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-15', RES_NO: 'CNC-004', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-15 08:00:00', PLAN_END: '2026-09-15 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-041', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-012', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-15 12:00:00', PLAN_END: '2026-09-15 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-042', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-012', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-15 16:00:00', PLAN_END: '2026-09-15 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-043', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-016', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 17:16:40', PLAN_END: '2026-09-15 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-044', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-015', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 20:36:40', PLAN_END: '2026-09-15 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-045', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-15', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-15 23:06:40', PLAN_END: '2026-09-16 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-046', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-16 08:00:00', PLAN_END: '2026-09-16 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-047', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-16 16:00:00', PLAN_END: '2026-09-16 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-048', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0004', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-16 22:06:40', PLAN_END: '2026-09-16 23:46:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-049', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-005', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-21 08:00:00', PLAN_END: '2026-09-21 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-050', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-005', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-21 16:00:00', PLAN_END: '2026-09-21 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-051', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-005', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-21 18:00:00', PLAN_END: '2026-09-22 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-052', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-22', RES_NO: 'CNC-005', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-22 08:00:00', PLAN_END: '2026-09-22 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-053', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-22 12:00:00', PLAN_END: '2026-09-22 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-054', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-22 16:00:00', PLAN_END: '2026-09-22 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-055', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 17:16:40', PLAN_END: '2026-09-22 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-056', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 20:36:40', PLAN_END: '2026-09-22 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-057', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-22 23:06:40', PLAN_END: '2026-09-23 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-058', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-23 08:00:00', PLAN_END: '2026-09-23 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-059', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-23 16:00:00', PLAN_END: '2026-09-23 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0831A-060', VERSION_NO: 'SCHV-2026-0831-A', WO_NO: 'WO-2026-0005', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-23 20:26:40', PLAN_END: '2026-09-23 22:06:40', STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0907-A（日排产 36 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-0907A-001', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-14 08:00:00', PLAN_END: '2026-09-14 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-002', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-14 16:00:00', PLAN_END: '2026-09-14 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-003', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-14 18:00:00', PLAN_END: '2026-09-15 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-004', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-15', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-15 08:00:00', PLAN_END: '2026-09-15 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-005', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-15 12:00:00', PLAN_END: '2026-09-15 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-006', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-15 16:00:00', PLAN_END: '2026-09-15 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-007', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 17:16:40', PLAN_END: '2026-09-15 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-008', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 20:36:40', PLAN_END: '2026-09-15 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-009', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-15', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-15 23:06:40', PLAN_END: '2026-09-16 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-010', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-16 08:00:00', PLAN_END: '2026-09-16 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-011', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-16 16:00:00', PLAN_END: '2026-09-16 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-012', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0003', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-16 20:26:40', PLAN_END: '2026-09-16 22:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-013', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-14 08:00:00', PLAN_END: '2026-09-14 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-014', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-14 16:00:00', PLAN_END: '2026-09-14 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-015', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-14', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-14 18:00:00', PLAN_END: '2026-09-15 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-016', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-15', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-15 08:00:00', PLAN_END: '2026-09-15 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-017', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-009', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-15 12:00:00', PLAN_END: '2026-09-15 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-018', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-15', RES_NO: 'RBT-009', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-15 16:00:00', PLAN_END: '2026-09-15 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-019', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-016', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 17:16:40', PLAN_END: '2026-09-15 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-020', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-15', RES_NO: 'ASM-015', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-15 20:36:40', PLAN_END: '2026-09-15 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-021', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-15', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-15 23:06:40', PLAN_END: '2026-09-16 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-022', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-16 08:00:00', PLAN_END: '2026-09-16 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-023', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-16 16:00:00', PLAN_END: '2026-09-16 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-024', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0004', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-16', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-16 22:06:40', PLAN_END: '2026-09-16 23:46:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-025', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-003', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-21 08:00:00', PLAN_END: '2026-09-21 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-026', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-003', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-21 16:00:00', PLAN_END: '2026-09-21 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-027', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-003', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-21 18:00:00', PLAN_END: '2026-09-22 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-028', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-22', RES_NO: 'CNC-003', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-22 08:00:00', PLAN_END: '2026-09-22 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-029', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-011', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-22 12:00:00', PLAN_END: '2026-09-22 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-030', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-011', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-22 16:00:00', PLAN_END: '2026-09-22 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-031', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 17:16:40', PLAN_END: '2026-09-22 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-032', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 20:36:40', PLAN_END: '2026-09-22 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-033', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-22 23:06:40', PLAN_END: '2026-09-23 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-034', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-23 08:00:00', PLAN_END: '2026-09-23 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-035', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-23 16:00:00', PLAN_END: '2026-09-23 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0907A-036', VERSION_NO: 'SCHV-2026-0907-A', WO_NO: 'WO-2026-0005', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-23 20:26:40', PLAN_END: '2026-09-23 22:06:40', STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0914-A（日排产 12 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-0914A-001', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-21 08:00:00', PLAN_END: '2026-09-21 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-002', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-21 16:00:00', PLAN_END: '2026-09-21 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-003', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-21 18:00:00', PLAN_END: '2026-09-22 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-004', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-22', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-22 08:00:00', PLAN_END: '2026-09-22 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-005', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-22 12:00:00', PLAN_END: '2026-09-22 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-006', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-22 16:00:00', PLAN_END: '2026-09-22 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-007', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 17:16:40', PLAN_END: '2026-09-22 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-008', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 20:36:40', PLAN_END: '2026-09-22 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-009', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-22 23:06:40', PLAN_END: '2026-09-23 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-010', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-23 08:00:00', PLAN_END: '2026-09-23 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-011', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-23 16:00:00', PLAN_END: '2026-09-23 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0914A-012', VERSION_NO: 'SCHV-2026-0914-A', WO_NO: 'WO-2026-0005', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-23 20:26:40', PLAN_END: '2026-09-23 22:06:40', STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0921-A（日排产 12 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-0921A-001', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-09-21 08:00:00', PLAN_END: '2026-09-21 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-002', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 40, PLAN_START: '2026-09-21 16:00:00', PLAN_END: '2026-09-21 18:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-003', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-09-21 18:00:00', PLAN_END: '2026-09-22 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-004', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-09-22', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 80, PLAN_START: '2026-09-22 08:00:00', PLAN_END: '2026-09-22 12:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-005', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 152, PLAN_START: '2026-09-22 12:00:00', PLAN_END: '2026-09-22 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-006', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-09-22', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-09-22 16:00:00', PLAN_END: '2026-09-22 17:16:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-007', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 17:16:40', PLAN_END: '2026-09-22 20:36:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-008', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-09-22', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-22 20:36:40', PLAN_END: '2026-09-22 23:06:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-009', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-09-22 23:06:40', PLAN_END: '2026-09-23 00:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-010', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-09-23 08:00:00', PLAN_END: '2026-09-23 16:00:00', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-011', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 67, PLAN_START: '2026-09-23 16:00:00', PLAN_END: '2026-09-23 20:26:40', STATUS: '已完工' }),
    base({ DP_ID: 'DP-0921A-012', VERSION_NO: 'SCHV-2026-0921-A', WO_NO: 'WO-2026-0005', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-09-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 200, PLAN_START: '2026-09-23 20:26:40', PLAN_END: '2026-09-23 22:06:40', STATUS: '已完工' }),
  );

/* ---------- SCHV-2026-0928-A（日排产 39 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-0928A-001', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-15', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-15 08:00:00', PLAN_END: '2026-10-15 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-002', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-15', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-15 16:00:00', PLAN_END: '2026-10-16 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-003', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-16', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-16 08:00:00', PLAN_END: '2026-10-16 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-004', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-16', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-16 16:00:00', PLAN_END: '2026-10-17 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-005', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-17', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-17 08:00:00', PLAN_END: '2026-10-17 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-006', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-17', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 303, PLAN_START: '2026-10-17 16:00:00', PLAN_END: '2026-10-18 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-007', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-19', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 303, PLAN_START: '2026-10-19 08:00:00', PLAN_END: '2026-10-19 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-008', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-19', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 194, PLAN_START: '2026-10-19 16:00:00', PLAN_END: '2026-10-19 21:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-009', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-19', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 43, PLAN_START: '2026-10-19 21:06:40', PLAN_END: '2026-10-20 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-010', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-20', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-20 08:00:00', PLAN_END: '2026-10-20 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-011', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-20', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-20 16:00:00', PLAN_END: '2026-10-21 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-012', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-21', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-21 08:00:00', PLAN_END: '2026-10-21 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-013', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-21', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-21 16:00:00', PLAN_END: '2026-10-22 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-014', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-22', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-22 08:00:00', PLAN_END: '2026-10-22 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-015', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-22 16:00:00', PLAN_END: '2026-10-23 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-016', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 37, PLAN_START: '2026-10-23 08:00:00', PLAN_END: '2026-10-23 10:26:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-017', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-021', SHIFT: '白班', PLAN_QTY: 667, PLAN_START: '2026-10-23 10:26:40', PLAN_END: '2026-10-23 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-018', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 133, PLAN_START: '2026-10-23 16:00:00', PLAN_END: '2026-10-23 17:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-019', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-20', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-20 08:00:00', PLAN_END: '2026-10-20 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-020', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-20', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-20 16:00:00', PLAN_END: '2026-10-21 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-021', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-21 08:00:00', PLAN_END: '2026-10-21 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-022', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 20, PLAN_START: '2026-10-21 16:00:00', PLAN_END: '2026-10-21 17:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-023', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 140, PLAN_START: '2026-10-21 17:00:00', PLAN_END: '2026-10-22 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-024', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-22', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-22 08:00:00', PLAN_END: '2026-10-22 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-025', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-22', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-22 16:00:00', PLAN_END: '2026-10-23 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-026', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-23', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 40, PLAN_START: '2026-10-23 08:00:00', PLAN_END: '2026-10-23 10:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-027', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-23', RES_NO: 'RBT-009', SHIFT: '白班', PLAN_QTY: 227, PLAN_START: '2026-10-23 10:00:00', PLAN_END: '2026-10-23 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-028', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-23', RES_NO: 'RBT-009', SHIFT: '中班', PLAN_QTY: 273, PLAN_START: '2026-10-23 16:00:00', PLAN_END: '2026-10-23 23:11:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-029', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-23', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-10-23 23:11:40', PLAN_END: '2026-10-24 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-030', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-013', SHIFT: '白班', PLAN_QTY: 452, PLAN_START: '2026-10-24 08:00:00', PLAN_END: '2026-10-24 15:31:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-031', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-014', SHIFT: '白班', PLAN_QTY: 38, PLAN_START: '2026-10-24 15:31:40', PLAN_END: '2026-10-24 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-032', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 462, PLAN_START: '2026-10-24 16:00:00', PLAN_END: '2026-10-24 21:46:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-033', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-24', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 33, PLAN_START: '2026-10-24 21:46:40', PLAN_END: '2026-10-25 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-034', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-26', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-26 08:00:00', PLAN_END: '2026-10-26 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-035', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-26', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-26 16:00:00', PLAN_END: '2026-10-27 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-036', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-27', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-27 08:00:00', PLAN_END: '2026-10-27 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-037', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-27', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 107, PLAN_START: '2026-10-27 16:00:00', PLAN_END: '2026-10-27 23:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-038', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-27', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 107, PLAN_START: '2026-10-27 23:06:40', PLAN_END: '2026-10-28 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-0928A-039', VERSION_NO: 'SCHV-2026-0928-A', WO_NO: 'WO-2026-0007', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-28', RES_NO: 'QMS-021', SHIFT: '白班', PLAN_QTY: 393, PLAN_START: '2026-10-28 08:00:00', PLAN_END: '2026-10-28 11:16:40', STATUS: '已排' }),
  );

/* ---------- SCHV-2026-1005-A（日排产 38 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-1005A-001', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-05', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-05 08:00:00', PLAN_END: '2026-10-05 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-002', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-05', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-05 16:00:00', PLAN_END: '2026-10-06 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-003', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-06', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-06 08:00:00', PLAN_END: '2026-10-06 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-004', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-06', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-06 16:00:00', PLAN_END: '2026-10-07 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-005', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-07', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-07 08:00:00', PLAN_END: '2026-10-07 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-006', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-07', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 303, PLAN_START: '2026-10-07 16:00:00', PLAN_END: '2026-10-08 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-007', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-08', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 303, PLAN_START: '2026-10-08 08:00:00', PLAN_END: '2026-10-08 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-008', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-08', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 194, PLAN_START: '2026-10-08 16:00:00', PLAN_END: '2026-10-08 21:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-009', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-08', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 43, PLAN_START: '2026-10-08 21:06:40', PLAN_END: '2026-10-09 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-010', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-09', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-09 08:00:00', PLAN_END: '2026-10-09 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-011', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-09', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-09 16:00:00', PLAN_END: '2026-10-10 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-012', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-10', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-10 08:00:00', PLAN_END: '2026-10-10 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-013', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-10', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-10 16:00:00', PLAN_END: '2026-10-11 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-014', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-12', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-12 08:00:00', PLAN_END: '2026-10-12 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-015', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-12', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-12 16:00:00', PLAN_END: '2026-10-13 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-016', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-13', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 37, PLAN_START: '2026-10-13 08:00:00', PLAN_END: '2026-10-13 10:26:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-017', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-13', RES_NO: 'QMS-021', SHIFT: '白班', PLAN_QTY: 667, PLAN_START: '2026-10-13 10:26:40', PLAN_END: '2026-10-13 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-018', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-13', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 133, PLAN_START: '2026-10-13 16:00:00', PLAN_END: '2026-10-13 17:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-019', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-05', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-05 08:00:00', PLAN_END: '2026-10-05 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-020', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-05', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-05 16:00:00', PLAN_END: '2026-10-06 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-021', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-06', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-06 08:00:00', PLAN_END: '2026-10-06 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-022', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-06', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 20, PLAN_START: '2026-10-06 16:00:00', PLAN_END: '2026-10-06 17:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-023', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-06', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 140, PLAN_START: '2026-10-06 17:00:00', PLAN_END: '2026-10-07 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-024', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-07', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-07 08:00:00', PLAN_END: '2026-10-07 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-025', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-07', RES_NO: 'CNC-002', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-07 16:00:00', PLAN_END: '2026-10-08 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-026', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-08', RES_NO: 'CNC-002', SHIFT: '白班', PLAN_QTY: 40, PLAN_START: '2026-10-08 08:00:00', PLAN_END: '2026-10-08 10:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-027', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-08', RES_NO: 'RBT-009', SHIFT: '白班', PLAN_QTY: 227, PLAN_START: '2026-10-08 10:00:00', PLAN_END: '2026-10-08 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-028', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-08', RES_NO: 'RBT-009', SHIFT: '中班', PLAN_QTY: 273, PLAN_START: '2026-10-08 16:00:00', PLAN_END: '2026-10-08 23:11:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-029', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-08', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 48, PLAN_START: '2026-10-08 23:11:40', PLAN_END: '2026-10-09 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-030', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-09', RES_NO: 'ASM-013', SHIFT: '白班', PLAN_QTY: 452, PLAN_START: '2026-10-09 08:00:00', PLAN_END: '2026-10-09 15:31:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-031', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-10-09', RES_NO: 'ASM-014', SHIFT: '白班', PLAN_QTY: 38, PLAN_START: '2026-10-09 15:31:40', PLAN_END: '2026-10-09 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-032', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-10-09', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 462, PLAN_START: '2026-10-09 16:00:00', PLAN_END: '2026-10-09 21:46:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-033', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-09', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 33, PLAN_START: '2026-10-09 21:46:40', PLAN_END: '2026-10-10 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-034', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-10', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-10 08:00:00', PLAN_END: '2026-10-10 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-035', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-10', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-10 16:00:00', PLAN_END: '2026-10-11 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-036', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-12', RES_NO: 'QMS-020', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-12 08:00:00', PLAN_END: '2026-10-12 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-037', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-12', RES_NO: 'QMS-020', SHIFT: '中班', PLAN_QTY: 107, PLAN_START: '2026-10-12 16:00:00', PLAN_END: '2026-10-12 23:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1005A-038', VERSION_NO: 'SCHV-2026-1005-A', WO_NO: 'WO-2026-0007', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-13', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 500, PLAN_START: '2026-10-13 17:06:40', PLAN_END: '2026-10-13 21:16:40', STATUS: '已排' }),
  );

/* ---------- SCHV-2026-1012-A（日排产 39 条）---------- */
  S.SCH_DAY_PLAN.push(
    base({ DP_ID: 'DP-1012A-001', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-15', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-15 08:00:00', PLAN_END: '2026-10-15 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-002', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-15', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-15 16:00:00', PLAN_END: '2026-10-16 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-003', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-16', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-16 08:00:00', PLAN_END: '2026-10-16 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-004', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-16', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 160, PLAN_START: '2026-10-16 16:00:00', PLAN_END: '2026-10-17 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-005', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-17', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 160, PLAN_START: '2026-10-17 08:00:00', PLAN_END: '2026-10-17 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-006', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-17', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 303, PLAN_START: '2026-10-17 16:00:00', PLAN_END: '2026-10-18 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-007', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-19', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 303, PLAN_START: '2026-10-19 08:00:00', PLAN_END: '2026-10-19 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-008', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-19', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 194, PLAN_START: '2026-10-19 16:00:00', PLAN_END: '2026-10-19 21:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-009', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-19', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 43, PLAN_START: '2026-10-19 21:06:40', PLAN_END: '2026-10-20 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-010', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-20', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-20 08:00:00', PLAN_END: '2026-10-20 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-011', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-20', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-20 16:00:00', PLAN_END: '2026-10-21 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-012', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-21', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-21 08:00:00', PLAN_END: '2026-10-21 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-013', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-21', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-21 16:00:00', PLAN_END: '2026-10-22 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-014', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-22', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-22 08:00:00', PLAN_END: '2026-10-22 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-015', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-22', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-22 16:00:00', PLAN_END: '2026-10-23 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-016', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 37, PLAN_START: '2026-10-23 08:00:00', PLAN_END: '2026-10-23 10:26:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-017', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-021', SHIFT: '白班', PLAN_QTY: 667, PLAN_START: '2026-10-23 10:26:40', PLAN_END: '2026-10-23 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-018', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0006', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-23', RES_NO: 'QMS-021', SHIFT: '中班', PLAN_QTY: 133, PLAN_START: '2026-10-23 16:00:00', PLAN_END: '2026-10-23 17:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-019', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-20', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 157, PLAN_START: '2026-10-20 08:00:00', PLAN_END: '2026-10-20 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-020', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-20', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 157, PLAN_START: '2026-10-20 16:00:00', PLAN_END: '2026-10-21 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-021', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 157, PLAN_START: '2026-10-21 08:00:00', PLAN_END: '2026-10-21 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-022', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '10', STEP_NAME: '数控粗加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 29, PLAN_START: '2026-10-21 16:00:00', PLAN_END: '2026-10-21 17:30:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-023', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-21', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 127, PLAN_START: '2026-10-21 17:30:00', PLAN_END: '2026-10-22 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-024', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-22', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 157, PLAN_START: '2026-10-22 08:00:00', PLAN_END: '2026-10-22 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-025', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-22', RES_NO: 'CNC-001', SHIFT: '中班', PLAN_QTY: 157, PLAN_START: '2026-10-22 16:00:00', PLAN_END: '2026-10-23 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-026', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '20', STEP_NAME: '数控精加工', PLAN_DATE: '2026-10-23', RES_NO: 'CNC-001', SHIFT: '白班', PLAN_QTY: 59, PLAN_START: '2026-10-23 08:00:00', PLAN_END: '2026-10-23 11:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-027', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-23', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 185, PLAN_START: '2026-10-23 11:00:00', PLAN_END: '2026-10-23 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-028', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-23', RES_NO: 'RBT-008', SHIFT: '中班', PLAN_QTY: 296, PLAN_START: '2026-10-23 16:00:00', PLAN_END: '2026-10-24 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-029', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '30', STEP_NAME: '机器人焊接', PLAN_DATE: '2026-10-24', RES_NO: 'RBT-008', SHIFT: '白班', PLAN_QTY: 19, PLAN_START: '2026-10-24 08:00:00', PLAN_END: '2026-10-24 08:31:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-030', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-013', SHIFT: '白班', PLAN_QTY: 448, PLAN_START: '2026-10-24 08:31:40', PLAN_END: '2026-10-24 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-031', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '40', STEP_NAME: '总成装配', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-013', SHIFT: '中班', PLAN_QTY: 52, PLAN_START: '2026-10-24 16:00:00', PLAN_END: '2026-10-24 16:51:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-032', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '50', STEP_NAME: '自动拧紧', PLAN_DATE: '2026-10-24', RES_NO: 'ASM-014', SHIFT: '中班', PLAN_QTY: 500, PLAN_START: '2026-10-24 16:51:40', PLAN_END: '2026-10-24 23:06:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-033', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-24', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 13, PLAN_START: '2026-10-24 23:06:40', PLAN_END: '2026-10-25 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-034', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-26', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-26 08:00:00', PLAN_END: '2026-10-26 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-035', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-26', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-26 16:00:00', PLAN_END: '2026-10-27 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-036', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-27', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 120, PLAN_START: '2026-10-27 08:00:00', PLAN_END: '2026-10-27 16:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-037', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-27', RES_NO: 'QMS-019', SHIFT: '中班', PLAN_QTY: 120, PLAN_START: '2026-10-27 16:00:00', PLAN_END: '2026-10-28 00:00:00', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-038', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '60', STEP_NAME: '三坐标检测', PLAN_DATE: '2026-10-28', RES_NO: 'QMS-019', SHIFT: '白班', PLAN_QTY: 7, PLAN_START: '2026-10-28 08:00:00', PLAN_END: '2026-10-28 08:26:40', STATUS: '已排' }),
    base({ DP_ID: 'DP-1012A-039', VERSION_NO: 'SCHV-2026-1012-A', WO_NO: 'WO-2026-0007', STEP_NO: '70', STEP_NAME: '在线视觉检测', PLAN_DATE: '2026-10-28', RES_NO: 'QMS-021', SHIFT: '白班', PLAN_QTY: 500, PLAN_START: '2026-10-28 08:26:40', PLAN_END: '2026-10-28 12:36:40', STATUS: '已排' }),
  );

  S.SCH_ADJUST = [
    base({ ADJ_ID: 'ADJ-2026-0001', VERSION_NO: 'SCHV-2026-0928-A', TASK_ID: 'T-0928A-002', WO_NO: 'WO-2026-0006', STEP_NO: '30', ADJ_TYPE: '拖拽调整', FROM_RES: 'RBT-008', TO_RES: 'RBT-009', FROM_TIME: '2026-10-17 16:00:00', TO_TIME: '2026-10-18 02:00:00', RUSH_MODE: '', IMPACT_ORDERS: 'WO-2026-0007(机器人焊接顺延 2h)', CONFLICT_MSG: '资源无冲突；与上道工序数控粗加工衔接 OK', ADJ_BY: '孙倩', ADJ_TIME: '2026-09-28 09:10:00', STATUS: '已生效' }),
    base({ ADJ_ID: 'ADJ-2026-0002', VERSION_NO: 'SCHV-2026-0928-A', TASK_ID: 'T-0928A-008', WO_NO: 'WO-2026-0007', STEP_NO: '40', ADJ_TYPE: '插单', FROM_RES: '', TO_RES: 'ASM-013', FROM_TIME: '', TO_TIME: '2026-10-24 15:31:40', RUSH_MODE: '混排重排', IMPACT_ORDERS: 'WO-2026-0006(悬置支架装配后延 1 天)；受影响订单 1 张', CONFLICT_MSG: '插单前影响预览：ASM-013 后续任务顺延；冻结期内任务已锁定不参与重排', ADJ_BY: '周杰', ADJ_TIME: '2026-09-28 07:50:00', STATUS: '已审批' })
  ];

  /* 排产异常：按「排程版本」从延期 / 冲突任务派生（calc:true 计算产物表，不渲染新增/导入）。
   * 交期口径 = 对应销售订单交期（P-MB-003 → 10/15、P-SF-002 → 10/20）。
   * 10 月这两张工单要经过齐套日限制（10/15）才能开工，因此 9/28、10/12 两版都判出延期 —— 属于「计划层面的预警」。 */
  S.SCH_EXCEPTION = [
    base({ EXC_ID: 'EXC-2026-0001', VERSION_NO: 'SCHV-2026-0928-A', TASK_ID: 'T-0928A-001', WO_NO: 'WO-2026-0006', EXC_TYPE: '交期延期', EXC_LEVEL: '高', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', EXC_DESC: '首道工序（数控粗加工）完工 10-17，晚于销售订单交期 10-15，延期 2 天', RES_NO: 'CNC-001', REQ_DATE: '2026-10-15', PLAN_END: '2026-10-17 16:00:00', DELAY_DAYS: 2, SUGGEST_ACTION: '提前投放毛坯，或改用倒排规则从交期倒推开工', HANDLE_STATUS: '待处置' }),
    base({ EXC_ID: 'EXC-2026-0002', VERSION_NO: 'SCHV-2026-0928-A', TASK_ID: 'T-0928A-011', WO_NO: 'WO-2026-0007', EXC_TYPE: '交期延期', EXC_LEVEL: '严重', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', EXC_DESC: '末道工序（在线视觉检测）完工 10-28，晚于销售订单交期 10-20，延期 8 天', RES_NO: 'QMS-021', REQ_DATE: '2026-10-20', PLAN_END: '2026-10-28 11:16:40', DELAY_DAYS: 8, SUGGEST_ACTION: '拆分批次并行投产，或与客户协商分批交付', HANDLE_STATUS: '待处置' }),
    base({ EXC_ID: 'EXC-2026-0003', VERSION_NO: 'SCHV-2026-1012-A', TASK_ID: 'T-1012A-001', WO_NO: 'WO-2026-0006', EXC_TYPE: '交期延期', EXC_LEVEL: '高', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', EXC_DESC: '首道工序完工 10-17，晚于交期 10-15，延期 2 天（换 RULE-03 重排后仍延期）', RES_NO: 'CNC-001', REQ_DATE: '2026-10-15', PLAN_END: '2026-10-17 16:00:00', DELAY_DAYS: 2, SUGGEST_ACTION: '把 WO-2026-0007 分流到 CNC-002，释放 CNC-001 产能', HANDLE_STATUS: '已处置' }),
    base({ EXC_ID: 'EXC-2026-0004', VERSION_NO: 'SCHV-2026-1012-A', TASK_ID: 'T-1012A-011', WO_NO: 'WO-2026-0007', EXC_TYPE: '交期延期', EXC_LEVEL: '严重', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', EXC_DESC: '末道工序完工 10-28，晚于交期 10-20，延期 8 天', RES_NO: 'QMS-021', REQ_DATE: '2026-10-20', PLAN_END: '2026-10-28 12:36:40', DELAY_DAYS: 8, SUGGEST_ACTION: '增加外协工序或与客户协商分批交付', HANDLE_STATUS: '已处置' }),
    base({ EXC_ID: 'EXC-2026-0005', VERSION_NO: 'SCHV-2026-1012-A', TASK_ID: 'T-1012A-005', WO_NO: 'WO-2026-0007', EXC_TYPE: '资源冲突', EXC_LEVEL: '中', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', EXC_DESC: 'CNC-001 与 WO-2026-0006 的粗加工时段重叠，已按有限产能串行到 10-20 之后', RES_NO: 'CNC-001', REQ_DATE: '2026-10-20', PLAN_END: '2026-10-21 17:30:00', DELAY_DAYS: 0, SUGGEST_ACTION: '把 WO-2026-0007 分流到 CNC-002，或调整投放顺序', HANDLE_STATUS: '已处置' })
  ];

  /* V5 口径：本期生产排程不含工程变更（ECN），原 SCH_ECN_ALERT 种子数据已移除。 */

  /* ==================================================================
   * ④ 计划分析与预警（RPT）—— 只读派生，不落地人工录入（占位初始化）
   *   注：产能负荷 / 齐套率 已是「计划看板」域的看板视图，不落库、此处无需占位。
   * ================================================================== */
  S.RPT_DELIVERY_ALERT = [];
  S.RPT_SCHEDULE_KPI = [];
  S.RPT_NET_REQ_SUM = [];
  S.RPT_SHORT_DETAIL = [];

  /* ==================================================================
   * ⑤ 集成接口（IF）
   * ================================================================== */
  S.IF_CONFIG = [
    base({ IF_CODE: 'IF-MES', SYS_NAME: 'MES 4.0', IF_TYPE: '同库直连', DIRECTION: '双向', DATA_SCOPE: '读业务数据 / 写回排程·补料·生产计划', FREQ: '实时', IS_RESERVED: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ IF_CODE: 'IF-ERP-R', SYS_NAME: 'ERP', IF_TYPE: '中间库', DIRECTION: '读', DATA_SCOPE: '物料/BOM/工艺/库存/销售订单/采购在途', FREQ: '每10分钟', IS_RESERVED: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ IF_CODE: 'IF-ERP-W', SYS_NAME: 'ERP', IF_TYPE: 'WebAPI', DIRECTION: '写', DATA_SCOPE: '计划订单/采购需求/生产工单', FREQ: '实时', IS_RESERVED: 0, ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' }),
    base({ IF_CODE: 'IF-EDI-830', SYS_NAME: 'EDI(主机厂)', IF_TYPE: '报文', DIRECTION: '读', DATA_SCOPE: '830 月度预测', FREQ: '按需', IS_RESERVED: 1, ENABLE_FLAG: 0 }),
    base({ IF_CODE: 'IF-EDI-862', SYS_NAME: 'EDI(主机厂)', IF_TYPE: '报文', DIRECTION: '读', DATA_SCOPE: '862 周装运需求', FREQ: '按需', IS_RESERVED: 1, ENABLE_FLAG: 0 }),
    base({ IF_CODE: 'IF-SRM', SYS_NAME: 'SRM(供应商协同)', IF_TYPE: '文件', DIRECTION: '写', DATA_SCOPE: '供应商交货计划', FREQ: '每日', IS_RESERVED: 1, ENABLE_FLAG: 0 })
  ];
  S.IF_RUN_LOG = [
    base({ LOG_ID: 'IFLOG-0001', IF_CODE: 'IF-ERP-R', RUN_TIME: '2026-09-28 08:00:00', DIRECTION: '读', RECORDS: 1284, STATUS: '成功', ERROR_MSG: '', RETRY_FLAG: 0, MANUAL_FALLBACK: 0 }),
    base({ LOG_ID: 'IFLOG-0002', IF_CODE: 'IF-MES', RUN_TIME: '2026-09-28 08:10:00', DIRECTION: '写', RECORDS: 42, STATUS: '成功', ERROR_MSG: '', RETRY_FLAG: 0, MANUAL_FALLBACK: 0 }),
    base({ LOG_ID: 'IFLOG-0003', IF_CODE: 'IF-ERP-W', RUN_TIME: '2026-09-28 09:05:00', DIRECTION: '写', RECORDS: 3, STATUS: '失败', ERROR_MSG: 'ERP 接口超时（3s）', RETRY_FLAG: 1, MANUAL_FALLBACK: 1 }),
    base({ LOG_ID: 'IFLOG-0004', IF_CODE: 'IF-ERP-W', RUN_TIME: '2026-09-28 09:20:00', DIRECTION: '写', RECORDS: 3, STATUS: '成功', ERROR_MSG: '', RETRY_FLAG: 1, MANUAL_FALLBACK: 0 })
  ];

  /* ==================================================================
   * ⑥ MES 引用数据（RF）—— 只读镜像，真源在 MES
   *   数据口径 1:1 对齐「MES 4.0 汽配车间」演示数据（8080）：
   *   产品 = 前/后副车架总成 + 电驱动悬置支架；工艺 = 数控加工 → 焊装 → 装配 → 检测；
   *   设备 = 汽配车间 6 区 33 台（CNC/RBT/ASM/QMS/WH/AGV）。
   * ================================================================== */
  S.RF_ITEM = [
    /* —— 成品 —— */
    base({ ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', UNIT: '件', ITEM_TYPE: '自制', ITEM_CATEGORY: '成品', CUSTOMER_PART_NO: 'LD-31001', SAFETY_STOCK: 500, PURCHASE_LEAD_TIME: 0, PRODUCE_LEAD_TIME: 15, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', SPEC: 'Q345B 焊接总成', UNIT: '件', ITEM_TYPE: '自制', ITEM_CATEGORY: '成品', CUSTOMER_PART_NO: 'LD-31002', SAFETY_STOCK: 400, PURCHASE_LEAD_TIME: 0, PRODUCE_LEAD_TIME: 15, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', SPEC: 'Q345B 冲焊件', UNIT: '件', ITEM_TYPE: '自制', ITEM_CATEGORY: '成品', CUSTOMER_PART_NO: 'ZC-24003', SAFETY_STOCK: 0, PURCHASE_LEAD_TIME: 0, PRODUCE_LEAD_TIME: 8, SOURCE_SYS: 'MES' }),
    /* —— 半成品 —— */
    base({ ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', SPEC: 'SF-3101 焊接件', UNIT: '件', ITEM_TYPE: '自制', ITEM_CATEGORY: '半成品', CUSTOMER_PART_NO: '', SAFETY_STOCK: 300, PURCHASE_LEAD_TIME: 0, PRODUCE_LEAD_TIME: 3, SOURCE_SYS: 'MES' }),
    /* —— 原材料 —— */
    base({ ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', UNIT: 'kg', ITEM_TYPE: '外购', ITEM_CATEGORY: '金属材料', CUSTOMER_PART_NO: '', SAFETY_STOCK: 8000, PURCHASE_LEAD_TIME: 7, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SPEC: 'Φ76×4.0', UNIT: 'kg', ITEM_TYPE: '外购', ITEM_CATEGORY: '金属材料', CUSTOMER_PART_NO: '', SAFETY_STOCK: 2000, PURCHASE_LEAD_TIME: 7, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', UNIT: '件', ITEM_TYPE: '外购', ITEM_CATEGORY: '金属材料', CUSTOMER_PART_NO: '', SAFETY_STOCK: 300, PURCHASE_LEAD_TIME: 10, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', SPEC: 'Φ1.2 实心焊丝', UNIT: 'kg', ITEM_TYPE: '外购', ITEM_CATEGORY: '焊接材料', CUSTOMER_PART_NO: '', SAFETY_STOCK: 400, PURCHASE_LEAD_TIME: 5, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    /* —— 外购件 —— */
    base({ ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', SPEC: 'Φ60×90', UNIT: '套', ITEM_TYPE: '外购', ITEM_CATEGORY: '外购件', CUSTOMER_PART_NO: '', SAFETY_STOCK: 2000, PURCHASE_LEAD_TIME: 15, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    base({ ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', SPEC: '10.9级 达克罗', UNIT: '件', ITEM_TYPE: '外购', ITEM_CATEGORY: '外购件', CUSTOMER_PART_NO: '', SAFETY_STOCK: 12000, PURCHASE_LEAD_TIME: 15, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' }),
    /* —— 辅料 —— */
    base({ ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', SPEC: 'MAC-COOL 920', UNIT: '桶', ITEM_TYPE: '外购', ITEM_CATEGORY: '化工辅料', CUSTOMER_PART_NO: '', SAFETY_STOCK: 20, PURCHASE_LEAD_TIME: 5, PRODUCE_LEAD_TIME: 0, SOURCE_SYS: 'MES' })
  ];
  /* BOM 三层：P-SF-001 → 分总成/衬套/螺栓；P-SF-002 → 钢板/钢管/焊丝；P-MB-003 → 毛坯/焊丝；
   *        M-SF-WELD → 钢板/焊丝（焊接分总成的下阶）
   * LEVEL_NO 已在数据里标好低阶码（同一物料取最低层），MRP 逐层展开直接用它排序 */
  S.RF_BOM = [
    base({ BOM_NO: 'BOM-SF1', BOM_VER: 'V2', SEQ_NO: 1, PARENT_ITEM: 'P-SF-001', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', NET_QTY: 1, LOSS_RATE: 0, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF1', BOM_VER: 'V2', SEQ_NO: 2, PARENT_ITEM: 'P-SF-001', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', NET_QTY: 4, LOSS_RATE: 0, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF1', BOM_VER: 'V2', SEQ_NO: 3, PARENT_ITEM: 'P-SF-001', ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', NET_QTY: 12, LOSS_RATE: 0.02, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF2', BOM_VER: 'V1', SEQ_NO: 1, PARENT_ITEM: 'P-SF-002', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', NET_QTY: 18.5, LOSS_RATE: 0.05, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF2', BOM_VER: 'V1', SEQ_NO: 2, PARENT_ITEM: 'P-SF-002', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', NET_QTY: 6.2, LOSS_RATE: 0.05, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF2', BOM_VER: 'V1', SEQ_NO: 3, PARENT_ITEM: 'P-SF-002', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', NET_QTY: 0.45, LOSS_RATE: 0.08, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-MB3', BOM_VER: 'V1', SEQ_NO: 1, PARENT_ITEM: 'P-MB-003', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', NET_QTY: 1, LOSS_RATE: 0.01, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-MB3', BOM_VER: 'V1', SEQ_NO: 2, PARENT_ITEM: 'P-MB-003', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', NET_QTY: 0.2, LOSS_RATE: 0.08, LEVEL_NO: 1, SOURCE_SYS: 'MES' }),
    /* 第 2 层：焊接分总成下阶 —— M-Q345B / M-WIRE-ER50 因同时出现在第 1 层，低阶码取 2（MRP 只按最低层展开一次） */
    base({ BOM_NO: 'BOM-SF1-W', BOM_VER: 'V2', SEQ_NO: 1, PARENT_ITEM: 'M-SF-WELD', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', NET_QTY: 17.0, LOSS_RATE: 0.05, LEVEL_NO: 2, SOURCE_SYS: 'MES' }),
    base({ BOM_NO: 'BOM-SF1-W', BOM_VER: 'V2', SEQ_NO: 2, PARENT_ITEM: 'M-SF-WELD', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', NET_QTY: 0.4, LOSS_RATE: 0.08, LEVEL_NO: 2, SOURCE_SYS: 'MES' })
  ];
  /* 工艺路线：只绑"设备类型/工作中心"，不绑台号（与 MES RT_ROUTE_STEP 一致） */
  S.RF_ROUTE = [
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_HOUR: 0.15, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '20', STEP_NAME: '数控精加工', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_HOUR: 0.20, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_HOUR: 0.25, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '40', STEP_NAME: '总成装配', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-ASM', STD_HOUR: 0.12, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '50', STEP_NAME: '自动拧紧', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-TORK', STD_HOUR: 0.06, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.10, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.03, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', RES_GROUP: '', STD_HOUR: 0, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', STEP_NO: '80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', RES_GROUP: 'GRP-WH', STD_HOUR: 0.02, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_HOUR: 0.15, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '20', STEP_NAME: '数控精加工', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_HOUR: 0.20, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_HOUR: 0.25, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '40', STEP_NAME: '总成装配', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-ASM', STD_HOUR: 0.12, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '50', STEP_NAME: '自动拧紧', WORK_CENTER: '动力总成装配区', RES_GROUP: 'GRP-TORK', STD_HOUR: 0.06, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.10, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.03, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', RES_GROUP: '', STD_HOUR: 0, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', STEP_NO: '80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', RES_GROUP: 'GRP-WH', STD_HOUR: 0.02, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', RES_GROUP: 'GRP-CNC', STD_HOUR: 0.12, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', RES_GROUP: 'GRP-RBT', STD_HOUR: 0.18, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.08, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', RES_GROUP: 'GRP-QMS', STD_HOUR: 0.03, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', RES_GROUP: '', STD_HOUR: 0, IS_KEY_STEP: 1, SOURCE_SYS: 'MES' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', STEP_NO: '80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', RES_GROUP: 'GRP-WH', STD_HOUR: 0.02, IS_KEY_STEP: 0, SOURCE_SYS: 'MES' })
  ];
  /* 设备：取 MES 汽配车间 33 台中与排产相关的 17 台生产/检测设备（货架/充电泊位/叉车不进排产资源池） */
  S.RF_EQUIPMENT = [
    base({ EQUIP_NO: 'CNC-001', EQUIP_NAME: 'CNC-001 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'CNC-002', EQUIP_NAME: 'CNC-002 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'CNC-003', EQUIP_NAME: 'CNC-003 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'CNC-004', EQUIP_NAME: 'CNC-004 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'CNC-005', EQUIP_NAME: 'CNC-005 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'CNC-006', EQUIP_NAME: 'CNC-006 立式数控加工中心', EQUIP_TYPE: '加工中心', WORK_CENTER: '数控加工区', STD_CYCLE: 180, EQUIP_STATUS: '待机', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'RBT-008', EQUIP_NAME: 'RBT-008 六轴焊接机器人', EQUIP_TYPE: '焊接机器人', WORK_CENTER: '机器人焊接区', STD_CYCLE: 95, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'RBT-009', EQUIP_NAME: 'RBT-009 六轴焊接机器人', EQUIP_TYPE: '焊接机器人', WORK_CENTER: '机器人焊接区', STD_CYCLE: 95, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'RBT-011', EQUIP_NAME: 'RBT-011 六轴焊接机器人', EQUIP_TYPE: '焊接机器人', WORK_CENTER: '机器人焊接区', STD_CYCLE: 95, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'RBT-012', EQUIP_NAME: 'RBT-012 六轴焊接机器人', EQUIP_TYPE: '焊接机器人', WORK_CENTER: '机器人焊接区', STD_CYCLE: 95, EQUIP_STATUS: '待机', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-013', EQUIP_NAME: 'ASM-013 滚筒装配输送线', EQUIP_TYPE: '装配输送线', WORK_CENTER: '动力总成装配区', STD_CYCLE: 60, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-014', EQUIP_NAME: 'ASM-014 自动拧紧机器人', EQUIP_TYPE: '拧紧机器人', WORK_CENTER: '动力总成装配区', STD_CYCLE: 45, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-015', EQUIP_NAME: 'ASM-015 自动拧紧机器人', EQUIP_TYPE: '拧紧机器人', WORK_CENTER: '动力总成装配区', STD_CYCLE: 45, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-016', EQUIP_NAME: 'ASM-016 滚筒装配输送线', EQUIP_TYPE: '装配输送线', WORK_CENTER: '动力总成装配区', STD_CYCLE: 60, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-017', EQUIP_NAME: 'ASM-017 自动拧紧机器人', EQUIP_TYPE: '拧紧机器人', WORK_CENTER: '动力总成装配区', STD_CYCLE: 45, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'ASM-018', EQUIP_NAME: 'ASM-018 自动拧紧机器人', EQUIP_TYPE: '拧紧机器人', WORK_CENTER: '动力总成装配区', STD_CYCLE: 45, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'QMS-019', EQUIP_NAME: 'QMS-019 三坐标精密测量机', EQUIP_TYPE: '三坐标测量机', WORK_CENTER: '精密检测区', STD_CYCLE: 240, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'QMS-020', EQUIP_NAME: 'QMS-020 三坐标精密测量机', EQUIP_TYPE: '三坐标测量机', WORK_CENTER: '精密检测区', STD_CYCLE: 240, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'QMS-021', EQUIP_NAME: 'QMS-021 在线视觉检测站', EQUIP_TYPE: '视觉检测站', WORK_CENTER: '精密检测区', STD_CYCLE: 30, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' }),
    base({ EQUIP_NO: 'QMS-022', EQUIP_NAME: 'QMS-022 在线视觉检测站', EQUIP_TYPE: '视觉检测站', WORK_CENTER: '精密检测区', STD_CYCLE: 30, EQUIP_STATUS: '运行', SOURCE_SYS: 'MES' })
  ];
  /* 销售订单：与 MES SD_SALES_ORDER_LINE 同口径（ORDER_QTY/DELIVERED_QTY/OPEN_QTY） */
  S.RF_SO = [
    base({ SO_NO: 'SO-2026-001', SEQ_NO: 1, CUSTOMER_CODE: 'C001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ORDER_QTY: 1000, DELIVERED_QTY: 1000, OPEN_QTY: 0, DELIVERY_DATE: '2026-09-30', PRIORITY: '一般', STATUS: '已完工', SOURCE_SYS: 'MES' }),
    base({ SO_NO: 'SO-2026-002', SEQ_NO: 1, CUSTOMER_CODE: 'C002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', ORDER_QTY: 800, DELIVERED_QTY: 0, OPEN_QTY: 800, DELIVERY_DATE: '2026-10-15', PRIORITY: '特急', STATUS: '执行中', SOURCE_SYS: 'MES' }),
    base({ SO_NO: 'SO-2026-002', SEQ_NO: 2, CUSTOMER_CODE: 'C002', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', ORDER_QTY: 500, DELIVERED_QTY: 0, OPEN_QTY: 500, DELIVERY_DATE: '2026-10-20', PRIORITY: '急', STATUS: '执行中', SOURCE_SYS: 'MES' })
  ];
  /* 库存：与 MES WM_STOCK 同口径（含库位/质检状态/冻结量） */
  S.RF_STOCK = [
    base({ STOCK_ID: 'STK-001', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', WAREHOUSE: '原料仓', LOT_NO: 'LOT-TG260903', ONHAND_QTY: 16000, AVAILABLE_QTY: 16000, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-002', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', WAREHOUSE: '原料仓', LOT_NO: 'LOT-TG260904', ONHAND_QTY: 4900, AVAILABLE_QTY: 4900, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-003', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', WAREHOUSE: '原料仓', LOT_NO: 'LOT-MZ260905', ONHAND_QTY: 88, AVAILABLE_QTY: 88, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-004', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', WAREHOUSE: '原料仓', LOT_NO: '', ONHAND_QTY: 3600, AVAILABLE_QTY: 3600, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-005', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', WAREHOUSE: '原料仓', LOT_NO: '', ONHAND_QTY: 180, AVAILABLE_QTY: 180, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-006', ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', WAREHOUSE: '原料仓', LOT_NO: '', ONHAND_QTY: 12, AVAILABLE_QTY: 12, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-007', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', WAREHOUSE: '半成品仓', LOT_NO: 'LOT-SO001-A', ONHAND_QTY: 0, AVAILABLE_QTY: 0, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-008', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', WAREHOUSE: '成品仓', LOT_NO: 'LOT-SO001-A', ONHAND_QTY: 0, AVAILABLE_QTY: 0, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-009', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', WAREHOUSE: '成品仓', LOT_NO: 'LOT-F-20260831-01', ONHAND_QTY: 500, AVAILABLE_QTY: 500, QC_QTY: 0, SOURCE_SYS: 'MES' }),
    base({ STOCK_ID: 'STK-010', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', WAREHOUSE: '成品仓', LOT_NO: 'LOT-F-20260903-03', ONHAND_QTY: 790, AVAILABLE_QTY: 790, QC_QTY: 0, SOURCE_SYS: 'MES' })
  ];
  S.RF_PO_ONWAY = [
    base({ PO_NO: 'PO-2026-0003', SEQ_NO: 1, SUPPLIER_CODE: 'S004', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', ORDER_QTY: 16000, ARRIVED_QTY: 0, OWING_QTY: 16000, DELIVERY_DATE: '2026-09-25', SOURCE_SYS: 'MES' })
  ];
  /* 工单：与 MES EX_WORK_ORDER 同口径（SO-001 拆 5 单 × 200 件，已全部入库；SO-002 在制） */
  S.RF_WORK_ORDER = [
    /* 9 月工单随 SO-2026-001（1000 件，交期 9/30）按周分批下达：第 2 周 400 / 第 3 周 400 / 第 4 周 200，
     * 所以 9 月的排产天然覆盖 9/06、9/14、9/21 三周，而不是挤在月初几天。 */
    base({ WO_NO: 'WO-2026-0001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ROUTE_NO: 'RT-SF1', PLAN_QTY: 200, FINISH_QTY: 200, PLAN_START: '2026-09-06', PLAN_END: '2026-09-08', DEPT_CLASS: '焊装课', PRIORITY: 1, STATUS: '已入库', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0002', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ROUTE_NO: 'RT-SF1', PLAN_QTY: 200, FINISH_QTY: 200, PLAN_START: '2026-09-06', PLAN_END: '2026-09-08', DEPT_CLASS: '焊装课', PRIORITY: 1, STATUS: '已入库', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0003', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ROUTE_NO: 'RT-SF1', PLAN_QTY: 200, FINISH_QTY: 200, PLAN_START: '2026-09-14', PLAN_END: '2026-09-16', DEPT_CLASS: '焊装课', PRIORITY: 1, STATUS: '已入库', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0004', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ROUTE_NO: 'RT-SF1', PLAN_QTY: 200, FINISH_QTY: 200, PLAN_START: '2026-09-14', PLAN_END: '2026-09-16', DEPT_CLASS: '焊装课', PRIORITY: 1, STATUS: '已入库', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0005', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ROUTE_NO: 'RT-SF1', PLAN_QTY: 200, FINISH_QTY: 200, PLAN_START: '2026-09-21', PLAN_END: '2026-09-23', DEPT_CLASS: '焊装课', PRIORITY: 1, STATUS: '已入库', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0006', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', ROUTE_NO: 'RT-MB3', PLAN_QTY: 800, FINISH_QTY: 0, PLAN_START: '2026-09-28', PLAN_END: '2026-10-12', DEPT_CLASS: '焊装课', PRIORITY: 2, STATUS: '执行中', SOURCE_SYS: 'MES' }),
    base({ WO_NO: 'WO-2026-0007', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', ROUTE_NO: 'RT-SF2', PLAN_QTY: 500, FINISH_QTY: 0, PLAN_START: '2026-09-28', PLAN_END: '2026-10-18', DEPT_CLASS: '焊装课', PRIORITY: 3, STATUS: '已下达', SOURCE_SYS: 'MES' })
  ];

  /* ==================================================================
   * ⑦ 系统（SYS）
   * ================================================================== */
  S.SYS_DICT = [
    base({ DICT_CODE: 'D1001', DICT_NAME: '需求来源', DICT_TYPE: 'DEMAND_SOURCE', ITEM_CODE: '销售订单', ITEM_NAME: '销售订单', ITEM_VALUE: 'SO', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1004', DICT_NAME: '需求来源', DICT_TYPE: 'DEMAND_SOURCE', ITEM_CODE: '库存补充', ITEM_NAME: '库存补充', ITEM_VALUE: 'MINMAX', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1005', DICT_NAME: '排程方向', DICT_TYPE: 'SCH_DIR', ITEM_CODE: '正排', ITEM_NAME: '正排', ITEM_VALUE: 'FW', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1006', DICT_NAME: '排程方向', DICT_TYPE: 'SCH_DIR', ITEM_CODE: '倒排', ITEM_NAME: '倒排', ITEM_VALUE: 'BW', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1007', DICT_NAME: '排程方向', DICT_TYPE: 'SCH_DIR', ITEM_CODE: '双向', ITEM_NAME: '双向', ITEM_VALUE: 'BOTH', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1008', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '白班', ITEM_NAME: '白班', ITEM_VALUE: 'D', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1009', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '中班', ITEM_NAME: '中班', ITEM_VALUE: 'M', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1010', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '晚班', ITEM_NAME: '晚班', ITEM_VALUE: 'N', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1011', DICT_NAME: '负荷预警级别', DICT_TYPE: 'LOAD_WARN', ITEM_CODE: '正常', ITEM_NAME: '正常(<85%)', ITEM_VALUE: 'OK', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1012', DICT_NAME: '负荷预警级别', DICT_TYPE: 'LOAD_WARN', ITEM_CODE: '黄色预警', ITEM_NAME: '黄色预警(85~90%)', ITEM_VALUE: 'YELLOW', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1013', DICT_NAME: '负荷预警级别', DICT_TYPE: 'LOAD_WARN', ITEM_CODE: '红色预警', ITEM_NAME: '红色预警(>90%)', ITEM_VALUE: 'RED', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1014', DICT_NAME: '调整类型', DICT_TYPE: 'ADJ_TYPE', ITEM_CODE: '拖拽调整', ITEM_NAME: '拖拽调整', ITEM_VALUE: 'DRAG', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'D1015', DICT_NAME: '调整类型', DICT_TYPE: 'ADJ_TYPE', ITEM_CODE: '插单', ITEM_NAME: '插单', ITEM_VALUE: 'RUSH', SORT_NO: 2, ENABLE_FLAG: 1 })
  ];
  S.SYS_CODE_RULE = [
    base({ RULE_CODE: 'BR-DEM', BIZ_TYPE: '需求源', PREFIX: 'DEM', DATE_FMT: 'yyyy-MM', FLOW_LEN: 4, CUR_NO: 4, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'BR-PR', BIZ_TYPE: '补料建议', PREFIX: 'PR', DATE_FMT: 'yyyy', FLOW_LEN: 4, CUR_NO: 3, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'BR-SCHV', BIZ_TYPE: '排程版本', PREFIX: 'SCHV', DATE_FMT: 'yyyy-MMdd', FLOW_LEN: 1, CUR_NO: 3, ENABLE_FLAG: 1 })
  ];
  S.SYS_AUDIT_LOG = [
    base({ LOG_ID: 'LOG-0001', TABLE_NAME: 'SCH_VERSION', RECORD_ID: 'SCHV-2026-0928-A', ACTION: '发布', FIELD_DIFF: 'STATUS: 已确认→已发布', OPERATOR: '周杰', OP_TIME: '2026-09-28 08:10:00', REMARK: '排程发布，回写 MES 排程单' }),
    base({ LOG_ID: 'LOG-0003', TABLE_NAME: 'SCH_RULE', RECORD_ID: 'RULE-01', ACTION: '修改', FIELD_DIFF: 'BOTTLENECK_STEP: →机器人焊接', OPERATOR: '孙倩', OP_TIME: '2026-09-27 14:30:00', REMARK: '设定瓶颈工序为机器人焊接' })
  ];
  S.SYS_ATTACHMENT = [
    base({ ATTACH_ID: 'ATT-0002', BIZ_TYPE: 'SCH_VERSION', BIZ_ID: 'SCHV-2026-0928-A', FILE_NAME: '排程对比说明_0928A.pdf', FILE_URL: '/files/sch-0928a.pdf', FILE_SIZE: 156732, UPLOAD_BY: '周杰', UPLOAD_TIME: '2026-09-28 08:05:00' })
  ];
  /* 单据上下游关联台账：由 CHAIN 声明表程序化生成，避免手写遗漏 */
  var CHAIN = [
    /* ============ 8/31（上线后首个滚动日）：销售订单需求源 → 需求计算版本 → 平级产出 ============ */
    ['BAS_DEMAND', 'DEM-2026-0831', 'MRP_BATCH', 'MRP-2026-0831', '执行物料需求计算', '2026-08-31 09:20:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_NET_REQ', 'NR-0831-01', '展开净需求', '2026-08-31 09:21:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_NET_REQ', 'NR-0831-05', '展开净需求', '2026-08-31 09:21:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_KIT_CHECK', 'KIT-2026-0831-A', '执行齐套检查', '2026-09-02 09:30:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_KIT_CHECK', 'KIT-2026-0831-B', '执行齐套检查', '2026-09-02 09:31:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_KIT_CHECK', 'KIT-2026-0831-C', '执行齐套检查', '2026-09-03 08:40:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0831-A', 'MRP_KIT_SHORT', 'SH-2026-0831-01', '生成缺料明细', '2026-09-02 09:35:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0831-A', 'MRP_KIT_SHORT', 'SH-2026-0831-02', '生成缺料明细', '2026-09-02 09:35:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0831-C', 'MRP_KIT_SHORT', 'SH-2026-0831-03', '生成缺料明细', '2026-09-03 08:45:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'PR_SUGGEST', 'PR-2026-0001', '生成补料建议', '2026-08-29 15:20:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'PP_PLAN_SUGGEST', 'PS-2026-0001', '生成生产计划建议', '2026-08-31 10:00:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'PP_PLAN_SUGGEST', 'PS-2026-0002', '生成生产计划建议', '2026-08-31 10:05:00'],
    ['PP_PLAN_SUGGEST', 'PS-2026-0001', 'SCH_VERSION', 'SCHV-2026-0831-A', '执行自动排程', '2026-08-31 08:40:00'],
    ['SCH_RULE', 'RULE-01', 'SCH_VERSION', 'SCHV-2026-0831-A', '按规则排程', '2026-08-31 08:40:00'],
    ['SCH_VERSION', 'SCHV-2026-0831-A', 'SCH_DAY_PLAN', 'DP-0831A-001', '细化日排产', '2026-08-31 08:50:00'],
    /* ============ 9 月第 2 周（9/07）：周滚动复核 + 排程重排 ============ */
    ['BAS_DEMAND', 'DEM-2026-0831', 'MRP_BATCH', 'MRP-2026-0907', '执行物料需求计算', '2026-09-07 09:05:00'],
    ['MRP_BATCH', 'MRP-2026-0907', 'MRP_NET_REQ', 'NR-0907-01', '展开净需求', '2026-09-07 09:06:00'],
    ['MRP_BATCH', 'MRP-2026-0907', 'MRP_NET_REQ', 'NR-0907-02', '展开净需求', '2026-09-07 09:06:00'],
    ['MRP_BATCH', 'MRP-2026-0831', 'MRP_KIT_CHECK', 'KIT-2026-0908-A', '执行齐套检查', '2026-09-08 09:10:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0908-A', 'MRP_KIT_SHORT', 'SH-2026-0908-01', '生成缺料明细', '2026-09-08 09:15:00'],
    ['SCH_RULE', 'RULE-01', 'SCH_VERSION', 'SCHV-2026-0907-A', '按规则排程', '2026-09-07 08:30:00'],
    ['SCH_VERSION', 'SCHV-2026-0907-A', 'SCH_DAY_PLAN', 'DP-0907A-001', '细化日排产', '2026-09-07 08:40:00'],
    /* ============ 9 月第 3 周（9/14）：换 RULE-02 复核与重排 ============ */
    ['BAS_DEMAND', 'DEM-2026-0831', 'MRP_BATCH', 'MRP-2026-0914', '执行物料需求计算', '2026-09-14 09:00:00'],
    ['MRP_BATCH', 'MRP-2026-0914', 'MRP_NET_REQ', 'NR-0914-01', '展开净需求', '2026-09-14 09:01:00'],
    ['MRP_BATCH', 'MRP-2026-0914', 'MRP_KIT_CHECK', 'KIT-2026-0914-A', '执行齐套检查', '2026-09-14 09:20:00'],
    ['SCH_RULE', 'RULE-02', 'SCH_VERSION', 'SCHV-2026-0914-A', '按规则排程', '2026-09-14 08:30:00'],
    ['SCH_VERSION', 'SCHV-2026-0914-A', 'SCH_DAY_PLAN', 'DP-0914A-001', '细化日排产', '2026-09-14 08:40:00'],
    /* ============ 9 月第 4 周（9/21）：周滚动复核 + 排程重排 ============ */
    ['BAS_DEMAND', 'DEM-2026-0831', 'MRP_BATCH', 'MRP-2026-0921', '执行物料需求计算', '2026-09-21 09:15:00'],
    ['MRP_BATCH', 'MRP-2026-0921', 'MRP_NET_REQ', 'NR-0921-01', '展开净需求', '2026-09-21 09:16:00'],
    ['MRP_BATCH', 'MRP-2026-0921', 'MRP_KIT_CHECK', 'KIT-2026-0921-A', '执行齐套检查', '2026-09-21 09:30:00'],
    ['SCH_RULE', 'RULE-01', 'SCH_VERSION', 'SCHV-2026-0921-A', '按规则排程', '2026-09-21 08:30:00'],
    ['SCH_VERSION', 'SCHV-2026-0921-A', 'SCH_DAY_PLAN', 'DP-0921A-001', '细化日排产', '2026-09-21 08:40:00'],
    /* ============ 9 月第 5 周（9/28）：SO-2026-002 下达 → 全量重算 + 排程 ============ */
    ['BAS_DEMAND', 'DEM-2026-0928', 'MRP_BATCH', 'MRP-2026-0928', '执行物料需求计算', '2026-09-28 09:20:00'],
    ['BAS_DEMAND', 'DEM-2026-0928-S', 'MRP_BATCH', 'MRP-2026-0928', '执行物料需求计算', '2026-09-28 09:20:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'MRP_NET_REQ', 'NR-0928-01', '展开净需求', '2026-09-28 09:21:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'MRP_KIT_CHECK', 'KIT-2026-0928-A', '执行齐套检查', '2026-09-28 09:30:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'MRP_KIT_CHECK', 'KIT-2026-0928-B', '执行齐套检查', '2026-09-28 09:31:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'MRP_KIT_CHECK', 'KIT-2026-0928-C', '执行齐套检查', '2026-09-28 09:32:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0928-A', 'MRP_KIT_SHORT', 'SH-2026-0928-03', '生成缺料明细', '2026-09-28 09:36:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0928-B', 'MRP_KIT_SHORT', 'SH-2026-0928-01', '生成缺料明细', '2026-09-28 09:35:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-0928-B', 'MRP_KIT_SHORT', 'SH-2026-0928-02', '生成缺料明细', '2026-09-28 09:35:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'PP_PLAN_SUGGEST', 'PS-2026-0004', '生成生产计划建议', '2026-09-28 10:00:00'],
    ['MRP_BATCH', 'MRP-2026-0928', 'PR_SUGGEST', 'PR-2026-0006', '生成补料建议', '2026-10-02 09:00:00'],
    ['SCH_RULE', 'RULE-01', 'SCH_VERSION', 'SCHV-2026-0928-A', '按规则排程', '2026-09-28 07:30:00'],
    ['SCH_VERSION', 'SCHV-2026-0928-A', 'SCH_DAY_PLAN', 'DP-0928A-001', '细化日排产', '2026-09-28 07:40:00'],
    ['SCH_VERSION', 'SCHV-2026-0928-A', 'SCH_ADJUST', 'ADJ-2026-0001', '登记人工调整', '2026-09-28 09:10:00'],
    ['IF_CONFIG', 'IF-ERP-R', 'IF_RUN_LOG', 'IFLOG-0002', '生成运行日志', '2026-09-28 08:00:00'],
    ['IF_CONFIG', 'IF-MES', 'IF_RUN_LOG', 'IFLOG-0001', '生成运行日志', '2026-09-28 08:10:00'],
    /* ============ 10 月第 1 周（10/05）：库存补充轮次 + 月度复核（RULE-02） ============ */
    ['BAS_DEMAND', 'DEM-2026-1005-S', 'MRP_BATCH', 'MRP-2026-1005', '执行物料需求计算', '2026-10-05 09:10:00'],
    ['MRP_BATCH', 'MRP-2026-1005', 'MRP_NET_REQ', 'NR-1005-03', '展开净需求', '2026-10-05 09:11:00'],
    ['MRP_BATCH', 'MRP-2026-1005', 'MRP_KIT_CHECK', 'KIT-2026-1006-A', '执行齐套检查', '2026-10-06 09:10:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-1006-A', 'MRP_KIT_SHORT', 'SH-2026-1006-01', '生成缺料明细', '2026-10-06 09:15:00'],
    ['MRP_BATCH', 'MRP-2026-1005', 'PR_SUGGEST', 'PR-2026-0007', '生成补料建议', '2026-10-05 15:20:00'],
    ['MRP_BATCH', 'MRP-2026-1005', 'MRP_KIT_CHECK', 'KIT-2026-1013-A', '执行齐套检查', '2026-10-13 08:30:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-1013-A', 'MRP_KIT_SHORT', 'SH-2026-1013-01', '生成缺料明细', '2026-10-13 08:35:00'],
    ['SCH_RULE', 'RULE-02', 'SCH_VERSION', 'SCHV-2026-1005-A', '按规则排程', '2026-10-05 17:30:00'],
    ['SCH_VERSION', 'SCHV-2026-1005-A', 'SCH_DAY_PLAN', 'DP-1005A-001', '细化日排产', '2026-10-05 17:40:00'],
    ['IF_CONFIG', 'IF-ERP-W', 'IF_RUN_LOG', 'IFLOG-0003', '生成运行日志', '2026-10-05 09:05:00'],
    ['IF_CONFIG', 'IF-ERP-W', 'IF_RUN_LOG', 'IFLOG-0004', '生成运行日志', '2026-10-05 09:20:00'],
    /* ============ 10 月第 2 周（10/12）：本周滚动（RULE-03，当前生效版本） ============ */
    ['BAS_DEMAND', 'DEM-2026-0928', 'MRP_BATCH', 'MRP-2026-1012', '执行物料需求计算', '2026-10-12 08:30:00'],
    ['MRP_BATCH', 'MRP-2026-1012', 'MRP_NET_REQ', 'NR-1012-01', '展开净需求', '2026-10-12 08:31:00'],
    ['MRP_BATCH', 'MRP-2026-1012', 'MRP_NET_REQ', 'NR-1012-02', '展开净需求', '2026-10-12 08:31:00'],
    ['MRP_BATCH', 'MRP-2026-1012', 'MRP_KIT_CHECK', 'KIT-2026-1012-A', '执行齐套检查', '2026-10-12 08:40:00'],
    ['MRP_KIT_CHECK', 'KIT-2026-1012-A', 'MRP_KIT_SHORT', 'SH-2026-1012-01', '生成缺料明细', '2026-10-12 08:45:00'],
    ['SCH_RULE', 'RULE-03', 'SCH_VERSION', 'SCHV-2026-1012-A', '按规则排程', '2026-10-12 08:30:00'],
    ['SCH_VERSION', 'SCHV-2026-1012-A', 'SCH_DAY_PLAN', 'DP-1012A-001', '细化日排产', '2026-10-12 08:40:00'],
    ['SCH_VERSION', 'SCHV-2026-1012-A', 'SCH_EXCEPTION', 'EXC-2026-0004', '派生排产异常', '2026-10-12 08:50:00']
  ];
  S.SYS_DOC_LINK = CHAIN.map(function (c, i) {
    return base({
      LINK_ID: 'LNK-' + ('000' + (i + 1)).slice(-3), FROM_TABLE: c[0], FROM_NO: c[1],
      TO_TABLE: c[2], TO_NO: c[3], FLOW_LABEL: c[4], LINK_TIME: c[5], REMARK: '流转生成'
    });
  });

  /* ==================================================================
   * 落库时间回填 —— 让时间线像真实系统，而不是「全库同一秒导入」
   * ① 版本派生的排程记录（任务 / 日排产 / 异常 / 人工调整）：创建时间 = 所属排程版本的生成时间；
   * ② 没有业务日期的配置类 / 快照类记录：按功能域错开到 APS 上线的准备期（8/25~8/28）。
   * ================================================================== */
  (function () {
    var verTime = {};
    (S.SCH_VERSION || []).forEach(function (v) { verTime[v.VERSION_NO] = v.GEN_TIME || ''; });
    ['SCH_TASK', 'SCH_DAY_PLAN', 'SCH_EXCEPTION', 'SCH_ADJUST'].forEach(function (t) {
      (S[t] || []).forEach(function (r) {
        var g = verTime[r.VERSION_NO];
        if (g) { r.CREATE_TIME = g; r.UPDATE_TIME = g; }
      });
    });
    var DOMAIN_DAY = [
      [/^SYS_/, '2026-08-25 10:00:00'],   /* 系统：字典 / 编码规则 / 审计日志…（实施准备期先配） */
      [/^RF_/, '2026-08-26 09:00:00'],    /* MES 主数据快照：首次全量同步 */
      [/^BAS_/, '2026-08-27 09:30:00'],   /* 计划基础数据：物料计划属性 / 资源 / 日历 / 换型 */
      [/^IF_/, '2026-08-27 14:00:00']     /* 集成配置：接口注册 */
    ];
    Object.keys(S).forEach(function (t) {
      if (!Array.isArray(S[t]) || !S[t].length || /^RPT_/.test(t)) return;
      DOMAIN_DAY.forEach(function (d) {
        if (!d[0].test(t)) return;
        S[t].forEach(function (r) {
          if (r.CREATE_TIME === MASTER_TIME) { r.CREATE_TIME = d[1]; r.UPDATE_TIME = d[1]; }
        });
      });
    });
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  if (root) root.APS_SEED = S;
})(typeof window !== 'undefined' ? window : null);
