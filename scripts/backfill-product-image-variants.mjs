// Generates private derivatives only. Existing images and database rows are untouched.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";
import { get } from "@vercel/blob";
import { ensureProductImageVariants } from "../src/lib/product-image-variants.ts";
const project=JSON.parse(readFileSync(new URL("../.vercel/project.json",import.meta.url),"utf8"));
if(project.projectId!=="prj_Ip1P7MnHAcBYOkIfs5gzLehy7575")throw Error("Unexpected project");
const source=process.argv[2];
if(!source||!process.env.DATABASE_URL||!process.env.BLOB_READ_WRITE_TOKEN)throw Error("Source and credentials required");
const manifest=JSON.parse(readFileSync(join(source,"manifest.json"),"utf8"));
const uploaded=JSON.parse(readFileSync(join(source,"uploaded.json"),"utf8"));
if(manifest.length!==25||uploaded.length!==25)throw Error("Expected 25 approved renders");
const q=neon(process.env.DATABASE_URL);
const records=await q`select im.id,im.pathname,im.url,w.product_name as name from workspace_item_images im join workspace_items w on w.id=im.item_id and w.brand=im.brand where im.deleted_at is null and w.deleted_at is null and w.brand='kaja' and w.section='catalogue' and w.catalogue_group='live'`;
const inputs=manifest.map(p=>{
 const record=records.find(r=>r.id===uploaded.find(u=>u.name===p.name)?.imageId&&r.name===p.name);
 const bytes=readFileSync(join(source,p.filename));
 if(!record||!record.pathname.endsWith(p.sha256+".png")||createHash("sha256").update(bytes).digest("hex")!==p.sha256)throw Error("Source mismatch: "+p.name);
 return {record,bytes,slug:p.slug};
});
const report=[];
for(const {record,bytes,slug} of inputs){
 const variants=await ensureProductImageVariants(record,bytes);
 const entry={imageId:record.id,name:record.name,slug};
 for(const v of variants){
  const stored=await get(v.url,{access:"private",useCache:false});
  if(!stored||stored.statusCode!==200)throw Error("Missing variant");
  const data=Buffer.from(await new Response(stored.stream).arrayBuffer());
  const metadata=await sharp(data).metadata();const size=v.variant==='thumb'?96:320;
  if(metadata.format!=="webp"||metadata.width!==size||metadata.height!==size||data.byteLength>(v.variant==='thumb'?5000:25000))throw Error("Invalid variant: "+record.name);
  writeFileSync(join(source,slug+"."+v.variant+".webp"),data);
  entry[v.variant]={bytes:data.byteLength,sha256:createHash("sha256").update(data).digest("hex")};
 }
 report.push(entry);console.log("Verified variants: "+record.name);
}
writeFileSync(join(source,"variants.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({products:report.length,thumbBytes:report.reduce((s,p)=>s+p.thumb.bytes,0),previewBytes:report.reduce((s,p)=>s+p.preview.bytes,0)}));
