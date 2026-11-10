/* ============================================================================
   APS 界面增强层 (pro.js)
   ----------------------------------------------------------------------------
   零侵入：不修改 app.js / api.js，不接管任何业务事件，不写业务数据。
   只负责：设计层结构注入（页头 / 侧栏搜索 / 计划周期进度条）、命令面板、
           主题与密度偏好、环境标识、键盘可达性与加载遮罩。
   app.js 每次 render() 会重建 #content / #sidebar，故用 MutationObserver 重放增强。
   ========================================================================== */
(function () {
  'use strict';

  var KEY_THEME = 'aps.pro.theme';
  var KEY_DENSITY = 'aps.pro.density';
  var SIDE_QUERY = '';
  var S = window.APS_SCHEMA || { TABLES: {}, GROUPS: [], DOMAINS: [] };
  var BASE = (location.pathname || '/').replace(/[^/]*$/, '');

  /* 视图目录：与 app.js 的 NAV / VIEW_PATH_ALIAS 对齐，含深链可达的旧视图 */
  var VIEWS = [
    { v: 'board',    label: '计划驾驶舱',        path: 'board',       group: '计划看板',     desc: '计划周期汇总指标与风险明细' },
    { v: 'mrp',      label: 'MRP 计算工作台',    path: 'mrp',         group: '物料需求计算', desc: '逐层净算 · 补料与生产建议' },
    { v: 'kit',      label: '齐套计算工作台',    path: 'kit',         group: '物料齐套计算', desc: '齐套检查 · 缺料明细' },
    { v: 'kitrate',  label: '齐套率看板',        path: 'kitrate',     group: '物料齐套计算', desc: '齐套率趋势与缺料 Top10' },
    { v: 'sched',    label: '排程工作台',        path: 'sched',       group: '生产排程',     desc: '有限产能自动排程' },
    { v: 'gantt',    label: '排产甘特图',        path: 'gantt',       group: '生产排程',     desc: '订单 / 工序 / 机台三视角' },
    { v: 'capload',  label: '产能负荷看板',      path: 'capload',     group: '计划看板',     desc: '按版本统计负荷率与瓶颈资源' },
    { v: 'uns',      label: 'UNS 数据源映射',    path: 'uns-source',  group: '系统与集成',   desc: 'MES 主数据与 UNS 别名对照' },
    { v: 'browser',  label: '数据浏览',          path: 'browser',     group: '通用',         desc: '全表 CRUD / 导入导出 / 审核' },
    { v: 'model',    label: '数据模型',          path: 'model',       group: '通用',         desc: '字段定义与显示配置' },
    { v: 'guide',    label: '使用说明',          path: 'guide',       group: '通用',         desc: '按表动态生成的操作指引' },
    { v: 'flow',     label: '核心流程（演练）',  path: 'flow',        group: '工具',         desc: '8 步一键演练与计算链' },
    { v: 'batch',    label: '计算版本工作台',    path: 'calc-batch',  group: '工具',         desc: '旧版集中式工作台（深链可达）' },
    { v: 'dashboard',label: '系统总览',          path: 'dashboard',   group: '工具',         desc: '数据域与记录分布' }
  ];
  var VIEW_BY_V = {}; VIEWS.forEach(function (x) { VIEW_BY_V[x.v] = x; });
  var VIEW_BY_PATH = {}; VIEWS.forEach(function (x) { VIEW_BY_PATH[x.path] = x; });

  var FLOW_STEPS = [
    { k: 'demand',  n: '01', t: '需求源',     table: 'BAS_DEMAND',       path: 't-bas-demand',       hint: '生效需求' },
    { k: 'rule',    n: '02', t: '排程规则',   table: 'SCH_RULE',         path: 't-sch-rule',         hint: '默认规则' },
    { k: 'mrp',     n: '03', t: 'MRP 净算',   table: 'MRP_BATCH',        path: 'mrp',                hint: '计算版本' },
    { k: 'kit',     n: '04', t: '齐套检查',   table: 'MRP_KIT_CHECK',    path: 'kit',                hint: '齐套单' },
    { k: 'suggest', n: '05', t: '计划建议',   table: 'PP_PLAN_SUGGEST',  path: 't-pp-plan-suggest',  hint: '生产/补料' },
    { k: 'sched',   n: '06', t: '自动排程',   table: 'SCH_VERSION',      path: 'sched',              hint: '排程版本' },
    { k: 'gantt',   n: '07', t: '甘特调整',   table: 'SCH_ADJUST',       path: 'gantt',              hint: '人工调整' },
    { k: 'board',   n: '08', t: '看板复核',   table: 'SCH_EXCEPTION',    path: 'board',              hint: '异常复核' }
  ];
  var FLOW_VIEWS = { flow: 1, mrp: 1, kit: 1, sched: 1, gantt: 1, board: 1, capload: 1, kitrate: 1, batch: 1 };

  /* ------------------------------------------------------------------ 工具 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function tSlug(t) { return 't-' + String(t).toLowerCase().replace(/_/g, '-'); }
  function currentView() {
    var act = $('#topnav button.active');
    if (act && act.getAttribute('data-view') && VIEW_BY_V[act.getAttribute('data-view')]) return act.getAttribute('data-view');
    var seg = (location.pathname || '').split('/').filter(Boolean).pop() || '';
    var x = VIEW_BY_PATH[seg] || VIEW_BY_V[seg];
    if (x) return x.v;
    var side = $('#sidebar .tbl-item.active[data-view]');
    if (side && VIEW_BY_V[side.getAttribute('data-view')]) return side.getAttribute('data-view');
    return 'browser';
  }
  function currentTable() {
    var act = $('#sidebar .tbl-item.active[data-t]');
    if (act) return act.getAttribute('data-t');
    var seg = (location.pathname || '').split('/').filter(Boolean).pop() || '';
    if (seg.indexOf('t-') !== 0) return '';
    var want = seg.slice(2).replace(/-/g, '_').toUpperCase();
    return S.TABLES[want] ? want : '';
  }
  function groupOfTable(t) {
    var out = '';
    (S.GROUPS || []).forEach(function (g) { if ((g.tables || []).indexOf(t) >= 0) out = g.name; });
    return out;
  }
  /* 业务表数据：服务器模式取 UNS 内存副本，本地模式取 localStorage，只读不写 */
  function tables() {
    try {
      if (window.APS_API && window.APS_API.isServer && window.APS_API.isServer()) {
        var t = window.APS_API.tables();
        if (t && Object.keys(t).length) return t;
      }
    } catch (e) { }
    try { return JSON.parse(localStorage.getItem('aps_db_v1') || '{}') || {}; } catch (e) { return {}; }
  }
  function liveRows(t) {
    var d = tables(), a = d[t];
    if (!Array.isArray(a)) return [];
    return a.filter(function (r) { return r && r.DEL_FLAG !== 1; });
  }
  function navigate(slug) {
    /* 优先点击已存在的导航项（不刷新，保留当前数据上下文）；否则走门户深链 */
    var target = $('#sidebar .tbl-item[data-t="' + slug.replace(/^t-/, '').replace(/-/g, '_').toUpperCase() + '"]');
    if (slug.indexOf('t-') === 0 && target) { target.click(); return true; }
    var v = VIEW_BY_PATH[slug] || VIEW_BY_V[slug];
    var vbtn = v && $('#topnav button[data-view="' + v.v + '"]');
    if (vbtn) { vbtn.click(); return true; }
    var side = v && $('#sidebar .tbl-item[data-view="' + v.v + '"]');
    if (side) { side.click(); return true; }
    try { location.href = BASE + slug; return true; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------ 偏好 / 环境 */
  function initPrefs() {
    /* URL 参数可覆盖偏好并落盘，便于把「深色 / 紧凑」视图直接分享给同事 */
    var qp = null;
    try { qp = new URLSearchParams(location.search); } catch (e) { }
    var qt = qp && qp.get('theme'), qd = qp && qp.get('density');
    var th = (qt === 'dark' || qt === 'light') ? qt : (store(KEY_THEME) || 'light');
    document.documentElement.setAttribute('data-theme', th === 'dark' ? 'dark' : 'light');
    if (qt === 'dark' || qt === 'light') store(KEY_THEME, th);
    var de = (qd === 'compact' || qd === 'comfortable') ? qd : (store(KEY_DENSITY) || 'comfortable');
    document.documentElement.setAttribute('data-density', de === 'compact' ? 'compact' : 'comfortable');
    if (qd === 'compact' || qd === 'comfortable') store(KEY_DENSITY, de);
    var host = location.hostname || '';
    var env, kind;
    if (/flash01/i.test(host)) { env = 'flash01 · 生产演示'; kind = 'server'; }
    else if (/v4on/i.test(host)) { env = 'v4on · 验证环境'; kind = 'server'; }
    else if (/localhost|127\.0\.0\.1|^$/.test(host)) { env = '本地开发'; kind = 'local'; }
    else { env = host; kind = 'server'; }
    var chip = $('#apsEnv');
    if (chip) { chip.textContent = env; chip.setAttribute('data-env', kind); chip.title = '运行环境：' + host + '（数据模式由顶栏同步状态决定）'; }
    try {
      if (window.APS_API && window.APS_API.on) {
        window.APS_API.on(function (s) {
          if (!chip) return;
          chip.setAttribute('data-env', s.mode === 'local' ? 'local' : (s.mode === 'init' ? 'unknown' : 'server'));
        });
      }
    } catch (e) { }
    var themeBtn = $('#proTheme'), densBtn = $('#proDensity');
    if (themeBtn) themeBtn.onclick = function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next); store(KEY_THEME, next);
      if (window.APS_TOAST) window.APS_TOAST('已切换到' + (next === 'dark' ? '深色' : '浅色') + '主题');
    };
    if (densBtn) densBtn.onclick = function () {
      var next = document.documentElement.getAttribute('data-density') === 'compact' ? 'comfortable' : 'compact';
      document.documentElement.setAttribute('data-density', next); store(KEY_DENSITY, next);
      if (window.APS_TOAST) window.APS_TOAST('表格密度：' + (next === 'compact' ? '紧凑' : '舒适'));
    };
    var menu = $('#proMenuToggle');
    if (menu) menu.onclick = function () {
      var open = document.documentElement.getAttribute('data-sidebar') === 'open';
      document.documentElement.setAttribute('data-sidebar', open ? 'closed' : 'open');
      menu.setAttribute('aria-expanded', String(!open));
    };
  }

  /* -------------------------------------------------------------- 加载遮罩 */
  function initBootMask() {
    if ($('.pro-boot')) return;
    var m = el('div', 'pro-boot');
    m.innerHTML = '<div class="pb-spin"></div><div>正在装载计划数据…</div>';
    document.body.appendChild(m);
    window.setTimeout(function () { hideBoot(); }, 3500); // 兜底：后端超时也必须能操作
  }
  function hideBoot() {
    var m = $('.pro-boot');
    if (!m || m.classList.contains('hide')) return;
    m.classList.add('hide');
    window.setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 260);
  }

  /* -------------------------------------------------------------- 侧栏增强 */
  var GROUP_ICON = {
    '计划基础数据': '基', '需求管理': '需', '物料需求计算': 'M', '物料齐套计算': '套',
    '生产排程': '排', '计划分析与预警': '析', '计划看板': '板', '系统与集成': '联'
  };
  function enhanceSidebar() {
    var sb = $('#sidebar');
    if (!sb || !$$('.tree-group', sb).length) return;

    /* 分组图标（插到 chev 之后） */
    $$('.group-head', sb).forEach(function (h) {
      if (h.querySelector('.pro-gicon')) return;
      var name = h.getAttribute('data-group') || '';
      var icon = el('span', 'pro-gicon', esc(GROUP_ICON[name] || name.slice(0, 1)));
      var chev = h.querySelector('.chev');
      if (chev && chev.parentNode) chev.parentNode.insertBefore(icon, chev.nextSibling);
    });

    /* 搜索框（app.js 重建侧栏后重新注入，保留查询词并重新过滤） */
    if (!$('.pro-side-search', sb)) {
      var box = el('div', 'pro-side-search');
      box.innerHTML = '<div class="pss-wrap">' +
        '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12.6 12.6l4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '<input id="proSideQuery" type="search" placeholder="筛选模块 / 数据表…" aria-label="筛选模块与数据表" autocomplete="off"/>' +
        '<button class="pss-clear" type="button" aria-label="清空筛选">×</button></div>';
      sb.insertBefore(box, sb.firstChild);
      var input = $('#proSideQuery', box), clear = $('.pss-clear', box);
      input.value = SIDE_QUERY;
      box.classList.toggle('has-value', !!SIDE_QUERY);
      input.oninput = function () { SIDE_QUERY = input.value; box.classList.toggle('has-value', !!SIDE_QUERY); applySideFilter(); };
      clear.onclick = function () { SIDE_QUERY = ''; input.value = ''; box.classList.remove('has-value'); applySideFilter(); input.focus(); };
    }
    applySideFilter();

    /* 底部说明 */
    if (!$('.pro-side-foot', sb)) {
      sb.appendChild(el('div', 'pro-side-foot',
        '<b>计划周期</b>：基础数据 → 需求 → MRP → 齐套 → 排程 → 看板。<br>快捷键 <b>Ctrl/⌘ + K</b> 打开命令面板，<b>/</b> 聚焦查询。'));
    }
  }
  function applySideFilter() {
    var q = (SIDE_QUERY || '').trim().toLowerCase();
    $$('#sidebar .tree-group').forEach(function (g) {
      var hit = 0;
      $$('.tbl-item', g).forEach(function (it) {
        var txt = (it.textContent || '').toLowerCase();
        var ok = !q || txt.indexOf(q) >= 0;
        it.style.display = ok ? '' : 'none';
        if (ok && q) hit++;
      });
      if (q) {
        var head = $('.group-head', g);
        var gh = (head && (head.textContent || '').toLowerCase().indexOf(q) >= 0);
        g.style.display = (hit || gh) ? '' : 'none';
        var list = $('.tbl-list', g);
        if (list && head && !head.classList.contains('collapsed')) list.style.display = '';
      } else g.style.display = '';
    });
  }

  /* -------------------------------------------------------------- 页头增强 */
  function enhanceHead() {
    var c = $('#content');
    if (!c || !c.children.length) return;
    if ($('.pro-head', c)) return;

    var view = currentView(), v = VIEW_BY_V[view] || VIEWS[0];
    /* 侧栏的 active 表项在非 browser 视图下依然存在，不能拿它当页面标题 */
    var table = view === 'browser' ? currentTable() : '';
    var h2 = $('.card > h2', c);
    var title = '', sub = '', crumb = '';
    if (table && S.TABLES[table]) {
      title = S.TABLES[table].label + ' · 数据浏览';
      var nCols = 0;
      try { nCols = S.columnsOf ? S.columnsOf(table).length : (S.TABLES[table].fields || []).length; } catch (e) { }
      sub = '字段 ' + nCols + ' 项 · 业务表 ' + table;
      crumb = (groupOfTable(table) || '数据浏览') + ' / ' + S.TABLES[table].label;
    } else {
      /* 取页面主标题的第一个文本节点，避免把 tag / mini 混进来 */
      if (h2) {
        var tn = Array.prototype.slice.call(h2.childNodes).filter(function (n) { return n.nodeType === 3 && n.textContent.trim(); })[0];
        title = tn ? tn.textContent.trim() : h2.textContent.trim();
      }
      title = title || v.label;
      sub = v.desc || '';
      crumb = (v.group || 'APS') + ' / ' + v.label;
    }
    var head = el('div', 'pro-head');
    head.setAttribute('data-pro-head', view + (table ? ':' + table : ''));
    var pills = '';
    var mode = 'local';
    try { mode = window.APS_API && window.APS_API.status ? window.APS_API.status().mode : 'local'; } catch (e) { }
    pills += '<span class="pro-pill">数据源 <b>' + (mode === 'server' ? 'supOS UNS' : '本地演示') + '</b></span>';
    var m = /\u5171\s*(\d+)\s*\u6761/.exec(c.textContent || '');
    if (m) pills += '<span class="pro-pill">记录 <b>' + m[1] + '</b></span>';
    head.innerHTML = '<div class="pro-crumb">APS 高级计划与排程 <i>›</i> ' + esc(crumb) + '</div>' +
      '<h1>' + esc(title) + '</h1>' +
      (sub ? '<div class="pro-sub">' + esc(sub) + '</div>' : '') +
      '<div class="pro-head-meta">' + pills + '</div>';
    c.insertBefore(head, c.firstChild);
  }

  /* ---------------------------------------------------- 计划周期进度条增强 */
  function flowDone(step) {
    var r = liveRows(step.table);
    if (!r.length) {
      if (step.k === 'suggest') return liveRows('PR_SUGGEST').length > 0;
      if (step.k === 'board') return liveRows('SCH_TASK').length > 0;
      return false;
    }
    if (step.k === 'demand') return r.some(function (x) { return /生效|已生效/.test(String(x.STATUS || '')); });
    if (step.k === 'rule') return r.some(function (x) { return +x.IS_DEFAULT === 1; });
    if (step.k === 'sched') return r.some(function (x) { return /发布|已发布/.test(String(x.STATUS || '')); });
    return true;
  }
  function enhanceFlowTrack() {
    var c = $('#content');
    if (!c || !c.children.length) return;
    if ($('.pro-flowtrack', c)) return;
    var view = currentView();
    if (!FLOW_VIEWS[view]) return;

    var done = FLOW_STEPS.map(flowDone);
    var n = done.filter(Boolean).length;
    var firstPending = done.indexOf(false);
    var cur = firstPending < 0 ? 7 : firstPending;
    var steps = FLOW_STEPS.map(function (s, i) {
      var cls = done[i] ? 'done' : (i === cur ? 'current' : '');
      var txt = done[i] ? '已完成' : (i === cur ? '进行中' : '待执行');
      return '<a class="ft-step ' + cls + '" href="' + esc(BASE + s.path) + '" data-step="' + s.k + '">' +
        '<span class="ft-n">' + (done[i] ? '✓' : s.n) + '</span>' +
        '<span class="ft-t">' + esc(s.t) + '</span>' +
        '<span class="ft-s">' + txt + ' · ' + liveRows(s.table).length + '</span></a>';
    }).join('');
    var box = el('div', 'pro-flowtrack');
    box.setAttribute('data-pro-flowtrack', view);
    box.innerHTML = '<div class="ft-hd"><span>计划周期进度</span><span class="ft-prog">' + n + ' / 8 已完成</span></div>' +
      '<div class="ft-bar"><i style="width:' + Math.round(n / 8 * 100) + '%"></i></div>' +
      '<div class="ft-steps">' + steps + '</div>' +
      '<div class="ft-tip">点击任一步可直接跳转到对应工作台或数据表；进度由当前业务表实时计算，不写入任何数据。</div>';
    var head = $('.pro-head', c);
    c.insertBefore(box, head && head.nextSibling ? head.nextSibling : c.firstChild);
  }

  /* ------------------------------------------- 看板空区间引导（只读提示） */
  /* 驾驶舱默认落「本月」，而演示数据的业务日期集中在 8–10 月：整套 KPI 会显示 0。
   * 不自动改用户的区间选择，只给出解释与一键切到「本年」的入口。 */
  function enhanceBoardHint() {
    var c = $('#content');
    if (!c || currentView() !== 'board') return;
    if ($('.pro-empty-hint', c)) return;
    if (!/本区间内无|本区间内暂无/.test(c.textContent || '')) return;
    var box = el('div', 'pro-empty-hint');
    box.innerHTML = '<span class="ph-ico">i</span>' +
      '<div class="ph-txt"><b>当前统计区间没有命中业务数据。</b>驾驶舱按需求日期 / 计划开工日 / 检查日期过滤，' +
      '区间外的计划周期不会计入 KPI；这与「计划周期进度」显示的数据完整性是两回事。可切到更宽的区间复核。</div>' +
      '<button type="button" data-pro-range="本年">查看本年</button>';
    var anchor = $('.pro-flowtrack', c) || $('.pro-head', c);
    c.insertBefore(box, anchor && anchor.nextSibling ? anchor.nextSibling : c.firstChild);
    var b = $('[data-pro-range]', box);
    if (b) b.onclick = function () {
      var chip = $('.board-card [data-chip="本年"]');
      if (chip) chip.click();
      else if (window.APS_TOAST) window.APS_TOAST('未找到「本年」快捷区间');
    };
  }

  /* ------------------------------------------------------------ 表格可达性 */
  function enhanceA11y() {
    $$('#content table.grid thead th').forEach(function (th) {
      if (!th.getAttribute('scope')) th.setAttribute('scope', 'col');
    });
    $$('#content table.grid').forEach(function (t) {
      if (!t.getAttribute('aria-label')) {
        var h2 = $('.card > h2', t.closest('.card') || document);
        t.setAttribute('aria-label', h2 ? h2.textContent.trim().slice(0, 40) : '业务数据表格');
      }
    });
  }

  /* -------------------------------------------------------------- 命令面板 */
  var cmd = { open: false, items: [], idx: 0, mask: null };
  function cmdData() {
    var out = [];
    VIEWS.forEach(function (v) { out.push({ label: v.label, kind: '视图', path: v.path, slug: v.path, sub: v.group }); });
    Object.keys(S.TABLES || {}).forEach(function (t) {
      var d = S.TABLES[t] || {};
      out.push({ label: d.label || t, kind: '数据表', path: tSlug(t), slug: tSlug(t), sub: groupOfTable(t) || t });
    });
    return out;
  }
  function openCmd() {
    if (cmd.mask) return;
    cmd.items = cmdData(); cmd.idx = 0; cmd.open = true;
    var mask = el('div', 'pro-cmd-mask');
    mask.innerHTML = '<div class="pro-cmd" role="dialog" aria-modal="true" aria-label="命令面板">' +
      '<div class="pc-in"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12.6 12.6l4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '<input id="proCmdInput" type="text" placeholder="搜索视图或数据表，回车跳转…" autocomplete="off" aria-label="搜索视图或数据表"/><kbd>ESC</kbd></div>' +
      '<div class="pc-list" id="proCmdList"></div>' +
      '<div class="pc-foot">↑ ↓ 选择 · Enter 打开 · Esc 关闭　|　共 ' + cmd.items.length + ' 个可跳转入口</div></div>';
    document.body.appendChild(mask); cmd.mask = mask;
    mask.onclick = function (e) { if (e.target === mask) closeCmd(); };
    var input = $('#proCmdInput', mask);
    input.oninput = function () { renderCmd(input.value); };
    input.onkeydown = function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmd.idx = Math.min(cmd.idx + 1, cmd.items.length - 1); renderCmd(input.value, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmd.idx = Math.max(cmd.idx - 1, 0); renderCmd(input.value, true); }
      else if (e.key === 'Enter') { e.preventDefault(); var it = cmd.shown && cmd.shown[cmd.idx]; if (it) chooseCmd(it.slug); }
    };
    renderCmd('');
    window.setTimeout(function () { try { input.focus(); } catch (e) { } }, 0);
  }
  function renderCmd(q, keepIdx) {
    var list = $('#proCmdList', cmd.mask);
    if (!list) return;
    var k = (q || '').trim().toLowerCase();
    var items = cmd.items.filter(function (x) {
      return !k || (x.label + ' ' + x.sub + ' ' + x.path).toLowerCase().indexOf(k) >= 0;
    }).slice(0, 60);
    cmd.shown = items;
    if (!keepIdx) cmd.idx = 0;
    if (cmd.idx >= items.length) cmd.idx = Math.max(0, items.length - 1);
    if (!items.length) { list.innerHTML = '<div class="pc-empty">没有匹配的视图或数据表</div>'; return; }
    var html = '', lastKind = '';
    items.forEach(function (x, i) {
      if (x.kind !== lastKind) { html += '<div class="pc-grp">' + esc(x.kind) + '</div>'; lastKind = x.kind; }
      html += '<div class="pc-item' + (i === cmd.idx ? ' on' : '') + '" data-i="' + i + '" data-slug="' + esc(x.slug) + '">' +
        '<span class="pc-kind">' + esc(x.kind) + '</span><span>' + esc(x.label) + '</span>' +
        '<span class="pc-path">' + esc(x.sub) + '</span></div>';
    });
    list.innerHTML = html;
    $$('.pc-item', list).forEach(function (it, i) {
      it.onclick = function () { chooseCmd(it.getAttribute('data-slug')); };
      it.onmouseenter = function () { cmd.idx = i; $$('.pc-item', list).forEach(function (n) { n.classList.remove('on'); }); it.classList.add('on'); };
    });
  }
  function chooseCmd(slug) { closeCmd(); navigate(slug); }
  function closeCmd() {
    if (cmd.mask && cmd.mask.parentNode) cmd.mask.parentNode.removeChild(cmd.mask);
    cmd.mask = null; cmd.open = false;
  }

  /* ------------------------------------------------------------ 键盘与提示 */
  function initKeys() {
    var b = $('#proCmd');
    if (b) b.onclick = openCmd;
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); cmd.open ? closeCmd() : openCmd(); return; }
      if (e.key === 'Escape') {
        if (cmd.open) { closeCmd(); return; }
        var mm = $('#modalMask');
        if (mm && mm.style.display !== 'none') { var x = $('#modalClose'); if (x) x.click(); }
        return;
      }
      if (e.key === '/' && !typing && !cmd.open) {
        var s = $('#search');
        if (s) { e.preventDefault(); s.focus(); }
      }
    });
    /* Toast 语义着色：只读取文本，不改业务提示内容 */
    var toast = $('#toast');
    if (toast && window.MutationObserver) {
      new MutationObserver(function () {
        var t = toast.textContent || '';
        toast.style.borderLeftColor = /失败|错误|不能|无法|请先|不存在|被拦/.test(t)
          ? 'var(--p-bad)' : (/删除|重置|已清除/.test(t) ? 'var(--p-warn)' : 'var(--p-primary)');
      }).observe(toast, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ------------------------------------------------------------ 增强调度器 */
  var obs = null, timer = null;
  function watch() {
    if (!obs) return;
    obs.disconnect();
    try {
      var c = $('#content'), s = $('#sidebar'), n = $('#topnav');
      if (c) obs.observe(c, { childList: true });
      if (s) obs.observe(s, { childList: true });
      if (n) obs.observe(n, { childList: true });
    } catch (e) { }
  }
  function enhance() {
    if (obs) obs.disconnect();
    try {
      enhanceSidebar();
      enhanceHead();
      enhanceFlowTrack();
      enhanceBoardHint();
      enhanceA11y();
      if ($('#content') && $('#content').children.length) hideBoot();
    } finally { if (obs) watch(); }
  }
  function scheduleEnhance() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; enhance(); }, 30);
  }
  function init() {
    initPrefs();
    initKeys();
    initBootMask();
    if (window.MutationObserver) {
      obs = new MutationObserver(function () { scheduleEnhance(); });
      watch();
    }
    document.addEventListener('DOMContentLoaded', scheduleEnhance);
    scheduleEnhance();
    window.setTimeout(enhance, 600);
    window.setTimeout(enhance, 1800);   /* 后端慢启动时数据到位后再算一次进度 */
  }
  /* 暴露只读探针，便于自动化验证断言增强层确实生效（不提供任何写业务数据的能力） */
  window.APS_PRO = {
    version: '2.2.0',
    view: currentView,
    table: currentTable,
    rows: liveRows,
    flow: function () { return FLOW_STEPS.map(function (s) { return { key: s.k, done: flowDone(s), count: liveRows(s.table).length }; }); },
    openCmd: openCmd,
    closeCmd: closeCmd,
    navigate: navigate,
    enhance: enhance
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
