import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";
import * as variants from "../src/lib/image-variant-path.ts";
import * as schema from "../src/lib/schema.ts";
const require=createRequire(import.meta.url);
let rows=[],blob=null,calls=0,query,requested=[],member=true;
class MissingBlob extends Error {}
const record={url:"https://private.example/item-images/kaja/source.png",pathname:"item-images/kaja/source.png"};
function load(file,privateRoute=false){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const route={};
 new Function("exports","require",source)(route,name=>{
  if(name==="@vercel/blob")return {BlobNotFoundError:MissingBlob,get:async(url,options)=>{assert.equal(options.access,"private");requested.push(url);return blob;}};
  if(name==="next/server")return {NextResponse:Response};
  if(name.endsWith("/image-variant-path"))return variants;
  if(name.endsWith("/schema"))return schema;
  if(name.endsWith("/auth"))return {currentMember:async()=>member?{slug:"patrick"}:null};
  if(name.endsWith("/db"))return {db:privateRoute?{select:()=>({from:()=>({innerJoin:()=>({where:async()=>{calls++;return rows;}})})})}:{execute:async(statement)=>{calls++;query=new PgDialect().sqlToQuery(statement);return {rows};}}};
  return require(name);
 });return route;
}
const route=load("../src/app/api/product-images/[id]/route.ts");
const privateRoute=load("../src/app/api/item-images/[id]/route.ts",true);
const request=(id,variant,privateMode=false)=>(privateMode?privateRoute:route).GET(new Request("https://example.test/api/image/"+id+(variant===undefined?"":"?variant="+variant)),{params:Promise.resolve({id})});
for(const id of ["0","-1","1.5","abc","01","9007199254740992","2147483648"])assert.equal((await request(id)).status,404);
for(const v of ["full","original","999","../source"])assert.equal((await request("25",v)).status,400);
assert.equal(calls,0);assert.equal((await request("25")).status,404);assert.deepEqual(query.params,[25]);
for(const rule of ["im.deleted_at is null","w.deleted_at is null","w.brand='kaja'","w.section='catalogue'","w.catalogue_group='live'","w.feedback_slug is not null","first_image.deleted_at is null","order by first_image.position,first_image.id limit 1"])assert(query.sql.includes(rule),rule);
rows=[record];requested=[];assert.equal((await request("25")).status,404);assert.deepEqual(requested,[variants.imageVariantUrl(record,"thumb")]);
blob={statusCode:200,headers:new Headers({"content-type":"image/png"}),stream:new ReadableStream()};assert.equal((await request("25")).status,404);
for(const v of [undefined,"thumb","preview"]){
 blob={statusCode:200,headers:new Headers({"content-type":"image/webp"}),stream:new Blob(["webpbytes"]).stream()};
 const response=await request("25",v);assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/webp");assert.equal(response.headers.get("cache-control"),"private, max-age=3600");assert.equal(response.headers.get("content-length"),"9");assert.equal(response.headers.get("x-content-type-options"),"nosniff");assert.equal(await response.text(),"webpbytes");assert.equal(requested.at(-1),variants.imageVariantUrl(record,v??"thumb"));
}
member=false;assert.equal((await request("25",undefined,true)).status,401);assert.equal((await request("25","thumb",true)).status,401);
member=true;requested=[];blob=null;assert.equal((await request("25","thumb",true)).status,404);assert.deepEqual(requested,[variants.imageVariantUrl(record,"thumb")]);
blob={statusCode:200,headers:new Headers({"content-type":"image/png"}),stream:new Blob(["original"]).stream()};const original=await request("25",undefined,true);assert.equal(original.status,200);assert.equal(requested.at(-1),record.url);assert.equal(await original.text(),"original");
console.log("Public thumbnail/preview variants, restricted originals, authentication, missing variants without PNG fallback and caching: passed");
