// POST /api/admin/reviews/:id/hide
// 切换评价 hidden 状态（隐藏/显示违规评价），并同步重新聚合师傅评分

import { json, fail } from "../../../../_shared/helpers.js";
import { requireAdmin } from "../../_guard.js";

export async function onRequestPost({ request, env, params }) {
  const g = await requireAdmin(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  const id = parseInt(params.id, 10);
  if (!id) return fail("id 无效");

  const review = await env.DB.prepare(
    "SELECT * FROM hr_reviews WHERE id = ?"
  ).bind(id).first();
  if (!review) return fail("评价不存在", 404);

  // master 角色只能操作自己师傅的评价
  if (g.account.role === "master") {
    if (!g.account.master_id) return fail("该账号未绑定师傅", 403);
    if (review.master_id !== g.account.master_id) {
      return fail("无权操作该评价", 403);
    }
  }

  // 切换 hidden
  const newHidden = review.hidden ? 0 : 1;
  try {
    await env.DB.prepare(
      "UPDATE hr_reviews SET hidden = ? WHERE id = ?"
    ).bind(newHidden, id).run();

    // 重新聚合师傅评分（仅统计 hidden=0 的评价）
    await env.DB.prepare(
      `UPDATE hr_masters SET
        rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM hr_reviews WHERE master_id = ? AND hidden = 0),
        rating_count = (SELECT COUNT(*) FROM hr_reviews WHERE master_id = ? AND hidden = 0),
        updated_at = datetime('now','+8 hours')
       WHERE id = ?`
    ).bind(review.master_id, review.master_id, review.master_id).run();
  } catch (err) {
    console.error("admin review hide failed:", err);
    return fail("操作失败", 500);
  }

  return json({
    reviewId: id,
    hidden: newHidden,
    message: newHidden ? "已隐藏" : "已显示",
  });
}
