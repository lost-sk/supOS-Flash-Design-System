/* 设计期 · 数据接入服务（L2）
 * 规格：.cache/flash-l2-specs/01-datasource-connect.md「数据接入服务」
 * 页面本身为 Node-RED customApp（appId nodered，链接 /#/os/customApp/os_data_connection），专属前端源码不在工作区；
 * 主体还原可实证的 IIoT 采集设备节点表单：Node-Red 表单（IIoT/NodeRED.tsx）+ 时序数据采集器表单（SupCollector.tsx）。 */
import { esc, card, note, field, input, realToolbar, searchBox } from './helpers.mjs';

const S = 'assets/page/dataconnect.js';

/* 子节点枚举（规格实证） */
const SUBS = ['IoT网关', 'REST API采集器', 'WebSocket采集器', '模拟采集器', '视频采集器', '时序库连接器', 'MQTT 网关'];

const radio = (name, val, checked = false) =>
  `<label style="display:inline-flex;align-items:center;gap:5px;margin-right:16px;font-size:12px;color:var(--flash-text-secondary);cursor:pointer"><input type="radio" name="${name}" value="${esc(val)}" ${checked ? 'checked' : ''}>${esc(val)}</label>`;

/* UUID标识：禁用只读 + 「复制」（NodeRED.tsx / SupCollector.tsx 实证） */
const uuidField = (val) => field('UUID标识',
  `<div style="display:flex;gap:8px;align-items:center">${input({ disabled: '', class: 'mono', style: 'background:var(--flash-bg-page)' }, val)}<button class="btn sm" data-op="copy" data-copy="${esc(val)}" data-msg="UUID 已复制">复制</button></div>`);

const formFoot = `<div class="btn-row" style="margin-top:14px;justify-content:flex-end"><button class="btn" data-op="form-cancel">取 消</button><button class="btn primary" data-op="form-ok">确 定</button></div>`;

/* Node-Red 表单（IIoT/NodeRED.tsx）：描述默认「Node-RED数据流接入」；部署来源=外置时显示设备 IP */
const nodeRedCard = `
  <section class="card" data-component="FlashCard">
    <div class="card-head"><h3>Node-Red 表单</h3><span class="sub mono">IIoT/NodeRED.tsx · 可实证</span></div>
    ${field('描述', input({}, 'Node-RED数据流接入'))}
    ${uuidField('6f2a91c0.3e84bd17')}
    ${field('部署来源', radio('dep-src', '内置', true) + radio('dep-src', '外置'))}
    ${field('时间戳来源', radio('ts-src-node', '服务器时间', true) + radio('ts-src-node', '采集设备时间'))}
    <div data-dep-ip hidden>${field('设备 IP', input({}, '', `冗余 IP 以'|'分割`))}</div>
    ${formFoot}
  </section>`;

/* 时序数据采集器表单（SupCollector.tsx）：通讯加密 Switch → 密钥只读域 +「生成/生成中」「复制」 */
const collectorCard = `
  <section class="card" data-component="FlashCard">
    <div class="card-head"><h3>时序数据采集器表单</h3><span class="sub mono">SupCollector.tsx · 可实证</span></div>
    ${field('描述', input({}, '平台官方提供的时序数据采集器'))}
    ${uuidField('e5a37f28-91bc-4d6e-a2c7-58f0d3b19c44')}
    ${field('时间戳来源', radio('ts-src-col', '服务器时间', true) + radio('ts-src-col', '采集设备时间'))}
    ${field('通讯加密', `<label class="switch"><input type="checkbox" data-sw-enc checked><i></i></label>`)}
    <div data-sec-key>${field('密钥', `<div style="display:flex;gap:8px;align-items:center">${input({ readonly: '', class: 'mono', style: 'background:var(--flash-bg-page)' }, '3d19a8c2f7e64b509ac1d6e84f02b7a3')}<button class="btn sm" data-op="gen-key">生成</button><button class="btn sm" data-op="copy" data-keycopy="1">复制</button></div>`)}</div>
    ${formFoot}
  </section>`;

const body = `
  ${note('数据接入服务页面本身为 Node-RED customApp，界面源码不在工作区，以下为数据源注册中 IIoT 采集设备节点的可实证表单')}
  <div class="mono muted" style="margin:-6px 0 12px 2px">customApp：appId nodered · 链接 /#/os/customApp/os_data_connection</div>
  <div class="split tree-main">
    ${card('子节点', `<div class="tree" data-component="DataconnectSider">
      <div class="tree-row is-active">IIoT采集设备</div>
      <div class="tree-children">${SUBS.map((n) =>
        `<div class="tree-row" data-op="pick" data-name="${esc(n)}"><span class="dot" style="background:var(--flash-collect-doing)"></span>${esc(n)}</div>`).join('')}</div>
    </div>`)}
    <div>
      ${realToolbar(`${searchBox('节点名称')}`, `<button class="btn primary" data-op="deploy">部署</button><button class="btn">刷新</button>`, 7)}
      <div class="grid cols-2">${nodeRedCard}${collectorCard}</div>
      ${note('子节点共 7 类：IoT网关、REST API采集器、WebSocket采集器、模拟采集器、视频采集器、时序库连接器、MQTT 网关；其节点表单未在工作区实证，暂不还原。')}
    </div>
  </div>`;

export const def = {
  title: '数据接入服务',
  desc: 'Node-RED customApp（os_data_connection）；主体为数据源注册中 IIoT 采集设备节点的可实证表单（UUID 复制 / 部署来源 / 通讯加密密钥）',
  crumb: ['设计期', '数据平台', '连接服务', '数据接入服务'],
  actions: '', ownToolbar: true, body, js: [S],
};
