// 后台守卫：校验 session + 角色
import { requireSession } from "../../_shared/helpers.js";

export async function requireAdmin(env, request) {
  const r = await requireSession(env, request);
  if (r.error) return r;
  if (r.account.role !== "super" && r.account.role !== "master") {
    return { error: "无权限", status: 403 };
  }
  return r;
}

export async function requireSuper(env, request) {
  const r = await requireSession(env, request);
  if (r.error) return r;
  if (r.account.role !== "super") {
    return { error: "需要超级管理员权限", status: 403 };
  }
  return r;
}
