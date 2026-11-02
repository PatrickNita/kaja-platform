import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = 'http://127.0.0.1:3012';
const body = 'Șț Привет 😀 ' + 'Feedback gustos și echilibrat. '.repeat(12) + '\n\nAl doilea paragraf păstrat integral.';
const rows = [body, 'Primul paragraf\nSemnătură', 'a'.repeat(100), 'a'.repeat(200), 'Scurt 😀'].map((body, index) => ({ id: index + 1, brand: 'kaja', product: 'Produs ' + index, flavor: 'Gust', body, createdAt: '2026-11-01T10:00:00Z', unread: false }));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'kaja_member', value: 'patrick.' + createHmac('sha256', process.env.SESSION_SECRET || 'development-only-secret').update('patrick').digest('hex'), url: base }]);
  await context.route('**/*', route => {
    const request = route.request();
    if (request.url().includes('/api/feedback/history')) return route.fulfill({ json: { comments: rows, nextCursor: null } });
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ json: {} });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/feedback?tab=history&brand=all');
  await page.locator('.feedback-history-row').first().waitFor();
  for (const width of [320, 390, 768, 800, 834, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const limit = width <= 800 ? 100 : 200;
    const previews = page.locator('.feedback-history-preview:visible');
    assert.equal(await previews.count(), 5);
    for (let index = 0; index < rows.length; index++) {
      const parts = rows[index].body.split('\n').filter(Boolean);
      const expected = Array.from(parts[0]).slice(0, limit).join('') + (Array.from(parts[0]).length > limit || parts.length > 1 ? '...' : '');
      assert.equal(await previews.nth(index).textContent(), expected);
      const geometry = await previews.nth(index).evaluate(el => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight), whiteSpace: getComputedStyle(el).whiteSpace, overflow: getComputedStyle(el).overflow, ellipsis: getComputedStyle(el).textOverflow }));
      assert.equal(geometry.whiteSpace, 'nowrap');
      assert.equal(geometry.overflow, 'hidden');
      assert.equal(geometry.ellipsis, 'ellipsis');
      assert(geometry.height <= geometry.line + 1);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const opener = page.locator('.feedback-history-row').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.locator('.feedback-message-body p').textContent(), body);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.feedback-history-row'));
    assert(await opener.evaluate(el => document.activeElement === el));
    console.log(`PASS ${width}px: single line, ${limit} characters, full dialog, keyboard, Escape and focus.`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
