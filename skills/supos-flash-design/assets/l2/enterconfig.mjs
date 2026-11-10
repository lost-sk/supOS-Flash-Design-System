/* 设计期 · 系统设置 · 企业运营配置（L2）
 * 规格：.cache/flash-l2-specs/06-sysconfig-org.md
 * 源码：supbase-frontend-main/src/pages/SystemConfig（UserManager / RoleManager）+ consts/systemConfig.ts（在线用户） */
import { esc, table, note, realToolbar, searchBox, tabs, pane } from './helpers.mjs';

const S = 'assets/page/enterconfig.js';

/* ── 通用小件 ── */
const selSearch = (label, opts) => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">${esc(label)}
  <select style="width:120px;height:28px"><option>请选择</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></span>`;
const ST_ON = '<span class="dot-status" style="color:var(--flash-status-running)">启用</span>';
const ST_OFF = '<span class="dot-status" style="color:var(--flash-error)">停用</span>';
const ST_IN = '<span class="dot-status" style="color:var(--flash-status-running)">在线</span>';
const ST_OUT = '<span class="muted">离线</span>';
const lockIco = (l) => (l ? '<span style="color:var(--flash-error)" title="锁定">🔒</span>' : '<span class="muted">—</span>');
const ops = (items) => `<span class="link-ops">${items}</span>`;
const L = (op, t, name, danger = false) =>
  `<a href="#" ${danger ? 'class="danger" ' : ''}data-op="${op}" data-name="${esc(name)}">${t}</a>`;

/* ── 用户管理（SystemConfig/UserManager/index.tsx） ── */
const USERS = [
  ['admin', '管理员', '平台超级管理员', 1, '', '13800000001', 'admin@example.com', '系统管理员', 1, 0, '', 'admin', '2026-10-30 09:00'],
  ['demo_user', '普通用户', '工艺工程师', 1, '阿坤', '13800000000', 'demo@example.com', '工艺工程师、安全管理员', 1, 0, '', 'demo_user', '2026-11-02 14:22'],
  ['demo_user2', '普通用户', '设备维护工程师', 1, '老张', '13998765432', 'demo_user2@example.com', '设备工程师', 0, 0, '', 'demo_user2', '2026-10-25 11:02'],
  ['mes_service', '服务账户', 'MES 系统集成凭证', 1, '', '', '', 'MES集成角色', 0, 0, '', 'demo_user', '2026-11-03 09:10'],
  ['liuyang', '普通用户', '质检员（离职停用）', 0, '小刘', '13711112222', 'liuyang@example.com', '质检操作员', 0, 0, '', 'demo_user2', '2026-10-12 16:40'],
  ['wangfang', '普通用户', '外部联调账号', 1, '小王', '13655556666', 'wangfang@example.com', '访客角色', 0, 1, '管理员锁定', 'admin', '2026-11-06 10:30'],
];
const userOpsCell = (name, on, isAdmin) => (on
  ? ops(`${L('u-edit', '编辑', name)}${L('u-pwd', '修改密码', name)}${isAdmin ? '<span class="muted">停用</span>' : L('u-disable', '停用', name)}`)
  : ops(`${L('u-enable', '启用', name)}${L('u-del', '删除', name, true)}`));
const userRows = USERS.map(([name, type, desc, on, alias, phone, mail, roles, online, locked, lockReason, user, time], i) => [
  `<input type="checkbox" aria-label="选择${esc(name)}">`,
  String(i + 1),
  `<span data-uname>${esc(name)}</span>`,
  esc(type),
  esc(desc),
  `<span data-stcell>${on ? ST_ON : ST_OFF}</span>`,
  alias ? esc(alias) : '<span class="muted">—</span>',
  phone ? esc(phone) : '<span class="muted">—</span>',
  mail ? `<span class="mono">${esc(mail)}</span>` : '<span class="muted">—</span>',
  esc(roles),
  `<span data-oncell>${online ? ST_IN : ST_OUT}</span>`,
  lockIco(locked),
  lockReason ? esc(lockReason) : '<span class="muted">—</span>',
  esc(user),
  esc(time),
  `<span data-opscell>${userOpsCell(name, !!on, name === 'admin')}</span>`,
]);
const usersPane = `
  ${realToolbar(
    `${searchBox('用户名称')}${selSearch('用户类型', ['普通用户', '管理员', '服务账户'])}${selSearch('状态', ['启用', '停用'])}${selSearch('锁定', ['未锁定', '锁定'])}`,
    `<button class="btn primary" data-op="user-add">＋ 新增</button><button class="btn" data-op="user-import">导入</button><button class="btn" data-op="user-export">导出</button><button class="btn" data-op="user-tpl">下载导入模板</button><button class="btn" data-op="user-batch-del" title="删除">🗑</button><button class="btn" data-op="user-setting">设置</button><button class="btn" data-op="user-log">登录日志</button>`,
    6)}
  <div data-user-table>
    ${table(['', '序号', '用户名称', '用户类型', '描述', '状态', '别名', '手机号', '邮箱', '角色', '在线状态', '锁定', '锁定原因', '更新人', '更新时间', '操作'], userRows)}
  </div>`;

/* ── 角色管理（SystemConfig/RoleManager/index.tsx） ── */
const ROLES = [
  ['ROLE_ADMIN', '系统管理员', '平台全部功能权限', '系统初始化', '内置角色', 'supOS', 'admin', '2026-09-30 08:00', 1],
  ['ROLE_PROCESS', '工艺工程师', '工艺参数与生产工单维护', '手动新增', '自定义角色', 'supOS', 'demo_user', '2026-11-02 14:22', 0],
  ['ROLE_DEVICE', '设备工程师', '设备台账与维修工单', '手动新增', '自定义角色', 'supOS', 'demo_user2', '2026-10-25 11:02', 0],
  ['ROLE_MES', 'MES集成角色', 'MES 系统对接与数据同步', '手动新增', '自定义角色', 'supOS', 'demo_user', '2026-11-03 09:10', 0],
  ['ROLE_VISITOR', '访客角色', '只读浏览与查询', '手动新增', '自定义角色', '', 'demo_user2', '2026-09-12 10:00', 0],
];
const roleRows = ROLES.map(([code, name, desc, src, type, app, user, time, built], i) => [
  `<input type="checkbox" aria-label="选择${esc(name)}"${built ? ' disabled' : ''}>`,
  String(i + 1),
  `<span class="mono">${esc(code)}</span>`,
  `<span data-rname>${esc(name)}</span>`,
  esc(desc),
  esc(src),
  esc(type),
  esc(app) || '<span class="muted">—</span>',
  esc(user),
  esc(time),
  `<span class="link-ops"><a href="#" data-op="r-edit" data-name="${esc(name)}">编辑</a><a href="#" data-op="r-perm" data-name="${esc(name)}">设置权限</a><a href="#" data-op="r-users" data-name="${esc(name)}">关联用户</a><a href="#" data-op="r-copy" data-name="${esc(name)}">复制</a><a href="#" class="danger" data-op="r-del" data-name="${esc(name)}">删除</a></span>`,
]);
const rolesPane = `
  ${realToolbar(
    `${searchBox('角色编号')}${searchBox('角色名称')}`,
    `<button class="btn primary" data-op="role-add">＋ 新增</button><button class="btn" data-op="role-import">导入</button><button class="btn" data-op="role-tpl">下载导入模板</button><button class="btn" data-op="role-batch-del" title="删除">🗑</button>`,
    5)}
  <div data-role-table>
    ${table(['', '序号', '角色编号', '角色名称', '描述', '创建来源', '角色类型', 'APP', '更新人', '更新时间', '操作'], roleRows)}
  </div>`;

/* ── 在线用户（consts/systemConfig.ts:110-133） ── */
const onlinePane = `
  ${realToolbar(
    `${searchBox('用户名')}${searchBox('登录时间')}${searchBox('访问IP')}${searchBox('客户端')}`,
    '',
    4)}
  ${table(['序号', '用户名称', '登录时间', '访问IP', '客户端'], [
    ['1', 'demo_user', '2026-11-10 09:12', 'host.example.com', 'Chrome 141 / Windows'],
    ['2', 'admin', '2026-11-10 08:55', 'host.example.com', 'Edge 141 / Windows'],
    ['3', 'demo_user2', '2026-11-10 10:02', 'app.example.com', 'Chrome 140 / macOS'],
    ['4', 'mes_service', '2026-11-10 07:30', 'app.example.com', 'Node.js SDK'],
  ])}`;

const body = `
  ${note('组织管理设计期页面（组织树+新建组织）在 supbase 前端仓不存在（仅组织选择器弹窗），故以用户/角色为主。', true)}
  <div data-tabgrp>
    ${tabs([['users', '用户管理'], ['roles', '角色管理'], ['online', '在线用户']])}
    ${pane('users', usersPane, true)}
    ${pane('roles', rolesPane)}
    ${pane('online', onlinePane)}
  </div>`;

export const def = {
  title: '企业运营配置',
  desc: '用户、角色与在线会话的运营管理（二级交互：用户抽屉/修改密码/停用锁定、角色权限设置/关联用户、在线用户查询）',
  crumb: ['设计期', '系统设置', '企业运营配置'],
  actions: '',
  ownToolbar: true,
  body,
  js: [S],
};
