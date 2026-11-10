/* 生成产物，勿手改 · 源：prototype.config.json */
window.FLASH = {
  "designNav": [
    {
      "type": "item",
      "label": "首页",
      "file": "design-home.html",
      "icon": "home"
    }
  ],
  "runtimeNav": [
    {
      "type": "item",
      "label": "应用首页",
      "icon": "home",
      "app": "demo",
      "view": ""
    },
    {
      "type": "group",
      "label": "示例应用",
      "icon": "app",
      "app": "demo",
      "children": [
        {
          "type": "item",
          "label": "总览",
          "app": "demo",
          "view": "总览"
        },
        {
          "type": "item",
          "label": "业务台账",
          "app": "demo",
          "view": "业务台账"
        },
        {
          "type": "item",
          "label": "运行看板",
          "app": "demo",
          "view": "运行看板"
        },
        {
          "type": "item",
          "label": "报表",
          "app": "demo",
          "view": "报表"
        }
      ]
    }
  ],
  "apps": {
    "demo": {
      "label": "示例应用",
      "short": "示例应用",
      "src": "apps/demo/index.html",
      "note": "示例应用 · 离线占位数据",
      "children": [
        "总览",
        "业务台账",
        "运行看板",
        "报表"
      ],
      "route": {
        "param": "view"
      },
      "navOff": true
    }
  },
  "pages": [
    {
      "file": "index.html",
      "title": "原型总览",
      "group": "entry",
      "desc": "全部页面与应用入口索引"
    },
    {
      "file": "login.html",
      "title": "用户登录",
      "group": "login",
      "desc": "完整登录页"
    },
    {
      "file": "runtime-desktop.html",
      "title": "运行期 · 桌面视图",
      "group": "runtime",
      "desc": "应用 / 架构图 / 工作台 三个 tab"
    },
    {
      "file": "runtime-menu.html",
      "title": "运行期 · 菜单视图",
      "group": "runtime",
      "desc": "左侧菜单树 + 右侧应用内容"
    },
    {
      "file": "design-home.html",
      "title": "设计期 · 首页",
      "group": "design",
      "desc": "平台设计期入口（背景板）"
    }
  ],
  "modes": [
    {
      "id": "login",
      "label": "登录页",
      "file": "login.html"
    },
    {
      "id": "runtime-desktop",
      "label": "运行期 · 桌面视图",
      "file": "runtime-desktop.html"
    },
    {
      "id": "runtime-menu",
      "label": "运行期 · 菜单视图",
      "file": "runtime-menu.html"
    },
    {
      "id": "design",
      "label": "设计期",
      "file": "design-home.html"
    }
  ],
  "P": null,
  "account": "admin",
  "title": "示例应用产品原型"
};
