/* supOS Flash 产品原型 · 二级交互共享库
 * antd 风格的 Modal / Drawer / Toast / Popconfirm / Dropdown / 表单校验。
 * 只依赖 tokens + flash.css 的类；页面脚本通过 window.FlashUI 调用。
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ── Toast（antd message：顶部居中） ── */
  let toastWrap = null;
  function toast(msg, type = 'success') {
    if (!toastWrap) { toastWrap = el('<div class="flash-toast-wrap"></div>'); document.body.appendChild(toastWrap); }
    const ico = { success: '✓', error: '✕', warning: '!', info: 'i' }[type] || 'i';
    const node = el(`<div class="flash-toast ${type}"><span class="t-ico">${ico}</span><span>${esc(msg)}</span></div>`);
    toastWrap.appendChild(node);
    setTimeout(() => node.remove(), 2400);
  }

  /* ── Modal ── */
  function modal({ title, width = 520, body = '', footer = '', confirm, onOk, okText = '确 定', cancelText = '取 消', danger = false, className = '' }) {
    const mask = el('<div class="flash-mask"></div>');
    const dlg = el(`<div class="flash-modal ${confirm ? 'confirm' : ''} ${className}" style="--fm-w:${width}px"></div>`);
    if (confirm) {
      dlg.innerHTML = `<div class="flash-modal-body">
          <span class="fm-icon ${danger ? 'danger' : 'warn'}">${danger ? '✕' : '!'}</span>
          <div class="fm-text"><b>${esc(title)}</b>${confirm.content ? `<p>${confirm.content}</p>` : ''}</div>
        </div>
        <div class="flash-modal-foot"><button class="btn" data-fm-cancel>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-fm-ok>${esc(okText)}</button></div>`;
    } else {
      dlg.innerHTML = `<div class="flash-modal-head"><h3>${esc(title)}</h3><button class="fm-x" data-fm-cancel>✕</button></div>
        <div class="flash-modal-body">${body}</div>
        ${footer !== null ? `<div class="flash-modal-foot">${footer || `<button class="btn" data-fm-cancel>${esc(cancelText)}</button><button class="btn primary" data-fm-ok>${esc(okText)}</button>`}</div>` : ''}`;
    }
    document.body.appendChild(mask); document.body.appendChild(dlg);
    function close() { mask.remove(); dlg.remove(); }
    mask.addEventListener('click', close);
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-fm-cancel]')) close();
      if (e.target.closest('[data-fm-ok]')) {
        if (!onOk || onOk(dlg) !== false) close();
      }
    });
    return { close, root: dlg };
  }

  function confirm({ title = '提示', content = '', okText = '确 定', danger = false, onOk }) {
    return modal({ title, confirm: { content }, okText, danger, onOk });
  }

  /* ── Drawer ── */
  function drawer({ title, width = 720, body = '', footer = '', onOk, okText = '确 定', cancelText = '取 消' }) {
    const mask = el('<div class="flash-drawer-mask"></div>');
    const pane = el(`<div class="flash-drawer" style="--fd-w:${width}px"></div>`);
    pane.innerHTML = `<div class="flash-drawer-head"><h3>${esc(title)}</h3><button class="fm-x" data-fd-cancel style="border:0;background:none;color:var(--flash-text-tertiary)">✕</button></div>
      <div class="flash-drawer-body">${body}</div>
      ${footer !== null ? `<div class="flash-drawer-foot">${footer || `<button class="btn" data-fd-cancel>${esc(cancelText)}</button><button class="btn primary" data-fd-ok>${esc(okText)}</button>`}</div>` : ''}`;
    document.body.appendChild(mask); document.body.appendChild(pane);
    function close() { mask.remove(); pane.remove(); }
    mask.addEventListener('click', close);
    pane.addEventListener('click', (e) => {
      if (e.target.closest('[data-fd-cancel]')) close();
      if (e.target.closest('[data-fd-ok]')) { if (!onOk || onOk(pane) !== false) close(); }
    });
    return { close, root: pane };
  }

  /* ── Popconfirm（挂在触发元素旁） ── */
  let popNode = null;
  function popconfirm({ trigger, title, content = '', okText = '确定', cancelText = '取消', danger = false, onOk }) {
    closePop();
    const rect = trigger.getBoundingClientRect();
    popNode = el(`<div class="flash-pop"><div class="fp-text"><span class="fp-ico">!</span><span>${esc(title)}${content ? ` <span class="muted">${esc(content)}</span>` : ''}</span></div>
      <div class="fp-btns"><button class="btn sm" data-fp-cancel>${esc(cancelText)}</button>
      <button class="btn sm ${danger ? 'danger' : 'primary'}" data-fp-ok>${esc(okText)}</button></div></div>`);
    document.body.appendChild(popNode);
    const pw = popNode.offsetWidth, ph = popNode.offsetHeight;
    let left = Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - pw - 8);
    let top = rect.bottom + window.scrollY + 6;
    if (top + ph > window.scrollY + window.innerHeight) top = rect.top + window.scrollY - ph - 6;
    popNode.style.left = Math.max(8, left) + 'px';
    popNode.style.top = top + 'px';
    popNode.addEventListener('click', (e) => {
      if (e.target.closest('[data-fp-cancel]')) closePop();
      if (e.target.closest('[data-fp-ok]')) { closePop(); if (onOk) onOk(); }
    });
    setTimeout(() => document.addEventListener('click', popOutside), 0);
    function popOutside(e) { if (popNode && !popNode.contains(e.target)) closePop(); }
    function closePop() { if (popNode) { popNode.remove(); popNode = null; document.removeEventListener('click', popOutside); } }
    return { close: closePop };
  }
  function closePop() { if (popNode) { popNode.remove(); popNode = null; } }

  /* ── Dropdown（行操作「更多」） ── */
  let menuNode = null;
  function dropdown({ trigger, items }) {
    closeMenu();
    const rect = trigger.getBoundingClientRect();
    menuNode = el(`<div class="flash-menu">${items.map((it, i) =>
      it === '-' ? '<div class="fm-divider"></div>' :
        `<button class="${it.danger ? 'danger' : ''}" data-mi="${i}">${esc(it.label)}</button>`).join('')}</div>`);
    document.body.appendChild(menuNode);
    menuNode.style.left = Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - menuNode.offsetWidth - 8)) + 'px';
    const top = rect.bottom + window.scrollY + 4;
    menuNode.style.top = (top + menuNode.offsetHeight > window.scrollY + window.innerHeight ? rect.top + window.scrollY - menuNode.offsetHeight - 4 : top) + 'px';
    menuNode.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mi]');
      if (!btn) return;
      const item = items[+btn.dataset.mi];
      closeMenu();
      if (item && item.onClick) item.onClick();
    });
    setTimeout(() => document.addEventListener('click', menuOutside), 0);
    function menuOutside(e) { if (menuNode && !menuNode.contains(e.target) && e.target !== trigger) closeMenu(); }
    function closeMenu() { if (menuNode) { menuNode.remove(); menuNode = null; document.removeEventListener('click', menuOutside); } }
    return { close: closeMenu };
  }
  function closeMenu() { if (menuNode) { menuNode.remove(); menuNode = null; } }

  /* ── 表单校验：field 结构为 <div class="field"><label>…</label><控件 data-req data-pattern data-max data-err></div>
   * 返回是否全部通过；不通过时给 .field 加 has-error 并写 data-err 文案 ── */
  function validate(scope) {
    let ok = true;
    (scope || document).querySelectorAll('.field').forEach((f) => {
      const ctrl = f.querySelector('input, select, textarea');
      if (!ctrl) return;
      f.classList.remove('has-error');
      let err = '';
      const v = (ctrl.value || '').trim();
      if (ctrl.dataset.req === '1' && !v) err = ctrl.dataset.err || '请输入该字段';
      if (!err && ctrl.dataset.max && v.length > +ctrl.dataset.max) err = ctrl.dataset.errMax || `长度不得超过${ctrl.dataset.max}！`;
      if (!err && ctrl.dataset.pattern && v && !new RegExp(ctrl.dataset.pattern).test(v)) err = ctrl.dataset.err || '格式不正确';
      if (err) { f.classList.add('has-error'); const slot = f.querySelector('.f-err'); if (slot) slot.textContent = err; ok = false; }
    });
    return ok;
  }
  function clearErrors(scope) {
    (scope || document).querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  }

  window.FlashUI = { esc, el, toast, modal, confirm, drawer, popconfirm, dropdown, validate, clearErrors, closePop, closeMenu };
})();
