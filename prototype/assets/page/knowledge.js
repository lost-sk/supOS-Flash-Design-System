/* 设计期 · 知识库 · 二级交互（规格：.cache/flash-l2-specs/04-ke-gateway-copilot.md） */
(function () {
  const U = window.FlashUI;
  const esc = U.esc;
  const tag = (t, k = '') => `<span class="tag ${k}">${esc(t)}</span>`;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ── 数据（与 l2/knowledge.mjs 示例一致） ── */
  const DOCS = {
    cnc: [
      ['CNC 机床报警代码手册', '可检索', '2.4 MB', '维修手册', '2026-11-01 10:20'],
      ['FANUC 系统维修手册', '处理中', '5.1 MB', '操作手册', '2026-11-10 09:05'],
      ['主轴故障排查 SOP', '处理失败', '1.2 MB', '维修手册', '2026-11-09 18:40'],
      ['设备点检记录表', '等待处理', '340 KB', '点检表单', '2026-11-10 08:12'],
    ],
    point: [
      ['设备点检作业指导书', '可检索', '3.2 MB', '作业标准', '2026-11-02 15:30'],
      ['巡检路线与频次说明', '可检索', '860 KB', '作业标准', '2026-11-05 11:10'],
      ['注塑机点检表', '处理中', '120 KB', '点检表单', '2026-11-10 09:30'],
    ],
  };
  const ST_CLS = { '可检索': 'ok', '处理中': 'info', '处理失败': 'err', '等待处理': 'warn' };

  /* ── 视图切换：知识库列表 / 文档列表 / 检索测试 ── */
  function showView(v) {
    $$('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== v; });
  }

  function renderDocs(kbId, kbName) {
    $('[data-doc-kb]').textContent = kbName;
    $('[data-doc-body]').innerHTML = DOCS[kbId].map(([name, st, size, cat, time]) => `
      <tr>
        <td>${esc(name)} ${tag('v1', 'info')}</td>
        <td>${tag(st, ST_CLS[st] || '')}</td>
        <td>${esc(size)}</td><td>${esc(cat)}</td><td>${esc(time)}</td>
        <td><span class="link-ops"><a href="#" data-op="doc-view" data-name="${esc(name)}">查看</a>
          <a href="#" data-op="upload-ver" data-name="${esc(name)}">上传新版本</a>
          <a href="#" class="danger" data-op="doc-del" data-name="${esc(name)}">删除</a></span></td>
      </tr>`).join('');
  }

  /* ── 通用悬浮面板（模型下拉 / 我的处理）：复用 flash-menu 视觉，自控 HTML ── */
  let popNode = null, popOutside = null;
  function popup(trigger, html) {
    closePopup();
    popNode = U.el(`<div class="flash-menu" style="z-index:96;${html.pop || ''}">${html.body}</div>`);
    document.body.appendChild(popNode);
    const rect = trigger.getBoundingClientRect();
    popNode.style.left = Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - popNode.offsetWidth - 8)) + 'px';
    const top = rect.bottom + window.scrollY + 4;
    popNode.style.top = (top + popNode.offsetHeight > window.scrollY + window.innerHeight ? rect.top + window.scrollY - popNode.offsetHeight - 4 : top) + 'px';
    popOutside = function (e) { if (popNode && !popNode.contains(e.target)) closePopup(); };
    setTimeout(() => document.addEventListener('click', popOutside), 0);
  }
  function closePopup() {
    if (popNode) { popNode.remove(); popNode = null; }
    if (popOutside) { document.removeEventListener('click', popOutside); popOutside = null; }
  }

  /* ── 新建 / 编辑知识库（useKnowledgeBaseAdmin 实证：名称必填 ≤64，描述 ≤500） ── */
  function newKbModal(editName) {
    U.modal({
      title: editName ? '编辑知识库' : '新建知识库', width: 520,
      body: `
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span class="req">名称</span></label>
          <div class="f-ctrl"><input maxlength="64" placeholder="例如：CNC 维修手册" value="${esc(editName || '')}"
            data-req="1" data-err="请填写知识库名称"></div>
          <div class="f-err">请填写知识库名称</div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>描述</span></label>
          <div class="f-ctrl"><textarea maxlength="500" style="height:auto;min-height:64px"></textarea></div>
        </div>`,
      okText: editName ? '保存' : '创建',
      onOk: (root) => {
        if (!U.validate(root)) return false;
        U.toast(editName ? '知识库已更新' : '知识库已创建');
        return true;
      },
    });
  }

  /* ── 卡片 ••• 菜单（编辑/检索设置/AI 模型/文档处理/知识处理/删除红） ── */
  function kbMenu(trigger, kbName) {
    U.dropdown({
      trigger, items: [
        { label: '编辑', onClick: () => newKbModal(kbName) },
        { label: '检索设置', onClick: () => U.toast('检索设置（示例：混合检索 · 向量/全文 0.7/0.3 · RRF k=60）', 'info') },
        { label: 'AI 模型', onClick: () => aiModelModal() },
        { label: '文档处理', onClick: () => U.toast('已打开文档处理配置（示例）', 'info') },
        { label: '知识处理', onClick: () => U.toast('已打开知识处理配置（示例）', 'info') },
        '-',
        { label: '删除', danger: true, onClick: () => delKb() },
      ],
    });
  }
  function delKb() {
    U.confirm({
      title: '删除知识库？',
      content: '删除是异步的：内容回收稍后完成。',
      okText: '确 定', danger: true,
      onOk: () => U.toast('知识库已删除'),
    });
  }

  /* ── AI 模型弹窗（KnowledgeBaseAiModelSettingsModal 实证，w720） ── */
  let embChanged = false;
  const embTagCls = { 'qwen3-embedding-0.6b': '向量 · 1024 维', 'bge-m3': '向量 · 1024 维', 'text-embedding-v3': '可选维度' };
  function aiModelModal() {
    embChanged = false;
    const cur = 'qwen3-embedding-0.6b';
    U.modal({
      title: 'AI 模型｜知识库的模型与索引配置', width: 720,
      body: `
        <div class="note">模型来自大模型网关 <a href="design-llm-gateway.html">→打开大模型网关</a></div>
        <div class="form-section">检索模型</div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>文本 Embedding</span></label>
          <div class="f-ctrl"><button class="btn" data-op="emb-select" data-cur="${cur}" style="display:inline-flex;align-items:center;gap:8px;justify-content:space-between;min-width:260px">
            <span data-emb-label>${cur}</span><span class="tag info">${embTagCls[cur]}</span><span>▾</span></button></div>
          <div class="f-extra">更换模型或向量维度需要全量重建知识库检索索引</div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>向量维度</span></label>
          <div class="f-ctrl"><select><option>1024 维（默认）</option><option>768 维</option><option>1536 维</option></select></div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>Reranker</span></label>
          <div class="f-ctrl"><select><option>使用平台默认（gte-multilingual-reranker-base）</option><option>bge-reranker-v2-m3</option></select></div>
        </div>
        <div class="form-section">大语言模型｜用于图谱构建</div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>模型</span></label>
          <div class="f-ctrl"><select><option>未配置</option><option>deepseek-v3</option><option>qwen3-32b</option></select></div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>图片语义理解</span></label>
          <div class="f-ctrl"><label class="switch"><input type="checkbox" data-vlm-switch><i></i></label></div>
        </div>
        <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">
          <label style="width:120px;flex:none;padding-top:7px"><span>多模态模型</span></label>
          <div class="f-ctrl"><div style="display:flex;align-items:center;gap:8px">
            <select><option>跟随大语言模型</option><option>qwen2.5-vl-7b</option></select>${tag('跟随中', 'info')}</div></div>
        </div>`,
      okText: '保存',
      onOk: () => {
        if (embChanged) {
          U.confirm({ title: '重新构建检索索引？', okText: '开始迁移', onOk: () => U.toast('已开始重建检索索引') });
        } else {
          U.toast('AI 模型配置已保存');
        }
        return true;
      },
    });
  }
  function embMenu(trigger) {
    const items = Object.keys(embTagCls).map((m) =>
      `<button data-emb="${m}" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span>${m}</span><span class="tag info">${embTagCls[m]}</span></button>`).join('');
    popup(trigger, { body: items });
  }

  /* ── 上传弹窗（QuickUploadModal 实证：拖拽区 + 可编辑文件行 + 同名冲突） ── */
  const fileRow = (name, desc) => `
    <div class="card" data-file-row style="margin:0;padding:10px 12px">
      <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:8px">
        <label style="width:120px;flex:none;padding-top:7px"><span class="req">名称</span></label>
        <div class="f-ctrl"><input maxlength="512" value="${esc(name)}" placeholder="文档名称"
          data-req="1" data-err="请输入文档名称" data-max="512" data-err-max="名称长度不得超过512！"></div>
        <div class="f-err">请输入文档名称</div>
      </div>
      <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:8px">
        <label style="width:120px;flex:none;padding-top:7px"><span>描述</span></label>
        <div class="f-ctrl"><textarea maxlength="500" style="height:auto;min-height:56px" data-max="500" data-err-max="描述长度不得超过500！">${esc(desc)}</textarea></div>
      </div>
      <div class="field" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:0">
        <label style="width:120px;flex:none;padding-top:7px"><span>文档分类</span></label>
        <div class="f-ctrl"><input placeholder="选择或输入文档分类"></div>
      </div>
    </div>`;

  function uploadModal(verName) {
    const isVer = !!verName;
    U.modal({
      title: isVer ? `上传「${verName}」的新版本` : '上传文件', width: 760,
      body: `
        <div class="uploader" data-op="add-file"><span class="up-ico">⇪</span><span>拖拽文件至此，或点击选择</span></div>
        <div data-files style="display:grid;gap:10px;margin-top:12px">
          ${isVer ? fileRow(verName, '') : fileRow('CNC 机床报警代码手册 v3.pdf', '覆盖 ALM-001～ALM-499 全部报警代码') + fileRow('主轴故障排查 SOP.docx', '')}
        </div>
        <div class="form-section">同名冲突</div>
        <div style="display:flex;gap:18px;font-size:13px;color:var(--flash-text-secondary)">
          <label style="display:flex;align-items:center;gap:6px"><input type="radio" name="kb-conflict" checked>作为新版本</label>
          <label style="display:flex;align-items:center;gap:6px"><input type="radio" name="kb-conflict">保留为新文档</label>
        </div>`,
      footer: `<button class="btn" data-fm-cancel>取 消</button><button class="btn primary" data-fm-ok>${isVer ? '上传新版本' : '开始上传'}</button>`,
      onOk: (root) => {
        if (!U.validate(root)) return false;
        U.toast(`已提交 ${$$('[data-file-row]', root).length} 个文件，上传会在后台继续`);
        return true;
      },
    });
  }

  /* ── 我的处理 Popover（全局进度：处理中 N / 处理异常 N / 处理记录） ── */
  function myProcessing(trigger) {
    popup(trigger, {
      pop: 'padding:10px;min-width:230px;',
      body: `<div style="display:flex;gap:6px;flex-wrap:wrap">${tag('处理中 2', 'info')}${tag('处理异常 0', 'err')}${tag('处理记录')}</div>`,
    });
  }

  /* ── 事件委托 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op]');
    if (!a) return;
    const op = a.dataset.op, name = a.dataset.name || '';
    switch (op) {
      case 'new-kb': newKbModal(); break;
      case 'kb-menu': kbMenu(a, a.dataset.kbname); break;
      case 'open-kb': {
        const id = a.dataset.kb;
        renderDocs(id, $('b', a).textContent.trim());
        showView('doc-list');
        break;
      }
      case 'back-kb': showView('kb-list'); break;
      case 'retrieval': showView('retrieval'); break;
      case 'back-docs': showView('doc-list'); break;
      case 'upload': uploadModal(); break;
      case 'upload-ver': uploadModal(name); break;
      case 'add-file': $('[data-files]').insertAdjacentHTML('beforeend', fileRow('', '')); break;
      case 'doc-view': U.toast(`已打开「${name}」原文预览（示例）`, 'info'); break;
      case 'doc-del':
        U.popconfirm({ trigger: a, title: '确定删除该文档？', danger: true, okText: '删除', onOk: () => U.toast(`「${name}」已删除`) });
        break;
      case 'my-processing': myProcessing(a); break;
      case 'ai-model': aiModelModal(); break;
      case 'emb-select': embMenu(a); break;
      case 'retr-search': {
        const q = $('[data-retr-q]').value.trim();
        $('[data-retr-meta]').hidden = !q;
        $('[data-retr-cards]').hidden = !q;
        $('[data-retr-empty]').hidden = !!q;
        break;
      }
    }
  });

  /* Embedding 下拉选择（下拉项带「向量 · N 维」Tag） */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-emb]');
    if (!b) return;
    const btn = document.querySelector('[data-op="emb-select"]');
    if (btn) {
      if (btn.dataset.cur !== b.dataset.emb) embChanged = true;
      btn.dataset.cur = b.dataset.emb;
      $('[data-emb-label]', btn).textContent = b.dataset.emb;
      $('.tag', btn).textContent = embTagCls[b.dataset.emb];
    }
    closePopup();
  });

  /* 知识库搜索过滤：无匹配显示空态「还没有知识库」 */
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-kb-search]')) return;
    const kw = e.target.value.trim().toLowerCase();
    let visible = 0;
    $$('[data-kb-search]').forEach((card) => {
      const hit = !kw || card.dataset.kbSearch.toLowerCase().includes(kw);
      card.hidden = !hit;
      if (hit) visible++;
    });
    $('[data-kb-empty]').hidden = visible > 0;
  });
})();
