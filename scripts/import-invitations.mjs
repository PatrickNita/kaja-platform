// Explicit, resumable import into the linked private Blob store. No activity notifications.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { put, get, head, BlobNotFoundError } from "@vercel/blob";

const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575") throw Error("Unexpected project");
const source = process.argv[2];
if (!source || !process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) throw Error("Source directory, DATABASE_URL and BLOB_READ_WRITE_TOKEN required");
const expected = ["Alex", "Marina", "Tatiana", "Andrei", "Ivan", "Alexei", "Alexandru", "Vlad", "Arian", "Olga", "Sergiu", "Vova", "Aurel", "Serghei", "Nichita", "Vadim", "Lucian", "Kolya", "Denis", "Iliusha", "Valera", "Dima", "Voskan", "Oaspete Hookah Place", "Oaspete Kamora"];
const filenames = readdirSync(source).filter(name => name.toLowerCase().endsWith(".png"));
if (filenames.length !== expected.length || expected.some(name => !filenames.includes(name + ".png"))) throw Error("Expected exactly the 25 approved invitations");
const inputs = expected.map(name => {
  const filename = name + ".png", bytes = readFileSync(join(source, filename));
  if (bytes.length > 25 * 1024 * 1024 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("Invalid PNG: " + filename);
  return { filename, bytes, hash: createHash("sha256").update(bytes).digest("hex") };
});
const query = neon(process.env.DATABASE_URL);
const [actor] = await query`select id from members where slug='patrick'`;
if (!actor) throw Error("Patrick not found");
const title = "Invitatii 01. Noiembrie", subtitle = "Degustare HOOKAH PLACE";
let [folder] = await query`select * from attachment_folders where brand='kaja' and title=${title} and deleted_at is null`;
if (!folder) [folder] = await query`insert into attachment_folders(brand,title,subtitle,published,created_by) values('kaja',${title},${subtitle},false,${actor.id}) returning *`;
if (folder.subtitle !== subtitle) throw Error("Existing folder metadata mismatch");
if (process.argv.includes("--prepare-only")) { console.log(JSON.stringify({ folderId: folder.id, published: folder.published, prepared: true })); process.exit(0); }
for (const input of inputs) {
  const [existing] = await query`select id,url from attachments where folder_id=${folder.id} and filename=${input.filename} and deleted_at is null`;
  if (!existing) {
    const pathname = `attachments/kaja/invitations-2026-11-01/${input.hash}-${input.filename.replace(/ /g,"-")}`;
    let blob;
    try { blob = await head(pathname); } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
      blob = await put(pathname, input.bytes, { access: "private", contentType: "image/png", addRandomSuffix: false, allowOverwrite: false });
    }
    await query`insert into attachments(brand,filename,content_type,folder_id,pathname,url,size,uploaded_by) values('kaja',${input.filename},'image/png',${folder.id},${blob.pathname},${blob.url},${input.bytes.length},${actor.id}) on conflict do nothing`;
  }
  console.log(`Stored ${input.filename}`);
}
const rows = await query`select filename,url,content_type from attachments where folder_id=${folder.id} and deleted_at is null order by filename`;
if (rows.length !== 25 || rows.some(row => !inputs.some(input => input.filename === row.filename) || row.content_type !== "image/png")) throw Error("Incomplete folder; left unpublished");
for (const row of rows) {
  const blob = await get(row.url, { access: "private", useCache: false });
  if (!blob || blob.statusCode !== 200) throw Error("Missing blob: " + row.filename);
  const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
  const expectedHash = inputs.find(input => input.filename === row.filename).hash;
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw Error("Stored content mismatch: " + row.filename);
}
await query`update attachment_folders set published=true where id=${folder.id}`;
console.log(JSON.stringify({ folderId: folder.id, title, files: rows.length, verified: true, published: true, url: `https://kaja-platform.vercel.app/?view=uploads&brand=kaja&folder=${folder.id}` }));
