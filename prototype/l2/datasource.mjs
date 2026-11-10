/* 设计期 · 数据源注册（L2）
 * 规格：.cache/flash-l2-specs/01-datasource-connect.md（源码：supbase-frontend-main/src/pages/DataSource） */
import { esc, tag, table, card, section, note, realToolbar, searchBox, input, select, field } from './helpers.mjs';

const S = 'assets/page/datasource.js';

/* 表格行（列序＝源码 SourceContent.tsx：别名/显示名称/描述/业务分类/数据源类型/连接地址/连接状态/创建来源/更新人/更新时间/操作） */
const linkSt = (n) => n === 1 ? tag('已连接', 'ok') : n === 0 ? tag('失败', 'err') : tag('未连接', 'err');
const ops = (name, extra) =>
  `<span class="link-ops"><a href="#" data-op="edit" data-name="${esc(name)}">编辑</a><a href="#" data-op="copy" data-name="${esc(name)}">复制</a>` +
  `<a href="#" data-op="more" data-name="${esc(name)}">更多</a><a href="#" class="danger" data-op="del" data-name="${esc(name)}">删除</a></span>` + (extra || '');

const rowsHtml = table(['', '别名', '显示名称', '描述', '业务分类', '数据源类型', '连接地址', '连接状态', '创建来源', '更新人', '更新时间', '操作'], [
  ['', 'jinda_mes', '精达设备台账库', '设备台账与维修记录', '业务系统', 'MySQL', '106.55.100.236:3306', linkSt(1), '手动新增', 'shaokun', '2026-11-02 14:22', ops('精达设备台账库')],
  ['', 'kingdee_order', '金蝶生产工单', '金蝶 K3 生产工单接口', '业务系统', 'REST API', 'kingdee.example.local', linkSt(1), '手动新增', 'shaokun', '2026-11-03 09:10', ops('金蝶生产工单')],
  ['', 'jingda_opcua', 'JINGDA_OPCUA', 'CNC 车间 OPC UA 采集', 'IIoT采集设备', 'OPC UA', 'opc.tcp://172.21.6.2:53880', linkSt(1), '手动新增', 'shaokun', '2026-10-23 16:40', ops('JINGDA_OPCUA')],
  ['', 'zhusuji_pg', '注塑机实时库', '注塑车间工艺参数', '数据库', 'PostgreSQL', '10.12.4.8:5432', linkSt(1), '手动新增', 'zhangwei', '2026-10-25 11:02', ops('注塑机实时库')],
  ['', 'ts_history', '时序历史库', '平台时序历史数据', '存储服务', 'TimescaleDB', '10.12.4.9:5432', linkSt(1), '系统初始化', 'admin', '2026-09-30 08:00', ops('时序历史库')],
  ['', 'modbus_spare', '备用采集源', 'Modbus 备用链路', 'IIoT采集设备', 'Modbus TCP', '172.21.6.9:502', linkSt(0), '手动新增', 'shaokun', '2026-10-28 15:31', ops('备用采集源')],
  ['', 'uns_readonly', 'UNS 只读视图', '联邦查询默认数据源', '存储服务', '联邦查询', 'uns://platform', linkSt(2), '系统初始化', 'admin', '2026-09-30 08:00', ops('UNS 只读视图')],
]);

const body = `
  <div class="split sider-main">
    ${card('数据源分类', `
      <div class="segmented" data-sider-mode><a class="is-active">业务分类</a><a>数据源分类</a></div>
      <div style="display:flex;align-items:center;gap:6px;margin:10px 0 8px">
        <input style="flex:1;height:28px" placeholder="输入目录名称搜索">
        <button class="btn sm" data-op="add-cat" title="新增业务分类">＋</button>
      </div>
      <div class="tree" data-component="DatasourceSider">
        <div class="tree-row is-active">全部<span class="sub" style="margin-left:auto">7</span></div>
        <div class="tree-row">IIoT采集设备<span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row">数据库<span class="sub" style="margin-left:auto">1</span></div>
        <div class="tree-row">业务系统<span class="sub" style="margin-left:auto">2</span></div>
        <div class="tree-row">存储服务<span class="sub" style="margin-left:auto">2</span></div>
        <div class="fm-divider" style="height:1px;background:var(--flash-border);margin:6px 0"></div>
        <div class="tree-row">未连通的数据源<span class="sub" style="margin-left:auto">1</span></div>
      </div>`)}
    <div>
      ${realToolbar(
        `${searchBox('数据源名称')}${searchBox('连通状态', '请选择连通状态').replace('<input', '<select style="width:160px;height:28px"><option>请选择连通状态</option><option>已连接</option><option>失败</option></select><input hidden')}`,
        `<button class="btn primary" data-op="add">＋ 新增</button><button class="btn">刷新</button><button class="btn" data-op="test">测试连通性</button><button class="btn" data-op="batch-del" title="批量删除">🗑</button>`,
        7)}
      ${rowsHtml}
      ${note('联邦查询只读，无 DDL/DML；UNS 关系表无事务，MES 类业务应选独立 PostgreSQL。元数据采集仅支持关系库与时序库。')}
    </div>
  </div>`;

const actions = '<button class="btn primary" data-op="add">＋ 新增</button>';

export const def = {
  title: '数据源注册', desc: '登记外部库与采集源，供建模、联邦查询和应用消费（二级交互：注册向导 / 配置弹窗 / 元数据采集抽屉）',
  crumb: ['设计期', '数据平台', '连接服务', '数据源注册'],
  actions, ownToolbar: true, body, js: [S],
};
