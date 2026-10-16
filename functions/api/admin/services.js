// GET  /api/admin/services?masterId=    某师傅的服务列表（含 active=0）
// POST /api/admin/services              创建服务
// POST body: { masterId, name, description, durationMin, priceCents, category, subcategory, sortOrder, active }

import { json, fail, readJson, nowLocalString } from "../../_shared/helpers.js";
import { requireSuper } from "./_guard.js";

const VALID_CATEGORIES = ["repair", "cleaning", "install", "other"];

// ============ GET 列表 ============
export async function onRequestGet({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const url = new URL(request.url);
  const masterId = parseInt(url.searchParams.get("masterId"), 10);
  if (!masterId) return fail("缺少 masterId 参数");

  const master = await env.DB.prepare(
    "SELECT id, code, name FROM hr_masters WHERE id = ?"
  ).bind(masterId).first();
  if (!master) return fail("师傅不存在", 404);

  const rows = await env.DB.prepare(
    `SELECT id, master_id, name, description, duration_min, price_cents, category,
     subcategory, sort_order, active, created_at, updated_at
     FROM hr_services WHERE master_id = ? ORDER BY sort_order, id`
  ).bind(masterId).all();

  return json({
    master,
    services: rows.results || [],
  });
}

// ============ POST 创建 ============
export async function onRequestPost({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const masterId = parseInt(body.masterId, 10);
  const name = (body.name || "").trim();
  const description = body.description ? String(body.description).trim().slice(0, 300) : null;
  const durationMin = parseInt(body.durationMin, 10);
  const priceCents = body.priceCents === null || body.priceCents === undefined
    ? null : parseInt(body.priceCents, 10);
  const category = String(body.category || "");
  const subcategory = body.subcategory ? String(body.subcategory).trim() : null;
  const sortOrder = parseInt(body.sortOrder, 10) || 0;
  const active = body.active === false || body.active === 0 ? 0 : 1;

  if (!masterId) return fail("缺少 masterId");
  if (!name || name.length > 60) return fail("name 1-60 字");
  if (!durationMin || durationMin <= 0) return fail("durationMin 必须为正整数");
  if (priceCents !== null && priceCents < 0) return fail("priceCents 不能为负");
  if (!VALID_CATEGORIES.includes(category)) return fail("category 非法");

  const master = await env.DB.prepare("SELECT id FROM hr_masters WHERE id = ?").bind(masterId).first();
  if (!master) return fail("师傅不存在", 404);

  const now = nowLocalString();
  let id;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO hr_services(master_id, name, description, duration_min, price_cents,
        category, subcategory, sort_order, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(masterId, name, description, durationMin, priceCents,
      category, subcategory, sortOrder, active, now, now).run();
    id = result.meta.last_row_id;
  } catch (err) {
    console.error("admin services create failed:", err);
    return fail("创建失败", 500);
  }

  return json({
    service: {
      id,
      master_id: masterId,
      name, description, duration_min: durationMin,
      price_cents: priceCents,
      category, subcategory,
      sort_order: sortOrder,
      active,
    },
  }, 201);
}
