// api.js — ApiClient 类：封装所有后端调用
(function (global) {
  "use strict";

  class ApiClient {
    constructor(opts) {
      this.base = (opts && opts.base) || (global.CONFIG && CONFIG.apiBase) || "/api";
      this.timeout = (opts && opts.timeout) || 15000;
    }

    // 内部：fetch + JSON 解析 + 错误处理
    async _request(path, options) {
      options = options || {};
      const url = path.startsWith("http") ? path : this.base + path;
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, this.timeout);
      const opt = Object.assign({}, options, { signal: controller.signal });
      opt.headers = Object.assign({ "Accept": "application/json" }, options.headers || {});
      if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
        opt.headers["Content-Type"] = "application/json";
        opt.body = JSON.stringify(options.body);
      }
      let res;
      try {
        res = await fetch(url, opt);
      } catch (err) {
        clearTimeout(timer);
        const e = new Error("网络请求失败，请检查网络");
        e.cause = err;
        e.code = "NETWORK";
        throw e;
      }
      clearTimeout(timer);
      let data = null;
      const ct = res.headers.get("content-type") || "";
      if (ct.indexOf("application/json") >= 0 || ct.indexOf("text/json") >= 0) {
        try { data = await res.json(); } catch (e) { data = null; }
      } else {
        try { data = await res.text(); } catch (e) {}
      }
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || ("HTTP " + res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.body = data;
        throw err;
      }
      return data;
    }

    // 1. GET /api/categories
    async getCategories() {
      const data = await this._request("/categories");
      // 后端返回 {categories: []}
      if (data && data.categories) return data.categories;
      return Array.isArray(data) ? data : [];
    }

    // 2. GET /api/masters?category=&q=&city=&page=&limit=
    async listMasters(params) {
      params = params || {};
      const q = global.qs ? global.qs({
        category: params.category || "",
        q: params.q || "",
        city: params.city || "",
        page: params.page || 1,
        limit: params.limit || (CONFIG && CONFIG.pageSize) || 20,
      }) : "";
      const data = await this._request("/masters" + q);
      if (!data) return { masters: [], cities: [], page: 1 };
      return {
        masters: data.masters || data.list || [],
        cities: data.cities || [],
        page: data.page || 1,
        limit: data.limit,
      };
    }

    // 3. GET /api/masters/:code
    async getMaster(code) {
      const data = await this._request("/masters/" + encodeURIComponent(code));
      return data || null;
    }

    // 4. GET /api/services/:code?category=
    async getServices(code, category) {
      const q = category ? ("?category=" + encodeURIComponent(category)) : "";
      const data = await this._request("/services/" + encodeURIComponent(code) + q);
      return (data && (data.services || data.list)) || [];
    }

    // 5. GET /api/slots/:code?serviceId=&date=
    async getSlots(code, serviceId, date) {
      const params = { serviceId: serviceId };
      if (date) params.date = date;
      const q = global.qs ? global.qs(params) : "";
      const data = await this._request("/slots/" + encodeURIComponent(code) + q);
      return data || { all: [], available: [], occupied: {}, closed: true };
    }

    // 6. POST /api/bookings/:code
    async submitBooking(code, body) {
      const data = await this._request("/bookings/" + encodeURIComponent(code), {
        method: "POST",
        body: body,
      });
      return data;
    }

    // 7. GET /api/my?phone=&status=
    async getMyOrders(phone, status) {
      const params = { phone: phone };
      if (status && status !== "all") params.status = status;
      const q = global.qs ? global.qs(params) : "";
      const data = await this._request("/my" + q);
      return (data && (data.orders || data.list)) || [];
    }

    // 8. POST /api/my/:id/cancel
    async cancelBooking(id, phone) {
      const data = await this._request("/my/" + encodeURIComponent(id) + "/cancel", {
        method: "POST",
        body: { phone: phone },
      });
      return data;
    }

    // 9. POST /api/my/:id/review
    async submitReview(id, phone, rating, content) {
      const data = await this._request("/my/" + encodeURIComponent(id) + "/review", {
        method: "POST",
        body: { phone: phone, rating: rating, content: content || null },
      });
      return data;
    }
  }

  // 全局单例
  global.ApiClient = ApiClient;
  global.api = new ApiClient();
})(window);
