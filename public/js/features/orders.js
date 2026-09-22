// features/orders.js — 我的订单：segment + 订单卡列表
(function (global) {
  "use strict";

  const SEGS = [
    { key: "all", name: "全部" },
    { key: "pending", name: "待确认" },
    { key: "confirmed", name: "已确认" },
    { key: "done", name: "已完成" },
    { key: "cancelled", name: "已取消" },
  ];

  let currentStatus = "all";
  let loadedOrders = [];

  function renderSeg() {
    return SEGS.map(function (s) {
      return '<div class="seg__item' + (s.key === currentStatus ? " active" : "") + '" data-status="' + s.key + '">' + escapeHtml(s.name) + "</div>";
    }).join("");
  }

  function renderEmpty() {
    const phone = store.getPhone();
    if (!phone) {
      return (
        '<div class="empty">' +
          '<div class="empty__icon"><span data-icon="list"></span></div>' +
          "请先在「我的」页面填写手机号" +
          '<div class="empty__action"><a class="btn btn--primary btn--sm" href="#/profile">去填写</a></div>' +
        "</div>"
      );
    }
    return (
      '<div class="empty">' +
        '<div class="empty__icon"><span data-icon="list"></span></div>' +
        (currentStatus === "all" ? "暂无订单" : "该状态下暂无订单") +
        '<div class="empty__action"><a class="btn btn--primary btn--sm" href="#/home">去预约</a></div>' +
      "</div>"
    );
  }

  function renderOrderCard(o) {
    const statusInfo = (CONFIG.orderStatus && CONFIG.orderStatus[o.status]) || { name: o.status, badge: "badge" };
    const mAvatar = o.masterAvatarUrl
      ? '<img src="' + escapeHtml(o.masterAvatarUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml((o.master_name || "M").slice(0, 1));
    const price = o.service_price_cents != null ? formatPrice(o.service_price_cents) : "面议";
    const reviewExists = !!o.review;
    const canReview = o.status === "done" && !reviewExists;
    const canCancel = o.status === "pending" || o.status === "confirmed";
    return (
      '<div class="order-card" data-id="' + o.id + '">' +
        '<div class="order-card__head">' +
          '<a class="order-card__master" href="#/master/' + encodeURIComponent(o.master_code || "") + '">' +
            '<div class="order-card__avatar">' + mAvatar + "</div>" +
            '<div class="order-card__master-info">' +
              '<div class="order-card__master-name">' + escapeHtml(o.master_name || "师傅") + "</div>" +
              '<div class="order-card__service">' + escapeHtml(o.service_name || "") + "</div>" +
            "</div>" +
          "</a>" +
          '<span class="badge ' + statusInfo.badge + '">' + escapeHtml(statusInfo.name) + "</span>" +
        "</div>" +
        '<div class="order-card__time"><span data-icon="clock"></span>' + escapeHtml(formatDate(o.scheduled_at)) + "</div>" +
        '<div class="order-card__addr"><span data-icon="location"></span>' + escapeHtml(o.customer_address || "") + "</div>" +
        (o.note ? '<div class="order-card__addr" style="color:var(--text-3)">备注：' + escapeHtml(o.note) + "</div>" : "") +
        (reviewExists ? '<div class="review-bubble" style="margin-top:8px">' +
          '<div class="review-bubble__rating"><span class="stars">' + renderStars(o.review.rating) + "</span></div>" +
          (o.review.content ? '<div class="review-bubble__content">' + escapeHtml(o.review.content) + "</div>" : "") +
        "</div>" : "") +
        '<div class="order-card__foot">' +
          '<span class="order-card__price">' + price + "</span>" +
          '<div class="order-card__actions">' +
            (canCancel ? '<button class="btn btn--ghost btn--sm" data-action="cancel" data-id="' + o.id + '">取消订单</button>' : "") +
            (canReview ? '<button class="btn btn--primary btn--sm" data-action="review" data-id="' + o.id + '">去评价</button>' : "") +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderStars(rating) {
    const r = parseInt(rating, 10) || 5;
    return Array.from({ length: 5 }, function (_, i) {
      return '<span data-icon="' + (i < r ? "star_fill" : "star_outline") + '"></span>';
    }).join("");
  }

  async function loadOrders() {
    const host = document.getElementById("orders-host");
    if (!host) return;
    host.innerHTML = '<div class="list-status">加载中…</div>';
    const phone = store.getPhone();
    if (!phone) {
      host.innerHTML = renderEmpty();
      if (icons) icons.render(host);
      return;
    }
    try {
      const orders = await api.getMyOrders(phone, currentStatus === "all" ? "" : currentStatus);
      loadedOrders = orders || [];
      if (loadedOrders.length === 0) {
        host.innerHTML = renderEmpty();
      } else {
        host.innerHTML = loadedOrders.map(renderOrderCard).join("");
        bindOrderEvents(host);
      }
    } catch (e) {
      host.innerHTML =
        '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(e.message || "加载失败") +
        '<div class="empty__action"><button class="btn btn--soft btn--sm" id="retry-btn">重试</button></div></div>';
      const retry = document.getElementById("retry-btn");
      if (retry) retry.addEventListener("click", function () { loadOrders(); });
    } finally {
      if (icons) icons.render(host);
    }
  }

  function bindOrderEvents(host) {
    host.querySelectorAll('.order-card__actions [data-action="cancel"]').forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const ok = await global.modal.confirm({
          title: "取消订单",
          body: "确定要取消该订单吗？取消后无法恢复。",
          okText: "确定取消",
          cancelText: "保留",
          okClass: "btn--danger",
        });
        if (!ok) return;
        const phone = store.getPhone();
        try {
          btn.disabled = true;
          btn.textContent = "取消中…";
          await api.cancelBooking(id, phone);
          toast("已取消");
          loadOrders();
        } catch (e) {
          toast(e.message || "取消失败");
          btn.disabled = false;
          btn.textContent = "取消订单";
        }
      });
    });
    host.querySelectorAll('.order-card__actions [data-action="review"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        go("review", { id: id });
      });
    });
  }

  async function render(route) {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    // 兼容 #/orders?status=done
    const q = route && route.query || {};
    if (q.status && SEGS.some(function (s) { return s.key === q.status; })) {
      currentStatus = q.status;
    } else {
      currentStatus = "all";
    }

    app.innerHTML =
      '<div class="card" style="margin-bottom:12px;padding:6px">' +
        '<div class="seg" id="order-seg">' + renderSeg() + "</div>" +
      "</div>" +
      '<div id="orders-host"></div>';

    if (global.router && global.router.setTitle) global.router.setTitle("我的订单");
    if (icons) icons.render(app);

    const seg = document.getElementById("order-seg");
    if (seg) {
      seg.querySelectorAll(".seg__item").forEach(function (el) {
        el.addEventListener("click", function () {
          const s = el.getAttribute("data-status");
          if (s && s !== currentStatus) {
            currentStatus = s;
            seg.querySelectorAll(".seg__item").forEach(function (x) { x.classList.remove("active"); });
            el.classList.add("active");
            loadOrders();
          }
        });
      });
    }

    await loadOrders();
  }

  global.orders = { render: render };
})(window);
