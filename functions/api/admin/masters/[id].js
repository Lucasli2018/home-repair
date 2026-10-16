// GET    /api/admin/masters/:id  师傅详情（含服务/排班/证书/标签）
// PUT    /api/admin/masters/:id  更新师傅
// DELETE /api/admin/masters/:id  删除师傅（级联）

import { json, fail, readJson, nowLocalString } from "../../../_shared/helpers.js";
import { requireSuper } from "../_guard.js";

async function getMaster(env, id) {
  return env.DB.prepare("SELECT * FROM hr_masters WHERE id = ?").bind(id).first();
}

// ============ GET 详情 ============
export async function onRequestGet({ request, env, params }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const m = await getMaster(env, id);
  if (!m) return fail("师傅不存在", 404);

  const tags = await env.DB.prepare(
    "SELECT tag FROM hr_master_tags WHERE master_id = ? ORDER BY tag"
  ).bind(id).all();
  const certs = await env.DB.prepare(
    "SELECT id, cert_key, title, sort_order FROM hr_master_certificates WHERE master_id = ? ORDER BY sort_order, id"
  ).bind(id).all();
  const services = await env.DB.prepare(
    `SELECT id, name, description, duration_min, price_cents, category, subcategory, sort_order, active
     FROM hr_services WHERE master_id = ? ORDER BY sort_order, id`
  ).bind(id).all();
  const schedule = await env.DB.prepare(
    `SELECT id, weekday, opens_at, closes_at, slot_minutes, capacity, active
     FROM hr_master_schedule WHERE master_id = ? ORDER BY weekday`
  ).bind(id).all();

  return json({
    master: {
      ...m,
      avatarUrl: m.avatar_key ? `/api/image/${m.avatar_key}` : null,
    },
    tags: (tags.results || []).map(t => t.tag),
    certificates: (certs.results || []).map(c => ({
      id: c.id,
      title: c.title,
      url: `/api/image/${c.cert_key}`,
      sortOrder: c.sort_order,
    })),
    services: services.results || [],
    schedule: schedule.results || [],
  });
}

// ============ PUT 更新 ============
export async function onRequestPut({ request, env, params }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const m = await getMaster(env, id);
  if (!m) return fail("师傅不存在", 404);

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  // 部分更新：仅更新提供的字段
  const fields = [];
  const binds = [];

  if (body.code !== undefined) {
    const code = String(body.code).trim();
    if (!code || code.length > 60) return fail("code 1-60 字");
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) return fail("code 仅允许字母数字、下划线、短横线");
    fields.push("code = ?"); binds.push(code);
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 30) return fail("name 1-30 字");
    fields.push("name = ?"); binds.push(name);
  }
  if (body.bio !== undefined) {
    fields.push("bio = ?"); binds.push(body.bio ? String(body.bio).trim().slice(0, 500) : null);
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone && !/^\+?\d{7,20}$/.test(phone)) return fail("手机号格式错误");
    fields.push("phone = ?"); binds.push(phone || null);
  }
  if (body.city !== undefined) {
    fields.push("city = ?"); binds.push(String(body.city).trim() || "上海");
  }
  if (body.district !== undefined) {
    fields.push("district = ?"); binds.push(body.district ? String(body.district).trim() : null);
  }
  if (body.priceMinCents !== undefined) {
    const v = body.priceMinCents === null ? null : parseInt(body.priceMinCents, 10);
    if (v !== null && v < 0) return fail("最低价不能为负");
    fields.push("price_min_cents = ?"); binds.push(v);
  }
  if (body.priceMaxCents !== undefined) {
    const v = body.priceMaxCents === null ? null : parseInt(body.priceMaxCents, 10);
    if (v !== null && v < 0) return fail("最高价不能为负");
    fields.push("price_max_cents = ?"); binds.push(v);
  }
  if (body.status !== undefined) {
    fields.push("status = ?"); binds.push(body.status === "paused" ? "paused" : "active");
  }
  if (body.sortOrder !== undefined) {
    fields.push("sort_order = ?"); binds.push(parseInt(body.sortOrder, 10) || 0);
  }

  const now = nowLocalString();
  fields.push("updated_at = ?"); binds.push(now);

  if (binds.length > 1) {
    binds.push(id);
    try {
      await env.DB.prepare(
        `UPDATE hr_masters SET ${fields.join(", ")} WHERE id = ?`
      ).bind(...binds).run();
    } catch (err) {
      if (String(err).includes("UNIQUE")) return fail("code 已存在", 409);
      console.error("admin masters update failed:", err);
      return fail("更新失败", 500);
    }
  }

  // 标签：若提供则整体替换
  if (Array.isArray(body.tags)) {
    const newTags = body.tags
      .map(t => String(t).trim())
      .filter(t => t && t.length <= 20)
      .slice(0, 20);
    await env.DB.prepare("DELETE FROM hr_master_tags WHERE master_id = ?").bind(id).run();
    for (const t of newTags) {
      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO hr_master_tags(master_id, tag) VALUES (?,?)"
        ).bind(id, t).run();
      } catch (err) {
        console.error("tag insert failed:", err);
      }
    }
  }

  const fresh = await getMaster(env, id);
  return json({
    master: {
      ...fresh,
      avatarUrl: fresh.avatar_key ? `/api/image/${fresh.avatar_key}` : null,
    },
  });
}

// ============ DELETE 级联删除 ============
export async function onRequestDelete({ request, env, params }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const m = await getMaster(env, id);
  if (!m) return fail("师傅不存在", 404);

  // 删除关联头像/证书对象（R2）
  if (m.avatar_key) {
    try { await env.R2.delete(m.avatar_key); } catch (e) { /* ignore */ }
  }
  const certs = await env.DB.prepare(
    "SELECT cert_key FROM hr_master_certificates WHERE master_id = ?"
  ).bind(id).all();
  for (const c of (certs.results || [])) {
    try { await env.R2.delete(c.cert_key); } catch (e) { /* ignore */ }
  }

  // ON DELETE CASCADE 自动清理 tags/services/schedule/bookings/reviews
  await env.DB.prepare("DELETE FROM hr_masters WHERE id = ?").bind(id).run();

  return json({ message: "已删除", id });
}
