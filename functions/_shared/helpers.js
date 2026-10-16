// 共享工具：JSON 响应、错误处理、session 校验、时间工具

// ============ JSON helpers ============
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ============ 师傅校验 ============
export async function getMaster(env, masterCode) {
  if (!masterCode || typeof masterCode !== "string") return null;
  return env.DB.prepare("SELECT * FROM hr_masters WHERE code = ?")
    .bind(masterCode).first();
}

export async function requireMaster(env, masterCode) {
  const master = await getMaster(env, masterCode);
  if (!master) return { error: "师傅不存在" };
  if (master.status !== "active") return { error: "师傅已暂停接单" };
  return { master };
}

// ============ Session 校验 ============
export function extractToken(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireSession(env, request) {
  const token = extractToken(request);
  if (!token) return { error: "未登录", status: 401 };

  const session = await env.DB.prepare(
    "SELECT * FROM hr_admin_sessions WHERE token = ?"
  ).bind(token).first();

  if (!session) return { error: "会话无效", status: 401 };

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (session.expires_at < now) {
    await env.DB.prepare("DELETE FROM hr_admin_sessions WHERE token = ?")
      .bind(token).run();
    return { error: "会话已过期", status: 401 };
  }

  const account = await env.DB.prepare("SELECT * FROM hr_admin_accounts WHERE id = ?")
    .bind(session.account_id).first();
  if (!account) return { error: "账户不存在", status: 401 };

  return { session, token, account };
}

// ============ 时间工具 ============
// 所有时间字符串统一格式 'YYYY-MM-DD HH:MM'（naive，本地时间）

export function nowLocalString(tz = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function weekdayOf(dateStr, tz = "Asia/Shanghai") {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCDay();
}

export function addMinutes(dateStr, minutes) {
  const [date, time] = dateStr.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes);
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;
}

// 生成候选时间点：从 opens_at 到 closes_at，每 slot_minutes 一个
export function generateTimePoints(opensAt, closesAt, slotMinutes) {
  const toMin = t => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fromMin = min => {
    const pad = n => String(n).padStart(2, "0");
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  };
  const points = [];
  for (let t = toMin(opensAt); t < toMin(closesAt); t += slotMinutes) {
    points.push(fromMin(t));
  }
  return points;
}

// ============ 姓名脱敏 ============
export function maskName(name) {
  if (!name) return "匿名用户";
  if (name.length <= 1) return name + "**";
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

// ============ 价格格式化 ============
export function formatPrice(cents) {
  if (!cents && cents !== 0) return "面议";
  return "¥" + (cents / 100).toFixed(0);
}
