// Headless-Chrome check of the deployed frontend, in real time (no virtual clock).
//
//   node deploy/verify_site.mjs <site-url> <out-dir> [--pages=/,/alerts] [--cold]
//
// For each page at 1440 px and 390 px:
//   - time to first meaningful content (main area holds real data, not a spinner);
//   - console errors and uncaught exceptions;
//   - failed requests (network errors and HTTP >= 400);
//   - horizontal overflow on mobile;
//   - a full-page screenshot in <out-dir>.
// On /alerts it also flips FAA -> DGCA and clicks Notify.
// Requests made while the "waking" banner is up are reported separately: they
// are the deliberate cold-start retries.
// Needs Node >= 22 (global WebSocket). Chrome path from CHROME or the default.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [site, outDir, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const PAGES = (flags.pages ?? "/,/briefing,/cascade,/live,/alerts,/performance").split(",");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9300 + Math.floor(Math.random() * 500);
const CONTENT_TIMEOUT_MS = Number(flags.timeout ?? 200_000);
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "fdpis-verify-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("chrome did not start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");

// Meaningful content: the wake banner is gone, <main> shows no spinner or
// skeleton, and it holds real data (table rows, a chart, list items) or a
// substantial amount of text.
const CONTENT_JS = `(() => {
  const main = document.querySelector("main"); if (!main) return false;
  if (document.querySelector('[role="status"]')) return false;
  if (main.querySelector(".animate-spin, .animate-pulse")) return false;
  return main.querySelectorAll("tbody tr, svg.recharts-surface, li, a[href]").length > 3
      || (main.innerText || "").length > 1500;
})()`;

async function visit(path, width, label) {
  const mobile = width < 600;
  await send("Emulation.setDeviceMetricsOverride", { width, height: mobile ? 844 : 900,
    deviceScaleFactor: mobile ? 2 : 1, mobile });
  const log = { console: [], failed: [], wakeRetries: 0, requests: 0 };
  let waking = false;
  const reqUrl = new Map();
  const onEvent = (m) => {
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      log.console.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
    if (m.method === "Runtime.exceptionThrown")
      log.console.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && m.params.entry.source !== "network")
      log.console.push(`${m.params.entry.source}: ${m.params.entry.text}`.slice(0, 300));
    if (m.method === "Network.requestWillBeSent") { log.requests++; reqUrl.set(m.params.requestId, m.params.request.url); }
    if (m.method === "Network.loadingFailed" && !m.params.canceled) {
      if (waking) log.wakeRetries++;
      else log.failed.push(`${m.params.errorText} ${reqUrl.get(m.params.requestId)}`);
    }
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) {
      if (waking && [502, 503, 504].includes(m.params.response.status)) log.wakeRetries++;
      else log.failed.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
    }
  };
  listeners.push(onEvent);
  const t0 = Date.now();
  await send("Page.navigate", { url: site.replace(/\/$/, "") + path });
  let ttc = null;
  let sawWake = false;
  while (Date.now() - t0 < CONTENT_TIMEOUT_MS) {
    waking = Boolean(await evaluate(`!!document.querySelector('[role="status"]')`).catch(() => false));
    sawWake ||= waking;
    if (await evaluate(CONTENT_JS).catch(() => false)) { ttc = Date.now() - t0; break; }
    await sleep(250);
  }
  if (sawWake) {
    // Failures before the banner first rendered are the same retry loop.
    const early = log.failed.filter((f) => /ERR_CONNECTION|HTTP 50[234]/.test(f) && !f.includes(site));
    log.wakeRetries += early.length;
    log.failed = log.failed.filter((f) => !early.includes(f));
  }
  await sleep(1500);                                   // let late requests settle
  const extra = {};
  if (path === "/alerts" && ttc !== null) Object.assign(extra, await alertsChecks());
  const overflow = await evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  // Name the elements that cross the right edge while their parent does not.
  const culprits = overflow > 0 ? await evaluate(`(() => {
    const W = document.documentElement.clientWidth, out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right <= W + 1) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a); if (o.overflowX !== "visible") { clipped = true; break; }
      }
      const p = el.parentElement?.getBoundingClientRect();
      if (!clipped && p && p.right <= W + 1)
        out.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 4).join(".")
                 + " right=" + Math.round(r.right));
    }
    return out.slice(0, 5);
  })()`) : [];
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const name = `${label}-${path === "/" ? "landing" : path.slice(1).replace(/\//g, "_")}.png`;
  writeFileSync(join(outDir, name), Buffer.from(shot.data, "base64"));
  listeners.splice(listeners.indexOf(onEvent), 1);
  return { page: path, viewport: label, timeToContentMs: ttc, sawWakeBanner: sawWake,
           horizontalOverflowPx: overflow, overflowCulprits: culprits, ...log, ...extra, screenshot: name };
}

async function alertsChecks() {
  const rows = `document.querySelectorAll("main tbody tr").length`;
  const table = `(document.querySelector("main tbody")?.innerText || "")`;
  const settled = async () => {
    for (let i = 0; i < 240; i++) {
      if (!(await evaluate(`!!document.querySelector("main .animate-spin")`))) return;
      await sleep(500);
    }
  };
  const radio = (re) => `(() => { const b = [...document.querySelectorAll('[role="radio"]')]
      .find((x) => ${re}.test(x.textContent)); if (!b) return false; b.click(); return true; })()`;
  const clickText = (re) => `(() => { const b = [...document.querySelectorAll("main button")]
      .find((x) => ${re}.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; })()`;

  await evaluate(radio("/FAA/")); await sleep(300); await settled();
  const faaRows = await evaluate(rows);
  const faaText = await evaluate(table);
  const flipped = await evaluate(radio("/DGCA/"));
  await sleep(300); await settled();
  const dgcaRows = await evaluate(rows);
  const dgcaText = await evaluate(table);

  const acked = await evaluate(clickText("/Acknowledge/"));
  await sleep(500);
  const notified = acked && await evaluate(clickText("/Notify crew/"));
  let confirmed = false;
  for (let i = 0; i < 40 && notified && !confirmed; i++) {
    await sleep(500);
    confirmed = await evaluate(`/Notified · simulated/.test(document.querySelector("main").innerText)`);
  }
  await evaluate(clickText("/^Outbox/"));
  let outboxItems = 0, outboxSimulated = false;
  for (let i = 0; i < 40 && outboxItems === 0; i++) {
    await sleep(500);
    outboxItems = await evaluate(`document.querySelectorAll("main li").length`);
    outboxSimulated = await evaluate(`/SIMULATED/.test(document.querySelector("main").innerText)`);
  }
  return { alerts: { rowsFaa: faaRows, rowsDgca: dgcaRows,
                     profileSwitchChangedRows: flipped && faaText !== dgcaText,
                     acknowledged: acked, notifyConfirmed: confirmed,
                     outboxItems, outboxShowsSimulated: outboxSimulated } };
}

const results = [];
try {
  for (const [w, label] of [[1440, "desktop"], [390, "mobile"]])
    for (const p of PAGES) {
      const r = await visit(p, w, label);
      results.push(r);
      console.log(`${label.padEnd(7)} ${p.padEnd(13)} content ${r.timeToContentMs === null ? "NEVER" : (r.timeToContentMs / 1000).toFixed(1) + "s"}`
        + `${r.sawWakeBanner ? " (wake banner)" : ""}  console errors ${r.console.length}  failed ${r.failed.length}`
        + `  wake retries ${r.wakeRetries}  overflow ${r.horizontalOverflowPx}px`
        + (r.alerts ? `  alerts ${JSON.stringify(r.alerts)}` : ""));
      for (const e of [...r.console, ...r.failed]) console.log("    ", e);
      for (const c of r.overflowCulprits) console.log("     overflow:", c);
    }
} finally {
  writeFileSync(join(outDir, "verify_results.json"), JSON.stringify(results, null, 1));
  ws.close();
  chrome.kill();
}
