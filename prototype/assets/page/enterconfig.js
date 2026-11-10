/* 设计期 · 系统设置 · 企业运营配置 · 二级交互（规格：.cache/flash-l2-specs/06-sysconfig-org.md） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* 与 l2/helpers.mjs 同构的运行时小件（页面脚本无法 import mjs，抽屉/弹窗模板用） */
  const field = (label, ctrl, { required = false, err = '', extra = '' } = {}) =>
    `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
      <label style="width:120px;flex:none;padding-top:7px"><span class="${required ? 'req' : ''}">${U.esc(label)}</span></label>
      <div class="f-ctrl">${ctrl}</div>
      ${extra ? `<div class="f-extra">${extra}</div>` : ''}
      <div class="f-err">${U.esc(err)}</div>
    </div>`;
  const input = (attrs = {}, value = '', ph = '') =>
    `<input ${Object.entries(attrs).map(([k, v]) => `${k}="${U.esc(v)}"`).join(' ')} value="${U.esc(value)}" placeholder="${U.esc(ph)}">`;
  const select = (options, attrs = {}, selected = '') =>
    `<select ${Object.entries(attrs).map(([k, v]) => `${k}="${U.esc(v)}"`).join(' ')}>${options.map((o) => `<option ${o === selected ? 'selected' : ''}>${U.esc(o)}</option>`).join('')}</select>`;
  const table = (heads, rows) =>
    `<div class="table-wrap"><table class="flash-table"><thead><tr>${heads.map((h) => `<th>${U.esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const note = (t, warn = false) => `<div class="note ${warn ? 'warn' : ''}">${t}</div>`;
  const link = (op, t, name, danger = false) =>
    `<a href="#" ${danger ? 'class="danger" ' : ''}data-op="${op}" data-name="${U.esc(name)}">${t}</a>`;

  /* ── 校验：data-req/data-err/data-max 交给 FlashUI.validate；data-pattern 独立先查（错误文案 data-errp） ── */
  function validateAll(scope) {
    let patBad = false;
    $$('.field', scope).forEach((f) => {
      const ctrl = f.querySelector('input, select, textarea');
      if (!ctrl || !ctrl.dataset.pattern) return;
      const v = (ctrl.value || '').trim();
      if (v && !new RegExp(ctrl.dataset.pattern).test(v)) {
        f.classList.add('has-error');
        const slot = f.querySelector('.f-err');
        if (slot) slot.textContent = ctrl.dataset.errp || ctrl.dataset.err || '格式不正确';
        patBad = true;
      }
    });
    if (patBad) return false;
    return U.validate(scope);
  }
  function fieldError(f, msg) {
    if (typeof f === 'string') f = $(f);
    if (!f) return;
    f.classList.add('has-error');
    const s = f.querySelector('.f-err');
    if (s) s.textContent = msg;
  }

  /* ── 页签切换（data-tabgrp 内局部作用：主页签 / 抽屉与弹窗内页签共用） ── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tabs a[data-tab]');
    if (!t) return;
    const grp = t.closest('[data-tabgrp]');
    if (!grp) return;
    e.preventDefault();
    $$('.tabs a[data-tab]', grp).forEach((x) => x.classList.toggle('is-active', x === t));
    $$('[data-section]', grp).forEach((p) => { p.hidden = p.dataset.section !== t.dataset.tab; });
  });

  /* ── 表格行状态 ── */
  const ST = {
    1: '<span class="dot-status" style="color:var(--flash-status-running)">启用</span>',
    0: '<span class="dot-status" style="color:var(--flash-error)">停用</span>',
  };
  const userOpsHtml = (name, on, isAdmin) => (on
    ? `<span class="link-ops">${link('u-edit', '编辑', name)}${link('u-pwd', '修改密码', name)}${isAdmin ? '<span class="muted">停用</span>' : link('u-disable', '停用', name)}</span>`
    : `<span class="link-ops">${link('u-enable', '启用', name)}${link('u-del', '删除', name, true)}</span>`);
  function setUserState(tr, on) {
    tr.dataset.state = on ? '1' : '0';
    const st = tr.querySelector('[data-stcell]');
    if (st) st.innerHTML = ST[on ? 1 : 0];
    const oc = tr.querySelector('[data-opscell]');
    if (oc) oc.innerHTML = userOpsHtml(tr.dataset.uname || '', on, tr.dataset.admin === '1');
  }
  const checkedRows = (sel) => $$(sel).filter((tr) => tr.querySelector('input[type=checkbox]:checked'));

  /* ── 用户：新增/编辑抽屉（宽800，仅服务账户 + 基本信息 + 角色关联/继承角色） ── */
  function openUserDrawer(row, isEdit) {
    const name = row ? row.dataset.uname : '';
    const admin = row ? row.dataset.admin === '1' : false;
    const svc = row ? row.dataset.type === '服务账户' : false;
    U.drawer({
      title: isEdit ? '编辑用户' : '新增用户', width: 800,
      footer: `<button class="btn" data-fd-cancel>取 消</button>${isEdit ? '' : '<button class="btn" data-uc-keep>确定,继续新增</button>'}<button class="btn primary" data-fd-ok>确 定</button>`,
      body: `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px">
          <label class="switch"><input type="checkbox" data-svc-switch${svc ? ' checked' : ''}><i></i></label>
          <div>
            <b style="font-size:13px;color:var(--flash-text-strong)">仅服务账户</b>
            <div class="muted" style="margin-top:2px">创建仅凭证访问的机器身份，用于 API 调用与系统集成；无页面登录，不受登录锁定策略影响。</div>
          </div>
        </div>
        <div class="form-section">1. 基本信息</div>
        <div data-user-normal${svc ? ' hidden' : ''}>
          ${field('用户名称', input(Object.assign({
            'data-req': '1', 'data-err': '请输入用户名称',
            'data-pattern': '^[\\u4e00-\\u9fa5A-Za-z0-9*()\\-_.]+$',
            'data-errp': '用户名称支持字母、数字、中文和特殊符号 *()-_.',
          }, isEdit && admin ? { value: name, disabled: '' } : isEdit ? { value: name } : {})), { required: true, err: '请输入用户名称' })}
          ${field('用户类型', select(['普通用户', '管理员'], isEdit ? { disabled: '' } : {}, admin ? '管理员' : '普通用户'))}
          ${field('别名', input())}
          ${isEdit ? '' : field('密码', input({ type: 'password', 'data-req': '1', 'data-err': '请输入密码' }), { required: true, err: '请输入密码' })}
          ${field('邮箱', input({ 'data-pattern': '^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$', 'data-errp': '邮箱格式不正确' }), { err: '邮箱格式不正确' })}
          ${field('手机号', input({ 'data-pattern': '^1[3-9]\\d{9}$', 'data-errp': '请输入有效的手机号码' }), { err: '请输入有效的手机号码' })}
          ${field('描述', '<textarea maxlength="511" rows="2" data-max="511"></textarea>')}
        </div>
        <div data-user-svc${svc ? '' : ' hidden'}>
          ${field('用户名称', input({ 'data-req': '1', 'data-err': '请输入用户名称' }), { required: true, err: '请输入用户名称' })}
          ${field('凭证类型', select(['APP key', 'AKSK']))}
          ${field('描述', '<textarea maxlength="511" rows="2"></textarea>')}
        </div>
        <div data-tabgrp style="margin-top:4px">
          <div class="tabs"><a href="#" data-tab="u-roles" class="is-active">角色关联</a><a href="#" data-tab="u-inherit">继承角色</a></div>
          <div data-section="u-roles">
            <div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn sm" data-op="role-batch-add">批量添加</button></div>
            <div data-uroles-table>
              ${table(['角色编号', '角色名称', '角色描述', '操作'], [
                ['ROLE_PROCESS', '工艺工程师', '工艺参数与生产工单维护', link('rrole-del', '删除', 'ROLE_PROCESS', true)],
                ['ROLE_DEVICE', '设备工程师', '设备台账与维修工单', link('rrole-del', '删除', 'ROLE_DEVICE', true)],
              ])}
            </div>
          </div>
          <div data-section="u-inherit" hidden>
            ${table(['角色编号', '角色名称', '角色描述', '来源类型', '来源编号', '来源名称'], [
              ['ROLE_BASE', '基础角色', '平台默认只读权限', '部门继承', 'DEP_PROD', '生产部'],
            ])}
          </div>
        </div>`,
      onOk: (root) => {
        if (!validateFields(root)) return false;
        U.toast(isEdit ? '保存成功' : '新增成功');
      },
    });
  }
  function validateFields(root) {
    const svc = $('[data-svc-switch]', root).checked;
    return validateAll(svc ? $('[data-user-svc]', root) : $('[data-user-normal]', root));
  }

  /* ── 用户：修改密码（宽620，两次输入一致性校验） ── */
  function openPwdModal(name) {
    U.modal({
      title: '修改密码', width: 620,
      body: `${field('用户名称', input({ value: name, disabled: '' }))}
        ${field('新密码', input({ type: 'password', 'data-req': '1', 'data-err': '请输入新密码' }), { required: true, err: '请输入新密码' })}
        ${field('确认密码', input({ type: 'password', 'data-req': '1', 'data-err': '请再次输入新密码', 'data-cpwd': '1' }), { required: true, err: '请再次输入新密码' })}
        ${note('修改密码后，在线用户将被强制退出', true)}`,
      onOk: (root) => {
        if (!validateAll(root)) return false;
        const p1 = $('input[data-cpwd]', root);
        const p0 = $('input[type=password]:not([data-cpwd])', root);
        if (p0.value !== p1.value) return fieldError(p1.closest('.field'), '两次输入的密码不一致');
        U.toast('密码已修改');
      },
    });
  }

  /* ── 角色：新增/编辑弹窗（宽620；新增底部「确定,继续新增」） ── */
  const roleCodeField = (code, disabled) => field('角色编号', input(Object.assign({
    'data-req': '1', 'data-err': '请输角色编码',
    'data-pattern': '^[A-Za-z0-9_]+$', 'data-errp': '角色编码仅支持英文、数字、下划线',
    'data-max': '64', 'data-errMax': '角色编码长度在1-64之间', maxlength: '64',
  }, disabled ? { value: code, disabled: '' } : code ? { value: code } : {})), { required: true, err: '请输角色编码' });
  function openRoleModal(row, isEdit) {
    const code = row ? row.children[2].textContent.trim() : '';
    const name = row ? row.children[3].textContent.trim() : '';
    U.modal({
      title: isEdit ? '编辑角色' : '新增角色', width: 620,
      body: `${roleCodeField(code, isEdit)}
        ${field('角色名称', input(Object.assign({ 'data-req': '1', 'data-err': '请输角色名称', maxlength: '32' }, isEdit ? { value: name } : {})), { required: true, err: '请输角色名称' })}
        ${field('描述', input({ maxlength: '255', 'data-max': '255' }))}`,
      footer: isEdit
        ? `<button class="btn" data-fm-cancel>取 消</button><button class="btn primary" data-fm-ok>确 定</button>`
        : `<button class="btn" data-fm-cancel>取 消</button><button class="btn primary" data-role-keep>确定,继续新增</button>`,
      onOk: (root) => { if (!validateAll(root)) return false; U.toast(isEdit ? '编辑成功' : '新增成功'); },
    });
  }

  /* ── 角色：复制弹窗（编号默认 {code}_copy，复制范围勾选） ── */
  function openCopyModal(row) {
    const code = row.children[2].textContent.trim();
    const name = row.children[3].textContent.trim();
    U.modal({
      title: '复制角色', width: 620,
      body: `${roleCodeField(`${code}_copy`, false)}
        ${field('角色名称', input({ value: name, 'data-req': '1', 'data-err': '请输角色名称', maxlength: '32' }), { required: true, err: '请输角色名称' })}
        <div class="field" style="align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>复制范围</span></label>
          <div class="f-ctrl" style="display:flex;gap:16px;flex-wrap:wrap;padding-top:6px">
            <label style="width:auto"><input type="checkbox" checked> 复制角色功能权限</label>
            <label style="width:auto"><input type="checkbox" checked> 复制角色数据权限</label>
          </div>
        </div>`,
      onOk: (root) => { if (!validateAll(root)) return false; U.toast('复制成功'); },
    });
  }

  /* ── 角色：权限设置抽屉（Tabs 功能权限/数据权限/OpenAPI；内置角色隐藏 OpenAPI） ── */
  function openPermDrawer(row) {
    const name = row.querySelector('[data-rname]').textContent.trim();
    const built = row.dataset.built === '1';
    const treeRow = (t, c) => `<div class="tree-row" data-check><input type="checkbox"${c ? ' checked' : ''}> ${U.esc(t)}</div>`;
    const funcTree = `<div class="tree" data-perm-tree>
      ${treeRow('数据平台', 1)}
      <div class="tree-children">${treeRow('数据源注册', 1)}${treeRow('数据接入服务', 1)}${treeRow('SQL 联邦查询', 1)}${treeRow('OpenAPI 开放', 0)}</div>
      ${treeRow('AI 与工具', 1)}
      <div class="tree-children">${treeRow('Copilot', 1)}${treeRow('知识库', 1)}${treeRow('大模型网关', 0)}${treeRow('Agent', 0)}</div>
      ${treeRow('APP 管理', 1)}
      <div class="tree-children">${treeRow('APP 运行管理', 1)}${treeRow('APP 综合设计工具', 0)}${treeRow('应用商店', 0)}</div>
      ${treeRow('系统设置', 1)}
      <div class="tree-children">${treeRow('基础配置', 1)}${treeRow('企业运营配置', 0)}</div>
    </div>`;
    U.drawer({
      title: `"${name}"权限设置`, width: 720,
      footer: `<button class="btn" data-fd-cancel>取 消</button><button class="btn primary" data-fd-ok>确 定</button>`,
      body: `${built ? note('内置角色隐藏 OpenAPI 页签。') : ''}
        <div data-tabgrp>
          <div class="tabs"><a href="#" data-tab="p-func" class="is-active">功能权限</a><a href="#" data-tab="p-data">数据权限</a>${built ? '' : '<a href="#" data-tab="p-api">OpenAPI</a>'}</div>
          <div data-section="p-func">${funcTree}</div>
          <div data-section="p-data" hidden>
            ${table(['资源类型', '资源', '权限'], [
              ['UNS 目录', '注塑车间', '<span class="tag info">查看、订阅</span>'],
              ['数据源', '精达设备台账库', '<span class="tag info">查看、查询</span>'],
            ])}
          </div>
          <div data-section="p-api" hidden>
            ${table(['API 名称', '方法', '授权'], [
              ['设备实时数据查询', 'GET', '<span class="tag ok">已授权</span>'],
              ['设备历史数据查询', 'GET', '<span class="tag ok">已授权</span>'],
            ])}
          </div>
        </div>`,
      onOk: () => U.toast('权限已保存'),
    });
  }

  /* ── 角色：关联用户弹窗（Tabs 关联用户/关联部门/关联岗位） ── */
  function openRoleUsersModal(row) {
    const name = row.querySelector('[data-rname]').textContent.trim();
    U.modal({
      title: `角色管理"${name}"`, width: 720,
      body: `<div data-tabgrp>
          <div class="tabs"><a href="#" data-tab="ru-users" class="is-active">关联用户</a><a href="#" data-tab="ru-dept">关联部门</a><a href="#" data-tab="ru-post">关联岗位</a></div>
          <div data-section="ru-users">
            ${table(['序号', '用户名称', '别名', '描述', '操作'], [
              ['1', 'shaokun', '阿坤', '工艺工程师', link('ru-untie', '解除', 'shaokun', true)],
              ['2', 'zhangwei', '老张', '设备维护工程师', link('ru-untie', '解除', 'zhangwei', true)],
            ])}
          </div>
          <div data-section="ru-dept" hidden>
            ${table(['序号', '部门编号', '部门名称', '描述'], [
              ['1', 'DEP_PROD', '生产部', '生产运行部门'],
              ['2', 'DEP_QUALITY', '质检部', '质量检验部门'],
            ])}
          </div>
          <div data-section="ru-post" hidden>
            ${table(['序号', '岗位编号', '岗位名称', '描述', '部门信息'], [
              ['1', 'POST_OP', '操作岗', '车间操作', '生产部'],
            ])}
          </div>
        </div>`,
      footer: `<button class="btn" data-fm-cancel>取 消</button>`,
    });
  }

  /* ── 用户抽屉：批量添加角色（简化选择弹窗） ── */
  function pickRoles(trigger) {
    const drawer = trigger.closest('.flash-drawer');
    U.modal({
      title: '选择角色', width: 640,
      body: table(['', '角色编号', '角色名称', '角色描述'], [
        ['<input type="checkbox" aria-label="选择质检员">', 'ROLE_QUALITY', '质检员', '质检记录与追溯'],
        ['<input type="checkbox" aria-label="选择能源管理">', 'ROLE_ENERGY', '能源管理', '能耗看板与报表'],
        ['<input type="checkbox" aria-label="选择仓储管理">', 'ROLE_WAREHOUSE', '仓储管理', '出入库与库存'],
      ]),
      onOk: (mroot) => {
        const picked = $$('tbody input:checked', mroot).map((c) => {
          const tds = c.closest('tr').children;
          return [tds[1].textContent.trim(), tds[2].textContent.trim()];
        });
        if (!picked.length) { U.toast('请选择至少一个角色', 'warning'); return false; }
        const tb = $('[data-uroles-table] tbody', drawer);
        picked.forEach(([code, nm]) => tb.insertAdjacentHTML('beforeend',
          `<tr><td><span class="mono">${U.esc(code)}</span></td><td><span data-rname>${U.esc(nm)}</span></td><td class="muted">—</td><td>${link('rrole-del', '删除', code, true)}</td></tr>`));
        U.toast('已添加角色');
      },
    });
  }

  /* ── 事件委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (a) {
      e.preventDefault();
      const op = a.dataset.op, name = a.dataset.name || '';
      const tr = a.closest('tr');
      ({
        'user-add': () => openUserDrawer(null, false),
        'user-import': () => U.toast('已打开用户导入（示例）', 'info'),
        'user-export': () => U.toast('已导出用户列表（示例）'),
        'user-tpl': () => U.toast('模板已下载（示例）'),
        'user-setting': () => U.toast('已打开列设置（示例）', 'info'),
        'user-log': () => U.toast('已打开登录日志（示例）', 'info'),
        'user-batch-del': () => {
          const rows = checkedRows('[data-user-table] tbody tr');
          if (!rows.length) return U.toast('请先选择要删除的用户', 'warning');
          U.confirm({
            title: '确认要删除所选用户吗？', danger: true,
            onOk: () => { rows.forEach((r) => r.remove()); U.toast(`已删除 ${rows.length} 个用户`); },
          });
        },
        'u-edit': () => openUserDrawer(a.closest('tr'), true),
        'u-pwd': () => openPwdModal(name),
        'u-disable': () => U.confirm({
          title: '停用', content: '用户停用后，在线用户将被强制退出',
          onOk: () => { setUserState(tr, false); U.toast('已停用'); },
        }),
        'u-enable': () => { setUserState(tr, true); U.toast('已启用'); },
        'u-del': () => U.confirm({
          title: `确认要删除${name}吗？`, danger: true,
          onOk: () => { tr.remove(); U.toast('已删除'); },
        }),
        'role-batch-add': () => pickRoles(a),
        'rrole-del': () => { tr.remove(); U.toast('已移除'); },
        'role-add': () => openRoleModal(null, false),
        'role-import': () => U.dropdown({
          trigger: a,
          items: ['角色', '角色关联用户', '角色数据权限', '角色功能权限'].map((l) => ({
            label: l, onClick: () => U.toast(`已开始导入${l}（示例）`, 'info'),
          })),
        }),
        'role-tpl': () => U.toast('模板已下载（示例）'),
        'role-batch-del': () => {
          const rows = checkedRows('[data-role-table] tbody tr');
          if (!rows.length) return U.toast('请先选择要删除的角色', 'warning');
          U.confirm({
            title: '确认要删除所选角色吗？', danger: true,
            onOk: () => { rows.forEach((r) => r.remove()); U.toast(`已删除 ${rows.length} 个角色`); },
          });
        },
        'r-edit': () => openRoleModal(a.closest('tr'), true),
        'r-copy': () => openCopyModal(a.closest('tr')),
        'r-perm': () => openPermDrawer(a.closest('tr')),
        'r-users': () => openRoleUsersModal(a.closest('tr')),
        'r-del': () => U.confirm({
          title: `确认要删除${name}吗？`, danger: true,
          onOk: () => { tr.remove(); U.toast('角色删除成功'); },
        }),
        'ru-untie': () => U.confirm({
          title: `确认要解除${name}关联吗？`, content: '请确认解除',
          onOk: () => { tr.remove(); U.toast('已解除关联'); },
        }),
      })[op]?.(a);
      return;
    }
    /* 「确定,继续新增」（角色弹窗 / 用户抽屉）：校验 → toast → 清空继续 */
    const keep = e.target.closest('[data-role-keep], [data-uc-keep]');
    if (keep) {
      const root = keep.closest('.flash-modal, .flash-drawer');
      const ok = keep.matches('[data-uc-keep]') ? validateFields(root) : validateAll(root);
      if (!ok) return;
      U.toast(keep.matches('[data-uc-keep]') ? '已保存，可继续新增' : '新增成功');
      $$('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea', root).forEach((i) => { if (!i.disabled) i.value = ''; });
    }
  });

  /* ── 权限树：点击行切换勾选 ── */
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.tree-row');
    if (!row || !row.closest('[data-perm-tree]') || e.target.tagName === 'INPUT') return;
    const c = row.querySelector('input[type=checkbox]');
    if (c) c.checked = !c.checked;
  });

  /* ── 仅服务账户切换：基本信息字段组切换 ── */
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-svc-switch]')) return;
    const root = e.target.closest('.flash-drawer');
    const svc = e.target.checked;
    $('[data-user-normal]', root).hidden = svc;
    $('[data-user-svc]', root).hidden = !svc;
  });

  /* ── 行数据挂点：tr 补充 data-uname / data-admin / data-type / data-built（供状态切换取值） ── */
  $$('[data-user-table] tbody tr').forEach((tr) => {
    tr.dataset.uname = tr.querySelector('[data-uname]').textContent.trim();
    tr.dataset.type = tr.children[3].textContent.trim();
    tr.dataset.admin = tr.dataset.uname === 'admin' ? '1' : '0';
  });
  $$('[data-role-table] tbody tr').forEach((tr) => {
    tr.dataset.built = tr.children[5].textContent.trim() === '系统初始化' ? '1' : '0';
  });
})();
