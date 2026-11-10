#!/usr/bin/env node
/* supOS Flash Design · 原型生成器
 * node scripts/new-prototype.mjs --config <config.json> --out <dir>
 * node scripts/new-prototype.mjs --out <dir> --rebuild      （只重生成页面）
 *
 * 只读本 skill 包内 assets/，只写 --out 目录。产物离线可点、不调用接口。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(SKILL, 'assets');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  return o;
}
const copy = (src, dst) => { mkdirSync(dirname(dst), { recursive: true }); cpSync(src, dst, { recursive: true }); };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const slugify = (s) => String(s || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'app';

/* ── 注册表 ── */
const MODULES = [
  ['design-datasource.html', 'datasource'], ['design-data-connect.html', 'dataconnect'],
  ['design-factory-model.html', 'uns'], ['design-semantic.html', 'diviner'],
  ['design-storage.html', 'dlake'], ['design-fedquery.html', 'fedquery'],
  ['design-knowledge.html', 'knowledge'], ['design-llm-gateway.html', 'llmgateway'],
  ['design-copilot.html', 'copilot'], ['design-openapi.html', 'openapi'],
  ['design-apps.html', 'appsmgmt'], ['design-app-design.html', 'appdesign'],
  ['design-agent.html', 'agent'], ['design-basic-config.html', 'basicconfig'],
  ['design-enterprise-config.html', 'enterconfig'], ['design-store.html', 'store'],
];

function fullDesignNav() {
  return [
    { type: 'item', label: '首页', file: 'design-home.html', icon: 'home' },
    { type: 'group', label: '数据平台', icon: 'database', children: [
      { type: 'group', label: '连接服务', children: [
        { type: 'item', label: '数据源注册', file: 'design-datasource.html' },
        { type: 'item', label: '数据接入服务', file: 'design-data-connect.html' }] },
      { type: 'group', label: '建模服务', children: [
        { type: 'item', label: '工厂模型', file: 'design-factory-model.html' },
        { type: 'item', label: '语义模型', file: 'design-semantic.html' }] },
      { type: 'group', label: '存储服务', children: [
        { type: 'item', label: '数据库资源管理', file: 'design-storage.html' },
        { type: 'item', label: 'SQL 联邦查询', file: 'design-fedquery.html' }] },
    ] },
    { type: 'group', label: 'AI 与工具', icon: 'spark', children: [
      { type: 'item', label: '知识库', file: 'design-knowledge.html' },
      { type: 'item', label: '大模型网关', file: 'design-llm-gateway.html' },
      { type: 'item', label: 'Copilot', file: 'design-copilot.html' },
      { type: 'item', label: 'OpenAPI 开放', file: 'design-openapi.html' }] },
    { type: 'group', label: 'APP 管理', icon: 'app', children: [
      { type: 'item', label: 'APP 运行管理', file: 'design-apps.html' },
      { type: 'item', label: 'APP 综合设计工具', file: 'design-app-design.html' }] },
    { type: 'item', label: 'Agent 管理', file: 'design-agent.html', icon: 'agent' },
    { type: 'group', label: '系统设置', icon: 'setting', children: [
      { type: 'group', label: '基础配置', file: 'design-basic-config.html', children: [
        { type: 'item', label: '主题配置', file: 'design-basic-config.html#theme' },
        { type: 'item', label: '菜单配置', file: 'design-basic-config.html#menu' },
        { type: 'item', label: '数据字典', file: 'design-basic-config.html#dict' },
        { type: 'item', label: '安全策略', file: 'design-basic-config.html#security' }] },
      { type: 'group', label: '企业运营配置', file: 'design-enterprise-config.html', children: [
        { type: 'item', label: '组织管理', file: 'design-enterprise-config.html#org' },
        { type: 'item', label: '岗位与角色', file: 'design-enterprise-config.html#role' },
        { type: 'item', label: '用户与权限', file: 'design-enterprise-config.html#user' }] },
    ] },
    { type: 'item', label: '应用商店', file: 'design-store.html', icon: 'store' },
  ];
}

function buildRegistry(config, slug, appEntry) {
  const app = config.app || {};
  const menus = (app.menus && app.menus.length) ? app.menus : ['总览'];
  const withDesign = !!config.withDesign;
  const apps = {
    [slug]: {
      label: app.name || config.title || '示例应用',
      short: app.name || '应用',
      src: `apps/${slug}/${appEntry}`,
      note: app.note || '示例应用 · 离线占位数据',
      children: menus,
      route: app.route || { param: 'view' },
      navOff: app.navOff !== false,
    },
  };
  const runtimeNav = [
    { type: 'item', label: '应用首页', icon: 'home', app: slug, view: '' },
    { type: 'group', label: app.name || '应用', icon: 'app', app: slug,
      children: menus.map((m) => ({ type: 'item', label: m, app: slug, view: m })) },
  ];
  const modes = [
    { id: 'login', label: '登录页', file: 'login.html' },
    { id: 'runtime-desktop', label: '运行期 · 桌面视图', file: 'runtime-desktop.html' },
    { id: 'runtime-menu', label: '运行期 · 菜单视图', file: 'runtime-menu.html' },
    { id: 'design', label: '设计期', file: 'design-home.html' },
  ];
  const P = (file, title, group, desc) => ({ file, title, group, desc });
  const pages = [
    P('index.html', '原型总览', 'entry', '全部页面与应用入口索引'),
    P('login.html', '用户登录', 'login', '完整登录页'),
    P('runtime-desktop.html', '运行期 · 桌面视图', 'runtime', '应用 / 架构图 / 工作台 三个 tab'),
    P('runtime-menu.html', '运行期 · 菜单视图', 'runtime', '左侧菜单树 + 右侧应用内容'),
    P('design-home.html', '设计期 · 首页', 'design', '平台设计期入口（背景板）'),
  ];
  if (withDesign) {
    const names = ['数据源注册', '数据接入服务', '工厂模型', '语义模型', '数据库资源管理', 'SQL 联邦查询',
      '知识库', '大模型网关', 'Copilot', 'OpenAPI 开放', 'APP 运行管理', 'APP 综合设计工具',
      'Agent 管理', '基础配置', '企业运营配置', '应用商店'];
    MODULES.forEach(([file], i) => pages.push(P(file, names[i], 'design', '平台模块页（参考实现）')));
  }
  return { designNav: withDesign ? fullDesignNav() : [{ type: 'item', label: '首页', file: 'design-home.html', icon: 'home' }],
    runtimeNav, apps, pages, modes, P: null, account: config.account || 'admin', title: config.title || '产品原型' };
}

/* ── 页面骨架 ── */
function pageHTML({ mode, nav, title, body, scripts = [] }) {
  const tags = ['assets/data.js', 'assets/shell.js', 'assets/interact.js', ...scripts]
    .map((s) => `<script src="${s}" defer></script>`).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · supOS Flash 产品原型</title>
<link rel="stylesheet" href="assets/flash.css">
${tags}
</head>
<body data-mode="${mode}" data-nav="${nav || ''}" data-title="${esc(title)}">
${body}
</body>
</html>
`;
}

/* ── 各形态页面 ── */
function loginBody(cfg) {
  const account = esc(cfg.account || 'admin');
  return `<div class="login-surface" data-component="LoginSurface">
    <div class="login-logo"><img src="assets/brand/default_login_logo.png" alt="supOS X 工厂操作系统"></div>
    <div class="login-card" data-component="LoginCard">
      <h2>用户登录</h2>
      <div class="field"><input id="username" placeholder="请输入用户名" value="${account}" autocomplete="off"></div>
      <div class="field"><input id="password" type="password" placeholder="任意密码即可" value="" autocomplete="off"></div>
      <div class="row"><label><input type="checkbox"> 记住用户名</label><a href="#">忘记密码</a></div>
      <button class="btn primary" data-login-submit>登录</button>
    </div>
    <div class="login-hint">默认账号 ${account} · 填入任意用户名即以该身份进入 · 密码任意均视为成功</div>
    <div class="login-copyright">© 2017-2026 蓝卓数字科技有限公司 版权所有</div>
  </div>`;
}

function desktopBody(slug, appEntry, cfg) {
  const date = esc(cfg.date || new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }));
  const tab = (id, label) => `<a href="?tab=${id}" data-desk-tab-link="${id}" class="${id === 'app' ? 'is-active' : ''}">${esc(label)}</a>`;
  const arch = `<div class="desk-arch" data-component="ArchitectureMap">
    <div class="arch-layer"><div class="arch-box" style="flex:1"><b>外部 Agent 入口</b><span>WorkBuddy · 平台外智能体</span></div><div class="arch-box" style="flex:1"><b>各类 APP / Agent</b><span>${esc(cfg.app.name || '客户应用')} · 业务应用</span></div></div>
    <div class="arch-box" style="margin-bottom:10px"><b>AI 开放服务</b><span>skill 管理 · 大模型网关 · Agent Hub · MCP 能力 · 统一出口</span></div>
    <div class="arch-box" style="margin-bottom:10px"><b>建模服务</b><span>工厂模型 · 知识库 · 服务与订阅管理</span></div>
    <div class="arch-box" style="margin-bottom:10px"><b>数据开放 / 存储服务</b><span>SQL 联邦查询 · OpenAPI 开放 · 数据库资源管理</span></div>
    <div class="arch-box"><b>连接服务</b><span>数据源注册 · 数据接入服务 · 采集器</span></div>
    ${'<div class="note">平台能力分层为示例示意，具体能力以实际交付版本为准。</div>'}
  </div>`;
  const workbench = `<div class="desk-floatcard" data-component="DesktopWorkbench">
    <div class="tabs"><a href="#" class="is-active">我的待办</a><a href="#">我的已办</a><a href="#">我的发起</a></div>
    <div class="table-wrap"><table class="flash-table"><thead><tr><th>所属模块</th><th>流程名称</th><th>任务名称</th><th>创建时间</th><th>状态</th></tr></thead><tbody></tbody></table></div>
    <div class="empty"><div class="empty-mark">▤</div><span>暂无数据</span></div>
    <div class="note">示例空态 · 桌面视图的工作台是浮在渐变底上的独立卡片，与门户工作台是两套视觉语言。</div>
  </div>`;
  return `<div class="desktop-surface" data-component="DesktopSurface">
    <div class="desk-topbar">
      <div class="desk-logo"><img src="assets/brand/default_logo.svg" alt="supOS X"></div>
      <nav class="desk-tabs" data-component="DesktopTabs">${tab('app', esc(cfg.app.name || '应用'))}${tab('architecture', '架构图')}${tab('workbench', '工作台')}</nav>
      <div class="desk-topbar-right">
        <span class="desk-tag">自定义布局</span><span>${date}</span>
        <span class="desk-icon" title="通知"><img src="assets/brand/smnIcon-CBGfisYv.png" alt=""></span>
        <span class="desk-icon" title="显示桌面"><img src="assets/brand/showDesktop-CkmC1w8R.png" alt=""></span>
        <span class="flash-avatar">·</span>
      </div>
    </div>
    <div class="desk-stage">
      <div data-desk-tab="app"><iframe class="desk-frame" data-app-frame="${esc(slug)}" src="apps/${esc(slug)}/${esc(appEntry)}" title="${esc(cfg.app.name || '应用')}"></iframe></div>
      <div data-desk-tab="architecture" hidden>${arch}</div>
      <div data-desk-tab="workbench" hidden>${workbench}</div>
    </div>
    <div class="desk-footer">© 2017-2026 蓝卓数字科技有限公司 版权所有 · supOS X 工厂操作系统</div>
  </div>`;
}

function menuBody(slug, appEntry, cfg) {
  return `<div class="app-context" data-component="AppContext">
    <div class="app-context-head"><h2 id="current-app-label">${esc(cfg.app.name || '应用')}</h2><span id="current-app-note">${esc(cfg.app.note || '示例应用')}</span></div>
    <iframe class="iframe-frame" id="app-frame" src="apps/${esc(slug)}/${esc(appEntry)}" title="应用内容" data-component="AppFrame"></iframe>
  </div>`;
}

function indexBody(reg, cfg, slug, appEntry) {
  const appName = esc(cfg.app.name || '应用');
  return `<div style="max-width:1080px;margin:0 auto;padding:24px 20px 100px">
    <div class="page-head"><div><h1>${esc(cfg.title || '产品原型')}</h1><p>登录页 / 运行期（桌面视图、菜单视图）/ 设计期 —— 全部页面可点击，离线可用。</p></div></div>
    <div class="note">本原型只覆盖产品本体，不涉及官网与传播物料。所有业务数据、菜单与统计数字均为<b>示例</b>；壳层与色值来自 supOS Flash 运行期实证快照。</div>
    <div class="section-title"><span>四种形态</span></div>
    <div class="grid cols-3">
      <a class="card" href="login.html" style="display:block"><div class="card-head"><h3>登录页</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">工业插画背景 + 白色登录卡</p></a>
      <a class="card" href="runtime-desktop.html" style="display:block"><div class="card-head"><h3>运行期 · 桌面视图</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">应用 / 架构图 / 工作台 三个 tab</p></a>
      <a class="card" href="runtime-menu.html" style="display:block"><div class="card-head"><h3>运行期 · 菜单视图</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">左侧菜单树 + 右侧应用内容</p></a>
      <a class="card" href="design-home.html" style="display:block"><div class="card-head"><h3>设计期</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">平台配置语境（${cfg.withDesign ? '含 16 个模块页' : '仅首页背景板'}）</p></a>
      <a class="card" href="apps/${esc(slug)}/${esc(appEntry)}" style="display:block"><div class="card-head"><h3>${appName}（独立）</h3><span class="sub">↗</span></div><p style="color:var(--flash-text-tertiary);font-size:12px">不套壳层直接打开应用</p></a>
    </div>
    <div class="section-title"><span>全部页面（${reg.pages.length}）</span></div>
    <div class="table-wrap"><table class="flash-table"><thead><tr><th>页面</th><th>分组</th><th>说明</th></tr></thead><tbody>
      ${reg.pages.map((p) => `<tr><td><a href="${p.file}">${p.file}</a></td><td>${esc(p.group)}</td><td>${esc(p.desc)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="section-title"><span>交付说明</span></div>
    <div class="note">页面由 <code>scripts/new-prototype.mjs</code> 生成；改内容请修改 <code>prototype.config.json</code> 后重跑生成器，不要手改 HTML。验收用 <code>scripts/validate.mjs --target &lt;dir&gt;</code>。</div>
  </div>`;
}

function designHomeBody(reg, cfg) {
  const quickIcons = ['datasource', 'connect', 'uns', 'service', 'fedquery', 'openapi', 'websocket', 'mqtt', 'event', 'appmgmt'];
  const iconMap = {
    datasource: 'Metadata-BsqjsLQJ.png', connect: 'NodeRED-DlcyYFLJ.png', uns: 'UNS-fEqJOMRo.png',
    service: 'ScriptService-CRIVbvAQ.png', fedquery: 'FedQuery-BIqfPygb.png', openapi: 'OpenAPI-BJkXxu5W.png',
    websocket: 'Websocket-Btf2l0-t.png', mqtt: 'MQTT-B28yoDQ2.png', event: 'EventSub-CNgnhVgF.png', appmgmt: 'AppMgmt-DuQX471w.png',
  };
  const labels = ['数据源注册', '数据接入服务', '工厂模型', '服务与订阅管理', 'SQL 联邦查询', 'OpenAPI 开放', 'WebSocket 开放', 'MQTT 协议开放', '事件开放', 'APP 运行管理'];
  const files = reg.pages.map((p) => p.file);
  const quick = quickIcons.map((k, i) => {
    const target = cfg.withDesign && files.includes(MODULES[i] ? MODULES[i][0] : '') ? MODULES[i][0] : '#';
    return `<a class="quick-item" href="${target}"><span class="quick-icon"><img src="assets/brand/${iconMap[k]}" alt=""></span><span>${esc(labels[i])}</span></a>`;
  }).join('');
  return `<div class="tabbar" data-component="TabBar"><span class="tab">首页<span class="close">×</span></span></div>
    <div class="sys-notice" data-component="SysNotice"><img src="assets/brand/smnIcon-CBGfisYv.png" alt=""><span>系统维护通知：平台将于本周日 22:00–23:00 进行例行维护，届时部分服务短暂不可用。</span><a class="more" href="#">查看详情 ›</a></div>
    <div class="page-head"><div><h1>设计期 · 首页</h1><p>平台模块入口与运行概览 · 页面与统计均为<b>示例</b></p></div></div>
    <section class="card"><div class="card-head"><h3>常用</h3></div><div class="quick-grid">${quick}</div></section>
    <div class="section-title"><span>运行概览</span></div>
    <div class="grid cols-4">
      <div class="stat-card stat-purple"><div class="label">数据源总数</div><div class="value">40<small>个</small></div><div class="foot">示例</div></div>
      <div class="stat-card stat-blue"><div class="label">关系库数据源</div><div class="value">26<small>个</small></div><div class="foot">示例</div></div>
      <div class="stat-card stat-green"><div class="label">接入采集设备</div><div class="value">8<small>个</small></div><div class="foot">示例</div></div>
      <div class="stat-card stat-amber"><div class="label">文件夹总数</div><div class="value">425</div><div class="foot">示例</div></div>
    </div>
    <div class="note">设计期页面是 <b>supOS Flash 平台自身界面</b>，用于展示应用被配置进平台的语境，不代表本应用的功能。${cfg.withDesign ? '左侧菜单可进入 16 个模块页。' : '本原型未启用模块页（config 的 withDesign 为 false）。'}</div>`;
}

/* ── 主流程 ── */
export async function generate(config, out, opts = {}) {
  const rebuild = !!opts.rebuild;
  mkdirSync(out, { recursive: true });
  const cfgPath = join(out, 'prototype.config.json');
  if (!rebuild) writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

  const app = config.app || {};
  const slug = app.slug || slugify(app.name || 'app');
  const appEntry = app.entry || 'index.html';

  if (!rebuild) {
    /* 资产：壳层、token、品牌、交互库 */
    for (const f of ['flash.css', 'shell.js', 'interact.js']) copy(join(ASSETS, 'shell', f), join(out, 'assets', f));
    copy(join(ASSETS, 'brand'), join(out, 'assets', 'brand'));
    const tokens = ['flash-product.css', 'flash-desktop.css']
      .map((f) => readFileSync(join(ASSETS, 'tokens', f), 'utf8')).join('\n\n');
    writeFileSync(join(out, 'assets', 'tokens.css'),
      `/* 构建产物，勿手改 · 源：assets/tokens/flash-product.css + flash-desktop.css */\n${tokens}\n`, 'utf8');

    /* 客户 app 或脱敏空白 app */
    const cfgDir = opts.configDir || process.cwd();
    const srcDir = app.dir ? resolve(cfgDir, app.dir) : join(ASSETS, 'templates', 'app-blank');
    if (!isDir(srcDir)) throw new Error(`app.dir 不存在或不是目录：${srcDir}`);
    copy(srcDir, join(out, 'apps', slug));
    const entryPath = join(out, 'apps', slug, appEntry);
    if (!existsSync(entryPath)) throw new Error(`app.entry 不存在：${appEntry}`);

    if (config.withDesign) {
      copy(join(ASSETS, 'l2'), join(out, 'assets', 'l2'));
      copy(join(ASSETS, 'page'), join(out, 'assets', 'page'));
    }
  }

  const reg = buildRegistry(config, slug, appEntry);
  writeFileSync(join(out, 'assets', 'data.js'),
    `/* 生成产物，勿手改 · 源：prototype.config.json */\nwindow.FLASH = ${JSON.stringify(reg, (_k, v) => typeof v === 'function' ? undefined : v, 2)};\n`, 'utf8');

  const built = [];
  const put = (file, mode, nav, title, body, scripts) => {
    writeFileSync(join(out, file), pageHTML({ mode, nav, title, body, scripts }), 'utf8');
    built.push(file);
  };
  put('index.html', 'design', '', '原型总览', indexBody(reg, config, slug, appEntry));
  put('login.html', 'login', 'login.html', '用户登录', loginBody(config));
  put('runtime-desktop.html', 'runtime-desktop', 'runtime-desktop.html', '运行期 · 桌面视图', desktopBody(slug, appEntry, config));
  put('runtime-menu.html', 'runtime-menu', 'runtime-menu.html', '运行期 · 菜单视图', menuBody(slug, appEntry, config));
  put('design-home.html', 'design', 'design-home.html', '设计期 · 首页', designHomeBody(reg, config));

  if (config.withDesign) {
    const H = await import(pathToFileURL(join(ASSETS, 'l2', 'helpers.mjs')).href);
    for (const [file, mod] of MODULES) {
      const m = await import(pathToFileURL(join(ASSETS, 'l2', `${mod}.mjs`)).href);
      const def = m.def;
      if (!def) continue;
      const body = `${H.tabbar(def.title)}${H.sysNotice()}${H.crumb(...(def.crumb || []))}` +
        `${H.head(def.title, def.desc, def.actions || '')}` +
        (def.ownToolbar ? def.body : `${H.toolbar(def.title)}${typeof def.body === 'function' ? def.body() : def.body}`);
      put(file, 'design', file, def.title, body, def.js || []);
    }
  }

  if (!rebuild) {
    const routes = reg.pages.map((p) => `- \`${p.file}\` — ${p.title}`).join('\n');
    writeFileSync(join(out, 'README.md'), `# ${config.title || '产品原型'}\n\n` +
      `由 **supOS Flash Design** skill 生成。双击 \`index.html\` 即可离线打开；若浏览器限制 \`file://\` iframe，可在目录内运行 \`python3 -m http.server\` 后访问。\n\n` +
      `## 页面\n\n${routes}\n\n` +
      `## 应用\n\n- 名称：${app.name || '示例应用'}\n- 目录：\`apps/${slug}/\`\n- 菜单：${(reg.apps[slug].children || []).join(' / ')}（示例，可在 config 中修改）\n- 路由参数：\`${((app.route || {}).param || 'view')}\`\n\n` +
      `## 说明\n\n- 登录页默认账号 \`${config.account || 'admin'}\`，任意用户名与密码均视为成功，不校验、不提交任何凭据。\n- 所有业务数据、菜单、统计数字均为**示例**；壳层与色值来自 supOS Flash 运行期实证快照，非逐像素复刻。\n- 设计期页面是平台自身界面，不代表本应用功能。\n- 改内容请编辑 \`prototype.config.json\` 后重跑生成器，不要手改 HTML。\n- 验收：\`node <skill>/scripts/validate.mjs --target <本目录>\`。\n`, 'utf8');
  }
  return { out, built, pageCount: built.length, slug, withDesign: !!config.withDesign };
}

/* CLI */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const a = args();
  const out = resolve(a.out || './flash-prototype');
  let config;
  let configDir = process.cwd();
  if (a.rebuild) {
    config = JSON.parse(readFileSync(join(out, 'prototype.config.json'), 'utf8'));
  } else {
    if (!a.config || a.config === true) {
      config = JSON.parse(readFileSync(join(ASSETS, 'templates', 'prototype.config.json'), 'utf8'));
    } else {
      const p = resolve(a.config);
      configDir = dirname(p);
      config = JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  const r = await generate(config, out, { rebuild: !!a.rebuild, configDir });
  console.log(`生成 ${r.pageCount} 个页面 → ${r.out}`);
  r.built.forEach((f) => console.log('  ', f));
}
