/* 设计期 · 数据库资源管理（DLake）· 二级交互
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「数据库资源管理（DLake）」章节 */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = U.esc;

  /* 本页内联小助手（表单结构交给 FlashUI.validate） */
  const F = (label, ctrl, o = {}) => `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
    <label style="width:120px;flex:none;padding-top:7px"><span class="${o.req ? 'req' : ''}">${label}</span></label>
    <div class="f-ctrl">${ctrl}</div>
    <div class="f-extra">${o.extra || ''}</div>
    <div class="f-err">${o.err || ''}</div>
  </div>`;
  const I = (attrs = {}, value = '', ph = '') =>
    `<input ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} value="${esc(value)}" placeholder="${esc(ph)}">`;
  const SEL = (opts, selected = '') =>
    `<select>${opts.map((o) => `<option ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

  /* 数据库硬件配置：CPU (vC) 0.1-32 / 内存 (G) 0.1-64 / 磁盘 (G) 0.1-1024 */
  const HW = `<div style="display:flex;gap:12px;flex-wrap:wrap">${[['CPU (vC)', '0.1', '32'], ['内存 (G)', '0.1', '64'], ['磁盘 (G)', '0.1', '1024']].map(([l, min, max]) =>
    `<div style="flex:1;min-width:150px">
      <div class="muted" style="margin-bottom:4px">${l}</div>
      <input type="number" min="${min}" max="${max}" step="0.1" placeholder="${min} - ${max}"
        style="width:100%;height:var(--flash-control-height);padding:0 10px;border:1px solid var(--flash-border);border-radius:var(--flash-radius)">
    </div>`).join('')}</div>`;

  function markErr(ctrl, msg) {
    const f = ctrl.closest('.field');
    f.classList.add('has-error');
    const slot = f.querySelector('.f-err');
    if (slot) slot.textContent = msg;
  }

  /* ── 「新增」Popover：申请资源 / 注册资源（说明文案逐字） ── */
  let addPop = null;
  function closeAddPop() {
    if (addPop) { addPop.remove(); addPop = null; document.removeEventListener('click', popOutside); }
  }
  function popOutside(e) {
    if (addPop && !addPop.contains(e.target) && !e.target.closest('[data-op="add"]')) closeAddPop();
  }
  function openAddPop(trigger) {
    closeAddPop();
    addPop = U.el(`<div class="flash-menu" style="min-width:300px;padding:8px">
      <button data-kind="apply" style="padding:8px 10px"><b style="font-weight:500">申请资源</b>
        <div class="muted" style="white-space:normal;margin-top:3px">没有现成数据库，需要平台建库…</div></button>
      <button data-kind="register" style="padding:8px 10px"><b style="font-weight:500">注册资源</b>
        <div class="muted" style="white-space:normal;margin-top:3px">登记外部已开通的数据库，平台不建库、仅纳管连接…</div></button>
    </div>`);
    document.body.appendChild(addPop);
    const rect = trigger.getBoundingClientRect();
    addPop.style.left = Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - addPop.offsetWidth - 8)) + 'px';
    addPop.style.top = rect.bottom + window.scrollY + 4 + 'px';
    addPop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      closeAddPop();
      resModal(b.dataset.kind);
    });
    setTimeout(() => document.addEventListener('click', popOutside), 0);
  }

  /* ── 申请资源 / 注册资源（同构弹窗，注册多访问地址 + 测试连接） ── */
  function resModal(kind) {
    const isReg = kind === 'register';
    const m = U.modal({
      title: isReg ? '注册资源' : '申请资源', width: 660,
      body: `
        <div class="form-section">资源类型</div>
        <div class="type-grid" data-res-type>${['PostgreSQL', 'TimescaleDB', 'MinIO'].map((t, i) =>
          `<div class="type-item${i === 0 ? ' is-active' : ''}" data-type="${t}"><span class="ti-ico">▤</span><span>${t}</span></div>`).join('')}</div>
        <div style="height:6px"></div>
        ${F('资源名称', I({ 'data-req': '1', 'data-err': '请输入资源名称', 'data-max': '64', 'data-errMax': '长度不得超过64！' }, '', '4-64 个字符'), { req: true, err: '请输入资源名称', extra: '长度 4-64 个字符' })}
        ${F('数据库名称', I({ 'data-req': '1', 'data-err': '请输入数据库名称', 'data-dbname': '1' }, '', '如 inj_process'), { req: true, err: '请输入数据库名称', extra: '以小写字母开头，仅包含小写字母、数字、下划线，且不能以特殊字符结尾' })}
        ${isReg ? F('访问地址', I({ 'data-req': '1', 'data-err': '请输入访问地址' }, '', '例如 10.12.4.8:5432'), { req: true, err: '请输入访问地址' }) : ''}
        ${F('描述', I())}
        ${F('独占实例', `<span style="display:inline-flex;align-items:center;gap:10px"><label class="switch"><input type="checkbox"><i></i></label><span class="muted" title="分配root权限用户" style="cursor:help">ⓘ 分配root权限用户</span></span>`)}
        ${F('用户生成方式', SEL(['自动生成用户', '指定用户名密码'], '自动生成用户'))}
        ${F('用户名', I({ 'data-pattern': '^(?!pg_)', 'data-err': '用户名不能以pg_开头' }), { err: '用户名不能以pg_开头' })}
        ${F('密码', I({ type: 'password' }))}
        <div class="form-section">数据库硬件配置</div>
        ${HW}`,
      footer: `${isReg ? '<button class="btn" data-reg-test>测试连接</button>' : ''}<button class="btn" data-fm-cancel>取 消</button><button class="btn primary" data-fm-ok>确 定</button>`,
      onOk: (root) => {
        if (!U.validate(root)) return false;
        const db = $('[data-dbname]', root);
        if (!/^[a-z][a-z0-9_]*$/.test(db.value.trim())) { markErr(db, '以小写字母开头，仅包含小写字母、数字、下划线，且不能以特殊字符结尾'); return false; }
        U.toast('新增成功');
      },
    });
    /* 资源类型卡片选择 */
    $('[data-res-type]', m.root).addEventListener('click', (e) => {
      const it = e.target.closest('.type-item');
      if (!it) return;
      $$('.type-item', m.root).forEach((x) => x.classList.toggle('is-active', x === it));
    });
    /* 测试连接：测试中… → 1s 后测试成功 */
    if (isReg) {
      const tb = $('[data-reg-test]', m.root);
      tb.addEventListener('click', () => {
        if (!U.validate(m.root)) return;
        tb.disabled = true;
        tb.textContent = '测试中…';
        setTimeout(() => { tb.disabled = false; tb.textContent = '测试连接'; U.toast('测试成功'); }, 1000);
      });
    }
  }

  /* ── 行操作 ── */
  function delRes(name, source) {
    U.confirm({
      title: '确认要删除这条信息吗？',
      content: source === '申请资源' ? '删除内部资源，可以在30天内进行恢复，请确认删除' : '删除外部资源后将无法恢复，请确认删除',
      danger: true,
      onOk: () => U.toast(`「${name}」已删除`),
    });
  }
  function purgeRes(name) {
    const m = U.modal({ title: '彻底删除', width: 460,
      body: `<p style="margin:2px 0 12px;color:var(--flash-text-secondary)">将彻底删除该数据库的所有数据，请确认</p>
        ${F('确认输入', I({ 'data-purge': '1' }, '', '请输入 DELETE'), { extra: '输入「DELETE」后方可执行' })}`,
      footer: `<button class="btn" data-fm-cancel>取 消</button><button class="btn danger" data-fm-ok>彻底删除</button>`,
      onOk: (root) => {
        if ($('[data-purge]', root).value.trim() !== 'DELETE') { U.toast('请输入 DELETE 确认', 'warning'); return false; }
        U.toast(`「${name}」已彻底删除`);
      } });
    $('[data-purge]', m.root).focus();
  }
  function detailDrawer(tr, name) {
    const cells = $$('td', tr).map((td) => td.textContent.trim());
    const pairs = [
      ['资源名称', cells[0]], ['状态', cells[1]], ['资源类型', cells[2]], ['数据库名称', cells[3]],
      ['实例名称', cells[4]], ['独占实例', cells[5]], ['资源来源', cells[6]], ['申请方来源', cells[7]],
      ['访问地址', cells[8]], ['描述', cells[9] || '-'], ['创建时间', cells[10]], ['更新时间', cells[11]],
    ];
    U.drawer({ title: `资源详情 - ${name}`, width: 640,
      body: `<dl class="desc">${pairs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
      footer: `<button class="btn" data-fd-cancel>关 闭</button>` });
  }
  function editRes(tr, name) {
    if (tr.dataset.manual !== '1') return U.toast('仅手动开通的资源可编辑', 'warning');
    const addr = $$('td', tr)[8].textContent.trim();
    U.modal({ title: `编辑资源 - ${name}`, width: 560,
      body: `${F('资源名称', I({ value: name, 'data-req': '1', 'data-err': '请输入资源名称' }), { req: true, err: '请输入资源名称' })}
        ${F('访问地址', I({ value: addr, 'data-req': '1', 'data-err': '请输入访问地址' }), { req: true, err: '请输入访问地址' })}
        ${F('描述', I())}`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('保存成功'); } });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op, name = a.dataset.name || '';
    const tr = a.closest('tr');
    const source = tr ? tr.dataset.source : '';
    ({
      add: () => openAddPop(a),
      refresh: () => U.toast('已刷新'),
      detail: () => detailDrawer(tr, name),
      edit: () => editRes(tr, name),
      viewdb: () => U.toast(`正在打开「${name}」数据库管理页…`, 'info'),
      more: (t) => U.dropdown({ trigger: t, items: [
        { label: '慢SQL查询', onClick: () => U.toast(`已打开「${name}」慢SQL查询（示例）`, 'info') },
        { label: '日志', onClick: () => U.toast(`已打开「${name}」运行日志（示例）`, 'info') },
        { label: '数据库开放', onClick: () => U.toast(`已打开「${name}」数据库开放配置（示例）`, 'info') },
        '-',
        { label: '删除', danger: true, onClick: () => delRes(name, source) },
      ] }),
      del: () => delRes(name, source),
      restore: () => U.confirm({
        title: '确认要恢复该数据库吗？',
        content: '数据库保留时间剩余28天6小时，到期后将彻底删除…',
        onOk: () => U.toast(`「${name}」已恢复`),
      }),
      purge: () => purgeRes(name),
    })[op]?.(a);
  });

  /* ── 页签过滤：全部 / 关系 / 非关系 / 时序 / 文件 / 分析型数仓 / 已删除 ── */
  const TAB_IDS = ['all', 'rel', 'nonrel', 'ts', 'file', 'dw', 'deleted'];
  function filterRows(k) {
    let n = 0;
    $$('.flash-table tbody tr[data-kind]').forEach((tr) => {
      const show = k === 'all' ? !tr.dataset.deleted
        : k === 'deleted' ? !!tr.dataset.deleted
          : (tr.dataset.kind === k && !tr.dataset.deleted);
      tr.hidden = !show;
      if (show) n++;
    });
    const c = $('.toolbar .count');
    if (c) c.textContent = `共 ${n} 条 · 示例`;
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.tabs a[data-tab]');
    if (!a || !a.closest('[data-lake-tabs]')) return;
    filterRows(a.dataset.tab);
  });
  /* 支持 #hash 直达页签 */
  const h = location.hash.slice(1);
  if (TAB_IDS.includes(h)) filterRows(h);
})();
