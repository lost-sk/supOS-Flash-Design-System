/* 设计期 · 语义模型 · 二级交互（规格：.cache/flash-l2-specs/03-diviner-semantic.md）
 * 模板（弹窗/抽屉/实体详情）来自 l2/diviner.mjs 内的 <template data-tpl>，文案逐字。
 * IIFE + document 委托 data-op；视图切换（列表/详情/指标/知识/草稿/图谱）用 hidden + data-view。 */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const elOf = (html) => U.el(html);
  const tplHtml = (name) => $(`[data-tpl="${name}"]`).innerHTML;

  /* 语义色 Tag（与 mjs 一致：只允许 var(--flash-*)） */
  const CT = {
    blue: ['var(--flash-primary)', 'var(--flash-primary-soft)'],
    green: ['var(--flash-success)', 'var(--flash-success-soft)'],
    purple: ['var(--flash-node-sub)', 'var(--flash-stat-purple)'],
    gold: ['var(--flash-sem-pending)', 'var(--flash-stat-amber)'],
    orange: ['var(--flash-warning)', 'var(--flash-stat-amber)'],
  };
  const ctag = (t, k) => { const [fg, bg] = CT[k] || CT.blue; return `<span class="tag" style="color:${fg};background:${bg};border-color:${bg}">${esc(t)}</span>`; };

  /* ── 示例数据（与左侧树 / 实体列表一致） ── */
  const NAME2ID = { '设备台账': 'md_equipment', '生产工单': 'md_work_order', '工序报工': 'md_process_report', '质量检验': 'md_quality_check', '分析宽表': 'md_analysis_wide' };
  const ENT = {
    md_equipment: {
      name: '设备台账', domain: '精达传动', kind: 'sql', desc: '设备主数据与台账信息',
      fields: [
        ['eq_id', '设备主键', 'BIGINT', '自增主键', '', '主键', 0],
        ['eq_code', '设备编码', 'VARCHAR', '编号规则 JD-EQ-0000', '', '分析维度', 0],
        ['eq_name', '设备名称', 'VARCHAR', '台账展示名称', '', '', 0],
        ['eq_type', '设备类型', 'VARCHAR', '车床 / 铣床 / 加工中心', '', '分析维度', 0],
        ['workshop', '所属车间', 'VARCHAR', '', '', '分析维度', 0],
        ['buy_date', '购置日期', 'DATE', '资产入账日期', '', '时间维度', 0],
        ['eq_value', '设备原值', 'DECIMAL', '资产原值', '元 ×1', '度量', 0],
        ['run_hours', '累计运行时长', 'BIGINT', '从接入起累计', '小时 ×1', '度量', 0],
        ['eq_status', '设备状态', 'VARCHAR', '运行 / 待机 / 故障 / 维保', '', '', 1],
      ],
      fks: [['被引用', 'eq_id', '生产工单', 'equipment_id']],
      rel: {
        'rel-metric': [['设备原值合计', '原子', '求和(eq_value)']],
        'rel-sql': [['eq_asset_summary', '按车间汇总设备资产']],
        'rel-knowledge': [['设备状态码', '枚举定义', 'RUNNING / IDLE / DOWN / MAINT / …']],
        'rel-rule': [],
      },
    },
    md_work_order: {
      name: '生产工单', domain: '精达传动', kind: 'model', desc: '生产工单主表与状态跟踪',
      fields: [
        ['wo_id', '工单主键', 'BIGINT', '自增主键', '', '主键', 0],
        ['order_no', '工单编号', 'VARCHAR', '编号规则 GD-YYMM-000', '', '分析维度', 0],
        ['product_code', '产品编码', 'VARCHAR', '关联产品主数据', '', '分析维度', 0],
        ['equipment_id', '设备', 'BIGINT', '引用设备台账', '', '', 0],
        ['plan_qty', '计划数量', 'INTEGER', '', '件 ×1', '度量', 0],
        ['done_qty', '完成数量', 'INTEGER', '', '件 ×1', '度量', 0],
        ['order_date', '下达日期', 'DATE', '', '', '时间维度', 0],
        ['status', '工单状态', 'VARCHAR', '已下达 / 生产中 / 完工', '', '', 1],
      ],
      fks: [['引用', 'equipment_id', '设备台账', 'eq_id'], ['被引用', 'order_no', '工序报工', 'work_order_no']],
      rel: { 'rel-metric': [], 'rel-sql': [], 'rel-knowledge': [['工单下达流程', '流程', '计划员下达 → 车间接收 → 开工确认']], 'rel-rule': [] },
    },
    md_process_report: {
      name: '工序报工', domain: '精达传动', kind: 'model', desc: '工序级报工明细',
      fields: [
        ['rp_id', '报工主键', 'BIGINT', '自增主键', '', '主键', 0],
        ['work_order_no', '工单编号', 'VARCHAR', '关联生产工单', '', '分析维度', 0],
        ['process_code', '工序编码', 'VARCHAR', 'OP10 / OP20 / OP30', '', '分析维度', 0],
        ['qty', '报工数量', 'DECIMAL', '合格 + 不合格', '件 ×1', '度量', 0],
        ['ng_qty', '不合格数量', 'DECIMAL', '', '件 ×1', '度量', 0],
        ['report_time', '报工时间', 'TIMESTAMP', '', '', '时间维度', 0],
      ],
      fks: [['引用', 'work_order_no', '生产工单', 'order_no'], ['被引用', 'rp_id', '质量检验', 'report_id']],
      rel: {
        'rel-metric': [['产量合计', '原子', '求和(qty)'], ['月度产量', '派生', '产量合计 + 按月汇总']],
        'rel-sql': [], 'rel-knowledge': [], 'rel-rule': [['报废复检规则', '连续报废 ≥3 件触发质检复检']],
      },
    },
    md_quality_check: {
      name: '质量检验', domain: '精达传动', kind: 'model', desc: '检验单与缺陷记录',
      fields: [
        ['qc_id', '检验单主键', 'BIGINT', '自增主键', '', '主键', 0],
        ['report_id', '报工单', 'BIGINT', '关联工序报工', '', '', 0],
        ['qc_result', '检验结论', 'VARCHAR', '合格 / 不合格 / 让步接收', '', '分析维度', 0],
        ['defect_code', '缺陷代码', 'VARCHAR', '关联缺陷字典', '', '分析维度', 0],
        ['qc_time', '检验时间', 'TIMESTAMP', '', '', '时间维度', 0],
      ],
      fks: [['引用', 'report_id', '工序报工', 'rp_id']],
      rel: { 'rel-metric': [], 'rel-sql': [], 'rel-knowledge': [['良品', '术语', '一次检验判定合格的产品']], 'rel-rule': [] },
    },
    md_analysis_wide: {
      name: '分析宽表', domain: '', kind: 'model', noSearch: true, desc: '',
      fields: [
        ['wide_key', '宽表主键', 'BIGINT', '', '', '主键', 0],
        ['eq_code', '设备编码', 'VARCHAR', '', '', '分析维度', 0],
        ['order_no', '工单编号', 'VARCHAR', '', '', '分析维度', 0],
        ['output_qty', '产出数量', 'DECIMAL', '', '件 ×1', '度量', 0],
      ],
      fks: [], rel: { 'rel-metric': [], 'rel-sql': [], 'rel-knowledge': [], 'rel-rule': [] },
    },
  };
  let curIdent = '';

  /* ── 视图切换 ── */
  function showView(name) { $$('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== name; }); }
  function setActive(row) { $$('.tree-row.is-active').forEach((r) => r.classList.remove('is-active')); if (row && row.classList.contains('tree-row')) row.classList.add('is-active'); }

  /* ── 列表过滤（搜索 + segmented / 筛选下拉） ── */
  const F = {
    entity: { q: '', kind: 'all' },
    field: { q: '', role: '全部字段' },
    metric: { q: '', t: '全部' },
    knowledge: { q: '', t: '全部' },
  };
  function applyFilter(kind) {
    const st = F[kind];
    const list = $(`[data-list="${kind}"]`);
    if (!list) return;
    let n = 0;
    $$('tbody tr', list).forEach((tr) => {
      const txt = tr.textContent.toLowerCase();
      let ok = !st.q || txt.includes(st.q.toLowerCase());
      if (ok && kind === 'entity' && st.kind !== 'all') ok = tr.dataset.kind === st.kind;
      if (ok && kind === 'field' && st.role !== '全部字段') ok = st.role === '隐藏字段' ? tr.dataset.hidden === '1' : tr.dataset.role === st.role;
      if (ok && kind === 'metric' && st.t !== '全部') ok = tr.dataset.mtype === st.t;
      if (ok && kind === 'knowledge' && st.t !== '全部') ok = tr.dataset.ktype === st.t;
      tr.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    const empty = list.parentElement.querySelector('[data-empty]');
    if (empty) { empty.hidden = n > 0; list.hidden = n === 0; }
  }
  document.addEventListener('input', (e) => {
    const s = e.target.closest('[data-search]');
    if (!s) return;
    F[s.dataset.search].q = s.value.trim();
    applyFilter(s.dataset.search);
  });
  document.addEventListener('change', (e) => {
    const g = e.target.closest('[data-graph-filter]');
    if (g) {
      const none = g.value === '未分配';
      $('[data-graph-wrap]').hidden = none;
      $('[data-graph-empty]').hidden = !none;
      return;
    }
    const s = e.target.closest('[data-filter]');
    if (!s) return;
    const kind = s.dataset.filter;
    if (kind === 'field') F.field.role = s.value; else F[kind].t = s.value;
    applyFilter(kind);
  });

  /* ── 表单辅助 ── */
  function markErr(ctrl, msg) {
    const f = ctrl.closest('.field');
    if (f) { f.classList.add('has-error'); const slot = f.querySelector('.f-err'); if (slot) slot.textContent = msg; }
    return false;
  }
  /* data-req-zone：隐藏分区自动摘除 data-req，展开时恢复（data-req0 永久标记） */
  function syncReq(scope) {
    $$('[data-req0]', scope).forEach((c) => {
      const z = c.closest('[data-req-zone]');
      if (z && !z.hidden) c.setAttribute('data-req', '1'); else c.removeAttribute('data-req');
    });
  }
  const fldVal = (root, sel) => { const c = $(sel, root); return c ? c.value.trim() : ''; };

  /* ── 行构造 ── */
  const fieldRow = (f) => {
    const [ident, biz, type, desc, unit, role, hidden] = f;
    return `<tr data-frow data-ident="${esc(ident)}" data-role="${esc(role)}" data-hidden="${hidden ? 1 : 0}" ${hidden ? 'style="opacity:.55"' : ''}>
      <td><div class="mono">${esc(ident)}</div><div style="color:var(--flash-text-secondary)">${esc(biz || '—')}</div></td>
      <td><span class="tag mono">${esc(type)}</span></td>
      <td>${desc ? esc(desc) : '<span class="muted">尚未添加描述</span>'}</td>
      <td>${esc(unit || '—')}</td>
      <td>${role ? ctag(role, { '主键': 'gold', '分析维度': 'blue', '度量': 'orange', '时间维度': 'green' }[role]) : '<span class="muted">—</span>'}</td>
      <td><button class="btn sm" data-op="vis">${hidden ? '🚫 已隐藏' : '👁 可见'}</button></td>
      <td><span class="link-ops"><a href="javascript:;" data-op="field-edit">编辑</a><a href="javascript:;" class="danger" data-op="field-del">删除</a></span></td></tr>`;
  };
  const fkRow = (fk) => `<tr data-fkrow>
    <td>${fk[0] === '引用' ? ctag('引用', 'blue') : ctag('被引用', 'green')}</td>
    <td class="mono">${esc(fk[1])}</td>
    <td><a href="javascript:;" data-op="open-model" data-ident="${esc(NAME2ID[fk[2]] || '')}">${esc(fk[2])}</a></td>
    <td class="mono">${esc(fk[3])}</td>
    <td><span class="link-ops"><a href="javascript:;" class="danger" data-op="fk-del">删除</a></span></td></tr>`;
  const relRow = (key, r) => ({
    'rel-metric': () => `<tr><td style="font-weight:500">${esc(r[0])}</td><td>${ctag(r[1], { '原子': 'blue', '派生': 'green', '独立': 'purple' }[r[1]])}</td><td>${esc(r[2])}</td></tr>`,
    'rel-sql': () => `<tr><td class="mono">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`,
    'rel-knowledge': () => `<tr><td style="font-weight:500">${esc(r[0])}</td><td>${ctag(r[1], { '术语': 'blue', '枚举定义': 'purple', '流程': 'cyan', '场景': 'green' }[r[1]])}</td><td>${esc(r[2])}</td></tr>`,
    'rel-rule': () => `<tr><td style="font-weight:500">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`,
  }[key]());

  /* ── 实体详情渲染 ── */
  function renderDetail(ident) {
    const d = ENT[ident];
    if (!d) return;
    curIdent = ident;
    const root = $(`[data-tpl="detail"]`).content.firstElementChild.cloneNode(true);
    const q = (s) => root.querySelector(s);
    q('[data-d-icon]').textContent = d.name.slice(0, 1);
    q('[data-d-name]').textContent = d.name;
    q('[data-d-ident]').textContent = ident;
    q('[data-d-kindtag]').innerHTML = d.kind === 'sql' ? ctag('SQL 视图', 'purple') : ctag('模型', 'blue');
    q('[data-d-retag]').hidden = !d.noSearch;
    q('[data-d-desc]').innerHTML = d.desc ? esc(d.desc) : '<span class="muted">还没有业务描述，点击编辑补充。</span>';
    q('[data-d-domain-val]').innerHTML = d.domain ? ctag(d.domain, 'blue') : '<span class="muted">未分配</span> <a href="javascript:;" data-op="set-domain">设置</a>';
    q('[data-field-body]').innerHTML = d.fields.map(fieldRow).join('');
    q('[data-fcount]').textContent = d.fields.length;
    q('[data-fkcount]').textContent = d.fks.length;
    renderFk(root, d);
    Object.keys(d.rel).forEach((key) => {
      const pane = q(`[data-dpane="${key}"]`);
      const rows = d.rel[key] || [];
      pane.querySelector(`[data-rel-body="${key}"]`).innerHTML = rows.map((r) => relRow(key, r)).join('');
      pane.querySelector('[data-list]').hidden = rows.length === 0;
      pane.querySelector('.empty').hidden = rows.length > 0;
    });
    const bodyEl = $('[data-detail-body]');
    bodyEl.innerHTML = '';
    bodyEl.appendChild(root);
    showView('detail');
  }
  function renderFk(root, d) {
    const pane = root.querySelector('[data-dpane="fks"]');
    pane.querySelector('[data-fk-body]').innerHTML = d.fks.map(fkRow).join('');
    pane.querySelector('[data-list]').hidden = d.fks.length === 0;
    pane.querySelector('.empty').hidden = d.fks.length > 0;
  }
  const detailRoot = () => $('[data-detail-body] [data-detail-root]');
  const cur = () => ENT[curIdent];
  function updateFcount() { const el = $('[data-fcount]'); if (el) el.textContent = cur().fields.length; }

  /* ── 弹窗：新建 / 编辑模型 ── */
  function openModelModal(d) {
    const m = U.modal({
      title: d ? `编辑模型 · ${d.name}` : '新建模型', width: 640, body: tplHtml('model'),
      onOk: (root) => { if (!U.validate(root)) return false; U.toast(d ? '模型已保存' : '模型已创建'); },
    });
    const root = m.root;
    syncReq(root);
    root.addEventListener('change', (e) => {
      if (e.target.name !== 'm-src') return;
      const phys = $('[data-src-phys]', root), sql = $('[data-src-sql]', root);
      const isPhys = e.target.value === 'phys';
      phys.hidden = !isPhys; sql.hidden = isPhys;
      U.clearErrors(root);
      syncReq(root);
    });
    if (d) {
      $('[data-m-ident]', root).value = curIdent;
      $('[data-m-ident]', root).disabled = true;
      $('[data-m-name]', root).value = d.name;
      $('[data-m-desc]', root).value = d.desc;
      $('[data-m-ds]', root).value = 'fedquery';
      $('[data-m-pk]', root).value = (d.fields.find((f) => f[5] === '主键') || d.fields[0])[0];
      $('[data-m-search]', root).checked = !d.noSearch;
      const useSql = d.kind === 'sql';
      ($(`input[name="m-src"][value="${useSql ? 'sql' : 'phys'}"]`, root)).checked = true;
      $('[data-src-phys]', root).hidden = useSql;
      $('[data-src-sql]', root).hidden = !useSql;
      $('[data-m-table]', root).value = useSql ? '' : curIdent;
      $('[data-m-sql]', root).value = useSql ? 'SELECT * FROM stg_equipment WHERE deleted = 0' : '';
      syncReq(root);
    }
  }

  /* ── 弹窗：新建 / 编辑字段 ── */
  function openFieldModal(editIdent, tr) {
    const d = cur();
    const m = U.modal({
      title: editIdent ? `编辑字段 · ${editIdent}` : '新建字段', width: 640, body: tplHtml('field'),
      onOk: (root) => {
        if (!U.validate(root)) return false;
        const ident = fldVal(root, '[data-f-ident]');
        if (!editIdent && d.fields.some((f) => f[0] === ident)) return markErr($('[data-f-ident]', root), '该字段标识已存在');
        const roleRadio = $('input[name="f-role"]:checked', root);
        const rec = [
          ident, fldVal(root, '[data-f-name]'), $('[data-f-type]', root).value, fldVal(root, '[data-f-desc]'),
          fldVal(root, '[data-f-unit]') ? (fldVal(root, '[data-f-ratio]') ? `${fldVal(root, '[data-f-unit]')} ×${fldVal(root, '[data-f-ratio]')}` : fldVal(root, '[data-f-unit]')) : '',
          $('[data-f-time]', root).checked ? '时间维度' : (roleRadio && roleRadio.value !== '未设置' ? roleRadio.value : ''),
          $('[data-f-hidden]', root).checked ? 1 : 0,
        ];
        if (editIdent) {
          const i = d.fields.findIndex((f) => f[0] === editIdent);
          d.fields[i] = rec;
          tr.replaceWith(elOf(fieldRow(rec)));
        } else {
          d.fields.push(rec);
          $('[data-field-body]').appendChild(elOf(fieldRow(rec)));
        }
        updateFcount(); applyFilter('field');
        U.toast(editIdent ? '字段已保存' : '字段已添加');
      },
    });
    if (editIdent) {
      const f = d.fields.find((x) => x[0] === editIdent) || [];
      const root = m.root;
      $('[data-f-ident]', root).value = f[0] || '';
      $('[data-f-name]', root).value = f[1] || '';
      $('[data-f-type]', root).value = f[2] || '';
      $('[data-f-desc]', root).value = f[3] || '';
      const unit = f[4] || '';
      const mi = unit.match(/^(.*?)\s*×([\d.]+)$/);
      $('[data-f-unit]', root).value = mi ? mi[1] : unit;
      $('[data-f-ratio]', root).value = mi ? mi[2] : '';
      const role = f[5] || '';
      if (role === '时间维度') $('[data-f-time]', root).checked = true;
      else if (role) ($(`input[name="f-role"][value="${role}"]`, root) || {}).checked = true;
      if (f[6]) $('[data-f-hidden]', root).checked = true;
    }
  }

  /* ── 弹窗：新建业务域 / 设置业务域 ── */
  function addDomain() {
    U.modal({
      title: '新建业务域', width: 420, body: tplHtml('domain'),
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('业务域已新增'); },
    });
  }
  function setDomain() {
    const d = cur();
    U.modal({
      title: '设置业务域', width: 420, body: tplHtml('set-domain'),
      onOk: (root) => {
        d.domain = $('select', root).value || '';
        renderDetail(curIdent);
        U.toast(d.domain ? `已分配到「${d.domain}」` : '已解除分配');
      },
    });
  }

  /* ── 弹窗：添加外键 ── */
  function openFkModal() {
    const d = cur();
    const m = U.modal({
      title: `添加外键 · ${d.name}`, width: 640, body: tplHtml('fk'),
      onOk: (root) => {
        if (!U.validate(root)) return false;
        const rows = $$('[data-fk-row]', root);
        if (!rows.length) { U.toast('至少添加一行完整列映射', 'warning'); return false; }
        const pairs = [];
        for (const r of rows) {
          const s = $('select[data-fk-src]', r).value, t = $('select[data-fk-dst]', r).value;
          if (!s) { U.toast('选本端列', 'warning'); return false; }
          if (!t) { U.toast('选目标列', 'warning'); return false; }
          pairs.push([s, t]);
        }
        const target = $('[data-fk-target]', root).value;
        d.fks.push(['引用', pairs[0][0], target, pairs[0][1]]);
        renderFk(detailRoot(), d);
        $('[data-fkcount]').textContent = d.fks.length;
        U.toast('外键声明已添加');
      },
    });
    const rowsEl = $('[data-fk-rows]', m.root);
    const addRow = () => rowsEl.appendChild(elOf(`
      <div data-fk-row style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <select data-fk-src style="flex:1"><option value="">选本端列</option>${d.fields.map((f) => `<option>${esc(f[0])}</option>`).join('')}</select>
        <span class="muted">→</span>
        <select data-fk-dst style="flex:1"><option value="">选目标列</option></select>
        <a href="javascript:;" data-op-tpl="fk-del-row" style="color:var(--flash-error)">✕</a>
      </div>`));
    addRow();
    m.root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-op-tpl]');
      if (!a) return;
      if (a.dataset.opTpl === 'fk-add-row') addRow();
      if (a.dataset.opTpl === 'fk-del-row') a.closest('[data-fk-row]').remove();
    });
    m.root.addEventListener('change', (e) => {
      const t = e.target.closest('[data-fk-target]');
      if (!t || !t.value) return;
      const td = ENT[NAME2ID[t.value]];
      if (!td) return;
      const pk = (td.fields.find((f) => f[5] === '主键') || td.fields[0])[0];
      $$('select[data-fk-dst]', m.root).forEach((s) => {
        s.innerHTML = `<option value="">选目标列</option>${td.fields.map((f) => `<option ${f[0] === pk ? 'selected' : ''}>${esc(f[0])}</option>`).join('')}`;
      });
    });
  }

  /* ── 抽屉：新建 / 编辑指标 ── */
  const condRow = () => `<div data-cond-row style="display:grid;grid-template-columns:1.2fr 1.1fr 1fr .7fr .6fr auto;gap:6px;margin-bottom:8px">
    <select><option>report_time 报工时间</option><option>qc_result 检验结论</option><option>eq_code 设备编码</option></select>
    <select><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option><option>为空</option><option>不为空</option></select>
    <input placeholder="比较值"><input placeholder="单位"><input placeholder="比例">
    <a href="javascript:;" data-op-tpl="cond-del-row" style="align-self:center;color:var(--flash-error)">✕</a></div>`;
  function openMetricDrawer(pre) {
    const dr = U.drawer({
      title: pre ? `编辑指标 · ${pre.name}` : '新建指标', width: 720, body: tplHtml('metric'), okText: '保存', cancelText: '取消',
      onOk: (pane) => {
        syncReq(pane);
        if (!U.validate(pane)) return false;
        const type = $('[data-metric-type]', pane).value;
        if (type === '原子') {
          const agg = $('[data-agg]', pane).value;
          const expr = $('[data-expr]', pane).textContent.trim();
          if (!['计数', '去重计数'].includes(agg) && !expr) return markErr($('[data-expr]', pane), '非计数聚合需要取值表达式');
        }
        if (type === '独立' && !$('[data-isql]', pane).textContent.trim()) return markErr($('[data-isql]', pane), '独立指标的实现 SQL 不能为空');
        U.toast('指标已保存');
      },
    });
    const pane = dr.root;
    const typeSel = $('[data-metric-type]', pane);
    const syncType = () => {
      const v = typeSel.value;
      $('[data-metric-atomic]', pane).hidden = v !== '原子';
      $('[data-metric-derived]', pane).hidden = v !== '派生';
      $('[data-metric-independent]', pane).hidden = v !== '独立';
      syncReq(pane);
    };
    typeSel.addEventListener('change', syncType);
    if (pre) {
      typeSel.value = pre.type;
      typeSel.disabled = true;
      $('[data-mt-ident]', pane).value = pre.ident;
      $('[data-mt-name]', pane).value = pre.name;
    }
    syncType();
    pane.addEventListener('change', (e) => {
      if (e.target.name !== 'd-period') return;
      $('[data-period-time]', pane).hidden = e.target.value !== 'query';
      syncReq(pane);
    });
    const condEl = $('[data-cond-rows]', pane);
    condEl.appendChild(elOf(condRow()));
    pane.addEventListener('click', (e) => {
      const a = e.target.closest('[data-op-tpl]');
      if (!a) return;
      if (a.dataset.opTpl === 'cond-add-row') condEl.appendChild(elOf(condRow()));
      if (a.dataset.opTpl === 'cond-del-row') a.closest('[data-cond-row]').remove();
    });
  }

  /* ── 抽屉：新建知识 ── */
  const enumRow = () => `<div data-enum-row style="display:grid;grid-template-columns:1fr 1fr 1.4fr auto;gap:8px;margin-bottom:8px">
    <input placeholder="原始取值 *"><input placeholder="业务名 *"><input placeholder="取值语义（可选）">
    <a href="javascript:;" data-op-tpl="enum-del-row" style="align-self:center;color:var(--flash-error)">✕</a></div>`;
  function openKnowledgeDrawer() {
    const dr = U.drawer({
      title: '新建知识', width: 720, body: tplHtml('knowledge'), okText: '保存', cancelText: '取消',
      onOk: (pane) => {
        syncReq(pane);
        if (!U.validate(pane)) return false;
        if ($('[data-ktype]', pane).value === '枚举定义' && !$$('[data-enum-row]', pane).length) { U.toast('至少定义一个枚举取值', 'warning'); return false; }
        U.toast('知识已保存');
      },
    });
    const pane = dr.root;
    const enumEl = $('[data-enum-rows]', pane);
    enumEl.appendChild(elOf(enumRow()));
    syncReq(pane);
    pane.addEventListener('click', (e) => {
      const a = e.target.closest('[data-op-tpl]');
      if (!a) return;
      if (a.dataset.opTpl === 'enum-add-row') enumEl.appendChild(elOf(enumRow()));
      if (a.dataset.opTpl === 'enum-del-row') a.closest('[data-enum-row]').remove();
    });
    pane.addEventListener('change', (e) => {
      const s = e.target.closest('[data-ktype]');
      if (!s) return;
      const isEnum = s.value === '枚举定义';
      $('[data-k-md]', pane).hidden = isEnum;
      $('[data-k-enum]', pane).hidden = !isEnum;
      U.clearErrors(pane);
      syncReq(pane);
    });
  }

  /* ── 草稿审批 ── */
  function setDraft(tr, state) {
    const name = tr.dataset.dname;
    tr.querySelector('[data-status]').innerHTML = state === 'approved'
      ? '<span class="dot-status" style="color:var(--flash-success)">已批准</span>'
      : '<span class="dot-status" style="color:var(--flash-error)">已驳回</span>';
    tr.querySelector('[data-ops]').innerHTML = `<span class="link-ops"><a href="javascript:;" data-op="draft-detail" data-dname="${esc(name)}">详情</a></span>`;
  }
  function draftApprove(tr) {
    U.modal({
      title: `批准草稿 · ${tr.dataset.dname}`, width: 480, body: tplHtml('approve'), okText: '批准',
      onOk: () => { setDraft(tr, 'approved'); U.toast('已批准，草稿按类型物化并重建索引'); },
    });
  }
  function draftReject(tr) {
    U.modal({
      title: `驳回草稿 · ${tr.dataset.dname}`, width: 480, body: tplHtml('reject'),
      footer: '<button class="btn" data-fm-cancel>取 消</button><button class="btn danger" data-fm-ok>驳 回</button>',
      onOk: (root) => { if (!U.validate(root)) return false; setDraft(tr, 'rejected'); U.toast('已驳回'); },
    });
  }
  function draftDetail(tr) {
    const c = [...tr.children].map((td) => td.innerHTML);
    U.drawer({
      title: `草稿详情 · ${tr.dataset.dname}`, width: 720, footer: null,
      body: [['类型', c[1]], ['来源', c[2]], ['内容', c[3]], ['目标引用', c[4]], ['理由', c[5]], ['状态', c[6]], ['时间', c[7]]]
        .map(([k, v]) => `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--flash-border)"><span class="muted" style="width:76px;flex:none">${k}</span><span style="flex:1">${v}</span></div>`).join(''),
    });
  }

  /* ── 事件委托 ── */
  const OPS = {
    nav: (el) => { showView(el.dataset.view); setActive(el); },
    back: () => showView('domains'),
    'open-model': (el) => { setActive(el.classList.contains('tree-row') ? el : null); renderDetail(el.dataset.ident); },
    toggle: (el) => {
      const kids = el.nextElementSibling;
      if (!kids || !kids.classList.contains('tree-children')) return;
      kids.hidden = !kids.hidden;
      const caret = el.querySelector('[data-caret]');
      if (caret) caret.textContent = kids.hidden ? '▸' : '▾';
    },
    'add-domain': addDomain,
    'add-model': () => openModelModal(null),
    'edit-model': () => openModelModal(cur()),
    'del-model': () => U.confirm({
      title: `删除模型「${cur().name}」？`,
      content: '将连带删除字段与索引文档，引用此模型的配置会失效。',
      okText: '删除', danger: true,
      onOk: () => { showView('domains'); U.toast(`模型「${cur().name}」已删除`); },
    }),
    'set-domain': setDomain,
    'add-field': () => openFieldModal(null),
    'field-edit': (el) => openFieldModal(el.closest('tr').dataset.ident, el.closest('tr')),
    'field-del': (el) => {
      const tr = el.closest('tr');
      U.popconfirm({
        trigger: el, title: `删除字段 ${tr.dataset.ident}？`, danger: true,
        onOk: () => {
          const d = cur();
          d.fields.splice(d.fields.findIndex((f) => f[0] === tr.dataset.ident), 1);
          tr.remove(); updateFcount(); applyFilter('field');
          U.toast('字段已删除');
        },
      });
    },
    vis: (el) => {
      const tr = el.closest('tr');
      const d = cur();
      const rec = d.fields.find((f) => f[0] === tr.dataset.ident);
      rec[6] = rec[6] ? 0 : 1;
      tr.replaceWith(elOf(fieldRow(rec)));
      U.toast(rec[6] ? '字段已隐藏' : '字段已设为可见');
    },
    'add-fk': openFkModal,
    'fk-del': (el) => U.popconfirm({
      trigger: el, title: '删除该外键声明？', danger: true,
      onOk: () => {
        const d = cur();
        d.fks.splice([...el.closest('tbody').children].indexOf(el.closest('tr')), 1);
        renderFk(detailRoot(), d);
        $('[data-fkcount]').textContent = d.fks.length;
        U.toast('外键声明已删除');
      },
    }),
    'metric-add': () => openMetricDrawer(null),
    'metric-edit': (el) => {
      const tr = el.closest('tr');
      openMetricDrawer({ type: tr.dataset.mtype, ident: tr.dataset.mident, name: tr.dataset.mname });
    },
    'metric-del': (el) => U.popconfirm({
      trigger: el, title: `删除指标 ${el.dataset.mname}？`, content: '删除会影响引用此对象的配置。', danger: true,
      onOk: () => { el.closest('tr').remove(); U.toast(`指标「${el.dataset.mname}」已删除`); },
    }),
    'knowledge-add': openKnowledgeDrawer,
    'knowledge-del': (el) => U.popconfirm({
      trigger: el, title: `删除知识 ${el.dataset.kname}？`, danger: true,
      onOk: () => { el.closest('tr').remove(); applyFilter('knowledge'); U.toast(`知识「${el.dataset.kname}」已删除`); },
    }),
    'draft-approve': (el) => draftApprove(el.closest('tr')),
    'draft-reject': (el) => draftReject(el.closest('tr')),
    'draft-detail': (el) => draftDetail(el.closest('tr')),
    'draft-refresh': () => U.toast('草稿队列已刷新', 'info'),
  };

  document.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-seg] a');
    if (seg) {
      const box = seg.parentElement;
      $$('a', box).forEach((x) => x.classList.toggle('is-active', x === seg));
      F[box.dataset.seg].kind = seg.dataset.kind;
      applyFilter(box.dataset.seg);
      return;
    }
    const dt = e.target.closest('[data-dtab]');
    if (dt) {
      const wrap = dt.closest('[data-dtabs]');
      $$('[data-dtab]', wrap).forEach((x) => x.classList.toggle('is-active', x === dt));
      $$('[data-dpane]', wrap).forEach((p) => { p.hidden = p.dataset.dpane !== dt.dataset.dtab; });
      if (dt.dataset.dtab === 'preview') {
        const pv = wrap.querySelector('[data-k-preview]');
        const ta = wrap.querySelector('[data-k-content]');
        if (pv && ta) pv.innerHTML = ta.value.split('\n').map((l) => `<p style="margin:2px 0">${esc(l) || '&nbsp;'}</p>`).join('');
      }
      return;
    }
    const op = e.target.closest('[data-op]');
    if (!op) return;
    e.preventDefault();
    OPS[op.dataset.op] && OPS[op.dataset.op](op);
  });
})();
