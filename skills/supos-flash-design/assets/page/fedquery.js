/* 设计期 · SQL 联邦查询（服务与订阅管理）· 二级交互
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「SQL 联邦查询」
 * 交互：新建下拉 / 节点右键（编辑·复制·删除）/ 标签页右键 / 修改数据源 / 调试入参+JSON 结果 / 保存。 */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  /* 浏览器端助手（与 l2/helpers.mjs 同名） */
  const field = (label, ctrl, { required = false, err = '', extra = '' } = {}) =>
    `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
      <label style="width:120px;flex:none;padding-top:7px"><span class="${required ? 'req' : ''}">${esc(label)}</span></label>
      <div class="f-ctrl">${ctrl}</div>
      ${extra ? `<div class="f-extra">${esc(extra)}</div>` : ''}
      <div class="f-err">${esc(err)}</div>
    </div>`;
  const input = (attrs = {}, value = '', ph = '') =>
    `<input ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} value="${esc(value)}" placeholder="${esc(ph)}">`;
  const select = (options, attrs = {}, selected = '') =>
    `<select ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>${options.map((o) => `<option ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

  const DOT = { js: 'var(--flash-node-js)', es: 'var(--flash-node-js)', sql: 'var(--flash-collect-doing)', sub: 'var(--flash-node-sub)' };
  const TYPE_LABEL = { js: 'JS服务', es: 'ES模块', sql: 'SQL服务', sub: 'JS订阅任务' };
  const NAME_PAT = '^[A-Za-z_$][A-Za-z0-9_$]*$';
  const NAME_ERR = '名称只能包含字母、数字、_、和 $，且不能以数字开头';

  /* ── 编辑区标签页切换 ── */
  function activateTab(tab) {
    $$('[data-edtab]').forEach((x) => x.classList.toggle('is-active', x === tab));
    const id = tab.dataset.edtab;
    $$('[data-edview]').forEach((v) => { v.style.display = v.dataset.edview === id ? '' : 'none'; });
  }
  function closeTab(tab) {
    const id = tab.dataset.edtab;
    tab.remove();
    const view = $(`[data-edview="${id}"]`);
    if (view) view.remove();
    const rest = $$('[data-edtab]');
    if (!rest.length) {
      const ed = $('[data-editor]');
      if (ed) ed.innerHTML = '<div class="empty" style="min-height:160px"><div class="empty-mark">▤</div><span>暂无打开的标签页</span></div>';
      return;
    }
    if (!rest.some((x) => x.classList.contains('is-active'))) activateTab(rest[0]);
  }

  /* ── 左树：新建节点插入第一个分组 ── */
  function appendNode(type, name, show) {
    const branch = $('[data-branch]');
    if (!branch || !name) return;
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.node = name;
    row.dataset.show = show || name;
    row.dataset.type = type;
    row.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${DOT[type] || DOT.js};flex:none"></span><span title="${U.esc(name)}">${U.esc(show || name)}</span>`;
    branch.appendChild(row);
  }

  /* ── 新建/复制/编辑弹窗（标题＝动作 + 类型；SQL服务含 sql语法/脚本类型） ── */
  function nameField(value) {
    return field('名称', input({ 'data-req': '1', 'data-pattern': NAME_PAT, 'data-err': NAME_ERR }, value), { required: true, err: NAME_ERR });
  }
  function showNameField(value) {
    return field('显示名', input({ 'data-req': '1', 'data-err': '请输入显示名称' }, value), { required: true, err: '请输入显示名称' });
  }
  function openModal(mode, type, row) {
    if (type === 'ns') return nsModal();
    if (type === 'group') return groupModal();
    const label = TYPE_LABEL[type] || type;
    const name = row ? row.dataset.node : '';
    const show = row ? row.dataset.show : '';
    const isCopy = mode === 'copy';
    const title = mode === 'edit' ? `编辑 ${label}` : isCopy ? `复制 ${label}` : `新增 ${label}`;
    U.modal({
      title, width: 520,
      body:
        nameField(isCopy ? `${name}_copy` : name) +
        showNameField(isCopy ? `${show}_copy` : show) +
        field('所属命名空间/分组', input({ disabled: '', style: 'background:var(--flash-bg-page)' }, '生产数据')) +
        (type === 'sql'
          ? field('sql语法', select(['mybatis', 'raw'], {}, 'mybatis')) +
            field('脚本类型', '<select data-req="1" data-err="请选择脚本类型"><option value="">请选择脚本类型</option><option>查询</option><option>存储过程</option></select>', { required: true, err: '请选择脚本类型' })
          : '') +
        field('描述', input({}, '')),
      onOk: (root) => {
        if (!U.validate(root)) return false;
        const vals = [...root.querySelectorAll('.field input:not([disabled])')].map((i) => i.value.trim());
        const nn = vals[0] || name, ss = vals[1] || nn;
        if (mode === 'edit' && row) {
          row.dataset.node = nn; row.dataset.show = ss;
          const span = row.querySelector('span[title]');
          if (span) { span.textContent = ss; span.title = nn; }
          U.toast('保存成功');
        } else {
          appendNode(type, nn, ss);
          U.toast(isCopy ? `已复制为「${ss}」` : '创建成功');
        }
      },
    });
  }
  function nsModal() {
    U.modal({
      title: '创建命名空间', width: 460,
      body: nameField('') + field('描述', input({}, '')),
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('命名空间已创建'); },
    });
  }
  function groupModal() {
    U.modal({
      title: '创建分组', width: 460,
      body:
        field('所属命名空间', input({ disabled: '', style: 'background:var(--flash-bg-page)' }, '默认命名空间')) +
        nameField('') + showNameField('') + field('描述', input({}, '')),
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('分组已创建'); },
    });
  }

  /* ── 节点删除确认：提示 / 确认删除 {showName}？（规格逐字） ── */
  function delNode(row) {
    const show = row.dataset.show || row.dataset.node;
    U.confirm({
      title: '提示', content: `确认删除 ${show}？`, okText: '确 定', danger: true,
      onOk: () => { row.remove(); U.toast(`「${show}」已删除`); },
    });
  }

  /* ── 修改数据源弹窗（数据库来源/类型/数据库 均必填） ── */
  function openDsModal() {
    U.modal({
      title: '修改数据源', width: 520,
      body:
        field('数据库来源', '<select data-req="1" data-err="请选择数据库来源" style="width:100%"><option value="">请选择数据库来源</option><option>数据源注册</option></select>', { required: true, err: '请选择数据库来源' }) +
        field('数据库类型', '<select data-req="1" data-err="请选择数据库类型" style="width:100%"><option value="">请选择数据库类型</option><option>MySQL</option><option>Oracle</option><option>SqlServer</option><option>PostgreSQL</option><option>达梦数据库</option><option>电科金仓</option><option>联邦查询</option></select>', { required: true, err: '请选择数据库类型' }) +
        field('数据库', '<select data-req="1" data-err="请选择数据库" style="width:100%"><option value="">请选择数据库</option><option>精达设备台账库</option><option>注塑机实时库</option><option>时序历史库</option></select>', { required: true, err: '请选择数据库' }),
      onOk: (root) => {
        if (!U.validate(root)) return false;
        const [src, dbType, db] = [...root.querySelectorAll('select')].map((s) => s.value);
        const warn = $('[data-ds-warn]');
        if (warn) warn.style.display = 'none';
        const dot = $('[data-ds-dot]');
        if (dot) dot.style.display = 'none';
        const info = $('[data-ds-info]');
        if (info) { info.style.display = ''; info.textContent = `已配置数据源：${db}（${dbType} · ${src}）`; }
        U.toast('保存成功');
      },
    });
  }

  /* ── 调试：弹窗「调试入参」（开始调试/关闭）→ 底部「调试信息」输出 JSON ── */
  function openDebug() {
    U.modal({
      title: '调试入参', width: 520,
      body:
        field('startTime', input({ 'data-req': '1', 'data-err': '请输入 startTime' }, '2026-11-01 00:00:00'), { required: true, err: '请输入 startTime' }) +
        field('endTime', input({}, '2026-11-10 00:00:00')) +
        field('dept', input({}, '')),
      footer: '<button class="btn" data-fm-cancel>关闭</button><button class="btn primary" data-fm-ok>开始调试</button>',
      onOk: () => { runDebug(); },
    });
  }
  function runDebug() {
    const empty = $('[data-dbg-empty]');
    if (empty) empty.style.display = 'none';
    const res = $('[data-dbg-result]');
    if (res) {
      res.style.display = '';
      res.textContent = JSON.stringify([
        { order_no: 'MO-2026-1108-001', qty: 126 },
        { order_no: 'MO-2026-1108-002', qty: 87 },
        { order_no: 'MO-2026-1109-001', qty: 240 },
      ], null, 2);
    }
    const dbgTab = $('.tabs a[data-tab="dbg"]');
    if (dbgTab) dbgTab.click();
    U.toast('调试完成');
  }

  /* ── 事件委托（click） ── */
  document.addEventListener('click', (e) => {
    const edtab = e.target.closest('[data-edtab]');
    if (edtab) { e.preventDefault(); activateTab(edtab); return; }
    const nrow = e.target.closest('.tree-row[data-node]');
    if (nrow) {
      $$('.tree-row.is-active').forEach((r) => r.classList.remove('is-active'));
      nrow.classList.add('is-active');
    }
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op;
    if (op === 'new-menu') {
      U.dropdown({ trigger: a, items: [
        { label: 'JS服务', onClick: () => openModal('new', 'js') },
        { label: 'ES模块', onClick: () => openModal('new', 'es') },
        { label: 'SQL服务', onClick: () => openModal('new', 'sql') },
        { label: 'JS订阅任务', onClick: () => openModal('new', 'sub') },
        { label: '创建命名空间', onClick: () => openModal('new', 'ns') },
        { label: '创建分组', onClick: () => openModal('new', 'group') },
      ] });
    }
    if (op === 'tg') { const b = a.nextElementSibling; if (b) b.hidden = !b.hidden; }
    if (op === 'ed') U.toast(`已执行「${a.dataset.label}」（示例）`, 'info');
    if (op === 'ds-modal') openDsModal();
    if (op === 'debug') openDebug();
    if (op === 'save') U.toast('保存成功');
    if (op === 'p-edit') U.toast('参数已更新');
    if (op === 'p-del') { const tr = a.closest('tr'); if (tr) tr.remove(); U.toast('参数已删除'); }
  });

  /* ── 右键：标签页（重新加载/关闭…）与树节点（编辑/复制/删除） ── */
  document.addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('[data-edtab]');
    if (tab) {
      e.preventDefault();
      U.dropdown({ trigger: tab, items: [
        { label: '重新加载', onClick: () => U.confirm({ title: '提示', content: '未保存的更改将会丢失。', onOk: () => U.toast('标签页已重新加载', 'info') }) },
        { label: '关闭标签页', onClick: () => closeTab(tab) },
        { label: '关闭其他标签页', onClick: () => $$('[data-edtab]').forEach((x) => { if (x !== tab) closeTab(x); }) },
        { label: '关闭全部标签页', onClick: () => $$('[data-edtab]').slice().forEach((x) => closeTab(x)) },
      ] });
      return;
    }
    const row = e.target.closest('.tree-row[data-node]');
    if (row) {
      e.preventDefault();
      U.dropdown({ trigger: row, items: [
        { label: '编辑', onClick: () => openModal('edit', row.dataset.type, row) },
        { label: '复制', onClick: () => openModal('copy', row.dataset.type, row) },
        { label: '删除', danger: true, onClick: () => delNode(row) },
      ] });
    }
  });

  /* ── 左树搜索过滤 ── */
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-tree-search]')) return;
    const q = e.target.value.trim().toLowerCase();
    $$('.tree-row[data-node]').forEach((r) => {
      const hit = !q || `${r.dataset.show}${r.dataset.node}`.toLowerCase().includes(q);
      r.style.display = hit ? '' : 'none';
    });
  });
})();
