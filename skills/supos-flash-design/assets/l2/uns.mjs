/* 设计期 · 工厂模型（UNS）· L2
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「工厂模型（UNS）」章节。
 * UNS 前端为独立静态包（/os/static/uns），源码不在仓，文案取自官方产品文档（文档实证），源码级样式未证实。 */
import { esc, tag, table, stat, card, note, realToolbar } from './helpers.mjs';

const S = 'assets/page/uns.js';

/* ── 树行：文件夹（挂载型带在线/断线状态点） / 文件 ── */
const folderRow = (name, { dot = '' } = {}) =>
  `<div class="tree-row" data-folder data-name="${esc(name)}">
    <span class="caret" style="font-size:10px;color:var(--flash-text-tertiary)">▾</span>
    ${dot ? `<span class="dot ${dot}" title="${dot === 'on' ? '在线' : '断线'}"></span>` : ''}
    <span>${esc(name)}</span>
    <span class="tr-ops">
      <button title="创建新文件" data-op="new-file" data-name="${esc(name)}">＋</button>
      <button title="创建新文件夹" data-op="new-folder" data-name="${esc(name)}">▤</button>
      <button title="删除" data-op="del-node" data-kind="folder" data-name="${esc(name)}" style="color:var(--flash-error)">🗑</button>
    </span>
  </div>`;
const fileRow = (name, type, active = false) =>
  `<div class="tree-row${active ? ' is-active' : ''}" data-file data-name="${esc(name)}">
    <span style="color:var(--flash-text-muted)">▫</span>
    <span>${esc(name)}</span>
    <span class="muted">${esc(type)}</span>
    <span class="tr-ops">
      <button title="编辑文件" data-op="file-edit" data-name="${esc(name)}">✎</button>
      <button title="删除" data-op="del-node" data-kind="file" data-name="${esc(name)}" style="color:var(--flash-error)">🗑</button>
    </span>
  </div>`;

const tree = `<div class="tree" data-uns-tree>
  ${folderRow('JINGDA', { dot: 'on' })}
  <div class="tree-children">
    ${folderRow('CNC加工', { dot: 'on' })}
    <div class="tree-children">
      ${fileRow('CNC-01', '时序型', true)}
      ${fileRow('CNC-02', '时序型')}
    </div>
    ${folderRow('注塑车间', { dot: 'off' })}
    <div class="tree-children">
      ${fileRow('INJ-01', '时序型')}
    </div>
  </div>
  ${folderRow('能源管理', { dot: 'off' })}
  <div class="tree-children">
    ${fileRow('EM-01', '关系型')}
  </div>
  ${folderRow('质量管理')}
  <div class="tree-children">
    ${fileRow('QC-01', '计算型')}
    ${fileRow('REF-01', '引用')}
  </div>
</div>`;

/* 文件详情右侧面板：内容由 assets/page/uns.js 渲染（默认 CNC-01） */
const rightPane = `<section class="card" data-component="FileDetail">
  <div class="card-head"><h3>文件详情</h3><span class="sub">点击左侧树中的文件查看详情</span></div>
  <div data-file-pane><div class="empty" style="min-height:120px"><div class="empty-mark">▤</div><span>请在左侧选择文件</span></div></div>
</section>`;

const body = `
  ${realToolbar('<span class="muted">全局操作</span>',
    `<button class="btn" data-op="import">导入 ▾</button><button class="btn" data-op="export">导出 ▾</button><button class="btn" data-op="batch-gen">批量生成</button>`,
    5862)}
  <div class="split tree-main">
    ${card('模型管理', `
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <button class="btn sm" data-op="new-folder">＋ 文件夹</button>
        <button class="btn sm" data-op="new-file">＋ 文件</button>
        <button class="btn sm" data-op="batch-gen">批量生成</button>
      </div>
      ${tree}
      <div class="muted" style="margin-top:10px;line-height:1.9">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--flash-success);margin-right:4px;vertical-align:middle"></span>在线
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--flash-text-muted);margin:0 4px 0 10px;vertical-align:middle"></span>断线（挂载型文件夹）
        <br>右键文件夹：刷新 / 复制粘贴 / 新建 / 收起 / 删除
      </div>`)}
    ${rightPane}
  </div>
  <div class="section-title"><span>统计信息</span></div>
  <div class="grid cols-4">
    ${stat('文件夹总数', '425', '订阅总数：0')}
    ${stat('文件总数', '5862', '订阅总数：2')}
    ${stat('模板总数', '2', '订阅总数：0')}
    ${stat('标签总数', '19', '订阅总数：0')}
  </div>
  <div class="section-title"><span>订阅信息</span><a class="more" href="#" data-op="subs-more">更多</a></div>
  ${card('', table(['订阅名称', '所属文件', '消息主题', '状态', '更新时间'], [
    ['主轴工况实时订阅', 'CNC-01', '<span class="mono">/JINGDA/CNC加工/CNC-01</span>', tag('正常', 'ok'), '2026-11-10 09:32'],
    ['进给速度订阅', 'CNC-01', '<span class="mono">/JINGDA/CNC加工/CNC-01</span>', tag('正常', 'ok'), '2026-11-10 09:32'],
    ['注塑温度订阅', 'INJ-01', '<span class="mono">/JINGDA/注塑车间/INJ-01</span>', tag('已暂停', 'warn'), '2026-11-08 18:20'],
  ]))}
  ${note('UNS 前端为独立静态包（/os/static/uns），本页文案来自官方产品文档（文档实证），源码级样式未证实。')}
`;

export const def = {
  title: '工厂模型', desc: '维护命名空间目录树与模型文件，位号历史与订阅统一纳管（二级交互：树右键菜单 / 新建文件 / 位号历史与存储设置）',
  crumb: ['设计期', '数据平台', '建模服务', '工厂模型'],
  actions: '', ownToolbar: true, body, js: [S],
};
