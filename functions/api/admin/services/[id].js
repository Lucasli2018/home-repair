// PUT    /api/admin/services/:id  更新服务
// DELETE /api/admin/services/:id  删除服务

import { json, fail, readJson, nowLocalString } from "../../../_shared/helpers.js";
import { requireSuper } from "../_guard.js";

const VALID_CATEGORIES = ["repair", "cleaning", "install", "other"];

async function getService(env, id) {
  return env.DB.prepare("SELECT * FROM services WHERE id = ?").bind(id).first();
}

// ============ PUT 更新 ============
export async function onRequestPut({ request, env, params }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const svc = await getService(env, id);
  if (!svc) return fail("服务不存在", 404);

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const fields = [];
  const binds = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 60) return fail("name 1-60 字");
    fields.push("name = ?"); binds.push(name);
  }
  if (body.description !== undefined) {
    fields.push("description = ?"); binds.push(body.description ? String(body.description).trim().slice(0, 300) : null);
  }
  if (body.durationMin !== undefined) {
    const d = parseInt(body.durationMin, 10);
    if (!d || d <= 0) return fail("durationMin 必须为正整数");
    fields.push("duration_min = ?"); binds.push(d);
  }
  if (body.priceCents !== undefined) {
    const v = body.priceCents === null ? null : parseInt(body.priceCents, 10);
    if (v !== null && v < 0) return fail("priceCents 不能为负");
    fields.push("price_cents = ?"); binds.push(v);
  }
  if (body.category !== undefined) {
    const c = String(body.category);
    if (!VALID_CATEGORIES.includes(c)) return fail("category 非法");
    fields.push("category = ?"); binds.push(c);
  }
  if (body.subcategory !== undefined) {
    fields.push("subcategory = ?"); binds.push(body.subcategory ? String(body.subcategory).trim() : null);
  }
  if (body.sortOrder !== undefined) {
    fields.push("sort_order = ?"); binds.push(parseInt(body.sortOrder, 10) || 0);
  }
  if (body.active !== undefined) {
    fields.push("active = ?"); binds.push(body.active === false || body.active === 0 ? 0 : 1);
  }

  if (fields.length) {
    fields.push("updated_at = ?");
    binds.push(nowLocalString());
    binds.push(id);
    try {
      await env.DB.prepare(
        `UPDATE services SET ${fields.join(", ")} WHERE id = ?`
      ).bind(...binds).run();
    } catch (err) {
      console.error("admin services update failed:", err);
      return fail("更新失败", 500);
    }
  }

  const fresh = await getService(env, id);
  return json({ service: fresh });
}

// ============ DELETE 删除 ============
export async function onRequestDelete({ request, env, params }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const svc = await getService(env, id);
  if (!svc) return fail("服务不存在", 404);

  // 关联的 bookings 也会因 ON DELETE CASCADE 被删除，避免悬空
  await env.DB.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
  return json({ message: "已删除", id });
}
