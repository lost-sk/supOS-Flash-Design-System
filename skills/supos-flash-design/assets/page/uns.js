/* 设计期 · 工厂模型（UNS）· 二级交互
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「工厂模型（UNS）」章节（文案：文档实证） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = U.esc;
  const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;

  /* 本页内联小助手（表单结构交给 FlashUI.validate） */
  const F = (label, ctrl, o = {}) => `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
    <label style="width:120px;flex:none;padding-top:7px"><span class="${o.req ? 'req' : ''}">${label}</span></label>
    <div class="f-ctrl">${ctrl}</div>
    <div class="f-extra">${o.extra || ''}</div>
    <div class="f-err">${o.err || ''}</div>
  </div>`;
  const I = (attrs = {}, value = '', ph = '') =>
    `<input ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} value="${esc(value)}" placeholder="${esc(ph)}">`;
  const SEL = (opts, selected = '', attrs = {}) =>
    `<select ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>${opts.map((o) => `<option ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const tableHtml = (heads, rows) => `<div class="table-wrap"><table class="flash-table"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</thead><tbody>${rows.join('')}</tbody></table></div>`;

  /* ── 文件与位号示例数据 ── */
  const FILES = {
    'CNC-01': { name: 'CNC-01', type: '时序型', ns: '/JINGDA/CNC加工/CNC-01', alias: '一号加工中心', desc: 'CNC 车间一号加工中心主轴与进给数据', attrs: '产线：一号线；班组：甲班' },
    'CNC-02': { name: 'CNC-02', type: '时序型', ns: '/JINGDA/CNC加工/CNC-02', alias: '二号加工中心', desc: 'CNC 车间二号加工中心主轴与进给数据', attrs: '产线：一号线；班组：乙班' },
    'INJ-01': { name: 'INJ-01', type: '时序型', ns: '/JINGDA/注塑车间/INJ-01', alias: '一号注塑机', desc: '注塑车间一号机温度与压力数据', attrs: '产线：注塑线' },
    'EM-01': { name: 'EM-01', type: '关系型', ns: '/能源管理/EM-01', alias: '总进线电表', desc: '厂区总进线电量寄存器', attrs: '区域：动力车间' },
    'QC-01': { name: 'QC-01', type: '计算型', ns: '/质量管理/QC-01', alias: '抽检合格率', desc: '按班次计算的抽检合格率', attrs: '' },
    'REF-01': { name: 'REF-01', type: '引用', ns: '/质量管理/REF-01', alias: '质检标准引用', desc: '引用集团质检标准位号', attrs: '' },
  };
  const TAGS = {
    'CNC-01': [
      ['主轴转速', 'SpindleSpeed', '模拟量', '8152 r/min', '正常', '开', '/JINGDA/CNC加工/CNC-01', '读写', '是', '2026-11-10 09:32'],
      ['进给速度', 'FeedRate', '模拟量', '1200 mm/min', '正常', '开', '/JINGDA/CNC加工/CNC-01', '读写', '否', '2026-11-10 09:32'],
      ['主轴负载', 'SpindleLoad', '模拟量', '62 %', '异常', '开', '/JINGDA/CNC加工/CNC-01', '只读', '否', '2026-11-10 09:31'],
      ['当前程序号', 'ProgNo', '枚举', 'O1234', '正常', '关', '/JINGDA/CNC加工/CNC-01', '只读', '是', '2026-11-10 08:47'],
      ['运行状态', 'RunState', '枚举', 'RUN', '正常', '关', '/JINGDA/CNC加工/CNC-01', '只读', '否', '2026-11-10 09:32'],
    ],
    'CNC-02': [
      ['主轴转速', 'SpindleSpeed', '模拟量', '7980 r/min', '正常', '开', '/JINGDA/CNC加工/CNC-02', '读写', '是', '2026-11-10 09:32'],
      ['进给速度', 'FeedRate', '模拟量', '1150 mm/min', '正常', '开', '/JINGDA/CNC加工/CNC-02', '读写', '否', '2026-11-10 09:32'],
    ],
    'INJ-01': [
      ['料筒温度', 'BarrelTemp', '模拟量', '212 ℃', '正常', '开', '/JINGDA/注塑车间/INJ-01', '只读', '否', '2026-11-10 09:30'],
      ['射胶压力', 'InjectPress', '模拟量', '88 MPa', '正常', '开', '/JINGDA/注塑车间/INJ-01', '只读', '否', '2026-11-10 09:30'],
    ],
    'EM-01': [
      ['有功功率', 'ActivePower', '模拟量', '342 kW', '正常', '开', '/能源管理/EM-01', '只读', '否', '2026-11-10 09:32'],
      ['累计电量', 'TotalEnergy', '累加量', '1284300 kWh', '正常', '开', '/能源管理/EM-01', '只读', '否', '2026-11-10 09:32'],
    ],
    'QC-01': [
      ['抽检合格率', 'PassRate', '计算量', '98.6 %', '正常', '开', '/质量管理/QC-01', '只读', '否', '2026-11-10 08:00'],
    ],
    'REF-01': [
      ['标准温度上限', 'StdTempMax', '引用', '80 ℃', '正常', '关', '/质量管理/REF-01', '只读', '否', '2026-11-01 10:00'],
    ],
  };

  /* 历史曲线示意（SVG，颜色取 token） */
  const PTS = '0,132 28,120 56,128 84,104 112,112 140,88 168,96 196,74 224,82 252,64 280,72 308,54 336,68 364,48 392,58 420,40 448,50 476,34 504,44 532,28 560,36';
  const CHART = `<svg viewBox="0 0 560 170" style="width:100%;height:auto;display:block;background:var(--flash-bg-subtle);border:1px solid var(--flash-border);border-radius:8px">
    <g style="stroke:var(--flash-border)"><line x1="0" y1="42" x2="560" y2="42"></line><line x1="0" y1="84" x2="560" y2="84"></line><line x1="0" y1="126" x2="560" y2="126"></line></g>
    <polygon points="${PTS} 560,170 0,170" style="fill:var(--flash-primary-soft)"></polygon>
    <polyline points="${PTS}" style="fill:none;stroke:var(--flash-primary);stroke-width:2"></polyline>
  </svg>`;

  /* ── 文件详情（tabs：订阅 / 明细 / 消息体 / 定义 / 附件，切换由 shell.js 全局 data-tab 处理） ── */
  const subPane = () => `
    <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
      <label style="width:120px;flex:none;padding-top:7px"><span>MQTT</span></label>
      <div class="f-ctrl" style="max-width:none;display:flex;align-items:center;gap:10px">
        <label class="switch"><input type="checkbox" data-mqtt checked><i></i></label>
        <span class="muted">开启后该文件下位号实时值将通过 MQTT 主题发布</span>
      </div>
    </div>`;
  const tagTable = (rows) => tableHtml(
    ['位号名称', '位号别名', '类型', '实时值', '状态', '保持历史', '命名空间', '读写类型', '数据下写', '更新时间', '操作'],
    rows.map((t) => `<tr>
      <td>${esc(t[0])}</td><td class="mono">${esc(t[1])}</td><td>${esc(t[2])}</td><td class="num">${esc(t[3])}</td>
      <td>${tag(t[4], t[4] === '正常' ? 'ok' : 'err')}</td><td>${esc(t[5])}</td><td class="mono">${esc(t[6])}</td>
      <td>${esc(t[7])}</td><td>${esc(t[8])}</td><td>${esc(t[9])}</td>
      <td><span class="link-ops"><a href="#" data-op="tag-edit" data-tag="${esc(t[0])}">编辑</a><a href="#" data-op="tag-history" data-tag="${esc(t[0])}">查看历史</a></span></td>
    </tr>`));
  const detailPane = (f, rows) => `
    <div class="form-section">基本信息</div>
    ${F('显示名称', I({}, f.alias))}
    ${F('描述', I({}, f.desc))}
    ${F('扩展属性', I({}, f.attrs))}
    <div class="btn-row"><button class="btn sm primary" data-op="save-detail">保存</button></div>
    <div class="form-section" style="margin-top:18px">位号明细</div>
    <div class="pane-head"><span class="muted">共 ${rows.length} 个位号 · 示例</span><button class="btn sm" data-op="hist-store">历史存储设置</button></div>
    ${tagTable(rows)}`;
  const bodyPane = (f) => `
    <div class="segmented" data-msg-fmt><a class="is-active" data-op="msg-fmt">JSON</a><a data-op="msg-fmt">Table</a></div>
    <pre class="mono" style="margin-top:10px;padding:12px;background:var(--flash-bg-subtle);border:1px solid var(--flash-border);border-radius:8px;overflow:auto">{
  "ns": "${f.ns}",
  "ts": "2026-11-10T09:32:00+08:00",
  "values": { "SpindleSpeed": 8152, "FeedRate": 1200, "SpindleLoad": 62, "RunState": "RUN" }
}</pre>`;
  const defPane = () => tableHtml(['属性名称', '数据类型', '描述', '操作'], [
    ['<span class="mono">SpindleSpeed</span>', 'double', '主轴转速（r/min）', '<a href="#" data-op="attr-edit">编辑</a>'],
    ['<span class="mono">FeedRate</span>', 'double', '进给速度（mm/min）', '<a href="#" data-op="attr-edit">编辑</a>'],
    ['<span class="mono">ProgNo</span>', 'string', '当前加工程序号', '<a href="#" data-op="attr-edit">编辑</a>'],
    ['<span class="mono">RunState</span>', 'enum', '设备运行状态', '<a href="#" data-op="attr-edit">编辑</a>'],
  ]);
  const attachPane = () => `<div class="uploader" data-op="upload"><span class="up-ico">⇪</span>点击或拖拽文件到此处上传</div><div class="muted" style="margin-top:8px">暂无附件</div>`;

  function detailHtml(f) {
    const rows = TAGS[f.name] || [];
    return `
    <div class="pane-head"><b>${esc(f.name)}</b><span class="muted">${esc(f.type)} · 命名空间 ${esc(f.ns)}</span></div>
    <div class="tabs">
      <a href="#sub" data-tab="sub">订阅</a>
      <a href="#detail" data-tab="detail" class="is-active">明细</a>
      <a href="#body" data-tab="body">消息体</a>
      <a href="#def" data-tab="def">定义</a>
      <a href="#attach" data-tab="attach">附件</a>
    </div>
    <div data-section="sub" hidden>${subPane()}</div>
    <div data-section="detail">${detailPane(f, rows)}</div>
    <div data-section="body" hidden>${bodyPane(f)}</div>
    <div data-section="def" hidden>${defPane()}</div>
    <div data-section="attach" hidden>${attachPane()}</div>`;
  }
  function renderDetail(name) { $('[data-file-pane]').innerHTML = detailHtml(FILES[name] || FILES['CNC-01']); }
  renderDetail('CNC-01');

  /* ── 树：点击选中文件 / 折叠文件夹 ── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('.tr-ops')) return;
    const row = e.target.closest('[data-uns-tree] .tree-row');
    if (!row) return;
    if (row.dataset.file) {
      $$('[data-uns-tree] .tree-row.is-active').forEach((r) => r.classList.remove('is-active'));
      row.classList.add('is-active');
      renderDetail(row.dataset.name);
    } else if (row.dataset.folder) {
      const kids = row.nextElementSibling;
      if (kids && kids.classList.contains('tree-children')) {
        kids.hidden = !kids.hidden;
        const c = $('.caret', row);
        if (c) c.textContent = kids.hidden ? '▸' : '▾';
      }
    }
  });

  /* ── 文件夹右键菜单（文档实证八项） ── */
  let clip = '';
  function collapseRow(row) {
    const kids = row.nextElementSibling;
    if (kids && kids.classList.contains('tree-children')) {
      kids.hidden = true;
      const c = $('.caret', row);
      if (c) c.textContent = '▸';
    }
    U.toast(`「${row.dataset.name}」已收起`, 'info');
  }
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('[data-uns-tree] .tree-row[data-folder]');
    if (!row) return;
    e.preventDefault();
    const name = row.dataset.name;
    U.dropdown({ trigger: row, items: [
      { label: '刷新', onClick: () => U.toast('模型树已刷新') },
      { label: '查看模板', onClick: showTemplates },
      { label: '复制', onClick: () => { clip = name; U.toast(`已复制「${name}」`); } },
      { label: '粘贴', onClick: () => { clip ? U.toast(`已将「${clip}」粘贴到「${name}」`) : U.toast('剪贴板为空，请先复制', 'warning'); } },
      { label: '创建新文件夹', onClick: () => newFolder(name) },
      { label: '创建新文件', onClick: () => newFile(name) },
      { label: '收起文件夹', onClick: () => collapseRow(row) },
      '-',
      { label: '删除', danger: true, onClick: () => delNode(name, true) },
    ] });
  });

  /* ── data-op 分发 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op, name = a.dataset.name || '';
    ({
      import: (t) => U.dropdown({ trigger: t, items: [
        { label: '文件', onClick: importFile },
        { label: 'JSON', onClick: importJson },
      ] }),
      export: (t) => U.dropdown({ trigger: t, items: [
        { label: 'JSON', onClick: () => U.toast('已导出所选文件 JSON（示例）') },
      ] }),
      'batch-gen': batchGen,
      'new-file': () => newFile(name),
      'new-folder': () => newFolder(name),
      'del-node': () => delNode(name, a.dataset.kind === 'folder'),
      'file-edit': () => openFileEdit(name),
      'tag-edit': () => tagEdit(a.dataset.tag),
      'tag-history': () => tagHistory(a.dataset.tag),
      'hist-store': histStore,
      'subs-more': () => U.toast('订阅信息列表（示例）', 'info'),
      'save-detail': () => U.toast('已保存'),
      'attr-edit': () => U.toast('属性定义随模板下发，编辑后同步到文件（示例）', 'info'),
      'msg-fmt': () => {
        const seg = a.closest('[data-msg-fmt]');
        $$('a', seg).forEach((x) => x.classList.toggle('is-active', x === a));
        U.toast(`已切换为 ${a.textContent} 格式（示例）`, 'info');
      },
      upload: () => U.toast('已选择文件（示例）', 'info'),
    })[op]?.(a);
  });

  /* MQTT 订阅开关 */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-mqtt]')) U.toast(`MQTT 订阅已${e.target.checked ? '开启' : '关闭'}`);
  });

  /* ── 全局操作：导入 / 导出 / 批量生成 ── */
  function importFile() {
    U.modal({ title: '导入文件', width: 560,
      body: `<div class="uploader"><span class="up-ico">⇪</span>点击或拖拽文件到此处上传<br><span class="muted">支持 .xlsx / .csv 模板文件</span></div>`,
      onOk: () => U.toast('导入任务已提交') });
  }
  function importJson() {
    U.modal({ title: '导入 JSON', width: 640,
      body: `<div class="field" style="display:block"><textarea style="width:100%;min-height:160px;padding:8px 10px;border:1px solid var(--flash-border);border-radius:var(--flash-radius);font-family:ui-monospace,Consolas,monospace;font-size:12px" placeholder="粘贴 UNS 文件 JSON"></textarea></div>`,
      onOk: () => U.toast('JSON 解析成功，已生成文件（示例）') });
  }
  function batchGen() {
    U.modal({ title: '批量生成', width: 520,
      body: `${F('数据类型', SEL(['时序型', '关系型']))}
        ${F('属性生成方式', SEL(['逆向生成', '挂载']))}`,
      onOk: () => U.toast('批量生成任务已提交') });
  }
  function showTemplates() {
    U.modal({ title: '查看模板', width: 560,
      body: tableHtml(['模板名称', '描述', '文件数'], [
        ['设备通用模板', '通用设备位号模板', '128'],
        ['CNC 采集模板', '加工中心采集点模板', '86'],
      ]),
      footer: `<button class="btn" data-fm-cancel>关 闭</button>` });
  }

  /* ── 创建新文件 / 新文件夹 / 删除 ── */
  function newFile(parent) {
    const m = U.modal({ title: '创建新文件', width: 660,
      body: `
        ${F('所属文件夹', I({ value: parent || 'JINGDA', disabled: '' }))}
        ${F('名称', I({ 'data-req': '1', 'data-err': '请输入名称', 'data-max': '128', 'data-errMax': '长度不得超过128！' }, '', '如 CNC-03'), { req: true, err: '请输入名称' })}
        ${F('显示名称', I())}
        ${F('描述', I())}
        ${F('属性生成方式', SEL(['自定义', '模板', '逆向生成']))}
        ${F('数据类型', SEL(['时序型', '关系型', '计算型', '引用'], '时序型', { 'data-dtype': '1' }))}
        ${F('数据下写', `<label class="switch"><input type="checkbox"><i></i></label>`)}
        <div class="form-section">扩展属性（最多 3 组）</div>
        <div data-ext-rows></div>
        <div style="margin-top:2px"><button class="btn sm" data-ext-add>＋ 添加属性</button></div>`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('文件已创建'); } });
    /* 扩展属性：最多 3 组键值对 */
    const rowsBox = $('[data-ext-rows]', m.root);
    $('[data-ext-add]', m.root).addEventListener('click', () => {
      if ($$('.ext-row', rowsBox).length >= 3) { U.toast('扩展属性最多 3 组', 'warning'); return; }
      rowsBox.insertAdjacentHTML('beforeend',
        `<div class="ext-row" style="display:flex;gap:8px;margin-bottom:8px">
          <input style="flex:1;height:30px;padding:0 8px;border:1px solid var(--flash-border);border-radius:var(--flash-radius)" placeholder="属性名">
          <input style="flex:1;height:30px;padding:0 8px;border:1px solid var(--flash-border);border-radius:var(--flash-radius)" placeholder="属性值">
          <button class="btn sm" data-ext-del>✕</button></div>`);
    });
    rowsBox.addEventListener('click', (e) => {
      const del = e.target.closest('[data-ext-del]');
      if (del) del.closest('.ext-row').remove();
    });
    /* 数据类型＝引用 时的文档实证提示 */
    const dt = $('[data-dtype]', m.root);
    dt.addEventListener('change', () => {
      dt.closest('.field').querySelector('.f-extra').textContent =
        dt.value === '引用' ? '引用不可链式，按命名空间路径搜索区分大小写' : '';
    });
  }
  function newFolder(parent) {
    U.modal({ title: '创建新文件夹', width: 460,
      body: `${F('上级文件夹', I({ value: parent || 'JINGDA', disabled: '' }))}
        ${F('名称', I({ 'data-req': '1', 'data-err': '请输入名称', 'data-max': '64', 'data-errMax': '长度不得超过64！' }, '', '如 装配车间'), { req: true, err: '请输入名称' })}`,
      onOk: (root) => { if (!U.validate(root)) return false; U.toast('文件夹已创建'); } });
  }
  function delNode(name, isFolder) {
    U.confirm({
      title: isFolder ? '确认删除该文件夹吗？' : '确认删除该文件吗？',
      content: isFolder ? `「${name}」及其下所有文件将一并删除。` : `「${name}」删除后可在回收站还原。`,
      danger: true, onOk: () => U.toast(`「${name}」已删除`),
    });
  }
  function openFileEdit(name) {
    $$('[data-uns-tree] .tree-row').forEach((r) => r.classList.toggle('is-active', r.dataset.name === name));
    renderDetail(name);
    const paneRoot = $('[data-file-pane]');
    $$('.tabs a', paneRoot).forEach((x) => x.classList.toggle('is-active', x.dataset.tab === 'detail'));
    $$('[data-section]', paneRoot).forEach((s) => { s.hidden = s.dataset.section !== 'detail'; });
    U.toast(`已打开「${name}」明细（示例）`, 'info');
  }

  /* ── 位号：编辑（仅读写类型/保持历史） / 查看历史 / 历史存储设置 ── */
  function tagEdit(name) {
    U.modal({ title: `编辑位号 - ${name}`, width: 460,
      body: `${F('位号名称', I({ value: name, disabled: '' }))}
        ${F('读写类型', SEL(['只读', '只写', '读写'], '读写'))}
        ${F('保持历史', SEL(['开', '关'], '开'))}
        <div class="muted">仅读写类型与保持历史支持编辑</div>`,
      onOk: () => U.toast('位号已保存') });
  }
  function tagHistory(name) {
    const m = U.modal({ title: `查看历史 - ${name}`, width: 760,
      body: `
        <div class="segmented" data-hist-mode>
          <a class="is-active" data-m="raw">原始</a><a data-m="sample">采样</a><a data-m="stat">统计</a>
        </div>
        <div data-hist-opts style="margin:12px 0"></div>
        ${CHART}
        <div class="muted" style="margin-top:8px">示例曲线，仅用于原型演示</div>`,
      footer: `<button class="btn" data-fm-cancel>关 闭</button>` });
    const opts = $('[data-hist-opts]', m.root);
    const OPTS = {
      raw: `<div class="muted">原始数据仅可查询 7 天内</div>`,
      sample: F('采样方式', SEL(['向前补值', '线性插值'])),
      stat: F('统计方式', SEL(['首值', '末值', '最大', '最小', '累加', '累加平均', '积分', '积分平均', '连续方差', '离散方差'])),
    };
    opts.innerHTML = OPTS.raw;
    $('[data-hist-mode]', m.root).addEventListener('click', (e) => {
      const a = e.target.closest('a[data-m]');
      if (!a) return;
      $$('a[data-m]', m.root).forEach((x) => x.classList.toggle('is-active', x === a));
      opts.innerHTML = OPTS[a.dataset.m];
    });
  }
  function histStore() {
    U.modal({ title: '历史存储设置', width: 460,
      body: `${F('设置范围', SEL(['全部', '已选项']))}
        ${F('保存历史', `<label class="switch"><input type="checkbox" checked><i></i></label>`)}`,
      onOk: () => U.toast('历史存储设置已保存') });
  }
})();
