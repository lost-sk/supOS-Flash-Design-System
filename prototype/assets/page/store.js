/* 设计期 · 应用商店 · 二级交互（规格：.cache/flash-l2-specs/05-openapi-apps-store.md） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* 订单明细（订单明细弹窗 宽1000） */
  const ORDER_DATA = {
    'APS 高级计划与排程系统': [['ORD-20261101-0001', '蓝卓supOS', '2026-11-01']],
    设备管理系统: [['ORD-20260815-0032', '精达集团', '2026-08-15'], ['ORD-20260820-0047', '精达集团', '2026-08-20']],
    汽配生产报工: [['ORD-20261001-0011', '蓝卓supOS', '2026-10-01']],
    水泥窑煅烧与环保智能预警: [['ORD-20261103-0005', '蓝卓supOS', '2026-11-03']],
  };
  /* 版本不匹配示例：该 APP 允许的 supOS 版本低于当前平台版本 */
  const MISMATCH = { 设备管理系统: { range: '1.7 - 2.0', current: '2.1' } };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op="order"],[data-op="download"],[data-op="install"]');
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.name || '';
    if (a.dataset.op === 'order') return orderModal(name);
    if (a.dataset.op === 'download') return U.toast('已开始下载安装包');
    /* 在线安装 */
    const mm = MISMATCH[name];
    if (mm) return U.toast(`${name}允许的supOS版本为${mm.range}, 您目前的supOS版本为${mm.current}，无法安装此APP`, 'error');
    versionModal(name);
  });

  function orderModal(name) {
    const orders = ORDER_DATA[name] || [];
    U.modal({
      title: '订单明细', width: 1000,
      body: `<div class="table-wrap"><table class="flash-table"><thead><tr>
          <th>序号</th><th>订单编号</th><th>APP名称</th><th>开发者</th><th>订单创建日期</th>
        </tr></thead><tbody>
          ${orders.map(([no, dev, date], i) => `<tr><td>${i + 1}</td><td class="mono">${U.esc(no)}</td><td>${U.esc(name)}</td><td>${U.esc(dev)}</td><td>${U.esc(date)}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--flash-text-tertiary)">暂无订单</td></tr>'}
        </tbody></table></div>`,
      footer: '<button class="btn" data-fm-cancel>关 闭</button>',
    });
  }

  /* 选择版本弹窗：版本类型 Radio + 版本号下拉 */
  function versionModal(name) {
    U.modal({
      title: '选择版本', width: 460,
      body: `
        <div class="field"><label><span class="req">版本类型</span></label>
          <div class="f-ctrl" style="max-width:none;display:flex;gap:18px;padding-top:6px">
            <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="ver-type" value="SE" checked>标准版(SE)</label>
            <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="ver-type" value="CE">定制版(CE)</label>
          </div>
        </div>
        <div class="field"><label><span class="req">版本号</span></label>
          <div class="f-ctrl"><select data-req="1" data-err="请选择版本号"><option>v2.3.6</option><option>v2.3.5</option><option>v2.1.0</option></select></div>
          <div class="f-err">请选择版本号</div>
        </div>`,
      onOk: (root) => { if (!U.validate(root)) return false; installProgress(name); },
    });
  }

  /* 在线安装弹窗：安装中... → 2s 后安装完成（绿色），footer「后台安装」 */
  function installProgress(name) {
    let done = false;
    const m = U.modal({
      title: '在线安装', width: 480,
      body: `
        <div style="padding:14px 0;text-align:center">
          <div data-in-text style="margin-bottom:12px;font-size:13px">安装中...</div>
          <div style="height:6px;background:var(--flash-bg-page);border-radius:3px;overflow:hidden"><div data-in-bar style="height:100%;width:0;background:var(--flash-primary);transition:width .2s"></div></div>
        </div>`,
      footer: '<button class="btn primary" data-fm-ok>后台安装</button>',
      onOk: () => {
        U.toast(done ? `「${name}」安装完成` : '已转入后台安装');
        markInstalled(name);
      },
    });
    let p = 0;
    const bar = $('[data-in-bar]', m.root), txt = $('[data-in-text]', m.root);
    const timer = setInterval(() => {
      p = Math.min(100, p + 10);
      bar.style.width = p + '%';
      if (p >= 100) {
        clearInterval(timer);
        done = true;
        txt.innerHTML = '<span style="color:var(--flash-success)">✓ 安装完成</span>';
      }
    }, 200);
  }

  function markInstalled(name) {
    const tr = $$('.flash-table tbody tr').find((r) => r.textContent.includes(name));
    const cell = tr && tr.querySelector('[data-stcell]');
    if (cell) cell.innerHTML = '<span class="dot-status" style="color:var(--flash-installed)">已安装</span>';
  }
})();
