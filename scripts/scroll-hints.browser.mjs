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
for(const width of (process.env.SCROLL_TEST_WIDTHS ? process.env.SCROLL_TEST_WIDTHS.split(",").map(Number) : [320,390,768,834,1024,1200,1440]))for(const path of ['/?view=catalogue&brand=kaja&catalogue=live','/feedback?brand=kaja',...(base.includes('127.0.0.1')?[]:['/b2b'])]){
 await page.setViewportSize({width,height:1000});await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:60000});const wrapper=page.locator('.horizontal-scroll-hints').first();await wrapper.waitFor();
 const scroll=wrapper.locator(':scope > [role=region]');const overflow=await scroll.evaluate(el=>/auto|scroll/.test(getComputedStyle(el).overflowX)&&el.scrollWidth>el.clientWidth+2);
 const right=wrapper.locator('.table-scroll-right'),left=wrapper.locator('.table-scroll-left'),bar=wrapper.locator('.table-scroll-bar');
 if(overflow){await right.waitFor();assert(await left.isDisabled());assert(await right.isEnabled());
 assert.equal(await bar.evaluate(el=>el.getBoundingClientRect().height),44);
 assert(await bar.evaluate(el=>el.getBoundingClientRect().bottom<=el.nextElementSibling.getBoundingClientRect().top));
 const dimensions=await scroll.evaluate(el=>({width:el.clientWidth,content:el.scrollWidth,children:Array.from(el.firstElementChild.children).slice(0,2).map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}))}));
 await bar.evaluate(el=>el.style.display='none');assert.deepEqual(await scroll.evaluate(el=>({width:el.clientWidth,content:el.scrollWidth,children:Array.from(el.firstElementChild.children).slice(0,2).map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}))})),dimensions);await bar.evaluate(el=>el.style.display='');
 if(width===390)await page.emulateMedia({reducedMotion:'no-preference'});
 await right.click();await page.waitForFunction(()=>{const el=document.querySelector('.horizontal-scroll-hints > [role=region]');return el.scrollWidth-el.clientWidth-el.scrollLeft<=2;});await page.waitForFunction(()=>document.querySelector('.table-scroll-right').disabled);assert(await right.isDisabled());assert(await left.isEnabled());
 await left.click();await page.waitForFunction(()=>document.querySelector('.horizontal-scroll-hints > [role=region]').scrollLeft<=2);await page.waitForFunction(()=>document.querySelector('.table-scroll-left').disabled);assert(await left.isDisabled());
 await scroll.evaluate(el=>{el.scrollLeft=(el.scrollWidth-el.clientWidth)/2;el.dispatchEvent(new Event('scroll'));});await page.waitForFunction(()=>!document.querySelector('.table-scroll-left').disabled&&!document.querySelector('.table-scroll-right').disabled);
 assert(await wrapper.locator('.table-scroll-track span').evaluate(el=>parseFloat(el.style.left)>0));
 await right.click();await page.waitForFunction(()=>document.querySelector('.table-scroll-right').disabled);
 await left.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.table-scroll-left').disabled);
 await page.emulateMedia({reducedMotion:'reduce'});
 await scroll.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.activeElement.scrollLeft>0);
 await page.setViewportSize({width:1600,height:1000});await bar.waitFor({state:'detached'});await page.setViewportSize({width,height:1000});await bar.waitFor();
 }else assert.equal(await bar.count(),0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log(width,path,overflow?'single-click endpoints, separate bar, indicator, resizing and keyboard passed':'no unnecessary arrows');
}
assert.deepEqual(errors,[]);
}finally{await browser.close();}

