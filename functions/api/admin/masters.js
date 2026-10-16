// GET  /api/admin/masters?status=&page=&limit=  师傅列表
// POST /api/admin/masters                          创建师傅
// POST body: { code, name, bio, phone, city, district, priceMinCents, priceMaxCents,
//              status, sortOrder, tags: [] }

import { json, fail, readJson, nowLocalString } from "../../_shared/helpers.js";
import { requireSuper } from "./_guard.js";

// ============ GET 列表 ============
export async function onRequestGet({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 20));
  const offset = (page - 1) * limit;

  let sql = `SELECT id, code, name, avatar_key, bio, phone, city, district,
    rating_avg, rating_count, price_min_cents, price_max_cents, status, sort_order,
    created_at, updated_at
    FROM hr_masters WHERE 1=1`;
  const binds = [];
  if (status) {
    sql += ` AND status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  const list = (rows.results || []).map(m => ({
    ...m,
    avatarUrl: m.avatar_key ? `/api/image/${m.avatar_key}` : null,
  }));

  // 每个师傅附标签
  for (const m of list) {
    const tags = await env.DB.prepare(
      "SELECT tag FROM hr_master_tags WHERE master_id = ? ORDER BY tag"
    ).bind(m.id).all();
    m.tags = (tags.results || []).map(t => t.tag);
  }

  // 总数
  let cntSql = "SELECT COUNT(*) AS c FROM hr_masters WHERE 1=1";
  const cntBinds = [];
  if (status) { cntSql += " AND status = ?"; cntBinds.push(status); }
  const cnt = await env.DB.prepare(cntSql).bind(...cntBinds).first();

  return json({
    masters: list,
    page,
    limit,
    total: cnt ? cnt.c : 0,
  });
}

// ============ POST 创建 ============
export async function onRequestPost({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const code = (body.code || "").trim();
  const name = (body.name || "").trim();
  const bio = body.bio ? String(body.bio).trim().slice(0, 500) : null;
  const phone = (body.phone || "").trim();
  const city = (body.city || "上海").trim() || "上海";
  const district = body.district ? String(body.district).trim() : null;
  const priceMinCents = body.priceMinCents ? parseInt(body.priceMinCents, 10) : null;
  const priceMaxCents = body.priceMaxCents ? parseInt(body.priceMaxCents, 10) : null;
  const status = body.status === "paused" ? "paused" : "active";
  const sortOrder = parseInt(body.sortOrder, 10) || 0;
  let tags = Array.isArray(body.tags) ? body.tags : [];

  if (!code || code.length > 60) return fail("code 必填，1-60 字");
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) return fail("code 仅允许字母数字、下划线、短横线");
  if (!name || name.length > 30) return fail("name 必填，1-30 字");
  if (phone && !/^\+?\d{7,20}$/.test(phone)) return fail("手机号格式错误");
  if (priceMinCents !== null && priceMinCents < 0) return fail("最低价不能为负");
  if (priceMaxCents !== null && priceMaxCents < 0) return fail("最高价不能为负");
  if (priceMinCents !== null && priceMaxCents !== null && priceMinCents > priceMaxCents) {
    return fail("最低价不能高于最高价");
  }

  tags = tags
    .map(t => String(t).trim())
    .filter(t => t && t.length <= 20)
    .slice(0, 20);

  const now = nowLocalString();
  let id;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO hr_masters(code, name, bio, phone, city, district,
        price_min_cents, price_max_cents, status, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(code, name, bio, phone, city, district,
      priceMinCents, priceMaxCents, status, sortOrder, now, now).run();
    id = result.meta.last_row_id;
  } catch (err) {
    if (String(err).includes("UNIQUE")) return fail("code 已存在", 409);
    console.error("admin masters create failed:", err);
    return fail("创建失败", 500);
  }

  // 批量插标签
  if (tags.length) {
    for (const t of tags) {
      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO hr_master_tags(master_id, tag) VALUES (?,?)"
        ).bind(id, t).run();
      } catch (err) {
        console.error("tag insert failed:", err);
      }
    }
  }

  return json({
    master: {
      id, code, name, bio, phone, city, district,
      priceMinCents, priceMaxCents, status, sortOrder,
      tags,
      ratingAvg: 0, ratingCount: 0,
      avatarUrl: null,
    },
  }, 201);
}
