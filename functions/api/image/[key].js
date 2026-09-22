// GET /api/image/:key
// 公开读取 R2 中的图片（师傅头像/证书）
// 安全：decodeURIComponent → 拒绝含 .. 或以 / 开头 → 必须以 master- 前缀开头

export async function onRequestGet({ env, params }) {
  let key = params.key;
  if (!key) return new Response("Not Found", { status: 404 });

  try {
    key = decodeURIComponent(key);
  } catch {
    return new Response("Bad Key", { status: 400 });
  }

  if (!key.startsWith("master-")) return new Response("Forbidden", { status: 403 });
  if (key.includes("..") || key.startsWith("/")) return new Response("Bad Key", { status: 400 });

  const obj = await env.R2.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");

  return new Response(obj.body, { headers });
}
