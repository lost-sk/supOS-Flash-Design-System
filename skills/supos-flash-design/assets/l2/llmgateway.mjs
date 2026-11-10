/* 设计期 · 大模型网关（L2）
 * 规格：.cache/flash-l2-specs/04-ke-gateway-copilot.md（前端 tsx 不在仓，文案取官方手册《大模型网关》） */
import { esc, tag, table, note, tabs, pane, searchBox, realToolbar } from './helpers.mjs';

const S = 'assets/page/llmgateway.js';

const capSel = `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">能力标签
  <select data-cap-filter style="width:150px;height:28px"><option>全部能力</option><option>对话</option><option>向量 1024 维</option><option>重排序</option><option>VLM</option></select></span>`;

/* 模型表（模型带复制 / 能力标签 / 上下文 / 渠道数 / 可用状态 / 详情） */
const modelName = (n) => `<span class="mono">${esc(n)}</span> <a href="#" data-op="copy-model" data-name="${esc(n)}" title="复制模型名称">⧉</a>`;
const avail = (s) => tag(s, { '完全可用': 'ok', '部分可用': 'warn', '不可用': 'err' }[s] || '');
const modelTable = table(['模型', '能力标签', '上下文', '渠道数', '可用状态', '详情'], [
  [modelName('deepseek-v3'), tag('对话', 'info'), '64K', '2', avail('完全可用'), '<a href="#" data-op="model-detail" data-name="deepseek-v3">详情</a>'],
  [modelName('qwen3-embedding-0.6b'), tag('向量 1024 维', 'info'), '32K', '1', avail('完全可用'), '<a href="#" data-op="model-detail" data-name="qwen3-embedding-0.6b">详情</a>'],
  [modelName('gte-multilingual-reranker-base'), tag('重排序', 'info'), '—', '1', avail('部分可用'), '<a href="#" data-op="model-detail" data-name="gte-multilingual-reranker-base">详情</a>'],
  [modelName('qwen2.5-vl-7b'), tag('VLM', 'info'), '32K', '1', avail('不可用'), '<a href="#" data-op="model-detail" data-name="qwen2.5-vl-7b">详情</a>'],
]);

/* 渠道表（盾牌=平台内置 / 模型 >5 显「+N」 / 状态开关 / 测速 / 编辑 / 删除） */
const chSwitch = (id, on, state, cls) =>
  `<span style="display:inline-flex;align-items:center;gap:8px"><label class="switch"><input type="checkbox" data-ch-switch ${on ? 'checked' : ''}><i></i></label><span data-ch-state class="${cls}">${state}</span></span>`;
const mTags = (list) => {
  const head = list.slice(0, 5).map((m) => tag(m)).join(' ');
  return list.length > 5 ? `${head} <span class="muted">+${list.length - 5}</span>` : head;
};
const chOps = (id) =>
  `<span class="link-ops"><a href="#" data-op="ch-edit" data-ch="${id}">编辑</a><a href="#" class="danger" data-op="ch-del" data-ch="${id}">删除</a></span>`;
const channelTable = table(['渠道名称', '模型', '响应时间', '状态', '单模型测速', '批量测速', '操作'], [
  [`<span title="平台内置">🛡</span> 平台内置模型服务`, mTags(['deepseek-v3', 'qwen3-embedding-0.6b', 'gte-multilingual-reranker-base', 'qwen2.5-vl-7b', 'qwen3-32b', 'qwen3-14b', 'bge-m3']), '320 ms', chSwitch('ch1', true, '启用', 'dot-status'), '<button class="btn sm" data-op="speed-one">单模型测速</button>', '<button class="btn sm" data-op="speed-batch">批量测速</button>', chOps('ch1')],
  ['精达车间专用渠道', mTags(['deepseek-v3', 'qwen3-embedding-0.6b', 'qwen3-32b']), '280 ms', chSwitch('ch2', true, '启用', 'dot-status'), '<button class="btn sm" data-op="speed-one">单模型测速</button>', '<button class="btn sm" data-op="speed-batch">批量测速</button>', chOps('ch2')],
  ['备用推理渠道', mTags(['deepseek-r1-distill-qwen-32b']), '—', chSwitch('ch3', false, '自动禁用', 'dot-status'), '<button class="btn sm" data-op="speed-one">单模型测速</button>', '<button class="btn sm" data-op="speed-batch">批量测速</button>', chOps('ch3')],
]);

/* 调用日志（子页签 全部/消费/管理/系统） */
const logRow = (time, ch, token, type, model, ip) => [
  `<td class="mono">${esc(time)}</td>`, `<td>${esc(ch)}</td>`, `<td class="mono">${esc(token)}</td>`,
  `<td data-log-type="${type}">${tag(type, { '消费': 'info', '管理': 'warn' }[type] || '')} <span class="mono">${esc(model)}</span></td>`,
  `<td class="mono">${esc(ip)}</td>`,
];

const logTable = table(['时间', '渠道', '令牌', '类型和模型', '来源 IP'], [
  logRow('2026-11-10 09:41:02', '平台内置模型服务', 'app-demo-001', '消费', 'deepseek-v3', 'app.example.com'),
  logRow('2026-11-10 09:38:44', '平台内置模型服务', 'app-demo-001', '消费', 'qwen3-embedding-0.6b', 'app.example.com'),
  logRow('2026-11-10 09:30:11', '精达车间专用渠道', 'app-jinda-007', '管理', '获取模型列表', 'app.example.com'),
  logRow('2026-11-10 08:00:00', '平台内置模型服务', 'system', '系统', '渠道健康检查', 'host.example.com'),
]).replace('<tbody>', '<tbody data-log-body>');

/* 设置页（日志 / 清理 / 监控） */
const sw = (checked, label) =>
  `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><label class="switch"><input type="checkbox" ${checked ? 'checked' : ''}><i></i></label><span style="font-size:13px">${esc(label)}</span></div>`;

const settingsPane = `
  <div class="card" style="max-width:640px">
    <div class="card-head"><h3>日志设置</h3></div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <label class="switch"><input type="checkbox" checked><i></i></label><span style="font-size:13px">启用日志消费</span>
      <span style="flex:1"></span>
      <button class="btn sm primary" data-op="save-log">保存日志设置</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:12px;color:var(--flash-text-secondary)">日志清理时间</span>
      <input type="number" value="30" min="1" style="width:110px;height:28px">
      <button class="btn sm" data-op="clean-log">清理历史日志</button>
    </div>
  </div>
  <div class="card" style="max-width:640px">
    <div class="card-head"><h3>监控设置</h3></div>
    ${sw(true, '失败时自动禁用通道')}
    ${sw(true, '成功时自动启用通道')}
    <div style="display:flex;justify-content:flex-end"><button class="btn sm primary" data-op="save-monitor">保存监控设置</button></div>
  </div>`;

const body = `
  ${note('本页文案取自官方手册《大模型网关》（前端 tsx 源码不在工作区，文档实证）。')}
  ${tabs([['lg-models', '模型'], ['lg-channels', '渠道'], ['lg-logs', '调用日志'], ['lg-settings', '设置']])}
  ${pane('lg-models', `
    ${realToolbar(`${searchBox('模型名称')}${capSel}`,
      `<button class="btn sm" data-op="search">搜索</button><button class="btn sm" data-op="reset">重置</button>`, 4)}
    ${modelTable}`, true)}
  ${pane('lg-channels', `
    ${realToolbar(`${searchBox('渠道名称')}${capSel}`,
      `<button class="btn sm" data-op="search">搜索</button><button class="btn sm" data-op="reset">重置</button><button class="btn sm primary" data-op="new-channel">＋ 新建渠道</button>`, 3)}
    ${channelTable}`)}
  ${pane('lg-logs', `
    <div class="segmented" data-log-mode style="margin-bottom:10px">
      <a class="is-active" data-log-tab="全部">全部</a><a data-log-tab="消费">消费</a><a data-log-tab="管理">管理</a><a data-log-tab="系统">系统</a>
    </div>
    ${realToolbar(
      `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">起始时间 <input type="date" style="height:28px"></span>
       <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">结束时间 <input type="date" style="height:28px"></span>
       ${searchBox('渠道 ID')}`,
      `<button class="btn sm" data-op="search">搜索</button><button class="btn sm" data-op="reset">重置</button>`, 4)}
    ${logTable}`)}
  ${pane('lg-settings', settingsPane)}`;

export const def = {
  title: '大模型网关', desc: '统一接入对话 / 向量 / 重排等模型能力（二级交互：渠道管理 / 调用日志 / 设置）',
  crumb: ['设计期', 'AI 与工具', '大模型网关'],
  actions: '', ownToolbar: true, body, js: [S],
};
