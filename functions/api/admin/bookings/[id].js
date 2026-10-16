// POST /api/admin/bookings/:id
// 状态变更：body { action: 'confirmed'|'rejected'|'done'|'cancelled' }
// 自动写入对应的 *_at 字段

import { json, fail, readJson, nowLocalString } from "../../../_shared/helpers.js";
import { requireAdmin } from "../_guard.js";

const ACTION_MAP = {
  confirmed: { status: "confirmed", at: "confirmed_at" },
  rejected: { status: "rejected", at: "rejected_at" },
  done: { status: "done", at: "done_at" },
  cancelled: { status: "cancelled", at: "cancelled_at" },
};

export async function onRequestPost({ request, env, params }) {
  const g = await requireAdmin(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");
  const action = String(body.action || "").toLowerCase();
  if (!ACTION_MAP[action]) return fail("action 必须为 confirmed/rejected/done/cancelled");

  const booking = await env.DB.prepare(
    "SELECT * FROM hr_bookings WHERE id = ?"
  ).bind(id).first();
  if (!booking) return fail("订单不存在", 404);

  // master 角色仅可操作自己师傅的订单
  if (g.account.role === "master") {
    if (!g.account.master_id) return fail("该账号未绑定师傅", 403);
    if (booking.master_id !== g.account.master_id) {
      return fail("无权操作该订单", 403);
    }
  }

  const target = ACTION_MAP[action];
  if (booking.status === target.status) {
    return fail(`订单已是 ${target.status} 状态`);
  }

  // 状态机约束：终态（cancelled/rejected/done）不可再变
  const FINAL = ["cancelled", "rejected", "done"];
  if (FINAL.includes(booking.status)) {
    return fail(`订单已 ${booking.status}，不可变更`);
  }

  const now = nowLocalString();
  try {
    await env.DB.prepare(
      `UPDATE hr_bookings SET status = ?, ${target.at} = ?, updated_at = ? WHERE id = ?`
    ).bind(target.status, now, now, id).run();
  } catch (err) {
    console.error("admin booking update failed:", err);
    return fail("更新失败", 500);
  }

  const fresh = await env.DB.prepare("SELECT * FROM hr_bookings WHERE id = ?").bind(id).first();
  return json({
    booking: fresh,
    message: `已${actionLabel(action)}`,
  });
}

function actionLabel(action) {
  switch (action) {
    case "confirmed": return "确认";
    case "rejected": return "拒绝";
    case "done": return "完成";
    case "cancelled": return "取消";
    default: return "处理";
  }
}
