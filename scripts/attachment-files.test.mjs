import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(path, overrides = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", source)(exports, name => overrides[name] ?? require(name));
  return exports;
}
const model = compile("../src/lib/attachment-files.ts");
assert.equal(model.attachmentContentType("Alex.png"), "image/png");
assert.equal(model.attachmentContentType("Existing.PDF"), "application/pdf");
for (const filename of ["", "x.svg", "x.exe.png/../x.png", "x\r.png", "a".repeat(256)+".png", "x.png.exe"]) assert.equal(model.attachmentContentType(filename), null);
const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
assert(model.validAttachmentSignature(png, "image/png"));
assert(!model.validAttachmentSignature(new TextEncoder().encode("not a PNG"), "image/png"));
assert(model.validAttachmentSignature(new TextEncoder().encode("%PDF-1.7"), "application/pdf"));
assert(!model.validAttachmentSignature(png, "application/pdf"));
let member = null, selected = [], gets = 0;
const db = { select() { return { from() { return { where: async () => selected.shift() ?? [] }; } }; } };
const route = compile("../src/app/api/attachments/[id]/route.ts", {
  "next/server": { NextResponse: Response },
  "../../../../lib/auth": { currentMember: async () => member },
  "../../../../lib/db": { db },
  "../../../../lib/schema": { attachments: {}, attachmentFolders: {} },
  "drizzle-orm": { and:()=>{}, eq:()=>{}, isNull:()=>{} },
  "@vercel/blob": { get: async () => { gets++; return { statusCode:200, stream: new ReadableStream({start(c){c.enqueue(png);c.close();}}) }; } },
});
const request = (id="1", preview="") => route.GET(new Request("https://example.test/api/attachments/"+id+preview), { params: Promise.resolve({ id }) });
assert.equal((await request()).status,401); assert.equal(gets,0);
const file = { id:1, brand:"kaja", filename:"Alex.png", contentType:"image/png", folderId:1, url:"private" };
for (const slug of ["patrick","ionut","andrei","igor"]) {
  member = {slug}; selected = [[file],[{brand:"kaja",published:true}]];
  const response = await request("1","?preview=1"); assert.equal(response.status,200);
  assert.equal(response.headers.get("Content-Type"),"image/png"); assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert(response.headers.get("Content-Disposition").startsWith("inline"));
}
member={slug:"igor"}; selected=[[file],[{brand:"kaja",published:false}]]; assert.equal((await request()).status,404);
selected=[[file],[{brand:"kaja",published:true}]];const opened=await request("1","?open=1");assert.equal(new URL(opened.headers.get("location")).searchParams.get("folder"),"1");
selected=[[file],[]]; assert.equal((await request()).status,404);
selected=[[file],[{brand:"virginia",published:true}]]; assert.equal((await request()).status,404);
assert.equal((await request("invalid")).status,404);
selected=[[{...file, filename:"old.pdf", contentType:"application/pdf", folderId:null}]];
const pdf = await request("1","?preview=1"); assert.equal(pdf.headers.get("Content-Type"),"application/pdf"); assert(pdf.headers.get("Content-Disposition").startsWith("attachment"));
console.log("Attachment validation and protected downloads: all cases passed.");

let hooks, inserts=0, deletes=0, folderExists=true, bytes=png;
const uploadDb = {
  select() { return { from(table) { return { where: async () => table === "folders" ? folderExists ? [{id:1,brand:"kaja"}] : [] : table === "members" ? [{id:1}] : [] }; } }; },
  insert() { return { values() { return { onConflictDoNothing() { return { returning: async()=>{inserts++;return [{id:2,filename:"Alex.png"}];}, then:ok=>Promise.resolve().then(ok) }; } }; } }; },
};
const uploadRoute = compile("../src/app/api/uploads/route.ts", {
  "next/server": { NextResponse: { json:Response.json } },
  "@vercel/blob/client": { handleUpload:async options=>{hooks=options;return {};} },
  "@vercel/blob": { del:async()=>{deletes++;}, get:async()=>({statusCode:200,blob:{size:bytes.length},stream:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})}) },
  "../../../lib/auth": { currentMember:async()=>member },
  "../../../lib/db": { db:uploadDb, memberSeed:[{slug:"patrick"}] },
  "../../../lib/schema": { attachments:"attachments",attachmentFolders:"folders",members:"members" },
  "../../../lib/activity": { recordActivity:async(_member,_event,options)=>{assert.equal(options.notifyTelegram,false);} },
  "../../../lib/attachment-files":model,
  "drizzle-orm": {and:()=>{},eq:()=>{},isNull:()=>{}},
});
await uploadRoute.POST(new Request("https://example.test/api/uploads",{method:"POST",body:"{}"}));
const token = payload=>hooks.onBeforeGenerateToken("path",JSON.stringify(payload));
for (const slug of [null,"igor","ionut","andrei"]) {member=slug?{slug}:null;await assert.rejects(token({filename:"Alex.png",brand:"kaja"}));}
member={slug:"patrick"};
for (const payload of [{filename:"x.svg",brand:"kaja"},{filename:"x.png",brand:"bad"},{filename:"x.png",brand:"kaja",folderId:-1}]) await assert.rejects(token(payload));
folderExists=false;await assert.rejects(token({filename:"x.png",brand:"kaja",folderId:1}));folderExists=true;
const granted=await token({filename:"Alex.png",brand:"kaja",folderId:1});assert.deepEqual(granted.allowedContentTypes,["image/png"]);assert.equal(granted.maximumSizeInBytes,25*1024*1024);
const complete=()=>hooks.onUploadCompleted({blob:{url:"private",pathname:"path",contentType:"image/png"},tokenPayload:granted.tokenPayload});
bytes=new TextEncoder().encode("fake PNG");await complete();assert.equal(inserts,0);assert.equal(deletes,1);
bytes=png;await complete();assert.equal(inserts,1);
console.log("Upload permissions, folder validation and binary signatures: passed.");
