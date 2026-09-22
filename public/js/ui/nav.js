// ui/nav.js — 底部 4 tab 导航
(function (global) {
  "use strict";

  const TABS = [
    { key: "home", name: "首页", icon: "home", route: "#/home" },
    { key: "category", name: "分类", icon: "grid", route: "#/category/repair" },
    { key: "orders", name: "订单", icon: "list", route: "#/orders" },
    { key: "profile", name: "我的", icon: "user", route: "#/profile" },
  ];

  function build() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    nav.innerHTML = TABS.map(function (t) {
      return (
        '<a class="nav__item" data-tab="' + t.key + '" href="' + t.route + '" aria-label="' + t.name + '">' +
          '<span data-icon="' + t.icon + '"></span>' +
          '<span>' + t.name + "</span>" +
        "</a>"
      );
    }).join("");
    nav.querySelectorAll(".nav__item").forEach(function (el) {
      el.addEventListener("click", function (e) {
        // hash 由 href 触发，不再手动 push
        const href = el.getAttribute("href") || "";
        if (!href) return;
        if (global.location.hash === href) {
          e.preventDefault();
          global.router && global.router.dispatch();
        }
      });
    });
    if (global.icons) global.icons.render(nav);
  }

  function setActiveNav(tab) {
    const nav = document.getElementById("nav");
    if (!nav) return;
    nav.querySelectorAll(".nav__item").forEach(function (el) {
      const k = el.getAttribute("data-tab");
      if (k === tab) el.classList.add("active");
      else el.classList.remove("active");
    });
  }

  global.nav = {
    TABS: TABS,
    build: build,
    setActiveNav: setActiveNav,
  };
  global.setActiveNav = setActiveNav;
})(window);
