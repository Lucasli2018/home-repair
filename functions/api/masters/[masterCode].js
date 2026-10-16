// GET /api/masters/:masterCode
// 师傅详情 + 服务列表 + 证书 URL + 最近 10 条评价

import { json, fail, requireMaster } from "../../_shared/helpers.js";

export async function onRequestGet({ env, params }) {
  const { masterCode } = params;
  const r = await requireMaster(env, masterCode);
  if (r.error) return fail(r.error, 404);
  const m = r.master;

  // 技能标签
  const tags = await env.DB.prepare(
    "SELECT tag FROM hr_master_tags WHERE master_id = ?"
  ).bind(m.id).all();

  // 证书
  const certs = await env.DB.prepare(
    "SELECT id, cert_key, title, sort_order FROM hr_master_certificates WHERE master_id = ? ORDER BY sort_order"
  ).bind(m.id).all();

  // 服务列表
  const svcs = await env.DB.prepare(
    "SELECT id, name, description, duration_min, price_cents, category, subcategory, sort_order, active FROM hr_services WHERE master_id = ? AND active = 1 ORDER BY sort_order"
  ).bind(m.id).all();

  // 最近 10 条评价
  const reviews = await env.DB.prepare(
    `SELECT r.id, r.customer_name, r.rating, r.content, r.created_at
     FROM hr_reviews r WHERE r.master_id = ? AND r.hidden = 0
     ORDER BY r.created_at DESC LIMIT 10`
  ).bind(m.id).all();

  return json({
    master: {
      id: m.id,
      code: m.code,
      name: m.name,
      avatarUrl: m.avatar_key ? `/api/image/${m.avatar_key}` : null,
      bio: m.bio,
      city: m.city,
      district: m.district,
      ratingAvg: m.rating_avg,
      ratingCount: m.rating_count,
      priceMinCents: m.price_min_cents,
      priceMaxCents: m.price_max_cents,
      priceRange: m.price_min_cents && m.price_max_cents
        ? `¥${(m.price_min_cents / 100).toFixed(0)}-${(m.price_max_cents / 100).toFixed(0)}`
        : "面议",
    },
    tags: (tags.results || []).map(t => t.tag),
    certificates: (certs.results || []).map(c => ({
      id: c.id,
      title: c.title,
      url: `/api/image/${c.cert_key}`,
    })),
    services: svcs.results || [],
    reviews: reviews.results || [],
  });
}
