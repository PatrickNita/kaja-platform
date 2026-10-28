import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as variants from '../src/lib/image-variant-path.ts';
let member={slug:'patrick'},attachment={id:1,pathname:'attachments/a.png',url:'https://private.example/attachments/a.png',contentType:'image/png',filename:'A.png',brand:'kaja',folderId:1},folder={brand:'kaja',published:true},blob,requested=[];
class Missing extends Error{}
const source=ts.transpileModule(readFileSync(new URL('../src/app/api/attachments/[id]/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const route={};new Function('exports','require',source)(route,name=>{
 if(name==='@vercel/blob')return {BlobNotFoundError:Missing,get:async url=>{requested.push(url);return blob;}};
 if(name==='next/server')return {NextResponse:Response};
 if(name==='drizzle-orm')return {and:()=>0,eq:()=>0,isNull:()=>0};
 if(name.endsWith('/image-variant-path'))return variants;
 if(name.endsWith('/auth'))return {currentMember:async()=>member};
 if(name.endsWith('/schema'))return {attachments:{},attachmentFolders:{}};
 if(name.endsWith('/db')){let count=0;return {db:{select:()=>({from:()=>({where:async()=>++count%2?[attachment]:[folder]})})}};}
 throw Error(name);
});
const request=(query='')=>route.GET(new Request('https://example.test/api/attachments/1'+query),{params:Promise.resolve({id:'1'})});
member=null;assert.equal((await request('?variant=thumb')).status,401);assert.equal(requested.length,0);member={slug:'andrei'};
folder.published=false;assert.equal((await request('?variant=thumb')).status,404);assert.equal(requested.length,0);folder.published=true;
blob=null;assert.equal((await request('?variant=thumb')).status,404);assert.equal(requested.at(-1),variants.imageVariantUrl(attachment,'thumb'));
for(const variant of ['thumb','preview']){blob={statusCode:200,headers:new Headers({'content-type':'image/webp'}),stream:new Blob(['small']).stream()};const response=await request('?variant='+variant);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(await response.text(),'small');assert.equal(requested.at(-1),variants.imageVariantUrl(attachment,variant));}
blob={statusCode:200,stream:new Blob(['original']).stream()};let response=await request('?preview=1');assert.equal(response.headers.get('content-type'),'image/png');assert(response.headers.get('content-disposition').startsWith('inline'));assert.equal(requested.at(-1),attachment.url);
response=await request();assert(response.headers.get('content-disposition').startsWith('attachment'));
attachment.contentType='application/pdf';attachment.filename='A.pdf';response=await request();assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal((await request('?variant=thumb')).status,400);
console.log('Attachment variants: authentication, unpublished folders, no original fallback, PNG originals and PDF compatibility passed');
