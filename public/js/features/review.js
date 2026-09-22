// features/review.js — 评价 modal（5 颗大星 + textarea）
// 路由 #/review/:id 自动弹出 modal；提交成功后跳转订单
(function (global) {
  "use strict";

  let rating = 0;
  let content = "";
  let bookingId = "";
  let submitting = false;

  function renderStars() {
    return Array.from({ length: 5 }, function (_, i) {
      const idx = i + 1;
      return (
        '<div class="review-stars__star' + (idx <= rating ? " active" : "") + '" data-star="' + idx + '" role="button" aria-label="' + idx + '星">' +
          '<span data-icon="' + (idx <= rating ? "star_fill" : "star_outline") + '"></span>' +
        "</div>"
      );
    }).join("");
  }

  function bodyHtml() {
    return (
      '<div style="text-align:center">' +
        '<div style="font-size:14px;color:var(--text-2);margin-bottom:4px">为本次服务评分</div>' +
        '<div class="review-stars" id="review-stars">' + renderStars() + "</div>" +
        '<div id="rating-label" style="font-size:13px;color:var(--text-3);height:18px">' +
          ratingLabel(rating) +
        "</div>" +
      "</div>" +
      '<div class="field" style="margin-top:16px">' +
        '<label class="field__label">详细评价（选填）</label>' +
        '<textarea class="field__textarea" id="review-content" maxlength="300" placeholder="师傅服务怎么样？分享一下你的体验吧…"></textarea>' +
        '<div class="field__hint" id="review-counter">0 / 300</div>' +
      "</div>"
    );
  }

  function ratingLabel(r) {
    const labels = ["", "很不满意", "不满意", "一般", "满意", "非常满意"];
    return labels[r] || "请选择评分";
  }

  function bindEvents(modal) {
    modal.querySelectorAll(".review-stars__star").forEach(function (el) {
      // 点击
      el.addEventListener("click", function () {
        rating = parseInt(el.getAttribute("data-star"), 10);
        modal.querySelector("#review-stars").innerHTML = renderStars();
        modal.querySelector("#rating-label").textContent = ratingLabel(rating);
        bindStars(modal);
        if (icons) icons.render(modal.querySelector("#review-stars"));
      });
      // hover
      el.addEventListener("mouseenter", function () {
        const r = parseInt(el.getAttribute("data-star"), 10);
        modal.querySelectorAll(".review-stars__star").forEach(function (x) {
          const xi = parseInt(x.getAttribute("data-star"), 10);
          if (xi <= r) x.classList.add("active");
          else x.classList.remove("active");
        });
      });
    });
    modal.querySelector("#review-stars").addEventListener("mouseleave", function () {
      modal.querySelectorAll(".review-stars__star").forEach(function (x) {
        const xi = parseInt(x.getAttribute("data-star"), 10);
        if (xi <= rating) x.classList.add("active");
        else x.classList.remove("active");
      });
    });

    const ta = modal.querySelector("#review-content");
    const counter = modal.querySelector("#review-counter");
    if (ta) {
      ta.addEventListener("input", function () {
        content = ta.value;
        if (counter) counter.textContent = (content.length || 0) + " / 300";
      });
    }
  }

  function bindStars(modal) {
    const starsContainer = modal.querySelector("#review-stars");
    if (!starsContainer) return;
    starsContainer.querySelectorAll(".review-stars__star").forEach(function (el) {
      el.addEventListener("click", function () {
        rating = parseInt(el.getAttribute("data-star"), 10);
        starsContainer.innerHTML = renderStars();
        modal.querySelector("#rating-label").textContent = ratingLabel(rating);
        bindStars(modal);
        if (icons) icons.render(starsContainer);
      });
      el.addEventListener("mouseenter", function () {
        const r = parseInt(el.getAttribute("data-star"), 10);
        starsContainer.querySelectorAll(".review-stars__star").forEach(function (x) {
          const xi = parseInt(x.getAttribute("data-star"), 10);
          if (xi <= r) x.classList.add("active");
          else x.classList.remove("active");
        });
      });
    });
    starsContainer.addEventListener("mouseleave", function () {
      starsContainer.querySelectorAll(".review-stars__star").forEach(function (x) {
        const xi = parseInt(x.getAttribute("data-star"), 10);
        if (xi <= rating) x.classList.add("active");
        else x.classList.remove("active");
      });
    });
  }

  async function render(route) {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    bookingId = (route && route.params && route.params.id) || "";
    if (!bookingId) {
      app.innerHTML = '<div class="empty">未指定订单</div>';
      return;
    }
    rating = 0;
    content = "";
    submitting = false;

    // 渲染一个轻量占位页（订单详情）
    app.innerHTML =
      '<div class="card">' +
        '<div style="font-size:15px;font-weight:600;margin-bottom:8px">订单评价</div>' +
        '<div style="color:var(--text-3);font-size:13px">订单号：' + escapeHtml(bookingId) + "</div>" +
        '<div style="margin-top:16px;text-align:center;color:var(--text-3);font-size:13px">请在下方弹窗中完成评价</div>' +
      "</div>";

    if (global.router && global.router.setTitle) global.router.setTitle("评价订单");

    if (!global.modal) {
      app.innerHTML = '<div class="empty">模态组件不可用</div>';
      return;
    }

    // 弹出 modal
    global.modal.show({
      title: "服务评价",
      bodyHtml: bodyHtml(),
      okText: "提交评价",
      cancelText: "取消",
      cancel: true,
      onMount: function (modal) {
        if (icons) icons.render(modal);
        bindEvents(modal);
      },
      onOk: async function (modal) {
        if (submitting) return false;
        if (!rating || rating < 1 || rating > 5) {
          toast("请选择 1-5 星评分");
          return false;
        }
        const phone = store.getPhone();
        if (!phone) {
          toast("请先在「我的」页面填写手机号");
          return false;
        }
        const ta = modal.querySelector("#review-content");
        const txt = ta ? ta.value.trim() : "";
        submitting = true;
        const okBtn = modal.querySelector("#modal-ok");
        if (okBtn) {
          okBtn.disabled = true;
          okBtn.innerHTML = '<span data-icon="refresh"></span>提交中';
          if (icons) icons.render(okBtn);
        }
        try {
          await api.submitReview(bookingId, phone, rating, txt);
          toast("评价成功");
          // 跳回订单
          setTimeout(function () { go("orders", {}, { status: "done" }); }, 200);
          return true;
        } catch (e) {
          toast(e.message || "评价失败");
          if (okBtn) {
            okBtn.disabled = false;
            okBtn.textContent = "提交评价";
          }
          submitting = false;
          return false;
        }
      },
      onCancel: function () {
        // 返回订单页
        setTimeout(function () { go("orders"); }, 100);
      },
    }).then(function (ok) {
      // 如果通过关闭按钮关闭（未提交），跳回订单
      if (!ok) {
        if (global.location.hash.indexOf("#/orders") !== 0) go("orders");
      }
    });
  }

  global.review = { render: render };
})(window);
