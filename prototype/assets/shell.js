/* supOS Flash 产品原型 · 共享壳层
 * 页面只需 <body data-mode="design" data-nav="xxx"> + 内容区 HTML，
 * 顶栏 / 侧栏 / 形态切换由本文件注入。无原型控制面板、无标注层。
 */
(function () {
  const F = window.FLASH;
  const body = document.body;
  const mode = body.dataset.mode || 'design';
  const navKey = body.dataset.nav || '';
  const contentHTML = body.innerHTML;
  body.innerHTML = '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const params = new URLSearchParams(location.search);
  const currentApp = params.get('app') || 'mes';
  const currentView = params.get('view') || '';

  /* ── 视图切换（三跳转统一入口）：右上角点击展开，点击跳转 ── */
  const FORMS = [
    { id: 'design', label: '设计期', file: 'design-home.html' },
    { id: 'runtime-desktop', label: '运行期 · 桌面视图', file: 'runtime-desktop.html' },
    { id: 'runtime-menu', label: '运行期 · 菜单视图', file: 'runtime-menu.html' },
  ];
  function formSwitchHTML() {
    return `<details class="view-switch">
      <summary class="flash-header-action" title="切换视图"><span class="ico">▦</span><span class="label">切换视图</span><span class="ico">⌄</span></summary>
      <div class="view-menu">
        ${FORMS.map((f) => `<a href="${f.file}" class="${f.id === mode ? 'is-active' : ''}">${f.label}${f.id === mode ? '（当前）' : ''}</a>`).join('')}
      </div>
    </details>`;
  }

  /* ── 顶栏：真实 logo + 手册 / 通知 / 全屏 / 形态下拉 / 头像 ── */
  function headerHTML() {
    return `<header class="flash-header" data-component="FlashHeader">
      <a class="flash-brand" href="index.html"><img src="assets/brand/default_logo.svg" alt="supOS X"></a>
      <div class="flash-header-right">
        <button class="flash-header-action" title="手册"><span class="ico">▤</span><span class="label">手册</span></button>
        <button class="flash-header-action flash-badge" title="通知"><span class="ico">◔</span></button>
        <button class="flash-header-action" title="全屏"><span class="ico">⛶</span></button>
        ${formSwitchHTML()}
        <span class="flash-avatar" title="当前账号 shaokun">S</span>
      </div>
    </header>`;
  }

  /* ── 菜单树 ── */
  function isActive(item, kind) {
    if (kind === 'runtime') {
      if (item.app && item.app === currentApp) {
        if (item.view) return item.view === currentView;
        /* 无 view：顶层 item（运行期 Copilot）与 app 分组根节点都按「当前 app」高亮 */
        return !currentView;
      }
      return false;
    }
    return item.file && navKey && item.file.split('#')[0] === navKey;
  }
  /* 一级菜单用线上真实 48×48 图标缩到 18px；二级只用浅色圆点 */
  const DESIGN_ICON = {
    database: 'Metadata-BsqjsLQJ.png', spark: 'AppMgmt-DuQX471w.png', app: 'AppMgmt-DuQX471w.png',
    agent: 'app-logo-default.png', flow: 'NodeRED-DlcyYFLJ.png', setting: 'app-logo-default.png',
    store: 'app-logo-default.png',
  };
  function icon(name, kind, level) {
    if (kind === 'runtime') return `<span class="nav-ico"><img src="assets/brand/app-logo-default.png" alt=""></span>`;
    if (level === 1 && DESIGN_ICON[name]) {
      return `<span class="nav-ico"><img src="assets/brand/${DESIGN_ICON[name]}" alt=""></span>`;
    }
    if (level >= 2) return `<span class="nav-ico glyph" style="opacity:.45">·</span>`;
    const map = { home: '⌂', database: '▤', spark: '✦', app: '▣', agent: '◈', flow: '⇄', setting: '⚙', store: '▦', star: '★' };
    return `<span class="nav-ico glyph">${map[name] || '·'}</span>`;
  }
  function navHTML(items, kind, level) {
    level = level || 1;
    return items.map((item) => {
      const active = isActive(item, kind);
      if (item.type === 'item') {
        const href = kind === 'runtime'
          ? `?app=${encodeURIComponent(item.app || currentApp)}&view=${encodeURIComponent(item.view || item.label)}`
          : (item.file || '#');
        return `<a class="nav-row level-${level} ${active ? 'is-active' : ''}" href="${href}"
          data-component="NavItem" data-nav-kind="${kind}" ${kind === 'runtime' ? `data-app="${esc(item.app || '')}" data-view="${esc(item.view || item.label)}"` : ''}>
          ${icon(item.icon, kind, level)}<span>${esc(item.label)}</span></a>`;
      }
      /* 线上设计期一级分组默认全部展开，二级保持折叠 */
      const open = (kind === 'design' && level === 1) || active || containsActive(item.children, kind);
      const label = kind === 'runtime'
        ? `<span>${esc(item.label)}</span>`
        : (item.file ? `<a href="${item.file}" style="color:inherit">${esc(item.label)}</a>` : `<span>${esc(item.label)}</span>`);
      return `<div class="nav-group ${open ? 'is-open' : ''}">
        <div class="nav-row level-${level} ${active ? 'is-active' : ''}" data-component="NavGroup" data-action="toggle-group">
          ${icon(item.icon, kind, level)}${label}
          <span class="nav-caret" role="button" aria-label="展开或收起">▸</span>
        </div>
        <div class="nav-children">${navHTML(item.children || [], kind, level + 1)}</div>
      </div>`;
    }).join('');
  }
  function containsActive(children, kind) {
    return (children || []).some((c) => isActive(c, kind) || containsActive(c.children, kind));
  }
  function siderHTML(kind) {
    const items = kind === 'runtime' ? F.runtimeNav : F.designNav;
    const ph = kind === 'runtime' ? '输入菜单名称搜索' : '搜索菜单 / 模块';
    return `<aside class="flash-sider" data-component="FlashSider">
      <div class="flash-sider-head"><div class="flash-search"><span>⌕</span><input placeholder="${ph}" aria-label="搜索菜单"></div></div>
      <nav class="flash-nav">${navHTML(items, kind, 1)}</nav>
    </aside>`;
  }

  /* ── 组装 ── */
  if (mode !== 'login' && mode !== 'runtime-desktop') {
    const kind = mode === 'runtime-menu' ? 'runtime' : 'design';
    body.insertAdjacentHTML('beforeend', headerHTML() + siderHTML(kind) +
      `<main class="flash-content" data-component="FlashContent">${contentHTML}</main>`);
  } else {
    body.insertAdjacentHTML('beforeend', `<main class="flash-content">${contentHTML}</main>`);
  }

  /* ── 当前账号：登录页写入 localStorage，缺省 admin ── */
  let storedUser = null;
  try { storedUser = localStorage.getItem('flashUser'); } catch (e) {}
  const currentUser = params.get('user') || storedUser || 'admin';
  document.querySelectorAll('.flash-avatar').forEach((a) => {
    a.textContent = currentUser.slice(0, 1).toUpperCase();
    a.title = '当前账号 ' + currentUser;
  });

  /* ── 交互 ── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t && t.dataset.action === 'toggle-group') {
      /* 一二级分组整行都可展开；行内的页面链接仍按链接跳转 */
      if (e.target.closest('a[href]')) return;
      e.preventDefault();
      t.closest('.nav-group').classList.toggle('is-open');
      return;
    }

    const loginBtn = e.target.closest('[data-login-submit]');
    if (loginBtn) {
      e.preventDefault();
      const input = document.getElementById('username');
      const user = (input && input.value.trim()) || 'admin';
      /* 任意密码都视为成功；用户名贯通到后续所有页面与试用之旅 iframe */
      try { localStorage.setItem('flashUser', user); } catch (e) {}
      location.href = 'runtime-desktop.html?user=' + encodeURIComponent(user);
      return;
    }

    /* 点击下拉外部时收起 */
    document.querySelectorAll('.view-switch[open]').forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });

    if (mode === 'runtime-menu') {
      const link = e.target.closest('a[data-nav-kind="runtime"]');
      if (link) {
        e.preventDefault();
        const app = link.dataset.app || currentApp;
        const view = link.dataset.view || '';
        history.replaceState(null, '', `?app=${encodeURIComponent(app)}&view=${encodeURIComponent(view)}`);
        setFrame(app, view);
        document.querySelectorAll('.flash-nav a').forEach((x) => x.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    }
  });

  function setFrame(app, view) {
    const frame = document.getElementById('app-frame');
    if (!frame || !F.apps[app]) return;
    let src = F.apps[app].src;
    /* 无子视图的 app（如运行期 Copilot）不追加 view 参数 */
    if (view && (F.apps[app].children || []).length) {
      src += (src.includes('?') ? '&' : '?') + 'view=' + encodeURIComponent(view);
    }
    frame.src = src;
    const hasViews = (F.apps[app].children || []).length > 0;
    const showView = view && hasViews ? view : '';
    const label = document.getElementById('current-app-label');
    if (label) label.textContent = F.apps[app].label + (showView ? ' · ' + showView : '');
    const note = document.getElementById('current-app-note');
    if (note) note.textContent = F.apps[app].note;
  }
  if (mode === 'runtime-menu') setFrame(currentApp, currentView);

  /* ── 运行期桌面视图：三个 tab ── */
  if (mode === 'runtime-desktop') {
    const right = document.querySelector('.desk-topbar-right');
    if (right) right.insertAdjacentHTML('afterbegin', formSwitchHTML());
    const deskTab = params.get('tab') || 'journey';
    document.querySelectorAll('[data-desk-tab]').forEach((s) => { s.hidden = s.dataset.deskTab !== deskTab; });
    document.querySelectorAll('[data-desk-tab-link]').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.deskTabLink === deskTab);
    });
    /* 把当前账号透传给试用之旅，identity / api/me 会显示该用户 */
    document.querySelectorAll('iframe').forEach((f) => {
      const src = f.getAttribute('src');
      if (!src || src.includes('user=')) return;
      f.setAttribute('src', src + (src.includes('?') ? '&' : '?') + 'user=' + encodeURIComponent(currentUser));
    });
  }

  /* ── 页内 tab（基础配置 / 企业运营配置子菜单） ── */
  if (location.hash) {
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === location.hash));
    document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = '#' + s.dataset.section !== location.hash; });
  }
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    e.preventDefault();
    const id = tab.dataset.tab;
    history.replaceState(null, '', '#' + id);
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === id));
    document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = s.dataset.section !== id; });
  });
})();
