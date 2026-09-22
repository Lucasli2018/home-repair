// POST /api/my/:id/review
// 用户评价（body: {phone, rating, content}）
// 要求：订单 status=done 且未评过
import { json, fail, readJson, maskName } from "../../../_shared/helpers.js";

export async function onRequestPost({ request, env, params }) {
  const id = parseInt(params.id, 10);
  if (!id) return fail("订单 id 无效");

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");
  const phone = (body.phone || "").trim();
  const rating = parseInt(body.rating, 10);
  const content = body.content ? String(body.content).trim().slice(0, 500) : null;

  if (!phone) return fail("缺少 phone");
  if (!rating || rating < 1 || rating > 5) return fail("评分 1-5 分");

  const booking = await env.DB.prepare(
    "SELECT * FROM bookings WHERE id = ? AND customer_phone = ?"
  ).bind(id, phone).first();
  if (!booking) return fail("订单不存在或无权操作", 404);

  if (booking.status !== "done") return fail("只有已完成的订单可评价");

  // 检查是否已评过
  const existed = await env.DB.prepare(
    "SELECT id FROM reviews WHERE booking_id = ?"
  ).bind(id).first();
  if (existed) return fail("该订单已评价过");

  try {
    // 插入评价（UNIQUE(booking_id) 兜底防重）
    const result = await env.DB.prepare(
      `INSERT INTO reviews(booking_id, master_id, customer_name, rating, content)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, booking.master_id, maskName(booking.customer_name), rating, content).run();

    // 聚合更新师傅评分
    await env.DB.prepare(
      `UPDATE masters SET
        rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE master_id = ? AND hidden = 0),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE master_id = ? AND hidden = 0),
        updated_at = datetime('now','+8 hours')
       WHERE id = ?`
    ).bind(booking.master_id, booking.master_id, booking.master_id).run();

    return json({
      reviewId: result.meta.last_row_id,
      rating, content,
      message: "评价成功",
    }, 201);
  } catch (err) {
    console.error("review insert failed:", err);
    return fail("评价失败，请稍后重试", 500);
  }
}
