/* 设计期 · 系统设置 · 基础配置 · 二级交互（规格：.cache/flash-l2-specs/06-sysconfig-org.md） */
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

  /* ── 页签切换（data-tabgrp 内局部作用，页面主页签与安全策略小页签共用） ── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tabs a[data-tab]');
    if (!t) return;
    const grp = t.closest('[data-tabgrp]');
    if (!grp) return;
    e.preventDefault();
    $$('.tabs a[data-tab]', grp).forEach((x) => x.classList.toggle('is-active', x === t));
    $$('[data-section]', grp).forEach((p) => { p.hidden = p.dataset.section !== t.dataset.tab; });
  });

  /* ── 帮助气泡（复用 .flash-pop 样式，无按钮，点外部关闭） ── */
  let tip = null;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { if (tip && !tip.contains(e.target)) { tip.remove(); tip = null; } return; }
    if (tip) tip.remove();
    tip = U.el(`<div class="flash-pop" style="max-width:340px"><div class="fp-text"><span class="fp-ico" style="color:var(--flash-primary)">?</span><span>${U.esc(t.dataset.tip)}</span></div></div>`);
    document.body.appendChild(tip);
    const r = t.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = (r.bottom + window.scrollY + 6) + 'px';
  });

  /* ── 上传块：点击即视为已上传，同步实时预览色块 ── */
  function bindUploads() {
    $$('.uploader[data-upload]').forEach((upEl) => {
      upEl.dataset.orig = upEl.getAttribute('style') || '';
      upEl.addEventListener('click', () => {
        upEl.dataset.done = '1';
        upEl.setAttribute('style', `${upEl.dataset.orig};border-style:solid;border-color:var(--flash-primary);color:var(--flash-primary)`);
        upEl.innerHTML = '<span class="up-ico" style="color:var(--flash-success)">✓</span><span>已上传（示例文件）</span>';
        const f = upEl.closest('.field');
        if (f) {
          f.classList.remove('has-error');
          const hid = f.querySelector('input[data-upload-val]');
          if (hid) hid.value = 'uploaded.png';
        }
        const key = upEl.dataset.upload;
        const pv = $(`[data-pv="${key}"]`);
        if (pv) {
          pv.style.borderStyle = 'solid';
          pv.style.borderColor = 'var(--flash-primary)';
          pv.style.background = 'var(--flash-primary-soft)';
          pv.style.color = 'var(--flash-primary)';
          pv.textContent = { logo: 'LOGO 已上传', slogan: '标语已上传' }[key] || '已上传';
        }
        if (key === 'bg') {
          const box = $('[data-login-preview]');
          if (box) box.style.background = 'var(--flash-primary-soft)';
        }
      });
    });
    $$('[data-pv]').forEach((pv) => { pv.dataset.def = pv.getAttribute('style') || ''; pv.dataset.text = pv.textContent; });
    const box = $('[data-login-preview]');
    if (box) box.dataset.def = box.getAttribute('style') || '';
  }
  function resetUploaders(scope) {
    $$('.uploader[data-upload]', scope).forEach((upEl) => {
      upEl.setAttribute('style', upEl.dataset.orig || '');
      upEl.innerHTML = '<span class="up-ico">＋</span><span>点击或拖拽上传</span>';
      const f = upEl.closest('.field');
      if (f) { const hid = f.querySelector('input[data-upload-val]'); if (hid) hid.value = ''; }
      const key = upEl.dataset.upload;
      const pv = $(`[data-pv="${key}"]`);
      if (pv) { pv.setAttribute('style', pv.dataset.def || ''); pv.textContent = pv.dataset.text || ''; }
      if (key === 'bg') {
        const box = $('[data-login-preview]');
        if (box) box.setAttribute('style', box.dataset.def || '');
      }
    });
  }

  /* ── 版权标记：字数统计 + 预览同步 ── */
  function bindCopyright() {
    const ipt = $('[data-copy-input]');
    if (!ipt) return;
    const cnt = $('[data-copy-count]');
    const sync = () => {
      cnt.textContent = `${ipt.value.length}/60`;
      const pv = $('[data-pv="copyright"]');
      if (pv) pv.textContent = ipt.value || '© 版权标记';
    };
    ipt.addEventListener('input', sync);
  }

  /* ── 菜单树：点击选中（拖拽语义见树下方说明） ── */
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.tree-row');
    if (!row || !row.closest('[data-menu-tree]')) return;
    $$('[data-menu-tree] .tree-row').forEach((x) => x.classList.remove('is-active'));
    row.classList.add('is-active');
  });

  /* ── 表格行状态切换 ── */
  const ST = {
    1: '<span class="dot-status" style="color:var(--flash-status-running)">启用</span>',
    0: '<span class="dot-status" style="color:var(--flash-error)">停用</span>',
  };
  function setRowState(tr, on) {
    tr.dataset.state = on ? '1' : '0';
    const st = tr.querySelector('[data-stcell]');
    if (st) st.innerHTML = ST[on ? 1 : 0];
    const tg = tr.querySelector('[data-toggle-link]');
    if (tg) tg.textContent = on ? '停用' : '启用';
  }
  const checkedRows = (sel) => $$(sel).filter((tr) => tr.querySelector('input[type=checkbox]:checked'));

  /* ── 新增/编辑菜单 抽屉（宽1060：1 基本信息 / 2 操作信息） ── */
  function openMenuDrawer(row) {
    const isEdit = !!row;
    const code = isEdit ? row.children[2].textContent.trim() : '';
    const name = isEdit ? row.children[3].textContent.trim() : '';
    const on = isEdit ? row.dataset.state === '1' : true;
    U.drawer({
      title: isEdit ? '编辑菜单' : '新增菜单', width: 1060,
      body: `
        <div class="form-section">1. 基本信息</div>
        ${field('菜单编码', input(Object.assign({
          'data-req': '1', 'data-err': '请输入菜单编码！',
          'data-pattern': '^(?!\\.)(?!.*\\.$)[A-Za-z0-9_.]+$',
          'data-errp': '请输入字母、数字、下划线和小数点的组合，且首尾不能为小数点！',
          'data-max': '200', maxlength: '200',
        }, isEdit ? { value: code, disabled: '' } : {})), { required: true, err: '请输入菜单编码！' })}
        ${field('菜单名称', input(Object.assign({ 'data-req': '1', 'data-err': '请输入菜单名称！' }, isEdit ? { value: name } : {})), { required: true, err: '请输入菜单名称！' })}
        ${field('父节点', select(['无', '数据平台', 'AI 与工具', 'APP 管理', '报表中心', '系统设置']))}
        <div class="field" style="align-items:flex-start" data-term-field>
          <label style="width:120px;flex:none;padding-top:7px"><span class="req">所属终端</span></label>
          <div class="f-ctrl" style="flex:1;max-width:none">
            <div style="display:flex;gap:16px;flex-wrap:wrap;padding-top:6px">
              <label style="width:auto"><input type="checkbox" value="PC端"> PC端</label>
              <label style="width:auto"><input type="checkbox" value="移动端"> 移动端</label>
              <label style="width:auto"><input type="checkbox" value="微信小程序"> 微信小程序</label>
              <label style="width:auto"><input type="checkbox" value="钉钉小程序"> 钉钉小程序</label>
            </div>
            <div class="f-err">请选择所属终端！</div>
          </div>
        </div>
        ${field('菜单栏显隐', select(['显示', '隐藏'], {}, on ? '显示' : '隐藏'))}
        ${field('打开方法', select(['当前窗口', '新建窗口'], {}, '当前窗口'))}
        ${field('自定义菜单名称', input())}
        ${field('URL', input())}
        ${field('描述', '<textarea maxlength="1023" rows="2" data-max="1023"></textarea>')}
        <div class="form-section">2. 操作信息</div>
        ${table(['操作项', 'ICON', '自定义ICON', '菜单路径'], [['打开页面', '—', '—', '同菜单 URL']])}`,
      onOk: (root) => {
        if (!validateAll(root)) return false;
        const tf = $('[data-term-field]', root);
        if (!$('input[type=checkbox]:checked', tf)) { fieldError(tf, '请选择所属终端！'); return false; }
        U.toast('保存成功');
      },
    });
  }

  /* ── 复制菜单弹窗（标题 `复制'菜单名'`，同时复制子菜单默认是） ── */
  function copyMenu(name) {
    U.modal({
      title: `复制'${name}'`, width: 480,
      body: `${field('父菜单', select(['无', '数据平台', 'AI 与工具', 'APP 管理', '报表中心', '系统设置']))}
        <div class="field" style="align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>同时复制子菜单</span></label>
          <div class="f-ctrl" style="display:flex;gap:16px;padding-top:7px">
            <label style="width:auto"><input type="radio" name="cp-child" checked> 是</label>
            <label style="width:auto"><input type="radio" name="cp-child"> 否</label>
          </div>
        </div>`,
      onOk: () => U.toast(`已复制菜单「${name}」`),
    });
  }

  /* ── 批量启用/停用菜单 ── */
  function batchMenu(on) {
    const rows = checkedRows('[data-menu-table] tbody tr');
    if (!rows.length) return U.toast('请先选择要操作的菜单', 'warning');
    U.confirm({
      title: on ? '确认要启用所选菜单吗？' : '确认要停用所选菜单吗？',
      content: '此操作将启用菜单及所有下级菜单，请确认。',
      onOk: () => { rows.forEach((tr) => setRowState(tr, on)); U.toast(`已${on ? '启用' : '停用'} ${rows.length} 个菜单`); },
    });
  }

  /* ── 访问黑白名单：新增IP（随设置模式切换标题）/ 删除 ── */
  const ipRow = (ip, n) =>
    `<tr><td><input type="checkbox" aria-label="选择${U.esc(ip)}"></td><td>${n}</td><td class="mono">${U.esc(ip)}</td><td>2026-11-10 10:30</td><td><a href="#" class="danger" data-op="ip-del" data-name="${U.esc(ip)}">删除</a></td></tr>`;
  function blMode() {
    const r = $('input[name="bl-mode"]:checked');
    return r && r.value === 'black' ? '黑名单' : '白名单';
  }
  function addIP() {
    const mode = blMode();
    U.modal({
      title: `新增${mode}IP`, width: 480,
      body: field('IP', input({ 'data-req': '1', 'data-err': '请输入IP！' }, '', '支持*？通配符'), { required: true, err: '请输入IP！', extra: '示例：192.0.2.*' }),
      onOk: (root) => {
        if (!validateAll(root)) return false;
        const ip = $('input[type=text], input:not([type])', root).value.trim();
        const tb = $('[data-ip-table] tbody');
        tb.insertAdjacentHTML('beforeend', ipRow(ip, tb.children.length + 1));
        U.toast(`已加入${mode}`);
      },
    });
  }
  function delIP(rows) {
    U.confirm({
      title: '确认要删除所选IP吗？',
      content: '删除后该IP不受白(黑)名单管控，请确认',
      danger: true,
      onOk: () => { rows.forEach((tr) => tr.remove()); U.toast('已删除'); },
    });
  }

  /* ── 密码策略 / 会话超时 ── */
  function savePwd() {
    const lf = $('[data-len-field]');
    const mn = +$('[data-pwd-min]', lf).value, mx = +$('[data-pwd-max]', lf).value;
    if (mn > mx) return fieldError(lf, '最小值不能大于最大值');
    lf.classList.remove('has-error');
    U.toast('保存成功');
  }
  function saveSso() {
    const rf = $('[data-sso-field]');
    if (!$('input[type=radio]:checked', rf)) return fieldError(rf, '请选择唯一登录！');
    rf.classList.remove('has-error');
    U.toast('保存成功');
  }
  const resetDefault = () => U.confirm({ title: '恢复默认吗?', content: '请确认!', onOk: () => U.toast('重置成功') });

  /* ── 恢复登录页默认：还原上传块 + 预览 + 版权标记 ── */
  function resetLogin() {
    const card = $('[data-login-card]');
    if (card) resetUploaders(card);
    const ipt = $('[data-copy-input]');
    if (ipt) { ipt.value = ''; ipt.dispatchEvent(new Event('input')); }
  }

  /* ── 事件委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op, name = a.dataset.name || '';
    ({
      'login-save': () => U.toast('保存成功'),
      'login-reset': () => U.confirm({ title: '恢复默认吗?', onOk: () => { resetLogin(); U.toast('重置成功'); } }),
      'nav-save': () => { if (!validateAll(a.closest('[data-nav-card]'))) return; U.toast('保存成功'); },
      'nav-reset': () => U.confirm({ title: '恢复默认吗?', onOk: () => { resetUploaders($('[data-nav-card]')); U.toast('重置成功'); } }),
      'favicon-save': () => { if (!validateAll(a.closest('[data-favicon-card]'))) return; U.toast('保存成功'); },
      'menu-add': () => openMenuDrawer(null),
      'menu-enable': () => batchMenu(true),
      'menu-disable': () => batchMenu(false),
      'm-edit': () => openMenuDrawer(a.closest('tr')),
      'm-copy': () => copyMenu(name),
      'm-toggle': () => setRowState(a.closest('tr'), a.closest('tr').dataset.state !== '1'),
      'xss-save': () => U.toast('保存成功'),
      'ip-add': addIP,
      'ip-del': () => delIP([a.closest('tr')]),
      'ip-batch-del': () => {
        const rows = checkedRows('[data-ip-table] tbody tr');
        if (!rows.length) return U.toast('请先选择要删除的IP', 'warning');
        delIP(rows);
      },
      'pwd-save': savePwd,
      'pwd-reset': resetDefault,
      'sso-save': saveSso,
      'sso-reset': resetDefault,
    })[op]?.(a);
  });

  /* ── change：清除 所属终端 / 唯一登录 的错误态；黑白名单模式切换按钮文案 ── */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-term-field] input[type=checkbox]') && e.target.checked) {
      e.target.closest('[data-term-field]').classList.remove('has-error');
    }
    if (e.target.closest('[data-sso-field]') && e.target.type === 'radio') {
      e.target.closest('[data-sso-field]').classList.remove('has-error');
    }
    if (e.target.name === 'bl-mode') {
      const btn = $('[data-ip-add]');
      if (btn) btn.textContent = `新增${blMode()}IP`;
    }
  });

  bindUploads();
  bindCopyright();
})();
