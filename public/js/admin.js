// admin.js — 家修管家后台管理 SPA
// 依赖：css/01-tokens.css ~ 05-system.css（design tokens + components）
// 后端 API：/api/admin/*
// 设计：AdminClient 类封装所有后台 API 调用（自动带 Authorization header），
//      AdminApp 单例管理 UI/路由/tab 切换。

(function () {
  "use strict";

  // ============ 工具函数 ============
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function formatPrice(cents) {
    if (cents === null || cents === undefined) return "面议";
    return "¥" + (cents / 100).toFixed(0);
  }

  function formatPriceRange(min, max) {
    if (min && max) return formatPrice(min) + "-" + formatPrice(max);
    if (min) return formatPrice(min) + " 起";
    if (max) return "≤" + formatPrice(max);
    return "面议";
  }

  function statusLabel(status) {
    switch (status) {
      case "pending": return { text: "待确认", cls: "badge--warn" };
      case "confirmed": return { text: "已确认", cls: "badge--info" };
      case "done": return { text: "已完成", cls: "badge--ok" };
      case "cancelled": return { text: "已取消", cls: "badge" };
      case "rejected": return { text: "已拒绝", cls: "badge--danger" };
      default: return { text: status, cls: "badge" };
    }
  }

  function masterStatusLabel(status) {
    return status === "active"
      ? { text: "接单中", cls: "badge--ok" }
      : { text: "已暂停", cls: "badge--warn" };
  }

  function categoryLabel(cat) {
    return { repair: "维修", cleaning: "保洁", install: "安装", other: "其他" }[cat] || cat;
  }

  function weekdayLabel(w) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][w];
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  // ============ AdminClient：API 封装 ============
  class AdminClient {
    constructor() {
      this.token = localStorage.getItem("home_repair_admin_token") || "";
      this.account = null;
      try {
        this.account = JSON.parse(localStorage.getItem("home_repair_admin_account") || "null");
      } catch { this.account = null; }
    }

    setAuth(token, account) {
      this.token = token;
      this.account = account;
      localStorage.setItem("home_repair_admin_token", token);
      localStorage.setItem("home_repair_admin_account", JSON.stringify(account));
    }

    clearAuth() {
      this.token = "";
      this.account = null;
      localStorage.removeItem("home_repair_admin_token");
      localStorage.removeItem("home_repair_admin_account");
    }

    isLoggedIn() {
      return !!(this.token && this.account);
    }

    isSuper() {
      return this.account && this.account.role === "super";
    }

    async request(path, options) {
      options = options || {};
      const headers = Object.assign({}, options.headers || {});
      if (this.token) headers["Authorization"] = "Bearer " + this.token;
      const isForm = options.body instanceof FormData;
      if (options.body && !isForm && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      let res;
      try {
        res = await fetch(path, Object.assign({}, options, { headers }));
      } catch (err) {
        const e = new Error("网络错误：" + err.message);
        e.network = true;
        throw e;
      }
      let data = null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try { data = await res.json(); } catch { data = null; }
      }
      if (!res.ok) {
        const msg = (data && data.error) || "HTTP " + res.status;
        const e = new Error(msg);
        e.status = res.status;
        e.data = data;
        throw e;
      }
      return data;
    }

    // ---- Auth ----
    login(username, password) {
      return this.request("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    }

    // ---- Masters ----
    getMasters(opts) {
      opts = opts || {};
      const p = new URLSearchParams();
      if (opts.status) p.set("status", opts.status);
      if (opts.page) p.set("page", opts.page);
      if (opts.limit) p.set("limit", opts.limit);
      return this.request("/api/admin/masters?" + p.toString());
    }

    getMaster(id) {
      return this.request("/api/admin/masters/" + id);
    }

    createMaster(data) {
      return this.request("/api/admin/masters", {
        method: "POST", body: JSON.stringify(data),
      });
    }

    updateMaster(id, data) {
      return this.request("/api/admin/masters/" + id, {
        method: "PUT", body: JSON.stringify(data),
      });
    }

    deleteMaster(id) {
      return this.request("/api/admin/masters/" + id, { method: "DELETE" });
    }

    // ---- Services ----
    getServices(masterId) {
      return this.request("/api/admin/services?masterId=" + masterId);
    }

    createService(data) {
      return this.request("/api/admin/services", {
        method: "POST", body: JSON.stringify(data),
      });
    }

    updateService(id, data) {
      return this.request("/api/admin/services/" + id, {
        method: "PUT", body: JSON.stringify(data),
      });
    }

    deleteService(id) {
      return this.request("/api/admin/services/" + id, { method: "DELETE" });
    }

    // ---- Schedule ----
    getSchedule(masterId) {
      return this.request("/api/admin/schedule?masterId=" + masterId);
    }

    upsertSchedule(data) {
      return this.request("/api/admin/schedule", {
        method: "POST", body: JSON.stringify(data),
      });
    }

    // ---- Bookings ----
    getBookings(opts) {
      opts = opts || {};
      const p = new URLSearchParams();
      if (opts.masterId) p.set("masterId", opts.masterId);
      if (opts.status) p.set("status", opts.status);
      if (opts.date) p.set("date", opts.date);
      if (opts.page) p.set("page", opts.page);
      if (opts.limit) p.set("limit", opts.limit);
      return this.request("/api/admin/bookings?" + p.toString());
    }

    updateBookingStatus(id, action) {
      return this.request("/api/admin/bookings/" + id, {
        method: "POST", body: JSON.stringify({ action }),
      });
    }

    // ---- Reviews ----
    getReviews(masterId) {
      const p = new URLSearchParams();
      if (masterId) p.set("masterId", masterId);
      return this.request("/api/admin/reviews?" + p.toString());
    }

    toggleReviewHide(id) {
      return this.request("/api/admin/reviews/" + id + "/hide", { method: "POST" });
    }

    // ---- Upload ----
    upload(formData) {
      return this.request("/api/admin/upload", {
        method: "POST", body: formData,
      });
    }
  }

  // ============ AdminApp：UI 主控 ============
  const AdminApp = {
    client: null,
    state: {
      tab: "masters",
      masters: [],
      currentMasterId: null,
      currentMaster: null, // for schedule/services sub-context
      filter: { status: "", masterId: "", date: "" },
    },

    async init() {
      this.client = new AdminClient();

      // 顶栏事件
      qs("#btn-home").addEventListener("click", () => {
        window.location.href = "/";
      });
      qs("#btn-logout").addEventListener("click", () => this.logout());

      // 登录表单
      qs("#login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        this.onLoginSubmit();
      });

      // tab 切换
      qsa("#admin-seg .seg__item").forEach((el) => {
        el.addEventListener("click", () => this.switchTab(el.dataset.tab));
      });

      // 模态层点击关闭
      qs("#overlay").addEventListener("click", (e) => {
        if (e.target.id === "overlay") this.closeModal();
      });

      // 首次渲染
      if (this.client.isLoggedIn()) {
        this.showMain();
      } else {
        this.showLogin();
      }
    },

    // ============ 登录/登出 ============
    showLogin() {
      qs("#admin-login").hidden = false;
      qs("#admin-main").hidden = true;
      qs("#admin-account").hidden = true;
      qs("#login-username").focus();
    },

    showMain() {
      qs("#admin-login").hidden = true;
      qs("#admin-main").hidden = false;
      qs("#admin-account").hidden = false;

      const acc = this.client.account || {};
      qs("#admin-account-name").textContent = acc.username || "";
      const roleEl = qs("#admin-account-role");
      roleEl.textContent = acc.role === "super" ? "超级管理员" : "师傅";
      roleEl.className = "badge " + (acc.role === "super" ? "badge--accent" : "badge--info");

      // master 角色隐藏部分 tab
      const tabs = qsa("#admin-seg .seg__item");
      tabs.forEach((t) => {
        if (!this.client.isSuper()) {
          // 师傅角色只能看自己师傅的：服务/排班/订单/评价（不可创建/删除师傅）
          if (t.dataset.tab === "masters") {
            t.style.display = "none";
          } else {
            t.style.display = "";
          }
        } else {
          t.style.display = "";
        }
      });

      // 默认 tab
      const defaultTab = this.client.isSuper() ? "masters" : "bookings";
      this.switchTab(defaultTab);
    },

    async onLoginSubmit() {
      const username = qs("#login-username").value.trim();
      const password = qs("#login-password").value;
      if (!username || !password) {
        this.toast("账号和密码必填");
        return;
      }
      const btn = qs("#login-form button[type=submit]");
      btn.disabled = true;
      btn.textContent = "登录中…";
      try {
        const data = await this.client.login(username, password);
        this.client.setAuth(data.token, data.account);
        this.toast("登录成功");
        this.showMain();
      } catch (err) {
        this.toast(err.message || "登录失败");
      } finally {
        btn.disabled = false;
        btn.textContent = "登录";
      }
    },

    logout() {
      this.client.clearAuth();
      this.state.masters = [];
      this.state.currentMasterId = null;
      this.state.currentMaster = null;
      this.showLogin();
      this.toast("已登出");
    },

    // ============ 401 处理 ============
    handleApiError(err) {
      if (err && err.status === 401) {
        this.client.clearAuth();
        this.showLogin();
        this.toast("登录已过期，请重新登录");
        return true;
      }
      return false;
    },

    // ============ tab 切换 ============
    switchTab(tab) {
      this.state.tab = tab;
      qsa("#admin-seg .seg__item").forEach((el) => {
        el.classList.toggle("active", el.dataset.tab === tab);
      });
      const content = qs("#admin-content");
      content.innerHTML = '<div class="empty">加载中…</div>';
      try {
        if (tab === "masters") this.renderMasters();
        else if (tab === "services") this.renderServices();
        else if (tab === "schedule") this.renderSchedule();
        else if (tab === "bookings") this.renderBookings();
        else if (tab === "reviews") this.renderReviews();
      } catch (err) {
        content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
      }
    },

    // ============ 加载师傅列表（多 tab 共用）============
    async loadMasters(force) {
      if (this.state.masters.length && !force) return this.state.masters;
      const data = await this.client.getMasters({ limit: 100 });
      this.state.masters = data.masters || [];
      return this.state.masters;
    },

    // ============ tab：师傅管理 ============
    async renderMasters() {
      const content = qs("#admin-content");
      const isSuper = this.client.isSuper();
      try {
        const data = await this.client.getMasters({ limit: 100 });
        this.state.masters = data.masters || [];
        const list = this.state.masters;

        let html = `
          <div class="admin__head">
            <h2>师傅管理 (${list.length})</h2>
            ${isSuper ? '<button class="btn btn--primary btn--sm" id="btn-new-master">+ 新增师傅</button>' : ""}
          </div>
          <div class="admin__toolbar">
            <div class="field">
              <select class="field__input" id="filter-master-status">
                <option value="">全部状态</option>
                <option value="active">接单中</option>
                <option value="paused">已暂停</option>
              </select>
            </div>
          </div>
        `;
        if (!list.length) {
          html += '<div class="empty">暂无师傅，点击「新增师傅」创建</div>';
        } else {
          html += `
            <div class="admin__table-wrap">
              <table class="admin__table">
                <thead>
                  <tr>
                    <th>排序</th>
                    <th>头像</th>
                    <th>姓名/Code</th>
                    <th>城市/区域</th>
                    <th>电话</th>
                    <th>价格区间</th>
                    <th>评分</th>
                    <th>标签</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.map((m) => {
                    const st = masterStatusLabel(m.status);
                    return `
                    <tr data-id="${m.id}">
                      <td>${m.sort_order}</td>
                      <td>${m.avatarUrl
                        ? `<img src="${escapeAttr(m.avatarUrl)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
                        : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:600">${escapeHtml((m.name || "?").slice(0, 1))}</div>`}
                      </td>
                      <td>
                        <div style="font-weight:600">${escapeHtml(m.name)}</div>
                        <div class="t-muted" style="font-size:12px">${escapeHtml(m.code)}</div>
                      </td>
                      <td>${escapeHtml(m.city || "")}<br><span class="t-muted">${escapeHtml(m.district || "")}</span></td>
                      <td class="mono">${escapeHtml(m.phone || "")}</td>
                      <td>${escapeHtml(formatPriceRange(m.price_min_cents, m.price_max_cents))}</td>
                      <td>${m.rating_count > 0
                        ? `<span class="t-warn">★ ${m.rating_avg.toFixed(1)}</span> <span class="t-muted">(${m.rating_count})</span>`
                        : '<span class="t-muted">—</span>'}</td>
                      <td>${(m.tags || []).map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join(" ") || '<span class="t-muted">—</span>'}</td>
                      <td><span class="badge ${st.cls}">${st.text}</span></td>
                      <td class="admin__row-actions">
                        <button class="btn btn--sm btn--ghost" data-act="edit">编辑</button>
                        ${isSuper ? `<button class="btn btn--sm btn--ghost" data-act="upload">图片</button>
                        <button class="btn btn--sm btn--danger" data-act="delete">删除</button>` : ""}
                      </td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `;
        }
        content.innerHTML = html;

        // 绑定事件
        if (isSuper) {
          const btnNew = qs("#btn-new-master");
          if (btnNew) btnNew.addEventListener("click", () => this.openMasterModal(null));
        }
        const filterStatus = qs("#filter-master-status");
        if (filterStatus) {
          filterStatus.value = this.state.filter.status || "";
          filterStatus.addEventListener("change", async () => {
            this.state.filter.status = filterStatus.value;
            const data = await this.client.getMasters({ status: filterStatus.value, limit: 100 });
            this.state.masters = data.masters || [];
            this.renderMasters();
          });
        }
        qsa("tr[data-id]", content).forEach((tr) => {
          const id = parseInt(tr.dataset.id, 10);
          qsa("button[data-act]", tr).forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              e.stopPropagation();
              const act = btn.dataset.act;
              if (act === "edit") this.openMasterModal(id);
              else if (act === "upload") this.openUploadModal(id);
              else if (act === "delete") this.confirmDeleteMaster(id);
            });
          });
        });
      } catch (err) {
        if (!this.handleApiError(err)) {
          content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
        }
      }
    },

    async openMasterModal(id) {
      let master = null;
      let tags = [];
      if (id) {
        try {
          const data = await this.client.getMaster(id);
          master = data.master;
          tags = data.tags || [];
        } catch (err) {
          if (!this.handleApiError(err)) this.toast("加载失败：" + err.message);
          return;
        }
      }
      const isEdit = !!master;
      const m = master || {};
      const html = `
        <div class="modal__head">
          <div class="modal__title">${isEdit ? "编辑师傅" : "新增师傅"}</div>
          <button class="modal__close" id="modal-close" aria-label="关闭">×</button>
        </div>
        <form class="admin__modal-form" id="master-form">
          <div class="field">
            <label class="field__label">Code <span class="req">*</span></label>
            <input class="field__input" name="code" required
              value="${escapeAttr(m.code || "")}"
              ${isEdit ? "readonly" : ""}
              placeholder="字母数字/下划线/短横线，如 zhang-plumber">
          </div>
          <div class="field">
            <label class="field__label">姓名 <span class="req">*</span></label>
            <input class="field__input" name="name" required maxlength="30"
              value="${escapeAttr(m.name || "")}" placeholder="师傅姓名">
          </div>
          <div class="field">
            <label class="field__label">简介</label>
            <textarea class="field__textarea" name="bio" maxlength="500" placeholder="师傅简介">${escapeHtml(m.bio || "")}</textarea>
          </div>
          <div class="field">
            <label class="field__label">电话</label>
            <input class="field__input" name="phone" value="${escapeAttr(m.phone || "")}" placeholder="联系电话">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">城市</label>
              <input class="field__input" name="city" value="${escapeAttr(m.city || "上海")}" placeholder="城市">
            </div>
            <div class="field">
              <label class="field__label">区域</label>
              <input class="field__input" name="district" value="${escapeAttr(m.district || "")}" placeholder="区域">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">最低价（分）</label>
              <input class="field__input" name="priceMinCents" type="number" min="0" step="100"
                value="${m.price_min_cents !== null && m.price_min_cents !== undefined ? m.price_min_cents : ""}" placeholder="如 8000 = ¥80">
            </div>
            <div class="field">
              <label class="field__label">最高价（分）</label>
              <input class="field__input" name="priceMaxCents" type="number" min="0" step="100"
                value="${m.price_max_cents !== null && m.price_max_cents !== undefined ? m.price_max_cents : ""}" placeholder="如 30000 = ¥300">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">状态</label>
              <select class="field__input" name="status">
                <option value="active" ${m.status === "active" ? "selected" : ""}>接单中</option>
                <option value="paused" ${m.status === "paused" ? "selected" : ""}>已暂停</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label">排序</label>
              <input class="field__input" name="sortOrder" type="number" value="${m.sort_order !== undefined ? m.sort_order : 0}">
            </div>
          </div>
          <div class="field">
            <label class="field__label">技能标签（逗号分隔）</label>
            <input class="field__input" name="tags" value="${escapeAttr(tags.join(", "))}" placeholder="如 水电维修, 家电维修">
          </div>
          <div class="admin__modal-actions">
            <button type="button" class="btn btn--ghost" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "保存" : "创建"}</button>
          </div>
        </form>
      `;
      this.openModal(html);

      qs("#modal-close").addEventListener("click", () => this.closeModal());
      qs("#modal-cancel").addEventListener("click", () => this.closeModal());
      qs("#master-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          code: fd.get("code").trim(),
          name: fd.get("name").trim(),
          bio: fd.get("bio").trim() || null,
          phone: fd.get("phone").trim() || null,
          city: fd.get("city").trim() || "上海",
          district: fd.get("district").trim() || null,
          priceMinCents: fd.get("priceMinCents") === "" ? null : parseInt(fd.get("priceMinCents"), 10),
          priceMaxCents: fd.get("priceMaxCents") === "" ? null : parseInt(fd.get("priceMaxCents"), 10),
          status: fd.get("status"),
          sortOrder: parseInt(fd.get("sortOrder"), 10) || 0,
          tags: String(fd.get("tags")).split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        };
        const submitBtn = qs("#master-form button[type=submit]");
        submitBtn.disabled = true;
        submitBtn.textContent = "提交中…";
        try {
          if (isEdit) {
            await this.client.updateMaster(id, payload);
            this.toast("已更新");
          } else {
            await this.client.createMaster(payload);
            this.toast("已创建");
          }
          this.closeModal();
          this.renderMasters();
        } catch (err) {
          if (!this.handleApiError(err)) {
            this.toast(err.message || "操作失败");
          }
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? "保存" : "创建";
        }
      });
    },

    async confirmDeleteMaster(id) {
      const m = this.state.masters.find((x) => x.id === id);
      const name = m ? m.name : "#" + id;
      const html = `
        <div class="modal__head">
          <div class="modal__title">删除师傅</div>
          <button class="modal__close" id="modal-close" aria-label="关闭">×</button>
        </div>
        <div class="modal__body">
          确认删除师傅 <b>${escapeHtml(name)}</b> 吗？<br>
          <span class="t-danger">该操作将级联删除该师傅的所有服务、排班、订单和评价，且不可恢复。</span>
        </div>
        <div class="admin__modal-actions">
          <button type="button" class="btn btn--ghost" id="modal-cancel">取消</button>
          <button type="button" class="btn btn--danger" id="modal-confirm">确认删除</button>
        </div>
      `;
      this.openModal(html);
      qs("#modal-close").addEventListener("click", () => this.closeModal());
      qs("#modal-cancel").addEventListener("click", () => this.closeModal());
      qs("#modal-confirm").addEventListener("click", async () => {
        const btn = qs("#modal-confirm");
        btn.disabled = true;
        btn.textContent = "删除中…";
        try {
          await this.client.deleteMaster(id);
          this.toast("已删除");
          this.closeModal();
          this.renderMasters();
        } catch (err) {
          if (!this.handleApiError(err)) this.toast(err.message || "删除失败");
          btn.disabled = false;
          btn.textContent = "确认删除";
        }
      });
    },

    // ============ tab：服务管理 ============
    async renderServices() {
      const content = qs("#admin-content");
      const isSuper = this.client.isSuper();
      // master 角色限定自己的 masterId
      let masterId = this.state.currentMasterId;
      if (!isSuper) {
        masterId = this.client.account && this.client.account.masterId;
      }

      try {
        // 先加载师傅列表（用于选择）
        let masters = this.state.masters;
        if (isSuper && !masters.length) {
          await this.loadMasters();
          masters = this.state.masters;
        }
        if (isSuper && !masterId && masters.length) {
          masterId = masters[0].id;
          this.state.currentMasterId = masterId;
        }
        if (!masterId) {
          content.innerHTML = '<div class="empty">请先创建师傅</div>';
          return;
        }

        const data = await this.client.getServices(masterId);
        const services = data.services || [];
        const master = data.master || masters.find((m) => m.id === masterId) || {};

        let html = `
          <div class="admin__head">
            <h2>服务管理</h2>
            <button class="btn btn--primary btn--sm" id="btn-new-service">+ 新增服务</button>
          </div>
          <div class="admin__master-pick">
            <label>选择师傅</label>
            <select id="pick-master-svc" ${!isSuper ? "disabled" : ""}>
              ${(isSuper ? masters : [master]).map((m) =>
                `<option value="${m.id}" ${m.id === masterId ? "selected" : ""}>${escapeHtml(m.name)} · ${escapeHtml(m.code)}</option>`
              ).join("")}
            </select>
          </div>
        `;
        if (!services.length) {
          html += '<div class="empty">暂无服务，点击「新增服务」创建</div>';
        } else {
          html += `
            <div class="admin__table-wrap">
              <table class="admin__table">
                <thead>
                  <tr>
                    <th>排序</th>
                    <th>服务名</th>
                    <th>分类</th>
                    <th>时长(分)</th>
                    <th>价格</th>
                    <th>启用</th>
                    <th>描述</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${services.map((s) => `
                    <tr data-id="${s.id}">
                      <td>${s.sort_order}</td>
                      <td><b>${escapeHtml(s.name)}</b></td>
                      <td><span class="badge badge--info">${escapeHtml(categoryLabel(s.category))}</span>
                        ${s.subcategory ? `<span class="badge">${escapeHtml(s.subcategory)}</span>` : ""}
                      </td>
                      <td>${s.duration_min}</td>
                      <td>${s.price_cents !== null && s.price_cents !== undefined ? formatPrice(s.price_cents) : '<span class="t-muted">面议</span>'}</td>
                      <td>${s.active
                        ? '<span class="badge badge--ok">启用</span>'
                        : '<span class="badge">停用</span>'}</td>
                      <td><span class="t-muted">${escapeHtml(s.description || "")}</span></td>
                      <td class="admin__row-actions">
                        <button class="btn btn--sm btn--ghost" data-act="edit">编辑</button>
                        <button class="btn btn--sm btn--danger" data-act="delete">删除</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `;
        }
        content.innerHTML = html;

        qs("#btn-new-service").addEventListener("click", () => this.openServiceModal(null, masterId));
        const pick = qs("#pick-master-svc");
        if (pick) {
          pick.addEventListener("change", () => {
            this.state.currentMasterId = parseInt(pick.value, 10);
            this.renderServices();
          });
        }
        qsa("tr[data-id]", content).forEach((tr) => {
          const id = parseInt(tr.dataset.id, 10);
          qsa("button[data-act]", tr).forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const act = btn.dataset.act;
              if (act === "edit") this.openServiceModal(id, masterId);
              else if (act === "delete") this.confirmDeleteService(id);
            });
          });
        });
      } catch (err) {
        if (!this.handleApiError(err)) {
          content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
        }
      }
    },

    async openServiceModal(id, masterId) {
      let svc = null;
      if (id) {
        try {
          const data = await this.client.getServices(masterId);
          svc = (data.services || []).find((s) => s.id === id);
        } catch (err) {
          if (!this.handleApiError(err)) this.toast("加载失败：" + err.message);
          return;
        }
      }
      const isEdit = !!svc;
      const s = svc || {};
      const html = `
        <div class="modal__head">
          <div class="modal__title">${isEdit ? "编辑服务" : "新增服务"}</div>
          <button class="modal__close" id="modal-close" aria-label="关闭">×</button>
        </div>
        <form class="admin__modal-form" id="service-form">
          <div class="field">
            <label class="field__label">服务名 <span class="req">*</span></label>
            <input class="field__input" name="name" required maxlength="60"
              value="${escapeAttr(s.name || "")}" placeholder="如 水龙头维修/更换">
          </div>
          <div class="field">
            <label class="field__label">描述</label>
            <textarea class="field__textarea" name="description" maxlength="300" placeholder="服务描述">${escapeHtml(s.description || "")}</textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">时长（分钟）<span class="req">*</span></label>
              <input class="field__input" name="durationMin" type="number" required min="1" step="1"
                value="${s.duration_min || 60}">
            </div>
            <div class="field">
              <label class="field__label">价格（分）</label>
              <input class="field__input" name="priceCents" type="number" min="0" step="100"
                value="${s.price_cents !== null && s.price_cents !== undefined ? s.price_cents : ""}" placeholder="留空=面议">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">分类 <span class="req">*</span></label>
              <select class="field__input" name="category">
                <option value="repair" ${s.category === "repair" ? "selected" : ""}>维修</option>
                <option value="cleaning" ${s.category === "cleaning" ? "selected" : ""}>保洁</option>
                <option value="install" ${s.category === "install" ? "selected" : ""}>安装</option>
                <option value="other" ${s.category === "other" ? "selected" : ""}>其他</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label">子分类</label>
              <input class="field__input" name="subcategory" value="${escapeAttr(s.subcategory || "")}" placeholder="如 water / daily">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label class="field__label">排序</label>
              <input class="field__input" name="sortOrder" type="number" value="${s.sort_order !== undefined ? s.sort_order : 0}">
            </div>
            <div class="field">
              <label class="field__label">启用</label>
              <select class="field__input" name="active">
                <option value="1" ${s.active === 1 || s.active === undefined ? "selected" : ""}>启用</option>
                <option value="0" ${s.active === 0 ? "selected" : ""}>停用</option>
              </select>
            </div>
          </div>
          <div class="admin__modal-actions">
            <button type="button" class="btn btn--ghost" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "保存" : "创建"}</button>
          </div>
        </form>
      `;
      this.openModal(html);

      qs("#modal-close").addEventListener("click", () => this.closeModal());
      qs("#modal-cancel").addEventListener("click", () => this.closeModal());
      qs("#service-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          masterId: masterId,
          name: fd.get("name").trim(),
          description: fd.get("description").trim() || null,
          durationMin: parseInt(fd.get("durationMin"), 10),
          priceCents: fd.get("priceCents") === "" ? null : parseInt(fd.get("priceCents"), 10),
          category: fd.get("category"),
          subcategory: fd.get("subcategory").trim() || null,
          sortOrder: parseInt(fd.get("sortOrder"), 10) || 0,
          active: parseInt(fd.get("active"), 10) === 1,
        };
        const submitBtn = qs("#service-form button[type=submit]");
        submitBtn.disabled = true;
        submitBtn.textContent = "提交中…";
        try {
          if (isEdit) {
            await this.client.updateService(id, payload);
            this.toast("已更新");
          } else {
            await this.client.createService(payload);
            this.toast("已创建");
          }
          this.closeModal();
          this.renderServices();
        } catch (err) {
          if (!this.handleApiError(err)) this.toast(err.message || "操作失败");
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? "保存" : "创建";
        }
      });
    },

    async confirmDeleteService(id) {
      const html = `
        <div class="modal__head">
          <div class="modal__title">删除服务</div>
          <button class="modal__close" id="modal-close" aria-label="关闭">×</button>
        </div>
        <div class="modal__body">
          确认删除该服务吗？关联的历史订单也会被一并删除。
        </div>
        <div class="admin__modal-actions">
          <button type="button" class="btn btn--ghost" id="modal-cancel">取消</button>
          <button type="button" class="btn btn--danger" id="modal-confirm">确认删除</button>
        </div>
      `;
      this.openModal(html);
      qs("#modal-close").addEventListener("click", () => this.closeModal());
      qs("#modal-cancel").addEventListener("click", () => this.closeModal());
      qs("#modal-confirm").addEventListener("click", async () => {
        const btn = qs("#modal-confirm");
        btn.disabled = true;
        btn.textContent = "删除中…";
        try {
          await this.client.deleteService(id);
          this.toast("已删除");
          this.closeModal();
          this.renderServices();
        } catch (err) {
          if (!this.handleApiError(err)) this.toast(err.message || "删除失败");
          btn.disabled = false;
          btn.textContent = "确认删除";
        }
      });
    },

    // ============ tab：排班管理 ============
    async renderSchedule() {
      const content = qs("#admin-content");
      const isSuper = this.client.isSuper();
      let masterId = this.state.currentMasterId;
      if (!isSuper) {
        masterId = this.client.account && this.client.account.masterId;
      }
      try {
        let masters = this.state.masters;
        if (isSuper && !masters.length) {
          await this.loadMasters();
          masters = this.state.masters;
        }
        if (isSuper && !masterId && masters.length) {
          masterId = masters[0].id;
          this.state.currentMasterId = masterId;
        }
        if (!masterId) {
          content.innerHTML = '<div class="empty">请先创建师傅</div>';
          return;
        }

        const data = await this.client.getSchedule(masterId);
        const schedule = data.schedule || [];
        const master = data.master || {};

        let html = `
          <div class="admin__head">
            <h2>排班管理</h2>
          </div>
          <div class="admin__master-pick">
            <label>选择师傅</label>
            <select id="pick-master-sch" ${!isSuper ? "disabled" : ""}>
              ${(isSuper ? masters : [master]).map((m) =>
                `<option value="${m.id}" ${m.id === masterId ? "selected" : ""}>${escapeHtml(m.name)} · ${escapeHtml(m.code)}</option>`
              ).join("")}
            </select>
          </div>
          <div class="admin__schedule-grid" id="schedule-grid">
            ${schedule.map((s) => this.scheduleDayCard(masterId, s)).join("")}
          </div>
        `;
        content.innerHTML = html;

        const pick = qs("#pick-master-sch");
        if (pick) {
          pick.addEventListener("change", () => {
            this.state.currentMasterId = parseInt(pick.value, 10);
            this.renderSchedule();
          });
        }
        // 每天的开关 + 保存按钮
        qsa(".admin__schedule-day", content).forEach((card) => {
          const weekday = parseInt(card.dataset.weekday, 10);
          const activeSelect = qs('select[name="active"]', card);
          const inputs = qsa("input, select", card);
          // 切换 active 联动 disabled
          const syncDisabled = () => {
            const active = activeSelect.value === "1";
            inputs.forEach((i) => {
              if (i.name !== "active") i.disabled = !active;
            });
            card.classList.toggle("is-off", !active);
          };
          activeSelect.addEventListener("change", syncDisabled);
          syncDisabled();

          qs("button.sch-save", card).addEventListener("click", async () => {
            const payload = {
              masterId,
              weekday,
              opensAt: qs('input[name="opensAt"]', card).value,
              closesAt: qs('input[name="closesAt"]', card).value,
              slotMinutes: parseInt(qs('select[name="slotMinutes"]', card).value, 10),
              capacity: parseInt(qs('select[name="capacity"]', card).value, 10),
              active: parseInt(activeSelect.value, 10) === 1,
            };
            const btn = qs("button.sch-save", card);
            btn.disabled = true;
            btn.textContent = "保存中…";
            try {
              await this.client.upsertSchedule(payload);
              this.toast(weekdayLabel(weekday) + " 已保存");
            } catch (err) {
              if (!this.handleApiError(err)) this.toast(err.message || "保存失败");
            } finally {
              btn.disabled = false;
              btn.textContent = "保存";
            }
          });
        });
      } catch (err) {
        if (!this.handleApiError(err)) {
          content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
        }
      }
    },

    scheduleDayCard(masterId, s) {
      const active = s.active === 1 || s.active === true;
      const opens = s.opens_at || "09:00";
      const closes = s.closes_at || "18:00";
      const slot = s.slot_minutes || 60;
      const cap = s.capacity || 1;
      return `
        <div class="admin__schedule-day ${active ? "" : "is-off"}" data-weekday="${s.weekday}">
          <div class="admin__schedule-day-head">
            <div class="admin__schedule-day-name">${weekdayLabel(s.weekday)}</div>
            <select name="active" class="field__input" style="width:auto;padding:2px 8px">
              <option value="1" ${active ? "selected" : ""}>营业</option>
              <option value="0" ${!active ? "selected" : ""}>休息</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label">开门时间</label>
            <input class="field__input" type="time" name="opensAt" value="${escapeAttr(opens)}" required>
          </div>
          <div class="field">
            <label class="field__label">关门时间</label>
            <input class="field__input" type="time" name="closesAt" value="${escapeAttr(closes)}" required>
          </div>
          <div class="field">
            <label class="field__label">每段时间（分钟）</label>
            <select class="field__input" name="slotMinutes">
              ${[30, 60, 90, 120].map((v) => `<option value="${v}" ${v === slot ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label class="field__label">同时容量（1-5）</label>
            <select class="field__input" name="capacity">
              ${[1, 2, 3, 4, 5].map((v) => `<option value="${v}" ${v === cap ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </div>
          <button type="button" class="btn btn--primary btn--block btn--sm sch-save">保存</button>
        </div>
      `;
    },

    // ============ tab：订单管理 ============
    async renderBookings() {
      const content = qs("#admin-content");
      const isSuper = this.client.isSuper();
      let masterId = this.state.filter.masterId;
      if (!isSuper) {
        masterId = this.client.account && this.client.account.masterId;
      }
      try {
        let masters = this.state.masters;
        if (isSuper && !masters.length) {
          await this.loadMasters();
          masters = this.state.masters;
        }

        const opts = { limit: 100 };
        if (masterId) opts.masterId = masterId;
        if (this.state.filter.status) opts.status = this.state.filter.status;
        if (this.state.filter.date) opts.date = this.state.filter.date;
        const data = await this.client.getBookings(opts);
        const bookings = data.bookings || [];
        const stats = data.todayStats || {};

        let html = `
          <div class="admin__head">
            <h2>订单管理</h2>
          </div>
        `;
        // 今日统计
        html += `
          <div class="admin__stats">
            <div class="admin__stat"><div class="admin__stat-label">今日预约</div><div class="admin__stat-value">${stats.total || 0}</div></div>
            <div class="admin__stat"><div class="admin__stat-label">待确认</div><div class="admin__stat-value t-warn">${stats.pending || 0}</div></div>
            <div class="admin__stat"><div class="admin__stat-label">已确认</div><div class="admin__stat-value t-info">${stats.confirmed || 0}</div></div>
            <div class="admin__stat"><div class="admin__stat-label">已完成</div><div class="admin__stat-value t-ok">${stats.done || 0}</div></div>
            <div class="admin__stat"><div class="admin__stat-label">已取消</div><div class="admin__stat-value">${stats.cancelled || 0}</div></div>
            <div class="admin__stat"><div class="admin__stat-label">已拒绝</div><div class="admin__stat-value t-danger">${stats.rejected || 0}</div></div>
          </div>
          <div class="admin__toolbar">
            ${isSuper ? `
            <div class="field">
              <select class="field__input" id="filter-booking-master">
                <option value="">全部师傅</option>
                ${masters.map((m) => `<option value="${m.id}" ${parseInt(masterId, 10) === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`).join("")}
              </select>
            </div>` : ""}
            <div class="field">
              <select class="field__input" id="filter-booking-status">
                <option value="">全部状态</option>
                <option value="pending" ${this.state.filter.status === "pending" ? "selected" : ""}>待确认</option>
                <option value="confirmed" ${this.state.filter.status === "confirmed" ? "selected" : ""}>已确认</option>
                <option value="done" ${this.state.filter.status === "done" ? "selected" : ""}>已完成</option>
                <option value="cancelled" ${this.state.filter.status === "cancelled" ? "selected" : ""}>已取消</option>
                <option value="rejected" ${this.state.filter.status === "rejected" ? "selected" : ""}>已拒绝</option>
              </select>
            </div>
            <div class="field">
              <input class="field__input" type="date" id="filter-booking-date" value="${escapeAttr(this.state.filter.date || "")}">
            </div>
            <button class="btn btn--ghost btn--sm" id="filter-clear">重置</button>
          </div>
        `;
        if (!bookings.length) {
          html += '<div class="empty">暂无订单</div>';
        } else {
          html += `
            <div class="admin__table-wrap">
              <table class="admin__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>师傅</th>
                    <th>服务</th>
                    <th>客户</th>
                    <th>电话</th>
                    <th>地址</th>
                    <th>预约时间</th>
                    <th>时长</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${bookings.map((b) => {
                    const st = statusLabel(b.status);
                    const isFinal = ["cancelled", "rejected", "done"].includes(b.status);
                    return `
                    <tr data-id="${b.id}">
                      <td>${b.id}</td>
                      <td>${escapeHtml(b.master_name || "")}<br><span class="t-muted">${escapeHtml(b.master_code || "")}</span></td>
                      <td><b>${escapeHtml(b.service_name || "")}</b><br><span class="t-muted">${escapeHtml(categoryLabel(b.category))}</span></td>
                      <td>${escapeHtml(b.customer_name)}</td>
                      <td class="mono">${escapeHtml(b.customer_phone)}</td>
                      <td><span class="t-muted">${escapeHtml(b.customer_address || "")}</span></td>
                      <td>${escapeHtml(b.scheduled_at)}</td>
                      <td>${b.duration_min}分</td>
                      <td><span class="badge ${st.cls}">${st.text}</span></td>
                      <td class="admin__row-actions">
                        ${b.status === "pending" ? `
                          <button class="btn btn--sm btn--soft" data-act="confirmed">确认</button>
                          <button class="btn btn--sm btn--danger" data-act="rejected">拒绝</button>
                        ` : ""}
                        ${b.status === "confirmed" ? `
                          <button class="btn btn--sm btn--soft" data-act="done">完成</button>
                          <button class="btn btn--sm btn--ghost" data-act="cancelled">取消</button>
                        ` : ""}
                        ${isFinal ? '<span class="t-muted">—</span>' : ""}
                      </td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `;
        }
        content.innerHTML = html;

        // 绑定筛选
        const fMaster = qs("#filter-booking-master");
        if (fMaster) {
          fMaster.addEventListener("change", () => {
            this.state.filter.masterId = fMaster.value;
            this.renderBookings();
          });
        }
        const fStatus = qs("#filter-booking-status");
        if (fStatus) {
          fStatus.addEventListener("change", () => {
            this.state.filter.status = fStatus.value;
            this.renderBookings();
          });
        }
        const fDate = qs("#filter-booking-date");
        if (fDate) {
          fDate.addEventListener("change", () => {
            this.state.filter.date = fDate.value;
            this.renderBookings();
          });
        }
        const fClear = qs("#filter-clear");
        if (fClear) {
          fClear.addEventListener("click", () => {
            this.state.filter = { status: "", masterId: "", date: "" };
            this.renderBookings();
          });
        }
        // 绑定操作
        qsa("tr[data-id]", content).forEach((tr) => {
          const id = parseInt(tr.dataset.id, 10);
          qsa("button[data-act]", tr).forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              e.stopPropagation();
              const action = btn.dataset.act;
              btn.disabled = true;
              const oldText = btn.textContent;
              btn.textContent = "处理中…";
              try {
                await this.client.updateBookingStatus(id, action);
                this.toast("已" + ({ confirmed: "确认", rejected: "拒绝", done: "完成", cancelled: "取消" }[action] || action));
                this.renderBookings();
              } catch (err) {
                if (!this.handleApiError(err)) this.toast(err.message || "操作失败");
                btn.disabled = false;
                btn.textContent = oldText;
              }
            });
          });
        });
      } catch (err) {
        if (!this.handleApiError(err)) {
          content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
        }
      }
    },

    // ============ tab：评价管理 ============
    async renderReviews() {
      const content = qs("#admin-content");
      const isSuper = this.client.isSuper();
      let masterId = this.state.currentMasterId;
      if (!isSuper) {
        masterId = this.client.account && this.client.account.masterId;
      }
      try {
        let masters = this.state.masters;
        if (isSuper && !masters.length) {
          await this.loadMasters();
          masters = this.state.masters;
        }

        const data = await this.client.getReviews(isSuper ? (masterId || "") : masterId);
        const reviews = data.reviews || [];

        let html = `
          <div class="admin__head">
            <h2>评价管理</h2>
          </div>
          <div class="admin__master-pick">
            <label>筛选师傅</label>
            <select id="pick-master-rev">
              <option value="">全部师傅</option>
              ${masters.map((m) =>
                `<option value="${m.id}" ${parseInt(masterId, 10) === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`
              ).join("")}
            </select>
          </div>
        `;
        if (!reviews.length) {
          html += '<div class="empty">暂无评价</div>';
        } else {
          html += `
            <div class="admin__table-wrap">
              <table class="admin__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>师傅</th>
                    <th>服务</th>
                    <th>客户</th>
                    <th>评分</th>
                    <th>内容</th>
                    <th>预约时间</th>
                    <th>评价时间</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${reviews.map((r) => `
                    <tr data-id="${r.id}">
                      <td>${r.id}</td>
                      <td>${escapeHtml(r.master_name || "")}</td>
                      <td><span class="t-muted">${escapeHtml(r.service_name || "")}</span></td>
                      <td>${escapeHtml(r.customer_name)}</td>
                      <td><span class="t-warn">★ ${r.rating}</span></td>
                      <td style="max-width:280px"><span class="t-2">${escapeHtml(r.content || "")}</span></td>
                      <td class="t-muted">${escapeHtml(r.booking_scheduled_at || "")}</td>
                      <td class="t-muted">${escapeHtml(r.created_at || "")}</td>
                      <td>${r.hidden
                        ? '<span class="badge badge--danger">已隐藏</span>'
                        : '<span class="badge badge--ok">显示中</span>'}</td>
                      <td>
                        <button class="btn btn--sm ${r.hidden ? "btn--soft" : "btn--ghost"}" data-act="toggle">
                          ${r.hidden ? "显示" : "隐藏"}
                        </button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `;
        }
        content.innerHTML = html;

        const pick = qs("#pick-master-rev");
        if (pick) {
          pick.addEventListener("change", () => {
            this.state.currentMasterId = pick.value ? parseInt(pick.value, 10) : null;
            this.renderReviews();
          });
        }
        qsa("tr[data-id]", content).forEach((tr) => {
          const id = parseInt(tr.dataset.id, 10);
          qsa("button[data-act]", tr).forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              e.stopPropagation();
              btn.disabled = true;
              try {
                const r = await this.client.toggleReviewHide(id);
                this.toast(r.message || "已处理");
                this.renderReviews();
              } catch (err) {
                if (!this.handleApiError(err)) this.toast(err.message || "操作失败");
                btn.disabled = false;
              }
            });
          });
        });
      } catch (err) {
        if (!this.handleApiError(err)) {
          content.innerHTML = '<div class="empty t-danger">加载失败：' + escapeHtml(err.message) + "</div>";
        }
      }
    },

    // ============ 上传图片模态 ============
    async openUploadModal(masterId) {
      const m = this.state.masters.find((x) => x.id === masterId);
      const name = m ? m.name : "#" + masterId;
      const html = `
        <div class="modal__head">
          <div class="modal__title">上传图片 — ${escapeHtml(name)}</div>
          <button class="modal__close" id="modal-close" aria-label="关闭">×</button>
        </div>
        <form class="admin__modal-form" id="upload-form">
          <div class="field">
            <label class="field__label">类型 <span class="req">*</span></label>
            <select class="field__input" name="kind" id="upload-kind">
              <option value="avatar">头像</option>
              <option value="cert">证书</option>
            </select>
          </div>
          <div class="field" id="title-field" style="display:none">
            <label class="field__label">证书标题 <span class="req">*</span></label>
            <input class="field__input" name="title" maxlength="100" placeholder="如 高级电工证">
          </div>
          <div class="field">
            <label class="field__label">图片 <span class="req">*</span></label>
            <input class="field__input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
            <div class="field__hint">支持 jpg/png/webp，≤5MB</div>
          </div>
          <div class="admin__modal-actions">
            <button type="button" class="btn btn--ghost" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn--primary">上传</button>
          </div>
        </form>
      `;
      this.openModal(html);

      qs("#modal-close").addEventListener("click", () => this.closeModal());
      qs("#modal-cancel").addEventListener("click", () => this.closeModal());
      qs("#upload-kind").addEventListener("change", (e) => {
        qs("#title-field").style.display = e.target.value === "cert" ? "" : "none";
      });
      qs("#upload-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.append("masterId", masterId);
        const submitBtn = qs("#upload-form button[type=submit]");
        submitBtn.disabled = true;
        submitBtn.textContent = "上传中…";
        try {
          const r = await this.client.upload(fd);
          this.toast("上传成功：" + r.url);
          this.closeModal();
          // 刷新师傅列表（头像可能变化）
          await this.loadMasters(true);
          this.renderMasters();
        } catch (err) {
          if (!this.handleApiError(err)) this.toast(err.message || "上传失败");
          submitBtn.disabled = false;
          submitBtn.textContent = "上传";
        }
      });
    },

    // ============ Modal & Toast ============
    openModal(html) {
      const overlay = qs("#overlay");
      const modal = qs("#modal");
      modal.innerHTML = html;
      overlay.hidden = false;
      // 锁滚动
      document.body.style.overflow = "hidden";
    },

    closeModal() {
      const overlay = qs("#overlay");
      const modal = qs("#modal");
      overlay.hidden = true;
      modal.innerHTML = "";
      document.body.style.overflow = "";
    },

    toast(msg) {
      const t = qs("#toast");
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        t.hidden = true;
      }, 2400);
    },
  };

  // ============ 启动 ============
  function boot() {
    AdminApp.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // 暴露到全局便于调试
  window.AdminApp = AdminApp;
  window.AdminClient = AdminClient;
})();
