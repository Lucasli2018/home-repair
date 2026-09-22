// 全局中间件：CORS、首访自动建表 + 基础种子、播种 admin 账号
// 建表 DDL 与基础种子统一来自 functions/_shared/schema.js（单一数据源），
// 不再内联重复 SQL。远程 D1 初始化用 scripts/gen-schema.mjs 生成的 schema.sql。

import { hashPassword, genSalt } from "./_shared/crypto.js";
import { SCHEMA_STATEMENTS, BASE_SEED_STATEMENTS } from "./_shared/schema.js";

let dbReady = false;
let seeding = false;
let accountsReady = false;

async function ensureDatabase(env) {
  if (dbReady || seeding) return;
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='masters'"
    ).first();
    if (result) {
      dbReady = true;
      return;
    }

    seeding = true;
    console.log("[middleware] 首次访问，初始化数据库 schema + 基础种子…");

    // 建表（每条一条语句）
    for (const sql of SCHEMA_STATEMENTS) {
      await env.DB.prepare(sql).run();
    }
    // 基础种子（师傅/标签/服务/排班）
    for (const sql of BASE_SEED_STATEMENTS) {
      await env.DB.prepare(sql).run();
    }

    console.log("[middleware] 数据库初始化完成");
    dbReady = true;
  } catch (err) {
    console.error("[middleware] 数据库初始化失败:", err);
  } finally {
    seeding = false;
  }
}

async function ensureAccounts(env) {
  if (accountsReady) return;
  try {
    // 给没有账号的情况播种默认 super 账号 admin / admin123
    const cnt = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM admin_accounts WHERE role = 'super'`
    ).first();
    if (cnt && cnt.c === 0) {
      const salt = genSalt(16);
      const hash = await hashPassword("admin123", salt);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_accounts(username, pass_hash, pass_salt, role, created_at)
         VALUES ('admin', ?, ?, 'super', datetime('now','+8 hours'))`
      ).bind(hash, salt).run();
      console.log("[middleware] 已播种默认管理员 admin / admin123");
    }
    accountsReady = true;
  } catch (err) {
    console.error("[middleware] 账号初始化失败:", err);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const origin = request.headers.get("origin") || "*";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  await ensureDatabase(env);
  await ensureAccounts(env);

  const originalNext = context.next;
  context.next = async (nextContext) => {
    const response = await originalNext(nextContext);
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  };

  return context.next();
}
