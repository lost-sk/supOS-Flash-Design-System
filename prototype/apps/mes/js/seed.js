/*
 * seed.js —— 演示种子数据（汽配车间 · 副车架 / 车身结构件场景 · 汽配一厂）
 * 设定 window.MES_SEED = { 表名: [记录...] }
 * 行业剧本：常州蓝驰新能源 / 合肥众驰 向本厂采购 前/后副车架总成、电驱动悬置支架，
 *   车间设备与内网 supOS「汽配车间」1:1 对应（33 台 = 29 台设备 + 4 个货架，见 MD_EQUIPMENT）。
 *   覆盖 报价→销售订单→请购比价→采购→到货→IQC→采购入库→生产计划→工单→排程→领料
 *   →数控加工/机器人焊接/总成装配/自动拧紧→IPQC→返工/报废→FQC→完工入库→成品上架→销货出库；
 *   以及 设备点检/保养/巡检/报修/OEE、班组排班、班组交接、日报、绩效、看板 全链路。
 *   （已按需求取消「进货单」「MRP 展开结果」两个环节）
 * 工序口径：前面工序按「设备类型」绑定（RT_ROUTE_STEP.EQUIP_TYPE），
 *   实际排产/报工按「具体台号」绑定（PP_SCHEDULE / EX_WO_STEP / EX_REPORT.EQUIP_NO）。
 * 单据日期集中在 2026-08-25 ~ 2026-09-18，保证看板「本月 / 本周」筛选有数据。
 * 每条记录已补全通用字段（ID/ORG_ID/审计/DEL_FLAG/VER_NO/REMARK/EXT_JSON）。
 */
(function (root) {
  'use strict';
  var ORG = 'ORG1'; // 汽配一厂
  var n = 0;
  function id(p) { n++; return (p || 'ID') + String(100000 + n); }
  function base(extra) {
    var r = {
      ID: id('SEED'), ORG_ID: ORG, CREATE_BY: 'SYS', CREATE_TIME: '2026-09-01 08:00:00',
      UPDATE_BY: null, UPDATE_TIME: null, DEL_FLAG: 0, VER_NO: 1, REMARK: '', EXT_JSON: null
    };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  /* 单据类记录：在 base 之上补 DOC 默认值（extra 可覆盖） */
  function doc(extra) {
    var r = base(extra);
    if (r.AUDIT_STATUS === undefined) r.AUDIT_STATUS = '已审核';
    if (r.AUDIT_BY === undefined) r.AUDIT_BY = '周杰';
    if (r.AUDIT_TIME === undefined) r.AUDIT_TIME = r.DOC_DATE ? (r.DOC_DATE + ' 09:00:00') : '2026-09-01 09:00:00';
    if (r.PRINT_TIMES === undefined) r.PRINT_TIMES = 0;
    if (r.ATTACH_URLS === undefined) r.ATTACH_URLS = null;
    if (r.MAKER === undefined) r.MAKER = '孙倩';
    if (r.MAKE_TIME === undefined) r.MAKE_TIME = '2026-09-01 08:30:00';
    return r;
  }
  var S = {};

  /* ==================== 设备厂家（作为「设备类供应商」登记，供 MD_EQUIPMENT.MANUFACTURER 引用） ==================== */
  var MFG = {
    cnc: '海天精工股份有限公司',
    rbt: '上海发那科机器人有限公司',
    asm: '德马科技集团股份有限公司',
    tork: '阿特拉斯·科普柯(上海)贸易有限公司',
    cmm: '卡尔蔡司(上海)管理有限公司',
    vis: '康耐视视觉检测系统(上海)有限公司',
    shelf: '南京音飞储存设备(集团)股份有限公司',
    agv: '杭州海康机器人股份有限公司',
    fork: '安徽合力股份有限公司',
    jig: '自制(工装夹具)'
  };

  /* ==================== 工厂建模 ==================== */
  S.MD_CUSTOMER = [
    base({ CUSTOMER_CODE: 'C001', CUSTOMER_NAME: '常州蓝驰新能源汽车有限公司', SHORT_NAME: '常州蓝驰', PART_NO_RULE: 'LD-*', CONTACT: '王经理', TEL: '0519-88123456', FAX: '0519-88123457', ADDRESS: '江苏省常州市武进国家高新区龙潜路20号', SETTLE_TYPE: '月结60天', CREDIT_LIMIT: 3000000, LEAD_TIME_DAYS: 30, TAX_TYPE: '增值税', TAX_RATE: 0.13, CURRENCY: 'CNY', CUSTOMER_CLASS: '战略', SALES_OWNER: '马晓东', ENABLE_FLAG: 1, ENABLE_FROM: '2025-01-01' }),
    base({ CUSTOMER_CODE: 'C002', CUSTOMER_NAME: '合肥众驰变速器有限公司', SHORT_NAME: '合肥众驰', PART_NO_RULE: 'ZC-*', CONTACT: '李经理', TEL: '0551-65321111', ADDRESS: '安徽省合肥市经开区始信路136号', SETTLE_TYPE: '月结45天', CREDIT_LIMIT: 1500000, LEAD_TIME_DAYS: 45, TAX_TYPE: '增值税', TAX_RATE: 0.13, CURRENCY: 'CNY', CUSTOMER_CLASS: '大客户', SALES_OWNER: '马晓东', ENABLE_FLAG: 1, ENABLE_FROM: '2025-06-01' })
  ];
  /* 供应商：S001~S004 为物料/外协供方，S005~S013 为设备厂家（与 MD_EQUIPMENT.MANUFACTURER 同名可对） */
  S.MD_SUPPLIER = [
    base({ SUPPLIER_CODE: 'S001', SUPPLIER_NAME: '江苏天工特殊钢股份有限公司', SUPPLY_CATEGORY: '结构钢板/无缝钢管', PAY_TERM: '月结30天', LEAD_TIME_DAYS: 7, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ SUPPLIER_CODE: 'S002', SUPPLIER_NAME: '宁波明铸冲压件有限公司', SUPPLY_CATEGORY: '冲压件毛坯', PAY_TERM: '月结30天', LEAD_TIME_DAYS: 10, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2024-03-01' }),
    base({ SUPPLIER_CODE: 'S003', SUPPLIER_NAME: '苏州金泰表面处理有限公司', SUPPLY_CATEGORY: '外协表面处理(电泳涂装)', PAY_TERM: '月结15天', LEAD_TIME_DAYS: 3, GRADE: 'B', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2024-06-01' }),
    base({ SUPPLIER_CODE: 'S004', SUPPLIER_NAME: '上海恒固紧固件有限公司', SUPPLY_CATEGORY: '高强度螺栓/橡胶衬套', PAY_TERM: '款到发货', LEAD_TIME_DAYS: 15, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2025-02-01' }),
    base({ SUPPLIER_CODE: 'S005', SUPPLIER_NAME: MFG.cnc, SUPPLY_CATEGORY: '设备-数控加工中心', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 90, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2022-04-01' }),
    base({ SUPPLIER_CODE: 'S006', SUPPLIER_NAME: MFG.rbt, SUPPLY_CATEGORY: '设备-焊接机器人', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 75, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-02-01' }),
    base({ SUPPLIER_CODE: 'S007', SUPPLIER_NAME: MFG.asm, SUPPLY_CATEGORY: '设备-装配输送线', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 60, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-04-01' }),
    base({ SUPPLIER_CODE: 'S008', SUPPLIER_NAME: MFG.tork, SUPPLY_CATEGORY: '设备-自动拧紧系统', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 60, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-04-01' }),
    base({ SUPPLIER_CODE: 'S009', SUPPLIER_NAME: MFG.cmm, SUPPLY_CATEGORY: '设备-三坐标测量机', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 120, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2022-10-01' }),
    base({ SUPPLIER_CODE: 'S010', SUPPLIER_NAME: MFG.vis, SUPPLY_CATEGORY: '设备-机器视觉系统', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 45, GRADE: 'B', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2022-10-01' }),
    base({ SUPPLIER_CODE: 'S011', SUPPLIER_NAME: MFG.shelf, SUPPLY_CATEGORY: '设备-仓储货架', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 30, GRADE: 'B', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-01-01' }),
    base({ SUPPLIER_CODE: 'S012', SUPPLIER_NAME: MFG.agv, SUPPLY_CATEGORY: '设备-AGV移动机器人', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 60, GRADE: 'A', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-07-01' }),
    base({ SUPPLIER_CODE: 'S013', SUPPLIER_NAME: MFG.fork, SUPPLY_CATEGORY: '设备-电动叉车', PAY_TERM: '验收后30天', LEAD_TIME_DAYS: 30, GRADE: 'B', QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2023-07-01' })
  ];
  S.MD_SUPPLIER_PERF = [
    base({ SUPPLIER_CODE: 'S001', YEAR: 2025, ITEM_NAME: 'Q345B结构钢板', PART_NO: 'M-Q345B', SUBMIT_DATE: '2025-12-20', ARRIVAL_BATCH_QTY: 96, QUALIFIED_BATCH_QTY: 95, BATCH_PASS_RATE: 0.9896, MAKER: '王芳', MAKE_DATE: '2025-12-31' }),
    base({ SUPPLIER_CODE: 'S002', YEAR: 2025, ITEM_NAME: '冲压件毛坯', PART_NO: 'M-SF-BLANK', SUBMIT_DATE: '2025-12-20', ARRIVAL_BATCH_QTY: 48, QUALIFIED_BATCH_QTY: 46, BATCH_PASS_RATE: 0.9583, MAKER: '王芳', MAKE_DATE: '2025-12-31' }),
    base({ SUPPLIER_CODE: 'S003', YEAR: 2025, ITEM_NAME: '电泳涂装外协', PART_NO: 'M-SF-WELD', SUBMIT_DATE: '2025-12-20', ARRIVAL_BATCH_QTY: 72, QUALIFIED_BATCH_QTY: 70, BATCH_PASS_RATE: 0.9722, MAKER: '王芳', MAKE_DATE: '2025-12-31' })
  ];
  /* 说明：原「到货及时率(MD_SUPPLIER_DELIVERY_RATE)」已按需求移除。 */
  S.MD_PRODUCT = [
    base({ PRODUCT_NO: 'P-SF-001', PRODUCT_NAME: '前副车架总成', CUSTOMER_PART_NO: 'LD-31001', CUSTOMER_CODE: 'C001', INTERNAL_DRAWING_NO: 'JN-SF-3101', PART_DRAWING_NO: 'SF-3101', SPEC: 'Q345B 焊接总成', MODEL: 'SF-01', UNIT: '件', PART_CATEGORY: '成品', MACHINE_TYPE: '副车架', LINE_CODE: 'L1', DEPT_CLASS: '焊装课', DRAWING_VER: 'B', ENABLE_FLAG: 1, ENABLE_FROM: '2025-03-01' }),
    base({ PRODUCT_NO: 'P-SF-002', PRODUCT_NAME: '后副车架总成', CUSTOMER_PART_NO: 'LD-31002', CUSTOMER_CODE: 'C001', INTERNAL_DRAWING_NO: 'JN-SF-3102', PART_DRAWING_NO: 'SF-3102', SPEC: 'Q345B 焊接总成', MODEL: 'SF-02', UNIT: '件', PART_CATEGORY: '成品', MACHINE_TYPE: '副车架', LINE_CODE: 'L1', DEPT_CLASS: '焊装课', DRAWING_VER: 'A', ENABLE_FLAG: 1, ENABLE_FROM: '2025-03-01' }),
    base({ PRODUCT_NO: 'P-MB-003', PRODUCT_NAME: '电驱动悬置支架', CUSTOMER_PART_NO: 'ZC-24003', CUSTOMER_CODE: 'C002', INTERNAL_DRAWING_NO: 'JN-MB-2403', PART_DRAWING_NO: 'MB-2403', SPEC: 'Q345B 冲焊件', MODEL: 'MB-01', UNIT: '件', PART_CATEGORY: '成品', MACHINE_TYPE: '悬置支架', LINE_CODE: 'L2', DEPT_CLASS: '焊装课', DRAWING_VER: 'C', ENABLE_FLAG: 1, ENABLE_FROM: '2024-09-01' })
  ];
  S.MD_BOM_HEAD = [
    base({ BOM_NO: 'BOM-SF1', CUSTOMER_NAME: '常州蓝驰新能源汽车有限公司', PROJECT_NO: 'PRJ-SF01', PART_DRAWING_NO: 'SF-3101', PART_NAME: '前副车架总成', BOM_STATUS: '正式', BOM_VER: 'V2', EFFECT_DATE: '2026-06-01', AUDIT_STATUS: '已发布', FORM_NO: 'Q/SF2004-04-B/1' }),
    base({ BOM_NO: 'BOM-SF2', CUSTOMER_NAME: '常州蓝驰新能源汽车有限公司', PROJECT_NO: 'PRJ-SF01', PART_DRAWING_NO: 'SF-3102', PART_NAME: '后副车架总成', BOM_STATUS: '正式', BOM_VER: 'V1', EFFECT_DATE: '2025-03-01', AUDIT_STATUS: '已发布', FORM_NO: 'Q/SF2004-04-B/2' }),
    base({ BOM_NO: 'BOM-MB3', CUSTOMER_NAME: '合肥众驰变速器有限公司', PROJECT_NO: 'PRJ-MB01', PART_DRAWING_NO: 'MB-2403', PART_NAME: '电驱动悬置支架', BOM_STATUS: '正式', BOM_VER: 'V1', EFFECT_DATE: '2024-09-01', AUDIT_STATUS: '已发布', FORM_NO: 'Q/SF2004-04-B/3' })
  ];
  S.MD_BOM_LINE = [
    base({ BOM_NO: 'BOM-SF1', SEQ_NO: 1, PARENT_ITEM_CODE: 'P-SF-001', ITEM_NAME: '副车架焊接分总成', ITEM_CATEGORY: '半成品', ERP_ITEM_CODE: 'M-SF-WELD', UNIT: '件', NET_QTY: 1, GROSS_QTY: 1, LOSS_RATE: 0, LEVEL_NO: 1, EFFECT_DATE: '2026-06-01' }),
    base({ BOM_NO: 'BOM-SF1', SEQ_NO: 2, PARENT_ITEM_CODE: 'P-SF-001', ITEM_NAME: '橡胶衬套总成', ITEM_CATEGORY: '外购件', ERP_ITEM_CODE: 'M-BUSH-01', UNIT: '套', NET_QTY: 4, LOSS_RATE: 0, LEVEL_NO: 1, EFFECT_DATE: '2026-06-01' }),
    base({ BOM_NO: 'BOM-SF1', SEQ_NO: 3, PARENT_ITEM_CODE: 'P-SF-001', ITEM_NAME: '高强度螺栓M12×60', ITEM_CATEGORY: '外购件', ERP_ITEM_CODE: 'M-BOLT-M12', UNIT: '件', NET_QTY: 12, GROSS_QTY: 12.2, LOSS_RATE: 0.02, LEVEL_NO: 1, EFFECT_DATE: '2026-06-01' }),
    base({ BOM_NO: 'BOM-SF2', SEQ_NO: 1, PARENT_ITEM_CODE: 'P-SF-002', ITEM_NAME: 'Q345B结构钢板', ITEM_CATEGORY: '原材料', ERP_ITEM_CODE: 'M-Q345B', UNIT: 'kg', NET_QTY: 18.5, GROSS_QTY: 19.4, LOSS_RATE: 0.05, LEVEL_NO: 1, EFFECT_DATE: '2025-03-01' }),
    base({ BOM_NO: 'BOM-SF2', SEQ_NO: 2, PARENT_ITEM_CODE: 'P-SF-002', ITEM_NAME: '20#无缝钢管', ITEM_CATEGORY: '原材料', ERP_ITEM_CODE: 'M-20G', UNIT: 'kg', NET_QTY: 6.2, GROSS_QTY: 6.5, LOSS_RATE: 0.05, LEVEL_NO: 1, EFFECT_DATE: '2025-03-01' }),
    base({ BOM_NO: 'BOM-SF2', SEQ_NO: 3, PARENT_ITEM_CODE: 'P-SF-002', ITEM_NAME: 'CO2焊丝ER50-6', ITEM_CATEGORY: '焊接材料', ERP_ITEM_CODE: 'M-WIRE-ER50', UNIT: 'kg', NET_QTY: 0.45, LOSS_RATE: 0.08, LEVEL_NO: 1, EFFECT_DATE: '2025-03-01' }),
    base({ BOM_NO: 'BOM-MB3', SEQ_NO: 1, PARENT_ITEM_CODE: 'P-MB-003', ITEM_NAME: '冲压件毛坯', ITEM_CATEGORY: '原材料', ERP_ITEM_CODE: 'M-SF-BLANK', UNIT: '件', NET_QTY: 1, LOSS_RATE: 0.01, LEVEL_NO: 1, EFFECT_DATE: '2024-09-01' }),
    base({ BOM_NO: 'BOM-MB3', SEQ_NO: 2, PARENT_ITEM_CODE: 'P-MB-003', ITEM_NAME: 'CO2焊丝ER50-6', ITEM_CATEGORY: '焊接材料', ERP_ITEM_CODE: 'M-WIRE-ER50', UNIT: 'kg', NET_QTY: 0.2, LOSS_RATE: 0.08, LEVEL_NO: 1, EFFECT_DATE: '2024-09-01' })
  ];
  S.MD_MATERIAL_CATEGORY = [
    base({ CATEGORY_CODE: 'MAT', CATEGORY_NAME: '制造物料', PARENT_CODE: '', LEVEL_NO: 1, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'RAW', CATEGORY_NAME: '原材料', PARENT_CODE: 'MAT', LEVEL_NO: 2, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'METAL', CATEGORY_NAME: '金属材料', PARENT_CODE: 'RAW', LEVEL_NO: 3, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'CHEM', CATEGORY_NAME: '化工辅料', PARENT_CODE: 'RAW', LEVEL_NO: 3, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'WELD', CATEGORY_NAME: '焊接材料', PARENT_CODE: 'RAW', LEVEL_NO: 3, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'PUR', CATEGORY_NAME: '外购件', PARENT_CODE: 'MAT', LEVEL_NO: 2, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'SEMI', CATEGORY_NAME: '半成品', PARENT_CODE: 'MAT', LEVEL_NO: 2, ENABLE_FLAG: 1 }),
    base({ CATEGORY_CODE: 'FIN', CATEGORY_NAME: '成品', PARENT_CODE: 'MAT', LEVEL_NO: 2, ENABLE_FLAG: 1 })
  ];
  S.MD_MATERIAL = [
    base({ ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', ITEM_CATEGORY: '金属材料', UNIT: 'kg', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 8000, MIN_STOCK: 4000, MAX_STOCK: 60000, PURCHASE_LEAD_TIME: 7, PRODUCE_LEAD_TIME: 0, DEFAULT_SUPPLIER: 'S001', STD_PRICE: 4.65, PRICE_EXCL_TAX: 4.12, TAX_TYPE: '增值税', TAX_RATE: 0.13, CURRENCY: 'CNY', EXCHANGE_RATE: 1, CONV_RATE: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SPEC: 'Φ76×4.0', ITEM_CATEGORY: '金属材料', UNIT: 'kg', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 2000, MIN_STOCK: 1000, MAX_STOCK: 20000, PURCHASE_LEAD_TIME: 7, DEFAULT_SUPPLIER: 'S001', STD_PRICE: 5.6, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', ITEM_CATEGORY: '金属材料', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 300, PURCHASE_LEAD_TIME: 10, DEFAULT_SUPPLIER: 'S002', STD_PRICE: 46, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2024-03-01' }),
    base({ ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', SPEC: 'Φ1.2 实心焊丝', ITEM_CATEGORY: '焊接材料', UNIT: 'kg', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 400, PURCHASE_LEAD_TIME: 5, DEFAULT_SUPPLIER: 'S004', STD_PRICE: 12.8, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', SPEC: 'Φ60×90', ITEM_CATEGORY: '外购件', UNIT: '套', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 2000, PURCHASE_LEAD_TIME: 15, DEFAULT_SUPPLIER: 'S004', STD_PRICE: 8.6, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2025-02-01' }),
    base({ ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', SPEC: '10.9级 达克罗', ITEM_CATEGORY: '外购件', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 12000, PURCHASE_LEAD_TIME: 15, DEFAULT_SUPPLIER: 'S004', STD_PRICE: 1.85, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2025-02-01' }),
    base({ ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', SPEC: 'MAC-COOL 920', ITEM_CATEGORY: '化工辅料', UNIT: '桶', LOT_FLAG: 0, SN_FLAG: 0, SAFETY_STOCK: 20, PURCHASE_LEAD_TIME: 5, STD_PRICE: 380, TAX_RATE: 0.13, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', SPEC: 'SF-3101 焊接件', ITEM_CATEGORY: '半成品', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 0, SAFETY_STOCK: 300, PRODUCE_LEAD_TIME: 3, STD_PRICE: 168, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2025-03-01' }),
    base({ ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', ITEM_CATEGORY: '成品', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 1, SAFETY_STOCK: 500, PRODUCE_LEAD_TIME: 15, STD_PRICE: 268, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2025-03-01' }),
    base({ ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', SPEC: 'Q345B 焊接总成', ITEM_CATEGORY: '成品', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 1, SAFETY_STOCK: 400, PRODUCE_LEAD_TIME: 15, STD_PRICE: 246, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2025-03-01' }),
    base({ ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', SPEC: 'Q345B 冲焊件', ITEM_CATEGORY: '成品', UNIT: '件', LOT_FLAG: 1, SN_FLAG: 0, PRODUCE_LEAD_TIME: 8, STD_PRICE: 96, CURRENCY: 'CNY', ENABLE_FLAG: 1, ENABLE_FROM: '2024-09-01' })
  ];

  /* ==================== 设备资料（33 台 = 29 台设备 + 4 个货架） ====================
   * 与内网 supOS「汽配车间」(AUTO_PARTS_WORKSHOP) 的 6 个区、33 个设备节点 1:1 对应：
   *   01 数控加工区 CNC-001~006 · 02 机器人焊接区 RBT-007~012 · 03 动力总成装配区 ASM-013~018
   *   04 精密检测区 QMS-019~022 · 05 智能仓储区 WH-023~026 · 06 AGV 物流区 AGV-027~033
   * 列：[编号, 名称, 类型, 型号, 制造单位, 班组, 区域, 设备类别, 状态, 标准节拍(s), 协议, 责任人, 加工能力] */
  var EQS = [
    ['CNC-001', 'CNC-001 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T1', '数控加工区', '关键设备', '运行', 180, 'OPC-UA', 'E001', '800×550×500'],
    ['CNC-002', 'CNC-002 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T1', '数控加工区', '关键设备', '运行', 180, 'OPC-UA', 'E001', '800×550×500'],
    ['CNC-003', 'CNC-003 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T2', '数控加工区', '关键设备', '运行', 180, 'OPC-UA', 'E002', '800×550×500'],
    ['CNC-004', 'CNC-004 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T2', '数控加工区', '关键设备', '运行', 180, 'OPC-UA', 'E002', '800×550×500'],
    ['CNC-005', 'CNC-005 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T1', '数控加工区', '关键设备', '运行', 180, 'OPC-UA', 'E001', '800×550×500'],
    ['CNC-006', 'CNC-006 立式数控加工中心', '加工中心', 'VMC-855', MFG.cnc, 'T2', '数控加工区', '关键设备', '待机', 180, 'OPC-UA', 'E002', '800×550×500'],
    ['RBT-007', 'RBT-007 副车架焊接工装', '焊接工装', 'HZ-JIG-2400', MFG.jig, 'T3', '机器人焊接区', '一般设备', '运行', 0, 'OPC-UA', 'E003', '工件≤2400mm'],
    ['RBT-008', 'RBT-008 六轴焊接机器人', '焊接机器人', 'ARC Mate 120iD', MFG.rbt, 'T3', '机器人焊接区', '关键设备', '运行', 95, 'OPC-UA', 'E003', '负载20kg'],
    ['RBT-009', 'RBT-009 六轴焊接机器人', '焊接机器人', 'ARC Mate 120iD', MFG.rbt, 'T3', '机器人焊接区', '关键设备', '运行', 95, 'OPC-UA', 'E003', '负载20kg'],
    ['RBT-010', 'RBT-010 副车架焊接工装', '焊接工装', 'HZ-JIG-2400', MFG.jig, 'T3', '机器人焊接区', '一般设备', '运行', 0, 'OPC-UA', 'E004', '工件≤2400mm'],
    ['RBT-011', 'RBT-011 六轴焊接机器人', '焊接机器人', 'ARC Mate 120iD', MFG.rbt, 'T3', '机器人焊接区', '关键设备', '运行', 95, 'OPC-UA', 'E004', '负载20kg'],
    ['RBT-012', 'RBT-012 六轴焊接机器人', '焊接机器人', 'ARC Mate 120iD', MFG.rbt, 'T3', '机器人焊接区', '关键设备', '待机', 95, 'OPC-UA', 'E004', '负载20kg'],
    ['ASM-013', 'ASM-013 滚筒装配输送线', '装配输送线', 'LX-3000', MFG.asm, 'T4', '动力总成装配区', '关键设备', '运行', 60, 'MQTT', 'E011', '线长30m'],
    ['ASM-014', 'ASM-014 自动拧紧机器人', '拧紧机器人', 'SmartTork ST-800', MFG.tork, 'T4', '动力总成装配区', '关键设备', '运行', 45, 'MQTT', 'E012', '扭矩800N·m'],
    ['ASM-015', 'ASM-015 自动拧紧机器人', '拧紧机器人', 'SmartTork ST-800', MFG.tork, 'T4', '动力总成装配区', '关键设备', '运行', 45, 'MQTT', 'E012', '扭矩800N·m'],
    ['ASM-016', 'ASM-016 滚筒装配输送线', '装配输送线', 'LX-3000', MFG.asm, 'T4', '动力总成装配区', '关键设备', '运行', 60, 'MQTT', 'E011', '线长30m'],
    ['ASM-017', 'ASM-017 自动拧紧机器人', '拧紧机器人', 'SmartTork ST-800', MFG.tork, 'T4', '动力总成装配区', '关键设备', '运行', 45, 'MQTT', 'E012', '扭矩800N·m'],
    ['ASM-018', 'ASM-018 自动拧紧机器人', '拧紧机器人', 'SmartTork ST-800', MFG.tork, 'T4', '动力总成装配区', '关键设备', '运行', 45, 'MQTT', 'E012', '扭矩800N·m'],
    ['QMS-019', 'QMS-019 三坐标精密测量机', '三坐标测量机', 'CONTURA G2', MFG.cmm, 'T-JC', '精密检测区', '关键设备', '运行', 240, 'OPC-UA', 'E005', '1000×1600×600'],
    ['QMS-020', 'QMS-020 三坐标精密测量机', '三坐标测量机', 'CONTURA G2', MFG.cmm, 'T-JC', '精密检测区', '关键设备', '运行', 240, 'OPC-UA', 'E005', '1000×1600×600'],
    ['QMS-021', 'QMS-021 在线视觉检测站', '视觉检测站', 'In-Sight 2000', MFG.vis, 'T-JC', '精密检测区', '一般设备', '运行', 30, 'MQTT', 'E005', '视野1200×900'],
    ['QMS-022', 'QMS-022 在线视觉检测站', '视觉检测站', 'In-Sight 2000', MFG.vis, 'T-JC', '精密检测区', '一般设备', '运行', 30, 'MQTT', 'E005', '视野1200×900'],
    ['WH-023', 'WH-023 三层重型仓储货架(原料架)', '仓储货架', 'HJ-3T-2400', MFG.shelf, 'T-WH', '智能仓储区', '一般设备', '运行', 0, 'MQTT', 'E010', '3层 载重3t'],
    ['WH-024', 'WH-024 三层重型仓储货架(半成品架)', '仓储货架', 'HJ-3T-2400', MFG.shelf, 'T-WH', '智能仓储区', '一般设备', '运行', 0, 'MQTT', 'E010', '3层 载重3t'],
    ['WH-025', 'WH-025 三层重型仓储货架(成品架A)', '仓储货架', 'HJ-3T-2400', MFG.shelf, 'T-WH', '智能仓储区', '一般设备', '运行', 0, 'MQTT', 'E010', '3层 载重3t'],
    ['WH-026', 'WH-026 三层重型仓储货架(成品架B)', '仓储货架', 'HJ-3T-2400', MFG.shelf, 'T-WH', '智能仓储区', '一般设备', '运行', 0, 'MQTT', 'E010', '3层 载重3t'],
    ['AGV-027', 'AGV-027 自动充电泊位', '充电泊位', 'CP-2K', MFG.agv, 'T-WH', 'AGV物流区', '一般设备', '运行', 0, 'MQTT', 'E014', '2kW'],
    ['AGV-028', 'AGV-028 自动充电泊位', '充电泊位', 'CP-2K', MFG.agv, 'T-WH', 'AGV物流区', '一般设备', '运行', 0, 'MQTT', 'E014', '2kW'],
    ['AGV-029', 'AGV-029 自动充电泊位', '充电泊位', 'CP-2K', MFG.agv, 'T-WH', 'AGV物流区', '一般设备', '运行', 0, 'MQTT', 'E014', '2kW'],
    ['AGV-030', 'AGV-030 自主移动物流机器人', 'AGV', 'MR-Q7', MFG.agv, 'T-WH', 'AGV物流区', '关键设备', '运行', 0, 'MQTT', 'E014', '载重1000kg'],
    ['AGV-031', 'AGV-031 自主移动物流机器人', 'AGV', 'MR-Q7', MFG.agv, 'T-WH', 'AGV物流区', '关键设备', '运行', 0, 'MQTT', 'E014', '载重1000kg'],
    ['AGV-032', 'AGV-032 自主移动物流机器人', 'AGV', 'MR-Q7', MFG.agv, 'T-WH', 'AGV物流区', '关键设备', '运行', 0, 'MQTT', 'E014', '载重1000kg'],
    ['AGV-033', 'AGV-033 电动平衡重叉车', '叉车', 'CPD15', MFG.fork, 'T-WH', 'AGV物流区', '一般设备', '运行', 0, '', 'E010', '载重1.5t']
  ];
  var FACTORY_DATE = { CNC: '2022-05-10', RBT: '2023-03-01', ASM: '2023-05-20', QMS: '2022-11-15', WH: '2023-02-08', AGV: '2023-08-12' };
  S.MD_EQUIPMENT = EQS.map(function (e, i) {
    var pfx = e[0].split('-')[0];
    return base({
      SEQ_NO: i + 1, EQUIP_NAME: e[1], EQUIP_MODEL: e[3], MANUFACTURER: e[4], EQUIP_NO: e[0],
      EQUIP_TYPE: e[2], TEAM_CODE: e[5], LINE_CODE: e[6], FACTORY_DATE: FACTORY_DATE[pfx],
      FACTORY_SN: e[0].replace('-', '') + 'SN', EQUIP_CLASS: e[7], SYSTEM_CODE: '汽配车间MES',
      CAPACITY: e[12], STD_CYCLE_TIME: e[9] || null, EQUIP_STATUS: e[8],
      IOT_FLAG: e[10] ? 1 : 0, PROTOCOL: e[10], OWNER: e[11], ENABLE_FLAG: 1, ENABLE_FROM: '2023-07-01'
    });
  });

  S.MD_GAUGE = [
    base({ SEQ_NO: 1, GAUGE_NO: 'G-CMM-01', GAUGE_NAME: '三坐标测量机', GAUGE_MODEL: 'CONTURA G2', MEASURE_RANGE: '1000×1600×600', DIVISION: '0.1μm', ACCURACY: '1.8μm', GAUGE_CLASS: 'A', LEGAL_CLASS: '强检', GAUGE_STATUS: '在用', CALIB_DATE: '2026-05-20', EXPIRE_DATE: '2027-05-20', ENABLE_DATE: '2022-12-10', USE_DEPT: '质保部', USER_NAME: '王芳' }),
    base({ SEQ_NO: 2, GAUGE_NO: 'G-UT-01', GAUGE_NAME: '超声波测厚仪', GAUGE_MODEL: 'TT130', MEASURE_RANGE: '0.75-300mm', DIVISION: '0.01mm', ACCURACY: '±0.05mm', GAUGE_CLASS: 'B', LEGAL_CLASS: '非强检', GAUGE_STATUS: '在用', CALIB_DATE: '2026-04-15', EXPIRE_DATE: '2027-04-15', ENABLE_DATE: '2023-09-01', USE_DEPT: '焊装课', USER_NAME: 'E003' }),
    base({ SEQ_NO: 3, GAUGE_NO: 'G-HD-01', GAUGE_NAME: '洛氏硬度计', GAUGE_MODEL: 'HR-150A', MEASURE_RANGE: 'HRC20-70', DIVISION: '0.5HRC', ACCURACY: '±1HRC', GAUGE_CLASS: 'B', LEGAL_CLASS: '强检', GAUGE_STATUS: '在用', CALIB_DATE: '2026-03-10', EXPIRE_DATE: '2027-03-10', USE_DEPT: '质保部', USER_NAME: 'E005' }),
    base({ SEQ_NO: 4, GAUGE_NO: 'G-CL-01', GAUGE_NAME: '数显卡尺', GAUGE_MODEL: '0-300mm', MEASURE_RANGE: '0-300mm', DIVISION: '0.01mm', ACCURACY: '±0.02mm', GAUGE_CLASS: 'C', LEGAL_CLASS: '非强检', GAUGE_STATUS: '在用', CALIB_DATE: '2026-06-01', EXPIRE_DATE: '2027-06-01', USE_DEPT: '焊装课', USER_NAME: 'E011' }),
    base({ SEQ_NO: 5, GAUGE_NO: 'G-TQ-01', GAUGE_NAME: '扭矩校验仪', GAUGE_MODEL: 'CDI-2500', MEASURE_RANGE: '50-2500N·m', DIVISION: '1N·m', ACCURACY: '±0.5%', GAUGE_CLASS: 'A', LEGAL_CLASS: '强检', GAUGE_STATUS: '在用', CALIB_DATE: '2026-07-01', EXPIRE_DATE: '2027-07-01', USE_DEPT: '质保部', USER_NAME: 'E005' })
  ];
  S.MD_POSITION = [
    base({ POSITION_CODE: 'P-CNC', POSITION_NAME: '加工中心操作工', POSITION_TYPE: '生产', GRADE: '中级技工', DEPT_CLASS: '机加课', HEADCOUNT: 12, DUTY: '加工中心编程与装夹加工，执行首件检验与工序自检', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-WELD', POSITION_NAME: '焊接机器人操作工', POSITION_TYPE: '生产', GRADE: '高级技工', DEPT_CLASS: '焊装课', HEADCOUNT: 8, DUTY: '焊接机器人示教与焊接参数管理，监控焊缝质量', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-ASM', POSITION_NAME: '装配工', POSITION_TYPE: '生产', GRADE: '中级技工', DEPT_CLASS: '总装课', HEADCOUNT: 8, DUTY: '副车架总成装配线作业，衬套压装与工件流转', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-TORK', POSITION_NAME: '拧紧操作工', POSITION_TYPE: '生产', GRADE: '中级技工', DEPT_CLASS: '总装课', HEADCOUNT: 6, DUTY: '自动拧紧机器人操作与扭矩过程能力监控', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-QC', POSITION_NAME: '质量检验员', POSITION_TYPE: '质量', GRADE: '技师', DEPT_CLASS: '质保部', HEADCOUNT: 4, DUTY: '来料/过程/成品检验，出具检验记录与判定', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-PM', POSITION_NAME: '设备维修技师', POSITION_TYPE: '设备', GRADE: '技师', DEPT_CLASS: '设备科', HEADCOUNT: 3, DUTY: '设备故障维修、保养计划执行与点检确认', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-LEAD', POSITION_NAME: '班组长', POSITION_TYPE: '管理', GRADE: '班长', DEPT_CLASS: '机加课', HEADCOUNT: 4, DUTY: '班组排产、人员协调、交接班与现场5S', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-PLAN', POSITION_NAME: '生产计划员', POSITION_TYPE: '管理', GRADE: '专员', DEPT_CLASS: '计划物流课', HEADCOUNT: 2, DUTY: '主计划编制与工序排程，协调 APS 排产结果', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-WH', POSITION_NAME: '仓库管理员', POSITION_TYPE: '仓储', GRADE: '专员', DEPT_CLASS: '计划物流课', HEADCOUNT: 3, DUTY: '收发料、库存账务与盘点', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-PUR', POSITION_NAME: '采购员', POSITION_TYPE: '采购', GRADE: '专员', DEPT_CLASS: '采购课', HEADCOUNT: 2, DUTY: '请购比价、供应商下单与交期跟催', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ POSITION_CODE: 'P-AGV', POSITION_NAME: 'AGV调度员', POSITION_TYPE: '物流', GRADE: '专员', DEPT_CLASS: '计划物流课', HEADCOUNT: 2, DUTY: 'AGV 任务调度与物流路径维护，保证线边配送', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' })
  ];
  S.HR_EMPLOYEE = [
    base({ EMP_NO: 'E001', EMP_NAME: '张伟', POST: 'P-CNC', TEAM_CODE: 'T1', DEPT_CLASS: '机加课', SKILL_LEVEL: '中级', AUTH_EQUIP: '["CNC-001","CNC-002","CNC-005"]', PIECE_RATE_FLAG: 1, PROBATION_END: '2025-09-30', STATUS: '在职' }),
    base({ EMP_NO: 'E002', EMP_NAME: '李强', POST: 'P-CNC', TEAM_CODE: 'T2', DEPT_CLASS: '机加课', SKILL_LEVEL: '高级', AUTH_EQUIP: '["CNC-003","CNC-004","CNC-006"]', PIECE_RATE_FLAG: 1, STATUS: '在职' }),
    base({ EMP_NO: 'E003', EMP_NAME: '陈刚', POST: 'P-WELD', TEAM_CODE: 'T3', DEPT_CLASS: '焊装课', SKILL_LEVEL: '高级', AUTH_EQUIP: '["RBT-007","RBT-008","RBT-009"]', PIECE_RATE_FLAG: 1, STATUS: '在职' }),
    base({ EMP_NO: 'E004', EMP_NAME: '刘敏', POST: 'P-WELD', TEAM_CODE: 'T3', DEPT_CLASS: '焊装课', SKILL_LEVEL: '技师', AUTH_EQUIP: '["RBT-010","RBT-011","RBT-012"]', PIECE_RATE_FLAG: 1, STATUS: '在职' }),
    base({ EMP_NO: 'E005', EMP_NAME: '王芳', POST: 'P-QC', TEAM_CODE: 'T-JC', DEPT_CLASS: '质保部', SKILL_LEVEL: '技师', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E006', EMP_NAME: '赵磊', POST: 'P-PM', TEAM_CODE: 'T-JD', DEPT_CLASS: '设备科', SKILL_LEVEL: '高级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E007', EMP_NAME: '孙倩', POST: 'P-PLAN', TEAM_CODE: 'T-SC', DEPT_CLASS: '计划物流课', SKILL_LEVEL: '中级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E008', EMP_NAME: '周杰', POST: 'P-LEAD', TEAM_CODE: 'T1', DEPT_CLASS: '机加课', SKILL_LEVEL: '高级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E009', EMP_NAME: '钱进', POST: 'P-PUR', TEAM_CODE: 'T-SC', DEPT_CLASS: '采购课', SKILL_LEVEL: '中级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E010', EMP_NAME: '朱霞', POST: 'P-WH', TEAM_CODE: 'T-WH', DEPT_CLASS: '计划物流课', SKILL_LEVEL: '中级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E011', EMP_NAME: '吴涛', POST: 'P-ASM', TEAM_CODE: 'T4', DEPT_CLASS: '总装课', SKILL_LEVEL: '中级', AUTH_EQUIP: '["ASM-013","ASM-016"]', PIECE_RATE_FLAG: 1, STATUS: '在职' }),
    base({ EMP_NO: 'E012', EMP_NAME: '郑琴', POST: 'P-TORK', TEAM_CODE: 'T4', DEPT_CLASS: '总装课', SKILL_LEVEL: '高级', AUTH_EQUIP: '["ASM-014","ASM-015","ASM-017","ASM-018"]', PIECE_RATE_FLAG: 1, STATUS: '在职' }),
    base({ EMP_NO: 'E013', EMP_NAME: '冯军', POST: 'P-LEAD', TEAM_CODE: 'T2', DEPT_CLASS: '机加课', SKILL_LEVEL: '高级', PIECE_RATE_FLAG: 0, STATUS: '在职' }),
    base({ EMP_NO: 'E014', EMP_NAME: '蒋丽', POST: 'P-AGV', TEAM_CODE: 'T-WH', DEPT_CLASS: '计划物流课', SKILL_LEVEL: '中级', PIECE_RATE_FLAG: 0, STATUS: '在职' })
  ];
  S.HR_TEAM = [
    base({ TEAM_CODE: 'T1', TEAM_NAME: '数控一班', DEPT_CLASS: '机加课', LEADER_EMP_NO: 'E008', SHIFT_MODEL: '两班倒', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T2', TEAM_NAME: '数控二班', DEPT_CLASS: '机加课', LEADER_EMP_NO: 'E013', SHIFT_MODEL: '两班倒', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T3', TEAM_NAME: '焊接班', DEPT_CLASS: '焊装课', LEADER_EMP_NO: 'E004', SHIFT_MODEL: '两班倒', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T4', TEAM_NAME: '装配班', DEPT_CLASS: '总装课', LEADER_EMP_NO: 'E011', SHIFT_MODEL: '两班倒', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T-JC', TEAM_NAME: '质检班', DEPT_CLASS: '质保部', LEADER_EMP_NO: 'E005', SHIFT_MODEL: '常白班', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T-JD', TEAM_NAME: '机修班', DEPT_CLASS: '设备科', LEADER_EMP_NO: 'E006', SHIFT_MODEL: '常白班', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T-SC', TEAM_NAME: '计划物流班', DEPT_CLASS: '计划物流课', LEADER_EMP_NO: 'E007', SHIFT_MODEL: '常白班', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ TEAM_CODE: 'T-WH', TEAM_NAME: '仓储物流班', DEPT_CLASS: '计划物流课', LEADER_EMP_NO: 'E010', SHIFT_MODEL: '常白班', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' })
  ];
  S.HR_TEAM_MEMBER = [
    base({ TEAM_CODE: 'T1', EMP_NO: 'E008', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T1', EMP_NO: 'E001', JOIN_DATE: '2024-01-01', IS_LEADER: 0 }),
    base({ TEAM_CODE: 'T2', EMP_NO: 'E013', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T2', EMP_NO: 'E002', JOIN_DATE: '2024-01-01', IS_LEADER: 0 }),
    base({ TEAM_CODE: 'T3', EMP_NO: 'E004', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T3', EMP_NO: 'E003', JOIN_DATE: '2024-01-01', IS_LEADER: 0 }),
    base({ TEAM_CODE: 'T4', EMP_NO: 'E011', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T4', EMP_NO: 'E012', JOIN_DATE: '2024-01-01', IS_LEADER: 0 }),
    base({ TEAM_CODE: 'T-JC', EMP_NO: 'E005', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T-JD', EMP_NO: 'E006', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T-SC', EMP_NO: 'E007', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T-SC', EMP_NO: 'E009', JOIN_DATE: '2024-01-01', IS_LEADER: 0 }),
    base({ TEAM_CODE: 'T-WH', EMP_NO: 'E010', JOIN_DATE: '2024-01-01', IS_LEADER: 1 }),
    base({ TEAM_CODE: 'T-WH', EMP_NO: 'E014', JOIN_DATE: '2024-01-01', IS_LEADER: 0 })
  ];

  /* ==================== 班组排班（新增表） ====================
   * APS 排产扣产能的「可用工时」来源：班组 × 日期 × 班次。
   * 班次定义见 HR_SHIFT_DEF（白班/中班/晚班），本表只记「谁在哪天值哪个班」，不再冗余起止时间。
   * 两班倒班组（T1~T4）按「白班 / 中班」交错排 5 天；常白班班组（T-JC/T-JD/T-WH）按常白班排工作日。 */
  S.HR_SHIFT_SCHEDULE = (function () {
    var rows = [], seq = 0;
    var W5 = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];
    function push(team, code, hrs, equips) {
      W5.forEach(function (d) {
        seq++;
        rows.push(base({
          SHIFT_ID: 'SS-' + String(seq).padStart(3, '0'), TEAM_CODE: team, SHIFT_DATE: d,
          SHIFT_CODE: code, STD_HOURS: hrs,
          EQUIP_NO: equips, REST_FLAG: 0, STATUS: '已确认'
        }));
      });
    }
    push('T1', '白班', 12, 'CNC-001/CNC-002/CNC-005');
    push('T2', '中班', 12, 'CNC-003/CNC-004/CNC-006');
    push('T3', '白班', 12, 'RBT-007~RBT-012');
    push('T4', '白班', 12, 'ASM-013~ASM-018');
    push('T-JC', '白班', 8, 'QMS-019~QMS-022');
    push('T-JD', '白班', 8, '全车间设备');
    push('T-WH', '常白班', 8, 'WH-023~WH-026 / AGV-027~AGV-033');
    return rows;
  })();
  /* ==================== 班次定义（字典级主数据） ====================
   * 全厂统一班次口径：排班（HR_SHIFT_SCHEDULE）与班次日历（HR_SHIFT_CALENDAR）均引用本表。 */
  S.HR_SHIFT_DEF = [
    base({ SHIFT_CODE: '白班', SHIFT_NAME: '白班', START_TIME: '08:00', END_TIME: '20:00', CROSS_DAY: 0, STD_HOURS: 12, REST_MIN: 60, COLOR_TAG: '#2f6fdb', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ SHIFT_CODE: '中班', SHIFT_NAME: '中班', START_TIME: '20:00', END_TIME: '08:00', CROSS_DAY: 1, STD_HOURS: 12, REST_MIN: 60, COLOR_TAG: '#7a4fd1', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ SHIFT_CODE: '晚班', SHIFT_NAME: '晚班', START_TIME: '00:00', END_TIME: '08:00', CROSS_DAY: 0, STD_HOURS: 8, REST_MIN: 30, COLOR_TAG: '#3f8f5f', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' }),
    base({ SHIFT_CODE: '常白班', SHIFT_NAME: '常白班', START_TIME: '08:30', END_TIME: '17:30', CROSS_DAY: 0, STD_HOURS: 8, REST_MIN: 60, COLOR_TAG: '#c98a1b', ENABLE_FLAG: 1, ENABLE_FROM: '2024-01-01' })
  ];
  /* ==================== 班次日历（业务事实） ====================
   * 某天某班组「上哪个班 / 是否休息 / 当天产能系数」。这里给出 2026-09-15 ~ 09-21 一周：
   * 09-19(周六)/09-20(周日) 两班倒班组加班（调休上班，产能系数 0.8），常白班班组休息；
   * 09-21(周一) 正常上班。APS 扣产能时按 CAP_RATIO 修正可用工时。 */
  S.HR_SHIFT_CALENDAR = (function () {
    var rows = [], seq = 0;
    var TEAMS_2S = [['T1', '白班', 'CNC-001/CNC-002/CNC-005'], ['T2', '中班', 'CNC-003/CNC-004/CNC-006'],
    ['T3', '白班', 'RBT-007~RBT-012'], ['T4', '白班', 'ASM-013~ASM-018']];
    var TEAMS_1S = [['T-JC', 'QMS-019~QMS-022'], ['T-JD', '全车间设备'], ['T-WH', 'WH-023~WH-026 / AGV-027~AGV-033']];
    function push(date, team, shift, dayType, ratio, hrs, memo, st) {
      seq++;
      rows.push(base({
        CAL_ID: 'SC-' + String(seq).padStart(3, '0'), CAL_DATE: date, TEAM_CODE: team,
        SHIFT_CODE: shift || '休息', DAY_TYPE: dayType, CAP_RATIO: ratio, WORK_HOURS: hrs, MEMO: memo || '', STATUS: st || '已确认'
      }));
    }
    var NORMAL = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-21'];
    NORMAL.forEach(function (d) {
      TEAMS_2S.forEach(function (t) { push(d, t[0], t[1], '工作日', 1, 11, ''); });
      TEAMS_1S.forEach(function (t) { push(d, t[0], '常白班', '工作日', 1, 7, ''); });
    });
    ['2026-09-19', '2026-09-20'].forEach(function (d) {
      TEAMS_2S.forEach(function (t) { push(d, t[0], t[1], '调休上班', 0.8, 8.8, '周末加班，产能系数 0.8', '已确认'); });
      TEAMS_1S.forEach(function (t) { push(d, t[0], '', '休息日', 0, 0, '常白班休息', '已确认'); });
    });
    return rows;
  })();

  S.MD_STEP_DICT = [
    base({ STEP_CODE: 'S10', STEP_NAME: '数控粗加工', STEP_DESC: '加工中心粗铣/钻孔，留精加工余量', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', IS_KEY_STEP: 0, IS_QC_POINT: 0, STD_HOUR: 0.15, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S20', STEP_NAME: '数控精加工', STEP_DESC: '加工中心精铣安装面/孔系至图纸尺寸', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', IS_KEY_STEP: 1, IS_QC_POINT: 0, STD_HOUR: 0.2, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S30', STEP_NAME: '机器人焊接', STEP_DESC: '六轴机器人CO2焊接，控制焊缝成形与熔深', WORK_CENTER: '机器人焊接区', EQUIP_TYPE: '焊接机器人', IS_KEY_STEP: 1, IS_QC_POINT: 0, STD_HOUR: 0.25, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S40', STEP_NAME: '总成装配', STEP_DESC: '滚筒输送线上完成衬套压装与工件合装', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '装配输送线', IS_KEY_STEP: 0, IS_QC_POINT: 0, STD_HOUR: 0.12, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S50', STEP_NAME: '自动拧紧', STEP_DESC: '自动拧紧机器人按扭矩/角度程序紧固螺栓', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '拧紧机器人', IS_KEY_STEP: 0, IS_QC_POINT: 0, STD_HOUR: 0.06, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S60', STEP_NAME: '三坐标检测', STEP_DESC: '三坐标测量关键孔位/面轮廓度，出具检测报告', WORK_CENTER: '精密检测区', EQUIP_TYPE: '三坐标测量机', IS_KEY_STEP: 1, IS_QC_POINT: 1, STD_HOUR: 0.1, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S70', STEP_NAME: '在线视觉检测', STEP_DESC: '视觉检测站判定焊缝外观缺陷与缺件', WORK_CENTER: '精密检测区', EQUIP_TYPE: '视觉检测站', IS_KEY_STEP: 0, IS_QC_POINT: 1, STD_HOUR: 0.03, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S75', STEP_NAME: '表面处理(外协)', STEP_DESC: '电泳涂装外协，膜厚/附着力按标准验收', WORK_CENTER: '外协', EQUIP_TYPE: '外协', IS_KEY_STEP: 1, IS_QC_POINT: 1, STD_HOUR: 0, ENABLE_FLAG: 1 }),
    base({ STEP_CODE: 'S80', STEP_NAME: '入库上架', STEP_DESC: 'AGV转运至智能仓储区，按成品/半成品上架', WORK_CENTER: '智能仓储区', EQUIP_TYPE: '仓储货架', IS_KEY_STEP: 0, IS_QC_POINT: 0, STD_HOUR: 0.02, ENABLE_FLAG: 1 })
  ];
  /* ==================== 工序设备能力矩阵（新增表） ====================
   * 把「工序」与「具体台号」连起来：上游 RT_ROUTE_STEP 只要求「设备类型」，
   * 本表给出该工序在每台设备上的标准节拍、换型时间、小时产能与优先级（同工序多台设备时的选择顺序）。
   * 节拍口径与 MD_EQUIPMENT.STD_CYCLE_TIME 对齐；换型时间用于 APS 计算批次切换损失。
   * 列：[工序, 工序名, 设备编号, 设备类型, 节拍(s/件), 换型(min), 小时产能(件/h), 优先级] */
  var CAPS = [
    ['S10', '数控粗加工', 'CNC-001', '加工中心', 180, 25, 18.5, 1],
    ['S10', '数控粗加工', 'CNC-002', '加工中心', 180, 25, 18.5, 2],
    ['S10', '数控粗加工', 'CNC-003', '加工中心', 180, 25, 18.5, 3],
    ['S10', '数控粗加工', 'CNC-004', '加工中心', 180, 25, 18.5, 4],
    ['S10', '数控粗加工', 'CNC-005', '加工中心', 180, 25, 18.5, 5],
    ['S10', '数控粗加工', 'CNC-006', '加工中心', 180, 25, 18.5, 6],
    ['S20', '数控精加工', 'CNC-001', '加工中心', 180, 30, 17.8, 1],
    ['S20', '数控精加工', 'CNC-002', '加工中心', 180, 30, 17.8, 2],
    ['S20', '数控精加工', 'CNC-003', '加工中心', 180, 30, 17.8, 3],
    ['S20', '数控精加工', 'CNC-004', '加工中心', 180, 30, 17.8, 4],
    ['S20', '数控精加工', 'CNC-005', '加工中心', 180, 30, 17.8, 5],
    ['S20', '数控精加工', 'CNC-006', '加工中心', 180, 30, 17.8, 6],
    ['S30', '机器人焊接', 'RBT-007', '焊接工装', 0, 20, 0, 1],
    ['S30', '机器人焊接', 'RBT-008', '焊接机器人', 95, 20, 32.5, 2],
    ['S30', '机器人焊接', 'RBT-009', '焊接机器人', 95, 20, 32.5, 3],
    ['S30', '机器人焊接', 'RBT-010', '焊接工装', 0, 20, 0, 4],
    ['S30', '机器人焊接', 'RBT-011', '焊接机器人', 95, 20, 32.5, 5],
    ['S30', '机器人焊接', 'RBT-012', '焊接机器人', 95, 20, 32.5, 6],
    ['S40', '总成装配', 'ASM-013', '装配输送线', 60, 15, 30.0, 1],
    ['S40', '总成装配', 'ASM-016', '装配输送线', 60, 15, 30.0, 2],
    ['S50', '自动拧紧', 'ASM-014', '拧紧机器人', 45, 10, 40.0, 1],
    ['S50', '自动拧紧', 'ASM-015', '拧紧机器人', 45, 10, 40.0, 2],
    ['S50', '自动拧紧', 'ASM-017', '拧紧机器人', 45, 10, 40.0, 3],
    ['S50', '自动拧紧', 'ASM-018', '拧紧机器人', 45, 10, 40.0, 4],
    ['S60', '三坐标检测', 'QMS-019', '三坐标测量机', 240, 5, 14.6, 1],
    ['S60', '三坐标检测', 'QMS-020', '三坐标测量机', 240, 5, 14.6, 2],
    ['S70', '在线视觉检测', 'QMS-021', '视觉检测站', 30, 5, 108.0, 1],
    ['S70', '在线视觉检测', 'QMS-022', '视觉检测站', 30, 5, 108.0, 2],
    ['S80', '入库上架', 'WH-023', '仓储货架', 0, 0, 0, 1],
    ['S80', '入库上架', 'WH-024', '仓储货架', 0, 0, 0, 2],
    ['S80', '入库上架', 'WH-025', '仓储货架', 0, 0, 0, 3],
    ['S80', '入库上架', 'WH-026', '仓储货架', 0, 0, 0, 4]
  ];
  S.MD_STEP_EQUIP_CAP = CAPS.map(function (r, i) {
    return base({
      CAP_ID: 'CAP-' + String(i + 1).padStart(3, '0'), STEP_CODE: r[0], STEP_NAME: r[1],
      EQUIP_NO: r[2], EQUIP_TYPE: r[3], STD_CT_SEC: r[4], SETUP_MIN: r[5],
      CAP_QTY_H: r[6], PRIORITY: r[7], QUALIFIED_FLAG: 1, ENABLE_FLAG: 1, ENABLE_FROM: '2026-06-01'
    });
  });

  /* ==================== 工艺管理 ==================== */
  S.RT_ROUTE = [
    base({ ROUTE_NO: 'RT-SF1', ROUTE_NAME: '前副车架总成加工路线', PRODUCT_NO: 'P-SF-001', ROUTE_VER: 'V2', STEP_COUNT: 9, HAS_OUTSOURCE: 1, EFFECT_DATE: '2026-06-01', STATUS: '已发布' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_NAME: '后副车架总成加工路线', PRODUCT_NO: 'P-SF-002', ROUTE_VER: 'V1', STEP_COUNT: 9, HAS_OUTSOURCE: 1, EFFECT_DATE: '2025-03-01', STATUS: '已发布' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_NAME: '电驱动悬置支架加工路线', PRODUCT_NO: 'P-MB-003', ROUTE_VER: 'V1', STEP_COUNT: 6, HAS_OUTSOURCE: 1, EFFECT_DATE: '2024-09-01', STATUS: '已发布' })
  ];
  /* 工艺路线工序：**只绑设备类型（EQUIP_TYPE）不绑台号** —— 具体台号在排产/报工时确定 */
  S.RT_ROUTE_STEP = [
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 10, STEP_CODE: 'S10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', STD_HOUR: 0.15, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 20, STEP_CODE: 'S20', STEP_NAME: '数控精加工', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', STD_HOUR: 0.2, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 30, STEP_CODE: 'S30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', EQUIP_TYPE: '焊接机器人', STD_HOUR: 0.25, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 40, STEP_CODE: 'S40', STEP_NAME: '总成装配', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '装配输送线', STD_HOUR: 0.12, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 50, STEP_CODE: 'S50', STEP_NAME: '自动拧紧', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '拧紧机器人', STD_HOUR: 0.06, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 60, STEP_CODE: 'S60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '三坐标测量机', STD_HOUR: 0.1, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 70, STEP_CODE: 'S70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '视觉检测站', STD_HOUR: 0.03, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 75, STEP_CODE: 'S75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', EQUIP_TYPE: '外协', STD_HOUR: 0, OUTSOURCE_FLAG: 1, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF1', SEQ_NO: 80, STEP_CODE: 'S80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', EQUIP_TYPE: '仓储货架', STD_HOUR: 0.02, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 10, STEP_CODE: 'S10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', STD_HOUR: 0.15, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 20, STEP_CODE: 'S20', STEP_NAME: '数控精加工', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', STD_HOUR: 0.2, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 30, STEP_CODE: 'S30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', EQUIP_TYPE: '焊接机器人', STD_HOUR: 0.25, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 40, STEP_CODE: 'S40', STEP_NAME: '总成装配', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '装配输送线', STD_HOUR: 0.12, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 50, STEP_CODE: 'S50', STEP_NAME: '自动拧紧', WORK_CENTER: '动力总成装配区', EQUIP_TYPE: '拧紧机器人', STD_HOUR: 0.06, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 60, STEP_CODE: 'S60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '三坐标测量机', STD_HOUR: 0.1, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 70, STEP_CODE: 'S70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '视觉检测站', STD_HOUR: 0.03, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 75, STEP_CODE: 'S75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', EQUIP_TYPE: '外协', STD_HOUR: 0, OUTSOURCE_FLAG: 1, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-SF2', SEQ_NO: 80, STEP_CODE: 'S80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', EQUIP_TYPE: '仓储货架', STD_HOUR: 0.02, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 10, STEP_CODE: 'S10', STEP_NAME: '数控粗加工', WORK_CENTER: '数控加工区', EQUIP_TYPE: '加工中心', STD_HOUR: 0.12, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 30, STEP_CODE: 'S30', STEP_NAME: '机器人焊接', WORK_CENTER: '机器人焊接区', EQUIP_TYPE: '焊接机器人', STD_HOUR: 0.18, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 60, STEP_CODE: 'S60', STEP_NAME: '三坐标检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '三坐标测量机', STD_HOUR: 0.08, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 70, STEP_CODE: 'S70', STEP_NAME: '在线视觉检测', WORK_CENTER: '精密检测区', EQUIP_TYPE: '视觉检测站', STD_HOUR: 0.03, OUTSOURCE_FLAG: 0, IS_QC_POINT: 1, IS_KEY_STEP: 0 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 75, STEP_CODE: 'S75', STEP_NAME: '表面处理(外协)', WORK_CENTER: '外协', EQUIP_TYPE: '外协', STD_HOUR: 0, OUTSOURCE_FLAG: 1, IS_QC_POINT: 1, IS_KEY_STEP: 1 }),
    base({ ROUTE_NO: 'RT-MB3', SEQ_NO: 80, STEP_CODE: 'S80', STEP_NAME: '入库上架', WORK_CENTER: '智能仓储区', EQUIP_TYPE: '仓储货架', STD_HOUR: 0.02, OUTSOURCE_FLAG: 0, IS_QC_POINT: 0, IS_KEY_STEP: 0 })
  ];
  S.RT_ROUTE_VERSION = [
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V1', PRODUCT_NO: 'P-SF-001', EFFECT_DATE: '2025-03-01', STATUS: '已失效', CHANGE_REASON: '首版发布', APPROVED_BY: '吴工' }),
    base({ ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', PRODUCT_NO: 'P-SF-001', EFFECT_DATE: '2026-06-01', STATUS: '已发布', CHANGE_REASON: '焊接参数优化+增加在线视觉检测工序', APPROVED_BY: '吴工' }),
    base({ ROUTE_NO: 'RT-SF2', ROUTE_VER: 'V1', PRODUCT_NO: 'P-SF-002', EFFECT_DATE: '2025-03-01', STATUS: '已发布', APPROVED_BY: '吴工' }),
    base({ ROUTE_NO: 'RT-MB3', ROUTE_VER: 'V1', PRODUCT_NO: 'P-MB-003', EFFECT_DATE: '2024-09-01', STATUS: '已发布', APPROVED_BY: '吴工' })
  ];
  S.RT_VERSION_LOG = [
    base({ ROUTE_NO: 'RT-SF1', FROM_VER: 'V1', TO_VER: 'V2', CHANGE_BY: '吴工', CHANGE_TIME: '2026-05-28 10:00:00', ECN_NO: 'ECN-2026-012', CHANGE_CONTENT: '焊接电流由200A调整为220A；S70 在线视觉检测由抽检改为全检' })
  ];
  S.RT_SOP = [
    base({ SOP_NO: 'SOP-SF1-30', ITEM_NAME: '前副车架总成', PART_NO: 'LD-31001', ENGINEER_NAME: '吴工', STEP_NO: 'S30', SOP_VER: 'V2', SOP_CONTENT: '1.装夹前确认工装定位销无磨损；2.焊接参数：电流220A、电压24V、焊速8mm/s；3.首件必做焊缝外观与熔深确认；4.导电嘴每500件更换', KEY_POINTS: '焊缝咬边≤0.5mm；不得有气孔/未熔合', EQUIP_NO: 'RBT-008', EFFECT_DATE: '2026-06-01', STATUS: '已发布' }),
    base({ SOP_NO: 'SOP-SF1-50', ITEM_NAME: '前副车架总成', PART_NO: 'LD-31001', ENGINEER_NAME: '吴工', STEP_NO: 'S50', SOP_VER: 'V1', SOP_CONTENT: '1.按扭矩程序执行，M12螺栓扭矩45N·m+角度90°；2.每班首件做扭矩校验；3.角度法监控贴死判定', KEY_POINTS: '扭矩偏差±5%内；滑牙/漏拧即停线', EQUIP_NO: 'ASM-014', EFFECT_DATE: '2026-06-01', STATUS: '已发布' })
  ];
  S.RT_OUTSOURCE_STEP = [
    base({ STEP_CODE: 'S75', OUTSOURCE_FLAG: 1, SUPPLIER_CODE: 'S003', PRICE: 12.0, LEAD_TIME: 3, IQC_REQUIRED: 1, HAS_INSPECTION_REPORT: 1 })
  ];

  /* ==================== 订单管理（报价→销售→请购→采购→到货） ==================== */
  S.SD_QUOTATION = [
    doc({ QUOTE_NO: '311-20260825001', DOC_NO: '311-20260825001', DOC_TYPE: '311', DOC_DATE: '2026-08-25', EXCHANGE_RATE: 1, DELIVERY_DAYS: 30, CUSTOMER_CODE: 'C001', QUOTE_DATE: '2026-08-25', VALID_UNTIL: '2026-09-25', STATUS: '客户签回', CUSTOMER_SIGN: '王经理' }),
    doc({ QUOTE_NO: '311-20260901002', DOC_NO: '311-20260901002', DOC_TYPE: '311', DOC_DATE: '2026-09-01', EXCHANGE_RATE: 1, DELIVERY_DAYS: 45, CUSTOMER_CODE: 'C002', QUOTE_DATE: '2026-09-01', VALID_UNTIL: '2026-10-01', STATUS: '客户签回', CUSTOMER_SIGN: '李经理' })
  ];
  S.SD_QUOTATION_LINE = [
    base({ QUOTE_NO: '311-20260825001', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', QTY: 1000, UNIT: '件', PRICE: 268, TAX_TYPE: '增值税', TAX_RATE: 0.13, CURRENCY: 'CNY', AMOUNT: 268000, DELIVERY_DATE: '2026-09-30' }),
    base({ QUOTE_NO: '311-20260901002', SEQ_NO: 1, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', QTY: 800, UNIT: '件', PRICE: 96, TAX_TYPE: '增值税', TAX_RATE: 0.13, CURRENCY: 'CNY', AMOUNT: 76800, DELIVERY_DATE: '2026-10-15' })
  ];
  S.SD_SALES_ORDER = [
    doc({ SO_NO: 'SO-2026-001', DOC_NO: 'SO-2026-001', DOC_TYPE: '2101', ORDER_TYPE: '国内订单', CUSTOMER_PO_NO: 'LD-PO-2608-117', CUSTOMER_CODE: 'C001', TEL: '0519-88123456', FAX: '0519-88123457', DOC_DATE: '2026-08-28', REVIEW_STATUS: '已评审', REVIEW_BY: '马晓东', REVIEW_TIME: '2026-08-28 16:30:00', DELIVERY_DATE: '2026-09-30', STATUS: '执行中', MO_NO: 'WO-2026-0001', PLAN_QTY: 1000, FINISH_QTY: 1000, MAKER: '马晓东' }),
    doc({ SO_NO: 'SO-2026-002', DOC_NO: 'SO-2026-002', DOC_TYPE: '2101', ORDER_TYPE: '国内订单', CUSTOMER_PO_NO: 'ZC-PO-2609-055', CUSTOMER_CODE: 'C002', TEL: '0551-65321111', DOC_DATE: '2026-09-01', REVIEW_STATUS: '已评审', REVIEW_BY: '马晓东', REVIEW_TIME: '2026-09-01 15:00:00', DELIVERY_DATE: '2026-10-15', STATUS: '执行中', MO_NO: 'WO-2026-0003', MAKER: '马晓东' })
  ];
  S.SD_SALES_ORDER_LINE = [
    base({ SO_NO: 'SO-2026-001', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', CUSTOMER_PART_NO: 'LD-31001', ORDER_QTY: 1000, DELIVERED_QTY: 1000, OPEN_QTY: 0, PRICE: 268, AMOUNT: 268000, DELIVERY_DATE: '2026-09-30' }),
    base({ SO_NO: 'SO-2026-002', SEQ_NO: 1, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', SPEC: 'Q345B 冲焊件', CUSTOMER_PART_NO: 'ZC-24003', ORDER_QTY: 800, DELIVERED_QTY: 0, OPEN_QTY: 800, PRICE: 96, AMOUNT: 76800, DELIVERY_DATE: '2026-10-15' }),
    base({ SO_NO: 'SO-2026-002', SEQ_NO: 2, ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', SPEC: 'Q345B 焊接总成', CUSTOMER_PART_NO: 'ZC-31002', ORDER_QTY: 500, DELIVERED_QTY: 0, OPEN_QTY: 500, PRICE: 252, AMOUNT: 126000, DELIVERY_DATE: '2026-10-20' })
  ];
  S.PD_PRICE_COMPARE = [
    base({ PR_NO: 'PR-2026-0001', SOURCE_TYPE: '生产计划', SOURCE_NO: 'MP-2026-09-01', SO_NO: 'SO-2026-001', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', UNIT: 'kg', REQ_QTY: 19000, REQ_DATE: '2026-09-05', SUGGEST_SUPPLIER: 'S001', COMPARE_RESULT: 'S001 单价4.65 / 中天钢铁 4.72 / 兴澄特钢 4.88，选定最低价', SELECTED_SUPPLIER: 'S001', COMPARE_BY: '钱进', COMPARE_DATE: '2026-08-29', AUDIT_STATUS: '已审核' }),
    base({ PR_NO: 'PR-2026-0002', SOURCE_TYPE: '生产计划', SOURCE_NO: 'MP-2026-09-03', SO_NO: 'SO-2026-002', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', UNIT: '件', REQ_QTY: 810, REQ_DATE: '2026-09-05', SUGGEST_SUPPLIER: 'S002', COMPARE_RESULT: 'S002 单价46 / 立中精工 49.2，选定最低价', SELECTED_SUPPLIER: 'S002', COMPARE_BY: '钱进', COMPARE_DATE: '2026-09-01', AUDIT_STATUS: '已审核' }),
    base({ PR_NO: 'PR-2026-0003', SOURCE_TYPE: '生产计划', SOURCE_NO: 'MP-2026-09-01', SO_NO: 'SO-2026-001', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', SPEC: 'Φ60×90', UNIT: '套', REQ_QTY: 4000, REQ_DATE: '2026-09-05', SUGGEST_SUPPLIER: 'S004', COMPARE_RESULT: '仅合格供方S004，直接下单', SELECTED_SUPPLIER: 'S004', COMPARE_BY: '钱进', COMPARE_DATE: '2026-09-09', AUDIT_STATUS: '已审核' })
  ];
  S.PD_PURCHASE_ORDER = [
    doc({ PO_NO: 'PO-2026-0001', DOC_NO: 'PO-2026-0001', DOC_TYPE: '3201', SO_NO: 'SO-2026-001', DOC_DATE: '2026-08-30', SUPPLIER_CODE: 'S001', RECV_WAREHOUSE: '原料仓', DELIVERY_DATE: '2026-09-03', SETTLE_TYPE: '月结30天', STATUS: '全部到货', MAKER: '钱进' }),
    doc({ PO_NO: 'PO-2026-0002', DOC_NO: 'PO-2026-0002', DOC_TYPE: '3201', SO_NO: 'SO-2026-002', DOC_DATE: '2026-09-01', SUPPLIER_CODE: 'S002', RECV_WAREHOUSE: '原料仓', DELIVERY_DATE: '2026-09-05', SETTLE_TYPE: '月结30天', STATUS: '全部到货', MAKER: '钱进' }),
    doc({ PO_NO: 'PO-2026-0003', DOC_NO: 'PO-2026-0003', DOC_TYPE: '3201', DOC_DATE: '2026-09-10', SUPPLIER_CODE: 'S004', RECV_WAREHOUSE: '原料仓', DELIVERY_DATE: '2026-09-25', SETTLE_TYPE: '款到发货', STATUS: '在途', MAKER: '钱进' })
  ];
  S.PD_PURCHASE_ORDER_LINE = [
    base({ PO_NO: 'PO-2026-0001', SEQ_NO: 1, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', UNIT: 'kg', ORDER_QTY: 19000, PRICE: 4.65, AMOUNT: 88350, TAX_RATE: 0.13, ARRIVED_QTY: 19000, OWING_QTY: 0, DELIVERY_DATE: '2026-09-03' }),
    base({ PO_NO: 'PO-2026-0001', SEQ_NO: 2, ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SPEC: 'Φ76×4.0', UNIT: 'kg', ORDER_QTY: 6500, PRICE: 5.6, AMOUNT: 36400, TAX_RATE: 0.13, ARRIVED_QTY: 6500, OWING_QTY: 0, DELIVERY_DATE: '2026-09-03' }),
    base({ PO_NO: 'PO-2026-0002', SEQ_NO: 1, ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', UNIT: '件', ORDER_QTY: 900, PRICE: 46, AMOUNT: 41400, TAX_RATE: 0.13, ARRIVED_QTY: 900, OWING_QTY: 0, DELIVERY_DATE: '2026-09-05' }),
    base({ PO_NO: 'PO-2026-0003', SEQ_NO: 1, ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', SPEC: 'Φ60×90', UNIT: '套', ORDER_QTY: 16000, PRICE: 8.6, AMOUNT: 137600, TAX_RATE: 0.13, ARRIVED_QTY: 0, OWING_QTY: 16000, DELIVERY_DATE: '2026-09-25' })
  ];
  S.PD_ARRIVAL = [
    doc({ ARRIVAL_NO: '301-20260903001', DOC_NO: '301-20260903001', DOC_TYPE: '301', DOC_DATE: '2026-09-03', ORG_ID: ORG, SUPPLIER_CODE: 'S001', PO_NO: 'PO-2026-0001', ARRIVAL_DATE: '2026-09-03', SUPPLIER_DN_NO: 'TG-DN-25881', IQC_FLAG: 1, STATUS: '已入库', MAKER: '朱霞' }),
    doc({ ARRIVAL_NO: '301-20260905002', DOC_NO: '301-20260905002', DOC_TYPE: '301', DOC_DATE: '2026-09-05', ORG_ID: ORG, SUPPLIER_CODE: 'S002', PO_NO: 'PO-2026-0002', ARRIVAL_DATE: '2026-09-05', SUPPLIER_DN_NO: 'MZ-DN-30012', IQC_FLAG: 1, STATUS: '已入库', MAKER: '朱霞' })
  ];
  S.PD_ARRIVAL_LINE = [
    base({ ARRIVAL_NO: '301-20260903001', SEQ_NO: 1, ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', ARRIVAL_QTY: 19000, UNIT: 'kg', LOT_NO: 'LOT-TG260903' }),
    base({ ARRIVAL_NO: '301-20260903001', SEQ_NO: 2, ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SPEC: 'Φ76×4.0', ARRIVAL_QTY: 6500, UNIT: 'kg', LOT_NO: 'LOT-TG260904' }),
    base({ ARRIVAL_NO: '301-20260905002', SEQ_NO: 1, ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', ARRIVAL_QTY: 900, UNIT: '件', LOT_NO: 'LOT-MZ260905' })
  ];
  /* 说明：原「进货单(PD_RECEIPT / PD_RECEIPT_LINE)」已按需求取消，到货后直接生成采购入库。 */

  /* ==================== 计划排产 ==================== */
  S.PP_MASTER_PLAN = [
    base({ PLAN_NO: 'MP-2026-09-01', SO_NO: 'SO-2026-001', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', DEPT_CLASS: '焊装课', WIP_QTY: 0, M1_QTY: 1000, M2_QTY: 0, M3_QTY: 0, TOTAL_QTY: 1000, DATA_SOURCE: '销售订单', MAKER: '孙倩', PUBLISH_DATE: '2026-09-01', PLAN_TYPE: '月计划', STATUS: '已完工', AUDIT_STATUS: '已审核' }),
    base({ PLAN_NO: 'MP-2026-09-03', SO_NO: 'SO-2026-002', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', DEPT_CLASS: '焊装课', WIP_QTY: 0, M1_QTY: 800, M2_QTY: 1200, M3_QTY: 1200, TOTAL_QTY: 3200, DATA_SOURCE: '销售订单+预测', MAKER: '孙倩', PUBLISH_DATE: '2026-09-01', PLAN_TYPE: '月计划', STATUS: '已确认', AUDIT_STATUS: '已审核' })
  ];
  S.PP_MASTER_PLAN_LINE = [
    base({ PLAN_NO: 'MP-2026-09-01', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成 Q345B 焊接总成', PLAN_MONTH: '2026-09', PLAN_QTY: 1000, WO_QTY: 1000, FINISHED_QTY: 1000, REQ_DATE: '2026-09-30', LINE_STATUS: '已完工' }),
    base({ PLAN_NO: 'MP-2026-09-03', SEQ_NO: 1, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架 Q345B 冲焊件', PLAN_MONTH: '2026-09', PLAN_QTY: 800, WO_QTY: 800, FINISHED_QTY: 790, REQ_DATE: '2026-09-30', LINE_STATUS: '已完工' }),
    base({ PLAN_NO: 'MP-2026-09-03', SEQ_NO: 2, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架 Q345B 冲焊件', PLAN_MONTH: '2026-10', PLAN_QTY: 1200, WO_QTY: 0, FINISHED_QTY: 0, REQ_DATE: '2026-10-31', LINE_STATUS: '未下达' }),
    base({ PLAN_NO: 'MP-2026-09-03', SEQ_NO: 3, ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架 Q345B 冲焊件', PLAN_MONTH: '2026-11', PLAN_QTY: 1200, WO_QTY: 0, FINISHED_QTY: 0, REQ_DATE: '2026-11-30', LINE_STATUS: '未下达' })
  ];
  /* 说明：原「MRP 展开结果(PP_MRP_RESULT)」已按需求取消——原由 MRP 承担的「计划→请购」与「计划→工单」
     两条边，现直接落在生产计划自身的流转上（生产计划明细作为下达依据，请购由 SOURCE_NO 关联生产计划）。 */
  /* 产能负载：按 5 工单 × 9 工序 = 45 道次，每道次 4h 净工时（200件÷50件/h）折算。
     各设备负载小时 = 承担道次 × 4h；可用产能按两天两班制 16h/日 × 2 日 = 32h 口径示意。 */
  S.PP_CAPACITY_LOAD = (function () {
    var LOAD = {
      'CNC-001': 8, 'CNC-002': 8, 'CNC-003': 8, 'CNC-004': 8, 'CNC-005': 8,
      'RBT-008': 8, 'RBT-009': 4, 'RBT-011': 4, 'RBT-012': 4,
      'ASM-013': 12, 'ASM-015': 8, 'ASM-016': 8, 'ASM-017': 4,
      'ASM-014': 8, 'QMS-019': 12, 'QMS-020': 8, 'QMS-021': 12, 'QMS-022': 8
    };
    var AVAIL = {
      'CNC-001': 32, 'CNC-002': 32, 'CNC-003': 32, 'CNC-004': 32, 'CNC-005': 32,
      'RBT-008': 32, 'RBT-009': 32, 'RBT-011': 32, 'RBT-012': 32,
      'ASM-013': 32, 'ASM-015': 32, 'ASM-016': 32, 'ASM-017': 32,
      'ASM-014': 32, 'QMS-019': 32, 'QMS-020': 32, 'QMS-021': 32, 'QMS-022': 32
    };
    var CENTER = {
      'CNC-001': '数控加工区', 'CNC-002': '数控加工区', 'CNC-003': '数控加工区', 'CNC-004': '数控加工区', 'CNC-005': '数控加工区',
      'RBT-008': '机器人焊接区', 'RBT-009': '机器人焊接区', 'RBT-011': '机器人焊接区', 'RBT-012': '机器人焊接区',
      'ASM-013': '动力总成装配区', 'ASM-014': '动力总成装配区', 'ASM-015': '动力总成装配区', 'ASM-016': '动力总成装配区', 'ASM-017': '动力总成装配区',
      'QMS-019': '精密检测区', 'QMS-020': '精密检测区', 'QMS-021': '精密检测区', 'QMS-022': '精密检测区'
    };
    return Object.keys(LOAD).map(function (eq) {
      var rate = +(LOAD[eq] / AVAIL[eq]).toFixed(4);
      var isBottle = rate >= 0.3;
      return base({
        CAP_LEVEL: 'CRP', WORK_CENTER: CENTER[eq], EQUIP_NO: eq, LOAD_DATE: '2026-09-06',
        AVAILABLE_CAP: AVAIL[eq], LOAD_HOURS: LOAD[eq], LOAD_RATE: rate,
        BOTTLENECK_FLAG: isBottle ? 1 : 0,
        SUGGEST_ADJ: isBottle ? (eq.indexOf('QMS') === 0 ? '检测为瓶颈：建议增加检测台次或错峰排检' : '负载偏高：建议安排中班并行') : '',
        AUDIT_STATUS: '已审核'
      });
    });
  })();
  S.PP_SCHEDULE = (function () {
    var STEPS = [
      ['S10', 'CNC-001'], ['S20', 'CNC-001'], ['S30', 'RBT-008'], ['S40', 'ASM-013'], ['S50', 'ASM-014'],
      ['S60', 'QMS-019'], ['S70', 'QMS-021'], ['S75', ''], ['S80', 'WH-025']
    ];
    var EQSET = [
      { S10: 'CNC-001', S20: 'CNC-001', S30: 'RBT-008', S40: 'ASM-013', S50: 'ASM-014', S60: 'QMS-019', S70: 'QMS-021', S75: '', S80: 'WH-025' },
      { S10: 'CNC-002', S20: 'CNC-002', S30: 'RBT-009', S40: 'ASM-013', S50: 'ASM-014', S60: 'QMS-019', S70: 'QMS-021', S75: '', S80: 'WH-025' },
      { S10: 'CNC-003', S20: 'CNC-003', S30: 'RBT-011', S40: 'ASM-016', S50: 'ASM-015', S60: 'QMS-020', S70: 'QMS-022', S75: '', S80: 'WH-025' },
      { S10: 'CNC-004', S20: 'CNC-004', S30: 'RBT-012', S40: 'ASM-016', S50: 'ASM-015', S60: 'QMS-020', S70: 'QMS-022', S75: '', S80: 'WH-026' },
      { S10: 'CNC-005', S20: 'CNC-005', S30: 'RBT-008', S40: 'ASM-013', S50: 'ASM-017', S60: 'QMS-019', S70: 'QMS-021', S75: '', S80: 'WH-026' }
    ];
    var EMP = { S10: 'E001', S20: 'E001', S30: 'E003', S40: 'E011', S50: 'E012', S60: 'E005', S70: 'E005', S75: 'E007', S80: 'E010' };
    var TEAM = { S10: 'T1', S20: 'T1', S30: 'T3', S40: 'T4', S50: 'T4', S60: 'T-JC', S70: 'T-JC', S75: 'WX', S80: 'T-WH' };
    var rows = [], seq = 0;
    for (var w = 0; w < 5; w++) {
      var wo = 'WO-2026-000' + (w + 1);
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][w];
      var cur = new Date(day + 'T08:00:00');
      STEPS.forEach(function (s) {
        seq++;
        var no = s[0];
        /* 工序 75 表面处理为外协：外协工位记供应商编号 S003（苏州金泰表面处理），
           既满足 PP_SCHEDULE.EQUIP_NO 必填，也如实反映「外协不占自有设备」这一事实。 */
        var eq = no === 'S75' ? 'S003' : (EQSET[w][no] || '');
        var hrs = no === 'S75' ? 0 : (no === 'S80' ? 0.5 : 4 / 9 > 0 ? +(200 * 0.02).toFixed(2) : 0);
        var from = new Date(cur.getTime());
        cur.setMinutes(cur.getMinutes() + Math.round(hrs * 60));
        var to = new Date(cur.getTime());
        var pad = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':00'; };
        rows.push(base({
          SCHEDULE_NO: 'SCH-2026-' + String(seq).padStart(4, '0'), WO_NO: wo, STEP_NO: no, EQUIP_NO: eq,
          EMP_NO: EMP[no], TEAM_CODE: TEAM[no], PLAN_START: pad(from), PLAN_END: pad(to),
          PRIORITY: w + 1, SCHEDULE_STATUS: '已完成', RUSH_FLAG: 0, AUDIT_STATUS: '已审核'
        }));
      });
    }
    return rows;
  })();
  S.EX_WORK_ORDER = (function () {
    /* 销售订单 SO-2026-001 = 1000 件 → 拆 5 个工单 × 200 件（WO-2026-0001 ~ WO-2026-0005）。
     * 设备按 50 件/h 模拟：单工单 200 件 = 4h 净加工 = 2 个班次各报工一次 100 件。
     * 5 个工单并行分配给不同加工中心/焊接机器人（并行排产）。
     *   单号        计划  完工  入库  状态      开工日      计划完工     并行主设备
     *   WO-0001    200   200   200  已入库    2026-09-06  2026-09-06   CNC-001
     *   WO-0002    200   200   200  已入库    2026-09-06  2026-09-06   CNC-002
     *   WO-0003    200   200   200  已入库    2026-09-07  2026-09-07   CNC-003
     *   WO-0004    200   200   200  已入库    2026-09-07  2026-09-07   CNC-004
     *   WO-0005    200   200   200  已入库    2026-09-08  2026-09-08   CNC-005
     * 前 4 单在 09-06/09-07 两班制完成，第 5 单 09-08 完成，合计 1000 件全部入库。 */
    var plan = [
      ['WO-2026-0001', 'LOT-SO001-A', '2026-09-06', 'CNC-001'],
      ['WO-2026-0002', 'LOT-SO001-B', '2026-09-06', 'CNC-002'],
      ['WO-2026-0003', 'LOT-SO001-C', '2026-09-07', 'CNC-003'],
      ['WO-2026-0004', 'LOT-SO001-D', '2026-09-07', 'CNC-004'],
      ['WO-2026-0005', 'LOT-SO001-E', '2026-09-08', 'CNC-005']
    ];
    return plan.map(function (p, i) {
      return doc({
        WO_NO: p[0], DOC_NO: p[0], WO_TYPE: '成品工单', DOC_TYPE: '5101', DOC_DATE: p[2],
        PLAN_NO: 'MP-2026-09-01', PRODUCT_NO: 'P-SF-001', PRODUCT_NAME: '前副车架总成',
        PLAN_LOT_NO: p[1], OPEN_DATE: p[2], PLAN_QTY: 200, PLAN_START: p[2], PLAN_END: p[2],
        ROUTE_NO: 'RT-SF1', ROUTE_VER: 'V2', BOM_VER: 'V2', LINE_CODE: 'L1', DEPT_CLASS: '焊装课',
        SO_NO: 'SO-2026-001', SEQ_NO: i + 1, PLAN_EQUIP_NO: p[3],
        STATUS: '已入库', RELEASE_BY: '孙倩', RELEASE_TIME: p[2] + ' 07:30:00',
        FINISH_QTY: 200, IN_QTY: 200, MAKER: '孙倩'
      });
    });
  })();

  /* ==================== 库存：领料/出入库 ==================== */
  /* 领料单：1 单对应 1 工单（5 工单 → 5 张领料单），料量按单工单 200 件 BOM 折算。
     BOM 单件用料：Q345B 钢板 19.0kg / 20#钢管 1.6kg / 焊丝 0.4kg / 切削液 0.05 桶。 */
  S.EX_ISSUE_ORDER = (function () {
    return [1, 2, 3, 4, 5].map(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      return doc({
        ISSUE_NO: '5401-' + day.replace(/-/g, '') + String(n).padStart(3, '0'),
        DOC_NO: '5401-' + day.replace(/-/g, '') + String(n).padStart(3, '0'),
        DOC_TYPE: '5401', DOC_DATE: day, ORG_ID: ORG, DEPT_CLASS: '机加课',
        TEAM_CODE: 'T1', ISSUE_BY: 'E001', STOREKEEPER: '朱霞', ISSUE_TYPE: '生产领料',
        WO_NO: wo, STEP_NO: 'S10', TOTAL_QTY: 1900 + 320 + 80 + 10,
        STATUS: '已出库', MAKER: 'E010'
      });
    });
  })();
  /* 领料库位 = 货架：WH-023 原料架。每单按单件 BOM×200 件发料。 */
  S.EX_ISSUE_LINE = (function () {
    var rows = [], seq = 0;
    var BOM = [
      ['M-Q345B', 'Q345B结构钢板', '6.0×1250×2500', 19.0, 'kg', 1900, 'LOT-TG260903'],
      ['M-20G', '20#无缝钢管', 'Φ76×4.0', 1.6, 'kg', 320, 'LOT-TG260904'],
      ['M-WIRE-ER50', 'CO2焊丝ER50-6', 'Φ1.2 实心焊丝', 0.4, 'kg', 80, ''],
      ['M-COOL', '半合成切削液', 'MAC-COOL 920', 0.05, '桶', 10, '']
    ];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      var issueNo = '5401-' + day.replace(/-/g, '') + String(n).padStart(3, '0');
      BOM.forEach(function (b, k) {
        seq++;
        rows.push(base({
          ISSUE_NO: issueNo, SEQ_NO: k + 1, ITEM_NO: b[0], ITEM_NAME: b[1], SPEC: b[2],
          ISSUE_QTY: b[5], PIECE_CNT: b[5], UNIT: b[4], LOT_NO: b[6], LOCATION: 'WH-023',
          ISSUED_QTY_ACC: b[5], LIMIT_QTY: b[5], OVER_RATIO: 0
        }));
      });
    });
    return rows;
  })();
  S.WM_OUTBOUND = (function () {
    var rows = [];
    var extra = 11;   // 补充单号从这里起排（0001~0005 给 Q345B 那行，0006 给销售出库）
    /* 每张领料单实际有 4 行物料，原来只出了 Q345B 这一行 ⇒「单头已出库、明细已领 0」自相矛盾，
       另外三种料的库存在账上永不动。这里补齐余下 3 行。
       注意 ITEM_NO 必须写：recomputeStock 是按 item_no 归集的，之前种子漏了这一列，
       导致线上每次重算都归集不到（库存全 0／负就是这么来的）。 */
    var REST = [
      { item: 'M-20G',       name: '20#无缝钢管',   qty: 320, lot: 'LOT-TG260904' },
      { item: 'M-WIRE-ER50', name: 'CO2焊丝ER50-6', qty: 80,  lot: '' },
      { item: 'M-COOL',      name: '半合成切削液',   qty: 10,  lot: '' }
    ];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      var issueNo = '5401-' + day.replace(/-/g, '') + String(n).padStart(3, '0');
      rows.push(doc({
        OUT_NO: 'OUT-2026-' + String(n).padStart(4, '0'), DOC_NO: 'OUT-2026-' + String(n).padStart(4, '0'),
        DOC_TYPE: '5401', DOC_DATE: day, OUT_TYPE: '领料出库', WO_NO: wo, STEP_NO: 'S10',
        WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', LOT_NO: 'LOT-TG260903', OUT_QTY: 1900,
        ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', ISSUE_NO: issueNo,
        ISSUE_BY: 'E001', STOREKEEPER: '朱霞', STATUS: '已出库'
      }));
      REST.forEach(function (r) {
        var no = 'OUT-2026-' + String(extra).padStart(4, '0'); extra++;
        rows.push(doc({
          OUT_NO: no, DOC_NO: no, DOC_TYPE: '5401', DOC_DATE: day, OUT_TYPE: '领料出库',
          WO_NO: wo, STEP_NO: 'S10', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023',
          LOT_NO: r.lot, OUT_QTY: r.qty, ITEM_NO: r.item, ITEM_NAME: r.name,
          ISSUE_NO: issueNo, ISSUE_BY: 'E001', STOREKEEPER: '朱霞', STATUS: '已出库'
        }));
      });
    });
    /* 销售出库：1000 件成品发货 */
    rows.push(doc({ OUT_NO: 'OUT-2026-0006', DOC_NO: 'OUT-2026-0006', DOC_TYPE: '2302', DOC_DATE: '2026-09-15',
      OUT_TYPE: '销售出库', WAREHOUSE_CODE: '成品仓', LOCATION: 'WH-025', LOT_NO: 'LOT-SO001-A',
      OUT_QTY: 1000, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成',
      ISSUE_BY: '马晓东', STOREKEEPER: '朱霞', STATUS: '已出库', REMARK: '对应销货单 2302-20260915001' }));
    return rows;
  })();
  S.WM_INBOUND = [
    doc({ IN_NO: 'IN-2026-0001', DOC_NO: 'IN-2026-0001', DOC_TYPE: '3401', DOC_DATE: '2026-09-03', IN_TYPE: '采购入库', SUPPLIER_CODE: 'S001', ARRIVAL_NO: '301-20260903001', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 25500, PRICE_QTY: 25500, LOT_NO: 'LOT-TG260903', ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', QC_NO: 'QC-2026-001', QC_RESULT: '合格', STATUS: '已入库' }),
    doc({ IN_NO: 'IN-2026-0002', DOC_NO: 'IN-2026-0002', DOC_TYPE: '3401', DOC_DATE: '2026-09-05', IN_TYPE: '采购入库', SUPPLIER_CODE: 'S002', ARRIVAL_NO: '301-20260905002', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 884, PRICE_QTY: 884, LOT_NO: 'LOT-MZ260905', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', QC_NO: 'QC-2026-002', QC_RESULT: '让步接收', STATUS: '已入库' }),
    /* 期初结存建账（2026-08-31）：原料仓 5 个品号的期初库存。
       修正背景：原来 WM_INBOUND 只有上面两张采购入库单、且都没有品号，
       M-Q345B 只有 5 张领料单各 1900kg 的出库（合计 9500）却没有任何入库，
       rules.recomputeStock 会算出在库 -9500。
       补这 5 张后：Q345B 20000-9500=10500、20#钢管 4800、焊丝 1200、
       切削液 80、衬套 3200（该品号是「待检」状态，全额计待检冻结，可用 0）。
       批号必须与 WM_STOCK 对应行一致，否则重算归集不到。 */
    doc({ IN_NO: 'IN-2026-0003', DOC_NO: 'IN-2026-0003', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: 'S001', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 20000, PRICE_QTY: 20000, LOT_NO: 'LOT-TG260903', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账' }),
    doc({ IN_NO: 'IN-2026-0004', DOC_NO: 'IN-2026-0004', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: 'S001', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 4800, PRICE_QTY: 4800, LOT_NO: 'LOT-TG260904', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账' }),
    doc({ IN_NO: 'IN-2026-0005', DOC_NO: 'IN-2026-0005', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: 'S004', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 1200, PRICE_QTY: 1200, LOT_NO: '', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账' }),
    doc({ IN_NO: 'IN-2026-0006', DOC_NO: 'IN-2026-0006', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: '', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 80, PRICE_QTY: 80, LOT_NO: '', ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账' }),
    doc({ IN_NO: 'IN-2026-0007', DOC_NO: 'IN-2026-0007', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: 'S004', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: 3200, PRICE_QTY: 3200, LOT_NO: '', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账' }),
    /* 成品仓的「上月结转」同样要有单据，否则重算就把 STK-009/010 归零了。
       期初结存走 WM_INBOUND（不是 WM_FINISH_IN）——完工入库会反算工单，
       而这两款成品在本剧本里本来就没有工单。 */
    doc({ IN_NO: 'IN-2026-0008', DOC_NO: 'IN-2026-0008', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: '', WAREHOUSE_CODE: '成品仓', ACCEPT_QTY: 500, PRICE_QTY: 500, LOT_NO: 'LOT-F-20260831-01', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账（成品上月结转）' }),
    doc({ IN_NO: 'IN-2026-0009', DOC_NO: 'IN-2026-0009', DOC_TYPE: '3401', DOC_DATE: '2026-08-31', IN_TYPE: '期初结存', SUPPLIER_CODE: '', WAREHOUSE_CODE: '成品仓', ACCEPT_QTY: 790, PRICE_QTY: 790, LOT_NO: 'LOT-F-20260903-03', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', QC_RESULT: '合格', STATUS: '已入库', REMARK: '期初结存建账（成品上月结转）' })
  ];
  /* 完工入库申请：标注货架库位（半成品→WH-024，成品→WH-025/026） */
  /* 完工入库申请：5 个工单各一次，每次 200 件（与 5×200 口径一致）。
     货架库位：成品 → WH-025 / WH-026。 */
  S.EX_FINISH_IN = (function () {
    return [1, 2, 3, 4, 5].map(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      var dt = day + ' 18:00:00';
      return base({
        IN_NO: 'FI-2026-' + String(n).padStart(4, '0'), WO_NO: wo, PRODUCT_NO: 'P-SF-001',
        FINISH_QTY: 200, GOOD_QTY: 200, NG_QTY: 0,
        QC_NO: 'QC-2026-' + String(5 + n).padStart(3, '0'),
        WAREHOUSE_CODE: '成品仓', LOCATION: n % 2 === 0 ? 'WH-026' : 'WH-025',
        LOT_NO: 'LOT-SO001-' + 'ABCDE'[n - 1], STATUS: '已入库', IN_TIME: dt
      });
    });
  })();
  S.WM_FINISH_IN = (function () {
    return [1, 2, 3, 4, 5].map(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      return doc({
        IN_NO: 'WI-2026-' + String(n).padStart(4, '0'), DOC_NO: 'WI-2026-' + String(n).padStart(4, '0'),
        DOC_NAME: '成品入库单', DOC_TYPE: '5201', DOC_DATE: day, WO_NO: wo, WAREHOUSE_CODE: '成品仓',
        LOCATION: n % 2 === 0 ? 'WH-026' : 'WH-025', LOT_NO: 'LOT-SO001-' + 'ABCDE'[n - 1],
        QC_NO: 'QC-2026-' + String(5 + n).padStart(3, '0'),
        ACCEPT_QTY: 200, TOTAL_IN_QTY: 200, GOOD_QTY: 200, NG_QTY: 0, REWORK_IN_FLAG: 0, STATUS: '已入库'
      });
    });
  })();
  S.WM_STOCKTAKING = [
    doc({ ST_NO: 'ST-2026-0001', DOC_NO: 'ST-2026-0001', DOC_TYPE: '5501', DOC_DATE: '2026-09-14', ST_TYPE: '循环盘点', ST_DATE: '2026-09-14', PRODUCT_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', BOOK_QTY: 900, ACTUAL_QTY: 898, GOOD_QTY: 898, DIFF_QTY: -2, DIFF_REASON: '卸货磕碰破损2件，已开报废单处理', COUNT_BY: 'E010', AUDIT_BY: '孙倩', STATUS: '已调整' })
  ];
  /* 库存主账：库位全部改用货架（WH-023 原料架 / WH-024 半成品架 / WH-025·026 成品架）。
     数量口径：与 rules.recomputeStock 的现算结果保持一致——种子里写得再漂亮，
     只要触发一次重算就会被覆盖，所以两边必须同源。
       M-Q345B    期初结存 20000 − 5 张领料单各 1900（合计 9500）= 10500；
       M-20G      期初结存 4800 − 领料出库 5×320（合计 1600）= 3200；
       M-WIRE-ER50 期初结存 1200 − 领料出库 5×80（合计 400）= 800；
       M-COOL     期初结存 80 − 领料出库 5×10（合计 50）= 30；
       M-BUSH-01  期初结存 3200，qc_status=待检 ⇒ 全额计待检冻结，可用 0；
       M-BOLT-M12 采购入库 25500（IN-2026-0001），无出库 ⇒ 25500；
       M-SF-BLANK 采购入库 884（盘点单 ST-2026-0001 的盘亏 2 件未过账到主账）；
       P-SF-001   完工入库 1000（5×200）→ 销售出库 1000 = 0；
       P-SF-002   期初结存 500、P-MB-003 期初结存 790
                  （成品「上月结转」用期初结存单建账，不走完工入库——完工入库会反算工单）。 */
  S.WM_STOCK = [
    base({ STOCK_ID: 'STK-001', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', UNIT: 'kg', LOT_NO: 'LOT-TG260903', QC_STATUS: '合格', ONHAND_QTY: 10500, AVAILABLE_QTY: 10500, FROZEN_QTY: 0, INTRANSIT_QTY: 0, SAFETY_STOCK: 8000, STOCK_AGE: 15, PRODUCE_DATE: '2026-08-20' }),
    base({ STOCK_ID: 'STK-002', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', SPEC: 'Φ76×4.0', UNIT: 'kg', LOT_NO: 'LOT-TG260904', QC_STATUS: '合格', ONHAND_QTY: 3200, AVAILABLE_QTY: 3200, FROZEN_QTY: 0, INTRANSIT_QTY: 0, SAFETY_STOCK: 2000, STOCK_AGE: 15 }),
    base({ STOCK_ID: 'STK-003', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', UNIT: '件', LOT_NO: 'LOT-MZ260905', QC_STATUS: '让步接收', ONHAND_QTY: 884, AVAILABLE_QTY: 884, FROZEN_QTY: 0, INTRANSIT_QTY: 0, SAFETY_STOCK: 300, STOCK_AGE: 13 }),
    base({ STOCK_ID: 'STK-004', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-BUSH-01', ITEM_NAME: '橡胶衬套总成', SPEC: 'Φ60×90', UNIT: '套', LOT_NO: '', QC_STATUS: '待检', ONHAND_QTY: 3200, AVAILABLE_QTY: 0, QC_HOLD_QTY: 3200, FROZEN_QTY: 0, INTRANSIT_QTY: 16000, SAFETY_STOCK: 2000 }),
    base({ STOCK_ID: 'STK-005', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-WIRE-ER50', ITEM_NAME: 'CO2焊丝ER50-6', SPEC: 'Φ1.2 实心焊丝', UNIT: 'kg', LOT_NO: '', QC_STATUS: '合格', ONHAND_QTY: 800, AVAILABLE_QTY: 800, FROZEN_QTY: 0, SAFETY_STOCK: 400 }),
    base({ STOCK_ID: 'STK-006', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-COOL', ITEM_NAME: '半合成切削液', SPEC: 'MAC-COOL 920', UNIT: '桶', LOT_NO: '', QC_STATUS: '合格', ONHAND_QTY: 30, AVAILABLE_QTY: 30, FROZEN_QTY: 0, SAFETY_STOCK: 20 }),
    base({ STOCK_ID: 'STK-007', WAREHOUSE_CODE: '半成品仓', LOCATION: 'WH-024', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', SPEC: 'SF-3101 焊接件', UNIT: '件', LOT_NO: 'LOT-SO001-A', QC_STATUS: '合格', ONHAND_QTY: 0, AVAILABLE_QTY: 0, FROZEN_QTY: 0, SAFETY_STOCK: 300, PRODUCE_DATE: '2026-09-08' }),
    base({ STOCK_ID: 'STK-008', WAREHOUSE_CODE: '成品仓', LOCATION: 'WH-025', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', UNIT: '件', LOT_NO: 'LOT-SO001-A', QC_STATUS: '合格', ONHAND_QTY: 0, AVAILABLE_QTY: 0, FROZEN_QTY: 0, SAFETY_STOCK: 500, PRODUCE_DATE: '2026-09-08', REMARK: 'SO-2026-001 共1000件，09-15 已全部发货' }),
    base({ STOCK_ID: 'STK-009', WAREHOUSE_CODE: '成品仓', LOCATION: 'WH-025', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', SPEC: 'Q345B 焊接总成', UNIT: '件', LOT_NO: 'LOT-F-20260831-01', QC_STATUS: '合格', ONHAND_QTY: 500, AVAILABLE_QTY: 500, FROZEN_QTY: 0, SAFETY_STOCK: 400, REMARK: '上月结转' }),
    base({ STOCK_ID: 'STK-010', WAREHOUSE_CODE: '成品仓', LOCATION: 'WH-026', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', SPEC: 'Q345B 冲焊件', UNIT: '件', LOT_NO: 'LOT-F-20260903-03', QC_STATUS: '合格', ONHAND_QTY: 790, AVAILABLE_QTY: 790, FROZEN_QTY: 0, PRODUCE_DATE: '2026-09-09' }),
    /* 螺栓原先只有 IN-2026-0001 的 25500 件入库、却没有库存行（recomputeStock 只更新已有行、不建行），
       这 25500 在库存台账里一直是隐形的。补 STK-011 + SL-006 后账实对齐。 */
    base({ STOCK_ID: 'STK-011', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', SPEC: '10.9级 达克罗', UNIT: '件', LOT_NO: 'LOT-TG260903', QC_STATUS: '合格', ONHAND_QTY: 25500, AVAILABLE_QTY: 25500, FROZEN_QTY: 0, INTRANSIT_QTY: 0, SAFETY_STOCK: 12000, STOCK_AGE: 37, PRODUCE_DATE: '2026-08-28' })
  ];
  S.WM_STOCK_LOT = [
    base({ STOCK_LOT_ID: 'SL-001', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', UNIT: 'kg', LOT_NO: 'LOT-TG260903', QC_STATUS: '合格', ONHAND_QTY: 10500, AVAILABLE_QTY: 10500, FROZEN_QTY: 0, INTRANSIT_QTY: 0, PRODUCE_DATE: '2026-08-20' }),
    base({ STOCK_LOT_ID: 'SL-002', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-20G', ITEM_NAME: '20#无缝钢管', UNIT: 'kg', LOT_NO: 'LOT-TG260904', QC_STATUS: '合格', ONHAND_QTY: 3200, AVAILABLE_QTY: 3200, FROZEN_QTY: 0, PRODUCE_DATE: '2026-08-21' }),
    base({ STOCK_LOT_ID: 'SL-003', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', UNIT: '件', LOT_NO: 'LOT-MZ260905', QC_STATUS: '让步接收', ONHAND_QTY: 884, AVAILABLE_QTY: 884, FROZEN_QTY: 0, PRODUCE_DATE: '2026-08-28' }),
    base({ STOCK_LOT_ID: 'SL-004', WAREHOUSE_CODE: '半成品仓', LOCATION: 'WH-024', ITEM_NO: 'M-SF-WELD', ITEM_NAME: '副车架焊接分总成', UNIT: '件', LOT_NO: 'LOT-SO001-A', QC_STATUS: '合格', ONHAND_QTY: 0, AVAILABLE_QTY: 0, FROZEN_QTY: 0, PRODUCE_DATE: '2026-09-08' }),
    base({ STOCK_LOT_ID: 'SL-005', WAREHOUSE_CODE: '成品仓', LOCATION: 'WH-025', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', UNIT: '件', LOT_NO: 'LOT-SO001-A', QC_STATUS: '合格', ONHAND_QTY: 0, AVAILABLE_QTY: 0, FROZEN_QTY: 0, PRODUCE_DATE: '2026-09-08' }),
    base({ STOCK_LOT_ID: 'SL-006', WAREHOUSE_CODE: '原料仓', LOCATION: 'WH-023', ITEM_NO: 'M-BOLT-M12', ITEM_NAME: '高强度螺栓M12×60', UNIT: '件', LOT_NO: 'LOT-TG260903', QC_STATUS: '合格', ONHAND_QTY: 25500, AVAILABLE_QTY: 25500, FROZEN_QTY: 0, INTRANSIT_QTY: 0, SAFETY_STOCK: 12000, PRODUCE_DATE: '2026-08-28' })
  ];

  /* ==================== 订单管理（销货） ==================== */
  S.SD_DELIVERY = [
    doc({ DELIVERY_NO: '2302-20260915001', DOC_NO: '2302-20260915001', DOC_TYPE: '2302', DOC_DATE: '2026-09-15', MAKE_DATE: '2026-09-15', CUSTOMER_CODE: 'C001', WAREHOUSE_CODE: '成品仓', TOTAL_QTY: 1000, STATUS: '已出库', MAKER: '马晓东' })
  ];
  S.SD_DELIVERY_LINE = [
    base({ DELIVERY_NO: '2302-20260915001', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', DELIVERY_QTY: 1000, UNIT: '件', BOX_CNT: 20, SO_NO: 'SO-2026-001', CUSTOMER_PO_NO: 'LD-PO-2608-117', LOT_NO: 'LOT-SO001-A', REMARK: '销售订单 SO-2026-001 共 1000 件一次性交付完成' })
  ];

  /* ==================== 生产执行 ==================== */
  /* 工单工序明细：EQUIP_SPEC 记「设备类型/规格」+ EQUIP_COUNT 记台数，
     EQUIP_NO 记**指定设备台号** —— 即「前面工序绑类型、实际排产绑台数」的落点 */
  S.EX_WO_STEP = (function () {
    /* 5 个工单 × 9 道工序 = 45 行。每道工序 200 件，节拍按 50 件/h 折算（4h/工序）。
     * 设备分配：粗/精加工并行到 CNC-001~005；焊接并行到 RBT-008/009/011/012；装配与拧紧流水并行；检测走 QMS。
     * [工序号, 工序名, 设备类型, 台号, 标准工时(h/件), 是否检验点] */
    var STEPS = [
      ['S10', '数控粗加工', '加工中心', 'CNC-001', 0.0200, 0],
      ['S20', '数控精加工', '加工中心', 'CNC-002', 0.0200, 0],
      ['S30', '机器人焊接', '焊接机器人', 'RBT-008', 0.0200, 0],
      ['S40', '总成装配', '装配输送线', 'ASM-013', 0.0200, 0],
      ['S50', '自动拧紧', '拧紧机器人', 'ASM-014', 0.0200, 0],
      ['S60', '三坐标检测', '三坐标测量机', 'QMS-019', 0.0200, 1],
      ['S70', '在线视觉检测', '视觉检测站', 'QMS-021', 0.0200, 1],
      ['S75', '表面处理(外协)', '外协', '', 0, 1],
      ['S80', '入库上架', '仓储货架', 'WH-025', 0.0000, 0]
    ];
    /* 5 工单并行：每单各工序换一组台号，避免同机冲突 */
    var EQSET = [
      { S10: 'CNC-001', S20: 'CNC-001', S30: 'RBT-008', S40: 'ASM-013', S50: 'ASM-014', S60: 'QMS-019', S70: 'QMS-021', S80: 'WH-025' },
      { S10: 'CNC-002', S20: 'CNC-002', S30: 'RBT-009', S40: 'ASM-013', S50: 'ASM-014', S60: 'QMS-019', S70: 'QMS-021', S80: 'WH-025' },
      { S10: 'CNC-003', S20: 'CNC-003', S30: 'RBT-011', S40: 'ASM-016', S50: 'ASM-015', S60: 'QMS-020', S70: 'QMS-022', S80: 'WH-025' },
      { S10: 'CNC-004', S20: 'CNC-004', S30: 'RBT-012', S40: 'ASM-016', S50: 'ASM-015', S60: 'QMS-020', S70: 'QMS-022', S80: 'WH-026' },
      { S10: 'CNC-005', S20: 'CNC-005', S30: 'RBT-008', S40: 'ASM-013', S50: 'ASM-017', S60: 'QMS-019', S70: 'QMS-021', S80: 'WH-026' }
    ];
    var OPER = { S10: 'E001', S20: 'E001', S30: 'E003', S40: 'E011', S50: 'E012', S60: 'E005', S70: 'E005', S75: 'S003', S80: 'E010' };
    var LEAD = { S10: 'E008', S20: 'E008', S30: 'E004', S40: 'E011', S50: 'E011', S60: 'E005', S70: 'E005', S75: 'E007', S80: 'E010' };
    var rows = [], seq = 0;
    for (var w = 0; w < 5; w++) {
      var wo = 'WO-2026-000' + (w + 1);
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][w];
      var start0 = '08:00:00';
      STEPS.forEach(function (s, k) {
        seq++;
        var no = s[0], isQC = s[5];
        var eq = EQSET[w][no] || '';
        var hrs = +(200 * s[4]).toFixed(2);           // 工序总净工时
        var st = new Date(day + 'T' + start0);
        st.setMinutes(st.getMinutes() + Math.round(hrs * 60));
        var et = new Date(st.getTime()); et.setMinutes(et.getMinutes() + Math.round(hrs * 60));
        var pad = function (d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':00'; };
        rows.push(base({
          WO_NO: wo, STEP_NO: no, STEP_NAME: s[1], EQUIP_SPEC: s[2], EQUIP_COUNT: 1, EQUIP_NO: eq,
          PROC_MODE: s[2] === '外协' ? '外协' : '自动', PLAN_QTY: 200, REPORT_QTY: 200, GOOD_QTY: 200, NG_QTY: 0,
          SCRAP_QTY: 0, REWORK_QTY: 0, STD_HOUR: s[4], ACT_HOUR: s[4], OPERATOR: OPER[no], LEADER: LEAD[no],
          SHIFT: '白班', PLAN_START: day + ' ' + pad(st), PLAN_END: day + ' ' + pad(et),
          ACT_START: day + ' ' + pad(st), ACT_END: day + ' ' + pad(et),
          STEP_STATUS: '已完成', IS_QC_POINT: isQC, OUTSOURCE_FLAG: s[2] === '外协' ? 1 : 0,
          PREV_STEP_NO: k > 0 ? STEPS[k - 1][0] : '', NEXT_STEP_NO: k < STEPS.length - 1 ? STEPS[k + 1][0] : ''
        }));
      });
    }
    return rows;
  })();
  /* 工序报工：EQUIP_NO 记**具体台号**（实际排产/执行绑台数） */
  /* 工序报工：EQUIP_NO 记**具体台号**（实际排产/执行绑台数）。
     口径：设备节拍 50 件/h → 单工单 200 件 = 4h = 2 个班次，每班次报工一次 100 件。
     5 个工单 × 2 班次 = 10 条报工，报工数据源为「设备采集」，报工挂在工作上。
     班次：白班 08:00-12:00（100件）/ 中班 12:00-16:00（100件）；工单间并行，日期 09-06 ~ 09-08。 */
  S.EX_REPORT = (function () {
    var rows = [], seq = 0;
    var EQ = ['CNC-001', 'CNC-002', 'CNC-003', 'CNC-004', 'CNC-005'];
    var DAYS = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'];
    var LOT = ['LOT-SO001-A', 'LOT-SO001-B', 'LOT-SO001-C', 'LOT-SO001-D', 'LOT-SO001-E'];
    for (var w = 0; w < 5; w++) {
      var wo = 'WO-2026-000' + (w + 1);
      [
        { shift: '白班', from: '08:00:00', to: '12:00:00', op: 'E001', ld: 'E008' },
        { shift: '中班', from: '12:00:00', to: '16:00:00', op: 'E002', ld: 'E013' }
      ].forEach(function (s) {
        seq++;
        rows.push(base({
          REPORT_NO: 'RP-2026-' + String(seq).padStart(4, '0'),
          WO_NO: wo, STEP_NO: 'S10', STEP_NAME: '数控粗加工',
          REPORT_DATE: DAYS[w], SHIFT: s.shift, OPERATOR: s.op, LEADER: s.ld, EQUIP_NO: EQ[w],
          REPORT_QTY: 100, GOOD_QTY: 100, NG_QTY: 0, SCRAP_QTY: 0, REWORK_QTY: 0,
          LOT_NO: LOT[w],
          START_TIME: DAYS[w] + ' ' + s.from, END_TIME: DAYS[w] + ' ' + s.to,
          STD_HOUR: 0.02, ACT_HOUR: 0.02, DOWN_MIN: 0, PROC_MODE: '自动',
          QC_STATUS: '合格', NEXT_STEP_NO: 'S20', DATA_SOURCE: '设备采集', STATUS: '已审核'
        }));
      });
    }
    return rows;
  })();
  /* 加工采集数据：不同设备类型的采集重点不同（加工中心看转速/进给；焊接看电流/电压；拧紧看扭矩/角度），
     设备专有参数落在 CUT_PARAM / RAW_DATA，通用列保持不变。 */
  /* 加工采集数据：设备按 50 件/h 采集，单班次（4h）产出 100 件 → PROCESS_QTY=100。
     不同设备类型的采集重点不同（加工中心看转速/进给；焊接看电流/电压；拧紧看扭矩/角度）。
     每个工单取 2 次采集（白班/中班），合计 10 条。 */
  S.EX_MACHINE_DATA = (function () {
    var rows = [], seq = 0;
    var EQ = ['CNC-001', 'CNC-002', 'CNC-003', 'CNC-004', 'CNC-005'];
    var DAYS = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'];
    [1, 2, 3, 4, 5].forEach(function (n) {
      ['10:05:00', '14:05:00'].forEach(function (tm) {
        seq++;
        var d = DAYS[n - 1].replace(/-/g, '');
        rows.push(base({
          COLLECT_NO: 'MC-' + d + '-' + String(seq).padStart(3, '0'),
          WO_NO: 'WO-2026-000' + n, STEP_NO: 'S10', EQUIP_NO: EQ[n - 1],
          COLLECT_TIME: DAYS[n - 1] + ' ' + tm, RUN_STATUS: '运行', PROCESS_QTY: 100,
          SPINDLE_SPEED: 8000, FEED_RATE: 1200, CUT_PARAM: 'ap=1.5 f=1200 n=8000',
          PROGRAM_NO: 'O3101', TOOL_NO: 'T03', TOOL_LIFE: '78%', ENERGY_KWH: 9.3,
          RAW_DATA: '{"spindle":8000,"feed":1200,"qty":100}'
        }));
      });
    });
    /* 追加一条异常采集：CNC-003 于 09-18 主轴异响报警（与 FR-2026-0001 咬合） */
    rows.push(base({ COLLECT_NO: 'MC-20260918-011', WO_NO: 'WO-2026-0003', STEP_NO: 'S10', EQUIP_NO: 'CNC-003',
      COLLECT_TIME: '2026-09-18 07:20:00', RUN_STATUS: '报警', PROCESS_QTY: 0, SPINDLE_SPEED: 0,
      ALARM_CODE: 'AL-2003', ALARM_MSG: '主轴异响，振动超限停机', ENERGY_KWH: 1.2,
      RAW_DATA: '{"alarm":"AL-2003","vib":"8.2mm/s"}' }));
    return rows;
  })();
  /* 工时记录：5 工单 × 2 班次 = 10 条，每班次 4h（240min），产出 100 件。 */
  S.EX_LABOR_RECORD = (function () {
    var rows = [], seq = 0;
    var EQ = ['CNC-001', 'CNC-002', 'CNC-003', 'CNC-004', 'CNC-005'];
    var DAYS = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'];
    [1, 2, 3, 4, 5].forEach(function (n) {
      [
        { shift: '白班', op: 'E001', from: '08:00:00', to: '12:00:00' },
        { shift: '中班', op: 'E002', from: '12:00:00', to: '16:00:00' }
      ].forEach(function (s) {
        rows.push(base({
          WO_NO: 'WO-2026-000' + n, STEP_NO: 'S10', EMP_NO: s.op, SHIFT: s.shift,
          START_TIME: DAYS[n - 1] + ' ' + s.from, END_TIME: DAYS[n - 1] + ' ' + s.to,
          DURATION_MIN: 240, MACHINE_NO: EQ[n - 1], QTY: 100, TYPE: '加工', WORK_DATE: DAYS[n - 1]
        }));
      });
    });
    return rows;
  })();
  S.QC_INSPECTION = (function () {
    var list = [
      doc({ QC_NO: 'QC-2026-001', DOC_NO: 'QC-2026-001', DOC_TYPE: '5601', DOC_DATE: '2026-09-03', FORM_NO: 'Q/SF2006-01', QC_TYPE: 'IQC', QC_STANDARD: 'GB/T 1591 低合金高强度结构钢', ITEM_NO: 'M-Q345B', ITEM_NAME: 'Q345B结构钢板', SPEC: '6.0×1250×2500', QTY: 19000, UNIT: 'kg', BATCH_QTY: 19000, SAMPLE_QTY: 20, PASS_QTY: 19000, FAIL_QTY: 0, DEFECT_DESC: '化学成分/屈服强度/冲击功全部合格', QC_RESULT: '合格', GAUGE_NO: 'G-HD-01', INSPECTOR: 'E005', INSPECT_DATE: '2026-09-03', STATUS: '已放行' }),
      doc({ QC_NO: 'QC-2026-002', DOC_NO: 'QC-2026-002', DOC_TYPE: '5601', DOC_DATE: '2026-09-05', FORM_NO: 'Q/SF2006-02', QC_TYPE: 'IQC', QC_STANDARD: 'GB/T 13914 冲压件尺寸与形位公差', ITEM_NO: 'M-SF-BLANK', ITEM_NAME: '冲压件毛坯', SPEC: 'MB-2403 冲压件', QTY: 900, UNIT: '件', BATCH_QTY: 900, SAMPLE_QTY: 45, PASS_QTY: 884, FAIL_QTY: 16, DEFECT_DESC: '16件落料边轻微拉毛，经MRB评审让步接收（非关键面）', QC_RESULT: '让步接收', GAUGE_NO: 'G-CL-01', INSPECTOR: 'E005', INSPECT_DATE: '2026-09-05', STATUS: '已放行' })
    ];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var wo = 'WO-2026-000' + n;
      var day = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'][n - 1];
      list.push(doc({
        QC_NO: 'QC-2026-' + String(5 + n).padStart(3, '0'), DOC_NO: 'QC-2026-' + String(5 + n).padStart(3, '0'),
        DOC_TYPE: '5601', DOC_DATE: day, FORM_NO: 'Q/SF2006-05', QC_TYPE: 'FQC',
        QC_STANDARD: '副车架总成检验规范 SF-3101-C', WO_NO: wo,
        CUSTOMER_NAME: '常州蓝驰新能源汽车有限公司', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成',
        SPEC: 'Q345B 焊接总成', PART_NO: 'LD-31001', INTERNAL_DRAWING_NO: 'JN-SF-3101',
        QTY: 200, UNIT: '件', BATCH_QTY: 200, SAMPLE_QTY: 20, PASS_QTY: 200, FAIL_QTY: 0,
        DEFECT_DESC: '三坐标尺寸/焊缝/涂层全项合格', QC_RESULT: '合格',
        GAUGE_NO: 'G-CMM-01', INSPECTOR: 'E005', INSPECT_DATE: day, STATUS: '已放行'
      }));
    });
    return list;
  })();
  /* 返工单：WO-2026-0003 焊接工序 8 件气孔超标转返工（改为与 200 件口径一致的批次）。 */
  S.QC_REWORK_ORDER = [
    doc({ REWORK_NO: 'RW-2026-0001', DOC_NO: 'RW-2026-0001', DOC_TYPE: '5402', DOC_DATE: '2026-09-07', ORIGIN_WO_NO: 'WO-2026-0003', REWORK_TYPE: '返工', RUSH_FLAG: 1, OPEN_DATE: '2026-09-07', STATUS_CODE: '已完成', PRODUCT_NO: 'P-SF-001', PRODUCT_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', SET_QTY: 8, PRODUCED_QTY: 8, SCRAP_QTY: 0, DESTROY_QTY: 0, REWORK_STEP: '30', REWORK_REASON: '焊缝气孔超限，打磨后重新补焊', NG_REASON_CODE: 'NG-07', QC_NO: 'QC-2026-008', REWORK_PASS_QTY: 8, STATUS: '已完成' })
  ];
  /* 报废单：粗加工工序装夹压伤 2 件报废（挂 WO-2026-0005 批次）。 */
  S.QC_SCRAP_ORDER = [
    doc({ SCRAP_NO: 'SC-1805-2026001', DOC_NO: 'SC-1805-2026001', DOC_NAME: '报废单', DOC_TYPE: '1805', DOC_DATE: '2026-09-08', SEQ_NO: 1, ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', SPEC: 'Q345B 焊接总成', SCRAP_QTY: 2, TOTAL_SCRAP_QTY: 2, SCRAP_TYPE: '半成品报废', SCRAP_REASON: '装夹压伤导致安装面变形，无法修复', NG_REASON_CODE: 'NG-05', WO_NO: 'WO-2026-0005', STEP_NO: 'S10', RESP_DEPT: '焊装课', RESP_EMP: 'E001', STATUS: '已审核' })
  ];
  /* 在制看板：5 个工单均已完工入库（各 200 件），在制归零。 */
  S.EX_WIP_BOARD = (function () {
    var DAYS = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'];
    return [1, 2, 3, 4, 5].map(function (n) {
      return base({
        SNAPSHOT_TIME: DAYS[n - 1] + ' 18:00:00', WO_NO: 'WO-2026-000' + n,
        PRODUCT_NO: 'P-SF-001', ITEM_NAME: '前副车架总成',
        CURRENT_STEP_NO: 'S80', CURRENT_STEP_NAME: '入库上架',
        GOOD_QTY: 200, WAIT_QC_QTY: 0, WIP_QTY: 0, PLAN_QTY: 200, DONE_RATE: 1,
        EST_FINISH_TIME: null, WIP_STATUS: '已完工', STAGNANT_DAYS: 0, AREA_CODE: '智能仓储区'
      });
    });
  })();
  S.EX_SHIFT_HANDOVER = [
    doc({ HANDOVER_NO: 'HO-20260918', DOC_NO: 'HO-20260918', DOC_TYPE: '5301', DOC_DATE: '2026-09-18', WORK_DATE: '2026-09-18', TEAM_CODE: 'T1', SHIFT: '白班', FROM_EMP: 'E008', TO_EMP: 'E013', ABSENT_EMP: '', HANDOVER_CONTENT: 'CNC-001/002 已完成粗精加工转序；RBT-008 焊接导电嘴寿命82%，夜班关注更换；QMS-019 三坐标待检件200件', STATUS: '已确认' }),
    doc({ HANDOVER_NO: 'HO-20260919', DOC_NO: 'HO-20260919', DOC_TYPE: '5301', DOC_DATE: '2026-09-19', WORK_DATE: '2026-09-19', TEAM_CODE: 'T3', SHIFT: '白班', FROM_EMP: 'E004', TO_EMP: 'E008', ABSENT_EMP: 'E002(调休)', HANDOVER_CONTENT: 'CNC-003 07:20 报警停机已报修（FR-2026-0001），维修中；WO-2026-0002 粗加工已完成，精加工按计划推进', STATUS: '已确认' })
  ];
  S.EX_SHIFT_STATION_CHECK = [
    base({ HANDOVER_NO: 'HO-20260918', MACHINE_NO: 'RBT-008', RUN_STATUS: '正常', REPAIR_NO: '', REMARK: '焊接参数正常，保护气流量18L/min' }),
    base({ HANDOVER_NO: 'HO-20260918', MACHINE_NO: 'CNC-001', RUN_STATUS: '正常', REPAIR_NO: '', REMARK: '刀具寿命78%，切削液浓度4.2%' }),
    base({ HANDOVER_NO: 'HO-20260919', MACHINE_NO: 'CNC-003', RUN_STATUS: '故障', REPAIR_NO: 'FR-2026-0001', REMARK: '主轴异响报警停机，待维修' })
  ];
  /* 班组日产出：5 工单 × 2 班次，每班次 100 件，合计 1000 件。 */
  S.EX_DAILY_OUTPUT = (function () {
    var rows = [], seq = 0;
    var DAYS = ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-07', '2026-09-08'];
    var EQ = ['CNC-001', 'CNC-002', 'CNC-003', 'CNC-004', 'CNC-005'];
    [1, 2, 3, 4, 5].forEach(function (n) {
      [
        { shift: '白班', op: 'E001', ld: 'E008' },
        { shift: '中班', op: 'E002', ld: 'E013' }
      ].forEach(function (s, k) {
        seq++;
        rows.push(base({
          DAILY_NO: 'DO-' + DAYS[n - 1].replace(/-/g, '') + '-' + seq,
          LINE_CODE: 'L1', MACHINE_TYPE: '副车架', DEPT_CLASS: '焊装课', WORK_DATE: DAYS[n - 1],
          SEQ_NO: seq, STEP_NAME: '数控粗加工', EQUIP_SPEC: '加工中心', EQUIP_COUNT: 1,
          SHIFT: s.shift, OPERATOR: s.op, LEADER: s.ld,
          PLAN_QTY: 100, ACT_QTY: 100, DIFF_QTY: 0, NG_QTY: 0, TOTAL_QTY: 100,
          PROC_MODE: '自动', EQUIP_ABNORMAL: '无', REMARK: '工单 WO-2026-000' + n + ' ' + s.shift + '（设备 ' + EQ[n - 1] + '）'
        }));
      });
    });
    return rows;
  })();
  /* ==================== 看板分析（订单一览） ==================== */
  S.PP_ORDER_BOARD = [
    base({ DOC_DATE: '2026-09-15 08:00:00', BOARD_MARK: '订单+预测', CATEGORY: '成品', ITEM_NO: 'P-SF-001', ITEM_NAME: '前副车架总成', ORDER_QTY: 1000, DELIVERED_QTY: 1000, LENT_QTY: 0, MONTH_IN_QTY: 1000, MONTH_OUT_QTY: 1000, WIP_QTY: 0, STOCK_QTY: 0, FORECAST_QTY: 2000, SHORT_QTY: 0, REMARK: 'SO-2026-001 已全部交付' }),
    base({ DOC_DATE: '2026-09-19 08:00:00', BOARD_MARK: '订单+预测', CATEGORY: '成品', ITEM_NO: 'P-SF-002', ITEM_NAME: '后副车架总成', ORDER_QTY: 3000, DELIVERED_QTY: 0, LENT_QTY: 0, MONTH_IN_QTY: 0, MONTH_OUT_QTY: 0, WIP_QTY: 1500, STOCK_QTY: 500, FORECAST_QTY: 5000, SHORT_QTY: 1500 }),
    base({ DOC_DATE: '2026-09-19 08:00:00', BOARD_MARK: '订单+预测', CATEGORY: '成品', ITEM_NO: 'P-MB-003', ITEM_NAME: '电驱动悬置支架', ORDER_QTY: 800, DELIVERED_QTY: 0, LENT_QTY: 0, MONTH_IN_QTY: 790, MONTH_OUT_QTY: 0, WIP_QTY: 0, STOCK_QTY: 790, FORECAST_QTY: 2000, SHORT_QTY: 10 })
  ];

  /* ==================== 设备管理 ==================== */
  /* 设备台账：与 MD_EQUIPMENT 33 台 1:1（货架也建台账，因为它是可点检/可保养的实体资产） */
  S.EQ_EQUIPMENT_LEDGER = EQS.map(function (e, i) {
    var isShelf = e[2] === '仓储货架';
    var isLogi = e[2] === 'AGV' || e[2] === '充电泊位' || e[2] === '叉车';
    return base({
      EQUIP_NO: e[0], ASSET_NO: 'ZC-2023-' + String(101 + i), LOCATION: e[6] + ' ' + e[0],
      LINE_CODE: e[6], START_USE_DATE: '2023-07-01', WARRANTY_END: '2026-07-01',
      SPARE_PARTS: isShelf ? '{"层板":2,"横梁":4}' : (isLogi ? '{"驱动轮":2,"蓄电池":1}' : '{"滤芯":2,"皮带":1}'),
      PM_CYCLE: isShelf ? 180 : 30, CHECK_CYCLE: isShelf ? '月' : '日',
      EQUIP_STATUS: e[8], TOTAL_RUN_HOUR: 4200 + i * 137, AUDIT_STATUS: '已审核'
    });
  });
  S.EQ_INSPECTION = [
    doc({ INSPECT_NO: 'INSP-20260919-01', DOC_NO: 'INSP-20260919-01', DOC_TYPE: '6101', DOC_DATE: '2026-09-19', EQUIP_NO: 'CNC-001', EQUIP_NAME: 'CNC-001 立式数控加工中心', USE_DEPT: '机加课', INSPECT_DATE: '2026-09-19', CYCLE_TYPE: '日', SHIFT: '白班', CHECK_ITEM: '润滑油位/气压/刀库/夹具', JUDGE_RESULT: '正常', INSPECT_BY: 'E001', CONFIRM_BY: 'E008', ALLOW_START: 1, STATUS: '已点检' }),
    doc({ INSPECT_NO: 'INSP-20260919-02', DOC_NO: 'INSP-20260919-02', DOC_TYPE: '6101', DOC_DATE: '2026-09-19', EQUIP_NO: 'RBT-008', EQUIP_NAME: 'RBT-008 六轴焊接机器人', USE_DEPT: '焊装课', INSPECT_DATE: '2026-09-19', CYCLE_TYPE: '日', SHIFT: '白班', CHECK_ITEM: '焊接参数/保护气流量/焊枪/清枪器', JUDGE_RESULT: '正常', INSPECT_BY: 'E003', CONFIRM_BY: 'E004', ALLOW_START: 1, STATUS: '已点检' }),
    doc({ INSPECT_NO: 'INSP-20260919-03', DOC_NO: 'INSP-20260919-03', DOC_TYPE: '6101', DOC_DATE: '2026-09-19', EQUIP_NO: 'CNC-003', EQUIP_NAME: 'CNC-003 立式数控加工中心', USE_DEPT: '机加课', INSPECT_DATE: '2026-09-19', CYCLE_TYPE: '日', SHIFT: '白班', CHECK_ITEM: '主轴振动/油温/异响', JUDGE_RESULT: '异常', INSPECT_BY: 'E002', CONFIRM_BY: 'E006', ALLOW_START: 0, STATUS: '已点检', REMARK: '主轴异响，待维修确认后方可开机' })
  ];
  S.EQ_INSPECTION_ITEM = [
    base({ TEMPLATE_CODE: 'TP-CNC', EQUIP_TYPE: '加工中心', CHECK_ITEM: '润滑油位', METHOD: '目视', STANDARD: '油位在视窗1/2-2/3', IS_KEY_ITEM: 1, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-CNC', EQUIP_TYPE: '加工中心', CHECK_ITEM: '主轴振动', METHOD: '振动仪', STANDARD: '<4.5mm/s', IS_KEY_ITEM: 1, SEQ_NO: 2 }),
    base({ TEMPLATE_CODE: 'TP-RBT', EQUIP_TYPE: '焊接机器人', CHECK_ITEM: '保护气流量', METHOD: '流量计', STANDARD: '15-20L/min', IS_KEY_ITEM: 1, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-RBT', EQUIP_TYPE: '焊接机器人', CHECK_ITEM: '焊枪/导电嘴', METHOD: '目视', STANDARD: '无飞溅堵塞、孔径正常', IS_KEY_ITEM: 1, SEQ_NO: 2 }),
    base({ TEMPLATE_CODE: 'TP-ASM', EQUIP_TYPE: '装配输送线', CHECK_ITEM: '滚筒/链条润滑', METHOD: '目视', STANDARD: '无卡滞、无异常噪音', IS_KEY_ITEM: 0, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-TORK', EQUIP_TYPE: '拧紧机器人', CHECK_ITEM: '扭矩标定', METHOD: '扭矩校验仪', STANDARD: '偏差≤±3%', IS_KEY_ITEM: 1, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-CMM', EQUIP_TYPE: '三坐标测量机', CHECK_ITEM: '环境温度/测针', METHOD: '温湿度计/目视', STANDARD: '20±2℃；测针无磨损', IS_KEY_ITEM: 1, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-SHF', EQUIP_TYPE: '仓储货架', CHECK_ITEM: '立柱/横梁变形', METHOD: '目视/水平尺', STANDARD: '无变形、无裂纹、销钉到位', IS_KEY_ITEM: 1, SEQ_NO: 1 }),
    base({ TEMPLATE_CODE: 'TP-AGV', EQUIP_TYPE: 'AGV', CHECK_ITEM: '电量/导航识别', METHOD: '系统自检', STANDARD: '电量≥30%、导航无丢标', IS_KEY_ITEM: 1, SEQ_NO: 1 })
  ];
  /* 保养计划：PLAN_DATE 为「天」粒度（沿用原口径），另给 PLAN_START/PLAN_END/EST_DOWN_MIN/AFFECT_CAPACITY
   * 让 APS 能把保养窗口当不可用产能扣除（AFFECT_CAPACITY=1 表示要占排产资源）。 */
  S.EQ_MAINTENANCE_PLAN = [
    doc({ PM_NO: 'PM-2026-0001', DOC_NO: 'PM-2026-0001', DOC_TYPE: '6201', DOC_DATE: '2026-09-22', EQUIP_NO: 'RBT-008', EQUIP_NAME: 'RBT-008 六轴焊接机器人', USE_DEPT: '焊装课', PM_LEVEL: '二级保养', PLAN_DATE: '2026-09-22', PLAN_START: '2026-09-22 08:30:00', PLAN_END: '2026-09-22 16:30:00', EST_DOWN_MIN: 480, AFFECT_CAPACITY: 1, PM_ITEM: '焊接机器人二级保养', PM_CONTENT: '各轴减速机油更换、焊缝跟踪标定、焊枪清理与送丝机构检查', ONTIME_FLAG: 1, EXEC_BY: 'E006', SUPERVISE_BY: 'E004', STATUS: '待执行' }),
    doc({ PM_NO: 'PM-2026-0002', DOC_NO: 'PM-2026-0002', DOC_TYPE: '6201', DOC_DATE: '2026-09-10', EQUIP_NO: 'CNC-001', EQUIP_NAME: 'CNC-001 立式数控加工中心', USE_DEPT: '机加课', PM_LEVEL: '一级保养', PLAN_DATE: '2026-09-10', PLAN_START: '2026-09-10 17:00:00', PLAN_END: '2026-09-10 20:00:00', EST_DOWN_MIN: 180, AFFECT_CAPACITY: 1, ACT_DATE: '2026-09-10', PM_ITEM: '加工中心一级保养', PM_CONTENT: '导轨润滑、排屑器清理、切削液更换、防护罩检查', ONTIME_FLAG: 1, EXEC_BY: 'E006', SUPERVISE_BY: 'E008', STATUS: '已完成' }),
    doc({ PM_NO: 'PM-2026-0003', DOC_NO: 'PM-2026-0003', DOC_TYPE: '6201', DOC_DATE: '2026-09-19', EQUIP_NO: 'QMS-019', EQUIP_NAME: 'QMS-019 三坐标精密测量机', USE_DEPT: '质保部', PM_LEVEL: '二级保养', PLAN_DATE: '2026-09-19', PLAN_START: '2026-09-19 13:00:00', PLAN_END: '2026-09-19 17:00:00', EST_DOWN_MIN: 240, AFFECT_CAPACITY: 1, PM_ITEM: '三坐标年度精度校准与保养', PM_CONTENT: '测头/测针标定、气浮导轨清洁、环境温湿度记录核查、精度复检', ONTIME_FLAG: 1, EXEC_BY: 'E005', SUPERVISE_BY: 'E006', STATUS: '待执行', REMARK: '校准期间 QMS-019 不可用，S60 三坐标检测改走 QMS-020' }),
    doc({ PM_NO: 'PM-2026-0004', DOC_NO: 'PM-2026-0004', DOC_TYPE: '6201', DOC_DATE: '2026-09-20', EQUIP_NO: 'WH-023', EQUIP_NAME: 'WH-023 三层重型仓储货架(原料架)', USE_DEPT: '计划物流课', PM_LEVEL: '一级保养', PLAN_DATE: '2026-09-20', PLAN_START: '2026-09-20 09:00:00', PLAN_END: '2026-09-20 11:00:00', EST_DOWN_MIN: 120, AFFECT_CAPACITY: 0, PM_ITEM: '货架结构与层板检查', PM_CONTENT: '立柱/横梁变形与裂纹目视检查、安全销复位、层板紧固', ONTIME_FLAG: 1, EXEC_BY: 'E006', SUPERVISE_BY: 'E010', STATUS: '待执行', REMARK: '货架保养不占排产产能' })
  ];
  S.EQ_MAINTENANCE_RECORD = [
    base({ PM_NO: 'PM-2026-0002', EQUIP_NO: 'CNC-001', EQUIP_NAME: 'CNC-001 立式数控加工中心', USE_DEPT: '机加课', PM_LEVEL: '一级保养', PLAN_DATE: '2026-09-10', ACT_DATE: '2026-09-10', PM_ITEM: '加工中心一级保养', PM_CONTENT: '导轨润滑1.2L、排屑器清理、切削液更换60L、防护罩检查完成，空载试机正常', ONTIME_FLAG: 1, EXEC_BY: 'E006', SUPERVISE_BY: 'E008', STATUS: '已完成', AUDIT_STATUS: '已审核' })
  ];
  S.EQ_PATROL = [
    doc({ PATROL_NO: 'PT-20260918-01', DOC_NO: 'PT-20260918-01', DOC_TYPE: '6301', DOC_DATE: '2026-09-18', PATROL_ROUTE: '数控加工区夜巡线', PATROL_DATE: '2026-09-18', SHIFT: '晚班', PATROL_BY: 'E006', EQUIP_NO: 'CNC-003', POINT_CODE: 'P-02', RESULT: '异常', ABNORMAL_DESC: '主轴部位间歇异响，振动手感明显，运行10分钟未消除', TO_REPAIR_FLAG: 1, STATUS: '已处理', REMARK: '已生成故障报修 FR-2026-0001' }),
    doc({ PATROL_NO: 'PT-20260918-02', DOC_NO: 'PT-20260918-02', DOC_TYPE: '6301', DOC_DATE: '2026-09-18', PATROL_ROUTE: '焊接区夜巡线', PATROL_DATE: '2026-09-18', SHIFT: '晚班', PATROL_BY: 'E006', EQUIP_NO: 'RBT-008', POINT_CODE: 'P-01', RESULT: '正常', TO_REPAIR_FLAG: 0, STATUS: '已完成', REMARK: '' })
  ];
  S.EQ_FAULT_REPAIR = [
    doc({ FORM_NO: 'Q/SF2010-01', MANAGE_NO: 'FR-2026-0001', DOC_NO: 'FR-2026-0001', DOC_TYPE: '6401', DOC_DATE: '2026-09-18', EQUIP_NO: 'CNC-003', EQUIP_NAME: 'CNC-003 立式数控加工中心', DEPT_CLASS: '机加课', FAULT_TIME: '2026-09-18 07:20:00', FAULT_DESC: '主轴异响并触发AL-2003振动超限报警，自动停机，无法继续加工', FAULT_TYPE: '机械故障', DOWN_MIN: 240, REPORT_BY: 'E002', REPORT_TIME: '2026-09-18 07:25:00', REPAIR_BY: 'E006', REPAIR_START: '2026-09-18 08:00:00', REPAIR_END: '2026-09-18 12:00:00', SPARE_USED: '{"主轴润滑脂":1,"预紧轴承垫片":1}', REPAIR_COST: 650, DISPOSE_RESULT: '主轴预紧力调整+润滑脂更换，空载试机1小时振动值2.8mm/s，恢复正常', VERIFY_BY: 'E005', AFFECT_DELIVERY: 1, STATUS: '已完成', REMARK: '当日欠产1200件，影响WO-2026-0002粗加工工序，周末加班补回' })
  ];
  /* 状态监测：33 台全覆盖（实时派生的原型快照，与设备主数据同源） */
  S.EQ_STATUS_MONITOR = EQS.map(function (e, i) {
    var isShelf = e[2] === '仓储货架';
    var warn = '';
    if (e[0] === 'CNC-006') warn = '无任务待机，可用于插单';
    else if (e[0] === 'RBT-012') warn = '待料停机';
    else if (e[0] === 'CNC-003') warn = '9-18主轴故障已修复，待验证后恢复';
    return base({
      EQUIP_NO: e[0], COLLECT_TIME: '2026-09-19 08:05:00', STATUS: e[8],
      DURATION_MIN: e[8] === '运行' ? 200 + i * 6 : 1165, TO_RCCP: e[8] === '运行' ? 1 : 0, WARN_MSG: warn
    });
  });
  /* ==================== 设备运行状态（新增表） ====================
   * 按「状态段」落地设备可用性：每台设备给出当天最近一段状态（运行/待机/故障/保养/停机），
   * 再把 CNC-003 的「故障→保养修复→恢复运行」讲成三段，成为 APS 扣除不可用产能的现成依据。 */
  S.EQ_RUNTIME_STATUS = (function () {
    var rows = [], seq = 0;
    function push(eq, state, from, to, dur, wo, step, rate, src, memo) {
      seq++;
      var hit = EQS.filter(function (e) { return e[0] === eq; })[0] || [];
      rows.push(base({
        STATUS_ID: 'RS-' + String(seq).padStart(3, '0'), EQUIP_NO: eq, EQUIP_NAME: hit[1] || eq, RUN_STATE: state,
        STATE_FROM: from, STATE_TO: to || null, DUR_MIN: dur || null,
        CUR_WO_NO: wo || '', CUR_STEP_NO: step || '', CUR_ORDER_NO: wo ? 'SO-2026-001' : '',
        SPEED_RATE: rate, SOURCE: src, MEMO: memo || '', STATUS: to ? '已归档' : '进行中'
      }));
    }
    /* ① 故障故事：CNC-003 09-18 主轴异响停机 → 维修保养 → 恢复运行（与 FR-2026-0001 咬合） */
    push('CNC-003', '故障', '2026-09-18 07:20:00', '2026-09-18 12:00:00', 280, 'WO-2026-0002', 'S10', 0, '采集', '主轴异响触发AL-2003振动超限自动停机（FR-2026-0001）');
    push('CNC-003', '保养', '2026-09-18 12:00:00', '2026-09-18 13:00:00', 60, '', '', 0, '手工', '主轴预紧力调整+润滑脂更换，空载试机');
    /* ② 常态快照：其余 32 台按主数据状态各生成一段（货架/AGV 等物流设备速率记 0） */
    EQS.forEach(function (e) {
      if (e[0] === 'CNC-003') return;
      var run = e[8] === '运行';
      push(e[0], run ? '运行' : '待机', '2026-09-19 08:00:00', null, null,
        run ? 'WO-2026-0001' : '', run ? 'S30' : '', run ? 95 : 0, '采集', e[2] === '仓储货架' ? '货架在位可用' : '');
    });
    /* ③ 需要「占用产能」的特殊状态段：保养窗口 / 待机可插单 */
    push('QMS-019', '保养', '2026-09-19 13:00:00', '2026-09-19 17:00:00', 240, '', 'S60', 0, '手工', '年度精度校准（PM-2026-0003），期间不接新任务');
    push('RBT-012', '待机', '2026-09-19 07:30:00', null, null, '', '', 0, '采集', '待料停机，可承接插单');
    return rows;
  })();
  S.EQ_OEE = [
    base({ STAT_DATE: '2026-09-17', PERIOD: '日', EQUIP_NO: 'CNC-001', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 15, CHANGE_MIN: 45, WAIT_MATERIAL_MIN: 10, RUN_MIN: 380, AVAILABILITY: 0.8444, IDEAL_CT: 180, ACT_CT: 190, PERFORMANCE: 0.9474, TOTAL_QTY: 120, GOOD_QTY: 119, QUALITY_RATE: 0.9917, OEE_VALUE: 0.7935, OEE_TARGET: 0.75, EQUIP_GROUP: '数控加工区', AUDIT_STATUS: '已审核' }),
    base({ STAT_DATE: '2026-09-17', PERIOD: '日', EQUIP_NO: 'CNC-002', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 10, CHANGE_MIN: 40, WAIT_MATERIAL_MIN: 0, RUN_MIN: 400, AVAILABILITY: 0.8889, IDEAL_CT: 180, ACT_CT: 184.6, PERFORMANCE: 0.975, TOTAL_QTY: 130, GOOD_QTY: 128, QUALITY_RATE: 0.9885, OEE_VALUE: 0.8564, OEE_TARGET: 0.75, EQUIP_GROUP: '数控加工区', AUDIT_STATUS: '已审核' }),
    base({ STAT_DATE: '2026-09-17', PERIOD: '日', EQUIP_NO: 'RBT-008', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 20, CHANGE_MIN: 40, WAIT_MATERIAL_MIN: 0, RUN_MIN: 390, AVAILABILITY: 0.8667, IDEAL_CT: 95, ACT_CT: 100.2, PERFORMANCE: 0.9487, TOTAL_QTY: 231, GOOD_QTY: 229, QUALITY_RATE: 0.9892, OEE_VALUE: 0.8138, OEE_TARGET: 0.75, EQUIP_GROUP: '机器人焊接区', AUDIT_STATUS: '已审核' }),
    base({ STAT_DATE: '2026-09-17', PERIOD: '日', EQUIP_NO: 'ASM-014', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 30, CHANGE_MIN: 60, WAIT_MATERIAL_MIN: 0, RUN_MIN: 360, AVAILABILITY: 0.8, IDEAL_CT: 45, ACT_CT: 49.9, PERFORMANCE: 0.9028, TOTAL_QTY: 432, GOOD_QTY: 432, QUALITY_RATE: 1, OEE_VALUE: 0.7222, OEE_TARGET: 0.75, EQUIP_GROUP: '动力总成装配区', AUDIT_STATUS: '已审核' }),
    base({ STAT_DATE: '2026-09-18', PERIOD: '日', EQUIP_NO: 'RBT-008', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 10, CHANGE_MIN: 30, WAIT_MATERIAL_MIN: 0, RUN_MIN: 410, AVAILABILITY: 0.9111, IDEAL_CT: 95, ACT_CT: 99.9, PERFORMANCE: 0.9512, TOTAL_QTY: 246, GOOD_QTY: 246, QUALITY_RATE: 1, OEE_VALUE: 0.8667, OEE_TARGET: 0.75, EQUIP_GROUP: '机器人焊接区', AUDIT_STATUS: '已审核' }),
    base({ STAT_DATE: '2026-09-18', PERIOD: '日', EQUIP_NO: 'QMS-019', PLANNED_MIN: 480, PLANNED_DOWN_MIN: 30, UNPLANNED_DOWN_MIN: 240, CHANGE_MIN: 30, WAIT_MATERIAL_MIN: 60, RUN_MIN: 210, AVAILABILITY: 0.4667, IDEAL_CT: 240, ACT_CT: 252, PERFORMANCE: 0.9524, TOTAL_QTY: 50, GOOD_QTY: 50, QUALITY_RATE: 1, OEE_VALUE: 0.4445, OEE_TARGET: 0.75, EQUIP_GROUP: '精密检测区', AUDIT_STATUS: '已审核', REMARK: 'CNC-003 主轴故障导致来件中断，检测站长时间待料' })
  ];

  /* ==================== 系统 ==================== */
  S.SYS_DICT = [
    base({ DICT_CODE: 'DT-5101', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5101', ITEM_NAME: '成品工单', ITEM_VALUE: '5101', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-5401', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5401', ITEM_NAME: '领料单', ITEM_VALUE: '5401', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-2302', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '2302', ITEM_NAME: '销货单', ITEM_VALUE: '2302', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-311', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '311', ITEM_NAME: '国内报价单', ITEM_VALUE: '311', SORT_NO: 4, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-301', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '301', ITEM_NAME: '到货单', ITEM_VALUE: '301', SORT_NO: 5, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-1805', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '1805', ITEM_NAME: '半成品报废', ITEM_VALUE: '1805', SORT_NO: 6, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-2101', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '2101', ITEM_NAME: '国内销售订单', ITEM_VALUE: '2101', SORT_NO: 7, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-3201', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '3201', ITEM_NAME: '采购订单', ITEM_VALUE: '3201', SORT_NO: 8, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-5201', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5201', ITEM_NAME: '成品入库单', ITEM_VALUE: '5201', SORT_NO: 9, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-5301', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5301', ITEM_NAME: '班组交接记录', ITEM_VALUE: '5301', SORT_NO: 10, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-5501', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5501', ITEM_NAME: '盘点单', ITEM_VALUE: '5501', SORT_NO: 11, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-5601', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '5601', ITEM_NAME: '检验单', ITEM_VALUE: '5601', SORT_NO: 12, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-6101', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '6101', ITEM_NAME: '设备点检单', ITEM_VALUE: '6101', SORT_NO: 13, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-6201', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '6201', ITEM_NAME: '设备保养计划', ITEM_VALUE: '6201', SORT_NO: 14, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-6301', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '6301', ITEM_NAME: '设备巡检单', ITEM_VALUE: '6301', SORT_NO: 15, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'DT-6401', DICT_NAME: '单据类型', DICT_TYPE: 'DOC_TYPE', ITEM_CODE: '6401', ITEM_NAME: '设备报修单', ITEM_VALUE: '6401', SORT_NO: 16, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'SF-1', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '白班', ITEM_NAME: '白班', ITEM_VALUE: '白班', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'SF-2', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '中班', ITEM_NAME: '中班', ITEM_VALUE: '中班', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'SF-3', DICT_NAME: '班次', DICT_TYPE: 'SHIFT', ITEM_CODE: '晚班', ITEM_NAME: '晚班', ITEM_VALUE: '晚班', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'EC-1', DICT_NAME: '设备类别', DICT_TYPE: 'EQUIP_CLASS', ITEM_CODE: '关键设备', ITEM_NAME: '关键设备', ITEM_VALUE: '关键设备', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'EC-2', DICT_NAME: '设备类别', DICT_TYPE: 'EQUIP_CLASS', ITEM_CODE: '一般设备', ITEM_NAME: '一般设备', ITEM_VALUE: '一般设备', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-1', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '加工中心', ITEM_NAME: '加工中心', ITEM_VALUE: '加工中心', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-2', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '焊接机器人', ITEM_NAME: '焊接机器人', ITEM_VALUE: '焊接机器人', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-3', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '焊接工装', ITEM_NAME: '焊接工装', ITEM_VALUE: '焊接工装', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-4', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '装配输送线', ITEM_NAME: '装配输送线', ITEM_VALUE: '装配输送线', SORT_NO: 4, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-5', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '拧紧机器人', ITEM_NAME: '拧紧机器人', ITEM_VALUE: '拧紧机器人', SORT_NO: 5, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-6', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '三坐标测量机', ITEM_NAME: '三坐标测量机', ITEM_VALUE: '三坐标测量机', SORT_NO: 6, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-7', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '视觉检测站', ITEM_NAME: '视觉检测站', ITEM_VALUE: '视觉检测站', SORT_NO: 7, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-8', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '仓储货架', ITEM_NAME: '仓储货架', ITEM_VALUE: '仓储货架', SORT_NO: 8, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-9', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: 'AGV', ITEM_NAME: 'AGV', ITEM_VALUE: 'AGV', SORT_NO: 9, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-10', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '充电泊位', ITEM_NAME: '充电泊位', ITEM_VALUE: '充电泊位', SORT_NO: 10, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ET-11', DICT_NAME: '设备类型', DICT_TYPE: 'EQUIP_TYPE', ITEM_CODE: '叉车', ITEM_NAME: '叉车', ITEM_VALUE: '叉车', SORT_NO: 11, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-1', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: '数控加工区', ITEM_NAME: '数控加工区', ITEM_VALUE: '数控加工区', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-2', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: '机器人焊接区', ITEM_NAME: '机器人焊接区', ITEM_VALUE: '机器人焊接区', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-3', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: '动力总成装配区', ITEM_NAME: '动力总成装配区', ITEM_VALUE: '动力总成装配区', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-4', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: '精密检测区', ITEM_NAME: '精密检测区', ITEM_VALUE: '精密检测区', SORT_NO: 4, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-5', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: '智能仓储区', ITEM_NAME: '智能仓储区', ITEM_VALUE: '智能仓储区', SORT_NO: 5, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'AR-6', DICT_NAME: '车间区域', DICT_TYPE: 'AREA', ITEM_CODE: 'AGV物流区', ITEM_NAME: 'AGV物流区', ITEM_VALUE: 'AGV物流区', SORT_NO: 6, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ND-1', DICT_NAME: '不良处置', DICT_TYPE: 'NG_DISPOSE', ITEM_CODE: '返工', ITEM_NAME: '返工', ITEM_VALUE: '返工', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ND-2', DICT_NAME: '不良处置', DICT_TYPE: 'NG_DISPOSE', ITEM_CODE: '返修', ITEM_NAME: '返修', ITEM_VALUE: '返修', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'ND-3', DICT_NAME: '不良处置', DICT_TYPE: 'NG_DISPOSE', ITEM_CODE: '报废', ITEM_NAME: '报废', ITEM_VALUE: '报废', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-01', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-01', ITEM_NAME: '尺寸超差', ITEM_VALUE: 'NG-01', SORT_NO: 1, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-02', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-02', ITEM_NAME: '焊缝气孔', ITEM_VALUE: 'NG-02', SORT_NO: 2, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-03', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-03', ITEM_NAME: '未熔合/未焊透', ITEM_VALUE: 'NG-03', SORT_NO: 3, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-04', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-04', ITEM_NAME: '焊接变形超差', ITEM_VALUE: 'NG-04', SORT_NO: 4, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-05', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-05', ITEM_NAME: '磕碰划伤', ITEM_VALUE: 'NG-05', SORT_NO: 5, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-06', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-06', ITEM_NAME: '涂层缺陷', ITEM_VALUE: 'NG-06', SORT_NO: 6, ENABLE_FLAG: 1 }),
    base({ DICT_CODE: 'NG-07', DICT_NAME: '不良原因代码', DICT_TYPE: 'NG_REASON', ITEM_CODE: 'NG-07', ITEM_NAME: '焊缝外观不良', ITEM_VALUE: 'NG-07', SORT_NO: 7, ENABLE_FLAG: 1 })
  ];
  S.SYS_CODE_RULE = [
    base({ RULE_CODE: 'RU-WO', BIZ_TYPE: '工序工单', PREFIX: 'WO-', DATE_FMT: 'yyyy', FLOW_LEN: 4, CUR_NO: 4, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'RU-PO', BIZ_TYPE: '采购订单', PREFIX: 'PO-', DATE_FMT: 'yyyy', FLOW_LEN: 4, CUR_NO: 4, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'RU-QC', BIZ_TYPE: '检验单', PREFIX: 'QC-', DATE_FMT: 'yyyy', FLOW_LEN: 3, CUR_NO: 6, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'RU-SO', BIZ_TYPE: '销售订单', PREFIX: 'SO-', DATE_FMT: 'yyyy', FLOW_LEN: 3, CUR_NO: 3, ENABLE_FLAG: 1 }),
    base({ RULE_CODE: 'RU-RPT', BIZ_TYPE: '工序报工', PREFIX: 'RP-', DATE_FMT: 'yyyy', FLOW_LEN: 4, CUR_NO: 12, ENABLE_FLAG: 1 })
  ];
  S.SYS_AUDIT_LOG = [
    base({ LOG_ID: 'LOG-2026-0001', TABLE_NAME: 'WM_STOCKTAKING', RECORD_ID: 'ST-2026-0001', ACTION: '审核', FIELD_DIFF: 'STATUS: 待审核→已调整；DIFF_QTY: -2', OPERATOR: '孙倩', OP_TIME: '2026-09-14 15:10:00', REMARK: '循环盘点差异审核通过' }),
    base({ LOG_ID: 'LOG-2026-0002', TABLE_NAME: 'QC_SCRAP_ORDER', RECORD_ID: 'SC-1805-2026001', ACTION: '审核', FIELD_DIFF: 'STATUS: 待审核→已审核', OPERATOR: '周杰', OP_TIME: '2026-09-09 10:20:00', REMARK: '半成品报废2件审核' })
  ];
  S.SYS_ATTACHMENT = [
    base({ ATTACH_ID: 'ATT-0001', BIZ_TYPE: 'QC_INSPECTION', BIZ_ID: 'QC-2026-003', FILE_NAME: 'QC-2026-003焊缝检测报告.pdf', FILE_URL: '/files/qc/2026/QC-2026-003.pdf', FILE_SIZE: 512340, UPLOAD_BY: 'E005', UPLOAD_TIME: '2026-09-11 10:05:00' }),
    base({ ATTACH_ID: 'ATT-0002', BIZ_TYPE: 'RT_SOP', BIZ_ID: 'SOP-SF1-30', FILE_NAME: '机器人焊接作业指导书V2图示.pdf', FILE_URL: '/files/sop/2026/SOP-SF1-30.pdf', FILE_SIZE: 2048000, UPLOAD_BY: '吴工', UPLOAD_TIME: '2026-06-01 09:00:00' })
  ];
  /* 单据上下游关联台账：把本剧本「全部」流转链声明为一张表，再程序化生成记录。 */
  /* 单据流转链：销售订单 → 生产计划 → 请购 → 采购 → 到货 → IQC → 采购入库 → 工单 → 领料/出库 → 报工 → 成品检验 → 完工入库 → 成品入库 → 销货 → 销售出库。
     SO-2026-001 = 1000 件 → 5 个工单 × 200 件，每单 2 班次 × 100 件报工，全链路 1000 件交付。 */
  var CHAIN = [
    ['SD_QUOTATION', '311-20260825001', 'SD_SALES_ORDER', 'SO-2026-001', '生成销售订单', '2026-08-28 10:00:00'],
    ['SD_QUOTATION', '311-20260901002', 'SD_SALES_ORDER', 'SO-2026-002', '生成销售订单', '2026-09-01 09:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'PD_PRICE_COMPARE', 'PR-2026-0001', '生成请购单', '2026-08-29 09:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-002', 'PD_PRICE_COMPARE', 'PR-2026-0002', '生成请购单', '2026-09-01 10:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'PP_MASTER_PLAN', 'MP-2026-09-01', '生成生产计划', '2026-09-01 08:30:00'],
    ['SD_SALES_ORDER', 'SO-2026-002', 'PP_MASTER_PLAN', 'MP-2026-09-03', '生成生产计划', '2026-09-01 09:10:00'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'PD_PRICE_COMPARE', 'PR-2026-0001', '生成请购单', '2026-08-29 08:40:00', '按生产计划用料需求请购'],
    ['PP_MASTER_PLAN', 'MP-2026-09-03', 'PD_PRICE_COMPARE', 'PR-2026-0002', '生成请购单', '2026-09-01 09:40:00', '按生产计划用料需求请购'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'PD_PRICE_COMPARE', 'PR-2026-0003', '生成请购单', '2026-09-05 10:00:00', '橡胶衬套缺料，由生产计划直接请购'],
    ['PD_PRICE_COMPARE', 'PR-2026-0001', 'PD_PURCHASE_ORDER', 'PO-2026-0001', '生成采购订单', '2026-08-30 11:00:00'],
    ['PD_PRICE_COMPARE', 'PR-2026-0002', 'PD_PURCHASE_ORDER', 'PO-2026-0002', '生成采购订单', '2026-09-01 15:00:00'],
    ['PD_PRICE_COMPARE', 'PR-2026-0003', 'PD_PURCHASE_ORDER', 'PO-2026-0003', '生成采购订单', '2026-09-10 11:00:00'],
    ['PD_PURCHASE_ORDER', 'PO-2026-0001', 'PD_ARRIVAL', '301-20260903001', '生成到货单', '2026-09-03 08:30:00'],
    ['PD_PURCHASE_ORDER', 'PO-2026-0002', 'PD_ARRIVAL', '301-20260905002', '生成到货单', '2026-09-05 08:30:00'],
    ['PD_ARRIVAL', '301-20260903001', 'QC_INSPECTION', 'QC-2026-001', '生成来料检验(IQC)', '2026-09-03 09:00:00'],
    ['PD_ARRIVAL', '301-20260905002', 'QC_INSPECTION', 'QC-2026-002', '生成来料检验(IQC)', '2026-09-05 09:00:00'],
    ['PD_ARRIVAL', '301-20260903001', 'WM_INBOUND', 'IN-2026-0001', '生成采购入库', '2026-09-03 11:00:00'],
    ['PD_ARRIVAL', '301-20260905002', 'WM_INBOUND', 'IN-2026-0002', '生成采购入库', '2026-09-05 11:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'EX_WORK_ORDER', 'WO-2026-0001', '生成生产工单', '2026-09-05 14:00:00', '1000件拆5单，本单200件'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'EX_WORK_ORDER', 'WO-2026-0001', '生成生产工单', '2026-09-05 14:00:00', '按生产计划明细下达'],
    ['EX_WORK_ORDER', 'WO-2026-0001', 'EX_ISSUE_ORDER', '5401-20260906001', '生成领料单', '2026-09-06 07:40:00'],
    ['EX_WORK_ORDER', 'WO-2026-0001', 'EX_REPORT', 'RP-2026-0001', '白班报工100件', '2026-09-06 12:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0001', 'EX_REPORT', 'RP-2026-0002', '中班报工100件', '2026-09-06 16:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0001', 'QC_INSPECTION', 'QC-2026-006', '生成成品检验(FQC)', '2026-09-06 17:00:00'],
    ['EX_WORK_ORDER', 'WO-2026-0001', 'EX_FINISH_IN', 'FI-2026-0001', '生成完工入库', '2026-09-06 17:40:00'],
    ['EX_FINISH_IN', 'FI-2026-0001', 'WM_FINISH_IN', 'WI-2026-0001', '生成成品入库单', '2026-09-06 18:00:00'],
    ['EX_ISSUE_ORDER', '5401-20260906001', 'WM_OUTBOUND', 'OUT-2026-0001', '生成领料出库', '2026-09-06 08:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'EX_WORK_ORDER', 'WO-2026-0002', '生成生产工单', '2026-09-05 14:05:00', '1000件拆5单，本单200件'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'EX_WORK_ORDER', 'WO-2026-0002', '生成生产工单', '2026-09-05 14:05:00', '按生产计划明细下达'],
    ['EX_WORK_ORDER', 'WO-2026-0002', 'EX_ISSUE_ORDER', '5401-20260906002', '生成领料单', '2026-09-06 07:40:00'],
    ['EX_WORK_ORDER', 'WO-2026-0002', 'EX_REPORT', 'RP-2026-0003', '白班报工100件', '2026-09-06 12:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0002', 'EX_REPORT', 'RP-2026-0004', '中班报工100件', '2026-09-06 16:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0002', 'QC_INSPECTION', 'QC-2026-007', '生成成品检验(FQC)', '2026-09-06 17:00:00'],
    ['EX_WORK_ORDER', 'WO-2026-0002', 'EX_FINISH_IN', 'FI-2026-0002', '生成完工入库', '2026-09-06 17:40:00'],
    ['EX_FINISH_IN', 'FI-2026-0002', 'WM_FINISH_IN', 'WI-2026-0002', '生成成品入库单', '2026-09-06 18:00:00'],
    ['EX_ISSUE_ORDER', '5401-20260906002', 'WM_OUTBOUND', 'OUT-2026-0002', '生成领料出库', '2026-09-06 08:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'EX_WORK_ORDER', 'WO-2026-0003', '生成生产工单', '2026-09-06 09:00:00', '1000件拆5单，本单200件'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'EX_WORK_ORDER', 'WO-2026-0003', '生成生产工单', '2026-09-06 09:00:00', '按生产计划明细下达'],
    ['EX_WORK_ORDER', 'WO-2026-0003', 'EX_ISSUE_ORDER', '5401-20260907003', '生成领料单', '2026-09-07 07:40:00'],
    ['EX_WORK_ORDER', 'WO-2026-0003', 'EX_REPORT', 'RP-2026-0005', '白班报工100件', '2026-09-07 12:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0003', 'EX_REPORT', 'RP-2026-0006', '中班报工100件', '2026-09-07 16:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0003', 'QC_INSPECTION', 'QC-2026-008', '生成成品检验(FQC)', '2026-09-07 17:00:00'],
    ['EX_WORK_ORDER', 'WO-2026-0003', 'EX_FINISH_IN', 'FI-2026-0003', '生成完工入库', '2026-09-07 17:40:00'],
    ['EX_FINISH_IN', 'FI-2026-0003', 'WM_FINISH_IN', 'WI-2026-0003', '生成成品入库单', '2026-09-07 18:00:00'],
    ['EX_ISSUE_ORDER', '5401-20260907003', 'WM_OUTBOUND', 'OUT-2026-0003', '生成领料出库', '2026-09-07 08:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'EX_WORK_ORDER', 'WO-2026-0004', '生成生产工单', '2026-09-06 09:05:00', '1000件拆5单，本单200件'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'EX_WORK_ORDER', 'WO-2026-0004', '生成生产工单', '2026-09-06 09:05:00', '按生产计划明细下达'],
    ['EX_WORK_ORDER', 'WO-2026-0004', 'EX_ISSUE_ORDER', '5401-20260907004', '生成领料单', '2026-09-07 07:40:00'],
    ['EX_WORK_ORDER', 'WO-2026-0004', 'EX_REPORT', 'RP-2026-0007', '白班报工100件', '2026-09-07 12:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0004', 'EX_REPORT', 'RP-2026-0008', '中班报工100件', '2026-09-07 16:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0004', 'QC_INSPECTION', 'QC-2026-009', '生成成品检验(FQC)', '2026-09-07 17:00:00'],
    ['EX_WORK_ORDER', 'WO-2026-0004', 'EX_FINISH_IN', 'FI-2026-0004', '生成完工入库', '2026-09-07 17:40:00'],
    ['EX_FINISH_IN', 'FI-2026-0004', 'WM_FINISH_IN', 'WI-2026-0004', '生成成品入库单', '2026-09-07 18:00:00'],
    ['EX_ISSUE_ORDER', '5401-20260907004', 'WM_OUTBOUND', 'OUT-2026-0004', '生成领料出库', '2026-09-07 08:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'EX_WORK_ORDER', 'WO-2026-0005', '生成生产工单', '2026-09-07 09:00:00', '1000件拆5单，本单200件'],
    ['PP_MASTER_PLAN', 'MP-2026-09-01', 'EX_WORK_ORDER', 'WO-2026-0005', '生成生产工单', '2026-09-07 09:00:00', '按生产计划明细下达'],
    ['EX_WORK_ORDER', 'WO-2026-0005', 'EX_ISSUE_ORDER', '5401-20260908005', '生成领料单', '2026-09-08 07:40:00'],
    ['EX_WORK_ORDER', 'WO-2026-0005', 'EX_REPORT', 'RP-2026-0009', '白班报工100件', '2026-09-08 12:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0005', 'EX_REPORT', 'RP-2026-0010', '中班报工100件', '2026-09-08 16:10:00'],
    ['EX_WORK_ORDER', 'WO-2026-0005', 'QC_INSPECTION', 'QC-2026-010', '生成成品检验(FQC)', '2026-09-08 17:00:00'],
    ['EX_WORK_ORDER', 'WO-2026-0005', 'EX_FINISH_IN', 'FI-2026-0005', '生成完工入库', '2026-09-08 17:40:00'],
    ['EX_FINISH_IN', 'FI-2026-0005', 'WM_FINISH_IN', 'WI-2026-0005', '生成成品入库单', '2026-09-08 18:00:00'],
    ['EX_ISSUE_ORDER', '5401-20260908005', 'WM_OUTBOUND', 'OUT-2026-0005', '生成领料出库', '2026-09-08 08:00:00'],
    ['SD_SALES_ORDER', 'SO-2026-001', 'SD_DELIVERY', '2302-20260915001', '生成销货单(发货)', '2026-09-15 09:00:00', '1000件一次性交付'],
    ['SD_DELIVERY', '2302-20260915001', 'WM_OUTBOUND', 'OUT-2026-0006', '生成销售出库', '2026-09-15 10:00:00'],
    ['QC_INSPECTION', 'QC-2026-008', 'QC_REWORK_ORDER', 'RW-2026-0001', '生成返工单', '2026-09-07 17:30:00', '8 件焊缝气孔超限转返工'],
    ['EX_REPORT', 'RP-2026-0009', 'QC_SCRAP_ORDER', 'SC-1805-2026001', '生成报废单', '2026-09-08 10:30:00', '装夹压伤 2 件报废'],
    ['EQ_PATROL', 'PT-20260918-01', 'EQ_FAULT_REPAIR', 'FR-2026-0001', '生成故障报修', '2026-09-18 07:20:00', '巡检异常触发报修']
  ];
  S.SYS_DOC_LINK = CHAIN.map(function (c, i) {
    return base({
      LINK_ID: 'LNK-' + ('00' + (i + 1)).slice(-3), FROM_TABLE: c[0], FROM_NO: c[1],
      TO_TABLE: c[2], TO_NO: c[3], FLOW_LABEL: c[4], LINK_TIME: c[5], REMARK: c[6] || '流转生成'
    });
  });

  /* ==================== 条码 / 二维码（物料 & 工序工单） ====================
   * 为便于后续扫码追溯，物料与工序工单各带「条码 + 二维码」两个字段：
   *   ITEM_BARCODE / WO_BARCODE —— 可打印的一维/二维条码值（唯一编号）
   *   QR_CODE                   —— 二维码承载的追溯串（应用内按此串渲染二维码图形）
   * 这里按编号规则自动生成，后续也可在表单里手工改写。 */
  S.MD_MATERIAL.forEach(function (m, i) {
    if (!m.ITEM_BARCODE) m.ITEM_BARCODE = 'MT' + String(i + 1).padStart(4, '0');
    if (!m.QR_CODE) m.QR_CODE = 'MES|MAT|' + m.ITEM_NO + '|' + m.ITEM_BARCODE + '|' + (m.LOT_FLAG ? 'BATCH' : 'SINGLE');
  });
  S.EX_WORK_ORDER.forEach(function (w, i) {
    if (!w.WO_BARCODE) w.WO_BARCODE = 'WO' + String(w.DOC_DATE || w.OPEN_DATE || '').replace(/-/g, '') + String(i + 1).padStart(3, '0');
    if (!w.QR_CODE) w.QR_CODE = 'MES|WO|' + w.WO_NO + '|' + w.PRODUCT_NO + '|QTY' + w.PLAN_QTY;
  });

  /* ==================== 生产报表 · 追溯报表（只读派生，占位初始化） ====================
   * 两张追溯报表不落地人工录入，内容由 app.js 按条码 / 批次 / 工单号从业务单据实时汇总。 */
  S.RPT_TRACE_MATERIAL = S.RPT_TRACE_MATERIAL || [];
  S.RPT_TRACE_WORK = S.RPT_TRACE_WORK || [];

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  if (root) root.MES_SEED = S;
})(typeof window !== 'undefined' ? window : null);