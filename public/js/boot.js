// boot.js — 启动入口
// 顺序：构建 nav/drawer → 绑定搜索按钮 → 注册路由 → 启动路由
(function (global) {
  "use strict";

  function bindSearch() {
    const btn = document.getElementById("btn-search");
    const overlay = document.getElementById("search-overlay");
    const closeBtn = document.getElementById("search-close");
    const input = document.getElementById("search-input");
    const submit = document.getElementById("search-submit");
    if (!btn || !overlay) return;

    function open() {
      overlay.hidden = false;
      setTimeout(function () {
        if (input) { input.focus(); }
      }, 50);
    }
    function close() {
      overlay.hidden = true;
      if (input) input.value = "";
    }
    btn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (submit) submit.addEventListener("click", doSearch);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") doSearch();
        if (e.key === "Escape") close();
      });
    }
    // 点击遮罩关闭
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    function doSearch() {
      const q = (input && input.value || "").trim();
      if (!q) { toast("请输入搜索词"); return; }
      close();
      // 跳到分类页并触发搜索（在 category 页面里通过 query.q 处理）
      // 简化：跳到师傅列表的第一分类，并暂存搜索词
      sessionStorage.setItem("home-repair-search-q", q);
      // 跳到 home 页，让 home 页处理搜索结果（这里改为简化：跳到 category/repair 并在 category 内读取 q）
      global.location.hash = "#/category/repair";
      // 触发 category 重渲染
      setTimeout(function () {
        const evt = new CustomEvent("home-repair:search", { detail: { q: q } });
        document.dispatchEvent(evt);
      }, 60);
    }
  }

  function bindGlobalSearchListener() {
    document.addEventListener("home-repair:search", function (e) {
      const q = e && e.detail && e.detail.q;
      if (!q) return;
      // 直接调用 search modal 渲染结果
      showSearchResults(q);
    });
  }

  async function showSearchResults(q) {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    if (global.router && global.router.setTitle) global.router.setTitle("搜索：" + q);
    app.innerHTML = '<div class="section-title">搜索结果：<span class="t-muted">' + escapeHtml(q) + "</span></div>" +
      '<div id="search-results-host"><div class="list-status">搜索中…</div></div>';
    const host = document.getElementById("search-results-host");
    try {
      const r = await api.listMasters({ q: q, limit: 30 });
      const list = r.masters || [];
      if (list.length === 0) {
        host.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="search"></span></div>未找到匹配的师傅<div class="empty__action"><a class="btn btn--primary btn--sm" href="#/home">回首页</a></div></div>';
        return;
      }
      host.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + list.map(renderMasterMini).join("") + "</div>";
      if (icons) icons.render(host);
    } catch (e) {
      host.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' + escapeHtml(e.message || "搜索失败") + "</div>";
    }
  }

  function renderMasterMini(m) {
    const name = m.name || "师傅";
    const code = m.code || "";
    const avatar = m.avatarUrl
      ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="' + escapeHtml(name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml(store.firstChar(name));
    const tagsHtml = (m.tags || []).slice(0, 2).map(function (t) {
      return '<span class="master-card__tag">' + escapeHtml(t) + "</span>";
    }).join("");
    const rating = m.rating_avg ? Number(m.rating_avg).toFixed(1) : "5.0";
    const price = m.priceRange || "面议";
    return (
      '<a class="master-card" href="#/master/' + encodeURIComponent(code) + '">' +
        '<div class="master-card__avatar">' + avatar + "</div>" +
        '<div class="master-card__body">' +
          '<div class="master-card__head"><span class="master-card__name">' + escapeHtml(name) + "</span></div>" +
          (tagsHtml ? '<div class="master-card__tags">' + tagsHtml + "</div>" : "") +
          '<div class="master-card__meta">' +
            '<span class="master-card__rating"><span data-icon="star"></span>' + rating + "</span>" +
            '<span class="master-card__price">' + escapeHtml(price) + "</span>" +
          "</div>" +
        "</div>" +
      "</a>"
    );
  }

  function registerRoutes() {
    router.on("home", async function () {
      // 清理其他页面留下的 bottom-bar
      cleanupBottomBar();
      if (global.home) await global.home.render.apply(global.home, arguments);
    });
    router.on("categoryRoot", async function () {
      cleanupBottomBar();
      // 已在 router 内 redirect
    });
    router.on("category", async function (route) {
      cleanupBottomBar();
      if (global.category) await global.category.render(route);
    });
    router.on("master", async function (route) {
      if (global.master) await global.master.render(route);
    });
    router.on("booking", async function (route) {
      if (global.booking) await global.booking.render(route);
    });
    router.on("orders", async function (route) {
      cleanupBottomBar();
      if (global.orders) await global.orders.render(route);
    });
    router.on("review", async function (route) {
      cleanupBottomBar();
      if (global.review) await global.review.render(route);
    });
    router.on("profile", async function () {
      cleanupBottomBar();
      if (global.profile) await global.profile.render.apply(global.profile, arguments);
    });
  }

  function cleanupBottomBar() {
    const old = document.querySelector(".bottom-bar");
    if (old) old.remove();
    const app = document.getElementById("app");
    if (app) app.classList.remove("app--has-bottom-bar");
  }

  function boot() {
    // 1. 构建 nav + drawer
    if (global.nav && nav.build) nav.build();
    if (global.drawer && drawer.init) drawer.init();
    if (global.icons) icons.render(document);
    // 2. 搜索按钮
    bindSearch();
    bindGlobalSearchListener();
    // 3. 注册路由
    registerRoutes();
    // 4. 初始化路由
    if (global.router) {
      router.init();
      router.start();
    }
  }

  // DOMContentLoaded 后启动
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.boot = boot;
})(window);
