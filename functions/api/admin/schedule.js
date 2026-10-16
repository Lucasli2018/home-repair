// GET  /api/admin/schedule?masterId=    某师傅的 7 天排班
// POST /api/admin/schedule              upsert 排班（INSERT OR REPLACE）
// POST body: { masterId, weekday, opensAt, closesAt, slotMinutes, capacity, active }

import { json, fail, readJson } from "../../_shared/helpers.js";
import { requireSuper } from "./_guard.js";

const VALID_SLOTS = [30, 60, 90, 120];

// ============ GET 7 天排班 ============
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
    `SELECT id, weekday, opens_at, closes_at, slot_minutes, capacity, active
     FROM hr_master_schedule WHERE master_id = ? ORDER BY weekday`
  ).bind(masterId).all();

  const found = new Map();
  for (const r of (rows.results || [])) found.set(r.weekday, r);

  // 补齐 0-6 全部 7 天，缺省为 null
  const schedule = [];
  for (let w = 0; w < 7; w++) {
    schedule.push(found.get(w) || {
      id: null,
      weekday: w,
      opens_at: null,
      closes_at: null,
      slot_minutes: null,
      capacity: null,
      active: 0,
    });
  }

  return json({ master, schedule });
}

// ============ POST upsert ============
export async function onRequestPost({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const masterId = parseInt(body.masterId, 10);
  const weekday = parseInt(body.weekday, 10);
  const opensAt = String(body.opensAt || "");
  const closesAt = String(body.closesAt || "");
  const slotMinutes = parseInt(body.slotMinutes, 10);
  const capacity = parseInt(body.capacity, 10);
  const active = body.active === false || body.active === 0 ? 0 : 1;

  if (!masterId) return fail("缺少 masterId");
  if (weekday < 0 || weekday > 6) return fail("weekday 必须为 0-6");
  if (!/^\d{2}:\d{2}$/.test(opensAt)) return fail("opensAt 格式应为 HH:MM");
  if (!/^\d{2}:\d{2}$/.test(closesAt)) return fail("closesAt 格式应为 HH:MM");
  if (opensAt >= closesAt) return fail("opensAt 必须早于 closesAt");
  if (!VALID_SLOTS.includes(slotMinutes)) return fail("slotMinutes 必须为 30/60/90/120");
  if (!capacity || capacity < 1 || capacity > 5) return fail("capacity 必须为 1-5");

  const master = await env.DB.prepare("SELECT id FROM hr_masters WHERE id = ?").bind(masterId).first();
  if (!master) return fail("师傅不存在", 404);

  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO hr_master_schedule
        (master_id, weekday, opens_at, closes_at, slot_minutes, capacity, active)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(masterId, weekday, opensAt, closesAt, slotMinutes, capacity, active).run();
  } catch (err) {
    console.error("admin schedule upsert failed:", err);
    return fail("保存失败", 500);
  }

  const row = await env.DB.prepare(
    "SELECT * FROM hr_master_schedule WHERE master_id = ? AND weekday = ?"
  ).bind(masterId, weekday).first();

  return json({ schedule: row });
}
