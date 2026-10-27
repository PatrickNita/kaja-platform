// Read-only local browser checks. Never submit writes to the connected database.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = process.env.TABLET_QA_BASE ?? "http://localhost:3130";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert(process.env.SESSION_SECRET, "Local session secret required");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kaja_member", value: `patrick.${createHmac("sha256",process.env.SESSION_SECRET).update("patrick").digest("hex")}`, url: base }]);
  await context.route("**/*", route => ["GET","HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
  const page = await context.newPage();
  for (const width of [320,390,768,800,801,834,1024,1199,1200,1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/?view=catalogue&brand=all&catalogue=live`, { waitUntil: "networkidle" });
    const card = page.locator(".catalogue-list-card .entry-card-preview").first();
    await card.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await card.evaluate(el => el === document.activeElement));
    const brands = page.getByRole("navigation", { name: "Filtrează după brand" });
    await brands.getByRole("link", { name: "KAJA", exact: true }).click();
    await page.waitForURL(/brand=kaja/);
    await brands.getByRole("link", { name: "KAJA", exact: true }).waitFor();
    assert((await brands.getByRole("link", { name: "KAJA", exact: true }).getAttribute("class"))?.includes("active"));
    if (width <= 800) {
      const menu = page.getByRole("button", { name: "Meniu", exact: true });
      await menu.click();
      const drawer = page.getByRole("dialog", { name: "Navigare spațiu de lucru" });
      await drawer.waitFor();
      assert(Math.abs((await drawer.boundingBox()).width - Math.max(width*.6,220)) < 1);
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      assert(await menu.evaluate(el => el === document.activeElement));
      await menu.click();
      await page.setViewportSize({ width: 1024, height: 768 });
      await drawer.waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      assert(await page.locator(".workspace-nav a.active").evaluate(el => el === document.activeElement));
    }
    console.log(`Catalogue filters, dialog, focus and tablet rotation: ${width}px passed`);
  }
} finally { await browser.close(); }
