// features/booking.js — 预约流程 4 步
// 步骤：1.选服务 → 2.选时间（日期chip前后7天 + 时段grid）→ 3.填信息 → 4.确认提交
(function (global) {
  "use strict";

  let state = {
    masterCode: "",
    master: null,
    services: [],
    selectedServiceId: "",
    selectedService: null,
    selectedDate: "",
    selectedSlot: "",
    slotsData: null,
    loadingSlots: false,
    submitting: false,
    // 表单快照（用于步骤切换时保留数据）
    formData: { name: "", phone: "", addr: "", note: "", email: "" },
  };

  function renderStepper(step) {
    const steps = ["选服务", "选时间", "填信息", "确认"];
    return (
      '<div class="card" style="margin-bottom:12px;padding:12px">' +
        steps.map(function (label, i) {
          const idx = i + 1;
          const done = i < step;
          const current = i === step;
          return (
            '<div class="booking-step" style="margin:0;display:flex;align-items:center;gap:8px">' +
              '<div class="booking-step__num' + (done ? " booking-step__num--done" : "") + '">' +
                (done ? '<span data-icon="check"></span>' : idx) +
              "</div>" +
              '<div class="booking-step__title' + (done ? " booking-step__title--done" : "") + '">' +
                label +
              "</div>" +
            "</div>"
          );
        }).join('<span style="color:var(--line-2);margin:0 4px">·</span>') +
      "</div>"
    );
  }

  function renderStep1Services() {
    const services = state.services;
    if (services.length === 0) {
      return '<div class="empty"><div class="empty__icon"><span data-icon="briefcase"></span></div>该师傅暂无可预约服务</div>';
    }
    const items = services.map(function (s) {
      const price = s.price_cents != null ? formatPrice(s.price_cents) : "面议";
      const dur = s.duration_min ? s.duration_min + "分钟" : "时长面议";
      return (
        '<div class="service-item' + (s.id == state.selectedServiceId ? ' active' : "") + '" data-svc-id="' + s.id + '" style="cursor:pointer">' +
          '<div class="service-item__main">' +
            '<div class="service-item__name">' + escapeHtml(s.name || "") + "</div>" +
            (s.description ? '<div class="service-item__desc">' + escapeHtml(s.description) + "</div>" : "") +
            '<div class="service-item__meta"><span data-icon="clock"></span>' + dur + "</div>" +
          "</div>" +
          '<div class="service-item__price">' + price + "</div>" +
        "</div>"
      );
    }).join("");
    return '<div class="section-title">选择服务项目</div><div class="service-list">' + items + "</div>";
  }

  function renderDateChips() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = [];
    for (let i = -7; i <= 7; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = y + "-" + m + "-" + day;
      const weekday = weekdayShort(dateStr);
      const isPast = i < 0;
      items.push(
        '<div class="date-chip' + (dateStr === state.selectedDate ? " active" : "") + (isPast ? ' style="opacity:0.45"' : "") + '" data-date="' + dateStr + '">' +
          '<div class="date-chip__weekday">' + escapeHtml(weekday) + "</div>" +
          '<div class="date-chip__day">' + m + "/" + day + "</div>" +
        "</div>"
      );
    }
    return '<div class="section-title">选择日期</div><div class="date-chips">' + items.join("") + "</div>";
  }

  function renderSlotsGrid() {
    if (state.loadingSlots) {
      return '<div class="section-title">选择时段</div><div class="list-status">加载中…</div>';
    }
    if (!state.slotsData) return "";
    if (state.slotsData.closed) {
      return '<div class="section-title">选择时段</div>' +
        '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(state.slotsData.closedReason || "该日不接单") + "</div>";
    }
    const all = state.slotsData.all || [];
    const occupied = state.slotsData.occupied || {};
    if (all.length === 0) {
      return '<div class="section-title">选择时段</div><div class="empty">今日无可用时段</div>';
    }
    const slots = all.map(function (time) {
      const isOcc = !!occupied[time];
      const isSel = time === state.selectedSlot;
      const cls = "slot" + (isSel ? " slot--selected" : (isOcc ? " slot--occupied" : ""));
      const status = isSel ? "已选" : (isOcc ? (occupied[time] || "已满") : "可约");
      return (
        '<div class="' + cls + '" data-slot="' + escapeHtml(time) + '">' +
          '<span class="slot__time">' + escapeHtml(time) + "</span>" +
          '<span class="slot__status">' + escapeHtml(status) + "</span>" +
        "</div>"
      );
    }).join("");
    return '<div class="section-title">选择时段</div><div class="slot-grid"' + (state.loadingSlots ? ' style="opacity:0.6;pointer-events:none"' : "") + ">" + slots + "</div>";
  }

  function renderStep2Time() {
    return renderDateChips() + renderSlotsGrid();
  }

  function renderStep3Form() {
    // 优先用 state.formData 中已有的值（步骤回退时保留输入），否则回退到 store
    const f = state.formData;
    const phone = f.phone || store.getPhone() || "";
    const name = f.name || store.getName() || "";
    return (
      '<div class="section-title">填写预约信息</div>' +
      '<div class="card">' +
        '<div class="field"><label class="field__label">姓名<span class="req">*</span></label>' +
          '<input class="field__input" id="bk-name" type="text" maxlength="50" placeholder="请输入姓名" value="' + escapeHtml(name) + '"></div>' +
        '<div class="field"><label class="field__label">手机号<span class="req">*</span></label>' +
          '<input class="field__input" id="bk-phone" type="tel" inputmode="numeric" maxlength="20" placeholder="请输入手机号" value="' + escapeHtml(phone) + '"></div>' +
        '<div class="field"><label class="field__label">上门地址<span class="req">*</span></label>' +
          '<textarea class="field__textarea" id="bk-addr" maxlength="200" placeholder="详细地址（5-200字）">' + escapeHtml(f.addr) + '</textarea></div>' +
        '<div class="field"><label class="field__label">备注</label>' +
          '<textarea class="field__textarea" id="bk-note" maxlength="500" placeholder="如故障描述、上门特殊要求等">' + escapeHtml(f.note) + '</textarea></div>' +
        '<div class="field"><label class="field__label">邮箱（选填）</label>' +
          '<input class="field__input" id="bk-email" type="email" maxlength="100" placeholder="用于接收订单通知" value="' + escapeHtml(f.email) + '"></div>' +
      "</div>"
    );
  }

  function renderStep4Confirm() {
    const svc = state.selectedService || {};
    const m = state.master || {};
    const f = state.formData;
    const price = svc.price_cents != null ? formatPrice(svc.price_cents) : "面议";
    const scheduledAt = state.selectedDate && state.selectedSlot ? (state.selectedDate + " " + state.selectedSlot) : "";
    return (
      '<div class="section-title">确认订单</div>' +
      '<div class="card">' +
        '<div class="summary-row"><span class="summary-row__label">师傅</span><span class="summary-row__value">' + escapeHtml(m.name || "") + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">服务</span><span class="summary-row__value">' + escapeHtml(svc.name || "") + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">时间</span><span class="summary-row__value">' + escapeHtml(formatDate(scheduledAt)) + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">时长</span><span class="summary-row__value">' + (svc.duration_min ? svc.duration_min + "分钟" : "面议") + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">姓名</span><span class="summary-row__value">' + escapeHtml(f.name) + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">手机号</span><span class="summary-row__value">' + escapeHtml(f.phone) + "</span></div>" +
        '<div class="summary-row"><span class="summary-row__label">地址</span><span class="summary-row__value">' + escapeHtml(f.addr) + "</span></div>" +
        (f.note ? '<div class="summary-row"><span class="summary-row__label">备注</span><span class="summary-row__value">' + escapeHtml(f.note) + "</span></div>" : "") +
        '<div class="summary-row"><span class="summary-row__label">价格</span><span class="summary-row__value summary-row__value--price">' + price + "</span></div>" +
      "</div>"
    );
  }

  function renderBottomBar(step) {
    const old = document.querySelector(".bottom-bar");
    if (old) old.remove();
    const bar = document.createElement("div");
    bar.className = "bottom-bar";
    if (step === 1) {
      bar.innerHTML =
        '<div class="bottom-bar__price" id="bk-svc-summary">未选服务</div>' +
        '<button class="btn btn--primary btn--lg" id="bk-next" disabled>下一步</button>';
    } else if (step === 2) {
      bar.innerHTML =
        '<div class="bottom-bar__price" id="bk-time-summary">未选时间</div>' +
        '<button class="btn btn--ghost btn--lg" id="bk-prev">上一步</button>' +
        '<button class="btn btn--primary btn--lg" id="bk-next" disabled>下一步</button>';
    } else if (step === 3) {
      bar.innerHTML =
        '<div class="bottom-bar__price" id="bk-form-summary">请填写完整</div>' +
        '<button class="btn btn--ghost btn--lg" id="bk-prev">上一步</button>' +
        '<button class="btn btn--primary btn--lg" id="bk-next" disabled>下一步</button>';
    } else if (step === 4) {
      bar.innerHTML =
        '<button class="btn btn--ghost btn--lg" id="bk-prev">返回修改</button>' +
        '<button class="btn btn--primary btn--lg" id="bk-submit">' +
          '<span data-icon="check"></span>提交预约</button>';
    }
    document.body.appendChild(bar);
    if (icons) icons.render(bar);
  }

  async function loadSlots() {
    if (!state.selectedDate || !state.selectedServiceId) return;
    state.loadingSlots = true;
    state.slotsData = null;
    state.selectedSlot = "";
    const host = document.getElementById("step-host");
    if (host) {
      // 只重渲染 step2 部分
      host.innerHTML = renderStep1Services() + renderDateChips() + renderSlotsGrid();
      bindStep2Events(host);
      if (icons) icons.render(host);
    }
    try {
      const data = await api.getSlots(state.masterCode, state.selectedServiceId, state.selectedDate);
      state.slotsData = data;
    } catch (e) {
      state.slotsData = { closed: true, closedReason: e.message || "加载失败", all: [], available: [], occupied: {} };
    } finally {
      state.loadingSlots = false;
      if (host) {
        host.innerHTML = renderStep1Services() + renderDateChips() + renderSlotsGrid();
        bindStep2Events(host);
        if (icons) icons.render(host);
        // 还原选中态
        syncBottomBar(2);
      }
    }
  }

  function syncBottomBar(step) {
    if (step === 1) {
      const summary = document.getElementById("bk-svc-summary");
      const next = document.getElementById("bk-next");
      const svc = state.selectedService;
      if (svc) {
        if (summary) summary.textContent = (svc.name || "服务") + " · " + (svc.price_cents != null ? formatPrice(svc.price_cents) : "面议");
        if (next) next.disabled = false;
      } else {
        if (summary) summary.textContent = "未选服务";
        if (next) next.disabled = true;
      }
    } else if (step === 2) {
      const summary = document.getElementById("bk-time-summary");
      const next = document.getElementById("bk-next");
      if (state.selectedDate && state.selectedSlot) {
        if (summary) summary.textContent = formatDate(state.selectedDate + " " + state.selectedSlot);
        if (next) next.disabled = false;
      } else {
        if (summary) summary.textContent = state.selectedDate ? "请选择时段" : "请选择日期";
        if (next) next.disabled = true;
      }
    } else if (step === 3) {
      const summary = document.getElementById("bk-form-summary");
      const next = document.getElementById("bk-next");
      const name = (document.getElementById("bk-name") || {}).value || "";
      const phone = (document.getElementById("bk-phone") || {}).value || "";
      const addr = (document.getElementById("bk-addr") || {}).value || "";
      if (name && isPhone(phone) && addr && addr.length >= 5) {
        if (summary) summary.textContent = "信息完整";
        if (next) next.disabled = false;
      } else {
        if (summary) summary.textContent = "请填写完整";
        if (next) next.disabled = true;
      }
    }
  }

  function bindStep1Events(host) {
    host.querySelectorAll(".service-item").forEach(function (el) {
      el.addEventListener("click", function () {
        const id = el.getAttribute("data-svc-id");
        const svc = state.services.find(function (s) { return String(s.id) === String(id); });
        state.selectedServiceId = id;
        state.selectedService = svc || null;
        host.querySelectorAll(".service-item").forEach(function (x) { x.classList.remove("active"); });
        el.classList.add("active");
        syncBottomBar(1);
      });
    });
  }

  function bindStep2Events(host) {
    host.querySelectorAll(".date-chip").forEach(function (el) {
      el.addEventListener("click", function () {
        if (el.style.opacity === "0.45") return; // 过去日期不可选
        const date = el.getAttribute("data-date");
        if (date !== state.selectedDate) {
          state.selectedDate = date;
          state.selectedSlot = "";
          // 重渲染以更新 active
          host.querySelectorAll(".date-chip").forEach(function (x) { x.classList.remove("active"); });
          el.classList.add("active");
          loadSlots();
        }
      });
    });
    host.querySelectorAll(".slot").forEach(function (el) {
      el.addEventListener("click", function () {
        if (el.classList.contains("slot--occupied")) return;
        const time = el.getAttribute("data-slot");
        state.selectedSlot = time;
        host.querySelectorAll(".slot").forEach(function (x) {
          x.classList.remove("slot--selected");
          const st = x.querySelector(".slot__status");
          if (st) st.textContent = x.classList.contains("slot--occupied") ? (state.slotsData.occupied[x.getAttribute("data-slot")] || "已满") : "可约";
        });
        el.classList.add("slot--selected");
        const st = el.querySelector(".slot__status");
        if (st) st.textContent = "已选";
        syncBottomBar(2);
      });
    });
  }

  function bindStep3Events(host) {
    ["bk-name", "bk-phone", "bk-addr"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", function () { syncBottomBar(3); });
      }
    });
    // 默认初始化一次
    syncBottomBar(3);
  }

  function getFormData() {
    const name = (document.getElementById("bk-name") || {}).value || "";
    const phone = (document.getElementById("bk-phone") || {}).value || "";
    const addr = (document.getElementById("bk-addr") || {}).value || "";
    const note = (document.getElementById("bk-note") || {}).value || "";
    const email = (document.getElementById("bk-email") || {}).value || "";
    return { name: name.trim(), phone: phone.trim(), addr: addr.trim(), note: note.trim(), email: email.trim() };
  }

  function validateForm() {
    const f = getFormData();
    return validateSnapshot(f);
  }

  // 验证快照（步骤4 提交时复用）
  function validateSnapshot(f) {
    if (!f.name || f.name.length < 1 || f.name.length > 50) return "姓名必填，1-50 字";
    if (!isPhone(f.phone)) return "手机号格式错误（7-20 位数字，可带 +）";
    if (!f.addr || f.addr.length < 5 || f.addr.length > 200) return "上门地址必填，5-200 字";
    if (f.email && !isEmail(f.email)) return "邮箱格式不正确";
    return null;
  }

  async function render(route) {
    cleanup();
    const app = document.getElementById("app");
    if (!app) return;
    const code = route && route.params && route.params.code;
    const serviceId = route && route.query && route.query.serviceId;
    if (!code) {
      app.innerHTML = '<div class="empty">未指定师傅</div>';
      return;
    }
    state = {
      masterCode: code,
      master: null,
      services: [],
      selectedServiceId: serviceId || "",
      selectedService: null,
      selectedDate: "",
      selectedSlot: "",
      slotsData: null,
      loadingSlots: false,
      submitting: false,
      // 从 store 预填：便于用户复用上次的姓名/手机
      formData: {
        name: store.getName() || "",
        phone: store.getPhone() || "",
        addr: "",
        note: "",
        email: "",
      },
    };

    app.className = "app app--has-bottom-bar";
    app.innerHTML = '<div id="master-host"><div class="list-status">加载中…</div></div><div id="step-host"></div>';
    const mHost = document.getElementById("master-host");

    try {
      const data = await api.getMaster(code);
      if (!data || !data.master) {
        mHost.innerHTML = '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>师傅不存在</div>';
        return;
      }
      state.master = data.master;
      state.services = data.services || [];
      if (state.selectedServiceId) {
        state.selectedService = state.services.find(function (s) { return String(s.id) === String(state.selectedServiceId); });
      }
      // 渲染师傅头部 mini
      mHost.innerHTML = renderMiniHead(state.master);
      if (icons) icons.render(mHost);

      // 默认选中第一个 service（如果指定了 serviceId 且能找到）
      if (!state.selectedService && state.services.length > 0) {
        state.selectedService = state.services[0];
        state.selectedServiceId = state.services[0].id;
      }
      renderStep(1);
    } catch (e) {
      mHost.innerHTML =
        '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(e.message || "加载失败") +
        '<div class="empty__action"><button class="btn btn--soft btn--sm" id="retry-btn">重试</button></div></div>';
      const retry = document.getElementById("retry-btn");
      if (retry) retry.addEventListener("click", function () { render(route); });
    }
  }

  function renderMiniHead(m) {
    const avatar = m.avatarUrl
      ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml(store.firstChar(m.name));
    return (
      '<a class="row" href="#/master/' + encodeURIComponent(m.code || state.masterCode) + '">' +
        '<div class="row__avatar">' + avatar + "</div>" +
        '<div class="row__main">' +
          '<div class="row__title">' + escapeHtml(m.name || "") + "</div>" +
          '<div class="row__sub">' + escapeHtml(m.priceRange || "面议") + "</div>" +
        "</div>" +
        '<span class="row__chevron" data-icon="chevron-right"></span>' +
      "</a>"
    );
  }

  let currentStep = 1;

  function renderStep(step) {
    currentStep = step;
    const host = document.getElementById("step-host");
    if (!host) return;
    let html = renderStepper(step - 1);
    if (step === 1) {
      html += renderStep1Services();
    } else if (step === 2) {
      html += renderStep1Services() + renderDateChips() + renderSlotsGrid();
    } else if (step === 3) {
      html += renderStep3Form();
    } else if (step === 4) {
      html += renderStep4Confirm();
    }
    host.innerHTML = html;
    if (icons) icons.render(host);

    // 绑定事件
    if (step === 1) {
      bindStep1Events(host);
    } else if (step === 2) {
      bindStep1Events(host);
      bindStep2Events(host);
      // 若已选 service 则自动加载今日时段
      if (!state.selectedDate) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        state.selectedDate = y + "-" + m + "-" + d;
        loadSlots();
      }
    } else if (step === 3) {
      bindStep3Events(host);
    } else if (step === 4) {
      // step 4 不再有表单 DOM；state.formData 已在 step 3 → 4 切换时缓存
    }

    renderBottomBar(step);
    bindBottomBar(step);

    syncBottomBar(step);

    // 滚到顶部
    if (host.parentElement) host.parentElement.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindBottomBar(step) {
    const prev = document.getElementById("bk-prev");
    const next = document.getElementById("bk-next");
    const submit = document.getElementById("bk-submit");

    if (prev) prev.addEventListener("click", function () {
      if (step > 1) renderStep(step - 1);
    });
    if (next) next.addEventListener("click", function () {
      if (step === 3) {
        const err = validateForm();
        if (err) { toast(err); return; }
        const f = getFormData();
        // 快照表单数据，供 step 4 确认页显示
        state.formData = f;
        // 同步到 store（便于下次预约复用）
        if (f.name) store.setName(f.name);
        if (f.phone) store.setPhone(f.phone);
      }
      renderStep(step + 1);
    });
    if (submit) submit.addEventListener("click", async function () {
      if (state.submitting) return;
      // step 4 提交：使用 step 3 → 4 时缓存的 state.formData
      const err = validateSnapshot(state.formData);
      if (err) { toast(err); return; }
      const f = state.formData;
      const scheduledAt = state.selectedDate + " " + state.selectedSlot;
      state.submitting = true;
      submit.disabled = true;
      submit.innerHTML = '<span data-icon="refresh"></span>提交中…';
      if (icons) icons.render(submit);
      try {
        await api.submitBooking(state.masterCode, {
          serviceId: state.selectedServiceId,
          scheduledAt: scheduledAt,
          customerName: f.name,
          customerPhone: f.phone,
          customerAddress: f.addr,
          note: f.note,
          customerEmail: f.email,
        });
        // 成功
        if (global.modal) {
          await global.modal.alert({
            title: "预约成功",
            bodyHtml:
              '<div style="text-align:center;padding:8px 0">' +
                '<div style="font-size:48px;color:var(--ok)"><span data-icon="check-circle"></span></div>' +
                '<div style="margin-top:8px;font-size:15px;color:var(--text)">' +
                  "服务：" + escapeHtml(state.selectedService.name || "") + "<br>" +
                  "时间：" + escapeHtml(formatDate(scheduledAt)) +
                "</div>" +
                '<div style="margin-top:8px;font-size:13px;color:var(--text-3)">师傅会尽快确认，请保持手机畅通</div>' +
              "</div>",
            okText: "查看订单",
          });
          if (icons) icons.render(document.getElementById("modal"));
        }
        go("orders");
      } catch (e) {
        toast(e.message || "预约失败");
        submit.disabled = false;
        submit.innerHTML = '<span data-icon="check"></span>提交预约';
        if (icons) icons.render(submit);
      } finally {
        state.submitting = false;
      }
    });
  }

  function cleanup() {
    const old = document.querySelector(".bottom-bar");
    if (old) old.remove();
    state = {
      masterCode: "",
      master: null,
      services: [],
      selectedServiceId: "",
      selectedService: null,
      selectedDate: "",
      selectedSlot: "",
      slotsData: null,
      loadingSlots: false,
      submitting: false,
      formData: { name: "", phone: "", addr: "", note: "", email: "" },
    };
  }

  global.booking = {
    render: render,
    cleanup: cleanup,
  };
})(window);
