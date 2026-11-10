/* MES 制造执行管理系统 · supOS 应用前端逻辑（纯前端 + localStorage 持久化，零依赖）
 * 导航「双形态」自适应（同一份代码，两种运行环境）：
 *   1. 门户形态（路径 /os/<组>/<应用>，或被门户 iframe 嵌入）：应用内不出菜单，
 *      全局业务页面切换由 supOS 门户菜单承载（符合平台规范）；顶栏只留「当前位置说明 + 登录人 + 重置」。
 *   2. 本地直连形态（如 http://localhost:8080）：应用内保留「顶栏视图页签 + 左侧功能域树 + 显示设置」，
 *      便于本地自由切页；两种形态都由 URL 深链直达且可直接刷新。
 *   3. 形态由 index.html <head> 的内联脚本首帧判定（唯一来源，写入 window.__MES_NAV__），
 *      可用 ?nav=1 / ?nav=0 强制覆盖；应用根路径按路径形状推断，资源与接口一律相对应用根解析。
 *   4. 保留本应用独有能力：演示数据自愈（SEED_VER）与生产计划明细。
 */
(function () {
  'use strict';
  var S = window.MES_SCHEMA;
  var LS = 'mes_db_v5'; // v5：生产计划补「明细子表 + 上下游链路」（旧缓存自动失效）
  var SEED_VER = 'v1.12';      // 演示数据剧本版本：升级种子数据时同步修改，浏览器端旧数据自动重建
                              // v1.8：销售订单 1000 件 → 5 工单 × 200 件，设备 50 件/h、每班次报工 100 件，全链路闭环
  var SEED_VER_KEY = 'mes_seed_ver';
  var FIELDS_KEY = 'mes_fields_v1';
  var VIEWS_KEY = 'mes_views_v2'; // v2：顶栏收为 3 个视图，其余改挂左侧树「生产看板」
  var COLVIS_KEY = 'mes_colvis_v1';
  var COLORDER_KEY = 'mes_colorder_v1';
  var INSIGHT_KEY = 'mes_insight_v1';
  var db = null;
  /* 首屏真实数据加载中（后端探活 + 逐表灌入期间为 true）：列表页据此显示「正在读取」而不是「暂无数据」 */
  var BOOTING = false;

  /* ================= 表级按需取数（2026-10-27 改造） =================
   * 老行为：页面一启动就把 70 张表各拉 200 行灌进 db。门户形态下点任何一个菜单都是
   *        URL 变化 → iframe 整页重载 → 这段预载重跑一次 ⇒ 每点一次页面 71 个请求。
   * 新行为：
   *   · LOADED[t]  = 这张表的真实数据已载入。**未载入不等于空表**，绝不把它当 0 行显示。
   *   · VERS[t]    = 上次同步到的版本 {c:未删除行数, u:最大更新时间}，用于版本对账。
   *   · 渲染时 rows()/rawRows() 把「本视图真正读了哪些表」记进 COLLECT；
   *     渲染完成后只补拉还缺的那几张（见 fillMissing）。
   *   · 启动先吃本地快照（0 请求）→ 一次 /api/sync 对账 → 只重拉变过的表。
   * 回退开关：URL 加 ?lazy=0 恢复旧的「启动全量预载」，出问题时可一键退回。 */
  var LAZY = !/[?&]lazy=0/.test(location.search || '');
  var LOADED = {};        // t -> true
  var VERS = {};          // t -> { c: number, u: string }
  var LOAD_FAIL = {};     // t -> true（本轮失败，别再反复重试）
  var COLLECT = null;     // 渲染期间收集「被读到的表」
  var FILLING = false;    // 补拉进行中，防止 render ↔ fillMissing 互相触发
  var VKEY = 'mes_sync_v1';

  function loadSync() {
    try {
      var r = JSON.parse(localStorage.getItem(VKEY) || 'null') || {};
      VERS = (r && typeof r.v === 'object' && r.v) ? r.v : {};
      (r.l || []).forEach(function (t) { LOADED[t] = 1; });
    } catch (e) { VERS = {}; LOADED = {}; }
  }
  function saveSync() {
    try { localStorage.setItem(VKEY, JSON.stringify({ v: VERS, l: Object.keys(LOADED) })); } catch (e) {}
  }
  /* 写完之后把这表版本作废：下次对账必然重拉，不会拿着旧快照当新数据 */
  function markStale(t) { if (t) { delete VERS[t]; saveSync(); } }
  /* 当前 supOS 登录账号：由 /api/whoami 解析（门户同源 Cookie），只用于界面展示与本地回填；
   * 真正落到 UNS 的 create_by / update_by 由服务端按同一份登录态强制覆盖，前端改不动。 */
  var CUR_USER = '';
  /* page / pageSize：数据浏览分页状态（pageSize 记在 localStorage，默认 20） */
  var st = {
    view: 'board', table: null, search: '', sel: null, open: { g: {}, t: {} }, doc: null,
    page: 1,
    pageSize: (function () {
      try { var n = parseInt(localStorage.getItem('mes_pageSize'), 10); return (n >= 10 && n <= 200) ? n : 20; } catch (e) { return 20; }
    })()
  };

  /* ================= 数据通道现状（2026-10-22 清理） =================
   * 历史：早期一度把平台 UNS 只读代理（POST api/call?tool=queryRelationData）当数据库用。
   *      该入口已在平台侧下线：应用内 API 路由只认表名，api/call 一律 404
   *      「未绑定的数据表：call」（flash01 与 supos-test 实测一致），连带
   *      「启动批量预载 70 表」与「应用侧写通道探测」整段成为死代码，本版已全部删除。
   * 现状：**唯一数据通道 = 自有后端**（见下节 BE，backend-uns 契约）；
   *      仅当后端不可用（纯静态预览）时才回落本地演示种子。
   */

  /* ================= 自有后端 UNS 读写通道（backend-uns 契约） =================
   * 2026-10-09：平台已支持**应用后端**访问 UNS（app.preflight profile=backend-uns）。
   *   静态内置代理仍只读；写必须走应用自己的服务端。
   * 2026-10-29：服务端整体迁到平台**原生 OpenAPI**（/os/open-api/uns/relation，
   *   POST 查 / PUT 写 / DELETE 删），不再经过 MCP 网关；交互请求带当前登录用户
   *   票据（x-ticket / suposTicket / Bearer），后台巡检带平台注入的应用 AppKey。
   *
   * 前端因此不再自己拼 SQL，而是调**自身业务 API**：
   *   GET    {base}api/<TABLE>?limit=          → { ok, rows:[...] }
   *   POST   {base}api/<TABLE>                 → { ok, row }         新增
   *   PUT    {base}api/<TABLE>/<KEY>           → { ok, row }         修改
   *   DELETE {base}api/<TABLE>/<KEY>           → { ok, deleted }     删除
   *
   * 无自有后端的部署（纯静态）→ BE.available() 为 false，页面自动回到只读。
   * ⚠️ 前端绝不发 SQL / 工具名 / 任意表名；表名与字段白名单由后端固定映射。
   */
  var BE = (function () {
    /* 已接后端的表（全表绑定，共 70 张）—— 由 .workbuddy/gen-tables-whitelist.js 生成：
     * keys = 该表「每行唯一」的业务键（明细表为复合键，长度 >1，后端按 '|' 解析）。 */
    var TABLES = { MD_CUSTOMER: { keys: ['customer_code'], label: '客户资料' }, MD_SUPPLIER: { keys: ['supplier_code'], label: '供应商资料' }, MD_PRODUCT: { keys: ['product_no'], label: '产品资料' }, MD_BOM_HEAD: { keys: ['bom_no'], label: 'BOM头' }, MD_MATERIAL: { keys: ['item_no'], label: '物料资料' }, MD_MATERIAL_CATEGORY: { keys: ['category_code'], label: '物料分类树' }, MD_EQUIPMENT: { keys: ['equip_no'], label: '设备资料' }, MD_GAUGE: { keys: ['gauge_no'], label: '量检具' }, HR_EMPLOYEE: { keys: ['emp_no'], label: '人员资料' }, MD_POSITION: { keys: ['position_code'], label: '岗位资料' }, HR_TEAM: { keys: ['team_code'], label: '班组资料' }, HR_SHIFT_SCHEDULE: { keys: ['shift_id'], label: '班组排班' }, HR_SHIFT_CALENDAR: { keys: ['cal_id'], label: '班次日历' }, RT_ROUTE: { keys: ['route_no'], label: '工艺路线主数据' }, RT_ROUTE_STEP: { keys: ['route_no', 'seq_no'], label: '工艺路线工序序列' }, MD_STEP_DICT: { keys: ['step_code'], label: '工序字典' }, MD_STEP_EQUIP_CAP: { keys: ['cap_id'], label: '工序设备能力矩阵' }, RT_ROUTE_VERSION: { keys: ['route_no', 'product_no', 'effect_date'], label: '工艺版本' }, RT_VERSION_LOG: { keys: ['route_no'], label: '工艺版本记录' }, RT_SOP: { keys: ['sop_no'], label: '作业指导书' }, RT_OUTSOURCE_STEP: { keys: ['step_code'], label: '外协工序' }, SD_QUOTATION: { keys: ['quote_no'], label: '报价单' }, SD_QUOTATION_LINE: { keys: ['quote_no', 'seq_no'], label: '报价单明细' }, SD_SALES_ORDER: { keys: ['so_no'], label: '销售订单' }, SD_SALES_ORDER_LINE: { keys: ['so_no', 'seq_no'], label: '销售订单明细' }, SD_DELIVERY: { keys: ['delivery_no'], label: '销货单' }, SD_DELIVERY_LINE: { keys: ['delivery_no', 'seq_no'], label: '销货单明细' }, PD_PRICE_COMPARE: { keys: ['pr_no'], label: '请购与比价选商' }, PD_PURCHASE_ORDER: { keys: ['po_no'], label: '采购订单' }, PD_PURCHASE_ORDER_LINE: { keys: ['po_no', 'seq_no'], label: '采购订单明细' }, PD_ARRIVAL: { keys: ['arrival_no'], label: '到货单' }, PD_ARRIVAL_LINE: { keys: ['arrival_no', 'seq_no'], label: '到货单明细' }, PP_MASTER_PLAN: { keys: ['plan_no'], label: '生产计划' }, PP_MASTER_PLAN_LINE: { keys: ['plan_no', 'item_no', 'seq_no'], label: '生产计划明细' }, PP_SCHEDULE: { keys: ['schedule_no'], label: '工序排程' }, EX_WORK_ORDER: { keys: ['wo_no'], label: '工序工单(成品工单)' }, EX_WO_STEP: { keys: ['wo_no', 'step_no'], label: '工单工序明细' }, EX_MACHINE_DATA: { keys: ['collect_no'], label: '加工采集数据' }, EX_LABOR_RECORD: { keys: ['step_no', 'emp_no', 'wo_no'], label: '工时/人工记录' }, EX_REPORT: { keys: ['report_no'], label: '工序报工(核心)' }, QC_INSPECTION: { keys: ['qc_no'], label: '检验记录' }, QC_REWORK_ORDER: { keys: ['rework_no'], label: '返工工单' }, QC_SCRAP_ORDER: { keys: ['scrap_no'], label: '报废单' }, EX_FINISH_IN: { keys: ['in_no'], label: '完工入库申请' }, EX_SHIFT_HANDOVER: { keys: ['handover_no'], label: '班组交接记录' }, EX_SHIFT_STATION_CHECK: { keys: ['handover_no', 'machine_no'], label: '工位点检明细' }, WM_STOCK: { keys: ['stock_id'], label: '库存主账' }, WM_STOCK_LOT: { keys: ['stock_lot_id'], label: '批次库存' }, WM_INBOUND: { keys: ['in_no'], label: '入库(采购/完工/退料)' }, WM_OUTBOUND: { keys: ['out_no'], label: '出库(领料/销售/报废)' }, WM_FINISH_IN: { keys: ['in_no'], label: '成品入库单' }, WM_STOCKTAKING: { keys: ['st_no'], label: '盘点' }, EX_ISSUE_ORDER: { keys: ['issue_no'], label: '领料单' }, EX_ISSUE_LINE: { keys: ['issue_no', 'seq_no'], label: '领料单明细' }, EQ_EQUIPMENT_LEDGER: { keys: ['equip_no'], label: '设备台账' }, EQ_INSPECTION: { keys: ['inspect_no'], label: '日常点检' }, EQ_INSPECTION_ITEM: { keys: ['template_code', 'seq_no'], label: '点检项模板' }, EQ_MAINTENANCE_PLAN: { keys: ['pm_no'], label: '保养计划(PM)' }, EQ_MAINTENANCE_RECORD: { keys: ['pm_no'], label: '保养记录' }, EQ_PATROL: { keys: ['patrol_no'], label: '设备巡检' }, EQ_FAULT_REPAIR: { keys: ['manage_no'], label: '故障报修' }, EQ_RUNTIME_STATUS: { keys: ['status_id'], label: '设备运行状态' }, SYS_DICT: { keys: ['dict_code'], label: '字典' }, SYS_CODE_RULE: { keys: ['rule_code'], label: '编号规则' }, SYS_AUDIT_LOG: { keys: ['log_id'], label: '审计日志' }, SYS_ATTACHMENT: { keys: ['attach_id'], label: '附件' }, SYS_DOC_LINK: { keys: ['link_id'], label: '单据上下游关联' }, HR_SHIFT_DEF: { keys: ['shift_code'], label: '班次定义' }, MD_BOM_LINE: { keys: ['bom_no', 'level_no', 'seq_no'], label: 'BOM行(多层级)' }, HR_TEAM_MEMBER: { keys: ['team_code', 'emp_no'], label: '班组成员' } };
    var avail = null;          // null=未探测 / true / false
    var lastErr = '';
    var nativeFetch = (typeof window !== 'undefined' && typeof window.fetch === 'function')
      ? window.fetch.bind(window) : null;

    function base() {
      var b = window.__SUPOS_BASE__;
      return (typeof b === 'string' && b.charAt(0) === '/') ? String(b).replace(/\/*$/, '/') : '';
    }
    function url(path) { return base() + String(path).replace(/^\/*/, ''); }
    function log(msg) { try { console.log('[MES-BE] ' + msg); } catch (e) {} }
    function on(t) { return !!TABLES[t]; }
    function tables() { return Object.keys(TABLES); }

    /* 统一请求：任何非 2xx 或空信封 → 抛错（绝不假成功） */
    function req(method, path, body) {
      if (!nativeFetch) return Promise.reject(new Error('环境无 fetch'));
      var opt = { method: method, credentials: 'include', headers: { 'Accept': 'application/json' } };
      if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
      return nativeFetch(url(path), opt).then(function (r) {
        return r.text().then(function (txt) {
          var j = null; try { j = JSON.parse(txt); } catch (e) { j = null; }
          if (r.status === 404 && !j) throw new Error('后端未部署（HTTP 404）');
          if (!r.ok || !j || j.ok === false) {
            var msg = (j && j.error) || ('HTTP ' + r.status);
            var err = new Error(String(msg).slice(0, 200));
            err.http = r.status; err.code = j && j.code; err.platform = j && j.platform;
            /* 保存时拒绝（乐观锁）要带出冲突明细，界面才能说清「哪个字段被谁改成了什么」 */
            err.conflicts = j && j.conflicts; err.modifiedBy = j && j.modifiedBy; err.modifiedAt = j && j.modifiedAt;
            throw err;
          }
          return j;
        });
      });
    }
    /* 探活：拿一张已接后端的表读 1 行；404/非 JSON → 无后端 */
    function probe() {
      if (avail !== null) return Promise.resolve(avail);
      var t = tables()[0];
      return req('GET', 'api/' + t + '?limit=1').then(function () {
        avail = true; log('自有后端可用（' + url('api/' + t) + '）'); return true;
      }).catch(function (e) {
        var m = String((e && e.message) || e);
        avail = false; lastErr = m;
        log('自有后端不可用 → 该表回落只读。原因：' + m.slice(0, 160));
        return false;
      });
    }
    /* 由调用方直接告诉可用性：/api/sync 成功即证明后端在，
     * 省掉「探活 + 对账」两次请求里的探活那一次（每次切页都省）。 */
    function markAvailable(v) { avail = v === true; }
    function list(t, limit) { return req('GET', 'api/' + t + '?limit=' + (limit || 500)).then(function (j) { return j.rows || []; }); }
    /* 服务端分页：o = { limit, offset, s, f, g }（s/f/g 已做 URL 转义）→ { rows, total } */
    function page(t, o) {
      var qs = 'api/' + t + '?limit=' + o.limit + '&offset=' + o.offset + '&total=1';
      if (o.s) qs += '&s=' + o.s;
      if (o.f) qs += '&f=' + o.f;
      if (o.e) qs += '&e=' + o.e;
      if (o.g) qs += '&g=' + o.g;
      return req('GET', qs).then(function (j) {
        return { rows: j.rows || [], total: (typeof j.total === 'number' ? j.total : (j.rows || []).length) };
      });
    }
    function row(t, key) { return req('GET', 'api/' + t + '/' + encodeURIComponent(key)).then(function (j) { return j.row; }); }
    /* 联动回写没算完时后端会带 warnings：如实提示，不假装成功 */
    function warnOf(j) {
      if (j && j.warnings && j.warnings.length) {
        toast('⚠ 联动回写未完成：' + j.warnings.join('；'));
        try { console.warn('[MES-RULES] ' + j.warnings.join(' | ')); } catch (e) {}
      }
      return j;
    }
    function create(t, obj) { return req('POST', 'api/' + t, obj).then(warnOf).then(function (j) { return j.row; }); }
    function edit(t, key, obj) { return req('PUT', 'api/' + t + '/' + encodeURIComponent(key), obj).then(warnOf).then(function (j) { return j.row; }); }
    /* 删除 = **软删除**（2026-10-29 改造）：后端把 del_flag 置 true，行留在库里，
     * 可在「表功能 ▾ → 回收站」里恢复。返回被删的那条业务键。 */
    function del(t, key) { return req('DELETE', 'api/' + t + '/' + encodeURIComponent(key)).then(warnOf).then(function (j) { return j.deleted; }); }
    /* 彻底删除：只允许删「已进回收站」的行，后端会拒绝直接删活行 */
    function purge(t, key) { return req('DELETE', 'api/' + t + '/' + encodeURIComponent(key) + '?purge=1').then(warnOf).then(function (j) { return j.deleted; }); }
    /* 回收站列表：?deleted=1 只列 del_flag=true 的行（含删除人/删除时间，来自 update_by/update_time） */
    function trash(t, o) {
      o = o || {};
      var qs = 'api/' + t + '?deleted=1&limit=' + (o.limit || 100) + '&offset=' + (o.offset || 0) + '&total=1';
      return req('GET', qs).then(function (j) {
        return { rows: j.rows || [], total: (typeof j.total === 'number' ? j.total : (j.rows || []).length) };
      });
    }
    /* 从回收站恢复：同业务键若已有活行，后端回 409 并说明原因（不静默覆盖） */
    function restore(t, key) { return req('POST', 'api/' + t + '/' + encodeURIComponent(key) + '/restore', {}).then(warnOf).then(function (j) { return j.row; }); }
    /* 单号唯一性预检（保存前调用）：由后端回答「这张表是否声明了单号唯一 + 该值是否已被占用」。
     * 表清单只在 server/unique-keys.js 维护，前端不写死，避免两边漂移。 */
    function checkKey(t, key) {
      return req('GET', 'api/uniq?table=' + encodeURIComponent(t) + '&key=' + encodeURIComponent(key == null ? '' : String(key)));
    }
    /* 版本对账（2026-10-27）：一次请求拿回若干表的 {行数, 最大更新时间}，不含业务行。
     * 前端拿它和本地快照比对，只重拉变化的表 —— 点一个页面不再无脑拉 70 张。 */
    function sync(ts) {
      var q = (ts && ts.length) ? ('?tables=' + ts.join(',')) : '';
      return req('GET', 'api/sync' + q).then(function (j) { return (j && j.tables) || {}; });
    }

    var api = {
      on: on, tables: tables, probe: probe, markAvailable: markAvailable, list: list, page: page, row: row, create: create, edit: edit, del: del, purge: purge, trash: trash, restore: restore, checkKey: checkKey, sync: sync,
      keysOf: function (t) { var e = TABLES[t] || {}; return (e.keys && e.keys.length) ? e.keys : (e.key ? [e.key] : ['ID']); },
      keyOf: function (t) { var k = this.keysOf(t); return k[0]; },
      available: function () { return avail !== false; },
      state: function () { return { available: avail, base: base(), tables: tables(), lastErr: lastErr }; }
    };
    if (typeof window !== 'undefined') window.__MES_BE__ = api;
    return api;
  })();

  /* ---------- 导航形态（门户形态 / 本地直连形态） ----------
   * 判定逻辑与 index.html <head> 的内联脚本**完全一致**，这里以它写入的 window.__MES_NAV__ 为准
   * （保证首帧与运行期同源）；万一内联脚本未执行（如被极端 CSP 拦截），再按同样规则兜底自算。 */
  var NAV_MODE = (window.__MES_NAV__ === 'portal' || window.__MES_NAV__ === 'local')
    ? window.__MES_NAV__
    : (((location.pathname || '').indexOf('/os/') === 0 || window.self !== window.top) ? 'portal' : 'local');
  var IN_PORTAL = NAV_MODE === 'portal';                       // true = 菜单交给门户，应用内不出导航
  var NAV_FORCED = /[?&]nav=[01]/.test(location.search || ''); // 是否用了 ?nav= 强制覆盖（重写 URL 时需保留）

  /* 视图清单（双形态共用）
   * · 本地直连形态：def=true 的进「顶栏视图页签」，side=true 的挂左侧树的分组目录；
   * · 门户形态：不使用本表渲染导航，但模块仍复用「合法 slug → 视图名」对照解析门户菜单深链。 */
  var NAV = [
    { view: 'browser', label: '数据浏览', def: true },
    { view: 'model', label: '数据模型', def: true },
    { view: 'guide', label: '使用说明', def: true },
    /* 「生产看板」组：不进顶栏，挂左侧树分组目录（side:true） */
    { view: 'board', label: '现场驾驶舱', def: false, side: true, group: '生产看板' },
    { view: 'wip', label: 'WIP 看板', def: false, side: true, group: '生产看板' },
    { view: 'oee', label: 'OEE', def: false, side: true, group: '生产看板' },
    /* 其余视图（原「应用工具」组已移除）：默认不进顶栏与左树，可用「⚙ 显示设置」勾到顶栏显示 */
    { view: 'flow', label: '核心流程', def: false },
    { view: 'insight', label: '数据洞察', def: false },
    { view: 'dashboard', label: '总览', def: false },
    { view: 'er', label: '关系图', def: false }
  ];
  var DEFAULT_LANDING = 'board'; // 每次打开 / 刷新默认落地的界面（现场驾驶舱）
  function navOf(view) { return NAV.find(function (n) { return n.view === view; }); }
  /* 左右树是否托管该视图（side:true）—— 深链时不自动冒到顶栏 */
  function isSidebarView(view) { var n = navOf(view); return !!(n && n.side); }
  /* 某导航分组挂的视图入口列表（新版一个分组可挂多个；g.view 为旧写法，保留兼容） */
  function groupViews(g) { return (g && g.views && g.views.length) ? g.views : ((g && g.view) ? [g.view] : []); }
  function coreView(view) { var n = navOf(view); return !!(n && n.core); }
  /* 顶栏视图页签是否显示该视图（本地直连形态用；门户形态不渲染顶栏，故不参与） */
  function visOn(view) {
    var n = navOf(view); if (!n) return false; if (n.core) return true;
    return views.vis[view] === undefined ? !!n.def : !!views.vis[view];
  }
  /* 某张表所属的导航分组（GROUPS 条目） */
  function groupOf(t) { var g = null; S.GROUPS.forEach(function (x) { if (x.tables.indexOf(t) >= 0) g = x; }); return g; }
  /* 是否属于「生产报表」：报表只读、只保留查询/导出，且数据由业务表实时派生 */
  function isReportTable(t) { var g = groupOf(t); return !!(S.TABLES[t] && S.TABLES[t].report) || !!(g && g.report); }

  /* 域配色（用于树形导航左侧色条） */
  var DOMAIN_COLOR = { MD: '#3b6ef5', SD: '#18a058', PP: '#0ea5a4', RT: '#0ea5a4', EX: '#d98800', EQ: '#8b5cf6', WM: '#8b5cf6', RPT: '#e11d48', KAN: '#0ea5e9', SYS: '#64748b' };
  function domColor(code) { return DOMAIN_COLOR[code] || '#3b6ef5'; }

  /* ---------- 深链路由（供 supOS 门户菜单把「域 / 表单」逐个挂成入口） ----------
   * 门户子菜单只能给「标题 + 路径」的扁平列表，无法嵌套。做法：每个域/表单给一个 slug 路径，
   * 应用启动时解析 URL 最后一段自动切到对应视图 / 表；导航时回写 URL 便于分享与刷新保持。
   * slug 约定：表单 `t-<表名小写、下划线转连字符>`（如 t-md-customer）；域 `g-<域代码小写>`（如 g-md）；
   * 视图沿用视图名（browser / board / insight / guide / flow / model / wip / oee / er / dashboard）。 */
  function tSlug(t) { return 't-' + String(t).toLowerCase().replace(/_/g, '-'); }
  function gSlug(code) { return 'g-' + String(code).toLowerCase(); }
  function groupDomainCode(name) {
    var d = (S.DOMAINS || []).find(function (x) { return x.name === name; });
    if (d) return d.code;
    return name;   // 非业务域分组已并入 DOMAINS（如「生产看板」= KAN），无需 ASCII 域码映射
  }
  var APP_BASE = (function () {
    var p = location.pathname || '/';
    return p.replace(/[^/]*$/, ''); // 去掉最后一段（可能是 slug 或 index.html）
  })();
  function routeTargets() {
    var byT = {}, byG = {};
    Object.keys(S.TABLES).forEach(function (t) { byT[tSlug(t)] = t; });
    S.GROUPS.forEach(function (g) { byG[gSlug(groupDomainCode(g.name))] = g.name; });
    return { byT: byT, byG: byG };
  }
  function applyRoute() {
    var t = routeTargets();
    var qv = (/[?&]v=([^&]+)/.exec(location.search) || [])[1];
    var qt = (/[?&]t=([^&]+)/.exec(location.search) || [])[1];
    var qg = (/[?&]g=([^&]+)/.exec(location.search) || [])[1];
    if (qt) { var dt = decodeURIComponent(qt); if (S.TABLES[dt]) { st.view = 'browser'; st.table = dt; } }
    if (qv) { var dv = decodeURIComponent(qv); if (navOf(dv)) { st.view = dv; if (!visOn(dv) && !isSidebarView(dv)) views.vis[dv] = true; } }
    /* 兼容门户可能采用的各种路径形态：/g-md、//g-md、#/g-md、#g-md、?g=md、
       以及 index.html 结尾（如 /g-md/index.html）——从后往前找第一个能命中的段 */
    var cands = (location.pathname || '').split('/')
      .concat((location.hash || '').replace(/^#/, '/').split('/'))
      .filter(Boolean)
      .map(function (x) { return String(x).toLowerCase().replace(/\.html?$/, ''); });
    var hitT = '', hitG = '', hitV = '';
    for (var i = cands.length - 1; i >= 0; i--) {
      var s = cands[i];
      if (!hitT && t.byT[s]) { hitT = t.byT[s]; break; }
      if (!hitG && t.byG[s]) { hitG = t.byG[s]; break; }
      if (!hitV && navOf(s)) { hitV = s; break; }
    }
    if (hitT) { st.view = 'browser'; st.table = hitT; }
    else if (hitG) {
      st.view = 'browser';
      st.open.g[hitG] = true;
      var g = S.GROUPS.find(function (x) { return x.name === hitG; }) || { tables: [] };
      var first = g.tables.find(function (x) { return S.TABLES[x] && !S.TABLES[x].detail; });
      if (first) st.table = first;
    } else if (hitV) { st.view = hitV; if (!visOn(hitV) && !isSidebarView(hitV)) views.vis[hitV] = true; }
    else if (qg) {
      var gc = String(decodeURIComponent(qg)).toLowerCase();
      var gn = (S.DOMAINS || []).find(function (d) { return String(d.code).toLowerCase() === gc; });
      var gname = gn ? gn.name : Object.keys(t.byG).indexOf('g-' + gc) >= 0 ? t.byG['g-' + gc] : '';
      if (gname) {
        st.view = 'browser'; st.open.g[gname] = true;
        var gg = S.GROUPS.find(function (x) { return x.name === gname; }) || { tables: [] };
        var ft = gg.tables.find(function (x) { return S.TABLES[x] && !S.TABLES[x].detail; });
        if (ft) st.table = ft;
      }
    }
  }
  /* 把当前所在位置同步到地址栏（不新增历史记录；失败静默）
   * 注意：?nav=0/1 强制导航形态的参数必须原样保留，否则重写 URL 后会丢失强制状态、形态回弹。 */
  function syncUrl() {
    try {
      var slug = (st.view === 'browser' && st.table) ? tSlug(st.table) : (navOf(st.view) ? st.view : '');
      if (!slug) return;
      var keep = NAV_FORCED ? (location.search || '') : '';
      var want = APP_BASE + slug + keep;
      if (location.pathname + keep !== want) history.replaceState(null, '', want);
    } catch (e) { }
  }

  /* ---------- 存储 ---------- */
  function load() { try { var r = localStorage.getItem(LS); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 字段自定义（增/改/删，持久化到 localStorage） ---------- */
  function loadFields() { try { return JSON.parse(localStorage.getItem(FIELDS_KEY)) || {}; } catch (e) { return {}; } }
  function saveFields(f) { try { localStorage.setItem(FIELDS_KEY, JSON.stringify(f)); } catch (e) {} }
  /* 把自定义字段应用到 S.TABLES（增/改/删） */
  function applyCustomFields() {
    var f = loadFields();
    Object.keys(f).forEach(function (t) {
      if (!S.TABLES[t]) return;
      var cols = S.TABLES[t].cols;
      var spec = f[t];
      (spec.removed || []).forEach(function (code) {
        var i = cols.findIndex(function (c) { return c.code === code; });
        if (i >= 0) cols.splice(i, 1);
      });
      spec.modified = spec.modified || {};
      Object.keys(spec.modified).forEach(function (code) {
        var i = cols.findIndex(function (c) { return c.code === code; });
        if (i >= 0) cols[i] = spec.modified[code];
      });
      (spec.added || []).forEach(function (c) {
        if (!cols.some(function (x) { return x.code === c.code; })) cols.push(c);
      });
    });
  }
  /* 记录一次字段变更 */
  function recordField(t, kind, col) {
    var f = loadFields(); if (!f[t]) f[t] = { added: [], removed: [], modified: {} };
    if (kind === 'add') { f[t].added = f[t].added.filter(function (c) { return c.code !== col.code; }); f[t].added.push(col); }
    else if (kind === 'modify') { f[t].modified[col.code] = col; }
    else if (kind === 'remove') {
      // 同时撤销该字段上可能的「新增/修改」定义
      f[t].added = f[t].added.filter(function (c) { return c.code !== col.code; });
      if (f[t].modified) delete f[t].modified[col.code];
      f[t].removed = f[t].removed.filter(function (c) { return c !== col.code; }); f[t].removed.push(col.code);
    }
    saveFields(f);
  }
  /* 删除字段前的依赖检查：返回 { dataCount, links:[说明] } */
  function fieldUsage(t, code) {
    var dataCount = 0;
    rows(t).forEach(function (r) { if (r[code] !== undefined && r[code] !== null && r[code] !== '') dataCount++; });
    var links = [];
    // 是否作为某主子表关联外键
    Object.keys(S.MASTER_DETAIL).forEach(function (m) {
      S.MASTER_DETAIL[m].forEach(function (d) {
        if (d.fk === code) links.push('「' + S.TABLES[m].label + '」与子表「' + S.TABLES[d.table].label + '」的主子表关联');
      });
    });
    // 是否作为主表主键（删除会破坏整张主子表定位）
    if (S.TABLES[t].pk === code && S.MASTER_DETAIL[t]) links.push('本表主键，且被 ' + S.MASTER_DETAIL[t].map(function (d) { return '「' + S.TABLES[d.table].label + '」'; }).join('、') + ' 作为关联字段');
    return { dataCount: dataCount, links: links };
  }

  /* ---------- 视图显隐设置（持久化到 localStorage） ---------- */
  function loadViews() {
    try {
      var r = JSON.parse(localStorage.getItem(VIEWS_KEY));
      if (r && typeof r === 'object') { if (!r.vis || typeof r.vis !== 'object') r.vis = {}; return r; }
    } catch (e) {}
    return { vis: {} };
  }
  function persistViews() { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch (e) {} }
  var views = loadViews();

  /* ---------- 字段显示/隐藏（按表持久化；主键不可隐藏） ---------- */
  function loadColVis() { try { return JSON.parse(localStorage.getItem(COLVIS_KEY)) || {}; } catch (e) { return {}; } }
  function saveColVis(v) { try { localStorage.setItem(COLVIS_KEY, JSON.stringify(v)); } catch (e) {} }
  /* 默认隐藏的字段（需求：涉及到「品番规则 / 客户品番」的先隐藏，需要时可在「显示字段」里勾出来） */
  var DEFAULT_HIDDEN = {
    MD_CUSTOMER: ['PART_NO_RULE'],
    MD_PRODUCT: ['CUSTOMER_PART_NO'],
    SD_SALES_ORDER_LINE: ['CUSTOMER_PART_NO'],
    SD_QUOTATION_LINE: ['CUSTOMER_PART_NO'],
    SD_DELIVERY_LINE: ['CUSTOMER_PART_NO'],
    MD_SUPPLIER_PERF: ['PART_NO'],
    RT_SOP: ['PART_NO'],
    QC_INSPECTION: ['PART_NO']
  };
  function defaultHidden(t, code) { return (DEFAULT_HIDDEN[t] || []).indexOf(code) >= 0; }
  function colOn(t, code) {
    var cv = loadColVis()[t];
    if (cv && (code in cv)) return cv[code] !== 0;  // 用户显式设置优先
    if (defaultHidden(t, code)) return false;       // 品番类字段默认隐藏
    return true;
  }
  function setColVis(t, code, on) {
    var cv = loadColVis();
    if (!cv[t]) cv[t] = {};
    if (on) delete cv[t][code]; else cv[t][code] = 0;
    if (Object.keys(cv[t]).length === 0) delete cv[t];
    saveColVis(cv);
  }
  function visibleColsOf(t) {
    return S.columnsOf(t).filter(function (c) { return colOn(t, c.code); });
  }

  /* ---------- 字段顺序自定义（上移 / 下移，按表持久化） ----------
   * 需求：备注统一后置到最末位（schema 已处理），其余字段顺序可由使用者自己调整。 */
  function loadOrder() { try { return JSON.parse(localStorage.getItem(COLORDER_KEY)) || {}; } catch (e) { return {}; } }
  function saveOrder(o) { try { localStorage.setItem(COLORDER_KEY, JSON.stringify(o)); } catch (e) {} }
  function applyOrder(t, cols) {
    var ord = loadOrder()[t];
    if (!ord || !ord.length) return cols;
    var idx = {};
    ord.forEach(function (code, i) { if (idx[code] === undefined) idx[code] = i; });
    return cols.slice().sort(function (a, b) {
      var ia = idx[a.code] === undefined ? 9999 : idx[a.code];
      var ib = idx[b.code] === undefined ? 9999 : idx[b.code];
      return ia - ib;
    });
  }
  /* 保存某表新顺序（以传入的列序为准，同时把未出现的列补到末尾） */
  function setOrder(t, orderedCodes) {
    var o = loadOrder();
    var exist = S.columnsOf(t).map(function (c) { return c.code; });
    var arr = orderedCodes.filter(function (c) { return exist.indexOf(c) >= 0; });
    exist.forEach(function (c) { if (arr.indexOf(c) < 0) arr.push(c); });
    o[t] = arr; saveOrder(o);
  }
  function moveField(t, code, dir) {
    var codes = S.columnsOf(t).map(function (c) { return c.code; });
    var i = codes.indexOf(code); if (i < 0) return;
    var j = i + dir; if (j < 0 || j >= codes.length) return;
    var tmp = codes[i]; codes[i] = codes[j]; codes[j] = tmp;
    setOrder(t, codes);
  }
  /* 把自定义顺序套用到全局 columnsOf：列表 / 表单 / 导出 / 详情统一生效 */
  (function wrapColumnsOf() {
    var orig = S.columnsOf;
    S.columnsOf = function (t) { return S.moveRemarkLast(applyOrder(t, orig.call(S, t))); };
  })();

  /* 建立「空表骨架」：启动首帧用它渲染，不等演示种子，避免「先出一屏演示数据、随即被清空」的抖动 */
  function initDbEmpty() {
    db = {};
    Object.keys(S.TABLES).forEach(function (t) { db[t] = []; });
  }
  /* force=true：无视已存在的 db 重新初始化（仅在后端不可用、回落到演示数据时用） */
  function ensureSeed(force) {
    if (!db || force === true) {
      /* 优先读取浏览器本地已保存的数据（用户的新增 / 修改会保留）；读不到才用演示种子初始化 */
      var stored = load();
      var ver = null;
      try { ver = localStorage.getItem(SEED_VER_KEY); } catch (e) { }
      /* 演示数据剧本升级（新增表 / 调整上下游）时，旧缓存自动失效重建，避免「看不到新表新明细」 */
      if (stored && ver !== SEED_VER) stored = null;
      var fresh = !stored;
      db = stored || clone(window.MES_SEED || {});
      Object.keys(S.TABLES).forEach(function (t) { if (!Array.isArray(db[t])) db[t] = []; });
      if (fresh) { save(); try { localStorage.setItem(SEED_VER_KEY, SEED_VER); } catch (e) { } }  // 仅在用种子初始化时写回，避免覆盖用户数据
    }
  }

  /* ---------- 工具 ---------- */
  function esc(s) { if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function now() { var d = new Date(); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); }
  function today() { var d=new Date(); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
  function ymd() { return today().replace(/-/g,''); }
  function uid(p) { return (p||'ID') + Date.now().toString(36) + Math.floor(Math.random()*900+100); }
  function toast(m) { var t=document.getElementById('toast'); t.textContent=m; t.style.display='block'; clearTimeout(toast._t); toast._t=setTimeout(function(){t.style.display='none';},2200); }
  /* 记录「本视图读了这张表」。渲染结束后 fillMissing() 只补拉缺的表。 */
  function touch(t) { if (COLLECT) COLLECT[t] = 1; }
  /* 交互期（表单下拉 / 弹窗 / 单据详情）读了未载入的表：登记进 NEED，由下一轮 fillMissing 补拉。
   * 渲染期只登记不调度，避免在 render() 内部递归重绘。
   * 这张网的用途是兜漏 —— 表单所需的引用主数据优先在 openForm/openDoc 入口整批拉齐，
   * 这里保证「就算某个角落漏登记，也不会永远空着」。 */
  var NEED = {};
  function want(t) {
    if (!LAZY || !t || LOADED[t] || LOAD_FAIL[t] || !BE.on(t) || isReportTable(t)) return;
    NEED[t] = 1;
  }
  /* 原始行（本表实际存储的数据）。未载入 → 返回空数组但已登记依赖，数据到了会自动重渲染。 */
  function rawRows(t) { touch(t); want(t); return (db[t]||[]).filter(function(r){return r.DEL_FLAG!==1;}); }
  /* 展示用行：生产报表组下的表不落地人工录入，改为按业务数据实时派生（见下方 buildReports） */
  function rows(t) {
    if (isReportTable(t)) {
      if (!RPT_CACHE) RPT_CACHE = buildReports();
      return RPT_CACHE[t] || [];
    }
    return rawRows(t);
  }
  /* 计数口径（侧栏 / 总览用）：优先取版本对账拿到的行数，**绝不为了显示一个数字去拉整表**。
   * 返回 -1 = 未知，界面显示「—」，不用 0 冒充。 */
  function knownCount(t) {
    if (isReportTable(t)) return RPT_CACHE ? (RPT_CACHE[t] || []).length : -1;
    if (VERS[t] && typeof VERS[t].c === 'number') return VERS[t].c;
    if (LOADED[t]) return (db[t]||[]).filter(function(r){return r.DEL_FLAG!==1;}).length;
    return -1;
  }
  function cntText(n) { return n < 0 ? '—' : String(n); }
  function find(t,id){ return (db[t]||[]).find(function(r){return r.ID===id;}); }
  function statusTag(v){ if(!v) return ''; var c='tag'; if(/合格|通过|已发布|运行|正常|已入库|已下达|完成|已确认|已点检|已签回/.test(v)) c+=' ok'; else if(/不合格|驳回|故障|异常|报废|停用|待检|已作废|隔离/.test(v)) c+=' bad'; else if(/待|在制|执行|中|草稿/.test(v)) c+=' warn'; return '<span class="'+c+'">'+esc(v)+'</span>'; }

  /* ---------- 数据操作 ---------- */
  /* 后端写请求队列（保存时拒绝 / 乐观锁用）：每次写全推到这里，弹窗保存统一 await。
   * 声明提前，避免首屏任何提前触发的写入拿到 undefined。 */
  var PENDING_WRITES = [];
  var WA_CONFLICT = 0, WA_FORCED = 0, WA_FORCE_FAIL = null;
  function insert(t, biz) {
    var def = S.TABLES[t]; var r = {};
    S.columnsOf(t).forEach(function (c) { if (c.sys && c.code!=='REMARK') r[c.code] = (c.code==='DEL_FLAG'?0:(c.code==='VER_NO'?1:null)); });
    r.ID = uid('ID'); r.ORG_ID='ORG1'; r.CREATE_BY=(CUR_USER||'anonymous'); r.CREATE_TIME=now(); r.UPDATE_BY=null; r.UPDATE_TIME=null; r.DEL_FLAG=0; r.VER_NO=1; r.REMOTE=null;
    var pk = def.pk;
    if (pk && pk!=='ID' && !biz[pk]) biz[pk] = t.split('_').pop()+'-'+ymd()+'-'+String(rows(t).length+1).padStart(3,'0');
    for (var k in biz) r[k]=biz[k];
    if (r.REMARK===undefined) r.REMARK='';
    /* 审核状态默认「待审核」（工作流预留字段） */
    if (r.AUDIT_STATUS === undefined || r.AUDIT_STATUS === '' || r.AUDIT_STATUS === null) r.AUDIT_STATUS = '待审核';
    /* 启用绑定：勾启用→默认填启用时间；停用→默认填失效时间 */
    if ('ENABLE_FLAG' in r) {
      if (r.ENABLE_FLAG && (r.ENABLE_FROM === undefined || r.ENABLE_FROM === '' || r.ENABLE_FROM === null)) r.ENABLE_FROM = today();
      if (!r.ENABLE_FLAG && (r.ENABLE_TO === undefined || r.ENABLE_TO === '' || r.ENABLE_TO === null)) r.ENABLE_TO = today();
    }
    db[t].push(r); save();
    /* 已接自有后端的表（BE 白名单 = 70 张）→ 走自身业务 API 真实写入 UNS。
     * 报表 9 张不在白名单内，本就只读派生，没有写入口。 */
    if (BE.on(t)) { PENDING_WRITES.push(BE.create(t, rowToBackend(t, r)).then(function () { srvRefresh(); }).catch(function (e) { beFail(e, t, r.ID); })); }
    return r;
  }
  function update(t,id,patch){
    var r=find(t,id);
    if(r){
      /* 只把「真正变了」的字段记下来：表单提交的是整行，但落 UNS 只需下发差量。
       * base = 改动前本地看到的值 → 随 __base 一起提交，后端拿它与库里当前值比对，
       * 不一致就整笔拒绝（保存时拒绝 / 乐观锁，见 server/main.js 的 sameValue()）。 */
      var changed = {}, base = {};
      for(var k in patch){ if(String(r[k]) !== String(patch[k])){ changed[k]=patch[k]; base[k]=(r[k]===undefined?null:r[k]); r[k]=patch[k]; } }
      r.UPDATE_TIME=now(); r.UPDATE_BY=(CUR_USER||'anonymous'); save();
      if (BE.on(t)) {
        var payload = rowToBackend(t, changed);
        var b = rowToBackend(t, base);
        if (Object.keys(b).length) payload.__base = b;
        PENDING_WRITES.push(BE.edit(t, backendKey(t, r), payload).then(function () { srvRefresh(); }).catch(function (e) {
          if (e && e.code === 'EDIT_CONFLICT') return resolveConflict(t, r, base, payload, e);
          beFail(e);
        }));
      }
    }
    return r;
  }
  function remove(t,id){
    var r=find(t,id);
    if(r){
      r.DEL_FLAG=1; r.UPDATE_TIME=now(); save();
      /* BE 通道 = **软删除**（2026-10-29）：后端把 del_flag 置 true 并记删除人/时间，
       * 行留在库里，可在「表功能 ▾ → 回收站」恢复；本地先置 DEL_FLAG=1 即时隐藏。 */
      if (BE.on(t)) { PENDING_WRITES.push(BE.del(t, backendKey(t, r)).then(function () { srvRefresh(); }).catch(function (e) { beFail(e); })); }
    }
  }
  /* 按外键向后端**定向拉全**子表行（分页 200，精确匹配 e=）。
   * 为什么必须拉全：本地缓存每表只有 200 行（首屏封顶），明细累计超过 200 行时，
   * 靠本地 rows(子表) 找子行会漏 —— 结果是父单删了、子行还在库里（孤儿明细）。
   * 返回 null 表示「没有后端」，调用方退回本地缓存（纯静态演示形态）。 */
  function fetchByFk(t, fkCol, val, cap) {
    if (!BE.on(t) || !BE.available()) return Promise.resolve(null);
    var out = [], offset = 0, limit = 200, max = cap || 4000;
    function step() {
      return BE.page(t, { limit: limit, offset: offset, e: fkCol + ':' + encodeURIComponent(val) })
        .then(function (res) {
          var got = res.rows || [];
          out = out.concat(got);
          if (got.length === limit && out.length < max) { offset += limit; return step(); }
          return out;
        });
    }
    return step().catch(function () { return null; });
  }
  /* 删主表记录时级联删除其下子表明细（软删，进回收站）。
   * 2026-10-29 修正：子行改为「按外键向后端定向拉全」再逐条删，不再只看本地 200 行缓存。 */
  function removeWithChildren(t, id) {
    var rec = find(t, id);
    if (!rec) return Promise.resolve(0);
    var kids = S.MASTER_DETAIL[t] || [];
    var jobs = kids.map(function (d) {
      var fkCol = backendCol(d.fk);
      return fetchByFk(d.table, fkCol, rec[d.fk]).then(function (far) {
        if (far === null) {          // 无后端 → 退回本地缓存（演示形态，行为与改造前一致）
          rows(d.table).filter(function (r) { return String(r[d.fk]) === String(rec[d.fk]); })
            .forEach(function (r) { remove(d.table, r.ID); });
          return 0;
        }
        var n = 0;
        far.forEach(function (u) {
          var mes = rowFromBackend(d.table, u);
          /* 双保险：后端用精确匹配取行，这里再按父单外键值校一遍，绝不错删别人的明细 */
          if (String(mes[d.fk]) !== String(rec[d.fk])) return;
          var key = backendKey(d.table, mes);
          if (!key) return;
          var local = find(d.table, mes.ID);
          if (local) { local.DEL_FLAG = 1; local.UPDATE_TIME = now(); }
          PENDING_WRITES.push(BE.del(d.table, key).catch(function (e) { beFail(e); }));
          n++;
        });
        if (n) save();
        return n;
      });
    });
    return Promise.all(jobs).then(function (ns) {
      remove(t, id);
      return ns.reduce(function (a, b) { return a + b; }, 0);
    });
  }
  /* 工具栏「删除」：删除左侧已勾选的多条；主表连带其子表明细一起删（软删，可恢复） */
  function doBatchDelete() {
    var selSet = (st.sel && st.sel[st.table]) || {};
    var ids = Object.keys(selSet);
    if (!ids.length) { toast('请先勾选要删除的记录（左侧复选框）'); return; }
    var isMaster = (S.MASTER_DETAIL[st.table] || []).length > 0;
    var msg = '确认删除已选的 ' + ids.length + ' 条记录？\n\n删除后进入「回收站」，可在「表功能 ▾ → 回收站」恢复。';
    if (isMaster) msg += '\n所选记录含有子表明细：其下子表明细会一并删除（同样可恢复）。';
    if (!confirm(msg)) return;
    var ps = ids.map(function (id) { return removeWithChildren(st.table, id); });
    st.sel[st.table] = {};
    render();
    Promise.all(ps).then(function () { srvRefresh(); });
    toast('已移入回收站：' + ids.length + ' 条（表功能 ▾ → 回收站 可恢复）');
  }

  /* ---------- 回收站（软删除的行） ----------
   * 后端删除已改为 del_flag=true（行留在库里），这里列出「已删」的行并提供恢复 / 彻底删除。
   * 删除人 / 删除时间取自 update_by / update_time —— 软删时由后端写入，所以不需要给 79 张表加列。 */
  function openTrash(t) {
    if (isReportTable(t)) { toast('生产报表是实时派生的只读视图，没有回收站'); return; }
    if (!BE.on(t) || !BE.available()) { toast('回收站需要后端支持（当前是离线演示模式）'); return; }
    var def = S.TABLES[t] || {};
    var pkCol = def.pk || 'ID';
    document.getElementById('modal').classList.add('wide');
    document.getElementById('modalTitle').textContent = (def.label || t) + ' · 回收站';
    document.getElementById('modalBody').innerHTML =
      '<div class="toolbar" style="margin-bottom:6px">' +
      '<span class="tag warn">已删除</span>' +
      '<span class="mini">删除后的记录留在这里，可恢复；彻底删除不可恢复。</span>' +
      '<span class="spacer"></span><button class="ghost sm" id="trashReload">刷新</button></div>' +
      '<div id="trashBox" class="mini">读取中…</div>';
    document.getElementById('modalSave').style.display = 'none';
    /* 铁律：写 modalCancel.textContent 的同一句必须重绑 onclick，否则沿用上一次弹窗的处理器 */
    var mc = document.getElementById('modalCancel');
    mc.textContent = '关 闭';
    mc.onclick = closeModal;
    document.getElementById('modalMask').style.display = 'flex';

    function load() {
      var box = document.getElementById('trashBox');
      if (!box) return;
      box.textContent = '读取中…';
      BE.trash(t, { limit: 100 }).then(function (res) {
        if (!res.rows.length) { box.innerHTML = '<div class="empty">回收站是空的（当前没有已删除的记录）。</div>'; return; }
        var h = '<div class="tbl-wrap"><table class="grid"><thead><tr>' +
          '<th>' + esc(pkCol) + '</th><th>删除人</th><th>删除时间</th><th>操作</th></tr></thead><tbody>';
        res.rows.forEach(function (u) {
          var mes = rowFromBackend(t, u);
          var key = backendKey(t, mes);
          h += '<tr><td>' + esc(String(mes[pkCol] == null ? '' : mes[pkCol])) + '</td>' +
            '<td>' + esc(String(u.update_by || '—')) + '</td>' +
            '<td>' + esc(String(u.update_time || '').slice(0, 19).replace('T', ' ')) + '</td>' +
            '<td><button class="ghost sm" data-restore="' + esc(key) + '">恢复</button> ' +
            '<button class="danger sm" data-purge="' + esc(key) + '">彻底删除</button></td></tr>';
        });
        h += '</tbody></table></div>' +
          '<p class="mini" style="margin-top:8px">共 ' + res.total + ' 条（最多列出最近 100 条）。</p>';
        box.innerHTML = h;
        box.querySelectorAll('[data-restore]').forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-restore');
            b.disabled = true;
            BE.restore(t, k).then(function () {
              toast('已恢复「' + k + '」');
              srvRefresh(); load();
            }).catch(function (e) { b.disabled = false; beFail(e); });
          };
        });
        box.querySelectorAll('[data-purge]').forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-purge');
            if (!confirm('彻底删除后不可恢复，确认删除「' + k + '」？')) return;
            b.disabled = true;
            BE.purge(t, k).then(function () { toast('已彻底删除「' + k + '」'); load(); })
              .catch(function (e) { b.disabled = false; beFail(e); });
          };
        });
      }).catch(function (e) {
        box.innerHTML = '<div class="empty">读取失败：' + esc(String((e && e.message) || e)) + '</div>';
      });
    }
    var rb = document.getElementById('trashReload');
    if (rb) rb.onclick = load;
    load();
  }

  /* ---------- 后端读写辅助（backend-uns） ---------- */
  /* MES 行 → 后端期望的 UNS 字段对象（键名小写下划线 = UNS 列名；空值转 null） */
  /* 列名映射（2026-10-20）：schema 里叫 STATUS 的列，UNS 实际列名是 **biz_status**（30 张表）。
   * 不映射的后果：读回来 `out.STATUS` 永远空（列表/表单状态列空白、必填校验卡住）、
   * 写下去 `status` 不在后端白名单被丢弃（"状态改了不生效"）。 */
  function backendCol(code) {
    var k = String(code).toLowerCase();
    return k === 'status' ? 'biz_status' : k;
  }
  function rowToBackend(t, r) {
    var out = {};
    S.columnsOf(t).forEach(function (c) {
      if (c.sys && c.code !== 'REMARK') return;
      if (!(c.code in r)) return;
      var v = r[c.code];
      if (v === undefined || v === '') v = null;
      out[backendCol(c.code)] = v;
    });
    return out;
  }
  /* 后端按业务键定位：单键取该列值；复合键按 keys 顺序用 '|' 连接（后端同口径解析）。
   * ⚠️ BE.TABLES.keys 存的是 UNS **小写**列名，而 MES 行的键是**大写**列名，故按大写取；
   *    取不到再回落原样（兼容 key 本身即大写/近似的情形）。此前按小写索引 → 取不到 →
   *    空键 → URL 变成 api/<表>/ → 后端 filter(Boolean) 滤掉空段 → 405「不支持的方法：DELETE/PUT」。 */
  function backendKey(t, r) {
    return BE.keysOf(t).map(function (k) {
      var v = r[String(k).toUpperCase()];
      if (v === null || v === undefined) v = r[k];
      return (v === null || v === undefined) ? '' : String(v);
    }).join('|');
  }
  /* 后端返回的 UNS 行（小写下划线键）→ MES 行（大写列名），列名映射统一走 backendCol()。 */
  function rowFromBackend(t, u) {
    var out = {};
    var def = S.TABLES[t] || {};
    S.columnsOf(t).forEach(function (c) {
      var k = backendCol(c.code);
      var v = u[k];
      if (v === undefined) return;
      if (c.type === 'b') v = (v === true || v === 1 || v === '1' || v === 'true' || v === 't') ? 1 : 0;
      out[c.code] = v;
    });
    /* 2026-10-19 修正：原来只取 def.pk 一列拼 ID，复合主键表（如工序报工 WO_NO|STEP_NO）
     * 会把同一张工单的 9 道工序算成同一个 ID ⇒ 列表里互相覆盖（首屏第一行被最后一行顶掉）、
     * 点编辑打开错行、勾选删除删错行。改用后端同款复合键 backendKey()。 */
    if (!out.ID) out.ID = 'B' + backendKey(t, out);
    if (!out.ORG_ID) out.ORG_ID = 'ORG1';
    if (out.DEL_FLAG === undefined) out.DEL_FLAG = 0;
    if (out.REMARK === undefined) out.REMARK = '';
    return out;
  }
  /* 后端写失败：如实提示、不假成功；新增失败要把本地「幽灵行」撤掉 */
  var beWarned = false;
  /* 已确认被后端拒绝的行（表:ID → true）：流转生成据此判断主单是否真的落库 */
  var FAILED_WRITES = {};
  /* 把后端返回的英文字段名换成界面上的中文标签（缺少必填字段：order_type → 订单类型） */
  function beMsgCn(t, m) {
    var s = String(m);
    if (t && /^缺少必填字段：/.test(s)) {
      s = s.replace(/^缺少必填字段：(.+)$/, function (all, list) {
        return '缺少必填字段：' + list.split(/,\s*/).map(function (f) { return fieldLabel(t, f); }).join('、');
      });
    }
    return s;
  }
  /* 新增请求被后端拒绝时，本地已 push 的那一行必须撤掉：
   * 否则页面照常渲染、还弹「已生成」，刷新才消失（历史缺陷：流转生成失败后留幽灵单）。 */
  function dropGhostLocal(t, id) {
    var r = (t && id) ? find(t, id) : null;
    if (!r || r.DEL_FLAG === 1) return;
    r.DEL_FLAG = 1; save();
    if (st.doc && st.doc.t === t && st.doc.id === id) { try { closeModal(); } catch (e1) {} }
    try { render(); } catch (e2) {}
  }
  function beFail(e, t, id) {
    var m = String((e && e.message) || e);
    /* 用户自己能纠正的错误（重号 / 缺必填 / 400）必须每次都提示，
     * 不能被下面的 beWarned 全局抑制吃掉（否则第二次起连提示都没有）。 */
    var userFix = !!(e && (e.code === 'DUP_KEY' || e.code === 'VALIDATION' || e.http === 400));
    var text = beMsgCn(t, m);
    if (userFix || !beWarned) {
      beWarned = true;
      toast('⚠ ' + (userFix ? text : '后端写入失败：' + text).slice(0, 120));
    }
    try { console.warn('[MES-BE] 写入失败：' + m + (e && e.platform ? '（平台：' + e.platform + '）' : '')); } catch (_) {}
    /* 只在「后端确实可用、这笔被它明确拒绝」时撤本地行。
     * 后端整体不可用（404 / 断网）属于离线演示模式，本地记录必须保留——那是应用的兜底形态。 */
    if (t && id && BE.available()) { FAILED_WRITES[t + ':' + id] = true; dropGhostLocal(t, id); }
  }

  /* ---------- 保存时拒绝（乐观锁）：别人先改过同一字段就不写 ----------
   * 队列 PENDING_WRITES 已在「数据操作」区声明；弹窗保存时统一 await，
   * 这样「已保存」的提示只在后端真的确认后才出现（此前是 fire-and-forget，
   * 后端 409/502 时页面照样弹「已保存」，用户完全无感）。 */
  /* 后端列名（小写）→ 中文标签，用于冲突提示 */
  function fieldLabel(t, f) {
    var cols = S.columnsOf(t) || [];
    for (var i = 0; i < cols.length; i++) {
      if (String(cols[i].code).toLowerCase() === String(f).toLowerCase()) return cols[i].label || cols[i].code;
    }
    return f;
  }
  function conflictText(t, e) {
    var cs = e.conflicts || [];
    var lines = cs.map(function (c) {
      return '· ' + fieldLabel(t, c.field) + '：你看到的是「' + (c.base === null ? '（空）' : c.base) + '」，现在已是「' + (c.current === null ? '（空）' : c.current) + '」';
    });
    var who = e.modifiedBy ? ('（最后由 ' + e.modifiedBy + (e.modifiedAt ? '，' + String(e.modifiedAt).slice(0, 19).replace('T', ' ') : '') + ' 修改）') : '';
    return { lines: lines, who: who };
  }
  /* 冲突处置：强制覆盖 / 放弃并显示最新值。返回 promise，供弹窗保存统一等待。 */
  function resolveConflict(t, r, base, payload, e) {
    WA_CONFLICT++;
    var info = conflictText(t, e);
    var msg = '保存被拒：这条记录已经被别人改过' + info.who + '\n\n' + info.lines.join('\n') +
      '\n\n点「确定」= 用你刚才填写的内容覆盖（强制保存）\n点「取消」= 放弃这次修改，显示库里的最新值';
    var force = false;
    try { force = window.confirm(msg); } catch (_) { force = false; }
    if (force) {
      var p2 = Object.assign({}, payload, { __force: true });
      /* 覆盖失败不能走 beFail：beFail 有 beWarned 全局抑制（只提示第一次），
       * 而且它随后会被弹窗的「已保存/未写入」提示盖掉 —— 用户会看到"点了确定却没反应、也没原因"。
       * 这里把真实原因留给 modalSave 统一报出来。 */
      return BE.edit(t, backendKey(t, r), p2).then(function () {
        WA_FORCED++; toast('已按你的选择覆盖保存'); srvRefresh();
      }).catch(function (err) {
        WA_FORCE_FAIL = err;
        try { console.warn('[MES-BE] 覆盖失败：' + String((err && err.message) || err) + (err && err.http ? '（HTTP ' + err.http + '）' : '')); } catch (_) {}
      });
    }
    /* 放弃：本地改动回滚到打开时的值（库里已被别人改成新值，随后 srvRefresh 会拉回来） */
    Object.keys(base).forEach(function (k) { r[k] = base[k]; });
    save(); srvRefresh(); render();
    toast('已放弃本次修改，显示最新值');
  }

  /* ================= 分页（2026-10-19） =================
   * 两种口径：
   *   · BE 绑定表（70 张，自有后端）→ 服务端分页：每次只取当前页（limit/offset），
   *     并由后端 count(*) 给总数。这样 8102 行报工也能翻到最后（此前每表最多载入 200 行）。
   *   · 报表 / 派生表（不在 BE 白名单）→ 前端分页：对派生结果切片。
   * SRV 是「当前页」缓存，key = 表|搜索词|每页条数|页码；key 变了才重新取数。
   * 取回的行会按 ID 合并进 db[t]，保证翻到的行也能被「编辑 / 删除 / 勾选」定位（find 只查 db）。 */
  var SRV = { key: '', pending: '', rows: [], total: 0, loading: false, err: '' };
  var PG = { total: 0, size: 20 };          // 供 bindView 里的翻页按钮算边界
  function srvInvalidate() { SRV.key = ''; }
  function pageCount(total, size) { return Math.max(1, Math.ceil((Number(total) || 0) / (Number(size) || 1))); }
  function mergeIntoDb(t, rows) {
    db[t] = db[t] || [];
    var idx = {};
    db[t].forEach(function (r, i) { idx[r.ID] = i; });
    rows.forEach(function (r) {
      if (idx[r.ID] !== undefined) Object.assign(db[t][idx[r.ID]], r);
      else { idx[r.ID] = db[t].length; db[t].push(r); }
    });
  }
  /* 查询词 → 后端参数：s=可搜索列（与界面列同口径）, f=字段级 col:value, g=全局词 */
  function searchParams(t, q) {
    var colMap = displayCols(t);
    function resolveCol(name) {
      name = String(name).toLowerCase();
      return colMap.find(function (c) {
        var l = c.label.toLowerCase(), k = c.code.toLowerCase();
        return l === name || k === name || l.indexOf(name) >= 0 || k.indexOf(name) >= 0;
      });
    }
    var fs = [], gs = [];
    String(q || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (seg) {
      var i = seg.indexOf(':');
      if (i > 0) {
        var col = resolveCol(seg.slice(0, i)), val = seg.slice(i + 1).trim();
        if (col && val) { fs.push(backendCol(col.code) + ':' + encodeURIComponent(val)); return; }
      }
      gs.push(encodeURIComponent(seg));
    });
    return { s: colMap.map(function (c) { return backendCol(c.code); }).join(','), f: fs.join(';'), g: gs.join(';') };
  }
  function srvFetch(t, q, size, page) {
    var key = t + '|' + q + '|' + size + '|' + page;
    if (SRV.pending === key) return;
    SRV.pending = key; SRV.loading = true;
    var p = searchParams(t, q);
    BE.page(t, { limit: size, offset: (page - 1) * size, s: p.s, f: p.f, g: p.g }).then(function (j) {
      var list = j.rows.map(function (u) { return rowFromBackend(t, u); });
      mergeIntoDb(t, list);
      SRV.key = key; SRV.pending = ''; SRV.rows = list; SRV.total = j.total; SRV.loading = false; SRV.err = '';
      render();
    }).catch(function (e) {
      SRV.key = key; SRV.pending = ''; SRV.rows = []; SRV.total = 0; SRV.loading = false;
      SRV.err = String((e && e.message) || e);
      render();
    });
  }
  /* 写操作成功后：作废该表版本 + 清分页缓存 + 重新取当前页（批量删除时 120ms 合并成一次刷新） */
  var _srvT = null;
  function srvRefresh() {
    markStale(st.table);            // 版本作废：下次对账必然重拉，不会拿旧快照当新数据
    srvInvalidate();
    if (_srvT) clearTimeout(_srvT);
    _srvT = setTimeout(function () { _srvT = null; render(); }, 120);
  }
  /* 导出 / 打印用：服务端分页时给「当前页」，否则给「当前页切片」（而不是整表已载入行） */
  function currentPageRows(t) {
    var size = st.pageSize || 20, page = st.page || 1;
    if (!isReportTable(t) && BE.on(t) && BE.available() && SRV.key.indexOf(t + '|') === 0) return SRV.rows;
    var list = applyQuery(rows(t), t, (st.search || '').trim());
    return list.slice((page - 1) * size, page * size);
  }
  /* 分页条：条数提示 + 每页条数选择 + 上一页/页码/下一页 + 跳页 */
  function pagerHtml(total, page, size) {
    var pages = pageCount(total, size);
    if (page > pages) page = pages;
    var opts = [10, 20, 50, 100, 200].map(function (n) {
      return '<option value="' + n + '"' + (n === size ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    var nums = [], prev = 0;
    for (var i = 1; i <= pages; i++) {
      if (i !== 1 && i !== pages && Math.abs(i - page) > 2) continue;
      if (prev && i - prev > 1) nums.push('<span class="pg-dot">…</span>');
      nums.push(i === page
        ? '<span class="pg-num active">' + i + '</span>'
        : '<button class="pg-num" data-pgnum="' + i + '">' + i + '</button>');
      prev = i;
    }
    return '<div class="pager">' +
      '<span class="mini">共 ' + total + ' 条 · 第 ' + page + ' / ' + pages + ' 页</span>' +
      '<span class="spacer"></span>' +
      '<label class="mini">每页 <select id="pgSize" class="pg-size">' + opts + '</select> 条</label>' +
      '<button class="ghost sm pg-step" data-pgprev="1"' + (page <= 1 ? ' disabled' : '') + '>‹ 上一页</button>' +
      '<span class="pg-nums">' + nums.join('') + '</span>' +
      '<button class="ghost sm pg-step" data-pgnext="1"' + (page >= pages ? ' disabled' : '') + '>下一页 ›</button>' +
      '<label class="mini">跳至 <input id="pgJump" class="pg-jump" type="number" min="1" max="' + pages + '" value="' + page + '"> 页</label>' +
      '</div>';
  }

  /* ---------- 列选择（应用字段显隐配置） ---------- */
  function displayCols(t) {
    var cols = S.columnsOf(t);
    var pk = S.TABLES[t].pk;
    var biz = cols.filter(function (c) { return !(c.sys && c.code!=='REMARK'); });
    var head = [];
    if (pk && pk!=='ID') head.push(cols.find(function (c){return c.code===pk;}));
    if (biz.some(function (c){return c.code==='DOC_NO';})) head.push(cols.find(function (c){return c.code==='DOC_NO';}));
    biz.forEach(function (c){ if (head.indexOf(c)<0) head.push(c); });
    return head.filter(function (c) { return c && colOn(t, c.code); }).slice(0, isReportTable(t) ? 14 : 9);
  }
  function displayColsExcept(t, ex) {
    return displayCols(t).filter(function (c) { return c.code !== ex; });
  }
  function cellValue(r, c) {
    var v = r[c.code];
    if (c.code==='AUDIT_STATUS') { if (!v) return '<span class="tag warn">待审核</span>'; if (/已通过|已审核|通过/.test(v)) return '<span class="tag ok">'+esc(v)+'</span>'; if (/驳回/.test(v)) return '<span class="tag bad">'+esc(v)+'</span>'; return '<span class="tag warn">'+esc(v)+'</span>'; }
    if (c.code==='STATUS'||c.code==='QC_RESULT'||c.code==='WIP_STATUS'||c.code==='EQUIP_STATUS') return statusTag(v);
    if (c.type==='b') return (v? '<span class="tag ok">是</span>' : '<span class="tag">否</span>');
    /* 日期/时间列按用户口径显示：日期只要 YYYY-MM-DD，时间精确到秒（库里可能带 +00 后缀） */
    if (c.type==='da') return esc(v === null || v === undefined ? '' : String(v).slice(0, 10));
    if (c.type==='dt') return esc(fmtDT(v));
    if (c.type==='x'||c.type==='j') return esc((v? String(v) : '').slice(0, 28));
    if (c.code==='REMARK') return esc((v||'').slice(0, 22));
    return esc(v);
  }

  /* 工步号排序：兼容 S10 / 10 两种写法（取其中数字比较） */
  function stepIdx(s) { var m = /(\d+)/.exec(String(s == null ? '' : s)); return m ? +m[1] : 0; }
  /* 引用字段下拉：从被引用主数据表取可选项（新增/编辑时只能选已存在的主数据） */
  function refNameCol(refTable) {
    var cols = S.columnsOf(refTable);
    var nc = cols.find(function (c) { return /NAME|DESC|SHORT|NICK/.test(c.code); });
    return nc ? nc.code : (cols[0] ? cols[0].code : 'ID');
  }
  /* 布尔标志：字段不存在视为通过；1/true/'1'/'Y' 为真 */
  function flagOn(r, k) { if (!(k in r)) return true; var v = r[k]; return v === 1 || v === true || v === '1' || v === 'Y'; }
  /* 设备「当前不可用」集合：EQ_RUNTIME_STATUS 未归档段（STATE_TO 为空）里状态为 故障/停机 的设备 */
  function equipUnavailable() {
    var bad = {};
    rows('EQ_RUNTIME_STATUS').forEach(function (r) {
      if (r.STATE_TO) return;
      var s = String(r.RUN_STATE || '');
      if (s === '故障' || s === '停机') bad[String(r.EQUIP_NO)] = s;
    });
    return bad;
  }
  /* 候选行准入：列级 filter（equipAvailable / none）+ 主数据启用标志 */
  function refRowOk(refTable, col, r, bad) {
    if (col && col.filter === 'none') return true;
    if (col && col.filter === 'equipAvailable' && bad) {
      var pkv = r.EQUIP_NO != null ? r.EQUIP_NO : r[(S.TABLES[refTable] || {}).pk];
      if (bad[String(pkv)]) return false;
    }
    if ('ENABLE_FLAG' in r && !flagOn(r, 'ENABLE_FLAG')) return false;     // 停用主数据不进候选
    if ('QUALIFIED_FLAG' in r && !flagOn(r, 'QUALIFIED_FLAG')) return false; // 非合格供方不进候选
    return true;
  }
  /* 联动取值：优先取被引用表同名字段，取不到则回落该表的名称列 */
  function deriveValue(refRow, code, refTable) {
    if (!refRow) return '';
    if (refRow[code] != null && refRow[code] !== '') return refRow[code];
    if (refTable) { var nc = refNameCol(refTable); if (nc && refRow[nc] != null) return refRow[nc]; }
    return '';
  }
  /* 字典类下拉：数据源 = SYS_DICT，按 DICT_TYPE 过滤，值取 ITEM_CODE（与字典项口径一致） */
  function dictTypeRows(type) { return rows('SYS_DICT').filter(function (r) { return String(r.DICT_TYPE) === String(type); }); }
  function dictOptions(type, selected) {
    var all = dictTypeRows(type);
    var opts = '<option value="">— 选择' + esc(type || '') + ' —</option>';
    var keep = all.filter(function (r) { return flagOn(r, 'ENABLE_FLAG'); });   // 停用字典项不进候选
    var sel = (selected == null || selected === '') ? '' : String(selected);
    /* 已有值即使是已停用的字典项也保留，避免编辑旧单被清空 */
    if (sel && !keep.some(function (r) { return String(r.ITEM_CODE) === sel; })) {
      var hit = all.filter(function (r) { return String(r.ITEM_CODE) === sel; })[0];
      if (hit) keep = keep.concat([hit]);
    }
    keep.forEach(function (r) {
      var code = r.ITEM_CODE; if (code === undefined || code === null || code === '') return;
      var nm = (r.ITEM_NAME != null && r.ITEM_NAME !== '' && String(r.ITEM_NAME) !== String(code)) ? String(r.ITEM_NAME) : '';
      opts += '<option value="' + esc(code) + '"' + (sel === String(code) ? ' selected' : '') + '>' + esc(code) + (nm ? ' · ' + esc(nm) : '') + '</option>';
    });
    return opts;
  }
  function dictExists(type, val) { if (val === '' || val == null) return false; return dictTypeRows(type).some(function (r) { return String(r.ITEM_CODE) === String(val); }); }
  function refOptions(refTable, selected, col) {
    if (col && col.dict) return dictOptions(col.dict, selected);
    var def = S.TABLES[refTable]; if (!def) return '<option value="">（主数据缺失）</option>';
    var pk = def.pk || 'ID'; var nc = refNameCol(refTable);
    var opts = '<option value="">— 选择' + esc(def.label) + ' —</option>';
    var bad = (col && col.filter === 'equipAvailable') ? equipUnavailable() : null;
    var all = rows(refTable);
    var keep = all.filter(function (r) { return refRowOk(refTable, col, r, bad); });
    /* 已有值即使被过滤掉（如设备已转故障 / 主数据停用）也保留在选项里，避免编辑旧单被清空 */
    var sel = (selected == null || selected === '') ? '' : String(selected);
    if (sel && !keep.some(function (r) { return String(r[pk]) === sel; })) {
      var hit = all.filter(function (r) { return String(r[pk]) === sel; })[0];
      if (hit) keep = keep.concat([hit]);
    }
    keep.forEach(function (r) {
      var val = r[pk]; if (val === undefined || val === null) return;
      var label = (r[nc] != null && r[nc] !== '' ? ' · ' + r[nc] : '');
      opts += '<option value="' + esc(val) + '"' + (sel === String(val) ? ' selected' : '') + '>' + esc(val) + esc(label) + '</option>';
    });
    return opts;
  }

  /* ---------- 条码 / 二维码（物料资料 · 工序工单） ---------- */
  function barcodeColOf(t) { return (S.TABLES[t] && S.TABLES[t].barcode) || ''; }
  function qrSvg(text) {
    text = String(text == null ? '' : text).trim();
    if (!text || typeof window.qrcode !== 'function') return '';
    try {
      var qr = window.qrcode(0, 'M');
      if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs['UTF-8']) {
        qr.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
      }
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    } catch (e) { return ''; }
  }
  /* 条码/二维码可视化块（用于表单预览与单据详情） */
  function bcVisual(t, codeVal, qrVal) {
    var bf = barcodeColOf(t);
    var label = bf ? ((S.columnsOf(t).find(function (c) { return c.code === bf; }) || {}).label || '条码') : '条码';
    var qrText = qrVal || codeVal || '';
    return '<div class="bc-row">' +
      '<div class="bc-code"><span class="mini">' + esc(label) + '</span><b>' + esc(codeVal || '—') + '</b></div>' +
      '<div class="bc-qr">' + (qrSvg(qrText) || '<div class="mini">（二维码内容为空）</div>') + '</div>' +
      '<div class="bc-txt"><span class="mini">二维码内容</span><div class="bc-qrtext">' + esc(String(qrText || '—')) + '</div></div>' +
      '</div>';
  }
  /* 单据详情里的条码/二维码面板：含「查看追溯报表 / 打印标签」 */
  function barcodePanel(t, row) {
    var bf = barcodeColOf(t);
    if (!bf) return '';
    var codeVal = row[bf] || row[S.TABLES[t].pk] || '';
    var trace = t === 'MD_MATERIAL' ? { label: '追溯报表-物料', table: 'RPT_TRACE_MATERIAL', q: 'ITEM_NO:' + row.ITEM_NO }
      : (t === 'EX_WORK_ORDER' ? { label: '追溯报表-报工', table: 'RPT_TRACE_WORK', q: 'WO_NO:' + row.WO_NO } : null);
    var h = '<div class="detail-panel bc-panel"><div class="dp-head"><span class="dp-title">条码 / 二维码 · 扫码追溯</span>' +
      '<span class="mini">扫码即可定位该' + esc(S.TABLES[t].label) + '，并沿追溯报表查看上下游</span>' +
      '<span class="spacer"></span>' +
      (trace ? '<button class="primary sm" data-trace="' + trace.table + '|' + encodeURIComponent(trace.q) + '">查看' + esc(trace.label) + ' →</button>' : '') +
      '<button class="ghost sm" data-printqr="' + esc(t) + '|' + esc(row.ID) + '">打印标签</button></div>';
    h += bcVisual(t, codeVal, row.QR_CODE);
    h += '</div>';
    return h;
  }
  /* 条码弹窗（用于无单据详情的主数据表，如物料资料） */
  function openBarcode(t, id) {
    var row = find(t, id); if (!row) return;
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '条码 / 二维码 · ' + S.TABLES[t].label;
    document.getElementById('modalBody').innerHTML = barcodePanel(t, row);
    document.getElementById('modalSave').style.display = 'none';
    var bcCancel = document.getElementById('modalCancel');
    bcCancel.textContent = '关 闭';
    bcCancel.onclick = closeModal;
    document.getElementById('modalMask').style.display = 'flex';
  }
  /* 打印条码标签（新窗口：二维码 + 编号 + 名称） */
  function printLabel(t, id) {
    var row = find(t, id); if (!row) return;
    var bf = barcodeColOf(t);
    var codeVal = row[bf] || row[S.TABLES[t].pk] || '';
    var nameCol = S.columnsOf(t).find(function (c) { return /_NAME$/.test(c.code); });
    var h = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>条码标签</title><style>' +
      'body{font-family:"Microsoft YaHei",sans-serif;padding:16px}' +
      '.lb{width:260px;border:1px dashed #999;border-radius:8px;padding:12px;text-align:center}' +
      '.lb .nm{font-size:13px;font-weight:700;margin-bottom:4px}' +
      '.lb svg{width:150px;height:150px}' +
      '.lb .cd{font-size:12px;font-family:Consolas,monospace;word-break:break-all;margin-top:6px}' +
      '</style></head><body><div class="lb">' +
      '<div class="nm">' + esc(S.TABLES[t].label) + (nameCol ? ' · ' + esc(row[nameCol.code] || '') : '') + '</div>' +
      (qrSvg(row.QR_CODE || codeVal) || '') +
      '<div class="cd">' + esc(codeVal) + '</div>' +
      '<div class="cd" style="color:#666">' + esc(row.QR_CODE || '') + '</div></div>' +
      '<p><button onclick="window.print()" style="padding:6px 18px;margin-top:10px">打 印</button></p></body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('浏览器拦截了打印窗口，请允许弹窗后重试'); return; }
    w.document.open(); w.document.write(h); w.document.close();
  }

  /* ---------- 侧边树形导航（扁平：功能域 → 表单，无业务域层/小圆点） ----------
   * 仅「本地直连」形态渲染；门户形态下不构建任何 DOM（全局导航由门户菜单承载）。 */
  function renderSidebar() {
    if (IN_PORTAL) return;                           // 门户形态：菜单交给门户，应用内不出侧栏
    ensureAllCounts();                               // 侧栏要显示每张表的条数，本地形态才全量对账
    if (!document.getElementById('sidebar')) return; // 本地形态：容器缺失时安全退出
    // NAV_SUB：纯导航归组（与主子表数据关系无关），如「物料分类树」挂在「物料资料」下
    var subSet = {};
    Object.keys(S.NAV_SUB || {}).forEach(function (p) { (S.NAV_SUB[p] || []).forEach(function (c) { subSet[c] = true; }); });
    Object.keys(S.MASTER_DETAIL).forEach(function (m) { S.MASTER_DETAIL[m].forEach(function (d) { subSet[d.table] = true; }); });
    var h = '';
    S.GROUPS.forEach(function (g) {
      var gOpen = st.open.g[g.name] === undefined ? (g.name === '工厂建模' || groupViews(g).length > 0) : (st.open.g[g.name] === true); // 工厂建模 / 视图型分组默认展开
      h += '<div class="tree-group">';
      h += '<div class="group-head' + (gOpen ? '' : ' collapsed') + '" data-group="' + esc(g.name) + '">' +
        '<span class="chev">▾</span><span>' + esc(g.name) + '</span>' +
        '<span class="cnt">' + (g.tables.filter(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; }).length + groupViews(g).length) + '</span></div>';
      if (gOpen) {
        h += '<div class="tbl-list">';
        /* 视图型分组：挂若干「直接进入某视图」的入口（生产看板 → 现场驾驶舱 / WIP 看板 / OEE） */
        groupViews(g).forEach(function (gv) {
          var vn = navOf(gv);
          h += '<div class="tbl-item view-entry' + (st.view === gv ? ' active' : '') + '" data-view="' + esc(gv) + '">' +
            '<span class="tdot vdot"></span><span>' + esc(vn ? vn.label : gv) + '</span>' +
            '<span class="cnt">视图</span></div>';
        });
        g.tables.forEach(function (t) {
          if (!S.TABLES[t] || S.TABLES[t].detail) return; // 子表(detail)不平铺
          if (subSet[t]) return; // 归到父表下的子项不再平铺
          var kids = S.MASTER_DETAIL[t] || [];          // 真实主子表（带「主」标记）
          var navKids = (S.NAV_SUB && S.NAV_SUB[t]) ? S.NAV_SUB[t] : []; // 纯导航归组
          var hasKids = kids.length > 0 || navKids.length > 0;
          var tOpen = st.open.t[t] === true;
          var cnt = cntText(knownCount(t));   // 只报已知计数，不为一个数字拉整表
          h += '<div class="tbl-item' + (st.table === t ? ' active' : '') + '" data-t="' + t + '">' +
            '<span class="tdot"></span><span>' + esc(S.TABLES[t].label) + '</span>' +
            (kids.length ? '<span class="md-badge">主</span>' : '') +
            (hasKids ? '<span class="tchev' + (tOpen ? ' open' : '') + '" data-tchev="' + t + '" title="展开/收起子表">▸</span>' : '') +
            '<span class="cnt">' + cnt + '</span></div>';
          if (hasKids && tOpen) {
            h += '<div class="tbl-sub">';
            kids.concat(navKids).forEach(function (d) {
              var kt = d.table || d;
              if (!S.TABLES[kt]) return;
              h += '<div class="tbl-item child sub' + (st.table === kt ? ' active' : '') + '" data-t="' + kt + '">' +
                '<span class="tdot"></span><span>' + esc(S.TABLES[kt].label) + '</span>' +
                '<span class="cnt">' + cntText(knownCount(kt)) + '</span></div>';
            });
            h += '</div>';
          }
        });
        h += '</div>';
      }
      h += '</div>';
    });
    var sb = document.getElementById('sidebar');
    sb.innerHTML = h;
    sb.querySelectorAll('.group-head').forEach(function (el) {
      el.onclick = function () { var k = el.getAttribute('data-group'); st.open.g[k] = !(st.open.g[k] === true); render(); };
    });
    sb.querySelectorAll('[data-tchev]').forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); var t = el.getAttribute('data-tchev'); st.open.t[t] = !(st.open.t[t] === true); render(); };
    });
    sb.querySelectorAll('.tbl-item').forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var v = el.getAttribute('data-view');
        if (v) { st.view = v; setNav(); render(); return; } // 视图入口（不改动顶部导航显隐）
        st.table = el.getAttribute('data-t'); st.view = 'browser'; st.sel = null; st.search = '';
        st.page = 1; srvInvalidate(); setNav(); render();
      };
    });
  }

  /* ---------- 顶栏状态同步：视图页签高亮（本地形态）+「当前位置」文字说明（两形态都有） ---------- */
  function setNav() {
    var nav = document.getElementById('topnav');
    if (nav) nav.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === st.view); });
    renderPageHead();
  }
  /* 渲染「功能域 / 页面」面包屑文字（纯说明，不可点击，不承担业务页面切换） */
  function renderPageHead() {
    var el = document.getElementById('pageHead');
    if (!el) return;
    var dom = '', title = '';
    if (st.view === 'browser' && st.table && S.TABLES[st.table]) {
      var g = groupOf(st.table);
      dom = g ? g.name : (S.TABLES[st.table].module || '');
      title = S.TABLES[st.table].label;
    } else {
      var n = navOf(st.view);
      title = n ? n.label : st.view;
      if (st.view === 'board') dom = '生产看板';
    }
    el.innerHTML = '<span class="ph-flow">当前页面</span>' +
      (dom ? '<span class="ph-sep">/</span><span class="ph-dom">' + esc(dom) + '</span>' : '') +
      '<span class="ph-sep">/</span><span class="ph-title">' + esc(title) + '</span>' +
      (st.view === 'browser' && st.table ? '<code class="ph-code">' + esc(st.table) + '</code>' : '');
  }
  /* ---------- 顶栏视图页签（仅「本地直连」形态渲染，门户形态由门户菜单承载） ---------- */
  function renderNav() {
    if (IN_PORTAL) return;                          // 门户形态：视图入口全部走门户菜单
    var nav = document.getElementById('topnav');
    if (!nav) return;                               // 本地形态：容器缺失时安全退出
    var h = '';
    NAV.forEach(function (n) {
      if (!visOn(n.view)) return;
      h += '<button data-view="' + n.view + '"' + (st.view === n.view ? ' class="active"' : '') + '>' + esc(n.label) + '</button>';
    });
    nav.innerHTML = h;
    nav.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { st.view = b.getAttribute('data-view'); if (st.view === 'browser' && !st.table) st.table = firstTable(); setNav(); render(); };
    });
  }
  function applyViews() { renderNav(); }
  /* 切到某个视图（若被隐藏则自动显示，避免点了进不去） */
  function gotoView(v) {
    if (!coreView(v) && !visOn(v)) { views.vis[v] = true; persistViews(); renderNav(); }
    st.view = v; if (v === 'browser' && !st.table) st.table = firstTable(); setNav(); render();
  }
  /* 显示设置弹窗：勾选顶部导航要显示哪些视图（默认只显示 数据浏览/数据模型/使用说明/核心流程/数据洞察） */
  function openSettings() {
    var body = '<p class="mini">本设置只影响<b>顶栏</b>的视图入口。默认只显示：<b>数据浏览 · 数据模型 · 使用说明</b>；其余视图默认挂在<b>左侧树</b>的「<b>生产看板</b>」（现场驾驶舱 / WIP 看板 / OEE）下，勾上则同时在顶栏显示。设置即时生效并自动保存。</p>';
    body += '<div class="set-list">';
    NAV.forEach(function (n) {
      var on = visOn(n.view);
      body += '<label class="set-row"><input type="checkbox" data-vis="' + n.view + '" ' + (on ? 'checked' : '') + '/> <span>' + esc(n.label) + '</span><span class="mini" style="margin-left:auto">' + esc(n.view) + '</span></label>';
    });
    body += '</div>';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '显示设置 · 顶部导航显隐';
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalSave').textContent = '完成';
    document.getElementById('modalCancel').textContent = '全部恢复默认';
    document.getElementById('modalMask').style.display = 'flex';
    document.getElementById('modalBody').querySelectorAll('[data-vis]').forEach(function (cb) {
      cb.onchange = function () {
        var v = cb.getAttribute('data-vis');
        views.vis[v] = cb.checked; persistViews();
        renderNav(); setNav();
        if (!cb.checked && st.view === v) { /* 当前正在看被隐藏的视图，跳回默认落地页 */ st.view = DEFAULT_LANDING; if (st.view === 'browser' && !st.table) st.table = firstTable(); render(); }
      };
    });
    document.getElementById('modalSave').onclick = function () { closeModal(); };
    document.getElementById('modalCancel').onclick = function () { views.vis = {}; persistViews(); renderNav(); setNav(); render(); toast('已恢复默认显隐'); };
  }
  /* 顶栏按钮绑定。
   * 注：业务数据已接入平台 UNS（在平台上管理），故**不再提供「重置演示数据」入口**——
   * 本地清库重置与 UNS 远端数据会互相打架（刷新后以 UNS 为准，按钮等于失效）。 */
  function bindTop() {
    var bs = document.getElementById('btnSettings');
    if (bs) bs.onclick = openSettings;
    var bg = document.getElementById('dsBadge');
    if (bg) bg.onclick = showDataSource;
  }
  /* 顶栏「数据源」徽标：一眼看出当前数据是不是真接在后端 UNS 上；点开看明细 */
  function renderDataSource() {
    var el = document.getElementById('dsBadge');
    if (!el) return;
    var b = BE.state();
    if (b.available === true) {
      /* 自有后端已接 UNS → 真实读写（写走 §backend-uns 业务 API） */
      el.className = 'dsbadge uns';
      el.textContent = '数据源：UNS 后端（' + b.tables.length + ' 表可写）';
    } else if (b.available === false) {
      el.className = 'dsbadge local';
      el.textContent = '数据源：本地演示';
    } else {
      el.className = 'dsbadge local';
      el.textContent = '数据源：连接中…';
    }
  }
  function showDataSource() {
    var b = BE.state();
    var lines = [];
    lines.push('数据源：' + (b.available === true ? '自有后端 → 平台 UNS 关系表（真实读写）'
      : (b.available === false ? '本地 localStorage（后端不可用，使用内置演示数据）' : '正在探测后端…')));
    lines.push('接口基址：' + (b.base || '(相对路径)'));
    lines.push('已绑定表：' + b.tables.length + ' 张');
    if (b.available === false && b.lastErr) lines.push('后端不可用原因：' + String(b.lastErr).slice(0, 200));
    lines.push('页面数据行数：' + Object.keys(db || {}).reduce(function (a, k) { return a + ((db[k] || []).length); }, 0) + ' 行');
    alert(lines.join('\n'));
  }
  window.__MES_DS__ = function () { return { be: BE.state() }; };   // 控制台快捷入口
  function firstTable() { for (var k in S.TABLES) return k; }

  /* ---------- 版本角标：这次发的是哪一版 ----------
   * 版本号 / 构建时间 / 前端源码哈希由打包脚本写进 js/version.js（window.__MES_VERSION__），
   * 前端零请求直接显示；没有该文件时静默不显示，不影响页面。 */
  function renderVersion() {
    var el = document.getElementById('verBadge');
    if (!el) return;
    var v = window.__MES_VERSION__;
    if (!v || !v.v) { el.textContent = ''; return; }
    el.textContent = 'v' + v.v;
    var tip = ['应用版本 ' + v.v];
    if (v.built) tip.push('构建时间 ' + v.built);
    if (v.src) tip.push('前端源码 ' + v.src);
    el.title = tip.join(' · ');
  }
  /* ---------- supOS 平台能力：读取当前登录人（相对应用根，走门户登录态） ----------
   * 成功则在顶栏显示；未登录 / 无权限时静默隐藏，不改打平台地址，也不影响页面本身。 */
  function loadWhoami() {
    var el = document.getElementById('whoami');
    if (!el) return;
    try {
      fetch('api/whoami', { credentials: 'include', headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return;
          var u = j.user || (j.data && j.data.user) || {};
          var name = (typeof u === 'string') ? u : (u.person_name || u.username || u.user_code || '');
          if (name) { CUR_USER = name; el.textContent = '当前用户：' + name; }
          else el.textContent = '';
        })
        .catch(function () { });
    } catch (e) { }
  }
  /* 门户菜单是真实路径深链，用户浏览器前进/后退时同步页面状态 */
  window.addEventListener('popstate', function () {
    st.sel = null; st.search = '';
    applyRoute();
    if (!st.table) st.table = firstTable();
    setNav(); render();
  });

  /* ============================================================
   * 生产报表 · 实时派生（只读）
   * 报表分组下的表格不接收人工录入：每次渲染都按业务数据实时重算，上游
   * （订单 / 采购 / 到货 / 工单 / 报工 / 出入库 / 检验 / 设备…）的任何新增
   * 或修改都会自动反映到报表里；报表内只保留「查询 / 导出」两种操作。
   * ============================================================ */
  var RPT_CACHE = null;
  function rptClear() { RPT_CACHE = null; }
  function rn(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function rd(v) { return v ? String(v).slice(0, 10) : ''; }
  function rrow(t, i, extra) {
    var r = { ID: 'RPT_' + t + '_' + (i + 1), ORG_ID: 'ORG1', CREATE_BY: 'SYS', CREATE_TIME: now(), DEL_FLAG: 0, VER_NO: 1, REMARK: '', EXT_JSON: null, AUDIT_STATUS: '已汇总' };
    for (var k in extra) r[k] = extra[k];
    return r;
  }
  function rfind(t, fn) { return rawRows(t).find(fn) || {}; }

  /* ① 供应商绩效(年度)：按到货单 + 采购入库检验结果实时汇总 */
  function rptSupplierPerf() {
    var out = [], i = 0, arr = {}, ok = {};
    rawRows('PD_ARRIVAL').forEach(function (a) {
      var s = a.SUPPLIER_CODE || '—';
      if (!arr[s]) arr[s] = { n: 0, dates: [] };
      arr[s].n++; if (a.ARRIVAL_DATE) arr[s].dates.push(rd(a.ARRIVAL_DATE));
    });
    rawRows('WM_INBOUND').forEach(function (w) {
      if (w.IN_TYPE !== '采购入库') return;
      var s = w.SUPPLIER_CODE || '—';
      if (!/不合格|退货|拒收/.test(w.QC_RESULT || '')) ok[s] = (ok[s] || 0) + 1;
    });
    Object.keys(arr).sort().forEach(function (s) {
      var n = arr[s].n, q = Math.min(ok[s] || 0, n), dates = arr[s].dates.slice().sort();
      var line = rawRows('PD_PURCHASE_ORDER_LINE').find(function (l) {
        return rawRows('PD_PURCHASE_ORDER').some(function (p) { return p.PO_NO === l.PO_NO && p.SUPPLIER_CODE === s; });
      }) || {};
      out.push(rrow('MD_SUPPLIER_PERF', i++, {
        SUPPLIER_CODE: s, YEAR: dates.length ? Number(dates[dates.length - 1].slice(0, 4)) : new Date().getFullYear(),
        ITEM_NAME: line.ITEM_NAME || '', PART_NO: line.ITEM_NO || '', SUBMIT_DATE: dates[dates.length - 1] || '',
        ARRIVAL_BATCH_QTY: n, QUALIFIED_BATCH_QTY: q, BATCH_PASS_RATE: n ? +(q / n).toFixed(4) : 0,
        APPROVED_BY: '王芳', SEALED_BY: '精测室', MAKER: '系统汇总', MAKE_DATE: rd(now())
      }));
    });
    return out;
  }

  /* ② 生产线日报：按 报工日期 × 班次 × 工序 汇总 */
  function rptDailyOutput() {
    var g = {}, out = [], i = 0;
    rawRows('EX_REPORT').forEach(function (r) {
      var d = rd(r.REPORT_DATE); if (!d) return;
      var k = d + '|' + (r.SHIFT || '') + '|' + (r.STEP_NAME || '');
      if (!g[k]) g[k] = { d: d, shift: r.SHIFT, step: r.STEP_NAME, plan: 0, act: 0, ng: 0, op: r.OPERATOR, ld: r.LEADER, eq: r.EQUIP_NO, lines: {} };
      var o = g[k];
      o.act += rn(r.REPORT_QTY); o.ng += rn(r.NG_QTY);
      var wo = rfind('EX_WORK_ORDER', function (w) { return w.WO_NO === r.WO_NO; });
      var ws = rfind('EX_WO_STEP', function (s) { return s.WO_NO === r.WO_NO && s.STEP_NO === r.STEP_NO; });
      o.plan += rn(ws.PLAN_QTY != null ? ws.PLAN_QTY : wo.PLAN_QTY);
      if (wo.LINE_CODE) o.lines[wo.LINE_CODE] = 1;
    });
    Object.keys(g).sort().forEach(function (k) {
      var o = g[k];
      out.push(rrow('EX_DAILY_OUTPUT', i++, {
        DAILY_NO: 'DO-' + o.d.replace(/-/g, '') + '-' + (i + 1), LINE_CODE: Object.keys(o.lines).join('/'),
        MACHINE_TYPE: '', DEPT_CLASS: '', WORK_DATE: o.d, SEQ_NO: i + 1, STEP_NAME: o.step,
        EQUIP_SPEC: '', EQUIP_COUNT: 1, SHIFT: o.shift, OPERATOR: o.op, LEADER: o.ld,
        PLAN_QTY: o.plan, ACT_QTY: o.act, DIFF_QTY: o.act - o.plan, NG_QTY: o.ng, TOTAL_QTY: o.act,
        PROC_MODE: '', EQUIP_ABNORMAL: '见设备故障/采集记录'
      }));
    });
    return out;
  }

  /* ③ 产能/负荷(CRP)：按 排程日期 × 设备 汇总负荷工时并算负荷率 */
  function rptCapacity() {
    var g = {}, out = [], i = 0;
    rawRows('PP_SCHEDULE').forEach(function (s) {
      var d = rd(s.PLAN_START); if (!d) return;
      var hrs = 0;
      if (s.PLAN_START && s.PLAN_END) {
        var a = new Date(String(s.PLAN_START).replace(/-/g, '/')), b = new Date(String(s.PLAN_END).replace(/-/g, '/'));
        if (!isNaN(a) && !isNaN(b)) hrs = Math.max(0, (b - a) / 3600000);
      }
      var k = d + '|' + (s.EQUIP_NO || '');
      if (!g[k]) g[k] = { d: d, eq: s.EQUIP_NO, load: 0 };
      g[k].load += hrs;
    });
    Object.keys(g).sort().forEach(function (k) {
      var o = g[k], eq = rfind('MD_EQUIPMENT', function (e) { return e.EQUIP_NO === o.eq; });
      var cap = 16, rate = cap ? o.load / cap : 0;
      out.push(rrow('PP_CAPACITY_LOAD', i++, {
        CAP_LEVEL: 'CRP', WORK_CENTER: (eq.EQUIP_TYPE || '') + '区', EQUIP_NO: o.eq, LOAD_DATE: o.d,
        AVAILABLE_CAP: cap, LOAD_HOURS: +o.load.toFixed(2), LOAD_RATE: +rate.toFixed(2),
        BOTTLENECK_FLAG: rate > 1 ? 1 : 0, SUGGEST_ADJ: rate > 1 ? '负荷率>100%，建议加班/外协分流' : '负荷正常'
      }));
    });
    return out;
  }

  /* ④ 设备综合效率(OEE)：可用率 × 性能率 × 良率（由日度报工与停机实时推算） */
  function rptOee() {
    var g = {}, out = [], i = 0;
    rawRows('EX_REPORT').forEach(function (r) {
      var d = rd(r.REPORT_DATE); if (!d) return;
      var k = d + '|' + (r.EQUIP_NO || '');
      if (!g[k]) g[k] = { d: d, eq: r.EQUIP_NO, qty: 0, good: 0, down: 0 };
      g[k].qty += rn(r.REPORT_QTY); g[k].good += rn(r.GOOD_QTY); g[k].down += rn(r.DOWN_MIN);
    });
    Object.keys(g).sort().forEach(function (k) {
      var o = g[k], eq = rfind('MD_EQUIPMENT', function (e) { return e.EQUIP_NO === o.eq; });
      var planned = 480, pd = 30, chg = 0, wait = 0, unplanned = o.down;
      var run = Math.max(0, planned - pd - unplanned - chg - wait);
      var av = planned ? run / planned : 0;
      var ideal = rn(eq.STD_CYCLE_TIME), act = o.qty ? (run * 60 / o.qty) : 0;
      var perf = (ideal && act) ? Math.min(1, ideal / act) : 0;
      var qr = o.qty ? o.good / o.qty : 0;
      out.push(rrow('EQ_OEE', i++, {
        STAT_DATE: o.d, PERIOD: '日', EQUIP_NO: o.eq,
        PLANNED_MIN: planned, PLANNED_DOWN_MIN: pd, UNPLANNED_DOWN_MIN: unplanned, CHANGE_MIN: chg, WAIT_MATERIAL_MIN: wait,
        RUN_MIN: +run.toFixed(1), AVAILABILITY: +av.toFixed(4), IDEAL_CT: ideal, ACT_CT: +act.toFixed(2),
        PERFORMANCE: +perf.toFixed(4), TOTAL_QTY: o.qty, GOOD_QTY: o.good, QUALITY_RATE: +qr.toFixed(4),
        OEE_VALUE: +(av * perf * qr).toFixed(4), OEE_TARGET: 0.75, EQUIP_GROUP: (eq.EQUIP_TYPE || '') + '区'
      }));
    });
    return out;
  }

  /* ⑤ 订单+预测+在制在库一览：由销售订单明细 / 工单 / 库存 / 入库 / 生产计划实时汇总 */
  function rptOrderBoard() {
    var g = {}, out = [], i = 0;
    function put(itemNo, name, patch) {
      if (!itemNo) return;
      if (!g[itemNo]) g[itemNo] = { ITEM_NO: itemNo, ITEM_NAME: name || '', ORDER_QTY: 0, DELIVERED_QTY: 0, LENT_QTY: 0, MONTH_IN_QTY: 0, MONTH_OUT_QTY: 0, WIP_QTY: 0, STOCK_QTY: 0, FORECAST_QTY: 0 };
      var o = g[itemNo];
      if (name && !o.ITEM_NAME) o.ITEM_NAME = name;
      Object.keys(patch || {}).forEach(function (k) { o[k] += patch[k]; });
    }
    rawRows('SD_SALES_ORDER_LINE').forEach(function (l) { put(l.ITEM_NO, l.ITEM_NAME, { ORDER_QTY: rn(l.ORDER_QTY), DELIVERED_QTY: rn(l.DELIVERED_QTY), MONTH_OUT_QTY: 0 }); });
    rawRows('SD_DELIVERY_LINE').forEach(function (l) { put(l.ITEM_NO, l.ITEM_NAME, { MONTH_OUT_QTY: rn(l.DELIVERY_QTY) }); });
    rawRows('EX_WORK_ORDER').forEach(function (w) { put(w.PRODUCT_NO, w.PRODUCT_NAME, { WIP_QTY: Math.max(0, rn(w.PLAN_QTY) - rn(w.FINISH_QTY)) }); });
    rawRows('WM_STOCK').forEach(function (s) { put(s.ITEM_NO, s.ITEM_NAME, { STOCK_QTY: rn(s.ONHAND_QTY) }); });
    rawRows('WM_FINISH_IN').forEach(function (f) {
      var w = rfind('EX_WORK_ORDER', function (x) { return x.WO_NO === f.WO_NO; });
      put(w.PRODUCT_NO, w.PRODUCT_NAME, { MONTH_IN_QTY: rn(f.TOTAL_IN_QTY) });
    });
    rawRows('PP_MASTER_PLAN').forEach(function (p) { put(p.ITEM_NO, p.ITEM_NAME, { FORECAST_QTY: rn(p.TOTAL_QTY) }); });
    Object.keys(g).forEach(function (k) {
      var o = g[k];
      var shortQty = Math.max(0, o.ORDER_QTY - o.DELIVERED_QTY - o.WIP_QTY - o.STOCK_QTY);
      out.push(rrow('PP_ORDER_BOARD', i++, {
        DOC_DATE: now(), BOARD_MARK: '订单+预测', CATEGORY: '成品', ITEM_NO: o.ITEM_NO, ITEM_NAME: o.ITEM_NAME,
        ORDER_QTY: o.ORDER_QTY, DELIVERED_QTY: o.DELIVERED_QTY, LENT_QTY: o.LENT_QTY,
        MONTH_IN_QTY: o.MONTH_IN_QTY, MONTH_OUT_QTY: o.MONTH_OUT_QTY, WIP_QTY: o.WIP_QTY,
        STOCK_QTY: o.STOCK_QTY, FORECAST_QTY: o.FORECAST_QTY, SHORT_QTY: shortQty
      }));
    });
    return out;
  }

  /* ⑥ WIP 在制看板：按工单 + 工单工序报工实时刷新 */
  function rptWipBoard() {
    var out = [], i = 0;
    rawRows('EX_WORK_ORDER').forEach(function (w) {
      var steps = rawRows('EX_WO_STEP').filter(function (s) { return s.WO_NO === w.WO_NO; }).sort(function (a, b) { return stepIdx(a.STEP_NO) - stepIdx(b.STEP_NO); });
      var cur = steps.filter(function (s) { return rn(s.REPORT_QTY) > 0; }).pop() || steps[0] || {};
      var good = steps.reduce(function (a, s) { return a + rn(s.GOOD_QTY); }, 0);
      var rep = steps.reduce(function (a, s) { return a + rn(s.REPORT_QTY); }, 0);
      var plan = rn(w.PLAN_QTY);
      var eq = rfind('MD_EQUIPMENT', function (e) { return e.EQUIP_NO === cur.EQUIP_NO; });
      out.push(rrow('EX_WIP_BOARD', i++, {
        SNAPSHOT_TIME: now(), WO_NO: w.WO_NO, PRODUCT_NO: w.PRODUCT_NO, ITEM_NAME: w.PRODUCT_NAME,
        CURRENT_STEP_NO: cur.STEP_NO || '', CURRENT_STEP_NAME: cur.STEP_NAME || '',
        GOOD_QTY: good, WAIT_QC_QTY: 0, WIP_QTY: Math.max(0, plan - rep), PLAN_QTY: plan,
        DONE_RATE: plan ? +(good / plan).toFixed(4) : 0,
        EST_FINISH_TIME: w.PLAN_END ? (rd(w.PLAN_END) + ' 20:00:00') : null,
        WIP_STATUS: w.STATUS || '', STAGNANT_DAYS: 0, AREA_CODE: eq.EQUIP_TYPE ? (eq.EQUIP_TYPE + '区') : ''
      }));
    });
    return out;
  }

  /* ⑦ 设备状态监测：按设备台账状态 + 未闭环报修实时生成 */
  function rptStatusMonitor() {
    var out = [], i = 0;
    rawRows('MD_EQUIPMENT').forEach(function (e) {
      var fault = rawRows('EQ_FAULT_REPAIR').find(function (f) { return f.EQUIP_NO === e.EQUIP_NO && !/完成|已闭环|已验收/.test(f.STATUS || ''); });
      out.push(rrow('EQ_STATUS_MONITOR', i++, {
        EQUIP_NO: e.EQUIP_NO, COLLECT_TIME: now(), STATUS: e.EQUIP_STATUS || '未知',
        DURATION_MIN: fault ? rn(fault.DOWN_MIN) : 0,
        TO_RCCP: /运行/.test(e.EQUIP_STATUS || '') ? 1 : 0,
        WARN_MSG: fault ? (fault.FAULT_DESC || '存在未闭环报修') : (/待机/.test(e.EQUIP_STATUS || '') ? '待机中' : '')
      }));
    });
    return out;
  }

  /* ⑧ 追溯报表-物料：按物料条码/批次串起 到货→检验→入库→领料→出库→发货 全链 */
  function rptTraceMaterial() {
    var out = [], i = 0;
    rawRows('MD_MATERIAL').forEach(function (m) {
      var ev = [];
      function push(node, tbl, no, qty, unit, date, who, status, lot) {
        ev.push({ node: node, tbl: tbl, no: no, qty: qty, unit: unit, date: rd(date), who: who || '', status: status || '', lot: lot || '' });
      }
      rawRows('PD_ARRIVAL_LINE').filter(function (l) { return l.ITEM_NO === m.ITEM_NO; }).forEach(function (l) {
        var h = rfind('PD_ARRIVAL', function (a) { return a.ARRIVAL_NO === l.ARRIVAL_NO; });
        push('采购到货', 'PD_ARRIVAL', l.ARRIVAL_NO, rn(l.ARRIVAL_QTY), l.UNIT, h.ARRIVAL_DATE, h.CREATE_BY, h.STATUS, l.LOT_NO);
      });
      rawRows('QC_INSPECTION').filter(function (q) { return q.ITEM_NO === m.ITEM_NO; }).forEach(function (q) {
        push('质量检验(' + (q.QC_TYPE || '') + ')', 'QC_INSPECTION', q.QC_NO, rn(q.QTY), q.UNIT, q.INSPECT_DATE, q.INSPECTOR, q.QC_RESULT, '');
      });
      var arrLots = rawRows('PD_ARRIVAL_LINE').filter(function (l) { return l.ITEM_NO === m.ITEM_NO; }).map(function (l) { return l.ARRIVAL_NO; });
      rawRows('WM_INBOUND').filter(function (w) { return arrLots.indexOf(w.ARRIVAL_NO) >= 0; }).forEach(function (w) {
        push('采购入库', 'WM_INBOUND', w.IN_NO, rn(w.ACCEPT_QTY), m.UNIT, (w.DOC_DATE || w.CREATE_TIME), w.CREATE_BY, (w.QC_RESULT || '') + ' ' + (w.STATUS || ''), w.LOT_NO);
      });
      rawRows('EX_ISSUE_LINE').filter(function (l) { return l.ITEM_NO === m.ITEM_NO; }).forEach(function (l) {
        var h = rfind('EX_ISSUE_ORDER', function (x) { return x.ISSUE_NO === l.ISSUE_NO; });
        push('生产领料', 'EX_ISSUE_ORDER', l.ISSUE_NO, rn(l.ISSUE_QTY), l.UNIT, h.DOC_DATE, h.ISSUE_BY, h.STATUS, l.LOT_NO);
      });
      rawRows('SD_DELIVERY_LINE').filter(function (l) { return l.ITEM_NO === m.ITEM_NO; }).forEach(function (l) {
        var h = rfind('SD_DELIVERY', function (x) { return x.DELIVERY_NO === l.DELIVERY_NO; });
        push('销售发货', 'SD_DELIVERY', l.DELIVERY_NO, rn(l.DELIVERY_QTY), l.UNIT, h.DOC_DATE, h.CREATE_BY, h.STATUS, l.LOT_NO);
      });
      ev.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      ev.forEach(function (e, idx) {
        out.push(rrow('RPT_TRACE_MATERIAL', i++, {
          TRACE_NO: 'TM-' + m.ITEM_NO + '-' + (idx + 1), MATERIAL_BARCODE: m.ITEM_BARCODE || '', ITEM_NO: m.ITEM_NO, ITEM_NAME: m.ITEM_NAME,
          LOT_NO: e.lot, NODE_SEQ: idx + 1, NODE_NAME: e.node, DOC_TABLE: e.tbl, DOC_NO: e.no,
          QTY: e.qty, UNIT: e.unit || m.UNIT, WORK_DATE: e.date, OPERATOR: e.who, STATUS: e.status
        }));
      });
    });
    return out;
  }

  /* ⑨ 追溯报表-报工：每条报工带工单条码 / 产品 / 设备 / 检验 / 上下道工序 */
  function rptTraceWork() {
    var out = [], i = 0;
    rawRows('EX_REPORT').forEach(function (r) {
      var wo = rfind('EX_WORK_ORDER', function (w) { return w.WO_NO === r.WO_NO; });
      out.push(rrow('RPT_TRACE_WORK', i++, {
        TRACE_NO: 'TW-' + r.REPORT_NO, REPORT_NO: r.REPORT_NO, WO_BARCODE: wo.WO_BARCODE || '', WO_NO: r.WO_NO,
        PRODUCT_NO: wo.PRODUCT_NO || '', PRODUCT_NAME: wo.PRODUCT_NAME || '',
        STEP_NO: r.STEP_NO, STEP_NAME: r.STEP_NAME, EQUIP_NO: r.EQUIP_NO, OPERATOR: r.OPERATOR, SHIFT: r.SHIFT,
        REPORT_DATE: rd(r.REPORT_DATE), REPORT_QTY: rn(r.REPORT_QTY), GOOD_QTY: rn(r.GOOD_QTY), NG_QTY: rn(r.NG_QTY),
        LOT_NO: r.LOT_NO, QC_NO: r.QC_NO, QC_STATUS: r.QC_STATUS, NEXT_STEP_NO: r.NEXT_STEP_NO, DATA_SOURCE: r.DATA_SOURCE
      }));
    });
    return out;
  }

  var RPT_BUILDERS = {
    MD_SUPPLIER_PERF: rptSupplierPerf,
    EX_DAILY_OUTPUT: rptDailyOutput,
    PP_CAPACITY_LOAD: rptCapacity,
    EQ_OEE: rptOee,
    PP_ORDER_BOARD: rptOrderBoard,
    EX_WIP_BOARD: rptWipBoard,
    EQ_STATUS_MONITOR: rptStatusMonitor,
    RPT_TRACE_MATERIAL: rptTraceMaterial,
    RPT_TRACE_WORK: rptTraceWork
  };
  function buildReports() {
    var out = {};
    Object.keys(RPT_BUILDERS).forEach(function (t) { try { out[t] = RPT_BUILDERS[t]() || []; } catch (e) { out[t] = []; } });
    return out;
  }

  /* ---------- 视图渲染 ---------- */
  function render() {
    rptClear();
    renderSidebar();
    var c = document.getElementById('content');
    var touched = {};          // 本视图真正读了哪些表 → 渲染后只补拉缺的
    var earlyExit = false;
    COLLECT = touched;
    try {
      if (st.view === 'dashboard') c.innerHTML = viewDashboard();
      else if (st.view === 'model') c.innerHTML = viewModel();
      else if (st.view === 'browser') c.innerHTML = viewBrowser();
      else if (st.view === 'board') c.innerHTML = viewBoard();
      else if (st.view === 'insight') { viewInsight(); syncUrl(); earlyExit = true; }
      else if (st.view === 'guide') c.innerHTML = viewGuide();
      else if (st.view === 'flow') c.innerHTML = viewFlow();
      else if (st.view === 'wip') c.innerHTML = viewWip();
      else if (st.view === 'oee') c.innerHTML = viewOee();
      else if (st.view === 'er') c.innerHTML = viewEr();
    } finally {
      COLLECT = null;
    }
    if (!earlyExit) { bindView(); syncUrl(); }
    fillMissing(touched);
  }

  /* 渲染后补数据：只拉「本视图真的读了」且「还没载入」的表。
   * 数据到齐后重渲染一次；失败的表记进 LOAD_FAIL，不会来回死循环。 */
  function fillMissing(touched) {
    if (!LAZY || FILLING || !BE.available()) return;
    var all = {};
    Object.keys(touched || {}).forEach(function (t) { all[t] = 1; });
    Object.keys(NEED).forEach(function (t) { all[t] = 1; delete NEED[t]; });
    var miss = Object.keys(all).filter(function (t) {
      return BE.on(t) && !LOADED[t] && !LOAD_FAIL[t];
    });
    if (!miss.length) return;
    FILLING = true;
    loadTables(miss, function () { FILLING = false; render(); });
  }

  /* ---------- 弹窗依赖：表单 / 单据详情 / 导入要用到的表 ----------
   * 这些入口是「点开才取数」，走不到 render() 的依赖收集，必须自己把表拉齐：
   *   - 本表 + 本表列上引用的主数据（ref，报价单的「客户」就是 MD_CUSTOMER）
   *   - 主从表的子表及其引用主数据
   *   - 字典下拉（SYS_DICT）、设备可用性（EQ_RUNTIME_STATUS）、业务流关联（SYS_DOC_LINK）
   *   - 导入时的父单表（IMPORT_FK） */
  function depsFor(t) {
    var out = {};
    function add(x) { if (x && S.TABLES[x]) out[x] = 1; }
    function scan(tt) {
      add(tt);
      S.columnsOf(tt).forEach(function (c) {
        if (c.ref) add(c.ref);
        if (c.dict) add('SYS_DICT');
        if (c.filter === 'equipAvailable') add('EQ_RUNTIME_STATUS');
      });
    }
    scan(t);
    (S.MASTER_DETAIL[t] || []).forEach(function (d) { scan(d.table); });
    if (S.IMPORT_FK && S.IMPORT_FK[t]) Object.keys(S.IMPORT_FK[t]).forEach(function (k) { add(S.IMPORT_FK[t][k]); });
    add('SYS_DICT'); add('SYS_DOC_LINK');
    return Object.keys(out);
  }
  /* 依赖表有缺 → 先加载，加载完重跑 rerun()，并返回 true 让调用方中止本次执行。
   * 失败的表会被 LOAD_FAIL 记住，不会反复重试造成死循环。 */
  function needDeps(t, rerun) {
    if (!LAZY || !BE.available()) return false;
    var miss = depsFor(t).filter(function (x) {
      return BE.on(x) && !LOADED[x] && !LOAD_FAIL[x] && !isReportTable(x);
    });
    if (!miss.length) return false;
    toast('加载主数据（' + miss.length + ' 张）…');
    loadTables(miss, function () { rerun(); });
    return true;
  }

  /* 批量拉表：并发 4，逐张落 db。done() 一定会被调用（成功或全失败），调用方据此重渲染。
   * 拉完顺手把这几张表的版本记进 VERS —— 否则下次对账「本地没版本 = 变了」，
   * 会把刚拉过的表原样再拉一遍（线上实测会退化成每次点击重拉全量）。 */
  function loadTables(list, done) {
    var q = list.slice(), i = 0, active = 0, ok = 0, finished = false;
    var okList = [];
    function finish() {
      if (finished) return;
      finished = true;
      if (ok) { save(); saveSync(); }
      if (done) done(ok);
      if (okList.length) {
        BE.sync(okList).then(function (tbl) {
          Object.keys(tbl).forEach(function (t) { VERS[t] = { c: tbl[t].c, u: tbl[t].u }; });
          saveSync();
        }).catch(function () {});
      }
    }
    function startOne(t) {
      active++;
      BE.list(t, 200).then(function (unsRows) {
        db[t] = unsRows.map(function (u) { return rowFromBackend(t, u); });
        LOADED[t] = 1; delete LOAD_FAIL[t]; ok++; okList.push(t);
      }).catch(function (e) {
        LOAD_FAIL[t] = 1;
        try { console.warn('[MES-BE] ' + t + ' 读取失败：' + ((e && e.message) || e)); } catch (_) {}
      }).then(function () {
        active--;
        if (i < q.length) startOne(q[i++]);
        else if (active === 0) finish();
      });
    }
    if (!q.length) { finish(); return; }
    var seed = Math.min(4, q.length);
    for (var k = 0; k < seed; k++) startOne(q[i++]);
  }

  /* 总览 */
  function viewDashboard() {
    ensureAllCounts();          // 总览要显示每张表的行数，这里才全量对账（单表页面不会走到）
    /* 2026-10-27：计数一律走 knownCount（版本对账已带回全量行数），
     * 不再为了显示 5 个数字把 70 张表全拉一遍。负数=未知，显示「—」。 */
    var totalTables = Object.keys(S.TABLES).length, totalRows = 0, anyUnknown = false;
    Object.keys(S.TABLES).forEach(function (t) {
      if (isReportTable(t)) return;                 // 报表由业务表派生，求和会重复计数
      var n = knownCount(t);
      if (n < 0) anyUnknown = true; else totalRows += n;
    });
    var wipN = knownCount('EX_WORK_ORDER');
    var wip = wipN > 0 ? wipN : 0;
    var oee = RPT_CACHE ? (RPT_CACHE['EQ_OEE'] || []) : [];
    var avgOee = '—';
    if (oee.length) {
      var s = oee.reduce(function (a, r) { return a + (+r.OEE_VALUE || 0); }, 0);
      avgOee = (s / oee.length * 100).toFixed(1) + '%';
    }
    var kpis = '<div class="kpis">' +
      kpi(totalTables, '数据表（' + S.DOMAINS.length + ' 功能域 / ' + totalTables + ' 张）') +
      kpi(cntText(totalRows) + (anyUnknown ? '+' : ''), '业务记录总数（不含报表）') +
      kpi(Object.keys(S.MASTER_DETAIL).length, '主子表关联') + kpi(avgOee, '设备 OEE 均值') + '</div>';
    var dom = '<div class="domgrid">';
    S.DOMAINS.forEach(function (d) {
      var cnt = 0; d.modules.forEach(function (m) { m.tables.forEach(function (t) { if (S.TABLES[t] && !isReportTable(t)) { var n = knownCount(t); if (n > 0) cnt += n; } }); });
      dom += '<div class="domcard"><div class="dn"><span class="layer-dot" style="background:'+domColor(d.code)+'"></span>'+esc(d.name)+'</div><div class="dd">'+esc(d.desc)+'</div>';
      d.modules.forEach(function (m) {
        var mc = 0, hasNum = false, unk = false;
        m.tables.forEach(function (t) {
          if (!S.TABLES[t]) return;
          if (isReportTable(t)) { unk = true; return; }     // 报表是派生视图，不参与求和
          var n = knownCount(t);
          if (n < 0) unk = true; else { mc += n; hasNum = true; }
        });
        dom += '<div class="modrow"><span>'+esc(m.name)+'</span><span>'+(hasNum ? cntText(mc)+(unk?'+':'') : '—')+' 条</span></div>';
      });
      dom += '</div>';
    });
    dom += '</div>';
    return '<div class="card"><h2>系统总览</h2>' + kpis + '</div>' +
      '<div class="card"><h2>业务域分布</h2>' + dom +
      '<p class="mini">提示：左侧「工厂建模」为第一层，逐级展开模块与表；带「主」标记的表支持主子表联动——点开一条主表记录即可查看其下产品 / 工序等明细。左侧「<b>生产看板 → 现场驾驶舱</b>」为每次刷新默认落地的实时状态视图；也可到「使用说明」了解某张表的来源与去向，到「<b>核心流程</b>」查看全局业务流图（可用右上角「⚙ 显示设置」把它加到顶栏）。</p></div>';
  }
  function kpi(v, l) { return '<div class="kpi"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + '</div></div>'; }

  /* 数据模型（含字段定义 增/改/删） */
  function isCustomField(t, code) {
    var f = loadFields()[t]; if (!f) return false;
    return (f.added || []).some(function (c) { return c.code === code; }) || !!(f.modified && f.modified[code]);
  }
  function viewModel() {
    if (!st.table) st.table = firstTable();
    var opts = ''; Object.keys(S.TABLES).forEach(function (t) { opts += '<option value="' + t + '"' + (t === st.table ? ' selected' : '') + '>' + esc(S.TABLES[t].label) + ' (' + t + ')</option>'; });
    var cols = S.columnsOf(st.table);
    var h = '<div class="card"><h2>数据模型 · ' + esc(S.TABLES[st.table].label) + '</h2>' +
      '<div class="toolbar"><select id="modelSel" style="max-width:380px">' + opts + '</select>' +
      '<span class="mini">功能域 ' + esc(S.TABLES[st.table].module) + ' · 共 ' + cols.length + ' 字段</span>' +
      '<span class="spacer"></span><button class="primary sm" id="btnAddField">+ 新增字段</button><button class="ghost sm" id="toBrowser">进入数据浏览</button></div>';
    h += '<div class="tbl-wrap"><table class="modtbl"><thead><tr><th style="width:92px">顺序</th><th>编号</th><th>中文名</th><th>类型</th><th>必填</th><th>来源</th><th>显示</th><th style="width:130px">操作</th></tr></thead><tbody>';
    cols.forEach(function (c, ci) {
      var src = c.sys ? '系统通用' : (c.doc ? '单据通用' : '业务字段');
      if (isCustomField(st.table, c.code)) src = '自定义';
      var canEdit = !c.sys;
      var lock = (c.code === (S.TABLES[st.table].pk || 'ID') || c.code === 'ID');
      h += '<tr><td class="ord-act">' +
        '<button class="ghost sm" data-upfield="' + esc(c.code) + '" title="上移"' + (ci === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="ghost sm" data-downfield="' + esc(c.code) + '" title="下移"' + (ci === cols.length - 1 ? ' disabled' : '') + '>↓</button></td>' +
        '<td><code>' + esc(c.code) + '</code></td><td>' + esc(c.label) + (c.req ? '<span class="fld-req">*</span>' : '') + '</td><td>' + esc(c.type) + '</td><td>' + (c.req ? '是' : '') + '</td><td class="mini">' + src + '</td>' +
        '<td><input type="checkbox" data-modelvis="' + esc(c.code) + '" ' + (colOn(st.table, c.code) ? 'checked' : '') + (lock ? ' disabled title="主键不可隐藏"' : '') + ' style="width:auto"/></td>' +
        '<td class="fld-act">' + (canEdit ? '<button class="ghost sm" data-editfield="' + esc(c.code) + '">编辑</button> <button class="danger sm" data-delfield="' + esc(c.code) + '">删除</button>' : '<span class="mini">系统</span>') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="mini" style="margin-top:10px">提示：① 用「顺序」列的 ↑ / ↓ 可调整字段先后（备注已在最后，调整后自动保存）；② 可「新增 / 编辑 / 删除」业务字段（系统通用字段只读）；③ 「显示」列控制该字段在数据列表 / 表单 / 详情中是否显示（主键不可隐藏；品番类字段已默认隐藏，需要时勾上即可）。自定义字段、顺序与显示配置均已本地持久化，重置演示数据会一并清除。</p>';
    // 主子表关系
    var rel = '';
    var asMaster = S.MASTER_DETAIL[st.table];
    if (asMaster) { rel += '本表为主表，包含子表：' + asMaster.map(function (d) { return '<b>' + esc(S.TABLES[d.table].label) + '</b>（' + esc(d.fk) + '）'; }).join('、') + '。'; }
    var asChild = Object.keys(S.MASTER_DETAIL).filter(function (k) { return S.MASTER_DETAIL[k].some(function (d) { return d.table === st.table; }); });
    if (asChild.length) { rel += '本表为子表，隶属于主表：' + asChild.map(function (k) { return '<b>' + esc(S.TABLES[k].label) + '</b>'; }).join('、') + '。'; }
    if (rel) h += '<div class="rel-note">主子表关系：' + rel + '</div>';
    h += '</div>';
    return h;
  }

  /* ---------- 字段定义 新增/编辑/删除 ---------- */
  function openFieldForm(t, code) {
    var def = S.TABLES[t];
    var existing = code ? S.columnsOf(t).find(function (c) { return c.code === code; }) : null;
    var isEdit = !!existing;
    var body = '<div class="fgrid">';
    body += '<div class="fitem full"><label>编号<code>code</code></label><input type="text" id="ff_code" value="' + esc(code || '') + '" ' + (isEdit ? 'readonly' : '') + ' placeholder="如 CUSTOMER_LEVEL（字母开头）"/></div>';
    body += '<div class="fitem"><label>中文名</label><input type="text" id="ff_label" value="' + esc(existing ? existing.label : '') + '" placeholder="如 客户等级"/></div>';
    body += '<div class="fitem"><label>类型</label><select id="ff_type">' + ['s', 'i', 'd', 'da', 'dt', 'x', 'j', 'b'].map(function (tp) { return '<option value="' + tp + '"' + (existing && existing.type === tp ? ' selected' : '') + '>' + tp + '</option>'; }).join('') + '</select></div>';
    body += '<div class="fitem"><label>必填</label><input type="checkbox" id="ff_req" ' + (existing && existing.req ? 'checked' : '') + ' style="width:auto"/></div>';
    body += '</div>';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = (isEdit ? '编辑' : '新增') + '字段 · ' + def.label;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalCancel').textContent = '取 消';
    document.getElementById('modalMask').style.display = 'flex';
    document.getElementById('modalSave').onclick = function () {
      var fcode = document.getElementById('ff_code').value.trim();
      var flabel = document.getElementById('ff_label').value.trim();
      var ftype = document.getElementById('ff_type').value;
      var freq = document.getElementById('ff_req').checked ? 1 : 0;
      if (!fcode || !flabel) { toast('请填写编号与中文名'); return; }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(fcode)) { toast('编号须以字母开头，仅含字母/数字/下划线'); return; }
      if (!isEdit && S.columnsOf(t).some(function (c) { return c.code === fcode; })) { toast('编号已存在'); return; }
      if (isEdit && fcode !== code) { toast('编号不可修改（可删除后重新新增）'); return; }
      recordField(t, isEdit ? 'modify' : 'add', { code: fcode, label: flabel, type: ftype, req: !!freq });
      applyCustomFields();
      closeModal();
      toast(isEdit ? '已更新字段 ' + fcode : '已新增字段 ' + fcode);
      render();
    };
  }
  function deleteField(t, code) {
    var col = S.columnsOf(t).find(function (c) { return c.code === code; });
    if (!col) return;
    var u = fieldUsage(t, code);
    var msg = '确认删除字段「' + col.label + '」(' + code + ') ？';
    var warn = [];
    if (u.dataCount > 0) warn.push('该字段下存在 ' + u.dataCount + ' 条业务数据，删除后将无法再显示');
    if (u.links.length) warn.push('该字段是关联字段：' + u.links.join('；'));
    if (warn.length) msg += '\n\n⚠ 关联提示：\n- ' + warn.join('\n- ') + '\n\n仍要删除吗？';
    else msg += '\n（无关联数据 / 单据依赖）';
    if (confirm(msg)) { recordField(t, 'remove', { code: code }); applyCustomFields(); toast('已删除字段 ' + code); render(); }
  }

  /* 数据浏览（主子表联动） */
  /* ---------- 查询：支持多字段用 ; 隔开（字段:值）模糊查询 ---------- */
  function applyQuery(list, table, q) {
    q = (q || '').trim();
    if (!q) return list;
    var colMap = displayCols(table);
    function resolveCol(name) {
      name = name.toLowerCase();
      return colMap.find(function (c) {
        var l = c.label.toLowerCase(), k = c.code.toLowerCase();
        return l === name || k === name || l.indexOf(name) >= 0 || k.indexOf(name) >= 0;
      });
    }
    var segs = q.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    var fieldConds = [], globalTerms = [];
    segs.forEach(function (seg) {
      var i = seg.indexOf(':');
      if (i > 0) {
        var fname = seg.slice(0, i), fval = seg.slice(i + 1).trim();
        var col = resolveCol(fname);
        if (col && fval) { fieldConds.push({ col: col, val: fval.toLowerCase() }); return; }
      }
      globalTerms.push(seg.toLowerCase());
    });
    return list.filter(function (r) {
      for (var k = 0; k < fieldConds.length; k++) {
        var c = fieldConds[k];
        var v = String(r[c.col.code] == null ? '' : r[c.col.code]).toLowerCase();
        if (v.indexOf(c.val) < 0) return false;
      }
      for (var j = 0; j < globalTerms.length; j++) {
        var g = globalTerms[j];
        var hit = colMap.some(function (c) { return String(r[c.code] == null ? '' : r[c.code]).toLowerCase().indexOf(g) >= 0; });
        if (!hit) return false;
      }
      return true;
    });
  }

  /* ---------- 查询：点击「查询」按钮或回车才执行（非实时筛选） ---------- */
  function doQuery() {
    var s = document.getElementById('search');
    st.search = s ? s.value : '';
    st.page = 1;                 // 换查询条件 → 回到第 1 页
    srvInvalidate();
    var c = document.getElementById('content'); c.innerHTML = viewBrowser(); bindView();
  }

  function viewBrowser() {
    if (!st.table) st.table = firstTable();
    var def = S.TABLES[st.table];
    var isRpt = isReportTable(st.table);
    var children = isRpt ? [] : (S.MASTER_DETAIL[st.table] || []);
    var isMaster = children.length > 0;
    var q = (st.search || '').trim();
    st.sel = st.sel || {}; if (!st.sel[st.table]) st.sel[st.table] = {};
    var selSet = st.sel[st.table];
    var selCount = Object.keys(selSet).length;
    /* 分页：BE 绑定表走服务端（可翻全表），报表/派生表走前端切片 */
    var pageSize = st.pageSize || 20;
    var srvMode = !isRpt && BE.on(st.table) && BE.available();
    var totalCount = 0, list = [], loadingTxt = '';
    if (srvMode) {
      var key = st.table + '|' + q + '|' + pageSize + '|' + st.page;
      if (SRV.key !== key) { srvFetch(st.table, q, pageSize, st.page); loadingTxt = '加载中…'; }
      totalCount = SRV.total || 0;
      list = (SRV.key === key) ? SRV.rows : [];
      /* 页码越界（删掉最后一页的数据 / 改小每页条数）→ 落到最后一页重新取 */
      if (SRV.key === key && SRV.total > 0 && st.page > pageCount(SRV.total, pageSize)) {
        st.page = pageCount(SRV.total, pageSize); srvInvalidate(); return viewBrowser();
      }
    } else {
      var all = rows(st.table);
      var filtered = applyQuery(all, st.table, q);
      totalCount = filtered.length;
      var pages = pageCount(totalCount, pageSize);
      if (st.page > pages) st.page = pages;
      list = filtered.slice((st.page - 1) * pageSize, st.page * pageSize);
    }
    PG.total = totalCount; PG.size = pageSize;

    var tag = isMaster ? '<span class="tag ok" style="margin-left:6px">主表 · 含子表明细</span>' : (def.detail ? '<span class="tag warn" style="margin-left:6px">子表</span>' : '');
    if (isRpt) tag += '<span class="tag" style="margin-left:6px">生产报表 · 只读</span>';
    var selTxt = selCount ? '，已选 ' + selCount + ' 条 <button class="link sm" id="btnClearSel">清除</button>' : '';
    /* 表名旁 = 一个「表功能」按钮：点开才在其下方展开三项（业务流 / 字段定义 / 显示字段），
       取代原先平铺的三个按钮；表名旁的英文表名（原 st.table）按需求不再显示。
       报表页只读，不挂此入口。三个子项沿用原 id，事件绑定逻辑不变。 */
    var h2btns = isRpt ? '' : '<span class="h2btns">' +
      '<button class="ghost sm" id="btnH2Menu" aria-haspopup="true" aria-expanded="false">表功能 ▾</button>' +
      '<span class="h2menu" id="h2menu" hidden>' +
      '<button class="ghost sm" id="btnFlow">业务流</button>' +
      '<button class="ghost sm" id="btnModel">字段定义</button>' +
      '<button class="ghost sm" id="btnCols">显示字段</button>' +
      '<button class="ghost sm" id="btnTrash">回收站</button>' +
      '</span></span>';
    var h = '<div class="card"><h2>' + esc(def.label) + tag + h2btns + '</h2>';
    h += '<div class="toolbar">' +
      '<input id="search" class="q" placeholder="模糊查询（多字段用 ; 隔开，如 物料:M001;环节:采购入库）" title="支持多字段组合查询，用英文分号 ; 隔开，例如：物料:M001;环节:采购入库" value="' + esc(st.search) + '"/>' +
      '<button class="primary sm" id="btnQuery">查询</button>' +
      '<span class="mini">共 ' + totalCount + ' 条' + (q ? '（按查询条件）' : '') + (loadingTxt ? ' · ' + loadingTxt : (BOOTING ? ' · 加载中…' : '')) + selTxt + '</span>' +
      '<span class="spacer"></span>';
    if (isRpt) {
      /* 生产报表：表内数据由业务数据实时汇总，只保留「查询 / 导出」 */
      h += '<button class="ghost sm" id="btnExport">导出</button>';
    } else {
      /* 业务流 / 字段定义 / 显示字段 已移到表名旁（见上方 h2btns） */
      h += '<button class="ghost sm" id="btnImport">导入</button>' +
        '<button class="ghost sm" id="btnExport">导出</button>' +
        '<button class="ghost sm" id="btnPrint">打印</button>' +
        '<button class="ghost sm" id="btnAudit">审核</button>' +
        /* 「删除」置于「+ 新增」之前：作用于左侧已勾选的多条（见 doBatchDelete） */
        '<button class="danger sm" id="btnDelSel">删除</button>' +
        '<button class="primary" id="btnAdd">+ 新增</button>';
    }
    h += '</div>';
    if (isRpt) {
      h += '<p class="mini" style="margin:-4px 0 12px">生产报表为只读视图：数据由「订单 / 采购 / 工单 / 报工 / 出入库 / 检验 / 设备」等业务表<b>实时汇总</b>，上游任何新增或修改都会自动反映到这里，因此本页只提供「查询 / 导出」。</p>';
    }

    if (list.length === 0) {
      var emptyTxt = srvMode
        ? (loadingTxt ? '正在从后端读取…' : (SRV.err ? '读取失败：' + esc(SRV.err) : '没有匹配的记录（当前查询条件下 0 条）。'))
        : (BOOTING ? '正在从后端读取数据…（首次加载需数秒，不会显示演示数据）'
          : (isRpt ? '当前无汇总数据（上游暂无相关业务记录）。' : '暂无数据，点击「新增」创建记录。'));
      h += '<div class="empty">' + emptyTxt + '</div>';
      h += pagerHtml(totalCount, st.page, pageSize);
      h += '</div>';
      return h;
    }

    if (isMaster) {
      // 主表网格（点击行弹出单据详情）
      h += '<div class="mini" style="margin-bottom:8px">点击任意一行打开单据详情（主表信息 + 子表明细）。</div>';
      h += '<div class="tbl-wrap"><table class="grid"><thead><tr><th class="chkcol"><input type="checkbox" id="chkAll" title="全选本页（跨页已选项保留）"></th>';
      var mc = displayCols(st.table);
      mc.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      h += '<th>子表明细</th></tr></thead><tbody>';
      list.forEach(function (r) {
        var checked = selSet[r.ID] ? ' checked' : '';
        h += '<tr class="master-row" data-doc="' + esc(r.ID) + '">';
        h += '<td class="chkcol"><input type="checkbox" class="rowchk" data-id="' + esc(r.ID) + '"' + checked + '></td>';
        /* 首列「单号」即编辑入口：点单号打开编辑表单；stopPropagation 以免冒泡触发整行「单据详情」 */
        mc.forEach(function (c) {
          if (c.code === def.pk) h += '<td class="pk"><a class="pk-link" data-edit="' + esc(r.ID) + '" title="点击编辑该单据">' + cellValue(r, c) + '</a></td>';
          else h += '<td>' + cellValue(r, c) + '</td>';
        });
        var badges = children.map(function (d) {
          var n = rows(d.table).filter(function (x) { return String(x[d.fk]) === String(r[d.fk]); }).length;
          return '<span class="badge-line">' + esc(S.TABLES[d.table].label) + ' ' + n + '</span>';
        }).join('');
        h += '<td>' + badges + '</td></tr>';
      });
      h += '</tbody></table></div>';
      h += pagerHtml(totalCount, st.page, pageSize);
    } else {
      // 普通 / 子表 / 报表：扁平网格（报表只读、无操作列）
      h += '<div class="tbl-wrap"><table class="grid"><thead><tr><th class="chkcol"><input type="checkbox" id="chkAll" title="全选本页（跨页已选项保留）"></th>';
      var dc = displayCols(st.table);
      var bcCol = isRpt ? '' : barcodeColOf(st.table);   // 只有存在条码列的表才需要「操作」列
      dc.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      if (bcCol) h += '<th>操作</th>';
      h += '</tr></thead><tbody>';
      list.forEach(function (r) {
        var checked = selSet[r.ID] ? ' checked' : '';
        h += '<tr>';
        h += '<td class="chkcol"><input type="checkbox" class="rowchk" data-id="' + esc(r.ID) + '"' + checked + '></td>';
        /* 编辑入口 = 首列「单号」（与原行内「编辑」按钮同语义 openForm）；删除改由工具栏批量执行 */
        dc.forEach(function (c) {
          if (!isRpt && c.code === def.pk) h += '<td class="pk"><a class="pk-link" data-edit="' + esc(r.ID) + '" title="点击编辑该记录">' + cellValue(r, c) + '</a></td>';
          else h += '<td class="' + (c.code === def.pk ? 'pk' : '') + '">' + cellValue(r, c) + '</td>';
        });
        if (bcCol) h += '<td><button class="ghost sm" data-qrrow="' + esc(r.ID) + '" title="查看条码 / 二维码并追溯">条码</button></td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
      h += pagerHtml(totalCount, st.page, pageSize);
    }
    h += '</div>';
    return h;
  }

  function childPanel(mrec, link) {
    var ctab = link.table, fk = link.fk;
    var cdef = S.TABLES[ctab];
    var fkVal = mrec[fk];
    var lines = rows(ctab).filter(function (r) { return String(r[fk]) === String(fkVal); });
    var cols = displayColsExcept(ctab, fk);
    var h = '<div class="detail-panel" data-ct="' + ctab + '">';
    h += '<div class="dp-head"><span class="dp-title">子表 · ' + esc(cdef.label) + ' <code>' + esc(ctab) + '</code></span>' +
      '<span class="mini">' + lines.length + ' 行 · 关联 ' + esc(fk) + ' = ' + esc(fkVal) + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="ghost sm" data-impchild="' + ctab + '">导入明细</button>' +
      '<button class="ghost sm" data-addchild="' + ctab + '">+ 新增明细</button></div>';
    if (lines.length === 0) { h += '<div class="empty sm">暂无明细，点击「新增明细」添加' + esc(cdef.label) + '。</div>'; }
    else {
      h += '<div class="tbl-wrap"><table class="grid sm"><thead><tr>';
      cols.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      h += '<th>操作</th></tr></thead><tbody>';
      lines.forEach(function (r) {
        h += '<tr>'; cols.forEach(function (c) { h += '<td' + (c.code === cdef.pk ? ' class="pk"' : '') + '>' + cellValue(r, c) + '</td>'; });
        h += '<td><button class="ghost sm" data-editc="' + ctab + '|' + esc(r.ID) + '">编辑</button> <button class="danger sm" data-delc="' + ctab + '|' + esc(r.ID) + '">删除</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';
    return h;
  }

  function bindView() {
    if (st.view === 'model') {
      var sel = document.getElementById('modelSel'); if (sel) sel.onchange = function () { st.table = sel.value; render(); };
      var tb = document.getElementById('toBrowser'); if (tb) tb.onclick = function () { st.view = 'browser'; setNav(); render(); };
      var af = document.getElementById('btnAddField'); if (af) af.onclick = function () { openFieldForm(st.table, null); };
      document.querySelectorAll('[data-editfield]').forEach(function (b) { b.onclick = function () { openFieldForm(st.table, b.getAttribute('data-editfield')); }; });
      document.querySelectorAll('[data-delfield]').forEach(function (b) { b.onclick = function () { deleteField(st.table, b.getAttribute('data-delfield')); }; });
      document.querySelectorAll('[data-upfield]').forEach(function (b) { b.onclick = function () { moveField(st.table, b.getAttribute('data-upfield'), -1); render(); }; });
      document.querySelectorAll('[data-downfield]').forEach(function (b) { b.onclick = function () { moveField(st.table, b.getAttribute('data-downfield'), 1); render(); }; });
      document.querySelectorAll('[data-modelvis]').forEach(function (cb) {
        cb.onchange = function () { setColVis(st.table, cb.getAttribute('data-modelvis'), cb.checked); toast(cb.checked ? '已显示该字段' : '已隐藏该字段'); };
      });
    }
    if (st.view === 'browser') {
      st.sel = st.sel || {}; if (!st.sel[st.table]) st.sel[st.table] = {};
      var selSet = st.sel[st.table];
      var selCount = Object.keys(selSet).length;
      var s = document.getElementById('search');
      if (s) {
        s.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); doQuery(); } };
        s.oninput = function () { /* 输入不实时筛选，点击「查询」或按回车才执行 */ };
      }
      var bq = document.getElementById('btnQuery'); if (bq) bq.onclick = doQuery;
      var ba = document.getElementById('btnAdd'); if (ba) ba.onclick = function () { openForm(st.table, null, null); };
      var bm = document.getElementById('btnModel'); if (bm) bm.onclick = function () { gotoView('model'); };
      /* 「业务流」与本表「使用说明」绑定（来源 / 去向 + 如何操作），不再跳「核心流程」 */
      var bf = document.getElementById('btnFlow'); if (bf) bf.onclick = function () { st.view = 'guide'; setNav(); render(); };
      var bi = document.getElementById('btnImport'); if (bi) bi.onclick = function () { openImport(st.table); };
      var bx = document.getElementById('btnExport'); if (bx) bx.onclick = function () { exportCsv(st.table, selCount, currentPageRows(st.table)); };
      var bp = document.getElementById('btnPrint'); if (bp) bp.onclick = function () { doPrint(st.table, selCount, currentPageRows(st.table)); };
      var bu = document.getElementById('btnAudit'); if (bu) bu.onclick = function () { openAudit(st.table, null); };
      var bd = document.getElementById('btnDelSel'); if (bd) bd.onclick = doBatchDelete;
      var bc = document.getElementById('btnCols'); if (bc) bc.onclick = function () { openColVis(st.table); };
      var bt = document.getElementById('btnTrash'); if (bt) bt.onclick = function () { openTrash(st.table); };
      /* 「表功能」下拉：默认收起，点按钮才展开；点页面其它地方自动收起（见全局委托） */
      var bH2Menu = document.getElementById('btnH2Menu'), mH2Menu = document.getElementById('h2menu');
      if (bH2Menu && mH2Menu) bH2Menu.onclick = function (e) {
        e.stopPropagation();
        mH2Menu.hidden = !mH2Menu.hidden;
        bH2Menu.setAttribute('aria-expanded', mH2Menu.hidden ? 'false' : 'true');
      };
      var bclr = document.getElementById('btnClearSel'); if (bclr) bclr.onclick = function () { st.sel[st.table] = {}; render(); };
      var chkAll = document.getElementById('chkAll');
      if (chkAll) chkAll.onchange = function () {
        document.querySelectorAll('.rowchk').forEach(function (cb) {
          var id = cb.getAttribute('data-id');
          if (chkAll.checked) selSet[id] = true; else delete selSet[id];
          cb.checked = chkAll.checked;
        });
        render();
      };
      document.querySelectorAll('.rowchk').forEach(function (cb) {
        cb.onclick = function (e) { e.stopPropagation(); };
        cb.onchange = function () {
          var id = cb.getAttribute('data-id');
          if (cb.checked) selSet[id] = true; else delete selSet[id];
          render();
        };
      });
      document.querySelectorAll('.master-row').forEach(function (tr) { tr.onclick = function () { openDoc(st.table, tr.getAttribute('data-doc')); }; });
      document.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openForm(st.table, b.getAttribute('data-edit'), null); }; });
      document.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); if (confirm('确认删除该记录？删除后进入回收站，可在「表功能 ▾ → 回收站」恢复。')) { remove(st.table, b.getAttribute('data-del')); toast('已移入回收站'); render(); } }; });
      document.querySelectorAll('[data-qrrow]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openBarcode(st.table, b.getAttribute('data-qrrow')); }; });
      /* ---- 分页控件 ---- */
      function goPage(n) {
        var p = parseInt(n, 10);
        if (!p || isNaN(p)) return;
        var pages = pageCount(PG.total, PG.size);
        p = Math.min(Math.max(p, 1), pages);
        if (p === st.page) return;
        st.page = p;
        render();
      }
      var pgSizeEl = document.getElementById('pgSize');
      if (pgSizeEl) pgSizeEl.onchange = function () {
        var v = parseInt(this.value, 10) || 20;
        st.pageSize = Math.min(Math.max(v, 10), 200);
        st.page = 1; srvInvalidate();
        try { localStorage.setItem('mes_pageSize', String(st.pageSize)); } catch (e) {}
        render();
      };
      document.querySelectorAll('[data-pgnum]').forEach(function (b) { b.onclick = function () { goPage(b.getAttribute('data-pgnum')); }; });
      var pgPrev = document.querySelector('[data-pgprev]'); if (pgPrev) pgPrev.onclick = function () { goPage(st.page - 1); };
      var pgNext = document.querySelector('[data-pgnext]'); if (pgNext) pgNext.onclick = function () { goPage(st.page + 1); };
      var pgJump = document.getElementById('pgJump');
      if (pgJump) {
        pgJump.onchange = function () { goPage(pgJump.value); };
        pgJump.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); goPage(pgJump.value); } };
      }
    }
    if (st.view === 'flow') bindFlow();
    if (st.view === 'board') bindBoard();
  }

  /* ---------- 表单弹窗 ---------- */
  /* 时间显示统一到「秒」：库里可能是 "2026-10-20 08:00:00+00"、"…T08:00:00.000Z" 等，
   * 一律归一成 "YYYY-MM-DD HH:mm:ss"（去掉时区后缀与毫秒，不补时区换算）。 */
  function fmtDT(v) {
    if (v === null || v === undefined || v === '') return '';
    var s = String(v).replace('T', ' ');
    if (s.indexOf(':') < 0) return s.slice(0, 10);   // 纯日期，别再动
    s = s.replace(/\.\d+/, '').replace(/\s*[+-]\d{2}(:?\d{2})?$/, '').replace(/Z$/, '');
    return s.slice(0, 19);
  }
  /* datetime-local 输入框的值：必须是 "YYYY-MM-DDTHH:mm:ss"（带秒，配合 step=1） */
  function toLocalDT(v) { if (!v) return ''; return fmtDT(v).replace(' ', 'T'); }
  function fromLocalDT(v) {
    if (!v) return '';
    var s = String(v).replace('T', ' ');
    if (s.length === 16) s += ':00';   // 浏览器在秒为 0 时可能省略 ":00"
    return s.slice(0, 19);
  }
  function inputHtml(col, val) {
    var name = 'f_' + col.code; var v = val == null ? '' : val;
    if (col.derive) return '<input type="text" id="' + name + '" value="' + esc(v) + '" readonly data-derived="' + esc(col.derive) + '" title="由「' + esc(col.derive) + '」自动带出，不可修改" style="opacity:.8;cursor:not-allowed"/>';
    if (col.ref || col.dict) return '<select id="' + name + '">' + refOptions(col.ref, v, col) + '</select>';
    if (col.type === 'b') return '<input type="checkbox" id="' + name + '" ' + (v ? 'checked' : '') + '" style="width:auto"/>';
    if (col.type === 'x') return '<textarea id="' + name + '">' + esc(v) + '</textarea>';
    if (col.type === 'j') return '<textarea id="' + name + '" placeholder="JSON">' + esc(typeof v === 'object' ? JSON.stringify(v) : v) + '</textarea>';
    /* 日期字段：库里是 timestamptz（如 "2026-10-20 00:00:00+00"），
     * <input type="date"> 只认 "YYYY-MM-DD"，塞完整时间串浏览器会当非法值 **显示空白**。
     * 后果：保存明明成功，下次打开还是空的，看起来像"改了没生效"（2026-10-20 用户反馈 C001 启用时间）。 */
    if (col.type === 'da') return '<input type="date" id="' + name + '" value="' + esc(v == null ? '' : String(v).slice(0, 10)) + '"/>';
    if (col.type === 'dt') return '<input type="datetime-local" step="1" id="' + name + '" value="' + esc(toLocalDT(v)) + '"/>';
    if (col.type === 'i') return '<input type="number" step="1" id="' + name + '" value="' + esc(v) + '"/>';
    if (col.type === 'd') return '<input type="number" step="0.0001" id="' + name + '" value="' + esc(v) + '"/>';
    return '<input type="text" id="' + name + '" value="' + esc(v) + '"/>';
  }
  /* ---------- 主子表合并表单 ---------- */
  /* 取子表用于行编辑的字段（去掉外键，最多 7 个） */
  function fkColsOf(ct) {
    var fks = [];
    Object.keys(S.MASTER_DETAIL).forEach(function (m) { S.MASTER_DETAIL[m].forEach(function (d) { if (d.table === ct) fks.push(d.fk); }); });
    return fks;
  }
  function editCols(ct) {
    var fks = fkColsOf(ct);
    var def = S.TABLES[ct];
    var cs = S.columnsOf(ct).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); });
    var head = [];
    if (def.pk && def.pk !== 'ID' && fks.indexOf(def.pk) < 0) head.push(cs.find(function (c) { return c.code === def.pk; }));
    cs.forEach(function (c) { if (head.indexOf(c) < 0 && fks.indexOf(c.code) < 0) head.push(c); });
    return head.filter(Boolean).slice(0, 7);
  }
  function lineInput(ct, i, c, v) {
    var attr = ' data-cell="' + ct + '|' + i + '|' + c.code + '"';
    var cls = 'cell-in' + (/QTY|QUANTITY|PRICE|AMOUNT|RATE/.test(c.code) ? ' num' : '');
    if (c.derive) return '<input type="text" class="' + cls + '"' + attr + ' value="' + esc(v) + '" readonly title="由「' + esc(c.derive) + '」自动带出，不可修改" style="opacity:.8;cursor:not-allowed"/>';
    if (c.ref || c.dict) return '<select class="' + cls + '"' + attr + '>' + refOptions(c.ref, v, c) + '</select>';
    if (c.type === 'b') return '<input type="checkbox"' + attr + (v ? ' checked' : '') + '/>';
    if (c.type === 'da') return '<input type="date" class="' + cls + '"' + attr + ' value="' + esc(v == null ? '' : String(v).slice(0, 10)) + '"/>';
    if (c.type === 'dt') return '<input type="datetime-local" step="1" class="' + cls + '"' + attr + ' value="' + esc(toLocalDT(v)) + '"/>';
    if (c.type === 'i') return '<input type="number" step="1" class="' + cls + '"' + attr + ' value="' + esc(v) + '"/>';
    if (c.type === 'd') return '<input type="number" step="0.0001" class="' + cls + '"' + attr + ' value="' + esc(v) + '"/>';
    return '<input type="text" class="' + cls + '"' + attr + ' value="' + esc(v) + '"/>';
  }
  function lineTotalsHtml(ct, arr) {
    var codes = S.columnsOf(ct).map(function (c) { return c.code; });
    var amtC = codes.find(function (c) { return /AMOUNT|TOTAL_PRICE/.test(c); });
    var qtyC = codes.find(function (c) { return /QTY|QUANTITY/.test(c); });
    var out = [];
    function fmt(n) { return '¥' + (+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    if (qtyC) out.push('<span>数量合计：<b>' + arr.reduce(function (a, r) { return a + (+r[qtyC] || 0); }, 0) + '</b></span>');
    if (amtC) out.push('<span>金额合计：<b class="tot-hot">' + fmt(arr.reduce(function (a, r) { return a + (+r[amtC] || 0); }, 0)) + '</b></span>');
    return out.join('');
  }
  function linesHtml(children, lineData) {
    var h = '';
    children.forEach(function (d) {
      var ct = d.table, cdef = S.TABLES[ct], ecs = editCols(ct);
      var arr = lineData[ct] || [];
      h += '<div class="form-sec" data-sec="' + ct + '"><div class="fs-head"><b>' + esc(cdef.label) + '</b><span class="mini">' + esc(ct) + '</span><span class="spacer"></span><button type="button" class="ghost sm" data-addline="' + ct + '">+ 添加' + esc(cdef.label.replace(/明细$/, '')) + '</button></div>';
      if (arr.length === 0) {
        h += '<div class="lines-empty">请点击「添加」按钮添加明细行</div>';
      } else {
        h += '<div class="tbl-wrap lines-wrap"><table class="lines-tbl"><thead><tr>';
        ecs.forEach(function (c) { h += '<th>' + esc(c.label) + (c.req ? ' <span class="req">*</span>' : '') + '</th>'; });
        h += '<th style="width:48px">操作</th></tr></thead><tbody>';
        arr.forEach(function (ln, i) {
          h += '<tr>';
          ecs.forEach(function (c) { h += '<td>' + lineInput(ct, i, c, ln[c.code]) + '</td>'; });
          h += '<td style="text-align:center"><button type="button" class="delline" data-delline="' + ct + '|' + i + '" title="删除该行">✕</button></td></tr>';
        });
        h += '</tbody></table></div>';
        h += '<div class="lines-foot">' + lineTotalsHtml(ct, arr) + '</div>';
      }
      h += '</div>';
    });
    return h;
  }

  function openForm(t, id, preset) {
    /* 表单里的引用下拉（客户 / 供方 / 品号 / 工序…）是「点开才取数」，先把依赖表拉齐再渲染 */
    if (needDeps(t, function () { openForm(t, id, preset); })) return;
    var def = S.TABLES[t]; var row = id ? find(t, id) : null;
    var fromDoc = st.doc; st.doc = fromDoc; // 若从单据详情进入：保留上下文，可「返回单据详情」，保存后也回到详情
    var cols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); }).filter(function (c) { return colOn(t, c.code); });
    var isMaster = !preset && S.MASTER_DETAIL[t] && S.MASTER_DETAIL[t].length > 0;
    var children = isMaster ? S.MASTER_DETAIL[t] : [];
    var lineData = {};
    children.forEach(function (d) {
      lineData[d.table] = row ? rows(d.table).filter(function (r) { return String(r[d.fk]) === String(row[d.fk]); }).map(function (r) {
        var o = { _id: r.ID };
        S.columnsOf(d.table).forEach(function (c) { if (!(c.sys && c.code !== 'REMARK')) o[c.code] = r[c.code]; });
        return o;
      }) : [];
    });

    var body = '<div class="fgrid">';
    cols.forEach(function (c) {
      var full = (c.type === 'x' || c.type === 'j');
      var v = row ? row[c.code] : (preset && preset[c.code] != null ? preset[c.code] : '');
      body += '<div class="fitem' + (full ? ' full' : '') + '"><label>' + esc(c.label) + (c.req ? ' <span class="req">*</span>' : '') + '</label>' + inputHtml(c, v) + '</div>';
    });
    body += '</div>';
    /* 审计信息：谁建的、谁改的。只读展示，值由服务端按 supOS 登录身份强制写入 */
    if (row) {
      body += '<div class="audit-line">创建人 <b>' + esc(row.CREATE_BY || '—') + '</b> <span class="mini">' + esc(fmtDT(row.CREATE_TIME) || '') + '</span>'
        + '　·　修改人 <b>' + esc(row.UPDATE_BY || '—') + '</b> <span class="mini">' + esc(fmtDT(row.UPDATE_TIME) || '') + '</span></div>';
    }
    if (barcodeColOf(t) && !preset) body += '<div class="detail-panel bc-panel" id="bcPreview" style="margin-top:14px"></div>';
    if (isMaster) body += '<div id="linesArea">' + linesHtml(children, lineData) + '</div>';
    body += tableFlowPanel(t, id);

    document.getElementById('modal').classList.toggle('wide', isMaster);
    document.getElementById('modalTitle').textContent = (row ? '编辑' : '新增') + def.label;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalMask').style.display = 'flex';
    /* 从单据详情进入（编辑子表明细 / 新增明细 / 改单据）：把「保存 / 取消」恢复成表单语义，
       取消 = 返回单据详情（而非关闭整个弹窗），并提供显式的「返回单据详情」入口。 */
    var mSave = document.getElementById('modalSave');
    var mCancel = document.getElementById('modalCancel');
    mSave.style.display = '';
    mSave.textContent = '保 存';
    if (fromDoc) {
      mCancel.textContent = '返回单据详情';
      mCancel.onclick = function () { openDoc(fromDoc.t, fromDoc.id); };
      /* 标题/返回条区分两种入口：① 同一张表（「编辑单据」按钮）② 子表明细 */
      var sameTable = (fromDoc.t === t);
      var scopeTxt = sameTable ? '单据头' : '子表明细';
      var backBar = '<div class="toolbar" style="margin-bottom:6px"><span class="tag warn">从单据详情进入</span><span class="mini">' + esc(S.TABLES[fromDoc.t].label) + ' · ' + scopeTxt + '</span><span class="spacer"></span><button class="ghost sm" id="btnBackDoc">← 返回单据详情</button></div>';
      document.getElementById('modalTitle').innerHTML = esc((row ? '编辑' : '新增') + def.label) + ' <span class="mini">· ' + scopeTxt + '</span>';
      document.getElementById('modalBody').insertAdjacentHTML('afterbegin', backBar);
      document.getElementById('btnBackDoc').onclick = function () { openDoc(fromDoc.t, fromDoc.id); };
    } else {
      mCancel.textContent = '取 消';
      mCancel.onclick = closeModal;
    }

    function refreshLines() { var a = document.getElementById('linesArea'); if (a) { a.innerHTML = linesHtml(children, lineData); bindLines(); } }
    function autoAmount(ct, i, srcCode) {
      var codes = S.columnsOf(ct).map(function (c) { return c.code; });
      var amtC = codes.find(function (c) { return /AMOUNT/.test(c) && !/ORIGIN/.test(c); });
      var qtyC = codes.find(function (c) { return /QTY|QUANTITY/.test(c) && !/AMOUNT|ARRIVED|DUE/.test(c); });
      var prC = codes.find(function (c) { return /PRICE/.test(c) && !/TOTAL/.test(c); });
      if (!amtC || !qtyC || !prC || (srcCode !== qtyC && srcCode !== prC)) return;
      var ln = lineData[ct][i];
      ln[amtC] = +(((+ln[qtyC] || 0) * (+ln[prC] || 0)).toFixed(2));
      var inp = document.querySelector('[data-cell="' + ct + '|' + i + '|' + amtC + '"]');
      if (inp) inp.value = ln[amtC];
      var foot = document.querySelector('.form-sec[data-sec="' + ct + '"] .lines-foot');
      if (foot) foot.innerHTML = lineTotalsHtml(ct, lineData[ct]);
    }
    function bindLines() {
      var area = document.getElementById('linesArea'); if (!area) return;
      area.querySelectorAll('[data-addline]').forEach(function (b) {
        b.onclick = function () { var ct = b.getAttribute('data-addline'); lineData[ct].push({}); refreshLines(); };
      });
      area.querySelectorAll('[data-delline]').forEach(function (b) {
        b.onclick = function () { var p = b.getAttribute('data-delline').split('|'); lineData[p[0]].splice(+p[1], 1); refreshLines(); };
      });
      area.querySelectorAll('[data-cell]').forEach(function (inp) {
        inp.oninput = function () {
          var p = inp.getAttribute('data-cell').split('|'); var ct = p[0], i = +p[1], code = p[2];
          lineData[ct][i][code] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : inp.value;
          autoAmount(ct, i, code);
          lineDerive(ct, i, code);
        };
        inp.onchange = inp.oninput;
      });
    }
    bindLines();
    /* 联动带出（明细行）：源列（ref 下拉）变化 → 从被引用表取同名字段写进只读列 */
    function lineDerive(ct, i, srcCode) {
      var dcols = S.columnsOf(ct).filter(function (c) { return c.derive === srcCode; });
      if (!dcols.length) return;
      var sc = S.columnsOf(ct).filter(function (c) { return c.code === srcCode; })[0];
      var v = (lineData[ct][i] || {})[srcCode];
      var refRow = null;
      if (sc && sc.ref && v !== '' && v != null) {
        var pk = S.TABLES[sc.ref].pk;
        refRow = rows(sc.ref).filter(function (r) { return String(r[pk]) === String(v); })[0] || null;
      }
      dcols.forEach(function (tc) {
        var nv = deriveValue(refRow, tc.code, sc && sc.ref);
        lineData[ct][i][tc.code] = nv;
        var el = document.querySelector('[data-cell="' + ct + '|' + i + '|' + tc.code + '"]');
        if (el) el.value = nv;
      });
    }
    /* 联动带出（单据头）：源列变化 → 同步同名字段到只读列 */
    function bindDerives() {
      var bySrc = {};
      cols.forEach(function (c) { if (c.derive) (bySrc[c.derive] = bySrc[c.derive] || []).push(c); });
      Object.keys(bySrc).forEach(function (src) {
        var el = document.getElementById('f_' + src); if (!el) return;
        var sc = cols.filter(function (c) { return c.code === src; })[0];
        el.onchange = function () {
          var v = el.value, refRow = null;
          if (sc && sc.ref && v !== '' && v != null) {
            var pk = S.TABLES[sc.ref].pk;
            refRow = rows(sc.ref).filter(function (r) { return String(r[pk]) === String(v); })[0] || null;
          }
          bySrc[src].forEach(function (tc) {
            var te = document.getElementById('f_' + tc.code);
            if (te) te.value = deriveValue(refRow, tc.code, sc && sc.ref);
          });
        };
      });
    }
    bindDerives();

    /* 条码 / 二维码实时预览（物料资料 · 工序工单）：改动条码或二维码内容即时刷新 */
    (function bindBarcodePreview() {
      var bf = barcodeColOf(t); if (!bf) return;
      var box = document.getElementById('bcPreview'); if (!box) return;
      var ci = document.getElementById('f_' + bf), qi = document.getElementById('f_QR_CODE');
      function upd() {
        box.innerHTML = '<div class="dp-head"><span class="dp-title">条码 / 二维码 · 预览</span>' +
          '<span class="mini">保存后可在「单据详情」扫码或跳转追溯报表</span></div>' +
          bcVisual(t, ci ? ci.value : '', qi ? qi.value : '');
      }
      if (ci) { ci.oninput = upd; ci.onchange = upd; }
      if (qi) { qi.oninput = upd; qi.onchange = upd; }
      upd();
    })();

    /* 启用绑定：勾「是否启用」自动填启用时间（并清失效时间）；取消勾选自动填失效时间（并清启用时间） */
    (function bindEnable() {
      var flag = document.getElementById('f_ENABLE_FLAG');
      if (!flag) return;
      var fromI = document.getElementById('f_ENABLE_FROM');
      var toI = document.getElementById('f_ENABLE_TO');
      flag.onchange = function () {
        if (!fromI || !toI) return;
        if (flag.checked) { if (!fromI.value) fromI.value = today(); toI.value = ''; }
        else { if (!toI.value) toI.value = today(); fromI.value = ''; }
      };
    })();

    document.getElementById('modalSave').onclick = async function () {
      var btn = this;
      if (btn.disabled) return;           /* 保存中再点无效，避免同一单连发两次写 */
      var biz = {}; var ok = true; var msg = '';
      cols.forEach(function (c) {
        var el = document.getElementById('f_' + c.code); if (!el) return; var val;
        if (c.type === 'b') val = el.checked ? 1 : 0;
        else if (c.type === 'dt') val = fromLocalDT(el.value);
        else if (c.type === 'j') { val = el.value; if (val) { try { JSON.parse(val); } catch (e) { ok = false; msg = '字段 ' + c.code + ' 不是合法 JSON'; } } }
        else val = el.value;
        if (c.req && (val === '' || val == null) && c.code !== 'REMARK') { ok = false; msg = '请填写必填项：' + c.label; }
        biz[c.code] = val;
      });
      if (!ok) { toast(msg); return; }
      var merged = Object.assign({}, preset || {}, biz);
      /* 完工入库前置（与后端同一规则）：入库上架没报满，保存就拦下 */
      if (FINISH_IN_TABLES.indexOf(t) >= 0) {
        var fmsg = finishInBlock(merged.WO_NO);
        if (fmsg) { toast(fmsg); return; }
      }
      WA_CONFLICT = 0; WA_FORCED = 0; WA_FORCE_FAIL = null;
      /* ---------- 单号全表唯一：保存前先问后端（A 档） ----------
       * 只在「新增」或「单号被改过」时查一次；后端说 enforced=false（如明细表，业务键是父单号、天生多行）就不拦。
       * 命中直接拦下且**不关窗**：原来本地是先插进去、后端 409 只弹一个一闪而过的提示，
       * 用户看到的是「保存成功、列表里有这行」，库里其实没写进去。 */
      if (BE.on(t)) {
        var ukCol = (S.TABLES[t] || {}).pk;
        var ukVal = ukCol ? merged[ukCol] : '';
        var ukOld = (row && ukCol) ? row[ukCol] : undefined;
        var ukChanged = !row || String(ukVal == null ? '' : ukVal) !== String(ukOld == null ? '' : ukOld);
        if (ukCol && ukVal && ukChanged) {
          var ukRes = null;
          btn.disabled = true;
          try { ukRes = await BE.checkKey(t, ukVal); } catch (e) { ukRes = null; }
          btn.disabled = false;
          if (ukRes && ukRes.enforced && ukRes.taken) {
            toast('保存失败：' + fieldLabel(t, ukCol) + '「' + ukVal + '」已存在，请换一个');
            return;
          }
        }
      }
      var rec = row ? update(t, id, merged) : insert(t, merged);
      /* 保存子表明细：按 _id 走「增 / 改 / 删」，不再「本地标记 + 整批重建」。
       * 2026-10-19 修正：原来旧行只做本地 DEL_FLAG=1、不发删除请求，随后又整批 insert()，
       * 而明细表业务键是 (父单号, 行号)，后端 POST 的唯一性预查会直接 409「业务键已存在」，
       * 导致「编辑已有单据的明细行」根本写不进 UNS（前端只弹错误提示，本地看着却是成功的）。 */
      var savedLines = 0;
      children.forEach(function (d) {
        var ecs = editCols(d.table);
        var keep = {};      /* 本次仍保留的旧行（按本地 ID） */
        var plan = [];      /* 待落库的编辑器行 */
        (lineData[d.table] || []).forEach(function (ln, i) {
          if (ecs.every(function (c) { return ln[c.code] === undefined || ln[c.code] === ''; })) return;
          var lbiz = {};
          if (ln._id) { var orig = find(d.table, ln._id); if (orig) S.columnsOf(d.table).forEach(function (c) { if (!(c.sys && c.code !== 'REMARK')) lbiz[c.code] = orig[c.code]; }); }
          ecs.forEach(function (c) { lbiz[c.code] = ln[c.code]; });
          lbiz[d.fk] = rec[d.fk];
          if (lbiz.SEQ_NO === undefined || lbiz.SEQ_NO === '') lbiz.SEQ_NO = i + 1;
          if (ln._id) keep[ln._id] = 1;
          plan.push({ id: ln._id || null, biz: lbiz });
        });
        /* ① 编辑器里已去掉的旧行 → 删（2026-10-29 起为软删除，进回收站可恢复）。
         * 注意这里只遍历「本地已载入」的行（每表 200 行封顶）：编辑器里本来也看不到更多行，
         * 因此不会误删看不见的明细，但也删不到它们 —— 与编辑器的可见范围一致。 */
        rows(d.table).filter(function (r) { return String(r[d.fk]) === String(rec[d.fk]) && !keep[r.ID]; })
          .forEach(function (r) { remove(d.table, r.ID); });
        /* ② 保留的行 → 改；新行 → 增 */
        plan.forEach(function (p) {
          if (p.id && find(d.table, p.id)) update(d.table, p.id, p.biz);
          else insert(d.table, p.biz);
          savedLines++;
        });
      });
      save();
      /* 等后端确认再关窗：写请求（主表 + 明细）都挂在 PENDING_WRITES 上。
       * 冲突时 resolveConflict 已经用确认框让用户选「覆盖」或「放弃」，这里只报最终结果。 */
      if (PENDING_WRITES.length) {
        var label = btn.textContent;
        btn.disabled = true; btn.textContent = '保存中…';
        try { await Promise.all(PENDING_WRITES.splice(0)); } catch (e) {}
        btn.disabled = false; btn.textContent = label;
      }
      st.doc = fromDoc; // 交还给 closeModal，让「返回单据详情」链路不丢上下文
      closeModal();
      if (WA_FORCE_FAIL) {
        var fm = String((WA_FORCE_FAIL && WA_FORCE_FAIL.message) || WA_FORCE_FAIL);
        toast('覆盖也没成功：' + fm.slice(0, 70) + '（本次改动未保存）');
      }
      else if (WA_CONFLICT) toast(WA_FORCED ? '已覆盖保存（这条记录被别人改过）' : '保存被拒：这条记录已被别人改过，本次修改未写入');
      else toast(isMaster ? '已保存（含明细 ' + savedLines + ' 行）' : '已保存');
      render();
      if (fromDoc) openDoc(fromDoc.t, fromDoc.id);
    };
  }
  /* ---------- 单据流转（FOC 业务流，单源可多向） ---------- */
  function genDocNo(t) {
    var p = { SD_QUOTATION: '311', SD_SALES_ORDER: '5101', SD_DELIVERY: '2302', PD_PURCHASE_ORDER: 'PO', PD_ARRIVAL: '301', PD_RECEIPT: '3401', EX_WORK_ORDER: 'WO', EX_ISSUE_ORDER: '5401', EX_FINISH_IN: 'FIN', WM_INBOUND: 'WIN', WM_OUTBOUND: 'WOUT' }[t] || t.split('_')[0];
    return p + '-' + ymd() + '-' + String(Math.floor(Math.random() * 900) + 100);
  }
  /* ---------- 流转生成：目标表「必填」兜底 ----------
   * doFlow 只复制源单的同名列，但后端 server/main.js 的 validateRequired() 会按
   * server/tables.js 里的 required 逐表卡必填。源单里没有的字段（如报价单没有订单类型 /
   * 评审状态 / 交期）会让整笔 POST 400「缺少必填字段」——表现就是「界面说已生成，UNS 里没有」。
   * 这里按「来源表>目标表」逐条给出取值口径：只在目标字段为空时补，绝不覆盖源单已有值。
   *
   * 取值语法（字符串以 @ 开头才解析，否则当常量）：
   *   @today / @now / @now8     今天 / 当前时刻 / 8 小时后
   *   @user                     当前登录人
   *   @cnt                      源单明细行数
   *   @ln.FIELD                 源单明细第一行（无明细时回落源单同名字段）
   *   @sum.FIELD                源单明细合计
   *   @src.FIELD                源单字段
   *   @routeNo / @routeVer      按产品查生效工艺路线（查不到回落 RT_ROUTE 第一条 / V1.0）
   *   @firstStep / @equipOfStep 工单第一道工序 / 该工序设备
   *   @woOfProduct              按产品找已有工单（生产计划转排程时用）
   *   @lot / @loc               按品号（＋仓库）查批次库存的批次 / 库位
   *   @supplier                 物料默认供应商
   *   @customer                 客户资料第一行（成品入库转销货单时没有客户来源）
   *   @equipName                设备名称
   *   @woProduct / @woProductName 按工单号查工单产品
   *   @bomQty                   BOM 单台用量合计 × 工单计划数
   *   @qcResult                 NG > 0 → 不合格，否则合格
   */
  var FLOW_FILL = {
    'SD_QUOTATION>SD_SALES_ORDER':        { ORDER_TYPE: '标准订单', REVIEW_STATUS: '待评审', DELIVERY_DATE: '@deliveryDate' },
    'SD_SALES_ORDER>SD_DELIVERY':         { MAKE_DATE: '@today', WAREHOUSE_CODE: '成品仓', TOTAL_QTY: '@sum.ORDER_QTY' },
    'SD_SALES_ORDER>PP_MASTER_PLAN':      { ITEM_NO: '@ln.ITEM_NO', ITEM_NAME: '@ln.ITEM_NAME', PLAN_TYPE: '销售订单' },
    'SD_SALES_ORDER>EX_WORK_ORDER':       { WO_TYPE: '正式工单', PRODUCT_NO: '@ln.ITEM_NO', PRODUCT_NAME: '@ln.ITEM_NAME', PLAN_QTY: '@sum.ORDER_QTY', PLAN_START: '@today', PLAN_END: '@ln.DELIVERY_DATE', ROUTE_NO: '@routeNo', ROUTE_VER: '@routeVer' },
    'SD_SALES_ORDER>PD_PRICE_COMPARE':    { SOURCE_TYPE: '销售订单', ITEM_NO: '@ln.ITEM_NO', ITEM_NAME: '@ln.ITEM_NAME', REQ_QTY: '@sum.ORDER_QTY', REQ_DATE: '@ln.DELIVERY_DATE', SELECTED_SUPPLIER: '@supplier' },
    'PD_PRICE_COMPARE>PD_PURCHASE_ORDER': { SUPPLIER_CODE: '@src.SELECTED_SUPPLIER', RECV_WAREHOUSE: '原料仓', DELIVERY_DATE: '@src.REQ_DATE' },
    'PD_PURCHASE_ORDER>PD_ARRIVAL':       { ARRIVAL_DATE: '@today', IQC_FLAG: true },
    'PD_ARRIVAL>QC_INSPECTION':           { QC_TYPE: '来料检验(IQC)', ITEM_NO: '@ln.ITEM_NO', ITEM_NAME: '@ln.ITEM_NAME', QTY: '@sum.ARRIVAL_QTY', UNIT: '@ln.UNIT', PASS_QTY: 0, FAIL_QTY: 0, QC_RESULT: '待判定', INSPECTOR: '@user', INSPECT_DATE: '@today' },
    'PD_ARRIVAL>WM_INBOUND':              { IN_TYPE: '采购入库', ITEM_NO: '@src.ITEM_NO', WAREHOUSE_CODE: '原料仓', ACCEPT_QTY: '@sum.ARRIVAL_QTY' },
    'SD_DELIVERY>WM_OUTBOUND':            { OUT_TYPE: '销售出库', ITEM_NO: '@ln.ITEM_NO', WAREHOUSE_CODE: '成品仓', LOCATION: '@loc', LOT_NO: '@lot', OUT_QTY: '@sum.DELIVERY_QTY', ISSUE_BY: '@user', STOREKEEPER: '@user' },
    'PP_MASTER_PLAN>EX_WORK_ORDER':       { WO_TYPE: '正式工单', PRODUCT_NO: '@ln.ITEM_NO', PRODUCT_NAME: '@ln.ITEM_NAME', PLAN_QTY: '@sum.PLAN_QTY', PLAN_START: '@today', PLAN_END: '@ln.REQ_DATE', ROUTE_NO: '@routeNo', ROUTE_VER: '@routeVer' },
    'PP_MASTER_PLAN>PP_SCHEDULE':         { WO_NO: '@woOfProduct', STEP_NO: '@firstStep', EQUIP_NO: '@equipOfStep', PLAN_START: '@now', PLAN_END: '@now8', SCHEDULE_STATUS: '待开工' },
    'PP_MASTER_PLAN>PD_PRICE_COMPARE':    { SOURCE_TYPE: '生产计划', ITEM_NO: '@ln.ITEM_NO', ITEM_NAME: '@ln.ITEM_NAME', REQ_QTY: '@sum.PLAN_QTY', REQ_DATE: '@ln.REQ_DATE', SELECTED_SUPPLIER: '@supplier' },
    'EX_WORK_ORDER>EX_ISSUE_ORDER':       { ISSUE_BY: '@user', STOREKEEPER: '@user', ISSUE_TYPE: '生产领料', TOTAL_QTY: '@bomQty' },
    'EX_WORK_ORDER>PP_SCHEDULE':          { STEP_NO: '@firstStep', EQUIP_NO: '@equipOfStep', PLAN_START: '@now', PLAN_END: '@now8', SCHEDULE_STATUS: '待开工' },
    'EX_ISSUE_ORDER>WM_OUTBOUND':         { OUT_TYPE: '领料出库', ITEM_NO: '@ln.ITEM_NO', WAREHOUSE_CODE: '原料仓', LOCATION: '@loc', LOT_NO: '@lot', OUT_QTY: '@sum.ISSUE_QTY' },
    'EX_REPORT>QC_INSPECTION':            { QC_TYPE: '工序检验', ITEM_NO: '@woProduct', ITEM_NAME: '@woProductName', QTY: '@sumQty', UNIT: '件', PASS_QTY: '@src.GOOD_QTY', FAIL_QTY: '@src.NG_QTY', QC_RESULT: '@qcResult', INSPECTOR: '@src.OPERATOR', INSPECT_DATE: '@src.REPORT_DATE' },
    'QC_INSPECTION>QC_REWORK_ORDER':      { ORIGIN_WO_NO: '@src.WO_NO', OPEN_DATE: '@today', PRODUCT_NO: '@woProduct', PRODUCT_NAME: '@woProductName' },
    'QC_INSPECTION>QC_SCRAP_ORDER':       { DOC_NAME: '半成品报废单', SEQ_NO: 1, ITEM_NO: '@src.ITEM_NO', ITEM_NAME: '@src.ITEM_NAME', SCRAP_QTY: '@src.FAIL_QTY', TOTAL_SCRAP_QTY: '@src.FAIL_QTY', SCRAP_TYPE: '制程不良' },
    'EX_FINISH_IN>WM_FINISH_IN':          { DOC_NAME: '成品入库单', ACCEPT_QTY: '@src.GOOD_QTY', TOTAL_IN_QTY: '@src.GOOD_QTY' },
    'WM_FINISH_IN>SD_DELIVERY':           { MAKE_DATE: '@today', CUSTOMER_CODE: '@customer', TOTAL_QTY: '@src.TOTAL_IN_QTY' },
    'EQ_PATROL>EQ_FAULT_REPAIR':          { EQUIP_NAME: '@equipName', FAULT_TIME: '@now', FAULT_DESC: '@src.ABNORMAL_DESC', REPORT_BY: '@user', REPORT_TIME: '@now' },
    'EQ_INSPECTION>EQ_FAULT_REPAIR':      { FAULT_TIME: '@now', FAULT_DESC: '日常点检发现异常', REPORT_BY: '@user', REPORT_TIME: '@now' }
  };
  function flowNum(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function flowPlusHours(n) {
    var d = new Date(); d.setTime(d.getTime() + n * 3600 * 1000);
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function flowDetailOf(srcT, src) {
    var md = (S.MASTER_DETAIL[srcT] || [])[0];
    if (!md) return [];
    var key = src[md.fk];
    if (key === undefined || key === null || key === '') return [];
    return rows(md.table).filter(function (r) { return String(r[md.fk]) === String(key); });
  }
  function flowResolve(spec, cx) {
    if (typeof spec !== 'string' || spec.charAt(0) !== '@') return spec;
    var b = spec.slice(1), i = b.indexOf('.');
    var head = i < 0 ? b : b.slice(0, i), arg = i < 0 ? '' : b.slice(i + 1);
    var src = cx.src, first = cx.first;
    if (head === 'today') return today();
    /* 交期口径：明细首行交期 → 源单头交期 → 源单「交货日(天)」推算 → 今天。
     * 报价单没有表头交期、明细编辑区又填不到交期，不给这条口径就只能落到今天。 */
    if (head === 'deliveryDate') {
      var dv = (first && first.DELIVERY_DATE) || src.DELIVERY_DATE || '';
      if (dv) return dv;
      if (flowNum(src.DELIVERY_DAYS) > 0) return flowDateAfter(flowNum(src.DELIVERY_DAYS));
      return today();
    }
    if (head === 'now') return now();
    if (head === 'now8') return flowPlusHours(8);
    if (head === 'user') return (CUR_USER || 'anonymous');
    if (head === 'cnt') return cx.det.length;
    if (head === 'src') return src[arg];
    if (head === 'ln') return first ? first[arg] : src[arg];
    if (head === 'sum') return cx.det.reduce(function (a, r) { return a + flowNum(r[arg]); }, 0);
    if (head === 'sumQty') return flowNum(src.GOOD_QTY) + flowNum(src.NG_QTY);
    if (head === 'qcResult') return flowNum(src.NG_QTY) > 0 ? '不合格' : '合格';
    if (head === 'routeNo' || head === 'routeVer') {
      var prod = cx.biz.PRODUCT_NO || (first && first.ITEM_NO) || src.ITEM_NO;
      var vs = rows('RT_ROUTE_VERSION').filter(function (v) { return String(v.PRODUCT_NO) === String(prod); });
      vs.sort(function (a, b2) { return String(b2.EFFECT_DATE || '').localeCompare(String(a.EFFECT_DATE || '')); });
      if (vs[0]) return head === 'routeNo' ? vs[0].ROUTE_NO : vs[0].ROUTE_VER;
      var rt = rows('RT_ROUTE').filter(function (r) { return String(r.PRODUCT_NO) === String(prod); })[0] || rows('RT_ROUTE')[0];
      return rt ? (head === 'routeNo' ? rt.ROUTE_NO : (rt.ROUTE_VER || 'V1.0')) : '';
    }
    if (head === 'firstStep' || head === 'equipOfStep' || head === 'woOfProduct') {
      var woNo = cx.biz.WO_NO || src.WO_NO;
      var wo = woNo ? rows('EX_WORK_ORDER').find(function (w) { return String(w.WO_NO) === String(woNo); }) : null;
      if (head === 'woOfProduct') {
        if (!wo) {
          var p0 = cx.biz.PRODUCT_NO || (first && first.ITEM_NO) || src.ITEM_NO;
          wo = rows('EX_WORK_ORDER').find(function (w) { return String(w.PRODUCT_NO) === String(p0); });
        }
        return wo ? wo.WO_NO : '';
      }
      var steps = woNo ? rows('EX_WO_STEP').filter(function (s) { return String(s.WO_NO) === String(woNo); }) : [];
      steps.sort(function (a, b2) { return String(a.STEP_NO).localeCompare(String(b2.STEP_NO)); });
      if (!steps[0]) return '';
      return head === 'firstStep' ? steps[0].STEP_NO : (steps[0].EQUIP_NO || '');
    }
    if (head === 'lot' || head === 'loc') {
      var it = cx.biz.ITEM_NO || (first && first.ITEM_NO) || src.ITEM_NO;
      var wh = cx.biz.WAREHOUSE_CODE || src.WAREHOUSE_CODE;
      var lots = rows('WM_STOCK_LOT').filter(function (l) {
        return String(l.ITEM_NO) === String(it) && (!wh || String(l.WAREHOUSE_CODE) === String(wh));
      });
      if (lots[0]) return head === 'lot' ? (lots[0].LOT_NO || '') : (lots[0].LOCATION || '');
      var stk = rows('WM_STOCK').find(function (s) { return String(s.ITEM_NO) === String(it); });
      if (!stk) return '';
      return head === 'lot' ? (stk.LOT_NO || '') : (stk.LOCATION || '');
    }
    if (head === 'supplier') {
      var it2 = cx.biz.ITEM_NO || (first && first.ITEM_NO) || src.ITEM_NO;
      var m = rows('MD_MATERIAL').find(function (x) { return String(x.ITEM_NO) === String(it2); });
      return m ? (m.DEFAULT_SUPPLIER || '') : '';
    }
    if (head === 'customer') return rows('MD_CUSTOMER')[0] ? rows('MD_CUSTOMER')[0].CUSTOMER_CODE : '';
    if (head === 'equipName') {
      var e = rows('MD_EQUIPMENT').find(function (x) { return String(x.EQUIP_NO) === String(src.EQUIP_NO); });
      return e ? (e.EQUIP_NAME || '') : '';
    }
    if (head === 'woProduct' || head === 'woProductName') {
      var wn = cx.biz.WO_NO || src.WO_NO;
      var w2 = wn ? rows('EX_WORK_ORDER').find(function (w) { return String(w.WO_NO) === String(wn); }) : null;
      if (!w2) {
        var pn = cx.biz.ITEM_NO || src.ITEM_NO;
        w2 = rows('EX_WORK_ORDER').find(function (w) { return String(w.PRODUCT_NO) === String(pn); });
      }
      return w2 ? (head === 'woProduct' ? w2.PRODUCT_NO : w2.PRODUCT_NAME) : '';
    }
    if (head === 'bomQty') {
      var pr = cx.biz.PRODUCT_NO || src.PRODUCT_NO || src.ITEM_NO;
      var mine = rows('MD_BOM_LINE').filter(function (l) { return String(l.PARENT_ITEM_CODE) === String(pr); });
      if (!mine.length) return 0;
      var bomNo = mine[0].BOM_NO;
      var per = rows('MD_BOM_LINE').filter(function (l) { return String(l.BOM_NO) === String(bomNo); })
        .reduce(function (a, l) { return a + (flowNum(l.GROSS_QTY) || flowNum(l.NET_QTY)); }, 0);
      return per * (flowNum(cx.biz.PLAN_QTY) || flowNum(src.PLAN_QTY) || 1);
    }
    return '';
  }
  /* 返回「该补的字段」字典：目标表有这一列、且值是源单里拿不到的必填项 */
  function flowFill(srcT, src, tgtT, biz) {
    var rules = FLOW_FILL[srcT + '>' + tgtT] || FLOW_FILL[tgtT] || {};
    var det = flowDetailOf(srcT, src);
    var cx = { srcT: srcT, src: src, tgtT: tgtT, biz: biz, det: det, first: det[0] || null };
    var cols = S.columnsOf(tgtT), out = {};
    Object.keys(rules).forEach(function (f) {
      var col = null;
      for (var i = 0; i < cols.length; i++) { if (cols[i].code === f) { col = cols[i]; break; } }
      if (!col) return;
      var v = flowResolve(rules[f], cx);
      if (v === undefined || v === null || v === '') {
        /* 规则也取不到值：按字段类型兜底，保证不会因为一个空值整笔 400 */
        if (col.type === 'da') v = today();
        else if (col.type === 'dt') v = now();
        else if (col.type === 'd') v = 0;
        else if (col.type === 'i') v = 1;
        else if (col.type === 'b') v = false;
        else v = '待补充';
      }
      out[f] = v;
    });
    return out;
  }
  /* ---------- 流转生成：明细行 ----------
   * ① 列名不同名的按 FLOW_LINE_FILL 映射（报价单 QTY → 销售订单 ORDER_QTY 等）；
   *    值为源字段名 / '@unit'（查物料单位）/ '@month'（本月 YYYY-MM）/ 常量。
   * ② 有些下游明细不是「照抄源单」，而是「按主数据展开」：工单工序 ← 工艺路线、
   *    领料明细 ← BOM × 计划数。照抄会写出没有工序号/品号的脏行（后端 400）。 */
  var FLOW_LINE_FILL = {
    'SD_QUOTATION_LINE>SD_SALES_ORDER_LINE':   { ORDER_QTY: 'QTY', OPEN_QTY: 'QTY', DELIVERED_QTY: 0 },
    'SD_SALES_ORDER_LINE>SD_DELIVERY_LINE':    { DELIVERY_QTY: 'ORDER_QTY', UNIT: '@unit' },
    'SD_SALES_ORDER_LINE>PP_MASTER_PLAN_LINE': { PLAN_QTY: 'ORDER_QTY', PLAN_MONTH: '@month' },
    'PD_PURCHASE_ORDER_LINE>PD_ARRIVAL_LINE':  { ARRIVAL_QTY: 'ORDER_QTY', UNIT: '@unit' }
  };
  var FLOW_LINE_EXPAND = {
    'SD_SALES_ORDER>EX_WORK_ORDER': 'ROUTE',
    'PP_MASTER_PLAN>EX_WORK_ORDER': 'ROUTE',
    'EX_WORK_ORDER>EX_ISSUE_ORDER': 'BOM'
  };
  /* 源单本身没有子表、目标却有子表的流转（比价单→采购订单、成品入库单→销货单）。
   * 这类单据天然是多对单：源单头就是一行货，原来走「复制源明细」分支时 srcLinks 为空，
   * 结果一行明细都不生成 —— 表头有、子表空，和报价单→销售订单是同一类症状。 */
  var FLOW_LINE_FROM_HEAD = {
    'PD_PRICE_COMPARE>PD_PURCHASE_ORDER': {
      ITEM_NO: '@src.ITEM_NO', ITEM_NAME: '@src.ITEM_NAME', SPEC: '@src.SPEC', UNIT: '@src.UNIT',
      ORDER_QTY: '@src.REQ_QTY', ARRIVED_QTY: 0, OWING_QTY: '@src.REQ_QTY', DELIVERY_DATE: '@src.REQ_DATE'
    },
    'WM_FINISH_IN>SD_DELIVERY': {
      ITEM_NO: '@woProduct', ITEM_NAME: '@woProductName', DELIVERY_QTY: '@src.TOTAL_IN_QTY',
      UNIT: '@unit', LOT_NO: '@src.LOT_NO', SO_NO: '@src.SO_NO'
    }
  };
  function flowUnitOf(itemNo) {
    var m = rows('MD_MATERIAL').find(function (x) { return String(x.ITEM_NO) === String(itemNo); });
    return m ? (m.UNIT || '件') : '件';
  }
  function flowThisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + ((d.getMonth() + 1) < 10 ? '0' : '') + (d.getMonth() + 1);
  }
  function flowLineFill(srcTable, ln, tgtTable) {
    var rules = FLOW_LINE_FILL[srcTable + '>' + tgtTable] || {}, out = {};
    Object.keys(rules).forEach(function (f) {
      var spec = rules[f], v;
      if (typeof spec === 'string' && spec.charAt(0) === '@') {
        if (spec === '@unit') v = flowUnitOf(ln.ITEM_NO);
        else if (spec === '@month') v = flowThisMonth();
        else v = '';
      } else if (typeof spec === 'string' && /^[A-Z][A-Z0-9_]*$/.test(spec)) {
        v = ln[spec];
      } else v = spec;
      out[f] = v;
    });
    return out;
  }
  /* 源无子表 → 目标有子表：按源单头造 1 行明细。
   * 映射值支持常量、@unit/@month，以及 flowResolve 的全部占位符（@src.X / @woProduct…）。 */
  function flowLineFromHead(srcT, src, tgtT, rec) {
    var rules = FLOW_LINE_FROM_HEAD[srcT + '>' + tgtT];
    var tgtLinks = S.MASTER_DETAIL[tgtT] || [];
    if (!rules || !tgtLinks.length) return Promise.resolve('');
    var Lt = tgtLinks[0].table, tfk = tgtLinks[0].fk;
    var cx = { src: src, det: [], first: null, biz: rec };
    var lbiz = {};
    Object.keys(rules).forEach(function (k) {
      var spec = rules[k], v;
      if (typeof spec === 'string' && spec.charAt(0) === '@') {
        if (spec === '@unit') v = flowUnitOf(rec.ITEM_NO || src.ITEM_NO);
        else if (spec === '@month') v = flowThisMonth();
        else v = flowResolve(spec, cx);
      } else if (typeof spec === 'string' && /^[A-Z][A-Z0-9_]*$/.test(spec)) {
        v = src[spec];
      } else v = spec;
      if (v !== undefined && v !== null && v !== '') lbiz[k] = v;
    });
    lbiz[tfk] = rec[tfk];
    if (lbiz.SEQ_NO === undefined || lbiz.SEQ_NO === null) lbiz.SEQ_NO = 1;
    if (!flowLineRequired(Lt, lbiz, src, rec, null)) {
      return Promise.resolve('源单没有明细，「' + S.TABLES[Lt].label + '」按表头补 1 行缺必填（品号/品名），请到详情里手工补一行');
    }
    var p0 = PENDING_WRITES.length;
    insert(Lt, lbiz);
    return flowWatchLines(PENDING_WRITES.slice(p0), 1, 0);
  }
  /* 明细行必填兜底 —— 表头有 FLOW_FILL，明细原本没有。于是「源明细缺某个必填列」时，
   * 每行 POST 都被 400「缺少必填字段」挡掉，界面表现就是「点了生成，子表一行都没跟过来」。
   * 真实案例（2026-10-22 手工新建的报价单）：报价单明细的编辑区只显示前 7 列，
   * 「交期」在编辑区根本填不到 → 销售订单明细的必填 DELIVERY_DATE 全空 → 整行被拒。
   * 取值顺序：源明细 → 目标单头同名列 → 源单头同名列 → 源单「交货日(天)」推算 → 按类型默认。
   * 返回 false = 文本类必填补不出来（如品号缺失）；这种行宁可不写，也不落垃圾数据。 */
  function flowDateAfter(days) {
    var d = new Date(); d.setDate(d.getDate() + days);
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function flowLineRequired(Lt, lbiz, src, rec, ln) {
    var ok = true;
    S.columnsOf(Lt).forEach(function (c) {
      if (c.sys || !c.req) return;
      var v = lbiz[c.code];
      if (v !== undefined && v !== null && v !== '') return;
      var alt = (ln && ln[c.code] !== undefined && ln[c.code] !== '') ? ln[c.code]
        : ((rec && rec[c.code] !== undefined && rec[c.code] !== '') ? rec[c.code]
          : ((src && src[c.code] !== undefined && src[c.code] !== '') ? src[c.code] : null));
      if (alt !== null) { lbiz[c.code] = alt; return; }
      if (c.type === 'da' && c.code === 'DELIVERY_DATE' && src && flowNum(src.DELIVERY_DAYS) > 0) {
        lbiz[c.code] = flowDateAfter(flowNum(src.DELIVERY_DAYS)); return;
      }
      if (c.type === 'da') lbiz[c.code] = today();
      else if (c.type === 'dt') lbiz[c.code] = now();
      else if (c.type === 'd' || c.type === 'i') lbiz[c.code] = 0;
      else if (c.type === 'b') lbiz[c.code] = false;
      else ok = false;
    });
    return ok;
  }
  /* 明细写入结果汇总：明细是逐行 POST 的，某行被拒时界面只闪一下提示，很容易被
   * 「已流转生成」的成功提示盖过去，用户以为整单都成了。这里**返回一句附加说明**
   * （而不是自己 toast），由调用方与成功提示合并成一条，杜绝「后到的提示被前一条覆盖」。 */
  function flowWatchLines(ps, wrote, skipped) {
    if (!ps.length) {
      if (skipped) return Promise.resolve('明细 ' + skipped + ' 行缺必填，未生成');
      if (!wrote) return Promise.resolve('源单没有明细行，只生成了表头');
      return Promise.resolve('');
    }
    return Promise.all(ps.map(function (p) {
      return p.then(function () { return null; }, function (e) { return e || {}; });
    })).then(function (rs) {
      var bad = rs.filter(Boolean), extra = [];
      if (bad.length) {
        var msg = String((bad[0] && bad[0].message) || bad[0] || '');
        extra.push('明细 ' + bad.length + '/' + wrote + ' 行未写入：' + msg.slice(0, 60));
      }
      if (skipped) extra.push('另有 ' + skipped + ' 行缺必填未生成');
      return extra.join('；');
    });
  }
  /* 取源单明细：本地缓存有就用；**本地为空时按外键去后端精确拉一次**。
   * 原来直接 `rows(Ls).filter(...)`：一旦这张表在首屏「8 张一批」预载时失败、
   * 或用户会话里从没打开过该明细页，本地就是空数组 ⇒ 明细一行都不复制，
   * 界面却照样提示「已流转生成」。2026-10-22 线上「报价单→销售订单明细 0 行」即此。
   * 后端不可用（离线演示）时退回本地，保持纯静态可用。 */
  function flowLoadLines(tbl, fk, key) {
    function mine(list) { return list.filter(function (r) { return String(r[fk]) === String(key); }); }
    var local = mine(rows(tbl));
    if (local.length || !BE.on(tbl) || !BE.available()) return Promise.resolve(local);
    var f = backendCol(fk) + ':' + encodeURIComponent(String(key));
    return BE.page(tbl, { limit: 200, offset: 0, f: f }).then(function (res) {
      var got = mine((res.rows || []).map(function (u) { return rowFromBackend(tbl, u); }));
      if (!got.length) return got;
      /* 补进本地缓存：单据详情的「明细」页签、后续编辑都读 db，避免再拉一次 */
      db[tbl] = rows(tbl).filter(function (r) { return String(r[fk]) !== String(key); }).concat(got);
      save();
      return got;
    }).catch(function (e) {
      try { console.warn('[MES-FLOW] 源明细拉取失败 ' + tbl + '：' + ((e && e.message) || e)); } catch (_) {}
      return [];
    });
  }
  /* 工单工序：按工艺路线展开（STEP_CODE 已是 S10/S20…，与 EX_WO_STEP.STEP_NO 同口径） */
  function flowExpandSteps(wo) {
    var steps = rows('RT_ROUTE_STEP').filter(function (s) { return String(s.ROUTE_NO) === String(wo.ROUTE_NO); });
    steps.sort(function (a, b) { return Number(a.SEQ_NO) - Number(b.SEQ_NO); });
    function codeOf(s) { return s.STEP_CODE || ('S' + s.SEQ_NO); }
    steps.forEach(function (s, i) {
      insert('EX_WO_STEP', {
        WO_NO: wo.WO_NO, STEP_NO: codeOf(s), STEP_NAME: s.STEP_NAME,
        EQUIP_SPEC: '', EQUIP_COUNT: 1, EQUIP_NO: '', PROC_MODE: '自动',
        PLAN_QTY: flowNum(wo.PLAN_QTY), REPORT_QTY: 0, GOOD_QTY: 0, NG_QTY: 0, SCRAP_QTY: 0, REWORK_QTY: 0,
        STEP_STATUS: '待开工',
        IS_QC_POINT: (/^(t|1|true|是)$/i.test(String(s.IS_QC_POINT)) ? 1 : 0),
        OUTSOURCE_FLAG: (/^(t|1|true|是)$/i.test(String(s.OUTSOURCE_FLAG)) ? 1 : 0),
        PREV_STEP_NO: i > 0 ? codeOf(steps[i - 1]) : '',
        NEXT_STEP_NO: i < steps.length - 1 ? codeOf(steps[i + 1]) : ''
      });
    });
    return steps.length;
  }
  /* 领料明细：按 BOM（父件=产品）展开，用量 = 单台用量 × 计划数 */
  function flowExpandIssue(head, productNo, qty) {
    var lines = rows('MD_BOM_LINE').filter(function (l) { return String(l.PARENT_ITEM_CODE) === String(productNo); });
    if (!lines.length) return 0;
    var bomNo = lines[0].BOM_NO;
    lines = lines.filter(function (l) { return String(l.BOM_NO) === String(bomNo); });
    lines.forEach(function (l, i) {
      var per = flowNum(l.GROSS_QTY) || flowNum(l.NET_QTY);
      insert('EX_ISSUE_LINE', {
        ISSUE_NO: head.ISSUE_NO, SEQ_NO: i + 1,
        ITEM_NO: l.ERP_ITEM_CODE, ITEM_NAME: l.ITEM_NAME, SPEC: '',
        ISSUE_QTY: per * (qty || 1), UNIT: l.UNIT || flowUnitOf(l.ERP_ITEM_CODE),
        LOT_NO: '', LOCATION: '', ISSUED_QTY_ACC: 0
      });
    });
    return lines.length;
  }
  /* ---------- 完工入库前置（前端同口径） ----------
   * 规则：工单的「入库上架」工序报工数量 ≥ 计划数量，才允许完工入库（申请/入库单）；
   * 超产不拦，只拦没报满（2026-10-26 用户口径）。
   * 后端 server/rules.js 的 beforeWrite 是硬拦；这里提前拦一下，给用户看得懂的提示，
   * 而不是等 POST 回来才报。找不到「入库上架」时按工序号最大那道卡（与后端一致）。 */
  function finishInBlock(woNo) {
    var wo = String(woNo == null ? '' : woNo).trim();
    if (!wo) return '';
    var steps = rows('EX_WO_STEP').filter(function (r) { return String(r.WO_NO) === wo; });
    if (!steps.length) return '工单 ' + wo + ' 还没有工序明细，不能完工入库';
    var up = steps.filter(function (r) { return String(r.STEP_NAME) === '入库上架'; })[0];
    if (!up) {
      steps = steps.slice().sort(function (a, b) { return String(b.STEP_NO).localeCompare(String(a.STEP_NO)); });
      up = steps[0];
    }
    var plan = flowNum(up.PLAN_QTY), rep = flowNum(up.REPORT_QTY);
    /* 只拦「没报满」：报工数量 ≥ 计划数量即放行（2026-10-26 用户定：超产不拦） */
    if (rep >= plan) return '';
    return '「' + up.STEP_NAME + '」报工数量 ' + rep + ' < 计划数量 ' + plan +
      '，工序未报满，不能完工入库（工单 ' + wo + '）';
  }
  var FINISH_IN_TABLES = ['EX_FINISH_IN', 'WM_FINISH_IN'];
  function doFlow(srcT, srcId, tgtT) {
    var src = find(srcT, srcId); if (!src) return;
    if (FINISH_IN_TABLES.indexOf(tgtT) >= 0) {
      var fb = finishInBlock(src.WO_NO);
      if (fb) { toast(fb); return; }
    }
    var tdef = S.TABLES[tgtT];
    var biz = {};
    var hasDocNo = S.columnsOf(tgtT).some(function (c) { return c.code === 'DOC_NO'; });
    S.columnsOf(tgtT).forEach(function (c) {
      if (c.sys) return;
      if (src[c.code] !== undefined && src[c.code] !== '' && c.code !== tdef.pk) biz[c.code] = src[c.code];
    });
    biz[tdef.pk] = genDocNo(tgtT);
    if (hasDocNo) biz.DOC_NO = biz[tdef.pk];
    biz.DOC_DATE = today();
    biz.STATUS = '草稿';
    if (tdef.cols.some(function (c) { return c.code === S.TABLES[srcT].pk; })) biz[S.TABLES[srcT].pk] = src[S.TABLES[srcT].pk];
    /* 必填兜底（见上方 FLOW_FILL）：不补的话后端会整笔 400「缺少必填字段」 */
    var filled = flowFill(srcT, src, tgtT, biz);
    Object.keys(filled).forEach(function (k) {
      if (biz[k] === undefined || biz[k] === null || biz[k] === '') biz[k] = filled[k];
    });
    var p0 = PENDING_WRITES.length;
    var rec = insert(tgtT, biz);
    var mainP = PENDING_WRITES.slice(p0)[0] || null;
    /* 必须等主表 POST 有结果再写关联 / 明细：主表被后端拒绝时若照写，就会留下
     * 「关联台账有记录、主单不存在」的孤儿行（2026-10-22 报价单→销售订单即此）。 */
    var finish = function () {
      if (FAILED_WRITES[tgtT + ':' + rec.ID]) return;
      // 记录具体上下游关联（供单据详情/使用说明按单号定位）
      var _f = (S.FLOW[srcT] || []).find(function (x) { return x.to === tgtT; });
      var _label = _f ? _f.label : (S.TABLES[srcT].label + ' → ' + tdef.label);
      insert('SYS_DOC_LINK', { LINK_ID: uid('LINK'), FROM_TABLE: srcT, FROM_NO: src[S.TABLES[srcT].pk], TO_TABLE: tgtT, TO_NO: rec[tdef.pk], FLOW_LABEL: _label, LINK_TIME: now(), REMARK: '流转生成' });
      // 明细行：按主数据展开（工序 / BOM）或从源明细复制 + 列名映射
      var exp = FLOW_LINE_EXPAND[srcT + '>' + tgtT];
      var lineP;
      if (exp === 'ROUTE') {
        flowExpandSteps(rec); lineP = Promise.resolve('');
      } else if (exp === 'BOM') {
        flowExpandIssue(rec, rec.PRODUCT_NO || src.PRODUCT_NO || src.ITEM_NO, flowNum(rec.PLAN_QTY) || flowNum(src.PLAN_QTY));
        lineP = Promise.resolve('');
      } else {
        var srcLinks = S.MASTER_DETAIL[srcT] || [];
        var tgtLinks = S.MASTER_DETAIL[tgtT] || [];
        if (srcLinks.length && tgtLinks.length) {
          var Ls = srcLinks[0].table, Lt = tgtLinks[0].table, sfk = srcLinks[0].fk, tfk = tgtLinks[0].fk;
          /* 明细必须异步取：本地缓存可能没有这张表（首屏分批预载失败 / 从未打开过） */
          lineP = flowLoadLines(Ls, sfk, src[sfk]).then(function (srcLines) {
            var pLines = PENDING_WRITES.length, wrote = 0, skipped = 0;
            srcLines.forEach(function (ln, i) {
              var lbiz = {};
              S.columnsOf(Lt).forEach(function (c) {
                if (c.sys) return;
                if (ln[c.code] !== undefined && ln[c.code] !== '' && c.code !== S.TABLES[Lt].pk) lbiz[c.code] = ln[c.code];
              });
              var lf = flowLineFill(Ls, ln, Lt);
              Object.keys(lf).forEach(function (k) { if (lbiz[k] === undefined || lbiz[k] === null || lbiz[k] === '') lbiz[k] = lf[k]; });
              lbiz[tfk] = rec[tfk];
              if (lbiz.SEQ_NO === undefined || lbiz.SEQ_NO === null) lbiz.SEQ_NO = i + 1;
              if (!flowLineRequired(Lt, lbiz, src, rec, ln)) { skipped++; return; }
              insert(Lt, lbiz); wrote++;
            });
            return flowWatchLines(PENDING_WRITES.slice(pLines), wrote, skipped);
          });
        } else if (tgtLinks.length) {
          /* 源单无子表、目标有子表 → 按源单头补 1 行（见 FLOW_LINE_FROM_HEAD） */
          lineP = flowLineFromHead(srcT, src, tgtT, rec);
        } else lineP = Promise.resolve('');
      }
      /* 等明细落定再提示 + 打开详情：否则详情里的「明细」页签可能还是空的，
       * 用户看到的就是「表头生成了、子表没跟过来」 */
      return lineP.then(function (note) {
        update(tgtT, rec.ID, { REMARK: '由「' + S.TABLES[srcT].label + '」' + (src[S.TABLES[srcT].pk] || '') + ' 流转生成' });
        /* 顺序不能反：openDoc 里可能触发 needDeps 的「加载主数据（N 张）…」提示，
         * 原先先 toast 成功再 openDoc，同一个 tick 内成功提示就被加载提示顶掉，
         * 用户只看到「加载主数据」，以为整单没生成。先开详情再提示，成功文案放最后一手。 */
        openDoc(tgtT, rec.ID);
        toast('已流转生成「' + tdef.label + '」' + rec[tdef.pk] + (note ? '；' + note : ''));
      });
    };
    if (mainP) mainP.then(finish, finish); else finish();
  }

  /* ---------- 业务流链（来源 / 当前 / 去向，按表动态生成） ---------- */
  function flowUpstream(t) {
    var ups = [];
    Object.keys(S.FLOW).forEach(function (src) {
      S.FLOW[src].forEach(function (f) { if (f.to === t) ups.push({ from: src, label: f.label }); });
    });
    return ups;
  }

  /* 关联字段表：子表/下游表 → [{ col: 指向父单的字段, parent: 父表 }]。
     用途：① 从当前单据的字段反查「上游单据」；② 反向扫描找出「下游单据」。
     这样即便 SYS_DOC_LINK 台账里没有记录（如手工新建的单据），业务流也能自动串起来。 */
  var LINK_FIELDS = {
    MD_BOM_LINE:            [{ col: 'BOM_NO', parent: 'MD_BOM_HEAD' }],
    RT_ROUTE_STEP:          [{ col: 'ROUTE_NO', parent: 'RT_ROUTE' }],
    RT_VERSION_LOG:         [{ col: 'ROUTE_NO', parent: 'RT_ROUTE_VERSION' }],
    HR_TEAM_MEMBER:         [{ col: 'TEAM_CODE', parent: 'HR_TEAM' }],
    EQ_MAINTENANCE_RECORD:  [{ col: 'PM_NO', parent: 'EQ_MAINTENANCE_PLAN' }],
    SD_QUOTATION_LINE:      [{ col: 'QUOTE_NO', parent: 'SD_QUOTATION' }],
    SD_SALES_ORDER_LINE:    [{ col: 'SO_NO', parent: 'SD_SALES_ORDER' }],
    SD_DELIVERY_LINE:       [{ col: 'DELIVERY_NO', parent: 'SD_DELIVERY' }, { col: 'SO_NO', parent: 'SD_SALES_ORDER' }],
    PD_PRICE_COMPARE:       [{ col: 'SO_NO', parent: 'SD_SALES_ORDER' }, { col: 'SOURCE_NO', parent: 'PP_MASTER_PLAN' }],
    PD_PURCHASE_ORDER:      [{ col: 'SO_NO', parent: 'SD_SALES_ORDER' }],
    PD_PURCHASE_ORDER_LINE: [{ col: 'PO_NO', parent: 'PD_PURCHASE_ORDER' }],
    PD_ARRIVAL:             [{ col: 'PO_NO', parent: 'PD_PURCHASE_ORDER' }],
    PD_ARRIVAL_LINE:        [{ col: 'ARRIVAL_NO', parent: 'PD_ARRIVAL' }],
    PP_SCHEDULE:            [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    PP_MASTER_PLAN_LINE:    [{ col: 'PLAN_NO', parent: 'PP_MASTER_PLAN' }],
    PP_MASTER_PLAN:         [{ col: 'SO_NO', parent: 'SD_SALES_ORDER' }],
    EX_WORK_ORDER:          [{ col: 'SO_NO', parent: 'SD_SALES_ORDER' }, { col: 'PLAN_NO', parent: 'PP_MASTER_PLAN' }],
    EX_WO_STEP:             [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    EX_ISSUE_ORDER:         [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    EX_ISSUE_LINE:          [{ col: 'ISSUE_NO', parent: 'EX_ISSUE_ORDER' }],
    EX_REPORT:              [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    QC_INSPECTION:          [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    QC_REWORK_ORDER:        [{ col: 'QC_NO', parent: 'QC_INSPECTION' }, { col: 'ORIGIN_WO_NO', parent: 'EX_WORK_ORDER' }],
    QC_SCRAP_ORDER:         [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    EX_FINISH_IN:           [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    WM_FINISH_IN:           [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    WM_INBOUND:             [{ col: 'ARRIVAL_NO', parent: 'PD_ARRIVAL' }],
    WM_OUTBOUND:            [{ col: 'WO_NO', parent: 'EX_WORK_ORDER' }],
    EX_SHIFT_STATION_CHECK: [{ col: 'HANDOVER_NO', parent: 'EX_SHIFT_HANDOVER' }]
  };
  /* 从当前记录字段反查上游单据（只认「父表主键」字段） */
  function flowInferUp(t, rec) {
    var out = [], maps = LINK_FIELDS[t] || [];
    maps.forEach(function (m) {
      if (m.parent === t) return;
      var pdef = S.TABLES[m.parent]; if (!pdef) return;
      var v = rec[m.col]; if (v === undefined || v === null || v === '') return;
      out.push({ table: m.parent, no: String(v), label: '由「' + pdef.label + '」关联' });
    });
    return out;
  }
  /* 反向扫描：找出所有字段指向当前单号的记录 → 下游单据（按表分组） */
  function flowInferDown(t, curNo) {
    var groups = {};
    Object.keys(LINK_FIELDS).forEach(function (ct) {
      if (ct === t) return;
      (LINK_FIELDS[ct] || []).forEach(function (m) {
        if (m.parent !== t) return;
        rows(ct).forEach(function (r) {
          var v = r[m.col]; if (v === undefined || v === null || v === '') return;
          if (String(v) !== String(curNo)) return;
          var cdef = S.TABLES[ct]; var no = cdef.pk ? r[cdef.pk] : r.ID;
          if (no === undefined || no === null || no === '') return;
          if (!groups[ct]) groups[ct] = [];
          if (groups[ct].indexOf(String(no)) < 0) groups[ct].push(String(no));
        });
      });
    });
    return groups;
  }
  /* t: 表名；id: 当前记录 ID（弹窗内传入，下游按钮可用；核心流程页不传则禁用） */
  function tableFlowPanel(t, id) {
    var def = S.TABLES[t]; if (!def) return '';
    var ups = flowUpstream(t);
    var downs = S.FLOW[t] || [];
    var curTag = '', curNo = '';
    if (id) { var rec = find(t, id); if (rec && def.pk && rec[def.pk]) { curTag = '：' + esc(rec[def.pk]); curNo = rec[def.pk]; } }
    // 具体关联：仅在有具体记录时查询（已实际生成的上下游具体单据）
    var upLinks = [], downLinks = [], rec = null, curNos = [];
    if (id && curNo) {
      rec = find(t, id);
      curNos = [rec[def.pk], rec.DOC_NO].filter(function (v) { return v !== undefined && v !== null && v !== ''; }).map(String);
      function inCur(v) { return curNos.indexOf(String(v)) >= 0; }
      upLinks = rows('SYS_DOC_LINK').filter(function (l) { return l.TO_TABLE === t && inCur(l.TO_NO); });
      downLinks = rows('SYS_DOC_LINK').filter(function (l) { return l.FROM_TABLE === t && inCur(l.FROM_NO); });
    }
    /* 台账没记录时，用「关联字段」兜底推断上下游（手工新建/导入的单据也能串起来） */
    var inferUps = [], inferDownGroups = {};
    if (rec && curNo) {
      inferUps = flowInferUp(t, rec).filter(function (u) {
        return !upLinks.some(function (l) { return l.FROM_TABLE === u.table && String(l.FROM_NO) === u.no; });
      });
      var dg = {};
      curNos.forEach(function (v) {
        var g = flowInferDown(t, v);
        Object.keys(g).forEach(function (ct) {
          if (!dg[ct]) dg[ct] = [];
          g[ct].forEach(function (no) { if (dg[ct].indexOf(no) < 0) dg[ct].push(no); });
        });
      });
      Object.keys(dg).forEach(function (ct) {
        var rest = dg[ct].filter(function (no) {
          return !downLinks.some(function (l) { return l.TO_TABLE === ct && String(l.TO_NO) === no; });
        });
        if (rest.length) inferDownGroups[ct] = rest;
      });
    }
    function tblName(x) { return S.TABLES[x] ? S.TABLES[x].label : x; }
    var h = '<div class="detail-panel flow-panel"><div class="dp-head"><span class="dp-title">业务流 · ' + esc(def.label) + ' <code>' + esc(t) + '</code></span>' +
      '<span class="mini">来源（上游）/ 去向（下游）/ 如何操作</span>' +
      '<span class="spacer"></span>' +
      '<button class="ghost sm" data-flownew="' + esc(t) + '">+ 新建 ' + esc(def.label) + '</button></div>';
    h += '<div class="flow-chain">';
    /* 来源 */
    h += '<div class="fc-col"><div class="fc-h">① 来源 · 上游</div>';
    if (upLinks.length) {
      upLinks.forEach(function (l) {
        h += '<div class="fc-node src linked"><b>' + esc(tblName(l.FROM_TABLE)) + '</b><div class="docno">' + esc(l.FROM_NO) + '</div>' +
          '<button class="ghost sm" data-linkopen="' + esc(l.FROM_TABLE) + '|' + esc(l.FROM_NO) + '">打开关联单 →</button></div>';
      });
    }
    inferUps.forEach(function (u) {
      h += '<div class="fc-node src linked"><b>' + esc(tblName(u.table)) + '</b><div class="docno">' + esc(u.no) + '</div>' +
        '<div class="mini">按字段关联（' + esc(u.label) + '）</div>' +
        '<button class="ghost sm" data-linkopen="' + esc(u.table) + '|' + esc(u.no) + '">打开关联单 →</button></div>';
    });
    if (!upLinks.length && !inferUps.length && id) {
      h += '<div class="fc-node muted">（暂无上游关联）</div>';
    }
    if (ups.length) h += '<div class="fc-hint">可来自：' + ups.map(function (u) { return esc(tblName(u.from)); }).join(' / ') + '</div>';
    else if (!id) h += '<div class="fc-node muted">根级单据，直接新建即可</div>';
    h += '</div>';
    h += '<div class="fc-arrow">↓</div>';
    /* 当前 */
    h += '<div class="fc-col"><div class="fc-h">② 当前 · ' + esc(def.label) + '</div><div class="fc-node cur">本表记录' + curTag + '</div></div>';
    h += '<div class="fc-arrow">↓</div>';
    /* 去向 */
    h += '<div class="fc-col"><div class="fc-h">③ 去向 · 下游</div>';
    /* 去向合并渲染：台账 + 字段推断按「表」归并，同表只出一个节点；多条时以单号 chip 罗列 */
    var downBuckets = {};
    downLinks.forEach(function (l) {
      if (!downBuckets[l.TO_TABLE]) downBuckets[l.TO_TABLE] = [];
      downBuckets[l.TO_TABLE].push({ no: l.TO_NO, ledger: true });
    });
    Object.keys(inferDownGroups).forEach(function (ct) {
      if (!downBuckets[ct]) downBuckets[ct] = [];
      inferDownGroups[ct].forEach(function (no) {
        if (!downBuckets[ct].some(function (x) { return String(x.no) === String(no); })) downBuckets[ct].push({ no: no, ledger: false });
      });
    });
    Object.keys(downBuckets).forEach(function (ct) {
      var arr = downBuckets[ct];
      if (arr.length === 1) {
        h += '<div class="fc-node tgt linked"><b>' + esc(tblName(ct)) + '</b><div class="docno">' + esc(arr[0].no) + '</div>' +
          '<div class="mini">' + (arr[0].ledger ? '业务流转生成' : '按字段关联') + '</div>' +
          '<button class="ghost sm" data-linkopen="' + esc(ct) + '|' + esc(arr[0].no) + '">打开关联单 →</button></div>';
      } else {
        var show = arr.slice(0, 8);
        h += '<div class="fc-node tgt linked"><b>' + esc(tblName(ct)) + '</b><div class="mini">共 ' + arr.length + ' 条（业务流转 + 按字段关联）</div>' +
          '<div class="link-chips">' + show.map(function (x) {
            return '<button class="ghost sm" data-linkopen="' + esc(ct) + '|' + esc(x.no) + '">' + esc(x.no) + ' →</button>';
          }).join('') + (arr.length > show.length ? '<span class="mini">…等 ' + arr.length + ' 条</span>' : '') + '</div></div>';
      }
    });
    if (!Object.keys(downBuckets).length && id) {
      h += '<div class="fc-node muted">（暂无下游关联）</div>';
    }
    if (downs.length) {
      h += '<div class="fc-hint">可向后流转：</div>';
      downs.forEach(function (f) {
        var dis = id ? '' : ' disabled title="请在数据浏览中打开具体单据后再流转"';
        h += '<div class="fc-node tgt"><b>' + esc(tblName(f.to)) + '</b><div class="mini">' + esc(f.label) + '</div>' +
          '<button class="primary sm" data-flowto="' + esc(f.to) + '" data-srct="' + esc(t) + '" data-srcid="' + esc(id || '') + '"' + dis + '>' + esc(f.label) + ' →</button></div>';
      });
    } else if (!id) {
      h += '<div class="fc-node muted">末端单据，无下游流转</div>';
    }
    h += '</div>';
    h += '</div>';
    h += '<p class="mini" style="padding:2px 14px 12px">说明：' + (id ? '上方「关联单」为已实际生成的上下游具体单据，点击可直接定位打开；' : '打开具体单据后，此处会显示已生成的上下游具体单号并可定位；') + '点「可向后流转」按钮即按业务流一键生成新单并复制表头 / 明细（如销售订单可生成销货单、生产工单、请购单）。总体上下游类型关系见「使用说明」。</p>';
    h += '</div>';
    return h;
  }

  /* ---------- 单据详情弹窗（主表信息 + 子表明细，独立界面） ---------- */
  function openDoc(t, id) {
    /* 单据详情要显示子表行、业务流上下游，同样是「点开才取数」 */
    if (needDeps(t, function () { openDoc(t, id); })) return;
    var def = S.TABLES[t]; var row = find(t, id); if (!row) return;
    st.doc = { t: t, id: id };
    var children = S.MASTER_DETAIL[t] || [];
    var cols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); }).filter(function (c) { return colOn(t, c.code); });
    var body = '<div class="toolbar" style="margin-bottom:6px"><span class="tag ok">单据详情</span><span class="mini">' + esc(t) + '</span><span class="spacer"></span><button class="ghost sm" id="btnFlowJump">业务流</button><button class="ghost sm" id="btnDocEdit">编辑单据</button></div>';
    body += '<div class="fgrid doc-grid">';
    cols.forEach(function (c) {
      body += '<div class="fitem doc-item"><label>' + esc(c.label) + '</label><div class="dval">' + cellValue(row, c) + '</div></div>';
    });
    body += '</div>';
    children.forEach(function (d) { body += childPanel(row, d); });
    // 条码 / 二维码（物料资料 · 工序工单）：扫码 + 追溯入口
    body += barcodePanel(t, row);
    // 业务流区：来源（上游）→ 当前 → 去向（下游）+ 如何操作
    body += tableFlowPanel(t, id);

    document.getElementById('modal').classList.add('wide');
    document.getElementById('modalTitle').textContent = def.label + ' · 单据详情';
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = 'none';
    /* 底栏左钮必须与「关闭整个弹窗」语义绑定：openForm 里可能把它改成「返回单据详情」，
       此处若不显式重绑，从子表编辑返回详情后按钮会残留“点了没反应”的状态。 */
    var docCancel = document.getElementById('modalCancel');
    docCancel.textContent = '关 闭';
    docCancel.onclick = closeModal;
    document.getElementById('modalMask').style.display = 'flex';

    document.getElementById('btnDocEdit').onclick = function () { openForm(t, id, null); };
    document.getElementById('btnFlowJump').onclick = function () { closeModal(); st.view = 'guide'; setNav(); render(); };
    var mb = document.getElementById('modalBody');
    mb.querySelectorAll('[data-addchild]').forEach(function (b) {
      b.onclick = function () {
        var ctab = b.getAttribute('data-addchild');
        var link = children.find(function (d) { return d.table === ctab; });
        var preset = {}; preset[link.fk] = row[link.fk];
        openForm(ctab, null, preset);
      };
    });
    /* 子表明细也支持 CSV 导入（父单号自动绑定到当前单据） */
    mb.querySelectorAll('[data-impchild]').forEach(function (b) {
      b.onclick = function () {
        var ctab = b.getAttribute('data-impchild');
        var link = children.find(function (d) { return d.table === ctab; });
        var preset = {}; preset[link.fk] = row[link.fk];
        openImport(ctab, preset);
      };
    });
    mb.querySelectorAll('[data-editc]').forEach(function (b) {
      /* 用「第一个 |」切表名与 ID：复合主键的 ID 本身就含 |（如 WO-2026-0001|S10），
       * 旧写法 split('|')[1] 会把工序号切掉，打开错误的明细行。 */
      b.onclick = function (e) {
        e.stopPropagation();
        var v = b.getAttribute('data-editc'); var i = v.indexOf('|');
        openForm(v.slice(0, i), v.slice(i + 1), null);
      };
    });
    mb.querySelectorAll('[data-delc]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var v = b.getAttribute('data-delc'); var i = v.indexOf('|');
        if (confirm('确认删除该明细？删除后进入回收站，可在「表功能 ▾ → 回收站」恢复。')) { remove(v.slice(0, i), v.slice(i + 1)); toast('已移入回收站（明细）'); openDoc(t, id); }
      };
    });
    /* 业务流面板的「打开关联单 / 打开来源表 / 新建 / 向后流转」按钮由页面级委托事件统一处理（见下方 document 监听）。 */
  }

  function closeModal() {
    document.getElementById('modalMask').style.display = 'none';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalCancel').textContent = '取 消';
    st.doc = null;
  }
  /* 按业务单号直接打开某张单据（用于业务流「打开关联单」定位） */
  function openDocByNo(t, no) {
    if (needDeps(t, function () { openDocByNo(t, no); })) return;
    var def = S.TABLES[t]; if (!def) return;
    var rec = rows(t).find(function (r) { return String(r[def.pk]) === String(no); });
    if (!rec) { toast('关联单据不存在或已删除'); return; }
    openDoc(t, rec.ID);
  }
  /* 点「表功能」下拉以外的任何地方都收起它（DOM 每次 render 重建，故按 id 现取） */
  document.addEventListener('click', function () {
    var m = document.getElementById('h2menu');
    if (m && !m.hidden) m.hidden = true;
  });
  /* 业务流面板按钮统一委托处理（模态与页面共用，避免重复绑定 / 双触发） */
  document.addEventListener('click', function (e) {
    var el = e.target; if (!el || typeof el.closest !== 'function') return;
    var b;
    if ((b = el.closest('[data-linkopen]'))) { var p = b.getAttribute('data-linkopen').split('|'); openDocByNo(p[0], p[1]); return; }
    if ((b = el.closest('[data-flowopen]'))) { closeModal(); st.table = b.getAttribute('data-flowopen'); st.view = 'browser'; setNav(); render(); return; }
    if ((b = el.closest('[data-flownew]'))) { openForm(b.getAttribute('data-flownew'), null, null); return; }
    if ((b = el.closest('[data-flowto]'))) { var stx = b.getAttribute('data-srct'), six = b.getAttribute('data-srcid'); if (stx && six) doFlow(stx, six, b.getAttribute('data-flowto')); return; }
    if ((b = el.closest('[data-trace]'))) { var tp = b.getAttribute('data-trace').split('|'); closeModal(); st.table = tp[0]; st.search = decodeURIComponent(tp[1] || ''); st.sel = null; st.view = 'browser'; setNav(); render(); return; }
    if ((b = el.closest('[data-printqr]'))) { var pq = b.getAttribute('data-printqr').split('|'); printLabel(pq[0], pq[1]); return; }
  });
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalCancel').onclick = closeModal;

  /* ---------- 数据导入（CSV 粘贴 / 上传，含引用 + 父单存在性校验） ----------
   * preset：子表明细导入时由父单带入的固定字段（如 { SO_NO: 'SO-2026-001' }），
   *         该字段在模板中固定为预设值，不允许 CSV 覆盖，保证明细永远挂在当前单据下。 */
  function openImport(t, preset) {
    if (needDeps(t, function () { openImport(t, preset); })) return;
    preset = preset || {};
    var def = S.TABLES[t];
    var cols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); });
    var fixedCodes = Object.keys(preset);
    var parseResult = null; // { rows: [{biz, ok, msg}], good }
    function refExists(refTable, val) { if (val === '' || val == null) return false; var pk = S.TABLES[refTable].pk; return rows(refTable).some(function (r) { return String(r[pk]) === String(val); }); }
    function parentCheck(biz) {
      var fk = S.IMPORT_FK[t]; if (!fk) return { ok: true, msg: '' };
      var errs = [];
      Object.keys(fk).forEach(function (f) { var v = biz[f]; if (v === undefined || v === '' || v == null) { errs.push('父单字段「' + f + '」为空'); return; } if (!refExists(fk[f], v)) errs.push('父单「' + f + '=' + v + '」在' + S.TABLES[fk[f]].label + '中不存在'); });
      return { ok: errs.length === 0, msg: errs.join('；') };
    }
    function coerce(c, v) {
      if (v === undefined) return '';
      v = String(v).trim(); if (v === '') return '';
      if (c.type === 'i') { var i = parseInt(v, 10); return isNaN(i) ? v : i; }
      if (c.type === 'd') { var d = parseFloat(v); return isNaN(d) ? v : d; }
      if (c.type === 'b') return (/^(1|是|Y|YES|TRUE|真)$/i.test(v)) ? 1 : 0;
      return v;
    }
    function parseCSV(text) {
      var out = [], row = [], field = '', q = false;
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
        else { if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n') { row.push(field); out.push(row); row = []; field = ''; } else field += ch; }
      }
      if (field !== '' || row.length) { row.push(field); out.push(row); }
      return out;
    }
    /* 表头解析：兼容 ① 中文名 ② 字段编号 ③ 中文名(CODE) ④ 中文名*(CODE) ⑤ 中文名[规则] */
    function mapHeader(headers) {
      return headers.map(function (h) {
        h = (h == null ? '' : String(h)).trim();
        if (!h) return null;
        var m = /[（(]\s*([A-Za-z][A-Za-z0-9_]*)\s*[)）]/.exec(h);
        if (m) { var c0 = cols.find(function (x) { return x.code.toLowerCase() === m[1].toLowerCase(); }); if (c0) return c0.code; }
        var clean = h.replace(/[*＊]/g, '').replace(/[（(].*?[)）]/g, '').replace(/[\[【].*?[\]】]/g, '').trim();
        var c = cols.find(function (x) { return x.code.toLowerCase() === clean.toLowerCase(); });
        if (!c) c = cols.find(function (x) { return x.label === clean; });
        return c ? c.code : null;
      });
    }
    function validate(biz) {
      var errs = [];
      cols.forEach(function (c) {
        if (fixedCodes.indexOf(c.code) >= 0) return; // 预设绑定字段由系统带入，不参与校验
        if (c.req && (biz[c.code] === undefined || biz[c.code] === '' || biz[c.code] == null)) errs.push('缺必填「' + c.label + '」');
        if (c.ref && biz[c.code] !== undefined && biz[c.code] !== '' && biz[c.code] != null) { if (!refExists(c.ref, biz[c.code])) errs.push(c.label + '「' + biz[c.code] + '」在' + S.TABLES[c.ref].label + '中不存在'); }
        else if (c.dict && biz[c.code] !== undefined && biz[c.code] !== '' && biz[c.code] != null) { if (!dictExists(c.dict, biz[c.code])) errs.push(c.label + '「' + biz[c.code] + '」不在字典 ' + c.dict + ' 中'); }
      });
      var pc = parentCheck(biz); if (!pc.ok) errs.push(pc.msg);
      return errs;
    }
    function realHeader() {
      /* 模板首行为 # 注释行，表头在第 2 行；用户也可能直接给表头行 —— 取第一行非 # 行 */
      var lines = parseCSV(document.getElementById('impCsv').value || '')
        .filter(function (r) { return r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); })
        .filter(function (r) { return !/^\s*#/.test(String(r[0] == null ? '' : r[0])); });
      return lines;
    }
    /* 子表导入支持：主表带子表时，允许「主子表合并文件」（与本表导出格式一致）。
       识别依据：首列表头含 ROW_TYPE，或存在 行类型【主表|子表明细】列。 */
    var mdChildren = S.MASTER_DETAIL[t] || [];
    var mayHaveDetail = mdChildren.length > 0 && fixedCodes.length === 0;

    function headerInfo(header) {
      /* 返回 { mode:'master'|'detail', colMap:[code|null], childMap:[{table,code}|null] } */
      var idx = -1;
      header.forEach(function (h, i) { if (idx < 0 && /ROW_TYPE/.test(String(h))) idx = i; });
      if (idx < 0) return { mode: 'master', typeIdx: -1, colMap: mapHeader(header), childMap: header.map(function () { return null; }) };
      /* 明细列：表头形如 子表名·中文名(TABLE.CODE) → 精确定位到子表字段；
         否则按子表字段编号 / 中文名在「各自所属子表」内反查。 */
      var childCodes = {};
      mdChildren.forEach(function (d) {
        S.columnsOf(d.table).forEach(function (c) { if (c.sys && c.code !== 'REMARK') return; childCodes[d.table] = childCodes[d.table] || {}; childCodes[d.table][c.code.toUpperCase()] = c.code; childCodes[d.table][c.label] = c.code; });
      });
      var mColMap = mapHeader(header);
      var cMap = header.map(function (h, i) {
        if (i === idx) return null;
        h = (h == null ? '' : String(h)).trim(); if (!h) return null;
        var m = /[（(]\s*([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\s*[)）]/.exec(h);
        if (m && childCodes[m[1]]) { var cc = childCodes[m[1]][m[2].toUpperCase()]; if (cc) return { table: m[1], code: cc }; }
        /* 无前缀：若主表也要这一列，优先主表；否则在子表里找唯一命中 */
        if (mColMap[i]) return null;
        var clean = h.replace(/[*＊]/g, '').replace(/[（(].*?[)）]/g, '').replace(/[\[【].*?[\]】]/g, '').trim();
        var hit = null;
        mdChildren.forEach(function (d) {
          var byCode = childCodes[d.table][clean.toUpperCase()], byLabel = childCodes[d.table][clean];
          if (byCode || byLabel) hit = { table: d.table, code: byCode || byLabel };
        });
        return hit;
      });
      return { mode: 'detail', typeIdx: idx, colMap: mColMap, childMap: cMap };
    }

    function doParse() {
      var lines = realHeader();
      if (lines.length < 2) { document.getElementById('impStat').textContent = '未解析到有效数据（至少需要表头 + 1 行，模板中的 # 说明行会自动忽略）'; document.getElementById('impPreview').innerHTML = ''; parseResult = null; return; }
      var header = lines[0];
      var info = headerInfo(header);
      var colMap = info.colMap;

      /* ---- A. 主子表合并文件（主表行 + 明细行） ---- */
      if (info.mode === 'detail') {
        var rowsArr = [], good = 0, lastMasterBiz = null, nMaster = 0, nLine = 0;
        /* 本文件内已通过校验的主表主键集合：合并文件自带主表行时，明细行的父单可能尚未落库，
           只要父单在本文件里出现过就应判为「关联成立」——这是主子表一次导入的前提。 */
        var seenMasters = {};
        var pkOf = S.TABLES[t] && S.TABLES[t].pk;
        for (var i = 1; i < lines.length; i++) {
          var r = lines[i];
          var type = String(r[info.typeIdx] == null ? '' : r[info.typeIdx]).trim();
          var isDetail = /明细|子表|detail/i.test(type);
          if (isDetail) {
            if (!mdChildren.length) { rowsArr.push({ kind: 'line', ok: false, msg: '本表没有子表，无法导入明细行' }); continue; }
            /* 明细行可能含多个子表 → 逐子表分别组装 */
            var perChild = {};
            mdChildren.forEach(function (d) { perChild[d.table] = {}; });
            info.childMap.forEach(function (cc, idx2) { if (!cc) return; var cell = r[idx2] != null ? r[idx2] : ''; if (String(cell).trim() === '') return; perChild[cc.table][cc.code] = coerce(S.columnsOf(cc.table).find(function (x) { return x.code === cc.code; }), cell); });
            /* 父单号：优先取明细行上主表列里的 fk 值；没有则沿用上一条主表行的 fk */
            colMap.forEach(function (code, idx2) { if (!code) return; });
            var anyChild = false;
            mdChildren.forEach(function (d) {
              var b = perChild[d.table];
              var vals = Object.keys(b).filter(function (k) { return String(b[k]) !== ''; });
              if (vals.length === 0) return;
              anyChild = true;
              var fkVal = b[d.fk];
              if (!fkVal && lastMasterBiz) { fkVal = lastMasterBiz[d.fk]; }
              if (fkVal !== undefined && fkVal !== '') b[d.fk] = fkVal;
              /* 关联主单必须成立：本文件里已出现（本次导入自带主表行），或系统里已存在 */
              var errs = [];
              var parentOk = b[d.fk] ? (seenMasters[b[d.fk]] || refExists(t, b[d.fk])) : false;
              if (!b[d.fk]) errs.push('明细行缺父单号「' + d.fk + '」，且上方没有可继承的主表行');
              else if (!parentOk) errs.push('父单「' + d.fk + '=' + b[d.fk] + '」不在本文件或系统中存在');
              S.columnsOf(d.table).forEach(function (c) {
                if (c.sys && c.code !== 'REMARK') return;   // 系统字段不参与明细校验（导入时由系统生成）
                if (c.req && (b[c.code] === undefined || b[c.code] === '')) errs.push('缺必填「' + S.TABLES[d.table].label + '·' + c.label + '」');
                /* 明细的「父单号」由上面的 parentOk 校验（允许本文件自带的主表行），此处不重复按「系统已存在」判死 */
                if (c.code !== d.fk && c.ref && b[c.code] !== undefined && b[c.code] !== '' && !refExists(c.ref, b[c.code])) errs.push(S.TABLES[d.table].label + '·' + c.label + '「' + b[c.code] + '」在' + S.TABLES[c.ref].label + '中不存在');
              });
              if (errs.length === 0) { good++; nLine++; } 
              rowsArr.push({ kind: 'line', table: d.table, biz: b, ok: errs.length === 0, msg: errs.join('；') });
            });
            if (!anyChild) rowsArr.push({ kind: 'line', ok: false, msg: '明细行没有任何字段值' });
            continue;
          }
          /* 主表行 */
          var biz = {};
          colMap.forEach(function (code, idx2) { if (!code) return; var cell = r[idx2] != null ? r[idx2] : ''; biz[code] = coerce(cols.find(function (c) { return c.code === code; }), cell); });
          cols.forEach(function (c) { if (biz[c.code] === undefined) biz[c.code] = ''; });
          /* 主表行的「主表列」里也可能填了父单号（=pk），用于明细继承 */
          var errs2 = validate(biz);
          if (errs2.length === 0) {
            good++; nMaster++; lastMasterBiz = biz;
            /* 登记本文件内已成立的主键（pk 与所有子表 fk 同名列都登记，便于明细行就近匹配） */
            if (pkOf && biz[pkOf]) seenMasters[biz[pkOf]] = 1;
            mdChildren.forEach(function (d) { if (biz[d.fk]) seenMasters[biz[d.fk]] = 1; });
          } else { lastMasterBiz = null; }
          rowsArr.push({ kind: 'master', biz: biz, ok: errs2.length === 0, msg: errs2.join('；') });
        }
        parseResult = { rows: rowsArr, good: good, mode: 'detail', nMaster: nMaster, nLine: nLine };
        var st2 = '主子表合并文件：主表 ' + nMaster + ' 行、明细 ' + nLine + ' 行，有效共 ' + good + ' 行' + (good < rowsArr.length ? '，无效 ' + (rowsArr.length - good) + ' 行' : '');
        document.getElementById('impStat').textContent = st2;
        document.getElementById('impPreview').innerHTML = renderPreview();
        return;
      }

      /* ---- B. 普通单表文件 ---- */
      if (colMap.every(function (x) { return !x; })) { document.getElementById('impStat').textContent = '表头无法识别：请使用「下载模板」的表头（形如 客户编号*(CUSTOMER_CODE)），或用中文名 / 字段编号作表头'; document.getElementById('impPreview').innerHTML = ''; parseResult = null; return; }
      var missReq = cols.filter(function (c) { return c.req && fixedCodes.indexOf(c.code) < 0 && colMap.indexOf(c.code) < 0; });
      var rowsArr2 = []; var good2 = 0;
      for (var j = 1; j < lines.length; j++) {
        var rj = lines[j]; var biz2 = {};
        colMap.forEach(function (code, idx2) { if (!code) return; var cell = rj[idx2] != null ? rj[idx2] : ''; biz2[code] = coerce(cols.find(function (c) { return c.code === code; }), cell); });
        cols.forEach(function (c) { if (biz2[c.code] === undefined) biz2[c.code] = ''; });
        fixedCodes.forEach(function (code) { biz2[code] = preset[code]; }); // 预设绑定字段强制覆盖
        var errs3 = validate(biz2); if (errs3.length === 0) good2++;
        rowsArr2.push({ kind: 'master', biz: biz2, ok: errs3.length === 0, msg: errs3.join('；') });
      }
      parseResult = { rows: rowsArr2, good: good2, mode: 'master' };
      var stat = '解析 ' + rowsArr2.length + ' 行，有效 ' + good2 + ' 行' + (good2 < rowsArr2.length ? '，无效 ' + (rowsArr2.length - good2) + ' 行' : '');
      if (missReq.length) stat += '；缺列（将全部失败）：' + missReq.map(function (c) { return c.label; }).join('、');
      document.getElementById('impStat').textContent = stat;
      document.getElementById('impPreview').innerHTML = renderPreview();
    }
    function renderPreview() {
      if (!parseResult) return '';
      var isDetailMode = parseResult.mode === 'detail';
      var showCols = cols.slice(0, isDetailMode ? 6 : 8);
      var h = '<div class="tbl-wrap"><table class="grid sm"><thead><tr><th>#</th>';
      h += '<th>行类型</th>';
      showCols.forEach(function (c) { h += '<th>' + esc(c.label) + (fixedCodes.indexOf(c.code) >= 0 ? ' <span class="tag">绑定</span>' : '') + '<br><code>' + esc(c.code) + '</code></th>'; });
      h += '<th>校验结果</th></tr></thead><tbody>';
      parseResult.rows.forEach(function (r, i) {
        h += '<tr class="' + (r.ok ? '' : 'badrow') + '"><td>' + (i + 1) + '</td>';
        h += '<td>' + (r.kind === 'line' ? '<span class="tag warn">明细' + (r.table ? '·' + esc(S.TABLES[r.table].label) : '') + '</span>' : '<span class="tag ok">主表</span>') + '</td>';
        showCols.forEach(function (c) {
          var v = '';
          if (r.kind === 'line') { v = r.biz[c.code] !== undefined ? r.biz[c.code] : ''; }
          else { v = r.biz[c.code] !== undefined ? r.biz[c.code] : ''; }
          h += '<td>' + esc(v) + '</td>';
        });
        h += '<td>' + (r.ok ? '<span class="tag ok">通过</span>' : '<span class="tag bad" title="' + esc(r.msg) + '">' + esc(r.msg) + '</span>') + '</td></tr>';
      });
      h += '</tbody></table></div>';
      if (isDetailMode) h += '<p class="mini" style="margin-top:6px">主表行先写入并落库，随后的明细行按「父单号」自动挂到对应主单下，形成主子表关联。</p>';
      return h;
    }
    /* 模板：第 1 行为 # 规则说明（导入时自动忽略），第 2 行为表头「中文名*(编号)」，
       必填用 * 标注，引用字段用 [须为已存在的XX] 标注绑定关系。 */
    function tplHeaderLine() {
      if (mayHaveDetail) {
        /* 带子表的主表：模板与导出格式一致（行类型 + 主表列 + 各子表列），一行主单后跟它的明细 */
        var head = ['行类型【主表|子表明细】(ROW_TYPE)'];
        if (mdChildren.length > 1) head.push('子表(CHILD_TABLE)');
        cols.forEach(function (c) {
          var rule = (c.ref ? '[须为' + S.TABLES[c.ref].label + '中已存在的编号]' : (c.dict ? '[须为字典 ' + c.dict + ' 的编号]' : ''));
          head.push(c.label + (c.req ? '*' : '') + '(' + c.code + ')' + rule);
        });
        var mCodes = {}; cols.forEach(function (c) { mCodes[c.code] = true; });
        var cnt = {}; mdChildren.forEach(function (d) { S.columnsOf(d.table).forEach(function (c) { if (!(c.sys && c.code !== 'REMARK')) cnt[c.code] = (cnt[c.code] || 0) + 1; }); });
        mdChildren.forEach(function (d) {
          S.columnsOf(d.table).forEach(function (c) {
            if (c.sys && c.code !== 'REMARK') return;
            var pre = (mCodes[c.code] || cnt[c.code] > 1 || mdChildren.length > 1);
            var rule = (c.code === d.fk) ? '[本文件自带主表行或系统中已存在]'
              : ((c.ref ? '[须为' + S.TABLES[c.ref].label + '中已存在的编号]' : (c.dict ? '[须为字典 ' + c.dict + ' 的编号]' : '')));
            head.push(pre
              ? S.TABLES[d.table].label + '·' + c.label + (c.req ? '*' : '') + '(' + d.table + '.' + c.code + ')' + rule
              : c.label + (c.req ? '*' : '') + '(' + c.code + ')' + rule);
          });
        });
        return head.join(',');
      }
      return cols.map(function (c) {
        var rule = (c.ref ? '[须为' + S.TABLES[c.ref].label + '中已存在的编号]' : (c.dict ? '[须为字典 ' + c.dict + ' 的编号]' : ''));
        var fx = fixedCodes.indexOf(c.code) >= 0 ? '[已绑定：' + preset[c.code] + ']' : '';
        return c.label + (c.req ? '*' : '') + '(' + c.code + ')' + rule + fx;
      }).join(',');
    }
    function downloadTpl() {
      var rules = [];
      rules.push('# MES 导入模板 · ' + def.label + '（表字段 ' + t + '）');
      rules.push('# 规则1：表头中带 * 的为必填项，不可为空；未带 * 的字段可留空。');
      rules.push('# 规则2：带 [须为XX中已存在的编号] 的为引用字段，必须先在对应主数据里建好（只能选已存在的主数据）。');
      if (S.IMPORT_FK[t]) Object.keys(S.IMPORT_FK[t]).forEach(function (f) {
        rules.push('# 规则3：明细字段「' + f + '」必须绑定已存在的' + S.TABLES[S.IMPORT_FK[t][f]].label + '单号（父单存在性校验）。');
      });
      if (mayHaveDetail) {
        rules.push('# 主子表：本表带子表 —— 首列「行类型」填「主表」或「子表明细」。');
        rules.push('#   先写 1 行「主表」，紧接着写属于它的若干行「子表明细」（父单号列 ' + mdChildren.map(function (d) { return d.fk; }).join('/') + ' 可留空，自动继承紧邻上方的主表行）。');
        rules.push('#   明细字段以「子表名·字段名」前缀表头标识归属，例如 ' + (function () { var d0 = mdChildren[0]; var c0 = S.columnsOf(d0.table).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); })[1]; return S.TABLES[d0.table].label + '·' + (c0 ? c0.label : '字段') + '(' + d0.table + '.' + (c0 ? c0.code : 'CODE') + ')'; })() + '。');
        rules.push('#   也可只用「导出（含明细）」得到的文件直接回灌 —— 两者格式完全一致。');
      }
      fixedCodes.forEach(function (code) { rules.push('# 绑定：字段「' + code + '」已由当前单据带入，固定为 ' + preset[code] + '，无需在文件中填写（填了也会被覆盖）。'); });
      rules.push('# 使用方法：保留本行与下一行表头，从第 3 行起按行填写数据；保存为 UTF-8 CSV 后上传，或直接粘贴到下方文本框。');
      var csv = '\ufeff' + rules.join('\n') + '\n' + tplHeaderLine() + '\n';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = def.label + (mayHaveDetail ? '_主子表导入模板' : '_导入模板') + '.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    var reqCols = cols.filter(function (c) { return c.req && fixedCodes.indexOf(c.code) < 0; });
    var refCols = cols.filter(function (c) { return c.ref; });
    var body = '<div class="import-wrap">';
    body += '<div class="imp-rules"><b>导入规则</b><ul>' +
      '<li><b>必填项</b>：' + (reqCols.length ? reqCols.map(function (c) { return esc(c.label); }).join('、') : '无') + '（模板表头用 <code>*</code> 标注）。</li>' +
      (refCols.length ? '<li><b>引用绑定</b>：' + refCols.map(function (c) { return esc(c.label) + ' → 须为「' + esc(S.TABLES[c.ref].label) + '」中已存在的编号'; }).join('；') + '。</li>' : '') +
      (S.IMPORT_FK[t] ? '<li><b>父单绑定</b>：' + Object.keys(S.IMPORT_FK[t]).map(function (f) { return esc(f) + ' 必须绑定已存在的「' + esc(S.TABLES[S.IMPORT_FK[t][f]].label) + '」'; }).join('；') + '。</li>' : '') +
      (fixedCodes.length ? '<li><b>已绑定字段</b>：' + fixedCodes.map(function (code) { return esc(code) + ' = ' + esc(preset[code]); }).join('、') + '（由当前单据带入，无需填写）。</li>' : '') +
      (mayHaveDetail ? '<li><b>支持主子表一次导入</b>：本表有子表（' + mdChildren.map(function (d) { return esc(S.TABLES[d.table].label); }).join('、') + '）。首列填「行类型」（<code>主表</code> / <code>子表明细</code>）：主表行后面紧跟属于它的明细行，明细行的父单号（' + mdChildren.map(function (d) { return '<code>' + esc(d.fk) + '</code>'; }).join('/') + '）留空即自动继承上一行主表。' +
        '「<b>导出</b>」出来的「含明细」文件可直接原样导入，格式一致。</li>' : '') +
      '<li>表头可使用 <code>中文名*(编号)</code>（推荐，模板即此格式），也可只用中文名或字段编号；<code>#</code> 开头的说明行会被自动忽略。</li>' +
      '<li>仅<b>校验通过</b>的行会写入系统。</li>' +
      '</ul></div>';
    body += '<div class="imp-toolbar"><button class="ghost sm" id="impTpl">下载模板(CSV·含中文表头与规则)</button><label class="ghost sm btn-file" for="impFile">选择CSV文件…</label><input type="file" id="impFile" accept=".csv,text/csv" style="display:none"/></div>';
    body += '<textarea id="impCsv" placeholder="将 CSV 粘贴到此处（建议直接粘贴「下载模板」的内容后补数据行），或点击「选择CSV文件」上传…" style="width:100%;height:140px;font-family:monospace"></textarea>';
    body += '<div class="imp-toolbar"><button class="primary sm" id="impParse">解析并校验</button><span class="mini" id="impStat"></span></div>';
    body += '<div id="impPreview"></div>';
    body += '</div>';

    document.getElementById('modal').classList.add('wide');
    document.getElementById('modalTitle').textContent = '导入数据 · ' + def.label + (fixedCodes.length ? '（已绑定父单 ' + fixedCodes.map(function (c) { return preset[c]; }).join(',') + '）' : '');
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalMask').style.display = 'flex';
    document.getElementById('modalCancel').textContent = '关闭';
    /* 与导入语义一致：底栏左钮＝放弃导入并关闭弹窗（显式重绑，避免残留上一个弹窗的绑定） */
    document.getElementById('modalCancel').onclick = closeModal;
    var saveBtn = document.getElementById('modalSave');
    saveBtn.style.display = ''; saveBtn.textContent = '确认导入';
    var impBackDoc = st.doc; // 由子表明细「导入」进入时，导入完成后回到单据详情
    saveBtn.onclick = function () {
      if (!parseResult || parseResult.good === 0) { toast('没有可导入的有效行，请先解析'); return; }
      var n = 0, nChild = 0;
      /* 按文件顺序写入：主表行先落库，明细行随后按父单号挂接，保证关联成立 */
      parseResult.rows.forEach(function (r) {
        if (!r.ok) return;
        if (r.kind === 'line') { insert(r.table, r.biz); nChild++; n++; }
        else { insert(t, r.biz); n++; }
      });
      st.doc = impBackDoc;
      closeModal();
      toast('成功导入 ' + n + ' 条记录' + (nChild ? '（含明细 ' + nChild + ' 条）' : '') + '到「' + def.label + '」');
      render();
      if (impBackDoc) openDoc(impBackDoc.t, impBackDoc.id);
    };
    document.getElementById('impTpl').onclick = downloadTpl;
    document.getElementById('impParse').onclick = doParse;
    document.getElementById('impFile').onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { document.getElementById('impCsv').value = rd.result; doParse(); }; rd.readAsText(f, 'UTF-8');
    };
  }

  /* ---------- 导出 CSV（可选仅导出选中） ----------
   * 有子表（MASTER_DETAIL）的主表：导出为「主子表合并文件」，用首列「行类型」区分
   *   行类型 = 主表 | 子表明细
   * 主表行：主表所有业务字段 + （子表列全留空）；子表明细行：父单号 + 明细字段。
   * 这样导出的文件既能直接看懂（一张单的用户一眼看到它的明细），也能被导入功能原样回灌。 */
  /* listOverride：分页后由调用方传入「当前页」，不传则沿用整表已载入行（保持旧口径） */
  function exportCsv(t, onlySelected, listOverride) {
    var def = S.TABLES[t];
    var children = S.MASTER_DETAIL[t] || [];
    var hasChild = children.length > 0;
    var mCols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); });
    var list = listOverride || rows(t);
    if (onlySelected) { var sel = (st.sel && st.sel[t]) || {}; list = list.filter(function (r) { return sel[r.ID]; }); }
    if (list.length === 0) { toast(onlySelected ? '未选择任何记录，请先勾选要导出的行' : '当前表没有数据可导出'); return; }
    function q(v) { var s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

    var csv, nMaster = list.length, nLine = 0, fname;
    if (!hasChild) {
      /* 无子表：字段单一，保持原样（表头 + 数据行） */
      csv = '﻿' + mCols.map(function (c) { return c.label + '(' + c.code + ')'; }).join(',') + '\n';
      list.forEach(function (r) { csv += mCols.map(function (c) { var v = r[c.code]; return q(typeof v === 'object' && v !== null ? JSON.stringify(v) : v); }).join(',') + '\n'; });
    } else {
      /* 有子表：所有子表列合并成一张宽表，用首列「行类型」区分主/明细行。
         表头冲突时加子表前缀，保证 (字段) 能唯一反查到所属表。 */
      var cCols = [];   // [{table, code, header}]
      var mCodes = {};
      mCols.forEach(function (c) { mCodes[c.code] = true; });
      var cCodes = {};  // code -> 出现次数（跨子表判重）
      children.forEach(function (d) {
        S.columnsOf(d.table).forEach(function (c) {
          if (c.sys && c.code !== 'REMARK') return;
          cCodes[c.code] = (cCodes[c.code] || 0) + 1;
        });
      });
      var multiChild = children.length > 1;
      children.forEach(function (d) {
        S.columnsOf(d.table).forEach(function (c) {
          if (c.sys && c.code !== 'REMARK') return;
          var needPrefix = mCodes[c.code] || cCodes[c.code] > 1 || multiChild;
          cCols.push({
            table: d.table, code: c.code,
            header: needPrefix
              ? S.TABLES[d.table].label + '·' + c.label + '(' + d.table + '.' + c.code + ')'
              : c.label + '(' + c.code + ')'
          });
        });
      });

      var head = ['行类型【主表|子表明细】(ROW_TYPE)'];
      if (multiChild) head.push('子表(CHILD_TABLE)');
      mCols.forEach(function (c) { head.push(c.label + '(' + c.code + ')'); });
      cCols.forEach(function (c) { head.push(c.header); });
      csv = '﻿' + head.join(',') + '\n';
      var mOff = multiChild ? 2 : 1;

      /* 明细行填写规则：只填「本子表的列」+「该子表的父单号 fk」；
         同名的审核类字段（AUDIT_*）是各表自己的审计列，不跨表带值，避免串数据。 */
      function masterLine(r) {
        var line = ['主表'];
        if (multiChild) line.push('');
        mCols.forEach(function (c) { var v = r[c.code]; line.push(q(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)); });
        cCols.forEach(function () { line.push(''); });
        return line.join(',');
      }
      function detailLine(r, d, ln) {
        var line = ['子表明细'];
        if (multiChild) line.push(d.table);
        mCols.forEach(function (c) {
          /* 父单号列回填主单值（人读友好，导入时也靠它定位父单）；其余主表列一律留空 */
          line.push(q(c.code === d.fk ? r[c.code] : ''));
        });
        cCols.forEach(function (cc) {
          if (cc.table !== d.table) { line.push(''); return; }
          var v = (cc.code === d.fk) ? r[d.fk] : ln[cc.code];
          line.push(q(typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
        });
        return line.join(',');
      }

      list.forEach(function (r) {
        csv += masterLine(r) + '\n';
        children.forEach(function (d) {
          rows(d.table).filter(function (x) { return String(x[d.fk]) === String(r[d.fk]); }).forEach(function (ln) {
            nLine++;
            csv += detailLine(r, d, ln) + '\n';
          });
        });
      });
    }
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    /* 文件名用中文，便于识别；括号与斜杠等非法字符先清理，「权限/负荷」这类会吃掉字面量，故用正则 */
    fname = String(def.label || t).replace(/[\\/:*?"<>|]/g, '') + (hasChild ? '_含明细' : '') + '_' + ymd() + '.csv';
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出 ' + nMaster + ' 条主表记录' + (hasChild ? ' + ' + nLine + ' 条明细' : '') + (onlySelected ? '（已选）' : '') + (listOverride ? '（当前页）' : '') + ' → ' + fname);
  }

  /* ---------- 打印（新窗口输出可打印列表；可选仅打印选中） ---------- */
  function doPrint(t, onlySelected, listOverride) {
    var def = S.TABLES[t];
    var cols = displayCols(t);
    var list = listOverride || rows(t);
    if (onlySelected) { var sel = (st.sel && st.sel[t]) || {}; list = list.filter(function (r) { return sel[r.ID]; }); }
    if (list.length === 0) { toast(onlySelected ? '未选择任何记录，请先勾选要打印的行' : '当前表没有数据可打印'); return; }
    var h = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + esc(def.label) + '</title><style>' +
      'body{font-family:"Microsoft YaHei",sans-serif;margin:24px;color:#111}' +
      'h2{margin:0 0 4px} .meta{color:#666;font-size:12px;margin-bottom:14px}' +
      'table{border-collapse:collapse;width:100%;font-size:12px}' +
      'th,td{border:1px solid #999;padding:5px 7px;text-align:left;word-break:break-all}' +
      'th{background:#f0f0f0} tr:nth-child(even) td{background:#fafafa}' +
      '@media print{ .noprint{display:none} }' +
      '</style></head><body>' +
      '<h2>MES 制造执行管理系统 · ' + esc(def.label) + '</h2>' +
      '<div class="meta">表名 ' + esc(t) + ' · 共 ' + list.length + ' 条' + (listOverride ? '（当前页）' : '') + (onlySelected ? '（已选）' : '') + ' · 打印时间 ' + now() + '</div>' +
      '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      list.map(function (r) { return '<tr>' + cols.map(function (c) { var v = r[c.code]; return '<td>' + esc(typeof v === 'object' && v !== null ? JSON.stringify(v) : (v === 0 ? '0' : (v || ''))) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>' +
      '<p class="noprint" style="margin-top:14px"><button onclick="window.print()" style="padding:6px 18px">打 印</button></p>' +
      '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('浏览器拦截了打印窗口，请允许弹窗后重试'); return; }
    w.document.open(); w.document.write(h); w.document.close();
  }

  /* ---------- 审核（为后续工作流预留：审核状态 / 审核人 / 审核时间） ---------- */
  function openAudit(t, presetId) {
    var def = S.TABLES[t];
    var pk = def.pk || 'ID';
    var noCol = S.columnsOf(t).some(function (c) { return c.code === 'DOC_NO'; }) ? 'DOC_NO' : pk;
    var list = rows(t);
    if (list.length === 0) { toast('当前表没有可审核的记录'); return; }
    var opts = '<option value="">— 选择要审核的' + esc(def.label) + ' —</option>';
    list.forEach(function (r) {
      var no = r[noCol] != null ? r[noCol] : r[pk];
      var cur = r.AUDIT_STATUS || '待审核';
      opts += '<option value="' + esc(r.ID) + '"' + (presetId === r.ID ? ' selected' : '') + '>' + esc(no) + '（' + esc(cur) + '）</option>';
    });
    var body = '<p class="mini">审核动作会写入该记录的 <b>审核状态 / 审核人 / 审核时间</b> 字段（所有表均已预留），供后续工作流流转使用。</p>';
    body += '<div class="fgrid">';
    body += '<div class="fitem full"><label>选择记录</label><select id="auRec">' + opts + '</select></div>';
    body += '<div class="fitem"><label>审核结果</label><select id="auResult"><option value="已审核">通过</option><option value="已驳回">驳回</option><option value="待审核">重置为待审核</option></select></div>';
    body += '<div class="fitem"><label>审核意见</label><input type="text" id="auMemo" placeholder="选填，将追加到备注"/></div>';
    body += '</div><p class="mini" id="auInfo"></p>';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '审核 · ' + def.label;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalSave').textContent = '确认审核';
    document.getElementById('modalCancel').textContent = '取消';
    document.getElementById('modalMask').style.display = 'flex';
    function showInfo() {
      var rec = find(t, document.getElementById('auRec').value);
      var el = document.getElementById('auInfo');
      if (!rec) { el.textContent = ''; return; }
      el.textContent = '当前：审核状态=' + (rec.AUDIT_STATUS || '待审核') + '，审核人=' + (rec.AUDIT_BY || '—') + '，审核时间=' + (rec.AUDIT_TIME || '—');
    }
    document.getElementById('auRec').onchange = showInfo; showInfo();
    document.getElementById('modalSave').onclick = function () {
      var id = document.getElementById('auRec').value;
      if (!id) { toast('请先选择要审核的记录'); return; }
      var result = document.getElementById('auResult').value;
      var memo = document.getElementById('auMemo').value.trim();
      var patch = { AUDIT_STATUS: result };
      if (result === '已审核' || result === '已驳回') { patch.AUDIT_BY = (CUR_USER||'anonymous'); patch.AUDIT_TIME = now(); }
      else { patch.AUDIT_BY = null; patch.AUDIT_TIME = null; }
      if (memo) { var rec = find(t, id); patch.REMARK = ((rec && rec.REMARK) ? rec.REMARK + '；' : '') + '审核意见：' + memo; }
      update(t, id, patch);
      closeModal();
      toast('已审核：' + result);
      render();
    };
  }

  /* ---------- 字段显示/隐藏配置（弹窗勾选，即时生效并持久化） ---------- */
  function openColVis(t) {
    var def = S.TABLES[t];
    var cols = S.columnsOf(t);
    var pk = def.pk || 'ID';
    var body = '<p class="mini">勾选 = 显示在数据列表 / 表单 / 详情中；取消勾选 = 隐藏（不删数据，随时可恢复）。<b>主键不可隐藏</b>。配置按表保存，刷新后仍生效。</p>';
    body += '<div class="set-list">';
    cols.forEach(function (c) {
      var lock = (c.code === pk || c.code === 'ID');
      var on = colOn(t, c.code);
      body += '<label class="set-row"><input type="checkbox" data-colvis="' + esc(c.code) + '" ' + (on ? 'checked' : '') + (lock ? ' disabled title="主键不可隐藏"' : '') + '/> <span>' + esc(c.label) + ' <code class="mini">' + esc(c.code) + '</code></span>' + (lock ? '<span class="mini">（主键）</span>' : '') + '</label>';
    });
    body += '</div><p class="mini">共 ' + cols.length + ' 个字段，当前显示 ' + cols.filter(function (c) { return colOn(t, c.code); }).length + ' 个。</p>';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '显示字段 · ' + def.label;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalSave').textContent = '完成';
    document.getElementById('modalCancel').textContent = '恢复默认（全部显示）';
    document.getElementById('modalMask').style.display = 'flex';
    document.getElementById('modalBody').querySelectorAll('[data-colvis]').forEach(function (cb) {
      cb.onchange = function () {
        setColVis(t, cb.getAttribute('data-colvis'), cb.checked);
        if (st.view === 'browser') { var c = document.getElementById('content'); c.innerHTML = viewBrowser(); bindView(); }
      };
    });
    document.getElementById('modalSave').onclick = function () { closeModal(); render(); };
    document.getElementById('modalCancel').onclick = function () {
      var cv = loadColVis(); delete cv[t]; saveColVis(cv);
      closeModal(); toast('已恢复默认显示'); render();
    };
  }

  /* ---------- 核心流程 ---------- */
  function viewFlow() {
    var h = '<div class="card"><h2>核心业务流程</h2>' +
      '<p class="mini">「核心流程」汇总各模块的业务上下游。若左侧已选中某张表（如销售订单），下方会直接展示该表的<b>来源 / 去向 / 操作</b>；未选中时先看全局业务流图。需要时点卡片右上角「展开一键演练」可按步骤跑通生产主链路。</p></div>';

    // 当前表流转（按表动态）
    if (st.table && S.TABLES[st.table]) {
      h += '<div class="card"><h3>当前表业务流 · ' + esc(S.TABLES[st.table].label) + '</h3>' + tableFlowPanel(st.table, null) + '</div>';
    }

    // 全局业务流图（模块上下游逻辑）
    h += viewFlowMap();

    // 一键演练（默认收起，点按钮再展开）
    var drillOpen = st.drill === true;
    h += '<div class="card"><div class="fs-head" style="margin-bottom:0"><h3 style="margin:0">一键演练（演示脚本）</h3>' +
      '<span class="mini">可选功能：按步骤跑通「订单 → 工单 → 领料 → 报工 → 完工入库」</span>' +
      '<span class="spacer"></span><button class="ghost sm" id="btnDrill">' + (drillOpen ? '收起一键演练 ▴' : '展开一键演练 ▾') + '</button></div>';
    if (drillOpen) {
      var so = rows('SD_SALES_ORDER')[0];
      var soQty = so ? rows('SD_SALES_ORDER_LINE').filter(function (l) { return l.SO_NO === so.SO_NO; }).reduce(function (a, l) { return a + (+l.ORDER_QTY || 0); }, 0) : 0;
      var wo = rows('EX_WORK_ORDER').find(function (r) { return r.SO_NO === (so && so.SO_NO); });
      var issue = wo ? rows('EX_ISSUE_ORDER').find(function (r) { return r.WO_NO === wo.WO_NO; }) : null;
      var stepsRes = [];
      var s1done = so && so.REVIEW_STATUS === '通过';
      stepsRes.push(stepCard(1, '订单评审', so ? ('销售订单 ' + so.SO_NO + ' / 客户 ' + so.CUSTOMER_CODE + ' / 数量 ' + soQty + ' / 评审状态：' + (so.REVIEW_STATUS || '待评审')) : '无销售订单', s1done,
        s1done ? ('已评审通过，关联生产订单 ' + (so.MO_NO || '—')) : null, '通过订单评审', function () { if (so) update('SD_SALES_ORDER', so.ID, { REVIEW_STATUS: '通过', STATUS: '已评审', MO_NO: 'MO-P3-001' }); }, !s1done));
      var s2done = !!wo;
      stepsRes.push(stepCard(2, '工序级排产 / 工单下达', s2done ? ('已生成工序工单 ' + wo.WO_NO + '，工艺路线 ' + (wo.ROUTE_NO || '—') + '，计划数量 ' + wo.PLAN_QTY) : '将由销售订单 + BOM + 工艺路线生成成品工单(5101)并展开各道工序', s2done,
        s2done ? ('工单工序 ' + rows('EX_WO_STEP').filter(function (r) { return r.WO_NO === wo.WO_NO; }).length + ' 道，已写入 EX_WO_STEP / PP_SCHEDULE') : null, '生成工序工单', function () { genWorkOrder(so); }, !s2done));
      var s3done = !!issue;
      stepsRes.push(stepCard(3, '领料 / 上料', s3done ? ('已生成领料单 ' + issue.ISSUE_NO + '（限额领料）') : '依据工单 BOM 生成限额领料单(5401)，从原料仓发料（领料单已归入「库存管理」）', s3done,
        s3done ? ('领料 ' + issue.TOTAL_QTY + ' 件 → 库存扣减联动') : null, '生成领料单', function () { genIssue(wo); }, !s3done && !!wo));
      var reported = wo ? rows('EX_REPORT').filter(function (r) { return r.WO_NO === wo.WO_NO; }).length : 0;
      var s4done = wo && reported >= 4;
      stepsRes.push(stepCard(4, '逐工序报工（含工序检验 / 不合格闭环）', s4done ? ('已报工 ' + reported + ' 道工序，良品全部合格') : '按工艺路线逐道工序报工，检验点判定合格/不合格，不合格走返工闭环', s4done,
        s4done ? ('工序报工 ' + reported + ' 条；已演示 良品报工 + 不合格→返工 闭环') : null, '模拟逐工序报工', function () { reportAll(wo); }, !s4done && !!wo));
      var wipRows = wo ? rows('EX_WIP_BOARD').filter(function (r) { return r.WO_NO === wo.WO_NO; }).length : 0;
      var s5done = wipRows > 0;
      stepsRes.push(stepCard(5, 'WIP 工艺路线追踪', s5done ? ('已生成 WIP 看板快照 ' + wipRows + ' 条') : '汇总各工序报工，形成在制品进度看板（WIP 在制看板）', s5done,
        s5done ? '可到「生产看板 → WIP 看板」查看' : null, '刷新 WIP 看板', function () { genWip(wo); }, !s5done && !!wo));
      var fin = wo ? rows('WM_FINISH_IN').find(function (r) { return r.WO_NO === wo.WO_NO; }) : null;
      var s6done = !!fin;
      stepsRes.push(stepCard(6, '完工入库', s6done ? ('已完工入库，入库单 ' + fin.IN_NO) : '末道工序完成后完工入库（成品检验 FQC → 成品仓）', s6done,
        s6done ? ('成品入库 ' + fin.ACCEPT_QTY + ' 件，库存更新') : null, '完工入库', function () { genFinish(wo); }, !s6done && !!wo));
      h += '<p class="mini" style="margin-top:10px">围绕演示场景一步步跑通：订单评审 → 排产工单 → 领料 → 逐工序报工(含不合格闭环) → WIP → 完工入库。每步写入对应数据表。</p>' +
        stepsRes.join('<div class="flow-line">↓</div>');
    }
    h += '</div>';
    return h;
  }
  /* 全局业务流图：模块上下游逻辑（上下结构） */
  function viewFlowMap() {
    var layers = [
      { t: '工厂建模（主数据地基 + 工艺资料）', d: '客户 / 供应商 / 产品 / BOM / 物料 / 设备 / 量检具 / 工艺路线主数据 / 工序字典 / SOP / 工艺版本 / 外协工序 / 人员班组', up: '最上游：被所有模块依赖，统一编号与版本；工序字典为唯一工序主数据，工单据此展开各工序' },
      { t: '订单管理', d: '报价单 → 销售订单 → 销货单；请购比价 → 采购订单 → 到货(+IQC) → 采购入库', up: '来源：客户 / 工厂建模主数据；销售订单驱动 生产工单 与 请购单（已取消进货单环节）' },
      { t: '计划排产', d: '生产计划 → 工序排程 → 工序工单', up: '来源：销售订单 / 生产计划；工单下达到「生产管理」（已取消 MRP 展开环节）' },
      { t: '库存管理', d: '采购入库 / 成品入库 / 库存主账 / 出库（领料·销售·报废）', up: '来源：采购进货、生产完工入库；供给：生产领料、销售发货' },
      { t: '生产管理', d: '工单工序 / 领料(→库存出库) / 报工 / 检验 / 返工·报废 / 完工入库 / WIP', up: '来源：工单(计划排产) + 领料(库存)；结果回写库存' },
      { t: '设备管理', d: '设备台账 / 点检 / 保养 / 巡检 → 故障报修', up: '支撑：保障生产执行，异常触发报修闭环' }
    ];
    var chain = layers.map(function (l) {
      return '<div class="mc-item"><div class="mc-t">' + esc(l.t) + '</div><div class="mc-d">' + esc(l.d) + '</div><div class="mc-up mini">↑ 上游：' + esc(l.up) + '</div></div>';
    }).join('<div class="mc-arrow">↓</div>');
    return '<div class="card"><h3>全局业务流图（模块上下游逻辑）</h3>' +
      '<p class="mini">自上而下为业务发生的先后逻辑；箭头表示单据 / 数据的主要流向；「工艺资料（含 SOP / 版本，已并入工厂建模）」「设备管理」属于支撑层（被引用 / 保障），非强流转。采购链路经「请购比价 → 采购订单 → 到货(+IQC) → 采购入库」回到库存（已取消进货单环节）；生产链路经「工单→领料→报工→完工入库」回到库存，再由销货单发往客户，形成闭环。</p>' +
      '<div class="modchain">' + chain + '</div></div>';
  }
  function stepCard(n, title, desc, done, res, btn, fn, enabled) {
    var h = '<div class="step' + (done ? ' done' : '') + '"><div class="sh"><span class="num">' + n + '</span>' + esc(title) + (done ? ' <span class="tag ok">已完成</span>' : '') + '</div>' +
      '<div class="sd">' + esc(desc) + '</div>';
    if (res) h += '<div class="res">' + esc(res) + '</div>';
    if (!done && enabled !== false) h += '<div style="margin-top:10px"><button class="primary" data-flow="' + n + '">' + esc(btn) + '</button></div>';
    h += '</div>';
    return h;
  }
  function bindFlow() {
    var bd = document.getElementById('btnDrill');
    if (bd) bd.onclick = function () { st.drill = !(st.drill === true); render(); };
    document.querySelectorAll('[data-flow]').forEach(function (b) {
      b.onclick = function () {
        var fns = {
          1: function () { var so = rows('SD_SALES_ORDER')[0]; if (so) update('SD_SALES_ORDER', so.ID, { REVIEW_STATUS: '通过', STATUS: '已评审', MO_NO: 'MO-P3-001' }); },
          2: function () { genWorkOrder(rows('SD_SALES_ORDER')[0]); },
          3: function () { var wo = rows('EX_WORK_ORDER')[0]; genIssue(wo); },
          4: function () { var wo = rows('EX_WORK_ORDER')[0]; reportAll(wo); },
          5: function () { var wo = rows('EX_WORK_ORDER')[0]; genWip(wo); },
          6: function () { var wo = rows('EX_WORK_ORDER')[0]; genFinish(wo); }
        };
        if (fns[b.getAttribute('data-flow')]) { fns[b.getAttribute('data-flow')](); toast('执行成功'); render(); }
      };
    });
  }
  function genWorkOrder(so) {
    if (!so) return; var exist = rows('EX_WORK_ORDER').find(function (r) { return r.SO_NO === so.SO_NO; }); if (exist) return;
    var wo = insert('EX_WORK_ORDER', { WO_NO: '5101-' + ymd() + '-001', WO_TYPE: '成品工单', DOC_DATE: today(), PRODUCT_NO: 'P3PUMP001', PRODUCT_NAME: 'P3泵总成', PLAN_QTY: 100, PLAN_START: today(), PLAN_END: '2024-05-30', ROUTE_NO: 'RT-P3', ROUTE_VER: 'V1', BOM_VER: 'V1', LINE_CODE: 'A024W542', DEPT_CLASS: '三课', SO_NO: so.SO_NO, STATUS: '已下达', RELEASE_BY: '计划', RELEASE_TIME: now(), FINISH_QTY: 0, IN_QTY: 0 });
    var steps = rows('RT_ROUTE_STEP').filter(function (r) { return r.ROUTE_NO === 'RT-P3'; }).sort(function (a, b) { return a.SEQ_NO - b.SEQ_NO; });
    steps.forEach(function (s, i) {
      insert('EX_WO_STEP', { WO_NO: wo.WO_NO, STEP_NO: 'S' + s.SEQ_NO, STEP_NAME: s.STEP_NAME, EQUIP_SPEC: '', EQUIP_COUNT: 1, EQUIP_NO: '', PROC_MODE: (s.EQUIP_TYPE === '手工' ? '手工' : '自动'), PLAN_QTY: 100, REPORT_QTY: 0, GOOD_QTY: 0, NG_QTY: 0, SCRAP_QTY: 0, REWORK_QTY: 0, OPERATOR: 'E001', LEADER: 'E002', SHIFT: '白班', STEP_STATUS: '待开工', IS_QC_POINT: s.IS_QC_POINT, OUTSOURCE_FLAG: 0, PREV_STEP_NO: i > 0 ? ('S' + steps[i - 1].SEQ_NO) : '', NEXT_STEP_NO: i < steps.length - 1 ? ('S' + steps[i + 1].SEQ_NO) : '' });
      insert('PP_SCHEDULE', { SCHEDULE_NO: 'SCH-' + wo.WO_NO + '-' + s.SEQ_NO, WO_NO: wo.WO_NO, STEP_NO: 'S' + s.SEQ_NO, EQUIP_NO: (s.EQUIP_TYPE === '车削' ? 'SP-375-01' : s.EQUIP_TYPE === '磨外径' ? 'SP-375-02' : 'SP-JC-03'), PLAN_START: today() + ' 08:00:00', PLAN_END: today() + ' 17:00:00', SCHEDULE_STATUS: '已排', RUSH_FLAG: 0 });
    });
  }
  function genIssue(wo) {
    if (!wo || rows('EX_ISSUE_ORDER').some(function (r) { return r.WO_NO === wo.WO_NO; })) return;
    var lines = rows('MD_BOM_LINE').filter(function (r) { return r.BOM_NO === 'BOM-P3'; });
    var io = insert('EX_ISSUE_ORDER', { ISSUE_NO: '5401-' + ymd() + '-001', DOC_TYPE: '5401', DOC_DATE: today(), ORG_ID: 'ORG1', DEPT_CLASS: '三课', TEAM_CODE: 'T-375', ISSUE_BY: 'E001', STOREKEEPER: '库管', ISSUE_TYPE: '限额领料', WO_NO: wo.WO_NO, STEP_NO: 'S10', TOTAL_QTY: 100, STATUS: '已发料' });
    lines.forEach(function (ln, i) {
      insert('EX_ISSUE_LINE', { ISSUE_NO: io.ISSUE_NO, SEQ_NO: i + 1, ITEM_NO: ln.ERP_ITEM_CODE, ITEM_NAME: ln.ITEM_NAME, SPEC: ln.ITEM_CATEGORY, ISSUE_QTY: (+ln.NET_QTY || 1) * 100, UNIT: ln.UNIT, LOT_NO: 'LOT-2401' });
    });
  }
  function reportAll(wo) {
    if (!wo) return;
    var steps = rows('EX_WO_STEP').filter(function (r) { return r.WO_NO === wo.WO_NO; }).sort(function (a, b) { return stepIdx(a.STEP_NO) - stepIdx(b.STEP_NO); });
    steps.forEach(function (s) {
      if (rows('EX_REPORT').some(function (r) { return r.WO_NO === wo.WO_NO && r.STEP_NO === s.STEP_NO; })) return;
      var isQC = +s.IS_QC_POINT === 1;
      insert('EX_REPORT', { REPORT_NO: 'RPT-' + wo.WO_NO + '-' + s.STEP_NO, WO_NO: wo.WO_NO, STEP_NO: s.STEP_NO, STEP_NAME: s.STEP_NAME, REPORT_DATE: today(), SHIFT: '白班', OPERATOR: 'E001', LEADER: 'E002', EQUIP_NO: (s.STEP_NAME === '珩磨' ? 'SP-375-02' : s.STEP_NAME === '测泄漏' ? 'SP-JC-03' : 'SP-375-01'), REPORT_QTY: 100, GOOD_QTY: 100, NG_QTY: 0, SCRAP_QTY: 0, REWORK_QTY: 0, LOT_NO: 'LOT-WIP-' + s.STEP_NO, START_TIME: today() + ' 08:00:00', END_TIME: today() + ' 12:00:00', PROC_MODE: s.PROC_MODE, QC_STATUS: isQC ? '已判定' : '', QC_NO: isQC ? ('QC-IPQC-' + s.STEP_NO) : '', NEXT_STEP_NO: s.NEXT_STEP_NO || '', DATA_SOURCE: '手工录入', STATUS: '已审核' });
      update('EX_WO_STEP', s.ID, { REPORT_QTY: 100, GOOD_QTY: 100, STEP_STATUS: isQC ? '已下转' : '已报工' });
      if (isQC) insert('QC_INSPECTION', { QC_NO: 'QC-IPQC-' + s.STEP_NO, FORM_NO: 'Q/SF', QC_TYPE: 'IPQC', QC_STANDARD: 'P图统计分析制度', WO_NO: wo.WO_NO, STEP_NO: s.STEP_NO, ITEM_NO: 'P3PUMP001', ITEM_NAME: 'P3泵总成', QTY: 100, UNIT: '件', BATCH_QTY: 100, SAMPLE_QTY: 10, PASS_QTY: 100, FAIL_QTY: 0, QC_RESULT: '合格', GAUGE_NO: 'G-201834', INSPECTOR: 'E003', INSPECT_DATE: today(), STATUS: '已放行' });
    });
    var he = steps.find(function (r) { return r.STEP_NAME === '珩磨'; });
    if (he && !rows('QC_REWORK_ORDER').some(function (r) { return r.ORIGIN_WO_NO === wo.WO_NO; })) {
      update('EX_WO_STEP', he.ID, { NG_QTY: 3, GOOD_QTY: 97, STEP_STATUS: '待检验' });
      var bad = rows('EX_REPORT').find(function (r) { return r.WO_NO === wo.WO_NO && r.STEP_NO === he.STEP_NO; });
      if (bad) update('EX_REPORT', bad.ID, { NG_QTY: 3, GOOD_QTY: 97, QC_STATUS: '不合格', QC_NO: 'QC-IPQC-20' });
      insert('QC_INSPECTION', { QC_NO: 'QC-IPQC-20', QC_TYPE: 'IPQC', QC_STANDARD: 'P图', WO_NO: wo.WO_NO, STEP_NO: 'S20', ITEM_NO: 'P3PUMP001', ITEM_NAME: 'P3泵总成', QTY: 100, UNIT: '件', BATCH_QTY: 100, SAMPLE_QTY: 10, PASS_QTY: 97, FAIL_QTY: 3, QC_RESULT: '不合格', GAUGE_NO: 'G-201834', INSPECTOR: 'E003', INSPECT_DATE: today(), STATUS: '已隔离' });
      insert('QC_REWORK_ORDER', { REWORK_NO: 'RW-' + wo.WO_NO, ORIGIN_WO_NO: wo.WO_NO, REWORK_TYPE: '尺寸超差', OPEN_DATE: today(), PRODUCT_NO: 'P3PUMP001', PRODUCT_NAME: 'P3泵总成', SET_QTY: 3, PRODUCED_QTY: 0, SCRAP_QTY: 0, DESTROY_QTY: 0, REWORK_STEP: 'S20 珩磨', REWORK_REASON: '外径超差', NG_REASON_CODE: 'NG01', QC_NO: 'QC-IPQC-20', REWORK_PASS_QTY: 3, STATUS: '已完成' });
      update('EX_WO_STEP', he.ID, { REWORK_QTY: 3, STEP_STATUS: '已报工' });
    }
    var fin = steps.reduce(function (a, r) { return a + (+r.GOOD_QTY || 0); }, 0);
    update('EX_WORK_ORDER', wo.ID, { FINISH_QTY: fin, STATUS: '执行中' });
  }
  function genWip(wo) {
    if (!wo) return;
    var steps = rows('EX_WO_STEP').filter(function (r) { return r.WO_NO === wo.WO_NO; }).sort(function (a, b) { return stepIdx(a.STEP_NO) - stepIdx(b.STEP_NO); });
    var cur = steps.filter(function (r) { return (+r.REPORT_QTY || 0) > 0; }).pop() || steps[0];
    db.EX_WIP_BOARD = db.EX_WIP_BOARD.filter(function (r) { return r.WO_NO !== wo.WO_NO; });
    insert('EX_WIP_BOARD', { SNAPSHOT_TIME: now(), WO_NO: wo.WO_NO, PRODUCT_NO: wo.PRODUCT_NO, ITEM_NAME: wo.PRODUCT_NAME, CURRENT_STEP_NO: cur.STEP_NO, CURRENT_STEP_NAME: cur.STEP_NAME, GOOD_QTY: (+cur.GOOD_QTY || 0), WAIT_QC_QTY: 0, WIP_QTY: (+wo.PLAN_QTY || 0) - ((+cur.GOOD_QTY || 0)), PLAN_QTY: wo.PLAN_QTY, DONE_RATE: (((+cur.GOOD_QTY || 0) / (+wo.PLAN_QTY || 1)) * 100).toFixed(1), WIP_STATUS: '正常', STAGNANT_DAYS: 0, AREA_CODE: '磨削区' });
  }
  function genFinish(wo) {
    if (!wo || rows('WM_FINISH_IN').some(function (r) { return r.WO_NO === wo.WO_NO; })) return;
    var fbFin = finishInBlock(wo.WO_NO);
    if (fbFin) { toast(fbFin); return; }
    insert('EX_FINISH_IN', { IN_NO: 'FIN-' + wo.WO_NO, WO_NO: wo.WO_NO, PRODUCT_NO: wo.PRODUCT_NO, FINISH_QTY: wo.FINISH_QTY, GOOD_QTY: wo.FINISH_QTY, NG_QTY: 0, QC_NO: 'QC-FQC-001', WAREHOUSE_CODE: '成品仓', LOT_NO: 'LOT-FIN-001', STATUS: '已入库', IN_TIME: now() });
    insert('WM_FINISH_IN', { IN_NO: 'WIN-' + ymd() + '-001', DOC_NAME: '生产入库单', DOC_DATE: today(), WO_NO: wo.WO_NO, WAREHOUSE_CODE: '成品仓', LOT_NO: 'LOT-FIN-001', QC_NO: 'QC-FQC-001', ACCEPT_QTY: wo.FINISH_QTY, TOTAL_IN_QTY: wo.FINISH_QTY, GOOD_QTY: wo.FINISH_QTY, NG_QTY: 0, REWORK_IN_FLAG: 0, STATUS: '已入库' });
    insert('QC_INSPECTION', { QC_NO: 'QC-FQC-001', QC_TYPE: 'FQC', QC_STANDARD: '成品检验规范', WO_NO: wo.WO_NO, ITEM_NO: 'P3PUMP001', ITEM_NAME: 'P3泵总成', QTY: wo.FINISH_QTY, UNIT: '件', PASS_QTY: wo.FINISH_QTY, FAIL_QTY: 0, QC_RESULT: '合格', INSPECTOR: 'E003', INSPECT_DATE: today(), STATUS: '已放行' });
    update('EX_WORK_ORDER', wo.ID, { IN_QTY: wo.FINISH_QTY, STATUS: '已入库' });
    var stk = rows('WM_STOCK').find(function (r) { return r.ITEM_NO === 'P3PUMP001'; });
    if (stk) update('WM_STOCK', stk.ID, { ONHAND_QTY: (+stk.ONHAND_QTY || 0) + (+wo.FINISH_QTY || 0), AVAILABLE_QTY: (+stk.AVAILABLE_QTY || 0) + (+wo.FINISH_QTY || 0) });
  }

  /* ---------- WIP 看板 ---------- */
  function viewWip() {
    var wos = rows('EX_WORK_ORDER');
    if (wos.length === 0) return '<div class="card"><h2>WIP 在制看板</h2><div class="empty">暂无工单，请先到「核心流程」生成工序工单并模拟报工。</div></div>';
    var h = '<div class="card"><h2>WIP 在制看板</h2><p class="mini">每道工序的报工实绩汇聚为工单级进度；红/黄/绿表示停滞/在制/正常。</p>';
    wos.forEach(function (wo) {
      var steps = rows('EX_WO_STEP').filter(function (r) { return r.WO_NO === wo.WO_NO; }).sort(function (a, b) { return stepIdx(a.STEP_NO) - stepIdx(b.STEP_NO); });
      h += '<div class="wip-card"><div style="font-weight:700">' + esc(wo.WO_NO) + ' · ' + esc(wo.PRODUCT_NAME) + ' <span class="mini">计划 ' + esc(wo.PLAN_QTY) + ' / 状态 ' + esc(wo.STATUS) + '</span></div>';
      steps.forEach(function (s) {
        var p = ((+s.REPORT_QTY || 0) / (+wo.PLAN_QTY || 1) * 100); if (p > 100) p = 100;
        h += '<div style="margin-top:8px"><div class="mini">' + esc(s.STEP_NO) + ' ' + esc(s.STEP_NAME) + ' — 报工 ' + (+s.REPORT_QTY || 0) + ' / 良品 ' + (+s.GOOD_QTY || 0) + ' / 不良 ' + (+s.NG_QTY || 0) + ' / 返工 ' + (+s.REWORK_QTY || 0) + ' <span class="tag">' + esc(s.STEP_STATUS) + '</span></div>' +
          '<div class="bar"><i style="width:' + p.toFixed(0) + '%"></i></div></div>';
      });
      h += '</div>';
    });
    var snap = rows('EX_WIP_BOARD');
    if (snap.length) {
      h += '<h3>看板快照（EX_WIP_BOARD）</h3><div class="tbl-wrap"><table class="grid"><thead><tr><th>工单</th><th>当前工序</th><th>良品</th><th>在制</th><th>完成率</th><th>状态</th></tr></thead><tbody>';
      snap.forEach(function (r) { h += '<tr><td class="pk">' + esc(r.WO_NO) + '</td><td>' + esc(r.CURRENT_STEP_NAME) + '</td><td class="cellnum">' + (+r.GOOD_QTY || 0) + '</td><td class="cellnum">' + (+r.WIP_QTY || 0) + '</td><td class="cellnum">' + esc(r.DONE_RATE) + '%</td><td>' + statusTag(r.WIP_STATUS) + '</td></tr>'; });
      h += '</tbody></table></div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------- OEE ---------- */
  function viewOee() {
    var oee = rows('EQ_OEE');
    if (oee.length === 0) return '<div class="card"><h2>设备综合效率(OEE)</h2><div class="empty">暂无 OEE 数据（由工序报工与停机记录实时汇总，请先在生产报表查看）。</div></div>';
    var h = '<div class="card"><h2>设备综合效率(OEE)（可用率 × 性能率 × 良率）</h2>';
    h += '<div class="tbl-wrap"><table class="grid"><thead><tr><th>设备</th><th>日期</th><th>可用率</th><th>性能率</th><th>良率</th><th>OEE</th><th>及格线</th></tr></thead><tbody>';
    oee.forEach(function (r) {
      var ov = (+r.OEE_VALUE || 0) * 100; var cls = ov >= (+r.OEE_TARGET || 0) * 100 ? 'ok' : 'warn';
      h += '<tr><td class="pk">' + esc(r.EQUIP_NO) + '</td><td>' + esc(r.STAT_DATE) + '</td><td class="cellnum">' + ((+r.AVAILABILITY || 0) * 100).toFixed(1) + '%</td><td class="cellnum">' + ((+r.PERFORMANCE || 0) * 100).toFixed(1) + '%</td><td class="cellnum">' + ((+r.QUALITY_RATE || 0) * 100).toFixed(1) + '%</td><td class="cellnum"><b>' + ov.toFixed(1) + '%</b></td><td class="cellnum">' + ((+r.OEE_TARGET || 0) * 100).toFixed(0) + '%</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3>设备 OEE 对比</h3>';
    oee.forEach(function (r) { var ov = (+r.OEE_VALUE || 0) * 100; h += '<div class="oee-row"><div class="nm">' + esc(r.EQUIP_NO) + '</div><div class="bar"><i style="width:' + ov.toFixed(0) + '%"></i></div><div class="mini">' + ov.toFixed(1) + '%</div></div>'; });
    h += '</div>';
    return h;
  }

  /* ---------- 关系图（ER 概要） ---------- */
  function viewEr() {
    var svg = '<svg class="er-svg" width="100%" viewBox="0 0 920 520" xmlns="http://www.w3.org/2000/svg">';
    var boxes = [['SD_SALES_ORDER', 120, 30], ['EX_WORK_ORDER', 120, 150], ['EX_WO_STEP', 120, 270], ['EX_REPORT', 360, 270], ['QC_INSPECTION', 600, 270], ['QC_REWORK_ORDER', 600, 390], ['PP_SCHEDULE', 360, 150], ['PD_ARRIVAL', 600, 30], ['WM_INBOUND', 600, 150], ['WM_STOCK_LOT', 820, 150], ['WM_FINISH_IN', 360, 410], ['RT_ROUTE_STEP', 120, 390], ['MD_BOM_LINE', 360, 30]];
    boxes.forEach(function (b) { var w = b[0].length * 7 + 24; svg += '<g transform="translate(' + b[1] + ',' + b[2] + ')"><rect class="box" width="' + w + '" height="34" rx="6"/><text class="lbl" x="12" y="21">' + b[0] + '</text></g>'; });
    function link(a, b) { svg += '<line x1="' + (a[1] + a[0].length * 7 + 24) + '" y1="' + (a[2] + 34) + '" x2="' + b[1] + '" y2="' + b[2] + '" stroke="#9aa6b6" stroke-width="1"/>'; }
    link(['SD_SALES_ORDER', 120, 30], ['EX_WORK_ORDER', 120, 150]);
    link(['EX_WORK_ORDER', 120, 150], ['EX_WO_STEP', 120, 270]);
    link(['EX_WO_STEP', 120, 270], ['EX_REPORT', 360, 270]);
    link(['EX_REPORT', 360, 270], ['QC_INSPECTION', 600, 270]);
    link(['QC_INSPECTION', 600, 270], ['QC_REWORK_ORDER', 600, 390]);
    link(['MD_BOM_LINE', 360, 30], ['PP_SCHEDULE', 360, 150]);
    link(['PP_SCHEDULE', 360, 150], ['EX_WORK_ORDER', 120, 150]);
    link(['PD_ARRIVAL', 600, 30], ['WM_INBOUND', 600, 150]);
    link(['WM_INBOUND', 600, 150], ['WM_STOCK_LOT', 820, 150]);
    link(['EX_WORK_ORDER', 120, 150], ['WM_FINISH_IN', 360, 410]);
    link(['RT_ROUTE_STEP', 120, 390], ['EX_WO_STEP', 120, 270]);
    svg += '</svg>';
    return '<div class="card"><h2>关键表关系（ER 概要）</h2><p class="mini">含主子表关联：SD_SALES_ORDER → SD_SALES_ORDER_LINE、EX_WORK_ORDER → EX_WO_STEP 等。完整共 ' + Object.keys(S.TABLES).length + ' 张表关系见导出的 <code>mes_schema.sql</code> 与《MES模块和字段设计文档》第 7 章。</p>' + svg + '</div>';
  }

  function groupIntroCard(gname) {
    var gi = S.GROUP_INTRO && S.GROUP_INTRO[gname];
    if (!gi) return '';
    return '<div class="card intro-card"><h3>模块介绍 · ' + esc(gname) + '</h3>' +
      '<p><b>模块作用：</b>' + esc(gi.role) + '</p>' +
      '<p><b>存放数据：</b>' + esc(gi.data) + '</p></div>';
  }
  /* ---------- 使用说明（内置新手引导，按当前选中表动态展示流转） ---------- */
  function viewGuide() {
    // 若左侧已选中某张表：直接展示该表的模块介绍 + 来源 / 去向 / 操作
    if (st.table && S.TABLES[st.table]) {
      var def = S.TABLES[st.table];
      var g = groupOf(st.table);
      var ups = flowUpstream(st.table);
      var srcTxt = ups.length ? ups.map(function (u) { return '「' + S.TABLES[u.from].label + '」(' + u.label + ')'; }).join('、') : '无前置单据（根级，直接新建）';
      var h = '<div class="card"><h2>使用说明 · 当前表「' + esc(def.label) + '」</h2>' +
        '<p class="mini">所属模块：' + esc(g ? g.name : def.module) + '。下面先介绍该表所属模块的作用与存放数据，再展示该表的<b>来源（从哪来）</b>、<b>去向（往后怎么流转）</b>与<b>如何操作</b>。</p></div>';
      h += groupIntroCard(g ? g.name : '');
      h += '<div class="card"><h3>当前表业务流</h3>' +
        '<p class="mini">' + esc(def.label) + ' 可从 ' + esc(srcTxt) + ' 进入，或直接「新建」；往后可流转到 ' +
        (S.FLOW[st.table] && S.FLOW[st.table].length ? S.FLOW[st.table].map(function (f) { return '「' + S.TABLES[f.to].label + '」'; }).join('、') : '末端单据（无下游）') +
        '。也可到「<b>核心流程</b>」查看全局业务流图。</p>' +
        tableFlowPanel(st.table, null) + '</div>';
      return h;
    }
    // 通用说明（平台用法）
    return '' +
    '<div class="card">' +
      '<h2>使用说明 · MES 制造执行管理系统</h2>' +
      '<p class="mini">本页长期内置在平台上，介绍系统怎么用、业务怎么跑。视图入口分两处：<b>顶栏</b>（数据浏览 / 数据模型 / 使用说明）与<b>左侧树</b>的「<b>生产看板</b>」（现场驾驶舱 / WIP 看板 / OEE）；其余视图（核心流程 / 数据洞察 / 总览 / 关系图）可点右上角「⚙ 显示设置」勾到顶栏显示。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>一、系统定位</h3>' +
      '<p>这是一套面向<b>汽配车间（副车架 / 车身结构件）</b>的 <b>MES（制造执行管理系统）原型</b>：以设计文档为唯一数据源（Schema 驱动），覆盖 <b>工厂建模 / 工艺管理 / 订单管理 / 计划排产 / 生产管理 / 库存管理 / 设备管理 / 生产报表 / 生产看板</b> 9 大功能域、共 <b>' + Object.keys(S.TABLES).length + ' 张数据表</b>。所有数据保存在浏览器本地（localStorage），无需数据库即可演示与评审。</p>' +
    '</div>' +

    '<div class="card"><h3>二、各模块介绍（作用 / 存放数据）</h3>' +
      '<p class="mini">左侧选中任一表后再进「使用说明」，会显示该表所属模块的介绍与该表的上下游流转。全部模块如下：</p>' +
      S.GROUPS.map(function (g) {
        var gi = (S.GROUP_INTRO || {})[g.name] || { role: '', data: '' };
        return '<div class="frow"><div><b>' + esc(g.name) + '</b> <span class="mini">(' + (g.tables.filter(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; }).length + groupViews(g).length) + ' 项)</span>' +
          '<div class="mini">作用：' + esc(gi.role) + '</div><div class="mini">数据：' + esc(gi.data) + '</div></div></div>';
      }).join('') +
    '</div>' +

    '<div class="card">' +
      '<h3>三、基本操作（左侧树 + 数据浏览）</h3>' +
      '<ul class="guide-ul">' +
        '<li><b>左侧功能域树</b>：顶层是 9 个功能域（「工厂建模」默认展开），点开看里面的表单；带「主」标记、或右侧带 ▸ 的表表示其下挂有<b>子表 / 子项</b>（如 BOM 头 → BOM 行、物料资料 → 物料分类树、班组资料 → 班组成员、库存主账 → 批次库存、工艺版本 → 工艺版本记录、设备资料 → 量检具、日常点检 → 点检项模板、保养计划 → 保养记录），点 ▸ 可展开。「<b>生产看板</b>」下挂「<b>现场驾驶舱 / WIP 看板 / OEE</b>」三个视图入口。</li>' +
        '<li><b>数据浏览</b>：点任意表单进入，可<b>搜索 / 新增 / 编辑 / 删除</b>记录；工具栏另有<b>导入 / 导出 / 打印 / 审核 / 显示字段</b>。带「主」标记的主表点任意一行会弹出<b>单据详情</b>。</li>' +
        '<li><b>导入</b>：点「导入」可下载 CSV 模板——模板表头为<b>中文名 + 字段编号</b>，必填项带 <code>*</code>，引用字段标注「须为某主数据中已存在的编号」，并在 # 说明行给出绑定规则；子表明细的「单据详情」里也有「导入明细」按钮，父单号会自动绑定到当前单据。</li>' +
        '<li><b>生产报表（只读）</b>：报表数据由业务数据<b>实时汇总</b>（上游一改，报表自动变化），因此只保留「查询 / 导出」。</li>' +
        '<li><b>条码 / 二维码</b>：物料资料与工序工单带「条码 + 二维码」字段，单据详情可扫码、打印标签，并一键跳到<b>追溯报表-物料 / 追溯报表-报工</b>。</li>' +
        '<li><b>审核</b>：业务单据表预留「审核状态 / 审核人 / 审核时间」字段（为后续工作流准备），点「审核」选择记录并给出结论即可写入；<b>报表</b>为实时派生视图，不含审核类字段。</li>' +
        '<li><b>启用绑定</b>：主数据表若勾选「是否启用」，会自动带出「启用时间」；停用时自动填「失效时间」。</li>' +
        '<li><b>字段可配置</b>：在「数据模型」或「显示字段」里可对字段<b>新增 / 编辑 / 删除 / 显示隐藏 / 上下移动调整顺序</b>（备注统一在最后），均本地持久化。</li>' +
        '<li><b>数据洞察</b>：把「数据洞察」勾到顶栏后支持对话式查询，直接问如「销售订单有多少条」「按物料分类统计库存」即可获得数据分析。</li>' +
      '</ul>' +
    '</div>' +

    '<div class="card">' +
      '<h3>四、核心业务流程（怎么跑）</h3>' +
      '<p class="mini">「核心流程」页给出<b>全局业务流图</b>；需要真实写入数据时可点卡片右上角「<b>展开一键演练</b>」按步骤跑通生产主链路。演示顺序：</p>' +
      '<div class="flow-line-list">' +
        fline('1', '订单评审', '销售订单评审通过，关联生产订单（SD_SALES_ORDER）') +
        fline('2', '工序级排产 / 工单下达', '由销售订单 + BOM + 工艺路线生成成品工单并展开各工序（EX_WORK_ORDER / EX_WO_STEP）') +
        fline('3', '领料 / 上料', '按工单 BOM 生成限额领料单，从原料仓发料（领料单已归入「库存管理」）') +
        fline('4', '逐工序报工（含工序检验 / 不合格闭环）', '按工艺路线逐道工序报工，检验点判定合格/不合格→不合格生成返工单（EX_REPORT / QC_INSPECTION / QC_REWORK_ORDER）') +
        fline('5', 'WIP 工艺路线追踪', '汇总各工序报工形成在制品进度看板（EX_WIP_BOARD）') +
        fline('6', '完工入库', '末道工序完成后完工入库，成品进成品仓（EX_FINISH_IN / WM_FINISH_IN）') +
      '</div>' +
      '<p class="mini">另有 <b>采购链路</b>（请购比价 → 采购订单 → 到货(+IQC) → 采购入库，采购订单已带「关联销售订单」）与 <b>单据流转</b>（单据详情里按业务流一键生成下游单，单源可多向）。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>五、视图显示设置</h3>' +
      '<p>顶栏默认只显示 <b>数据浏览 / 数据模型 / 使用说明</b> 三个；「生产看板」组（现场驾驶舱 / WIP 看板 / OEE）挂在左侧树。点右上角「⚙ 显示设置」可把任一视图（含核心流程 / 数据洞察 / 总览 / 关系图）勾到顶栏一并显示，设置即时生效并自动保存。每次打开 / 刷新默认落在「<b>生产看板 · 现场驾驶舱</b>」。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>六、范围边界</h3>' +
      '<p class="mini">报表统计与追溯数据归入「<b>生产报表</b>」（供应商绩效 / 生产线日报 / 设备综合效率(OEE) / 设备状态监测 / 追溯报表-物料 / 追溯报表-报工），实时状态展示归入「<b>生产看板 → 现场驾驶舱</b>」。已按需求取消「<b>进货单</b>」与「<b>MRP 展开结果</b>」两个环节：采购链路由到货单直接生成采购入库，需求由销售订单 / 生产计划直接驱动请购。单别沿用 ERP 编号（5101 成品工单 / 5401 领料单 / 2302 销货单 / 311 报价单 / 301 到货单 / 1805 半成品报废），班次统一为「白班 / 中班 / 晚班」。</p>' +
    '</div>';
  }
  function fline(n, t, d) {
    return '<div class="frow"><span class="fnum">' + n + '</span><div><b>' + esc(t) + '</b><div class="mini">' + esc(d) + '</div></div></div>';
  }

  /* ============================================================
   * 数据洞察（对话式数据查询与分析）
   * 通过自然语言查询本地 MES 数据（localStorage），返回分析结论与明细表。
   * 支持 @图片 附参考图（图片仅作对话展示，分析依据为文本问句 + 系统数据）。
   * ============================================================ */
  var INSIGHT_ALIAS = {
    '销售订单': ['SD_SALES_ORDER'], '报价': ['SD_QUOTATION'], '销货': ['SD_DELIVERY'],
    '采购订单': ['PD_PURCHASE_ORDER'], '采购': ['PD_PURCHASE_ORDER'], '采购金额': ['PD_PURCHASE_ORDER'], '到货': ['PD_ARRIVAL'], '请购': ['PD_PRICE_COMPARE'], '比价': ['PD_PRICE_COMPARE'],
    '工单': ['EX_WORK_ORDER'], '生产工单': ['EX_WORK_ORDER'], '成品工单': ['EX_WORK_ORDER'],
    '报工': ['EX_REPORT'], '领料': ['EX_ISSUE_ORDER'], '完工入库': ['WM_FINISH_IN', 'EX_FINISH_IN'],
    '库存': ['WM_STOCK'], '入库': ['WM_INBOUND', 'WM_FINISH_IN'], '出库': ['WM_OUTBOUND'], '批次库存': ['WM_STOCK_LOT'],
    '产品': ['MD_PRODUCT'], '物料': ['MD_MATERIAL'], 'BOM': ['MD_BOM_HEADER'], '客户': ['MD_CUSTOMER'],
    '供应商': ['MD_SUPPLIER'], '设备': ['MD_EQUIPMENT'], '人员': ['HR_EMPLOYEE'], '员工': ['HR_EMPLOYEE'],
    '班组': ['HR_TEAM'], '岗位': ['MD_POSITION'], '工序': ['MD_STEP_DICT'], '工艺': ['RT_ROUTE'],
    'OEE': ['EQ_OEE'], '检验': ['QC_INSPECTION'], '返工': ['QC_REWORK_ORDER'], '报废': ['QC_SCRAP_ORDER'],
    'WIP': ['EX_WIP_BOARD'], '在制': ['EX_WIP_BOARD'], '产能': ['PP_CAPACITY_LOAD'], '排产': ['PP_SCHEDULE'],
    '主生产计划': ['PP_MASTER_PLAN'], '生产计划': ['PP_MASTER_PLAN'], '生产日报': ['EX_DAILY_OUTPUT'],
    '供应商绩效': ['MD_SUPPLIER_PERF'], '设备状态': ['EQ_STATUS_MONITOR'],
    '订单预测': ['PP_ORDER_BOARD'], '点检': ['EQ_INSPECTION'], '保养': ['EQ_MAINTENANCE_PLAN'], '巡检': ['EQ_PATROL'],
    '故障': ['EQ_FAULT_REPAIR'], '量检具': ['MD_GAUGE'], 'SOP': ['RT_SOP'], '工艺版本': ['RT_ROUTE_VERSION'],
    '追溯': ['RPT_TRACE_MATERIAL', 'RPT_TRACE_WORK'], '条码': ['MD_MATERIAL'], '二维码': ['MD_MATERIAL']
  };
  function insightTables(q) {
    var ql = q.toLowerCase(); var sc = {};
    Object.keys(INSIGHT_ALIAS).forEach(function (kw) {
      if (ql.indexOf(kw.toLowerCase()) >= 0) INSIGHT_ALIAS[kw].forEach(function (t) { sc[t] = (sc[t] || 0) + (kw.length >= 3 ? 3 : 2); });
    });
    Object.keys(S.TABLES).forEach(function (t) {
      var lab = (S.TABLES[t].label || '').toLowerCase();
      if (lab && ql.indexOf(lab) >= 0) sc[t] = (sc[t] || 0) + 6;
      if (ql.indexOf(t.toLowerCase()) >= 0) sc[t] = (sc[t] || 0) + 4;
    });
    return Object.keys(sc).map(function (t) { return { t: t, s: sc[t] }; }).filter(function (x) { return S.TABLES[x.t]; }).sort(function (a, b) { return b.s - a.s; });
  }
  function insightBizCols(t) { return S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); }); }
  function insightNumCols(t) { return insightBizCols(t).filter(function (c) { return c.type === 'i' || c.type === 'd'; }); }
  function insightFindCol(t, terms) {
    var cols = insightBizCols(t); var best = null, bestScore = 0;
    var NOUN = { '物料': 'MATERIAL', '产品': 'PRODUCT', '客户': 'CUSTOMER', '供应商': 'SUPPLIER', '工序': 'STEP', '设备': 'EQUIP', '班组': 'TEAM', '岗位': 'POSITION', '人员': 'EMPLOYEE', '员工': 'EMPLOYEE', '分类': 'CLASS|CATEGORY', '类别': 'CATEGORY', '类型': 'TYPE', '状态': 'STATUS', '车间': 'WORKSHOP', '产线': 'LINE', '仓库': 'WAREHOUSE', '库': 'WAREHOUSE', '区域': 'AREA', '部门': 'DEPT', '课别': 'DEPT', '班次': 'SHIFT', '品名': 'NAME|ITEM_NAME', '品号': 'ITEM_NO', '名称': 'NAME' };
    cols.forEach(function (c) {
      var lab = (c.label || '').toLowerCase(), code = c.code.toLowerCase();
      terms.forEach(function (term) {
        var tl = String(term).toLowerCase(); if (!tl) return;
        if (lab.indexOf(tl) >= 0) { var s = 100 + tl.length; if (s > bestScore) { bestScore = s; best = c; } }
        Object.keys(NOUN).forEach(function (n) {
          if (tl.indexOf(n) >= 0) {
            NOUN[n].toLowerCase().split('|').forEach(function (kw) {
              if (kw && code.indexOf(kw) >= 0) { var s2 = 50 + n.length; if (s2 > bestScore) { bestScore = s2; best = c; } }
            });
          }
        });
      });
    });
    return best;
  }
  function insightFindNumCol(t, terms) {
    var cols = insightNumCols(t);
    if (!cols.length) return null;
    var map = { '数量': /QTY|QUANTITY/, '库存': /ONHAND|AVAILABLE|STOCK_QTY/, '良品': /GOOD/, '不良': /NG|FAIL/, '报废': /SCRAP/, '金额': /AMOUNT|PRICE|TOTAL/, 'OEE': /OEE/, '产量': /OUTPUT|PRODUCE/, '产出': /OUTPUT/, '工时': /HOUR|MANHOUR|WORKTIME/, '效率': /EFFIC|RATE/ };
    if (terms && terms.length) {
      for (var i = 0; i < terms.length; i++) { var re = map[terms[i]]; if (re) { var hit = cols.find(function (c) { return re.test(c.code) || re.test(c.label.toLowerCase()); }); if (hit) return hit; } }
      return null; // 提到了指标但本表无对应数值列，交由上层按计数处理
    }
    return cols[0] || null;
  }
  function insightIntent(q) {
    var ql = q.toLowerCase();
    var I = { type: 'list', group: null, metricTerms: null, topN: 5, asc: false, status: null, date: null };
    if (/未审核|待审核|没审核|尚未审核/.test(q)) I.status = '待审核';
    else if (/已审核|审核通过|已通过审核/.test(q)) I.status = '已审核';
    else if (/不合格/.test(q)) I.status = '不合格';
    else if (/合格/.test(q)) I.status = '合格';
    else if (/未完成|未完工|在制|执行中|进行中/.test(q)) I.status = '执行中';
    if (/今天|今日/.test(q)) I.date = 'today';
    else if (/本月|当月|这个月/.test(q)) I.date = 'month';
    else if (/本周|这周/.test(q)) I.date = 'week';
    else if (/最近|近期|近一个月|近30天/.test(q)) I.date = 'recent';
    var tm = q.match(/(?:top|前|最高|最大|最多|最少|最低|最小)\s*(\d{1,2})?/i);
    if (tm) { I.type = 'top'; I.topN = tm[1] ? parseInt(tm[1], 10) : 5; if (/(少|低|最小|最少)/.test(q)) I.asc = true; }
    var g = q.match(/按\s*([^，。,.\s]{1,10})(?:统计|汇总|分类|分组|聚合|计算|看|查|分布|占比|分析|排列)/);
    if (g) { I.type = 'group'; I.group = g[1]; }
    else if (/各(?:个|种|类)?\s*状态|状态分布|按状态|不同状态/.test(q)) { I.type = 'group'; I.group = '状态'; }
    else if (/分布|占比|构成|构成比/.test(q) && I.type === 'list') { I.type = 'group'; I.group = '状态'; }
    if (/均值|平均|总共|合计|总和|总计|总量|累计/.test(q)) { if (I.type !== 'group' && I.type !== 'top') I.type = 'aggregate'; }
    if (/多少条|几条|共有|有几|有多少|记录数|总条数|数量是多少|总共有/.test(q) && I.type === 'list') I.type = 'count';
    var mterms = q.match(/数量|库存|良品|不良|报废|金额|OEE|产量|产出|工时|效率/g);
    if (mterms) I.metricTerms = mterms;
    return I;
  }
  function insightDateFilter(t, arr, kind) {
    if (!kind) return arr;
    var cols = insightBizCols(t);
    var dateCol = cols.find(function (c) { return c.type === 'da' || c.type === 'dt' || /DATE|TIME|DAY|月|日|时间|日期/.test(c.code + c.label); });
    if (!dateCol) return arr;
    var now = new Date();
    return arr.filter(function (r) {
      var v = r[dateCol.code]; if (!v) return false;
      var d = new Date(String(v).replace(/-/g, '/').replace('T', ' ')); if (isNaN(d.getTime())) return false;
      if (kind === 'today') return d.toDateString() === now.toDateString();
      if (kind === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (kind === 'week') { var onejan = new Date(now.getFullYear(), 0, 1); var wk = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7); var wkd = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7); return wk === wkd; }
      if (kind === 'recent') return (now - d) <= 30 * 86400000;
      return true;
    });
  }
  function insightStatusFilter(t, arr, status) {
    if (!status) return arr;
    var cols = insightBizCols(t);
    var col = cols.find(function (c) { return c.code === 'AUDIT_STATUS'; }) || cols.find(function (c) { return c.code === 'STATUS' || c.code === 'QC_RESULT' || c.code === 'WIP_STATUS' || /STATUS|RESULT/.test(c.code); });
    if (!col) return arr;
    return arr.filter(function (r) { return String(r[col.code] || '').indexOf(status) >= 0; });
  }
  function insightGroupCol(t, term) {
    if (!term) return null;
    if (term === '状态') { var sc2 = insightBizCols(t).find(function (c) { return c.code === 'STATUS' || c.code === 'AUDIT_STATUS' || c.code === 'QC_RESULT'; }); return sc2 || null; }
    var term2 = term.replace(/[的]+$/, '');
    return insightFindCol(t, [term2, term]);
  }
  function insightListTable(t, arr, n) {
    var def = S.TABLES[t];
    var cols = displayCols(t);
    if (cols.length === 0) cols = insightBizCols(t).slice(0, 6);
    var head = cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('');
    var body = arr.slice(0, n).map(function (r) { return '<tr>' + cols.map(function (c) { return '<td class="' + (c.code === def.pk ? 'pk' : '') + '">' + cellValue(r, c) + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<table class="grid sm insight-tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  function insightOverview() {
    var totalTables = Object.keys(S.TABLES).length, totalRows = 0;
    Object.keys(S.TABLES).forEach(function (t) { totalRows += rows(t).length; });
    var lines = S.GROUPS.filter(function (g) { /* 纯视图分组（如 生产看板）不含业务表，概览里跳过 */
      return g.tables.some(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; });
    }).map(function (g) {
      var items = g.tables.filter(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; }).map(function (t) { return S.TABLES[t].label + '（' + rows(t).length + '）'; });
      return '<tr><td><b>' + esc(g.name) + '</b></td><td>' + items.join('、') + '</td></tr>';
    }).join('');
    var tableHtml = '<table class="grid sm insight-tbl"><thead><tr><th>模块</th><th>各表记录数</th></tr></thead><tbody>' + lines + '</tbody></table>';
    var text = '系统当前共 <b>' + totalTables + '</b> 张数据表、<b>' + totalRows + '</b> 条业务记录，分布如下。您也可以直接问我，例如「销售订单有多少条」「按物料分类统计库存数量」「各状态工单的分布」。';
    return { text: text, table: tableHtml };
  }
  function insightAnalysis(q) {
    var tables = insightTables(q);
    var t = tables.length ? tables[0].t : null;
    if (!t || /系统(概况|总览)|有哪些表|多少张表|系统里有什么|有什么数据|都有什么数据|数据全貌|整体概览|整体概况/.test(q)) {
      if (!t) return insightOverview();
      if (/系统(概况|总览)|有哪些表|多少张表|系统里有什么|有什么数据|都有什么数据|数据全貌|整体概览|整体概况/.test(q)) return insightOverview();
    }
    var def = S.TABLES[t];
    var I = insightIntent(q);
    var all = rows(t);
    var base = insightStatusFilter(t, all, I.status);
    base = insightDateFilter(t, base, I.date);
    /* 时间范围筛选后无结果时，自动回退到不限制时间（避免演示数据年份与当前不符时一律为空） */
    if (base.length === 0 && I.date) base = insightStatusFilter(t, all, I.status);
    var title = '「' + def.label + '」';

    if (I.type === 'count') {
      var txt = '经检索，' + title + '当前共有 <b>' + all.length + '</b> 条记录' +
        (I.status ? ('，其中状态含「' + I.status + '」的有 <b>' + base.length + '</b> 条') : '') +
        (I.date ? ('（按时间范围筛选后 <b>' + base.length + '</b> 条）') : '') + '。';
      if (all.length === 0) txt += '（当前无相关记录）';
      return { text: txt, table: null };
    }

    if (I.type === 'group') {
      var gcMatched = insightGroupCol(t, I.group);
      var gc = gcMatched;
      if (!gc) {
        gc = insightBizCols(t).find(function (c) { return (/CLASS|CATEGORY|TYPE/.test(c.code) || /(分类|类别|类型)/.test(c.label)); })
          || insightBizCols(t).find(function (c) { return c.type === 's' && c.code !== def.pk && !/REMARK|STATUS|AUDIT/.test(c.code); })
          || insightBizCols(t).find(function (c) { return c.code === 'STATUS' || c.code === 'AUDIT_STATUS'; });
      }
      var metric = (I.metricTerms && I.metricTerms.length) ? insightFindNumCol(t, I.metricTerms) : null;
      var groups = {};
      base.forEach(function (r) {
        var k = r[gc.code]; if (k === undefined || k === null || k === '') k = '（空）'; k = String(k);
        if (!groups[k]) groups[k] = { n: 0, sum: 0 };
        groups[k].n += 1;
        if (metric) groups[k].sum += (+r[metric.code] || 0);
      });
      var arr = Object.keys(groups).map(function (k) { return { k: k, n: groups[k].n, sum: groups[k].sum }; }).sort(function (a, b) { return b.n - a.n; });
      var total = base.length;
      var sumTotal = arr.reduce(function (a, x) { return a + x.sum; }, 0);
      var head = '<th>' + esc(gc.label) + '</th><th>记录数</th><th>占比</th>' + (metric ? '<th>' + esc(metric.label) + '合计</th>' : '');
      var body = arr.slice(0, 15).map(function (x) {
        var pct = total ? (x.n / total * 100).toFixed(1) : '0.0';
        return '<tr><td>' + esc(x.k) + '</td><td class="cellnum">' + x.n + '</td><td class="cellnum">' + pct + '%</td>' + (metric ? '<td class="cellnum">' + x.sum.toFixed(2) + '</td>' : '') + '</tr>';
      }).join('');
      var tableHtml = '<table class="grid sm insight-tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
      var desc = '按「' + gc.label + '」对' + title + '分组统计，共 <b>' + total + '</b> 条、<b>' + arr.length + '</b> 个分组' +
        (metric ? ('，「' + metric.label + '」合计 <b>' + sumTotal.toFixed(2) + '</b>') : '') + '，结果（Top 15）如下：';
      if (!gcMatched && I.group) desc = '「' + def.label + '」中没有名为「' + I.group + '」的字段，已自动按「' + gc.label + '」汇总。' + desc;
      if (total === 0) desc += '（当前无相关记录）';
      return { text: desc, table: tableHtml };
    }

    if (I.type === 'top') {
      var sortCol = insightFindNumCol(t, I.metricTerms) || insightNumCols(t)[0] || insightBizCols(t).find(function (c) { return c.code === def.pk; });
      if (!sortCol) return { text: title + '暂无可排序的数值字段，已为您列出前 ' + I.topN + ' 条：', table: insightListTable(t, base, I.topN) };
      var sorted = base.slice().sort(function (a, b) { return (+b[sortCol.code] || 0) - (+a[sortCol.code] || 0); });
      if (I.asc) sorted.reverse();
      var top = sorted.slice(0, I.topN);
      var labelCols = insightBizCols(t).filter(function (c) { return c.code !== sortCol.code && c.code !== def.pk; }).slice(0, 3);
      var head2 = (def.pk && def.pk !== 'ID' ? '<th>' + esc(def.pk) + '</th>' : '') + labelCols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '<th>' + esc(sortCol.label) + '</th>';
      var body2 = top.map(function (r) {
        var tr = (def.pk && def.pk !== 'ID' ? '<td class="pk">' + esc(r[def.pk]) + '</td>' : '');
        labelCols.forEach(function (c) { tr += '<td>' + esc(r[c.code] == null ? '' : r[c.code]) + '</td>'; });
        tr += '<td class="cellnum">' + esc(r[sortCol.code] == null ? '' : r[sortCol.code]) + '</td>';
        return '<tr>' + tr + '</tr>';
      }).join('');
      var tableHtml2 = '<table class="grid sm insight-tbl"><thead><tr>' + head2 + '</tr></thead><tbody>' + body2 + '</tbody></table>';
      var desc2 = '按「' + sortCol.label + '」对' + title + (I.asc ? '从小到大' : '从大到小') + '排序，前 <b>' + I.topN + '</b> 名如下：';
      return { text: desc2, table: tableHtml2 };
    }

    if (I.type === 'aggregate') {
      var m = insightFindNumCol(t, I.metricTerms);
      if (!m) return { text: title + '暂无可统计的数值字段，已为您列出前 10 条：', table: insightListTable(t, base, 10) };
      var sum = base.reduce(function (a, r) { return a + (+r[m.code] || 0); }, 0);
      var avg = base.length ? (sum / base.length) : 0;
      var verb = /均值|平均/.test(q) ? '平均' : '合计';
      var val = /均值|平均/.test(q) ? avg.toFixed(2) : sum.toFixed(2);
      var txtA = '对' + title + '的「' + m.label + '」进行' + verb + '统计：共 <b>' + base.length + '</b> 条，' + verb + '值为 <b>' + val + '</b>（合计 ' + sum.toFixed(2) + '，均值 ' + avg.toFixed(2) + '）。';
      return { text: txtA, table: null };
    }

    var descL = title + '当前共 ' + all.length + ' 条记录' + (I.status ? ('，状态含「' + I.status + '」的 ' + base.length + ' 条') : '') + '，为您展示前 ' + Math.min(10, base.length) + ' 条：';
    if (I.status && base.length === 0 && all.length > 0) descL += '（没有符合「' + I.status + '」的记录）';
    return { text: descL, table: insightListTable(t, base, 10) };
  }

  /* ---------- 数据洞察 · 视图与交互 ---------- */
  var insPendingImg = null;
  function chip(q) { return '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }
  function insightLoad() { try { return JSON.parse(localStorage.getItem(INSIGHT_KEY)) || []; } catch (e) { return []; } }
  function insightSave(arr) { try { localStorage.setItem(INSIGHT_KEY, JSON.stringify(arr)); } catch (e) {} }
  function insMsgHtml(m) {
    if (m.role === 'user') {
      var img = m.img ? '<div class="im-img"><img src="' + m.img + '" alt="参考图"/></div>' : '';
      return '<div class="im im-user"><div class="im-bubble">' + img + esc(m.text) + '</div></div>';
    }
    var tbl = m.table ? '<div class="im-table">' + m.table + '</div>' : '';
    return '<div class="im im-bot"><div class="im-avatar">AI</div><div class="im-bubble">' + m.text + tbl + '</div></div>';
  }
  function renderInsightHistory() {
    var chat = document.getElementById('insChat'); if (!chat) return;
    var hist = insightLoad();
    if (!hist.length) { hist.push({ role: 'bot', text: '您好，我是 MES 数据洞察助手。我可以基于当前系统内的演示数据，用对话方式帮您做查询与统计分析。试试下方的提示，或直接输入您的问题。' }); insightSave(hist); }
    chat.innerHTML = hist.map(insMsgHtml).join('');
    chat.scrollTop = chat.scrollHeight;
  }
  function insSend(preset) {
    var input = document.getElementById('insInput');
    var q = (preset != null ? preset : (input ? input.value : '')).trim();
    if (!q && !insPendingImg) { toast('请输入您的问题'); return; }
    var img = insPendingImg;
    var chat = document.getElementById('insChat'); if (!chat) return;
    var hist = insightLoad();
    hist.push({ role: 'user', text: q || '（附图提问）', img: img || undefined });
    chat.innerHTML = hist.map(insMsgHtml).join(''); chat.scrollTop = chat.scrollHeight;
    var res = insightAnalysis(q || '');
    hist.push({ role: 'bot', text: res.text, table: res.table || undefined });
    insightSave(hist);
    chat.innerHTML = hist.map(insMsgHtml).join(''); chat.scrollTop = chat.scrollHeight;
    if (input) input.value = '';
    insPendingImg = null;
    var at = document.getElementById('insAttach'); if (at) at.classList.remove('attached');
  }
  function viewInsight() {
    var c = document.getElementById('content');
    c.innerHTML =
      '<div class="card insight-card">' +
        '<div class="insight-top"><h2>数据洞察 · 对话式数据分析</h2><button class="ghost sm" id="insClear">清空对话</button></div>' +
        '<p class="mini">用自然语言向系统提问，直接分析本地 MES 数据（无需联网）。支持 <b>@图片</b> 附参考图；常用问法见下方提示。分析结论与明细均基于当前浏览器内的演示数据。</p>' +
        '<div class="insight-chips" id="insChips">' +
          chip('销售订单有多少条') + chip('按物料分类统计库存数量') + chip('各状态工单的分布') +
          chip('本月报工数量 top5 产品') + chip('OEE 均值是多少') + chip('列出未审核的销售订单') +
          chip('按供应商统计采购金额') + chip('追溯报表-报工有哪些记录') +
        '</div>' +
      '</div>' +
      '<div class="card insight-chat" id="insChat"></div>' +
      '<div class="card insight-input">' +
        '<textarea id="insInput" placeholder="例如：按物料分类统计库存数量；或点「@ 图片」附图后再输入问题…"></textarea>' +
        '<div class="insight-ia"><button class="ghost sm" id="insAttach">@ 图片</button>' +
        '<button class="primary" id="insSend">发送</button>' +
        '<input type="file" id="insFile" accept="image/*" style="display:none"/></div>' +
      '</div>';
    c.querySelectorAll('#insChips button').forEach(function (b) { b.onclick = function () { insSend(b.getAttribute('data-q')); }; });
    var clr = document.getElementById('insClear'); if (clr) clr.onclick = function () { if (confirm('确定清空当前对话？')) { localStorage.removeItem(INSIGHT_KEY); insPendingImg = null; renderInsightHistory(); } };
    var input = document.getElementById('insInput');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insSend(); } });
    var snd = document.getElementById('insSend'); if (snd) snd.onclick = function () { insSend(); };
    var file = document.getElementById('insFile');
    var at = document.getElementById('insAttach');
    if (at) at.onclick = function () { if (file) file.click(); };
    if (file) file.onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { insPendingImg = rd.result; toast('已附图，输入问题后发送即可'); if (at) at.classList.add('attached'); };
      rd.readAsDataURL(f);
    };
    renderInsightHistory();
  }

  /* ---------- 生产看板 · 现场驾驶舱（默认落地页） ---------- */
  var BR_CHIPS = ['本周', '上周', '本月', '上月', '本年'];
  function brFmt(d) { function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function brRange(chip) {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth(), s, e;
    if (chip === '本周') { var wd = (d.getDay() + 6) % 7; s = new Date(d); s.setDate(d.getDate() - wd); e = new Date(s); e.setDate(s.getDate() + 6); }
    else if (chip === '上周') { var wd2 = (d.getDay() + 6) % 7; e = new Date(d); e.setDate(d.getDate() - wd2 - 1); s = new Date(e); s.setDate(e.getDate() - 6); }
    else if (chip === '上月') { s = new Date(y, m - 1, 1); e = new Date(y, m, 0); }
    else if (chip === '本年') { s = new Date(y, 0, 1); e = new Date(y, 11, 31); }
    else { s = new Date(y, m, 1); e = new Date(y, m + 1, 0); }
    return { from: brFmt(s), to: brFmt(e) };
  }
  function brInit() {
    if (!st.board) { var r = brRange('本月'); st.board = { chip: '本月', from: r.from, to: r.to }; }
    return st.board;
  }
  function brInRange(v, from, to) { if (!v) return false; var s = String(v).slice(0, 10); return s >= from && s <= to; }
  function brNum(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function brKpi(label, num, sub, color) {
    return '<div class="kpi-card"><div class="kpi-label">' + esc(label) + '</div>' +
      '<div class="kpi-num" style="color:' + (color || '#0f172a') + '">' + num + '</div>' +
      '<div class="kpi-sub">' + sub + '</div></div>';
  }
  function brBars(pairs, color) {
    if (!pairs.length) return '<div class="mini">' + (BOOTING ? '正在从后端读取数据…' : '暂无数据') + '</div>';
    var max = 1; pairs.forEach(function (p) { if (p[1] > max) max = p[1]; });
    return '<div class="bars">' + pairs.map(function (p) {
      var w = Math.round(p[1] / max * 100);
      return '<div class="bar-row"><span class="bar-lab">' + esc(p[0]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w + '%;background:' + (color || '#3b6ef5') + '"></span></span>' +
        '<span class="bar-val">' + p[1] + '</span></div>';
    }).join('') + '</div>';
  }
  function viewBoard() {
    var B = brInit();
    var from = B.from, to = B.to;
    var openQty = 0;
    rows('SD_SALES_ORDER_LINE').forEach(function (r) { openQty += brNum(r.OPEN_QTY); });
    var wos = rows('EX_WORK_ORDER').filter(function (r) { return /生产|下达|执行/.test(r.STATUS || ''); });
    var wipQty = 0; wos.forEach(function (r) { wipQty += Math.max(0, brNum(r.PLAN_QTY) - brNum(r.FINISH_QTY)); });
    var goodQty = 0; rows('EX_REPORT').forEach(function (r) { if (brInRange(r.REPORT_DATE, from, to)) goodQty += brNum(r.GOOD_QTY); });
    var oeeArr = rows('EQ_OEE').filter(function (r) { return brInRange(r.STAT_DATE, from, to); });
    var oeeAvg = oeeArr.length ? (oeeArr.reduce(function (a, r) { return a + brNum(r.OEE_VALUE); }, 0) / oeeArr.length) : 0;
    var inQty = 0; rows('WM_FINISH_IN').forEach(function (r) { if (brInRange(r.DOC_DATE, from, to)) inQty += brNum(r.TOTAL_IN_QTY); });
    var faultOpen = rows('EQ_FAULT_REPAIR').filter(function (r) { return !/完成|已闭环/.test(r.STATUS || ''); }).length;
    var waitQC = rows('QC_INSPECTION').filter(function (r) { return /处理中|待检|待判定/.test(r.STATUS || '') || /不合格/.test(r.QC_RESULT || ''); }).length;
    var kpis =
      brKpi('未交订单(件)', openQty, '销售订单明细累计未交', '#e11d48') +
      brKpi('在制工单', wos.length + ' 单', '在制约 ' + wipQty + ' 件', '#d98800') +
      brKpi('区间完工合格(件)', goodQty, from + ' ~ ' + to, '#18a058') +
      brKpi('区间成品入库(件)', inQty, '完工入库单合计', '#0ea5a4') +
      brKpi('平均设备综合效率', (oeeAvg * 100).toFixed(1) + '%', 'OEE 均值 · ' + oeeArr.length + ' 条记录', oeeAvg >= 0.75 ? '#18a058' : '#e11d48') +
      brKpi('待处理异常', faultOpen + ' / ' + waitQC, '未闭环报修 / 待处理检验', (faultOpen + waitQC) > 0 ? '#e11d48' : '#18a058');
    var woStat = {}; rows('EX_WORK_ORDER').forEach(function (r) { var k = r.STATUS || '未知'; woStat[k] = (woStat[k] || 0) + 1; });
    var eqStat = {}; rows('MD_EQUIPMENT').forEach(function (r) { var k = r.EQUIP_STATUS || '未知'; eqStat[k] = (eqStat[k] || 0) + 1; });
    var byDay = {}; rows('EX_REPORT').forEach(function (r) { if (!brInRange(r.REPORT_DATE, from, to)) return; var k = String(r.REPORT_DATE).slice(5); byDay[k] = (byDay[k] || 0) + brNum(r.GOOD_QTY); });
    var dayArr = Object.keys(byDay).sort();
    var trend = '<div class="trend">' + (dayArr.length ? (function () {
      var maxv = Math.max.apply(null, dayArr.map(function (x) { return byDay[x]; })) || 1;
      return dayArr.map(function (k) {
        var hh = Math.round(byDay[k] / maxv * 90) + 6;
        return '<div class="tcol" title="' + k + ' ' + byDay[k] + '件"><span class="tval">' + byDay[k] + '</span><span class="tbar" style="height:' + hh + 'px"></span><span class="tlab">' + esc(k) + '</span></div>';
      }).join('');
    })() : '<div class="mini">' + (BOOTING ? '正在从后端读取数据…' : '区间内暂无报工数据') + '</div>') + '</div>';
    var wipRows = rows('EX_WIP_BOARD').map(function (r) {
      return '<tr><td>' + esc(r.WO_NO) + '</td><td>' + esc(r.ITEM_NAME || r.PRODUCT_NO) + '</td><td>' + esc(r.CURRENT_STEP_NAME || '') + '</td>' +
        '<td>' + (r.PLAN_QTY == null ? '' : r.PLAN_QTY) + '</td><td>' + (r.GOOD_QTY == null ? '' : r.GOOD_QTY) + '</td><td>' + (r.WIP_QTY == null ? '' : r.WIP_QTY) + '</td>' +
        '<td>' + (r.DONE_RATE == null ? '' : (brNum(r.DONE_RATE) * 100).toFixed(0) + '%') + '</td><td>' + (r.EST_FINISH_TIME ? esc(String(r.EST_FINISH_TIME).slice(0, 16)) : '—') + '</td><td>' + statusTag(r.WIP_STATUS) + '</td></tr>';
    }).join('');
    var bkRows = rows('PP_ORDER_BOARD').map(function (r) {
      return '<tr><td>' + esc(r.ITEM_NO) + '</td><td>' + esc(r.ITEM_NAME) + '</td><td>' + (r.ORDER_QTY || 0) + '</td><td>' + (r.DELIVERED_QTY || 0) + '</td>' +
        '<td>' + (r.WIP_QTY || 0) + '</td><td>' + (r.STOCK_QTY || 0) + '</td><td>' + (r.FORECAST_QTY || 0) + '</td><td style="color:#e11d48;font-weight:600">' + (r.SHORT_QTY || 0) + '</td></tr>';
    }).join('');
    var h = '';
    h += '<div class="card board-card"><div class="board-head"><h2>生产看板 · 现场驾驶舱</h2>' +
      '<div class="chips">' + BR_CHIPS.map(function (cp) { return '<button class="chip' + (B.chip === cp ? ' active' : '') + '" data-chip="' + cp + '">' + cp + '</button>'; }).join('') + '</div></div>' +
      '<div class="board-filter"><span class="mini">统计区间</span>' +
      '<input type="date" id="brFrom" value="' + esc(from) + '"/><span class="mini">~</span><input type="date" id="brTo" value="' + esc(to) + '"/>' +
      '<button class="primary sm" id="brQuery">查询</button><button class="ghost sm" id="brReset">重置</button>' +
      '<span class="mini">当前区间 ' + esc(from) + ' ~ ' + esc(to) + ' · 本页为只读驾驶舱（默认落地页），指标由各业务表实时汇总' +
      (BOOTING ? ' · <b>正在从后端读取数据…</b>' : '') + '</span></div></div>';
    h += '<div class="kpi-grid">' + kpis + '</div>';
    h += '<div class="board-2col">' +
      '<div class="card"><h3>区间产量趋势（合格件）</h3>' + trend + '</div>' +
      '<div class="card"><h3>工单状态分布</h3>' + brBars(Object.keys(woStat).map(function (k) { return [k, woStat[k]]; }), '#0ea5a4') +
        '<h3 class="mt14">设备状态分布</h3>' + brBars(Object.keys(eqStat).map(function (k) { return [k, eqStat[k]]; }), '#8b5cf6') + '</div>' +
      '</div>';
    h += '<div class="card"><h3>WIP 在制明细</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>工单号</th><th>品名</th><th>当前工序</th><th>计划数</th><th>良品数</th><th>在制数</th><th>完成率</th><th>预计完工</th><th>状态</th></tr></thead><tbody>' +
      (wipRows || '<tr><td colspan="9" class="mini">' + (BOOTING ? '正在从后端读取数据…' : '暂无在制数据') + '</td></tr>') + '</tbody></table></div></div>';
    h += '<div class="card"><h3>订单 · 在制 · 在库一览（交付缺口）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>品号</th><th>品名</th><th>订单数</th><th>已交</th><th>在制</th><th>在库</th><th>预测</th><th>缺交</th></tr></thead><tbody>' +
      (bkRows || '<tr><td colspan="8" class="mini">' + (BOOTING ? '正在从后端读取数据…' : '暂无数据') + '</td></tr>') + '</tbody></table></div></div>';
    return h;
  }
  function bindBoard() {
    document.querySelectorAll('.board-card [data-chip]').forEach(function (b) {
      b.onclick = function () { var r = brRange(b.getAttribute('data-chip')); st.board = { chip: b.getAttribute('data-chip'), from: r.from, to: r.to }; render(); };
    });
    var q = document.getElementById('brQuery');
    if (q) q.onclick = function () {
      var f = document.getElementById('brFrom'), t = document.getElementById('brTo');
      st.board = { chip: '', from: (f && f.value) || st.board.from, to: (t && t.value) || st.board.to }; render();
    };
    var rs = document.getElementById('brReset');
    if (rs) rs.onclick = function () { var r = brRange('本月'); st.board = { chip: '本月', from: r.from, to: r.to }; render(); };
  }

  /* ---------- 启动 ----------
   * ⚠️ 2026-10-22 改：**首屏不再用演示种子占位**。
   *   原顺序是 ensureSeed() → render()（先出 844 条种子）→ 探活成功后 db[t]=[] 全清空
   *   → 再逐批回填真实数据，用户会看到「有数据 → 空 → 又有数据」三段抖动。
   *   新顺序：先建空骨架渲染（列表显示「正在读取」）→ 探活 →
   *     · 后端可用：直接逐批灌真实数据，全程只有「空 → 真实」，种子一次都不出现；
   *     · 后端不可用（纯静态预览 / 未部署）：才 ensureSeed(true) 回落演示数据。 */
  /* ---------- 启动 ----------
   * 2026-10-27 按需取数改造：不再「启动即全量预载 70 张表」。
   *   老行为：一进来把 70 张表各拉 200 行；门户点菜单 = iframe 整页重载 → 71 个请求/次点击。
   *   新顺序：
   *     1) 读本地快照（db + 表版本）→ 立刻渲染。0 请求，切页秒开；
   *     2) 探活；后端不可用才回落演示种子；
   *     3) GET /api/sync 一次对账 → 只重拉「版本变了且已载入过」的表；
   *     4) 渲染途中真正读到的表若还没载入，由 fillMissing() 补拉 —— 每页只拉自己用到的。
   *   ?lazy=0 可一键退回老的全量预载，留作线上兜底。 */
  var bootFromCache = false;
  if (LAZY) {
    loadSync();                                   // 恢复上一轮的表版本 + 「已载入」标记
    var cachedDb = load();                        // localStorage 快照（mes_db_v5）
    if (cachedDb && typeof cachedDb === 'object') {
      db = cachedDb;
      Object.keys(S.TABLES).forEach(function (t) {
        if (!Array.isArray(db[t])) db[t] = [];
        if (!LOADED[t]) db[t] = [];                 // 没打过「已载入」标记的表，快照不可信 → 清空待拉
      });
      bootFromCache = true;
    } else {
      initDbEmpty();
      VERS = {}; LOADED = {}; saveSync();
    }
  } else {
    initDbEmpty();
  }
  BOOTING = !bootFromCache;       // 有快照就直接出数据，不再让列表显示「加载中」
  applyCustomFields();
  applyViews();                 // 先载入视图显隐设置（applyRoute 依赖 visOn）
  applyRoute();                 // 深链：按 URL（门户菜单路径）定位视图 / 表
  if (!st.table) st.table = firstTable();
  bindTop(); setNav(); render();
  renderVersion();              // 顶栏版本角标（由 js/version.js 注入，零请求）
  loadWhoami();                 // 读取门户当前登录人（失败静默）
  renderDataSource();           // 探活前显示「连接中…」
  /* 自有后端（§backend-uns）：已接后端的表走自身业务 API，真实读写 UNS。
   * 按需模式下不再单独探活 —— /api/sync 成功即证明后端在，省掉每次切页的一次请求。
   * 探活失败 / 对账失败（未部署 / 无权限 / 纯静态）→ 回落内置演示数据。 */
  if (LAZY) {
    BOOTING = false;
    reconcile().then(function (backendOk) {
      if (!backendOk) {
        LOADED = {}; VERS = {}; saveSync();   // 后端没了：本地快照不能算「已同步」
        ensureSeed(true); save(); render(); renderDataSource();
        return;
      }
      render(); renderDataSource();
    });
  } else {
    BE.probe().then(function (ok) {
      if (!ok) {
        BOOTING = false;
        ensureSeed(true); save(); render(); renderDataSource();
        return;
      }
      return legacyPreload();
    });
  }

  /* 版本对账：只问「本地已有缓存」的那几张表（线上实测全量 70 张要 2.4s，别每次点击都付）。
   *   · 无缓存时只问 1 张：用来确认后端在不在，成本一次极小的查询；
   *   · 有缓存时问已载入的：变了就重拉，没变就用缓存；
   *   · 需要全部行数（总览 / 本地侧栏）时才走 ensureAllCounts()。
   * 返回值 = 后端是否可用（sync 成功即 true）。 */
  function reconcile(list) {
    var known = (list && list.length) ? list : Object.keys(LOADED);
    if (!known.length) known = [BE.tables()[0]];
    return BE.sync(known).then(function (tbl) {
      BE.markAvailable(true);
      var changed = [];
      Object.keys(tbl).forEach(function (t) {
        var cur = tbl[t] || {};
        var old = VERS[t];
        var same = old && String(old.c) === String(cur.c) && String(old.u) === String(cur.u);
        VERS[t] = { c: cur.c, u: cur.u };
        if (!same && LOADED[t]) changed.push(t);
      });
      saveSync();
      if (!changed.length) return true;
      return new Promise(function (res) { loadTables(changed, function () { res(true); }); });
    }).catch(function (e) {
      BE.markAvailable(false);
      try { console.warn('[MES-BE] 版本对账失败：' + ((e && e.message) || e)); } catch (_) {}
      return false;
    });
  }

  /* 需要「每张表有多少行」的视图（系统总览 / 本地形态左侧树计数）才全量对账一次。
   * 门户形态下的单表页面永远走不到这里，所以不会为了一屏计数把 70 张表问一遍。 */
  var ALL_COUNTS = false, ALL_COUNTS_BUSY = false;
  function ensureAllCounts() {
    if (ALL_COUNTS || ALL_COUNTS_BUSY || !BE.available()) return;
    if (Object.keys(VERS).length >= BE.tables().length) { ALL_COUNTS = true; return; }
    ALL_COUNTS_BUSY = true;
    reconcile(BE.tables()).then(function () { ALL_COUNTS = true; }).catch(function () {})
      .then(function () { ALL_COUNTS_BUSY = false; render(); });
  }

  /* 旧的全量预载（?lazy=0 时使用）。保留原实现与注释，作为线上兜底路径。 */
  function legacyPreload() {
    var list = BE.tables(), CHUNK = 8;
    var bootPainted = false;
    function bootPaint() {
      BOOTING = false;
      bootPainted = true;
      Object.keys(db).forEach(function (t) { if (Array.isArray(db[t])) LOADED[t] = 1; });
      save(); saveSync(); render(); renderDataSource();
    }
    var bootTimer = setTimeout(bootPaint, 7000);
    function loadFrom(i) {
      if (i >= list.length) return Promise.resolve();
      return Promise.all(list.slice(i, i + CHUNK).map(function (t) {
        return BE.list(t, 200).then(function (unsRows) {
          db[t] = unsRows.map(function (u) { return rowFromBackend(t, u); });
          LOADED[t] = 1;
        }).catch(function (e) {
          try { console.warn('[MES-BE] ' + t + ' 读取失败：' + ((e && e.message) || e)); } catch (_) {}
        });
      })).then(function () { return loadFrom(i + CHUNK); });
    }
    return loadFrom(0).then(function () {
      clearTimeout(bootTimer);
      if (bootPainted) { save(); saveSync(); render(); return; }
      bootPaint();
    });
  }

  /* 测试钩子（只读暴露，不影响运行）：自动化冒烟脚本用 */
  window.__MES_T = { openDoc: openDoc, openForm: openForm, closeModal: closeModal, find: find, rows: rows, st: st, S: S, exportCsv: exportCsv, doPrint: doPrint, openBarcode: openBarcode, openImport: openImport, save: save, render: render, isReportTable: isReportTable, currentPageRows: currentPageRows, getDb: function () { return db; } };
})();
