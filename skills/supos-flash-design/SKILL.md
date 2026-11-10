---
name: supos-flash-design
description: "This skill should be used when a user asks to produce a clickable product prototype for an application built on supOS Flash, for example 帮我做一个基于 supOS Flash 的 XX 应用原型, 把我的 app 包装成 supOS 产品原型, or 生成一套 supOS Flash 页面级 POC. It scaffolds an offline self-contained HTML prototype with the real supOS Flash login, runtime-desktop and runtime-menu shells, embeds the users own application HTML, optionally adds the design-time module pages, and validates the result. Do not use for marketing sites, generic UI polishing, or frontends unrelated to supOS Flash."
agent_created: true
user-invocable: true
metadata:
  version: "1.0.0"
  architecture: self-contained-skill-with-parameterized-scaffold
---

# supOS Flash Design

## 目的

把「一个基于 supOS Flash 开发的应用」快速包装成**可点击、可离线打开、可验收的产品原型**：真实的 supOS Flash 登录页与运行期壳层 + 客户自己的 app 内容 + 可选的设计期模块页。原型用于产品评审与方案沟通，不是生产代码。

本 skill 自包含：所有 token、壳层、组件脚本、品牌资源、生成器都在包内，不依赖任何外部仓库、线上环境或网络。

## 何时使用

在用户出现以下意图时启用：

- 「帮我做一个基于 supOS Flash 的 XX 应用原型」
- 「把我这个 app 放进 supOS Flash 里看看效果」
- 「生成一套 supOS Flash 的页面级 POC / 产品原型」
- 「给客户演示 XX 系统在 supOS 里的样子」

不适用的场景：官网 / 品牌站 / 宣传物料、通用 UI 美化、与 supOS Flash 无关的前端开发、直接修改生产前端代码。

## 输入契约

以一份 JSON 配置为唯一输入（`--config <path>`）。字段定义、缺省值与完整示例见 [`references/contracts.md`](references/contracts.md)。

最小可用配置只需两项：

```json
{ "title": "注塑车间智能看板", "app": { "name": "注塑车间智能看板", "menus": ["总览", "工单", "设备"] } }
```

收集输入时遵循：

1. 用户已提供 app HTML / 目录 → 填 `app.dir` 与 `app.entry`；未提供 → 保持缺省，生成器用 `assets/templates/app-blank/` 造一个可切页的占位应用。
2. 用户未给菜单 → 按应用语义补 3–5 个中文菜单项，并在交付说明里标注「示例菜单」。
3. 用户未提设计期 → 保持 `withDesign: false`，只交四形态核心原型。
4. 一次性问清缺失的必填项，不要分多轮追问；可合理缺省的字段一律不打扰用户。

## 输出契约

生成到 `--out <dir>`（默认 `./flash-prototype`）。目录结构、页面清单、`data.js` 注册表字段说明见 `references/contracts.md`。默认产物：

```
index.html · login.html · runtime-desktop.html · runtime-menu.html · design-home.html
assets/    · apps/<app-slug>/   · README.md   · prototype.config.json
```

`design-home.html` 始终生成，作为「切换到设计期」的落点；加 `withDesign: true` 时额外生成 16 个平台模块页，并把设计期首页升级为完整门户。

## 工作流程

1. **确认契约**：读 [`references/contracts.md`](references/contracts.md)，把用户输入整理成 config JSON，写入输出目录的 `prototype.config.json` 便于复现。
2. **确认视觉口径**：读 [`references/visual-spec.md`](references/visual-spec.md)。只有 `withDesign: true` 或需要平台模块规格时，才读 [`references/module-specs.md`](references/module-specs.md)。
3. **生成**：运行
   ```
   node scripts/new-prototype.mjs --config <config.json> --out <dir>
   ```
   脚本复制包内资产、按注册表渲染页面、复制或创建客户 app、拼接 token，不访问包外路径。仅需重生成页面时运行 `node scripts/build-pages.mjs --out <dir>`。
4. **接入应用**：检查 `apps/<slug>/` 的入口可离线打开；若客户 app 有自己的路由，在 config 的 `app.route` 里声明参数名与菜单→视图映射，让左侧菜单点击能真正切换 iframe 内容。未声明时按 `?view=` 处理，并在交付说明里标注。
5. **验收**：运行 `node scripts/validate.mjs --target <dir>`，再用浏览器打开 `index.html` 抽查四形态，按 [`references/delivery-check.md`](references/delivery-check.md) 逐项勾对；未跑的检查明确写成「未跑」。

## 资源索引

| 需要 | 读 / 用 |
| --- | --- |
| 输入 / 输出契约、注册表字段 | [`references/contracts.md`](references/contracts.md) |
| 色值、密度、四形态规格 | [`references/visual-spec.md`](references/visual-spec.md) + [`assets/tokens/`](assets/tokens/) |
| 平台设计期模块页规格 | [`references/module-specs.md`](references/module-specs.md) |
| 验收清单、已知坑、分发合规 | [`references/delivery-check.md`](references/delivery-check.md) |
| 壳层样式与交互 | [`assets/shell/`](assets/shell/)（复制，不加载进上下文） |
| 品牌图标与背景 | [`assets/brand/`](assets/brand/) |
| 设计期模块定义与页面脚本 | [`assets/l2/`](assets/l2/)、[`assets/page/`](assets/page/) |
| 空白 app 与注册表模板 | [`assets/templates/`](assets/templates/) |
| 生成器与验收脚本 | [`scripts/new-prototype.mjs`](scripts/new-prototype.mjs)、[`scripts/validate.mjs`](scripts/validate.mjs) |
| 可运行的精简成品 | [`examples/minimal/`](examples/minimal/) |

## 硬规则

- 颜色只使用 `assets/tokens/*.css` 的变量；门户与桌面是两套视觉语言，不互相覆盖。
- 不臆造 supOS Flash 能力；平台演示环境里的场景菜单属于实例数据，不能写成官方能力清单。
- 所有示例数据、示例菜单、占位统计数字必须显式标注「示例」。
- 输出不得包含真实凭据、内部域名、内网 IP、真实账号或客户业务数据。
- 原型离线可开（`file://` 双击即可），不依赖 CDN、不调用后端接口、不提交任何数据。
- 不修改本 skill 包内的 `assets/` 与 `scripts/`，除非任务本身就是扩展 skill。
- 中文文案用「你」不用「您」；术语用「设计期」，不用「设计器」。

## 完成标准

- [ ] `scripts/new-prototype.mjs` 成功，`scripts/validate.mjs --target <dir>` 无 error
- [ ] 登录 → 运行期桌面视图 → 三个 tab → 运行期菜单视图 → 设计期（若启用），全链路可点
- [ ] 客户 app 在菜单视图 iframe 内正常显示，左侧子菜单点击后内容或视图标识同步变化
- [ ] 400px 宽无横向滚动；页面无原型控制面板、标注浮层
- [ ] 输出目录无内部域名、真实 IP、凭据、真实账号
- [ ] 回复列出：交付路径、页面清单、已跑/未跑检查、与真实产品的差异和仍存限制

## 边界

- 登录页与运行期壳层来自 supOS Flash 运行期实证快照，非逐像素复刻；无 Figma 设计稿。
- 桌面运行期前端壳层源码不随包分发，桌面顶栏按截图与真实背景资源还原。
- 设计期模块页是**平台自身界面**，是否交付由 `withDesign` 决定；它们是参考实现，不代表客户应用的功能。
- 设计器画布（报表 / 组态 / 3D 编辑器内部）不还原。
