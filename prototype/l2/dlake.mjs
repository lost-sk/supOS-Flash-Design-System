/* 设计期 · 数据库资源管理（DLake）· L2
 * 规格：.cache/flash-l2-specs/02-uns-dlake-fedquery.md「数据库资源管理（DLake）」章节 */
import { esc, tag, stat, note, realToolbar, tabs, searchBox } from './helpers.mjs';

const S = 'assets/page/dlake.js';

/* 行需要 data-kind/data-deleted/data-source/data-manual（页签过滤用），故自建表格标记 */
const tableHtml = (heads, rows) => `<div class="table-wrap"><table class="flash-table" data-component="FlashTable"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</thead><tbody>${rows.join('')}</tbody></table></div>`;

/* 状态：在线 var(--flash-success) / 离线 / 错误 var(--flash-error) */
const stTag = (s) => s === '在线'
  ? '<span class="dot-status" style="color:var(--flash-success)">在线</span>'
  : s === '离线'
    ? '<span class="dot-status" style="color:var(--flash-text-tertiary)">离线</span>'
    : s === '错误'
      ? '<span class="dot-status" style="color:var(--flash-error)">错误</span>'
      : tag('已删除', 'warn');

const opsCell = (name, { manual = false, deleted = false } = {}) => deleted
  ? `<span class="link-ops"><a href="#" data-op="restore" data-name="${esc(name)}">恢复</a><a href="#" class="danger" data-op="purge" data-name="${esc(name)}">彻底删除</a></span>`
  : `<span class="link-ops"><a href="#" data-op="detail" data-name="${esc(name)}">详情</a>` +
    (manual
      ? `<a href="#" data-op="edit" data-name="${esc(name)}">编辑</a>`
      : `<span class="muted" title="仅手动开通的资源可编辑" style="margin-right:8px">编辑</span>`) +
    `<a href="#" data-op="viewdb" data-name="${esc(name)}">查看数据库</a><a href="#" data-op="more" data-name="${esc(name)}">更多</a></span>`;

/* 列序：资源名称/状态/资源类型/数据库名称/实例名称/独占实例/资源来源/申请方来源/访问地址/描述/创建时间/更新时间/操作 */
const R = (kind, name, status, type, db, inst, exc, source, applier, addr, desc, created, updated, opts = {}) =>
  `<tr data-kind="${kind}"${opts.deleted ? ' data-deleted="1" hidden' : ''} data-source="${esc(source)}"${opts.manual ? ' data-manual="1"' : ''}>
    <td>${esc(name)}</td><td>${stTag(status)}</td><td>${esc(type)}</td><td class="mono">${esc(db)}</td><td>${esc(inst)}</td><td>${esc(exc)}</td>
    <td>${esc(source)}</td><td>${esc(applier)}</td><td class="mono">${esc(addr)}</td><td>${desc ? esc(desc) : '-'}</td>
    <td>${esc(created)}</td><td>${esc(updated)}</td><td>${opsCell(name, opts)}</td></tr>`;

const rows = [
  R('rel', '注塑机工艺库', '在线', 'PostgreSQL', 'inj_process', 'pg-main-01', '是', '申请资源', '平台服务', '10.12.4.8:5432', '注塑车间工艺参数库', '2026-09-12 10:20', '2026-11-01 15:40'),
  R('rel', '精达台账库', '在线', 'MySQL', 'jinda_mes', '-', '否', '注册资源', '手动开通', '106.55.100.236:3306', '外部已开通库，仅纳管连接', '2026-09-28 11:05', '2026-10-30 09:12', { manual: true }),
  R('rel', '金蝶中间库', '离线', 'SQL Server', 'kingdee_mid', '-', '否', '注册资源', '手动开通', 'kingdee.example.local', '', '2026-10-11 16:44', '2026-10-25 10:02', { manual: true }),
  R('rel', '质检报告库', '错误', 'PostgreSQL', 'qc_report', 'pg-main-01', '否', '申请资源', '平台服务', '10.12.4.8:5432', '', '2026-10-18 14:30', '2026-11-02 08:55'),
  R('ts', '设备时序库', '在线', 'TimescaleDB', 'ts_history', 'ts-main-01', '否', '申请资源', '平台服务', '10.12.4.9:5432', '平台时序历史数据', '2026-09-30 08:00', '2026-10-20 09:00'),
  R('ts', '能源时序库', '在线', 'TimescaleDB', 'energy_ts', 'ts-main-01', '是', '申请资源', '平台服务', '10.12.4.9:5432', '', '2026-10-02 10:00', '2026-10-22 17:20'),
  R('nonrel', '缓存服务', '离线', 'Redis', 'cache_main', 'redis-main', '否', '注册资源', '手动开通', '172.21.6.20:6379', '', '2026-10-05 09:40', '2026-10-15 11:11', { manual: true }),
  R('file', '图纸对象存储', '在线', 'MinIO', 'drawings', 'minio-main', '否', '申请资源', '扩展应用', 'minio.local:9000', '工艺图纸与文档', '2026-10-08 13:22', '2026-11-05 14:08'),
  R('dw', '报表数仓', '在线', 'ClickHouse', 'bi_warehouse', 'ch-main-01', '否', '申请资源', '平台服务', '10.12.4.30:8123', '经营报表与看板', '2026-09-15 10:10', '2026-11-08 09:45'),
  R('rel', '旧版注塑库', '已删除', 'PostgreSQL', 'inj_process_old', 'pg-main-01', '否', '注册资源', '手动开通', '10.12.4.8:5432', '', '2026-08-11 10:00', '2026-10-28 15:00', { deleted: true, manual: true }),
  R('ts', '临时试验库', '已删除', 'TimescaleDB', 'trial_ts', 'ts-main-01', '否', '申请资源', '平台服务', '10.12.4.9:5432', '', '2026-09-01 08:00', '2026-10-30 12:00', { deleted: true }),
];

const searches = `${searchBox('资源名称')}
  <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">资源类型
    <select style="width:150px;height:28px"><option>全部</option><option>PostgreSQL</option><option>MySQL</option><option>SQL Server</option><option>TimescaleDB</option><option>MinIO</option><option>Redis</option><option>ClickHouse</option></select></span>
  <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">状态
    <select style="width:110px;height:28px"><option>全部</option><option>离线</option><option>在线</option><option>错误</option></select></span>`;

const body = `
  <div class="grid cols-4" style="margin-bottom:14px">
    ${stat('接入数据库', '21')}
    ${stat('时序数据库', '1')}
    ${stat('关系数据库', '20')}
    ${stat('非关系数据库', '0')}
  </div>
  <div data-lake-tabs>${tabs([['all', '全部'], ['rel', '关系数据库'], ['nonrel', '非关系数据库'], ['ts', '时序数据库'], ['file', '文件数据库'], ['dw', '分析型数仓'], ['deleted', '已删除']])}</div>
  ${realToolbar(searches,
    `<button class="btn primary" data-op="add">＋ 新增</button><button class="btn" data-op="refresh">刷新</button>`,
    9)}
  ${tableHtml(['资源名称', '状态', '资源类型', '数据库名称', '实例名称', '独占实例', '资源来源', '申请方来源', '访问地址', '描述', '创建时间', '更新时间', '操作'], rows)}
  ${note('删除内部资源（申请资源）可在 30 天内恢复；外部资源（注册资源）删除后无法恢复。')}
`;

export const def = {
  title: '数据库资源管理', desc: '申请/注册数据库资源并统一纳管连接（二级交互：申请资源 / 注册资源 / 测试连接 / 删除与恢复）',
  crumb: ['设计期', '数据平台', '存储服务', '数据库资源管理'],
  actions: '', ownToolbar: true, body, js: [S],
};
