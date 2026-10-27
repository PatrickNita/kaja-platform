// Layout regression checks use the real styles and local markup; no server or database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const styles = ["globals.css", "b2b/b2b.css", "design-system.css"]
  .map(file => readFileSync(new URL(`../src/app/${file}`, import.meta.url), "utf8").replace('@import "tailwindcss";', ""))
  .join("\n");
const product = title => `<article class="card-wrap catalogue-list-card"><div class="entry-card-preview"><div class="product-list-row workspace-data-row"><span class="product-table-product workspace-data-identity"><span class="product-list-thumbnail"><span class="product-placeholder"></span></span><strong class="item-title workspace-data-title">${title}</strong></span><span class="product-table-flavor product-list-secondary">Vinăriță (Woodruff)</span><span class="product-table-brand entry-brand-inline">KAJA</span><span class="product-table-usage product-list-secondary">Folosit în 5 localuri din 17</span><span class="product-table-chevron"><svg class="navigation-icon" width="14" height="14"></svg></span></div></div></article>`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const width of [320,390,600,768,800,801,834,912,1024,1100,1199,1200,1366,1440,1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<style>${styles}</style><main class="workspace-shell"><div class="workspace-content"><section class="catalogue-list"><div class="product-table-scroll"><div class="product-table product-table--usage workspace-data-table"><div class="product-table-head workspace-data-head"><span>Produs</span><span>Gust</span><span>Brand</span><span>Utilizare în localuri</span><span></span></div><div class="modal-entry-grid">${["BRAIN FREEZE","FOREST MASTER","NILLA","CHCK","MON BLANC","CIN&MON"].map(product).join("")}</div></div></div></section><div class="b2b-admin"><section class="b2b-summary-table"><div class="b2b-summary-scroll"><div class="b2b-summary-content"><div class="b2b-location-entry"><button class="b2b-mobile-location"><svg class="navigation-icon" width="20" height="20" aria-hidden="true"></svg><strong>BAZA HOOKAH</strong><span class="b2b-mobile-address">Strada Paris 51/4</span><time class="b2b-mobile-last">22.10.2026, 14:33</time><svg class="navigation-icon" width="20" height="20" aria-hidden="true"></svg></button></div></div></div></section></div></div></main>`);
    const result = await page.evaluate(() => {
      const visibleTitle = card => card.querySelector(".item-title").getBoundingClientRect();
      const location = document.querySelector(".b2b-mobile-location");
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        cards: [...document.querySelectorAll(".catalogue-list-card")].map(card => ({ titleWidth: visibleTitle(card).width, titleHeight: visibleTitle(card).height, height: card.getBoundingClientRect().height, top: card.getBoundingClientRect().top })),
        tableStyle: {headSize:getComputedStyle(document.querySelector(".product-table-head")).fontSize,headWeight:getComputedStyle(document.querySelector(".product-table-head")).fontWeight,rowSize:getComputedStyle(document.querySelector(".product-list-row")).fontSize,rowWeight:getComputedStyle(document.querySelector(".product-list-row")).fontWeight,titleWeight:getComputedStyle(document.querySelector(".workspace-data-title")).fontWeight,titleSpacing:getComputedStyle(document.querySelector(".workspace-data-title")).letterSpacing},
        location: innerWidth <= 1100 ? { height: location.getBoundingClientRect().height, iconHeight: location.querySelector("svg").getBoundingClientRect().height, iconCenter: location.querySelector("svg").getBoundingClientRect().y + location.querySelector("svg").getBoundingClientRect().height/2, center: location.getBoundingClientRect().y + location.getBoundingClientRect().height/2, nameY: location.querySelector("strong").getBoundingClientRect().y, dateY: location.querySelector("time").getBoundingClientRect().y } : null,
      };
    });
    assert.deepEqual(result.tableStyle,{headSize:"11px",headWeight:"800",rowSize:"12px",rowWeight:"400",titleWeight:"600",titleSpacing:"normal"});
    assert(result.overflow <= 1, `${width}px: page overflow`);
    assert(result.cards.filter(card => Math.abs(card.top-result.cards[0].top)<1).length===1, `${width}px: one full-width product per row`);
    for (const card of result.cards) {
      if (width > 800) { assert(card.titleWidth >= 95, `${width}px: compressed title`); assert(card.titleHeight < 65, `${width}px: title stacks vertically`); }
      assert(card.height < 180, `${width}px: oversized product card`);
    }
    if (result.location) { assert.equal(result.location.iconHeight,20); assert(Math.abs(result.location.iconCenter-result.location.center)<2); assert(result.location.height >= 64 && result.location.height < 100); assert(Math.abs(result.location.nameY - result.location.dateY) < 5); }
    console.log(`Responsive catalogue and B2B: ${width}px passed`);
  }
} finally { await browser.close(); }
