import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import {neon} from '@neondatabase/serverless';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base='https://kaja-platform.vercel.app',db=neon(process.env.DATABASE_URL);
const files=await db`select a.id,a.filename,a.size,a.folder_id from attachments a join attachment_folders f on f.id=a.folder_id where a.deleted_at is null and a.content_type='image/png' and f.published=true and f.deleted_at is null order by a.filename`;
assert(files.length>0);const output=process.env.PRODUCT_IMAGES_ASSETS+'/uploads-optimized';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),member=await browser.newContext(),guest=await browser.newContext();
assert.equal((await member.request.get(process.env.PRODUCT_IMAGES_MEMBER_URL,{maxRedirects:0})).status(),307);
for(const context of [member,guest])await context.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const page=await member.newPage(),feedback=await guest.newPage();let originals=0;const errors=[];
page.on('request',r=>{const url=new URL(r.url());if(/\/api\/attachments\/\d+$/.test(url.pathname)&&!url.searchParams.has('variant'))originals++;});
for(const p of [page,feedback])p.on('pageerror',e=>errors.push(e.message));
const loaded=async(p,selector)=>{await p.locator(selector).first().waitFor();await p.locator(selector).evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));await p.waitForFunction(sel=>Array.from(document.querySelectorAll(sel)).every(i=>i.complete&&i.naturalWidth>0),selector,{timeout:45000});};
try{
 for(const file of files){const r=await member.request.get(base+'/api/attachments/'+file.id+'?variant=thumb');assert.equal(r.status(),200);assert.equal(r.headers()['content-type'],'image/webp');assert((await r.body()).length<5000);}
 assert.equal((await guest.request.get(base+'/api/attachments/'+files[0].id+'?variant=thumb')).status(),401);
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await feedback.setViewportSize({width,height:1000});const before=originals;
  await page.goto(base+'/?view=uploads&brand=kaja&folder='+files[0].folder_id,{waitUntil:'domcontentloaded'});await loaded(page,'.upload-file-thumbnail img');assert.equal(originals,before);assert(await page.locator('.upload-file-thumbnail img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth===96)));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const card=page.locator('.upload-compact-files .entry-card-preview').first();await card.evaluate(el=>new Promise(resolve=>{const poll=()=>{const key=Object.keys(el).find(k=>k.startsWith('__reactProps$'));if(key&&el[key]?.onClick)resolve(true);else setTimeout(poll,20);};poll();}));await card.click();await loaded(page,'[role=dialog] .upload-preview-image img');assert.equal(originals,before+1);assert(await page.locator('[role=dialog] .upload-preview-image img').evaluate(i=>i.naturalWidth>96));await page.screenshot({path:output+'/invitation-'+width+'.png',animations:'disabled'});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.classList.contains('entry-card-preview'));
  await feedback.goto(base+'/feedback/kaja/green-hairy',{waitUntil:'domcontentloaded'});if(!await feedback.locator('.feedback-public-header').count())await feedback.goto(base+'/feedback/kaja/1st-sin',{waitUntil:'domcontentloaded'});await loaded(feedback,'.feedback-product-image img');
  const positions=await feedback.locator('.feedback-public-header').evaluate(el=>{const title=el.querySelector('h1'),flavor=title.querySelector('span'),image=el.querySelector('.feedback-product-image'),range=document.createRange();range.selectNodeContents(title.firstChild);return {textAlign:getComputedStyle(title).textAlign,flavorDisplay:getComputedStyle(flavor).display,title:range.getBoundingClientRect().toJSON(),flavor:flavor.getBoundingClientRect().toJSON(),image:image.getBoundingClientRect().toJSON()};});assert.equal(positions.textAlign,'center');assert.equal(positions.flavorDisplay,'block');assert(positions.flavor.y>=positions.title.bottom);assert(positions.title.y>=positions.image.bottom);await feedback.screenshot({path:output+'/feedback-'+width+'.png',animations:'disabled'});console.log(width,'centered feedback and thumbnail-only upload list passed');
 }
 assert.deepEqual(errors,[]);console.log('All attachment thumbnails authenticated; original only after opening; focus and Escape passed.');
}catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true});console.log('Dialog:',await page.locator('[role=dialog]').allTextContents());throw error;}finally{await browser.close();}
