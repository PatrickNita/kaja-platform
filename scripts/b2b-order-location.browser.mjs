// Local synthetic portal fixture. POSTs are intercepted; no production order is changed.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdirSync,copyFileSync,existsSync,unlinkSync,rmdirSync} from 'node:fs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base='http://localhost:3130',out=process.env.PRODUCT_LIST_QA_DIR;assert(out);mkdirSync(out,{recursive:true});
const fixture=new URL('../src/app/qa-order-location/page.tsx',import.meta.url),fixtureDirectory=new URL('../src/app/qa-order-location/',import.meta.url);
assert(!existsSync(fixture),'Do not overwrite an existing route');
mkdirSync(fixtureDirectory);copyFileSync(new URL('./fixtures/order-location.page.tsx.txt',import.meta.url),fixture);
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const width of [320,390,768,1024,1440])for(const language of ['ro','ru']) {
  const context=await browser.newContext({viewport:{width,height:950}}),p=await context.newPage();let calls=0;
  const text=language==='ro'?{history:'Istoric comenzi',move:'Modifică locația',save:'Salvează locația',back:'Înapoi'}:{history:'История заказов',move:'Изменить заведение',save:'Сохранить заведение',back:'Назад'};
  await p.route('**/api/b2b',async route=>{
    assert.equal(route.request().method(),'POST');const body=route.request().postDataJSON();assert.equal(body.operation,'changeOrderLocation');assert.equal(body.locationId,1);assert.equal(body.destinationLocationId,2);assert.equal(body.version,1);calls++;
    const local={name:'Local Beta cu denumire foarte lungă pentru verificarea încadrării',address:'Strada cu adresă lungă pentru verificarea dialogului 123',contact:'Persoană contact',phone:'069111111'};
    await route.fulfill({json:{ok:true,result:{order:{id:9001,location_id:2,location_name:local.name,location_snapshot:local,author:'Local',status:'placed',version:2,total:80000,cashback:0,created_at:'2026-10-27T10:00:00Z',items:[{id:1,name:'Produs test',flavor:'Gheață',grams:200,price:40000,quantity:2}]}}}});
  });
  await p.goto(base+'/qa-order-location?lang='+language,{waitUntil:'networkidle'});
  await p.getByRole('button',{name:text.history,exact:true}).click();await p.locator('.b2b-order-card').click();
  const move=p.getByRole('button',{name:text.move,exact:true});await move.click();const dialog=p.getByRole('dialog');
  await assert.equal(await p.getByRole('button',{name:text.save,exact:true}).isDisabled(),true);
  assert.equal(calls,0);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.getByRole('button',{name:/Local Beta/}).click();assert.equal(calls,0);
  await p.waitForFunction(()=>document.querySelector('.b2b-order-location-options [aria-pressed="true"]')?.textContent.includes('Local Beta'));
  assert(await p.getByRole('button',{name:text.save,exact:true}).isEnabled());
  await p.screenshot({path:`${out}/location-${width}-${language}.png`});
  await p.getByRole('button',{name:text.back,exact:true}).click();await p.waitForFunction(label=>document.activeElement?.textContent===label,text.move);
  await move.click();await p.getByRole('button',{name:/Local Beta/}).click();await p.getByRole('button',{name:text.save,exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('.b2b-checkout-location')?.textContent.includes('Local Beta'));assert.equal(calls,1);assert(await dialog.isVisible());
  assert((await p.locator('.b2b-checkout-total').innerText()).includes('800 MDL'));
  await dialog.press('Escape');await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.activeElement?.matches('.b2b-order-card'));
  await p.locator('.b2b-order-card').click();await p.getByRole('dialog').waitFor();await p.mouse.click(2,2);await dialog.waitFor({state:'hidden'});
  await context.close();console.log(width,language,'selection, save, updated dialog/history, Escape, outside and focus passed');
 }
 for(const query of ['single=1','status=confirmed','status=paid']) {
  const context=await browser.newContext(),p=await context.newPage();await p.goto(base+'/qa-order-location?'+query,{waitUntil:'networkidle'});await p.getByRole('button',{name:'Istoric comenzi',exact:true}).click();await p.locator('.b2b-order-card').click();assert.equal(await p.getByRole('button',{name:'Modifică locația',exact:true}).count(),0);await context.close();
 }
 console.log('Single location, confirmed and paid: transfer hidden.');
 const context=await browser.newContext({viewport:{width:390,height:900}}),p=await context.newPage();
 await p.route('**/api/b2b',route=>route.fulfill({status:409,json:{error:'Comanda sau datele au fost actualizate între timp. Reîncarcă pagina și verifică starea curentă.',errorCode:'conflict'}}));
 await p.goto(base+'/qa-order-location',{waitUntil:'networkidle'});await p.getByRole('button',{name:'Istoric comenzi',exact:true}).click();await p.locator('.b2b-order-card').click();await p.getByRole('button',{name:'Modifică locația',exact:true}).click();await p.getByRole('button',{name:/Local Beta/}).click();await p.getByRole('button',{name:'Salvează locația',exact:true}).click();await p.getByRole('alert').filter({hasText:'Comanda sau datele'}).waitFor();assert((await p.locator('.b2b-checkout-location').innerText()).includes('Local Alpha'));assert(await p.getByRole('dialog').isVisible());await context.close();console.log('Failed save retains destination picker, source and error.');
} finally {await browser.close();unlinkSync(fixture);rmdirSync(fixtureDirectory);}
