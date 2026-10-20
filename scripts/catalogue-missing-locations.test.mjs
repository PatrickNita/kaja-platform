import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const usage={},schema={},route={};new Function('exports','require',compile('../src/lib/catalogue-usage.ts'))(usage,require);new Function('exports','require',compile('../src/lib/schema.ts'))(schema,require);
let member=null,selects=0,executions=0,item={name:' brain  FREEZE ',title:'ignored'},products=[{id:1,name:'BRAIN FREEZE'}],fail=false;
const db={select(){const rows=selects++===0?(item?[item]:[]):products;return {from(){return this},where(){return this},limit(){return Promise.resolve(rows)},then(ok,err){return Promise.resolve(rows).then(ok,err)}}},async execute(){executions++;if(fail)throw Error('private database error');return {rows:[{id:7,name:'Local test',address:'Address test'}]}}};
new Function('exports','require',compile('../src/app/api/catalogue/[id]/missing-locations/route.ts'))(route,name=>{
 if(name==='next/server')return {NextResponse:{json:(data,init)=>Response.json(data,init)}};
 if(name.endsWith('/auth'))return {currentMember:async()=>member};if(name.endsWith('/db'))return {db};if(name.endsWith('/schema'))return schema;if(name.endsWith('/catalogue-usage'))return usage;return require(name);
});
async function get(id='1'){selects=0;return route.GET(new Request('http://localhost/api/catalogue/'+id+'/missing-locations'),{params:Promise.resolve({id})})}
assert.equal((await get()).status,401);assert.equal(selects,0);assert.equal(executions,0);
for(const slug of ['patrick','ionut','andrei','igor']){member={slug};const r=await get();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(await r.json(),{locations:[{id:7,name:'Local test',address:'Address test'}]});}
for(const id of ['0','-1','1x','2147483648'])assert.equal((await get(id)).status,400);
item=null;assert.equal((await get()).status,404);item={name:'Unknown',title:'Unknown'};assert.equal((await get()).status,422);item={name:'BRAIN FREEZE',title:''};products.push({id:2,name:'brain freeze'});assert.equal((await get()).status,422);products.pop();fail=true;const error=await get();assert.equal(error.status,503);assert(!(await error.text()).includes('private database error'));
console.log('PASS: four members, unauthorized access, validation, unavailable/unmapped/ambiguous products, no-store, limited response and safe database errors.');
