// GET /api/admin/reviews?masterId=  评价列表（含 hidden 状态）

import { json, fail } from "../../_shared/helpers.js";
import { requireAdmin } from "./_guard.js";

export async function onRequestGet({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  // master 角色只能看自己师傅的评价
  let scopedMasterId = null;
  if (g.account.role === "master") {
    scopedMasterId = g.account.master_id;
    if (!scopedMasterId) return fail("该账号未绑定师傅", 403);
  }

  const url = new URL(request.url);
  const masterIdParam = parseInt(url.searchParams.get("masterId"), 10) || null;
  const masterId = scopedMasterId || masterIdParam;

  let sql = `SELECT r.id, r.booking_id, r.master_id, r.customer_name, r.rating, r.content,
    r.hidden, r.created_at,
    m.name AS master_name, m.code AS master_code,
    b.scheduled_at AS booking_scheduled_at, b.service_id,
    s.name AS service_name
    FROM hr_reviews r
    JOIN hr_masters m ON r.master_id = m.id
    JOIN hr_bookings b ON r.booking_id = b.id
    LEFT JOIN hr_services s ON b.service_id = s.id
    WHERE 1=1`;
  const binds = [];
  if (masterId) {
    sql += ` AND r.master_id = ?`;
    binds.push(masterId);
  }
  sql += ` ORDER BY r.created_at DESC LIMIT 200`;

  const rows = await env.DB.prepare(sql).bind(...binds).all();

  return json({
    reviews: rows.results || [],
    filter: { masterId },
  });
}
