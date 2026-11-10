/* APS 原型前端逻辑（纯前端 + localStorage 持久化，零依赖）
 * 引擎与现有 MES 4.0 同构：左侧树形导航 / 单据主子表联动 / 全表 CRUD / 核心流程 / 使用说明 / 视图显隐可配置，
 * 仅替换数据模型（schema.js）与演示剧本（seed.js），并改写 APS 专属的报表派生、计划驾驶舱、排产甘特图与业务流。
 */
(function () {
  'use strict';
  var S = window.APS_SCHEMA;
  var LS = 'aps_db_v1'; // v1：APS（V5 轻量化三核心：物料需求计算 + 物料齐套计算 + 生产排程）
  var SEED_VER = 'v5.3';      // 演示数据剧本版本：升级种子数据时同步修改，浏览器端旧数据自动重建
                              //   v5.3（2026-10-15）：中间三轮「试算」版本的净需求行补齐在途口径 ——
                              //      9/07、9/14、9/21 复核结论为「无需补充」，其差额由上一轮下单形成的采购在途
                              //      （ON_ORDER_QTY）覆盖，使 GROSS+安全−可用−在制−在途 恰为 0。
                              //   v5.2（2026-10-15）：时间线按「真实滚动节奏」重建 ——
                              //   ① 创建/更新时间不再全库同一秒：单据跟随单据日期、计算结果跟随计算时间、
                              //      主数据按域错开到 APS 上线准备期（8/25~8/28）；版本派生的排程记录跟随版本生成日；
                              //   ② 9 月工单（SO-2026-001 共 1000 件，交期 9/30）按周分批下达（9/06、9/14、9/21 三周），
                              //      排产因此铺满 9 月各周，不再只有月初几天；
                              //   ③ 排程版本由 4 版扩到 7 版（8/31 起每个周一各滚一轮），MRP 版本同步扩到 7 个；
                              //   ④ 工厂日历由 9 条特殊日扩成覆盖 8/28~10/31 的完整班次日历（周一至周六双班、国庆停产）。
                              //   v5.1（2026-10-15）：① 计算结果表去掉「审核」按钮与审核状态/审核人/审核时间字段
                              //                       （系统写入的数据无人工审核环节；业务录入表保留）；
                              //                       ② 产能负荷看板 / 齐套率看板 由「报表表」改为「看板视图」
                              //                       （计划看板域：卡片 + 图形 + 明细，rptCapacityLoad/rptKitRate 直接驱动）。
                              //   v5.0（2026-10-15）：重大重构 ——
                              //   ① 需求源只留「销售订单 + 库存补充」两类（删客户预测/看板叫料），库存补充改为引用 MES 库存+在途；
                              //   ② 需求明细删「预测冲减量/冲减后需求」字段，只留需求数量；
                              //   ③ 删周计划表(SCH_WEEK_PLAN)与滚动排产记录(SCH_ROLL_LOG)，只留日排产；
                              //   ④ 新增排产异常表(SCH_EXCEPTION)，从排程延期/冲突任务派生；
                              //   ⑤ 字段英文名不再显示在列表表头/导入模板/列选择器；
                              //   ⑥ 工作台标题区运行按钮去掉，只保留下方操作区；
                              //   ⑦ 版本关联的排程规则下拉显示「编号·名称」；
                              //   ⑧ 清理叫料/预测触发的历史计算数据（净需求/齐套/缺料/补料/生产建议）
  var SEED_VER_KEY = 'aps_seed_ver';
  var FIELDS_KEY = 'aps_fields_v1';
  var VIEWS_KEY = 'aps_views_v1'; // v1：顶栏收为 3 个视图，其余改挂左侧树「计划看板 / 应用工具」
  var COLVIS_KEY = 'aps_colvis_v1';
  var COLORDER_KEY = 'aps_colorder_v1';
  var INSIGHT_KEY = 'aps_insight_v1';
  var db = null;
  var st = { view: 'board', table: null, search: '', sel: null, open: { g: {}, t: {} }, doc: null, fold: {} };

  /* 顶部导航配置（def=默认是否显示；可在「显示设置」中勾选显隐）
   * 顶栏只保留 数据浏览 / 数据模型 / 使用说明 三个；
   * 其余视图一律以「左侧树视图入口」呈现，挂在**各自所属的功能域**下 ——
   *   计划看板 → 计划驾驶舱 / 排产甘特图；
   *   物料需求计算 → MRP 计算工作台；物料齐套计算 → 齐套计算工作台；生产排程 → 排程工作台；
   *   系统与集成 → UNS 数据源映射。
   * side=true 表示该视图属于左侧树，不因深链自动冒到顶栏（仍可在「显示设置」手动勾出）。
   * ⚠️ 原「应用工具」域的 batch(计算版本工作台) / flow(核心流程) 已随功能拆解从导航下线
   *    （side:false + hidden:true，代码保留以兼容深链）；dashboard / insight / er 同样已隐藏。
   *    需要恢复时把 side 改回 true 并加回 GROUPS 的 views 即可。 */
  var NAV = [
    { view: 'browser', label: '数据浏览', def: true },
    { view: 'model', label: '数据模型', def: true },
    { view: 'guide', label: '使用说明', def: true },
    /* 以下视图不进顶栏，改为左侧树对应功能域下的入口（side:true） */
    { view: 'board', label: '计划驾驶舱', def: false, side: true, group: '计划看板' },
    /* 产能负荷看板：留在「计划看板」域（跨订单的产能体检）；
     * 齐套率看板归入「物料齐套计算」域、排产甘特图归入「生产排程」域——与各自的计算工作台同域，
     * 「算完就在本域看结果」。 */
    { view: 'capload', label: '产能负荷看板', def: false, side: true, group: '计划看板' },
    { view: 'kitrate', label: '齐套率看板', def: false, side: true, group: '物料齐套计算' },
    { view: 'gantt', label: '排产甘特图', def: false, side: true, group: '生产排程' },
    /* 三个核心域的计算工作台：进入该域的第一个入口（算，而不是录） */
    { view: 'mrp', label: 'MRP 计算工作台', def: false, side: true, group: '物料需求计算' },
    { view: 'kit', label: '齐套计算工作台', def: false, side: true, group: '物料齐套计算' },
    { view: 'sched', label: '排程工作台', def: false, side: true, group: '生产排程' },
    /* UNS 数据源映射：归属「系统与集成」（数据来源说明，非计算） */
    { view: 'uns', label: 'UNS 数据源映射', def: false, side: true, group: '系统与集成' },
    /* 原「应用工具」域已拆解进三个核心功能域；以下视图从导航下线（代码保留，深链仍可达） */
    { view: 'batch', label: '计算版本工作台（旧）', def: false, side: false, hidden: true },
    { view: 'flow', label: '核心流程（旧）', def: false, side: false, hidden: true },
    /* 已隐藏（从左侧树移除；仍可通过深链 / 显示设置手动访问） */
    { view: 'dashboard', label: '总览', def: false, side: false, hidden: true },
    { view: 'insight', label: '数据洞察', def: false, side: false, hidden: true },
    { view: 'er', label: '关系图', def: false, side: false, hidden: true }
  ];
  var DEFAULT_LANDING = 'board'; // 每次打开 / 刷新默认落地的界面（计划驾驶舱）
  function navOf(view) { return NAV.find(function (n) { return n.view === view; }); }
  /* 门户菜单路径别名：supOS 平台会把 /batch、/uns 这类「平台自身业务词」的菜单项丢弃
     （实测 1.4.0 发布时 aps_v_batch / aps_v_uns 未落到菜单树，而 /flow、/board 正常）。
     故菜单 path 改用不冲突的 slug，并在路由解析时映射回真实视图名。
     注意：这只改「路径 → 视图」的入口，视图名（st.view / NAV.view / 深链 ?v=）保持 batch / uns 不变。 */
  var VIEW_PATH_ALIAS = { 'calc-batch': 'batch', 'uns-source': 'uns' };
  function viewBySlug(slug) { return VIEW_PATH_ALIAS[slug] || (navOf(slug) ? slug : ''); }
  /* 左右树是否托管该视图（side:true）—— 深链时不自动冒到顶栏 */
  function isSidebarView(view) { var n = navOf(view); return !!(n && n.side); }
  /* 某导航分组挂的视图入口列表（新版一个分组可挂多个；g.view 为旧写法，保留兼容） */
  function groupViews(g) { return (g && g.views && g.views.length) ? g.views : ((g && g.view) ? [g.view] : []); }
  function coreView(view) { var n = navOf(view); return !!(n && n.core); }
  function visOn(view) { var n = navOf(view); if (!n) return false; if (n.core) return true; return views.vis[view] === undefined ? !!n.def : !!views.vis[view]; }
  /* 某张表所属的导航分组（GROUPS 条目） */
  function groupOf(t) { var g = null; S.GROUPS.forEach(function (x) { if (x.tables.indexOf(t) >= 0) g = x; }); return g; }
  /* 是否属于「报表分析」：报表只读、只保留查询/导出，且数据由业务表实时派生 */
  function isReportTable(t) { var g = groupOf(t); return !!(g && g.report); }

  /* 域配色（用于树形导航左侧色条） */
  var DOMAIN_COLOR = { BAS: '#3b6ef5', MRP: '#18a058', SCH: '#0ea5a4', RPT: '#e11d48', IF: '#d98800', RF: '#8b5cf6', KAN: '#0ea5e9', SYS: '#64748b' };
  function domColor(code) { return DOMAIN_COLOR[code] || '#3b6ef5'; }

  /* ---------- 深链路由（供 supOS 门户菜单把「域 / 表单」逐个挂成入口） ----------
   * 门户菜单支持三级：应用根 → 功能域目录（纯分组，不可点）→ 具体页面（本文件的路由目标），
   * 且各页面叶子直接带应用内相对路径。做法：每个域/表单给一个 slug 路径，
   * 应用启动时解析 URL 最后一段自动切到对应视图 / 表；导航时回写 URL 便于分享与刷新保持。
   * slug 约定：表单 `t-<表名小写、下划线转连字符>`（如 t-bas-demand）；域 `g-<域代码小写>`（如 g-bas，域级入口，门户菜单未使用）；
   * 视图沿用视图名（browser / model / guide / board / gantt / flow / insight / dashboard / er）。 */
  function tSlug(t) { return 't-' + String(t).toLowerCase().replace(/_/g, '-'); }
  function gSlug(code) { return 'g-' + String(code).toLowerCase(); }
  function groupDomainCode(name) {
    var d = (S.DOMAINS || []).find(function (x) { return x.name === name; });
    if (d) return d.code;
    var EXTRA = { '应用工具': 'TOOL' }; // 非业务域分组，给个 ASCII 域码便于深链
    return EXTRA[name] || name;
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
      if (!hitV && viewBySlug(s)) { hitV = viewBySlug(s); break; }
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
  /* 把当前所在位置同步到地址栏（不新增历史记录；失败静默） */
  function syncUrl() {
    try {
      var slug = (st.view === 'browser' && st.table) ? tSlug(st.table) : (navOf(st.view) ? st.view : '');
      if (!slug) return;
      var want = APP_BASE + slug;
      if (location.pathname !== want) history.replaceState(null, '', want);
    } catch (e) { }
  }

  /* ---------- 存储 ---------- */
  function load() { try { var r = localStorage.getItem(LS); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  /* 服务器模式下 db 不再落 localStorage：数据在 UNS，本地只留 UI 偏好（字段、列顺序、显隐） */
  function save() {
    if (window.APS_API && window.APS_API.isServer()) return;
    try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) {}
  }
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
    RF_ITEM: ['CUSTOMER_PART_NO']
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

  function ensureSeed() {
    if (db) return;
    /* 服务器模式：业务表一律以 UNS 为唯一真源；空就是空，绝不拿演示数据顶上，
     * 否则用户看到的「有数据」是假的。只有不在白名单里的 RF_* 快照表仍用本地种子
     * （P2 把引擎搬到后端后，这份快照也会去掉）。 */
    var api = window.APS_API;
    if (api && api.isServer()) {
      var remote = api.tables() || {}, seed0 = window.APS_SEED || {};
      db = {};
      Object.keys(S.TABLES).forEach(function (t) {
        if (Array.isArray(remote[t])) { db[t] = remote[t]; return; }
        if (!api.metaOf(t) && Array.isArray(seed0[t])) { db[t] = clone(seed0[t]); return; }
        db[t] = [];
      });
      return;
    }
    /* 本地模式（后端不可用时的降级）：沿用原来的 localStorage + 种子逻辑 */
    var stored = load();
    var ver = null;
    try { ver = localStorage.getItem(SEED_VER_KEY); } catch (e) { }
    /* 演示数据剧本升级（新增表 / 调整上下游）时，旧缓存自动失效重建，避免「看不到新表新明细」 */
    if (stored && ver !== SEED_VER) stored = null;
    var fresh = !stored;
    db = stored || clone(window.APS_SEED || {});
    Object.keys(S.TABLES).forEach(function (t) { if (!Array.isArray(db[t])) db[t] = []; });
    if (fresh) { save(); try { localStorage.setItem(SEED_VER_KEY, SEED_VER); } catch (e) { } }
  }

  /* ---------- 工具 ---------- */
  function esc(s) { if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function now() { var d = new Date(); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); }
  function today() { var d=new Date(); function p(n){return (n<10?'0':'')+n;} return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
  function ymd() { return today().replace(/-/g,''); }
  function uid(p) { return (p||'ID') + Date.now().toString(36) + Math.floor(Math.random()*900+100); }
  function toast(m) { var t=document.getElementById('toast'); t.textContent=m; t.style.display='block'; clearTimeout(toast._t); toast._t=setTimeout(function(){t.style.display='none';},2200); }
  /* 原始行（本表实际存储的数据） */
  function rawRows(t) { return (db[t]||[]).filter(function(r){return r.DEL_FLAG!==1;}); }
  /* 展示用行：报表分析组下的表不落地人工录入，改为按业务数据实时派生（见下方 buildReports） */
  function rows(t) {
    if (isReportTable(t)) {
      if (!RPT_CACHE) RPT_CACHE = buildReports();
      return RPT_CACHE[t] || [];
    }
    return rawRows(t);
  }
  function find(t,id){ return (db[t]||[]).find(function(r){return r.ID===id;}); }
  function statusTag(v){ if(!v) return ''; var c='tag'; if(/合格|通过|已发布|运行|正常|已入库|已下达|完成|已确认|已点检|已签回/.test(v)) c+=' ok'; else if(/不合格|驳回|故障|异常|报废|停用|待检|已作废|隔离/.test(v)) c+=' bad'; else if(/待|在制|执行|中|草稿/.test(v)) c+=' warn'; return '<span class="'+c+'">'+esc(v)+'</span>'; }

  /* ---------- 数据操作 ---------- */
  function insert(t, biz) {
    var def = S.TABLES[t]; var r = {};
    S.columnsOf(t).forEach(function (c) { if (c.sys && c.code!=='REMARK') r[c.code] = (c.code==='DEL_FLAG'?0:(c.code==='VER_NO'?1:null)); });
    r.ID = uid('ID'); r.ORG_ID='ORG1'; r.CREATE_BY='OPER'; r.CREATE_TIME=now(); r.UPDATE_BY=null; r.UPDATE_TIME=null; r.DEL_FLAG=0; r.VER_NO=1; r.REMOTE=null;
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
    /* 写穿透：先改内存让界面立刻响应，再入队由 api.js 合并提交到 UNS */
    if (window.APS_API) window.APS_API.enqueue(t, 'upsert', r);
    return r;
  }
  function update(t,id,patch){ var r=find(t,id); if(r){ for(var k in patch) r[k]=patch[k]; r.UPDATE_TIME=now(); save(); if (window.APS_API) window.APS_API.enqueue(t,'upsert',r); } return r; }
  function remove(t,id){ var r=find(t,id); if(r){ r.DEL_FLAG=1; r.UPDATE_TIME=now(); save(); if (window.APS_API) window.APS_API.enqueue(t,'delete',r); } }
  /* 删除主表记录时，连同其子表明细一起软删除（按 MASTER_DETAIL 的 fk 关联）。
   * 返回被连带删除的明细条数，供提示文案使用。 */
  function removeWithChildren(t, id) {
    var r = find(t, id); if (!r) return 0;
    var children = S.MASTER_DETAIL[t] || [];
    var n = 0;
    children.forEach(function (d) {
      rows(d.table).forEach(function (x) {
        if (String(x[d.fk]) === String(r[d.fk])) {
          x.DEL_FLAG = 1; x.UPDATE_TIME = now(); n++;
          if (window.APS_API) window.APS_API.enqueue(d.table, 'delete', x);
        }
      });
    });
    r.DEL_FLAG = 1; r.UPDATE_TIME = now(); save();
    if (window.APS_API) window.APS_API.enqueue(t, 'delete', r);
    return n;
  }

  /* ---------- 主表聚合回写（schema 的 MASTER_AGG） ----------
   * 需求：需求明细新增 / 修改 / 删除后，主表「来源单据号」要按明细里实际用到的来源单号重算——
   *       多条用「；」拼接、单条原样显示，且同一单号只出现一次（不重复）。 */
  function syncMasterAgg(mt, mrec, noPersist) {
    var maps = (S.MASTER_AGG || {})[mt]; if (!maps || !mrec) return false;
    var touched = false;
    maps.forEach(function (m) {
      var seen = [], vals = [];
      rows(m.table).filter(function (r) { return String(r[m.fk]) === String(mrec[m.fk]); }).forEach(function (r) {
        var v = r[m.col]; if (v === undefined || v === null || String(v) === '') return;
        v = String(v);
        if (seen.indexOf(v) >= 0) return;              // 去重：同一来源单号只保留一次
        seen.push(v); vals.push(v);
      });
      var nv = vals.join(m.sep);
      if (String(mrec[m.field] || '') !== nv) { mrec[m.field] = nv; touched = true; }
    });
    /* 主表聚合是派生写入：改完同样要入队，否则刷新后主表的「来源单据号」会回退。
     * noPersist 用于启动时的全量重算 —— 只修界面显示，不因为打开页面就往服务器写数据。 */
    if (touched && !noPersist && window.APS_API) window.APS_API.enqueue(mt, 'upsert', mrec);
    return touched;
  }
  /* 保存 / 删除的是「某聚合主表的子表」时，回查父单并同步（子表单独维护时也能同步主表） */
  function syncAggByChild(ct, childRec) {
    if (!childRec) return false;
    var changed = false;
    Object.keys(S.MASTER_AGG || {}).forEach(function (mt) {
      (S.MASTER_AGG[mt] || []).forEach(function (m) {
        if (m.table !== ct) return;
        var fkVal = childRec[m.fk]; if (fkVal === undefined || fkVal === null || fkVal === '') return;
        var mdef = S.TABLES[mt]; if (!mdef) return;
        var mrec = rows(mt).find(function (r) { return String(r[mdef.pk]) === String(fkVal); });
        if (mrec && syncMasterAgg(mt, mrec)) changed = true;
      });
    });
    if (changed) save();
    return changed;
  }
  /* 种子 / 历史数据里的聚合字段可能过期：启动时按明细重算一次，保证落库值与列表展示一致 */
  function syncAllAgg() {
    var changed = false;
    Object.keys(S.MASTER_AGG || {}).forEach(function (mt) {
      rows(mt).forEach(function (r) { if (syncMasterAgg(mt, r, true)) changed = true; });
    });
    if (changed) save();
    return changed;
  }

  /* ---------- 列选择（应用字段显隐配置） ---------- */
  /* 报表分析表（计划分析与预警）：数据由业务实时派生、不落库、无单据流转，
     也没有「主键 ID / 审核状态 / 审核人 / 审核时间」这些录入类概念，故列表不展示它们。 */
  var RPT_HIDE_COLS = ['ID', 'AUDIT_STATUS', 'AUDIT_BY', 'AUDIT_TIME'];
  function isRptHiddenCol(t, code) { return isReportTable(t) && RPT_HIDE_COLS.indexOf(code) >= 0; }
  function displayCols(t) {
    var cols = S.columnsOf(t);
    var pk = S.TABLES[t].pk;
    var biz = cols.filter(function (c) { return !(c.sys && c.code!=='REMARK') && !isRptHiddenCol(t, c.code); });
    var head = [];
    if (pk && pk!=='ID') head.push(cols.find(function (c){return c.code===pk;}));
    if (biz.some(function (c){return c.code==='DOC_NO';})) head.push(cols.find(function (c){return c.code==='DOC_NO';}));
    /* 表级「优先展示列」（schema 的 lead）：声明后紧跟单据号展示，保证不被列数截断，如需求源 → 需求来源 / 来源单据号 */
    (S.TABLES[t].lead || []).forEach(function (code) {
      var lc = cols.find(function (c) { return c.code === code; });
      if (lc && head.indexOf(lc) < 0) head.push(lc);
    });
    biz.forEach(function (c){ if (head.indexOf(c)<0) head.push(c); });
    return head.filter(function (c) { return c && colOn(t, c.code); }).slice(0, isReportTable(t) ? 14 : 9);
  }
  function displayColsExcept(t, ex) {
    return displayCols(t).filter(function (c) { return c.code !== ex; });
  }
  /* 派生列：值不落在本表字段，而由子表 / 关联数据实时算出（表 → 字段 → 取值函数）。
   * 需求：需求源的「来源单据号」要展示其明细里实际用到的来源单号，多条用「；」间隔、单条原样显示。 */
  var DERIVED_CELL = {
    BAS_DEMAND: {
      SOURCE_NO: function (r) {
        var nos = rows('BAS_DEMAND_LINE')
          .filter(function (l) { return String(l.DEMAND_NO) === String(r.DEMAND_NO); })
          .map(function (l) { return l.SRC_DOC_NO; })
          .filter(function (x) { return x !== undefined && x !== null && String(x) !== ''; })
          .filter(function (x, i, a) { return a.indexOf(x) === i; });
        return nos.length ? nos.join('；') : (r.SOURCE_NO || '');
      }
    }
  };
  function cellValue(r, c, t) {
    var v = r[c.code];
    var dcell = (t && DERIVED_CELL[t]) ? DERIVED_CELL[t][c.code] : null;
    if (dcell) { var dv = dcell(r); if (dv !== undefined && dv !== null && dv !== '') return esc(dv); }
    if (c.code==='AUDIT_STATUS') { if (!v) return '<span class="tag warn">待审核</span>'; if (/已通过|已审核|通过/.test(v)) return '<span class="tag ok">'+esc(v)+'</span>'; if (/驳回/.test(v)) return '<span class="tag bad">'+esc(v)+'</span>'; return '<span class="tag warn">'+esc(v)+'</span>'; }
    if (c.code==='STATUS'||c.code==='QC_RESULT'||c.code==='WIP_STATUS'||c.code==='EQUIP_STATUS') return statusTag(v);
    if (c.type==='b') return (v? '<span class="tag ok">是</span>' : '<span class="tag">否</span>');
    if (c.type==='x'||c.type==='j') return esc((v? String(v) : '').slice(0, 28));
    if (c.code==='REMARK') return esc((v||'').slice(0, 22));
    return esc(v);
  }

  /* 引用字段下拉：从被引用主数据表取可选项（新增/编辑时只能选已存在的主数据） */
  function refNameCol(refTable) {
    var cols = S.columnsOf(refTable);
    var nc = cols.find(function (c) { return /NAME|DESC|SHORT|NICK/.test(c.code); });
    return nc ? nc.code : (cols[0] ? cols[0].code : 'ID');
  }
  /* opt.filter(r) 收窄候选；opt.label(r) 自定义选项后缀文字 */
  function refOptions(refTable, selected, opt) {
    opt = opt || {};
    var def = S.TABLES[refTable]; if (!def) return '<option value="">（主数据缺失）</option>';
    var pk = def.pk || 'ID'; var nc = refNameCol(refTable);
    var opts = '<option value="">— 选择' + esc(def.label) + ' —</option>';
    var hit = false;
    rows(refTable).forEach(function (r) {
      var val = r[pk]; if (val === undefined || val === null) return;
      if (opt.filter && !opt.filter(r)) return;
      var isSel = selected != null && String(val) === String(selected);
      if (isSel) hit = true;
      var label = opt.label ? opt.label(r) : (r[nc] != null && r[nc] !== '' ? ' · ' + r[nc] : '');
      opts += '<option value="' + esc(val) + '"' + (isSel ? ' selected' : '') + '>' + esc(val) + esc(label) + '</option>';
    });
    /* 已选值不在候选池内（如切换来源后原品号不属于新来源）→ 补一个选项，避免编辑时静默丢值 */
    if (selected != null && String(selected) !== '' && !hit) {
      opts += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '（不在当前来源范围内）</option>';
    }
    return opts;
  }
  /* 字典可用编码（按 SORT_NO 排序，仅启用项），供下拉渲染与导入校验共用 */
  function dictCodes(dictType) {
    return rows('SYS_DICT').filter(function (r) {
      return r.DICT_TYPE === dictType && (r.ENABLE_FLAG === undefined || r.ENABLE_FLAG === null || +r.ENABLE_FLAG === 1);
    }).sort(function (a, b) { return (+a.SORT_NO || 0) - (+b.SORT_NO || 0); }).map(function (r) { return r.ITEM_CODE; });
  }
  /* 字典下拉：选项来自 SYS_DICT（DICT_TYPE = 列上声明的 dict），仅列启用项 */
  function dictOptions(dictType, selected) {
    var codes = dictCodes(dictType);
    var nameOf = {};
    rows('SYS_DICT').forEach(function (r) { if (r.DICT_TYPE === dictType) nameOf[r.ITEM_CODE] = r.ITEM_NAME || r.ITEM_CODE; });
    var opts = '<option value="">— 选择 —</option>';
    codes.forEach(function (v) {
      opts += '<option value="' + esc(v) + '"' + (selected != null && String(v) === String(selected) ? ' selected' : '') + '>' + esc(nameOf[v] || v) + '</option>';
    });
    if (selected != null && String(selected) !== '' && codes.indexOf(String(selected)) < 0) {
      opts += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>';
    }
    return opts;
  }

  /* ---------- 需求来源 → 可用数据池（需求明细的「品号」候选受表头「需求来源」约束） ---------- */
  var DEMAND_TARGET = (S.DEMAND_TARGET || { table: '', itemCol: '' });
  /* 当前正在渲染的需求明细上下文（同步渲染，openForm 在构建表格前赋值）
   * formTable：本次打开的表单对应的表；table/itemCol：受来源约束的子表与品号字段 */
  var lineRefCtx = { formTable: '', table: '', itemCol: '', src: '', pool: null };
  /* 需求明细的「品号」下拉选项参数：候选收窄到当前来源的可用数据，并在选项里提示来源单据号 */
  function demandRefOpt(ct, code) {
    if (!lineRefCtx.pool || ct !== lineRefCtx.table || code !== lineRefCtx.itemCol) return null;
    var nameCol = refNameCol('RF_ITEM');
    return {
      filter: function (r) { return !!lineRefCtx.pool[r[lineRefCtx.itemCol]]; },
      label: function (r) {
        var p = lineRefCtx.pool[r[lineRefCtx.itemCol]];
        return ' · ' + (r[nameCol] || '') + (p && p.doc ? '（' + p.doc + '）' : '');
      }
    };
  }
  function demandSourceDef(srcType) { return (S.DEMAND_SOURCE || {})[srcType] || null; }
  /* 按来源类型算出可用品号池：{ 品号: { name, doc, qty, date, cust } }；null = 该来源无外部数据表（品号不限） */
  function demandPool(srcType) {
    var d = demandSourceDef(srcType); if (!d || !d.ref) return null;
    var pool = {}, stock = {};
    if (d.stockRef) rows(d.stockRef).forEach(function (r) { stock[r[d.itemCol]] = (stock[r[d.itemCol]] || 0) + (+r[d.stockCol] || 0); });
    rows(d.ref).forEach(function (r) {
      if (d.poolFilter && !d.poolFilter(r)) return;
      var no = r[d.itemCol]; if (!no) return;
      var qty = +r[d.qtyCol] || 0;
      if (d.stockRef) qty = Math.max(0, qty - (stock[no] || 0));
      var date = (d.dateCol && r[d.dateCol]) || '';
      /* 同品号命中多张来源单时取交期最早的一张（多张来源单仍会各自生成明细行） */
      if (pool[no] && date && pool[no].date && date >= pool[no].date) return;
      pool[no] = {
        name: (d.nameCol && r[d.nameCol]) || '', doc: (d.docCol && r[d.docCol]) || '',
        qty: qty, date: date, cust: (d.custCol && r[d.custCol]) || ''
      };
    });
    return pool;
  }
  /* 无外部来源表时，按规则生成来源单据号（FC-YYYY-MM / KB-YYYY-MMDD / AUTO-YYYY-MMDD，口径与种子数据一致） */
  function autoSourceDocNo(srcType) {
    var d = demandSourceDef(srcType);
    if (!d || !d.docPrefix || d.docCol) return '';
    var t = today();
    var stamp = d.period === 'month' ? t.slice(0, 7) : (t.slice(0, 7) + t.slice(8));
    return d.docPrefix + '-' + stamp;
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
    document.getElementById('modalCancel').textContent = '关 闭';
    document.getElementById('modalMask').style.display = 'flex';
  }
  /* 打印条码标签（新窗口：二维码 + 编码 + 名称） */
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

  /* ---------- 侧边树形导航（扁平：功能域 → 表单，无业务域层/小圆点） ---------- */
  function renderSidebar() {
    // NAV_SUB：纯导航归组（与主子表数据关系无关），如「物料分类树」挂在「物料资料」下
    var subSet = {};
    Object.keys(S.NAV_SUB || {}).forEach(function (p) { (S.NAV_SUB[p] || []).forEach(function (c) { subSet[c] = true; }); });
    Object.keys(S.MASTER_DETAIL).forEach(function (m) { S.MASTER_DETAIL[m].forEach(function (d) { subSet[d.table] = true; }); });
    var h = '';
    /* 默认展开：只展开侧边栏里第一个业务功能域（APS 为「计划基础数据」）。
     * 早期版本对「带视图入口的分组」也默认展开，导致一次铺开 3 个核心域 + 全部结果明细表，
     * 首页信息量过大；现改为按需展开，核心域的工作台入口点一下即可见。 */
    var firstBiz = null;
    S.GROUPS.forEach(function (g) {
      if (!firstBiz && g.tables.some(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; })) firstBiz = g.name;
    });
    S.GROUPS.forEach(function (g) {
      var gOpen = st.open.g[g.name] === undefined ? (g.name === firstBiz) : (st.open.g[g.name] === true);
      h += '<div class="tree-group">';
      h += '<div class="group-head' + (gOpen ? '' : ' collapsed') + '" data-group="' + esc(g.name) + '">' +
        '<span class="chev">▾</span><span>' + esc(g.name) + '</span>' +
        '<span class="cnt">' + (g.tables.filter(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; }).length + groupViews(g).length) + '</span></div>';
      if (gOpen) {
        h += '<div class="tbl-list">';
        /* 视图型分组：挂若干「直接进入某视图」的入口（计划看板 → 计划驾驶舱 / 排产甘特图；三个核心域 → 各自的计算工作台；系统与集成 → UNS 数据源映射） */
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
          var cnt = rows(t).length;
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
                '<span class="cnt">' + rows(kt).length + '</span></div>';
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
        st.table = el.getAttribute('data-t'); st.view = 'browser'; st.sel = null; st.search = ''; setNav(); render();
      };
    });
  }

  /* ---------- 顶部导航（动态渲染 + 显隐可配置） ---------- */
  function setNav() { document.querySelectorAll('#topnav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === st.view); }); }
  function renderNav() {
    var nav = document.getElementById('topnav');
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
  /* 显示设置弹窗：勾选顶部导航要显示哪些视图（默认只显示 数据浏览/数据模型/使用说明） */
  function openSettings() {
    var body = '<p class="mini">本设置只影响<b>顶栏</b>的视图入口。默认只显示：<b>数据浏览 · 数据模型 · 使用说明</b>；其余视图挂在<b>左侧树</b>对应功能域下——「<b>计划看板</b>」（计划驾驶舱 / 排产甘特图）、「<b>物料需求计算</b>」（MRP 计算工作台）、「<b>物料齐套计算</b>」（齐套计算工作台）、「<b>生产排程</b>」（排程工作台）、「<b>系统与集成</b>」（UNS 数据源映射），勾上则同时在顶栏显示。设置即时生效并自动保存。</p>';
    body += '<div class="set-list">';
    NAV.forEach(function (n) {
      if (n.hidden) return; // 已隐藏的视图（数据洞察 / 关系图）不出现在设置里
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
  function bindTop() {
    var bs = document.getElementById('btnSettings');
    if (bs) bs.onclick = openSettings;
    document.getElementById('btnReset').onclick = function () {
      /* 服务器模式下「重置」不能假装能清空服务器数据 —— 只能重新拉取 */
      if (window.APS_API && window.APS_API.isServer()) {
        if (confirm('将从服务器重新载入数据，本地尚未保存的改动会丢失。继续？')) location.reload();
        return;
      }
      if (confirm('确定重置为演示数据？当前所有修改（含自定义字段、字段顺序、显示配置）将丢失。')) {
        db = null;
        localStorage.removeItem(LS); localStorage.removeItem(FIELDS_KEY);
        localStorage.removeItem(COLVIS_KEY); localStorage.removeItem(COLORDER_KEY); localStorage.removeItem(SEED_VER_KEY);
        views.vis = {}; persistViews(); // 视图显隐恢复默认（顶栏只留 数据浏览 / 数据模型 / 使用说明）
        ensureSeed(); st.table = firstTable(); st.sel = null; st.view = DEFAULT_LANDING;
        renderSidebar(); render(); toast('已重置演示数据');
      }
    };
  }
  function firstTable() { for (var k in S.TABLES) return k; }

  /* ============================================================
   * 计划分析与预警 · 实时派生（只读）
   * 报表分组下的表格不接收人工录入：每次渲染都按业务数据实时重算，上游
   * （需求 / 净需求 / 齐套 / 排程任务 / 交期 / 补料建议…）的任何新增或修改
   * 都会自动反映到报表里；报表内只保留「查询 / 导出」两种操作。
   * 口径对齐 MES 现有报表机制：不落库、随业务数据实时变化、只读、可查询导出。
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
  /* 两个时间之间的小时数（用于负荷工时） */
  function rhours(a, b) {
    if (!a || !b) return 0;
    var x = new Date(String(a).replace(/-/g, '/')), y = new Date(String(b).replace(/-/g, '/'));
    if (isNaN(x) || isNaN(y)) return 0;
    return Math.max(0, (y - x) / 3600000);
  }
  /* 资源在某日的可用工时：优先取「工厂日历」该资源/工厂当日的可用工时合计，缺省按双班 16h */
  function rCapHours(resNo, day) {
    var hits = rawRows('BAS_CALENDAR').filter(function (c) {
      return rd(c.WORK_DATE) === day && !c.IS_HOLIDAY && (c.OWNER_CODE === resNo || c.CAL_LEVEL === '工厂');
    });
    var h = hits.reduce(function (a, c) { return a + rn(c.CAP_HOURS); }, 0);
    return h > 0 ? h : 16;
  }
  /* 负荷率分级：>90% 红 / 85~90% 黄 / 其余正常 */
  function rLoadWarn(rate) { return rate > 0.9 ? '红色预警' : (rate >= 0.85 ? '黄色预警' : '正常'); }

  /* 最新排程版本号（按生成时间降序第一）——产能负荷派生 / 看板的默认版本。
   *    不用「首版」：产能负荷看板有区间过滤（默认本月），首版往往排的是更早的月份，会读到空 */
  function latestVerNo() {
    var vers = rawRows('SCH_VERSION').slice().sort(function (a, b) { return String(b.GEN_TIME || '').localeCompare(String(a.GEN_TIME || '')); });
    return vers.length ? vers[0].VERSION_NO : '';
  }

  /* ① 产能负荷派生：**按单个排程版本**、**按自然日切分**汇总负荷工时并算负荷率，瓶颈识别到机台。
   *      口径（2026-10-15 修订，替代原「全部版本 + 全时长记开工日」）：
   *        ① 只统计**一个排程版本**（默认首版，可在看板上切换版本）——避免多个版本的任务在同一时段叠加导致负荷率虚高；
   *        ② 工时**按自然日切分**：优先用该版本的「日排产 SCH_DAY_PLAN」（引擎已按 日期 × 班次 拆好），
   *           无日排产时才回退为按任务的 0 点边界逐日切分 —— 跨天任务不再把全部时长记在开工日。
   *      （不落库、不进报表缓存；直接驱动「计划看板 → 产能负荷看板」与驾驶舱的预警分布） */
  function rptCapacityLoad(optVer) {
    var ver = optVer || latestVerNo();
    var g = {}, out = [], i = 0;
    /* ① 优先：日排产（天然按 生产日期 × 班次 切分，跨午夜的班次仍归其 PLAN_DATE 当天） */
    var dps = rawRows('SCH_DAY_PLAN').filter(function (d) { return !ver || d.VERSION_NO === ver; });
    if (dps.length) {
      dps.forEach(function (d) {
        var day = rd(d.PLAN_DATE); if (!day) return;
        var k = day + '|' + (d.RES_NO || '');
        if (!g[k]) g[k] = { d: day, res: d.RES_NO, load: 0 };
        g[k].load += rhours(d.PLAN_START, d.PLAN_END);
      });
    } else {
      /* ② 回退：无日排产的版本 → 按任务的 0 点边界逐日切分 */
      rawRows('SCH_TASK').filter(function (t) { return !ver || t.VERSION_NO === ver; }).forEach(function (t) {
        var cur = new Date(String(t.START_TIME).replace(/-/g, '/')), end = new Date(String(t.END_TIME).replace(/-/g, '/'));
        if (isNaN(cur) || isNaN(end) || end <= cur) return;
        var guard = 0;
        function z(n) { return (n < 10 ? '0' : '') + n; }
        while (cur < end && guard++ < 400) {
          var dayEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
          var seg = dayEnd < end ? dayEnd : end;
          var day = cur.getFullYear() + '-' + z(cur.getMonth() + 1) + '-' + z(cur.getDate());
          var k2 = day + '|' + (t.RES_NO || '');
          if (!g[k2]) g[k2] = { d: day, res: t.RES_NO, load: 0 };
          g[k2].load += (seg - cur) / 3600000;
          cur = seg;
        }
      });
    }
    var rates = {};
    Object.keys(g).forEach(function (k) { var o = g[k]; rates[o.res] = Math.max(rates[o.res] || 0, o.load / rCapHours(o.res, o.d)); });
    var maxRate = 0; Object.keys(rates).forEach(function (r) { if (rates[r] > maxRate) maxRate = rates[r]; });
    Object.keys(g).sort().forEach(function (k) {
      var o = g[k], res = rfind('BAS_RESOURCE', function (r) { return r.RES_NO === o.res; });
      var cap = rCapHours(o.res, o.d), rate = cap ? o.load / cap : 0;
      var warn = rLoadWarn(rate);
      var isBottle = rate >= maxRate && rate > 0.9 ? 1 : 0;
      out.push(rrow('CAP_LOAD', i++, {
        LOAD_ID: 'LOAD-' + o.d.replace(/-/g, '') + '-' + (o.res || 'X'), CAP_LEVEL: res.RES_TYPE === '产线' ? '产线' : '机台',
        WORK_CENTER: res.WORK_CENTER || '', RES_NO: o.res, RES_NAME: res.RES_NAME || '',
        LOAD_DATE: o.d, AVAILABLE_CAP: +cap.toFixed(1), LOAD_HOURS: +o.load.toFixed(2), LOAD_RATE: +rate.toFixed(3),
        WARN_LEVEL: warn, BOTTLENECK_FLAG: isBottle, VERSION_NO: ver,
        SUGGEST_ADJ: rate > 0.9 ? '负荷率>90%，建议加班 / 外协分流 / 调整订单顺序' : (rate >= 0.85 ? '负荷率 85~90%，建议关注并预留缓冲' : '负荷正常')
      }));
    });
    return out;
  }

  /* ② 齐套率派生：按齐套检查单实时汇总，带出缺料 Top 与长周期件专项预警。
   *      （不落库；直接驱动「计划看板 → 齐套率看板」与总览页的平均齐套率） */
  function rptKitRate() {
    var out = [], i = 0;
    rawRows('MRP_KIT_CHECK').forEach(function (k) {
      var shorts = rawRows('MRP_KIT_SHORT').filter(function (s) { return s.CHECK_NO === k.CHECK_NO; })
        .sort(function (a, b) { return rn(b.SHORT_QTY) - rn(a.SHORT_QTY); });
      var top = shorts.map(function (s) { return s.ITEM_NAME + '(' + rn(s.SHORT_QTY) + ')'; }).join('、');
      var longWarn = shorts.filter(function (s) {
        var pa = rfind('BAS_ITEM_PLAN_ATTR', function (p) { return p.ITEM_NO === s.ITEM_NO; });
        return pa.LONG_CYCLE_FLAG == 1 || rfind('RF_ITEM', function (r) { return r.ITEM_NO === s.ITEM_NO; }).ITEM_CATEGORY === '毛坯';
      }).map(function (s) { return s.ITEM_NAME; }).join('、');
      var so = rfind('RF_SO', function (s) { return s.SO_NO === k.ORDER_NO; });
      out.push(rrow('KIT_RATE', i++, {
        KIT_ID: 'KR-' + k.CHECK_NO, STAT_DATE: rd(k.CHECK_DATE), SO_NO: k.ORDER_NO, CUSTOMER_CODE: so.CUSTOMER_CODE || '',
        ITEM_NO: k.ITEM_NO, ITEM_NAME: k.ITEM_NAME, ORDER_QTY: rn(k.DEMAND_QTY), KIT_QTY: rn(k.KIT_QTY),
        KIT_RATE: rn(k.KIT_RATE), KIT_DATE: rd(k.KIT_DATE), SHORT_TOP: top || '无缺料',
        LONG_CYCLE_WARN: longWarn ? ('长周期件缺料：' + longWarn) : '无'
      }));
    });
    return out;
  }

  /* ③ 交期预警表：需求交期 vs 该订单的排程完工，延期高亮并给出客户汇总 */
  function rptDeliveryAlert() {
    var out = [], i = 0, custSum = {};
    var rowsSrc = rawRows('RF_SO');
    rowsSrc.forEach(function (s) {
      var tasks = rawRows('SCH_TASK').filter(function (t) { return t.SO_NO === s.SO_NO && (!s.ITEM_NO || t.ITEM_NO === s.ITEM_NO); });
      var end = tasks.reduce(function (a, t) { var d = rd(t.END_TIME); return d > a ? d : a; }, '');
      var req = rd(s.DELIVERY_DATE);
      var delay = (end && req && end > req) ? Math.round((new Date(end.replace(/-/g, '/')) - new Date(req.replace(/-/g, '/'))) / 86400000) : 0;
      var risk = delay >= 3 ? '高' : (delay >= 1 ? '中' : '低');
      custSum[s.CUSTOMER_CODE] = (custSum[s.CUSTOMER_CODE] || 0) + delay;
      out.push(rrow('RPT_DELIVERY_ALERT', i++, {
        ALERT_ID: 'DA-' + s.SO_NO + '-' + (s.SEQ_NO || 1), SO_NO: s.SO_NO, CUSTOMER_CODE: s.CUSTOMER_CODE,
        ITEM_NO: s.ITEM_NO, ITEM_NAME: s.ITEM_NAME, REQ_DATE: req, SCH_END: end || '未排程',
        DELAY_DAYS: delay, DELAY_FLAG: delay > 0 ? 1 : 0, RISK_LEVEL: risk,
        CUSTOMER_SUM: (custSum[s.CUSTOMER_CODE] || 0) > 0 ? ('该客户累计延期 ' + custSum[s.CUSTOMER_CODE] + ' 天（主机厂交付风险）') : '按期'
      }));
    });
    return out;
  }

  /* ④ 排程KPI：按排程版本汇总延期任务数 / 总延期天数 / 总换型时间 / 资源利用率 / 准时率 */
  function rptScheduleKpi() {
    var out = [], i = 0, alerts = rptDeliveryAlert();
    rawRows('SCH_VERSION').forEach(function (v) {
      var tasks = rawRows('SCH_TASK').filter(function (t) { return t.VERSION_NO === v.VERSION_NO; });
      var delayTask = tasks.filter(function (t) { return t.DELAY_FLAG == 1; }).length;
      var sos = {}; tasks.forEach(function (t) { if (t.SO_NO) sos[t.SO_NO] = 1; });
      var delayDays = alerts.filter(function (a) { return sos[a.SO_NO]; }).reduce(function (a, x) { return a + rn(x.DELAY_DAYS); }, 0);
      var changeMin = tasks.reduce(function (a, t) { return a + rn(t.CHANGE_MIN); }, 0);
      var total = tasks.length || rn(v.TOTAL_TASK);
      var ontime = Math.max(0, total - delayTask);
      out.push(rrow('RPT_SCHEDULE_KPI', i++, {
        KPI_ID: 'KPI-' + v.VERSION_NO, STAT_DATE: rd(v.GEN_TIME), VERSION_NO: v.VERSION_NO, RULE_NO: v.RULE_NO,
        DELAY_TASK: delayTask, DELAY_DAYS: delayDays, TOTAL_CHANGE_MIN: +changeMin.toFixed(1),
        UTIL_RATE: rn(v.UTIL_RATE), ONTIME_TASK: ontime, OTD_RATE: total ? +(ontime / total).toFixed(3) : 0
      }));
    });
    return out;
  }

  /* ⑤ 物料需求计划表：按 品号 × 需求日期 汇总毛需求 / 净需求 / 库存 / 在途 / 在制 / 缺口（取最新计算版本） */
  function rptNetReqSum() {
    var batches = rawRows('MRP_BATCH').slice().sort(function (a, b) { return String(b.CALC_TIME).localeCompare(String(a.CALC_TIME)); });
    var batch = batches.length ? batches[0].BATCH_NO : '';
    var g = {}, out = [], i = 0;
    rawRows('MRP_NET_REQ').filter(function (r) { return !batch || r.BATCH_NO === batch; }).forEach(function (r) {
      var d = rd(r.REQ_DATE), k = r.ITEM_NO + '|' + d;
      if (!g[k]) g[k] = { ITEM_NO: r.ITEM_NO, ITEM_NAME: r.ITEM_NAME, ITEM_TYPE: r.ITEM_TYPE, LEVEL_NO: r.LEVEL_NO, REQ_DATE: d, GROSS: 0, NET: 0, STOCK: 0, ONWAY: 0, WIP: 0 };
      var o = g[k];
      o.GROSS += rn(r.GROSS_QTY); o.NET += rn(r.ADJ_QTY); o.STOCK = Math.max(o.STOCK, rn(r.AVAIL_STOCK));
      o.ONWAY += rn(r.ON_ORDER_QTY); o.WIP += rn(r.WIP_QTY);
    });
    Object.keys(g).sort().forEach(function (k) {
      var o = g[k];
      out.push(rrow('RPT_NET_REQ_SUM', i++, {
        SUM_ID: 'NRS-' + (i + 1), ITEM_NO: o.ITEM_NO, ITEM_NAME: o.ITEM_NAME, ITEM_TYPE: o.ITEM_TYPE, LEVEL_NO: o.LEVEL_NO,
        REQ_DATE: o.REQ_DATE, GROSS_QTY: +o.GROSS.toFixed(1), NET_QTY: +o.NET.toFixed(1), STOCK_QTY: +o.STOCK.toFixed(1),
        ON_ORDER_QTY: +o.ONWAY.toFixed(1), WIP_QTY: +o.WIP.toFixed(1),
        SHORT_QTY: +Math.max(0, o.NET - o.STOCK - o.ONWAY - o.WIP).toFixed(1)
      }));
    });
    return out;
  }

  /* ⑥ 缺料明细表：订单下钻（缺什么 / 缺多少 / 预计何时恢复） */
  function rptShortDetail() {
    var out = [], i = 0;
    rawRows('MRP_KIT_SHORT').forEach(function (s) {
      out.push(rrow('RPT_SHORT_DETAIL', i++, {
        DETAIL_ID: 'SD-' + s.SHORT_ID, SO_NO: s.ORDER_NO, ITEM_NO: s.ITEM_NO, ITEM_NAME: s.ITEM_NAME,
        SHORT_QTY: rn(s.SHORT_QTY), RECOVER_DATE: rd(s.RECOVER_DATE), KEY_ITEM_FLAG: s.KEY_ITEM_FLAG == 1 ? 1 : 0,
        SUPPLY_TYPE: s.SUPPLY_TYPE, ORDER_DRILL: s.ORDER_NO,
        RISK_LEVEL: s.BLOCK_FLAG == 1 ? '阻断' : (s.KEY_ITEM_FLAG == 1 ? '关注' : '一般')
      }));
    });
    return out;
  }

  /* 注：产能负荷 / 齐套率已改为「计划看板」域的看板视图（viewCapLoad / viewKitRate），
     不再作为报表表落缓存；其派生函数 rptCapacityLoad / rptKitRate 仍被看板与驾驶舱直接调用。 */
  var RPT_BUILDERS = {
    RPT_DELIVERY_ALERT: rptDeliveryAlert,
    RPT_SCHEDULE_KPI: rptScheduleKpi,
    RPT_NET_REQ_SUM: rptNetReqSum,
    RPT_SHORT_DETAIL: rptShortDetail
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
    if (st.view === 'dashboard') c.innerHTML = viewDashboard();
    else if (st.view === 'model') c.innerHTML = viewModel();
    else if (st.view === 'browser') c.innerHTML = viewBrowser();
    else if (st.view === 'board') c.innerHTML = viewBoard();
    else if (st.view === 'capload') c.innerHTML = viewCapLoad();
    else if (st.view === 'kitrate') c.innerHTML = viewKitRate();
    else if (st.view === 'insight') { viewInsight(); syncUrl(); return; }
    else if (st.view === 'guide') c.innerHTML = viewGuide();
    else if (st.view === 'flow') c.innerHTML = viewFlow();
    else if (st.view === 'uns') c.innerHTML = viewUns();
    else if (st.view === 'batch') c.innerHTML = viewBatch();
    else if (st.view === 'gantt') c.innerHTML = viewGantt();
    /* 三个核心域的计算工作台（进入即算，替代原先「应用工具」里的集中式工作台） */
    else if (st.view === 'mrp') c.innerHTML = viewMrp();
    else if (st.view === 'kit') c.innerHTML = viewKit();
    else if (st.view === 'sched') c.innerHTML = viewSched();
    else if (st.view === 'er') c.innerHTML = viewEr();
    bindView();
    syncUrl();
  }

  /* 总览 */
  function viewDashboard() {
    var totalTables = Object.keys(S.TABLES).length, totalRows = 0;
    Object.keys(S.TABLES).forEach(function (t) { totalRows += rows(t).length; });
    var tasks = rows('SCH_TASK').length;
    var vt = 0; rows('SCH_TASK').forEach(function (r) { vt += (+r.CHANGE_MIN || 0); });
    var kit = rptKitRate(); var avgKit = 0;
    if (kit.length) { var ks = kit.reduce(function (a, r) { return a + (+r.KIT_RATE || 0); }, 0); avgKit = (ks / kit.length * 100).toFixed(1); }
    var kpis = '<div class="kpis">' +
      kpi(totalTables, '数据表（' + Object.keys(S.DOMAINS).length + ' 业务域 / ' + totalTables + ' 张）') + kpi(totalRows, '业务记录总数') +
      kpi(Object.keys(S.MASTER_DETAIL).length, '主子表关联') + kpi(tasks + ' / ' + avgKit + '%', '排程任务数 / 平均齐套率') + '</div>';
    var dom = '<div class="domgrid">';
    S.DOMAINS.forEach(function (d) {
      var cnt = 0; d.modules.forEach(function (m) { m.tables.forEach(function (t) { if (S.TABLES[t]) cnt += rows(t).length; }); });
      dom += '<div class="domcard"><div class="dn"><span class="layer-dot" style="background:'+domColor(d.code)+'"></span>'+esc(d.name)+'</div><div class="dd">'+esc(d.desc)+'</div>';
      d.modules.forEach(function (m) { var mc = 0; m.tables.forEach(function (t) { if (S.TABLES[t]) mc += rows(t).length; }); dom += '<div class="modrow"><span>'+esc(m.name)+'</span><span>'+mc+' 条</span></div>'; });
      dom += '</div>';
    });
    dom += '</div>';
    return '<div class="card"><h2>系统总览</h2>' + kpis + '</div>' +
      '<div class="card"><h2>业务域分布</h2>' + dom +
      '<p class="mini">提示：左侧「计划基础数据」为第一层，逐级展开各功能域与表；带「主」标记的表支持主子表联动——点开一条主表记录即可查看其下明细（如 需求源→需求明细、需求计算版本→净需求、齐套检查→缺料明细、排程版本→排程任务）。三个核心域（<b>物料需求计算 / 物料齐套计算 / 生产排程</b>）的第一项就是<b>计算工作台</b>——进入即算，域内下表是计算结果明细。左侧「<b>计划看板 → 计划驾驶舱</b>」为每次刷新默认落地的实时状态视图，「<b>计划看板 → 排产甘特图</b>」按订单 / 工序 / 机台查看排程。</p></div>';
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
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(fcode)) { toast('编码须以字母开头，仅含字母/数字/下划线'); return; }
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
    var c = document.getElementById('content'); c.innerHTML = viewBrowser(); bindView();
  }

  /* 计算结果表 → 产出它的工作台名称（列表空态与说明文案用；按导航分组反查，不依赖 module 字段，
     因为齐套两表的 module 仍写作「物料需求计算」，与导航域「物料齐套计算」不一致） */
  function benchNameOf(table) {
    var g = (S.GROUPS || []).filter(function (x) { return (x.tables || []).indexOf(table) >= 0; })[0];
    var name = g ? g.name : '';
    if (name === '生产排程') return '排程工作台';
    if (name === '物料齐套计算') return '齐套计算工作台';
    if (name === '物料需求计算') return 'MRP 计算工作台';
    return '计算工作台';
  }

  function viewBrowser() {
    if (!st.table) st.table = firstTable();
    var def = S.TABLES[st.table];
    var isRpt = isReportTable(st.table);
    var children = isRpt ? [] : (S.MASTER_DETAIL[st.table] || []);
    var isMaster = children.length > 0;
    var all = rows(st.table);
    var q = (st.search || '').trim();
    st.sel = st.sel || {}; if (!st.sel[st.table]) st.sel[st.table] = {};
    var selSet = st.sel[st.table];
    var selCount = Object.keys(selSet).length;
    var list = applyQuery(all, st.table, q);

    var tag = isMaster ? '<span class="tag ok" style="margin-left:6px">主表 · 含子表明细</span>' : (def.detail ? '<span class="tag warn" style="margin-left:6px">子表</span>' : '');
    if (isRpt) tag += '<span class="tag" style="margin-left:6px">报表分析 · 只读</span>';
    if (def.calc) tag += '<span class="tag" style="margin-left:6px">计算结果 · 系统写入</span>';
    var selTxt = selCount ? '，已选 ' + selCount + ' 条 <button class="link sm" id="btnClearSel">清除</button>' : '';
    var h = '<div class="card"><h2>' + esc(def.label) + tag + ' <span class="mini">' + st.table + '</span></h2>';
    h += '<div class="toolbar">' +
      '<input id="search" class="q" placeholder="模糊查询（多字段用 ; 隔开，如 物料:M001;环节:采购入库）" title="支持多字段组合查询，用英文分号 ; 隔开，例如：物料:M001;环节:采购入库" value="' + esc(st.search) + '"/>' +
      '<button class="primary sm" id="btnQuery">查询</button>' +
      '<span class="mini">共 ' + all.length + ' 条' + (q ? '，筛选 ' + list.length + ' 条' : '') + '<span id="selHint">' + selTxt + '</span></span>' +
      '<span class="spacer"></span>';
    if (isRpt) {
      /* 报表分析：表内数据由业务数据实时汇总，只保留「查询 / 导出」 */
      h += '<button class="ghost sm" id="btnExport">导出</button>';
    } else {
      h += '<button class="ghost sm" id="btnFlow">计算派生</button>' +
        '<button class="ghost sm" id="btnModel">字段定义</button>' +
        '<button class="ghost sm" id="btnCols">显示字段</button>' +
        /* 计算结果表（schema 的 calc:true）不提供「新增」，也不提供「导入」——数据由计算工作台写入 */
        (def.calc ? '' : '<button class="ghost sm" id="btnImport">导入</button>') +
        '<button class="ghost sm" id="btnExport">导出</button>' +
        '<button class="ghost sm" id="btnPrint">打印</button>' +
        /* 计算结果表（schema 的 calc:true）由系统写入，无人工审核概念：不提供「审核」，也不展示审核字段 */
        (def.calc ? '' : '<button class="ghost sm" id="btnAudit">审核</button>') +
        /* 需求源 / 销售订单(引用) 两处都提供：多选销售订单 → 合并生成一张需求源单 */
        ((st.table === 'BAS_DEMAND' || st.table === 'RF_SO') ? '<button class="ghost sm" id="btnFromSo" title="多选销售订单，合并生成一张需求源单">从销售订单生成</button>' : '') +
        '<button class="danger sm" id="btnDelSel" title="删除已勾选的记录（主表会连同子表明细一起删除）">删除</button>' +
        /* 计算结果表（schema 的 calc:true）不提供「新增」——数据由计算工作台写入 */
        (def.calc ? '' : '<button class="primary" id="btnAdd">+ 新增</button>');
    }
    h += '</div>';
    if (isRpt) {
      h += '<p class="mini" style="margin:-4px 0 12px">报表分析为只读视图：数据由「需求源 / 净需求 / 齐套检查 / 排程任务 / 计划建议」等业务表<b>实时汇总</b>，上游任何新增或修改都会自动反映到这里，因此本页只提供「查询 / 导出」。</p>';
    } else if (def.calc) {
      /* 计算结果表：由对应计算工作台自动写入，不提供「新增 / 导入 / 审核」（查询 / 导出 / 编辑 / 删除仍可用） */
      h += '<p class="mini" style="margin:-4px 0 12px">本表是<b>计算结果</b>：由「<b>' + benchNameOf(st.table) + '</b>」运行后自动写入，因此不提供「<b>新增</b>」「<b>导入</b>」与「<b>审核</b>」（系统写入的数据没有人工审核环节，故也不展示审核状态 / 审核人 / 审核时间）。要重新出数请回工作台重跑计算；已生成的记录可正常<b>查询 / 导出 / 编辑 / 删除</b>。</p>';
    } else if (st.table === 'BAS_DEMAND') {
      /* 需求源：把两条创建路径直接写在页面上，避免「不知道怎么建」 */
      h += '<p class="mini" style="margin:-4px 0 12px">新建需求源有两条路：① <b>「从销售订单生成」</b>（工具栏按钮）——多选 supOS UNS 里已有的销售订单行，一条订单行生成一条需求明细，最快；② <b>点「+ 新增」手工建单</b>——先填<b>需求单号</b>与<b>需求来源</b>，再在表单下方「需求明细」区逐行添加，品号候选会按所选来源自动收窄，并自动带出<b>来源单据号 / 需求日期 / 需求数量</b>。</p>';
    }

    if (list.length === 0) {
      var emptyTxt = isRpt ? '当前无汇总数据（上游暂无相关业务记录）。'
        : (def.calc ? '暂无数据：本表由计算自动写入，请到「' + benchNameOf(st.table) + '」运行一次计算。'
          : '暂无数据，点击「新增」创建记录。');
      h += '<div class="empty">' + emptyTxt + '</div></div>'; return h;
    }

    /* 主键单元格：可点击直接打开编辑表单（无需单独的「编辑」按钮） */
    function pkCell(r, c) {
      var v = cellValue(r, c, st.table);
      if (isRpt) return v;   // 报表只读，不做可点
      return '<button class="linkcell" data-edit="' + esc(r.ID) + '" title="点击编辑">' + v + '</button>';
    }
    if (isMaster) {
      // 主表网格（点击单号/主键列打开编辑表单；子表明细列可点开单据详情）
      h += '<div class="mini" style="margin-bottom:8px">点击<b>单号</b>列可直接编辑该记录；点击「子表明细」列可打开单据详情（主表信息 + 子表明细）。删除用工具栏「删除」（先勾选要删的记录）。</div>';
      h += '<div class="tbl-wrap"><table class="grid"><thead><tr><th class="chkcol"><input type="checkbox" id="chkAll" title="全选 / 取消全选当前筛选结果"></th>';
      var mc = displayCols(st.table);
      mc.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      h += '<th>子表明细</th></tr></thead><tbody>';
      list.forEach(function (r) {
        var checked = selSet[r.ID] ? ' checked' : '';
        h += '<tr class="master-row">';
        h += '<td class="chkcol"><input type="checkbox" class="rowchk" data-id="' + esc(r.ID) + '"' + checked + '></td>';
        mc.forEach(function (c) { h += '<td class="' + (c.code === def.pk ? 'pk' : '') + '">' + (c.code === def.pk ? pkCell(r, c) : cellValue(r, c, st.table)) + '</td>'; });
        var badges = children.map(function (d) {
          var n = rows(d.table).filter(function (x) { return String(x[d.fk]) === String(r[d.fk]); }).length;
          return '<span class="badge-line">' + esc(S.TABLES[d.table].label) + ' ' + n + '</span>';
        }).join('');
        h += '<td><span class="doctap" data-doc="' + esc(r.ID) + '">' + badges + ' 打开 →</span></td></tr>';
      });
      h += '</tbody></table></div>';
    } else {
      // 普通 / 子表 / 报表：扁平网格（报表无操作列）
      h += '<div class="tbl-wrap"><table class="grid"><thead><tr><th class="chkcol"><input type="checkbox" id="chkAll" title="全选 / 取消全选当前筛选结果"></th>';
      var dc = displayCols(st.table);
      dc.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      if (!isRpt && barcodeColOf(st.table)) h += '<th>操作</th>';
      h += '</tr></thead><tbody>';
      list.forEach(function (r) {
        var checked = selSet[r.ID] ? ' checked' : '';
        h += '<tr>';
        h += '<td class="chkcol"><input type="checkbox" class="rowchk" data-id="' + esc(r.ID) + '"' + checked + '></td>';
        dc.forEach(function (c) { h += '<td class="' + (c.code === def.pk ? 'pk' : '') + '">' + (c.code === def.pk ? pkCell(r, c) : cellValue(r, c, st.table)) + '</td>'; });
        if (!isRpt && barcodeColOf(st.table)) h += '<td><button class="ghost sm" data-qrrow="' + esc(r.ID) + '" title="查看条码 / 二维码并追溯">条码</button></td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
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
      /* 计算结果子表（净需求 / 缺料明细 / 排程任务）不提供「导入明细」与「+ 新增明细」 */
      (cdef.calc ? '' : '<button class="ghost sm" data-impchild="' + ctab + '">导入明细</button>' +
        '<button class="ghost sm" data-addchild="' + ctab + '">+ 新增明细</button>') + '</div>';
    if (lines.length === 0) { h += '<div class="empty sm">' + (cdef.calc ? '暂无' + esc(cdef.label) + '（由计算自动写入）。' : '暂无明细，点击「新增明细」添加' + esc(cdef.label) + '。') + '</div>'; }
    else {
      h += '<div class="tbl-wrap"><table class="grid sm"><thead><tr>';
      cols.forEach(function (c) { h += '<th>' + esc(c.label) + '</th>'; });
      h += '<th>操作</th></tr></thead><tbody>';
      lines.forEach(function (r) {
        h += '<tr>'; cols.forEach(function (c) { h += '<td' + (c.code === cdef.pk ? ' class="pk"' : '') + '>' + cellValue(r, c, ctab) + '</td>'; });
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
      var bfs = document.getElementById('btnFromSo'); if (bfs) bfs.onclick = function () { openSoPicker(); };
      var bm = document.getElementById('btnModel'); if (bm) bm.onclick = function () { gotoView('model'); };
      /* 「计算派生」与本表「使用说明」绑定（来源 / 派生 + 如何操作），不再跳「核心流程」 */
      var bf = document.getElementById('btnFlow'); if (bf) bf.onclick = function () { st.view = 'guide'; setNav(); render(); };
      var bi = document.getElementById('btnImport'); if (bi) bi.onclick = function () { openImport(st.table); };
      var bx = document.getElementById('btnExport'); if (bx) bx.onclick = function () { exportCsv(st.table, selCount); };
      var bp = document.getElementById('btnPrint'); if (bp) bp.onclick = function () { doPrint(st.table, selCount); };
      var bu = document.getElementById('btnAudit'); if (bu) bu.onclick = function () { openAudit(st.table, null); };
      var bc = document.getElementById('btnCols'); if (bc) bc.onclick = function () { openColVis(st.table); };
      var bclr = document.getElementById('btnClearSel'); if (bclr) bclr.onclick = function () { st.sel[st.table] = {}; render(); };
      var chkAll = document.getElementById('chkAll');
      /* 勾选框状态：表头「全选」反映当前筛选结果是否已全部勾选（含半选态） */
      var rowBoxes = Array.prototype.slice.call(document.querySelectorAll('.rowchk'));
      if (chkAll) {
        var onCount = rowBoxes.filter(function (cb) { return cb.checked; }).length;
        chkAll.checked = rowBoxes.length > 0 && onCount === rowBoxes.length;
        chkAll.indeterminate = onCount > 0 && onCount < rowBoxes.length;
        /* 点击表头：一次性把「当前筛选结果」全部勾选 / 全部取消（不再重新渲染，避免勾选态丢失） */
        chkAll.onchange = function () {
          var next = chkAll.checked;
          rowBoxes.forEach(function (cb) {
            cb.checked = next;
            var id = cb.getAttribute('data-id');
            if (next) selSet[id] = true; else delete selSet[id];
          });
          updateSelHint();
        };
      }
      document.querySelectorAll('.rowchk').forEach(function (cb) {
        cb.onclick = function (e) { e.stopPropagation(); };
        cb.onchange = function () {
          var id = cb.getAttribute('data-id');
          if (cb.checked) selSet[id] = true; else delete selSet[id];
          /* 只更新表头状态与选中计数，不整页 render（否则勾选态闪烁 / 丢失） */
          if (chkAll) {
            var on = rowBoxes.filter(function (x) { return x.checked; }).length;
            chkAll.checked = rowBoxes.length > 0 && on === rowBoxes.length;
            chkAll.indeterminate = on > 0 && on < rowBoxes.length;
          }
          updateSelHint();
        };
      });
      /* 选中计数提示（工具栏里的「已选 N 条 / 清除」）——不重渲染，仅就地更新文本 */
      function updateSelHint() {
        var n = Object.keys(selSet).filter(function (k) { return selSet[k]; }).length;
        var box = document.getElementById('selHint');
        if (!box) return;
        box.innerHTML = n ? ('，已选 ' + n + ' 条 <button class="link sm" id="btnClearSel">清除</button>') : '';
        var clr = document.getElementById('btnClearSel');
        if (clr) clr.onclick = function () {
          st.sel[st.table] = {};
          rowBoxes.forEach(function (cb) { cb.checked = false; });
          if (chkAll) { chkAll.checked = false; chkAll.indeterminate = false; }
          updateSelHint();
        };
      }
      /* 主表行：整行不触发动作；只有「单号/主键」列（data-edit）与「打开」列（.doctap）可点 */
      document.querySelectorAll('.doctap[data-doc]').forEach(function (el) {
        el.onclick = function (e) { e.stopPropagation(); openDoc(st.table, el.getAttribute('data-doc')); };
      });
      document.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openForm(st.table, b.getAttribute('data-edit'), null); }; });
      /* 删除：删除当前表格中所有已勾选的记录（主表连带子表明细一起软删除） */
      var bds = document.getElementById('btnDelSel');
      if (bds) bds.onclick = function () {
        var ids = Object.keys(selSet).filter(function (k) { return selSet[k]; });
        if (!ids.length) { toast('请先勾选要删除的记录'); return; }
        var kids = (S.MASTER_DETAIL[st.table] || []).length;
        if (!confirm('确认删除已勾选的 ' + ids.length + ' 条记录？' + (kids ? '主表记录的子表明细将一并删除（软删除）。' : '（软删除）'))) return;
        var total = 0;
        ids.forEach(function (id) { total += removeWithChildren(st.table, id); delete selSet[id]; });
        toast('已删除 ' + ids.length + ' 条' + (kids ? '（连带明细 ' + total + ' 条）' : ''));
        render();
      };
      document.querySelectorAll('[data-qrrow]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openBarcode(st.table, b.getAttribute('data-qrrow')); }; });
      updateSelHint();
    }
    if (st.view === 'flow') bindFlow();
    if (st.view === 'board' || st.view === 'capload' || st.view === 'kitrate') bindBoard();
    /* 产能负荷看板的「排程版本」选择器（与甘特图 / 排程工作台的版本下拉各自独立） */
    if (st.view === 'capload') {
      var capSel = document.getElementById('capVer');
      if (capSel) capSel.onchange = function () { st.capVer = capSel.value; render(); };
    }
    if (st.view === 'gantt') bindGantt();
    if (st.view === 'mrp') bindMrp();
    if (st.view === 'kit') bindKit();
    if (st.view === 'sched') bindSched();
  }
  /* 三个计算工作台的就地交互（运行按钮走全局事件委托，此处只管下拉 / 勾选联动） */
  function bindMrp() {
    var all = document.getElementById('mrpAll');
    function boxes() { return Array.prototype.slice.call(document.querySelectorAll('.mrpdem')); }
    function sum() {
      var sel = boxes().filter(function (cb) { return cb.checked; });
      var lines = sel.reduce(function (a, cb) { return a + (+cb.getAttribute('data-lines') || 0); }, 0);
      var el = document.getElementById('mrpSum');
      if (el) el.textContent = '已选 ' + sel.length + ' 张 / 明细 ' + lines + ' 行';
      if (all) { all.checked = sel.length === boxes().length && boxes().length > 0; all.indeterminate = sel.length > 0 && sel.length < boxes().length; }
    }
    boxes().forEach(function (cb) { cb.onchange = sum; });
    if (all) all.onchange = function () { boxes().forEach(function (cb) { cb.checked = all.checked; }); sum(); };
    sum();
    var rs = document.getElementById('mrpRule');
    if (rs) rs.onchange = function () { st.mrpRule = rs.value; };
  }
  function bindKit() {
    /* 版本下拉在「运行齐套检查」时读取，无需即时联动 */
  }
  function bindSched() {
    /* 甘特三视角切换（与「计划看板 → 排产甘特图」共享 st.ganttMode） */
    document.querySelectorAll('#content [data-gm]').forEach(function (b) {
      b.onclick = function () { st.ganttMode = b.getAttribute('data-gm'); render(); };
    });
    var rs = document.getElementById('schedRule');
    if (rs) rs.onchange = function () { st.schedRule = rs.value; };
    var sv = document.getElementById('schedVer');
    if (sv) sv.onchange = function () { st.schedVer = sv.value; render(); };
  }

  /* ---------- 表单弹窗 ---------- */
  function toLocalDT(v) { if (!v) return ''; return String(v).replace(' ', 'T').slice(0, 16); }
  function fromLocalDT(v) { if (!v) return ''; return v.replace('T', ' ') + ':00'; }
  function inputHtml(col, val) {
    var name = 'f_' + col.code; var v = val == null ? '' : val;
    if (col.ref) return '<select id="' + name + '">' + refOptions(col.ref, v, demandRefOpt(lineRefCtx.formTable, col.code)) + '</select>';
    if (col.dict) return '<select id="' + name + '">' + dictOptions(col.dict, v) + '</select>';
    if (col.sel) return '<select id="' + name + '">' + (function () {
      var o = '<option value="">— 选择 —</option>';
      col.sel.forEach(function (x) { o += '<option value="' + esc(x) + '"' + (String(x) === String(v) ? ' selected' : '') + '>' + esc(x) + '</option>'; });
      return o;
    })() + '</select>';
    if (col.type === 'b') return '<input type="checkbox" id="' + name + '" ' + (v ? 'checked' : '') + '" style="width:auto"/>';
    if (col.type === 'x') return '<textarea id="' + name + '">' + esc(v) + '</textarea>';
    if (col.type === 'j') return '<textarea id="' + name + '" placeholder="JSON">' + esc(typeof v === 'object' ? JSON.stringify(v) : v) + '</textarea>';
    if (col.type === 'da') return '<input type="date" id="' + name + '" value="' + esc(v) + '"/>';
    if (col.type === 'dt') return '<input type="datetime-local" id="' + name + '" value="' + esc(toLocalDT(v)) + '"/>';
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
  /* 行编辑器字段数：默认 7 列，表级 lineCols 可放宽（如需求明细 8 列，保证「来源单据号」不被截断） */
  function editCols(ct) {
    var fks = fkColsOf(ct);
    var def = S.TABLES[ct];
    var cs = S.columnsOf(ct).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); });
    var head = [];
    if (def.pk && def.pk !== 'ID' && fks.indexOf(def.pk) < 0) head.push(cs.find(function (c) { return c.code === def.pk; }));
    cs.forEach(function (c) { if (head.indexOf(c) < 0 && fks.indexOf(c.code) < 0) head.push(c); });
    return head.filter(Boolean).slice(0, def.lineCols || 7);
  }
  function lineInput(ct, i, c, v) {
    var attr = ' data-cell="' + ct + '|' + i + '|' + c.code + '"';
    var cls = 'cell-in' + (/QTY|QUANTITY|PRICE|AMOUNT|RATE/.test(c.code) ? ' num' : '');
    if (c.ref) return '<select class="' + cls + '"' + attr + '>' + refOptions(c.ref, v, demandRefOpt(ct, c.code)) + '</select>';
    if (c.dict) return '<select class="' + cls + '"' + attr + '>' + dictOptions(c.dict, v) + '</select>';
    if (c.type === 'b') return '<input type="checkbox"' + attr + (v ? ' checked' : '') + '/>';
    if (c.type === 'da') return '<input type="date" class="' + cls + '"' + attr + ' value="' + esc(v) + '"/>';
    if (c.type === 'dt') return '<input type="datetime-local" class="' + cls + '"' + attr + ' value="' + esc(toLocalDT(v)) + '"/>';
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

  /* ctx: 可选的上下文（如从单据详情「新增明细」进入时，带入父单的 { sourceType }），不写入数据 */
  function openForm(t, id, preset, ctx) {
    var def = S.TABLES[t]; var row = id ? find(t, id) : null;
    var fromDoc = st.doc; st.doc = null; // 若从单据详情进入，保存后回到详情
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

    /* 当前「需求来源」：新建取预设值 / 编辑取已存值 / 子表明细取父单带入值。
     * 它决定明细「品号」候选范围与「来源单据号 / 需求日期 / 需求数量」的自动带出。 */
    var formSrc = (row && row.SOURCE_TYPE) || (preset && preset.SOURCE_TYPE) || (ctx && ctx.sourceType) || '';
    var formPool = demandPool(formSrc);
    lineRefCtx.formTable = t;
    lineRefCtx.table = DEMAND_TARGET.table || '';
    lineRefCtx.itemCol = DEMAND_TARGET.itemCol || '';
    lineRefCtx.src = formSrc;
    lineRefCtx.pool = formPool;

    var body = '<div class="fgrid">';
    cols.forEach(function (c) {
      var full = (c.type === 'x' || c.type === 'j');
      var v = row ? row[c.code] : (preset && preset[c.code] != null ? preset[c.code] : '');
      body += '<div class="fitem' + (full ? ' full' : '') + '"><label>' + esc(c.label) + (c.req ? ' <span class="req">*</span>' : '') + '</label>' + inputHtml(c, v) + '</div>';
    });
    body += '</div>';
    if (t === DEMAND_TARGET.table) body += linesHint();   // 独立「需求明细」表单也提示来源约束
    if (barcodeColOf(t) && !preset) body += '<div class="detail-panel bc-panel" id="bcPreview" style="margin-top:14px"></div>';
    if (isMaster) body += '<div id="linesArea">' + linesHint() + linesHtml(children, lineData) + '</div>';
    /* 注意：「计算派生关系」面板（tableFlowPanel）只在「单据详情」与「使用说明」中出现，
       编辑 / 新增表单里不再展示该框（保持表单简洁）。 */

    document.getElementById('modal').classList.toggle('wide', isMaster);
    document.getElementById('modalTitle').textContent = (row ? '编辑' : '新增') + def.label;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalMask').style.display = 'flex';

    /* 明细区顶部的「需求来源约束」提示：把当前来源对应的品号池与带出规则讲清楚 */
    function linesHint() {
      var isTarget = DEMAND_TARGET.table && (t === DEMAND_TARGET.table || children.some(function (d) { return d.table === DEMAND_TARGET.table; }));
      if (!isTarget) return '';
      var txt, d = demandSourceDef(formSrc);
      if (!formSrc) txt = '尚未选择「需求来源」。选择后，下方明细的「品号」候选会自动收窄到该来源的可用数据，并自动带出「来源单据号」。';
      else if (!d) txt = '「' + formSrc + '」未在数据源中定义，明细品号不做限制。';
      else if (!lineRefCtx.pool) txt = '来源「' + formSrc + '」：' + d.desc + '。选中品号后会自动带出「来源单据号」。';
      else txt = '来源「' + formSrc + '」：品号候选已收窄为 ' + Object.keys(lineRefCtx.pool).length + ' 项 —— ' + d.desc + '。选中品号后自动带出「品名 / 来源单据号 / 需求日期 / 需求数量」。';
      return '<div class="detail-panel src-hint"><div class="dp-head"><span class="dp-title">需求来源约束</span>' +
        '<span class="mini">' + esc(txt) + '</span></div></div>';
    }
    function refreshLines() { var a = document.getElementById('linesArea'); if (a) { a.innerHTML = linesHint() + linesHtml(children, lineData); bindLines(); } }
    /* 行内联动：选定「品号」后带出品名 / 来源单据号 / 需求日期 / 需求数量（只填空值，不覆盖已填内容） */
    function autoFillLine(ct, i) {
      var ln = lineData[ct][i]; if (!ln || !ln.ITEM_NO) return;
      var codes = S.columnsOf(ct).map(function (c) { return c.code; });
      var has = function (c) { return codes.indexOf(c) >= 0; };
      if (has('ITEM_NAME')) {
        var it = rows('RF_ITEM').find(function (r) { return String(r.ITEM_NO) === String(ln.ITEM_NO); });
        if (it && it.ITEM_NAME) ln.ITEM_NAME = it.ITEM_NAME;
      }
      var info = lineRefCtx.pool ? lineRefCtx.pool[ln.ITEM_NO] : null;
      /* 来源单据号：有来源表取来源单号；无来源表（库存补充/预测/叫料）按规则自动生成，避免留空 */
      var docNo = (info && info.doc) || autoSourceDocNo(formSrc);
      if (has('SRC_DOC_NO') && docNo) ln.SRC_DOC_NO = docNo;
      if (has('REQ_DATE') && !ln.REQ_DATE) ln.REQ_DATE = (info && info.date) || today();
      if (has('DEMAND_QTY') && !(+ln.DEMAND_QTY > 0) && info && info.qty > 0) ln.DEMAND_QTY = info.qty;
    }
    /* 行内公式（schema 的 LINE_CALC）：冲减后需求 = 需求数量 − 预测冲减量 */
    function calcLine(ct, i, srcCode) {
      var f = (S.LINE_CALC || {})[ct]; if (!f) return;
      var ln = lineData[ct][i]; if (!ln) return;
      Object.keys(f).forEach(function (target) {
        var rule = f[target]; if (!rule || !rule.minus || rule.minus.indexOf(srcCode) < 0) return;
        var v = rule.minus.reduce(function (acc, code, k) { return k === 0 ? (+ln[code] || 0) : acc - (+ln[code] || 0); }, 0);
        if (rule.min != null) v = Math.max(rule.min, v);
        ln[target] = +v.toFixed(4);
      });
    }
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
          calcLine(ct, i, code);
          /* 改品号 → 自动带出联动字段并整行重绘（下拉已失焦，不会打断输入） */
          if (code === DEMAND_TARGET.itemCol && ct === DEMAND_TARGET.table) { autoFillLine(ct, i); refreshLines(); return; }
        };
        inp.onchange = inp.oninput;
      });
    }
    bindLines();

    /* 单表表单联动：从「单据详情 → 新增明细」进入需求明细时，选品号同样自动带出从属字段 */
    (function bindSingleLine() {
      if (t !== DEMAND_TARGET.table) return;
      var gi = function (code) { return document.getElementById('f_' + code); };
      var itemI = gi(DEMAND_TARGET.itemCol), nameI = gi('ITEM_NAME'), docI = gi('SRC_DOC_NO');
      var dateI = gi('REQ_DATE'), qtyI = gi('DEMAND_QTY');
      if (!itemI) return;
      function follow() {
        var itemNo = itemI.value; if (!itemNo) return;
        if (nameI && !nameI.value) {
          var it = rows('RF_ITEM').find(function (r) { return String(r.ITEM_NO) === String(itemNo); });
          if (it && it.ITEM_NAME) nameI.value = it.ITEM_NAME;
        }
        var info = lineRefCtx.pool ? lineRefCtx.pool[itemNo] : null;
        var docNo = (info && info.doc) || autoSourceDocNo(lineRefCtx.src);
        if (docI && !docI.value && docNo) docI.value = docNo;
        if (dateI && !dateI.value) dateI.value = (info && info.date) || today();
        if (qtyI && !(+qtyI.value > 0) && info && info.qty > 0) qtyI.value = info.qty;
      }
      itemI.onchange = follow;
      if (qtyI) qtyI.onchange = follow;
    })();

    /* 「需求来源」变化 → 明细品号候选立刻按新来源收窄 / 放开（已选品号会保留并标注「不在当前来源范围内」） */
    (function bindSourceType() {
      var sel = document.getElementById('f_SOURCE_TYPE');
      if (!sel || !DEMAND_TARGET.table) return;
      sel.onchange = function () {
        var nv = sel.value;
        if (nv === formSrc) return;
        formSrc = nv;
        lineRefCtx.src = nv;
        lineRefCtx.pool = demandPool(nv);
        refreshLines();
      };
    })();

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

    document.getElementById('modalSave').onclick = function () {
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
      var rec = row ? update(t, id, merged) : insert(t, merged);
      /* 保存子表明细：旧行软删除，再按编辑器内容重建 */
      var savedLines = 0;
      children.forEach(function (d) {
        rows(d.table).filter(function (r) { return String(r[d.fk]) === String(rec[d.fk]); }).forEach(function (r) { r.DEL_FLAG = 1; r.UPDATE_TIME = now(); if (window.APS_API) window.APS_API.enqueue(d.table, 'delete', r); });
        (lineData[d.table] || []).forEach(function (ln, i) {
          var ecs = editCols(d.table);
          if (ecs.every(function (c) { return ln[c.code] === undefined || ln[c.code] === ''; })) return;
          var lbiz = {};
          if (ln._id) { var orig = find(d.table, ln._id); if (orig) S.columnsOf(d.table).forEach(function (c) { if (!(c.sys && c.code !== 'REMARK')) lbiz[c.code] = orig[c.code]; }); }
          ecs.forEach(function (c) { lbiz[c.code] = ln[c.code]; });
          lbiz[d.fk] = rec[d.fk];
          if (lbiz.SEQ_NO === undefined || lbiz.SEQ_NO === '') lbiz.SEQ_NO = i + 1;
          lbiz._fromMaster = 1; // 标记来源（insert 会忽略未知键之外无影响）
          delete lbiz._fromMaster;
          insert(d.table, lbiz);
          savedLines++;
        });
      });
      save();
      /* 主表聚合回写：主表「来源单据号」= 其明细实际用到的来源单号，去重后按「；」拼接（不重复） */
      if (syncMasterAgg(t, rec)) save();
      /* 若保存的是别的聚合主表的子表（子表单独维护 / 单据详情内编辑明细），回查父单同步 */
      syncAggByChild(t, rec);
      closeModal();
      var m = isMaster ? '已保存（含明细 ' + savedLines + ' 行）' : '已保存';
      if ((S.MASTER_AGG || {})[t] && rec.SOURCE_NO !== undefined) m += ' · 来源单据号：' + (rec.SOURCE_NO || '（无）');
      toast(m);
      render();
      if (fromDoc) openDoc(fromDoc.t, fromDoc.id);
    };
  }
  /* ---------- 单据流转（FOC 业务流，单源可多向） ---------- */
  function genDocNo(t) {
    var p = { BAS_DEMAND: 'DEM', MRP_BATCH: 'MRP', MRP_NET_REQ: 'NR', MRP_KIT_CHECK: 'KIT', MRP_KIT_SHORT: 'SH', PR_SUGGEST: 'PR', PP_PLAN_SUGGEST: 'PS', SCH_VERSION: 'SCHV', SCH_TASK: 'T', SCH_DAY_PLAN: 'DP', SCH_ADJUST: 'ADJ', IF_CONFIG: 'IF', IF_RUN_LOG: 'IFLOG', BAS_MAINTENANCE: 'MT', BAS_CHANGEOVER: 'CV', BAS_CALENDAR: 'CAL' }[t] || t.split('_')[0];
    /* 单号不重复：若撞号则重新生成（对「主表单据号不要重复」的要求做兜底） */
    var def = S.TABLES[t] || {}, no = '';
    for (var i = 0; i < 60; i++) {
      no = p + '-' + ymd() + '-' + String(Math.floor(Math.random() * 900) + 100);
      if (!def.pk || !rows(t).some(function (r) { return String(r[def.pk]) === no; })) break;
    }
    return no;
  }
  function doFlow(srcT, srcId, tgtT) {
    var src = find(srcT, srcId); if (!src) return;
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
    var rec = insert(tgtT, biz);
    // 记录具体上下游关联（供单据详情/使用说明按单号定位）
    var _f = (S.FLOW[srcT] || []).find(function (x) { return x.to === tgtT; });
    var _label = _f ? _f.label : (S.TABLES[srcT].label + ' → ' + tdef.label);
    insert('SYS_DOC_LINK', { LINK_ID: uid('LINK'), FROM_TABLE: srcT, FROM_NO: src[S.TABLES[srcT].pk], TO_TABLE: tgtT, TO_NO: rec[tdef.pk], FLOW_LABEL: _label, LINK_TIME: now(), REMARK: '计算派生' });
    // 复制明细行
    var srcLinks = S.MASTER_DETAIL[srcT] || [];
    var tgtLinks = S.MASTER_DETAIL[tgtT] || [];
    if (srcLinks.length && tgtLinks.length) {
      var Ls = srcLinks[0].table, Lt = tgtLinks[0].table, sfk = srcLinks[0].fk, tfk = tgtLinks[0].fk;
      var srcLines = rows(Ls).filter(function (r) { return String(r[sfk]) === String(src[sfk]); });
      srcLines.forEach(function (ln, i) {
        var lbiz = {};
        S.columnsOf(Lt).forEach(function (c) {
          if (c.sys) return;
          if (ln[c.code] !== undefined && ln[c.code] !== '' && c.code !== S.TABLES[Lt].pk) lbiz[c.code] = ln[c.code];
        });
        lbiz[tfk] = rec[tfk];
        if (lbiz.SEQ_NO === undefined) lbiz.SEQ_NO = i + 1;
        insert(Lt, lbiz);
      });
    }
    update(tgtT, rec.ID, { REMARK: '由「' + S.TABLES[srcT].label + '」' + (src[S.TABLES[srcT].pk] || '') + ' 计算派生' });
    toast('已计算派生「' + tdef.label + '」' + rec[tdef.pk]);
    openDoc(tgtT, rec.ID);
  }

  /* ---------- 从销售订单批量生成需求源（多选 SO → 一张需求源单） ----------
   * 口径：销售订单来自 supOS UNS「MES制造管理系统/订单管理/销售订单明细」（只读，APS 不重建）；
   *   ① 按「销售订单号」勾选，可多选；
   *   ② 生成 1 张需求源单 BAS_DEMAND + 若干需求明细 BAS_DEMAND_LINE；
   *   ③ 需求数量取「未交数量」（无未交时退回订单数量），需求日期取「交期要求」；
   *   ④ 行级「来源单据号」= 对应销售订单号；表头「来源单据号」= 选中的全部单号（多条用「；」间隔）；
   *   ⑤ 登记 SYS_DOC_LINK，使需求源单据详情能一键回溯到销售订单。 */
  function soGroups() {
    var g = {};
    /* 与 schema DEMAND_SOURCE.销售订单 的 poolFilter 口径一致：仅取「未交数量 > 0」的订单行 */
    rows('RF_SO').forEach(function (r) {
      if (!r.SO_NO) return;
      if (soNeedQty(r) <= 0) return;
      (g[r.SO_NO] = g[r.SO_NO] || []).push(r);
    });
    return g;
  }
  function soNeedQty(l) {
    var q = (l.OPEN_QTY === undefined || l.OPEN_QTY === null || l.OPEN_QTY === '') ? l.ORDER_QTY : l.OPEN_QTY;
    return +q || 0;
  }
  function openSoPicker() {
    var gs = soGroups(), codes = Object.keys(gs).sort();
    if (!codes.length) { toast('未读到可用的销售订单行（UNS「MES制造管理系统/订单管理 → 销售订单明细」里「未交数量 > 0」的行为空）'); return; }
    /* 被隐藏的行（未交数量 <= 0）：用于向用户解释「为什么弹窗里的行数比销售订单总数少」 */
    var soAll = rows('RF_SO').filter(function (r) { return r.SO_NO; });
    var soShown = 0; codes.forEach(function (no) { soShown += gs[no].length; });
    var soHidden = soAll.filter(function (r) { return soNeedQty(r) <= 0; });
    var hiddenTxt = soHidden.length
      ? '<br><b>注意：</b>该来源共 <b>' + soAll.length + '</b> 行销售订单行，其中 <b>' + soHidden.length + ' 行「未交数量 = 0」</b>（已完工 / 已全部交付，不再构成需求）<b>已隐藏</b>，因此下面的勾选表只列出未交 &gt; 0 的行：' +
      esc(soHidden.map(function (r) { return r.SO_NO + ' 行' + (r.SEQ_NO || 1) + '（' + (r.ITEM_NAME || r.ITEM_NO || '') + '）'; }).join('、')) + '。'
      : '';
    var body = '<p class="mini">数据来自 supOS UNS「<b>MES制造管理系统 / 订单管理 → 销售订单明细</b>」<code>mes_sd_sales_order_line</code>（只读，APS 不复制、按需直读）。支持<b>多选</b>：可按<b>整单勾选</b>，也可展开订单<b>逐行勾选</b>；勾选后<b>品号 / 品名 / 需求数量 / 需求日期随之带出</b>，确认时系统会<b>合并生成一张需求源单</b>，每个选中行成为一条需求明细（行级「来源单据号」记录对应订单号）。需求数量默认取 <b>未交数量</b>（无未交时取订单数量），需求日期取 <b>交期</b>。' + hiddenTxt + '</p>';
    body += '<div class="toolbar" style="margin:4px 0 10px"><label class="mini" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="soAll" style="width:auto"/> 全选所有行</label><span class="spacer"></span><span class="mini" id="soSum">已选 0 行 / 需求合计 0</span></div>';
    body += '<div class="tbl-wrap"><table class="grid sm"><thead><tr><th class="chkcol" title="勾选该行">选</th><th>销售订单号</th><th>客户</th><th>行</th><th>品号</th><th>品名</th><th>未交数量</th><th>交期</th><th>状态</th></tr></thead><tbody>';
    codes.forEach(function (no) {
      var ls = gs[no];
      var cust = ls[0].CUSTOMER_CODE || '';
      ls.forEach(function (l, i) {
        var q = soNeedQty(l);
        body += '<tr>' +
          '<td class="chkcol"><input type="checkbox" class="soline" data-so="' + esc(no) + '" data-item="' + esc(l.ITEM_NO || '') + '" data-name="' + esc(l.ITEM_NAME || '') + '" data-qty="' + q + '" data-date="' + esc(l.DELIVERY_DATE || '') + '" data-seq="' + esc(l.SEQ_NO || (i + 1)) + '"/></td>' +
          /* 订单号每行都显示（避免「同一订单的后续行订单号留空 → 被误读成只有一条数据」）；整单复选框只在首行 */
          '<td class="pk">' + (i === 0 ? '<input type="checkbox" class="sohead" data-so="' + esc(no) + '" title="整单勾选/取消" style="width:auto;margin-right:6px"/>' : '') + esc(no) + '</td>' +
          '<td>' + (i === 0 ? esc(cust) : '') + '</td>' +
          '<td class="cellnum">' + esc(l.SEQ_NO || (i + 1)) + '</td>' +
          '<td>' + esc(l.ITEM_NO || '') + '</td><td>' + esc(l.ITEM_NAME || '') + '</td>' +
          '<td class="cellnum">' + q + '</td><td>' + esc(l.DELIVERY_DATE || '') + '</td>' +
          '<td>' + statusTag(l.STATUS) + '</td>' +
          '</tr>';
      });
    });
    body += '</tbody></table></div>';
    body += '<p class="mini">提示：① <b>每行都显示所属销售订单号</b>——同一张订单的多行会重复显示该订单号（整单勾选的复选框只出现在该订单的第一行）。② 勾选的订单行会<b>共用同一张需求源单</b>（表头「来源单据号」以「；」列出全部订单号）；若希望「一单对一单」，每次只勾一张订单的行即可。③ 生成的单据为「草稿」状态，可在需求源表单继续编辑。</p>';
    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '从销售订单生成需求源（可多选）';
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalMask').style.display = 'flex';
    var save = document.getElementById('modalSave');
    save.style.display = ''; save.textContent = '生成需求源单';
    /* 行复选框：可见，勾选即选中该订单行（品号/数量/交期随之带出） */
    function lineBoxes() { return Array.prototype.slice.call(document.querySelectorAll('.soline')); }
    function syncHeads() {
      document.querySelectorAll('.sohead').forEach(function (hd) {
        var no = hd.getAttribute('data-so');
        var arr = lineBoxes().filter(function (cb) { return cb.getAttribute('data-so') === no; });
        var on = arr.filter(function (cb) { return cb.checked; }).length;
        hd.checked = on === arr.length && arr.length > 0;
        hd.indeterminate = on > 0 && on < arr.length;
      });
    }
    function refreshSum() {
      var sel = lineBoxes().filter(function (cb) { return cb.checked; });
      var qty = sel.reduce(function (a, cb) { return a + (+cb.getAttribute('data-qty') || 0); }, 0);
      var el = document.getElementById('soSum');
      if (el) el.textContent = '已选 ' + sel.length + ' 行 / 需求合计 ' + qty;
    }
    lineBoxes().forEach(function (cb) { cb.onchange = function () { syncHeads(); refreshSum(); }; });
    /* 整单复选框：勾选/取消该订单的全部行 */
    document.querySelectorAll('.sohead').forEach(function (hd) {
      hd.onchange = function () {
        var no = hd.getAttribute('data-so'), next = hd.checked;
        lineBoxes().forEach(function (cb) { if (cb.getAttribute('data-so') === no) cb.checked = next; });
        syncHeads(); refreshSum();
      };
    });
    var all = document.getElementById('soAll');
    if (all) all.onchange = function () {
      lineBoxes().forEach(function (cb) { cb.checked = all.checked; });
      syncHeads(); refreshSum();
    };
    syncHeads(); refreshSum();
    save.onclick = function () {
      var picked = lineBoxes().filter(function (cb) { return cb.checked; }).map(function (cb) {
        return { SO_NO: cb.getAttribute('data-so'), SEQ_NO: cb.getAttribute('data-seq'), ITEM_NO: cb.getAttribute('data-item'), ITEM_NAME: cb.getAttribute('data-name'), QTY: +cb.getAttribute('data-qty') || 0, DATE: cb.getAttribute('data-date') };
      });
      if (!picked.length) { toast('请至少勾选一行销售订单'); return; }
      genDemandFromSoLines(picked);
      closeModal();
      document.getElementById('modalSave').textContent = '完成';
      render();
    };
  }
  function genDemandFromSoLines(picked) {
    var sos = picked.map(function (p) { return p.SO_NO; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var custs = [];
    rows('RF_SO').forEach(function (r) { if (r.CUSTOMER_CODE && custs.indexOf(r.CUSTOMER_CODE) < 0) custs.push(r.CUSTOMER_CODE); });
    var no = genDocNo('BAS_DEMAND');
    insert('BAS_DEMAND', {
      DEMAND_NO: no, DOC_NO: no, SOURCE_TYPE: '销售订单', SOURCE_NO: sos.join('；'),
      CUSTOMER_CODE: sos.length === 1 ? custOfSo(sos[0]) : '', PLAN_HORIZON: 60, FREEZE_FLAG: 0,
      DOC_DATE: today(), STATUS: '草稿', MAKER: 'OPER', MAKE_TIME: now(),
      REMARK: '由销售订单 ' + sos.join('、') + ' 生成'
    });
    picked.forEach(function (p, i) {
      insert('BAS_DEMAND_LINE', {
        DEMAND_NO: no, SEQ_NO: i + 1, ITEM_NO: p.ITEM_NO, ITEM_NAME: p.ITEM_NAME,
        DEMAND_QTY: p.QTY, REQ_DATE: p.DATE || today(),
        SRC_DOC_NO: p.SO_NO, LOCK_FLAG: 0, LINE_STATUS: '草稿'
      });
    });
    sos.forEach(function (s) {
      insert('SYS_DOC_LINK', { LINK_ID: uid('LINK'), FROM_TABLE: 'RF_SO', FROM_NO: s, TO_TABLE: 'BAS_DEMAND', TO_NO: no, FLOW_LABEL: '按销售订单生成需求源', LINK_TIME: now(), REMARK: '销售订单生成' });
    });
    toast('已按 ' + sos.length + ' 张销售订单生成需求源 ' + no + '（明细 ' + picked.length + ' 行）');
    st.table = 'BAS_DEMAND'; st.view = 'browser';
    var rec = rows('BAS_DEMAND').find(function (x) { return x.DEMAND_NO === no; });
    if (rec) setTimeout(function () { openDoc('BAS_DEMAND', rec.ID); }, 80);
  }
  function custOfSo(soNo) {
    var hit = rows('RF_SO').find(function (r) { return r.SO_NO === soNo; });
    return hit ? (hit.CUSTOMER_CODE || '') : '';
  }

  /* ---------- 业务流链（来源 / 当前 / 去向，按表动态生成） ---------- */
  function flowUpstream(t) {
    var ups = [];
    Object.keys(S.FLOW).forEach(function (src) {
      S.FLOW[src].forEach(function (f) { if (f.to === t) ups.push({ from: src, label: f.label }); });
    });
    /* 跨系统引用来源（如需求源 ← MES 销售订单 RF_SO）：只说明「从哪来」，不参与 FOC 自动流转 */
    ((S.TABLES[t] && S.TABLES[t].upRef) || []).forEach(function (src) {
      if (S.TABLES[src] && !ups.some(function (u) { return u.from === src; })) ups.push({ from: src, label: '引用生成' });
    });
    return ups;
  }

  /* 关联字段表：子表/下游表 → [{ col: 指向父单的字段, parent: 父表 }]。
     用途：① 从当前记录的字段反查「来源记录」；② 反向扫描找出「派生结果」。
     这样即便 SYS_DOC_LINK 台账里没有记录（如手工新建的单据），业务流也能自动串起来。 */
  var LINK_FIELDS = {
    BAS_DEMAND_LINE:   [{ col: 'DEMAND_NO', parent: 'BAS_DEMAND' }],
    BAS_MAINTENANCE:   [{ col: 'RES_NO', parent: 'BAS_RESOURCE' }],
    MRP_BATCH:         [{ col: 'RULE_NO', parent: 'SCH_RULE' }],
    MRP_NET_REQ:       [{ col: 'BATCH_NO', parent: 'MRP_BATCH' }],
    MRP_KIT_CHECK:     [{ col: 'BATCH_NO', parent: 'MRP_BATCH' }],
    MRP_KIT_SHORT:     [{ col: 'CHECK_NO', parent: 'MRP_KIT_CHECK' }],
    PR_SUGGEST:        [{ col: 'BATCH_NO', parent: 'MRP_BATCH' }],
    PP_PLAN_SUGGEST:   [{ col: 'BATCH_NO', parent: 'MRP_BATCH' }],
    SCH_VERSION:       [{ col: 'RULE_NO', parent: 'SCH_RULE' }],
    SCH_TASK:          [{ col: 'VERSION_NO', parent: 'SCH_VERSION' }],
    SCH_DAY_PLAN:      [{ col: 'VERSION_NO', parent: 'SCH_VERSION' }],
    SCH_ADJUST:        [{ col: 'VERSION_NO', parent: 'SCH_VERSION' }],
    SCH_EXCEPTION:     [{ col: 'VERSION_NO', parent: 'SCH_VERSION' }],
    IF_RUN_LOG:        [{ col: 'IF_CODE', parent: 'IF_CONFIG' }],
    RF_BOM:            [{ col: 'PARENT_ITEM', parent: 'RF_ITEM' }],
    RF_STOCK:          [{ col: 'ITEM_NO', parent: 'RF_ITEM' }]
  };
  /* 从当前记录字段反查来源记录（只认「父表主键」字段） */
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
  /* 反向扫描：找出所有字段指向当前单号的记录 → 派生结果（按表分组） */
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
    var h = '<div class="detail-panel flow-panel"><div class="dp-head"><span class="dp-title">计算派生关系 · ' + esc(def.label) + ' <code>' + esc(t) + '</code></span>' +
      '<span class="mini">来源（从哪算来）/ 派生（算出什么）/ 如何操作</span>' +
      '<span class="spacer"></span>' +
      '<button class="ghost sm" data-flownew="' + esc(t) + '">+ 新建 ' + esc(def.label) + '</button></div>';
    h += '<div class="flow-chain">';
    /* 来源 */
    h += '<div class="fc-col"><div class="fc-h">① 来源 · 从哪算来</div>';
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
      h += '<div class="fc-node muted">（暂无可追溯来源）</div>';
    }
    if (ups.length) h += '<div class="fc-hint">可来自：' + ups.map(function (u) { return esc(tblName(u.from)); }).join(' / ') + '</div>';
    else if (!id) h += '<div class="fc-node muted">根级单据，直接新建即可</div>';
    h += '</div>';
    h += '<div class="fc-arrow">↓</div>';
    /* 当前 */
    h += '<div class="fc-col"><div class="fc-h">② 当前 · ' + esc(def.label) + '</div><div class="fc-node cur">本表记录' + curTag + '</div></div>';
    h += '<div class="fc-arrow">↓</div>';
    /* 去向 */
    h += '<div class="fc-col"><div class="fc-h">③ 派生 · 算出什么</div>';
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
          '<div class="mini">' + (arr[0].ledger ? '计算派生结果' : '按字段关联') + '</div>' +
          '<button class="ghost sm" data-linkopen="' + esc(ct) + '|' + esc(arr[0].no) + '">打开关联单 →</button></div>';
      } else {
        var show = arr.slice(0, 8);
        h += '<div class="fc-node tgt linked"><b>' + esc(tblName(ct)) + '</b><div class="mini">共 ' + arr.length + ' 条（计算派生 + 按字段关联）</div>' +
          '<div class="link-chips">' + show.map(function (x) {
            return '<button class="ghost sm" data-linkopen="' + esc(ct) + '|' + esc(x.no) + '">' + esc(x.no) + ' →</button>';
          }).join('') + (arr.length > show.length ? '<span class="mini">…等 ' + arr.length + ' 条</span>' : '') + '</div></div>';
      }
    });
    if (!Object.keys(downBuckets).length && id) {
      h += '<div class="fc-node muted">（暂无派生结果）</div>';
    }
    if (downs.length) {
      h += '<div class="fc-hint">可执行的计算步骤：</div>';
      downs.forEach(function (f) {
        var dis = id ? '' : ' disabled title="请在数据浏览中打开具体记录后再执行"';
        h += '<div class="fc-node tgt"><b>' + esc(tblName(f.to)) + '</b><div class="mini">' + esc(f.label) + '</div>' +
          '<button class="primary sm" data-flowto="' + esc(f.to) + '" data-srct="' + esc(t) + '" data-srcid="' + esc(id || '') + '"' + dis + '>' + esc(f.label) + ' →</button></div>';
      });
    } else if (!id) {
      h += '<div class="fc-node muted">末端结果，无后续步骤</div>';
    }
    h += '</div>';
    h += '</div>';
    h += '<p class="mini" style="padding:2px 14px 12px">说明：' + (id ? '上方「关联单」为已实际算出的来源 / 派生记录，点击可直接定位打开；' : '打开具体记录后，此处会显示已算出的来源 / 派生单号并可定位；') + 'APS 以<b>需求计算版本</b>为核心：一次计算同时产出净需求 / 齐套 / 补料建议等<b>平级结果</b>，彼此不是 MES 那种「一张单转成另一张单」的单据链。总体逻辑见「使用说明 → 核心计算链」。</p>';
    h += '</div>';
    return h;
  }

  /* ---------- 单据详情弹窗（主表信息 + 子表明细，独立界面） ---------- */
  function openDoc(t, id) {
    var def = S.TABLES[t]; var row = find(t, id); if (!row) return;
    st.doc = { t: t, id: id };
    var children = S.MASTER_DETAIL[t] || [];
    var cols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK'); }).filter(function (c) { return colOn(t, c.code); });
    var body = '<div class="toolbar" style="margin-bottom:6px"><span class="tag ok">单据详情</span><span class="mini">' + esc(t) + '</span><span class="spacer"></span><button class="ghost sm" id="btnFlowJump">计算派生</button><button class="ghost sm" id="btnDocEdit">编辑单据</button></div>';
    body += '<div class="fgrid doc-grid">';
    cols.forEach(function (c) {
      body += '<div class="fitem doc-item"><label>' + esc(c.label) + '</label><div class="dval">' + cellValue(row, c, t) + '</div></div>';
    });
    body += '</div>';
    children.forEach(function (d) { body += childPanel(row, d); });
    // 条码 / 二维码（物料资料 · 工序工单）：扫码 + 追溯入口
    body += barcodePanel(t, row);
    // 计算派生区：来源（从哪算来）→ 当前 → 派生（算出什么）+ 如何操作
    body += tableFlowPanel(t, id);

    document.getElementById('modal').classList.add('wide');
    document.getElementById('modalTitle').textContent = def.label + ' · 单据详情';
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalSave').style.display = 'none';
    document.getElementById('modalCancel').textContent = '关 闭';
    document.getElementById('modalMask').style.display = 'flex';

    document.getElementById('btnDocEdit').onclick = function () { openForm(t, id, null); };
    document.getElementById('btnFlowJump').onclick = function () { closeModal(); st.view = 'guide'; setNav(); render(); };
    var mb = document.getElementById('modalBody');
    mb.querySelectorAll('[data-addchild]').forEach(function (b) {
      b.onclick = function () {
        var ctab = b.getAttribute('data-addchild');
        var link = children.find(function (d) { return d.table === ctab; });
        var preset = {}; preset[link.fk] = row[link.fk];
        /* 带入父单上下文：明细的「品号」候选同样受父单「需求来源」约束 */
        openForm(ctab, null, preset, { sourceType: row.SOURCE_TYPE });
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
      b.onclick = function (e) { e.stopPropagation(); var p = b.getAttribute('data-editc').split('|'); openForm(p[0], p[1], null); };
    });
    mb.querySelectorAll('[data-delc]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); var p = b.getAttribute('data-delc').split('|');
        if (!confirm('确认删除该明细（软删除）？')) return;
        remove(p[0], p[1]);
        /* 删掉明细后，主表「来源单据号」同步重算（去掉该行带来的来源单号） */
        syncMasterAgg(t, row); save();
        toast('已删除明细');
        openDoc(t, id);
      };
    });
    /* 计算派生面板的「打开关联单 / 打开来源表 / 新建 / 执行步骤」按钮由页面级委托事件统一处理（见下方 document 监听）。 */
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
    var def = S.TABLES[t]; if (!def) return;
    var rec = rows(t).find(function (r) { return String(r[def.pk]) === String(no); });
    if (!rec) { toast('关联单据不存在或已删除'); return; }
    openDoc(t, rec.ID);
  }
  /* 业务流面板按钮统一委托处理（模态与页面共用，避免重复绑定 / 双触发） */
  document.addEventListener('click', function (e) {
    var el = e.target; if (!el || typeof el.closest !== 'function') return;
    var b;
    if ((b = el.closest('[data-linkopen]'))) { var p = b.getAttribute('data-linkopen').split('|'); openDocByNo(p[0], p[1]); return; }
    if ((b = el.closest('[data-flowopen]'))) { closeModal(); st.table = b.getAttribute('data-flowopen'); st.view = 'browser'; setNav(); render(); return; }
    if ((b = el.closest('[data-flownew]'))) { openForm(b.getAttribute('data-flownew'), null, null); return; }
    if ((b = el.closest('[data-flowto]'))) { var stx = b.getAttribute('data-srct'), six = b.getAttribute('data-srcid'); if (stx && six) doFlow(stx, six, b.getAttribute('data-flowto')); return; }
    if ((b = el.closest('[data-batchpick]'))) { st.batchNo = b.getAttribute('data-batchpick'); render(); return; }
    if ((b = el.closest('[data-batchnew]'))) { openBatchWizard(); return; }
    if ((b = el.closest('[data-batchopen]'))) { st.table = b.getAttribute('data-batchopen'); st.view = 'browser'; setNav(); render(); return; }
    if ((b = el.closest('[data-batchcalc]'))) { genCalc(); st.view = 'batch'; render(); return; }
    /* 三个计算工作台：运行 / 结果切换 / 折叠 / 域间跳转 */
    if ((b = el.closest('[data-mrprun]'))) { runMrp(); return; }
    if ((b = el.closest('[data-gendemand]'))) { genDemand(); st.view = 'mrp'; setNav(); render(); toast('已生成演示需求源（含销售订单 / 库存补充），可点「运行 MRP 计算」'); return; }
    if ((b = el.closest('[data-mrptab]'))) { st.mrpTab = b.getAttribute('data-mrptab'); render(); return; }
    if ((b = el.closest('[data-kitrun]'))) { runKit(); return; }
    if ((b = el.closest('[data-schedrun]'))) { runSched(); return; }
    if ((b = el.closest('[data-viewto]'))) { st.view = b.getAttribute('data-viewto'); setNav(); render(); return; }
    if ((b = el.closest('[data-fold]'))) {
      var fk = b.getAttribute('data-fold');
      st.fold = st.fold || {};
      /* 按按钮上的「当前显示状态」取反，兼容 defaultOpen 的折叠卡 */
      st.fold[fk] = b.getAttribute('data-foldopen') !== '1';
      render(); return;
    }
    if ((b = el.closest('[data-trace]'))) { var tp = b.getAttribute('data-trace').split('|'); closeModal(); st.table = tp[0]; st.search = decodeURIComponent(tp[1] || ''); st.sel = null; st.view = 'browser'; setNav(); render(); return; }
    if ((b = el.closest('[data-printqr]'))) { var pq = b.getAttribute('data-printqr').split('|'); printLabel(pq[0], pq[1]); return; }
  });
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalCancel').onclick = closeModal;

  /* ---------- 数据导入（CSV 粘贴 / 上传，含引用 + 父单存在性校验） ----------
   * preset：子表明细导入时由父单带入的固定字段（如 { SO_NO: 'SO-2026-001' }），
   *         该字段在模板中固定为预设值，不允许 CSV 覆盖，保证明细永远挂在当前单据下。 */
  function openImport(t, preset) {
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
        /* 字典字段：值必须是该字典类型下已启用的项（如「需求来源」只能是四类来源之一） */
        if (c.dict && biz[c.code] !== undefined && biz[c.code] !== '' && biz[c.code] != null) {
          if (!dictCodes(c.dict).some(function (v) { return String(v) === String(biz[c.code]); })) errs.push(c.label + '「' + biz[c.code] + '」不是有效字典值（可选：' + dictCodes(c.dict).join('/') + '）');
        }
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
    function doParse() {
      var lines = realHeader();
      if (lines.length < 2) { document.getElementById('impStat').textContent = '未解析到有效数据（至少需要表头 + 1 行，模板中的 # 说明行会自动忽略）'; document.getElementById('impPreview').innerHTML = ''; parseResult = null; return; }
      var header = lines[0]; var colMap = mapHeader(header);
      if (colMap.every(function (x) { return !x; })) { document.getElementById('impStat').textContent = '表头无法识别：请使用「下载模板」的表头（形如 客户编号*(CUSTOMER_CODE)），或用中文名 / 字段编号作表头'; document.getElementById('impPreview').innerHTML = ''; parseResult = null; return; }
      var missReq = cols.filter(function (c) { return c.req && fixedCodes.indexOf(c.code) < 0 && colMap.indexOf(c.code) < 0; });
      var rowsArr = []; var good = 0;
      for (var i = 1; i < lines.length; i++) {
        var r = lines[i]; var biz = {};
        colMap.forEach(function (code, idx) { if (!code) return; var cell = r[idx] != null ? r[idx] : ''; biz[code] = coerce(cols.find(function (c) { return c.code === code; }), cell); });
        cols.forEach(function (c) { if (biz[c.code] === undefined) biz[c.code] = ''; });
        fixedCodes.forEach(function (code) { biz[code] = preset[code]; }); // 预设绑定字段强制覆盖
        var errs = validate(biz); if (errs.length === 0) good++;
        rowsArr.push({ biz: biz, ok: errs.length === 0, msg: errs.join('；') });
      }
      parseResult = { rows: rowsArr, good: good };
      var stat = '解析 ' + rowsArr.length + ' 行，有效 ' + good + ' 行' + (good < rowsArr.length ? '，无效 ' + (rowsArr.length - good) + ' 行' : '');
      if (missReq.length) stat += '；缺列（将全部失败）：' + missReq.map(function (c) { return c.label; }).join('、');
      document.getElementById('impStat').textContent = stat;
      document.getElementById('impPreview').innerHTML = renderPreview();
    }
    function renderPreview() {
      if (!parseResult) return '';
      var showCols = cols.slice(0, 8);
      var h = '<div class="tbl-wrap"><table class="grid sm"><thead><tr><th>#</th>';
      showCols.forEach(function (c) { h += '<th>' + esc(c.label) + (fixedCodes.indexOf(c.code) >= 0 ? ' <span class="tag">绑定</span>' : '') + '</th>'; });
      h += '<th>校验结果</th></tr></thead><tbody>';
      parseResult.rows.forEach(function (r, i) {
        h += '<tr class="' + (r.ok ? '' : 'badrow') + '"><td>' + (i + 1) + '</td>';
        showCols.forEach(function (c) { h += '<td>' + esc(r.biz[c.code] !== undefined ? r.biz[c.code] : '') + '</td>'; });
        h += '<td>' + (r.ok ? '<span class="tag ok">通过</span>' : '<span class="tag bad" title="' + esc(r.msg) + '">' + esc(r.msg) + '</span>') + '</td></tr>';
      });
      h += '</tbody></table></div>';
      return h;
    }
    /* 模板：第 1 行为 # 规则说明（导入时自动忽略），第 2 行为表头「中文名*(编号)」，
       必填用 * 标注，引用字段用 [须为已存在的XX] 标注绑定关系。 */
    function tplHeaderLine() {
      return cols.map(function (c) {
        var rule = c.ref ? '[须为' + S.TABLES[c.ref].label + '中已存在的编号]' : '';
        if (!rule && c.dict) rule = '[可选值：' + dictCodes(c.dict).join('/') + ']';
        var fx = fixedCodes.indexOf(c.code) >= 0 ? '[已绑定：' + preset[c.code] + ']' : '';
        return c.label + (c.req ? '*' : '') + '(' + c.code + ')' + rule + fx;
      }).join(',');
    }
    function downloadTpl() {
      var rules = [];
      rules.push('# APS 导入模板 · ' + def.label + '（表字段 ' + t + '）');
      rules.push('# 规则1：表头中带 * 的为必填项，不可为空；未带 * 的字段可留空。');
      rules.push('# 规则2：带 [须为XX中已存在的编号] 的为引用字段，必须先在对应主数据里建好（只能选已存在的主数据）。');
      if (S.IMPORT_FK[t]) Object.keys(S.IMPORT_FK[t]).forEach(function (f) {
        rules.push('# 规则3：明细字段「' + f + '」必须绑定已存在的' + S.TABLES[S.IMPORT_FK[t][f]].label + '单号（父单存在性校验）。');
      });
      fixedCodes.forEach(function (code) { rules.push('# 绑定：字段「' + code + '」已由当前单据带入，固定为 ' + preset[code] + '，无需在文件中填写（填了也会被覆盖）。'); });
      rules.push('# 使用方法：保留本行与下一行表头，从第 3 行起按行填写数据；保存为 UTF-8 CSV 后上传，或直接粘贴到下方文本框。');
      var csv = '\ufeff' + rules.join('\n') + '\n' + tplHeaderLine() + '\n';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = def.label + '_导入模板.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    var reqCols = cols.filter(function (c) { return c.req && fixedCodes.indexOf(c.code) < 0; });
    var refCols = cols.filter(function (c) { return c.ref; });
    var dictCols = cols.filter(function (c) { return c.dict; });
    var body = '<div class="import-wrap">';
    body += '<div class="imp-rules"><b>导入规则</b><ul>' +
      '<li><b>必填项</b>：' + (reqCols.length ? reqCols.map(function (c) { return esc(c.label); }).join('、') : '无') + '（模板表头用 <code>*</code> 标注）。</li>' +
      (refCols.length ? '<li><b>引用绑定</b>：' + refCols.map(function (c) { return esc(c.label) + ' → 须为「' + esc(S.TABLES[c.ref].label) + '」中已存在的编号'; }).join('；') + '。</li>' : '') +
      (dictCols.length ? '<li><b>字典取值</b>：' + dictCols.map(function (c) { return esc(c.label) + ' → ' + dictCodes(c.dict).map(function (v) { return esc(v); }).join(' / '); }).join('；') + '（必须是上述值之一）。</li>' : '') +
      (S.IMPORT_FK[t] ? '<li><b>父单绑定</b>：' + Object.keys(S.IMPORT_FK[t]).map(function (f) { return esc(f) + ' 必须绑定已存在的「' + esc(S.TABLES[S.IMPORT_FK[t][f]].label) + '」'; }).join('；') + '。</li>' : '') +
      (fixedCodes.length ? '<li><b>已绑定字段</b>：' + fixedCodes.map(function (code) { return esc(code) + ' = ' + esc(preset[code]); }).join('、') + '（由当前单据带入，无需填写）。</li>' : '') +
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
    var saveBtn = document.getElementById('modalSave');
    saveBtn.style.display = ''; saveBtn.textContent = '确认导入';
    /* 需求明细导入：「来源单据号」留空时，按父单「需求来源」自动补（与表单内选品号自动带出同一口径） */
    function importSrcNo(biz) {
      if (!DEMAND_TARGET.table || t !== DEMAND_TARGET.table) return '';
      var itemNo = biz[DEMAND_TARGET.itemCol]; if (!itemNo) return '';
      var src = '';
      Object.keys(S.MASTER_AGG || {}).forEach(function (mt) {
        (S.MASTER_AGG[mt] || []).forEach(function (m) {
          if (m.table !== t || src) return;
          var fkVal = (preset || {})[m.fk] || biz[m.fk]; if (!fkVal) return;
          var mdef = S.TABLES[mt]; if (!mdef) return;
          var mrec = rows(mt).find(function (x) { return String(x[mdef.pk]) === String(fkVal); });
          if (mrec) src = mrec.SOURCE_TYPE || '';
        });
      });
      var pool = demandPool(src);
      if (pool && pool[itemNo] && pool[itemNo].doc) return pool[itemNo].doc;
      return autoSourceDocNo(src);
    }
    saveBtn.onclick = function () {
      if (!parseResult || parseResult.good === 0) { toast('没有可导入的有效行，请先解析'); return; }
      var n = 0, filled = 0;
      parseResult.rows.forEach(function (r) {
        if (!r.ok) return;
        if (!r.biz.SRC_DOC_NO) { var sn = importSrcNo(r.biz); if (sn) { r.biz.SRC_DOC_NO = sn; filled++; } }
        var rc = insert(t, r.biz);
        syncAggByChild(t, rc);   // 明细导入后同步主表「来源单据号」（去重 + 「；」拼接）
        n++;
      });
      save();
      closeModal();
      toast('成功导入 ' + n + ' 条记录到「' + def.label + '」' + (filled ? '（自动补来源单据号 ' + filled + ' 行）' : ''));
      render();
    };
    document.getElementById('impTpl').onclick = downloadTpl;
    document.getElementById('impParse').onclick = doParse;
    document.getElementById('impFile').onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { document.getElementById('impCsv').value = rd.result; doParse(); }; rd.readAsText(f, 'UTF-8');
    };
  }

  /* ---------- 导出 CSV（全部业务字段 × 全部记录；可选仅导出选中） ---------- */
  function exportCsv(t, onlySelected) {
    var def = S.TABLES[t];
    var cols = S.columnsOf(t).filter(function (c) { return !(c.sys && c.code !== 'REMARK') && !isRptHiddenCol(t, c.code); });
    var list = rows(t);
    if (onlySelected) { var sel = (st.sel && st.sel[t]) || {}; list = list.filter(function (r) { return sel[r.ID]; }); }
    if (list.length === 0) { toast(onlySelected ? '未选择任何记录，请先勾选要导出的行' : '当前表没有数据可导出'); return; }
    function q(v) { var s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    var csv = '﻿' + cols.map(function (c) { return c.label + '(' + c.code + ')'; }).join(',') + '\n';
    list.forEach(function (r) { csv += cols.map(function (c) { var v = r[c.code]; return q(typeof v === 'object' && v !== null ? JSON.stringify(v) : v); }).join(',') + '\n'; });
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = t + '_' + ymd() + '.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出 ' + list.length + ' 条记录' + (onlySelected ? '（已选）' : ''));
  }

  /* ---------- 打印（新窗口输出可打印列表；可选仅打印选中） ---------- */
  function doPrint(t, onlySelected) {
    var def = S.TABLES[t];
    var cols = displayCols(t);
    var list = rows(t);
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
      '<h2>APS 高级计划与排程系统 · ' + esc(def.label) + '</h2>' +
      '<div class="meta">表名 ' + esc(t) + ' · 共 ' + list.length + ' 条' + (onlySelected ? '（已选）' : '') + ' · 打印时间 ' + now() + '</div>' +
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
    /* 计算结果表由系统写入，没有人工审核环节（工具栏也不提供入口，此处兜底） */
    if (def.calc) { toast('计算结果表由系统写入，不参与人工审核'); return; }
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
      if (result === '已审核' || result === '已驳回') { patch.AUDIT_BY = 'OPER'; patch.AUDIT_TIME = now(); }
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
      /* 报表分析表：不展示「主键 ID / 审核状态 / 审核人 / 审核时间」，面板里也不提供 */
      if (isRptHiddenCol(t, c.code)) return;
      var lock = (c.code === pk || c.code === 'ID');
      var on = colOn(t, c.code);
      body += '<label class="set-row"><input type="checkbox" data-colvis="' + esc(c.code) + '" ' + (on ? 'checked' : '') + (lock ? ' disabled title="主键不可隐藏"' : '') + '/> <span>' + esc(c.label) + '</span>' + (lock ? '<span class="mini">（主键）</span>' : '') + '</label>';
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
    var h = '<div class="card"><h2>核心计算链</h2>' +
      '<p class="mini">APS 的逻辑是<b>规则驱动的计算链</b>（不是 MES 的单据流转）：确认需求源后，套用<b>排程规则</b>，用<b>需求计算版本</b>一次算出净需求 / 齐套 / 补料 / 排程等<b>平级结果</b>。若左侧已选中某张表（如需求源），下方会直接展示该表的<b>来源 / 派生 / 操作</b>；未选中时先看全局计算链。<b>要跑一次完整计划，到三个核心域各自的「计算工作台」</b>：物料需求计算 → MRP 计算工作台（净需求 + 计划建议）、物料齐套计算 → 齐套计算工作台、生产排程 → 排程工作台；想逐步演示每一步写入什么数据，点本页卡片右上角「展开一键演练」。</p></div>';

    // 当前表计算派生关系（按表动态）
    if (st.table && S.TABLES[st.table]) {
      h += '<div class="card"><h3>当前表计算派生关系 · ' + esc(S.TABLES[st.table].label) + '</h3>' + tableFlowPanel(st.table, null) + '</div>';
    }

    // 全局计算链（版本中心 · APS 原生逻辑）
    h += viewFlowMap();

    // 一键演练（默认收起，点按钮再展开）
    var drillOpen = st.drill === true;
    h += '<div class="card"><div class="fs-head" style="margin-bottom:0"><h3 style="margin:0">一键演练（演示脚本）</h3>' +
      '<span class="mini">可选功能：按步骤跑通「确认需求源 → 选排程规则 → 跑需求计算 → 一屏看派生结果 → 排程微调 → 滚动重排」</span>' +
      '<span class="spacer"></span><button class="ghost sm" id="btnDrill">' + (drillOpen ? '收起一键演练 ▴' : '展开一键演练 ▾') + '</button></div>';
    if (drillOpen) {
      var dem = rows('BAS_DEMAND')[0];
      var demQty = dem ? rows('BAS_DEMAND_LINE').filter(function (l) { return l.DEMAND_NO === dem.DEMAND_NO; }).reduce(function (a, l) { return a + (+l.DEMAND_QTY || 0); }, 0) : 0;
      var batch = rows('MRP_BATCH').find(function (r) { return r.BATCH_TYPE === '全量'; }) || rows('MRP_BATCH')[0];
      var kit = batch ? rows('MRP_KIT_CHECK').find(function (r) { return r.BATCH_NO === batch.BATCH_NO; }) : null;
      var ps = rows('PP_PLAN_SUGGEST')[0];
      var ver = rows('SCH_VERSION')[0];
      var drlRule = rows('SCH_RULE').find(function (r) { return +r.IS_DEFAULT === 1; }) || rows('SCH_RULE')[0] || {};
      var stepsRes = [];
      var s1done = !!(dem && dem.STATUS === '已生效');
      stepsRes.push(stepCard(1, '① 确认需求源（订单 / 预测 / 叫料 / 库存补充）', dem ? ('需求单 ' + dem.DEMAND_NO + ' / 来源 ' + dem.SOURCE_TYPE + ' / 冲减后需求合计 ' + demQty + ' / 状态：' + dem.STATUS) : '暂无需求源，将新建一张销售订单来源的需求单', s1done,
        s1done ? ('需求源就绪——这是本次计算的输入') : null, '生成 / 刷新需求源', function () { genDemand(); }, !s1done));
      var s2done = !!batch;
      stepsRes.push(stepCard(2, '② 选排程规则（作为本次计算口径）', drlRule.RULE_NO ? ('默认规则「' + (drlRule.RULE_NAME || drlRule.RULE_NO) + '」' + drlRule.RULE_NO + '：订单排序 ' + (drlRule.ORDER_SORT || '-') + ' / 资源优选 ' + (drlRule.RES_SELECT || '-')) : '排程规则是独立功能表（生产排程 → 排程规则），在版本里被引用为计算口径', true,
        '规则 → 需求计算版本；跑计算时会自动取「默认规则」（可到排程规则表切换默认 / 新建）', null, null, false));
      stepsRes.push(stepCard(3, '③ 跑需求计算（净需求逐层展开）', s2done ? ('计算版本 ' + batch.BATCH_NO + '（规则 ' + (batch.RULE_NO || '-') + '），净需求 ' + rows('MRP_NET_REQ').filter(function (r) { return r.BATCH_NO === batch.BATCH_NO; }).length + ' 行') : '一次运行：按 BOM 自成品向下逐层展开，净需求 = max(毛需求 − 可用库存 − 在制 − 在途, 0)，再按最小批量 / 批量倍数向上取整', s2done,
        s2done ? '已写入 MRP_BATCH / MRP_NET_REQ（含批量调整后数量与建议下达日期）' : null, '执行净需求计算', function () { genCalc(); }, !s2done));
      var s3done = !!kit;
      stepsRes.push(stepCard(4, '④ 派生结果 A · 齐套检查（逐层 + 先到先得）', s3done ? ('齐套单 ' + kit.CHECK_NO + '，齐套率 ' + ((+kit.KIT_RATE || 0) * 100).toFixed(1) + '%，缺料 ' + kit.SHORT_QTY) : '对订单 / 工单逐层齐套检查（整机←部件←零件），多订单共用库存按需求日期先到先得，关键件缺料阻断性预警', s3done,
        s3done ? '已生成齐套单与缺料明细（MRP_KIT_CHECK / MRP_KIT_SHORT）' : null, '执行齐套检查', function () { genKit(); }, !s3done));
      var s4done = !!ps;
      stepsRes.push(stepCard(5, '⑤ 派生结果 B · 补料建议 / 生产计划建议', s4done ? ('计划建议 ' + ps.SUGGEST_NO + '，建议数量 ' + ps.NET_QTY) : '外购 / 外协项生成补料建议，自制项生成生产计划建议；人工确认后回写 MES（请购与比价选商 / 生产计划）', s4done,
        s4done ? '可到「补料建议」「生产计划建议」查看，或在「计算版本工作台」一屏看全部派生结果' : null, '生成计划建议', function () { genSuggest(); }, !s4done));
      var s5done = !!ver;
      stepsRes.push(stepCard(6, '⑥ 派生结果 C · 有限产能自动排程（日排产）', s5done ? ('排程版本 ' + ver.VERSION_NO + '，规则 ' + (ver.RULE_NO || '-') + '，任务 ' + rows('SCH_TASK').filter(function (r) { return r.VERSION_NO === ver.VERSION_NO; }).length + ' 条，状态 ' + ver.STATUS) : '在约束下自动排布每道工序到「资源 × 起止时间 × 数量」，产出日排产(3~7天)；按版本引用的排程规则执行', s5done,
        s5done ? '已写入 SCH_VERSION / SCH_TASK / SCH_DAY_PLAN' : null, '执行自动排程', function () { genSchedule(); }, !s5done));
      var adj = rows('SCH_ADJUST')[0];
      var s6done = !!adj;
      stepsRes.push(stepCard(7, '⑦ 甘特图人工调整 / 插单 / 锁定', s6done ? ('已登记调整 ' + adj.ADJ_ID + '（' + adj.ADJ_TYPE + '）') : '甘特图拖拽改时间 / 换资源并实时校验冲突；插单前出影响预览；锁定任务不参与重排', s6done,
        s6done ? '可到左侧「计划看板 → 排产甘特图」查看效果' : null, '模拟人工调整', function () { genAdjust(); }, !s6done));
      h += '<p class="mini" style="margin-top:10px">APS 主链路：<b>确认需求源 → 选排程规则 → 跑需求计算（一个版本）→ 同时派生 净需求 / 齐套 / 补料与计划建议 / 排程</b> → 人工微调。注意 ④⑤⑥ 是同一个版本的<b>平级产物</b>，不是「一张单流转出下一张单」。每步写入对应数据表；本期生产排程<b>不含工程变更（ECN）</b>。</p>' +
        stepsRes.join('<div class="flow-line">↓</div>');
    }
    h += '</div>';
    return h;
  }
  /* 全局计算链：APS 原生逻辑（版本中心 · 一次算出一批平级结果），与 MES 的「单据链」区分 */
  function viewFlowMap() {
    var stages = [
      { t: '① 输入 · 需求源', d: '销售订单 / 库存补充（可多选来源单据，品号自动带出）', note: '来源：UNS 销售订单 / 库存 + 人工录入' },
      { t: '② 口径 · 排程规则', d: '订单排序 / 资源优选 / 优化目标 / 正倒排 / 瓶颈工序 / 齐套约束（独立功能表，被版本引用）', note: '排程规则是独立表，在「需求计算版本」里被引用为本次计算口径' },
      { t: '③ 计算 · 需求计算版本', d: '一次运行：逐层展开 BOM → 冲减库存/在制/在途 → 缺料判定 → 齐套校验 → 拆出补料/计划建议', note: 'APS 的「心脏」，一次算出一批结果' },
      { t: '④ 输出 · 平级派生结果', d: '净需求 ｜ 齐套检查 + 缺料明细 ｜ 补料建议 / 生产计划建议 ｜ 排程版本 + 排程任务', note: '同一版本的产物，互为兄弟，不是「一张单转成另一张单」' },
      { t: '⑤ 下发与回写 MES', d: '补料建议 → PD_PRICE_COMPARE（请购与比价选商）；生产计划建议 → PP_MASTER_PLAN；排程发布 → PP_SCHEDULE', note: 'APS 只算「怎么排」，执行仍由 MES 承接' }
    ];
    var chain = stages.map(function (l) {
      return '<div class="mc-item"><div class="mc-t">' + esc(l.t) + '</div><div class="mc-d">' + esc(l.d) + '</div><div class="mc-up mini">' + esc(l.note) + '</div></div>';
    }).join('<div class="mc-arrow">↓</div>');
    return '<div class="card"><h3>核心计算链（版本中心 · APS 原生逻辑）</h3>' +
      '<p class="mini">APS 与 MES 的逻辑<b>本质不同</b>：MES 是「事件驱动的单据链」（一张单流转出下一张单），APS 是「<b>规则驱动的计算链</b>」——以<b>需求计算版本</b>为心脏，输入需求源、套用排程规则，<b>一次算出</b>净需求 / 齐套 / 补料 / 排程等<b>平级结果</b>；结果之间没有 MES 那种逐级流转关系。数据边界上，APS 主数据<b>只引用不重建</b>（真源在 supOS UNS「工厂建模」，按需直读），计算结果再回写 MES 承接执行。本期生产排程<b>不含工程变更（ECN）</b>；集成接口一期仅预留、不实现实际对接。</p>' +
      '<p class="mini">想按版本查看「输入 → 输出」的完整内容，请到左侧「<b>物料需求计算 → MRP 计算工作台</b>」（并入计算版本视角）。</p>' +
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
          1: genDemand, 3: genCalc, 4: genKit, 5: genSuggest,
          6: genSchedule, 7: genAdjust
        };
        if (fns[b.getAttribute('data-flow')]) { fns[b.getAttribute('data-flow')](); toast('执行成功'); render(); }
      };
    });
  }
  /* 记录具体上下游关联（供单据详情 / 使用说明按单号定位） */
  function linkDocs(fromT, fromNo, toT, toNo, label) {
    insert('SYS_DOC_LINK', { LINK_ID: uid('LINK'), FROM_TABLE: fromT, FROM_NO: fromNo, TO_TABLE: toT, TO_NO: toNo, FLOW_LABEL: label, LINK_TIME: now(), REMARK: '计算派生' });
  }
  /* ① 需求源：按「需求来源两类」各建一张需求单（与 schema 的 DEMAND_SOURCE 声明一致）
   *    销售订单 → RF_SO 未交 > 0 的行（有多少取多少）
   *    库存补充 → BAS_ITEM_PLAN_ATTR 有 min/max 的品号，数量 = 上限 − RF_STOCK 可用量 */
  function genDemand() {
    if (rows('BAS_DEMAND').length) return;
    var demNo = 'DEM-' + ymd() + '-001';
    var made = 0;

    /* ① 销售订单：未交 > 0 */
    var openLines = rows('RF_SO').filter(function (s) { return (+s.OPEN_QTY || 0) > 0; });
    if (openLines.length) {
      var so = openLines[0];
      insert('BAS_DEMAND', { DEMAND_NO: demNo, DOC_NO: demNo, SOURCE_TYPE: '销售订单', SOURCE_NO: so.SO_NO || '', CUSTOMER_CODE: so.CUSTOMER_CODE || '', PLAN_HORIZON: 60, FREEZE_FLAG: 0, DOC_TYPE: 'DEM', DOC_DATE: today(), MAKER: '计划员', MAKE_TIME: now(), STATUS: '已生效' });
      openLines.slice(0, 8).forEach(function (s, i) {
        insert('BAS_DEMAND_LINE', { DEMAND_NO: demNo, SEQ_NO: i + 1, ITEM_NO: s.ITEM_NO, ITEM_NAME: s.ITEM_NAME, DEMAND_QTY: +s.OPEN_QTY || 0, REQ_DATE: s.DELIVERY_DATE, SRC_DOC_NO: s.SO_NO, LOCK_FLAG: 0, LINE_STATUS: '已生效' });
      });
      made += openLines.slice(0, 8).length;
    }

    /* ② 库存补充：只对**长周期件**（BAS_ITEM_PLAN_ATTR.LONG_CYCLE_FLAG=1，采购提前期长、来不及按需采购）
     *    做 min/max 常备补货 —— 可用量低于 MIN_STOCK 才触发，补到 MAX_STOCK；
     *    需求日期 = 今天 + 采购提前期（缺省 15 天）。短周期件按需采购，不进库存补充。
     * ⚠️ 不要对全部有 min/max 的品号做补货：那会把成品/半成品也补一遍（与订单来源重复），
     *    且与种子数据的口径不符（种子只补长周期采购件）。 */
    var reNo = demNo + '-S';
    var reLines = [];
    rows('BAS_ITEM_PLAN_ATTR').forEach(function (p) {
      if (+p.LONG_CYCLE_FLAG !== 1) return;
      var minS = +p.MIN_STOCK || 0, maxS = +p.MAX_STOCK || 0;
      if (minS <= 0 || maxS <= 0) return;
      var av = mrpAvail(p.ITEM_NO);
      if (av < minS) reLines.push({ ITEM_NO: p.ITEM_NO, ITEM_NAME: p.ITEM_NAME, QTY: Math.ceil(maxS - av), AVAIL: av, LEAD: +p.PURCHASE_LEAD_TIME || 15 });
    });
    if (reLines.length) {
      insert('BAS_DEMAND', { DEMAND_NO: reNo, DOC_NO: reNo, SOURCE_TYPE: '库存补充', SOURCE_NO: 'AUTO-' + ymd(), CUSTOMER_CODE: '', PLAN_HORIZON: 30, FREEZE_FLAG: 0, DOC_TYPE: 'DEM', DOC_DATE: today(), MAKER: '计划员', MAKE_TIME: now(), STATUS: '已生效' });
      reLines.forEach(function (r, i) {
        insert('BAS_DEMAND_LINE', { DEMAND_NO: reNo, SEQ_NO: i + 1, ITEM_NO: r.ITEM_NO, ITEM_NAME: r.ITEM_NAME, DEMAND_QTY: r.QTY, REQ_DATE: mrpAddDays(today(), r.LEAD), SRC_DOC_NO: 'AUTO-' + ymd(), LOCK_FLAG: 0, LINE_STATUS: '已生效' });
        made++;
      });
    }

    if (!made) { toast('没有可采集的需求（RF_SO 未交为 0 且无计划属性）'); return; }
    toast('已生成需求源 2 类共 ' + made + ' 行明细');
  }
  /* ---------- MRP 计算内核辅助 ---------- */
  /* 汇总某品号的可用库存（RF_STOCK.AVAILABLE_QTY 求和） */
  function mrpAvail(itemNo) {
    var q = 0;
    rows('RF_STOCK').forEach(function (s) { if (s.ITEM_NO === itemNo) q += (+s.AVAILABLE_QTY || 0); });
    return q;
  }
  /* 汇总某品号的在制量（RF_WORK_ORDER 中未完工且未入库的剩余量） */
  function mrpWip(itemNo) {
    var q = 0;
    rows('RF_WORK_ORDER').forEach(function (w) {
      if (w.ITEM_NO !== itemNo) return;
      if (/完工|入库|关闭|取消/.test(w.STATUS || '')) return;   // 已完工/已入库的不算在制
      q += Math.max(0, (+w.PLAN_QTY || 0) - (+w.FINISH_QTY || 0));
    });
    return q;
  }
  /* 汇总某品号的采购在途（RF_PO_ONWAY.OWING_QTY 求和） */
  function mrpOnway(itemNo) {
    var q = 0;
    rows('RF_PO_ONWAY').forEach(function (p) { if (p.ITEM_NO === itemNo) q += (+p.OWING_QTY || 0); });
    return q;
  }
  /* 取某品号的物料计划属性（安全库存 / 批量 / 提前期 / 计划类型） */
  function mrpAttr(itemNo) {
    return rfind('BAS_ITEM_PLAN_ATTR', function (p) { return p.ITEM_NO === itemNo; }) || {};
  }
  /* 沿 BOM 取某父件下的直接子件行（含用量与损耗率） */
  function mrpChildren(parentNo) {
    return rows('RF_BOM').filter(function (b) { return b.PARENT_ITEM === parentNo; });
  }
  /* 日期倒推：reqDate 减 lead 天 */
  function mrpMinusDays(reqDate, lead) {
    if (!reqDate) return '';
    var d = new Date(String(reqDate).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - (+lead || 0));
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  /* 日期正推：base 加 n 天 */
  function mrpAddDays(base, n) {
    var d = new Date(String(base || today()).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return today();
    d.setDate(d.getDate() + (+n || 0));
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ② 净需求计算：生成计算版本 + 逐层展开净需求
   *    算法：① 汇总全部需求单明细 → 独立需求（LEVEL 0 相关需求起点，落库按低阶码写）
   *          ② 对每个品号：毛需求 = 独立需求 + 上层相关需求
   *             净需求 = max(0, 毛需求 + 安全库存 − 可用库存 − 在制 − 采购在途)
   *          ③ 净需求按 MIN_BATCH / BATCH_MULTIPLE 批量取整 → ADJ_QTY
   *          ④ 若该件为自制且有 BOM，则把 ADJ_QTY 按用量×(1+损耗率) 摊到子件，递归下层
   *          ⑤ 多父件共同需求同一物料时，按「低阶码最低层」只算一次（MRP 低阶码规则）
   */
  function genCalc(opts) {
    opts = opts || {};
    /* 幂等：允许指定版本的「覆盖重算」（先清掉旧版本结果再重算）；默认新版本，若已有则不再重复 */
    if (!opts.demandNos && rows('MRP_BATCH').length) return;
    var batchNo = opts.batchNo || ('MRP-' + ymd() + '-' + ('00' + (rows('MRP_BATCH').length + 1)).slice(-3));

    /* —— ① 汇总独立需求（可在弹窗勾选「本次纳入」的需求源；不传则全部） —— */
    var scope = opts.demandNos && opts.demandNos.length ? opts.demandNos : null;
    var gross0 = {};      // ITEM_NO -> 毛需求（独立需求）
    var nameOf = {};      // ITEM_NO -> 品名
    var reqDateOf = {};   // ITEM_NO -> 最早需求日期
    var demandNos = {};   // 参与计算的需求单号集合
    rows('BAS_DEMAND_LINE').forEach(function (l) {
      if (l.DEL_FLAG == 1) return;
      if (scope && scope.indexOf(l.DEMAND_NO) < 0) return;   // 只算勾选的需求源
      var q = +l.DEMAND_QTY || 0;
      gross0[l.ITEM_NO] = (gross0[l.ITEM_NO] || 0) + q;
      nameOf[l.ITEM_NO] = l.ITEM_NAME || nameOf[l.ITEM_NO] || '';
      if (l.REQ_DATE && (!reqDateOf[l.ITEM_NO] || l.REQ_DATE < reqDateOf[l.ITEM_NO])) reqDateOf[l.ITEM_NO] = l.REQ_DATE;
      if (l.DEMAND_NO) demandNos[l.DEMAND_NO] = 1;
    });

    /* —— ② 把独立需求按 BOM 递归展开成「相关需求」，记录每条需求的来源父件 ——
     *    注意：不能从 null 起展开（BOM 顶层是各成品/半成品），必须从「独立需求品号」逐个起展开 */
    var relDemand = {};   // ITEM_NO -> 相关需求合计
    var parentOf = {};    // ITEM_NO -> 第一个父件品号（用于落 PARENT_ITEM）
    var bomVerOf = {};    // ITEM_NO -> BOM 版本
    var levelOf = {};     // ITEM_NO -> 低阶码（沿 BOM 走到的最大深度）
    var guard = 0;
    Object.keys(gross0).forEach(function (rootNo) {
      (function explode(parentNo, parentQty, depth) {
        if (depth > 12 || guard++ > 5000) return;            // 防环
        mrpChildren(parentNo).forEach(function (b) {
          if (b.DEL_FLAG == 1) return;
          var need = parentQty * (+b.NET_QTY || 0) * (1 + (+b.LOSS_RATE || 0));
          relDemand[b.ITEM_NO] = (relDemand[b.ITEM_NO] || 0) + need;
          if (!parentOf[b.ITEM_NO]) parentOf[b.ITEM_NO] = parentNo;
          if (!bomVerOf[b.ITEM_NO] && b.BOM_VER) bomVerOf[b.ITEM_NO] = b.BOM_VER;
          var lv = +b.LEVEL_NO || (depth + 1);
          /* 低阶码规则：同一物料多层出现时取「最低层」（数值最大），保证只在最低层净算一次 */
          if (!levelOf[b.ITEM_NO] || lv > levelOf[b.ITEM_NO]) levelOf[b.ITEM_NO] = lv;
          explode(b.ITEM_NO, need, depth + 1);
        });
      })(rootNo, (gross0[rootNo] || 0), 1);
    });

    /* 独立需求品号自身的层级：无父件的成品 = LEVEL 1；有父件的取低阶码 */
    Object.keys(gross0).forEach(function (it) {
      if (!levelOf[it]) levelOf[it] = parentOf[it] ? 99 : 1;
    });

    /* —— ③ 逐品号算净需求 —— */
    var items = {};
    Object.keys(gross0).forEach(function (k) { items[k] = 1; });
    Object.keys(relDemand).forEach(function (k) { items[k] = 1; });
    if (!Object.keys(items).length) { toast('没有需求源明细，无法计算'); return; }

    var net = [];
    Object.keys(items).forEach(function (itemNo) {
      var pa = mrpAttr(itemNo);
      var gross = (gross0[itemNo] || 0) + (relDemand[itemNo] || 0);
      if (gross <= 0) return;
      var safe = +pa.SAFETY_STOCK || 0;
      var avail = mrpAvail(itemNo), wip = mrpWip(itemNo), onway = mrpOnway(itemNo);
      var nq = Math.max(0, gross + safe - avail - wip - onway);
      net.push({
        ITEM_NO: itemNo, ITEM_NAME: nameOf[itemNo] || (mrpItemName(itemNo) || ''),
        PLAN_TYPE: pa.PLAN_TYPE || (mrpItemType(itemNo)),
        GROSS: gross, SAFE: safe, AVAIL: avail, WIP: wip, ONWAY: onway, NET: nq,
        REQ: reqDateOf[itemNo] || mrpReqDateOf(parentOf[itemNo], gross0, reqDateOf),
        PARENT: parentOf[itemNo] || '', BOM_VER: bomVerOf[itemNo] || '',
        LEVEL: levelOf[itemNo] || 1, HAS_BOM: mrpChildren(itemNo).length > 0
      });
    });
    /* 按层级 → 品号排序，保证主表层级清晰 */
    net.sort(function (a, b) { return (a.LEVEL - b.LEVEL) || String(a.ITEM_NO).localeCompare(String(b.ITEM_NO)); });

    /* 排程规则：优先用弹窗指定的规则，其次默认规则，最后第一条 */
    var _rule = (opts.ruleNo && rfind('SCH_RULE', function (r) { return r.RULE_NO === opts.ruleNo; }))
      || rows('SCH_RULE').find(function (r) { return +r.IS_DEFAULT === 1; }) || rows('SCH_RULE')[0] || null;
    insert('MRP_BATCH', { BATCH_NO: batchNo, BATCH_TYPE: opts.batchType || '全量', RULE_NO: _rule ? _rule.RULE_NO : '', CALC_TIME: now(), CALC_BY: '计划员', REQ_ROWS: Object.keys(gross0).length, NET_ROWS: net.length, DURATION_SEC: 0, STATUS: '已完成', IDEMPOTENT_KEY: 'HASH-' + ymd() + '-' + batchNo.slice(-3) });
    st.batchNo = batchNo;

    net.forEach(function (n, i) {
      var pa = mrpAttr(n.ITEM_NO);
      var mult = +pa.BATCH_MULTIPLE || 1, minb = +pa.MIN_BATCH || 0;
      var adj = n.NET > 0 ? Math.max(minb, Math.ceil(n.NET / mult) * mult) : 0;
      /* 提前期：自制取生产提前期；外购/外协取采购提前期（字段名与 schema 一致） */
      var isMake = (n.PLAN_TYPE === '自制');
      var lead = isMake ? (+pa.PRODUCE_LEAD_TIME || 0) : (+pa.PURCHASE_LEAD_TIME || 0);
      var sd = mrpMinusDays(n.REQ, lead);
      insert('MRP_NET_REQ', {
        /* 主键必须带批次号：原来只有日期 + 序号，同一天跑第二批会生成完全相同的 NET_ID，
         * 逻辑上「新增」的其实是「覆盖上一批净需求」。后端按业务键 upsert，撞号就真丢了。 */
        NET_ID: 'NR-' + String(batchNo).replace(/^MRP-/, '') + '-' + ('00' + (i + 1)).slice(-3), BATCH_NO: batchNo,
        LEVEL_NO: n.LEVEL, ITEM_NO: n.ITEM_NO, ITEM_NAME: n.ITEM_NAME, ITEM_TYPE: n.PLAN_TYPE,
        PARENT_ITEM: n.PARENT, BOM_VER: n.BOM_VER,
        GROSS_QTY: +n.GROSS.toFixed(4), SAFE_STOCK: n.SAFE, AVAIL_STOCK: n.AVAIL, WIP_QTY: n.WIP, ON_ORDER_QTY: n.ONWAY,
        NET_QTY: +n.NET.toFixed(4), ADJ_QTY: adj, REQ_DATE: n.REQ, SUGGEST_DATE: sd,
        STATUS: adj > 0 ? '待确认' : '无需补充'
      });
    });
    Object.keys(demandNos).forEach(function (dn) { linkDocs('BAS_DEMAND', dn, 'MRP_BATCH', batchNo, '纳入需求计算'); });
    toast('已生成计算版本 ' + batchNo + '（规则 ' + (_rule ? _rule.RULE_NO : '默认') + '，逐层展开 ' + net.length + ' 条净需求）');
    return batchNo;
  }
  /* 取 UNS 物料主数据快照里的品名/类型（补充 BAS_ITEM_PLAN_ATTR 未覆盖的物料） */
  function mrpItemName(itemNo) { var it = rfind('RF_ITEM', function (x) { return x.ITEM_NO === itemNo; }); return it ? it.ITEM_NAME : ''; }
  function mrpItemType(itemNo) {
    var it = rfind('RF_ITEM', function (x) { return x.ITEM_NO === itemNo; });
    if (!it) return '外购';
    return it.ITEM_TYPE || '外购';
  }
  /* 子件需求日期：取父件需求日期（父件的 REQ_DATE 已在上一轮确定） */
  function mrpReqDateOf(parentNo, gross0, reqDateOf) {
    if (!parentNo) return '';
    return reqDateOf[parentNo] || '';
  }
  /* ③ 齐套检查：按成品逐层检查子件可供量，生成齐套单 + 缺料明细
   *    参数 bNo：指定版本（向导一次运行时传入）；不传则取最早版本，且不重复生成 */
  function genKit(bNo) {
    if (!bNo && rows('MRP_KIT_CHECK').length) return;
    var batch = bNo ? rfind('MRP_BATCH', function (b) { return b.BATCH_NO === bNo; }) : (rows('MRP_BATCH')[0] || {});
    bNo = bNo || (batch && batch.BATCH_NO) || '';
    if (bNo && rows('MRP_KIT_CHECK').some(function (k) { return k.BATCH_NO === bNo; })) return; // 该版本已算过
    var checkNo = 'KIT-' + (bNo ? bNo.replace(/^MRP-/, '') : ymd()) + '-A';
    var nets = rows('MRP_NET_REQ').filter(function (n) { return !bNo || n.BATCH_NO === bNo; });
    /* 齐套对象 = LEVEL 1 的成品/独立需求件（有 BOM 才有齐套意义） */
    var tops = nets.filter(function (n) { return (+n.LEVEL_NO || 1) === 1; });
    var head = tops[0] || nets[0] || {};
    var demand = tops.reduce(function (a, n) { return a + (+n.GROSS_QTY || 0); }, 0);
    var kit = tops.reduce(function (a, n) { return a + Math.min(+n.GROSS_QTY || 0, (+n.AVAIL_STOCK || 0) + (+n.ON_ORDER_QTY || 0) + (+n.WIP_QTY || 0)); }, 0);
    var short = Math.max(0, demand - kit);
    insert('MRP_KIT_CHECK', {
      CHECK_NO: checkNo, BATCH_NO: bNo, CHECK_TYPE: '整单', CHECK_DATE: today(),
      ORDER_NO: head.PARENT_ITEM || head.ITEM_NO || '', ITEM_NO: head.ITEM_NO || '', ITEM_NAME: head.ITEM_NAME || '',
      LEVEL_NO: 1, DEMAND_QTY: demand, KIT_QTY: kit, SHORT_QTY: short,
      KIT_RATE: demand ? +(kit / demand).toFixed(4) : 1, KIT_DATE: today(),
      KEY_ITEM_FLAG: 1, PERIOD_TYPE: '按日', STATUS: short > 0 ? '存在缺料' : '已齐套'
    });
    /* 缺料明细：净需求 > 0 的所有物料（含下层），按关键件标记阻断级别 */
    nets.forEach(function (n, i) {
      if ((+n.ADJ_QTY || 0) <= 0 && (+n.NET_QTY || 0) <= 0) return;
      var pa = mrpAttr(n.ITEM_NO);
      var key = +pa.KEY_ITEM_FLAG === 1;
      insert('MRP_KIT_SHORT', {
        /* 同 NET_ID：缺料明细主键也要带批次号，否则第二次齐套检查会覆盖第一次 */
        SHORT_ID: 'SH-' + (bNo ? String(bNo).replace(/^MRP-/, '') : ymd()) + '-' + ('00' + (i + 1)).slice(-3), CHECK_NO: checkNo,
        ORDER_NO: n.PARENT_ITEM || head.ITEM_NO || '', ITEM_NO: n.ITEM_NO, ITEM_NAME: n.ITEM_NAME,
        SHORT_QTY: +n.NET_QTY || 0, REQ_DATE: n.REQ_DATE, RECOVER_DATE: n.SUGGEST_DATE || today(),
        SUPPLY_TYPE: n.ITEM_TYPE === '自制' ? '自制' : '采购补料',
        KEY_ITEM_FLAG: key ? 1 : 0, BLOCK_FLAG: key ? 1 : 0,
        STATUS: key ? '阻断预警' : '记录缺口'
      });
    });
    if (bNo) linkDocs('MRP_BATCH', bNo, 'MRP_KIT_CHECK', checkNo, '执行齐套检查');
    toast('已生成齐套单 ' + checkNo);
  }
  /* ④ 计划建议：外购/外协 → 补料建议（PR_SUGGEST）；自制 → 生产计划建议
   *    参数 bNo：指定版本（向导一次运行时传入） */
  function genSuggest(bNo) {
    var batch = bNo ? rfind('MRP_BATCH', function (b) { return b.BATCH_NO === bNo; }) : (rows('MRP_BATCH')[0] || {});
    bNo = bNo || (batch && batch.BATCH_NO) || '';
    var made = 0;
    var sameItemScoped = function (tbl, item) {
      return rows(tbl).some(function (p) { return p.ITEM_NO === item && (!bNo || p.BATCH_NO === bNo); });
    };
    rows('MRP_NET_REQ').filter(function (n) { return (!bNo || n.BATCH_NO === bNo) && (+n.ADJ_QTY || 0) > 0; }).forEach(function (n, i) {
      if (n.ITEM_TYPE === '自制') {
        if (sameItemScoped('PP_PLAN_SUGGEST', n.ITEM_NO)) return;
        var psNo = 'PS-' + (bNo ? String(bNo).replace(/^MRP-/, '') : ymd()) + '-' + ('00' + (i + 1)).slice(-3);
        insert('PP_PLAN_SUGGEST', { SUGGEST_NO: psNo, BATCH_NO: bNo, ITEM_NO: n.ITEM_NO, ITEM_NAME: n.ITEM_NAME, NET_QTY: n.ADJ_QTY, SUGGEST_START: n.SUGGEST_DATE, SUGGEST_END: n.REQ_DATE, REQ_DATE: n.REQ_DATE, DOC_TYPE: 'PS', DOC_DATE: today(), STATUS: '待确认' });
        linkDocs('MRP_BATCH', bNo, 'PP_PLAN_SUGGEST', psNo, '生成生产计划建议'); made++;
      } else {
        if (sameItemScoped('PR_SUGGEST', n.ITEM_NO)) return;
        var prNo = 'PR-' + (bNo ? String(bNo).replace(/^MRP-/, '') : ymd()) + '-' + ('00' + (i + 1)).slice(-3);
        insert('PR_SUGGEST', { PR_NO: prNo, BATCH_NO: bNo, ITEM_NO: n.ITEM_NO, ITEM_NAME: n.ITEM_NAME, ITEM_TYPE: n.ITEM_TYPE, NET_QTY: n.ADJ_QTY, REQ_DATE: n.REQ_DATE, SUGGEST_DATE: n.SUGGEST_DATE, SUGGEST_SUPPLIER: '', DOC_TYPE: 'PR', DOC_DATE: today(), STATUS: '待确认' });
        linkDocs('MRP_BATCH', bNo, 'PR_SUGGEST', prNo, '生成补料建议'); made++;
      }
    });
    /* 一条都没算出来时如实说明，不再插入一条 NET_QTY:100 的假建议凑数。
     * 假数据会让「引擎没算出东西」和「正常有建议」在界面上长得一样，等于掩盖故障。 */
    if (!made) {
      var exist = rows('PP_PLAN_SUGGEST').some(function (p) { return !bNo || p.BATCH_NO === bNo; }) ||
        rows('PR_SUGGEST').some(function (p) { return !bNo || p.BATCH_NO === bNo; });
      toast(exist ? '该批次的计划建议已存在，未重复生成' : '本次没有需要下达的计划建议（净需求为 0）');
      return;
    }
    toast('已生成计划建议 ' + made + ' 条');
  }
  /* 版本号生成：SCHV-YYYYMMDD-<版本数>-<字母>，多版本/同版本多次排程均不撞号 */
  function nextVerNo() {
    var base = 'SCHV-' + ymd() + '-';
    var used = {};
    rows('SCH_VERSION').forEach(function (v) { used[String(v.VERSION_NO)] = 1; });
    var bi = rows('MRP_BATCH').length || 1;
    for (var r = 0; r < 200; r++) {
      for (var li = 0; li < 26; li++) {
        var no = base + bi + '-' + String.fromCharCode(65 + li);
        if (!used[no]) return no;
      }
      bi++;
    }
    return base + bi + '-A';
  }
  /* ⑤ 自动排程：生成排程版本 + 任务 + 周/日计划
   *    参数 bNo：指定版本（用于取该版本引用的排程规则）
   *    参数 optRuleNo：显式指定排程规则（排程工作台里「选规则 → 运行」用；优先级高于版本引用） */
  /* ---------- 排程日历 / 产能推演（2026-10-13 重写）----------
   * 时间基准：机时 = 工单数量 × BAS_RESOURCE.STD_CYCLE（标准节拍 s/件）/ 3600；
   *           按 BAS_CALENDAR 的班次日历逐日推演（跳假日 / 跳非工作时段 / 跨天），
   *           遵守有限产能（同机台串行）与 BAS_MAINTENANCE 维保占用；换型时间计入占用。
   * ⚠️ 不要退回旧写法「hours = PLAN_QTY × STD_HOUR 当小时数，end = (startH+hours)%24」——
   *    它把总工时当成当天连续小时数、取模后日期不跨天，会产出 START ≥ END 的坏时间。 */
  var SCH_SHIFTS_DEFAULT = [{ SHIFT: '白班', S: 480, E: 960 }, { SHIFT: '中班', S: 960, E: 1440 }];
  var SCH_CAL_DATES = null, SCH_WIN_CACHE = {};
  function schP2(n) { return (n < 10 ? '0' : '') + n; }
  function schDateStr(d) { return d.getFullYear() + '-' + schP2(d.getMonth() + 1) + '-' + schP2(d.getDate()); }
  function schDayStartMs(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function schMs(v) { var d = new Date(v); return schDateStr(d) + ' ' + schP2(d.getHours()) + ':' + schP2(d.getMinutes()) + ':' + schP2(d.getSeconds()); }
  function schHHMM(v) { var m = /(\d{1,2}):(\d{2})/.exec(String(v || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  /* ISO 周（如 2026-W42） */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var wk = Math.ceil(((t - ys) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + schP2(wk);
  }
  function schCalOf(dateStr) {
    if (!SCH_CAL_DATES) {
      SCH_CAL_DATES = {};
      rows('BAS_CALENDAR').forEach(function (c) {
        if (+c.ENABLE_FLAG === 0) return;
        var d = String(c.WORK_DATE || '').slice(0, 10); if (!d) return;
        (SCH_CAL_DATES[d] = SCH_CAL_DATES[d] || []).push(c);
      });
    }
    return SCH_CAL_DATES[dateStr] || [];
  }
  function schFallback(dateStr) {
    var dow = new Date(dateStr + 'T00:00:00').getDay();
    if (dow === 0) return [];                                          // 周日休
    if (dow === 6) return [{ SHIFT: '白班', S: 480, E: 960 }];         // 周六只排白班
    return [{ SHIFT: '白班', S: 480, E: 960 }, { SHIFT: '中班', S: 960, E: 1440 }];
  }
  /* 某资源在某日的可用班次（分钟区间）。级次：资源 > 工作中心 > 工厂；无当日记录用标准两班兜底 */
  function schWindows(dateStr, resNo, workCenter) {
    var key = dateStr + '|' + resNo;
    if (SCH_WIN_CACHE[key]) return SCH_WIN_CACHE[key];
    var all = schCalOf(dateStr), wins = null;
    function toWin(list) {
      if (list.some(function (c) { return +c.IS_HOLIDAY === 1; })) return [];
      return list.map(function (c) {
        var s = schHHMM(c.WORK_START); if (s === null) return null;
        var e = schHHMM(c.WORK_END); if (e === null || e <= s) e = 1440;
        return { SHIFT: c.SHIFT || '班次', S: s, E: e };
      }).filter(Boolean).sort(function (a, b) { return a.S - b.S; });
    }
    if (all.length) {
      var lv = all.filter(function (c) { return c.CAL_LEVEL === '资源' && String(c.OWNER_CODE) === String(resNo); });
      if (lv.length) wins = toWin(lv);
      if (wins === null) { lv = all.filter(function (c) { return c.CAL_LEVEL === '工作中心' && String(c.OWNER_CODE) === String(workCenter); }); if (lv.length) wins = toWin(lv); }
      if (wins === null) { lv = all.filter(function (c) { return c.CAL_LEVEL === '工厂'; }); if (lv.length) wins = toWin(lv); }
    }
    if (wins === null) wins = schFallback(dateStr);
    SCH_WIN_CACHE[key] = wins; return wins;
  }
  /* 从 [ws,we] 中切掉占用区间，返回可用子段 */
  function schSplitBlocks(ws, we, blocks) {
    var segs = [{ s: ws, e: we }];
    (blocks || []).forEach(function (b) {
      var out = [];
      segs.forEach(function (g) {
        if (b.e <= g.s || b.s >= g.e) { out.push(g); return; }
        if (b.s > g.s) out.push({ s: g.s, e: b.s });
        if (b.e < g.e) out.push({ s: b.e, e: g.e });
      });
      segs = out;
    });
    return segs.filter(function (g) { return g.e > g.s; }).sort(function (a, b) { return a.s - b.s; });
  }
  /* 正排：把 hours 小时落到该资源上，起点不早于 fromMs；逐日消耗班次（跨天 / 跳假日 / 避占用） */
  function schPlace(resNo, wc, fromMs, hours, blocks) {
    var need = Math.max(0, hours) * 60, cur = new Date(fromMs), start = null, g, i, j;
    for (g = 0; g < 900; g++) {
      var base = schDayStartMs(cur), wins = schWindows(schDateStr(cur), resNo, wc);
      for (i = 0; i < wins.length; i++) {
        var segs = schSplitBlocks(base + wins[i].S * 60000, base + wins[i].E * 60000, blocks);
        for (j = 0; j < segs.length; j++) {
          var s = Math.max(segs[j].s, cur.getTime());
          if (segs[j].e <= s) continue;
          if (start === null) start = s;
          var cap = (segs[j].e - s) / 60000;
          if (need <= cap) return { s: start, e: s + need * 60000 };
          need -= cap; cur = new Date(segs[j].e);
        }
      }
      cur = new Date(base + 86400000);
    }
    return null;
  }
  /* 倒排：把 hours 小时排成「完工不晚于 latestMs」 */
  function schPlaceBack(resNo, wc, latestMs, hours, blocks) {
    var need = Math.max(0, hours) * 60, cur = new Date(latestMs), g, i, j;
    for (g = 0; g < 900; g++) {
      var base = schDayStartMs(cur), wins = schWindows(schDateStr(cur), resNo, wc);
      for (i = wins.length - 1; i >= 0; i--) {
        var segs = schSplitBlocks(base + wins[i].S * 60000, base + wins[i].E * 60000, blocks).slice().reverse();
        for (j = 0; j < segs.length; j++) {
          var e = Math.min(segs[j].e, cur.getTime());
          if (e <= segs[j].s) continue;
          var cap = (e - segs[j].s) / 60000;
          if (need <= cap) return { s: e - need * 60000, e: e };
          need -= cap; cur = new Date(segs[j].s);
        }
      }
      cur = new Date(base - 1);
    }
    return null;
  }
  /* 区间内该资源的可用机时（小时）—— 用于算资源利用率 */
  function schAvailHours(resNo, wc, fromMs, toMs) {
    var tot = 0, g = 0, cur = new Date(schDayStartMs(new Date(fromMs)));
    while (cur.getTime() <= toMs && g++ < 500) {
      var base = cur.getTime();
      schWindows(schDateStr(cur), resNo, wc).forEach(function (w) {
        var s = Math.max(base + w.S * 60000, fromMs), e = Math.min(base + w.E * 60000, toMs);
        if (e > s) tot += (e - s) / 3600000;
      });
      cur = new Date(base + 86400000);
    }
    return tot;
  }
  /* 换型时间：同产品 0；否则同组「上产品→本产品」> 同组通配 → 本产品 > 同组首行 */
  function schChangeover(group, fromProd, toProd) {
    if (!group || !fromProd || fromProd === toProd) return 0;
    var list = rows('BAS_CHANGEOVER').filter(function (c) { return c.RES_GROUP === group && +c.ENABLE_FLAG !== 0; });
    var hit = list.find(function (c) { return c.FROM_PRODUCT === fromProd && c.TO_PRODUCT === toProd; })
      || list.find(function (c) { return +c.IS_WILDCARD === 1 && c.TO_PRODUCT === toProd; })
      || list.find(function (c) { return c.TO_PRODUCT === toProd; });
    return hit ? (+hit.CHANGE_MIN || 0) : 0;
  }
  /* 把一个任务按「日期 × 班次」切分，数量按各段时长占比分摊 —— 用于生成日排产 */
  function schDaySplit(resNo, wc, sMs, eMs, planQty, blocks) {
    var days = [], g = 0, cur = new Date(schDayStartMs(new Date(sMs)));
    while (cur.getTime() <= eMs && g++ < 500) {
      var base = cur.getTime();
      schWindows(schDateStr(cur), resNo, wc).forEach(function (w) {
        schSplitBlocks(base + w.S * 60000, base + w.E * 60000, blocks).forEach(function (seg) {
          var s = Math.max(seg.s, sMs), e = Math.min(seg.e, eMs);
          if (e > s) days.push({ d: schDateStr(new Date(s)), shift: w.SHIFT, s: s, e: e });
        });
      });
      cur = new Date(base + 86400000);
    }
    if (!days.length) return [];
    var totalMin = days.reduce(function (a, x) { return a + (x.e - x.s) / 60000; }, 0) || 1;
    var acc = 0;
    return days.map(function (x, i) {
      var q = (i === days.length - 1) ? Math.max(0, (+planQty || 0) - acc) : Math.round((+planQty || 0) * ((x.e - x.s) / 60000) / totalMin);
      acc += q;
      return { date: x.d, shift: x.shift, s: x.s, e: x.e, qty: q };
    });
  }

  /* 自动排程引擎。opt 为可选项，**仅供离线种子生成工具**使用（界面调用一律不传）：
   *   baseDay  排程基准日 'YYYY-MM-DD'（默认 today()）——用于补历史剧本（如 9 月周期）
   *   verNo    指定版本号（默认 nextVerNo()）
   *   wos[]    指定参与排程的工单号（默认取「未完工/未入库」的工单）
   *   done     true = 生成「已完工的历史排程」：任务/日排产落已完工、不判延期 */
  function genSchedule(bNo, optRuleNo, opt) {
    opt = opt || {};
    if (!bNo && !optRuleNo && rows('SCH_VERSION').length) return;
    /* 排程规则口径：工作台指定的规则 > 本版本引用的规则 > 默认规则 > 第一条 */
    var batch = (bNo && rfind('MRP_BATCH', function (b) { return b.BATCH_NO === bNo; })) || rows('MRP_BATCH').find(function (b) { return b.BATCH_NO === st.batchNo; }) || rows('MRP_BATCH')[rows('MRP_BATCH').length - 1] || null;
    var rule = (optRuleNo && rfind('SCH_RULE', function (r) { return r.RULE_NO === optRuleNo; }))
      || (batch && batch.RULE_NO && rfind('SCH_RULE', function (r) { return r.RULE_NO === batch.RULE_NO; }))
      || rows('SCH_RULE').find(function (r) { return +r.IS_DEFAULT === 1; }) || rows('SCH_RULE')[0] || { RULE_NO: 'RULE-01' };
    SCH_CAL_DATES = null; SCH_WIN_CACHE = {};       // 日历缓存按次失效

    var verNo = opt.verNo || nextVerNo(), day0 = opt.baseDay || today();
    var baseMs = new Date(day0 + 'T00:00:00').getTime();
    var finite = +rule.FINITE_CAP !== 0;
    var useKit = +rule.KIT_CONSTRAINT === 1;
    var frozen = +rule.FREEZE_FIRST === 1;
    var backward = /倒|双向/.test(String(rule.SCH_DIR || '')) && !!rule.BOTTLENECK_STEP;

    /* —— 资源池：组成员 ∩ 已建资源 ∩ 支持该工序名 —— */
    var resAll = rows('BAS_RESOURCE').filter(function (r) { return +r.ENABLE_FLAG !== 0; });
    var resByNo = {}; resAll.forEach(function (r) { resByNo[r.RES_NO] = r; });
    var membersOf = {};
    rows('BAS_RESOURCE_GROUP').filter(function (g) { return +g.ENABLE_FLAG !== 0; }).forEach(function (g) {
      var m = String(g.MEMBER_RES || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      membersOf[g.GROUP_CODE] = m.length ? m : resAll.filter(function (r) { return r.RES_GROUP === g.GROUP_CODE; }).map(function (r) { return r.RES_NO; });
    });
    function cands(step) {
      if (!step.RES_GROUP) return [];
      return (membersOf[step.RES_GROUP] || []).map(function (no) { return resByNo[no]; }).filter(function (r) {
        if (!r) return false;
        var sup = String(r.SUPPORTED_STEP || '');
        if (!sup) return true;
        return sup.split('/').some(function (x) {
          x = x.trim();
          return x && step.STEP_NAME && (x === step.STEP_NAME || x.indexOf(step.STEP_NAME) >= 0 || step.STEP_NAME.indexOf(x) >= 0);
        });
      });
    }
    var busyUntil = {}, lastProd = {}, usedMin = {}, booked = {}, occByRes = {};
    resAll.forEach(function (r) { busyUntil[r.RES_NO] = 0; lastProd[r.RES_NO] = ''; usedMin[r.RES_NO] = 0; booked[r.RES_NO] = []; });
    rows('BAS_MAINTENANCE').forEach(function (m) {
      if (/完成|取消/.test(String(m.STATUS || ''))) return;
      var s = new Date(String(m.START_TIME || '').replace(' ', 'T')).getTime();
      var e = new Date(String(m.END_TIME || '').replace(' ', 'T')).getTime();
      if (isFinite(s) && isFinite(e) && e > s) (occByRes[m.RES_NO] = occByRes[m.RES_NO] || []).push({ s: s, e: e });
    });
    function blocksOf(resNo) { return (occByRes[resNo] || []).concat(booked[resNo] || []); }

    /* —— 口径：交期（未交销售订单交期）/ 齐套日（最早需求日）—— */
    var dueOf = {}, soOf = {};
    rows('RF_SO').forEach(function (s) {
      if (s.SO_NO && !soOf[s.ITEM_NO]) soOf[s.ITEM_NO] = s.SO_NO;
      if ((+s.OPEN_QTY || 0) <= 0) return;
      var t = new Date(String(s.DELIVERY_DATE || '').slice(0, 10) + 'T23:59:59').getTime();
      if (isFinite(t) && (!dueOf[s.ITEM_NO] || t < dueOf[s.ITEM_NO])) dueOf[s.ITEM_NO] = t;
    });
    var kitOf = {};
    rows('MRP_NET_REQ').forEach(function (n) {
      var t = new Date(String(n.REQ_DATE || '').slice(0, 10) + 'T00:00:00').getTime();
      if (isFinite(t) && (!kitOf[n.ITEM_NO] || t < kitOf[n.ITEM_NO])) kitOf[n.ITEM_NO] = t;
    });
    function dueMs(w) { return dueOf[w.ITEM_NO] || new Date(String(w.PLAN_END || day0).slice(0, 10) + 'T23:59:59').getTime(); }
    /* 机时（小时）：数量 × 该机台标准节拍；无节拍退回工艺工时 */
    function hoursOf(step, wo, res) {
      var cyc = +(res && res.STD_CYCLE) || 0;
      if (cyc <= 0) cyc = Math.max(1, Math.round((+step.STD_HOUR || 0) * 3600));
      return (+wo.PLAN_QTY || 0) * cyc / 3600;
    }

    /* —— 工单排序：ORDER_SORT（订单排序）+ OPT_TARGET 真正参与 —— */
    var srt = String(rule.ORDER_SORT || ''), optTgt = String(rule.OPT_TARGET || '');
    var wos = rows('RF_WORK_ORDER').filter(function (w) {
      if (opt.wos) return opt.wos.indexOf(w.WO_NO) >= 0;
      return !/完工|入库/.test(String(w.STATUS || ''));
    });
    wos.sort(function (a, b) {
      if (opt.wos) return opt.wos.indexOf(a.WO_NO) - opt.wos.indexOf(b.WO_NO);
      if (/聚簇/.test(srt) && String(a.ITEM_NO) !== String(b.ITEM_NO)) return String(a.ITEM_NO) < String(b.ITEM_NO) ? -1 : 1;
      var d = dueMs(a) - dueMs(b); if (d) return d;
      if (frozen || /冻结/.test(srt)) {
        var fa = /执行|下达/.test(String(a.STATUS || '')) ? 0 : 1, fb = /执行|下达/.test(String(b.STATUS || '')) ? 0 : 1;
        if (fa !== fb) return fa - fb;
      }
      if (/在制品|在制/.test(opt)) return (+a.PLAN_QTY || 0) - (+b.PLAN_QTY || 0);
      return (+a.PRIORITY || 9) - (+b.PRIORITY || 9);
    });
    /* —— 选机：RES_SELECT（资源优选）真正参与 —— */
    function pickRes(list, prod) {
      if (!list.length) return null;
      var sel = String(rule.RES_SELECT || '');
      return list.slice().sort(function (a, b) {
        if (/节拍最快/.test(sel)) return (+a.STD_CYCLE || 9e9) - (+b.STD_CYCLE || 9e9) || a.RES_NO.localeCompare(b.RES_NO);
        if (/换型|设置/.test(sel) && !/负载/.test(sel)) {
          var ca = schChangeover(a.RES_GROUP, lastProd[a.RES_NO], prod), cb = schChangeover(b.RES_GROUP, lastProd[b.RES_NO], prod);
          return ca - cb || (busyUntil[a.RES_NO] || 0) - (busyUntil[b.RES_NO] || 0) || a.RES_NO.localeCompare(b.RES_NO);
        }
        return (busyUntil[a.RES_NO] || 0) - (busyUntil[b.RES_NO] || 0) || a.RES_NO.localeCompare(b.RES_NO);
      })[0];
    }

    insert('SCH_VERSION', { VERSION_NO: verNo, RULE_NO: rule.RULE_NO, VERSION_TYPE: '日排产', RANGE_FROM: day0, RANGE_TO: day0, GEN_TIME: now(), GEN_BY: '计划员', TOTAL_TASK: 0, DELAY_TASK: 0, TOTAL_CHANGE_MIN: 0, UTIL_RATE: 0, ROLLBACK_FLAG: 0, DOC_TYPE: 'SCHV', DOC_DATE: day0, STATUS: opt.done ? '已发布' : '草稿' });

    var seq = 0, changeMin = 0, delayed = 0, skipped = [], minMs = null, maxMs = null, dayPlans = [];

    wos.forEach(function (wo) {
      /* 只排本厂工序（外协 RES_GROUP 为空不进本厂排产） */
      var steps = rows('RF_ROUTE').filter(function (r) { return r.ROUTE_NO === wo.ROUTE_NO && !!r.RES_GROUP; })
        .sort(function (a, b) { return String(a.STEP_NO).localeCompare(String(b.STEP_NO)); });
      var kitMs = useKit && kitOf[wo.ITEM_NO] ? kitOf[wo.ITEM_NO] : 0;
      var psMs = new Date(String(wo.PLAN_START || day0).slice(0, 10) + 'T00:00:00').getTime();
      var floorMs = Math.max(baseMs, kitMs, isFinite(psMs) ? psMs : 0);
      /* ok=false 起步：只有「双向分支成功」才置 true；否则（含正排规则）落到下面的正排分支
       * ⚠️ 不要写成 ok=true —— 正排规则 bi 恒为 -1、谁也不改 ok，会导致正排分支永不执行、产出 0 条任务 */
      var placed = [], ok = false, bi = -1, k;

      /* 双向：瓶颈工序以「交期 − 瓶颈后工序机时」为完工上限，瓶颈及其前道倒排，后道正排 */
      if (backward) {
        for (k = 0; k < steps.length; k++) if (steps[k].STEP_NAME === rule.BOTTLENECK_STEP) { bi = k; break; }
      }
      if (bi > 0) {
        var afterH = 0, cs, rr;
        for (k = bi + 1; k < steps.length; k++) {
          cs = cands(steps[k]);
          rr = cs.length ? cs.reduce(function (x, y) { return (+x.STD_CYCLE || 9e9) <= (+y.STD_CYCLE || 9e9) ? x : y; }) : null;
          afterH += hoursOf(steps[k], wo, rr);
        }
        var cursor = dueMs(wo) - afterH * 3600000, allOk = true;
        for (k = bi; k >= 0; k--) {
          var lb = cands(steps[k]); if (!lb.length) { allOk = false; break; }
          var rb = pickRes(lb, wo.ITEM_NO);
          var cb2 = schChangeover(steps[k].RES_GROUP, lastProd[rb.RES_NO], wo.ITEM_NO);
          var hb = hoursOf(steps[k], wo, rb);
          var pb = schPlaceBack(rb.RES_NO, rb.WORK_CENTER, cursor, hb + cb2 / 60, blocksOf(rb.RES_NO));
          if (!pb || pb.s < baseMs) { allOk = false; break; }
          placed[k] = { step: steps[k], res: rb, s: pb.s, e: pb.e, cm: cb2, h: hb };
          cursor = pb.s;
        }
        if (allOk) {
          cursor = placed[bi].e;
          for (k = bi + 1; k < steps.length && allOk; k++) {
            var lf = cands(steps[k]); if (!lf.length) { skipped.push(wo.WO_NO + ' ' + steps[k].STEP_NAME); continue; }
            var rf = pickRes(lf, wo.ITEM_NO);
            var cf = schChangeover(steps[k].RES_GROUP, lastProd[rf.RES_NO], wo.ITEM_NO);
            var hf = hoursOf(steps[k], wo, rf);
            var from = Math.max(cursor, finite ? (busyUntil[rf.RES_NO] || 0) : 0);
            var pf = schPlace(rf.RES_NO, rf.WORK_CENTER, from, hf + cf / 60, blocksOf(rf.RES_NO));
            if (!pf) { allOk = false; break; }
            placed[k] = { step: steps[k], res: rf, s: pf.s, e: pf.e, cm: cf, h: hf };
            cursor = pf.e;
          }
        }
        ok = allOk; if (!ok) placed = [];
      }

      if (!ok) {
        /* 正排：起点 = max(排程起点, 工单计划开工, 齐套日)；有限产能 + 换型计入 */
        var cur = floorMs; placed = [];
        steps.forEach(function (s, idx) {
          var list = cands(s);
          if (!list.length) { skipped.push(wo.WO_NO + ' ' + s.STEP_NAME); return; }
          var res = pickRes(list, wo.ITEM_NO);
          var cm = schChangeover(s.RES_GROUP, lastProd[res.RES_NO], wo.ITEM_NO);
          var h = hoursOf(s, wo, res);
          var from = Math.max(cur, finite ? (busyUntil[res.RES_NO] || 0) : 0);
          var p = schPlace(res.RES_NO, res.WORK_CENTER, from, h + cm / 60, blocksOf(res.RES_NO));
          if (!p) { skipped.push(wo.WO_NO + ' ' + s.STEP_NAME + '(日历内排不下)'); return; }
          placed[idx] = { step: s, res: res, s: p.s, e: p.e, cm: cm, h: h };
          cur = p.e;
        });
      }

      /* 落库：排程任务 + 日排产 */
      var due = dueMs(wo), firstIdx = -1, fi;
      for (fi = 0; fi < steps.length; fi++) if (placed[fi]) { firstIdx = fi; break; }
      steps.forEach(function (s, idx) {
        var pl = placed[idx]; if (!pl) return;
        seq++;
        /* 锁定口径：启用「冻结优先」的规则下，在制工单（执行中/已下达）的**首道已开工工序**锁定，
         * 表示冻结期内已投产的工序不参与滚动重排；其余工序可重排。
         * ⚠️ 不要锁全部工序（否则整版排产都不可调），也不要不锁（冻结机制形同虚设）。 */
        var lock = (frozen && idx === firstIdx && /执行|下达/.test(String(wo.STATUS || ''))) ? 1 : 0;
        var delay = pl.e > due ? 1 : 0; if (delay && !opt.done) delayed++;
        var dp = schDaySplit(pl.res.RES_NO, pl.res.WORK_CENTER, pl.s, pl.e, wo.PLAN_QTY, blocksOf(pl.res.RES_NO));
        changeMin += pl.cm;
        busyUntil[pl.res.RES_NO] = Math.max(busyUntil[pl.res.RES_NO] || 0, pl.e);
        booked[pl.res.RES_NO].push({ s: pl.s, e: pl.e });
        lastProd[pl.res.RES_NO] = wo.ITEM_NO;
        usedMin[pl.res.RES_NO] += (pl.e - pl.s) / 60000;
        if (minMs === null || pl.s < minMs) minMs = pl.s;
        if (maxMs === null || pl.e > maxMs) maxMs = pl.e;
        insert('SCH_TASK', {
          /* 任务主键带版本号：原来只有日期 + 序号，同一天再排一次会覆盖上次的任务行 */
          TASK_ID: 'T-' + String(verNo).replace(/^SCHV-/, '') + '-' + ('000' + seq).slice(-3), VERSION_NO: verNo,
          WO_NO: wo.WO_NO, SO_NO: soOf[wo.ITEM_NO] || '', ITEM_NO: wo.ITEM_NO, ITEM_NAME: wo.ITEM_NAME,
          STEP_NO: s.STEP_NO, STEP_NAME: s.STEP_NAME, RES_NO: pl.res.RES_NO, RES_GROUP: s.RES_GROUP,
          START_TIME: schMs(pl.s), END_TIME: schMs(pl.e), PLAN_QTY: wo.PLAN_QTY,
          DONE_QTY: opt.done ? (wo.PLAN_QTY || 0) : 0,
          CHANGE_MIN: pl.cm, KIT_DATE: kitOf[wo.ITEM_NO] ? schDateStr(new Date(kitOf[wo.ITEM_NO])) : '',
          LOCK_FLAG: lock, RUSH_FLAG: 0,
          DELAY_FLAG: opt.done ? 0 : delay, TASK_STATUS: opt.done ? '已完工' : '已排'
        });
        dp.forEach(function (x) {
          dayPlans.push({ VERSION_NO: verNo, WO_NO: wo.WO_NO, STEP_NO: s.STEP_NO, STEP_NAME: s.STEP_NAME,
            PLAN_DATE: x.date, RES_NO: pl.res.RES_NO, SHIFT: x.shift, PLAN_QTY: x.qty,
            PLAN_START: schMs(x.s), PLAN_END: schMs(x.e), STATUS: opt.done ? '已完工' : '已排' });
        });
      });
    });

    /* 日排产落库：主键同样要带版本号，否则不同版本的同序号日计划会互相覆盖 */
    dayPlans.forEach(function (p, i) {
      p.DP_ID = 'DP-' + String(verNo).replace(/^SCHV-/, '') + '-' + ('000' + (i + 1)).slice(-3);
      insert('SCH_DAY_PLAN', p);
    });

    /* —— 版本汇总：任务数 / 延期数 / 总换型 / 资源利用率（回填，不再恒 0）—— */
    var usedH = 0, capH = 0;
    resAll.forEach(function (r) {
      if (!usedMin[r.RES_NO]) return;
      usedH += usedMin[r.RES_NO] / 60;
      if (minMs !== null && maxMs !== null) capH += schAvailHours(r.RES_NO, r.WORK_CENTER, minMs, maxMs);
    });
    var util = capH > 0 ? Math.min(1, usedH / capH) : 0;
    update('SCH_VERSION', rows('SCH_VERSION').find(function (v) { return v.VERSION_NO === verNo; }).ID, {
      TOTAL_TASK: seq, DELAY_TASK: delayed, TOTAL_CHANGE_MIN: changeMin, UTIL_RATE: +util.toFixed(4),
      RANGE_FROM: minMs !== null ? schDateStr(new Date(minMs)) : day0,
      RANGE_TO: maxMs !== null ? schDateStr(new Date(maxMs)) : day0
    });
    var ps = rows('PP_PLAN_SUGGEST')[0]; if (ps) linkDocs('PP_PLAN_SUGGEST', ps.SUGGEST_NO, 'SCH_VERSION', verNo, '执行自动排程');
    linkDocs('SCH_RULE', rule.RULE_NO, 'SCH_VERSION', verNo, '按规则排程');
    toast('已按规则 ' + rule.RULE_NO + ' 排程 ' + verNo + '：任务 ' + seq + ' 条 · 延期 ' + delayed + ' 条 · 利用率 ' + (util * 100).toFixed(1) + '%' + (skipped.length ? ' · ' + skipped.length + ' 道工序无可用资源已跳过' : ''));
  }
  /* ⑥ 人工调整：登记一条拖拽 / 插单调整记录 */
  function genAdjust() {
    var ver = rows('SCH_VERSION')[0]; if (!ver) { toast('请先执行自动排程'); return; }
    if (rows('SCH_ADJUST').length) return;
    var t = rows('SCH_TASK').find(function (x) { return x.VERSION_NO === ver.VERSION_NO; }) || {};
    var id = 'ADJ-' + ymd() + '-001';
    insert('SCH_ADJUST', { ADJ_ID: id, VERSION_NO: ver.VERSION_NO, TASK_ID: t.TASK_ID || '', WO_NO: t.WO_NO || '', STEP_NO: t.STEP_NO || '', ADJ_TYPE: '拖拽调整', FROM_RES: t.RES_NO || '', TO_RES: t.RES_NO || '', FROM_TIME: t.START_TIME || '', TO_TIME: t.START_TIME || '', RUSH_MODE: '', IMPACT_ORDERS: '受影响的后续任务将顺延，插单前已出影响预览', CONFLICT_MSG: '资源无冲突；与上道工序衔接 OK', ADJ_BY: '计划员', ADJ_TIME: now(), STATUS: '已生效' });
    linkDocs('SCH_VERSION', ver.VERSION_NO, 'SCH_ADJUST', id, '登记人工调整');
    toast('已登记人工调整 ' + id);
  }
  /* V5 口径：本期生产排程不含工程变更（ECN），原 genEcn 已移除。
     BOM / 工艺版本变更引起的重排与在制物料替换列入后续版本评估。 */

  /* ---------- 甘特时间轴公共件（真时间轴：条按真实开工~完工水平定位，而不是「工时占比」） ---------- */
  var GT_WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function gtP2(n) { return (n < 10 ? '0' : '') + n; }
  function gtTms(v) { if (!v) return NaN; var d = new Date(String(v).replace(/-/g, '/')); return isNaN(d) ? NaN : d.getTime(); }
  function gtDay0(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function gtDate(ms) { var d = new Date(ms); return d.getFullYear() + '-' + gtP2(d.getMonth() + 1) + '-' + gtP2(d.getDate()); }
  function gtMD(ms) { var d = new Date(ms); return gtP2(d.getMonth() + 1) + '-' + gtP2(d.getDate()); }
  /* 工厂日历按日索引：{ 'YYYY-MM-DD': {off, from, to} }——用于甘特底纹（全休日 / 非班次时段） */
  function gtCal(dFrom, dTo) {
    var by = {};
    rawRows('BAS_CALENDAR').forEach(function (c) {
      if (c.CAL_LEVEL !== '工厂') return;
      var d = rd(c.WORK_DATE); (by[d] = by[d] || []).push(c);
    });
    var out = {}, cur = gtDay0(gtTms(dFrom)), end = gtDay0(gtTms(dTo));
    for (; cur <= end; cur += 86400000) {
      var list = (by[gtDate(cur)] || []).filter(function (c) { return rn(c.CAP_HOURS) > 0 && !c.IS_HOLIDAY; });
      var f = 24, t = 0;
      list.forEach(function (c) {
        var a = gtTms(c.WORK_START), b = gtTms(c.WORK_END);
        if (a === a) { var ha = (a - gtDay0(a)) / 3600000; if (ha < f) f = ha; }
        if (b === b) { var hb = (b - gtDay0(b)) / 3600000; if (hb === 0) hb = 24; if (hb > t) t = hb; }
      });
      out[gtDate(cur)] = { off: !list.length, from: list.length ? f : 0, to: list.length ? (t || 24) : 24 };
    }
    return out;
  }
  /* 时间重叠的任务自动分层（泳道）——同机台 / 同工序的多条并行任务不会互相压住 */
  function gtLanes(arr) {
    var lanes = [], laneOf = {};
    arr.slice().sort(function (a, b) { return gtTms(a.START_TIME) - gtTms(b.START_TIME); }).forEach(function (t) {
      var s = gtTms(t.START_TIME), e = gtTms(t.END_TIME);
      for (var li = 0; ; li++) {
        if (!lanes[li]) lanes[li] = [];
        if (!lanes[li].some(function (q) { return s < q.e && e > q.s; })) { lanes[li].push({ s: s, e: e }); laneOf[t.TASK_ID] = li; break; }
      }
    });
    return { n: lanes.length, of: laneOf };
  }
  function gtBarTag(t, mode) {
    if (mode === 'step') return String(t.WO_NO || '');
    return String(t.STEP_NO || '') + (t.STEP_NAME ? ' ' + t.STEP_NAME : '');
  }
  function gtGroupTitle(k, arr, mode) {
    var nm, cnt;
    if (mode === 'res') {
      var r = rfind('BAS_RESOURCE', function (x) { return x.RES_NO === k; });
      nm = k + (r && r.RES_NAME ? ' · ' + String(r.RES_NAME).replace(new RegExp('^' + k + '\\s*'), '') : '');
      cnt = arr.length + ' 条';
    } else if (mode === 'step') {
      var res = {}; arr.forEach(function (x) { if (x.RES_NO) res[x.RES_NO] = 1; });
      nm = k; cnt = arr.length + ' 条 · ' + Object.keys(res).length + ' 台';
    } else {
      var w = arr[0] || {};
      nm = k + (w.ITEM_NAME ? ' · ' + w.ITEM_NAME : '');
      cnt = arr.length + ' 道工序';
    }
    return '<span class="gt-nm" title="' + esc(nm + '（' + cnt + '）') + '">' + esc(nm) + '</span>' +
      '<span class="gt-cnt">' + esc(cnt) + '</span>';
  }
  /* 甘特渲染（完整页 viewGantt 与排程工作台缩略甘特共用）
   *   opt = { pph 每小时像素, labW 左列宽, hdr 是否渲染日期表头, tags 是否渲染条右侧标注, label 左表头文案 } */
  function gtRender(tasks, mode, opt) {
    opt = opt || {};
    var pph = opt.pph || 4, ppd = pph * 24, labW = opt.labW || 210;
    tasks = (tasks || []).filter(function (t) { return gtTms(t.START_TIME) === gtTms(t.START_TIME); });
    if (!tasks.length) return '<div class="empty sm">该版本暂无排程任务。</div>';
    var t0 = Infinity, t1 = -Infinity;
    tasks.forEach(function (t) { var s = gtTms(t.START_TIME), e = gtTms(t.END_TIME); if (s < t0) t0 = s; if (e > t1) t1 = e; });
    var ws = gtDay0(t0), we = gtDay0(t1) + 86400000;
    if ((we - ws) / 86400000 < 2) we = ws + 86400000 * 2;
    var days = Math.round((we - ws) / 86400000);
    /* 自适应缩放：给定目标总宽 fitW 时按整段时长反算每小时像素（夹在 0.8~9px/h） */
    if (opt.fitW) pph = Math.max(0.8, Math.min(9, opt.fitW / ((we - ws) / 3600000)));
    ppd = pph * 24;
    var TL = Math.round(days * ppd);
    var cal = gtCal(gtDate(ws), gtDate(we - 1));
    function Xp(ms) { return Math.round((ms - ws) / 3600000 * pph); }
    function Wp(a, b) { return Math.max(4, Math.round((b - a) / 3600000 * pph)); }

    /* 表头（日期 + 星期）与底纹层（全休日 / 非班次时段）——两张同宽网格保证对齐 */
    var hd = '', bg = '';
    for (var i = 0; i < days; i++) {
      var c0 = ws + i * 86400000, info = cal[gtDate(c0)] || { off: true, from: 0, to: 24 };
      var band = '';
      if (!info.off && (info.from > 0 || info.to < 24)) {
        if (info.from > 0) band += '<div class="gt-offband" style="left:0;width:' + Math.round(info.from * pph) + 'px"></div>';
        if (info.to < 24) band += '<div class="gt-offband" style="left:' + Math.round(info.to * pph) + 'px;right:0"></div>';
      }
      hd += '<div class="gt-day' + (info.off ? ' off' : '') + '" style="width:' + ppd + 'px">' +
        '<div class="gt-d1">' + (ppd >= 66 ? gtMD(c0) : new Date(c0).getDate()) + '</div>' +
        (ppd >= 66 ? '<div class="gt-d2">' + GT_WD[new Date(c0).getDay()] + (info.off ? ' 休' : '') + '</div>' : '') + '</div>';
      bg += '<div class="gt-day' + (info.off ? ' off' : '') + '" style="width:' + ppd + 'px">' + band + '</div>';
    }

    /* 分组 → 泳道分层 → 条形 */
    function keyOf(t) { return mode === 'res' ? (t.RES_NO || '未指定机台') : (mode === 'step' ? ((t.STEP_NO || '') + ' ' + (t.STEP_NAME || '')) : (t.WO_NO || '未指定工单')); }
    var groups = {};
    tasks.forEach(function (t) { var k = keyOf(t); (groups[k] = groups[k] || []).push(t); });
    var BH = 15, GAP = 5, PADY = 8, rowsHtml = '';
    Object.keys(groups).sort().forEach(function (k) {
      var arr = groups[k], lz = gtLanes(arr), nL = Math.max(1, lz.n);
      var rowH = PADY * 2 + nL * BH + (nL - 1) * GAP;
      var laneArr = {};
      arr.forEach(function (t) { var li = lz.of[t.TASK_ID] || 0; (laneArr[li] = laneArr[li] || []).push(t); });
      Object.keys(laneArr).forEach(function (li) { laneArr[li].sort(function (a, b) { return gtTms(a.START_TIME) - gtTms(b.START_TIME); }); });
      var bars = '';
      arr.forEach(function (t) {
        var s = gtTms(t.START_TIME), e = gtTms(t.END_TIME), li = lz.of[t.TASK_ID] || 0;
        var left = Xp(s), w = Wp(s, e), top = PADY + li * (BH + GAP);
        var col = t.DELAY_FLAG == 1 ? 'var(--bad)' : (t.RUSH_FLAG == 1 ? 'var(--warn)' : (t.LOCK_FLAG == 1 ? '#94a3b8' : 'var(--ok)'));
        var done = +t.PLAN_QTY ? Math.round((+t.DONE_QTY || 0) / (+t.PLAN_QTY) * 100) : 0;
        var tip = [t.TASK_ID, (t.WO_NO || '') + ' ' + (t.ITEM_NAME || ''), (t.STEP_NO || '') + ' ' + (t.STEP_NAME || ''), t.RES_NO || '',
          String(t.START_TIME).slice(5, 16) + ' ~ ' + String(t.END_TIME).slice(5, 16) + '（' + rhours(t.START_TIME, t.END_TIME).toFixed(1) + ' h）',
          '计划 ' + (+t.PLAN_QTY || 0) + ' / 已完 ' + (+t.DONE_QTY || 0) + (done ? '（' + done + '%）' : ''),
          t.DELAY_FLAG == 1 ? '⚠ 延期' : (t.RUSH_FLAG == 1 ? '插单' : (t.LOCK_FLAG == 1 ? '锁定（在制）' : '正常'))
        ].join('\n');
        bars += '<div class="gt-bar" title="' + esc(tip) + '" style="left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;background:' + col + '">' +
          (done > 0 ? '<span class="gt-prog" style="width:' + Math.min(100, done) + '%"></span>' : '') +
          (w >= 78 ? '<span class="gt-in">' + esc(gtBarTag(t, mode)) + '</span>' : '') + '</div>';
        /* 条太窄时把标注放到条右侧——仅在「到下一条之间有空位」时才画，避免压住后续任务 */
        if (opt.tags === false || w >= 78) return;
        var la = laneArr[li] || [], nxt = null;
        for (var q = 0; q < la.length; q++) { if (gtTms(la[q].START_TIME) >= e) { nxt = la[q]; break; } }
        var room = (nxt ? Xp(gtTms(nxt.START_TIME)) : TL) - (left + w);
        if (room >= 96) bars += '<div class="gt-tag" style="left:' + (left + w + 7) + 'px;top:' + top + 'px">' +
          esc(gtBarTag(t, mode)) + ' · ' + rhours(t.START_TIME, t.END_TIME).toFixed(1) + 'h</div>';
      });
      rowsHtml += '<div class="gt-row gt-grprow"><div class="gt-lab">' + gtGroupTitle(k, arr, mode) + '</div>' +
        '<div class="gt-cell" style="width:' + TL + 'px;height:' + rowH + 'px">' + bars + '</div></div>';
    });

    var nowMs = Date.now();
    var nowX = (pph >= 1 && nowMs >= ws && nowMs <= we) ? Xp(nowMs) : null;
    var h = '<div class="gt-scroll"><div class="gt-inner" style="--gt-lab:' + labW + 'px">';
    if (opt.hdr !== false) {
      h += '<div class="gt-row gt-hdr"><div class="gt-lab">' + esc(opt.label || '分组 / 资源') + '</div>' +
        '<div class="gt-cell" style="width:' + TL + 'px"><div class="gt-days">' + hd + '</div></div></div>';
    }
    h += '<div class="gt-body"><div class="gt-bg" style="width:' + TL + 'px"><div class="gt-days">' + bg + '</div>' +
      (nowX === null ? '' : '<div class="gt-nowline" style="left:' + nowX + 'px"></div>') + '</div>' +
      '<div class="gt-rows">' + rowsHtml + '</div></div></div></div>';
    return h;
  }

  /* ---------- 排产甘特图（订单 / 工序 / 机台三视角 + 计划与实绩对比） ---------- */
  function viewGantt() {
    var vers = rows('SCH_VERSION');
    if (!vers.length) return '<div class="card"><h2>生产排程 · 排产甘特图</h2><div class="empty">暂无排程版本，请先到「生产排程 → 排程工作台」运行自动排程。</div></div>';
    var verNo = st.ganttVer && vers.some(function (v) { return v.VERSION_NO === st.ganttVer; }) ? st.ganttVer : vers[0].VERSION_NO;
    var mode = st.ganttMode || 'res';
    var tasks = rows('SCH_TASK').filter(function (t) { return t.VERSION_NO === verNo; });
    /* 三视角：分组维度 / 组标题 / 条内标注各不同，切换后分组与排序随之变化
     *   机台视角：按「资源/机台」分组，组标题机台号+名称，条内标「工单 · 工序」
     *   工序视角：按「工序」分组，组标题工序号+工序名，条内标「机台 · 工单」
     *   订单视角：按「工单」分组，组标题工单号+品名，条内标「工序 · 机台」 */
    var modeName = { res: '机台视角', step: '工序视角', order: '订单视角' };
    var modeHint = {
      res: '按<b>机台（资源）</b>分组——每个机台一行，行内是该机台要做的各道工序；用于看设备负载与冲突',
      step: '按<b>工序</b>分组——每道工序一行，行内是各工单在该工序的加工任务；用于看工序流转与瓶颈',
      order: '按<b>工单（订单）</b>分组——每个工单一行，行内是该工单的完整工艺路线；用于看单张订单的排产进度'
    };
    var curVer = vers.find(function (v) { return v.VERSION_NO === verNo; });
    var h = '<div class="card"><div class="board-head"><h2>生产排程 · 排产甘特图</h2>' +
      '<div class="chips">' + ['res', 'step', 'order'].map(function (m) { return '<button class="chip' + (mode === m ? ' active' : '') + '" data-gm="' + m + '">' + modeName[m] + '</button>'; }).join('') + '</div></div>' +
      '<div class="board-filter"><span class="mini">排程版本</span>' +
      '<select id="ganttVer" class="mini-sel">' + vers.map(function (v) { return '<option value="' + esc(v.VERSION_NO) + '"' + (v.VERSION_NO === verNo ? ' selected' : '') + '>' + esc(v.VERSION_NO) + ' · ' + esc(v.RULE_NO) + ' · ' + esc(v.STATUS) + '</option>'; }).join('') + '</select>' +
      '<span class="mini">共 ' + tasks.length + ' 条任务 · 条按<b>真实开工~完工</b>水平定位；红色=延期、橙色=插单、灰色=锁定、绿色=正常</span></div>' +
      '<p class="mini" style="margin-top:8px"><b>' + modeName[mode] + '</b>：' + modeHint[mode] + '。' +
      '「排程版本」= 一次自动排程产出的<b>整版排产结果快照</b>（含版本号 / 引用规则 / 计划区间 / 任务集合 / 资源利用率 / 状态），' +
      '用于对比不同规则或不同时点的排程、发布其中一版下车间、以及滚动重排留痕；同一版本下所有任务共享同一套排程口径。</p></div>';

    if (curVer) {
      h += '<div class="card"><h3>版本信息 · ' + esc(curVer.VERSION_NO) + '</h3><div class="kv-grid">' +
        '<div class="kv"><span class="k">引用规则</span><span class="v">' + esc(curVer.RULE_NO || '-') + '</span></div>' +
        '<div class="kv"><span class="k">版本类型</span><span class="v">' + esc(curVer.VERSION_TYPE || '-') + '</span></div>' +
        '<div class="kv"><span class="k">计划区间</span><span class="v">' + esc(String(curVer.RANGE_FROM || '').slice(0, 10)) + ' ~ ' + esc(String(curVer.RANGE_TO || '').slice(0, 10)) + '</span></div>' +
        '<div class="kv"><span class="k">生成 / 发布</span><span class="v">' + esc(curVer.GEN_BY || '-') + ' · ' + esc(String(curVer.GEN_TIME || '').slice(0, 16)) + (curVer.PUBLISH_TIME ? ' → 发布 ' + esc(String(curVer.PUBLISH_TIME).slice(0, 16)) : '') + '</span></div>' +
        '<div class="kv"><span class="k">任务数 / 延期</span><span class="v">' + esc(tasks.length) + ' / ' + esc(curVer.DELAY_TASK || 0) + '</span></div>' +
        '<div class="kv"><span class="k">资源利用率</span><span class="v">' + esc((brNum(curVer.UTIL_RATE) * 100).toFixed(1)) + '%</span></div>' +
        '<div class="kv"><span class="k">状态</span><span class="v">' + statusTag(curVer.STATUS) + '</span></div>' +
        '</div></div>';
    }

    if (!tasks.length) {
      return h + '<div class="card"><h3>该版本暂无排程任务</h3><p class="mini">版本 <b>' + esc(verNo) + '</b> 在当前数据中没有任何排程任务（仅登记了版本头信息）。' +
        '演示数据里任务主要落在首个版本，可切换到有任务的版本查看；若需该版本也有任务，可在「生产排程 → 排程工作台」用对应规则重新执行自动排程。</p></div>';
    }

    /* ★ 甘特时间轴：条按真实开工~完工水平定位（不是「工时占比」），横轴为日期刻度。
     *   底纹 = 工厂日历（全休日 / 非班次时段），重叠任务自动分层，红色竖线为「今天」。 */
    var ZP = { tight: 1.5, std: 4, loose: 9 };
    var gz = ZP[st.ganttZoom] ? st.ganttZoom : 'std';
    var labOf = { res: '机台 / 资源', step: '工序', order: '工单 / 订单' };
    var gCnt = {}; tasks.forEach(function (t) { var k = mode === 'res' ? (t.RES_NO || '未指定机台') : (mode === 'step' ? ((t.STEP_NO || '') + ' ' + (t.STEP_NAME || '')) : (t.WO_NO || '未指定工单')); gCnt[k] = 1; });
    var nowIn = (function () { var n = Date.now(), a = Infinity, b = -Infinity; tasks.forEach(function (t) { var s = gtTms(t.START_TIME), e = gtTms(t.END_TIME); if (s < a) a = s; if (e > b) b = e; }); return n >= gtDay0(a) && n <= gtDay0(b) + 86400000; })();
    h += '<div class="card"><div class="board-head"><h3 style="margin:0">' + modeName[mode] + ' · 时间轴甘特（' + Object.keys(gCnt).length + ' 组）</h3>' +
      '<span class="mini">横轴 = 日期刻度，条按真实开工~完工定位；同组内时间重叠的任务自动分层</span>' +
      '<span class="spacer"></span><span class="mini">缩放</span>' +
      [['tight', '紧凑'], ['std', '标准'], ['loose', '宽松']].map(function (z) {
        return '<button class="chip' + (gz === z[0] ? ' active' : '') + '" data-gz="' + z[0] + '">' + z[1] + '</button>';
      }).join('') + '</div>' +
      gtRender(tasks, mode, { pph: ZP[gz], hdr: true, tags: true, label: labOf[mode], labW: 210 }) +
      '<div class="gt-legend"><span><i style="background:var(--ok)"></i>正常</span><span><i style="background:var(--warn)"></i>插单</span>' +
      '<span><i style="background:#94a3b8"></i>锁定（在制）</span><span><i style="background:var(--bad)"></i>延期</span>' +
      '<span><i style="background:rgba(15,23,42,.42)"></i>深色覆盖段 = 已完成实绩</span>' +
      '<span><i style="background:#eef1f6"></i>灰底 = 全休日（周日 / 节假日）</span>' +
      '<span><i style="background:#f7f8fc"></i>浅底 = 非班次时段</span>' +
      (nowIn ? '<span><i style="background:var(--bad)"></i>红色竖线 = 今天</span>' : '') + '</div></div>';

    /* 明细表：按当前视角的维度排序（机台→资源；工序→工序号；订单→工单），再按开工时间 */
    var detailSort = tasks.slice().sort(function (a, b) {
      var ka = mode === 'res' ? (a.RES_NO || '') : (mode === 'step' ? (a.STEP_NO || '') : (a.WO_NO || ''));
      var kb = mode === 'res' ? (b.RES_NO || '') : (mode === 'step' ? (b.STEP_NO || '') : (b.WO_NO || ''));
      var c = String(ka).localeCompare(String(kb));
      return c !== 0 ? c : String(a.START_TIME).localeCompare(String(b.START_TIME));
    });
    h += '<div class="card"><h3>排程任务明细（按' + modeName[mode] + '排序）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>任务ID</th><th>工单</th><th>品名</th><th>工序</th><th>资源</th><th>计划开工</th><th>计划完工</th>' +
      '<th>计划数</th><th>已完</th><th>换型(分)</th><th>齐套日</th><th>锁定</th><th>插单</th><th>延期</th><th>状态</th></tr></thead><tbody>' +
      detailSort.map(function (t) {
        return '<tr><td class="pk">' + esc(t.TASK_ID) + '</td><td>' + esc(t.WO_NO) + '</td><td>' + esc(t.ITEM_NAME) + '</td>' +
          '<td>' + esc(t.STEP_NO + ' ' + t.STEP_NAME) + '</td><td>' + esc(t.RES_NO) + '</td>' +
          '<td>' + esc(String(t.START_TIME).slice(0, 16)) + '</td><td>' + esc(String(t.END_TIME).slice(0, 16)) + '</td>' +
          '<td class="cellnum">' + (+t.PLAN_QTY || 0) + '</td><td class="cellnum">' + (+t.DONE_QTY || 0) + '</td>' +
          '<td class="cellnum">' + (+t.CHANGE_MIN || 0) + '</td><td>' + esc(String(t.KIT_DATE || '').slice(0, 10)) + '</td>' +
          '<td>' + (t.LOCK_FLAG == 1 ? '是' : '') + '</td><td>' + (t.RUSH_FLAG == 1 ? '是' : '') + '</td>' +
          '<td>' + (t.DELAY_FLAG == 1 ? '<span class="tag bad">延期</span>' : '') + '</td><td>' + statusTag(t.TASK_STATUS) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return h;
  }

  /* ---------- 关系图（ER 概要） ---------- */
  function viewEr() {
    var svg = '<svg class="er-svg" width="100%" viewBox="0 0 920 520" xmlns="http://www.w3.org/2000/svg">';
    var boxes = [['BAS_DEMAND', 120, 30], ['MRP_BATCH', 120, 150], ['MRP_NET_REQ', 120, 270], ['MRP_KIT_CHECK', 360, 270], ['MRP_KIT_SHORT', 360, 390], ['PR_SUGGEST', 600, 270], ['SCH_VERSION', 600, 30], ['SCH_TASK', 600, 150], ['PP_PLAN_SUGGEST', 360, 150], ['SCH_EXCEPTION', 820, 150], ['BAS_ITEM_PLAN_ATTR', 360, 30], ['RF_WORK_ORDER', 120, 410]];
    boxes.forEach(function (b) { var w = b[0].length * 7 + 24; svg += '<g transform="translate(' + b[1] + ',' + b[2] + ')"><rect class="box" width="' + w + '" height="34" rx="6"/><text class="lbl" x="12" y="21">' + b[0] + '</text></g>'; });
    function link(a, b) { svg += '<line x1="' + (a[1] + a[0].length * 7 + 24) + '" y1="' + (a[2] + 34) + '" x2="' + b[1] + '" y2="' + b[2] + '" stroke="#9aa6b6" stroke-width="1"/>'; }
    link(['BAS_DEMAND', 120, 30], ['MRP_BATCH', 120, 150]);
    link(['MRP_BATCH', 120, 150], ['MRP_NET_REQ', 120, 270]);
    link(['MRP_BATCH', 120, 150], ['MRP_KIT_CHECK', 360, 270]);
    link(['MRP_KIT_CHECK', 360, 270], ['MRP_KIT_SHORT', 360, 390]);
    link(['MRP_BATCH', 120, 150], ['PP_PLAN_SUGGEST', 360, 150]);
    link(['MRP_NET_REQ', 120, 270], ['PR_SUGGEST', 600, 270]);
    link(['PP_PLAN_SUGGEST', 360, 150], ['SCH_VERSION', 600, 30]);
    link(['SCH_VERSION', 600, 30], ['SCH_TASK', 600, 150]);
    link(['RF_WORK_ORDER', 120, 410], ['SCH_TASK', 600, 150]);
    link(['SCH_VERSION', 600, 30], ['SCH_EXCEPTION', 820, 150]);
    link(['BAS_ITEM_PLAN_ATTR', 360, 30], ['MRP_NET_REQ', 120, 270]);
    svg += '</svg>';
    return '<div class="card"><h2>关键表关系（ER 概要）</h2><p class="mini">含主子表关联：BAS_DEMAND → BAS_DEMAND_LINE、MRP_BATCH → MRP_NET_REQ、MRP_KIT_CHECK → MRP_KIT_SHORT、SCH_VERSION → SCH_TASK。完整共 ' + Object.keys(S.TABLES).length + ' 张表关系见导出的 <code>aps_schema.sql</code> 与《APS产品功能需求文档 V5》。</p>' + svg + '</div>';
  }

  /* ---------- 计算版本工作台（APS 核心交互：选规则 → 纳入需求源 → 跑计算 → 一屏看派生结果） ---------- */
  function viewBatch() {
    var batches = rows('MRP_BATCH');
    var cur = batches.find(function (b) { return b.BATCH_NO === st.batchNo; }) || batches[batches.length - 1] || null;
    var h = '<div class="card"><div class="board-head"><h2>计算版本工作台</h2>' +
      '<div class="chips"><button class="primary" data-batchnew="1">+ 新建计算版本</button></div></div>' +
      '<p class="mini">APS 的核心不是 MES 那种「一张单流转出下一张单」，而是<b>以「需求计算版本」为中心的一次计算</b>：选好<b>排程规则</b>、把<b>需求源</b>纳入本次计算，运行后<b>同时产出</b>净需求 / 齐套检查 / 补料建议 / 生产计划建议 / 排程版本等<b>平级结果</b>。下方即围绕某个版本，一屏查看「输入 → 输出」全部内容。</p>' +
      '<p class="mini" style="margin-top:6px"><b>怎么用：</b>点右上「<b>+ 新建计算版本</b>」→ 在弹窗里选<b>排程规则</b>、勾选<b>本次要算的需求源</b> → 点「<b>运行计算</b>」，系统会在一个版本里依次算出全部结果，并自动回到本页展示。</p></div>';

    if (!batches.length) {
      return h + '<div class="card"><h3>还没有计算版本</h3>' +
        '<p class="mini">请先到「需求管理 → 需求源」准备需求（可从销售订单勾选生成），然后点右上「<b>+ 新建计算版本</b>」运行一次计算。</p>' +
        '<div style="margin-top:10px"><button class="primary" data-batchnew="1">+ 新建计算版本</button> <button class="ghost" data-batchcalc="1">按默认规则快速计算</button></div></div>';
    }

    /* 版本选择器 */
    var opts = batches.map(function (b) {
      var isCur = cur && b.BATCH_NO === cur.BATCH_NO;
      return '<button class="' + (isCur ? 'primary' : 'ghost') + ' sm" data-batchpick="' + esc(b.BATCH_NO) + '">' + esc(b.BATCH_NO) + '</button>';
    }).join(' ');
    h += '<div class="card"><h3>选择版本</h3><p class="mini">共 ' + batches.length + ' 个版本，点击切换查看：</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + opts + '</div></div>';

    if (!cur) return h;

    /* ① 本次计算的口径：排程规则 + 基本信息 */
    var rule = cur.RULE_NO ? rfind('SCH_RULE', function (r) { return r.RULE_NO === cur.RULE_NO; }) : null;
    h += '<div class="card"><h3>① 本次计算的口径</h3>' +
      '<div class="kv-grid">' +
      '<div class="kv"><span class="k">版本号</span><span class="v">' + esc(cur.BATCH_NO) + '</span></div>' +
      '<div class="kv"><span class="k">版本类型</span><span class="v">' + esc(cur.BATCH_TYPE || '-') + '</span></div>' +
      '<div class="kv"><span class="k">排程规则</span><span class="v">' + (rule ? esc(rule.RULE_NAME || rule.RULE_NO) + ' <code>' + esc(rule.RULE_NO) + '</code>' : '<span class="mini">未指定（沿用默认规则）</span>') + '</span></div>' +
      '<div class="kv"><span class="k">计算人 / 时间</span><span class="v">' + esc(cur.CALC_BY || '-') + ' · ' + esc(cur.CALC_TIME || '-') + '</span></div>' +
      '<div class="kv"><span class="k">需求行数 / 净需求行数</span><span class="v">' + esc(cur.REQ_ROWS || 0) + ' / ' + esc(cur.NET_ROWS || 0) + '</span></div>' +
      '<div class="kv"><span class="k">状态</span><span class="v">' + esc(cur.STATUS || '-') + '</span></div>' +
      '</div>' +
      (rule ? '<p class="mini" style="margin-top:10px">规则要点：订单排序 <b>' + esc(rule.ORDER_SORT || '-') + '</b> · 资源优选 <b>' + esc(rule.RES_SELECT || '-') + '</b> · 优化目标 <b>' + esc(rule.OPT_TARGET || '-') + '</b> · 排程方向 <b>' + esc(rule.SCH_DIR || '-') + '</b>' + (rule.KIT_CONSTRAINT ? ' · <b>启用齐套约束</b>' : '') + '</p>' : '') +
      '<p class="mini" style="margin-top:6px">排程规则是<b>独立的功能表</b>（生产排程 → 排程规则），在此处被版本<b>引用</b>为本次计算口径。</p>' +
      '</div>';

    /* ② 输入：本次纳入的需求源 */
    var linkedDemands = rows('SYS_DOC_LINK').filter(function (l) { return l.TO_TABLE === 'MRP_BATCH' && String(l.TO_NO) === String(cur.BATCH_NO); })
      .map(function (l) { return l.FROM_NO; });
    var demandRows = rows('BAS_DEMAND').filter(function (d) { return linkedDemands.indexOf(d.DEMAND_NO) >= 0; });
    if (!demandRows.length) demandRows = rows('BAS_DEMAND'); // 兜底：台账缺失时展示全部需求源
    var demHtml = demandRows.map(function (d) {
      var lines = rows('BAS_DEMAND_LINE').filter(function (l) { return l.DEMAND_NO === d.DEMAND_NO; });
      var qty = lines.reduce(function (a, l) { return a + (+l.DEMAND_QTY || 0); }, 0);
      return '<tr><td class="pk">' + esc(d.DEMAND_NO) + '</td><td>' + esc(d.SOURCE_TYPE || '-') + '</td>' +
        '<td class="mini">' + esc(d.SOURCE_NO || '-') + '</td><td>' + esc(d.CUSTOMER_CODE || '-') + '</td>' +
        '<td class="cellnum">' + lines.length + '</td><td class="cellnum">' + qty + '</td>' +
        '<td><button class="ghost sm" data-linkopen="BAS_DEMAND|' + esc(d.DEMAND_NO) + '">打开 →</button></td></tr>';
    }).join('');
    h += '<div class="card"><h3>② 输入 · 本次纳入的需求源</h3>' +
      '<p class="mini">这些需求源的明细是本次计算的<b>毛需求输入</b>；数量取「冲减后需求」。</p>' +
      '<div class="tbl-wrap"><table class="grid"><thead><tr><th>需求单号</th><th>需求来源</th><th>来源单据号</th><th>客户</th><th>明细行</th><th>冲减后需求合计</th><th></th></tr></thead><tbody>' + (demHtml || '<tr><td colspan="7" class="mini">（无关联需求源）</td></tr>') + '</tbody></table></div></div>';

    /* ③ 输出：派生结果（按 schema 的 BATCH_RESULT 声明，一屏罗列） */
    var results = (S.BATCH_RESULT || []).filter(function (r) { return r.kind === 'output'; });
    var cards = results.map(function (r) {
      var rdef = S.TABLES[r.table] || {};
      var rrows = r.via ? rows(r.table).filter(function (x) { return String(x[r.via]) === String(cur.BATCH_NO); }) : rows(r.table);
      var n = rrows.length;
      /* 单表汇总指标 */
      var metric = '';
      if (r.table === 'MRP_NET_REQ') metric = '其中待补充 ' + rrows.filter(function (x) { return (+x.ADJ_QTY || 0) > 0; }).length + ' 条';
      else if (r.table === 'MRP_KIT_CHECK') { var kr = rrows[0]; metric = kr ? ('齐套率 ' + ((+kr.KIT_RATE || 0) * 100).toFixed(1) + '% / 缺料 ' + (+kr.SHORT_QTY || 0)) : ''; }
      else if (r.table === 'PR_SUGGEST') metric = '建议数量合计 ' + rrows.reduce(function (a, x) { return a + (+x.NET_QTY || 0); }, 0);
      else if (r.table === 'PP_PLAN_SUGGEST') metric = '建议数量合计 ' + rrows.reduce(function (a, x) { return a + (+x.NET_QTY || 0); }, 0);
      else if (r.table === 'SCH_VERSION') { var vr = rrows[rrows.length - 1]; metric = vr ? ('状态 ' + (vr.STATUS || '-') + ' / 任务 ' + rows('SCH_TASK').filter(function (t) { return t.VERSION_NO === vr.VERSION_NO; }).length + ' 条') : ''; }
      var chips = rrows.slice(0, 4).map(function (x) {
        var no = rdef.pk ? x[rdef.pk] : x.ID;
        return '<button class="ghost sm" data-linkopen="' + esc(r.table) + '|' + esc(no) + '">' + esc(no) + ' →</button>';
      }).join(' ');
      return '<div class="rc-cell"><div class="rc-h">' + esc(r.label) + ' <span class="tag">' + n + ' 条</span></div>' +
        (metric ? '<div class="mini">' + esc(metric) + '</div>' : '') +
        (n ? '<div class="link-chips">' + chips + (n > 4 ? '<span class="mini">…等 ' + n + ' 条</span>' : '') + '</div>' : '<div class="mini">本次未产出</div>') +
        '<div style="margin-top:6px"><button class="ghost sm" data-batchopen="' + esc(r.table) + '">到列表查看</button></div></div>';
    }).join('');
    h += '<div class="card"><h3>③ 输出 · 本次计算派生的平级结果</h3>' +
      '<p class="mini">以下结果由同一个版本<b>一次算出</b>，彼此<b>平级</b>（互为兄弟），不是逐级流转生成的单据链。</p>' +
      '<div class="rc-grid">' + cards + '</div></div>';

    /* ④ 下一步可执行动作 */
    var nextSteps = (S.FLOW['MRP_BATCH'] || []);
    h += '<div class="card"><h3>④ 可继续执行</h3><p class="mini">在同一版本下补算结果，或进入排程：</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
      nextSteps.map(function (f) {
        return '<button class="primary sm" data-flowto="' + esc(f.to) + '" data-srct="MRP_BATCH" data-srcid="' + esc(cur.ID) + '">' + esc(f.label) + ' →</button>';
      }).join('') +
      '<button class="ghost sm" data-flowto="SCH_VERSION" data-srct="MRP_BATCH" data-srcid="' + esc(cur.ID) + '">执行自动排程 →</button>' +
      '</div></div>';
    return h;
  }

  /* ---------- 新建计算版本 · 引导式操作向导 ----------
   *  APS 的「怎么用」主线：① 选排程规则（计算口径）→ ② 勾选本次要算的需求源
   *  → ③ 点「运行计算」→ 一个版本里依次跑 净需求 → 齐套 → 补料/计划建议 → 自动排程
   *  → 自动跳回工作台，一屏查看全部派生结果。
   */
  function openBatchWizard() {
    var rules = rows('SCH_RULE');
    if (!rules.length) { toast('尚无排程规则，请先到「生产排程 → 排程规则」维护规则'); return; }
    var defRule = rules.find(function (r) { return +r.IS_DEFAULT === 1; }) || rules[0];
    var demands = rows('BAS_DEMAND');
    if (!demands.length) { toast('尚无需求源，请先到「需求管理 → 需求源」准备需求'); return; }
    /* 需求源排序：未计算过的排前面，方便优先勾选本次要算的 */
    var batchNoOf = {};
    rows('SYS_DOC_LINK').forEach(function (l) { if (l.FROM_TABLE === 'BAS_DEMAND' && l.TO_TABLE === 'MRP_BATCH') batchNoOf[String(l.FROM_NO)] = 1; });

    var body = '<div class="wiz-steps"><span class="wiz-step on">① 选排程规则</span><span class="wiz-arrow">→</span>' +
      '<span class="wiz-step on">② 勾选需求源</span><span class="wiz-arrow">→</span><span class="wiz-step on">③ 运行计算</span></div>';
    body += '<p class="mini">一次运行会新建一个<b>需求计算版本</b>，并在该版本下同时产出净需求 / 齐套检查 / 补料建议 / 生产计划建议 / 排程版本等<b>平级结果</b>。</p>';

    /* ① 排程规则 */
    body += '<div class="wiz-sec"><div class="wiz-h">① 选排程规则 <span class="mini">（本次计算口径）</span></div>' +
      '<select id="wizRule" class="mini-sel" style="min-width:320px">' +
      rules.map(function (r) {
        return '<option value="' + esc(r.RULE_NO) + '"' + (r.RULE_NO === defRule.RULE_NO ? ' selected' : '') + '>' +
          esc(r.RULE_NO + ' · ' + (r.RULE_NAME || '')) + (r.IS_DEFAULT == 1 ? '（默认）' : '') + '</option>';
      }).join('') + '</select>' +
      '<div id="wizRuleTip" class="mini" style="margin-top:8px"></div></div>';

    /* ② 需求源多选 */
    body += '<div class="wiz-sec"><div class="wiz-h">② 勾选需求源 <span class="mini">（勾哪几张就只算哪几张的明细）</span></div>';
    body += '<div class="toolbar" style="margin:4px 0 8px"><label class="mini" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="wizAll" style="width:auto"/> 全选</label>' +
      '<span class="spacer"></span><span class="mini" id="wizSum">已选 0 张 / 明细 0 行</span></div>';
    body += '<div class="tbl-wrap" style="max-height:260px;overflow:auto"><table class="grid sm"><thead><tr><th class="chkcol">选</th><th>需求单号</th><th>需求来源</th><th>来源单据号</th><th>客户</th><th>明细行</th><th>冲减后需求合计</th><th>版本</th></tr></thead><tbody>';
    demands.forEach(function (d) {
      var lines = rows('BAS_DEMAND_LINE').filter(function (l) { return l.DEMAND_NO === d.DEMAND_NO; });
      var qty = lines.reduce(function (a, l) { return a + (+l.DEMAND_QTY || 0); }, 0);
      var done = batchNoOf[String(d.DEMAND_NO)];
      body += '<tr><td class="chkcol"><input type="checkbox" class="wizdem" data-no="' + esc(d.DEMAND_NO) + '" data-lines="' + lines.length + '" checked/></td>' +
        '<td class="pk">' + esc(d.DEMAND_NO) + '</td><td>' + esc(d.SOURCE_TYPE || '-') + '</td>' +
        '<td class="mini">' + esc(d.SOURCE_NO || '-') + '</td><td>' + esc(d.CUSTOMER_CODE || '-') + '</td>' +
        '<td class="cellnum">' + lines.length + '</td><td class="cellnum">' + qty + '</td>' +
        '<td>' + (done ? '<span class="tag">已计算过</span>' : '<span class="mini">未计算</span>') + '</td></tr>';
    });
    body += '</tbody></table></div>';
    body += '<p class="mini" style="margin-top:6px">需求数量取「<b>冲减后需求</b>」（已扣除冲减量）；这些明细即本次计算的<b>毛需求输入</b>。若默认全选不符预期，可逐张取消勾选。</p></div>';

    /* ③ 结果预览 */
    body += '<div class="wiz-sec"><div class="wiz-h">③ 运行计算 <span class="mini">（将依次执行下列步骤）</span></div>' +
      '<ol class="mini" style="line-height:1.9;padding-left:20px;margin-top:4px">' +
      '<li><b>净需求计算</b>：按 BOM 逐层展开，生成计算版本 + 净需求（含安全库存 / 可用 / 在制 / 在途扣减与批量取整）</li>' +
      '<li><b>齐套检查</b>：按成品校验子件可供量，输出齐套率 / 缺料明细</li>' +
      '<li><b>生成计划建议</b>：外购 / 外协 → 补料建议；自制 → 生产计划建议</li>' +
      '<li><b>自动排程</b>：按所选规则生成排程版本 + 任务 + 周 / 日计划</li>' +
      '</ol><p class="mini" style="margin-top:4px">运行完成后自动回到「计算版本工作台」，一屏查看本次全部派生结果。</p></div>';

    document.getElementById('modal').classList.remove('wide');
    document.getElementById('modalTitle').textContent = '新建计算版本 · 引导向导';
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalMask').style.display = 'flex';
    var save = document.getElementById('modalSave');
    save.style.display = ''; save.textContent = '运行计算';
    document.getElementById('modalCancel').textContent = '取 消';

    /* 规则要点预览 */
    function ruleTip() {
      var sel = document.getElementById('wizRule');
      var r = sel && sel.value ? rfind('SCH_RULE', function (x) { return x.RULE_NO === sel.value; }) : null;
      var el = document.getElementById('wizRuleTip'); if (!el) return;
      if (!r) { el.innerHTML = ''; return; }
      el.innerHTML = '规则要点：订单排序 <b>' + esc(r.ORDER_SORT || '-') + '</b> · 资源优选 <b>' + esc(r.RES_SELECT || '-') + '</b> · 优化目标 <b>' + esc(r.OPT_TARGET || '-') + '</b> · 排程方向 <b>' + esc(r.SCH_DIR || '-') + '</b> · 有限产能 <b>' + (r.FINITE_CAP == 1 ? '是' : '否') + '</b>' + (r.KIT_CONSTRAINT == 1 ? ' · <b>启用齐套约束</b>' : '');
    }
    var ruleSel = document.getElementById('wizRule');
    if (ruleSel) ruleSel.onchange = ruleTip;
    ruleTip();

    /* 需求源勾选联动 */
    function demBoxes() { return Array.prototype.slice.call(document.querySelectorAll('.wizdem')); }
    function refreshSum() {
      var sel = demBoxes().filter(function (cb) { return cb.checked; });
      var lines = sel.reduce(function (a, cb) { return a + (+cb.getAttribute('data-lines') || 0); }, 0);
      var el = document.getElementById('wizSum'); if (el) el.textContent = '已选 ' + sel.length + ' 张 / 明细 ' + lines + ' 行';
      var all = document.getElementById('wizAll');
      if (all) { all.checked = sel.length === demBoxes().length && demBoxes().length > 0; all.indeterminate = sel.length > 0 && sel.length < demBoxes().length; }
    }
    demBoxes().forEach(function (cb) { cb.onchange = refreshSum; });
    var allBox = document.getElementById('wizAll');
    if (allBox) allBox.onchange = function () { demBoxes().forEach(function (cb) { cb.checked = allBox.checked; }); refreshSum(); };
    refreshSum();

    /* 运行：一次跑完四步 */
    save.onclick = function () {
      var ruleNo = document.getElementById('wizRule').value;
      var picked = demBoxes().filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.getAttribute('data-no'); });
      if (!picked.length) { toast('请至少勾选一张需求源'); return; }
      closeModal();
      var bNo = genCalc({ ruleNo: ruleNo, demandNos: picked, batchType: picked.length === demands.length ? '全量' : '指定需求源' });
      if (!bNo) { render(); return; }
      genKit(bNo);
      genSuggest(bNo);
      genSchedule(bNo);
      st.view = 'batch'; st.batchNo = bNo; setNav(); render();
      toast('已运行计算版本 ' + bNo + '（纳入 ' + picked.length + ' 张需求源）');
    };
  }

  /* ================================================================
   * 三个核心域的计算工作台（原「应用工具 → 计算版本工作台」按域拆解）
   *   核心① 物料需求计算 → viewMrp   （净需求 + 补料建议 + 生产计划建议）
   *   核心② 物料齐套计算 → viewKit   （齐套率 + 缺料明细）
   *   核心③ 生产排程     → viewSched （规则 + 目标 + 自动排程 + 甘特 + 任务）
   * 共同原则：进入即「算」——顶部给口径与运行按钮，中部给 KPI，下部给结果明细；
   *           算法与可调参数用折叠卡片显式说明，不隐藏计算逻辑。
   * ================================================================ */

  /* 数量显示：整数不带小数，其余保留 2 位 */
  function qfmt(v) {
    var n = brNum(v);
    return (Math.abs(n - Math.round(n)) < 1e-6) ? String(Math.round(n)) : String(+n.toFixed(2));
  }
  /* 折叠卡片：标题栏 + 可选副标题 + 展开/收起按钮；开合状态存 st.fold[id]
   * defaultOpen=true 时首次进入默认展开（用户一旦手动切换，就以其选择为准）
   * ⚠️ 按钮带 data-foldopen 记录「当前实际显示状态」——切换时按它取反，
   *    否则默认展开状态下 st.fold[id] 还是 undefined，点一下反而又设成展开（点不动）。 */
  function foldCard(id, title, sub, inner, defaultOpen) {
    var open = (st.fold && st.fold[id] !== undefined) ? (st.fold[id] === true) : (defaultOpen === true);
    return '<div class="card"><div class="fs-head" style="margin-bottom:0">' +
      '<h3 style="margin:0">' + title + '</h3>' +
      (sub ? '<span class="mini">' + sub + '</span>' : '') +
      '<span class="spacer"></span><button class="ghost sm" data-fold="' + esc(id) + '" data-foldopen="' + (open ? '1' : '0') + '">' + (open ? '收起 ▴' : '展开 ▾') + '</button></div>' +
      (open ? '<div style="margin-top:12px">' + inner + '</div>' : '') + '</div>';
  }
  /* 工作台顶部的「计算口径」一行摘要 */
  function ruleSummary(rule) {
    if (!rule || !rule.RULE_NO) return '<span class="mini">未指定规则（沿用默认口径）</span>';
    return '口径规则 <b>' + esc(rule.RULE_NO) + '</b>' + (rule.RULE_NAME ? ' ' + esc(rule.RULE_NAME) : '') +
      ' · 订单排序 <b>' + esc(rule.ORDER_SORT || '-') + '</b>' +
      ' · 资源优选 <b>' + esc(rule.RES_SELECT || '-') + '</b>' +
      ' · 优化目标 <b>' + esc(rule.OPT_TARGET || '-') + '</b>' +
      ' · 方向 <b>' + esc(rule.SCH_DIR || '-') + '</b>' +
      (rule.FINITE_CAP == 1 ? ' · <b>有限产能</b>' : '') +
      (rule.KIT_CONSTRAINT == 1 ? ' · <b>齐套约束</b>' : '');
  }
  /* 优化目标的中文解释（排程工作台用） */
  function optTargetDesc(t) {
    var s = String(t || '');
    if (/交期|交付|delay|due/i.test(s)) return '以<b>订单交期</b>为第一目标：尽量让所有工单在交期前完工，使<b>延期任务数与总延期天数最小</b>。';
    if (/利用|负荷|产能/i.test(s)) return '以<b>设备利用率</b>为第一目标：减少资源空闲，把任务集中排到同一资源上，提升<b>瓶颈资源利用率</b>。';
    if (/换型|准备时间|setup|changeover/i.test(s)) return '以<b>最小换型时间</b>为第一目标：把相同 / 相近产品的任务连续排产，减少<b>序列相关的换型准备时间</b>。';
    if (/均衡|平衡|分摊|负载均衡/i.test(s)) return '以<b>负载均衡</b>为第一目标：在候选资源组内分摊任务，避免单台设备过载、其他设备空闲。';
    if (/成本/i.test(s)) return '以<b>总成本</b>为第一目标：综合换型、加班与在制占用，寻找成本更低的排产组合。';
    return '按规则设定的优化目标对候选排产方案择优（当前口径：<b>' + esc(t || '未指定') + '</b>）。';
  }
  /* 内嵌甘特（三视角分组，口径与「计划看板 → 排产甘特图」一致，此处为紧凑版） */
  function ganttMini(tasks, mode) {
    return gtRender(tasks, mode, { fitW: 980, hdr: true, tags: false, labW: 168, label: { res: '机台 / 资源', step: '工序', order: '工单 / 订单' }[mode] });
  }

  /* ---------- 核心① MRP 计算工作台 ---------- */
  function viewMrp() {
    var batches = rows('MRP_BATCH');
    var cur = batches.filter(function (b) { return b.BATCH_NO === st.batchNo; })[0] || batches[batches.length - 1] || null;
    var nets = cur ? rows('MRP_NET_REQ').filter(function (x) { return x.BATCH_NO === cur.BATCH_NO; }) : [];
    var prs = cur ? rows('PR_SUGGEST').filter(function (x) { return x.BATCH_NO === cur.BATCH_NO; }) : [];
    var pps = cur ? rows('PP_PLAN_SUGGEST').filter(function (x) { return x.BATCH_NO === cur.BATCH_NO; }) : [];
    var demands = rows('BAS_DEMAND');
    var shortRows = nets.filter(function (x) { return (+x.ADJ_QTY || 0) > 0; });
    var sumQty = function (arr) { return arr.reduce(function (a, x) { return a + (+x.NET_QTY || 0); }, 0); };
    var rules = rows('SCH_RULE');
    var rule = (cur && cur.RULE_NO ? rfind('SCH_RULE', function (r) { return r.RULE_NO === cur.RULE_NO; }) : null)
      || rules.filter(function (r) { return +r.IS_DEFAULT === 1; })[0] || rules[0] || {};
    var tab = st.mrpTab || 'net';

    var h = '';
    /* ── 头部：标题 + 主操作 + 口径摘要 ── */
    h += '<div class="card"><div class="board-head"><h2>物料需求计算 · MRP 计算工作台</h2></div>' +
      '<p class="mini">按 BOM 自成品向下<b>逐层展开</b>，扣减库存 / 在制 / 在途得到净需求，再按最小批量与批量倍数取整，输出 <b>净需求 · 补料建议 · 生产计划建议</b>。在下方选排程规则与勾选需求源后点「运行 MRP 计算」。</p>' +
      '<p class="mini" style="margin-top:6px">本次口径：' + ruleSummary(rule) + '</p></div>';

    /* ── KPI 概览 ── */
    h += '<div class="card"><h3>计算结果概览</h3>' +
      (cur ? '' : '<p class="mini">尚未运行过计算，以下指标为 0。点右上「运行 MRP 计算」开始（需先准备需求源）。</p>') +
      '<div class="kpis">' +
      kpi(demands.length + ' 张', '输入需求源') +
      kpi(nets.length, '净需求（逐层展开）') +
      kpi(shortRows.length, '需补充物料') +
      kpi(qfmt(sumQty(prs) + sumQty(pps)), '建议数量合计') +
      '</div>' +
      (cur ? '<p class="mini" style="margin-top:10px">当前版本 <b>' + esc(cur.BATCH_NO) + '</b> · 类型 ' + esc(cur.BATCH_TYPE || '-') +
        ' · 计算人 ' + esc(cur.CALC_BY || '-') + ' · 时间 ' + esc(String(cur.CALC_TIME || '').slice(0, 16)) + '</p>' : '') +
      '</div>';

    /* ── 运行设置：口径 + 输入范围 ── */
    var ruleOpts = rules.map(function (r) {
      var sel = (st.mrpRule ? r.RULE_NO === st.mrpRule : (rule && r.RULE_NO === rule.RULE_NO));
      return '<option value="' + esc(r.RULE_NO) + '"' + (sel ? ' selected' : '') + '>' + esc(r.RULE_NO + ' · ' + (r.RULE_NAME || '')) + (r.IS_DEFAULT == 1 ? '（默认）' : '') + '</option>';
    }).join('');
    var setInner;
    if (!demands.length) {
      setInner = '<div class="empty sm">尚无需求源，暂时无法计算。可到「需求管理 → 需求源」手工维护（支持从销售订单多选合并生成），或点下方按钮<b>快速生成一组演示需求源</b>（销售订单 / 库存补充两类）。</div>' +
        '<div style="margin-top:12px"><button class="primary" data-gendemand="1">⚡ 一键生成演示需求源</button> ' +
        '<button class="ghost" data-batchopen="BAS_DEMAND">到「需求源」手工维护</button></div>';
    } else {
      var demRows = demands.map(function (d) {
        var lines = rows('BAS_DEMAND_LINE').filter(function (l) { return l.DEMAND_NO === d.DEMAND_NO; });
        var q = lines.reduce(function (a, l) { return a + (+l.DEMAND_QTY || 0); }, 0);
        return '<tr><td class="chkcol"><input type="checkbox" class="mrpdem" data-no="' + esc(d.DEMAND_NO) + '" data-lines="' + lines.length + '" checked/></td>' +
          '<td class="pk">' + esc(d.DEMAND_NO) + '</td><td>' + esc(d.SOURCE_TYPE || '-') + '</td>' +
          '<td class="mini">' + esc(d.SOURCE_NO || '-') + '</td><td class="cellnum">' + lines.length + '</td>' +
          '<td class="cellnum">' + qfmt(q) + '</td></tr>';
      }).join('');
      setInner = '<div class="kv-grid" style="margin-bottom:12px"><div class="kv"><span class="k">计算口径（排程规则）</span>' +
        '<span class="v"><select id="mrpRule" class="mini-sel">' + ruleOpts + '</select></span></div></div>' +
        '<div class="toolbar" style="margin:0 0 8px"><label class="mini" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mrpAll" style="width:auto"/> 全选</label>' +
        '<span class="spacer"></span><span class="mini" id="mrpSum"></span></div>' +
        '<div class="tbl-wrap" style="max-height:220px;overflow:auto"><table class="grid sm"><thead><tr>' +
        '<th class="chkcol">选</th><th>需求单号</th><th>需求来源</th><th>来源单据号</th><th>明细行</th><th>冲减后需求合计</th></tr></thead><tbody>' + demRows + '</tbody></table></div>' +
        '<p class="mini" style="margin-top:6px">只算勾选的需求源；数量取「<b>冲减后需求</b>」（已扣预测冲减），即本次计算的<b>毛需求输入</b>。</p>' +
        '<div style="margin-top:10px"><button class="primary" data-mrprun="1">▶ 运行 MRP 计算</button> ' +
        '<span class="mini">依次执行：净需求逐层展开 → 生成补料建议 / 生产计划建议</span></div>';
    }
    h += foldCard('mrpSet', '运行设置 · 口径与输入范围', demands.length ? ('共 ' + demands.length + ' 张需求源') : '暂无需求源', setInner, true);

    /* ── 结果：Tab 切换 ── */
    var tabs = [['net', '净需求', nets.length], ['pr', '补料建议', prs.length], ['pp', '生产计划建议', pps.length]];
    var tabBar = '<div class="chips">' + tabs.map(function (t) {
      return '<button class="chip' + (tab === t[0] ? ' active' : '') + '" data-mrptab="' + t[0] + '">' + t[1] + ' <span class="mini">' + t[2] + '</span></button>';
    }).join('') + '</div>';
    var resHtml = '<div class="empty sm">本次未产出结果。运行 MRP 计算后在此查看。</div>';
    if (tab === 'net' && nets.length) {
      var netRows = nets.slice().sort(function (a, b) { return (+a.LEVEL_NO || 1) - (+b.LEVEL_NO || 1) || String(a.ITEM_NO).localeCompare(String(b.ITEM_NO)); }).map(function (n) {
        var lv = +(n.LEVEL_NO || 1);
        return '<tr><td class="cellnum">' + lv + '</td>' +
          '<td class="pk" style="padding-left:' + (8 + (lv - 1) * 14) + 'px">' + esc(n.ITEM_NO) + '</td>' +
          '<td>' + esc(n.ITEM_NAME) + '</td><td>' + esc(n.ITEM_TYPE || '-') + '</td>' +
          '<td class="cellnum">' + qfmt(n.GROSS_QTY) + '</td>' +
          '<td class="cellnum">' + qfmt(n.NET_QTY) + '</td>' +
          '<td class="cellnum"' + ((+n.ADJ_QTY || 0) > 0 ? ' style="font-weight:700;color:#b45309"' : '') + '>' + qfmt(n.ADJ_QTY) + '</td>' +
          '<td>' + esc(String(n.REQ_DATE || '').slice(0, 10)) + '</td>' +
          '<td>' + esc(String(n.SUGGEST_DATE || '').slice(0, 10)) + '</td></tr>';
      }).join('');
      resHtml = '<div class="tbl-wrap" style="max-height:460px;overflow:auto"><table class="grid"><thead><tr>' +
        '<th>层级</th><th>品号</th><th>品名</th><th>建议类型</th><th>毛需求</th><th>净需求</th><th>批量调整后</th><th>需求日期</th><th>建议下达</th></tr></thead><tbody>' +
        netRows + '</tbody></table></div>' +
        '<p class="mini" style="margin-top:8px">品号按<b>层级缩进</b>显示 BOM 层次；「批量调整后 &gt; 0」的行走才是真正需要补充的（橙色加粗）。</p>';
    } else if (tab === 'pr' && prs.length) {
      resHtml = '<div class="tbl-wrap" style="max-height:460px;overflow:auto"><table class="grid"><thead><tr>' +
        '<th>补料建议号</th><th>品号</th><th>品名</th><th>供应方式</th><th>建议数量</th><th>需求日期</th><th>建议下达</th><th>建议供应商</th></tr></thead><tbody>' +
        prs.map(function (x) {
          return '<tr><td class="pk">' + esc(x.PR_NO) + '</td><td>' + esc(x.ITEM_NO) + '</td><td>' + esc(x.ITEM_NAME) + '</td>' +
            '<td>' + esc(x.ITEM_TYPE || '-') + '</td><td class="cellnum">' + qfmt(x.NET_QTY) + '</td>' +
            '<td>' + esc(String(x.REQ_DATE || '').slice(0, 10)) + '</td><td>' + esc(String(x.SUGGEST_DATE || '').slice(0, 10)) + '</td>' +
            '<td>' + esc(x.SUGGEST_SUPPLIER || '（待选商）') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="mini" style="margin-top:8px">外购 / 外协项的建议；确认后回写 MES 请购与比价选商（<code>PD_PRICE_COMPARE</code>）。</p>';
    } else if (tab === 'pp' && pps.length) {
      resHtml = '<div class="tbl-wrap" style="max-height:460px;overflow:auto"><table class="grid"><thead><tr>' +
        '<th>计划建议号</th><th>品号</th><th>品名</th><th>建议数量</th><th>建议开工</th><th>建议完工</th><th>需求日期</th></tr></thead><tbody>' +
        pps.map(function (x) {
          return '<tr><td class="pk">' + esc(x.SUGGEST_NO) + '</td><td>' + esc(x.ITEM_NO) + '</td><td>' + esc(x.ITEM_NAME) + '</td>' +
            '<td class="cellnum">' + qfmt(x.NET_QTY) + '</td>' +
            '<td>' + esc(String(x.SUGGEST_START || '').slice(0, 10)) + '</td><td>' + esc(String(x.SUGGEST_END || '').slice(0, 10)) + '</td>' +
            '<td>' + esc(String(x.REQ_DATE || '').slice(0, 10)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="mini" style="margin-top:8px">自制项的建议；确认后回写 MES 生产计划（<code>PP_MASTER_PLAN</code>）。</p>';
    } else if (nets.length || prs.length || pps.length) {
      resHtml = '<div class="empty sm">该分类本次未产出记录。切换上方 Tab 查看其他结果。</div>';
    }
    h += '<div class="card"><div class="board-head"><h3 style="margin:0">计算结果</h3>' + tabBar + '</div>' +
      '<div style="margin-top:12px">' + resHtml + '</div>' +
      '<div class="toolbar" style="margin-top:12px"><span class="spacer"></span>' +
      '<button class="ghost sm" data-batchopen="MRP_NET_REQ">到「净需求」表查看</button>' +
      '<button class="ghost sm" data-batchopen="PR_SUGGEST">到「补料建议」表</button>' +
      '<button class="ghost sm" data-batchopen="PP_PLAN_SUGGEST">到「生产计划建议」表</button>' +
      '<button class="ghost sm" data-viewto="kit">下一步：齐套计算 →</button></div></div>';

    /* ── 算法说明（显式公开计算逻辑） ── */
    h += foldCard('mrpAlgo', '算法说明 · 净需求是怎么算出来的', 'BOM 逐层展开 · 净需求扣减 · 批量取整 · 提前期倒推',
      '<div class="modchain">' +
      '<div class="mc-item"><div class="mc-t">① 展开毛需求</div><div class="mc-d">独立需求（需求明细的「冲减后需求」）＋ 相关需求：沿 BOM 逐层展开，<b>子件需求 = 父件需求 × 单位用量 × (1 + 损耗率)</b></div>' +
      '<div class="mc-up mini">低阶码规则：同一物料在多层出现时，只在「最低层」净算一次，避免重复计算；递归深度上限 12 层防环。</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">② 计算净需求</div><div class="mc-d"><b>净需求 = max( 0 , 毛需求 + 安全库存 − 可用库存 − 在制 − 在途 )</b></div>' +
      '<div class="mc-up mini">安全库存取自「物料计划属性」；可用 / 在制 / 在途来自 MES 只读镜像（RF_STOCK / RF_WORK_ORDER / RF_PO），APS 不重复维护。</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">③ 批量调整</div><div class="mc-d"><b>批量调整后 = max( 最小批量 , ⌈净需求 ÷ 批量倍数⌉ × 批量倍数 )</b></div>' +
      '<div class="mc-up mini">净需求为 0 时不生成补充建议；参数取自「物料计划属性」的 MIN_BATCH / BATCH_MULTIPLE。</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">④ 倒推建议下达日期</div><div class="mc-d"><b>建议下达 = 需求日期 − 提前期</b>（自制取生产提前期；外购 / 外协取采购提前期）</div>' +
      '<div class="mc-up mini">按物料「建议类型」自动分派：自制 → 生产计划建议；外购 / 外协 → 补料建议。</div></div>' +
      '</div>' +
      '<p class="mini" style="margin-top:10px"><b>可调参数在哪：</b>「计划基础数据 → 物料计划属性」（安全库存 / 最小批量 / 批量倍数 / 提前期）+「<b>排程规则</b>」（计算口径）。改这两处后重新运行本工作台即可看到结果变化。</p>');

    /* ── 历史版本（紧凑） ── */
    if (batches.length > 1) {
      h += foldCard('mrpHist', '历史计算版本', '共 ' + batches.length + ' 个，点击切换',
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' + batches.slice().reverse().map(function (b) {
          var isCur = cur && b.BATCH_NO === cur.BATCH_NO;
          return '<button class="' + (isCur ? 'primary' : 'ghost') + ' sm" data-batchpick="' + esc(b.BATCH_NO) + '">' + esc(b.BATCH_NO) +
            ' <span class="mini">' + esc(String(b.CALC_TIME || '').slice(5, 16)) + '</span></button>';
        }).join('') + '</div>');
    }
    return h;
  }

  /* ---------- 核心② 齐套计算工作台 ---------- */
  function viewKit() {
    var checks = rows('MRP_KIT_CHECK');
    var cur = checks.filter(function (c) { return c.CHECK_NO === st.kitNo; })[0] || checks[checks.length - 1] || null;
    var shorts = cur ? rows('MRP_KIT_SHORT').filter(function (s) { return s.CHECK_NO === cur.CHECK_NO; }) : [];
    var batches = rows('MRP_BATCH');
    var rate = cur ? brNum(cur.KIT_RATE) : 0;
    var blockCnt = shorts.filter(function (s) { return s.BLOCK_FLAG == 1; }).length;
    var keyCnt = shorts.filter(function (s) { return s.KEY_ITEM_FLAG == 1; }).length;

    var h = '';
    h += '<div class="card"><div class="board-head"><h2>物料齐套计算 · 齐套工作台</h2></div>' +
      '<p class="mini">对订单 / 工单 / 计划做<b>逐层齐套检查</b>（整机 ← 部件 ← 零件关键件）：算齐套数量、齐套率与缺料明细，关键件缺料标为<b>阻断级</b>。齐套日期作为排程的<b>最早开工约束</b>。运行前请先完成「物料需求计算」。</p></div>';

    /* 检查设置 */
    var setInner;
    if (!batches.length) {
      setInner = '<div class="empty sm">尚无计算版本。请先到「物料需求计算」运行 MRP 计算，生成需求计算版本后再做齐套检查。</div>';
    } else {
      setInner = '<div class="kv-grid"><div class="kv"><span class="k">检查的计算版本</span><span class="v">' +
        '<select id="kitBatch" class="mini-sel">' + batches.slice().reverse().map(function (b) {
          return '<option value="' + esc(b.BATCH_NO) + '"' + (cur && cur.BATCH_NO === b.BATCH_NO ? ' selected' : '') + '>' + esc(b.BATCH_NO) + '</option>';
        }).join('') + '</select></span></div>' +
        '<div class="kv"><span class="k">检查口径</span><span class="v">' + esc(cur && cur.CHECK_TYPE || '整单（LEVEL 1 成品 / 独立需求件）') + '</span></div>' +
        '<div class="kv"><span class="k">检查日期</span><span class="v">' + esc(String(cur && cur.CHECK_DATE || today()).slice(0, 10)) + '</span></div>' +
        '<div class="kv"><span class="k">周期粒度</span><span class="v">' + esc(cur && cur.PERIOD_TYPE || '按日') + '</span></div>' +
        '</div>' +
        '<div style="margin-top:12px"><button class="primary" data-kitrun="1">▶ 运行齐套检查</button> ' +
        '<span class="mini">对所选版本重新检查（同版本重复运行会覆盖上一次结果）</span></div>';
    }
    h += foldCard('kitSet', '检查设置', batches.length ? ('共 ' + batches.length + ' 个版本') : '暂无版本', setInner, true);

    /* KPI + 齐套率可视化 */
    h += '<div class="card"><h3>齐套结果概览</h3>' +
      (cur ? '' : '<p class="mini">尚未做过齐套检查，以下指标为 0。</p>') +
      '<div class="kpis">' +
      kpi((rate * 100).toFixed(1) + '%', '齐套率') +
      kpi(qfmt(cur && cur.DEMAND_QTY), '需求数量') +
      kpi(qfmt(cur && cur.SHORT_QTY), '缺料数量') +
      kpi(blockCnt, '关键件阻断') +
      '</div>' +
      (cur ? '<div style="margin-top:14px"><div class="mini" style="margin-bottom:4px">齐套率 <b>' + (rate * 100).toFixed(1) + '%</b>（齐套 ' + qfmt(cur.KIT_QTY) + ' / 需求 ' + qfmt(cur.DEMAND_QTY) + '）</div>' +
        '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, Math.round(rate * 100))) + '%;background:linear-gradient(90deg,' + (rate >= 0.9 ? '#18a058,#4ade80' : (rate >= 0.6 ? '#d98800,#fbbf24' : '#e11d48,#fb7185')) + ')"></i></div></div>' +
        '<p class="mini" style="margin-top:10px">齐套单 <b>' + esc(cur.CHECK_NO) + '</b> · 对象 ' + esc(cur.ITEM_NO || '-') + ' ' + esc(cur.ITEM_NAME || '') + ' · 状态 ' + statusTag(cur.STATUS) + '</p>' : '') +
      '</div>';

    /* 缺料 Top-N */
    if (shorts.length) {
      var top = shorts.slice().sort(function (a, b) { return (+b.SHORT_QTY || 0) - (+a.SHORT_QTY || 0); }).slice(0, 8);
      var maxS = 1; top.forEach(function (x) { var v = +x.SHORT_QTY || 0; if (v > maxS) maxS = v; });
      h += '<div class="card"><h3>缺料 Top ' + top.length + '</h3>' +
        top.map(function (x) {
          var v = +x.SHORT_QTY || 0;
          var col = x.BLOCK_FLAG == 1 ? '#e11d48' : '#d98800';
          return '<div class="bar-row"><span class="bar-lab" title="' + esc(x.ITEM_NO + ' ' + (x.ITEM_NAME || '')) + '">' + esc(x.ITEM_NO) + '</span>' +
            '<span class="bar-track"><span class="bar-fill" style="width:' + Math.max(3, Math.round(v / maxS * 100)) + '%;background:' + col + '"></span></span>' +
            '<span class="bar-val">' + qfmt(v) + '</span></div>';
        }).join('') +
        '<p class="mini" style="margin-top:8px">红色 = 关键件缺料（<b>阻断级</b>，影响开工）；橙色 = 非关键件（提示级）。</p></div>';
    }

    /* 缺料明细 */
    h += '<div class="card"><div class="board-head"><h3 style="margin:0">缺料明细</h3>' +
      '<span class="mini">共 ' + shorts.length + ' 条（关键件 ' + keyCnt + ' 条）</span>' +
      '<span class="spacer"></span><button class="ghost sm" data-batchopen="MRP_KIT_SHORT">到「缺料明细」表</button></div>' +
      (shorts.length ? '<div class="tbl-wrap" style="margin-top:12px;max-height:420px;overflow:auto"><table class="grid"><thead><tr>' +
        '<th>缺料ID</th><th>订单/工单</th><th>品号</th><th>品名</th><th>缺料数量</th><th>需求日期</th><th>预计恢复</th><th>供应方式</th><th>关键件</th><th>阻断</th><th>状态</th></tr></thead><tbody>' +
        shorts.map(function (s) {
          return '<tr><td class="pk">' + esc(s.SHORT_ID) + '</td><td>' + esc(s.ORDER_NO || '-') + '</td>' +
            '<td>' + esc(s.ITEM_NO) + '</td><td>' + esc(s.ITEM_NAME) + '</td>' +
            '<td class="cellnum"' + (s.BLOCK_FLAG == 1 ? ' style="font-weight:700;color:#e11d48"' : '') + '>' + qfmt(s.SHORT_QTY) + '</td>' +
            '<td>' + esc(String(s.REQ_DATE || '').slice(0, 10)) + '</td><td>' + esc(String(s.RECOVER_DATE || '').slice(0, 10)) + '</td>' +
            '<td>' + esc(s.SUPPLY_TYPE || '-') + '</td><td>' + (s.KEY_ITEM_FLAG == 1 ? '是' : '') + '</td>' +
            '<td>' + (s.BLOCK_FLAG == 1 ? '<span class="tag bad">阻断</span>' : '') + '</td><td>' + statusTag(s.STATUS) + '</td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty sm" style="margin-top:12px">本次无缺料记录——所有检查对象均可齐套。</div>') +
      '</div>';

    /* 算法说明 */
    h += foldCard('kitAlgo', '算法说明 · 齐套率与缺料分级', '齐套量 · 齐套率 · 关键件阻断',
      '<div class="modchain">' +
      '<div class="mc-item"><div class="mc-t">① 齐套对象</div><div class="mc-d">取净需求中 <b>LEVEL 1</b> 的成品 / 独立需求件（有 BOM 才有齐套意义）作为检查对象</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">② 齐套量</div><div class="mc-d"><b>齐套量 = Σ min( 需求数量 , 可供量 )</b>，其中 可供量 = 可用库存 + 在制 + 在途</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">③ 齐套率与缺口</div><div class="mc-d"><b>齐套率 = 齐套量 ÷ 需求数量</b>；<b>缺料数量 = max( 0 , 需求 − 齐套 )</b></div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">④ 缺料分级</div><div class="mc-d">「物料计划属性」中 <b>KEY_ITEM_FLAG = 关键件</b> → <b>阻断级预警</b>（BLOCK_FLAG=1，影响开工）；否则 → 记录缺口（提示级）</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">⑤ 与排程的衔接</div><div class="mc-d">齐套日期写入排程任务的 <code>KIT_DATE</code>，作为<b>最早开工约束</b>；在排程工作台启用「齐套约束」后生效</div></div>' +
      '</div>' +
      '<p class="mini" style="margin-top:10px"><b>可调参数在哪：</b>「物料计划属性」的「关键件标识」决定缺料是阻断还是提示。</p>');
    return h;
  }

  /* ---------- 核心③ 排程工作台 ---------- */
  function viewSched() {
    var vers = rows('SCH_VERSION');
    var cur = vers.filter(function (v) { return v.VERSION_NO === st.schedVer; })[0] || vers[0] || null;
    var rules = rows('SCH_RULE');
    var rule = (cur && cur.RULE_NO ? rfind('SCH_RULE', function (r) { return r.RULE_NO === cur.RULE_NO; }) : null)
      || rules.filter(function (r) { return +r.IS_DEFAULT === 1; })[0] || rules[0] || {};
    var tasks = cur ? rows('SCH_TASK').filter(function (t) { return t.VERSION_NO === cur.VERSION_NO; }) : [];
    var mode = st.ganttMode || 'res';
    var delayCnt = tasks.filter(function (t) { return t.DELAY_FLAG == 1; }).length;
    var changeSum = tasks.reduce(function (a, t) { return a + (+t.CHANGE_MIN || 0); }, 0);
    var util = cur ? brNum(cur.UTIL_RATE) : 0;

    var h = '';
    h += '<div class="card"><div class="board-head"><h2>生产排程 · 排程工作台</h2></div>' +
      '<p class="mini">用<b>有限产能自动排程</b>替代人工 Excel 排产：按<b>排程规则</b>把每道工序排到「资源 × 起止时间 × 数量」，产出<b>排程版本 + 任务 + 日排产</b>。约束包含资源产能、换型时间、工作日历与齐套日期。</p></div>';

    /* 规则与优化目标（核心：把规则和目标摆到台面上） */
    var ruleOpts = rules.map(function (r) {
      var sel = (st.schedRule ? r.RULE_NO === st.schedRule : (cur && r.RULE_NO === cur.RULE_NO));
      return '<option value="' + esc(r.RULE_NO) + '"' + (sel ? ' selected' : '') + '>' + esc(r.RULE_NO + ' · ' + (r.RULE_NAME || '')) + (r.IS_DEFAULT == 1 ? '（默认）' : '') + '</option>';
    }).join('');
    h += '<div class="card" style="border-left:4px solid var(--primary)"><h3>排程规则与优化目标</h3>' +
      (rules.length ? '<div class="kv-grid">' +
        '<div class="kv"><span class="k">优化目标</span><span class="v" style="color:var(--primary-d);font-weight:700">' + esc(rule.OPT_TARGET || '-') + '</span></div>' +
        '<div class="kv"><span class="k">订单排序</span><span class="v">' + esc(rule.ORDER_SORT || '-') + '</span></div>' +
        '<div class="kv"><span class="k">资源优选</span><span class="v">' + esc(rule.RES_SELECT || '-') + '</span></div>' +
        '<div class="kv"><span class="k">排程方向</span><span class="v">' + esc(rule.SCH_DIR || '-') + '</span></div>' +
        '<div class="kv"><span class="k">有限产能</span><span class="v">' + (rule.FINITE_CAP == 1 ? '启用' : '不启用') + '</span></div>' +
        '<div class="kv"><span class="k">瓶颈工序</span><span class="v">' + esc(rule.BOTTLENECK_STEP || '不指定') + '</span></div>' +
        '<div class="kv"><span class="k">齐套约束</span><span class="v">' + (rule.KIT_CONSTRAINT == 1 ? '启用' : '不启用') + '</span></div>' +
        '<div class="kv"><span class="k">冻结优先</span><span class="v">' + (rule.FREEZE_FIRST == 1 ? '启用' : '不启用') + '</span></div>' +
        '</div>' +
        '<div class="rel-note" style="margin-top:12px"><b>优化目标说明：</b>' + optTargetDesc(rule.OPT_TARGET) + '</div>' +
        '<div class="toolbar" style="margin-top:12px"><span class="mini">切换规则（不同规则的排序 / 优选 / 目标不同）：</span>' +
        '<select id="schedRule" class="mini-sel">' + ruleOpts + '</select>' +
        '<span class="spacer"></span><button class="primary" data-schedrun="1">▶ 运行自动排程</button> ' +
        '<button class="ghost" data-batchopen="SCH_ADJUST">✋ 人工调整</button></div>' :
        '<div class="empty sm">尚无排程规则。请先到「生产排程 → 排程规则」维护规则（订单排序 / 资源优选 / 优化目标）。</div>') +
      '</div>';

    /* 结果 KPI */
    h += '<div class="card"><h3>排程结果概览</h3>' +
      (cur ? '' : '<p class="mini">尚未运行过排程，以下指标为 0。</p>') +
      '<div class="kpis">' +
      kpi(tasks.length, '排程任务数') +
      kpi(delayCnt, '延期任务数') +
      kpi(qfmt(changeSum), '总换型时间(分)') +
      kpi((util * 100).toFixed(1) + '%', '资源利用率') +
      '</div>' +
      (cur ? '<p class="mini" style="margin-top:10px">当前版本 <b>' + esc(cur.VERSION_NO) + '</b> · 规则 ' + esc(cur.RULE_NO || '-') +
        ' · 类型 ' + esc(cur.VERSION_TYPE || '-') + ' · 状态 ' + statusTag(cur.STATUS) +
        ' · 生成 ' + esc(String(cur.GEN_TIME || '').slice(0, 16)) + '</p>' : '') +
      '</div>';

    /* 甘特图（内嵌三视角） */
    h += '<div class="card"><div class="board-head"><h3 style="margin:0">排产甘特（三视角）</h3>' +
      '<div class="chips">' + [['res', '机台视角'], ['step', '工序视角'], ['order', '订单视角']].map(function (m) {
        return '<button class="chip' + (mode === m[0] ? ' active' : '') + '" data-gm="' + m[0] + '">' + m[1] + '</button>';
      }).join('') + '</div></div>' +
      '<p class="mini" style="margin-top:8px">横轴 = <b>日期刻度</b>，条按<b>真实开工~完工</b>水平定位（同组内时间重叠的任务自动分层）；<b>红=延期、橙=插单、灰=锁定、绿=正常</b>，深色覆盖段 = 已完成实绩。切换视角按不同维度分组：机台 / 工序 / 订单。要看更细的时钟刻度请点「打开完整甘特图 →」。</p>' +
      '<div style="margin-top:12px">' + (cur ? ganttMini(tasks, mode) : '<div class="empty sm">尚无排程版本。运行自动排程后在此查看甘特。</div>') + '</div>' +
      (vers.length > 1 ? '<div class="toolbar" style="margin-top:12px"><span class="mini">排程版本：</span>' +
        '<select id="schedVer" class="mini-sel">' + vers.map(function (v) {
          return '<option value="' + esc(v.VERSION_NO) + '"' + (cur && v.VERSION_NO === cur.VERSION_NO ? ' selected' : '') + '>' + esc(v.VERSION_NO) + ' · ' + esc(v.STATUS) + '</option>';
        }).join('') + '</select><span class="spacer"></span>' +
        '<button class="ghost sm" data-viewto="gantt">打开完整甘特图 →</button></div>' : '') +
      '</div>';

    /* 任务明细（精简）：**始终渲染**——0 条时给出原因，避免「卡片整块消失、看不出是版本无任务还是没渲染」 */
    var ts = tasks.slice().sort(function (a, b) { return String(a.START_TIME).localeCompare(String(b.START_TIME)); }).slice(0, 60);
    h += '<div class="card"><div class="board-head"><h3 style="margin:0">排程任务明细</h3>' +
      '<span class="mini">' + (cur ? '版本 ' + esc(cur.VERSION_NO) + ' · 共 ' + tasks.length + ' 条' + (tasks.length > 60 ? '，此处显示前 60 条' : '') : '尚无排程版本') + '</span>' +
      '<span class="spacer"></span><button class="ghost sm" data-batchopen="SCH_TASK">到「排程任务」表</button></div>' +
      (tasks.length ?
        '<div class="tbl-wrap" style="margin-top:12px;max-height:420px;overflow:auto"><table class="grid"><thead><tr>' +
        '<th>任务ID</th><th>工单</th><th>品名</th><th>工序</th><th>资源</th><th>计划开工</th><th>计划完工</th><th>计划数</th><th>换型(分)</th><th>延期</th></tr></thead><tbody>' +
        ts.map(function (t) {
          return '<tr><td class="pk">' + esc(t.TASK_ID) + '</td><td>' + esc(t.WO_NO) + '</td><td>' + esc(t.ITEM_NAME) + '</td>' +
            '<td>' + esc(t.STEP_NO + ' ' + t.STEP_NAME) + '</td><td>' + esc(t.RES_NO) + '</td>' +
            '<td>' + esc(String(t.START_TIME).slice(0, 16)) + '</td><td>' + esc(String(t.END_TIME).slice(0, 16)) + '</td>' +
            '<td class="cellnum">' + qfmt(t.PLAN_QTY) + '</td><td class="cellnum">' + qfmt(t.CHANGE_MIN) + '</td>' +
            '<td>' + (t.DELAY_FLAG == 1 ? '<span class="tag bad">延期</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty sm" style="margin-top:12px">当前版本（<b>' + esc(cur ? cur.VERSION_NO : '—') + '</b>）暂无排程任务。可能原因：① 该版本只登记了版本头、未产出任务；② 当前工单已全部完工、无需再排。<br/>可切换上方的「排程版本」，或点「▶ 运行自动排程」按当前工单重新排一版。</div>') +
      '</div>';

    /* 算法说明 */
    h += foldCard('schedAlgo', '算法说明 · 排程规则、优化目标与约束', '有限产能 · 资源优选 · 换型 · 日历 · 齐套',
      '<div class="modchain">' +
      '<div class="mc-item"><div class="mc-t">① 取待排工单</div><div class="mc-d">取 MES 只读镜像 <code>RF_WORK_ORDER</code> 中<b>未完工</b>的工单（已完工 / 已入库不再进排程）</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">② 工序展开</div><div class="mc-d">按工单的工艺路线 <code>RF_ROUTE</code> 取各道工序，按工序号顺序排；<b>外协工序</b>（无资源分组）不进本厂排产，只做提示</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">③ 资源优选（一工序多机）</div><div class="mc-d">在工序对应的<b>资源分组</b>成员机台中，按规则（<b>' + esc(rule.RES_SELECT || '轮询分摊') + '</b>）选一台；组内轮询实现负载分摊，避免所有任务压在一台设备上</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">④ 约束校验</div><div class="mc-d">' +
      '<b>产能</b>：工时 = 计划数量 × 标准工时（最小 1h）· ' +
      '<b>换型</b>：取「换型时间」表中「任意 → 该产品」的通配行，计入换型分钟 · ' +
      '<b>日历</b>：以「工厂日历」的可用时段为界 · ' +
      '<b>齐套</b>：启用时以任务的 <code>KIT_DATE</code> 为最早开工约束</div></div>' +
      '<div class="mc-arrow">↓</div>' +
      '<div class="mc-item"><div class="mc-t">⑤ 排定与产出</div><div class="mc-d">按「<b>' + esc(rule.SCH_DIR || '正排') + '</b>」方向排到「资源 × 起止时间 × 数量」，产出<b>排程版本 + 排程任务 + 日排产(3~7天)</b>，并统计延期数 / 总换型时间 / 资源利用率</div></div>' +
      '</div>' +
      '<p class="mini" style="margin-top:10px"><b>优化目标怎么影响排产：</b>' + optTargetDesc(rule.OPT_TARGET) + '</p>' +
      '<p class="mini"><b>可调参数在哪：</b>「生产排程 → 排程规则」改排序 / 优选 / 目标 / 方向 / 瓶颈 / 齐套约束；「计划基础数据」下的换型时间、资源分组、工厂日历决定约束边界。改后在本工作台重新运行即可看到新版本。</p>');
    return h;
  }

  /* 运行 MRP 计算（读工作台当前选择 → 生成版本 → 计划建议）
   * 兜底：若「运行设置」被收起导致勾选框不在 DOM，则按**全部需求源**计算（避免点了运行却一直提示未勾选） */
  function runMrp() {
    var all = rows('BAS_DEMAND');
    if (!all.length) { toast('尚无需求源，请先点「一键生成演示需求源」或到「需求管理 → 需求源」准备'); return; }
    var boxes = Array.prototype.slice.call(document.querySelectorAll('.mrpdem'));
    var picked = boxes.length
      ? boxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.getAttribute('data-no'); })
      : all.map(function (d) { return d.DEMAND_NO; });
    if (!picked.length) { toast('请至少勾选一张需求源'); return; }
    var sel = document.getElementById('mrpRule');
    if (sel) st.mrpRule = sel.value;
    var bNo = genCalc({ ruleNo: st.mrpRule, demandNos: picked, batchType: picked.length === all.length ? '全量' : '指定需求源' });
    if (!bNo) { render(); return; }
    genSuggest(bNo);
    st.batchNo = bNo; st.view = 'mrp'; st.mrpTab = 'net'; setNav(); render();
    toast('已运行 MRP 计算（版本 ' + bNo + '，纳入 ' + picked.length + ' 张需求源）');
  }
  /* 运行齐套检查（可重复：同版本先撤旧结果再重算） */
  function runKit() {
    var batches = rows('MRP_BATCH');
    if (!batches.length) { toast('请先运行 MRP 计算，生成需求计算版本'); return; }
    var sel = document.getElementById('kitBatch');
    var bNo = sel ? sel.value : batches[batches.length - 1].BATCH_NO;
    rows('MRP_KIT_CHECK').filter(function (k) { return k.BATCH_NO === bNo; }).forEach(function (k) { removeWithChildren('MRP_KIT_CHECK', k.ID); });
    genKit(bNo);
    var made = rows('MRP_KIT_CHECK').filter(function (k) { return k.BATCH_NO === bNo; })[0];
    st.kitNo = made ? made.CHECK_NO : st.kitNo;
    st.view = 'kit'; setNav(); render();
    toast('已运行齐套检查（版本 ' + bNo + '）');
  }
  /* 运行自动排程（按工作台选定规则生成新版本） */
  function runSched() {
    var sel = document.getElementById('schedRule');
    if (!rows('SCH_RULE').length) { toast('尚无排程规则，请先到「生产排程 → 排程规则」维护'); return; }
    var ruleNo = sel ? sel.value : (rows('SCH_RULE').filter(function (r) { return +r.IS_DEFAULT === 1; })[0] || rows('SCH_RULE')[0]).RULE_NO;
    st.schedRule = ruleNo;
    var before = rows('SCH_VERSION').length;
    genSchedule(st.batchNo || null, ruleNo);
    var vers = rows('SCH_VERSION');
    if (vers.length > before) st.schedVer = vers[vers.length - 1].VERSION_NO;
    st.view = 'sched'; setNav(); render();
    var n = rows('SCH_TASK').filter(function (t) { return t.VERSION_NO === st.schedVer; }).length;
    toast('已按规则 ' + ruleNo + ' 自动排程（任务 ' + n + ' 条）');
  }

  /* ---------- UNS 数据源（APS 取数 ↔ supOS UNS 节点映射） ---------- */
  function viewUns() {
    var map = S.UNS_MAP || {};
    var rowsHtml = Object.keys(map).map(function (t) {
      var m = map[t], def = S.TABLES[t] || {};
      var cnt = (window.APS_SEED && window.APS_SEED[t] && window.APS_SEED[t].length) || rows(t).length;
      return '<tr><td class="pk">' + esc(t) + '</td><td>' + esc(def.label || '') + '</td>' +
        '<td><code>' + esc(m.alias) + '</code></td><td class="mini">' + esc(m.node) + '</td>' +
        '<td class="cellnum">' + cnt + '</td></tr>';
    }).join('');
    var h = '<div class="card"><h2>UNS 数据源映射</h2>' +
      '<p class="mini">APS 遵循 <b>「主数据零重建」</b>：物料 / BOM / 工艺路线 / 设备 / 销售订单 / 库存 / 采购在途 / 工单实绩的<b>真源在 supOS UNS</b>（flash01 环境的「MES制造管理系统」功能域），APS 不做重复维护入口。下表为 APS 取数与 UNS 节点的对应关系——需求源、物料需求计算、齐套计算、排程所需的输入数据，均<b>按需从 UNS 读取</b>。</p>' +
      '<div class="tbl-wrap"><table class="grid"><thead><tr><th>APS 取数</th><th>用途</th><th>UNS 别名</th><th>UNS 节点</th><th>快照行数</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
      '<p class="mini" style="margin-top:8px">说明：连上 UNS 后由取数层用实时数据填充；本地开发 / 离线演示时使用<b>内置快照</b>兜底（即上表「快照行数」），保证全链路可完整跑通。这些取数表<b>不出现在左侧导航</b>，避免与 MES 重复维护。</p>' +
      '</div>';
    h += '<div class="card"><h3>取数场景示例</h3>' +
      '<ul class="mini" style="line-height:1.9;padding-left:18px">' +
      '<li><b>需求源（销售订单）</b>：进入「需求管理 → 需求源」，点工具栏「<b>从销售订单生成</b>」→ 弹窗列出 UNS 销售订单明细中<b>未交量 &gt; 0</b> 的订单行，<b>可多选（整单或逐行）</b>，确认后品号 / 品名 / 需求数量 / 需求日期随所选来源自动带出，合并生成一张需求源单。</li>' +
      '<li><b>物料需求计算</b>：按 BOM（UNS <code>mes_md_bom_line</code>）逐层展开，扣减 UNS 库存（<code>mes_wm_stock</code>）/ 在制（<code>mes_ex_wo_step</code>）/ 在途（<code>mes_pd_purchase_order_line</code>）生成净需求。</li>' +
      '<li><b>物料齐套计算</b>：按需求日期「先到先得」校验可用库存与在途到货，输出齐套数量 / 齐套率 / 齐套日期。</li>' +
      '<li><b>生产排程</b>：排程对象来自 UNS 工单工序（<code>mes_ex_wo_step</code>），工序-设备能力与节拍取 UNS 工艺 / 设备数据。</li>' +
      '</ul></div>';
    return h;
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
        '<p class="mini">所属模块：' + esc(g ? g.name : def.module) + '。下面先介绍该表所属模块的作用与存放数据，再展示该表的<b>来源（从哪算来）</b>、<b>派生（算出什么）</b>与<b>如何操作</b>。</p></div>';
      h += groupIntroCard(g ? g.name : '');
      /* 表级使用说明补充（schema 的 TABLE_TIPS）：解释该表的特殊交互与口径 */
      var tips = (S.TABLE_TIPS || {})[st.table] || [];
      if (tips.length) {
        h += '<div class="card"><h3>本表操作要点</h3><ul class="guide-ul">' +
          tips.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="card"><h3>当前表计算派生关系</h3>' +
        '<p class="mini">' + esc(def.label) + ' 可从 ' + esc(srcTxt) + ' 进入，或直接「新建」；往后可派生 ' +
        (S.FLOW[st.table] && S.FLOW[st.table].length ? S.FLOW[st.table].map(function (f) { return '「' + S.TABLES[f.to].label + '」'; }).join('、') : '末端单据（无下游）') +
        '。计算结果由三个核心域各自的「计算工作台」运行产出：物料需求计算 → MRP 计算工作台、物料齐套计算 → 齐套计算工作台、生产排程 → 排程工作台。</p>' +
        tableFlowPanel(st.table, null) + '</div>';
      return h;
    }
    // 通用说明（平台用法）
    return '' +
    '<div class="card">' +
      '<h2>使用说明 · APS 高级计划与排程系统</h2>' +
      '<p class="mini">本页长期内置在平台上，介绍系统怎么用、计划怎么跑。视图入口分布在两处：<b>顶栏</b>（数据浏览 / 数据模型 / 使用说明）与<b>左侧树</b>对应功能域下（<b>计划看板</b>：计划驾驶舱 / 排产甘特图；<b>物料需求计算</b>：MRP 计算工作台；<b>物料齐套计算</b>：齐套计算工作台；<b>生产排程</b>：排程工作台；<b>系统与集成</b>：UNS 数据源映射）；也可点右上角「⚙ 显示设置」把任一视图勾到顶栏。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>一、系统定位</h3>' +
      '<p>这是一套面向汽配机加工行业的 <b>APS（高级计划与排程系统）原型</b>：以《APS产品功能需求文档 V5》与《APS产品功能知识库》为唯一数据源（Schema 驱动），围绕 <b>三核心</b>——<b>①物料需求计算</b>（缺料判定）+ <b>②物料齐套计算</b>（齐套率/齐套日期）+ <b>③生产排程</b>（有限产能自动排程 → 甘特调整；不含 ECN）——共 <b>' + Object.keys(S.TABLES).length + ' 张数据表</b>、<b>' + Object.keys(S.DOMAINS).length + ' 个功能域</b>。业务数据保存在 <b>supOS UNS 关系表</b>，多人多浏览器看到的是同一份数据；顶栏右上角显示当前数据源与同步状态。</p>' +
      '<p class="mini">与 MES <b>同库共生、主数据零重建</b>：物料 / BOM / 工艺路线 / 设备 / 销售订单 / 库存 / 采购在途 / 工单报工实绩等主数据<b>只引用不重建</b>——真源在 supOS UNS「MES制造管理系统/工厂建模」（flash01 环境），APS 按需直读、不做重复维护入口；APS 只补充计划参数、计算与排程结果，并回写 MES 请购与比价选商 / 生产计划 / 排程单。</p>' +
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
        '<li><b>左侧功能域树</b>：顶层是各功能域（「计划基础数据」默认展开，其余按需点开）。三个核心域的<b>第一项就是计算工作台</b>（MRP 计算工作台 / 齐套计算工作台 / 排程工作台），其下才是计算结果明细表（净需求 / 补料建议 / 生产计划建议 / 齐套检查 / 缺料明细 / 排程版本 / 排程任务等）。带「主」标记、或右侧带 ▸ 的表表示其下挂有<b>子表 / 子项</b>（需求源 → 需求明细、需求计算版本 → 净需求、齐套检查 → 缺料明细、排程版本 → 排程任务），点 ▸ 可展开。「<b>计划看板</b>」下挂「<b>计划驾驶舱 / 产能负荷看板 / 齐套率看板 / 排产甘特图</b>」，「<b>系统与集成</b>」下挂「<b>UNS 数据源映射</b>」。</li>' +
        '<li><b>数据浏览</b>：点任意表单进入，可<b>搜索 / 新增 / 编辑 / 删除</b>记录；工具栏另有<b>导入 / 导出 / 打印 / 审核 / 显示字段</b>（<b>计算结果表</b>由系统写入，工具栏只保留<b>查询 / 导出 / 编辑 / 删除</b>）。带「主」标记的主表点任意一行会弹出<b>单据详情</b>（主表信息 + 子表明细，子表可继续新增 / 导入，<b>计算结果子表除外</b>）。</li>' +
        '<li><b>新增（主子表一致）</b>：主表点「+ 新增」录表头，进入单据详情后在其子表区点「新增明细」录入行；<b>明细行数、金额、数量</b>由子表实时汇总回表头展示。<b>计算结果表与需求计算版本</b>不提供「+ 新增 / + 新增明细」，其数据一律由对应计算工作台写入。</li>' +
        '<li><b>导入</b>：点「导入」可下载 CSV 模板——模板表头为<b>中文名</b>，必填项带 <code>*</code>，引用字段标注「须为某主数据中已存在的编号」，并在 # 说明行给出绑定规则；子表明细的「单据详情」里也有「导入明细」按钮，父单号（如需求单号 / 版本号 / 齐套单号 / 排程版本号）会自动绑定到当前单据，并做<b>父单存在性校验</b>。<b>计算结果表</b>（净需求 / 补料建议 / 生产计划建议 / 齐套检查 / 缺料明细 / 排程版本 / 排程任务 / 日排产 / 人工调整记录 / 排产异常 / 需求计算版本）不提供「导入」，其数据一律由对应计算工作台写入。</li>' +
        '<li><b>报表分析（只读）</b>：「计划分析与预警」域内的表格数据由业务数据<b>实时汇总</b>（上游一改，报表自动变化），因此只保留「查询 / 导出」。</li>' +
        '<li><b>审核</b>：业务录入表（需求源 / 排程规则 / 计划基础数据 / 系统表等）预留「审核状态 / 审核人 / 审核时间」字段（为后续工作流准备），点「审核」选择记录并给出结论即可写入。<b>计算结果表</b>（需求计算版本 / 净需求 / 齐套检查 / 缺料明细 / 补料建议 / 生产计划建议 / 排程版本 / 排程任务 / 日排产 / 人工调整记录 / 排产异常）由系统写入，<b>不提供「审核」、也不展示审核字段</b>。</li>' +
        '<li><b>字段可配置</b>：在「数据模型」或「显示字段」里可对字段<b>新增 / 编辑 / 删除 / 显示隐藏 / 上下移动调整顺序</b>（备注统一在最后），均本地持久化。</li>' +
        '<li><b>需求来源约束</b>（需求源 → 需求明细）：「需求来源」选定后，明细的<b>品号候选自动收窄到该来源的可用数据</b>，选中品号即自动带出<b>品名 / 来源单据号 / 需求日期 / 需求数量</b>；「冲减后需求」按 <b>需求数量 − 预测冲减量</b> 自动计算。</li>' +
        '<li><b>来源单据号聚合</b>（需求源）：「来源单据号」由明细<b>实时聚合</b>——多条用「；」拼接、单条原样，<b>自动去重</b>；新增 / 修改 / 删除（含导入）明细后自动重算回写。</li>' +
        '<li><b>三个计算工作台（怎么算）</b>——①「<b>物料需求计算 → MRP 计算工作台</b>」：选排程规则 + 勾选需求源（默认全选、可逐张取消）→ 点「运行 MRP 计算」，产出<b>净需求 + 补料建议 + 生产计划建议</b>；②「<b>物料齐套计算 → 齐套计算工作台</b>」：选版本 → 点「运行齐套检查」，产出<b>齐套率 + 缺料明细</b>；③「<b>生产排程 → 排程工作台</b>」：选排程规则（页面会显示该规则的<b>优化目标</b>与约束）→ 点「运行自动排程」，产出<b>排程版本 + 任务 + 日排产</b>，并在页内直接看甘特。每个工作台都带「算法说明」折叠卡，公开公式与可调参数。</li>' +
      '</ul>' +
    '</div>' +

    '<div class="card">' +
      '<h3>四、核心计算链（计划怎么跑）</h3>' +
      '<p class="mini"><b>最常用的一条路：</b>① 到「<b>需求管理 → 需求源</b>」准备需求 → ② 到「<b>物料需求计算 → MRP 计算工作台</b>」选口径、勾需求源、点「<b>运行 MRP 计算</b>」→ ③ 到「<b>物料齐套计算 → 齐套计算工作台</b>」点「<b>运行齐套检查</b>」→ ④ 到「<b>生产排程 → 排程工作台</b>」选排程规则、点「<b>运行自动排程</b>」。每一步算完即在同一页看到 KPI 与结果明细，<b>不需要手工逐条建单</b>。</p>' +
      '<p class="mini">下面 8 步行是<b>核心计算链</b>的完整含义（版本中心 · APS 原生逻辑），每一步都落在对应功能域里；如需逐步演示每一步写入什么数据，可打开旧版「核心流程」页（已从导航下线，深链 <code>?v=flow</code> 仍可达）点右上「展开一键演练」。</p>' +
      '<div class="flow-line-list">' +
        fline('1', '① 确认需求源（销售订单 / 库存补充）', '汇总两类需求来源，形成生效需求（BAS_DEMAND / BAS_DEMAND_LINE）——这是本次计算的输入') +
        fline('2', '② 选排程规则（作为计算口径）', '排程规则是独立功能表（SCH_RULE）；在需求计算版本里被引用为本次计算口径（订单排序 / 资源优选 / 优化目标 / 正倒排 / 瓶颈 / 齐套约束）') +
        fline('3', '③ 跑需求计算版本（净需求逐层展开）', '按 BOM 自成品向下逐层展开，净需求 = max(毛需求 − 可用库存 − 在制 − 在途, 0)，再按最小批量 / 批量倍数取整（MRP_BATCH / MRP_NET_REQ）') +
        fline('4', '④ 派生结果 A · 齐套检查（逐层 + 先到先得）', '对订单 / 工单逐层齐套，多订单共用库存按需求日期先到先得，关键件缺料阻断性预警（MRP_KIT_CHECK / MRP_KIT_SHORT）') +
        fline('5', '⑤ 派生结果 B · 补料建议 / 生产计划建议', '外购 / 外协项生成补料建议、自制项生成生产计划建议，人工确认后回写 MES（PR_SUGGEST / PP_PLAN_SUGGEST）') +
        fline('6', '⑥ 派生结果 C · 有限产能自动排程（日排产）', '在约束下把每道工序排到「资源 × 起止时间 × 数量」，产出日排产(3~7天)（SCH_VERSION / SCH_TASK / SCH_DAY_PLAN）') +
        fline('7', '⑦ 甘特图人工调整 / 插单 / 锁定', '拖拽改时间 / 换资源并实时校验冲突；插单前出影响预览；锁定任务不参与重排（SCH_ADJUST）') +
        fline('8', '⑧ 排产异常预警', '自动识别排程结果中的交期延期 / 资源冲突 / 超负荷，给出异常级别与建议处置（SCH_EXCEPTION）') +
      '</div>' +
      '<p class="mini">⚠️ 注意 ④⑤⑥ 是<b>同一次计算的平级产物</b>（互为兄弟），不是 MES 那种「一张单流转出下一张单」；它们分别落在「物料需求计算」「物料齐套计算」「生产排程」三个域的结果明细里。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>五、视图显示设置</h3>' +
      '<p>顶栏默认只显示 <b>数据浏览 / 数据模型 / 使用说明</b> 三个；其余视图挂在<b>左侧树</b>对应功能域下——「<b>计划看板</b>」（计划驾驶舱 / 产能负荷看板 / 齐套率看板 / 排产甘特图）、「<b>物料需求计算</b>」（MRP 计算工作台）、「<b>物料齐套计算</b>」（齐套计算工作台）、「<b>生产排程</b>」（排程工作台）、「<b>系统与集成</b>」（UNS 数据源映射）。点右上角「⚙ 显示设置」可把任一视图勾到顶栏一并显示，设置即时生效并自动保存。每次打开 / 刷新默认落在「<b>计划看板 · 计划驾驶舱</b>」。</p>' +
    '</div>' +

    '<div class="card">' +
      '<h3>六、范围边界</h3>' +
      '<p class="mini">实时状态展示归入「<b>计划看板 → 计划驾驶舱</b>」，产能负荷与齐套率以<b>看板（卡片 + 图形 + 明细）</b>形式归入「<b>计划看板 → 产能负荷看板 / 齐套率看板</b>」，排程时间轴归入「<b>计划看板 → 排产甘特图</b>」，其余汇总类分析（交期预警表 / 排程KPI / 物料需求计划表 / 缺料明细表）为「<b>计划分析与预警</b>」下的只读报表表。以上全部只读实时派生。<b>集成接口一期仅预留、不实现实际对接</b>；<b>本期生产排程不含工程变更（ECN）</b>。所有主数据（物料 / BOM / 工艺 / 设备 / 订单 / 库存）真源在 supOS UNS「工厂建模」，APS 内只读引用、不做重复维护入口。</p>' +
    '</div>';
  }
  function fline(n, t, d) {
    return '<div class="frow"><span class="fnum">' + n + '</span><div><b>' + esc(t) + '</b><div class="mini">' + esc(d) + '</div></div></div>';
  }

  /* ============================================================
   * 数据洞察（对话式数据查询与分析）
   * 通过自然语言查询本地 APS 数据（localStorage），返回分析结论与明细表。
   * 支持 @图片 附参考图（图片仅作对话展示，分析依据为文本问句 + 系统数据）。
   * ============================================================ */
  var INSIGHT_ALIAS = {
    '需求源': ['BAS_DEMAND'], '需求': ['BAS_DEMAND', 'BAS_DEMAND_LINE'], '需求明细': ['BAS_DEMAND_LINE'], '订单需求': ['BAS_DEMAND'], '预测': ['BAS_DEMAND'], '叫料': ['BAS_DEMAND'],
    '计划属性': ['BAS_ITEM_PLAN_ATTR'], '物料计划': ['BAS_ITEM_PLAN_ATTR'],
    '排产资源': ['BAS_RESOURCE'], '资源': ['BAS_RESOURCE'], '机台': ['BAS_RESOURCE'], '设备': ['BAS_RESOURCE', 'RF_EQUIPMENT'], '产线': ['BAS_RESOURCE'],
    '资源分组': ['BAS_RESOURCE_GROUP'], '一工序多机': ['BAS_RESOURCE_GROUP'], '多机': ['BAS_RESOURCE_GROUP'],
    '切换': ['BAS_CHANGEOVER'], '换型': ['BAS_CHANGEOVER'], '换型时间': ['BAS_CHANGEOVER'],
    '日历': ['BAS_CALENDAR'], '工厂日历': ['BAS_CALENDAR'], '工作中心日历': ['BAS_CALENDAR'],
    '维保': ['BAS_MAINTENANCE'], '故障占用': ['BAS_MAINTENANCE'], '占用': ['BAS_MAINTENANCE'],
    '需求计算': ['MRP_BATCH'], '批次': ['MRP_BATCH'], '计算版本': ['MRP_BATCH'],
    '净需求': ['MRP_NET_REQ'], '物料需求': ['MRP_NET_REQ'], 'MRP': ['MRP_BATCH', 'MRP_NET_REQ'],
    '齐套': ['MRP_KIT_CHECK'], '齐套检查': ['MRP_KIT_CHECK'], '齐套率': ['MRP_KIT_CHECK'],
    '缺料': ['MRP_KIT_SHORT'], '缺料明细': ['MRP_KIT_SHORT'], '短料': ['MRP_KIT_SHORT'],
    '补料': ['PR_SUGGEST'], '补料建议': ['PR_SUGGEST'], '请购': ['PR_SUGGEST'], '请购建议': ['PR_SUGGEST'],
    '生产计划': ['PP_PLAN_SUGGEST'], '计划建议': ['PP_PLAN_SUGGEST'], '生产计划建议': ['PP_PLAN_SUGGEST'],
    '排程规则': ['SCH_RULE'], '规则': ['SCH_RULE'],
    '排程版本': ['SCH_VERSION'], '版本': ['SCH_VERSION'], '排程': ['SCH_VERSION', 'SCH_TASK'],
    '排程任务': ['SCH_TASK'], '任务': ['SCH_TASK'], '工序任务': ['SCH_TASK'], '甘特': ['SCH_TASK'],
    '日排产': ['SCH_DAY_PLAN'], '日计划': ['SCH_DAY_PLAN'],
    '人工调整': ['SCH_ADJUST'], '调整': ['SCH_ADJUST'], '插单': ['SCH_ADJUST'], '锁定': ['SCH_ADJUST'],
    '排产异常': ['SCH_EXCEPTION'], '异常': ['SCH_EXCEPTION'], '延期': ['SCH_EXCEPTION'], '冲突': ['SCH_EXCEPTION'],
    '产能负荷': ['SCH_TASK'], '产能': ['SCH_TASK'], '负荷': ['SCH_TASK'], '负荷率': ['SCH_TASK'],
    '交期': ['RPT_DELIVERY_ALERT'], '交期预警': ['RPT_DELIVERY_ALERT'], '延期': ['RPT_DELIVERY_ALERT'], '预警': ['RPT_DELIVERY_ALERT'],
    '排程KPI': ['RPT_SCHEDULE_KPI'], 'KPI': ['RPT_SCHEDULE_KPI'], '准时': ['RPT_SCHEDULE_KPI'],
    '物料需求计划': ['RPT_NET_REQ_SUM'], '需求计划': ['RPT_NET_REQ_SUM'], '需求汇总': ['RPT_NET_REQ_SUM'],
    '缺料明细表': ['RPT_SHORT_DETAIL'], '缺料汇总': ['RPT_SHORT_DETAIL'],
    '集成': ['IF_CONFIG'], '接口': ['IF_CONFIG', 'IF_RUN_LOG'], '运行日志': ['IF_RUN_LOG'],
    '物料': ['RF_ITEM'], '物料主数据': ['RF_ITEM'], '品号': ['RF_ITEM'], 'BOM': ['RF_BOM'], '工艺路线': ['RF_ROUTE'], '工艺': ['RF_ROUTE'],
    '销售订单': ['RF_SO'], '客户订单': ['RF_SO'], '库存': ['RF_STOCK'], '在途': ['RF_PO_ONWAY'], '采购在途': ['RF_PO_ONWAY'],
    '工单': ['RF_WORK_ORDER'], '报工': ['RF_WORK_ORDER'], '实绩': ['RF_WORK_ORDER'],
    '字典': ['SYS_DICT'], '编码规则': ['SYS_CODE_RULE'], '审计': ['SYS_AUDIT_LOG'], '日志': ['SYS_AUDIT_LOG'],
    '附件': ['SYS_ATTACHMENT'], '单据关联': ['SYS_DOC_LINK'], '上下游': ['SYS_DOC_LINK']
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
    var body = arr.slice(0, n).map(function (r) { return '<tr>' + cols.map(function (c) { return '<td class="' + (c.code === def.pk ? 'pk' : '') + '">' + cellValue(r, c, t) + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<table class="grid sm insight-tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  function insightOverview() {
    var totalTables = Object.keys(S.TABLES).length, totalRows = 0;
    Object.keys(S.TABLES).forEach(function (t) { totalRows += rows(t).length; });
    var lines = S.GROUPS.filter(function (g) { /* 纯视图分组（应用工具）不含业务表，概览里跳过 */
      return g.tables.some(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; });
    }).map(function (g) {
      var items = g.tables.filter(function (t) { return S.TABLES[t] && !S.TABLES[t].detail; }).map(function (t) { return S.TABLES[t].label + '（' + rows(t).length + '）'; });
      return '<tr><td><b>' + esc(g.name) + '</b></td><td>' + items.join('、') + '</td></tr>';
    }).join('');
    var tableHtml = '<table class="grid sm insight-tbl"><thead><tr><th>模块</th><th>各表记录数</th></tr></thead><tbody>' + lines + '</tbody></table>';
    var text = '系统当前共 <b>' + totalTables + '</b> 张数据表、<b>' + totalRows + '</b> 条业务记录，分布如下。您也可以直接问我，例如「需求源有多少条」「按齐套状态统计齐套检查」「各状态排程任务的分布」。';
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
    if (!hist.length) { hist.push({ role: 'bot', text: '您好，我是 APS 数据洞察助手。我可以基于当前系统内的演示数据，用对话方式帮您做查询与统计分析。试试下方的提示，或直接输入您的问题。' }); insightSave(hist); }
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
        '<p class="mini">用自然语言向系统提问，直接分析本地 APS 数据（无需联网）。支持 <b>@图片</b> 附参考图；常用问法见下方提示。分析结论与明细均基于当前浏览器内的演示数据。</p>' +
        '<div class="insight-chips" id="insChips">' +
          chip('需求源有多少条') + chip('排程任务有多少条') + chip('各状态排程任务的分布') +
          chip('本月齐套检查平均齐套率') + chip('按负荷率统计产能负荷看板 top5') + chip('列出交期预警表') +
          chip('各类型需求源的分布') + chip('列出执行中的排程任务') +
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
    if (!pairs.length) return '<div class="mini">暂无数据</div>';
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
    /* 区间过滤：各表按自己的业务日期字段落入统计区间（口径见下）
     *   需求源明细 / 净需求 / 缺料 → 需求日期；齐套 → 检查日期；
     *   排程任务 → 计划开工日；排程版本 → 生成日期；补料 / 生产建议 → 版本计算时间。
     * 过滤后若某类为空，下方卡片会自动显示「本区间内无数据」，切换区间即可看到差异。 */
    function inRange(r, dateCol) { return brInRange(r[dateCol], from, to); }
    /* 生效需求（需求源·明细）：单一日期口径 —— 只按明细的「需求日期」入区间，与净需求 / 缺料一致。
     *   「生效」仅作为需求源表头的状态条件，不参与日期过滤。
     *   ⚠️ 历史写法是「表头按 DOC_DATE ∧ 明细按 REQ_DATE」求交集：当建单日与要货日分属不同月份时，
     *   单月查询必然命中 0（9 月建单、10 月要货 → 9 月 / 10 月都显示 0），故 2026-10-13 改为单口径。 */
    var effDemandNos = {}; rows('BAS_DEMAND').forEach(function (r) { if (/生效/.test(r.STATUS || '')) effDemandNos[r.DEMAND_NO] = 1; });
    var demQty = 0, demLines = 0, demNos = {};
    rows('BAS_DEMAND_LINE').forEach(function (r) {
      if (effDemandNos[r.DEMAND_NO] && inRange(r, 'REQ_DATE')) { demQty += brNum(r.DEMAND_QTY); demLines++; demNos[r.DEMAND_NO] = 1; }
    });
    /* 净需求（按需求日期） */
    var netRows = rows('MRP_NET_REQ').filter(function (r) { return inRange(r, 'REQ_DATE'); });
    var netQty = 0; netRows.forEach(function (r) { netQty += brNum(r.NET_QTY); });
    /* 齐套检查（按检查日期） */
    var kits = rows('MRP_KIT_CHECK').filter(function (r) { return inRange(r, 'CHECK_DATE'); });
    var kitAvg = kits.length ? (kits.reduce(function (a, r) { return a + brNum(r.KIT_RATE); }, 0) / kits.length * 100) : 0;
    /* 排程任务（按计划开工日） */
    var tasks = rows('SCH_TASK').filter(function (r) { return inRange(r, 'START_TIME'); });
    var delayTasks = tasks.filter(function (r) { return r.DELAY_FLAG == 1; });
    var lockTasks = tasks.filter(function (r) { return r.LOCK_FLAG == 1; });
    var rushTasks = tasks.filter(function (r) { return r.RUSH_FLAG == 1; });
    /* 排程版本（按生成日期） */
    var vers = rows('SCH_VERSION').filter(function (r) { return inRange(r, 'GEN_TIME'); });
    var utilAvg = vers.length ? (vers.reduce(function (a, r) { return a + brNum(r.UTIL_RATE); }, 0) / vers.length * 100) : 0;
    /* 缺料（按需求日期） */
    var shorts = rows('MRP_KIT_SHORT').filter(function (r) { return inRange(r, 'REQ_DATE'); });
    var blockShorts = shorts.filter(function (r) { return r.BLOCK_FLAG == 1 || /关键|是/.test(String(r.KEY_ITEM_FLAG || '')); });
    /* 建议：按版本计算时间入区间（版本是净需求/建议的产出时点） */
    var okBatches = {}; rows('MRP_BATCH').forEach(function (b) { if (inRange(b, 'CALC_TIME')) okBatches[b.BATCH_NO] = 1; });
    var prs = rows('PR_SUGGEST').filter(function (r) { return okBatches[r.BATCH_NO]; });
    var pps = rows('PP_PLAN_SUGGEST').filter(function (r) { return okBatches[r.BATCH_NO]; });
    var kpis =
      brKpi('生效需求(件)', demQty, demLines ? ('需求源 ' + Object.keys(demNos).length + ' 单 · 明细 ' + demLines + ' 行') : '本区间内无要货需求', '#3b6ef5') +
      brKpi('净需求', netRows.length + ' 行', '净需求合计 ' + netQty + ' 件', '#18a058') +
      brKpi('平均齐套率', kitAvg.toFixed(1) + '%', '齐套检查 ' + kits.length + ' 单', kitAvg >= 90 ? '#18a058' : (kitAvg >= 80 ? '#d98800' : '#e11d48')) +
      brKpi('排程任务 / 延期', tasks.length + ' / ' + delayTasks.length, '锁定 ' + lockTasks.length + ' · 插单 ' + rushTasks.length, delayTasks.length > 0 ? '#e11d48' : '#18a058') +
      brKpi('平均资源利用率', utilAvg.toFixed(1) + '%', '排程版本 ' + vers.length + ' 个', utilAvg >= 80 ? '#18a058' : '#d98800') +
      brKpi('缺料预警', shorts.length + ' 条', '阻断性 ' + blockShorts.length + ' 条 · 补料建议 ' + prs.length + ' / 生产建议 ' + pps.length, blockShorts.length > 0 ? '#e11d48' : '#d98800');
    /* 分布：与上面同口径（已按区间过滤） */
    var taskStat = {}; tasks.forEach(function (r) { var k = r.TASK_STATUS || '未知'; taskStat[k] = (taskStat[k] || 0) + 1; });
    var warnStat = {}; rptCapacityLoad().forEach(function (r) { var k = r.WARN_LEVEL || '正常'; warnStat[k] = (warnStat[k] || 0) + 1; });
    var resStat = {}; tasks.forEach(function (r) { var k = r.RES_NO || '未指定'; resStat[k] = (resStat[k] || 0) + 1; });
    /* 任务按计划开工日趋势 */
    var byDay = {};
    tasks.forEach(function (r) { if (!r.START_TIME) return; var k = String(r.START_TIME).slice(5, 10); byDay[k] = (byDay[k] || 0) + 1; });
    var dayArr = Object.keys(byDay).sort();
    if (dayArr.length > 20) dayArr = dayArr.slice(0, 20);
    var trendMax = 1; dayArr.forEach(function (k) { if (byDay[k] > trendMax) trendMax = byDay[k]; });
    var trend = '<div class="trend">' + (dayArr.length ? dayArr.map(function (k) {
      var hh = Math.round(byDay[k] / trendMax * 90) + 6;
      return '<div class="tcol" title="' + k + ' ' + byDay[k] + ' 条任务"><span class="tval">' + byDay[k] + '</span><span class="tbar" style="height:' + hh + 'px"></span><span class="tlab">' + esc(k) + '</span></div>';
    }).join('') : '<div class="mini">本区间内暂无排程任务（可切换区间，或到「生产排程 → 排程工作台」运行自动排程）</div>') + '</div>';
    /* 延期 / 风险任务明细 */
    var riskRows = tasks.slice().sort(function (a, b) { return (b.DELAY_FLAG == 1 ? 1 : 0) - (a.DELAY_FLAG == 1 ? 1 : 0); }).slice(0, 12).map(function (r) {
      return '<tr><td class="pk">' + esc(r.TASK_ID) + '</td><td>' + esc(r.WO_NO) + '</td><td>' + esc(r.ITEM_NAME || r.ITEM_NO) + '</td>' +
        '<td>' + esc(r.STEP_NO + ' ' + r.STEP_NAME) + '</td><td>' + esc(r.RES_NO) + '</td>' +
        '<td>' + esc(String(r.START_TIME || '').slice(0, 16)) + '</td><td>' + esc(String(r.END_TIME || '').slice(0, 16)) + '</td>' +
        '<td class="cellnum">' + (+r.PLAN_QTY || 0) + '</td><td class="cellnum">' + (+r.DONE_QTY || 0) + '</td>' +
        '<td>' + (r.DELAY_FLAG == 1 ? '<span class="tag bad">延期</span>' : '') + (r.RUSH_FLAG == 1 ? '<span class="tag">插单</span>' : '') + (r.LOCK_FLAG == 1 ? '<span class="tag">锁定</span>' : '') + '</td>' +
        '<td>' + statusTag(r.TASK_STATUS) + '</td></tr>';
    }).join('');
    /* 缺料明细（阻断优先） */
    var shortRows = shorts.slice().sort(function (a, b) { return (b.BLOCK_FLAG == 1 ? 1 : 0) - (a.BLOCK_FLAG == 1 ? 1 : 0); }).slice(0, 12).map(function (r) {
      return '<tr><td class="pk">' + esc(r.SHORT_ID) + '</td><td>' + esc(r.ORDER_NO) + '</td><td>' + esc(r.ITEM_NO) + '</td><td>' + esc(r.ITEM_NAME) + '</td>' +
        '<td class="cellnum">' + (+r.SHORT_QTY || 0) + '</td><td>' + esc(String(r.REQ_DATE || '').slice(0, 10)) + '</td><td>' + esc(String(r.RECOVER_DATE || '').slice(0, 10)) + '</td>' +
        '<td>' + esc(r.SUPPLY_TYPE) + '</td><td>' + (/关键|是/.test(String(r.KEY_ITEM_FLAG || '')) ? '<span class="tag bad">关键件</span>' : '') + (r.BLOCK_FLAG == 1 ? '<span class="tag bad">阻断</span>' : '') + '</td>' +
        '<td>' + statusTag(r.STATUS) + '</td></tr>';
    }).join('');
    var h = '';
    h += '<div class="card board-card"><div class="board-head"><h2>计划看板 · 计划驾驶舱</h2>' +
      '<div class="chips">' + BR_CHIPS.map(function (cp) { return '<button class="chip' + (B.chip === cp ? ' active' : '') + '" data-chip="' + cp + '">' + cp + '</button>'; }).join('') + '</div></div>' +
      '<div class="board-filter"><span class="mini">统计区间</span>' +
      '<input type="date" id="brFrom" value="' + esc(from) + '"/><span class="mini">~</span><input type="date" id="brTo" value="' + esc(to) + '"/>' +
      '<button class="primary sm" id="brQuery">查询</button><button class="ghost sm" id="brReset">重置</button>' +
      '<span class="mini">当前区间 ' + esc(from) + ' ~ ' + esc(to) + ' · 本页为只读驾驶舱（默认落地页）。区间口径：需求源（明细） / 净需求 / 缺料按<b>需求日期</b>、齐套按<b>检查日期</b>、排程任务按<b>计划开工日</b>、排程版本按<b>生成日期</b>、补料 / 生产建议按<b>版本计算时间</b>过滤。「生效需求」按需求日期归属（建单日不计入），某区间内没有要货需求时显示 0</span></div></div>';
    h += '<div class="kpi-grid">' + kpis + '</div>';
    h += '<div class="board-2col">' +
      '<div class="card"><h3>排程任务按计划开工日分布（条）</h3>' + trend + '</div>' +
      '<div class="card"><h3>排程任务状态分布</h3>' + brBars(Object.keys(taskStat).map(function (k) { return [k, taskStat[k]]; }), '#0ea5a4') +
        '<h3 class="mt14">产能负荷预警分布</h3>' + brBars(Object.keys(warnStat).map(function (k) { return [k, warnStat[k]]; }), '#e11d48') + '</div>' +
      '</div>';
    h += '<div class="card"><h3>任务按机台分布</h3>' + brBars(Object.keys(resStat).map(function (k) { return [k, resStat[k]]; }), '#3b6ef5') + '</div>';
    h += '<div class="card"><h3>排程任务明细（延期 / 插单 / 锁定优先）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>任务ID</th><th>工单</th><th>品名</th><th>工序</th><th>资源</th><th>计划开工</th><th>计划完工</th>' +
      '<th>计划数</th><th>已完</th><th>标记</th><th>状态</th></tr></thead><tbody>' +
      (riskRows || '<tr><td colspan="11" class="mini">本区间内暂无排程任务数据（可切换区间查看）</td></tr>') + '</tbody></table></div></div>';
    h += '<div class="card"><h3>缺料明细（关键件 / 阻断优先）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>缺料ID</th><th>订单/工单</th><th>品号</th><th>品名</th><th>缺料数</th><th>需求日</th><th>预计恢复</th><th>供应方式</th><th>标识</th><th>状态</th></tr></thead><tbody>' +
      (shortRows || '<tr><td colspan="10" class="mini">本区间内暂无缺料数据</td></tr>') + '</tbody></table></div></div>';
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
  /* ---------- 计划看板 · 产能负荷看板（卡片式，只读实时派生） ----------
   * 数据源：rptCapacityLoad()（按 资源 × 日期 汇总排程任务的负荷工时与负荷率，瓶颈识别到机台）。
   * 区间过滤按「负荷日期(LOAD_DATE)」，与驾驶舱同用「本周/上周/本月/上月/本年」快捷区间。 */
  function capColor(rate) { return rate > 0.9 ? '#e11d48' : (rate >= 0.85 ? '#d98800' : '#18a058'); }
  function kitColor(rate) { return rate >= 0.9 ? '#18a058' : (rate >= 0.7 ? '#d98800' : '#e11d48'); }
  function pct(v) { return (brNum(v) * 100).toFixed(1) + '%'; }
  /* 通用横条（标签 / 数值（可为百分比字符串）/ 条宽 0~100 / 颜色） */
  function brBarRows(items, valFmt) {
    if (!items.length) return '<div class="mini">本区间内暂无数据</div>';
    return '<div class="bars">' + items.map(function (p) {
      return '<div class="bar-row"><span class="bar-lab" title="' + esc(p[0]) + '">' + esc(p[0]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.max(1, Math.round(p[3])) + '%;background:' + p[4] + '"></span></span>' +
        '<span class="bar-val">' + (valFmt ? valFmt(p) : p[2]) + '</span></div>';
    }).join('') + '</div>';
  }
  /* 看板统一的「区间 + 快捷切换」头部（与驾驶舱同一套控件 id，交互复用 bindBoard）
   * midHtml：可选，插在「统计区间」之前的额外过滤控件（如产能负荷看板的「排程版本」选择器） */
  function dashHead(title, sub, from, to, midHtml) {
    return '<div class="card board-card"><div class="board-head"><h2>' + esc(title) + '</h2>' +
      '<div class="chips">' + BR_CHIPS.map(function (cp) { return '<button class="chip' + (brInit().chip === cp ? ' active' : '') + '" data-chip="' + cp + '">' + cp + '</button>'; }).join('') + '</div></div>' +
      '<div class="board-filter">' + (midHtml || '') + '<span class="mini">统计区间</span>' +
      '<input type="date" id="brFrom" value="' + esc(from) + '"/><span class="mini">~</span><input type="date" id="brTo" value="' + esc(to) + '"/>' +
      '<button class="primary sm" id="brQuery">查询</button><button class="ghost sm" id="brReset">重置</button>' +
      '<span class="mini">当前区间 ' + esc(from) + ' ~ ' + esc(to) + ' · ' + sub + '</span></div></div>';
  }

  function viewCapLoad() {
    var B = brInit(), from = B.from, to = B.to;
    var vers = rows('SCH_VERSION');
    var verNo = (st.capVer && vers.some(function (v) { return v.VERSION_NO === st.capVer; })) ? st.capVer : latestVerNo();
    var curVer = vers.filter(function (v) { return v.VERSION_NO === verNo; })[0] || null;
    var all = rptCapacityLoad(verNo).filter(function (r) { return brInRange(r.LOAD_DATE, from, to); });
    var loadSum = 0, capSum = 0, reds = 0, warns = 0;
    all.forEach(function (r) {
      loadSum += brNum(r.LOAD_HOURS); capSum += brNum(r.AVAILABLE_CAP);
      if (r.WARN_LEVEL === '红色预警') { reds++; warns++; } else if (r.WARN_LEVEL === '黄色预警') warns++;
    });
    var avgRate = capSum ? loadSum / capSum : 0;
    var bottle = {}; all.forEach(function (r) { if (r.BOTTLENECK_FLAG == 1) bottle[r.RES_NO] = brNum(r.LOAD_RATE); });
    var overHours = all.reduce(function (a, r) { return a + Math.max(0, brNum(r.LOAD_HOURS) - brNum(r.AVAILABLE_CAP)); }, 0);
    var dayCnt = {}; all.forEach(function (r) { dayCnt[r.LOAD_DATE] = 1; });
    var resCnt = {}; all.forEach(function (r) { resCnt[r.RES_NO] = 1; });
    var kpis =
      brKpi('平均负荷率', pct(avgRate), '可用产能 ' + capSum.toFixed(0) + ' h · 负荷 ' + loadSum.toFixed(0) + ' h', capColor(avgRate)) +
      brKpi('负荷预警(机台·日)', warns + ' 项', '红色 ' + reds + ' · 黄色 ' + (warns - reds) + '（>90% 红 / 85~90% 黄）', warns ? '#e11d48' : '#18a058') +
      brKpi('瓶颈资源', Object.keys(bottle).length + ' 个', Object.keys(bottle).slice(0, 4).join(' / ') || '本区间无瓶颈', Object.keys(bottle).length ? '#e11d48' : '#18a058') +
      brKpi('超负荷工时', overHours.toFixed(1) + ' h', '超 100% 负荷率的工时合计', overHours > 0 ? '#e11d48' : '#18a058') +
      brKpi('统计范围', Object.keys(dayCnt).length + ' 天 / ' + Object.keys(resCnt).length + ' 台', '资源·日 组合 ' + all.length + ' 行', '#3b6ef5');
    /* 图 1：按日负荷率（负荷工时 / 可用产能） */
    var byDay = {};
    all.forEach(function (r) {
      var k = r.LOAD_DATE; if (!byDay[k]) byDay[k] = { load: 0, cap: 0 };
      byDay[k].load += brNum(r.LOAD_HOURS); byDay[k].cap += brNum(r.AVAILABLE_CAP);
    });
    var dayItems = Object.keys(byDay).sort().map(function (k) {
      var o = byDay[k], rate = o.cap ? o.load / o.cap : 0;
      return [k.slice(5), k, pct(rate), rate * 100, capColor(rate)];
    });
    /* 图 2：按资源平均负荷率（降序前 12） */
    var byRes = {};
    all.forEach(function (r) {
      var k = r.RES_NO || '未指定'; if (!byRes[k]) byRes[k] = { load: 0, cap: 0, name: r.RES_NAME || '' };
      byRes[k].load += brNum(r.LOAD_HOURS); byRes[k].cap += brNum(r.AVAILABLE_CAP);
    });
    var resItems = Object.keys(byRes).map(function (k) {
      var o = byRes[k], rate = o.cap ? o.load / o.cap : 0;
      return [k + (o.name ? ' · ' + o.name : ''), k, pct(rate), rate * 100, capColor(rate)];
    }).sort(function (a, b) { return b[3] - a[3]; }).slice(0, 12);
    /* 图 3：预警分布 */
    var warnStat = {}; all.forEach(function (r) { var k = r.WARN_LEVEL || '正常'; warnStat[k] = (warnStat[k] || 0) + 1; });
    /* 明细：负荷率降序前 15 */
    var detail = all.slice().sort(function (a, b) { return brNum(b.LOAD_RATE) - brNum(a.LOAD_RATE); }).slice(0, 15).map(function (r) {
      var lv = r.WARN_LEVEL === '红色预警' ? 'bad' : (r.WARN_LEVEL === '黄色预警' ? 'warn' : 'ok');
      return '<tr><td class="pk">' + esc(r.LOAD_ID) + '</td><td>' + esc(r.LOAD_DATE) + '</td><td>' + esc(r.CAP_LEVEL) + '</td>' +
        '<td>' + esc(r.WORK_CENTER) + '</td><td>' + esc(r.RES_NO) + '</td><td>' + esc(r.RES_NAME) + '</td>' +
        '<td class="cellnum">' + brNum(r.AVAILABLE_CAP).toFixed(1) + '</td><td class="cellnum">' + brNum(r.LOAD_HOURS).toFixed(2) + '</td>' +
        '<td class="cellnum" style="color:' + capColor(brNum(r.LOAD_RATE)) + ';font-weight:600">' + pct(r.LOAD_RATE) + '</td>' +
        '<td><span class="tag ' + lv + '">' + esc(r.WARN_LEVEL) + '</span>' + (r.BOTTLENECK_FLAG == 1 ? '<span class="tag bad">瓶颈</span>' : '') + '</td>' +
        '<td>' + esc(r.SUGGEST_ADJ) + '</td></tr>';
    }).join('');
    var verSel = '<span class="mini">排程版本</span><select id="capVer" class="mini-sel">' + (vers.length ?
      vers.map(function (v) { return '<option value="' + esc(v.VERSION_NO) + '"' + (v.VERSION_NO === verNo ? ' selected' : '') + '>' + esc(v.VERSION_NO) + ' · ' + esc(v.RULE_NO || '-') + ' · ' + esc(v.STATUS) + '</option>'; }).join('') :
      '<option value="">（暂无排程版本）</option>') + '</select>';
    var h = dashHead('计划看板 · 产能负荷看板',
      '负荷率 = 该资源当日排产占用工时 ÷ 该资源当日可用产能（取自工厂日历，缺省双班 16h）；>90% 红色预警 / 85~90% 黄色预警，最高负荷资源标为瓶颈。区间按<b>负荷日期</b>过滤。' +
      '口径（2026-10-15 修订）：只统计<b>所选排程版本</b>的排产，跨天任务的工时<b>按自然日切分</b>到各天（取自该版本的日排产），不再按开工日整段计入',
      from, to, verSel);
    h += '<div class="kpi-grid">' + kpis + '</div>';
    h += '<div class="card"><p class="mini" style="margin:0">当前统计版本 <b>' + esc(verNo || '—') + '</b>' +
      (curVer ? ' · 规则 ' + esc(curVer.RULE_NO || '-') + ' · 计划区间 ' + esc(String(curVer.RANGE_FROM || '').slice(0, 10)) + ' ~ ' + esc(String(curVer.RANGE_TO || '').slice(0, 10)) +
        ' · 状态 ' + statusTag(curVer.STATUS) : '') +
      ' · 该版本 ' + rows('SCH_TASK').filter(function (t) { return t.VERSION_NO === verNo; }).length + ' 条任务 / ' +
      rows('SCH_DAY_PLAN').filter(function (d) { return d.VERSION_NO === verNo; }).length + ' 条日排产（负荷工时即按日排产切分）' +
      (vers.length > 1 ? '　·　切换上方「排程版本」可对比不同规则 / 时点的产能占用' : '') + '</p></div>';
    h += '<div class="board-2col">' +
      '<div class="card"><h3>按日负荷率趋势（负荷工时 ÷ 可用产能）</h3>' + brBarRows(dayItems) + '</div>' +
      '<div class="card"><h3>负荷预警分布（资源·日）</h3>' + brBars(Object.keys(warnStat).map(function (k) { return [k, warnStat[k]]; }), '#e11d48') +
        '<h3 class="mt14">瓶颈资源</h3>' + (Object.keys(bottle).length ? brBars(Object.keys(bottle).map(function (k) { return [k, +(bottle[k] * 100).toFixed(1)]; }), '#d98800') : '<div class="mini">本区间内无超 90% 负荷的资源</div>') + '</div>' +
      '</div>';
    h += '<div class="card"><h3>资源负荷排行（平均负荷率，前 12）</h3>' + brBarRows(resItems) + '</div>';
    h += '<div class="card"><h3>负荷明细（负荷率降序，前 15）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>负荷ID</th><th>日期</th><th>层级</th><th>工作中心</th><th>资源</th><th>资源名称</th>' +
      '<th>可用产能(h)</th><th>负荷工时(h)</th><th>负荷率</th><th>预警</th><th>建议调整</th></tr></thead><tbody>' +
      (detail || '<tr><td colspan="11" class="mini">本区间内暂无负荷数据 —— 当前版本 <b>' + esc(verNo || '—') + '</b> 在所选区间内没有排产。可切换上方的「排程版本」（各版本排的是不同月份），或调整统计区间。</td></tr>') + '</tbody></table></div></div>';
    return h;
  }

  /* ---------- 计划看板 · 齐套率看板（卡片式，只读实时派生） ----------
   * 数据源：rptKitRate()（按齐套检查单实时汇总，带出缺料 Top 与长周期件专项预警）。
   * 区间过滤按「统计日期(STAT_DATE = 齐套检查日期)」。 */
  function viewKitRate() {
    var B = brInit(), from = B.from, to = B.to;
    var all = rptKitRate().filter(function (r) { return brInRange(r.STAT_DATE, from, to); });
    var rates = all.map(function (r) { return brNum(r.KIT_RATE); });
    var avg = rates.length ? rates.reduce(function (a, b) { return a + b; }, 0) / rates.length : 0;
    var full = all.filter(function (r) { return brNum(r.KIT_RATE) >= 0.999; }).length;
    var low = all.filter(function (r) { return brNum(r.KIT_RATE) < 0.7; });
    var longWarn = all.filter(function (r) { return r.LONG_CYCLE_WARN && r.LONG_CYCLE_WARN !== '无'; });
    var orderQty = 0, kitQty = 0;
    all.forEach(function (r) { orderQty += brNum(r.ORDER_QTY); kitQty += brNum(r.KIT_QTY); });
    /* 缺料汇总：仅统计本区间内齐套单涉及的缺料 */
    var inRangeChecks = {}; all.forEach(function (r) { inRangeChecks[r.KIT_ID.replace(/^KR-/, '')] = 1; });
    var shorts = rawRows('MRP_KIT_SHORT').filter(function (s) { return inRangeChecks[s.CHECK_NO]; });
    var shortByItem = {};
    shorts.forEach(function (s) { var k = s.ITEM_NAME || s.ITEM_NO; shortByItem[k] = (shortByItem[k] || 0) + brNum(s.SHORT_QTY); });
    var shortItems = Object.keys(shortByItem).map(function (k) { return [k, k, shortByItem[k], 0, '#e11d48']; })
      .sort(function (a, b) { return b[2] - a[2]; }).slice(0, 10);
    var sMax = shortItems.length ? shortItems[0][2] : 1;
    shortItems.forEach(function (p) { p[3] = sMax ? p[2] / sMax * 100 : 0; });
    var byCust = {};
    all.forEach(function (r) { var k = r.CUSTOMER_CODE || '未指定客户'; if (!byCust[k]) byCust[k] = { s: 0, n: 0 }; byCust[k].s += brNum(r.KIT_RATE); byCust[k].n++; });
    var custItems = Object.keys(byCust).map(function (k) { var r = byCust[k].s / byCust[k].n; return [k, k, pct(r), r * 100, kitColor(r)]; })
      .sort(function (a, b) { return a[3] - b[3]; });
    var orderItems = all.map(function (r) {
      var r0 = brNum(r.KIT_RATE);
      return [(r.SO_NO || r.KIT_ID) + ' · ' + (r.ITEM_NAME || r.ITEM_NO), r.KIT_ID, pct(r0), r0 * 100, kitColor(r0)];
    }).sort(function (a, b) { return a[3] - b[3]; }).slice(0, 14);
    var kpis =
      brKpi('平均齐套率', pct(avg), '齐套检查 ' + all.length + ' 单', kitColor(avg)) +
      brKpi('完全齐套', full + ' / ' + all.length + ' 单', '齐套率 = 100% 的检查单', full === all.length && all.length ? '#18a058' : '#d98800') +
      brKpi('齐套率 < 70%', low.length + ' 单', low.length ? ('最低 ' + pct(Math.min.apply(null, rates)) + ' · ' + low.slice(0, 3).map(function (r) { return r.ITEM_NAME || r.ITEM_NO; }).join(' / ')) : '本区间无高风险单', low.length ? '#e11d48' : '#18a058') +
      brKpi('长周期件预警', longWarn.length + ' 单', longWarn.length ? longWarn.slice(0, 2).map(function (r) { return r.LONG_CYCLE_WARN; }).join('；') : '无长周期件缺料', longWarn.length ? '#d98800' : '#18a058') +
      brKpi('齐套数量 / 订单数量', kitQty.toFixed(0) + ' / ' + orderQty.toFixed(0), '清单级齐套数量合计', '#3b6ef5');
    var detail = all.slice().sort(function (a, b) { return brNum(a.KIT_RATE) - brNum(b.KIT_RATE); }).map(function (r) {
      var r0 = brNum(r.KIT_RATE);
      return '<tr><td class="pk">' + esc(r.KIT_ID) + '</td><td>' + esc(r.STAT_DATE) + '</td><td>' + esc(r.SO_NO) + '</td>' +
        '<td>' + esc(r.CUSTOMER_CODE) + '</td><td>' + esc(r.ITEM_NO) + '</td><td>' + esc(r.ITEM_NAME) + '</td>' +
        '<td class="cellnum">' + brNum(r.ORDER_QTY) + '</td><td class="cellnum">' + brNum(r.KIT_QTY) + '</td>' +
        '<td class="cellnum" style="color:' + kitColor(r0) + ';font-weight:600">' + pct(r0) + '</td>' +
        '<td>' + esc(r.KIT_DATE) + '</td><td>' + esc(r.SHORT_TOP) + '</td><td>' + esc(r.LONG_CYCLE_WARN) + '</td></tr>';
    }).join('');
    var h = dashHead('物料齐套计算 · 齐套率看板', '齐套率 = 齐套数量 ÷ 需求数量，按齐套检查单实时汇总；≥90% 绿 / 70~90% 黄 / <70% 红。区间按<b>统计日期（齐套检查日期）</b>过滤', from, to);
    h += '<div class="kpi-grid">' + kpis + '</div>';
    h += '<div class="board-2col">' +
      '<div class="card"><h3>各订单 / 品号齐套率（由低到高，前 14）</h3>' + brBarRows(orderItems) + '</div>' +
      '<div class="card"><h3>缺料 Top 10（数量）</h3>' + brBarRows(shortItems) +
        '<h3 class="mt14">客户维度平均齐套率</h3>' + brBarRows(custItems) + '</div>' +
      '</div>';
    h += '<div class="card"><h3>齐套检查明细（齐套率升序，全量）</h3><div class="tbl-wrap"><table class="grid"><thead><tr>' +
      '<th>看板ID</th><th>统计日期</th><th>销售订单</th><th>客户</th><th>品号</th><th>品名</th>' +
      '<th>订单数量</th><th>齐套数量</th><th>齐套率</th><th>齐套日期</th><th>缺料Top</th><th>长周期件预警</th></tr></thead><tbody>' +
      (detail || '<tr><td colspan="12" class="mini">本区间内暂无齐套数据（请切换区间，或先到「物料齐套计算 → 齐套计算工作台」运行齐套检查）</td></tr>') + '</tbody></table></div></div>';
    return h;
  }

  function bindGantt() {
    /* 三视角切换 */
    document.querySelectorAll('[data-gm]').forEach(function (b) {
      b.onclick = function () { st.ganttMode = b.getAttribute('data-gm'); render(); };
    });
    /* 排程版本切换 */
    var sv = document.getElementById('ganttVer');
    if (sv) sv.onchange = function () { st.ganttVer = sv.value; render(); };
    /* 时间轴缩放（紧凑 / 标准 / 宽松） */
    document.querySelectorAll('#content [data-gz]').forEach(function (b) {
      b.onclick = function () { st.ganttZoom = b.getAttribute('data-gz'); render(); };
    });
  }

  /* 离线种子生成工具的引擎出口（界面逻辑不使用；见 _tool_gen_seed_sched.js） */
  window.APS_ENGINE = { genSchedule: genSchedule };
  /* 供 api.js 在写队列失败时提示用户 */
  window.APS_TOAST = toast;

  /* ---------- 启动 ---------- */
  function boot() {
    applyCustomFields();
    ensureSeed();
    syncAllAgg();                 // 主表聚合字段（如需求源「来源单据号」）按明细重算一次，保证落库值与展示一致
    applyViews();                 // 先载入视图显隐设置（applyRoute 依赖 visOn）
    applyRoute();                 // 深链：按 URL（门户菜单路径）定位视图 / 表
    if (!st.table) st.table = firstTable();
    bindTop(); setNav(); render();
  }

  /* 先装载数据再渲染：rows() 是同步的，界面首次绘制时数据必须已经就位。
   * 后端不可用时 api.js 会自行降级为本地模式，boot() 照常执行。*/
  if (window.APS_API) {
    window.APS_API.boot().then(boot, boot);
  } else {
    boot();
  }
})();
