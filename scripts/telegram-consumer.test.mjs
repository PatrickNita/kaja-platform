import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import * as formatter from '../src/lib/telegram-task-digest.ts';
const names=['members','taskAssignees','tasks','telegramDebounce','telegramOutbox'];
const schema=Object.fromEntries(names.map(name=>[name,new Proxy({table:name},{get:(o,k)=>k==='table'?name:`${name}.${String(k)}`})]));
const drizzle=Object.fromEntries(['and','asc','eq','inArray','isNull','lt','lte','or'].map(op=>[op,(...args)=>({op,args})]));
const now=new Date(Date.now()-60000);
let state={actorId:1,generation:'g',sentGeneration:null,dueAt:now,processingGeneration:null};
const base={actorId:1,memberName:'Patrick',brand:'kaja',catalogueGroup:null,reactionType:null,createdAt:now};
let rows=[{...base,id:1,entityType:'task',entityId:10,action:'created',title:'old'}, {...base,id:2,entityType:'task',entityId:11,action:'created',title:'deleted'}, {...base,id:3,entityType:'task',entityId:10,action:'edited',title:'Modificare'}];
const current=[{taskId:10,title:'Actualizat',createdAt:now,memberId:2,name:'Igor'}];
const updates=[], deliveries=[], scheduled=[];
function query(kind,table) {
 let values;
 const q={from(t){table=t;return q},where(predicate){q.predicate=predicate;return q},innerJoin(){return q},orderBy(){return q},limit(){return q},set(v){values=v;return q},returning(){q.ret=true;return q},then(resolve,reject){
  try {
   let result;
   if(kind==='select') result=table.table==='telegramDebounce'?[{...state}]:table.table==='telegramOutbox'?rows:current;
   else {updates.push({table:table.table,values,predicate:q.predicate});if(table.table==='telegramDebounce') state={...state,...values};result=q.ret?[{...state}]:[];}
   return Promise.resolve(result).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject)}
 }};return q;
}
const db={select:()=>query('select'),update:t=>query('update',t),batch:ops=>Promise.all(ops)};
const context=vm.createContext({console,Date,Map,Set,Intl,process:{env:{TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'fake'}},fetch:async(url,options)=>{deliveries.push(JSON.parse(options.body));return {ok:true}}});
const synthetic=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v)},{context});
const dependencies={'@vercel/queue':{send:async(...args)=>scheduled.push(args)},'drizzle-orm':drizzle,'node:crypto':{randomUUID:()=> 'uuid'},'./db':{db},'./schema':schema,'./telegram-task-digest':formatter};
const code=ts.transpileModule(readFileSync('src/lib/telegram.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new vm.SourceTextModule(code,{context});await mod.link(name=>synthetic(dependencies[name]));await mod.evaluate();
await mod.namespace.processTelegramDigest({actorId:1,generation:'g'});
assert.equal(deliveries.length,2);
assert.equal(deliveries[0].text,'Sarcini primite de Igor\n- Actualizat');
assert.deepEqual(deliveries[0].entities,[{type:'bold',offset:0,length:'Sarcini primite de Igor'.length}]);
assert.match(deliveries[1].text,/KAJA\n.*Patrick a modificat sarcina/);
assert(!deliveries.some(m=>m.text.includes('deleted')));
assert.equal(state.sentGeneration,'g');
assert(updates.some(u=>u.table==='telegramOutbox'&&u.values.sentAt));
const before=deliveries.length;await mod.namespace.processTelegramDigest({actorId:1,generation:'g'});assert.equal(deliveries.length,before);
state={...state,generation:'next',sentGeneration:null,dueAt:new Date(Date.now()+1800000)};
await mod.namespace.processTelegramDigest({actorId:1,generation:'next'});assert.equal(scheduled.length,1);assert.equal(deliveries.length,before);

console.log('Consumer passed: current assignment/title, deleted task omitted, edit unchanged, replay suppressed, debounce rescheduled. No network used.');


