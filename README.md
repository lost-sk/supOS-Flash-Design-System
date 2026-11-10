# supOS Flash Design System · 产品原型版

**版本 0.2（实证版，2026-11-09）**｜范围：**只做 product 本体**——登录页、运行期（桌面视图 / 菜单视图）、设计期。**不涉及官网、不涉及传播物料**，因为 supOS Flash 是一个产品而不是营销站。

本版把 v0.1 的 5 篇叙述性草案，补成一套**能产出可点击页面级原型、能验收**的设计系统。做法参考 [Tier0 Design System](../Tier0-Design-System)，但不照搬它的场景划分：Tier0 有官网 / 产品 / PPT 三表面，Flash 的「产品」内部就有多套视觉语言，必须按真实界面族拆。

---

## 快速开始

```
双击打开  prototype/index.html
```

不需要构建、不需要登录、不调用任何接口。所有 app 内容都是本地静态 HTML。

若浏览器限制 `file://` 下的 iframe，起一个本地服务：

```bash
cd prototype && python3 -m http.server 8899
# http://127.0.0.1:8899/
```

重新生成页面 / 校验：

```bash
node prototype/build-pages.mjs     # 按 assets/data.js 重生成全部页面 + 同步 token
node verify.mjs                    # 链接、资源、token、遗留路径检查
```

`build-pages.mjs` 会把仓库根 `tokens/*.css` 同步成 `prototype/assets/tokens.css`（构建产物），因此无论双击 `file://` 打开，还是以 `prototype/` 为根起本地服务，色值都能正确加载。

---

## 四层资产

| 层 | 位置 | 作用 |
|---|---|---|
| **Token** | `tokens/flash-product.css`、`tokens/flash-desktop.css` | 机器可读色值 / 字号 / 密度，页面唯一色源 |
| **规范** | `01`–`04` 四篇 | 品牌、登录与运行期、设计期、交付检查 |
| **Skill** | `skills/supos-flash-design/` | **对外交付物**：客户加载后按 `prototype.config.json` 生成应用原型。根 `SKILL.md` + `references/` 规范 + `assets/` 壳层与模板 + `scripts/` 生成器与验收 + `examples/minimal/` 可运行示例 |
| **原型** | `prototype/` | 22 个可点击 HTML + 5 个真实客户 app + 共享壳层 |

`prototype/assets/data.js` 是**单一数据源**：菜单树、页面注册表、app 注册表同时供壳层、生成器、验证脚本使用。改菜单只改这一处。

---

## 真源优先级（冲突时按序）

1. **线上运行期实证**：`flash01.devcloud.supos.net` 2026-11-09 实测截图、DOM、`computed style`、接口
2. **源码实证**：`gitlab-supos/supos/supbase/supbase-frontend-main@flash_1.08.00.00-C`，特别是 `src/App.tsx` 的 `ConfigProvider theme.token`
3. **客户 app 源码**：`git-scm2/BluetronAcademy/poc`（develop 分支）下的 `工业AI之旅/`、`AI应用开发场景/`、`AI智能体开发场景/`
4. **本仓叙述**：仅在前三者没有覆盖时补缺

> v0.1 草案的 `#1448ED` 取自 logo 像素，与真实产品代码不符，**已作废**。用户 2026-11-09 明确「色值和规格冲突按实际线上 + 源码实证」。代码基线 `V1.06.02.00-C` 与 `1.08 / flash_1.08.00.00-C` 的差异不影响 HTML 原型，两份证据都保留。

---

## 页面清单

| 形态 | 页面 |
|---|---|
| 登录页 | `login.html` — 工业 3D 插画铺底、玻璃拟态「让工业智能更简单」、右侧登录卡 |
| 运行期 · 桌面视图 | `runtime-desktop.html` — 三个 tab：试用之旅（真实 app）/ 架构图 / 工作台 |
| 运行期 · 菜单视图 | `runtime-menu.html` — 左侧 app 菜单树 + 右侧客户 app 真实 HTML |
| 设计期 | `design-home.html` + 17 个模块页，含基础配置 / 企业运营配置的子菜单（工作流管理已移除） |
| 总览 | `index.html` — 全部页面与全部 app 的索引 |

运行期两种视图互相切换：桌面视图顶栏右侧「菜单视图 ⇄」直达菜单视图，菜单视图顶栏「桌面视图」直达桌面视图；**鼠标悬停该入口会浮出「切换到设计期」**。设计期左侧一、二级分组整行均可点击展开/收起，分组内的页面链接仍按链接跳转。

嵌入的真实 app（来自 `poc/`）：MES 制造执行管理系统、APS 高级计划与排程、数智 BI 智能体、知识问答智能体、supOS 工业AI之旅（6 主题 18 任务）。

---

## 与 Tier0 的关键差异

| 维度 | Tier0 | supOS Flash |
|---|---|---|
| 表面划分 | 产品 / 官网 / PPT / 单页 | 登录页 / 运行期桌面 / 运行期菜单 / 设计期 |
| 视觉语言 | 共享一套品牌 | **三套并存**：门户高密度工作台、桌面渐变引导、登录营销页 |
| 主色治理 | 一个 FX Green | 门户 `#297bff`、桌面 `#005FE1`、组件包 `#0055f2`、旧按钮 `#0f71e2` 并存 |
| 真源 | Figma + Tier0-Frontend | 线上实证 + `supbase-frontend-main` + `poc/` 客户 app（无 Figma） |
| 换肤 | 静态主题 | **运行期可配置**（`theme-settings/login-page|logo-pic|zhuobao`） |

---

## 试用之旅进度效果与账号

**登录**：默认账号 `admin`；在登录页填任意用户名即以该身份进入，**任意密码都算成功**。用户名写入 `localStorage.flashUser` 并带在跳转 URL 上，顶栏头像、桌面视图和试用之旅内部的「当前账号」都会显示它；直接打开页面（未经登录）时显示 `admin`。原型不校验、不提交任何凭据。

桌面视图的「试用之旅」tab 默认加载 `prototype/apps/trial-journey/progress-preview.html`：它在原版 HTML/CSS/JS 之上按真实接口格式回放一份进度快照，让 `progress.mjs` 的 `paintMap()` 自己渲染完成态，不是手画的效果。同一份 HTML 用 `?state=` 切换三种状态：

| 参数 | 效果 |
|---|---|
| `?state=done5`（默认） | **应用开发全完成、个人工作台未做**：15/18，前 5 主题 `is-complete`（已完成徽章 / 绿勾 / 进度环满），第 6 主题 `is-current`（NOW 0/3） |
| `?state=locked` | 0/18，后续主题全灰锁定，锁图标 + 「待解锁」，用于对照 |
| `?state=all` | 18/18，6 个主题全完成终态 |

`?user=` 可覆盖账号（例如 `?user=wanggong`）。入口链接见 `prototype/index.html` 的「试用之旅 · 进度效果」。

> 按源码 `canOpenStage()` 的门槛，只要 `2.2` 已完成，后面的主题就都解锁。因此 `done5` 里个人工作台**不是灰锁**，而是已解锁的「当前任务」——这正是「没做」的真实状态；灰锁只在 `?state=locked` 展示。

## 已知边界

- 设计期 16 个模块页已补齐二级交互（v0.3）：注册向导 / 表单校验 / 弹窗 / 抽屉 / Agent 对话流等，规格来自源码逐字取证（`l2/*.mjs` + `assets/page/*.js`，文案证据存 `.cache/flash-l2-specs/`）。设计器画布（报表 / 工艺流程图 / 3D 等 iframe 内部的工具界面）仍未还原——对应微前端包源码不在工作区。
- 桌面运行期前端壳层源码不在工作区，桌面视图按线上截图与 `trial-journey` 源码还原。
- flash01 是演示 / 训练营环境，运行期菜单里全是演示场景应用，**不能当官方能力清单**。
- 所有数字与账号均为示例或线上快照，不提交任何凭据。

页面清单、真源与待确认项见本文件、`04-执行与检查.md` 与 `prototype/index.html` 总览。页面不含原型控制面板或标注浮层。
