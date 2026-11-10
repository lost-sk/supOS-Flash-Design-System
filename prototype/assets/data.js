/* supOS Flash 产品原型 · 页面与菜单注册表
 * 真源：flash01 2026-11-09 线上实测（/#/os/home 设计期、/#/home 运行期菜单）
 *      + poc/ 下客户自己开发的 app HTML
 * 本文件是壳层、页面生成器、验证脚本共用的单一数据源。
 */
(function () {
  const P = (file, title, group, desc) => ({ file, title, group, desc });

  /* ── 设计期：线上实测的一级/二级菜单层级 ── */
  const designNav = [
    { type: 'item', label: '首页', file: 'design-home.html', icon: 'home' },

    { type: 'group', label: '数据平台', icon: 'database', children: [
      { type: 'group', label: '连接服务', children: [
        { type: 'item', label: '数据源注册', file: 'design-datasource.html' },
        { type: 'item', label: '数据接入服务', file: 'design-data-connect.html' },
      ]},
      { type: 'group', label: '建模服务', children: [
        { type: 'item', label: '工厂模型', file: 'design-factory-model.html' },
        { type: 'item', label: '语义模型', file: 'design-semantic.html' },
      ]},
      { type: 'group', label: '存储服务', children: [
        { type: 'item', label: '数据库资源管理', file: 'design-storage.html' },
        { type: 'item', label: 'SQL 联邦查询', file: 'design-fedquery.html' },
      ]},
    ]},

    { type: 'group', label: 'AI 与工具', icon: 'spark', children: [
      { type: 'item', label: '知识库', file: 'design-knowledge.html' },
      { type: 'item', label: '大模型网关', file: 'design-llm-gateway.html' },
      { type: 'item', label: 'Copilot', file: 'design-copilot.html' },
      { type: 'item', label: 'OpenAPI 开放', file: 'design-openapi.html' },
    ]},

    { type: 'group', label: 'APP 管理', icon: 'app', children: [
      { type: 'item', label: 'APP 运行管理', file: 'design-apps.html' },
      { type: 'item', label: 'APP 综合设计工具', file: 'design-app-design.html' },
    ]},

    { type: 'item', label: 'Agent 管理', file: 'design-agent.html', icon: 'agent' },

    { type: 'group', label: '系统设置', icon: 'setting', children: [
      { type: 'group', label: '基础配置', file: 'design-basic-config.html', children: [
        { type: 'item', label: '主题配置', file: 'design-basic-config.html#theme' },
        { type: 'item', label: '菜单配置', file: 'design-basic-config.html#menu' },
        { type: 'item', label: '数据字典', file: 'design-basic-config.html#dict' },
        { type: 'item', label: '安全策略', file: 'design-basic-config.html#security' },
      ]},
      { type: 'group', label: '企业运营配置', file: 'design-enterprise-config.html', children: [
        { type: 'item', label: '组织管理', file: 'design-enterprise-config.html#org' },
        { type: 'item', label: '岗位与角色', file: 'design-enterprise-config.html#role' },
        { type: 'item', label: '用户与权限', file: 'design-enterprise-config.html#user' },
      ]},
    ]},

    { type: 'item', label: '应用商店', file: 'design-store.html', icon: 'store' },
  ];

  /* ── 运行期菜单视图：poc 里客户自己开发的 app ── */
  const apps = {
    mes: {
      label: 'MES 制造执行管理系统',
      short: 'MES 回归测试',
      src: 'apps/mes/index.html?nav=0',
      note: 'poc/AI应用开发场景/mes_app · 9 大功能域 / 79 张表',
      children: ['工厂建模','工艺管理','订单管理','计划排产','生产管理','库存管理','设备管理','报表分析','生产看板'],
    },
    aps: {
      label: 'APS 高级计划与排程系统',
      short: 'APS 高级计划与排程',
      src: 'apps/aps/index.html?nav=0',
      note: 'poc/AI应用开发场景/aps_system · MRP 净算 / 齐套 / 有限产能排程',
      children: ['计划基础数据','需求管理','物料需求计算','物料齐套计算','生产排程','计划看板'],
    },
    bi: {
      label: '数智 BI 智能体',
      short: '数智 BI 智能体',
      src: 'apps/bi/index.html',
      note: 'poc/AI智能体开发场景/数智BI智能体 · 问数智能体',
      children: ['对话问数','历史会话','数据源连接'],
    },
    qa: {
      label: '知识问答智能体',
      short: '知识问答智能体',
      src: 'apps/qa/index.html',
      note: 'poc/AI智能体开发场景/知识问答智能体 · 知识库问答',
      children: ['知识问答','知识库管理','引用溯源'],
    },
    trial: {
      label: 'supOS 工业AI之旅',
      short: 'supOS 工业AI之旅',
      src: 'apps/trial-journey/index.html',
      note: 'poc/工业AI之旅/app/trial-journey · 6 主题 18 任务',
      children: ['智能体接入','数据连接','数据建模','指标开发','多角色洞察','应用开发','个人工作台'],
    },
  };

  /* 运行期 Copilot：线上 /#/os_ai_runtime_copilot（scope:runtime → /os/supagent/workspace）实证 */
  Object.assign(apps, {
    copilot: {
      label: 'supOS Copilot',
      short: 'supOS Copilot',
      src: 'runtime-copilot.html',
      note: '对话即指令，智能即协同 · supagent workspace 线上实证',
      children: [],
    },
  });

  const runtimeNav = [
    { type: 'item', label: '收藏', icon: 'star', app: null },
    { type: 'item', label: 'Copilot', icon: 'spark', app: 'copilot' },
    ...Object.entries(apps).filter(([, a]) => a.children.length).map(([key, a]) => ({
      type: 'group', label: a.short, icon: 'app', app: key, children: a.children.map(c => ({
        type: 'item', label: c, app: key, view: c,
      })),
    })),
  ];

  /* ── 页面注册表：生成器与验证脚本都读它 ── */
  const pages = [
    P('index.html', 'supOS Flash · 原型总览', 'entry', '四个入口与全部页面索引'),
    P('login.html', '用户登录', 'login', '完整登录页，工业 3D 插画 + 玻璃拟态标语 + 右侧登录卡'),
    P('runtime-desktop.html', '运行期 · 桌面视图', 'runtime', '桌面顶栏（试用之旅 / 架构图 / 工作台）+ 渐变底 + 应用内容'),
    P('runtime-menu.html', '运行期 · 菜单视图', 'runtime', '左侧 app 菜单树 + 右侧客户 app 真实 HTML'),

    P('design-home.html', '设计期 · 首页', 'design', '可调布局的分组卡片门户，含平台统计'),
    P('design-datasource.html', '数据源注册', 'design', '数据源列表、类型分布、新建入口'),
    P('design-data-connect.html', '数据接入服务', 'design', '采集点、同步流程、连接状态'),
    P('design-factory-model.html', '工厂模型', 'design', 'UNS 目录树 + 位号明细'),
    P('design-semantic.html', '语义模型', 'design', '模型 / 指标 / 关系登记'),
    P('design-storage.html', '数据库资源管理', 'design', '数据湖资源申请与实例'),
    P('design-fedquery.html', 'SQL 联邦查询', 'design', '只读联邦查询编辑器与结果'),
    P('design-knowledge.html', '知识库', 'design', '文档、切片、检索与引用'),
    P('design-llm-gateway.html', '大模型网关', 'design', '模型接入、配额与审计'),
    P('runtime-copilot.html', '运行期 · Copilot 工作区', 'runtime', 'supOS Copilot 工作区（os_ai_runtime_copilot 线上实证）'),
    P('design-copilot.html', 'Copilot', 'design', 'supOS Copilot 工作区（对话式任务入口与执行回执）'),
    P('design-openapi.html', 'OpenAPI 开放', 'design', 'API 目录与凭证'),
    P('design-apps.html', 'APP 运行管理', 'design', '已安装应用、状态与版本'),
    P('design-app-design.html', 'APP 综合设计工具', 'design', '报表 / 组态 / 3D / 业务 DIY'),
    P('design-agent.html', 'Agent 管理', 'design', '智能体目录与调用状态'),
    P('design-basic-config.html', '基础配置', 'design', '含子菜单：主题 / 菜单 / 数据字典 / 安全策略'),
    P('design-enterprise-config.html', '企业运营配置', 'design', '含子菜单：组织 / 岗位角色 / 用户权限'),
    P('design-store.html', '应用商店', 'design', '可安装应用与模板'),
  ];

  const modes = [
    { id: 'login', label: '登录页', file: 'login.html' },
    { id: 'runtime-desktop', label: '运行期 · 桌面视图', file: 'runtime-desktop.html' },
    { id: 'runtime-menu', label: '运行期 · 菜单视图', file: 'runtime-menu.html' },
    { id: 'design', label: '设计期', file: 'design-home.html' },
  ];

  window.FLASH = { designNav, runtimeNav, apps, pages, modes, P };
})();
