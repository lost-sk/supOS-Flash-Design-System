/* 设计期 · OpenAPI 开放 · 二级交互（规格：.cache/flash-l2-specs/05-openapi-apps-store.md） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ── 示例数据（与 openapi.mjs 行数据一致） ── */
  const API_DATA = {
    设备实时数据查询: { addr: '/openapi/v1/uns/realtime', desc: '查询指定设备位号的实时值', type: 'REST', reg: '手动注册', src: '数据服务', dir: '设备采集', st: '启用', auth: '认证', user: 'demo_user', time: '2026-11-02 14:22' },
    设备历史数据查询: { addr: '/openapi/v1/uns/history', desc: '按时间区间查询位号历史值', type: 'REST', reg: '手动注册', src: '数据服务', dir: '设备采集', st: '启用', auth: '认证', user: 'demo_user', time: '2026-11-02 14:25' },
    生产工单同步: { addr: '/openapi/v1/mes/order-sync', desc: 'MES 工单状态变更推送', type: 'REST', reg: 'APP声明', src: '金蝶 K3', dir: '生产管理', st: '启用', auth: '免认证', user: 'demo_user2', time: '2026-10-28 09:30' },
    报表数据导出: { addr: '/openapi/v1/report/export', desc: '报表数据导出为 Excel', type: 'REST', reg: '手动注册', src: '报表工具', dir: '生产管理', st: '禁用', auth: '认证', user: 'admin', time: '2026-09-30 08:00' },
    旧版点位写入: { addr: '/openapi/v1/uns/write-v1', desc: '旧版位号写入接口', type: 'REST', reg: '系统初始化', src: '系统', dir: '系统接口', st: '已卸载', auth: '认证', user: 'admin', time: '2026-08-12 10:00' },
    设备告警推送: { addr: '/openapi/v1/alarm/push', desc: '设备告警事件推送', type: 'REST', reg: 'APP声明', src: '告警服务', dir: '系统接口', st: '已废弃', auth: '免认证', user: 'admin', time: '2026-07-01 08:00' },
  };
  const MCP_DATA = {
    'supOS-UNS MCP Server': {
      desc: '将 supOS 工厂模型（UNS）目录树、位号查询与实时订阅封装为 MCP 工具，供外部 Agent 读取与订阅工业数据。',
      tools: [
        ['list_uns_directory', '浏览工厂模型目录树', '{\n  "parent": "注塑车间",\n  "depth": 2\n}'],
        ['read_tag_realtime', '读取位号实时值', '{\n  "tags": ["注塑车间/注塑机01/温度"],\n  "quality": true\n}'],
        ['read_tag_history', '按时间区间读取位号历史值', '{\n  "tags": ["注塑车间/注塑机01/温度"],\n  "start": "2026-11-10 00:00:00",\n  "end": "2026-11-10 09:00:00"\n}'],
        ['subscribe_tags', '订阅位号实时推送', '{\n  "tags": ["注塑车间/注塑机01/压力"],\n  "interval": 1000\n}'],
        ['search_model', '按名称搜索模型对象', '{\n  "keyword": "注塑机",\n  "type": "instance"\n}'],
        ['write_tag', '写入位号目标值', '{\n  "tag": "注塑车间/注塑机01/设定温度",\n  "value": 210\n}'],
      ],
      serverConfigs: '{\n  "mcpServers": {\n    "supos-uns": {\n      "url": "http://host.example.com:32580/mcp/uns",\n      "transport": "streamable-http",\n      "headers": { "Authorization": "Bearer <token>" }\n    }\n  }\n}',
    },
    'supOS-数据服务 MCP Server': {
      desc: '提供 supOS 实时/历史数据查询与订阅工具，覆盖 UNS 与 IIoT 数据订阅总通道。',
      tools: [
        ['query_realtime', '查询实时数据', '{\n  "sources": ["UNS", "IIoT"],\n  "tags": ["空压机房/01/排气压力"]\n}'],
        ['query_history', '查询历史数据', '{\n  "tag": "空压机房/01/排气压力",\n  "aggregate": "avg",\n  "interval": "5m"\n}'],
        ['subscribe_data', '订阅数据推送', '{\n  "topic": "uns/空压机房/01/排气压力",\n  "qos": 1\n}'],
        ['list_topics', '列出可订阅 Topic', '{\n  "keyword": "注塑"\n}'],
      ],
      serverConfigs: '{\n  "mcpServers": {\n    "supos-data": {\n      "url": "http://host.example.com:32580/mcp/data",\n      "transport": "streamable-http"\n    }\n  }\n}',
    },
    'supOS-OpenAPI MCP Server': {
      desc: '将 API 目录中已注册的开放接口批量封装为 MCP 工具，按服务用户凭证鉴权。',
      tools: [
        ['call_openapi', '调用已注册开放接口', '{\n  "path": "/openapi/v1/uns/realtime",\n  "method": "GET",\n  "query": { "tag": "注塑车间/注塑机01/温度" }\n}'],
        ['list_apis', '列出可调用的开放接口', '{\n  "dir": "设备采集",\n  "status": 1\n}'],
        ['describe_api', '查看接口出入参说明', '{\n  "path": "/openapi/v1/mes/order-sync"\n}'],
      ],
      serverConfigs: '{\n  "mcpServers": {\n    "supos-openapi": {\n      "url": "http://host.example.com:32580/mcp/openapi",\n      "transport": "streamable-http",\n      "headers": { "X-App-Key": "<service-user-key>" }\n    }\n  }\n}',
    },
  };
  const EV_FIELDS = [
    ['eventCode', 'STRING', '是', '事件编码'],
    ['eventName', 'STRING', '是', '事件名称'],
    ['deviceCode', 'STRING', '否', '设备编码'],
    ['ts', 'TIMESTAMP', '是', '事件时间'],
    ['payload', 'JSON', '否', '事件负载'],
  ];
  const evData = (name) => ({
    fields: EV_FIELDS,
    versions: [['v1.1', '2026-10-12', '新增 deviceCode 字段'], ['v1.0', '2026-09-01', '初始版本']],
    json: JSON.stringify({ eventCode: name + '_EVENT', eventName: name, deviceCode: 'INJ-01', ts: '2026-11-10T09:41:22+08:00', payload: { value: 86.5, unit: '℃' } }, null, 2),
  });

  /* ── 文档委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (a) {
      e.preventDefault();
      const op = a.dataset.op, name = a.dataset.name || '';
      ({
        'api-detail': () => openApiDetail(name),
        'service-user': openServiceUser,
        'ws-toggle': wsToggle,
        'mqtt-toggle': mqttToggle,
        'mqtt-pick': pickNode,
        'mqtt-sub': mqttSubscribe,
        'mqtt-unsub': mqttUnsubscribe,
        'mqtt-rm': () => { mqTopics = mqTopics.filter((t) => t !== name); renderMqTopics(); U.toast('已取消订阅'); },
        'mcp-detail': () => openMcp(name),
        'mcp-back': (t) => { const d = t.closest('.flash-drawer'); d?.remove(); document.querySelector('.flash-drawer-mask')?.remove(); },
        'mcp-copy': (t) => copyCfg(t),
        'event-detail': () => openEventDetail(name),
        'su-role': () => U.toast('已关联服务角色'),
      })[op]?.(a);
      return;
    }
    /* 目录树点击（API 目录 / 事件菜单） */
    const row = e.target.closest('.tree-row');
    if (row && row.closest('[data-tree]')) {
      const tree = row.closest('[data-tree]');
      $$('.tree-row', tree).forEach((r) => r.classList.toggle('is-active', r === row));
      if (row.dataset.dir) filterApi(row.dataset.dir);
      if (row.dataset.ev) filterEvents(row.dataset.ev);
      return;
    }
    /* 选择节点弹窗内点击 */
    const node = e.target.closest('.flash-modal .tree-row[data-node]');
    if (node) {
      const ipt = $('[data-mqtt-node]');
      if (ipt) ipt.value = node.dataset.node;
      node.closest('.flash-modal')?.remove();
      document.querySelector('.flash-mask')?.remove();
      return;
    }
    /* 局部页签（事件管理/事件订阅、事件详情字段/版本） */
    const st = e.target.closest('[data-subtab]');
    if (st) {
      e.preventDefault();
      const wrap = st.closest('[data-subwrap]');
      $$('[data-subtab]', wrap).forEach((x) => x.classList.toggle('is-active', x === st));
      $$('[data-subpane]', wrap).forEach((p) => { p.hidden = p.dataset.subpane !== st.dataset.subtab; });
    }
  });

  /* 认证类型 Radio：选择后清除错误 */
  document.addEventListener('change', (e) => {
    if (e.target.matches('input[name="su-auth"]')) e.target.closest('[data-su-auth]')?.classList.remove('has-error');
  });

  /* MCP 搜索过滤 */
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-mcp-search]')) return;
    const q = e.target.value.trim().toLowerCase();
    let n = 0;
    $$('[data-mcp-list] > a').forEach((c) => { const hit = !q || c.textContent.toLowerCase().includes(q); c.hidden = !hit; if (hit) n++; });
    const empty = $('[data-mcp-empty]'); if (empty) empty.hidden = n > 0;
  });

  /* ── API 目录 ── */
  function filterApi(dir) {
    $$('[data-section="api"] tbody tr').forEach((tr) => {
      const g = tr.querySelector('[data-apidir]');
      tr.hidden = dir !== '全部' && g && g.dataset.apidir !== dir;
    });
  }
  function openApiDetail(name) {
    const r = API_DATA[name];
    if (!r) return;
    U.drawer({
      title: '接口详情', width: 720,
      body: `<dl class="desc">
          <dt>接口中文名称</dt><dd>${U.esc(name)}</dd>
          <dt>接口地址</dt><dd class="mono">${U.esc(r.addr)}</dd>
          <dt>接口描述</dt><dd>${U.esc(r.desc)}</dd>
          <dt>接口类型</dt><dd>${U.esc(r.type)}</dd>
          <dt>注册方式</dt><dd>${U.esc(r.reg)}</dd>
          <dt>接口来源</dt><dd>${U.esc(r.src)}</dd>
          <dt>所属目录</dt><dd>${U.esc(r.dir)}</dd>
          <dt>状态</dt><dd>${U.esc(r.st)}</dd>
          <dt>认证方式</dt><dd>${U.esc(r.auth)}</dd>
          <dt>创建人</dt><dd>${U.esc(r.user)}</dd>
          <dt>创建时间</dt><dd>${U.esc(r.time)}</dd>
        </dl>`,
      footer: '<button class="btn" data-fd-cancel>关闭</button>',
    });
  }

  /* ── 服务用户（ServiceUser/AddModal 800px） ── */
  function openServiceUser() {
    U.drawer({
      title: '新增服务用户', width: 800,
      body: `
        <div class="form-section">基本信息</div>
        ${fieldHtml('服务用户名称', `<input data-su-name="1" data-req="1" data-err="请输入服务用户名称" maxlength="64" placeholder="请输入服务用户名称">`, { required: true, err: '请输入服务用户名称', wide: true })}
        <div class="field" data-su-auth>
          <label><span class="req">服务用户认证类型</span></label>
          <div class="f-ctrl" style="max-width:none;display:flex;gap:18px;padding-top:6px">
            <label style="width:auto;display:flex;align-items:center;gap:6px"><input type="radio" name="su-auth" value="APP KEY">APP KEY</label>
            <label style="width:auto;display:flex;align-items:center;gap:6px"><input type="radio" name="su-auth" value="AKSK">AKSK</label>
          </div>
          <div class="f-err">请选择认证方式</div>
        </div>
        ${fieldHtml('服务用户描述', '<textarea rows="3" style="width:100%" maxlength="200" placeholder="请输入服务用户描述"></textarea>', { wide: true })}
        <div class="form-section">可关联服务角色</div>
        ${tbl(['服务角色编号', '名称', '描述', '操作'], [
          ['SR-001', '运维管理员', '平台运维与告警处理', '<a href="#" data-op="su-role">关联</a>'],
          ['SR-002', '数据查看', 'UNS 与 OpenAPI 只读访问', '<a href="#" data-op="su-role">关联</a>'],
          ['SR-003', '应用接入', '第三方应用接入凭证', '<a href="#" data-op="su-role">关联</a>'],
        ])}`,
      footer: '<button class="btn" data-fd-cancel>取 消</button><button class="btn primary" data-fd-ok>确 定</button>',
      onOk: (root) => validateServiceUser(root),
    });
  }
  function validateServiceUser(root) {
    let ok = U.validate(root);
    /* 名称格式校验（仅支持数字、字母和特殊符号*()-_.） */
    const ipt = root.querySelector('[data-su-name]');
    const f = ipt.closest('.field');
    const v = ipt.value.trim();
    if (v && !/^[A-Za-z0-9*()\-.]+$/.test(v)) {
      f.classList.add('has-error');
      const slot = f.querySelector('.f-err');
      if (slot) slot.textContent = '仅支持数字、字母和特殊符号*()-_.';
      ok = false;
    }
    /* 认证类型必选 */
    if (!root.querySelector('input[name="su-auth"]:checked')) {
      root.querySelector('[data-su-auth]')?.classList.add('has-error');
      ok = false;
    }
    if (!ok) return false;
    U.toast('服务用户已新增');
  }

  /* ── WebSocket 在线调试 ── */
  let wsOn = false;
  function wsToggle() {
    const st = $('[data-ws-state]'), resp = $('[data-ws-resp]'), btn = $('[data-ws-btn]'), addr = $('[data-ws-addr]');
    if (!wsOn) {
      if (!addr.value.trim()) {
        st.textContent = 'CONNECT_ERROR'; st.className = 'tag err'; btn.textContent = '连接';
        resp.textContent = '// 连接失败：连接地址不能为空';
        U.toast('连接失败：连接地址不能为空', 'error');
        return;
      }
      wsOn = true;
      st.textContent = 'CONNECT'; st.className = 'tag ok'; btn.textContent = '断开连接';
      resp.textContent = JSON.stringify({ topic: 'uns/注塑车间/注塑机01/温度', value: 86.5, quality: 'GOOD', ts: '2026-11-10T09:41:22+08:00' }, null, 2);
      U.toast('WebSocket 已连接');
    } else {
      wsOn = false;
      st.textContent = 'DISCONNECT'; st.className = 'tag'; btn.textContent = '连接';
      resp.textContent = '// 已断开连接，重新点击「连接」可再次订阅';
    }
  }

  /* ── MQTT 在线调试 ── */
  let mqState = 'off';
  let mqTopics = [];
  function mqttCheck() {
    const pane = $('[data-section="mqtt"]');
    if (!U.validate(pane)) return false;
    const bk = $('[data-mqtt-broker]');
    const f = bk.closest('.field');
    if (!/^wss?:\/\//.test(bk.value.trim())) {
      f.classList.add('has-error');
      const slot = f.querySelector('.f-err');
      if (slot) slot.textContent = 'Broker地址必须以ws://或wss://开头';
      return false;
    }
    return true;
  }
  function mqttToggle() {
    const btn = $('[data-mqtt-btn]'), st = $('[data-mqtt-state]');
    if (mqState === 'off') {
      if (!mqttCheck()) return;
      mqState = 'ing';
      st.textContent = '连接中'; st.className = 'tag info';
      btn.textContent = '正在连接中...'; btn.disabled = true;
      setTimeout(() => {
        mqState = 'on';
        st.textContent = '连通'; st.className = 'tag ok';
        btn.textContent = '断开连接'; btn.disabled = false;
        U.toast('MQTT Broker 已连接');
      }, 900);
    } else if (mqState === 'on') {
      mqState = 'off';
      st.textContent = '断开'; st.className = 'tag err';
      btn.textContent = '连接';
    }
  }
  function mqttSubscribe() {
    const topic = ($('[data-mqtt-topic]')?.value || '').trim();
    if (!topic) return U.toast('请先选择订阅的Topic', 'warning');
    if (mqState !== 'on') return U.toast('请先连接 MQTT Broker', 'warning');
    if (mqTopics.includes(topic)) return U.toast('已经订阅该Topic，请勿重复订阅', 'warning');
    mqTopics.push(topic);
    renderMqTopics();
    U.toast('调试成功');
  }
  function mqttUnsubscribe() {
    const topic = ($('[data-mqtt-topic]')?.value || '').trim();
    if (!topic || !mqTopics.includes(topic)) return U.toast('请先选择订阅的Topic', 'warning');
    mqTopics = mqTopics.filter((t) => t !== topic);
    renderMqTopics();
    U.toast('已取消订阅');
  }
  function renderMqTopics() {
    const box = $('[data-mqtt-topics]');
    if (!box) return;
    box.innerHTML = mqTopics.length
      ? mqTopics.map((t) => `<span class="tag info">${U.esc(t)}<a href="#" data-op="mqtt-rm" data-name="${U.esc(t)}" style="margin-left:6px;color:inherit">✕</a></span>`).join('')
      : '<span class="muted">暂无订阅</span>';
  }
  function pickNode() {
    U.modal({
      title: '选择节点', width: 420,
      body: `<div class="tree">
          <div class="tree-row" data-node="注塑车间">注塑车间</div>
          <div class="tree-row" data-node="注塑车间/注塑机01" style="padding-left:24px">注塑机01</div>
          <div class="tree-row" data-node="注塑车间/注塑机01/温度" style="padding-left:40px">温度</div>
          <div class="tree-row" data-node="注塑车间/注塑机01/压力" style="padding-left:40px">压力</div>
          <div class="tree-row" data-node="空压机房">空压机房</div>
          <div class="tree-row" data-node="空压机房/01/排气压力" style="padding-left:24px">01 排气压力</div>
        </div>`,
      footer: '<button class="btn" data-fm-cancel>取 消</button>',
    });
  }

  /* ── MCP 详情 ── */
  function openMcp(name) {
    const data = MCP_DATA[name];
    if (!data) return;
    U.drawer({
      title: name, width: 800,
      body: `
        <div style="margin-bottom:6px"><a href="#" data-op="mcp-back">← 返回MCPServer</a></div>
        <div class="form-section">功能描述</div>
        <p style="font-size:13px;color:var(--flash-text)">${U.esc(data.desc)}</p>
        <div class="form-section">工具列表（${data.tools.length}）</div>
        ${data.tools.map(([tn, td, pj]) => `
          <div class="collapse"><details>
            <summary><b style="color:var(--flash-text-strong)">${U.esc(tn)}</b><span class="muted">${U.esc(td)}</span></summary>
            <div class="cp-body"><div class="muted" style="margin-bottom:4px">输入参数</div>
              <pre class="mono" style="background:var(--flash-bg-subtle);border:1px solid var(--flash-border);border-radius:var(--flash-radius);padding:8px;white-space:pre-wrap">${U.esc(pj)}</pre></div>
          </details></div>`).join('')}
        <div class="form-section">serverConfigs</div>
        <div style="position:relative">
          <pre class="code-editor" data-mcp-cfg>${U.esc(data.serverConfigs)}</pre>
          <button class="btn sm" data-op="mcp-copy" style="position:absolute;top:8px;right:8px">复制</button>
        </div>`,
      footer: null,
    });
  }
  function copyCfg(target) {
    const pre = target.closest('.flash-drawer')?.querySelector('[data-mcp-cfg]');
    const text = pre ? pre.textContent : '';
    const done = () => U.toast('已复制到剪贴板');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { U.toast('复制失败，请手动复制', 'error'); }
    ta.remove();
  }

  /* ── 事件开放 ── */
  function filterEvents(ev) {
    const paneEl = $('[data-subpane="em"]');
    if (!paneEl) return;
    const groups = ['设备事件', '生产事件'];
    let n = 0;
    $$('tbody tr', paneEl).forEach((tr) => {
      const g = tr.querySelector('[data-evgroup]');
      const name = g ? g.textContent.trim() : '';
      const hit = groups.includes(ev) ? (g && g.dataset.evgroup === ev) : name === ev;
      tr.hidden = !hit; if (hit) n++;
    });
    const empty = $('[data-ev-empty]'), panel = $('[data-ev-panel]');
    if (empty) empty.hidden = n > 0;
    if (panel) panel.hidden = n === 0;
  }
  function openEventDetail(name) {
    const d = evData(name);
    const drawer = U.drawer({
      title: '事件详情', width: 800,
      body: `
        <div data-subwrap>
          <div class="tabs"><a data-subtab="f" class="is-active">字段</a><a data-subtab="v">版本</a></div>
          <div data-subpane="f">${tbl(['字段名', '类型', '是否必填', '描述'], d.fields)}</div>
          <div data-subpane="v" hidden>${tbl(['版本号', '发布时间', '变更说明'], d.versions)}</div>
        </div>
        <div class="form-section">数据结构 JSON</div>
        <pre class="code-editor" style="min-height:140px">${U.esc(d.json)}</pre>`,
      footer: '<button class="btn" data-fd-cancel>关闭</button>',
    });
    drawer.root.style.bottom = 'auto';
    drawer.root.style.height = '630px';
  }

  /* ── 局部小助手（页面脚本无法 import helpers.mjs，这里内联等价实现） ── */
  function escAttr(s) { return U.esc(s); }
  function tbl(heads, rows) {
    return `<div class="table-wrap"><table class="flash-table"><thead><tr>${heads.map((h) => `<th>${U.esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function fieldHtml(label, ctrl, { required = false, err = '', extra = '', wide = false } = {}) {
    return `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start${wide ? ';max-width:none' : ''}">
      <label style="width:120px;flex:none;padding-top:7px"><span class="${required ? 'req' : ''}">${escAttr(label)}</span></label>
      <div class="f-ctrl">${ctrl}</div>
      ${extra ? `<div class="f-extra">${extra}</div>` : ''}
      <div class="f-err">${escAttr(err)}</div>
    </div>`;
  }
})();
