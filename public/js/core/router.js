// core/router.js — hash 路由
// 路由：#/home /#/category/:cat /#/master/:code /#/booking/:code?serviceId= /#/orders /#/review/:id /#/profile
(function (global) {
  "use strict";

  const routes = [
    { name: "home", pattern: /^\/?home\/?$/, tab: "home" },
    { name: "category", pattern: /^\/?category\/([^\/?]+)\/?$/, tab: "category", params: ["cat"] },
    { name: "categoryRoot", pattern: /^\/?category\/?$/, tab: "category", redirect: { name: "category", params: { cat: "repair" } } },
    { name: "master", pattern: /^\/?master\/([^\/?]+)\/?$/, tab: "category", params: ["code"] },
    { name: "booking", pattern: /^\/?booking\/([^\/?]+)\/?$/, tab: "category", params: ["code"] },
    { name: "orders", pattern: /^\/?orders\/?$/, tab: "orders" },
    { name: "review", pattern: /^\/?review\/([^\/?]+)\/?$/, tab: "orders", params: ["id"] },
    { name: "profile", pattern: /^\/?profile\/?$/, tab: "profile" },
  ];

  let currentRoute = null;
  let listeners = {};

  function parseHash() {
    let h = global.location.hash || "";
    if (h.indexOf("#") === 0) h = h.slice(1);
    if (h.indexOf("/") !== 0) h = "/" + h;
    // 分离 path 与 query
    const qIdx = h.indexOf("?");
    let path = qIdx >= 0 ? h.slice(0, qIdx) : h;
    let queryStr = qIdx >= 0 ? h.slice(qIdx + 1) : "";
    if (path.length > 1 && path.slice(-1) === "/") path = path.slice(0, -1);
    if (!path || path === "/") path = "/home";
    const query = {};
    if (queryStr) {
      queryStr.split("&").forEach(function (kv) {
        if (!kv) return;
        const idx = kv.indexOf("=");
        const k = decodeURIComponent(idx >= 0 ? kv.slice(0, idx) : kv);
        const v = idx >= 0 ? decodeURIComponent(kv.slice(idx + 1)) : "";
        if (k) query[k] = v;
      });
    }
    return { path: path, query: query };
  }

  function matchRoute(parsed) {
    const path = parsed.path;
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      const m = path.match(r.pattern);
      if (m) {
        if (r.redirect) {
          return {
            name: r.redirect.name,
            params: r.redirect.params || {},
            query: parsed.query,
            tab: r.tab,
            redirect: true,
          };
        }
        const params = {};
        if (r.params) {
          for (let j = 0; j < r.params.length; j++) {
            params[r.params[j]] = decodeURIComponent(m[j + 1] || "");
          }
        }
        return { name: r.name, params: params, query: parsed.query, tab: r.tab };
      }
    }
    return null;
  }

  function go(name, params, query) {
    let hash = "#/" + name;
    if (params) {
      Object.keys(params).forEach(function (k) {
        hash += "/" + encodeURIComponent(params[k]);
      });
    }
    if (query) {
      const parts = [];
      Object.keys(query).forEach(function (k) {
        if (query[k] != null && query[k] !== "") {
          parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(query[k]));
        }
      });
      if (parts.length) hash += "?" + parts.join("&");
    }
    if (global.location.hash === hash) {
      // 同路由再次触发
      dispatch();
    } else {
      global.location.hash = hash;
    }
  }

  function goFromHash(hash) {
    global.location.hash = hash;
  }

  function on(name, handler) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(handler);
  }

  function off(name, handler) {
    if (!listeners[name]) return;
    listeners[name] = listeners[name].filter(function (fn) { return fn !== handler; });
  }

  async function dispatch() {
    const parsed = parseHash();
    const route = matchRoute(parsed);
    if (!route) {
      // 未匹配 → 回首页
      global.location.hash = "#/home";
      return;
    }
    if (route.redirect) {
      go(route.name, route.params, route.query);
      return;
    }
    currentRoute = route;
    if (global.setActiveNav && route.tab) {
      global.setActiveNav(route.tab);
    }
    if (listeners[route.name]) {
      for (const fn of listeners[route.name]) {
        try {
          await fn(route);
        } catch (e) {
          console.error("router handler error:", e);
          if (global.showToast) global.showToast("页面加载失败");
        }
      }
    }
    // 滚到顶部
    if (global.scrollTo) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function getCurrent() {
    return currentRoute;
  }

  function setTitle(title) {
    const el = document.getElementById("topbar-title");
    if (el) el.textContent = title || (global.CONFIG && global.CONFIG.appName) || "家修";
  }

  function init() {
    global.addEventListener("hashchange", dispatch);
    // 等所有 script 加载完成再触发首次路由（由 boot.js 控制）
  }

  function start() {
    if (!global.location.hash) {
      global.location.hash = "#/home";
    } else {
      dispatch();
    }
  }

  global.router = {
    on: on,
    off: off,
    go: go,
    goFromHash: goFromHash,
    dispatch: dispatch,
    start: start,
    init: init,
    getCurrent: getCurrent,
    setTitle: setTitle,
    parse: parseHash,
    match: matchRoute,
  };

  // 全局快捷方法
  global.go = go;
})(window);
