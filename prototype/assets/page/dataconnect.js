/* 设计期 · 数据接入服务 · 二级交互（规格：.cache/flash-l2-specs/01-datasource-connect.md「数据接入服务」）
 * 交互：UUID/密钥复制（clipboard + 降级）、部署来源切换设备 IP、通讯加密开关联动密钥、密钥生成/生成中。 */
(function () {
  const U = window.FlashUI;

  /* 复制：优先 navigator.clipboard，file:// 场景降级 execCommand */
  function copyText(text, msg) {
    const done = () => U.toast(msg || '已复制到剪贴板');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { U.toast('复制失败，请手动复制', 'error'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op;
    if (op === 'copy') {
      if (a.dataset.keycopy) {
        const inp = a.closest('.field').querySelector('input');
        copyText(inp ? inp.value : '', '密钥已复制');
      } else copyText(a.dataset.copy || '', a.dataset.msg || '已复制到剪贴板');
    }
    if (op === 'gen-key' && !a.disabled) {
      a.disabled = true;
      a.textContent = '生成中';
      setTimeout(() => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        const inp = a.closest('.field').querySelector('input');
        if (inp) inp.value = key;
        a.disabled = false;
        a.textContent = '生成';
        U.toast('密钥已生成');
      }, 900);
    }
    if (op === 'pick') U.toast(`「${a.dataset.name}」节点表单未在工作区实证`, 'info');
    if (op === 'deploy') U.toast('部署成功');
    if (op === 'form-ok') {
      if (!U.validate(a.closest('.card'))) return;
      U.toast('保存成功');
    }
    if (op === 'form-cancel') {
      U.clearErrors(a.closest('.card'));
      U.toast('已取消修改', 'info');
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('input[name="dep-src"]')) {
      const box = document.querySelector('[data-dep-ip]');
      if (box) box.hidden = e.target.value !== '外置';
    }
    if (e.target.matches('[data-sw-enc]')) {
      const box = document.querySelector('[data-sec-key]');
      if (box) box.hidden = !e.target.checked;
    }
  });
})();
