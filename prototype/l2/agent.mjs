/* 设计期 · Agent 管理（L2）
 * 规格：.cache/flash-l2-specs/05-openapi-apps-store.md
 * 实证：Agent 随 APP 自动注册，无手工注册弹窗（GET /os/inter-api/agent-mesh/agents/list） */
import { esc, tag, table, note } from './helpers.mjs';

const S = 'assets/page/agent.js';
const online = (on) => `<span class="dot-status" style="color:${on ? 'var(--flash-success)' : 'var(--flash-text-muted)'}">${on ? '在线' : '离线'}</span>`;

const rows = table(['名称', '描述', '所属APP', '状态', '在线状态', '操作'], [
  ['AppDesignTool', 'APP 综合开发工具内置设计 Agent', 'APP综合开发工具', tag('已安装', 'info'), online(true), '<a href="#" data-op="detail" data-name="AppDesignTool">详情</a>'],
  ['生产运维助手', '生产运行期的运维问答、工单与巡检 Agent', '生产运维助手APP', tag('运行中', 'ok'), online(true), '<a href="#" data-op="detail" data-name="生产运维助手">详情</a>'],
]);

const body = `
  ${note('Agent 随 APP 自动注册，无手工注册入口（手册与接口实证：GET /os/inter-api/agent-mesh/agents/list）；线上目录实测仅 2 个（AppDesignTool、生产运维助手）。')}
  ${rows}
`;

export const def = {
  title: 'Agent 管理',
  desc: 'Agent 目录与运行状态只读查看，随 APP 自动注册（二级交互：详情抽屉）',
  crumb: ['设计期', 'Agent 管理'],
  actions: '', ownToolbar: true, body, js: [S],
};
