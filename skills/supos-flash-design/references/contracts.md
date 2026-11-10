# 输入 / 输出契约与注册表

## 1. 配置（`--config <config.json>`）

| 字段 | 类型 | 必填 | 缺省 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | string | 是 | — | 原型标题，出现在浏览器标题与总览页 |
| `app.name` | string | 是 | — | 应用显示名，用于左侧菜单与应用标签 |
| `app.slug` | string | 否 | 由 name 生成拼音/英文缺省 `app` | 输出目录名 `apps/<slug>/` |
| `app.dir` | string | 否 | — | 客户 app 静态目录（含 HTML/CSS/JS），生成时整体复制 |
| `app.entry` | string | 否 | `index.html` | app 入口文件，相对 `app.dir` |
| `app.menus` | string[] | 否 | `["总览"]` | 运行期菜单视图的二级菜单；**示例值须标注** |
| `app.route` | object | 否 | `{ "param": "view" }` | 路由声明，见 §3 |
| `app.note` | string | 否 | `示例应用 · 离线占位` | 应用说明，显示在菜单视图 |
| `account` | string | 否 | `admin` | 默认账号；登录页填任意用户名即以该身份进入，密码任意成功 |
| `withDesign` | boolean | 否 | `false` | 是否额外生成设计期首页 + 16 个模块页 |
| `date` | string | 否 | 生成当天 | 顶栏日期文案 |

最小配置：

```json
{
  "title": "注塑车间智能看板",
  "app": { "name": "注塑车间智能看板", "menus": ["总览", "工单", "设备", "质量"] }
}
```

带真实 app 与自定义路由：

```json
{
  "title": "设备预测性维护",
  "account": "admin",
  "withDesign": true,
  "app": {
    "name": "设备预测性维护",
    "slug": "pdm",
    "dir": "./my-pdm-web",
    "entry": "index.html",
    "menus": ["总览", "设备台账", "预警", "工单"],
    "route": {
      "param": "v",
      "map": { "总览": "overview", "设备台账": "assets", "预警": "alerts", "工单": "orders" }
    },
    "note": "客户自开发应用 · 示例数据"
  }
}
```

`app.dir` 为相对路径时，相对**配置文件所在目录**解析。

## 2. 输出目录（`--out <dir>`）

```
<out>/
├── prototype.config.json        # 本次输入快照，便于复现
├── README.md                    # 交付说明：页面清单、如何打开、示例标注、边界
├── index.html                   # 原型总览（全部页面 + app 入口）
├── login.html                   # 登录页
├── runtime-desktop.html         # 运行期 · 桌面视图（应用 / 架构图 / 工作台 三个 tab）
├── runtime-menu.html            # 运行期 · 菜单视图（左侧菜单树 + 右侧 app iframe）
├── design-home.html             # 始终生成（形态切换落点）
├── design-*.html                # 仅 withDesign: true，16 个平台模块页
├── prototype.config.json        # 本次输入快照
├── assets/
│   ├── tokens.css               # 两份 token 拼接产物
│   ├── data.js                  # 注册表（单一数据源）
│   ├── flash.css · shell.js · interact.js
│   ├── brand/                   # 18 个线上真实图标与背景
│   ├── page/                    # 设计期模块页交互脚本（仅 withDesign）
│   └── l2/                      # 设计期模块定义（仅 withDesign）
└── apps/<slug>/                 # 客户 app 或脱敏空白 app
```

所有页面通过 `<a href>` 真实跳转，`file://` 双击即可点；`assets/data.js` 同时供壳层、生成器、验收脚本读取。

## 3. 应用路由契约

运行期菜单视图的二级菜单点击后，壳层会更新 URL、标题并按以下规则改写 iframe src：

- 读取 `apps[slug].route.param`（缺省 `view`）作为 query 参数名；
- 读取 `route.map[菜单名]` 作为值，未命中时回退为菜单名本身；
- 拼接为 `?{param}={value}`，并保留 `nav=0`（关闭 app 自带导航）。

客户 app 需自行读取该参数渲染对应视图。若 app 使用 hash 路由或 `?v=` / `?t=` 等既有参数，在 `route` 中声明即可，**不要改壳层代码**。

`assets/templates/app-blank/` 是可运行的参考实现：它读取 `?view=` 并渲染对应卡片，用于无真实 app 时保证「子菜单可点击」成立。

若客户 app 完全不支持路由，把 `app.menus` 设为 `["总览"]`，并在交付说明里写明「菜单仅切换标识、不切换内容」，不要假装能切。

## 4. 注册表结构（`assets/data.js` 的 `window.FLASH`）

| 键 | 用途 | 由谁写 |
| --- | --- | --- |
| `pages` | 页面注册表 `[{file,title,group,desc}]`，生成器与验收共用 | 生成器按 `withDesign` 写入 |
| `modes` | 四个形态的 id / label / file，顶栏「视图」下拉读取 | 生成器固定写入 |
| `designNav` | 设计期菜单树（一级组 / 二级组 / item） | 生成器固定写入（线上实测层级） |
| `runtimeNav` | 运行期菜单树，由 `apps` 的 `menus` 派生 | 生成器按 config 写入 |
| `apps` | app 注册表：`label / short / src / note / children / route` | 生成器按 config 写入 |

新增页面或 app 时，**只改 `prototype.config.json` 后重跑生成器**；不要手改生成的 HTML 或 `data.js`。

字段类型与嵌套示例见 [`../examples/minimal/assets/data.js`](../examples/minimal/assets/data.js)。

## 5. 账号规则

- 登录页默认账号为 `config.account`；填入任意用户名即以该身份进入，密码任意都视为成功。
- 用户名写入 `localStorage.flashUser`，并随跳转 URL 传递；顶栏头像、桌面视图与 iframe 内应用共享。
- 直接打开页面（未经登录）时显示 `config.account`。
- 不校验、不提交、不存储任何真实凭据。
