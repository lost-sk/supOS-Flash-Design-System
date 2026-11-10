#!/usr/bin/env node
/* supOS Flash 产品原型 · 页面生成器
 * 单一数据源：assets/data.js（菜单 / 页面 / app 注册表）
 * 运行：node prototype/build-pages.mjs
 * 产出：prototype/*.html，全部静态、离线可点、不调用接口。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { def as l2Datasource } from './l2/datasource.mjs';
import { def as l2Dataconnect } from './l2/dataconnect.mjs';
import { def as l2Uns } from './l2/uns.mjs';
import { def as l2Diviner } from './l2/diviner.mjs';
import { def as l2Dlake } from './l2/dlake.mjs';
import { def as l2Fedquery } from './l2/fedquery.mjs';
import { def as l2Knowledge } from './l2/knowledge.mjs';
import { def as l2LlmGateway } from './l2/llmgateway.mjs';
import { def as l2Copilot, bareBody as copilotBare } from './l2/copilot.mjs';
import { def as l2Openapi } from './l2/openapi.mjs';
import { def as l2Appsmgmt } from './l2/appsmgmt.mjs';
import { def as l2Appdesign } from './l2/appdesign.mjs';
import { def as l2Agent } from './l2/agent.mjs';
import { def as l2Basicconfig } from './l2/basicconfig.mjs';
import { def as l2Enterconfig } from './l2/enterconfig.mjs';
import { def as l2Store } from './l2/store.mjs';
import { esc, tag, crumb, head, section, card, stat, table, quick, toolbar, tabbar, sysNotice, kv, note, tabs, pane, fields } from './l2/helpers.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '..');

/* token 单一真源在仓库根 tokens/；这里同步一份到原型目录，
 * 保证 file:// 双击、或以 prototype/ 为根起 http server 时都能加载。 */
const tokenSrc = ['flash-product.css', 'flash-desktop.css']
  .map((f) => readFileSync(join(REPO, 'tokens', f), 'utf8'))
  .join('\n\n');
writeFileSync(join(ROOT, 'assets/tokens.css'),
  `/* 构建产物，勿手改 · 源：tokens/flash-product.css + tokens/flash-desktop.css */\n${tokenSrc}\n`, 'utf8');

/* 视图助手统一来自 ./l2/helpers.mjs（esc/tag/table/stat/card/section/kv/note/tabs/pane/fields…） */
const ICON = {
  datasource: 'brand/Metadata-BsqjsLQJ.png', connect: 'brand/NodeRED-DlcyYFLJ.png',
  uns: 'brand/UNS-fEqJOMRo.png', service: 'brand/ScriptService-CRIVbvAQ.png',
  fedquery: 'brand/FedQuery-BIqfPygb.png', openapi: 'brand/OpenAPI-BJkXxu5W.png',
  websocket: 'brand/Websocket-Btf2l0-t.png', mqtt: 'brand/MQTT-B28yoDQ2.png',
  event: 'brand/EventSub-CNgnhVgF.png', appmgmt: 'brand/AppMgmt-DuQX471w.png',
  appdefault: 'brand/app-logo-default.png',
};

/* ── 页面骨架 ── */
function page({ file, mode, nav, title, body, extraHead = '', scripts = [] }) {
  const scriptTags = ['assets/interact.js', ...scripts]
    .map((s) => `<script src="${s}" defer></script>`).join('\n');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · supOS Flash 产品原型</title>
<link rel="stylesheet" href="assets/flash.css">
${extraHead}
<script src="assets/data.js" defer></script>
<script src="assets/shell.js" defer></script>
${scriptTags}
</head>
<body data-mode="${mode}" data-nav="${nav || ''}" data-title="${esc(title)}">
${body}
</body>
</html>
`;
  writeFileSync(join(ROOT, file), html, 'utf8');
  return file;
}

const C = { blue: '#297bff', deep: '#0055f2', teal: '#176d88', purple: '#7b61ff', green: '#159968', orange: '#f08a24', red: '#ee493c', dark: '#323c47' };
const built = [];

/* ══════════ 1. 入口总览 ══════════ */
{
  const groups = [
    ['登录页', [['login.html', '用户登录', '完整登录页：工业 3D 插画 + 玻璃拟态标语 + 右侧登录卡']]],
    ['运行期', [
      ['runtime-desktop.html', '桌面视图', 'supOS 工业AI之旅 / 架构图 / 工作台 三个 tab'],
      ['runtime-menu.html', '菜单视图', '左侧 app 菜单 + 右侧客户 app 真实 HTML'],
      ['runtime-copilot.html', 'Copilot 工作区', 'os_ai_runtime_copilot 线上实证（supOS Copilot 工作区）'],
    ]],
    ['设计期', [
      ['design-home.html', '首页', '可调布局分组卡片门户'],
      ['design-datasource.html', '数据源注册', '数据源列表与类型分布'],
      ['design-factory-model.html', '工厂模型', 'UNS 目录树与位号'],
      ['design-semantic.html', '语义模型', '模型 / 指标 / 关系登记'],
      ['design-knowledge.html', '知识库', '文档、切片、检索'],
      ['design-llm-gateway.html', '大模型网关', '模型接入与配额'],
      ['design-copilot.html', 'Copilot', 'supOS Copilot 工作区（对话任务与执行回执）'],
      ['design-basic-config.html', '基础配置', '含 4 个子菜单'],
      ['design-enterprise-config.html', '企业运营配置', '含 3 个子菜单'],
    ]],
  ];
  const body = `<div style="max-width:1080px;margin:0 auto;padding:28px 20px 120px">
    ${head('supOS Flash · 产品原型总览', '登录页 / 运行期（桌面视图、菜单视图）/ 设计期 —— 全部页面可点击，数据为示例，离线可用。')}
    ${note('本原型只覆盖产品本体，<b>不涉及官网与传播物料</b>。色值以线上 flash01 与 <code>supbase-frontend-main/src/App.tsx</code> 实证为准，草案 v0.1 的 #1448ED 已作废。')}
    ${groups.map(([g, items]) => `${section(g)}<div class="grid cols-3">${items.map(([f, t, d]) =>
      `<a class="card" href="${f}" style="display:block"><div class="card-head"><h3>${esc(t)}</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">${esc(d)}</p></a>`).join('')}</div>`).join('')}
    ${section('全部页面')}
    ${table(['页面', '分组', '内容'], [
      ...['login', 'runtime-desktop', 'runtime-menu', 'design-home', 'design-datasource', 'design-data-connect', 'design-factory-model', 'design-semantic', 'design-storage', 'design-fedquery', 'design-knowledge', 'design-llm-gateway', 'design-copilot', 'design-openapi', 'design-apps', 'design-app-design', 'design-agent', 'design-basic-config', 'design-enterprise-config', 'design-store']
        .map((n) => [`<a href="${n}.html">${n}.html</a>`, n.startsWith('design') ? '设计期' : (n.startsWith('runtime') ? '运行期' : '登录'), '见对应页面']),
    ])}
    ${section('试用之旅 · 进度效果（同一份 HTML，按 ?state= 回放真实接口快照）')}
    <div class="grid cols-3">${[
      ['state=done5', '应用开发全完成 · 15/18', '前 5 个主题全部完成（绿勾 / 已完成徽章 / 进度环满），个人工作台未做'],
      ['state=locked', '全锁定灰态 · 0/18', '后续阶段灰态锁定、显示「待解锁」，用于与完成态对照'],
      ['state=all', '全部完成 · 18/18', '6 个主题全部完成，展示终态效果'],
    ].map(([s, t, d]) => `<a class="card" href="apps/trial-journey/progress-preview.html?${s}" style="display:block"><div class="card-head"><h3>${t}</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">${d}</p></a>`).join('')}</div>
    ${section('真实客户 app（poc/ 归档）')}
    ${table(['app', '来源', '说明'], [
      ['<a href="apps/mes/index.html">MES 制造执行管理系统</a>', 'poc/AI应用开发场景/mes_app', '9 大功能域 / 79 张表'],
      ['<a href="apps/aps/index.html">APS 高级计划与排程</a>', 'poc/AI应用开发场景/aps_system', 'MRP 净算 / 齐套 / 有限产能排程'],
      ['<a href="apps/bi/index.html">数智 BI 智能体</a>', 'poc/AI智能体开发场景/数智BI智能体', '问数智能体'],
      ['<a href="apps/qa/index.html">知识问答智能体</a>', 'poc/AI智能体开发场景/知识问答智能体', '知识库问答'],
      ['<a href="apps/trial-journey/index.html">supOS 工业AI之旅</a>', 'poc/工业AI之旅/app/trial-journey', '6 主题 18 任务'],
    ])}
  </div>`;
  built.push(page({ file: 'index.html', mode: 'design', nav: '', title: '原型总览', body }));
}

/* ══════════ 2. 登录页 ══════════ */
{
  const body = `<div class="login-surface" data-component="LoginSurface">
    <div class="login-logo"><img src="assets/brand/default_login_logo.png" alt="supOS X 工厂操作系统"></div>
    <div class="login-card" data-component="LoginCard">
      <h2>用户登录</h2>
      <div class="field"><input id="username" placeholder="请输入用户名" value="admin" autocomplete="off"></div>
      <div class="field"><input id="password" type="password" placeholder="任意密码即可" value="" autocomplete="off"></div>
      <div class="row"><label><input type="checkbox"> 记住用户名</label><a href="#">忘记密码</a></div>
      <button class="btn primary" data-login-submit>登录</button>
    </div>
    <div class="login-hint">默认账号 admin · 填入任意用户名即以该身份进入 · 密码任意均视为成功</div>
    <div class="login-copyright">© 2017-2026 蓝卓数字科技有限公司 版权所有</div>
  </div>`;
  built.push(page({ file: 'login.html', mode: 'login', nav: 'login.html', title: '用户登录', body }));
}

/* ══════════ 3. 运行期 · 桌面视图 ══════════ */
{
  const tab = (id, label) => `<a href="?tab=${id}" data-desk-tab-link="${id}" class="${id === 'journey' ? 'is-active' : ''}">${esc(label)}</a>`;
  const arch = `<div class="desk-arch" data-component="ArchitectureMap">
    <div class="arch-layer"><div class="arch-box" style="flex:1"><b>外部 Agent 入口</b><span>WorkBuddy · 千问办公 · 平台外</span></div><div class="arch-box" style="flex:1"><b>各类 APP / Agent</b><span>注塑生产应用 · MES 管理系统 · 字航 AI 管理</span></div></div>
    ${section('')}
    <div class="arch-box" style="margin-bottom:10px"><b>AI 开放服务</b><span>skill 管理 · 提示词 · 大模型网关 · Agent Hub · Flash · MCP 能力 · 统一出口</span></div>
    <div class="arch-box" style="margin-bottom:10px"><b>建模服务</b><span>工厂模型 · 知识库 · 服务与订阅管理 · 报警管理</span></div>
    <div class="arch-layer"><div class="arch-box"><b>数据开放</b><span>SQL 联邦查询 · OpenAPI 开放 · WebSocket 开放 · MQTT 协议开放 · 事件开放</span></div><div class="arch-box" style="text-align:center"><div class="arch-core">supOS Flash</div><span style="margin-top:8px">平台内核 · 统一底座</span></div><div class="arch-box"><b>存储服务</b><span>数据库资源管理 · 数据库实例回滚</span></div></div>
    <div class="arch-box"><b>连接服务</b><span>数据源注册 · 数据接入服务 · 采集器</span></div>
  </div>`;
  const workbench = `<div class="desk-floatcard" data-component="DesktopWorkbench">
    <div class="tabs"><a href="#" class="is-active">我的待办</a><a href="#">我的已办</a><a href="#">我的发起</a><a href="#" style="margin-left:auto">更多 ›</a></div>
    ${table(['所属模块', '流程名称', '任务名称', '创建时间', '发起人', '状态', '操作'], [])}
    <div class="empty"><div class="empty-mark">▤</div><span>暂无数据</span></div>
    ${note('运行期桌面视图的「工作台」是浮在渐变底上的独立卡片，与门户工作台的高密度布局是两套视觉语言。')}
  </div>`;
  const body = `<div class="desktop-surface" data-component="DesktopSurface">
    <div class="desk-topbar">
      <div class="desk-logo"><img src="assets/brand/default_logo.svg" alt="supOS X"></div>
      <nav class="desk-tabs" data-component="DesktopTabs">${tab('journey', 'supOS工业AI之旅')}${tab('architecture', '架构图')}${tab('workbench', '工作台')}</nav>
      <div class="desk-topbar-right">
        <span class="desk-tag">自定义布局</span><span>11月10日 周二</span>
        <span class="desk-icon" title="通知"><img src="assets/brand/smnIcon-CBGfisYv.png" alt=""></span>
        <span class="desk-icon" title="显示桌面"><img src="assets/brand/showDesktop-CkmC1w8R.png" alt=""></span>
        <span class="flash-avatar">S</span>
      </div>
    </div>
    <div class="desk-stage">
      <div data-desk-tab="journey"><iframe class="desk-frame" src="apps/trial-journey/progress-preview.html" title="supOS 工业AI之旅 · 进度效果"></iframe></div>
      <div data-desk-tab="architecture" hidden>${arch}</div>
      <div data-desk-tab="workbench" hidden>${workbench}</div>
    </div>
    <div class="desk-footer">© 2017-2026 蓝卓数字科技有限公司 版权所有 · supOS X 工厂操作系统</div>
  </div>`;
  built.push(page({ file: 'runtime-desktop.html', mode: 'runtime-desktop', nav: 'runtime-desktop.html', title: '运行期 · 桌面视图', body }));
}

/* ══════════ 4. 运行期 · 菜单视图 ══════════
 * 纯产品形态：左侧 supOS 运行期菜单（壳层注入），右侧直接是 app 内容 iframe，
 * 不放任何原型说明性内容。 */
{
  const body = `<iframe class="iframe-frame" id="app-frame" src="apps/mes/index.html?nav=0" title="客户应用内容" data-component="AppFrame"></iframe>`;
  built.push(page({ file: 'runtime-menu.html', mode: 'runtime-menu', nav: 'runtime-menu.html', title: '运行期 · 菜单视图', body }));
}

/* ══════════ 4b. 运行期 · Copilot 工作区 ══════════
 * 线上 /#/os_ai_runtime_copilot（scope:runtime → /os/supagent/workspace）实证；
 * 无壳层裸页，供运行期菜单视图 iframe 加载，也可直接打开。 */
built.push(page({
  file: 'runtime-copilot.html', mode: 'login', nav: '', title: '运行期 · Copilot 工作区',
  body: copilotBare, scripts: ['assets/page/copilot.js'],
}));

/* ══════════ 5. 设计期 · 首页 ══════════ */
{
  const body = `${tabbar('首页')}
    ${sysNotice()}
    <div class="home-actions" data-component="HomeActions"><span class="badge9">9</span><button class="btn sm">调整布局</button></div>
    ${card('常用', quick([
      ['数据源注册', 'design-datasource.html', ICON.datasource], ['数据接入服务', 'design-data-connect.html', ICON.connect],
      ['工厂模型', 'design-factory-model.html', ICON.uns], ['服务与订阅管理', 'design-storage.html', ICON.service],
      ['SQL 联邦查询', 'design-fedquery.html', ICON.fedquery], ['OpenAPI 开放', 'design-openapi.html', ICON.openapi],
      ['WebSocket 开放', 'design-openapi.html', ICON.websocket], ['MQTT 协议开放', 'design-openapi.html', ICON.mqtt],
      ['事件开放', 'design-openapi.html', ICON.event], ['APP 运行管理', 'design-apps.html', ICON.appmgmt],
    ]), 'design-home.html')}
    ${section('数据源管理', 'design-datasource.html')}
    ${card('', `<div class="grid cols-4">${stat('数据源总数', '40<small>个</small>', '', 'stat-purple')}${stat('关系库数据源', '26<small>个</small>', '', 'stat-blue')}${stat('接入采集设备', '8<small>个</small>', '', 'stat-green')}${stat('接入采集设备 在线/离线', '4 / 4<small>个</small>', '', 'stat-amber')}</div>`, 'design-datasource.html')}
    ${section('工厂模型', 'design-factory-model.html')}
    ${card('', `<div class="grid cols-4">${stat('文件夹总数', '425', '订阅总数：0')}${stat('文件总数', '5862', '订阅总数：2')}${stat('模板总数', '2', '订阅总数：0')}${stat('标签总数', '19', '订阅总数：0')}</div>`, 'design-factory-model.html')}
    ${section('数据库资源管理', 'design-storage.html')}
    ${card('', `<div class="grid cols-4">${stat('接入数据库', '21')}${stat('时序数据库', '1 / 1<small>个</small>')}${stat('关系数据库', '20 / 20<small>个</small>')}${stat('非关系数据库', '0 / 0<small>个</small>')}</div>`, 'design-storage.html')}
    ${section('APP 综合设计工具', 'design-app-design.html')}
    ${card('', quick([
      ['报表', 'design-app-design.html', C.dark], ['工艺流程图', 'design-app-design.html', C.blue],
      ['首页', 'design-home.html', C.purple], ['3D 数字孪生', 'design-app-design.html', C.teal],
      ['桌面组态', 'design-app-design.html', C.green], ['业务 DIY', 'design-app-design.html', C.orange],
    ]), 'design-app-design.html')}
    ${section('APP 运行管理', 'design-apps.html')}
    ${card('', `<div class="grid cols-3">${['APS 高级计划与排程系统', '设备管理系统', '汽配生产报工', '汽配车间实时孪生', '水泥窑煅烧与环保智能预警', '轻量化化工 MES'].map((n) =>
      `<a class="card" href="design-apps.html" style="display:flex;align-items:center;gap:10px;padding:10px 12px"><img src="assets/brand/app-logo-default.png" style="width:32px;height:32px;object-fit:contain"><span><span style="display:block;color:var(--flash-text-strong)">${n}</span><span style="color:var(--flash-text-tertiary);font-size:12px">运行中 · 示例</span></span></a>`).join('')}</div>`, 'design-apps.html')}`;
  built.push(page({ file: 'design-home.html', mode: 'design', nav: 'design-home.html', title: '设计期 · 首页', body }));
}

/* ══════════ 6~ 设计期模块页（L2：内容与交互在 l2/ 模块，规格见 .cache/flash-l2-specs） ══════════ */
const rows = {
  'design-datasource.html': l2Datasource,
  'design-data-connect.html': l2Dataconnect,
  'design-factory-model.html': l2Uns,
  'design-semantic.html': l2Diviner,
  'design-storage.html': l2Dlake,
  'design-fedquery.html': l2Fedquery,
  'design-knowledge.html': l2Knowledge,
  'design-llm-gateway.html': l2LlmGateway,
  'design-copilot.html': l2Copilot,
  'design-openapi.html': l2Openapi,
  'design-apps.html': l2Appsmgmt,
  'design-app-design.html': l2Appdesign,
  'design-agent.html': l2Agent,
  'design-basic-config.html': l2Basicconfig,
  'design-enterprise-config.html': l2Enterconfig,
  'design-store.html': l2Store,
};

for (const [file, def] of Object.entries(rows)) {
  /* 线上每个设计期页面都有可关闭的 tab 标签、全局系统通知条和一行工具栏。
   * L2 页面自带真实工具栏（ownToolbar），不再注入通用 toolbar()。 */
  const body = `${tabbar(def.title)}${sysNotice()}${crumb(...def.crumb)}` +
    `${head(def.title, def.desc, def.actions || '')}` +
    (def.ownToolbar ? def.body : `${toolbar(def.title)}${typeof def.body === 'function' ? def.body() : def.body}`);
  built.push(page({ file, mode: 'design', nav: file, title: def.title, body, scripts: def.js || [] }));
}

console.log(`生成 ${built.length} 个页面：`);
built.forEach((f) => console.log('  ', f));
const dataSrc = readFileSync(join(ROOT, 'assets/data.js'), 'utf8');
const registered = [...dataSrc.matchAll(/P\('([^']+\.html)'/g)].map((m) => m[1]);
const missing = registered.filter((f) => !existsSync(join(ROOT, f)));
console.log(missing.length ? `未在磁盘找到：${missing.join(', ')}` : '页面注册表与磁盘一致');
