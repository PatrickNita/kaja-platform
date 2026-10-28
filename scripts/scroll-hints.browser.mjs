import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHmac} from 'node:crypto';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.SCROLL_TEST_BASE||'http://127.0.0.1:3130';
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
if(base.includes('127.0.0.1'))await context.addCookies([{name:'kaja_member',value:'patrick.'+createHmac('sha256',process.env.SESSION_SECRET).update('patrick').digest('hex'),url:base}]);
else assert.equal((await context.request.get(process.env.PRODUCT_IMAGES_MEMBER_URL,{maxRedirects:0})).status(),307);
await context.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
for(const width of [320,390,768,834,1024,1440])for(const path of ['/?view=catalogue&brand=kaja&catalogue=live','/feedback?brand=kaja',...(base.includes('127.0.0.1')?[]:['/b2b'])]){
 await page.setViewportSize({width,height:1000});await page.goto(base+path,{waitUntil:'networkidle'});const wrapper=page.locator('.horizontal-scroll-hints').first();await wrapper.waitFor();
 const scroll=wrapper.locator(':scope > [role=region]');const overflow=await scroll.evaluate(el=>/auto|scroll/.test(getComputedStyle(el).overflowX)&&el.scrollWidth>el.clientWidth+2);
 const right=wrapper.locator('.scroll-edge--right button'),left=wrapper.locator('.scroll-edge--left button');
 if(overflow){await right.waitFor();assert.equal(await left.count(),0);
 const geometry=await scroll.evaluate(el=>Array.from(el.firstElementChild.children).slice(0,2).map(c=>c.getBoundingClientRect().toJSON()));
 await wrapper.evaluate(el=>el.querySelectorAll('.scroll-edge').forEach(e=>e.style.display='none'));
 assert.deepEqual(await scroll.evaluate(el=>Array.from(el.firstElementChild.children).slice(0,2).map(c=>c.getBoundingClientRect().toJSON())),geometry);
 await wrapper.evaluate(el=>el.querySelectorAll('.scroll-edge').forEach(e=>e.style.display=''));
 await right.click();await left.waitFor();assert(await scroll.evaluate(el=>el.scrollLeft>0));
 await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;el.dispatchEvent(new Event('scroll'));});await right.waitFor({state:'detached'});await left.waitFor();
 await scroll.evaluate(el=>{el.scrollLeft=0;el.dispatchEvent(new Event('scroll'));});await left.waitFor({state:'detached'});await right.waitFor();
 await scroll.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.activeElement.scrollLeft>0);
 }else assert.equal(await wrapper.locator('.scroll-edge').count(),0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log(width,path,overflow?'arrows, click, swipe/keyboard and unchanged geometry passed':'no unnecessary arrows');
}
assert.deepEqual(errors,[]);
}finally{await browser.close();}

