import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let member=null, calls=0, fail=false, found=true;
const route={};
const code=ts.transpileModule(readFileSync('src/app/api/b2b/locations/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('exports','require',code)(route,name=>{
 if(name==='next/server')return {NextResponse:{json:(v,o)=>Response.json(v,o)}};
 if(name.endsWith('/auth'))return {currentMember:async()=>member};
 if(name.endsWith('/b2b/server'))return {loadData:async(location,id)=>{calls++;assert.equal(location,undefined);assert.equal(id,12);if(fail)throw Error('secret');return {locations:found?[{id:12,name:'Local test'}]:[],products:[],orders:[{private:'not exposed'}]}}};
 throw Error(name);
});
const get=id=>route.GET(new Request('https://example.test/api/b2b/locations/'+id),{params:Promise.resolve({id})});
assert.equal((await get('12')).status,401);assert.equal(calls,0);
for(const slug of ['patrick','ionut','andrei','igor']){member={slug};const response=await get('12');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(Object.keys(await response.json()).sort(),['location','memberSlug','products']);}
for(const id of ['0','-1','1.2','2147483648','abc'])assert.equal((await get(id)).status,400);
found=false;assert.equal((await get('12')).status,404);fail=true;const bad=await get('12');assert.equal(bad.status,503);assert(!(await bad.text()).includes('secret'));
console.log('PASS venue detail API: authentication, four roles, scoped ID, minimal response, validation, safe errors.');
