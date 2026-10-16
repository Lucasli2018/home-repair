// GET /api/masters?category=&q=&page=&limit=
// 师傅列表（不返回 phone）

import { json, fail } from "../../_shared/helpers.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 20));
  const offset = (page - 1) * limit;

  let sql = `SELECT id, code, name, avatar_key, bio, city, district,
    rating_avg, rating_count, price_min_cents, price_max_cents, status, sort_order
    FROM hr_masters WHERE status = 'active'`;
  const binds = [];

  if (category) {
    sql += ` AND id IN (SELECT DISTINCT master_id FROM hr_services WHERE category = ? AND active = 1)`;
    binds.push(category);
  }
  if (city) {
    sql += ` AND city = ?`;
    binds.push(city);
  }
  if (q) {
    sql += ` AND (name LIKE ? OR bio LIKE ? OR id IN (SELECT master_id FROM hr_master_tags WHERE tag LIKE ?))`;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY rating_avg DESC, sort_order ASC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const rows = await env.DB.prepare(sql).bind(...binds).all();

  const list = (rows.results || []).map(m => ({
    ...m,
    avatarUrl: m.avatar_key ? `/api/image/${m.avatar_key}` : null,
    priceRange: m.price_min_cents && m.price_max_cents
      ? `¥${(m.price_min_cents / 100).toFixed(0)}-${(m.price_max_cents / 100).toFixed(0)}`
      : "面议",
  }));

  // 补每个师傅的标签
  for (const m of list) {
    const tags = await env.DB.prepare(
      "SELECT tag FROM hr_master_tags WHERE master_id = ?"
    ).bind(m.id).all();
    m.tags = (tags.results || []).map(t => t.tag);
  }

  // 可用城市列表（供前端筛选）
  const cityRows = await env.DB.prepare(
    `SELECT DISTINCT city FROM hr_masters WHERE status = 'active' ORDER BY city`
  ).all();
  const cities = (cityRows.results || []).map(c => c.city);

  return json({ masters: list, cities, page, limit });
}
