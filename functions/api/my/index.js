// GET /api/my?phone=&status=
// 我的订单（按手机号查询）

import { json, fail, maskName } from "../../_shared/helpers.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") || "").trim();
  const status = url.searchParams.get("status") || "";

  if (!phone) return fail("缺少 phone 参数");
  if (!/^\+?\d{7,20}$/.test(phone)) return fail("手机号格式错误");

  let sql = `SELECT b.id, b.master_id, b.service_id, b.customer_name, b.customer_phone,
    b.customer_address, b.scheduled_at, b.duration_min, b.status, b.note, b.created_at,
    m.name AS master_name, m.code AS master_code, m.avatar_key AS master_avatar_key,
    s.name AS service_name, s.price_cents AS service_price_cents, s.category
    FROM bookings b
    JOIN masters m ON b.master_id = m.id
    JOIN services s ON b.service_id = s.id
    WHERE b.customer_phone = ?`;
  const binds = [phone];
  if (status) {
    sql += ` AND b.status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY b.scheduled_at DESC`;

  const rows = await env.DB.prepare(sql).bind(...binds).all();

  const list = (rows.results || []).map(b => ({
    ...b,
    masterAvatarUrl: b.master_avatar_key ? `/api/image/${b.master_avatar_key}` : null,
  }));

  // 标记已评价
  for (const b of list) {
    const r = await env.DB.prepare(
      "SELECT id, rating, content FROM reviews WHERE booking_id = ? AND hidden = 0"
    ).bind(b.id).first();
    b.review = r || null;
  }

  return json({ orders: list });
}
