// POST /api/admin/upload  multipart/form-data 上传图片到 R2
// 字段：file + kind(avatar|cert) + masterId + title(证书标题，kind=cert 时)
// 限制 ≤5MB，jpg/png/webp
// 生成扁平 key: master-<code>-<kind>-<ts>-<rand>.<ext>
// kind=avatar 时 UPDATE hr_masters.avatar_key
// kind=cert 时 INSERT master_certificates
// 返回 { key, url: /api/image/<key> }

import { json, fail } from "../../_shared/helpers.js";
import { requireSuper } from "./_guard.js";
import { genToken } from "../../_shared/crypto.js";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function onRequestPost({ request, env }) {
  const g = await requireSuper(env, request);
  if (g.error) return fail(g.error, g.status || 401);

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return fail("请求必须是 multipart/form-data");
  }

  const file = formData.get("file");
  const kind = String(formData.get("kind") || "");
  const masterId = parseInt(formData.get("masterId"), 10);
  const title = formData.get("title") ? String(formData.get("title")).trim().slice(0, 100) : null;

  if (!file || typeof file === "string") return fail("缺少 file 字段");
  if (kind !== "avatar" && kind !== "cert") return fail("kind 必须为 avatar 或 cert");
  if (!masterId) return fail("缺少 masterId");
  if (kind === "cert" && !title) return fail("上传证书需提供 title");

  const master = await env.DB.prepare(
    "SELECT id, code, avatar_key FROM hr_masters WHERE id = ?"
  ).bind(masterId).first();
  if (!master) return fail("师傅不存在", 404);

  // 校验类型
  const contentType = (file.type || "").toLowerCase();
  if (!ALLOWED[contentType]) {
    return fail("仅支持 jpg/png/webp 图片");
  }
  const ext = ALLOWED[contentType];

  // 校验大小
  const size = file.size;
  if (!size || size > MAX_SIZE) {
    return fail("文件大小需 ≤ 5MB");
  }

  // 生成 key: master-<code>-<kind>-<ts>-<rand>.<ext>
  const ts = Date.now();
  const rand = genToken(4); // 8 位 hex
  const safeCode = master.code.replace(/[^a-zA-Z0-9_-]/g, "-");
  const key = `master-${safeCode}-${kind}-${ts}-${rand}.${ext}`;

  try {
    // 上传到 R2
    await env.R2.put(key, file.stream(), {
      contentType,
      httpMetadata: { contentType },
    });
  } catch (err) {
    console.error("R2 put failed:", err);
    return fail("上传到 R2 失败", 500);
  }

  const url = `/api/image/${key}`;

  if (kind === "avatar") {
    // 删除旧头像（如有）
    if (master.avatar_key && master.avatar_key !== key) {
      try { await env.R2.delete(master.avatar_key); } catch (e) { /* ignore */ }
    }
    try {
      await env.DB.prepare(
        "UPDATE hr_masters SET avatar_key = ?, updated_at = datetime('now','+8 hours') WHERE id = ?"
      ).bind(key, masterId).run();
    } catch (err) {
      console.error("update avatar_key failed:", err);
      // 回滚已上传的对象
      try { await env.R2.delete(key); } catch (e) { /* ignore */ }
      return fail("保存头像失败", 500);
    }
    return json({ key, url, kind: "avatar", masterId });
  }

  // kind === "cert"
  try {
    const result = await env.DB.prepare(
      "INSERT INTO hr_master_certificates(master_id, cert_key, title, sort_order) VALUES (?,?,?,?)"
    ).bind(masterId, key, title, 0).run();
    const certId = result.meta.last_row_id;
    return json({
      key, url, kind: "cert", masterId,
      certificate: { id: certId, title, url, sortOrder: 0 },
    }, 201);
  } catch (err) {
    console.error("insert certificate failed:", err);
    try { await env.R2.delete(key); } catch (e) { /* ignore */ }
    return fail("保存证书失败", 500);
  }
}
