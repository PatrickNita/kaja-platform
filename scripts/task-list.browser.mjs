import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.TASK_TEST_BASE || 'http://localhost:3013';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.request.get(base+'/member/patrick/'+(process.env.TASK_TEST_TOKEN||'task-list-local-check'));
 await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(base+'/?view=tasks&brand=kaja&tasks=all');
 await page.locator('.task-list-group').first().waitFor();
 const groups=await page.locator('.task-list-heading').allTextContents();
 assert(groups.length>0);
 let individuals=false;for(const heading of groups){if(!heading.includes('împreună'))individuals=true;else assert(!individuals,'Joint groups must precede individuals');}
 const ids=await page.locator('.task-list-card .entry-card-preview').evaluateAll(els=>els.map(el=>el.id));assert.equal(new Set(ids).size,ids.length);assert(ids.length>0);
 for(const width of [320,390,768,834,1024,1440]){
  await page.setViewportSize({width,height:1000});
  const tables=page.locator('.product-table--tasks');
  assert.equal(await tables.first().getByRole('columnheader').count(),5);
  assert.deepEqual(await tables.first().getByRole('columnheader').allTextContents(),['Sarcină','Brand','Descrierea','Comentarii','']);
  const row=page.locator('.task-list-card .workspace-data-row').first();
  const values=await row.evaluate(el=>{const s=getComputedStyle(el),t=getComputedStyle(el.querySelector('.workspace-data-title')),head=getComputedStyle(el.closest('.product-table').querySelector('.workspace-data-head'));return {height:el.getBoundingClientRect().height,font:s.fontSize,color:s.color,weight:t.fontWeight,head:head.fontSize,headWeight:head.fontWeight,grid:s.gridTemplateColumns}});
  assert.equal(values.font,'12px');assert.equal(values.weight,'600');assert.equal(values.head,'11px');assert.equal(values.headWeight,'800');assert(values.height>=52&&values.height<80,JSON.stringify(values));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const description=page.locator('.task-list-description').first();const style=await description.evaluate(el=>{const s=getComputedStyle(el);return {whiteSpace:s.whiteSpace,height:el.getBoundingClientRect().height,line:parseFloat(s.lineHeight),ellipsis:s.textOverflow}});assert.equal(style.whiteSpace,'nowrap');assert.equal(style.ellipsis,'ellipsis');assert(style.height<=style.line+1);assert(await row.locator('.task-list-member').count()>0);assert.equal(await page.locator('.task-list-member-mark').count(),0);
  const circles=await page.locator('.task-list-member').evaluateAll(els=>els.map(el=>{const s=getComputedStyle(el);return {text:el.textContent.trim(),label:el.getAttribute('aria-label'),title:el.title,done:el.classList.contains('completed'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,border:s.borderColor,background:s.backgroundColor,radius:s.borderRadius}}));
  for(const circle of circles){const name=circle.label.split(':')[0];assert.equal(circle.text,({Andrei:'A',Igor:'IG',Patrick:'P',Ionut:'IO'})[name]);assert.equal(circle.title,circle.label);assert.equal(circle.width,26);assert.equal(circle.height,26);assert.equal(circle.radius,'50%');assert.equal(circle.border,circle.done?'rgb(52, 114, 82)':'rgb(128, 61, 61)');assert.equal(circle.background,circle.done?'rgb(16, 33, 25)':'rgb(36, 20, 20)');}assert.equal(await row.locator('.product-list-symbol').count(),0);const region=page.locator('.task-list-group .product-table-scroll').first();
  const overflow=await region.evaluate(el=>el.scrollWidth>el.clientWidth+2);
  const hints=page.locator('.task-list-group .horizontal-scroll-hints').first();
  if(overflow){const right=hints.getByRole('button',{name:'Mergi la capătul tabelului'});await right.click();await page.waitForFunction(()=>{const el=document.querySelector('.task-list-group .product-table-scroll');return el.scrollWidth-el.clientWidth-el.scrollLeft<3});await page.waitForFunction(()=>document.querySelector('.task-list-group .table-scroll-right').disabled);await hints.getByRole('button',{name:'Mergi la începutul tabelului'}).click();}
  const trigger=page.locator('.task-list-card .entry-card-preview').first();await trigger.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();assert((await dialog.innerText()).includes('Responsabili'));const details=await dialog.locator('.entry-card-content > p').first().textContent();assert(details?.length>0);const chars=Array.from(details.replace(/\s+/g,' ').trim());const expected=chars.slice(0,100).join('')+(chars.length>100?'...':'');assert.equal(await trigger.locator('.task-list-description').textContent(),expected);
  const removals=dialog.locator('.task-member-remove');const assignedCount=await removals.count();assert(assignedCount>0);for(const removal of await removals.all()){assert.equal(await removal.textContent(),'Elimină');assert.equal(await removal.isDisabled(),assignedCount===1);}assert((await dialog.innerText()).includes('Trebuie să rămână cel puțin un responsabil.'));
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');if(width===1440){assert(await dialog.locator('.task-assignee-manager button[aria-label^="Marchează"]').count()>0);await dialog.getByRole('button',{name:'Modifică',exact:true}).click();const description=dialog.getByRole('textbox',{name:'Descriere',exact:true});const before=await description.inputValue();await description.fill(before+' (verificare locală nesalvată)');await dialog.getByRole('button',{name:'Anulează',exact:true}).click();assert((await dialog.innerText()).includes(before));await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-entry-edit'));}await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await trigger.evaluate(el=>document.activeElement===el));
  report.push({width,...values,overflow,dialog:true,escape:true,focus:true});
  if([390,1440].includes(width)){mkdirSync('tmp/task-list-screens',{recursive:true});await page.screenshot({path:`tmp/task-list-screens/${width}.png`,fullPage:true});}
 }
 // Compare the actual shared table styles with Catalogue at the same width.
 const taskStyle=await page.locator('.task-list-card .workspace-data-row').first().evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.fontWeight,s.color,s.padding,s.minHeight,s.backgroundColor,s.borderBottom]});
 await page.goto(base+'/?view=catalogue&brand=kaja&catalogue=live');const catalog=page.locator('.catalogue-list-card .workspace-data-row').first();await catalog.waitFor();assert.deepEqual(await catalog.evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.fontWeight,s.color,s.padding,s.minHeight,s.backgroundColor,s.borderBottom]}),taskStyle);
 if(!process.env.TASK_TEST_BASE){
  for(const slug of ['andrei','igor','ionut','patrick']){
   await context.request.get(base+'/member/'+slug+'/task-list-local-check');
   await page.goto(base+'/?view=tasks&brand=kaja&tasks=mine');
   if(['andrei','igor','patrick'].includes(slug))assert((await page.locator('.task-list-heading').allTextContents()).some(t=>t.toLowerCase().includes(slug)));
   assert.equal(await page.locator('summary').filter({hasText:'Adaugă sarcină'}).count(),slug==='patrick'?1:0);
   await page.goto(base+'/?view=tasks&brand=all&tasks=history');
   if(slug!=='patrick')assert.equal(new URL(page.url()).searchParams.get('tasks'),'all');
  }
 }
 if(process.env.TASK_TEST_FIXTURE==='1'){
  const styles=await page.locator('link[rel=stylesheet]').evaluateAll(els=>els.map(e=>e.href));
  await page.setContent('<html lang=ro><head>'+styles.map(href=>'<link rel=stylesheet href='+JSON.stringify(href)+'>').join('')+'</head><body><main class=workspace-shell><div class=workspace-content>'+readFileSync('tmp/task-list-fixture.html','utf8')+'</div></main></body></html>');
  for(const width of [320,390,768,834,1024,1440]){await page.setViewportSize({width,height:1000});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.workspace-data-row')).fontSize==='12px');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const long=page.locator('.workspace-data-row').filter({hasText:'Denumire foarte lungă'});assert(await long.evaluate(el=>el.getBoundingClientRect().height>52));const short=page.locator('.workspace-data-row').filter({hasText:'Sarcina 1'});assert.equal(await short.locator('.task-list-member.completed').count(),1);assert.equal(await short.locator('.task-list-member.incomplete').count(),1);assert.equal(await short.locator('.task-list-member-initial').allTextContents().then(x=>x.join(',')),'A,IG');assert.equal(await short.getByRole('cell').nth(3).innerText(),'2');const four=page.locator('.workspace-data-row').filter({hasText:'Sarcina 6'});assert.deepEqual(await four.locator('.task-list-member-initial').allTextContents(),['A','IG','IO','P']);assert.equal(await four.locator('.task-list-member.completed').count(),2);assert.equal(await four.locator('.task-list-member.incomplete').count(),2);}
 }
 assert.deepEqual(errors,[]);writeFileSync('tmp/task-list-browser-report.json',JSON.stringify({groups,report,errors},null,2));console.log(JSON.stringify({groups,report,errors}));
}finally{await browser.close()}


