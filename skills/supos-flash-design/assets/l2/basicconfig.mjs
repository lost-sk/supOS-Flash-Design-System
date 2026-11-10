/* 设计期 · 系统设置 · 基础配置（L2）
 * 规格：.cache/flash-l2-specs/06-sysconfig-org.md
 * 源码：supbase-frontend-main/src/pages/Setting（ThemeConfig / MenuConfig / Security/CommonSetting） */
import { esc, table, card, note, realToolbar, searchBox, tabs, pane, field, input, select } from './helpers.mjs';

const S = 'assets/page/basicconfig.js';

/* ── 通用小件（field 默认 f-ctrl 限宽，上传/单选/开关组需撑满，故用 xfld） ── */
const xfld = (label, inner, { req = false, err = '', extra = '', attrs = '' } = {}) =>
  `<div class="field" style="align-items:flex-start" ${attrs}>
    <label style="width:120px;flex:none;padding-top:7px"><span class="${req ? 'req' : ''}">${esc(label)}</span></label>
    <div class="f-ctrl" style="flex:1;max-width:none">
      ${inner}
      ${err ? `<div class="f-err">${esc(err)}</div>` : ''}
      ${extra ? `<div class="f-extra">${extra}</div>` : ''}
    </div>
  </div>`;
const sw = (on) => `<label class="switch"><input type="checkbox"${on ? ' checked' : ''}><i></i></label>`;
const chk = (t, attrs = '') => `<label style="width:auto"><input type="checkbox" ${attrs}> ${esc(t)}</label>`;
const rad = (t, name, attrs = '') => `<label style="width:auto"><input type="radio" name="${name}" ${attrs}> ${esc(t)}</label>`;
const up = (key, pad = '18px') => `<div class="uploader" data-upload="${key}" style="padding:${pad}"><span class="up-ico">＋</span><span>点击或拖拽上传</span></div>`;
const selSearch = (label, opts) => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">${esc(label)}
  <select style="width:120px;height:28px"><option>请选择</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></span>`;
const HELP_UPLOAD = '请上传小于 5M 的ICO、JPG、GIF、SVG、JPEG或PNG文件。推荐尺寸 logo：宽度等于280px / 背景：1920px * 1080px / 标语：宽度等于530px';
const tipIco = `<span data-tip="${esc(HELP_UPLOAD)}" style="cursor:help;color:var(--flash-primary);border:1px solid var(--flash-primary);border-radius:50%;width:14px;height:14px;display:inline-grid;place-items:center;font-size:10px;vertical-align:-2px;margin-left:4px">?</span>`;

/* ── 页签1 · 登录页设置（ThemeConfig → pages/Theme/LoginConfig） ── */
const loginPreview = `
  <div data-login-preview style="position:relative;height:230px;border:1px solid var(--flash-border);border-radius:var(--flash-radius-lg);overflow:hidden;background:linear-gradient(135deg,var(--flash-primary-soft),var(--flash-bg-subtle))">
    <div data-pv="logo" style="position:absolute;top:12px;left:14px;width:96px;height:26px;border:1px dashed var(--flash-border-strong);border-radius:4px;display:grid;place-items:center;font-size:10px;color:var(--flash-text-tertiary);background:var(--flash-bg-subtle)">LOGO</div>
    <div style="position:absolute;top:16%;left:66%;width:27%;min-width:150px;padding:14px;background:var(--flash-bg-container);border:1px solid var(--flash-border);border-radius:var(--flash-radius)">
      <div style="font-size:11px;color:var(--flash-text-strong);margin-bottom:10px">用户登录</div>
      <div style="height:24px;border:1px solid var(--flash-border);border-radius:3px;margin-bottom:8px;background:var(--flash-bg-subtle)"></div>
      <div style="height:24px;border:1px solid var(--flash-border);border-radius:3px;margin-bottom:12px;background:var(--flash-bg-subtle)"></div>
      <div style="height:24px;border-radius:3px;background:var(--flash-primary)"></div>
    </div>
    <div data-pv="slogan" style="position:absolute;bottom:36px;left:14px;width:190px;height:22px;border:1px dashed var(--flash-border-strong);border-radius:4px;display:grid;place-items:center;font-size:10px;color:var(--flash-text-tertiary);background:var(--flash-bg-subtle)">标语</div>
    <div style="position:absolute;bottom:10px;width:100%;text-align:center;font-size:10px;color:var(--flash-text-tertiary)"><span data-pv="copyright">© 版权标记</span></div>
  </div>`;
const loginPane = `
  <div class="pane-head"><b>系统登录页配置${tipIco}</b></div>
  <div class="split main-aside">
    <div class="card" data-login-card>
      ${xfld('LOGO', up('logo'))}
      ${xfld('背景', up('bg'))}
      ${xfld('标语', up('slogan'))}
      ${xfld('版权标记', `<div style="display:flex;align-items:center;gap:8px">
        <input maxlength="60" data-copy-input placeholder="请输入版权标记" style="flex:1">
        <span class="muted" data-copy-count>0/60</span></div>`)}
      <div class="btn-row" style="margin-top:8px">
        <button class="btn primary" data-op="login-save">保存</button>
        <button class="btn" data-op="login-reset">恢复默认</button>
      </div>
    </div>
    <div>${card('实时预览', loginPreview)}</div>
  </div>`;

/* ── 页签2 · 顶部导航栏设置（LOGO 必填「请上传LOGO!」推荐 84*28px） ── */
const navPane = `
  <div class="card" style="max-width:720px" data-nav-card>
    ${xfld('LOGO',
      `<input type="text" hidden data-upload-val data-req="1" data-err="请上传LOGO!">${up('navlogo')}`,
      { req: true, err: '请上传LOGO!', extra: '推荐尺寸 84*28px' })}
    <div class="btn-row" style="margin-top:8px">
      <button class="btn primary" data-op="nav-save">保存</button>
      <button class="btn" data-op="nav-reset">恢复默认</button>
    </div>
  </div>`;

/* ── 页签3 · favicon设置（图标必填「请上传favicon 图标!」，系统标题默认 supOS X 工厂操作系统） ── */
const faviconPane = `
  <div class="card" style="max-width:720px" data-favicon-card>
    ${xfld('favicon 图标',
      `<input type="text" hidden data-upload-val data-req="1" data-err="请上传favicon 图标!">${up('favicon')}`,
      { req: true, err: '请上传favicon 图标!' })}
    ${field('系统标题', input({ maxlength: '50', value: 'supOS X 工厂操作系统' }))}
    <div class="btn-row" style="margin-top:8px">
      <button class="btn primary" data-op="favicon-save">保存</button>
    </div>
  </div>`;

/* ── 页签4 · 菜单配置（pages/Setting/MenuConfig：左拖拽树 + 右搜索表格） ── */
const ST_ON = '<span class="dot-status" style="color:var(--flash-status-running)">启用</span>';
const ST_OFF = '<span class="dot-status" style="color:var(--flash-error)">停用</span>';
const menuTree = `<div class="tree" data-menu-tree>
  <div class="tree-row is-active">全部菜单</div>
  <div class="tree-children">
    <div class="tree-row"><span class="dot on"></span>数据平台</div>
    <div class="tree-children">
      <div class="tree-row"><span class="dot on"></span>数据源注册</div>
      <div class="tree-row"><span class="dot on"></span>数据接入服务</div>
    </div>
    <div class="tree-row"><span class="dot on"></span>AI 与工具</div>
    <div class="tree-children">
      <div class="tree-row"><span class="dot on"></span>Copilot</div>
      <div class="tree-row"><span class="dot on"></span>知识库</div>
    </div>
    <div class="tree-row"><span class="dot on"></span>APP 管理</div>
    <div class="tree-children">
      <div class="tree-row"><span class="dot on"></span>APP 运行管理</div>
    </div>
    <div class="tree-row"><span class="dot off"></span>报表中心</div>
    <div class="tree-row"><span class="dot on"></span>系统设置</div>
    <div class="tree-children">
      <div class="tree-row"><span class="dot on"></span>基础配置</div>
      <div class="tree-row"><span class="dot on"></span>企业运营配置</div>
    </div>
  </div>
</div>`;
const MENUS = [
  ['SYS_DATASOURCE', '数据源注册', 1, '当前窗口', '系统自带', '/design-datasource.html', '显示', 'PC端、移动端', 'demo_user', '2026-11-02 14:22'],
  ['SYS_CONNECT', '数据接入服务', 1, '当前窗口', '系统自带', '/design-data-connect.html', '显示', 'PC端', 'demo_user', '2026-11-03 09:10'],
  ['AI_COPILOT', 'Copilot', 1, '当前窗口', '综合开发工具', '/design-copilot.html', '显示', 'PC端', 'demo_user2', '2026-10-25 11:02'],
  ['APP_RUNTIME', 'APP 运行管理', 1, '新建窗口', 'app运行管理', '/design-apps.html', '显示', 'PC端、移动端', 'admin', '2026-10-01 08:00'],
  ['RPT_CENTER', '报表中心', 0, '当前窗口', '报表开发工具', '/report.html', '隐藏', 'PC端', 'admin', '2026-09-12 10:00'],
  ['SYS_BASIC', '基础配置', 1, '当前窗口', '系统自带', '/design-basic-config.html', '显示', 'PC端', 'admin', '2026-11-06 16:40'],
  ['SYS_ENTER', '企业运营配置', 1, '当前窗口', '菜单新增', '/design-enterprise-config.html', '显示', 'PC端', 'admin', '2026-11-06 16:41'],
];
const menuRows = MENUS.map(([code, name, on, open, src, url, vis, term, user, time], i) => [
  `<input type="checkbox" aria-label="选择${esc(name)}">`,
  String(i + 1),
  `<span class="mono">${esc(code)}</span>`,
  esc(name),
  `<span data-stcell>${on ? ST_ON : ST_OFF}</span>`, /* 状态单元格（挂点 data-stcell，供 JS 切换） */
  esc(open),
  esc(src),
  `<span class="mono">${esc(url)}</span>`,
  esc(vis),
  esc(term),
  esc(user),
  esc(time),
  `<span class="link-ops"><a href="#" data-op="m-edit" data-name="${esc(name)}">编辑</a><a href="#" data-op="m-copy" data-name="${esc(name)}">复制</a><a href="#" data-op="m-toggle" data-toggle-link data-name="${esc(name)}">${on ? '停用' : '启用'}</a></span>`,
]);
const menuPane = `
  <div class="split tree-main">
    ${card('菜单树', `${menuTree}${note('菜单树支持拖拽排序（源码提示：「无法将菜单移动至根节点平级或第一项！」）。')}`)}
    <div>
      ${realToolbar(
        `${searchBox('菜单名称')}${searchBox('自定义名称')}${selSearch('状态', ['启用', '停用'])}${searchBox('URL')}${searchBox('更新人')}`,
        `<button class="btn primary" data-op="menu-add">＋ 新增</button><button class="btn" data-op="menu-enable">启用</button><button class="btn" data-op="menu-disable">停用</button>`,
        7)}
      <div data-menu-table>
        ${table(['', '序号', '菜单编号', '菜单名称', '状态', '打开方式', '菜单来源', 'URL', '菜单栏显隐', '所属终端', '更新人', '更新时间', '操作'], menuRows)}
      </div>
      ${note('「数据字典」子菜单在线上存在，但其前端源码不在 supbase 工作区（仅 systemcode 后端 API：模块→编码→编码值），故本页未还原文典 UI。', true)}
    </div>
  </div>`;

/* ── 页签5 · 安全策略（小页签：应用防护 / 访问黑白名单 / 密码策略 / 会话超时） ── */
const secXss = `
  <div class="card" style="max-width:760px">
    ${field('允许以下域名跨域访问', input())}
    ${xfld('子域共享cookie', sw(false))}
    ${xfld('路径泄露防护', sw(true))}
    ${field('敏感信息脱敏处理', select(['完全脱敏', '关闭'], {}, '完全脱敏'))}
    <div class="btn-row" style="margin-top:8px"><button class="btn primary" data-op="xss-save">确定</button></div>
  </div>`;
const BL_ROWS = [['host.example.com', '2026-11-02 14:22'], ['192.0.2.*', '2026-10-28 15:31'], ['host.example.com', '2026-09-30 08:00']]
  .map(([ip, t], i) => `<tr><td><input type="checkbox" aria-label="选择${esc(ip)}"></td><td>${i + 1}</td><td class="mono">${esc(ip)}</td><td>${t}</td><td><a href="#" class="danger" data-op="ip-del" data-name="${esc(ip)}">删除</a></td></tr>`).join('');
const secBl = `
  <div class="card">
    ${xfld('设置模式', `<div style="display:flex;gap:16px;padding-top:6px">${rad('白名单', 'bl-mode', 'value="white" checked')}${rad('黑名单', 'bl-mode', 'value="black"')}</div>`)}
    ${note('黑名单或白名单只能设置其中一个。设置后如果要切换设置模式，只能清除已维护数据、才能切换', true)}
    ${note('白名单：只有名单内 IP 能访问 supOS；首次添加自动加入当前终端 IP。')}
    ${realToolbar('',
      `<button class="btn primary" data-op="ip-add" data-ip-add>新增白名单IP</button><button class="btn" data-op="ip-batch-del">删除</button>`, 3)}
    <div data-ip-table>
      ${table(['', '序号', '访问IP', '加入时间', '操作'], [])}
    </div>
  </div>`;
const secPwd = `
  <div class="card" style="max-width:860px" data-pwd-card>
    ${xfld('密码必须包含', `<div style="display:flex;gap:16px;flex-wrap:wrap;padding-top:6px">${chk('大小写字母', 'checked')}${chk('数字', 'checked')}${chk('特殊字符')}</div><div class="f-extra">特殊字符仅支持!@#$%^&*();'?.,</div>`)}
    ${xfld('密码长度', `<div style="display:flex;align-items:center;gap:8px;padding-top:4px">
      <input type="number" value="8" min="8" max="32" data-pwd-min style="width:90px"><span class="muted">~</span>
      <input type="number" value="32" min="8" max="32" data-pwd-max style="width:90px"></div><div class="f-err">最小值不能大于最大值</div>`,
      { attrs: 'data-len-field' })}
    ${xfld('首次登录修改密码', sw(true))}
    ${xfld('密码使用期限', `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${sw(true)}<span class="muted">密码更新周期</span><input type="number" value="90" min="1" style="width:90px"><span class="muted">天</span></div>`)}
    ${xfld('密码锁定', `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${sw(true)}<span class="muted">密码错误次数</span><input type="number" value="5" min="1" style="width:80px"><span class="muted">次</span><span class="muted">锁定时间</span><input type="number" value="30" min="1" style="width:80px"><span class="muted">分钟</span><label style="width:auto"><input type="checkbox"> 永久</label></div>`)}
    ${xfld('验证码', sw(true))}
    <div class="btn-row" style="margin-top:8px">
      <button class="btn primary" data-op="pwd-save">确定</button>
      <button class="btn" data-op="pwd-reset">恢复默认</button>
    </div>
  </div>`;
const secSso = `
  <div class="card" style="max-width:760px" data-sso-card>
    ${xfld('移动端登录过期时间', `<div style="display:flex;align-items:center;gap:8px"><input type="number" value="1440" min="1" style="width:110px">${select(['分钟', '小时', '天'], { style: 'width:90px' })}</div>`)}
    ${xfld('网页端登录过期时间', `<div style="display:flex;align-items:center;gap:8px"><input type="number" value="8" min="1" style="width:110px">${select(['分钟', '小时', '天'], { style: 'width:90px' }, '小时')}</div>`)}
    ${xfld('唯一登录', `<div style="display:flex;gap:16px;flex-wrap:wrap;padding-top:6px">${rad('多端分别唯一登录', 'sso')}${rad('多端共同唯一登录', 'sso')}</div><div class="f-err">请选择唯一登录！</div>`,
      { req: true, attrs: 'data-sso-field' })}
    <div class="btn-row" style="margin-top:8px">
      <button class="btn primary" data-op="sso-save">确定</button>
      <button class="btn" data-op="sso-reset">恢复默认</button>
    </div>
  </div>`;
const secPane = `
  <div data-tabgrp>
    ${tabs([['sec-xss', '应用防护'], ['sec-bl', '访问黑白名单'], ['sec-pwd', '密码策略'], ['sec-sso', '会话超时']])}
    ${pane('sec-xss', secXss, true)}
    ${pane('sec-bl', secBl)}
    ${pane('sec-pwd', secPwd)}
    ${pane('sec-sso', secSso)}
  </div>`;

const body = `
  <div data-tabgrp>
    ${tabs([['login', '登录页设置'], ['navbar', '顶部导航栏设置'], ['favicon', 'favicon设置'], ['menu', '菜单配置'], ['security', '安全策略']])}
    ${pane('login', loginPane, true)}
    ${pane('navbar', navPane)}
    ${pane('favicon', faviconPane)}
    ${pane('menu', menuPane)}
    ${pane('security', secPane)}
  </div>`;

/* 供 JS 复用的枚举与文案见 assets/page/basicconfig.js */
export const def = {
  title: '基础配置',
  desc: '登录页与顶部导航视觉、favicon、菜单结构与安全策略（二级交互：上传实时预览 / 菜单抽屉 / 黑白名单 / 密码策略 / 会话超时）',
  crumb: ['设计期', '系统设置', '基础配置'],
  actions: '',
  ownToolbar: true,
  body,
  js: [S],
};
