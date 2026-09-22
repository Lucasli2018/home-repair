// features/master.js — 师傅详情
(function (global) {
  "use strict";

  function renderHead(m) {
    const avatar = m.avatarUrl
      ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="' + escapeHtml(m.name || "") + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml(store.firstChar(m.name));
    const tags = (m.tags || []).map(function (t) {
      return '<span class="master-head__tag">' + escapeHtml(t) + "</span>";
    }).join("");
    const rating = m.ratingAvg ? Number(m.ratingAvg).toFixed(1) : "5.0";
    const ratingCount = m.ratingCount || 0;
    const price = m.priceRange || "面议";
    const city = m.city || "";
    const district = m.district || "";
    return (
      '<div class="master-head">' +
        '<div class="master-head__avatar">' + avatar + "</div>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="master-head__name">' + escapeHtml(m.name || "") + "</div>" +
          (tags ? '<div class="master-head__tags">' + tags + "</div>" : "") +
          '<div class="master-head__meta">' +
            '<span class="master-head__rating"><span data-icon="star"></span>' + rating + " · " + ratingCount + "评</span>" +
            (city || district ? '<span>📍 ' + escapeHtml((city || "") + (district ? " " + district : "")) + "</span>" : "") +
            '<span class="master-head__price">' + escapeHtml(price) + "</span>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderBio(m) {
    if (!m.bio) return "";
    return (
      '<div class="section-title">关于师傅</div>' +
      '<div class="card">' + escapeHtml(m.bio) + "</div>"
    );
  }

  function renderCerts(certs) {
    if (!certs || certs.length === 0) return "";
    const items = certs.map(function (c) {
      return (
        '<div class="cert-card">' +
          (c.url ? '<img class="cert-card__img" src="' + escapeHtml(c.url) + '" alt="' + escapeHtml(c.title || "") + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">' : '<div class="cert-card__img"></div>') +
          '<div class="cert-card__title">' + escapeHtml(c.title || "证书") + "</div>" +
        "</div>"
      );
    }).join("");
    return (
      '<div class="section-title">资质证书</div>' +
      '<div class="cert-strip">' + items + "</div>"
    );
  }

  function renderServices(services) {
    if (!services || services.length === 0) {
      return '<div class="section-title">服务项目</div>' +
        '<div class="empty" style="padding:24px"><div class="empty__icon"><span data-icon="briefcase"></span></div>暂无可预约的服务</div>';
    }
    const items = services.map(function (s) {
      const price = s.price_cents != null ? formatPrice(s.price_cents) : "面议";
      const dur = s.duration_min ? s.duration_min + "分钟" : "时长面议";
      return (
        '<a class="service-item" href="#/booking/' + encodeURIComponent(s.masterCode || (global.master_code || "")) +
          (s.id ? ("?serviceId=" + s.id) : "") + '" data-svc-id="' + s.id + '">' +
          '<div class="service-item__main">' +
            '<div class="service-item__name">' + escapeHtml(s.name || "") + "</div>" +
            (s.description ? '<div class="service-item__desc">' + escapeHtml(s.description) + "</div>" : "") +
            '<div class="service-item__meta"><span data-icon="clock"></span>' + dur + "</div>" +
          "</div>" +
          '<div class="service-item__price">' + price + "</div>" +
        "</a>"
      );
    }).join("");
    return (
      '<div class="section-title">服务项目</div>' +
      '<div class="service-list">' + items + "</div>"
    );
  }

  function renderReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return '<div class="section-title">用户评价</div>' +
        '<div class="empty" style="padding:24px"><div class="empty__icon"><span data-icon="star"></span></div>暂无评价</div>';
    }
    const items = reviews.map(function (r) {
      const rating = parseInt(r.rating, 10) || 5;
      const stars = Array.from({ length: 5 }, function (_, i) {
        return '<span class="star' + (i < rating ? "" : " star--empty") + '"><span data-icon="' + (i < rating ? "star_fill" : "star_outline") + '"></span></span>';
      }).join("");
      const name = maskName(r.customer_name || r.customerName || "匿名");
      const date = formatDate(r.created_at, { dateOnly: true });
      const content = r.content ? escapeHtml(r.content) : '<span style="color:var(--text-3)">用户未留言</span>';
      return (
        '<div class="review-bubble">' +
          '<div class="review-bubble__head">' +
            '<span class="review-bubble__user">' + escapeHtml(name) + "</span>" +
            '<span class="review-bubble__date">' + escapeHtml(date) + "</span>" +
          "</div>" +
          '<div class="review-bubble__rating"><span class="stars">' + stars + "</span></div>" +
          '<div class="review-bubble__content">' + content + "</div>" +
        "</div>"
      );
    }).join("");
    return '<div class="section-title">用户评价<span class="section-title__more">' + reviews.length + "条</span></div>" +
      '<div>' + items + "</div>";
  }

  async function render(route) {
    const app = document.getElementById("app");
    if (!app) return;
    const code = route && route.params && route.params.code;
    if (!code) {
      app.innerHTML = '<div class="empty">未指定师傅</div>';
      return;
    }
    global.master_code = code;
    app.className = "app app--has-bottom-bar";
    app.innerHTML =
      '<div id="master-host"><div class="list-status">加载中…</div></div>';

    const host = document.getElementById("master-host");
    try {
      const data = await api.getMaster(code);
      if (!data || !data.master) {
        host.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>师傅不存在或已下线</div>';
        return;
      }
      const m = data.master;
      // 给 services 注入 masterCode
      (data.services || []).forEach(function (s) { s.masterCode = code; });
      host.innerHTML =
        renderHead(m) +
        renderBio(m) +
        renderCerts(data.certificates) +
        renderServices(data.services) +
        renderReviews(data.reviews);
      if (icons) icons.render(host);
      // 渲染底部固定栏
      renderBottomBar(m, data.services);
      if (global.router && global.router.setTitle) {
        global.router.setTitle(m.name + " · 师傅详情");
      }
    } catch (e) {
      host.innerHTML =
        '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(e.message || "加载失败") +
        '<div class="empty__action"><button class="btn btn--soft btn--sm" id="retry-btn">重试</button></div></div>';
      const retry = document.getElementById("retry-btn");
      if (retry) retry.addEventListener("click", function () { render(route); });
    }
  }

  function renderBottomBar(m, services) {
    // 移除已有 bottom-bar
    const old = document.querySelector(".bottom-bar");
    if (old) old.remove();
    if (!services || services.length === 0) return;
    const firstService = services[0];
    const firstHref = "#/booking/" + encodeURIComponent(m.code) + (firstService ? ("?serviceId=" + firstService.id) : "");
    const bar = document.createElement("div");
    bar.className = "bottom-bar";
    bar.innerHTML =
      '<div class="bottom-bar__price">' + escapeHtml(m.priceRange || "面议") +
        (m.priceRange ? "<small>起</small>" : "") +
      "</div>" +
      '<a class="btn btn--primary btn--lg" href="' + firstHref + '">' +
        '<span data-icon="calendar"></span>立即预约</a>';
    document.body.appendChild(bar);
    if (icons) icons.render(bar);
  }

  function cleanup() {
    const old = document.querySelector(".bottom-bar");
    if (old) old.remove();
  }

  global.master = {
    render: render,
    cleanup: cleanup,
  };
})(window);
