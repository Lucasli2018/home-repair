// GET /api/slots/:masterCode?serviceId=&date=
// 返回某服务在某日的可用时间段

import {
  json, fail, requireMaster,
  generateTimePoints, addMinutes, weekdayOf, nowLocalString,
} from "../../_shared/helpers.js";

export async function onRequestGet({ request, env, params }) {
  const { masterCode } = params;
  const url = new URL(request.url);
  const serviceId = parseInt(url.searchParams.get("serviceId"), 10);
  let date = url.searchParams.get("date");

  if (!serviceId) return fail("缺少 serviceId");

  const r = await requireMaster(env, masterCode);
  if (r.error) return fail(r.error, 404);
  const m = r.master;

  const service = await env.DB.prepare(
    "SELECT * FROM services WHERE id = ? AND master_id = ? AND active = 1"
  ).bind(serviceId, m.id).first();
  if (!service) return fail("服务不存在", 404);

  if (!date) {
    date = nowLocalString().slice(0, 10);
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail("日期格式错误，需要 YYYY-MM-DD");
  }

  const weekday = weekdayOf(date);
  const schedule = await env.DB.prepare(
    "SELECT * FROM master_schedule WHERE master_id = ? AND weekday = ? AND active = 1"
  ).bind(m.id, weekday).first();

  if (!schedule) {
    return json({
      master: { code: m.code },
      service: { durationMin: service.duration_min, name: service.name },
      date,
      all: [], available: [], occupied: {},
      closed: true,
      closedReason: "该日不接单",
    });
  }

  const candidateTimes = generateTimePoints(schedule.opens_at, schedule.closes_at, schedule.slot_minutes);
  const allSlots = candidateTimes.map(t => `${date} ${t}`);

  // 查占用区间
  const busy = await env.DB.prepare(`
    SELECT scheduled_at, duration_min FROM bookings
    WHERE master_id = ? AND scheduled_at LIKE ?
      AND status IN ('pending','confirmed','done')
  `).bind(m.id, `${date}%`).all();

  const busyRanges = (busy.results || []).map(b => ({
    start: b.scheduled_at,
    end: addMinutes(b.scheduled_at, b.duration_min),
  }));

  const now = nowLocalString();
  const isToday = date === now.slice(0, 10);

  const available = [];
  const occupied = {};
  const all = [];
  const capacity = Math.max(parseInt(schedule.capacity, 10) || 1, 1);

  for (const slot of allSlots) {
    const timeStr = slot.slice(11);
    all.push(timeStr);

    const slotEnd = addMinutes(slot, service.duration_min);
    const overlapCount = busyRanges.filter(br => slot < br.end && br.start < slotEnd).length;
    if (overlapCount >= capacity) {
      occupied[timeStr] = capacity > 1 ? `已满（${overlapCount}/${capacity}）` : "已被预约";
      continue;
    }

    if (isToday && slot <= now) {
      occupied[timeStr] = "已过";
      continue;
    }

    available.push(timeStr);
  }

  return json({
    master: { code: m.code },
    service: { durationMin: service.duration_min, name: service.name },
    date,
    all, available, occupied,
    closed: false,
    schedule: {
      opensAt: schedule.opens_at,
      closesAt: schedule.closes_at,
      slotMinutes: schedule.slot_minutes,
      capacity,
    },
  });
}
