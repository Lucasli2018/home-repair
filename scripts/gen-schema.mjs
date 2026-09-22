// 由单一数据源（functions/_shared/schema.js + seed-test.js）生成 schema.sql
// schema.sql 是远程 D1 的初始化脚本（建表 + 基础种子 + 测试数据）。
// 用法：node scripts/gen-schema.mjs
// 改了表结构/种子/测试数据后重跑本脚本，再 wrangler d1 execute ... --file=schema.sql

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCHEMA_STATEMENTS, BASE_SEED_STATEMENTS } from "../functions/_shared/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// 测试数据模块可选（未创建时为空数组）
let TEST_DATA_STATEMENTS = [];
try {
  const mod = await import("../functions/_shared/seed-test.js");
  TEST_DATA_STATEMENTS = mod.TEST_DATA_STATEMENTS || [];
} catch {
  TEST_DATA_STATEMENTS = [];
}

const HEADER = `-- home-repair D1 初始化 schema（由 scripts/gen-schema.mjs 自动生成，请勿手改）
-- 建表 + 基础种子 + 测试数据。
-- 全新库：        wrangler d1 execute home-repair-db --remote --file=schema.sql
-- 本地开发无需执行（_middleware 首访自动建表 + 基础种子）

`;

const all = [...SCHEMA_STATEMENTS, ...BASE_SEED_STATEMENTS, ...TEST_DATA_STATEMENTS];
const sql = HEADER + all.map((s) => s.trim().replace(/\s+/g, " ").replace(/;\s*$/, "") + ";\n").join("\n");

const outPath = join(root, "schema.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`[gen-schema] 已生成 ${outPath}`);
console.log(`[gen-schema] 语句数: schema=${SCHEMA_STATEMENTS.length}, base_seed=${BASE_SEED_STATEMENTS.length}, test_data=${TEST_DATA_STATEMENTS.length}`);
