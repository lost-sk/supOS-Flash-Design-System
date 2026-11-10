/* 设计期 · 数据源注册 · 二级交互（规格：.cache/flash-l2-specs/01-datasource-connect.md） */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  /* 与 l2/helpers.mjs 同名的浏览器端助手（页面脚本无法 import ESM） */
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
  const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;
  const table = (heads, rows) => `<div class="table-wrap"><table class="flash-table"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op, name = a.dataset.name || '';
    ({
      add: openWizard, edit: () => openEdit(name), copy: () => U.toast(`已复制为「${name}_copy」`),
      del: () => delOne(name), 'batch-del': batchDel, test: testConnect, 'add-cat': addCat,
      more: (t) => U.dropdown({ trigger: t, items: [
        { label: '日志', onClick: () => U.toast(`已打开「${name}」连接日志`, 'info') },
        { label: '访问页面', onClick: () => U.toast(`正在打开「${name}」访问页面…`, 'info') },
        { label: '元数据采集', onClick: openCollect },
      ] }),
      collect: openCollect,
    })[op]?.(a);
  });

  /* 批量选择 */
  document.addEventListener('change', (e) => {
    if (e.target.matches('.flash-table tbody input[type=checkbox]')) {
      const n = $$('.flash-table tbody input:checked').length;
      if (n === 0 && !e.target.checked) return;
    }
  });

  function checkedNames() {
    return $$('.flash-table tbody tr').filter((tr) => tr.querySelector('input:checked'))
      .map((tr) => tr.children[1].textContent.trim());
  }

  /* 删除确认：源码文案逐字 */
  function delOne(name) {
    U.confirm({
      title: `确定要删除"${name}"吗？`,
      content: '请注意评估数据源的业务影响范围，本操作无法撤销。',
      okText: '确 定', danger: true,
      onOk: () => U.toast(`「${name}」已删除`),
    });
  }
  function batchDel() {
    const names = checkedNames();
    if (!names.length) return U.toast('请先勾选要删除的数据源', 'warning');
    U.confirm({ title: '删除', content: '确定删除(已引用的数据源不可删除)', okText: '确 定', danger: true, onOk: () => U.toast(`已删除 ${names.length} 个数据源`) });
  }
  function testConnect() {
    const names = checkedNames();
    if (!names.length) return U.toast('请选择要测试连接的数据源', 'warning');
    U.toast(`已对 ${names.length} 个数据源发起连通性测试`);
  }
  function addCat() {
    const m = U.modal({
      title: '新增业务分类', width: 420,
      body: `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:64px;flex:none;padding-top:7px"><span class="req">名称</span></label>
          <div class="f-ctrl"><input maxlength="50" placeholder="请输入名称" data-req="1" data-err="名称不能为空！"
            data-pattern="^[\\u4e00-\\u9fa5A-Za-z0-9_]{1,50}$" data-errmax="支持中文、字母、数字、&quot;_&quot;字符类型输入，最长50字符"></div>
          <div class="f-err">名称不能为空！</div>
        </div>`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('分类已新增'); },
    });
    const ipt = $('input', m.root); if (ipt) ipt.focus();
  }

  /* ── 新增：数据源注册向导（SourceGallery 实证：右侧竖向 Steps + Anchor 分组） ── */
  const GROUPS = [
    ['IIoT采集设备', ['OPC UA', 'Modbus TCP', 'Node-RED', 'IoT网关', 'MQTT 网关', '时序数据采集器']],
    ['数据库', ['MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', '达梦数据库', '电科金仓']],
    ['业务系统', ['REST API', 'WebSocket API', '金蝶 K3', 'SAP']],
    ['存储服务', ['TimescaleDB（内置）', 'MinIO（内置）', '联邦查询（内置）']],
  ];
  function openWizard() {
    let step = 1, picked = '';
    const m = U.modal({
      title: '数据源注册向导', width: 920, footer: null,
      body: `<div style="display:grid;grid-template-columns:170px 1fr;gap:20px">
          <div class="steps" data-wiz-steps>
            <div class="step is-current"><span class="s-dot">1</span><div><div class="s-title">选择数据源</div><div class="s-desc">请选择需要接入的数据源类型</div></div></div>
            <div class="step"><span class="s-dot">2</span><div><div class="s-title">配置并确认连接信息</div><div class="s-desc">填写连接参数并测试连通性</div></div></div>
          </div>
          <div data-wiz-body></div>
        </div>`,
    });
    const bodyEl = $('[data-wiz-body]', m.root);
    function step1() {
      step = 1; picked = '';
      bodyEl.innerHTML = GROUPS.map(([g, items]) =>
        `<div class="anchor-group">${esc(g)}</div><div class="type-grid">${items.map((it) =>
          `<div class="type-item" data-type="${esc(it)}"><span class="ti-ico">▤</span><span>${esc(it)}</span>${it.includes('内置') ? '<span class="ti-badge">内置</span>' : ''}</div>`).join('')}</div>`).join('') +
        `<div class="btn-row" style="margin-top:16px;justify-content:flex-end">
          <button class="btn" data-wiz-cancel>取消</button>
          <button class="btn primary" data-wiz-next disabled>下一步</button></div>`;
      bodyEl.addEventListener('click', (e) => {
        const it = e.target.closest('.type-item');
        if (it) {
          $$('.type-item.is-active', bodyEl).forEach((x) => x.classList.remove('is-active'));
          it.classList.add('is-active'); picked = it.dataset.type;
          $('[data-wiz-next]', bodyEl).disabled = false;
        }
        if (e.target.closest('[data-wiz-next]') && picked) step2();
        if (e.target.closest('[data-wiz-cancel]')) m.close();
      });
    }
    function step2() {
      step = 2;
      $$('.step', m.root).forEach((s, i) => s.classList.toggle('is-current', i === 1), );
      $$('.step', m.root)[0].classList.remove('is-current');
      $$('.step', m.root)[0].classList.add('is-finish');
      $$('.step', m.root)[1].classList.add('is-current');
      bodyEl.innerHTML = `
        <div class="form-section">1. 基本信息</div>
        ${field('别名', input({ 'data-req': '1', 'data-err': '别名不能为空', maxlength: '50' }), { required: true, err: '别名不能为空' })}
        ${field('显示名称', input({ 'data-req': '1', 'data-err': '请输入显示名称', 'data-max': '128', 'data-errMax': '名称长度不得超过128！' }), { required: true, err: '请输入显示名称' })}
        ${field('描述', input({ 'data-max': '255', 'data-errMax': '名称长度不得超过255！' }), { err: '名称长度不得超过255！' })}
        ${field('业务分类', select(['IIoT采集设备', '数据库', '业务系统', '存储服务']))}
        <div class="form-section">2. 连接信息</div>
        ${field('连接地址', input({ 'data-req': '1', 'data-err': '请输入连接地址' }, '', `例如 ${picked.includes('OPC') ? 'opc.tcp://opc.example.com:4840' : 'pg.example.com:5432'}`), { required: true, err: '请输入连接地址' })}
        ${field('用户名', input())}
        ${field('密码', input({ type: 'password' }))}
        <div class="btn-row" style="margin-top:14px;justify-content:space-between">
          <button class="btn" data-wiz-back>返回上一步</button>
          <div class="btn-row">
            <button class="btn" data-wiz-cancel>取消</button>
            <button class="btn" data-wiz-test>连接测试</button>
            <button class="btn" data-wiz-keep>确认，继续新增</button>
            <button class="btn primary" data-wiz-ok>确认</button>
          </div>
        </div>`;
      bodyEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-wiz-back]')) { resetSteps(); step1(); }
        if (e.target.closest('[data-wiz-cancel]')) m.close();
        if (e.target.closest('[data-wiz-test]')) {
          if (!U.validate(bodyEl)) return;
          U.toast('连接测试通过', 'success');
        }
        if (e.target.closest('[data-wiz-keep]')) {
          if (!U.validate(bodyEl)) return;
          U.toast('已保存，可继续新增下一个数据源');
          step1();
        }
        if (e.target.closest('[data-wiz-ok]')) {
          if (!U.validate(bodyEl)) return;
          m.close(); U.toast('新增成功');
        }
      }, { once: false });
    }
    function resetSteps() {
      $$('.step', m.root).forEach((s, i) => { s.classList.remove('is-current', 'is-finish'); if (i === 0) s.classList.add('is-current'); });
    }
    step1();
  }

  /* ── 编辑弹窗：`${typeName}配置`，分区 基本信息/连接信息（SourceForm 实证） ── */
  function openEdit(name) {
    const typeName = 'MySQL';
    U.modal({
      title: `${typeName}配置`, width: 860,
      body: `
        <div class="form-section">1. 基本信息</div>
        ${field('别名', input({ value: 'jinda_mes', disabled: '' }), { required: true, extra: '编辑时不可修改' })}
        ${field('显示名称', input({ value: esc(name), 'data-req': '1', 'data-err': '请输入显示名称', 'data-max': '128', 'data-errMax': '名称长度不得超过128！' }), { required: true, err: '请输入显示名称' })}
        ${field('描述', input({ value: '设备台账与维修记录', 'data-max': '255', 'data-errMax': '名称长度不得超过255！' }), { err: '名称长度不得超过255！' })}
        ${field('业务分类', select(['业务系统', 'IIoT采集设备', '数据库', '存储服务'], {}, '业务系统'))}
        <div class="form-section">2. 连接信息</div>
        ${field('连接地址', input({ value: 'db.example.com:3306', 'data-req': '1', 'data-err': '请输入连接地址' }), { required: true, err: '请输入连接地址' })}
        ${field('用户名', input({ value: 'readonly' }))}
        ${field('密码', input({ type: 'password', value: '........' }))}`,
      footer: `<button class="btn" data-fm-cancel>取 消</button><button class="btn" data-op-x="test">连接测试</button><button class="btn primary" data-fm-ok>确 定</button>`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('保存成功'); },
    });
    /* 弹窗内「连接测试」 */
    document.addEventListener('click', function once(e) {
      const t = e.target.closest('[data-op-x="test"]');
      if (t) { const root = t.closest('.flash-modal'); if (!U.validate(root)) return; U.toast('连接测试通过'); }
      document.removeEventListener('click', once);
    });
  }

  /* ── 元数据采集抽屉（CommonDrawer 宽960 实证） ── */
  function openCollect() {
    U.drawer({
      title: '元数据采集', width: 960,
      body: `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span class="muted">仅支持关系库、时序库的元数据采集计划</span>
          <span class="spacer" style="flex:1"></span>
          <button class="btn sm primary" data-cp-add>＋ 新增 采集计划</button>
          <button class="btn sm">刷新</button>
        </div>
        ${table(['数据源名称', '数据源类型', '最近采集状态', '最近采集时间', '采集周期', '调度状态', '操作'], [
          ['精达设备台账库', 'MySQL', tag('成功', 'ok'), '2026-11-09 02:00', '每天 02:00', tag('启用', 'ok'),
            '<a href="#" data-cp="run">立即采集</a> <a href="#" data-cp="toggle">停用</a> <a href="#" data-cp="history">历史记录</a>'],
          ['注塑机实时库', 'PostgreSQL', tag('失败', 'err'), '2026-11-09 02:00', '每周一 02:00', tag('启用', 'ok'),
            '<a href="#" data-cp="run">立即采集</a> <a href="#" data-cp="toggle">停用</a> <a href="#" data-cp="history">历史记录</a>'],
          ['时序历史库', 'TimescaleDB', tag('采集中', 'info'), '2026-11-10 02:00', '每小时', tag('启用', 'ok'),
            '<a href="#" style="color:var(--flash-text-muted)">采集中</a> <a href="#" data-cp="history">历史记录</a>'],
        ])}`,
      footer: null,
    });
    document.addEventListener('click', function once(e) {
      const t = e.target.closest('[data-cp]');
      if (!t) return;
      const k = t.dataset.cp;
      if (k === 'run') U.toast('采集任务已发起');
      if (k === 'toggle') U.toast('调度状态已更新');
      if (k === 'history') U.toast('已打开采集历史（示例）', 'info');
      if (k === 'add') collectPlanModal();
      document.removeEventListener('click', once);
    });
  }
  function collectPlanModal() {
    U.modal({
      title: '新增 采集计划', width: 560,
      body: `
        ${field('数据源类型', select(['MySQL', 'PostgreSQL', 'TimescaleDB'], { 'data-req': '1', 'data-err': '请选择数据源类型' }), { required: true, err: '请选择数据源类型' })}
        ${field('数据源', select(['精达设备台账库', '注塑机实时库', '时序历史库'], { 'data-req': '1', 'data-err': '请选择数据源' }), { required: true, err: '请选择数据源', extra: '若没有相关的数据源，请在数据源注册中添加' })}
        ${field('采集周期', select(['每小时', '每天', '每周', '每月']))}
        ${field('采集策略', select(['全量', '部分']))}
        ${field('描述', input())}`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('采集计划已新增'); },
    });
  }
})();
