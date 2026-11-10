/* l2 共享视图助手（build-pages.mjs 与各 l2 模块共同复用，避免两份定义漂移） */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;
export const crumb = (...p) => `<div class="crumb">${p.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
export const head = (t, d, actions = '') => `<div class="page-head"><div><h1>${esc(t)}</h1><p>${esc(d)}</p></div><div class="btn-row">${actions}</div></div>`;
export const tabbar = (label = '首页') => `<div class="tabbar" data-component="TabBar"><span class="tab">${esc(label)}<span class="close">×</span></span></div>`;
export const sysNotice = () => `<div class="sys-notice" data-component="SysNotice"><img src="assets/brand/smnIcon-CBGfisYv.png" alt=""><span>系统维护通知：平台将于本周日 22:00–23:00 进行例行维护，届时部分服务短暂不可用。</span><a class="more" href="#">查看详情 ›</a></div>`;
export const table = (heads, rows) => `<div class="table-wrap"><table class="flash-table" data-component="FlashTable"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const stat = (label, value, foot = '', cls = '') => `<div class="stat-card ${cls}" data-component="StatCard"><div class="label">${esc(label)}</div><div class="value">${value}</div>${foot ? `<div class="foot">${esc(foot)}</div>` : ''}</div>`;
export const card = (t, inner, enterFile = '') => `<section class="card" data-component="FlashCard"><div class="card-head"><h3>${esc(t)}</h3>${enterFile ? `<a class="enter" href="${enterFile}">进入 ›</a>` : ''}</div>${inner}</section>`;
export const section = (t, more = '') => `<div class="section-title"><span>${esc(t)}</span>${more ? `<a class="more" href="${more}">进入 ›</a>` : ''}</div>`;
export const kv = (pairs) => `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
export const note = (t, warn = false) => `<div class="note ${warn ? 'warn' : ''}">${t}</div>`;
export const tabs = (items) => `<div class="tabs">${items.map(([id, label], i) => `<a href="#${id}" data-tab="${id}" class="${i === 0 ? 'is-active' : ''}">${esc(label)}</a>`).join('')}</div>`;
export const pane = (id, inner, show) => `<div data-section="${id}" ${show ? '' : 'hidden'}>${inner}</div>`;
export const fields = (items) => items.map(([label, value, type = 'text']) => `<div class="field"><label>${esc(label)}</label><input type="${type}" value="${esc(value)}"></div>`).join('');
/* 校验字段：attrs 为 data-req / data-err / data-max / data-pattern / data-errMax（interact.js 校验用） */
export const field = (label, ctrl, { required = false, err = '', extra = '', wide = false } = {}) =>
  `<div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start${wide ? ';max-width:none' : ''}">
    <label style="width:120px;flex:none;padding-top:7px;${required ? '' : ''}"><span class="${required ? 'req' : ''}">${esc(label)}</span></label>
    <div class="f-ctrl">${ctrl}</div>
    ${extra ? `<div class="f-extra">${extra}</div>` : ''}
    <div class="f-err">${esc(err)}</div>
  </div>`;
export const input = (attrs = {}, value = '', ph = '') =>
  `<input ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} value="${esc(value)}" placeholder="${esc(ph)}">`;
export const select = (options, attrs = {}, selected = '') =>
  `<select ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>${options.map((o) => `<option ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
/* 第三参数：brand/xxx.png → 线上真实 48×48 图标；否则当作色值画字母块 */
export const quick = (items) => `<div class="quick-grid">${items.map(([label, file, icon]) => {
  const box = icon.startsWith('brand/')
    ? `<span class="quick-icon"><img src="assets/${icon}" alt=""></span>`
    : `<span class="quick-icon glyph" style="background:${icon}">${esc(label.slice(0, 1))}</span>`;
  return `<a class="quick-item" href="${file}">${box}<span>${esc(label)}</span></a>`;
}).join('')}</div>`;
/* 通用工具栏（仅 L1 概览页兜底用；L2 模块页用 realToolbar） */
export const toolbar = (label = '名称', count = 6) => `<div class="toolbar" data-component="Toolbar">
  <div class="search"><span>⌕</span><input placeholder="搜索${esc(label)}"></div>
  <select><option>全部状态</option><option>运行中</option><option>已停止</option></select>
  <button class="btn sm">刷新</button><span class="spacer"></span>
  <span class="count">共 ${count} 条 · 示例</span></div>`;
/* 顶部真实工具栏：搜索项 + 按钮区 + 计数 */
export const realToolbar = (searches, buttons, count) => `<div class="toolbar" data-component="Toolbar" style="flex-wrap:wrap">
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${searches}</div>
  <span class="spacer"></span>
  <div class="btn-row" style="gap:8px">${buttons}</div>
  <span class="count">共 ${count} 条 · 示例</span></div>`;
export const searchBox = (label, ph = '') => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--flash-text-tertiary)">${esc(label)}
  <input style="width:160px;height:28px" placeholder="${esc(ph || label)}"></span>`;
