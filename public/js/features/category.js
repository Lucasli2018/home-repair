// features/category.js — 分类页：segment + 二级 chip + 师傅列表
(function (global) {
  "use strict";

  let currentCategory = "repair";
  let currentSub = "";
  let currentCity = "";
  let cats = [];
  let cities = [];
  let loading = false;

  function findCat(key) {
    return cats.find(function (c) { return c.key === key; }) ||
      (CONFIG.categories || []).find(function (c) { return c.key === key; });
  }

  function renderSeg() {
    return (cats.length ? cats : (CONFIG.categories || []))
      .map(function (c) {
        return '<div class="seg__item' + (c.key === currentCategory ? " active" : "") + '" data-cat="' + c.key + '">' + escapeHtml(c.name) + "</div>";
      })
      .join("");
  }

  function renderSubChips() {
    const cat = findCat(currentCategory);
    const subs = (cat && cat.subs) || [];
    if (subs.length === 0) return '<div style="color:var(--text-3);font-size:13px">该分类暂无二级筛选</div>';
    const items = [{ key: "", name: "全部" }].concat(subs);
    return items.map(function (s) {
      return '<div class="chip' + (s.key === currentSub ? " active" : "") + '" data-sub="' + escapeHtml(s.key) + '">' + escapeHtml(s.name) + "</div>";
    }).join("");
  }

  function renderCityChips() {
    if (!cities.length) return "";
    const items = [{ key: "", name: "全部城市" }].concat(cities.map(function (c) { return { key: c, name: c }; }));
    return items.map(function (c) {
      return '<div class="chip' + (c.key === currentCity ? " active" : "") + '" data-city="' + escapeHtml(c.key) + '">' + escapeHtml(c.name) + "</div>";
    }).join("");
  }

  function renderHero() {
    const cat = findCat(currentCategory);
    if (!cat) return "";
    return (
      '<div class="cat-hero">' +
        '<div class="cat-hero__title">' + escapeHtml(cat.name || "") + "服务</div>" +
        '<div class="cat-hero__desc">专业师傅 · 上门服务 · 明码标价</div>' +
      "</div>"
    );
  }

  function renderMaster(m) {
    const name = m.name || "师傅";
    const code = m.code || "";
    const avatar = m.avatarUrl
      ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="' + escapeHtml(name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : escapeHtml(store.firstChar(name));
    const tagsHtml = (m.tags || []).slice(0, 3).map(function (t) {
      return '<span class="master-card__tag">' + escapeHtml(t) + "</span>";
    }).join("");
    const rating = m.rating_avg ? Number(m.rating_avg).toFixed(1) : "5.0";
    const ratingCount = m.rating_count || 0;
    const price = m.priceRange || "面议";
    const bio = m.bio ? escapeHtml(m.bio) : "从业多年，专业上门服务";
    const cat = findCat(currentCategory);

    return (
      '<a class="master-card" href="#/master/' + encodeURIComponent(code) + '">' +
        '<div class="master-card__avatar">' + avatar + "</div>" +
        '<div class="master-card__body">' +
          '<div class="master-card__head">' +
            '<span class="master-card__name">' + escapeHtml(name) + "</span>" +
            (cat ? '<span class="badge badge--accent" style="margin-left:auto">' + escapeHtml(cat.name) + "</span>" : "") +
          "</div>" +
          (tagsHtml ? '<div class="master-card__tags">' + tagsHtml + "</div>" : "") +
          '<div class="master-card__meta">' +
            '<span class="master-card__rating"><span data-icon="star"></span>' + rating + " · " + ratingCount + "评</span>" +
            (m.city ? '<span style="color:var(--text-3);font-size:12px"><span data-icon="location"></span>' + escapeHtml(m.city) + (m.district ? "·" + escapeHtml(m.district) : "") + "</span>" : "") +
            '<span class="master-card__price">' + escapeHtml(price) + "</span>" +
          "</div>" +
          '<div class="master-card__bio">' + bio + "</div>" +
        "</div>" +
      "</a>"
    );
  }

  async function loadMasters() {
    if (loading) return;
    loading = true;
    const host = document.getElementById("master-host");
    if (!host) return;
    if (host.children.length === 0) {
      host.innerHTML = '<div class="list-status">加载中…</div>';
    }
    try {
      const params = { category: currentCategory, city: currentCity };
      const r = await api.listMasters(params);
      const list = r.masters || [];
      if (r.cities && r.cities.length && cities.join(",") !== r.cities.join(",")) {
        cities = r.cities;
        const cityHost = document.getElementById("city-chips");
        if (cityHost) { cityHost.innerHTML = renderCityChips(); bindCityChips(); }
      }
      // 二级筛选在前端做（如有 sub）
      let filtered = list;
      if (currentSub) {
        filtered = list.filter(function (m) {
          // 后端没有直接返回 services.subcategory，所以这里在 tags / name 上找关键字
          const cat = findCat(currentCategory);
          const sub = cat && cat.subs ? cat.subs.find(function (s) { return s.key === currentSub; }) : null;
          if (!sub) return true;
          // 弱匹配：师傅 tags 包含子类名 或 bio 包含
          const tags = (m.tags || []).join(",");
          return tags.indexOf(sub.name) >= 0 || (m.bio || "").indexOf(sub.name) >= 0;
        });
      }
      if (filtered.length === 0) {
        host.innerHTML =
          '<div class="empty"><div class="empty__icon"><span data-icon="search"></span></div>' +
          "暂无符合条件的师傅" +
          '<div class="empty__action"><a class="btn btn--soft btn--sm" href="#/home">返回首页</a></div>' +
          "</div>";
      } else {
        host.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + filtered.map(renderMaster).join("") + "</div>";
      }
    } catch (e) {
      host.innerHTML =
        '<div class="empty"><div class="empty__icon"><span data-icon="alert-circle"></span></div>' +
        escapeHtml(e.message || "加载失败") +
        '<div class="empty__action"><button class="btn btn--soft btn--sm" id="retry-btn">重试</button></div></div>';
      const retry = document.getElementById("retry-btn");
      if (retry) retry.addEventListener("click", function () { loadMasters(); });
    } finally {
      loading = false;
      if (icons) icons.render(host);
    }
  }

  function bindCityChips() {
    const host = document.getElementById("city-chips");
    if (!host) return;
    host.querySelectorAll(".chip").forEach(function (el) {
      el.addEventListener("click", function () {
        const c = el.getAttribute("data-city");
        currentCity = c || "";
        host.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("active"); });
        el.classList.add("active");
        loadMasters();
      });
    });
  }

  async function render(route) {
    const app = document.getElementById("app");
    if (!app) return;
    app.className = "app";
    currentCategory = (route && route.params && route.params.cat) || "repair";
    currentSub = "";
    currentCity = "";

    // 加载分类
    try {
      cats = await api.getCategories();
    } catch (e) {
      cats = (CONFIG.categories || []);
    }
    // 加载可用城市（用于城市筛选）
    try {
      const cr = await api.listMasters({ category: currentCategory, limit: 1 });
      cities = cr.cities || [];
    } catch (e) {
      cities = [];
    }

    app.innerHTML =
      renderHero() +
      '<div class="card" style="margin-bottom:12px;padding:6px">' +
        '<div class="seg" id="cat-seg">' + renderSeg() + "</div>" +
      "</div>" +
      (cities.length ? '<div class="sub-chips" id="city-chips" style="margin-bottom:8px">' + renderCityChips() + "</div>" : "") +
      '<div class="sub-chips" id="sub-chips" style="margin-bottom:12px">' + renderSubChips() + "</div>" +
      '<div id="master-host"></div>';

    if (icons) icons.render(app);

    // 绑定事件
    const seg = document.getElementById("cat-seg");
    if (seg) {
      seg.querySelectorAll(".seg__item").forEach(function (el) {
        el.addEventListener("click", function () {
          const c = el.getAttribute("data-cat");
          if (c && c !== currentCategory) {
            go("category", { cat: c });
          }
        });
      });
    }
    const chips = document.getElementById("sub-chips");
    if (chips) {
      chips.querySelectorAll(".chip").forEach(function (el) {
        el.addEventListener("click", function () {
          const s = el.getAttribute("data-sub");
          currentSub = s || "";
          chips.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("active"); });
          el.classList.add("active");
          loadMasters();
        });
      });
    }
    bindCityChips();

    // 设置标题
    const cat = findCat(currentCategory);
    if (global.router && global.router.setTitle) {
      global.router.setTitle((cat && cat.name ? cat.name : "分类") + "服务");
    }

    await loadMasters();
  }

  global.category = { render: render };
})(window);
