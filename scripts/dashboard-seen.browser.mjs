// Local UI checks only: every mutation is intercepted, never sent to the database.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = process.env.SEEN_QA_BASE || "http://localhost:3130";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const out = process.env.SEEN_QA_DIR; assert(out); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [], errors = [];
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kaja_member", value: `patrick.${createHmac("sha256", process.env.SESSION_SECRET || "development-only-secret").update("patrick").digest("hex")}`, url: base }]);
  let counts = { orders: 3, feedback: 123 }, requests = [], release, fail = false;
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === "/api/member-dashboard") return route.fulfill({ json: counts });
    // The local checkout has no production link-decryption key. Use the read-only
    // feedback history shell for this navigation target; assert the B2B URL itself.
    if (request.method() === "GET" && url.pathname === "/b2b") {
      url.pathname = "/feedback";
      return route.fulfill({ response: await route.fetch({ url: url.href }) });
    }
    if (request.method() === "GET" || request.method() === "HEAD") return route.continue();
    if (url.pathname !== "/api/member-seen") return route.fulfill({ json: {} });
    const body = request.postDataJSON(); requests.push(body);
    if (release) await release.promise;
    if (fail) return route.fulfill({ status: 503, json: { error: "Test failure" } });
    if (body.type === "dashboard") counts[body.kind] = 0;
    return route.fulfill({ json: { ok: true } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const kind of ["orders", "feedback"]) {
      const brand = width === 320 ? "all" : width === 390 ? "kaja" : width === 768 ? "hexenwerk" : "virginia";
      counts = { orders: brand === "all" || brand === "kaja" ? 3 : 0, feedback: 123 }; requests = [];
      await page.goto(`${base}/?view=activity&brand=${brand}`, { waitUntil: "networkidle" });
      assert.equal(requests.length, 0, "GET/prefetch must not mark read");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const card = page.getByRole("button", { name: kind === "orders" ? /^Comenzi noi/ : /^Feedback nou/ });
      release = {}; release.promise = new Promise(resolve => { release.resolve = resolve; });
      await card.focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector('.dashboard-stat[aria-busy="true"]'));
      assert.equal(await page.locator(".dashboard-stat:disabled").count(), 2);
      await card.evaluate(element => { element.click(); element.click(); });
      await page.waitForTimeout(150);
      assert.equal(requests.length, 1); assert.equal(new URL(page.url()).pathname, "/");
      assert.deepEqual(requests[0], { type: "dashboard", kind, brand });
      release.resolve(); release = null;
      await page.waitForURL(url => url.pathname === (kind === "orders" ? "/b2b" : "/feedback") && url.searchParams.get("tab") === "history");
      await page.waitForLoadState("networkidle");
      console.log(JSON.stringify({ width, kind, stage: "navigated", history: await page.evaluate(() => history.length), url: page.url() }));
      assert.equal(new URL(page.url()).searchParams.has("unread"), false);
      await page.goBack({ waitUntil: "networkidle" });
      await page.waitForFunction(({ kind }) => [...document.querySelectorAll('.dashboard-stat')].some(e => e.textContent.startsWith(kind === 'orders' ? 'Comenzi noi' : 'Feedback nou') && e.querySelector('strong').textContent === '0'), { kind }).catch(async error => { console.log(JSON.stringify({ width, kind, url: page.url(), cards: await page.locator('.dashboard-stat').allTextContents(), errors })); throw error; });
      if (kind === "feedback") await page.screenshot({ path: `${out}/dashboard-seen-${width}.png` });
      results.push({ width, kind, brand, zeroCount: kind === "orders" && !["all", "kaja"].includes(brand), waitsForSave: true, duplicateBlocked: true, returnCount: 0 });
    }
  }
  counts = { orders: 3, feedback: 123 }; fail = true; requests = [];
  await page.goto(`${base}/?view=activity&brand=kaja`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Feedback nou/ }).click();
  await page.getByRole("alert").filter({ hasText: "Nu s-au putut marca" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.getByRole("button", { name: /^Feedback nou/ }).locator("strong").innerText(), "123");
  fail = false;
  await page.getByRole("alert").getByRole("button", { name: "Reîncearcă" }).click();
  await page.waitForURL(url => url.pathname === "/feedback");
  assert.equal(requests.length, 2);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, failedSaveAndRetry: true, errors }, null, 2));
  console.log(`PASS ${results.length} local UI cases: responsive layout, keyboard, scoped payload, await save, duplicate blocking, back counts, failure and retry.`);
} finally { await browser.close(); }
