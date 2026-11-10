# 示例应用产品原型

由 **supOS Flash Design** skill 生成。双击 `index.html` 即可离线打开；若浏览器限制 `file://` iframe，可在目录内运行 `python3 -m http.server` 后访问。

## 页面

- `index.html` — 原型总览
- `login.html` — 用户登录
- `runtime-desktop.html` — 运行期 · 桌面视图
- `runtime-menu.html` — 运行期 · 菜单视图
- `design-home.html` — 设计期 · 首页

## 应用

- 名称：示例应用
- 目录：`apps/demo/`
- 菜单：总览 / 业务台账 / 运行看板 / 报表（示例，可在 config 中修改）
- 路由参数：`view`

## 说明

- 登录页默认账号 `admin`，任意用户名与密码均视为成功，不校验、不提交任何凭据。
- 所有业务数据、菜单、统计数字均为**示例**；壳层与色值来自 supOS Flash 运行期实证快照，非逐像素复刻。
- 设计期页面是平台自身界面，不代表本应用功能。
- 改内容请编辑 `prototype.config.json` 后重跑生成器，不要手改 HTML。
- 验收：`node <skill>/scripts/validate.mjs --target <本目录>`。
