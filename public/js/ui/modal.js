// ui/modal.js — 通用 modal / toast 包装
(function (global) {
  "use strict";

  let stackDepth = 0;

  function show(opts) {
    opts = opts || {};
    const overlay = document.getElementById("overlay");
    const modal = document.getElementById("modal");
    if (!overlay || !modal) {
      if (global.toast && opts.title) global.toast(opts.title + " · " + (opts.body || ""));
      return Promise.resolve(null);
    }
    stackDepth++;
    const title = opts.title || "";
    const bodyHtml = opts.bodyHtml != null ? opts.bodyHtml : escapeHtml(opts.body || "");
    const okText = opts.okText || "确定";
    const cancelText = opts.cancelText || "取消";
    const showCancel = opts.cancel !== false && opts.cancelText !== null;
    const dismissible = opts.dismissible !== false;
    const onMount = opts.onMount;
    const onOk = opts.onOk;
    const onCancel = opts.onCancel;

    modal.innerHTML =
      '<div class="modal__head">' +
        '<div class="modal__title">' + escapeHtml(title) + "</div>" +
        '<button class="modal__close" type="button" aria-label="关闭">' +
          '<span data-icon="close"></span>' +
        "</button>" +
      "</div>" +
      '<div class="modal__body">' + bodyHtml + "</div>" +
      '<div class="modal__footer">' +
        (showCancel
          ? '<button class="btn btn--ghost btn--block" id="modal-cancel" type="button">' + escapeHtml(cancelText) + "</button>"
          : "") +
        '<button class="btn btn--primary ' + (showCancel ? "" : "btn--block") + '" id="modal-ok" type="button">' +
          escapeHtml(okText) +
        "</button>" +
      "</div>";

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (global.icons) global.icons.render(modal);

    let resolved = false;
    function close(value) {
      if (resolved) return;
      resolved = true;
      overlay.hidden = true;
      modal.innerHTML = "";
      stackDepth--;
      if (stackDepth <= 0) {
        stackDepth = 0;
        document.body.style.overflow = "";
      }
      if (opts.resolve) opts.resolve(value);
    }

    return new Promise(function (resolve) {
      opts.resolve = resolve;

      const okBtn = modal.querySelector("#modal-ok");
      const cancelBtn = modal.querySelector("#modal-cancel");
      const closeBtn = modal.querySelector(".modal__close");

      if (okBtn) {
        okBtn.addEventListener("click", async function () {
          if (onOk) {
            okBtn.disabled = true;
            try {
              const r = await onOk(modal);
              if (r === false) {
                okBtn.disabled = false;
                return;
              }
            } catch (e) {
              okBtn.disabled = false;
              if (global.toast) global.toast(e && e.message ? e.message : "操作失败");
              return;
            }
          }
          close(true);
        });
      }
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
          if (onCancel) {
            try { onCancel(modal); } catch (e) {}
          }
          close(false);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          close(false);
        });
      }
      if (dismissible) {
        overlay.addEventListener("click", function (e) {
          if (e.target === overlay) close(false);
        }, { once: true });
      }
      // Escape
      document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
          close(false);
          document.removeEventListener("keydown", escHandler);
        }
      });

      if (onMount) {
        try { onMount(modal); } catch (e) { console.warn("modal onMount error:", e); }
      }
    });
  }

  function alert(opts) {
    if (typeof opts === "string") opts = { body: opts };
    opts = Object.assign({}, opts, { cancel: false });
    return show(opts);
  }

  function confirm(opts) {
    opts = Object.assign({
      title: "提示",
      okText: "确定",
      cancelText: "取消",
      cancel: true,
    }, opts || {});
    return show(opts).then(function (r) { return r === true; });
  }

  function prompt(opts) {
    opts = opts || {};
    const label = opts.label || "请输入";
    const placeholder = opts.placeholder || "";
    const type = opts.type || "text";
    const initial = opts.value || "";
    const bodyHtml =
      '<div class="field"><label class="field__label">' + escapeHtml(label) +
      '</label><input class="field__input" id="prompt-input" type="' + type + '"' +
      (placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : "") +
      ' value="' + escapeHtml(initial) + '" autocomplete="off"></div>';
    return show({
      title: opts.title || "提示",
      bodyHtml: bodyHtml,
      okText: opts.okText || "确定",
      cancelText: opts.cancelText || "取消",
      cancel: true,
      onMount: function (root) {
        const inp = root.querySelector("#prompt-input");
        if (inp) {
          inp.focus();
          inp.select && inp.select();
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              const okBtn = root.querySelector("#modal-ok");
              if (okBtn) okBtn.click();
            }
          });
        }
      },
      onOk: function (root) {
        const inp = root.querySelector("#prompt-input");
        const v = inp ? inp.value : "";
        if (opts.validate) {
          const err = opts.validate(v);
          if (err) {
            if (global.toast) global.toast(err);
            return false;
          }
        }
        opts._value = v;
      },
    }).then(function (ok) {
      return ok ? opts._value : null;
    });
  }

  function close(value) {
    const overlay = document.getElementById("overlay");
    const modal = document.getElementById("modal");
    if (overlay) overlay.hidden = true;
    if (modal) modal.innerHTML = "";
    document.body.style.overflow = "";
    stackDepth = 0;
  }

  global.modal = {
    show: show,
    alert: alert,
    confirm: confirm,
    prompt: prompt,
    close: close,
  };
})(window);
