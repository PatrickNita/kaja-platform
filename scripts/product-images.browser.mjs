import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {neon} from '@neondatabase/serverless';
assert(process.env.PLAYWRIGHT_MODULE_PATH, 'PLAYWRIGHT_MODULE_PATH required');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.PRODUCT_IMAGES_BASE || 'http://127.0.0.1:3130';
const assets=process.env.PRODUCT_IMAGES_ASSETS;
assert(assets);
const uploaded=JSON.parse(readFileSync(assets+'/uploaded.json','utf8'));
const output=assets+'/browser-'+(base.includes('127.0.0.1')?'local':'live');mkdirSync(output,{recursive:true});
const db=neon(process.env.DATABASE_URL);
const [group]=await db`select g.id,g.version,l.id as location_id from b2b_access_groups g join b2b_locations l on l.access_group_id=g.id join b2b_orders o on o.location_id=l.id order by o.id desc limit 1`;
assert(group,'An existing order is needed for read-only history verification');
const snapshot=async()=>JSON.stringify(await db`select (select md5(jsonb_agg(to_jsonb(p) order by p.id)::text) from b2b_products p) as products,(select md5(jsonb_agg(to_jsonb(o) order by o.id)::text) from b2b_orders o) as orders,(select md5(jsonb_agg(to_jsonb(i) order by i.order_id,i.product_id)::text) from b2b_order_items i) as lines`);
const before=await snapshot();
const browser=await chromium.launch({channel:'chrome',headless:true});
const member=await browser.newContext();
if(base.includes('127.0.0.1')) {
 await member.addCookies([{name:'kaja_member',value:'patrick.'+createHmac('sha256',process.env.SESSION_SECRET).update('patrick').digest('hex'),url:base}]);
} else {
 assert(process.env.PRODUCT_IMAGES_MEMBER_URL,'Authorized personal member URL required for live checks');
 assert.equal(new URL(process.env.PRODUCT_IMAGES_MEMBER_URL).origin,new URL(base).origin);
 const accessPage=await member.newPage();await accessPage.goto(process.env.PRODUCT_IMAGES_MEMBER_URL,{waitUntil:'domcontentloaded'});await accessPage.close();
}
const portal=await browser.newContext();
if(base.includes('127.0.0.1')) {
 const expires=Math.floor(Date.now()/1000)+3600,value=[group.id,group.version,expires].join('.');
 await portal.addCookies([{name:'kaja_b2b',value:value+'.'+createHmac('sha256',Buffer.from('ab'.repeat(32),'hex')).update('b2b:'+value).digest('hex'),url:base}]);
} else {
 const r=await member.request.get(base+'/api/b2b/locations/'+group.location_id);assert.equal(r.status(),200);
 const data=await r.json();assert(data.location.link);
 const accessPage=await portal.newPage();await accessPage.goto(base+data.location.link);await accessPage.close();
}
await portal.addInitScript(({key,id})=>localStorage.setItem(key,String(id)),{key:'kaja-b2b-location:'+group.id,id:group.location_id});
const publicContext=await browser.newContext();
for(const c of [member,portal,publicContext]) await c.route('**/*',route=>route.request().method()==='GET'||route.request().method()==='HEAD'?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
const errors=[];
const page=await portal.newPage();const catalogue=await member.newPage();const feedback=await publicContext.newPage();
for(const p of [page,catalogue,feedback])p.on('pageerror',e=>errors.push(e.message));
const languageReady=async(p,language)=>p.waitForFunction(lang=>{
 const button=Array.from(document.querySelectorAll('.language-option')).find(el=>el.textContent===lang.toUpperCase());
 const props=button&&Object.keys(button).find(key=>key.startsWith('__reactProps$'));
 return Boolean(props&&typeof button[props]?.onClick==='function');
},language);
const loaded=async(p,selector)=>{
 await p.locator(selector).first().waitFor();await p.locator(selector).evaluateAll(images=>images.forEach(i=>i.loading='eager'));
 try { await p.waitForFunction(sel=>Array.from(document.querySelectorAll(sel)).every(i=>i.complete&&i.naturalWidth>0),selector,{timeout:45000}); }
 catch(error){console.log('Incomplete images',await p.locator(selector).evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>({src:new URL(i.src).pathname,complete:i.complete,width:i.naturalWidth}))));throw error;}
};
try {
 for(const item of process.env.PRODUCT_IMAGES_LAYOUT_ONLY ? [] : uploaded){
  let lastError;
  for(let attempt=0;attempt<3;attempt++) {
   try { const response=await publicContext.request.get(base+'/api/product-images/'+item.imageId,{timeout:15000});assert.equal(response.status(),200,item.name);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'),item.sha256,item.name);lastError=null;break;
   } catch(error){lastError=error;}
  }
  if(lastError)throw lastError;
  const denied=await publicContext.request.get(base+'/api/item-images/'+item.imageId);assert.equal(denied.status(),401);
 }
 assert.equal((await publicContext.request.get(base+'/api/product-images/0')).status(),404);
 assert.equal((await publicContext.request.get(base+'/api/product-images/99999999')).status(),404);
 console.log(process.env.PRODUCT_IMAGES_LAYOUT_ONLY ? 'Layout-only pass; API checks already completed.' : '25 public image hashes match; private gallery stays unauthorized.');
 // Use the just-verified bytes for layout checks, isolating them from intermittent local Blob streams.
 if(base.includes('127.0.0.1')) for(const context of [member,portal,publicContext])await context.route('**/api/{product-images,item-images}/*',route=>{
  const id=Number(new URL(route.request().url()).pathname.split('/').at(-1));const image=uploaded.find(i=>i.imageId===id);
  return image?route.fulfill({status:200,contentType:'image/png',body:readFileSync(assets+'/'+image.slug+'.png')}):route.continue();
 });
 for(const width of [320,390,768,1024,1440]){
  for(const p of [page,catalogue,feedback])await p.setViewportSize({width,height:1000});
  await catalogue.goto(base+'/?view=catalogue&brand=kaja&catalogue=live',{waitUntil:'domcontentloaded',timeout:60000});
  await loaded(catalogue,'.product-list-thumbnail img');assert.equal(await catalogue.locator('.product-list-thumbnail img').count(),25);
  assert(await catalogue.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await catalogue.screenshot({path:output+'/catalogue-'+width+'.png',fullPage:true,animations:'disabled'});
  await catalogue.locator('.catalogue-list-card [role=button]').first().click();await loaded(catalogue,'.gallery-stage > img');
  await catalogue.keyboard.press('Escape');
  await catalogue.waitForFunction(()=>document.activeElement?.classList.contains('entry-card-preview'));
  for(const language of ['ro','ru']){
   await page.goto(base+'/comenzi',{waitUntil:'domcontentloaded',timeout:60000});
   await languageReady(page,language);
   await page.getByRole('button',{name:language.toUpperCase(),exact:true}).click();
   await page.waitForFunction(lang=>document.querySelector('.b2b-portal')?.getAttribute('lang')===lang,language);
   await loaded(page,'.b2b-product .product-image img');assert.equal(await page.locator('.b2b-product .product-image img').count(),25);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:output+'/portal-'+width+'-'+language+'.png',fullPage:true,animations:'disabled'});
   await page.locator('.b2b-quantity button').nth(1).click();
   await page.locator('.b2b-cart-bar button').filter({hasText:language==='ru'?'Проверить':'Verifică'}).click();
   await loaded(page,'dialog .b2b-checkout-product .product-image img');
   await page.screenshot({path:output+'/review-'+width+'-'+language+'.png',animations:'disabled'});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.activeElement?.closest('.b2b-cart-bar'));
   await page.locator('.portal-view-tabs button').nth(1).click();
   await page.locator('.b2b-order-card').first().click();await loaded(page,'dialog .b2b-checkout-product .product-image img');
   const edit=page.getByRole('button',{name:language==='ru'?'Изменить заказ':'Modifică comanda',exact:true});
   if(await edit.count()){
    await edit.click();await loaded(page,'dialog .b2b-product .product-image img');
    await page.locator('dialog .b2b-quantity button').nth(1).click();
    await page.getByRole('button',{name:language==='ru'?'Проверить изменения':'Verifică modificările',exact:true}).click();
    await loaded(page,'dialog .b2b-checkout-product .product-image img');
   }
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.activeElement?.classList.contains('b2b-order-card'));
   await feedback.goto(base+'/feedback/kaja/1st-sin',{waitUntil:'domcontentloaded',timeout:60000});
   await languageReady(feedback,language);
   await feedback.getByRole('button',{name:language.toUpperCase(),exact:true}).click();
   await feedback.waitForFunction(lang=>document.querySelector('.feedback-public-card')?.getAttribute('lang')===lang,language);
   await loaded(feedback,'.feedback-product-image img');
   assert(await feedback.locator('.feedback-product-image').evaluate(el=>el.getBoundingClientRect().width<=160));
   assert(await feedback.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await feedback.screenshot({path:output+'/feedback-'+width+'-'+language+'.png',fullPage:true,animations:'disabled'});
  }
  console.log(width,'Catalog, portal, review, history, editing and public feedback RO/RU passed');
 }
 for(const item of uploaded){await feedback.goto(base+'/feedback/kaja/'+item.slug,{waitUntil:'domcontentloaded'});await loaded(feedback,'.feedback-product-image img');assert((await feedback.locator('.feedback-public-header').innerText()).includes(item.name));}
 await publicContext.route('**/api/product-images/*',route=>route.fulfill({status:404,body:''}));
 await feedback.goto(base+'/feedback/kaja/1st-sin',{waitUntil:'domcontentloaded',timeout:60000});await feedback.waitForFunction(()=>!document.querySelector('.feedback-product-image img')&&document.querySelector('.feedback-product-image svg'));console.log('Missing image fallback passed.');
 if(!base.includes('127.0.0.1')) { await catalogue.goto(base+'/b2b?tab=history',{waitUntil:'domcontentloaded',timeout:60000});
 const history=catalogue.locator('.b2b-order-card').first();
 assert(await history.count(),'Internal history order missing');await history.click();await loaded(catalogue,'dialog .b2b-checkout-product .product-image img');await catalogue.screenshot({path:output+'/admin-history-1440.png',animations:'disabled'}); }
 assert.deepEqual(errors,[]);
 assert.equal(await snapshot(),before,'Read-only verification changed order or product data');
 console.log('25 public product pages passed; no browser exceptions; orders, line items and stock unchanged.');
}finally{await browser.close();}
