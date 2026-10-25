// Local read-only UI tests. Native sharing is mocked; no message or production mutation is sent.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.UPLOAD_QA_BASE??"http://localhost:3130";
assert(["localhost","127.0.0.1"].includes(new URL(base).hostname),"Native share mocks must only run locally");
const output=process.env.UPLOAD_QA_DIR;assert(output);mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const errors=[],results=[];
async function contextFor(slug) {
  const context=await browser.newContext();
  await context.addCookies([{name:"kaja_member",value:`${slug}.${createHmac("sha256",process.env.SESSION_SECRET).update(slug).digest("hex")}`,url:base,httpOnly:true,sameSite:"Lax"}]);
  await context.addInitScript(()=>{
    window.__shareMode="supported";window.__shareCalls=[];window.__revoked=[];
    const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url);};
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>window.__shareMode!=="unsupported"});
    Object.defineProperty(navigator,"share",{configurable:true,value:data=>{
      window.__shareCalls.push({keys:Object.keys(data),names:data.files.map(file=>file.name),types:data.files.map(file=>file.type)});
      return window.__shareMode==="cancelled"?Promise.reject(new DOMException("Cancelled","AbortError")):window.__shareMode==="error"?Promise.reject(new DOMException("Blocked","NotAllowedError")):Promise.resolve();
    }});
  });
  return context;
}
try {
  const context=await contextFor("patrick"),page=await context.newPage();
  page.setDefaultNavigationTimeout(60000);page.setDefaultTimeout(45000);
  page.on("pageerror",error=>errors.push(error.message));
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}/?view=uploads&brand=kaja&folder=1`,{waitUntil:"domcontentloaded"});
    const cards=page.locator(".upload-compact-files .entry-card-preview");assert.equal(await cards.count(),25);
    const card=cards.first();const bounds=await card.boundingBox();assert(bounds.height>= (width<=800?88:96));assert(bounds.height<130);
    assert.equal(await page.locator(".upload-compact-files .attachment-actions").count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.waitForFunction(()=>{const image=document.querySelector(".upload-file-thumbnail img");return image?.complete && image.naturalWidth>0;});
    await page.screenshot({path:join(output,`compact-${width}.png`),fullPage:true});
    // CSS stress test only: no application data is changed.
    const heading=card.locator("h2"),original=await heading.textContent();await heading.evaluate(el=>el.textContent="Nume foarte lung pentru verificarea casetei și a spațierilor ".repeat(8));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert((await card.boundingBox()).height>bounds.height);await heading.evaluate((el,text)=>el.textContent=text,original);
    await card.press("Enter");const dialog=page.getByRole("dialog",{name:"Alex",exact:true});await dialog.waitFor();
    await dialog.getByRole("button",{name:"Share",exact:true}).waitFor({state:"visible"});await page.waitForFunction(()=>!document.querySelector('.upload-preview-actions button')?.disabled);
    assert.equal(await dialog.locator(".upload-preview-image img").count(),1);assert(await page.evaluate(()=>document.body.style.overflow==="hidden"));
    assert.equal(await dialog.getByRole("button",{name:"Șterge",exact:true}).count(),1);
    for(const action of await dialog.locator(".upload-preview-actions .button").all())assert((await action.boundingBox()).height>=44);
    assert(await dialog.locator(".entry-modal-close").evaluate(el=>el===document.activeElement));
    await dialog.locator(".entry-modal-close").press("Shift+Tab");assert(await dialog.getByRole("button",{name:"Șterge",exact:true}).evaluate(el=>el===document.activeElement));
    await dialog.getByRole("button",{name:"Șterge",exact:true}).press("Tab");assert(await dialog.locator(".entry-modal-close").evaluate(el=>el===document.activeElement));
    await page.screenshot({path:join(output,`preview-${width}.png`)});
    await dialog.getByRole("button",{name:"Share",exact:true}).click();
    const shared=await page.evaluate(()=>window.__shareCalls.at(-1));assert.deepEqual(shared,{keys:["files"],names:["Alex.png"],types:["image/png"]});
    await page.evaluate(()=>window.__shareMode="cancelled");await dialog.getByRole("button",{name:"Share",exact:true}).click();assert.equal(await dialog.locator(".upload-share-message").count(),0);
    await page.evaluate(()=>window.__shareMode="unsupported");const calls=await page.evaluate(()=>window.__shareCalls.length);await dialog.getByRole("button",{name:"Share",exact:true}).click();await dialog.getByText(/Acest browser nu permite/).waitFor();assert.equal(await page.evaluate(()=>window.__shareCalls.length),calls);
    await page.evaluate(()=>window.__shareMode="error");await dialog.getByRole("button",{name:"Share",exact:true}).click();await dialog.getByText(/Distribuirea nu a putut/).waitFor();
    page.once("dialog",jsDialog=>jsDialog.dismiss());await dialog.getByRole("button",{name:"Șterge",exact:true}).click();assert.equal(await cards.count(),25);assert(await dialog.isVisible());
    const downloadPromise=page.waitForEvent("download");await dialog.getByRole("link",{name:"Descarcă PNG",exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),"Alex.png");assert.equal(await download.failure(),null);
    await dialog.press("Escape");await dialog.waitFor({state:"hidden"});assert(await card.evaluate(el=>el===document.activeElement));assert.equal(await page.evaluate(()=>document.body.style.overflow),"");assert((await page.evaluate(()=>window.__revoked.length))>0);
    await card.click();await page.getByRole("dialog").waitFor();await page.locator(".entry-modal-backdrop").click({position:{x:2,y:2}});await page.getByRole("dialog").waitFor({state:"hidden"});
    results.push({width,cards:25,compact:true,preview:true,focus:true,shareScenarios:true,download:true});
  }
  // Test the unavailable preview, disabled Share and recovery, without changing a file.
  await context.route("**/api/attachments/*?preview=1",route=>route.fulfill({status:404,body:"missing"}));
  await page.reload({waitUntil:"domcontentloaded"});await page.locator(".upload-compact-files .entry-card-preview").first().click();
  await page.getByRole("alert").filter({hasText:"Imaginea nu poate fi încărcată"}).waitFor();assert(await page.getByRole("button",{name:"Share",exact:true}).isDisabled());
  await context.unroute("**/api/attachments/*?preview=1");await page.getByRole("button",{name:"Reîncearcă",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.upload-preview-actions button')?.disabled);await page.getByRole("dialog").press("Escape");
  await context.close();
  for(const slug of ["ionut","andrei","igor"]) {
    const memberContext=await contextFor(slug),memberPage=await memberContext.newPage();await memberPage.setViewportSize({width:390,height:900});
    await memberPage.goto(`${base}/?view=uploads&brand=kaja&folder=1`,{waitUntil:"domcontentloaded"});await memberPage.locator(".upload-compact-files .entry-card-preview").first().click();
    await memberPage.getByRole("dialog").waitFor();assert.equal(await memberPage.getByRole("button",{name:"Șterge",exact:true}).count(),0);assert.equal(await memberPage.getByRole("button",{name:"Share",exact:true}).count(),1);
    await memberContext.close();results.push({slug,deleteHidden:true});
  }
  assert.deepEqual(errors,[]);const report={results,previewRecovery:true,consoleErrors:errors,nativeSharingMocked:true,productionMutations:0};writeFileSync(join(output,"share-results.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
