/* 设计期 · APP 综合设计工具（L2 · 纯静态，无 js）
 * 规格：.cache/flash-l2-specs/05-openapi-apps-store.md
 * 源码：supbase-frontend-main/src/pages/Apps/*.tsx（全为 BaseIframeWrapper iframe 壳 → /toolkit 微前端） */
import { esc, note, section } from './helpers.mjs';

/* 入口卡片：sub 为源码实证的 url 或说明；href 为原型内可跳转页面（'#' 表示 iframe 壳无对应原型页） */
const toolCard = (name, sub, href, opts = {}) => `
  <div class="card" style="display:block;position:relative">
    ${opts.state ? `<span class="tag ${opts.stateCls || 'info'}" style="position:absolute;top:12px;right:12px;z-index:2">${esc(opts.state)}</span>` : ''}
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span class="quick-icon glyph" style="background:${opts.clr || 'var(--flash-primary)'}">${esc(name.slice(0, 1))}</span>
      <div style="min-width:0">
        <b style="font-size:13px;color:var(--flash-text-strong)">${href && href !== '#' ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</b>
        <div class="muted" style="margin-top:2px">${esc(sub)}</div>
      </div>
    </div>
    <div class="link-ops" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--flash-border)">
      <a data-tool-op style="cursor:pointer">删除</a><a data-tool-op style="cursor:pointer">更新</a><a data-tool-op style="cursor:pointer">安装</a>
    </div>
    ${opts.disabled ? `<div style="position:absolute;inset:0;z-index:1;border-radius:var(--flash-radius-lg);background:var(--flash-mask);display:flex;align-items:center;justify-content:center;color:var(--flash-text-secondary);font-size:12px;text-align:center;padding:0 14px">该模块未启用，请联系管理员安装</div>` : ''}
  </div>`;

const entries = [
  ['APP综合开发工具', '/toolkit/app-manage · iframe 壳工具', '#'],
  ['报表开发工具', '报表设计 · 新窗打开', '#', { state: '新窗打开' }],
  ['数据集成交换工具 ETL', 'ETL 数据集成交换 · iframe 壳工具', '#', { state: '检测中...', stateCls: 'info' }],
  ['元数据管理', '元数据模型登记 · iframe 壳工具', '#', { state: '安装中...', stateCls: 'info' }],
  ['系统连接器管理', '连接器与凭证 · iframe 壳工具', '#', { state: '成功', stateCls: 'ok' }],
  ['工厂模型', '/os/static/uns · UNS 目录树与位号', 'design-factory-model.html'],
  ['统一数据源注册管理', '外部库与采集源登记', 'design-datasource.html'],
  ['工作桌面', '运行期桌面视图', 'runtime-desktop.html'],
  ['Agent运行管理', 'Agent 目录与运行状态', 'design-agent.html'],
];

/* 原六类设计入口（线上实测菜单，data.json 未证实） */
const six = [
  ['报表', 'var(--flash-text-strong)'], ['工艺流程图', 'var(--flash-primary)'],
  ['首页', 'var(--flash-success)'], ['3D数字孪生', 'var(--flash-warning)', true],
  ['桌面组态', 'var(--flash-status-pending)'], ['业务DIY', 'var(--flash-error)'],
].map(([n, clr, disabled]) => `
  <div class="card" style="display:block;position:relative">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="quick-icon glyph" style="background:${clr}">${esc(n.slice(0, 1))}</span>
      <b style="font-size:13px;color:var(--flash-text-strong)">${esc(n)}</b>
    </div>
    ${disabled ? '<div style="position:absolute;inset:0;z-index:1;border-radius:var(--flash-radius-lg);background:var(--flash-mask);display:flex;align-items:center;justify-content:center;color:var(--flash-text-secondary);font-size:12px;text-align:center;padding:0 14px">该模块未启用，请联系管理员安装</div>' : ''}
  </div>`).join('');

const body = `
  ${section('APP 开发与管理工具（源码实证 · BaseIframeWrapper iframe 壳）')}
  ${note('以下入口在真实产品中均为 iframe 壳加载 /toolkit 微前端；原型中静态展示。卡片右上角为遮罩状态示例（检测中.../安装中.../成功），悬浮操作「删除/更新/安装」为静态演示，安装遮罩依次为「检测中...→安装中...→成功」。')}
  <div class="grid cols-3">${entries.map(([n, s, h, o]) => toolCard(n, s, h, o || {})).join('')}</div>
  ${section('六类设计工具入口（线上实测菜单 · 未证实）')}
  ${note('六类设计工具入口来自线上实测菜单；supbase 源码 data.json 中未见对应注册，标注未证实。')}
  <div class="grid cols-3">${six}</div>
  ${note('无权限提示文案（线上实证）：「您暂无权限访问该功能」「模块暂未授权」；功能未安装：「此功能未安装」。', true)}
`;

export const def = {
  title: 'APP 综合设计工具',
  desc: 'APP 综合开发 / 报表 / ETL / 元数据 / 连接器等设计工具入口（真实产品中均为 iframe 壳加载 /toolkit 微前端）',
  crumb: ['设计期', 'APP 管理', 'APP 综合设计工具'],
  actions: '', ownToolbar: true, body, js: [],
};
