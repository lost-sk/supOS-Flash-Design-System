/* 设计期 · Agent 管理 · 二级交互（规格：.cache/flash-l2-specs/05-openapi-apps-store.md） */
(function () {
  const U = window.FlashUI;
  const $ = (s, r) => (r || document).querySelector(s);

  const DATA = {
    AppDesignTool: {
      desc: 'APP 综合开发工具内置设计 Agent', app: 'APP综合开发工具',
      tools: ['- list_app_pages\n  - generate_report'],
    },
    生产运维助手: {
      desc: '生产运行期的运维问答、工单与巡检 Agent', app: '生产运维助手APP',
      tools: ['- answer_ops_question\n  - create_work_order\n  - inspect_device'],
    },
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-op="detail"]');
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.name;
    const d = DATA[name] || { desc: '', app: '', tools: [] };
    U.drawer({
      title: `Agent 详情 · ${name}`, width: 720,
      body: `
        <dl class="desc">
          <dt>名称</dt><dd>${U.esc(name)}</dd>
          <dt>描述</dt><dd>${U.esc(d.desc)}</dd>
          <dt>所属APP</dt><dd>${U.esc(d.app)}</dd>
          <dt>runtimeType</dt><dd class="mono">supagent_derived</dd>
          <dt>type</dt><dd class="mono">internal</dd>
          <dt>entry.type</dt><dd class="mono">supagent</dd>
          <dt>callable</dt><dd class="mono">true</dd>
          <dt>subagent_enabled</dt><dd class="mono">true</dd>
        </dl>
        <div class="form-section">注册清单（YAML）</div>
        <pre class="code-editor">runtimeType: supagent_derived
type: internal
entry:
  type: supagent
  callable: true
subagent_enabled: true
tools:
${U.esc(d.tools.join('\n'))}</pre>`,
      footer: '<button class="btn" data-fd-cancel>关闭</button>',
    });
  });
})();
