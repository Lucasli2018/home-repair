// core/utils.js — 通用工具：$ / $$ / escapeHtml / formatDate / formatPrice / showToast
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 格式化日期：'YYYY-MM-DD HH:MM' → 'MM月DD日 HH:MM'
  function formatDate(s, opts) {
    if (!s) return "";
    opts = opts || {};
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) {
      const month = m[2];
      const day = m[3];
      const hour = m[4];
      const min = m[5];
      if (opts.dateOnly) return `${month}月${day}日`;
      return `${month}月${day}日 ${hour}:${min}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const parts = s.split("-");
      if (opts.dateOnly) return `${parts[1]}月${parts[2]}日`;
      return s;
    }
    return s;
  }

  // 价格分→元
  function formatPrice(cents, opts) {
    opts = opts || {};
    if (cents == null || cents === "") return opts.fallback || "面议";
    const n = parseInt(cents, 10);
    if (isNaN(n)) return opts.fallback || "面议";
    return "¥" + (n / 100).toFixed(opts.decimals || 0);
  }

  // 短日期：返回 weekday 字符串如 "今天"、"明天"、"周三"
  function weekdayShort(dateStr) {
    if (!dateStr) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateStr.replace(/-/g, "/"));
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === 2) return "后天";
    if (diff === -1) return "昨天";
    const wd = target.getDay();
    const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return names[wd];
  }

  // mask 手机号：138****8888
  function maskPhone(phone) {
    if (!phone) return "";
    const s = String(phone);
    if (s.length < 7) return s.slice(0, -2) + "**";
    return s.slice(0, 3) + "****" + s.slice(-4);
  }

  // 转义正则字符
  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 防抖
  function debounce(fn, wait) {
    let t = null;
    return function () {
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  // 节流
  function throttle(fn, wait) {
    let last = 0, timer = null;
    return function () {
      const ctx = this, args = arguments;
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(ctx, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(function () {
          last = Date.now();
          fn.apply(ctx, args);
        }, wait - (now - last));
      }
    };
  }

  // 显示 toast
  let toastTimer = null;
  function showToast(msg, opts) {
    opts = opts || {};
    const el = $("#toast");
    if (!el) {
      // fallback：alert
      try { alert(msg); } catch (e) {}
      return;
    }
    el.textContent = msg;
    el.hidden = false;
    if (opts.duration === 0) return; // 持续显示
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, opts.duration || 1800);
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const el = $("#toast");
    if (el) el.hidden = true;
  }

  // 判断是否手机号
  function isPhone(s) {
    return /^\+?\d{7,20}$/.test(String(s || "").trim());
  }

  // 判断邮箱
  function isEmail(s) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
  }

  // 渲染 loading 占位
  function renderSkeletons(container, count, template) {
    container.innerHTML = "";
    const n = Math.max(1, count || 3);
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.innerHTML = template || '<div class="card"><div class="skeleton" style="height:80px"></div></div>';
      container.appendChild(div.firstChild);
    }
  }

  // 像素安全的高度容器
  function safeAreaTop() {
    return getComputedStyle(document.documentElement).getPropertyValue("--safe-top") || "0px";
  }

  // 拼接 query string
  function qs(obj) {
    if (!obj) return "";
    const parts = [];
    Object.keys(obj).forEach(function (k) {
      if (obj[k] != null && obj[k] !== "") {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  global.$ = $;
  global.$$ = $$;
  global.escapeHtml = escapeHtml;
  global.formatDate = formatDate;
  global.formatPrice = formatPrice;
  global.weekdayShort = weekdayShort;
  global.maskPhone = maskPhone;
  global.escapeRegex = escapeRegex;
  global.debounce = debounce;
  global.throttle = throttle;
  global.showToast = showToast;
  global.toast = showToast; // 别名
  global.hideToast = hideToast;
  global.isPhone = isPhone;
  global.isEmail = isEmail;
  global.renderSkeletons = renderSkeletons;
  global.qs = qs;
})(window);
