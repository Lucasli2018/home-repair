// GET /api/services/:masterCode?category=
// 某师傅的服务列表

import { json, fail, requireMaster } from "../../_shared/helpers.js";

export async function onRequestGet({ request, env, params }) {
  const { masterCode } = params;
  const r = await requireMaster(env, masterCode);
  if (r.error) return fail(r.error, 404);
  const m = r.master;

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "";

  let sql = `SELECT id, name, description, duration_min, price_cents, category, subcategory, sort_order
    FROM hr_services WHERE master_id = ? AND active = 1`;
  const binds = [m.id];
  if (category) {
    sql += ` AND category = ?`;
    binds.push(category);
  }
  sql += ` ORDER BY sort_order`;

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ services: rows.results || [] });
}
