# 交付检查、已知坑与分发合规

## 1. 命令

```
node scripts/new-prototype.mjs --config <config.json> --out <dir>
node scripts/build-pages.mjs --out <dir>          # 仅重生成页面
node scripts/validate.mjs --target <dir>          # 参数化验收，0 error 才算通过
```

`validate.mjs` 覆盖：注册表 ↔ 磁盘页面一致、每个页面含 `data-mode` / `data-nav` 且引用共享脚本、全部 href/src/CSS @import 目标存在、`tokens.css` 与两份源内容一致、无包外绝对路径、无明文凭据与内网地址、页面清单 == 注册表、400px 窄屏无溢出（需浏览器抽查）。

## 2. 人工抽查清单（浏览器）

- [ ] 双击 `index.html` 能离线打开，无 console error
- [ ] 登录页填任意用户名 → 运行期桌面视图；顶栏头像、iframe 内账号同步；密码任意成功
- [ ] 桌面视图三个 tab 可切；应用 tab 内 app 完整显示
- [ ] 桌面视图顶栏「菜单视图」一键直达，hover 浮出「切换到设计期」；菜单视图同理可回桌面
- [ ] 菜单视图点左侧 app / 子菜单，右侧 iframe 与标题同步更新
- [ ] 设计期（若启用）左侧一二级分组整行可展开，当前项高亮，基础配置 / 企业运营配置页内 tab 可切
- [ ] 400px 宽无横向滚动；页面无右下角原型面板、无标注浮层
- [ ] 所有示例数据、示例菜单、占位统计数字均标注「示例」

用 Edge/Chrome 的调试协议可自动化其中多数项：打开页面、取 `document.body.innerText`、`getComputedStyle`、`getBoundingClientRect`、监听 console error、逐页截图。脚本不随 skill 分发，需要时现写即可。

## 3. 已知坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| CSS 变量全失效、顶栏 / 侧栏塌陷 | `flash.css` 的 `@import "./tokens.css"` 相对路径断 | 生成器必须把两份 token 拼成输出目录 `assets/tokens.css`，与 `flash.css` 同目录 |
| 页面出现两个顶栏 / 两套菜单 | app 自带导航未关闭，或误用了 `portal.html` | iframe src 加 `?nav=0`，用 app 的 `index.html` 本体 |
| 子菜单点了只改 URL 不改内容 | 壳层用的 query 参数名 / 值与 app 路由不匹配 | 在 `app.route` 声明 `param` 与 `map`；无路由能力时只留一个菜单并如实标注 |
| 登录页出现两组标语 | 又渲染了一个 DOM 横幅 | 标语已印在 `default_bg.png` 里，删掉重复 DOM |
| 桌面视图被门户蓝色覆盖 | 误用 `--flash-primary` | 桌面用 `--desk-*` |
| 切 tab / 切形态后账号丢失 | URL 参数没带过去 | 统一用壳层的 URL 生成函数，`localStorage.flashUser` 兜底 |
| `file://` 下 iframe 被拦 | 浏览器本地文件策略 | 用 `python3 -m http.server` 起本地服务，或提示用户换浏览器 |
| 改了菜单但页面没变 | 手改了生成的 HTML | 只改 `prototype.config.json` 后重跑生成器 |

## 4. 分发合规（对外交付前必须过）

输出目录与本 skill 包**不得包含**：

- 内部环境域名、实例地址、登录入口 URL
- 内部代码仓库路径、分支名、版本基线编号
- 真实账号 / 密码 / ticket / AppKey / Cookie
- 内网 IP、数据库连接串、真实客户业务数据
- 未经授权的客户 app 源码或其业务表数据

`assets/brand/` 内的图标与背景来自平台默认皮肤，可随包分发；`examples/minimal/` 使用虚构应用与虚构数据。若要把客户真实 app 一起打包，先取得授权并脱敏。

## 5. 仍存边界（写进交付说明）

- 壳层是运行期实证快照还原，非逐像素复刻；无 Figma 设计稿。
- 桌面运行期前端壳层源码不随包分发，顶栏按截图与真实背景资源还原。
- 平台设计期模块页是参考实现，不是客户应用功能。
- 演示 / 训练营环境里的场景菜单是实例数据，不是官方能力清单。
- 设计器画布未还原。
- 原型不调用任何后端接口，所有状态为本地模拟。
