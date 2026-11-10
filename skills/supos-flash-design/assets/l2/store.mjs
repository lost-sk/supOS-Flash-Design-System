/* 设计期 · 应用商店 · 已购应用（L2）
 * 规格：.cache/flash-l2-specs/05-openapi-apps-store.md
 * 源码：supbase-frontend-main/src/pages/AppStore（已购应用页 / 选择版本 / 在线安装 / 订单明细） */
import { esc, tag, table, note, realToolbar, searchBox } from './helpers.mjs';

const S = 'assets/page/store.js';

const appCell = (name, ver) => `<span style="display:inline-flex;align-items:center;gap:8px"><img src="assets/brand/app-logo-default.png" style="width:28px;height:28px;object-fit:contain;border-radius:6px" alt=""><span>${esc(name)}<span class="muted" style="margin-left:6px">${esc(ver)}</span></span></span>`;
const ST = {
  已安装: '<span data-stcell><span class="dot-status" style="color:var(--flash-installed)">已安装</span></span>',
  待升级: '<span data-stcell><span class="tag warn">待升级</span></span>',
  未安装: '<span data-stcell><span class="dot-status" style="color:var(--flash-primary)">未安装</span></span>',
  安装中: '<span data-stcell><span class="dot-status" style="color:var(--flash-status-pending)">⟳ 安装中</span></span>',
};
const opCell = (name, canInstall = true) => `<span class="link-ops"><a href="#" data-op="download" data-name="${esc(name)}">下载</a>${canInstall ? `<a href="#" data-op="install" data-name="${esc(name)}">在线安装</a>` : '<span class="muted" style="margin-right:8px">在线安装</span>'}</span>`;
const orderCell = (name) => `<a href="#" style="color:var(--flash-primary)" data-op="order" data-name="${esc(name)}">明细</a>`;

const rows = table(['APP名称', 'APP类型', '版本号', '安装状态', '开发者', '订单', '操作'], [
  [appCell('APS 高级计划与排程系统', 'v2.0.1'), '高代码开发应用', '2.0.1', ST.已安装, '蓝卓supOS', orderCell('APS 高级计划与排程系统'), opCell('APS 高级计划与排程系统')],
  [appCell('设备管理系统', 'v2.3.5'), '高代码开发应用', '2.3.6', ST.待升级, '精达集团', orderCell('设备管理系统'), opCell('设备管理系统')],
  [appCell('汽配生产报工', 'v1.2.0'), '轻应用', '1.2.0', ST.未安装, '蓝卓supOS', orderCell('汽配生产报工'), opCell('汽配生产报工')],
  [appCell('水泥窑煅烧与环保智能预警', 'v1.0.8'), '轻应用', '1.0.8', ST.安装中, '蓝卓supOS', orderCell('水泥窑煅烧与环保智能预警'), opCell('水泥窑煅烧与环保智能预警', false)],
]);

const body = `
  <div style="margin-bottom:4px"><a href="design-apps.html">← 返回APP运行管理</a></div>
  ${realToolbar(searchBox('名称'), '<button class="btn">刷新</button>', 4)}
  ${rows}
  ${note('安装状态：安装中 / 待升级 / 已安装 / 未安装；在线安装前需选择版本类型（标准版(SE) / 定制版(CE)）与版本号，版本不在当前 supOS 允许范围内时无法安装。')}
`;

export const def = {
  title: '应用商店',
  desc: '已购应用列表与在线安装（二级交互：选择版本 / 在线安装 / 订单明细）',
  crumb: ['设计期', '应用商店'],
  actions: '', ownToolbar: true, body, js: [S],
};
