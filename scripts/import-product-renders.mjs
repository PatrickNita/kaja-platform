// Explicit, resumable import of the approved KAJA original renders. No notifications.
import { readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ensureProductImageVariants } from "../src/lib/product-image-variants.ts";
import { put, get, head, BlobNotFoundError } from "@vercel/blob";

const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575") throw Error("Unexpected project");
const source = process.argv[2];
if (!source || !process.env.DATABASE_URL) throw Error("Source and DATABASE_URL required");
const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));
if (manifest.length !== 25 || new Set(manifest.map(p => p.name)).size !== 25 || new Set(manifest.map(p => p.filename)).size !== 25) throw Error("Expected 25 unique products and files");
const q = neon(process.env.DATABASE_URL);
const items = await q`select id,product_name,feedback_slug from workspace_items where brand='kaja' and section='catalogue' and catalogue_group='live' and deleted_at is null`;
const b2b = await q`select id,name from b2b_products`;
const [actor] = await q`select id from members where slug='patrick'`;
if (!actor) throw Error("Patrick missing");
const inputs = manifest.map(p => {
  const matches = items.filter(i => i.product_name === p.name && i.feedback_slug === p.slug);
  if (matches.length !== 1 || b2b.filter(i => i.name.toLowerCase().trim() === p.name.toLowerCase().trim()).length !== 1) throw Error("Ambiguous or missing product: " + p.name);
  if (p.filename !== basename(p.filename)) throw Error("Invalid filename");
  const bytes = readFileSync(join(source,p.filename));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== p.sha256 || bytes.length > 10*1024*1024 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024) throw Error("Invalid square PNG: " + p.filename);
  return { ...p, itemId: matches[0].id, bytes, hash };
});
if (process.argv.includes("--dry-run")) { console.log(JSON.stringify({ validated:inputs.length, products:inputs.map(p=>({name:p.name,itemId:p.itemId})) })); process.exit(0); }
if (!process.env.BLOB_READ_WRITE_TOKEN) throw Error("BLOB_READ_WRITE_TOKEN required");
const previous = await q`select id,item_id,pathname from workspace_item_images where deleted_at is null and item_id=any(${inputs.map(p=>p.itemId)}::int[])`;
const report = [];
for (const p of inputs) {
  const pathname = `item-images/kaja/renders/${p.itemId}-${p.hash}.png`;
  let blob;
  try { blob = await head(pathname); } catch(error) {
    if (!(error instanceof BlobNotFoundError)) throw error;
    blob = await put(pathname,p.bytes,{access:"private",contentType:"image/png",addRandomSuffix:false,allowOverwrite:false});
  }
  await ensureProductImageVariants(blob,p.bytes);
  await q`insert into workspace_item_images(brand,item_id,pathname,url,position,uploaded_by)
    select 'kaja',${p.itemId},${blob.pathname},${blob.url},coalesce((select min(position) from workspace_item_images where item_id=${p.itemId} and deleted_at is null),0)-1,${actor.id}
    on conflict(pathname) do nothing`;
  const [image] = await q`select id,pathname,url from workspace_item_images where item_id=${p.itemId} and brand='kaja' and deleted_at is null order by position,id limit 1`;
  if (image?.pathname !== pathname) throw Error("Render is not primary: " + p.name);
  const stored = await get(image.url,{access:"private",useCache:false});
  if (!stored || stored.statusCode !== 200) throw Error("Missing stored image: " + p.name);
  const downloaded = Buffer.from(await new Response(stored.stream).arrayBuffer());
  if (createHash("sha256").update(downloaded).digest("hex") !== p.hash) throw Error("Stored bytes mismatch: " + p.name);
  report.push({name:p.name,slug:p.slug,itemId:p.itemId,imageId:image.id,sha256:p.hash});
  console.log("Verified " + p.name);
}
const after = await q`select id from workspace_item_images where deleted_at is null and item_id=any(${inputs.map(p=>p.itemId)}::int[])`;
if (previous.some(p=>!after.some(i=>i.id===p.id))) throw Error("An existing image was lost");
writeFileSync(join(source,"uploaded.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({verified:report.length,existingImagesPreserved:previous.length}));
