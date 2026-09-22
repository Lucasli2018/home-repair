// core/store.js — localStorage 读写（手机号、token）
(function (global) {
  "use strict";

  const KEY = (global.CONFIG && global.CONFIG.storageKey) || "home-repair-v1";

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj || {}));
    } catch (e) {
      // 静默失败（隐私模式 / 配额满）
      console.warn("store: write failed", e);
    }
  }

  function get(key, fallback) {
    const all = readAll();
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback;
  }

  function set(key, value) {
    const all = readAll();
    all[key] = value;
    writeAll(all);
  }

  function remove(key) {
    const all = readAll();
    delete all[key];
    writeAll(all);
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  // 业务封装
  function getPhone() {
    return get("phone", "");
  }
  function setPhone(phone) {
    if (phone) set("phone", String(phone).trim());
    else remove("phone");
  }

  function getToken() {
    return get("token", "");
  }
  function setToken(token) {
    if (token) set("token", String(token));
    else remove("token");
  }

  function getName() {
    return get("name", "");
  }
  function setName(name) {
    if (name) set("name", String(name).trim().slice(0, 50));
    else remove("name");
  }

  function getTheme() {
    return get("theme", "auto");
  }
  function setTheme(name) {
    set("theme", name === "dark" || name === "light" ? name : "auto");
  }

  // 首字母头像 fallback 颜色
  function pickAvatarColor(name) {
    const colors = (global.CONFIG && global.CONFIG.defaultAvatarColors) || ["#ea580c"];
    if (!name) return colors[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
    return colors[h % colors.length];
  }

  function firstChar(name) {
    if (!name) return "?";
    const s = String(name).trim();
    return s ? s.slice(0, 1).toUpperCase() : "?";
  }

  global.store = {
    KEY: KEY,
    get: get,
    set: set,
    remove: remove,
    clear: clear,
    getPhone: getPhone,
    setPhone: setPhone,
    getToken: getToken,
    setToken: setToken,
    getName: getName,
    setName: setName,
    getTheme: getTheme,
    setTheme: setTheme,
    pickAvatarColor: pickAvatarColor,
    firstChar: firstChar,
  };
})(window);
