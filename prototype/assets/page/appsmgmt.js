/* 设计期 · APP 运行管理 · 二级交互（规格：.cache/flash-l2-specs/05-openapi-apps-store.md） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const STATUS = {
    RUNNING: ['运行中', 'var(--flash-status-running)'],
    UN_RUNNING: ['已停止', 'var(--flash-error)'],
    PENDING: ['启动中', 'var(--flash-status-pending)'],
  };
  let currentTab = 'agent';

  const rows = () => $$('[data-apptable] tbody tr');
  const checkedRows = () => rows().filter((r) => !r.hidden && r.querySelector('input[type=checkbox]').checked);
  const rowByName = (n) => rows().find((r) => r.dataset.name === n);

  /* ── 行内状态 / 操作渲染 ── */
  const stSpan = (s) => `<span class="dot-status" style="color:${STATUS[s][1]}">${STATUS[s][0]}</span>`;
  const opsHtml = (state) => {
    if (state === 'PENDING') return `<span class="link-ops"><a href="#" data-op="cfg">配置</a><a href="#" data-op="row-stop">停止</a></span>`;
    if (state === 'RUNNING') return `<span class="link-ops"><a href="#" data-op="cfg">配置</a><a href="#" data-op="row-stop">停止</a><a href="#" data-op="upgrade">升级</a><span class="muted" style="margin-right:8px">卸载</span></span>`;
    return `<span class="link-ops"><a href="#" data-op="cfg">配置</a><a href="#" data-op="row-start">启动</a><a href="#" data-op="upgrade">升级</a><a href="#" data-op="row-uninstall">卸载</a></span>`;
  };
  function rerenderRow(tr) {
    tr.querySelector('[data-stcell]').innerHTML = stSpan(tr.dataset.state);
    tr.querySelector('[data-opscell]').innerHTML = opsHtml(tr.dataset.state);
    syncBatch();
  }

  /* ── 过滤（页签 + 名称搜索）与空态 ── */
  function refresh() {
    const q = ($('[data-app-search]')?.value || '').trim();
    let n = 0;
    rows().forEach((r) => {
      const ok = (currentTab === 'all' || r.dataset.type === currentTab) && (!q || (r.dataset.name || '').includes(q));
      r.hidden = !ok; if (ok) n++;
    });
    const empty = $('[data-apps-empty]');
    if (empty) {
      empty.hidden = n > 0;
      if (n === 0) {
        const label = ($(`[data-apptab="${currentTab}"]`)?.dataset.label) || '应用';
        $('[data-apps-empty-text]').innerHTML =
          `你还未安装${U.esc(label)}，你可选择 <a href="#" data-op="install-upload">本地上传${U.esc(label)}</a> 或 <a href="design-store.html">APP应用商店购买</a>`;
      }
    }
    syncBatch();
  }

  /* ── 批量按钮可用性（RUNNING/UN_RUNNING 互斥禁用） ── */
  function syncBatch() {
    const sel = checkedRows().map((r) => r.dataset.state);
    const has = sel.length > 0;
    const bStart = $('[data-op="batch-start"]'), bStop = $('[data-op="batch-stop"]'), bUni = $('[data-op="batch-uninstall"]');
    if (bStart) bStart.disabled = !(has && sel.every((s) => s === 'UN_RUNNING'));
    if (bStop) bStop.disabled = !(has && sel.some((s) => s === 'RUNNING' || s === 'PENDING'));
    if (bUni) bUni.disabled = !(has && sel.every((s) => s === 'UN_RUNNING'));
  }

  /* ── 文档委托 ── */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-apptab]');
    if (tab) {
      e.preventDefault();
      currentTab = tab.dataset.apptab;
      $$('[data-apptab]').forEach((x) => x.classList.toggle('is-active', x === tab));
      if ($('[data-app-search]')) $('[data-app-search]').value = '';
      refresh();
      return;
    }
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op;
    const tr = a.closest('tr[data-name]');
    const name = tr ? tr.dataset.name : (a.dataset.name || '');
    ({
      install: (t) => U.dropdown({ trigger: t, items: [
        { label: '从本地上传', onClick: uploadFlow },
        { label: '从应用商店购买', onClick: () => { location.href = 'design-store.html'; } },
      ] }),
      'install-upload': () => uploadFlow(),
      'batch-start': () => batchStart(),
      'batch-stop': () => batchStop(),
      'batch-uninstall': () => uninstallModal(checkedRows().map((r) => r.dataset.name)),
      queue: openQueue,
      cfg: () => U.toast(`已打开「${name}」配置`, 'info'),
      'row-start': () => startRow(tr),
      'row-stop': () => { tr.dataset.state = 'UN_RUNNING'; rerenderRow(tr); U.toast(`「${name}」已停止`); },
      upgrade: () => upgradeModal(),
      'row-uninstall': () => uninstallModal([name]),
    })[op]?.(a);
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-apptable] input[type=checkbox]')) syncBatch();
  });
  document.addEventListener('input', (e) => { if (e.target.matches('[data-app-search]')) refresh(); });

  /* ── 启动：启动中 → 2s 后运行中 ── */
  function startRow(tr) {
    if (!tr || tr.dataset.state === 'PENDING') return;
    tr.dataset.state = 'PENDING';
    rerenderRow(tr);
    U.toast(`正在启动「${tr.dataset.name}」...`, 'info');
    setTimeout(() => {
      if (tr.dataset.state !== 'PENDING') return;
      tr.dataset.state = 'RUNNING';
      rerenderRow(tr);
      U.toast(`「${tr.dataset.name}」启动成功`);
    }, 2000);
  }
  function batchStart() {
    const list = checkedRows().filter((r) => r.dataset.state === 'UN_RUNNING');
    if (!list.length) return U.toast('请先勾选已停止的APP', 'warning');
    list.forEach((r) => { r.dataset.state = 'PENDING'; rerenderRow(r); });
    U.toast(`已对 ${list.length} 个APP发起启动`, 'info');
    setTimeout(() => {
      list.forEach((r) => { if (r.dataset.state === 'PENDING') { r.dataset.state = 'RUNNING'; rerenderRow(r); } });
      U.toast('所选APP启动成功');
    }, 2000);
  }
  function batchStop() {
    const list = checkedRows().filter((r) => r.dataset.state === 'RUNNING' || r.dataset.state === 'PENDING');
    if (!list.length) return U.toast('请先勾选运行中的APP', 'warning');
    list.forEach((r) => { r.dataset.state = 'UN_RUNNING'; rerenderRow(r); });
    U.toast(`已停止 ${list.length} 个APP`);
  }

  /* ── 卸载确认（useAppActions.tsx:40-121 文案逐字） ── */
  function uninstallModal(names) {
    if (!names.length) return U.toast('请先勾选要卸载的APP', 'warning');
    const title = names.length === 1 ? `确认卸载"${names[0]}"这个APP吗？` : '确认要卸载所选APP吗？';
    U.modal({
      title, width: 480,
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
          <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="unins-keep" checked>保留元数据</label>
          <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="unins-keep">删除元数据</label>
        </div>
        <div class="note warn">注意: 业务数据库将在30天后自动删除。若APP重新安装，则元数据重新注册。</div>`,
      footer: '<button class="btn" data-fm-cancel>取 消</button><button class="btn danger" data-fm-ok>卸载</button>',
      onOk: () => {
        names.forEach((n) => rowByName(n)?.remove());
        refresh();
        U.toast(names.length === 1 ? `「${names[0]}」已卸载` : `已卸载 ${names.length} 个APP`);
      },
    });
  }

  /* ── 升级弹窗（UpgradeModal） ── */
  function upgradeModal() {
    U.modal({
      title: '请选择升级版本', width: 460,
      body: `
        <div class="field"><label><span class="req">升级版本</span></label>
          <div class="f-ctrl"><select data-req="1" data-err="请选择升级版本"><option>2.3.6（最新）</option><option>2.3.5</option><option>2.2.0</option></select></div>
          <div class="f-err">请选择升级版本</div>
        </div>`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('升级任务已提交'); },
    });
  }

  /* ── 安装：从本地上传（UploadProgressModal） ── */
  function uploadFlow() {
    let done = false;
    const m = U.modal({
      title: '安装', width: 520,
      body: `
        <div style="padding:10px 0">
          <div data-up-text style="margin-bottom:10px;font-size:13px">上传中...</div>
          <div style="height:6px;background:var(--flash-bg-page);border-radius:3px;overflow:hidden"><div data-up-bar style="height:100%;width:0;background:var(--flash-primary);transition:width .2s"></div></div>
        </div>`,
      footer: '<button class="btn" data-fm-cancel>取消</button><button class="btn primary" data-fm-ok>下一步</button>',
      onOk: () => { if (!done) { U.toast('请等待上传完成', 'warning'); return false; } U.toast('已进入安装配置（示例）'); },
    });
    let p = 0;
    const bar = $('[data-up-bar]', m.root), txt = $('[data-up-text]', m.root);
    const timer = setInterval(() => {
      p = Math.min(100, p + 12); bar.style.width = p + '%';
      if (p >= 40 && p < 100) txt.textContent = '安装包处理中...';
      if (p >= 100) { clearInterval(timer); txt.textContent = '上传完成'; done = true; }
    }, 180);
  }

  /* ── 安装队列（TaskQueueModal 宽1100） ── */
  const QDATA = [
    ['APS 排程系统', '高代码开发应用', '2.0.1', '2026-11-09 20:00', '2026-11-09 20:05', '已安装', 'ok'],
    ['能耗分析', '智能体应用', '1.0.0', '2026-11-10 09:12', '—', '安装中', 'info'],
    ['质检报告', '轻应用', '0.9.5', '2026-11-10 08:30', '—', '待安装', ''],
    ['旧版网关', '平台扩展应用', '4.1.0', '2026-11-08 15:00', '—', '安装失败', 'err'],
  ];
  function openQueue() {
    U.modal({
      title: '安装队列', width: 1100,
      body: `
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <input style="width:180px;height:28px" placeholder="APP名称" data-q-name>
          <select style="height:28px" data-q-status><option>全部状态</option><option>待安装</option><option>安装中</option><option>已安装</option><option>安装失败</option></select>
        </div>
        <div class="table-wrap"><table class="flash-table" data-qtable><thead><tr>
          <th>序号</th><th>APP名称</th><th>APP类型</th><th>版本号</th><th>上传时间</th><th>安装时间</th><th>状态</th><th>操作</th>
        </tr></thead><tbody>
          ${QDATA.map(([n, t, v, up, ins, st, cls], i) => `
            <tr data-qname="${U.esc(n)}" data-qstatus="${st}">
              <td>${i + 1}</td><td>${U.esc(n)}</td><td>${U.esc(t)}</td><td>${U.esc(v)}</td><td>${up}</td><td>${ins}</td>
              <td><span class="tag ${cls}">${st}</span></td>
              <td><span class="link-ops">${st === '待安装' ? '<a href="#" data-op="q-install">安装</a>' : ''}<a href="#" data-op="q-log">日志</a><a href="#" data-op="q-del" style="color:var(--flash-error)">删除</a></span></td>
            </tr>`).join('')}
        </tbody></table></div>`,
      footer: '<button class="btn" data-fm-cancel>关 闭</button>',
    });
  }
  function filterQueue() {
    const tb = $('[data-qtable]');
    if (!tb) return;
    const q = ($('[data-q-name]')?.value || '').trim();
    const st = $('[data-q-status]')?.value || '全部状态';
    $$('tbody tr', tb).forEach((tr) => {
      const ok = (!q || tr.dataset.qname.includes(q)) && (st === '全部状态' || tr.dataset.qstatus === st);
      tr.hidden = !ok;
    });
  }
  document.addEventListener('input', (e) => { if (e.target.matches('[data-q-name]')) filterQueue(); });
  document.addEventListener('change', (e) => { if (e.target.matches('[data-q-status]')) filterQueue(); });

  function qLog(name, status) {
    const tail = {
      已安装: '[09:13:10] 容器启动成功，健康检查通过\n[09:13:11] 安装成功',
      安装中: '[09:13:02] 拉取镜像 registry.supos.local/energy:1.0.0 ...\n[09:13:05] 下载中 46%',
      待安装: '[09:12:20] 已加入安装队列，等待调度...',
      安装失败: '[09:13:02] 容器启动失败: ImagePullBackOff\n[09:13:03] 安装失败: 安装包异常',
    }[status] || '';
    U.modal({
      title: `安装日志 · ${name}`, width: 760,
      body: `<pre class="code-editor" style="max-height:380px;overflow:auto">[09:12:01] 开始上传安装包 ${U.esc(name)}.zip (36.2 MB)
[09:12:18] 上传完成，校验 SHA256 通过
[09:12:19] 解析 manifest.json ...
[09:12:20] 创建数据库实例 ...
${tail}</pre>`,
      footer: '<button class="btn" data-fm-cancel>关 闭</button>',
    });
  }

  /* 队列行操作（在弹窗内，走单独委托） */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op="q-install"],[data-op="q-log"],[data-op="q-del"]');
    if (!a) return;
    e.preventDefault();
    const tr = a.closest('tr');
    const name = tr.dataset.qname, status = tr.dataset.qstatus;
    if (a.dataset.op === 'q-install') U.toast(`「${name}」已开始安装`);
    if (a.dataset.op === 'q-log') qLog(name, status);
    if (a.dataset.op === 'q-del') {
      U.confirm({ title: '确认要删除吗？', okText: '确 定', danger: true, onOk: () => { tr.remove(); U.toast('已删除'); } });
    }
  });
})();
