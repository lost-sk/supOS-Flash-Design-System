/* 设计期 · SQL 联邦查询（L2 · 真实页面名「服务与订阅管理」）
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「SQL 联邦查询」（ServiceScript 源码实证）
 * 布局：左树（统一树）+ 多标签编辑区 + 底部面板；源码无「保存为视图」，保存即保存为 SQL 服务。 */
import { esc, table, card, kv, tabs, pane, field, input, select } from './helpers.mjs';

const S = 'assets/page/fedquery.js';

/* 类型图标色：JS #297BFF / SQL #0099B1 / 订阅 #5C00E9（tokens：--flash-node-js / --flash-collect-doing / --flash-node-sub） */
const DOT = { js: 'var(--flash-node-js)', es: 'var(--flash-node-js)', sql: 'var(--flash-collect-doing)', sub: 'var(--flash-node-sub)' };
const ndot = (c) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:7px;vertical-align:1px"></span>`;

/* 左树（统一树）：命名空间 → 分组 → 节点（data-* 供右键菜单使用） */
const GROUPS = [
  { ns: '生产数据', items: [
    { name: 'order_sum_query', show: '工单汇总查询', type: 'sql' },
    { name: 'syncErpOrder', show: '工单同步服务', type: 'js' },
  ] },
  { ns: '设备数据', items: [
    { name: 'tempLimitSub', show: '温度越限订阅', type: 'sub' },
    { name: 'esScoreCalc', show: '评分计算模块', type: 'es' },
  ] },
];
const treeHtml = `<div class="tree" data-component="FedTree">
  <div class="tree-row is-active" data-op="tg">默认命名空间</div>
  <div class="tree-children">${GROUPS.map((g) => `
    <div class="tree-row" data-op="tg" data-name="${esc(g.ns)}">▸ ${esc(g.ns)}</div>
    <div class="tree-children" data-branch>${g.items.map((n) =>
      `<div class="tree-row" data-node="${esc(n.name)}" data-show="${esc(n.show)}" data-type="${n.type}">${ndot(DOT[n.type])}<span title="${esc(n.name)}">${esc(n.show)}</span></div>`).join('')}</div>`).join('')}
  </div>
</div>`;

/* 编辑器工具栏：撤销/恢复/缩进/注释/格式化/搜索 +（SQL）编写说明、修改数据源（缺失红点）；右侧 调试/保存 */
const edBar = (isSql) => `<div class="toolbar" style="flex-wrap:wrap;margin-bottom:10px">
  <div class="btn-row" style="gap:6px;flex-wrap:wrap">${['撤销', '恢复', '左缩进', '右缩进', '注释', '格式化', '搜索'].map((b) =>
    `<button class="btn sm" data-op="ed" data-label="${esc(b)}">${esc(b)}</button>`).join('')}${isSql ? `
    <button class="btn sm" data-op="ed" data-label="编写说明">编写说明</button>
    <button class="btn sm" data-op="ds-modal" style="position:relative">修改数据源<i data-ds-dot style="position:absolute;top:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:var(--flash-error)"></i></button>` : ''}
  </div>
  <span class="spacer"></span>
  <div class="btn-row" style="gap:8px">
    <button class="btn sm" data-op="debug">调试</button>
    <button class="btn sm primary" data-op="save">保存</button>
  </div>
</div>`;

/* 代码示例（行序敏感，用数组拼接保证缩进） */
const sqlCode = [
  '<span class="cm-key">&lt;select</span> <span class="cm-str">id</span>=<span class="cm-str">"queryOrderSummary"</span> <span class="cm-str">resultType</span>=<span class="cm-str">"java.util.HashMap"</span><span class="cm-key">&gt;</span>',
  '<span class="cm-key">SELECT</span> w.order_no, SUM(r.qty) <span class="cm-key">AS</span> qty',
  '<span class="cm-key">FROM</span> mes_work_order w',
  '<span class="cm-key">LEFT JOIN</span> mes_order_record r <span class="cm-key">ON</span> r.order_id = w.id',
  '<span class="cm-key">WHERE</span> w.create_time &gt;= #{startTime}',
  '  <span class="cm-key">AND</span> w.dept = #{dept}',
  '<span class="cm-key">GROUP BY</span> w.order_no',
  '<span class="cm-key">&lt;/select&gt;</span>',
].join('\n');
const jsCode = [
  '<span class="cm-com">// 工单同步：ERP 工单 → UNS 状态位</span>',
  '<span class="cm-key">function</span> syncErpOrder(ctx) {',
  '  <span class="cm-key">const</span> rows = ctx.db.query(<span class="cm-str">"SELECT order_no FROM mes_work_order WHERE synced = 0"</span>);',
  '  rows.forEach((r) =&gt; ctx.uns.set(<span class="cm-str">"/" + r.order_no + "/status"</span>, <span class="cm-str">"SYNCED"</span>));',
  '  <span class="cm-key">return</span> { synced: rows.length };',
  '}',
].join('\n');

/* 底部面板：基本信息 / 入参 / 出参 / 调试信息（列：必填、参数名称、类型、默认值、描述、操作） */
const paramOps = '<span class="link-ops"><a href="#" data-op="p-edit">编辑</a><a href="#" class="danger" data-op="p-del">删除</a></span>';
const bottomPanel = `
  <div class="card" style="margin-top:12px" data-component="FedBottom">
    ${tabs([['base', '基本信息'], ['in', '入参'], ['out', '出参'], ['dbg', '调试信息']])}
    ${pane('base', kv([
      ['名称', '<span class="mono">order_sum_query</span>'],
      ['显示名', '工单汇总查询'],
      ['类型', 'SQL服务'],
      ['所属命名空间/分组', '生产数据'],
      ['sql语法', '<span class="mono">mybatis</span>'],
      ['脚本类型', '查询'],
      ['描述', '按日汇总工单数量'],
      ['更新时间', '2026-11-09 17:42'],
    ]), true)}
    ${pane('in', table(['必填', '参数名称', '类型', '默认值', '描述', '操作'], [
      ['是', '<span class="mono">startTime</span>', 'String', '-', '统计开始时间', paramOps],
      ['否', '<span class="mono">endTime</span>', 'String', '-', '统计结束时间', paramOps],
      ['否', '<span class="mono">dept</span>', 'String', '-', '车间/部门过滤', paramOps],
    ]))}
    ${pane('out', table(['必填', '参数名称', '类型', '默认值', '描述', '操作'], [
      ['是', '<span class="mono">order_no</span>', 'String', '-', '工单编号', paramOps],
      ['是', '<span class="mono">qty</span>', 'Number', '-', '汇总数量', paramOps],
    ]))}
    ${pane('dbg', `<div class="empty" data-dbg-empty style="min-height:120px"><div class="empty-mark">▤</div><span>暂无数据</span></div>
      <div class="code-editor" data-dbg-result style="display:none"></div>`)}
  </div>`;

const body = `
  <div class="split tree-main">
    ${card('统一树', `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn sm primary" data-op="new-menu">＋ 新建 ▾</button>
        <input data-tree-search style="flex:1;height:26px;min-width:0;border:1px solid var(--flash-border);border-radius:var(--flash-radius);padding:0 8px;font-size:12px" placeholder="搜索节点">
      </div>
      ${treeHtml}`)}
    <div>
      <div class="tabs" style="margin-bottom:10px" data-edtabs>
        <a href="#" data-edtab="sql" class="is-active">${ndot(DOT.sql)}工单汇总查询</a>
        <a href="#" data-edtab="js">${ndot(DOT.js)}工单同步服务</a>
      </div>
      <div data-editor>
        <div data-edview="sql">
          <div class="note warn" data-ds-warn style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span>当前 SQL 脚本尚未配置数据源，运行前请先点击「修改数据源」完成配置。</span>
            <a href="#" data-op="ds-modal">去配置</a>
          </div>
          <div class="muted" data-ds-info style="display:none;margin-bottom:8px"></div>
          ${edBar(true)}
          <div class="code-editor" data-component="FedCode">${sqlCode}</div>
        </div>
        <div data-edview="js" style="display:none">
          <div class="muted" style="margin-bottom:8px">数据源：精达设备台账库（MySQL · 数据源注册）</div>
          ${edBar(false)}
          <div class="code-editor" data-component="FedCode">${jsCode}</div>
        </div>
      </div>
      ${bottomPanel}
    </div>
  </div>`;

export const def = {
  title: 'SQL 联邦查询',
  desc: '服务与订阅管理：JS/SQL 服务与订阅任务的脚本编辑（左树 + 多标签 + 调试）',
  crumb: ['设计期', '数据平台', '存储服务', 'SQL 联邦查询'],
  actions: '', ownToolbar: true, body, js: [S],
};
