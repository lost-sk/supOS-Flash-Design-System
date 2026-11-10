/* 设计期 · OpenAPI 开放（L2）
 * 规格：.cache/flash-l2-specs/05-openapi-apps-store.md
 * 源码：supbase-frontend-main/src/pages/OpenAPI（ManageList/ServiceUser/RealDataTesting/MQTTTest/MCP/事件开放） */
import { esc, tag, table, stat, card, section, note, tabs, pane, realToolbar, searchBox, field, input, select } from './helpers.mjs';

const S = 'assets/page/openapi.js';

/* ── API 目录（Setting/OpenAPI/ManageList） ── */
const apiLink = (n) => `<a href="#" data-op="api-detail" data-name="${esc(n)}">详情</a>`;
const apiRows = table(
  ['序号', '接口中文名称', '接口地址', '接口描述', '接口类型', '注册方式', '接口来源', '所属目录', '状态', '认证方式', '创建人', '创建时间', '操作'],
  [
    ['1', '<span data-apidir="设备采集">设备实时数据查询</span>', '/openapi/v1/uns/realtime', '查询指定设备位号的实时值', 'REST', '手动注册', '数据服务', '设备采集', tag('启用', 'ok'), '认证', 'demo_user', '2026-11-02 14:22', apiLink('设备实时数据查询')],
    ['2', '<span data-apidir="设备采集">设备历史数据查询</span>', '/openapi/v1/uns/history', '按时间区间查询位号历史值', 'REST', '手动注册', '数据服务', '设备采集', tag('启用', 'ok'), '认证', 'demo_user', '2026-11-02 14:25', apiLink('设备历史数据查询')],
    ['3', '<span data-apidir="生产管理">生产工单同步</span>', '/openapi/v1/mes/order-sync', 'MES 工单状态变更推送', 'REST', 'APP声明', '金蝶 K3', '生产管理', tag('启用', 'ok'), '免认证', 'demo_user2', '2026-10-28 09:30', apiLink('生产工单同步')],
    ['4', '<span data-apidir="生产管理">报表数据导出</span>', '/openapi/v1/report/export', '报表数据导出为 Excel', 'REST', '手动注册', '报表工具', '生产管理', tag('禁用', 'err'), '认证', 'admin', '2026-09-30 08:00', apiLink('报表数据导出')],
    ['5', '<span data-apidir="系统接口">旧版点位写入</span>', '/openapi/v1/uns/write-v1', '旧版位号写入接口', 'REST', '系统初始化', '系统', '系统接口', tag('已卸载', 'warn'), '认证', 'admin', '2026-08-12 10:00', apiLink('旧版点位写入')],
    ['6', '<span data-apidir="系统接口">设备告警推送</span>', '/openapi/v1/alarm/push', '设备告警事件推送', 'REST', 'APP声明', '告警服务', '系统接口', tag('已废弃'), '免认证', 'admin', '2026-07-01 08:00', apiLink('设备告警推送')],
  ]);
const apiStSel = searchBox('状态').replace('<input',
  '<select style="width:120px;height:28px"><option>请选择状态</option><option>启用</option><option>禁用</option><option>已卸载</option><option>已废弃</option></select><input hidden');
const apiPane = `
  <div class="split tree-main">
    ${card('接口目录', `
      <div class="tree" data-tree>
        <div class="tree-row is-active" data-dir="全部">全部接口<span class="sub" style="margin-left:auto">6</span></div>
        <div class="tree-row" data-dir="设备采集">设备采集<span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row" data-dir="生产管理">生产管理<span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row" data-dir="系统接口">系统接口<span class="sub" style="margin-left:auto">2</span></div>
      </div>`)}
    <div>
      ${realToolbar(`${searchBox('接口中文名称')}${searchBox('接口地址')}${searchBox('接口来源')}${apiStSel}`,
        `<button class="btn" data-op="service-user">服务用户</button><button class="btn">刷新</button>`, 6)}
      ${apiRows}
      ${note('状态枚举：启用 / 禁用 / 已卸载 / 已废弃；认证方式：免认证 / 认证；注册方式：APP声明 / 手动注册 / 系统初始化。服务用户名称校验：「请输入服务用户名称」「仅支持数字、字母和特殊符号*()-_.」，服务用户认证类型（APP KEY / AKSK）必选。')}
    </div>
  </div>`;

/* ── WebSocket（RealDataTesting） ── */
const wsPane = `
  <div class="grid cols-2" style="margin-bottom:4px">
    ${stat('Websocket客户端连接数', '6')}
    ${stat('数据订阅总数量（含UNS和IIoT）', '18')}
  </div>
  ${section('Websocket 客户端连接')}
  ${realToolbar(searchBox('', '输入订阅来源或客户端IP'), '<button class="btn">刷新</button>', 6)}
  ${table(['序号', '订阅来源', '客户端地址', '连接建立时间', '数据订阅量', '最新数据推送时间'], [
    ['1', 'UNS 订阅', 'host.example.com:52100', '2026-11-09 08:12', '6', '2026-11-10 09:41'],
    ['2', 'IIoT 订阅', 'app.example.com2:53110', '2026-11-09 09:30', '5', '2026-11-10 09:40'],
    ['3', 'OpenAPI 推送', 'host.example.com:49120', '2026-11-08 15:02', '3', '2026-11-10 09:38'],
    ['4', '事件开放', 'host.example.com:38000', '2026-11-07 11:20', '2', '2026-11-10 09:30'],
    ['5', 'UNS 订阅', 'host.example.com:52210', '2026-11-06 08:00', '1', '2026-11-09 18:00'],
    ['6', 'IIoT 订阅', 'host.example.com:51200', '2026-11-05 10:00', '1', '2026-11-10 08:55'],
  ])}
  ${card('在线调试', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div>
        ${field('连接地址', `<span style="display:inline-flex;align-items:center;height:30px;padding:0 8px;border:1px solid var(--flash-border);border-right:0;border-radius:var(--flash-radius) 0 0 var(--flash-radius);background:var(--flash-bg-subtle);color:var(--flash-text-tertiary);font-size:12px">ws://</span>` +
          input({ style: 'height:30px;border:1px solid var(--flash-border);border-radius:0 var(--flash-radius) var(--flash-radius) 0', 'data-ws-addr': '1' }, 'host.example.com:32580'), { extra: '示例：host.example.com:32580' })}
        ${field('连接认证', input({ readonly: '' }, 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...'), { extra: 'Authorization，登录后自动携带，只读' })}
        ${field('订阅对象', select(['注塑车间/注塑机01/温度', '注塑车间/注塑机01/压力', '空压机房/01/排气压力']))}
        <div class="btn-row" style="margin-left:128px"><button class="btn primary" data-op="ws-toggle" data-ws-btn>连接</button></div>
      </div>
      <div>
        <div class="pane-head"><b>发送 / 响应</b><span class="tag" data-ws-state>DISCONNECT</span></div>
        <div class="mono" style="background:var(--flash-bg-subtle);border:1px solid var(--flash-border);border-radius:var(--flash-radius);padding:8px 10px;white-space:pre-wrap">{"action":"subscribe","targets":["注塑车间/注塑机01/温度"]}</div>
        <div class="muted" style="margin:6px 0 4px">响应</div>
        <pre class="code-editor" style="min-height:130px" data-ws-resp>// 尚未建立连接，点击「连接」后发送订阅请求</pre>
      </div>
    </div>`)}
`;

/* ── MQTT（MQTTTest） ── */
const mqttPane = `
  <div class="grid cols-2" style="margin-bottom:4px">
    ${stat('MQTT客户端连接数', '4')}
    ${stat('订阅的Topic数量', '9')}
  </div>
  ${section('MQTT 客户端连接')}
  ${realToolbar(searchBox('', '请输入客户端ID'), '<button class="btn">刷新</button>', 4)}
  ${table(['序号', '客户端ID', '用户名', 'IP地址', '连接建立时间', '订阅的Topic数量'], [
    ['1', 'supos-uns-01', 'uns_client', 'host.example.com', '2026-11-09 08:10', '4'],
    ['2', 'supos-iiot-02', 'iiot_client', 'app.example.com2', '2026-11-09 09:26', '3'],
    ['3', 'mes-gateway', 'mes_user', 'host.example.com', '2026-11-08 14:00', '1'],
    ['4', 'etl-bridge', 'etl_user', 'app.example.com', '2026-11-07 16:40', '1'],
  ])}
  ${card('在线调试', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div>
        ${field('MQTT Broker 连接地址', input({ 'data-mqtt-broker': '1', 'data-req': '1', 'data-err': '请输入MQTT Broker 连接地址!' }, 'ws://host.example.com:32580/mqtt'), { required: true, err: '请输入MQTT Broker 连接地址!' })}
        ${field('客户端ID', input({ 'data-req': '1', 'data-err': '请输入客户端ID' }, 'supos-debug-client'), { required: true, err: '请输入客户端ID' })}
        ${field('连接状态', '<span class="tag err" data-mqtt-state>断开</span>')}
        <div class="btn-row" style="margin-left:128px"><button class="btn primary" data-op="mqtt-toggle" data-mqtt-btn>连接</button></div>
        <div style="height:1px;background:var(--flash-border);margin:12px 0"></div>
        ${field('选择工厂模型节点', input({ readonly: '', 'data-mqtt-node': '1' }, '', '请选择工厂模型节点') + '<button class="btn sm" data-op="mqtt-pick" style="margin-left:6px">选择节点</button>')}
        ${field('订阅Topic', input({ 'data-mqtt-topic': '1' }, '', 'uns/注塑车间/注塑机01/温度'))}
        ${field('QoS', select(['0', '1', '2']))}
        <div class="btn-row" style="margin-left:128px">
          <button class="btn primary" data-op="mqtt-sub">开始订阅</button>
          <button class="btn" data-op="mqtt-unsub">取消订阅</button>
        </div>
      </div>
      <div>
        <div class="pane-head"><b>已订阅 Topic</b><span class="muted">点击 ✕ 移除</span></div>
        <div data-mqtt-topics style="display:flex;flex-wrap:wrap;gap:8px"><span class="muted">暂无订阅</span></div>
        <div class="note" style="margin-top:14px">连接状态：连通 / 连接中 / 断开 / 重连中；Broker 地址默认 ws(s)://host:32580/mqtt，校验「Broker地址必须以ws://或wss://开头」；连接按钮文案：连接 / 断开连接 / 正在连接中... / 断线重连中...。</div>
      </div>
    </div>`)}
`;

/* ── MCP ── */
const mcpCards = [
  ['supOS-UNS MCP Server', '提供工厂模型目录、位号查询与实时订阅工具', '6', 'var(--flash-primary)', 'U'],
  ['supOS-数据服务 MCP Server', '提供实时/历史数据查询与订阅工具', '4', 'var(--flash-success)', '数'],
  ['supOS-OpenAPI MCP Server', '将已注册开放接口封装为 MCP 工具', '3', 'var(--flash-warning)', 'O'],
].map(([n, o, c, clr, g]) => `
  <a class="card" href="#" data-op="mcp-detail" data-name="${esc(n)}" style="display:block">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span class="quick-icon glyph" style="background:${clr}">${g}</span>
      <div style="min-width:0"><b style="font-size:13px;color:var(--flash-text-strong)">${esc(n)}</b>
        <div class="muted" style="margin-top:2px">${esc(o)}</div></div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--flash-text-secondary)">含 ${c} 个工具</div>
  </a>`).join('');
const mcpPane = `
  ${note('supOS MCP Servers，基于MCP协议，将 supOS 工厂模型与数据服务封装为标准 MCP 工具，供外部 Agent 调用。')}
  ${realToolbar('<input style="width:220px;height:28px" placeholder="请输入名称或功能描述" data-mcp-search>', '', 3)}
  <div class="grid cols-3" data-mcp-list>${mcpCards}</div>
  <div class="empty" data-mcp-empty hidden><div class="empty-mark">▤</div><span>暂无 supOS MCP Servers</span></div>
`;

/* ── 事件开放 ── */
const evLink = (n) => `<a href="#" style="color:var(--flash-primary)" data-op="event-detail" data-name="${esc(n)}">查看</a>`;
const eventPane = `
  <div class="split sider-main">
    ${card('事件菜单', `
      <input style="width:100%;height:28px" placeholder="请输入名称搜索">
      <div class="tree" data-tree style="margin-top:8px">
        <div class="tree-row" data-ev="设备事件"><b>设备事件</b><span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row" data-ev="设备报警事件" style="padding-left:24px">设备报警事件</div>
        <div class="tree-row" data-ev="注塑机离线事件" style="padding-left:24px">注塑机离线事件</div>
        <div class="tree-row" data-ev="生产事件"><b>生产事件</b><span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row" data-ev="工单完成事件" style="padding-left:24px">工单完成事件</div>
        <div class="tree-row" data-ev="库存不足事件" style="padding-left:24px">库存不足事件</div>
      </div>`)}
    <div data-ev-area>
      <div data-subwrap>
        <div class="tabs">
          <a data-subtab="em" class="is-active">事件管理</a>
          <a data-subtab="es">事件订阅</a>
        </div>
        <div data-subpane="em">
          <div data-ev-empty class="empty"><div class="empty-mark">▤</div><span>请先选择左侧菜单</span></div>
          <div data-ev-panel hidden>
            ${realToolbar(searchBox('事件名称'), '', 4)}
            ${table(['事件名称', '事件显示名称', '备注', '数据结构描述'], [
              ['<span data-evgroup="设备事件">设备报警事件</span>', '设备报警', 'PLC 报警位触发', evLink('设备报警事件')],
              ['<span data-evgroup="设备事件">注塑机离线事件</span>', '注塑机离线', '采集心跳超时', evLink('注塑机离线事件')],
              ['<span data-evgroup="生产事件">工单完成事件</span>', '工单完成', 'MES 报工完成回调', evLink('工单完成事件')],
              ['<span data-evgroup="生产事件">库存不足事件</span>', '库存不足', '原料库存低于安全库存', evLink('库存不足事件')],
            ])}
          </div>
        </div>
        <div data-subpane="es" hidden>
          ${realToolbar(`${searchBox('订阅名称')}${searchBox('事件名称')}${searchBox('事件分组')}${searchBox('主题名称')}`, '', 2)}
          ${table(['订阅名称', '订阅显示名称', '传输类型', '传输地址', '最大拉取事件', '事件确认方式', '事件名称', '事件分组', '主题名称', '订阅创建时间'], [
            ['sub-alarm-01', '设备报警订阅', 'KAFKA', 'kafka://host.example.com:9092/alarm', '100', '自动确认', '设备报警事件', '设备事件', 'alarm-topic', '2026-10-20 11:00'],
            ['sub-order-02', 'MES 工单订阅', 'MQTT', 'mqtt://host.example.com:31883/order', '50', '手动确认', '工单完成事件', '生产事件', 'order-topic', '2026-10-25 14:30'],
          ])}
        </div>
      </div>
    </div>
  </div>`;

const body = `
  ${tabs([['api', 'API 目录'], ['ws', 'WebSocket'], ['mqtt', 'MQTT'], ['mcp', 'MCP'], ['event', '事件开放']])}
  ${pane('api', apiPane, true)}
  ${pane('ws', wsPane)}
  ${pane('mqtt', mqttPane)}
  ${pane('mcp', mcpPane)}
  ${pane('event', eventPane)}
`;

export const def = {
  title: 'OpenAPI 开放',
  desc: 'API 目录 / WebSocket / MQTT / MCP / 事件开放 统一开放入口（二级交互：服务用户 / 在线调试 / MCP 详情 / 事件详情）',
  crumb: ['设计期', 'AI 与工具', 'OpenAPI 开放'],
  actions: '', ownToolbar: true, body, js: [S],
};
