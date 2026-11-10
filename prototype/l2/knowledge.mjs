/* 设计期 · 知识库（L2）
 * 规格：.cache/flash-l2-specs/04-ke-gateway-copilot.md（源码：knowledge-engine/frontend/src/features） */
import { esc, tag, table, realToolbar } from './helpers.mjs';

const S = 'assets/page/knowledge.js';

/* 文档状态枚举（documentStatus.ts 示例）→ Tag 语义 */
const stTag = (s) => tag(s, { '可检索': 'ok', '处理中': 'info', '处理失败': 'err', '等待处理': 'warn' }[s] || '');

const docOps = (name) =>
  `<span class="link-ops"><a href="#" data-op="doc-view" data-name="${esc(name)}">查看</a>` +
  `<a href="#" data-op="upload-ver" data-name="${esc(name)}">上传新版本</a>` +
  `<a href="#" class="danger" data-op="doc-del" data-name="${esc(name)}">删除</a></span>`;

const docRow = (name, st, size, cat, time) =>
  [`${esc(name)} ${tag('v1', 'info')}`, stTag(st), esc(size), esc(cat), esc(time), docOps(name)];

/* 知识库卡片（头像字母 + 名称 + 平台内置徽标 + 描述 + 更新时间 + ••• 菜单） */
const kbCard = (k) => `
  <section class="card" style="cursor:pointer;margin:0" data-op="open-kb" data-kb="${k.id}" data-kb-search="${esc(k.name + ' ' + k.desc)}">
    <div style="display:flex;gap:12px;align-items:flex-start">
      <span style="flex:none;width:40px;height:40px;border-radius:10px;background:var(--flash-primary-soft);color:var(--flash-primary);display:grid;place-items:center;font-weight:600">${esc(k.name.slice(0, 1))}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--flash-text-strong)">${esc(k.name)}</b>${tag('平台内置', 'info')}</div>
        <div class="muted" style="margin-top:4px">${esc(k.desc)}</div>
        <div class="muted" style="margin-top:8px">${esc(k.time)}</div>
      </div>
      <button class="btn sm" data-op="kb-menu" data-kb="${k.id}" data-kbname="${esc(k.name)}" title="更多操作">•••</button>
    </div>
  </section>`;

const KB_CARDS = kbCard({ id: 'cnc', name: 'CNC 维修手册', desc: 'CNC 机床报警代码、故障排查与维修 SOP 文档集', time: '更新于 今天 09:12' }) +
  kbCard({ id: 'point', name: '设备点检知识库', desc: '设备点检标准、巡检路线与点检记录问答', time: '更新于 昨天 16:40' });

/* 文档列表（默认展示「CNC 维修手册」） */
const docTable = table(['文档名称', '状态', '大小', '文档分类', '上传时间', '操作'], [
  docRow('CNC 机床报警代码手册', '可检索', '2.4 MB', '维修手册', '2026-11-01 10:20'),
  docRow('FANUC 系统维修手册', '处理中', '5.1 MB', '操作手册', '2026-11-10 09:05'),
  docRow('主轴故障排查 SOP', '处理失败', '1.2 MB', '维修手册', '2026-11-09 18:40'),
  docRow('设备点检记录表', '等待处理', '340 KB', '点检表单', '2026-11-10 08:12'),
]).replace('<tbody>', '<tbody data-doc-body>');

/* 检索测试结果卡（文档名 + v1 + 正文命中 + 分区 Tags + 查看原文） */
const retrCard = (doc, sections, snippet) => `
  <div class="card" style="margin:0">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <b style="color:var(--flash-text-strong)">${esc(doc)}</b>
      ${tag('v1', 'info')}${tag('正文命中', 'info')}${sections.map((s) => tag(s)).join('')}
      <span style="flex:1"></span>
      <span class="link-ops"><a href="#" data-op="doc-view" data-name="${esc(doc)}">查看原文</a></span>
    </div>
    <p class="muted" style="margin:8px 0 0;line-height:1.8">${snippet}</p>
  </div>`;

const body = `
  ${realToolbar(
    `<span style="font-size:13px;font-weight:500;color:var(--flash-text-strong)">知识库</span>
     <span class="muted">2 个知识库</span>
     <input style="width:200px;height:28px" placeholder="搜索知识库" data-kb-search>`,
    `<button class="btn primary" data-op="new-kb">＋ 新建知识库</button>`,
    2)}

  <div data-view="kb-list">
    <div class="grid cols-2" data-kb-grid>${KB_CARDS}</div>
    <div class="empty" data-kb-empty hidden><div class="empty-mark">▤</div><span>还没有知识库</span></div>
  </div>

  <div data-view="doc-list" hidden>
    <div class="pane-head">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn sm" data-op="back-kb">← 返回</button>
        <b data-doc-kb>CNC 维修手册</b><span class="muted">文档列表</span>
      </div>
      <div class="btn-row" style="align-items:center">
        <button class="btn sm" data-op="retrieval">检索测试</button>
        <a href="#" class="muted" data-op="my-processing">我的处理</a>
        <button class="btn sm primary" data-op="upload">上传文件</button>
      </div>
    </div>
    ${docTable}
  </div>

  <div data-view="retrieval" hidden>
    <div class="pane-head">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn sm" data-op="back-docs">← 返回</button><b>检索测试</b>
      </div>
      <span class="muted">知识库检索 · 示例</span>
    </div>
    <div class="card">
      <div style="display:flex;gap:10px;align-items:flex-end">
        <textarea style="flex:1" maxlength="2000" data-retr-q placeholder="输入自然语言问题，例如：主轴过载怎么处理"></textarea>
        <button class="btn primary" data-op="retr-search">检索</button>
      </div>
    </div>
    <div class="muted" data-retr-meta hidden style="margin:10px 2px 0">本次 混合检索 · 向量/全文权重 0.7/0.3 · RRF k=60 · 精排 gte-multilingual-reranker-base</div>
    <div data-retr-cards hidden style="margin-top:10px;display:grid;gap:10px">
      ${retrCard('CNC 机床报警代码手册', ['3.2 主轴过载报警', '维修流程'], '…当主轴电机过载时，系统将触发 ALM-401 报警。应先检查负载条件与切削参数，随后检查主轴放大器与编码器线缆连接，必要时执行主轴负载重启流程…')}
      ${retrCard('FANUC 系统维修手册', ['4.1 主轴放大器'], '…主轴过载多由加工参数超出机床额定负载引起。建议降低进给速度或切深，若报警持续，按第 4.1 节检查放大器散热与再生放电单元…')}
    </div>
    <div class="empty" data-retr-empty><div class="empty-mark">⌕</div><span>没有可用的检索依据</span></div>
  </div>`;

export const def = {
  title: '知识库', desc: '知识库与文档检索（二级交互：文档列表 / 上传 / AI 模型 / 检索测试）',
  crumb: ['设计期', 'AI 与工具', '知识库'],
  actions: '', ownToolbar: true, body, js: [S],
};
