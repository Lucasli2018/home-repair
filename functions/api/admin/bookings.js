// GET /api/admin/bookings?masterId=&status=&date=  订单列表 + 今日统计

import { json, fail, nowLocalString } from "../../_shared/helpers.js";
import { requireAdmin } from "./_guard.js";

const VALID_STATUS = ["pending", "confirmed", "done", "cancelled", "rejected"];

// ============ GET 订单列表 ============
export async function onRequestGet({ request, env }) {
  const g = await requireAdmin(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  // master 角色只能看自己师傅的订单
  let scopedMasterId = null;
  if (g.account.role === "master") {
    scopedMasterId = g.account.master_id;
    if (!scopedMasterId) return fail("该账号未绑定师傅", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const date = url.searchParams.get("date") || "";
  const masterIdParam = parseInt(url.searchParams.get("masterId"), 10) || null;
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 50));
  const offset = (page - 1) * limit;

  if (status && !VALID_STATUS.includes(status)) return fail("status 非法");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("date 格式应为 YYYY-MM-DD");

  const masterId = scopedMasterId || masterIdParam;

  let sql = `SELECT b.id, b.master_id, b.service_id, b.customer_name, b.customer_phone,
    b.customer_address, b.scheduled_at, b.duration_min, b.status, b.note, b.customer_email,
    b.confirmed_at, b.done_at, b.cancelled_at, b.rejected_at, b.created_at,
    m.name AS master_name, m.code AS master_code,
    s.name AS service_name, s.price_cents AS service_price_cents, s.category
    FROM bookings b
    JOIN masters m ON b.master_id = m.id
    JOIN services s ON b.service_id = s.id
    WHERE 1=1`;
  const binds = [];

  if (masterId) {
    sql += ` AND b.master_id = ?`;
    binds.push(masterId);
  }
  if (status) {
    sql += ` AND b.status = ?`;
    binds.push(status);
  }
  if (date) {
    sql += ` AND b.scheduled_at LIKE ?`;
    binds.push(`${date}%`);
  }
  sql += ` ORDER BY b.scheduled_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const rows = await env.DB.prepare(sql).bind(...binds).all();

  // 今日统计（今日预约：scheduled_at 落在今日；按状态分组）
  const today = nowLocalString().slice(0, 10);
  let statsSql = `SELECT b.status, COUNT(*) AS c FROM bookings b
    WHERE b.scheduled_at LIKE ?`;
  const statsBinds = [`${today}%`];
  if (masterId) {
    statsSql += ` AND b.master_id = ?`;
    statsBinds.push(masterId);
  }
  statsSql += ` GROUP BY b.status`;
  const statsRows = await env.DB.prepare(statsSql).bind(...statsBinds).all();

  const todayStats = { total: 0, pending: 0, confirmed: 0, done: 0, cancelled: 0, rejected: 0 };
  for (const r of (statsRows.results || [])) {
    todayStats[r.status] = r.c;
    todayStats.total += r.c;
  }

  return json({
    bookings: rows.results || [],
    page,
    limit,
    todayStats,
    today,
    filter: { masterId, status, date },
  });
}
