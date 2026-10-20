import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base=process.env.FEEDBACK_TEST_BASE || 'http://localhost:3120';
assert(['localhost','127.0.0.1','kaja-platform.vercel.app'].includes(new URL(base).hostname));
const db=neon(process.env.DATABASE_URL);
const output=process.env.FEEDBACK_QA_DIR; assert(output, 'FEEDBACK_QA_DIR required');mkdirSync(output,{recursive:true});
const [owner]=await db.query("select id from members where slug='patrick'");
const fixtureName='TEST FEEDBACK '+randomUUID();
const [fixture]=await db.query("insert into workspace_items(brand,section,catalogue_group,title,body,product_name,flavor,created_by,updated_by) values('kaja','catalogue','live',$1,'PRIVATE TEST DESCRIPTION',$1,'Gust de test lung cu diacritice și detalii', $2,$2) returning id,feedback_id,feedback_slug",[fixtureName,owner.id]);
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try {
 const anon=await browser.newContext();const publicPage=await anon.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
 await publicPage.goto(`${base}/feedback/${fixture.feedback_id}`);assert.equal(new URL(publicPage.url()).pathname,`/feedback/kaja/${fixture.feedback_slug}`);await publicPage.getByRole('button',{name:'RU',exact:true}).click();await publicPage.getByLabel('Анонимный комментарий').fill('TEST anonim din browser');
 await publicPage.getByRole('button',{name:'RO',exact:true}).click();assert.equal(await publicPage.getByLabel('Comentariu anonim').inputValue(),'TEST anonim din browser');
 await publicPage.waitForTimeout(2100);
 await publicPage.getByRole('button',{name:'Trimite feedback',exact:true}).click();await publicPage.getByText('Mulțumim! Feedbackul tău a fost trimis.').waitFor();
 assert.equal((await db.query('select count(*)::int as n from product_feedback where item_id=$1',[fixture.id]))[0].n,1);
 assert.equal((await anon.request.get(`${base}/api/feedback/${fixture.feedback_id}`)).status(),401);
 assert.equal((await anon.request.get(`${base}/api/feedback/${fixture.feedback_id}/qr`)).status(),401);
 for(const width of [320,390,768,1440]) {await publicPage.setViewportSize({width,height:900});await publicPage.goto(`${base}/feedback/${fixture.feedback_id}`);assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await publicPage.screenshot({path:`${output}/public-${width}.png`,fullPage:true});}
 await publicPage.getByLabel('Comentariu anonim').fill('Pastrat la eroare');
 await publicPage.route('**/api/feedback',route=>route.fulfill({status:503,contentType:'application/json',body:'{"code":"unavailable"}'}));
 await publicPage.getByRole('button',{name:'Trimite feedback',exact:true}).click();await publicPage.locator('.b2b-error').waitFor();assert.equal(await publicPage.getByLabel('Comentariu anonim').inputValue(),'Pastrat la eroare');
 await publicPage.unroute('**/api/feedback');
 for(const slug of process.env.FEEDBACK_PUBLIC_ONLY === '1' ? [] : ['patrick','ionut','andrei','igor']) {
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  await context.addCookies([{name:'kaja_member',value:`${slug}.${createHmac('sha256',process.env.SESSION_SECRET).update(slug).digest('hex')}`,url:base}]);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/feedback');await p.getByRole('button',{name:fixtureName+' -',exact:false}).waitFor();
  assert.equal(await p.locator('.feedback-product').count(),26);
  for(const width of slug==='patrick'?[320,390,768,1440]:[390]) {
   await p.setViewportSize({width,height:900});const card=p.getByRole('button',{name:fixtureName+' -',exact:false});await card.click();
   const dialog=p.getByRole('dialog');await dialog.getByText('TEST anonim din browser').waitFor();await dialog.locator('.feedback-qr').evaluate(async img=>{if(!img.complete)await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;});if(!img.naturalWidth)throw Error('QR failed');});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await dialog.getByRole('button',{name:'Copiază linkul'}).click();await dialog.getByText('Link copiat.').waitFor();
   assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),`https://kaja-platform.vercel.app/feedback/kaja/${fixture.feedback_slug}`);
   if(slug==='patrick') {await p.screenshot({path:`${output}/dialog-${width}.png`,fullPage:true});const qr=await context.request.get(`${base}/api/feedback/${fixture.feedback_id}/qr?download`);assert.equal(qr.status(),200);assert(qr.headers()['content-disposition'].includes('attachment'));const svg=await qr.text();assert(svg.startsWith('<svg'));writeFileSync(`${output}/qr.svg`,svg);await dialog.locator('.feedback-qr').screenshot({path:`${output}/qr.png`});}
   await p.keyboard.press('Escape');assert.equal(await p.getByRole('dialog').count(),0);assert(await card.evaluate(el=>document.activeElement===el));
  }
  if(slug==='patrick') {
   await p.goto(base+'/?view=catalogue&brand=kaja');
   await p.getByRole('button',{name:'Deschide '+fixtureName,exact:true}).click();
   const editor=p.getByRole('dialog');await editor.getByRole('button',{name:'Modifică',exact:true}).click();
   await editor.getByLabel('Gust',{exact:true}).fill('Gust modificat doar în ciornă');
   assert(await editor.getByRole('button',{name:'Salvează modificările'}).isEnabled());
   p.once('dialog',d=>d.dismiss());await p.keyboard.press('Escape');assert(await editor.isVisible());
   assert.equal(await editor.getByLabel('Gust',{exact:true}).inputValue(),'Gust modificat doar în ciornă');
   p.once('dialog',d=>d.accept());await editor.getByRole('button',{name:'Anulează',exact:true}).click();
   await editor.getByRole('button',{name:'Modifică',exact:true}).click();
   assert.equal(await editor.getByLabel('Gust',{exact:true}).inputValue(),'Gust de test lung cu diacritice și detalii');
   await p.keyboard.press('Escape');await p.goto(base+'/feedback');
  }
  await p.getByRole('link',{name:'HEXENWERK',exact:true}).click();await p.getByText('Nu există produse în catalogul activ al acestui brand.').waitFor();assert(p.url().includes('brand=hexenwerk'));
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(process.env.FEEDBACK_PUBLIC_ONLY === '1' ? 'Public live browser PASS: RO/RU, submission, private API isolation, errors, 320/390/768/1440.' : 'Browser PASS: 4 roles, RO/RU, submission, private APIs, clipboard, SVG, Escape/focus, errors, filters, catalogue draft, 320/390/768/1440.');
} finally {
 await browser.close();await db.transaction([db.query('delete from product_feedback where item_id=$1',[fixture.id]),db.query('delete from workspace_items where id=$1 and title=$2',[fixture.id,fixtureName])]);
 console.log('Fictive product and test comments removed.');
}
