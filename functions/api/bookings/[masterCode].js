// POST /api/bookings/:masterCode
// 提交预约。Body: { serviceId, scheduledAt, customerName, customerPhone, customerAddress, note, customerEmail }
// 关键：原子 INSERT ... WHERE NOT EXISTS 防止并发冲突

import {
  json, fail, readJson, requireMaster,
  addMinutes, nowLocalString,
} from "../../_shared/helpers.js";

export async function onRequestPost({ request, env, params }) {
  const { masterCode } = params;
  const r = await requireMaster(env, masterCode);
  if (r.error) return fail(r.error, 404);
  const m = r.master;

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const serviceId = parseInt(body.serviceId, 10);
  const scheduledAt = body.scheduledAt;
  const name = (body.customerName || "").trim();
  const phone = (body.customerPhone || "").trim();
  const address = (body.customerAddress || "").trim();
  const note = body.note ? String(body.note).trim().slice(0, 500) : null;
  const email = body.customerEmail ? String(body.customerEmail).trim().slice(0, 100) : null;

  if (!serviceId) return fail("缺少 serviceId");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(scheduledAt || "")) {
    return fail("时间格式错误，需要 'YYYY-MM-DD HH:MM'");
  }
  if (!name || name.length < 1 || name.length > 50) return fail("姓名必填，1-50 字");
  if (!/^\+?\d{7,20}$/.test(phone)) return fail("手机号格式错误（7-20 位数字，可带 +）");
  if (!address || address.length < 5 || address.length > 200) {
    return fail("上门地址必填，5-200 字");
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail("邮箱格式不正确");
  }

  // 校验服务存在
  const service = await env.DB.prepare(
    "SELECT * FROM hr_services WHERE id = ? AND master_id = ? AND active = 1"
  ).bind(serviceId, m.id).first();
  if (!service) return fail("服务不存在", 404);

  // 校验日期在排班时间内
  const date = scheduledAt.slice(0, 10);
  const time = scheduledAt.slice(11);
  const schedule = await env.DB.prepare(`
    SELECT * FROM hr_master_schedule
    WHERE master_id = ? AND weekday = strftime('%w', ?) AND active = 1
  `).bind(m.id, date).first();
  if (!schedule) return fail("该日师傅不接单");
  if (time < schedule.opens_at || time >= schedule.closes_at) {
    return fail("时间在接单时段外");
  }

  const now = nowLocalString();
  if (scheduledAt <= now) return fail("时间已过期");

  // 原子插入
  try {
    const end = addMinutes(scheduledAt, service.duration_min);
    const result = await env.DB.prepare(`
      INSERT INTO hr_bookings
        (master_id, service_id, customer_name, customer_phone,
         customer_address, scheduled_at, duration_min, status, note, customer_email)
      SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
      WHERE (
        SELECT COUNT(*) FROM hr_bookings b
        WHERE b.master_id = ?
          AND b.status IN ('pending','confirmed','done')
          AND b.scheduled_at < ?
          AND datetime(b.scheduled_at, '+' || b.duration_min || ' minutes') > ?
      ) < (
        SELECT COALESCE(MAX(capacity), 1) FROM hr_master_schedule
        WHERE master_id = ? AND weekday = strftime('%w', ?) AND active = 1
      )
    `).bind(
      m.id, serviceId, name, phone, address, scheduledAt, service.duration_min, note, email,
      m.id, end, scheduledAt,
      m.id, date
    ).run();

    const id = result.meta.last_row_id;
    if (!result.meta.changes || !id) {
      return fail("该时段容量已满，请重新选择", 409);
    }

    return json({
      booking: {
        id,
        masterId: m.id,
        masterCode: m.code,
        masterName: m.name,
        serviceId,
        serviceName: service.name,
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        scheduledAt,
        durationMin: service.duration_min,
        status: "pending",
        note,
        priceCents: service.price_cents,
      },
      message: "预约成功，等待师傅确认",
    }, 201);
  } catch (err) {
    console.error("booking insert failed:", err);
    return fail("预约失败，请稍后重试", 500);
  }
}
