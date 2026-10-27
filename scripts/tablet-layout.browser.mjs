// Layout regression checks use the real styles and local markup; no server or database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const styles = ["globals.css", "b2b/b2b.css", "design-system.css"]
  .map(file => readFileSync(new URL(`../src/app/${file}`, import.meta.url), "utf8").replace('@import "tailwindcss";', ""))
  .join("\n");
const product = title => `<article class="card-wrap catalogue-compact-card"><div class="entry-card-preview"><div class="catalogue-mobile-preview"><span class="product-placeholder"></span><strong class="catalogue-preview-title">${title}</strong><span class="catalogue-preview-brand">KAJA</span><span class="catalogue-preview-flavor">Vinăriță (Woodruff)</span><div class="catalogue-preview-usage"><div class="meta">Folosit în 5 localuri din 17</div></div></div><div class="catalogue-desktop-preview"><span class="product-placeholder"></span><div class="entry-card-head"><h3 class="item-title">${title}</h3><span class="entry-author-group entry-preview-author">KAJA</span></div><p class="entry-preview">Vinăriță (Woodruff)</p><div class="meta">Folosit în 5 localuri din 17</div></div></div></article>`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const width of [320,390,600,768,800,801,834,912,1024,1100,1199,1200,1366,1440,1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<style>${styles}</style><main class="workspace-shell"><div class="workspace-content"><section><div class="modal-entry-grid">${["BRAIN FREEZE","FOREST MASTER","NILLA","CHCK"].map(product).join("")}</div></section><div class="b2b-admin"><section class="b2b-summary-table"><div class="b2b-summary-scroll"><div class="b2b-summary-content"><div class="b2b-location-entry"><button class="b2b-mobile-location"><strong>BAZA HOOKAH</strong><span class="b2b-mobile-address">Strada Paris 51/4</span><time class="b2b-mobile-last">22.10.2026, 14:33</time></button></div></div></div></section></div></div></main>`);
    const result = await page.evaluate(() => {
      const visibleTitle = card => card.querySelector(innerWidth <= 800 ? ".catalogue-preview-title" : ".item-title").getBoundingClientRect();
      const location = document.querySelector(".b2b-mobile-location");
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        cards: [...document.querySelectorAll(".catalogue-compact-card")].map(card => ({ titleWidth: visibleTitle(card).width, titleHeight: visibleTitle(card).height, height: card.getBoundingClientRect().height })),
        location: innerWidth <= 1100 ? { height: location.getBoundingClientRect().height, nameY: location.querySelector("strong").getBoundingClientRect().y, dateY: location.querySelector("time").getBoundingClientRect().y } : null,
      };
    });
    assert(result.overflow <= 1, `${width}px: page overflow`);
    for (const card of result.cards) {
      if (width > 800) { assert(card.titleWidth >= 95, `${width}px: compressed title`); assert(card.titleHeight < 65, `${width}px: title stacks vertically`); }
      assert(card.height < 180, `${width}px: oversized product card`);
    }
    if (result.location) { assert(result.location.height >= 64 && result.location.height < 100); assert(Math.abs(result.location.nameY - result.location.dateY) < 5); }
    console.log(`Responsive catalogue and B2B: ${width}px passed`);
  }
} finally { await browser.close(); }
