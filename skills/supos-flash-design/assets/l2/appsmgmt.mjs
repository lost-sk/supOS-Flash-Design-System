/* 设计期 · APP 运行管理（L2）
 * 规格：.cache/flash-l2-specs/05-openapi-apps-store.md
 * 源码：supbase-frontend-main/src/pages/AppRuntimeManage（tabs/AppToolbar/createColumns/AppRowActions/useAppActions/TaskQueueModal） */
import { esc, tag, note } from './helpers.mjs';

const S = 'assets/page/appsmgmt.js';

/* ── CountTabs（config/tabs.ts:58-130，默认智能体应用） ── */
const TABS = [
  ['agent', '智能体应用', 2], ['highCode', '高代码开发应用', 2], ['lowCode', '低代码', 1],
  ['light', '轻应用', 1], ['module', '平台扩展应用', 2], ['plugin', '平台扩展插件', 0], ['all', '全部', 8],
];
const tabsHtml = `<div class="tabs" data-apptabs>${TABS.map(([id, label, n], i) =>
  `<a href="#" data-apptab="${id}" data-label="${esc(label)}" class="${i === 0 ? 'is-active' : ''}">${esc(label)}<span class="muted" style="margin-left:4px">${n}</span></a>`).join('')}</div>`;

/* ── 行状态与操作（createColumns.tsx / AppRowActions.tsx 语义） ── */
const STATUS = {
  RUNNING: ['运行中', 'var(--flash-status-running)'],
  UN_RUNNING: ['已停止', 'var(--flash-error)'],
  PENDING: ['启动中', 'var(--flash-status-pending)'],
};
const stCell = (s) => `<span data-stcell><span class="dot-status" style="color:${STATUS[s][1]}">${STATUS[s][0]}</span></span>`;
const L = (op, t) => `<a href="#" data-op="${op}">${t}</a>`;
const opsCell = (state) => {
  if (state === 'PENDING') return `<td data-opscell><span class="link-ops">${L('cfg', '配置')}${L('row-stop', '停止')}</span></td>`;
  if (state === 'RUNNING') return `<td data-opscell><span class="link-ops">${L('cfg', '配置')}${L('row-stop', '停止')}${L('upgrade', '升级')}<span class="muted" style="margin-right:8px">卸载</span></span></td>`;
  return `<td data-opscell><span class="link-ops">${L('cfg', '配置')}${L('row-start', '启动')}${L('upgrade', '升级')}${L('row-uninstall', '卸载')}</span></td>`;
};

/* ── 示例 APP 行（类型枚举：agent/highCode/lowCode/light/module/plugin） ── */
const APPS = [
  ['生产运维助手', '运维Agent', 'agent', '智能体应用', 'info', 'RUNNING', '2.1.0', '蓝卓supOS', 'cpu: 1、内存: 512Mi', '2027-12-31', '2026-11-01 10:00', '2026-11-09 15:20'],
  ['数智BI智能体', 'BI问数', 'agent', '智能体应用', 'info', 'UN_RUNNING', '1.4.2', '蓝卓supOS', 'cpu: 1、内存: 512Mi', '2027-06-30', '2026-10-12 09:00', '2026-11-05 11:40'],
  ['汽配车间实时孪生', '孪生大屏', 'highCode', '高代码开发应用', '', 'RUNNING', '3.0.1', '字航科技', 'cpu: 2、内存: 1Gi', '2027-03-15', '2026-09-20 14:00', '2026-11-08 16:00'],
  ['设备管理系统', 'EMS', 'highCode', '高代码开发应用', '', 'UN_RUNNING', '2.3.5', '精达集团', 'cpu: 2、内存: 2Gi', 'OVERDUE', '2026-08-15 10:30', '2026-10-30 09:00'],
  ['汽配生产报工', '报工', 'lowCode', '低代码', '', 'RUNNING', '1.2.0', '蓝卓supOS', 'cpu: 1、内存: 512Mi', '2027-01-01', '2026-10-01 08:00', '2026-11-02 10:00'],
  ['水泥窑煅烧与环保智能预警', '窑况预警', 'light', '轻应用', '', 'RUNNING', '1.0.8', '蓝卓supOS', 'cpu: 1、内存: 512Mi', '2026-12-31', '2026-11-03 09:00', '2026-11-03 09:00'],
  ['ETL 数据集成', 'ETL', 'module', '平台扩展应用', 'warn', 'UN_RUNNING', '5.2.0', '蓝卓supOS', 'cpu: 2、内存: 2Gi', '2098-12-31', '2026-07-10 10:00', '2026-09-01 09:00'],
  ['OPC UA 连接器', '采集连接器', 'module', '平台扩展应用', 'warn', 'RUNNING', '1.7.3', '蓝卓supOS', 'cpu: 1、内存: 512Mi', '2098-12-31', '2026-07-10 10:00', '2026-09-01 09:00'],
];
const nameCell = (n) => `<span style="display:inline-flex;align-items:center;gap:8px"><img src="assets/brand/app-logo-default.png" style="width:26px;height:26px;object-fit:contain;border-radius:6px" alt="">${esc(n)}</span>`;
const trs = APPS.map(([name, alias, type, typeLabel, cls, st, ver, dev, res, exp, ins, upd]) =>
  `<tr data-type="${type}" data-state="${st}" data-name="${esc(name)}">
    <td><input type="checkbox" aria-label="选择${esc(name)}"></td>
    <td>${nameCell(name)}</td>
    <td>${esc(alias)}</td>
    <td>${tag(typeLabel, cls)}</td>
    <td>${stCell(st)}</td>
    <td>${esc(ver)}</td>
    <td>${esc(dev)}</td>
    <td>${esc(res)}</td>
    <td>${exp === 'OVERDUE' ? '<span style="color:var(--flash-error)">已逾期</span>' : esc(exp)}</td>
    <td>${esc(ins)}</td>
    <td>${esc(upd)}</td>
    ${opsCell(st)}
  </tr>`).join('');
const appsTable = `<div class="table-wrap"><table class="flash-table" data-apptable><thead><tr>
  <th style="width:36px"></th><th>APP名称</th><th>APP别名</th><th>类型</th><th>运行状态</th><th>版本号</th><th>开发者</th><th>资源限制</th><th>到期日期</th><th>安装时间</th><th>更新时间</th><th style="width:200px">操作</th>
</tr></thead><tbody>${trs}</tbody></table></div>`;

const body = `
  ${tabsHtml}
  <div class="toolbar" data-component="Toolbar" style="flex-wrap:wrap">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input style="width:180px;height:28px" placeholder="输入名称搜索" data-app-search>
    </div>
    <span class="spacer"></span>
    <div class="btn-row" style="gap:8px">
      <button class="btn primary" data-op="install">安装</button>
      <span style="display:inline-flex">
        <button class="btn" data-op="batch-start" disabled style="border-right:0;border-radius:var(--flash-radius) 0 0 var(--flash-radius)">启动</button>
        <button class="btn" data-op="batch-stop" disabled style="border-radius:0 var(--flash-radius) var(--flash-radius) 0">停止</button>
      </span>
      <button class="btn" data-op="batch-uninstall" disabled>卸载</button>
      <button class="btn" data-op="queue">安装队列</button>
    </div>
    <span class="count">共 8 条 · 示例</span>
  </div>
  ${appsTable}
  <div class="empty" data-apps-empty hidden><div class="empty-mark">▤</div><span data-apps-empty-text></span></div>
  ${note('运行状态：RUNNING 运行中 / UN_RUNNING 已停止 / PENDING 启动中；卸载仅对「已停止」的 APP 可用，卸载确认「确认卸载"xxx"这个APP吗？」（可选保留元数据 / 删除元数据），注意: 业务数据库将在30天后自动删除。若APP重新安装，则元数据重新注册。')}
`;

export const def = {
  title: 'APP 运行管理',
  desc: '已安装 APP 的启动 / 停止 / 升级 / 卸载与安装队列（二级交互：安装 / 卸载确认 / 升级 / 安装队列）',
  crumb: ['设计期', 'APP 管理', 'APP 运行管理'],
  actions: '', ownToolbar: true, body, js: [S],
};
