// POST /api/my/:id/cancel
// 用户取消订单（body: {phone} 校验归属）
import { json, fail, readJson, nowLocalString, maskName } from "../../../_shared/helpers.js";

export async function onRequestPost({ request, env, params }) {
  const id = parseInt(params.id, 10);
  if (!id) return fail("订单 id 无效");

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");
  const phone = (body.phone || "").trim();
  if (!phone) return fail("缺少 phone");

  const booking = await env.DB.prepare(
    "SELECT * FROM bookings WHERE id = ? AND customer_phone = ?"
  ).bind(id, phone).first();
  if (!booking) return fail("订单不存在或无权操作", 404);

  if (booking.status === "done") return fail("已完成的订单无法取消");
  if (booking.status === "cancelled") return fail("订单已是取消状态");
  if (booking.status === "rejected") return fail("订单已被拒绝");

  const now = nowLocalString();
  await env.DB.prepare(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?`
  ).bind(now, now, id).run();

  return json({ message: "已取消", id, status: "cancelled" });
}
