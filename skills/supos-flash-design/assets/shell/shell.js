/* supOS Flash Design · 共享壳层（skill 包内版）
 * 页面只需 <body data-mode data-nav> + 内容片段；顶栏 / 侧栏 / 形态切换由此注入。
 * 注册表来自 assets/data.js（window.FLASH），形态清单、菜单、app 路由全部由它驱动。
 */
(function () {
  const F = window.FLASH || {};
  const body = document.body;
  const mode = body.dataset.mode || 'design';
  const navKey = body.dataset.nav || '';
  const contentHTML = body.innerHTML;
  body.innerHTML = '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const params = new URLSearchParams(location.search);
  const appKeys = Object.keys(F.apps || {});
  const currentApp = params.get('app') || appKeys[0] || 'app';
  const currentView = params.get('view') || '';

  let storedUser = null;
  try { storedUser = localStorage.getItem('flashUser'); } catch (e) {}
  const currentUser = params.get('user') || storedUser || F.account || 'admin';

  /* 统一的 URL 生成：所有形态跳转都带走账号上下文 */
  function withUser(file, extra) {
    const q = new URLSearchParams();
    q.set('user', currentUser);
    Object.entries(extra || {}).forEach(([k, v]) => { if (v) q.set(k, v); });
    return file + '?' + q.toString();
  }
  const modeFile = (id) => ((F.modes || []).find((m) => m.id === id) || {}).file || '';

  /* 顶栏「切换视图」下拉：形态清单只从注册表派生 */
  function formSwitchHTML() {
    const forms = (F.modes || []).filter((m) => m.id !== 'login');
    return `<details class="view-switch">
      <summary class="flash-header-action" title="切换视图"><span class="ico">▦</span><span class="label">切换视图</span><span class="ico">⌄</span></summary>
      <div class="view-menu">
        ${forms.map((f) => `<a href="${withUser(f.file)}" class="${f.id === mode ? 'is-active' : ''}">${esc(f.label)}${f.id === mode ? '（当前）' : ''}</a>`).join('')}
      </div>
    </details>`;
  }

  /* 运行期一键互跳 + hover 浮出「切换到设计期」 */
  function switchHTML() {
    if (mode === 'runtime-desktop') {
      return `<div class="view-hover"><a class="desk-tag" href="${withUser(modeFile('runtime-menu'))}">菜单视图 ⇄</a>
        <div class="view-hover-menu"><div class="menu-label">切换形态</div>
          <a href="${withUser(modeFile('design'))}">切换到设计期</a>
          <a href="${withUser(modeFile('runtime-desktop'))}">桌面视图（当前）</a></div></div>`;
    }
    if (mode === 'runtime-menu') {
      return `<div class="view-hover"><a class="flash-header-action" href="${withUser(modeFile('runtime-desktop'))}"><span class="ico">⇄</span><span class="label">桌面视图</span></a>
        <div class="view-hover-menu"><div class="menu-label">切换形态</div>
          <a href="${withUser(modeFile('design'))}">切换到设计期</a>
          <a href="${withUser(modeFile('runtime-menu'))}">菜单视图（当前）</a></div></div>`;
    }
    return '';
  }

  function headerHTML() {
    return `<header class="flash-header" data-component="FlashHeader">
      <a class="flash-brand" href="index.html"><img src="assets/brand/default_logo.svg" alt="supOS X"></a>
      <div class="flash-header-right">
        <button class="flash-header-action" title="手册"><span class="ico">▤</span><span class="label">手册</span></button>
        <button class="flash-header-action flash-badge" title="通知"><span class="ico">◔</span></button>
        <button class="flash-header-action" title="全屏"><span class="ico">⛶</span></button>
        ${switchHTML()}
        ${formSwitchHTML()}
        <span class="flash-avatar" title="当前账号">·</span>
      </div>
    </header>`;
  }

  /* ── 菜单树 ── */
  function isActive(item, kind) {
    if (kind === 'runtime') {
      if (item.app && item.app === currentApp) {
        if (item.view) return item.view === currentView;
        return !currentView;
      }
      return false;
    }
    return item.file && navKey && item.file.split('#')[0] === navKey;
  }
  const DESIGN_ICON = {
    database: 'Metadata-BsqjsLQJ.png', spark: 'AppMgmt-DuQX471w.png', app: 'AppMgmt-DuQX471w.png',
    agent: 'app-logo-default.png', setting: 'app-logo-default.png', store: 'app-logo-default.png',
  };
  const GLYPH = { home: '⌂', database: '▤', spark: '✦', app: '▣', agent: '◈', setting: '⚙', store: '▦', star: '★' };
  function icon(name, kind, level) {
    if (kind === 'runtime') return `<span class="nav-ico"><img src="assets/brand/app-logo-default.png" alt=""></span>`;
    if (level === 1 && DESIGN_ICON[name]) return `<span class="nav-ico"><img src="assets/brand/${DESIGN_ICON[name]}" alt=""></span>`;
    if (level >= 2) return `<span class="nav-ico glyph" style="opacity:.45">·</span>`;
    return `<span class="nav-ico glyph">${GLYPH[name] || '·'}</span>`;
  }
  function containsActive(children, kind) {
    return (children || []).some((c) => isActive(c, kind) || containsActive(c.children, kind));
  }
  function navHTML(items, kind, level) {
    level = level || 1;
    return items.map((item) => {
      const active = isActive(item, kind);
      if (item.type === 'item') {
        const href = kind === 'runtime'
          ? withUser('runtime-menu.html', { app: item.app || currentApp, view: item.view || '' })
          : (item.file || '#');
        return `<a class="nav-row level-${level} ${active ? 'is-active' : ''}" href="${href}"
          data-component="NavItem" data-nav-kind="${kind}" ${kind === 'runtime' ? `data-app="${esc(item.app || '')}" data-view="${esc(item.view || '')}"` : ''}>
          ${icon(item.icon, kind, level)}<span>${esc(item.label)}</span></a>`;
      }
      const open = (kind === 'design' && level === 1) || active || containsActive(item.children, kind);
      const label = item.file
        ? `<a href="${item.file}" style="color:inherit">${esc(item.label)}</a>`
        : `<span>${esc(item.label)}</span>`;
      return `<div class="nav-group ${open ? 'is-open' : ''}">
        <div class="nav-row level-${level} ${active ? 'is-active' : ''}" data-component="NavGroup" data-action="toggle-group">
          ${icon(item.icon, kind, level)}${label}
          <span class="nav-caret" role="button" aria-label="展开或收起">▸</span>
        </div>
        <div class="nav-children">${navHTML(item.children || [], kind, level + 1)}</div>
      </div>`;
    }).join('');
  }
  function siderHTML(kind) {
    const items = kind === 'runtime' ? (F.runtimeNav || []) : (F.designNav || []);
    const ph = kind === 'runtime' ? '输入菜单名称搜索' : '搜索菜单 / 模块';
    return `<aside class="flash-sider" data-component="FlashSider">
      <div class="flash-sider-head"><div class="flash-search"><span>⌕</span><input placeholder="${ph}" aria-label="搜索菜单"></div></div>
      <nav class="flash-nav">${navHTML(items, kind, 1)}</nav>
    </aside>`;
  }

  /* ── 组装 ── */
  if (mode !== 'login' && mode !== 'runtime-desktop' && mode !== 'bare') {
    const kind = mode === 'runtime-menu' ? 'runtime' : 'design';
    body.insertAdjacentHTML('beforeend', headerHTML() + siderHTML(kind) +
      `<main class="flash-content" data-component="FlashContent">${contentHTML}</main>`);
  } else {
    body.insertAdjacentHTML('beforeend', `<main class="flash-content">${contentHTML}</main>`);
  }

  document.querySelectorAll('.flash-avatar').forEach((a) => {
    a.textContent = currentUser.slice(0, 1).toUpperCase();
    a.title = '当前账号 ' + currentUser;
  });

  /* ── app iframe：按 app.route 声明拼接参数 ── */
  function appSrc(appKey, view) {
    const a = (F.apps || {})[appKey];
    if (!a) return '';
    const bits = [];
    if (a.navOff !== false) bits.push('nav=0');
    if (view) {
      const r = a.route || {};
      const param = r.param || 'view';
      const value = (r.map && r.map[view]) || view;
      bits.push(param + '=' + encodeURIComponent(value));
    }
    bits.push('user=' + encodeURIComponent(currentUser));
    return a.src + (a.src.includes('?') ? '&' : '?') + bits.join('&');
  }
  function setFrame(appKey, view) {
    const a = (F.apps || {})[appKey];
    const frame = document.getElementById('app-frame');
    if (!a || !frame) return;
    frame.src = appSrc(appKey, view);
    const showView = view && (a.children || []).length ? view : '';
    const label = document.getElementById('current-app-label');
    if (label) label.textContent = a.label + (showView ? ' · ' + showView : '');
    const note = document.getElementById('current-app-note');
    if (note) note.textContent = a.note || '';
  }
  if (mode === 'runtime-menu') setFrame(currentApp, currentView);

  /* ── 桌面视图：三个 tab + 账号透传 ── */
  if (mode === 'runtime-desktop') {
    const right = document.querySelector('.desk-topbar-right');
    if (right) right.insertAdjacentHTML('afterbegin', switchHTML() + formSwitchHTML());
    const deskTab = params.get('tab') || 'app';
    document.querySelectorAll('[data-desk-tab]').forEach((s) => { s.hidden = s.dataset.deskTab !== deskTab; });
    document.querySelectorAll('[data-desk-tab-link]').forEach((a) => {
      const id = a.dataset.deskTabLink;
      a.setAttribute('href', withUser('runtime-desktop.html', id === 'app' ? {} : { tab: id }));
      a.classList.toggle('is-active', id === deskTab);
    });
    document.querySelectorAll('iframe[data-app-frame]').forEach((f) => {
      const key = f.dataset.appFrame || appKeys[0];
      f.setAttribute('src', appSrc(key, ''));
    });
  }

  /* ── 页内 tab（保留 query，避免丢账号） ── */
  function applyHash() {
    const h = location.hash;
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === h));
    document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = '#' + s.dataset.section !== h; });
  }
  if (location.hash) applyHash();

  /* ── 交互 ── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t && t.dataset.action === 'toggle-group') {
      if (e.target.closest('a[href]')) return;
      e.preventDefault();
      t.closest('.nav-group').classList.toggle('is-open');
      return;
    }

    const loginBtn = e.target.closest('[data-login-submit]');
    if (loginBtn) {
      e.preventDefault();
      const input = document.getElementById('username');
      const user = (input && input.value.trim()) || F.account || 'admin';
      try { localStorage.setItem('flashUser', user); } catch (err) {}
      const q = new URLSearchParams(); q.set('user', user);
      location.href = (modeFile('runtime-desktop') || 'runtime-desktop.html') + '?' + q.toString();
      return;
    }

    document.querySelectorAll('.view-switch[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); });

    if (mode === 'runtime-menu') {
      const link = e.target.closest('a[data-nav-kind="runtime"]');
      if (link) {
        e.preventDefault();
        const app = link.dataset.app || currentApp;
        const view = link.dataset.view || '';
        history.replaceState(null, '', withUser('runtime-menu.html', { app, view }));
        setFrame(app, view);
        document.querySelectorAll('.flash-nav a').forEach((x) => x.classList.remove('is-active'));
        link.classList.add('is-active');
        return;
      }
    }

    const tab = e.target.closest('[data-tab]');
    if (tab) {
      e.preventDefault();
      const id = tab.dataset.tab;
      history.replaceState(null, '', location.pathname + location.search + '#' + id);
      document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === id));
      document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = s.dataset.section !== id; });
    }
  });
})();
