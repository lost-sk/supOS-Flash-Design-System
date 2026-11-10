/* 设计期 · 大模型网关 · 二级交互（规格：.cache/flash-l2-specs/04-ke-gateway-copilot.md，文案取官方手册） */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ── 页签：模型 / 渠道 / 调用日志 / 设置 ── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tabs a[data-tab]');
    if (!t) return;
    $$('.tabs a[data-tab]').forEach((x) => x.classList.toggle('is-active', x === t));
    $$('[data-section]').forEach((p) => { p.hidden = p.dataset.section !== t.dataset.tab; });
  });

  /* ── 筛选：搜索 / 重置（模型名称 / 渠道名称 / 能力标签） ── */
  function paneOf(el) { return el.closest('[data-section]'); }
  function doSearch(btn) {
    const scope = paneOf(btn);
    const kw = ($('input:not([type=date]):not([type=number])', scope)?.value || '').trim().toLowerCase();
    const cap = $('select[data-cap-filter]', scope)?.value || '全部能力';
    let n = 0;
    $$('tbody tr', scope).forEach((tr) => {
      const hitKw = !kw || tr.textContent.toLowerCase().includes(kw);
      const hitCap = cap === '全部能力' || tr.textContent.includes(cap);
      tr.style.display = hitKw && hitCap ? '' : 'none';
      if (hitKw && hitCap) n++;
    });
    U.toast(`筛选完成：${n} 条`, 'info');
  }
  function doReset(btn) {
    const scope = paneOf(btn);
    $$('input:not([type=checkbox])', scope).forEach((i) => { i.value = ''; });
    $$('select', scope).forEach((s) => { s.selectedIndex = 0; });
    $$('tbody tr', scope).forEach((tr) => { tr.style.display = ''; });
  }

  /* ── 模型详情抽屉（能力声明勾选 + 互斥 note） ── */
  const MODEL_DETAIL = {
    'deepseek-v3': { desc: '通用对话大模型，适用于问答、摘要与文案生成', use: '对话模型', ctx: '64K', out: '8K', caps: ['对话'] },
    'qwen3-embedding-0.6b': { desc: '文本向量化模型，用于知识库检索与语义匹配', use: '向量模型', ctx: '32K', out: '—', caps: ['文本 Embedding'] },
    'gte-multilingual-reranker-base': { desc: '多语言重排序模型，用于检索结果精排', use: '重排模型', ctx: '—', out: '—', caps: ['Reranker'] },
    'qwen2.5-vl-7b': { desc: '视觉语言模型，用于图片语义理解', use: '其他模型', ctx: '32K', out: '4K', caps: ['视觉理解（VLM）'] },
  };
  function modelDrawer(name) {
    const m = MODEL_DETAIL[name] || { desc: '', use: '对话模型', ctx: '—', out: '—', caps: [] };
    const cb = (label) => `<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" ${m.caps.includes(label) ? 'checked' : ''}> ${label}</label>`;
    U.drawer({
      title: '模型详情', width: 640, footer: null,
      body: `
        <dl class="desc">
          <dt>模型名称</dt><dd class="mono">${esc(name)}</dd>
          <dt>模型说明</dt><dd>${esc(m.desc)}</dd>
          <dt>模型用途</dt><dd>${esc(m.use)}</dd>
          <dt>上下文</dt><dd>${esc(m.ctx)}</dd>
          <dt>模型最大输出</dt><dd>${esc(m.out)}</dd>
        </dl>
        <div class="form-section">能力声明</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--flash-text-secondary);margin-bottom:12px">
          ${cb('对话')}${cb('视觉理解（VLM）')}${cb('文本 Embedding')}${cb('Reranker')}
        </div>
        <div class="note warn">三种检索类能力互斥，且不可与对话/VLM 同选</div>`,
    });
  }

  /* ── 新建 / 编辑渠道弹窗 ── */
  const CH = {
    ch1: { name: '平台内置模型服务', api: 'https://llm.supos.local/v1', models: ['deepseek-v3', 'qwen3-embedding-0.6b', 'gte-multilingual-reranker-base'] },
    ch2: { name: '精达车间专用渠道', api: 'https://jinda.example.local/v1', models: ['deepseek-v3', 'qwen3-embedding-0.6b', 'qwen3-32b'] },
    ch3: { name: '备用推理渠道', api: 'https://backup.example.local/v1', models: ['deepseek-r1-distill-qwen-32b'] },
  };
  function addModelTag(root, name) {
    name = name.trim();
    if (!name) return;
    if ($$('[data-model-tags] .tag', root).some((t) => t.dataset.name === name)) return;
    $('[data-model-tags]', root).insertAdjacentHTML('beforeend',
      `<span class="tag info" data-name="${esc(name)}">${esc(name)} <a href="#" data-rm-tag style="margin-left:2px;color:inherit;text-decoration:none">×</a></span>`);
  }
  function channelModal(id) {
    const edit = id ? CH[id] : null;
    U.modal({
      title: edit ? '编辑渠道' : '新建渠道', width: 640,
      body: `
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span class="req">渠道名称</span></label>
          <div class="f-ctrl"><input value="${esc(edit ? edit.name : '')}" maxlength="64" data-req="1" data-err="请输入渠道名称"></div>
          <div class="f-err">请输入渠道名称</div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span class="req">渠道 API 地址</span></label>
          <div class="f-ctrl"><input value="${esc(edit ? edit.api : '')}" placeholder="https://api.openai.com/v1"
            data-req="1" data-err="请输入以 http(s):// 开头的 API 地址" data-pattern="^https?://.+"></div>
          <div class="f-err">请输入以 http(s):// 开头的 API 地址</div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>密钥</span></label>
          <div class="f-ctrl"><input type="password" placeholder="sk-…"></div>
          <div class="f-extra">建议填写，用于渠道鉴权</div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span class="req">模型</span></label>
          <div class="f-ctrl" style="max-width:none;flex:1">
            <input data-model-input placeholder="输入模型名称后回车添加" style="width:100%">
            <div data-model-tags style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
              ${(edit ? edit.models : []).map((m) => `<span class="tag info" data-name="${esc(m)}">${esc(m)} <a href="#" data-rm-tag style="margin-left:2px;color:inherit;text-decoration:none">×</a></span>`).join('')}
            </div>
          </div>
        </div>
        <div class="btn-row" style="margin:2px 0 12px">
          <button class="btn sm" data-op="fetch-models">获取模型列表</button>
          <button class="btn sm" data-op="batch-add">批量添加</button>
          <button class="btn sm" data-op="speed-models">测速模型</button>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>用途</span></label>
          <div class="f-ctrl"><select><option>对话模型</option><option>向量模型</option><option>重排模型</option><option>其他模型</option></select></div>
        </div>
        <div style="border:1px solid var(--flash-border);border-radius:var(--flash-radius);padding:10px 12px;margin-bottom:12px;background:var(--flash-bg-subtle)">
          <div class="muted" style="line-height:1.8">供应商自动判定：azure→Azure OpenAI、anthropic、gemini、deepseek、minimax、openrouter，其余按 OpenAI 兼容接入。</div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:var(--flash-text-secondary)">
            <input type="checkbox" data-agree> 我已阅读并确认上述声明，同意继续创建渠道
          </label>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:0">
          <label style="width:120px;flex:none;padding-top:7px"><span>允许额外字段透传</span></label>
          <div class="f-ctrl"><label class="switch"><input type="checkbox"><i></i></label></div>
        </div>`,
      okText: '确 定',
      onOk: (root) => {
        const agree = $('[data-agree]', root);
        if (!agree.checked) { U.toast('请先阅读并确认上述声明，同意后继续创建渠道', 'warning'); return false; }
        if (!$$('[data-model-tags] .tag', root).length) { U.toast('请至少添加一个模型', 'warning'); return false; }
        if (!U.validate(root)) return false;
        U.toast(edit ? '渠道已更新' : '渠道已创建');
        return true;
      },
    });
  }

  /* ── 事件委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    e.preventDefault();
    const op = a.dataset.op, name = a.dataset.name || '';
    switch (op) {
      case 'search': doSearch(a); break;
      case 'reset': doReset(a); break;
      case 'copy-model': U.toast(`已复制模型名称「${name}」`); break;
      case 'model-detail': modelDrawer(name); break;
      case 'new-channel': channelModal(); break;
      case 'ch-edit': channelModal(a.dataset.ch); break;
      case 'ch-del':
        U.confirm({ title: '删除', content: '确定删除该渠道？删除后渠道下的模型将不可用。', danger: true, onOk: () => U.toast('渠道已删除') });
        break;
      case 'speed-one': U.toast('测速完成：平均 320 ms'); break;
      case 'speed-batch': U.toast('已对渠道全部模型发起测速', 'info'); break;
      case 'fetch-models': {
        const root = a.closest('.flash-modal');
        ['gpt-4o', 'deepseek-v3'].forEach((m) => addModelTag(root, m));
        U.toast('已从渠道获取模型列表（示例）', 'info');
        break;
      }
      case 'batch-add': {
        const root = a.closest('.flash-modal');
        ['qwen3-32b', 'qwen3-embedding-0.6b'].forEach((m) => addModelTag(root, m));
        U.toast('已批量添加模型（示例）', 'info');
        break;
      }
      case 'speed-models': U.toast('测速完成：平均 320 ms'); break;
      case 'save-log': U.toast('日志设置已保存'); break;
      case 'clean-log': U.toast('已提交历史日志清理任务', 'info'); break;
      case 'save-monitor': U.toast('监控设置已保存'); break;
    }
  });

  /* 模型 Tag 移除 */
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-tag]');
    if (rm) { e.preventDefault(); rm.closest('.tag').remove(); }
  });

  /* 模型输入：回车添加 Tag */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-model-input]')) return;
    e.preventDefault();
    addModelTag(e.target.closest('.flash-modal'), e.target.value);
    e.target.value = '';
  });

  /* 渠道状态开关（启用 / 手动禁用 / 自动禁用） */
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-ch-switch]')) return;
    const state = e.target.closest('td,span').querySelector('[data-ch-state]');
    if (e.target.checked) {
      state.textContent = '启用'; state.classList.add('dot-status');
      U.toast('渠道已启用');
    } else {
      state.textContent = '手动禁用';
      U.toast('渠道已手动禁用', 'warning');
    }
  });

  /* 调用日志子页签：全部 / 消费 / 管理 / 系统 */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-log-tab]');
    if (!t) return;
    $$('[data-log-tab]').forEach((x) => x.classList.toggle('is-active', x === t));
    const mode = t.dataset.logTab;
    $$('[data-log-type]').forEach((td) => {
      td.parentElement.style.display = (mode === '全部' || td.dataset.logType === mode) ? '' : 'none';
    });
  });
})();
