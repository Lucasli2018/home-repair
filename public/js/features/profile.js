// features/profile.js — 我的：头像 + 手机号 + 入口列表 + 平台管理入口
(function (global) {
  "use strict";

  function renderHead() {
    const phone = store.getPhone();
    const name = store.getName() || (phone ? phone.slice(-4) + "用户" : "");
    const initial = store.firstChar(name || phone || "?");
    const masked = phone ? maskPhone(phone) : "未绑定手机号";
    return (
      '<div class="profile-head">' +
        '<div class="profile-head__avatar">' + escapeHtml(initial) + "</div>" +
        '<div class="profile-head__info">' +
          '<div class="profile-head__phone">' + escapeHtml(masked) + "</div>" +
          '<div class="profile-head__hint">' +
            (phone ? escapeHtml(name || "尊贵的用户") + " · 已绑定" : "点击下方「修改手机号」绑定") +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderList() {
    return (
      '<div class="profile-list">' +
        '<div class="row" data-action="edit-phone">' +
          '<div class="row__avatar"><span data-icon="phone"></span></div>' +
          '<div class="row__main"><div class="row__title">手机号</div><div class="row__sub">用于查询订单与评价</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</div>" +
        '<div class="row" data-action="edit-name">' +
          '<div class="row__avatar"><span data-icon="user"></span></div>' +
          '<div class="row__main"><div class="row__title">昵称</div><div class="row__sub">显示在评价等场景</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</div>" +
        '<a class="row" href="#/orders">' +
          '<div class="row__avatar"><span data-icon="list"></span></div>' +
          '<div class="row__main"><div class="row__title">我的订单</div><div class="row__sub">查看 / 取消 / 评价</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</a>" +
        '<a class="row" href="#/category/repair">' +
          '<div class="row__avatar"><span data-icon="grid"></span></div>' +
          '<div class="row__main"><div class="row__title">浏览分类</div><div class="row__sub">维修 / 保洁 / 安装</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</a>" +
        '<div class="row" data-action="settings">' +
          '<div class="row__avatar"><span data-icon="gear"></span></div>' +
          '<div class="row__main"><div class="row__title">设置</div><div class="row__sub">主题 / 缓存</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</div>" +
        '<div class="row" data-action="about">' +
          '<div class="row__avatar"><span data-icon="info"></span></div>' +
          '<div class="row__main"><div class="row__title">关于我们</div><div class="row__sub">服务时间 / 客服</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</div>" +
        '<div class="row" data-action="admin">' +
          '<div class="row__avatar" style="background:var(--accent-soft);color:var(--accent-strong)"><span data-icon="shield"></span></div>' +
          '<div class="row__main"><div class="row__title" style="color:var(--accent-strong)">平台管理后台</div><div class="row__sub">师傅 / 订单 / 评价管理</div></div>' +
          '<span class="row__chevron" data-icon="chevron-right"></span>' +
        "</div>" +
      "</div>"
    );
  }

  function renderActions() {
    const phone = store.getPhone();
    if (!phone) return "";
    return (
      '<div style="margin-top:24px;text-align:center">' +
        '<button class="btn btn--ghost btn--sm" id="logout-btn">解绑手机号</button>' +
      "</div>"
    );
  }

  function bindActions() {
    const app = document.getElementById("app");
    if (!app) return;
    app.querySelectorAll('[data-action="edit-phone"]').forEach(function (el) {
      el.addEventListener("click", async function () {
        const cur = store.getPhone();
        const v = await global.modal.prompt({
          title: "修改手机号",
          label: "手机号",
          type: "tel",
          value: cur,
          placeholder: "请输入 11 位手机号",
          okText: "保存",
          cancelText: "取消",
          validate: function (v) {
            if (!v || !isPhone(v)) return "手机号格式错误（7-20 位数字，可带 +）";
            return null;
          },
        });
        if (v != null) {
          store.setPhone(v);
          toast("手机号已保存");
          render();
        }
      });
    });
    app.querySelectorAll('[data-action="edit-name"]').forEach(function (el) {
      el.addEventListener("click", async function () {
        const cur = store.getName();
        const v = await global.modal.prompt({
          title: "修改昵称",
          label: "昵称",
          type: "text",
          value: cur,
          placeholder: "1-50 字",
          okText: "保存",
          cancelText: "取消",
          validate: function (v) {
            if (!v || v.length < 1 || v.length > 50) return "昵称 1-50 字";
            return null;
          },
        });
        if (v != null) {
          store.setName(v);
          toast("昵称已保存");
          render();
        }
      });
    });
    app.querySelectorAll('[data-action="settings"]').forEach(function (el) {
      el.addEventListener("click", function () {
        if (global.drawer && global.drawer.settingsModal) global.drawer.settingsModal();
      });
    });
    app.querySelectorAll('[data-action="about"]').forEach(function (el) {
      el.addEventListener("click", function () {
        if (global.drawer && global.drawer.aboutModal) global.drawer.aboutModal();
      });
    });
    app.querySelectorAll('[data-action="admin"]').forEach(function (el) {
      el.addEventListener("click", function () {
        const path = global.CONFIG && global.CONFIG.adminPath ? global.CONFIG.adminPath : "/admin.html";
        global.location.href = path;
      });
    });
    const logout = document.getElementById("logout-btn");
    if (logout) {
      logout.addEventListener("click", async function () {
        const ok = await global.modal.confirm({
          title: "解绑手机号",
          body: "解绑后将无法查询历史订单。确定要继续吗？",
          okText: "确定解绑",
          cancelText: "保留",
        });
        if (ok) {
          store.setPhone("");
          store.setName("");
          toast("已解绑");
          render();
        }
      });
    }
  }

  function render() {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    app.innerHTML = renderHead() + renderList() + renderActions();
    if (global.router && global.router.setTitle) global.router.setTitle("我的");
    if (icons) icons.render(app);
    bindActions();
  }

  global.profile = { render: render };
})(window);
