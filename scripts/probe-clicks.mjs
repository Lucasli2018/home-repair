// 真实点击探针：无头 Chrome + CDP，逐个点击主要按钮并断言页面变化
import { spawn } from "node:child_process";

const WebSocket = globalThis.WebSocket;

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:8811";
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 全局看门狗：超时强制输出已收集结果并退出
setTimeout(() => {
  console.log("\n===== 点击探针结果（看门狗超时，部分结果） =====");
  for (const r of results) console.log((r.ok ? "PASS" : "FAIL") + " | " + r.label + (r.ok ? "" : " | " + r.why));
  console.log("FAIL count: " + results.filter((r) => !r.ok).length + "/" + results.length);
  try { chrome.kill(); } catch {}
  process.exit(2);
}, 180000);
// 启动无头 Chrome
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=F:/LLM/home-repair/.chrome-probe",
  "--window-size=414,896",
  "about:blank",
], { stdio: "ignore" });

async function getTargetWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("chrome devtools not ready");
}

const wsUrl = await getTargetWs();
const ws = new WebSocket(wsUrl);
const wsOpen = new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", () => reject(new Error("ws connect failed")), { once: true });
});
await Promise.race([wsOpen, sleep(8000).then(() => { throw new Error("ws open timeout"); })]);

let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    // 每个命令 8 秒超时，防止页面导航导致 evaluate 永远不返回
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("cdp timeout: " + method));
      }
    }, 8000);
  });
}

const consoleErrors = [];
const results = [];

// 捕获页面 console.error / 未捕获异常
ws.addEventListener("message", (ev) => {
  try {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push("console.error: " + JSON.stringify(msg.params.args).slice(0, 300));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || "").slice(0, 300));
    }
  } catch {}
});
await send("Runtime.enable");

// 等待首页渲染完成（hero 出现）
async function waitForRender(selectorExpr, timeoutMs = 12000) {
  for (let i = 0; i < timeoutMs / 300; i++) {
    const ok = await evalJs(`!!(${selectorExpr})`);
    if (ok === true) return true;
    await sleep(300);
  }
  return false;
}

async function evalJs(expr) {
  let r;
  try {
    r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  } catch (e) {
    return { __error: e.message };
  }
  if (r.result && r.result.exceptionDetails) {
    return { __error: r.result.exceptionDetails.text + " " + JSON.stringify(r.result.exceptionDetails.exception?.description || "") };
  }
  return r.result?.result?.value;
}

async function navigate(url) {
  try { await send("Page.enable"); } catch {}
  try { await send("Page.navigate", { url }); } catch (e) { console.log("nav retry: " + e.message); await sleep(500); await send("Page.navigate", { url }).catch(() => {}); }
  await sleep(1500);
}

async function clickAt(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

// 获取元素中心坐标（并检查是否被遮挡）
async function getCenter(selector) {
  const info = await evalJs(`(() => {
    const el = ${selector};
    if (!el) return null;
    el.scrollIntoView({block:'center'});
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + Math.min(r.height/2, 24);
    const top = document.elementFromPoint(cx, cy);
    const covered = top && !el.contains(top) && top !== el;
    return { x: cx, y: cy, covered: covered, topDesc: top ? top.tagName + '.' + (top.className||'').toString().slice(0,60) : 'none' };
  })()`);
  return info;
}

async function clickSel(selectorExpr, label, expectFn, waitMs = 1200) {
  await waitForRender(selectorExpr, 8000);
  const center = await getCenter(selectorExpr);
  if (!center) {
    results.push({ label, ok: false, why: "元素不存在: " + selectorExpr });
    return false;
  }
  if (center.covered) {
    results.push({ label, ok: false, why: `被遮挡 by ${center.topDesc}`, covered: true });
    // 仍然尝试点击
  }
  await clickAt(center.x, center.y);
  await sleep(waitMs);
  let expect = null;
  try { expect = await expectFn(); } catch (e) { expect = "expectErr:" + e.message; }
  const ok = expect === true;
  if (center.covered) {
    if (ok) results.push({ label, ok: true, why: "" });
    // 被遮挡时若断言也失败，只保留一条"被遮挡"记录，避免重复噪音
  } else {
    results.push({ label, ok, why: ok ? "" : "断言失败 expect=" + JSON.stringify(expect) });
  }
  return ok;
}

await navigate(BASE + "/");
await waitForRender(`#app .hero`, 15000);

// ---------- 1. 首页 ----------
await clickSel(`document.querySelector('#btn-menu')`, "顶栏菜单按钮", async () => {
  return evalJs(`document.getElementById('drawer').classList.contains('show') && document.getElementById('scrim').hidden === false`);
});
// 关闭抽屉：点屏幕右侧空白处（抽屉占左侧 296px，中心点会被抽屉自己挡住）
{
  const vw = await evalJs(`window.innerWidth`);
  await clickAt(vw - 30, 400);
  await sleep(1000);
  const ok = await evalJs(`!document.getElementById('drawer').classList.contains('show') && document.getElementById('scrim').hidden === true`);
  results.push({ label: "关闭抽屉(遮罩)", ok: ok === true, why: ok === true ? "" : "断言失败 expect=" + JSON.stringify(ok) });
}

await clickSel(`document.querySelector('#btn-search')`, "顶栏搜索按钮", async () => {
  return evalJs(`document.getElementById('search-overlay').hidden === false`);
});
await clickSel(`document.getElementById('search-close')`, "搜索关闭按钮", async () => {
  return evalJs(`document.getElementById('search-overlay').hidden === true`);
});

await clickSel(`document.querySelector('.hero__btn--solid')`, "hero 立即预约", async () => {
  return evalJs(`location.hash.includes('category')`);
});

await navigate(BASE + "/#/");
await waitForRender(`#master-list-host .master-card`, 15000);
await clickSel(`document.querySelector('#master-list-host .master-card')`, "首页师傅卡片", async () => {
  return evalJs(`location.hash.includes('master/')`);
}, 2000);

// ---------- 2. 师傅详情 → 底部立即预约 ----------
await waitForRender(`.bottom-bar .btn--primary`, 10000);
await clickSel(`document.querySelector('.bottom-bar .btn--primary')`, "师傅详情-立即预约", async () => {
  return evalJs(`location.hash.includes('booking/')`);
});
await waitForRender(`#step-host .service-item`, 10000);
await sleep(1000);

// ---------- 3. 预约流程 ----------
// 先取消历史订单释放时段，保证探针可重复执行
{
  const list = await fetch(BASE + "/api/my?phone=13800138000").then((r) => r.json()).catch(() => ({ orders: [] }));
  for (const o of list.orders || []) {
    if (o.status !== "cancelled") {
      await fetch(BASE + "/api/my/" + o.id + "/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800138000" }),
      }).catch(() => {});
    }
  }
  await sleep(500);
}
await clickSel(`document.querySelector('#step-host .service-item')`, "预约-选服务", async () => {
  return evalJs(`!!document.querySelector('#step-host .service-item.active')`);
});
await clickSel(`document.getElementById('bk-next')`, "预约-下一步(步骤1→2)", async () => {
  return evalJs(`!!document.querySelector('.date-chips')`);
});
// 选日期：直接选「明天」（今天的时段 22 点后全部已过）
{
  const tomorrow = await evalJs(`(function(){ const d=new Date(Date.now()+86400000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })()`);
  await clickSel(`document.querySelector('.date-chips .date-chip[data-date="${tomorrow}"]')`, "预约-选明天", async () => {
    return evalJs(`!!document.querySelector('.date-chip.active')`);
  }, 2500);
}
await clickSel(`document.querySelector('.slot-grid .slot:not(.slot--occupied)')`, "预约-选时段", async () => {
  return evalJs(`!!document.querySelector('.slot--selected')`);
});
await clickSel(`document.getElementById('bk-next')`, "预约-下一步(2→3)", async () => {
  return evalJs(`!!document.getElementById('bk-name')`);
});
// 填表单
await evalJs(`(function(){
  document.getElementById('bk-name').value='测试用户';
  document.getElementById('bk-name').dispatchEvent(new Event('input'));
  document.getElementById('bk-phone').value='13800138000';
  document.getElementById('bk-phone').dispatchEvent(new Event('input'));
  document.getElementById('bk-addr').value='上海市浦东新区测试路1号';
  document.getElementById('bk-addr').dispatchEvent(new Event('input'));
  return true;
})()`);
await sleep(300);
await clickSel(`document.getElementById('bk-next')`, "预约-下一步(3→4)", async () => {
  return evalJs(`!!document.querySelector('.summary-row')`);
});
await clickSel(`document.getElementById('bk-prev')`, "预约-返回修改", async () => {
  return evalJs(`!!document.getElementById('bk-name')`);
});
await clickSel(`document.getElementById('bk-next')`, "预约-再进确认", async () => {
  return evalJs(`!!document.querySelector('.summary-row')`);
});
await clickSel(`document.getElementById('bk-submit')`, "预约-提交", async () => {
  return evalJs(`location.hash.includes('orders') || (!!document.getElementById('modal') && document.getElementById('modal').innerHTML.includes('预约成功'))`);
}, 9000);
// 提交失败时抓 toast / modal 内容帮助定位
{
  const diag = await evalJs(`(function(){
    const t = document.getElementById('toast');
    return { toast: t && !t.hidden ? t.textContent : '', hash: location.hash, step4: !!document.querySelector('.summary-row') };
  })()`);
  if (diag && !diag.hash.includes('orders')) {
    console.log("提交后诊断: " + JSON.stringify(diag));
  }
}

// ---------- 4. 底部导航 ----------
await clickSel(`document.querySelector('.nav__item[data-tab="orders"]')`, "底部导航-订单", async () => {
  return evalJs(`location.hash.includes('orders')`);
});
await clickSel(`document.querySelector('.nav__item[data-tab="profile"]')`, "底部导航-我的", async () => {
  return evalJs(`location.hash.includes('profile')`);
});
await clickSel(`document.querySelector('.nav__item[data-tab="category"]')`, "底部导航-分类", async () => {
  return evalJs(`location.hash.includes('category')`);
});
await clickSel(`document.querySelector('.nav__item[data-tab="home"]')`, "底部导航-首页", async () => {
  return evalJs(`location.hash.includes('home')`);
});

// ---------- 5. 分类页 ----------
await navigate(BASE + "/#/category/repair");
await waitForRender(`#cat-seg .seg__item`, 10000);
await clickSel(`document.querySelector('#cat-seg .seg__item:nth-child(2)')`, "分类页-切换一级分类", async () => {
  return evalJs(`location.hash !== '#/category/repair'`);
}, 2000);
await clickSel(`document.querySelector('#sub-chips .chip:nth-child(2)')`, "分类页-二级筛选chip", async () => {
  return evalJs(`!!document.querySelector('#sub-chips .chip.active')`);
}, 1500);
await clickSel(`document.querySelector('#master-host .master-card')`, "分类页-师傅卡片", async () => {
  return evalJs(`location.hash.includes('master/')`);
}, 2000);

console.log("\n===== 点击探针结果 =====");
for (const r of results) {
  console.log((r.ok ? "PASS" : "FAIL") + " | " + r.label + (r.ok ? "" : " | " + r.why));
}
if (consoleErrors.length) {
  console.log("\n===== console errors =====");
  consoleErrors.forEach((e) => console.log(e));
}
console.log("\nFAIL count: " + results.filter((r) => !r.ok).length + "/" + results.length);

chrome.kill();
ws.close();
process.exit(0);
