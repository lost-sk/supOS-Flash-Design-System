# 视觉规范（supOS Flash 运行期实证快照）

所有数值来自 supOS Flash 运行期实例的 DOM `computed style` 与前端主题配置实证，机器可读版本在 [`../assets/tokens/flash-product.css`](../assets/tokens/flash-product.css) 与 [`../assets/tokens/flash-desktop.css`](../assets/tokens/flash-desktop.css)。**色值只从 token 变量取，不在页面里写 hex。**

## 1. 两套视觉语言

| 语言 | 适用形态 | 主色 | 说明 |
| --- | --- | --- | --- |
| 门户工作台 | 运行期菜单视图、设计期 | `#297bff` | 高密度企业工作台，蓝色顶栏 + 白色侧栏 |
| 桌面引导 | 运行期桌面视图 | `#005FE1` | 浅蓝渐变、引导式旅程、浮层卡片 |

两套语言不互相覆盖。治理清单里的并存色 `#0055f2`（组件包）、`#0f71e2`（旧按钮）、`#0666ff`（hover）在 token 中保留为 `--flash-legacy-*`，仅在复刻对应组件时使用，不要当作品牌主色。

## 2. 门户 token（实证值）

| 项 | 值 |
| --- | --- |
| 主色 / hover / 链接 | `#297bff` / `#0666ff` / `#297bff` |
| 语义色 | error `#F3324F` · success `#05C933` · warning `#FAAD14` |
| 文字 / 边框 | `#323c47` / `#e0e6ee` |
| 字号 / 行高 | 13px / `22/13`（保证 Input 高 32px） |
| 圆角 | 4px |
| 顶栏 / 侧栏 | 50px / 250px |
| 菜单行高 | 一级 36px · 二级 34px |
| 字体栈 | `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, MicrosoftYaHei`（**不含 Inter**） |
| 顶栏渐变 | `rgb(42,83,208) → rgb(68,123,237)`（垂直） |
| 内容区背景 | `linear-gradient(rgb(220,228,244), #fff 30%)` |

顶栏使用真实 logo（`default_logo.svg`，93×24）、手册 / 通知 / 全屏图标与头像。侧栏固定不滚动，只有内容区滚动。

## 3. 四种形态

| 形态 | 页面 | 关键结构 |
| --- | --- | --- |
| 登录页 | `login.html` | 全屏工业 3D 等距插画（`default_bg.png`，**标语横幅已印在背景图里，不要再渲染一个 DOM 横幅**）；左上 283×35 字标；右侧白色登录卡 `left 73% / top 29.4% / 360×412`；输入框与按钮 40px；底部版权 |
| 运行期 · 桌面视图 | `runtime-desktop.html` | 60px 半透明顶栏 + 居中三 tab（应用 / 架构图 / 工作台）+ 真实渐变背景图 + footer；应用 tab 用 iframe 承载客户 app |
| 运行期 · 菜单视图 | `runtime-menu.html` | 蓝顶栏 + 250px 白色 app 菜单树 + 右侧 app iframe；app 自带导航由 `?nav=0` 关闭 |
| 设计期 | `design-home.html` + `design-*.html` | 门户壳层 + 可关闭 tab 条 + 系统维护通知条 + 工具栏（搜索 / 筛选 / 刷新 / 计数）+ 分组卡片；首页快捷入口用线上真实 48×48 PNG 图标 |

设计期一级分组默认全部展开，一二级分组整行可点击展开/收起，行内页面链接仍按链接跳转。基础配置与企业运营配置带子菜单，用页内 hash tab 切换，不做死链接。

## 4. 组件与状态

复用 [`../assets/shell/flash.css`](../assets/shell/flash.css) 的类，不另造按钮 / 表格 / 卡片：

- `FlashCard` / `StatCard` / `FlashTable` / `FlashSider` / `NavItem` / `NavGroup` / `FlashContent` / `AppFrame`
- 按钮：主 / 次 / 小号，含 hover、focus、disabled；标签 `ok / warn / err / info` 必须配文字，不只用颜色表达状态
- 表格行高 48px、hover 浅蓝底、长文本截断；空态为虚线框图标 +「暂无数据」
- 页内 tab 选中态为主色 2px 下划线
- 弹窗 / 抽屉 / Toast / Popconfirm / Dropdown / 表单校验由 `interact.js` 的 `window.FlashUI` 提供

加载中、空、错误、成功四种状态都要保持结构稳定，不跳动。所有用户可见文案在真实产品中走 i18n（zh-cn / en-us / zh-hk），原型用中文。

## 5. 换肤边界

品牌资源（登录页背景、logo、版权）在运行期是可替换的租户配置，不是写死的平台资产。原型使用平台默认皮肤；若客户要求换肤，替换 `assets/brand/` 下对应文件即可，不要改 CSS 结构。

## 6. 硬约束

- 不要求与真实产品逐像素一致，但壳层几何、密度、色彩层级必须同一量级。
- 不把桌面渐变底与门户侧栏混在同一页；一个页面只用一种形态。
- 不引入新色板；草稿阶段的 `#1448ED` 与实证不符，已作废。
