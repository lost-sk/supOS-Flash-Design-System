/* Copilot 工作区 · 二级交互（线上实证 2026-11-10 + agent-chat-template 规格）
 * 演示一次完整任务闭环：用户提问 → 处理过程步骤 → 风险确认 → 继续执行 → 正式回答。 */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const cpw = $('[data-cpw]');
  const chatBody = $('[data-cp-body]');
  const chatWrap = $('[data-cp-chatwrap]');
  const convHead = $('[data-cp-convhead]');
  const hero = $('[data-cp-hero]');
  const statusEl = $('[data-cp-status]');
  const titleEl = $('[data-cp-title]');
  const textEl = $('[data-cp-text]');
  const searchEl = $('[data-cp-search]');

  const DEMO_Q = '把精达传动的设备台账接入平台';
  const ASK_Q = '统计上周设备点检完成率';
  const REPLY_FIXED = '已收到。演示环境不执行真实任务，你可以在输入框描述平台任务（如接入数据源、登记语义模型）查看完整交互流。';

  /* ── 会话（对话历史切换时保存 / 恢复消息与状态） ── */
  let SESSIONS = [
    { id: 's1', title: '设备台账接入平台' },
    { id: 's2', title: '注塑车间日报生成思路' },
  ];
  let cur = '';
  const memory = {}; // sid → { html, status, title }

  function snapshot() {
    if (cur) memory[cur] = { html: chatBody.innerHTML, status: statusEl.innerHTML, title: titleEl.textContent };
  }
  function showHero() {
    cur = '';
    convHead.hidden = true;
    chatWrap.hidden = true;
    hero.hidden = false;
    renderSessions();
  }
  function restore(sid) {
    const s = SESSIONS.find((x) => x.id === sid);
    if (!s) return showHero();
    cur = sid;
    const m = memory[sid];
    hero.hidden = true;
    convHead.hidden = false;
    chatWrap.hidden = false;
    titleEl.textContent = s.title;
    statusEl.innerHTML = m ? m.status : tag('处理完成', 'ok');
    chatBody.innerHTML = m ? m.html
      : `<div class="msg ai"><span class="avatar">A</span><div class="bubble"><span class="muted">该会话为历史记录，演示环境未保留消息内容。重新描述你的任务即可开始。</span></div></div>`;
    renderSessions();
  }
  function renderSessions() {
    const q = (searchEl ? searchEl.value : '').trim();
    const list = SESSIONS.filter((s) => !q || s.title.includes(q));
    $('[data-sessions]').innerHTML = list.map((s) => {
      const on = s.id === cur;
      return `<div class="cpw-hist-item ${on ? 'is-active' : ''}" data-op="session" data-sid="${s.id}" title="${esc(s.title)}">
        <span style="color:var(--flash-text-tertiary)">◷</span><span class="h-title">${esc(s.title)}</span>
        <button class="h-more" data-op="session-more" data-sid="${s.id}" title="更多">•••</button></div>`;
    }).join('') || `<div class="muted" style="padding:8px;font-size:12px">没有匹配的对话</div>`;
  }

  function setStatus(t, k) { statusEl.innerHTML = tag(t, k); }
  function scrollDown() { chatWrap.scrollTop = chatWrap.scrollHeight; }

  function userMsg(text) {
    chatBody.insertAdjacentHTML('beforeend',
      `<div class="msg user"><span class="avatar">U</span><div class="bubble">${esc(text)}</div></div>`);
    scrollDown();
  }
  function aiMsg(html) {
    chatBody.insertAdjacentHTML('beforeend',
      `<div class="msg ai"><span class="avatar">A</span><div class="bubble">${html}</div></div>`);
    scrollDown();
  }

  /* ── 处理过程步骤行：等待中 ○ / 处理中 spinner / 已完成 ✓ 绿 / 未完成 ✕ ── */
  const ICO = { wait: '○', doing: '<span class="st-spin">◌</span>', done: '✓', fail: '✕' };
  function stepRow(label, state, sub = '') {
    return `<div class="step-row ${state}" data-step="${esc(label)}"><span class="st-ico">${ICO[state] || '○'}</span><span>${esc(label)}</span>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}</div>`;
  }
  function setStep(label, state, sub) {
    const row = chatBody.querySelector(`[data-step="${CSS.escape(label)}"]`);
    if (!row) return;
    row.className = `step-row ${state}`;
    row.querySelector('.st-ico').innerHTML = ICO[state] || '○';
    const subEl = row.querySelector('.muted');
    if (sub) { if (subEl) subEl.textContent = sub; else row.insertAdjacentHTML('beforeend', `<span class="muted">${esc(sub)}</span>`); }
  }

  /* ── 风险确认卡（RiskConfirmation 实证文案） ── */
  function riskCardHtml() {
    return `<div class="risk-card" data-risk>
      <b>操作需要你的确认</b>
      <p>请核对以下操作，再决定是否允许执行。</p>
      <div class="risk-row">创建资源：<code>datasource/jinda_mes</code>（生产环境）</div>
      <div class="risk-btns">
        <button class="btn sm" data-op="risk" data-choose="allow">本次允许</button>
        <button class="btn sm" data-op="risk" data-choose="session">会话允许</button>
        <button class="btn sm danger" data-op="risk" data-choose="deny">拒绝操作</button>
      </div></div>`;
  }
  function riskReceipt(card, verdict) {
    card.innerHTML = `<b>操作确认 · ${verdict}</b><p>用户决定已记录，执行结果以任务实际返回为准。</p>`;
  }

  let demoRunning = false;

  /* 进入对话态（首条消息发出后隐藏欢迎区） */
  function enterConv(title) {
    hero.hidden = true;
    convHead.hidden = false;
    chatWrap.hidden = false;
    titleEl.textContent = title;
    if (!SESSIONS.some((s) => s.title === title)) {
      SESSIONS.unshift({ id: 's' + Date.now(), title });
      cur = SESSIONS[0].id;
    }
  }

  /* ── 任务闭环演示：把精达传动的设备台账接入平台 ── */
  function runDemo(question) {
    if (demoRunning) { U.toast('演示流程进行中，请先完成当前确认', 'info'); return; }
    demoRunning = true;
    enterConv(question);
    userMsg(question);
    setStatus('正在处理请求', 'info');
    aiMsg(`<div class="collapse"><details open><summary>处理过程 · 3 个步骤</summary><div class="cp-body">
      ${stepRow('正在理解需求', 'wait')}
      ${stepRow('注册 MySQL 数据源', 'wait')}
      ${stepRow('登记语义模型', 'wait')}
    </div></details></div>`);
    setTimeout(() => setStep('正在理解需求', 'done', '已完成'), 700);
    setTimeout(() => { setStep('注册 MySQL 数据源', 'doing', '处理中…'); setStatus('等待操作确认', 'warn'); }, 1500);
    setTimeout(() => aiMsg(riskCardHtml()), 2200);
  }
  function continueDemo(card, verdict) {
    riskReceipt(card, verdict);
    setStatus('正在生成回答', 'info');
    setStep('注册 MySQL 数据源', 'done', '已完成');
    setStep('登记语义模型', 'doing', '处理中…');
    setTimeout(() => {
      setStep('登记语义模型', 'done', '已完成');
      aiMsg(`<b>已把精达传动的设备台账接入平台：</b>
        <ul style="margin:8px 0 0;padding-left:18px;line-height:1.9">
          <li>创建数据源 <code>datasource/jinda_mes</code>（生产环境，MySQL）。</li>
          <li>登记语义模型：设备台账 / 设备 / 部件 三层结构。</li>
          <li>可在「语义模型」中继续配置指标与关系，随后即可在应用中消费。</li>
        </ul>`);
      setStatus('处理完成', 'ok');
      demoRunning = false;
    }, 1200);
  }
  function denyDemo(card) {
    riskReceipt(card, '已拒绝');
    setStep('注册 MySQL 数据源', 'fail', '未完成');
    setStatus('已停止', 'warn');
    demoRunning = false;
  }

  /* ── 反问卡（HumanInput：eyebrow「需要你补充」+ form 字段 + 提交回答） ── */
  function askCard(question) {
    enterConv(question);
    userMsg(question);
    setTimeout(() => {
      aiMsg(`<div class="mono muted" style="letter-spacing:1px">需要你补充</div>
        <div class="field" style="margin:10px 0 10px;align-items:center">
          <label style="width:auto;text-align:left;flex:none">数据源类型<span style="color:var(--flash-error)">*</span></label>
          <select data-ask-type style="flex:1"><option>MySQL</option><option>PostgreSQL</option><option>OPC UA</option></select>
        </div>
        <button class="btn sm primary" data-op="ask-submit">提交回答</button>`);
      setStatus('等待你的回答', 'warn');
    }, 500);
  }

  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    textEl.value = '';
    if (text === DEMO_Q) return runDemo(text);
    if (text === ASK_Q) return askCard(text);
    enterConv(text.length > 18 ? text.slice(0, 18) + '…' : text);
    userMsg(text);
    setTimeout(() => aiMsg(REPLY_FIXED), 500);
  }

  /* ── 事件委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    switch (a.dataset.op) {
      case 'send': send(textEl.value); break;
      case 'new-session': snapshot(); showHero(); break;
      case 'fold': cpw.classList.toggle('cpw-folded'); break;
      case 'session':
        if (a.dataset.sid !== cur) { snapshot(); restore(a.dataset.sid); }
        break;
      case 'session-more': {
        const sid = a.dataset.sid;
        U.dropdown({ trigger: a, items: [
          { label: '删除', onClick: () => U.confirm({
              title: '删除对话', content: `确定删除「${(SESSIONS.find((s) => s.id === sid) || {}).title || ''}」吗？`,
              okText: '确 定', danger: true,
              onOk: () => { SESSIONS = SESSIONS.filter((s) => s.id !== sid); if (cur === sid) showHero(); else renderSessions(); U.toast('对话已删除'); },
            }) },
        ] });
        break;
      }
      case 'agent-select':
        U.dropdown({ trigger: a, items: [
          { label: 'prod-ops-agent', onClick: () => { $('[data-agent-label]').textContent = 'prod-ops-agent'; } },
          { label: '设备守护智能体', onClick: () => { $('[data-agent-label]').textContent = '设备守护智能体'; } },
        ] });
        break;
      case 'model-select':
        U.dropdown({ trigger: a, items: [
          { label: 'DeepSeek-V4.1-Flash', onClick: () => { $('[data-model-label]').textContent = 'DeepSeek-V4.1-Flash'; } },
          { label: 'qwen3-embedding-0.6b（不可用）', onClick: () => U.toast('该模型当前不可用', 'warning') },
        ] });
        break;
      case 'flash-mode': U.toast('已切换为闪速模式（演示）', 'info'); break;
      case 'attach': U.toast('演示环境不支持上传附件', 'info'); break;
      case 'learn-more': U.toast('跳转产品功能介绍（演示）', 'info'); break;
      case 'settings': U.toast('设置面板未包含在演示范围', 'info'); break;
      case 'risk': {
        const card = chatBody.querySelector('[data-risk]');
        if (!card) break;
        if (a.dataset.choose === 'deny') denyDemo(card);
        else continueDemo(card, a.dataset.choose === 'allow' ? '本次允许' : '会话允许');
        break;
      }
      case 'ask-submit': {
        const sel = chatBody.querySelector('[data-ask-type]');
        const val = sel ? sel.value : 'MySQL';
        const askMsg = sel ? sel.closest('.msg.ai') : null;
        if (askMsg) { const b = askMsg.querySelector('.bubble'); b.textContent = ''; b.insertAdjacentHTML('beforeend', `<span class="muted">已提交回答：数据源类型 ${esc(val)}</span>`); }
        userMsg(`数据源类型：${val}`);
        setStatus('处理完成', 'ok');
        setTimeout(() => aiMsg(REPLY_FIXED), 500);
        break;
      }
    }
  });

  /* Enter 发送 · Shift + Enter 换行 */
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(textEl.value); }
  });
  if (searchEl) searchEl.addEventListener('input', renderSessions);

  showHero();
})();
