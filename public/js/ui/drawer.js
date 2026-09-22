// ui/drawer.js — 左侧抽屉
(function (global) {
  "use strict";

  const ITEMS = [
    { key: "home", name: "首页", icon: "home", route: "#/home" },
    { key: "category", name: "全部分类", icon: "grid", route: "#/category/repair" },
    { key: "orders", name: "我的订单", icon: "list", route: "#/orders" },
    { key: "profile", name: "我的评价", icon: "star", route: "#/orders" }, // 评价入口在订单
    { key: "about", name: "关于我们", icon: "info", action: "about" },
    { key: "settings", name: "设置", icon: "gear", action: "settings" },
  ];

  function build() {
    const nav = document.getElementById("drawer-nav");
    if (!nav) return;
    nav.innerHTML =
      ITEMS.map(function (it) {
        return (
          '<div class="drawer__nav-item" data-key="' + it.key + '"' +
          (it.route ? ' data-route="' + it.route + '"' : "") +
          (it.action ? ' data-action="' + it.action + '"' : "") +
          '><span data-icon="' + it.icon + '"></span><span>' + it.name + "</span></div>"
        );
      }).join("") +
      '<div class="drawer__nav-item drawer__nav-item--admin" data-key="admin" data-action="admin">' +
        '<span data-icon="shield"></span><span>平台管理后台</span>' +
      "</div>";
    nav.querySelectorAll(".drawer__nav-item").forEach(function (el) {
      el.addEventListener("click", function () {
        const route = el.getAttribute("data-route");
        const action = el.getAttribute("data-action");
        const key = el.getAttribute("data-key");
        close();
        if (route) {
          if (global.location.hash === route) {
            global.router && global.router.dispatch();
          } else {
            global.location.hash = route;
          }
        } else if (action === "about") {
          aboutModal();
        } else if (action === "settings") {
          settingsModal();
        } else if (action === "admin") {
          const path = global.CONFIG && global.CONFIG.adminPath ? global.CONFIG.adminPath : "/admin.html";
          global.location.href = path;
        }
      });
    });
    if (global.icons) global.icons.render(nav);
  }

  function open() {
    const d = document.getElementById("drawer");
    const s = document.getElementById("scrim");
    if (d) {
      d.classList.add("show");
      d.setAttribute("aria-hidden", "false");
    }
    if (s) s.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    const d = document.getElementById("drawer");
    const s = document.getElementById("scrim");
    if (d) {
      d.classList.remove("show");
      d.setAttribute("aria-hidden", "true");
    }
    if (s) s.hidden = true;
    document.body.style.overflow = "";
  }

  function toggle() {
    const d = document.getElementById("drawer");
    if (d && d.classList.contains("show")) close();
    else open();
  }

  function aboutModal() {
    if (global.modal) {
      global.modal.show({
        title: "关于家修管家",
        bodyHtml:
          '<div style="text-align:center;padding:8px 0;">' +
            '<div style="font-size:20px;font-weight:700;color:var(--accent-strong)">' +
            (global.CONFIG && global.CONFIG.appName ? global.CONFIG.appName : "家修管家") + "</div>" +
            '<div style="font-size:13px;color:var(--text-3);margin-top:4px">v1.0 · 上门服务</div>' +
            '<div style="margin-top:16px;font-size:14px;color:var(--text-2);line-height:1.7">' +
              (global.CONFIG ? "服务时间：" + global.CONFIG.serviceHours : "") + "<br>" +
              "覆盖城市：北京、上海、广州、深圳等<br>" +
              "客服电话：400-100-1000" +
            "</div>" +
          "</div>",
        okText: "知道了",
      });
    }
  }

  function settingsModal() {
    if (!global.modal) return;
    const theme = global.store ? global.store.getTheme() : "auto";
    global.modal.show({
      title: "设置",
      bodyHtml:
        '<div class="field">' +
          "<label class=\"field__label\">主题</label>" +
          '<div class="seg" id="theme-seg">' +
            '<div class="seg__item' + (theme === "light" ? " active" : "") + '" data-theme="light">浅色</div>' +
            '<div class="seg__item' + (theme === "dark" ? " active" : "") + '" data-theme="dark">深色</div>' +
            '<div class="seg__item' + (theme === "auto" ? " active" : "") + '" data-theme="auto">跟随系统</div>' +
          "</div>" +
        "</div>" +
        '<div class="field">' +
          "<label class=\"field__label\">缓存</label>" +
          '<button class="btn btn--ghost btn--block" id="clear-cache-btn" type="button">清除本地缓存</button>' +
          '<div class="field__hint">清除后，本地保存的手机号、姓名等会被删除</div>' +
        "</div>",
      okText: "完成",
      onMount: function (root) {
        const seg = root.querySelector("#theme-seg");
        if (seg) {
          seg.querySelectorAll(".seg__item").forEach(function (el) {
            el.addEventListener("click", function () {
              const t = el.getAttribute("data-theme");
              seg.querySelectorAll(".seg__item").forEach(function (x) { x.classList.remove("active"); });
              el.classList.add("active");
              applyTheme(t);
            });
          });
        }
        const btn = root.querySelector("#clear-cache-btn");
        if (btn) {
          btn.addEventListener("click", function () {
            if (global.store) global.store.clear();
            if (global.toast) global.toast("已清除本地缓存");
          });
        }
      },
    });
  }

  function applyTheme(name) {
    if (global.store) global.store.setTheme(name);
    document.documentElement.setAttribute("data-theme", name);
  }

  function bindTopbar() {
    const btn = document.getElementById("btn-menu");
    if (btn) btn.addEventListener("click", open);
    const scrim = document.getElementById("scrim");
    if (scrim) scrim.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function init() {
    build();
    bindTopbar();
    // 初始化主题
    const theme = global.store ? global.store.getTheme() : "auto";
    applyTheme(theme);
  }

  global.drawer = {
    ITEMS: ITEMS,
    build: build,
    open: open,
    close: close,
    toggle: toggle,
    init: init,
    aboutModal: aboutModal,
    settingsModal: settingsModal,
    applyTheme: applyTheme,
  };
})(window);
