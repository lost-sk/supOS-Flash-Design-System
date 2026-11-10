/* 设计期 · 语义模型（L2）
 * 规格：.cache/flash-l2-specs/03-diviner-semantic.md（源码：supbase-diviner-frontend/src/，文案为组件硬编码中文）
 * 布局：.split.tree-main 左 250px 导航树 + 右侧多视图（实体列表 / 实体详情 / 指标 / 知识 / 知识草稿 / 关系图）
 * 弹窗与抽屉的表单文案放在 <template data-tpl> 中，由 assets/page/diviner.js 按需实例化。 */
import { esc, tag, card, stat, note, realToolbar, field, input } from './helpers.mjs';

const S = 'assets/page/diviner.js';

/* 语义色 Tag（规格「语义色汇总」；只允许 var(--flash-*)，禁止新 hex） */
const CT = {
  blue: ['var(--flash-primary)', 'var(--flash-primary-soft)'],
  green: ['var(--flash-success)', 'var(--flash-success-soft)'],
  purple: ['var(--flash-node-sub)', 'var(--flash-stat-purple)'],
  cyan: ['var(--flash-collect-doing)', 'var(--flash-stat-blue)'],
  gold: ['var(--flash-sem-pending)', 'var(--flash-stat-amber)'],
  orange: ['var(--flash-warning)', 'var(--flash-stat-amber)'],
};
const ctag = (t, k) => { const [fg, bg] = CT[k] || CT.blue; return `<span class="tag" style="color:${fg};background:${bg};border-color:${bg}">${esc(t)}</span>`; };

/* ── 左侧 250px 导航树（layout/menu.tsx 两组菜单；树根：域=文件夹 / 实体=文件） ── */
const sider = card('语义模型', `
  <div style="margin-bottom:6px">
    <div class="muted">所属应用</div>
    <select style="width:100%;height:28px;margin-top:4px"><option>全部</option><option>平台</option><option>mes_app</option></select>
  </div>
  <div class="anchor-group">语义定义</div>
  <div class="tree" data-nav-tree>
    <div class="tree-row is-active" data-op="nav" data-view="domains"><span>▦</span>实体</div>
    <div class="tree-children">
      <div class="tree-row" data-op="toggle" data-open="1"><span data-caret>▾</span><span>📁</span>精达传动<span class="sub" style="margin-left:auto">4</span></div>
      <div class="tree-children">
        <div class="tree-row" data-op="open-model" data-ident="md_equipment"><span>📄</span>设备台账</div>
        <div class="tree-row" data-op="open-model" data-ident="md_work_order"><span>📄</span>生产工单</div>
        <div class="tree-row" data-op="open-model" data-ident="md_process_report"><span>📄</span>工序报工</div>
        <div class="tree-row" data-op="open-model" data-ident="md_quality_check"><span>📄</span>质量检验</div>
      </div>
      <div class="tree-row" data-op="open-model" data-ident="md_analysis_wide"><span>📄</span>分析宽表</div>
    </div>
    <div class="tree-row" data-op="nav" data-view="metrics"><span>∑</span>指标</div>
    <div class="tree-row"><span>ƒ</span>SQL 片段</div>
    <div class="tree-row" data-op="nav" data-view="knowledge"><span>☰</span>知识</div>
    <div class="tree-row"><span>§</span>规则</div>
    <div class="tree-row"><span>⚡</span>动作</div>
    <div class="tree-row" data-op="nav" data-view="graph"><span>⌗</span>关系</div>
  </div>
  <div class="anchor-group">治理</div>
  <div class="tree">
    <div class="tree-row" data-op="nav" data-view="drafts"><span>⏳</span>知识草稿</div>
  </div>
  ${note('本页文案来自 diviner 前端源码（组件硬编码中文）。')}`);

/* ── 实体列表（/domains） ── */
const entRow = (name, ident, desc) =>
  `<tr data-kind="entity" data-op="open-model" data-ident="${esc(ident)}" style="cursor:pointer">
    <td><div style="font-weight:500">${esc(name)}</div><div class="mono muted">${esc(ident)}</div></td>
    <td>${tag('实体')}</td><td>${esc(desc)}</td></tr>`;
const domainRow = `<tr data-kind="domain">
  <td><div style="font-weight:500">精达传动</div><div class="mono muted">jd_transmission</div></td>
  <td>${tag('业务域', 'info')}</td><td>精达传动业务域：设备、工单、报工与质量主题</td></tr>`;
const listTable = (heads, rows) => `<div class="table-wrap"><table class="flash-table"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

const viewDomains = `
<div data-view="domains">
  <div class="grid cols-3" style="margin-bottom:12px">
    ${stat('业务域', '1')}${stat('实体总数', '5')}${stat('待分配', '<span style="color:var(--flash-sem-pending)">1</span>', '未分配业务域的实体')}
  </div>
  ${realToolbar(
    `<input style="width:250px;height:28px" placeholder="搜索业务域或实体（名称 / 标识）" data-search="entity">
     <div class="segmented" data-seg="entity"><a class="is-active" data-kind="all">全部 6</a><a data-kind="domain">业务域 1</a><a data-kind="entity">实体 5</a></div>`,
    `<button class="btn primary" data-op="add-domain">新建业务域</button><button class="btn" data-op="add-model">新建模型</button>`,
    6)}
  <div data-list="entity">
    ${listTable(['名称', '类型', '描述'], [
      domainRow,
      entRow('设备台账', 'md_equipment', '设备主数据与台账信息'),
      entRow('生产工单', 'md_work_order', '生产工单主表与状态跟踪'),
      entRow('工序报工', 'md_process_report', '工序级报工明细'),
      entRow('质量检验', 'md_quality_check', '检验单与缺陷记录'),
      entRow('分析宽表', 'md_analysis_wide', '多主题拼接的分析宽表'),
    ])}
  </div>
  <div class="empty" data-empty hidden style="min-height:150px"><div class="empty-mark">▤</div><span>没有匹配的业务域或实体</span></div>
</div>`;

/* ── 实体详情（/models/:name，页面内视图切换） ── */
const viewDetail = `
<div data-view="detail" hidden>
  <div style="margin-bottom:10px"><button class="btn sm" data-op="back">← 返回列表</button></div>
  <div data-detail-body></div>
</div>`;

/* ── 指标（/metrics） ── */
const mRow = (name, ident, mtype, cal, grain, tperiod, unit, entity) =>
  `<tr data-mtype="${esc(mtype)}" data-mident="${esc(ident)}" data-mname="${esc(name)}">
    <td style="font-weight:500">${esc(name)}</td><td>${ctag(mtype, { '原子': 'blue', '派生': 'green', '独立': 'purple' }[mtype])}</td><td>${cal}</td>
    <td>${esc(grain)}</td><td>${tperiod}</td><td>${esc(unit)}</td><td>${esc(entity)}</td>
    <td><span class="muted">未添加描述</span></td>
    <td><span class="link-ops"><a href="javascript:;" data-op="metric-edit" data-mident="${esc(ident)}">编辑</a><a href="javascript:;" class="danger" data-op="metric-del" data-mname="${esc(name)}">删除</a></span></td></tr>`;
const viewMetrics = `
<div data-view="metrics" hidden>
  ${realToolbar(
    `<input style="width:200px;height:28px" placeholder="搜索指标" data-search="metric">
     <select style="height:28px" data-filter="metric"><option>全部</option><option>原子</option><option>派生</option><option>独立</option></select>`,
    `<button class="btn primary" data-op="metric-add">新建指标</button>`,
    7)}
  <div data-list="metric">
    ${listTable(['指标名称', '类型', '口径', '观察粒度', '时间口径', '单位', '关联实体', '描述', '操作'], [
      mRow('设备原值合计', 'metric_asset_value_sum', '原子', '求和(eq_value)', '设备编码', '全量', '元', '设备台账'),
      mRow('设备台数', 'metric_equipment_count', '原子', '按行计数', '设备编码', '全量', '台', '设备台账'),
      mRow('工单总数', 'metric_work_order_count', '原子', '按行计数', '工单编号', '全量', '单', '生产工单'),
      mRow('合格报工数', 'metric_qualified_reports', '原子', '计数(rp_id)', '工单编号 / 工序', '全量', '件', '工序报工'),
      mRow('报工合格数（口径收窄）', 'metric_qualified_narrowed', '派生', `${tag('合格报工数', 'info')} + 限定 qc_result=合格`, '工序', ctag('按查询时间', 'green'), '件', '工序报工'),
      mRow('月度产量', 'metric_monthly_output', '派生', `${tag('产量合计', 'info')} + 按月汇总`, '月', ctag('按查询时间', 'green'), '吨', '工序报工'),
      mRow('OEE 设备综合效率', 'metric_oee', '独立', `实现 SQL + ${tag('班次', 'info')} ${tag('车间', 'info')}`, '设备编码', '全量', '%', '设备台账'),
    ])}
  </div>
</div>`;

/* ── 知识（/knowledge） ── */
const kRow = (name, ktype, content, entity, mounts) =>
  `<tr data-ktype="${esc(ktype)}">
    <td style="font-weight:500">${esc(name)}</td><td>${ctag(ktype, { '术语': 'blue', '枚举定义': 'purple', '流程': 'cyan', '场景': 'green' }[ktype])}</td><td>${content}</td>
    <td>${esc(entity)}</td><td>${esc(mounts)}</td>
    <td><span class="link-ops"><a href="javascript:;" class="danger" data-op="knowledge-del" data-kname="${esc(name)}">删除</a></span></td></tr>`;
const viewKnowledge = `
<div data-view="knowledge" hidden>
  ${realToolbar(
    `<input style="width:200px;height:28px" placeholder="搜索知识" data-search="knowledge">
     <select style="height:28px" data-filter="knowledge"><option>全部</option><option>术语</option><option>枚举定义</option><option>流程</option><option>场景</option></select>`,
    `<button class="btn primary" data-op="knowledge-add">新建知识</button>`,
    4)}
  <div data-list="knowledge">
    ${listTable(['名称', '类型', '内容', '关联实体', '挂载', '操作'], [
      kRow('良品', '术语', '一次检验判定合格的产品', '质量检验', '3 处'),
      kRow('设备状态码', '枚举定义', `${tag('RUNNING 运行', 'info')}${tag('IDLE 待机', 'info')}${tag('DOWN 故障', 'info')}${tag('MAINT 维保', 'info')}<span class="muted">+2</span>`, '设备台账', '2 处'),
      kRow('工单下达流程', '流程', '计划员下达 → 车间接收 → 开工确认', '生产工单', '1 处'),
      kRow('换型超时场景', '场景', '换型超过 30 分钟触发预警并记录停线原因', '工序报工', '1 处'),
    ])}
  </div>
  <div class="empty" data-empty hidden style="min-height:150px"><div class="empty-mark">▤</div><span>把业务含义沉淀下来，让分析更准确</span></div>
</div>`;

/* ── 知识草稿（队列审批制） ── */
const dotSt = (t, c) => `<span class="dot-status" style="color:${c}">${esc(t)}</span>`;
const dRow = (name, dtype, source, content, target, reason, state, time) =>
  `<tr data-dname="${esc(name)}">
    <td style="font-weight:500">${esc(name)}</td><td>${dtype}</td><td>${esc(source)}</td><td>${esc(content)}</td><td>${esc(target)}</td><td>${esc(reason)}</td>
    <td data-status>${state}</td><td>${esc(time)}</td>
    <td data-ops>${state.includes('待审批')
      ? `<span class="link-ops"><a href="javascript:;" data-op="draft-approve" data-dname="${esc(name)}">通过</a><a href="javascript:;" data-op="draft-reject" data-dname="${esc(name)}">驳回</a><a href="javascript:;" data-op="draft-detail" data-dname="${esc(name)}">详情</a></span>`
      : `<span class="link-ops"><a href="javascript:;" data-op="draft-detail" data-dname="${esc(name)}">详情</a></span>`}</td></tr>`;
const viewDrafts = `
<div data-view="drafts" hidden>
  ${realToolbar(
    `<span class="muted">草稿由抽取与人工补充产生，批准后按类型物化并重建索引</span>`,
    `<button class="btn" data-op="draft-refresh">刷新</button>`,
    5)}
  <div data-list="drafts">
    ${listTable(['草稿', '类型', '来源', '内容', '目标引用', '理由', '状态', '时间', '操作'], [
      dRow('设备稼动率', ctag('术语', 'blue'), '机器', '稼动率＝实际运行时间 ÷ 计划运行时间', '指标 · 设备稼动率', '抽取指标描述中的新术语', dotSt('待审批', 'var(--flash-primary)'), '2026-11-09 16:20'),
      dRow('报废复检规则', ctag('规则', 'orange'), '人工', '连续报废 ≥3 件触发质检复检', '模型 · 工序报工', '人工补充业务规则', dotSt('待审批', 'var(--flash-primary)'), '2026-11-10 09:05'),
      dRow('工单优先级', ctag('枚举定义', 'purple'), '机器', 'HIGH 高 / NORMAL 中 / LOW 低', '模型字段 · 生产工单.priority', '新增字段缺枚举定义', dotSt('已批准', 'var(--flash-success)'), '2026-11-08 14:10'),
      dRow('产量合计', ctag('指标', 'gold'), '机器', '求和(qty)，建议登记为原子指标', '指标 · 产量合计', '从 SQL 抽取聚合表达式', dotSt('已批准', 'var(--flash-success)'), '2026-11-07 11:32'),
      dRow('良品率片段', ctag('片段', 'cyan'), '人工', 'SELECT 合格数 / 总数 AS yield_ratio …', 'SQL 片段 · yield_ratio', '人工沉淀常用片段', dotSt('已驳回', 'var(--flash-error)'), '2026-11-06 17:48'),
    ])}
  </div>
  <div class="empty" data-empty hidden style="min-height:150px"><div class="empty-mark">▤</div><span>没有该状态的草稿</span></div>
</div>`;

/* ── 关系图（/graph，React Flow 的静态 SVG 还原） ── */
const gNode = (name, ident, x, y) => `
  <div class="graph-node" data-op="open-model" data-ident="${esc(ident)}"
    style="position:absolute;left:${x}px;top:${y}px;width:200px;border:1px solid var(--flash-node-js);border-radius:var(--flash-radius-lg);background:var(--flash-bg-container);padding:9px 12px;cursor:pointer">
    <div style="font-weight:500;font-size:13px">${esc(name)}</div><div class="mono muted">${esc(ident)}</div>
  </div>`;
const gLabel = (x, y, t, semantic) => `
  <span style="position:absolute;left:${x}px;top:${y}px;padding:1px 8px;font-size:11px;background:var(--flash-bg-container);border:1px solid ${semantic ? 'var(--flash-node-sub)' : 'var(--flash-border)'};border-radius:10px;color:${semantic ? 'var(--flash-node-sub)' : 'var(--flash-text-secondary)'}" class="mono">${esc(t)}</span>`;
const viewGraph = `
<div data-view="graph" hidden>
  <div class="pane-head" style="align-items:flex-start">
    <div>
      <b style="font-size:15px">实体关系图</b>
      <div class="muted" style="margin-top:3px;max-width:720px">展示模型间关联：外键边（列对标注，箭头由引用方指向被引用方）+ 语义关系边（分类:语义 标注）；点击实体进入编辑。</div>
    </div>
    <select style="height:28px" data-graph-filter><option>全部业务域</option><option>精达传动</option><option>未分配</option></select>
  </div>
  <div data-graph-wrap style="border:1px solid var(--flash-border);border-radius:var(--flash-radius-lg);background:var(--flash-bg-container);overflow:auto">
    <div style="position:relative;width:980px;height:440px">
      <svg width="980" height="440" viewBox="0 0 980 440" style="position:absolute;inset:0">
        <defs>
          <marker id="garr-fk" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" style="stroke:var(--flash-primary)" stroke-width="1.4"></path></marker>
          <marker id="garr-sem" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" style="stroke:var(--flash-node-sub)" stroke-width="1.4"></path></marker>
        </defs>
        <line x1="300" y1="286" x2="446" y2="102" style="stroke:var(--flash-primary)" stroke-width="1.4" marker-end="url(#garr-fk)"></line>
        <line x1="644" y1="315" x2="378" y2="315" style="stroke:var(--flash-primary)" stroke-width="1.4" marker-end="url(#garr-fk)"></line>
        <line x1="606" y1="70" x2="740" y2="282" style="stroke:var(--flash-node-sub)" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#garr-sem)"></line>
      </svg>
      ${gLabel(300, 176, 'equipment_id → eq_id')}
      ${gLabel(452, 300, 'work_order_no → order_no')}
      ${gLabel(690, 158, '工艺:加工对象', true)}
      ${gNode('设备台账', 'md_equipment', 400, 36)}
      ${gNode('生产工单', 'md_work_order', 170, 286)}
      ${gNode('工序报工', 'md_process_report', 646, 286)}
      <div style="position:absolute;left:14px;bottom:12px;display:flex;gap:14px;font-size:11px;color:var(--flash-text-tertiary)">
        <span><span style="display:inline-block;width:18px;border-top:2px solid var(--flash-primary);vertical-align:middle;margin-right:5px"></span>外键边</span>
        <span><span style="display:inline-block;width:18px;border-top:2px dashed var(--flash-node-sub);vertical-align:middle;margin-right:5px"></span>语义关系边</span>
      </div>
    </div>
  </div>
  <div class="empty" data-graph-empty hidden style="min-height:220px"><div class="empty-mark">▤</div><span>暂无实体关系</span></div>
</div>`;

/* ── 弹窗 / 抽屉模板（文案逐字，由 diviner.js 实例化） ── */
const tpl = (name, inner) => `<template data-tpl="${name}">${inner}</template>`;
const radio = (name, value, label, checked) => `<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}>${esc(label)}</label>`;
const check = (label) => `<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox">${esc(label)}</label>`;

const tplModel = tpl('model', `
  ${field('模型标识', input({ 'data-req': '1', 'data-pattern': '^[A-Za-z_][A-Za-z0-9_]*$', 'data-err': '标识须以字母或下划线开头，仅包含字母、数字和下划线', 'data-m-ident': '1' }, '', '如 md_equipment'), { required: true, err: '标识须以字母或下划线开头，仅包含字母、数字和下划线' })}
  ${field('业务名称', input({ 'data-req': '1', 'data-err': '业务名称不能为空', 'data-m-name': '1' }), { required: true, err: '业务名称不能为空' })}
  ${field('业务同义词', input({}, '', '输入后回车'))}
  ${field('业务描述', input({ 'data-m-desc': '1' }))}
  <div class="form-section">存储来源</div>
  ${field('数据源', `<input list="dl-ds" data-req="1" data-err="数据源不能为空" data-m-ds="1" placeholder="输入以检索，支持 fedquery / uns"><datalist id="dl-ds"><option value="fedquery"></option><option value="uns"></option></datalist>`, { required: true, err: '数据源不能为空' })}
  ${field('数据库', input())}
  ${field('Schema', input())}
  ${field('数据来源', `<div style="display:flex;gap:16px;padding-top:6px">${radio('m-src', 'phys', '物理数据表', true)}${radio('m-src', 'sql', 'SQL 定义')}</div>`)}
  <div data-src-phys data-req-zone>${field('物理表名', input({ 'data-req0': '1', 'data-err': '物理表名称不能为空', 'data-m-table': '1' }), { required: true, err: '物理表名称不能为空' })}</div>
  <div data-src-sql data-req-zone hidden>${field('SQL 语句', `<textarea rows="4" class="mono" style="width:100%" data-req0="1" data-err="视图 SQL 不能为空" data-m-sql="1"></textarea>`, { required: true, err: '视图 SQL 不能为空' })}</div>
  ${field('主键', input({ 'data-m-pk': '1' }, '', '如 eq_id；复合主键以逗号分隔'))}
  ${field('参与检索发现', `<label class="switch"><input type="checkbox" checked data-m-search="1"><i></i></label>`)}
`);

const tplField = tpl('field', `
  ${field('字段标识', input({ 'data-req': '1', 'data-err': '字段标识不能为空', 'data-f-ident': '1' }, '', '如 eq_code'), { required: true, err: '字段标识不能为空' })}
  ${field('业务名称', input({ 'data-f-name': '1' }))}
  ${field('数据类型', `<select data-req="1" data-err="数据类型不能为空" data-f-type="1"><option value="">请选择</option><option>VARCHAR</option><option>BIGINT</option><option>INTEGER</option><option>DOUBLE</option><option>DECIMAL</option><option>BOOLEAN</option><option>DATE</option><option>TIMESTAMP</option></select>`, { required: true, err: '数据类型不能为空' })}
  ${field('字段同义词', input({}, '', '输入后回车'))}
  ${field('业务描述', input({ 'data-f-desc': '1' }))}
  ${field('规范单位', input({ 'data-f-unit': '1' }, '', '如 元、件'))}
  ${field('换算比例', input({ 'data-pattern': '^\\d+(\\.\\d+)?$', 'data-err': '须为正十进制数', 'data-f-ratio': '1' }, '', '如 1000'), { err: '须为正十进制数' })}
  ${field('分析角色', `<div style="display:flex;gap:16px;padding-top:6px">${radio('f-role', '未设置', '未设置', true)}${radio('f-role', '分析维度', '分析维度')}${radio('f-role', '度量', '度量')}</div>`)}
  ${field('标记', `<div style="display:flex;gap:14px;padding-top:6px;flex-wrap:wrap"><label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-f-time="1">时间维度</label>${check('允许 NULL')}${check('建立索引')}<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-f-hidden="1">隐藏字段</label></div>`)}
`);

const tplDomain = tpl('domain', `
  ${field('名称', input({ 'data-req': '1', 'data-err': '名称不能为空', maxlength: '50' }), { required: true, err: '名称不能为空' })}
`);

const tplSetDomain = tpl('set-domain', `
  ${field('所属业务域', `<select style="width:100%"><option value="">未分配</option><option>精达传动</option></select>`, { extra: '清空即解除分配；不改变模型 Ref 与权限。' })}
`);

const tplFk = tpl('fk', `
  ${field('目标模型', `<select data-fk-target data-req="1" data-err="请选择目标模型"><option value="">请选择目标模型</option><option>设备台账</option><option>生产工单</option><option>工序报工</option><option>质量检验</option></select>`, { required: true, err: '请选择目标模型', extra: '选中后带出对端主键首列' })}
  <div class="form-section">列映射</div>
  <div data-fk-rows></div>
  <div style="margin:6px 0 2px"><button class="btn sm" data-op-tpl="fk-add-row">＋ 添加列映射行</button></div>
`);

const tplMetric = tpl('metric', `
  ${field('指标类型', `<select data-metric-type data-req="1" data-err="指标类型不能为空"><option>原子</option><option>派生</option><option>独立</option></select>`, { required: true, err: '指标类型不能为空' })}
  ${field('指标标识', input({ 'data-req': '1', 'data-err': '指标标识不能为空', 'data-mt-ident': '1' }, '', '如 metric_asset_value_sum'), { required: true, err: '指标标识不能为空' })}
  ${field('指标名称', input({ 'data-req': '1', 'data-err': '指标名称不能为空', 'data-mt-name': '1' }), { required: true, err: '指标名称不能为空' })}
  ${field('同义词', input({}, '', '输入后回车'))}
  <div class="form-section">口径定义</div>
  <div data-metric-atomic data-req-zone>
    ${field('基表模型', `<select data-req0="1" data-err="原子指标必须关联基表模型"><option value="">请选择</option><option>设备台账</option><option>生产工单</option><option>工序报工</option><option>质量检验</option></select>`, { required: true, err: '原子指标必须关联基表模型' })}
    ${field('聚合函数', `<select data-agg><option>求和</option><option>计数</option><option>去重计数</option><option>平均</option><option>最小</option><option>最大</option><option>中位数</option><option>总体标准差</option></select>`)}
    ${field('取值表达式', `<div class="code-editor" contenteditable="true" data-expr>SELECT SUM(eq_value) FROM md_equipment</div>`, { required: true, err: '非计数聚合需要取值表达式' })}
  </div>
  <div data-metric-derived data-req-zone hidden>
    ${field('基础原子指标', `<select data-req0="1" data-err="派生指标必须选择基础原子指标"><option value="">请选择</option><option>设备原值合计</option><option>设备台数</option><option>合格报工数</option></select>`, { required: true, err: '派生指标必须选择基础原子指标' })}
    ${field('统计周期', `<div style="display:flex;gap:16px;padding-top:6px">${radio('d-period', 'all', '全量', true)}${radio('d-period', 'query', '按查询时间')}</div>`)}
    <div data-period-time data-req-zone hidden>${field('时间字段', `<select data-req0="1" data-err="按查询时间口径需要指定时间字段"><option value="">请选择</option><option>report_time 报工时间</option><option>order_date 下达日期</option></select>`, { required: true, err: '按查询时间口径需要指定时间字段' })}</div>
    <div data-cond-rows></div>
    <div style="margin:6px 0 2px"><button class="btn sm" data-op-tpl="cond-add-row">＋ 添加总体条件</button></div>
  </div>
  <div data-metric-independent data-req-zone hidden>
    ${field('实现 SQL', `<div class="code-editor" contenteditable="true" data-isql>SELECT a.eq_code AS 设备编码, SUM(a.qty) / NULLIF(SUM(a.plan_qty),0) AS 完成率 FROM md_process_report a GROUP BY a.eq_code</div>`)}
    ${field('参数声明', input({}, '', '如 班次、车间，多个以逗号分隔'))}
  </div>
  <div class="form-section">描述</div>
  ${field('指标描述', `<textarea rows="3" style="width:100%"></textarea>`)}
`);

const tplKnowledge = tpl('knowledge', `
  ${field('知识类型', `<select data-ktype data-req="1" data-err="知识类型不能为空"><option>术语</option><option>枚举定义</option><option>流程</option><option>场景</option></select>`, { required: true, err: '知识类型不能为空' })}
  ${field('知识标识', input({ 'data-req': '1', 'data-err': '知识标识不能为空' }, '', '如 kpi_yield'), { required: true, err: '知识标识不能为空' })}
  ${field('显示名称', input({ 'data-req': '1', 'data-err': '显示名称不能为空' }), { required: true, err: '显示名称不能为空' })}
  ${field('同义词', input({}, '', '输入后回车'))}
  ${field('关联实体', `<select><option value="">不关联（可选）</option><option>设备台账</option><option>生产工单</option><option>工序报工</option><option>质量检验</option></select>`)}
  ${field('描述', input())}
  <div data-k-md data-req-zone>
    <div class="form-section">内容 · Markdown</div>
    <div data-dtabs>
      <div class="tabs"><a href="javascript:;" data-dtab="edit" class="is-active">编辑</a><a href="javascript:;" data-dtab="preview">预览</a></div>
      <div data-dpane="edit"><textarea rows="6" class="mono" style="width:100%" data-req0="1" data-err="知识内容不能为空" data-k-content="1">## 定义
一次检验判定合格的产品。</textarea></div>
      <div data-dpane="preview" hidden><div class="note" data-k-preview></div></div>
    </div>
  </div>
  <div data-k-enum data-req-zone hidden>
    <div class="form-section">枚举取值</div>
    <div data-enum-rows></div>
    <div style="margin:6px 0 2px"><button class="btn sm" data-op-tpl="enum-add-row">＋ 添加枚举定义</button></div>
  </div>
`);

const tplApprove = tpl('approve', `
  ${field('审批备注', `<textarea rows="3" style="width:100%" placeholder="可选"></textarea>`)}
`);
const tplReject = tpl('reject', `
  ${field('审批备注', `<textarea rows="3" style="width:100%" data-req="1" data-err="驳回必须填写备注" placeholder="请说明驳回原因"></textarea>`, { required: true, err: '驳回必须填写备注' })}
`);

/* ── 实体详情模板：头部卡 + Tabs（字段 / 外键 / 相关指标 / 相关 SQL 片段 / 相关知识 / 相关规则） ── */
const emptyBox = (t) => `<div class="empty" hidden style="min-height:130px"><div class="empty-mark">▤</div><span>${esc(t)}</span></div>`;
const tplDetail = tpl('detail', `
  <div data-detail-root>
    <section class="card">
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <span data-d-icon style="display:grid;place-items:center;width:44px;height:44px;border-radius:var(--flash-radius-lg);background:var(--flash-stat-blue);color:var(--flash-primary);font-size:20px;font-weight:600;flex:none">模</span>
        <div style="min-width:260px;flex:1">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <b style="font-size:16px" data-d-name>设备台账</b>
            <span class="mono muted" data-d-ident>md_equipment</span>
            <span data-d-kindtag>${ctag('SQL 视图', 'purple')}</span>
            <span data-d-retag hidden><span class="tag">不参与检索</span></span>
          </div>
          <div style="margin-top:6px;font-size:13px" data-d-desc><span class="muted">还没有业务描述，点击编辑补充。</span></div>
          <div style="margin-top:6px;font-size:12px;display:flex;gap:6px;align-items:center" data-d-domain><span class="muted">业务域：</span><span data-d-domain-val>${tag('精达传动', 'info')}</span></div>
        </div>
        <div class="btn-row" style="margin-left:auto">
          <button class="btn" data-op="edit-model">编辑模型</button>
          <button class="btn danger" data-op="del-model">删除</button>
        </div>
      </div>
    </section>
    <div data-dtabs style="margin-top:12px">
      <div class="tabs">
        <a href="javascript:;" data-dtab="fields" class="is-active">字段 <span data-fcount>0</span></a>
        <a href="javascript:;" data-dtab="fks">外键 <span data-fkcount>0</span></a>
        <a href="javascript:;" data-dtab="rel-metric">相关指标</a>
        <a href="javascript:;" data-dtab="rel-sql">相关 SQL 片段</a>
        <a href="javascript:;" data-dtab="rel-knowledge">相关知识</a>
        <a href="javascript:;" data-dtab="rel-rule">相关规则</a>
      </div>
      <div data-dpane="fields">
        <div class="pane-head">
          <div style="display:flex;gap:8px;align-items:center">
            <input style="width:220px;height:28px" placeholder="搜索字段名称或业务含义…" data-search="field">
            <select style="height:28px" data-filter="field"><option>全部字段</option><option>分析维度</option><option>度量</option><option>时间维度</option><option>隐藏字段</option></select>
          </div>
          <button class="btn sm primary" data-op="add-field">添加字段</button>
        </div>
        <div data-list="field">
          <div class="table-wrap"><table class="flash-table"><thead><tr><th>字段 / 业务名称</th><th>类型</th><th>业务描述</th><th>单位</th><th>字段语义角色</th><th>可见性</th><th>操作</th></tr></thead><tbody data-field-body></tbody></table></div>
        </div>
        <div class="empty" data-empty hidden style="min-height:130px"><div class="empty-mark">▤</div><span>没有符合条件的字段</span></div>
      </div>
      <div data-dpane="fks" hidden>
        <div class="pane-head">
          <span class="muted">外键声明本端列到对端模型列的引用；「被引用」方向由对端模型声明自动带出，入边只读。</span>
          <button class="btn sm primary" data-op="add-fk">添加外键</button>
        </div>
        <div data-list="fk">
          <div class="table-wrap"><table class="flash-table"><thead><tr><th>方向</th><th>本端列</th><th>对端模型</th><th>对端列</th><th>操作</th></tr></thead><tbody data-fk-body></tbody></table></div>
        </div>
        ${emptyBox('还没有外键声明')}
      </div>
      <div data-dpane="rel-metric" hidden>
        <div data-list="rel-metric"><div class="table-wrap"><table class="flash-table"><thead><tr><th>指标名称</th><th>类型</th><th>口径</th></tr></thead><tbody data-rel-body="rel-metric"></tbody></table></div></div>
        ${emptyBox('暂无数据')}
      </div>
      <div data-dpane="rel-sql" hidden>
        <div data-list="rel-sql"><div class="table-wrap"><table class="flash-table"><thead><tr><th>片段标识</th><th>说明</th></tr></thead><tbody data-rel-body="rel-sql"></tbody></table></div></div>
        ${emptyBox('暂无数据')}
      </div>
      <div data-dpane="rel-knowledge" hidden>
        <div data-list="rel-knowledge"><div class="table-wrap"><table class="flash-table"><thead><tr><th>名称</th><th>类型</th><th>内容</th></tr></thead><tbody data-rel-body="rel-knowledge"></tbody></table></div></div>
        ${emptyBox('暂无数据')}
      </div>
      <div data-dpane="rel-rule" hidden>
        <div data-list="rel-rule"><div class="table-wrap"><table class="flash-table"><thead><tr><th>规则名称</th><th>内容</th></tr></thead><tbody data-rel-body="rel-rule"></tbody></table></div></div>
        ${emptyBox('暂无数据')}
      </div>
    </div>
  </div>
`);

const body = `
<div class="split tree-main">
  <aside>${sider}</aside>
  <div data-views>
    ${viewDomains}
    ${viewDetail}
    ${viewMetrics}
    ${viewKnowledge}
    ${viewDrafts}
    ${viewGraph}
  </div>
</div>
${tplModel}
${tplField}
${tplDomain}
${tplSetDomain}
${tplFk}
${tplMetric}
${tplKnowledge}
${tplApprove}
${tplReject}
${tplDetail}`;

export const def = {
  title: '语义模型', desc: 'diviner 前端还原：业务域与实体、字段与外键、指标、知识、知识草稿审批与实体关系图（二级交互）',
  crumb: ['设计期', '数据平台', '建模服务', '语义模型'],
  actions: '', ownToolbar: true, body, js: [S],
};
