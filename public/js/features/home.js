// features/home.js — 首页：hero + 分类宫格 + 推荐师傅 + 当前订单
(function (global) {
  "use strict";

  const SUBCAT_FALLBACK = [
    { key: "water", name: "水电", icon: "wrench", parent: "repair" },
    { key: "appliance", name: "家电", icon: "wrench", parent: "repair" },
    { key: "pipe", name: "管道", icon: "wrench", parent: "repair" },
    { key: "daily", name: "日常", icon: "sparkles", parent: "cleaning" },
    { key: "deep", name: "深度", icon: "sparkles", parent: "cleaning" },
  ];

  function renderHero() {
    return (
      '<section class="hero">' +
        '<div class="hero__title">家修管家</div>' +
        '<div class="hero__sub">家庭维修 · 保洁家政 · 上门服务</div>' +
        '<div class="hero__actions">' +
          '<a class="hero__btn hero__btn--solid" href="#/category/repair">立即预约</a>' +
          '<a class="hero__btn" href="#/orders">查看订单</a>' +
        "</div>" +
      "</section>"
    );
  }

  function renderCategoryGrid(cats) {
    const main = (cats && cats.length) ? cats : (global.CONFIG && CONFIG.categories) || [];
    let subs = [];
    main.forEach(function (c) {
      (c.subs || []).forEach(function (s) {
        subs.push({ key: s.key, name: s.name, icon: c.icon, parent: c.key });
      });
    });
    // 取前 4 个子类
    const pickedSubs = subs.slice(0, 4);

    const mainHtml = main.slice(0, 4).map(function (c) {
      return (
        '<a class="cat-item" href="#/category/' + encodeURIComponent(c.key) + '">' +
          '<span class="cat-item__icon" data-icon="' + (c.icon || "grid") + '"></span>' +
          "<span class=\"cat-item__name\">" + escapeHtml(c.name) + "</span>" +
        "</a>"
      );
    }).join("");

    const subHtml = pickedSubs.map(function (s) {
      return (
        '<a class="cat-item" href="#/category/' + encodeURIComponent(s.parent) + '">' +
          '<span class="cat-item__icon" data-icon="' + (s.icon || "grid") + '"></span>' +
          "<span class=\"cat-item__name\">" + escapeHtml(s.name) + "</span>" +
        "</a>"
      );
    }).join("");

    return (
      '<section class="card" style="margin-top:16px;padding:16px 12px">' +
        '<div class="cat-grid">' + mainHtml + "</div>" +
        '<div style="height:12px"></div>' +
        '<div class="cat-grid">' + subHtml + "</div>" +
      "</section>"
    );
  }

  function renderMasterCard(m) {
    const name = m.name || "师傅";
    const code = m.code || "";
    const avatar = m.avatarUrl
      ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="' + escapeHtml(name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml(store.firstChar(name));
    const tagsHtml = (m.tags || []).slice(0, 2).map(function (t) {
      return '<span class="master-card__tag">' + escapeHtml(t) + "</span>";
    }).join("");
    const rating = m.rating_avg ? Number(m.rating_avg).toFixed(1) : "5.0";
    const ratingCount = m.rating_count || 0;
    const price = m.priceRange || "面议";
    const bio = m.bio ? escapeHtml(m.bio) : "从业多年，专业上门服务";

    return (
      '<a class="master-card" href="#/master/' + encodeURIComponent(code) + '">' +
        '<div class="master-card__avatar">' + avatar + "</div>" +
        '<div class="master-card__body">' +
          '<div class="master-card__head">' +
            '<span class="master-card__name">' + escapeHtml(name) + "</span>" +
          "</div>" +
          (tagsHtml ? '<div class="master-card__tags">' + tagsHtml + "</div>" : "") +
          '<div class="master-card__meta">' +
            '<span class="master-card__rating"><span data-icon="star"></span>' + rating + " · " + ratingCount + "评</span>" +
            '<span class="master-card__price">' + escapeHtml(price) + "</span>" +
          "</div>" +
          '<div class="master-card__bio">' + bio + "</div>" +
        "</div>" +
      "</a>"
    );
  }

  function renderOrderCard(o) {
    const statusInfo = (CONFIG.orderStatus && CONFIG.orderStatus[o.status]) || { name: o.status, badge: "badge" };
    const mAvatar = o.masterAvatarUrl
      ? '<img src="' + escapeHtml(o.masterAvatarUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml((o.master_name || "M").slice(0, 1));
    return (
      '<a class="order-card" href="#/master/' + encodeURIComponent(o.master_code || "") + '">' +
        '<div class="order-card__head">' +
          '<div class="order-card__master">' +
            '<div class="order-card__avatar">' + mAvatar + "</div>" +
            '<div class="order-card__master-info">' +
              '<div class="order-card__master-name">' + escapeHtml(o.master_name || "师傅") + "</div>" +
              '<div class="order-card__service">' + escapeHtml(o.service_name || "") + "</div>" +
            "</div>" +
          "</div>" +
          '<span class="badge ' + statusInfo.badge + '">' + escapeHtml(statusInfo.name) + "</span>" +
        "</div>" +
        '<div class="order-card__time"><span data-icon="clock"></span>' + escapeHtml(formatDate(o.scheduled_at)) + "</div>" +
        '<div class="order-card__addr"><span data-icon="location"></span>' + escapeHtml(o.customer_address || "") + "</div>" +
      "</a>"
    );
  }

  async function render(route) {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    app.innerHTML =
      renderHero() +
      '<div class="section-title">服务分类<span class="section-title__more">全部 ›</span></div>' +
      '<div id="cat-grid-host"></div>' +
      '<div class="section-title">推荐师傅<a class="section-title__more" href="#/category/repair">更多 ›</a></div>' +
      '<div id="master-list-host"><div class="list-status">加载中…</div></div>' +
      '<div id="current-orders-host"></div>';

    // 1. 分类
    let cats = [];
    try {
      cats = await api.getCategories();
    } catch (e) {
      cats = (CONFIG.categories || []);
    }
    const gridHost = document.getElementById("cat-grid-host");
    if (gridHost) gridHost.innerHTML = renderCategoryGrid(cats);
    if (icons) icons.render(app);

    // 2. 推荐师傅
    const masterHost = document.getElementById("master-list-host");
    try {
      const r = await api.listMasters({ limit: 6 });
      const list = r.masters || [];
      if (list.length === 0) {
        masterHost.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="wrench"></span></div>暂无师傅数据<div class="empty__action"><button class="btn btn--soft btn--sm" onclick="location.reload()">刷新</button></div></div>';
      } else {
        masterHost.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + list.map(renderMasterCard).join("") + "</div>";
      }
    } catch (e) {
      masterHost.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(e.message || "加载失败") +
        '<div class="empty__action"><button class="btn btn--soft btn--sm" onclick="location.reload()">重试</button></div></div>';
    }
    if (icons) icons.render(app);

    // 3. 当前订单
    const phone = store.getPhone();
    const ordersHost = document.getElementById("current-orders-host");
    if (phone) {
      try {
        // 取进行中：pending + confirmed（status 不传 'all'，需要分别拉取）
        const [pendingList, confirmedList] = await Promise.all([
          api.getMyOrders(phone, "pending").catch(function () { return []; }),
          api.getMyOrders(phone, "confirmed").catch(function () { return []; }),
        ]);
        const orders = [].concat(pendingList, confirmedList);
        if (orders.length > 0) {
          ordersHost.innerHTML =
            '<div class="section-title">进行中的订单<a class="section-title__more" href="#/orders">全部 ›</a></div>' +
            orders.slice(0, 3).map(renderOrderCard).join("");
        } else {
          ordersHost.innerHTML = "";
        }
      } catch (e) {
        ordersHost.innerHTML = "";
      }
    } else {
      ordersHost.innerHTML = "";
    }
    if (icons) icons.render(app);
  }

  global.home = { render: render };
})(window);
