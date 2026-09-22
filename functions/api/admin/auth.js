// POST /api/admin/auth
// 后台登录：校验账号密码，生成 24h session token
// body: { username, password }
// 返回: { token, account: { id, username, role, masterId } }

import {
  json, fail, readJson, nowLocalString, addMinutes,
} from "../../_shared/helpers.js";
import { verifyPassword, genToken } from "../../_shared/crypto.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return fail("请求体必须是 JSON");

  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) return fail("账号和密码必填");

  const account = await env.DB.prepare(
    "SELECT * FROM admin_accounts WHERE username = ?"
  ).bind(username).first();

  // 恒定错误信息，避免账号枚举
  if (!account) return fail("账号或密码错误", 401);

  const ok = await verifyPassword(password, account.pass_salt, account.pass_hash);
  if (!ok) return fail("账号或密码错误", 401);

  const token = genToken(32);
  const now = nowLocalString();
  const expires = addMinutes(now, 60 * 24); // 24 小时

  try {
    await env.DB.prepare(
      "INSERT INTO admin_sessions(token, account_id, created_at, expires_at) VALUES (?,?,?,?)"
    ).bind(token, account.id, now, expires).run();

    await env.DB.prepare(
      "UPDATE admin_accounts SET last_login_at = ? WHERE id = ?"
    ).bind(now, account.id).run();
  } catch (err) {
    console.error("admin auth session insert failed:", err);
    return fail("登录失败，请稍后重试", 500);
  }

  return json({
    token,
    account: {
      id: account.id,
      username: account.username,
      role: account.role,
      masterId: account.master_id,
    },
  });
}
