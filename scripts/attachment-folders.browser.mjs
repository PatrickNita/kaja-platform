// Read-only browser verification. Never submits a valid upload or creates/deletes data.
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = process.env.UPLOAD_QA_BASE ?? "http://localhost:3130";
assert(["localhost","127.0.0.1","kaja-platform.vercel.app"].includes(new URL(base).hostname));
const output = process.env.UPLOAD_QA_DIR; assert(output); mkdirSync(output,{recursive:true});
const q = neon(process.env.DATABASE_URL);
const [folder] = await q`select * from attachment_folders where brand='kaja' and title='Invitatii 01. Noiembrie' and deleted_at is null`;
assert(folder);
const files = await q`select * from attachments where folder_id=${folder.id} and deleted_at is null order by filename`;
const [pdf] = await q`select * from attachments where folder_id is null and content_type='application/pdf' and deleted_at is null limit 1`;
const browser = await chromium.launch({channel:"chrome",headless:true});
const errors=[], results=[];
try {
  for (const slug of ["patrick","ionut","andrei","igor"]) {
    const context = await browser.newContext();
    const signature = createHmac("sha256",process.env.SESSION_SECRET).update(slug).digest("hex");
    await context.addCookies([{name:"kaja_member",value:`${slug}.${signature}`,url:base,httpOnly:true,sameSite:"Lax"}]);
    const page = await context.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      for(const brand of ["kaja","all"]) {
        await page.goto(`${base}/?view=uploads&brand=${brand}`,{waitUntil:"networkidle"});
        assert.equal(await page.locator(".upload-folder-card").filter({hasText:folder.title}).count(),folder.published || slug==="patrick" ? 1 : 0);
        assert.equal(await page.locator(".upload-file-card").filter({hasText:"Oaspete Kamora"}).count(),0);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${slug} ${width} ${brand} overflow`);
      }
      const response = await page.goto(`${base}/?view=uploads&brand=kaja&folder=${folder.id}`,{waitUntil:"networkidle"});
      if(!folder.published && slug!=="patrick") { assert.equal(response.status(),404); continue; }
      assert.equal(response.status(),200);
      assert.equal(await page.locator(".upload-image-card").count(),files.length);
      assert.equal(await page.getByText("Degustare HOOKAH PLACE",{exact:true}).count(),1);
      assert.equal(await page.getByText("Editează dosarul",{exact:true}).count(),slug==="patrick"?1:0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${slug} ${width} folder overflow`);
      if(slug==="patrick") {
        await page.screenshot({path:join(output,`folder-${width}.png`),fullPage:true});
        await page.getByText("Încarcă fișier",{exact:true}).click();
        await page.locator("input[type=file]").setInputFiles({name:"blocked.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});
        assert.equal(await page.getByText("Sunt permise doar PDF și PNG.",{exact:true}).count(),1);
        await page.getByText("Încarcă fișier",{exact:true}).click();
      }
      await page.getByRole("link",{name:"Înapoi la încărcări"}).click();
      await page.waitForURL(url=>!url.searchParams.has("folder"));
      results.push({slug,width,passed:true});
    }
    if(slug==="patrick" || folder.published) {
      for(const file of slug==="patrick" ? files : files.slice(0,1)) {
        const download = await context.request.get(`${base}/api/attachments/${file.id}`);
        assert.equal(download.status(),200);assert.equal(download.headers()["content-type"],"image/png");
        assert(download.headers()["content-disposition"].startsWith("attachment"));
        const bytes=await download.body();
        if(process.env.UPLOAD_QA_SOURCE) assert.equal(createHash("sha256").update(bytes).digest("hex"),createHash("sha256").update(readFileSync(join(process.env.UPLOAD_QA_SOURCE,file.filename))).digest("hex"));
        const preview = await context.request.get(`${base}/api/attachments/${file.id}?preview=1`);
        assert.equal(preview.status(),200);assert(preview.headers()["content-disposition"].startsWith("inline"));
      }
    }
    if(pdf) {const response=await context.request.get(`${base}/api/attachments/${pdf.id}`);assert.equal(response.status(),200);assert.equal(response.headers()["content-type"],"application/pdf");}
    await context.close();
  }
  const anon=await browser.newContext();
  const protectedId=files[0]?.id ?? pdf?.id ?? 1;
  assert.equal((await anon.request.get(`${base}/api/attachments/${protectedId}`)).status(),401);
  await anon.close();
  assert.deepEqual(errors,[]);
  const report={base,folderId:folder.id,published:folder.published,files:files.length,results,consoleErrors:errors,pdfVerified:Boolean(pdf),anonymousDenied:true};
  writeFileSync(join(output,"results.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally { await browser.close(); }
