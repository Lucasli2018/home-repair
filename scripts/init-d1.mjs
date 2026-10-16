// home-repair · 把 schema.sql（建表 + 基础种子 + 测试数据）应用到共享 dev 库（幂等）
// 数据源：Cloudflare 共享 dev 库（database_id=3c83aee3-...-6488750deeb4），本项目表统一带 hr_ 前缀。
// 运行：node scripts/init-d1.mjs   （需本机 Machine 级 CLOUDFLARE_API_TOKEN，或环境变量 CF_TOKEN）
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DB_ID = "3c83aee3-4645-450b-b50b-6488750deeb4";
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "332b848d9f5d9ec2808bdb855763eb8e";

let TOKEN = process.env.CF_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
if (!TOKEN) {
  try {
    TOKEN = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN','Machine')"],
      { encoding: "utf8" }
    ).trim();
  } catch { TOKEN = ""; }
}
if (!TOKEN) {
  console.error("缺少 CF_TOKEN / CLOUDFLARE_API_TOKEN（请确认本机 Machine 级环境变量已设置）");
  process.exit(1);
}

const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

async function query(sqlText) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: sqlText }),
  });
  const j = await res.json();
  if (!j.success) {
    console.error("查询失败：", JSON.stringify(j.errors || j, null, 2));
    process.exit(1);
  }
  return (j.result || [])[0]?.results || [];
}

async function main() {
  // 1. 应用 schema.sql（IF NOT EXISTS / OR IGNORE，可重复执行）
  await query(sql);
  console.log("✅ schema.sql 已应用到共享 dev 库（hr_ 表 + 基础种子 + 测试数据）");

  // 2. 自检：表清单 + 行数
  const tables = await query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hr_%' ORDER BY name"
  );
  console.log(`\n共 ${tables.length} 张 hr_ 表：`);
  for (const t of tables) {
    const rows = await query(`SELECT COUNT(*) AS c FROM ${t.name}`);
    console.log(`  ${t.name.padEnd(24)} ${rows[0].c} 行`);
  }

  // 3. 演示数据概览
  const stat = await query(
    "SELECT status, COUNT(*) AS c FROM hr_bookings GROUP BY status ORDER BY status"
  );
  console.log("\n预约单状态分布：", stat.map((s) => `${s.status}=${s.c}`).join("  "));
}

main().catch((e) => { console.error("异常：", e.message); process.exit(1); });
