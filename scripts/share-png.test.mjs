import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require=createRequire(import.meta.url);
function compile(path, overrides={}) {
  const exports={};
  const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function("exports","require",source)(exports,name=>overrides[name]??require(name));return exports;
}
const {sharePng,prepareSharePng}=compile("../src/lib/share-png.ts");
const file=new File([new Uint8Array([137,80,78,71,13,10,26,10])],"Oaspete Hookah Place.png",{type:"image/png"});
assert.equal(await sharePng(file,{}),"unsupported");
let calls=0;
assert.equal(await sharePng(file,{canShare:()=>false,share:async()=>{calls++;}}),"unsupported");assert.equal(calls,0);
const api={canShare(data){assert.deepEqual(Object.keys(data),["files"]);return true;},share(data){assert.equal(this,api);calls++;assert.deepEqual(data,{files:[file]});return Promise.resolve();}};
const sharing=sharePng(file,api);assert.equal(calls,1,"Share must start synchronously inside user click");assert.equal(await sharing,"opened");
assert.equal(await sharePng(file,{canShare:()=>true,share:async()=>{throw new DOMException("Cancelled","AbortError");}}),"cancelled");
await assert.rejects(sharePng(file,{canShare:()=>true,share:async()=>{throw new DOMException("Blocked","NotAllowedError");}}),{name:"NotAllowedError"});
const controller=new AbortController();
const prepared=await prepareSharePng(25,file.name,controller.signal,async(url,options)=>{
  assert.equal(url,"/api/attachments/25?preview=1");assert.equal(options.credentials,"same-origin");assert.equal(options.cache,"no-store");assert.equal(options.signal,controller.signal);
  return new Response(await file.arrayBuffer(),{headers:{"Content-Type":"image/png"}});
});
assert.equal(prepared.name,file.name);assert.equal(prepared.type,"image/png");assert.equal(prepared.size,file.size);
for(const response of [new Response("Unauthorized",{status:401}),new Response("missing",{status:404}),new Response("wrong",{headers:{"Content-Type":"text/html"}}),new Response(null,{headers:{"Content-Type":"image/png"}})]) await assert.rejects(prepareSharePng(1,"test.png",controller.signal,async()=>response));
const preview=compile("../src/app/upload-file-preview.tsx",{"../lib/share-png":{prepareSharePng,sharePng},"./entry-modal-state":{useEntryModalState:()=>({closeEntry(){},saving:false})}});
const pdf=renderToStaticMarkup(React.createElement(preview.UploadFilePreview,{id:1,filename:"Report.pdf",contentType:"application/pdf",metadata:"KAJA · PDF",children:null}));
assert(pdf.includes("Descarcă PDF"));assert(pdf.includes("Document PDF"));assert(!pdf.includes(">Share</button>"));
const png=renderToStaticMarkup(React.createElement(preview.UploadFilePreview,{id:2,filename:file.name,contentType:"image/png",metadata:"KAJA · PNG",children:null}));
assert(png.includes("Descarcă PNG"));assert(png.includes(">Share</button>"));assert(png.includes("disabled=\"\""));assert(png.includes("Se pregătește imaginea"));
console.log("Share PNG: native file payload, immediate activation, unsupported, cancellation, errors, protected preparation and PDF/PNG rendering passed.");

// Each query has a separate result: folder metadata, then an empty file list.
let query=0;
const fakeDb={select:()=>({from:()=>({where:()=>({orderBy:async()=>++query===1?[{id:1,brand:"kaja",title:"Dosar gol",subtitle:"Test",published:true}]:[]})})})};
const library=compile("../src/app/upload-library.tsx",{
  "drizzle-orm":{and:()=>{},desc:()=>{},eq:()=>{},isNull:()=>{},or:()=>{},sql:()=>{}},
  "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
  "next/navigation":{notFound:()=>{throw Error("Not found");}},
  "../lib/db":{db:fakeDb},"../lib/schema":{attachmentFolders:{},attachments:{}},
  "./actions":{deleteAttachment:()=>{}},"./confirm-delete-button":{ConfirmDeleteButton:()=>null},
  "./pdf-uploader":{PdfUploader:()=>null},"./upload-folder-form":{UploadFolderForm:()=>null},
  "./upload-folder-actions":{deleteUploadFolder:()=>{}},
  "./merch-grid":{ModalEntryGrid:({children})=>React.createElement("div",null,children),ModalEntryCard:()=>null},
  "./upload-file-preview":{UploadFilePreview:()=>null,UploadFileThumbnail:()=>null},
});
const empty=renderToStaticMarkup(await library.UploadLibrary({brandFilter:"kaja",memberSlug:"igor",folderParam:"1"}));
assert(empty.includes("Dosar gol"));assert(empty.includes("Nu există fișiere"));assert(!empty.includes("Șterge"));
console.log("Empty folder rendering and member controls: passed.");
