import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {neon} from '@neondatabase/serverless';
const content=readFileSync(new URL('../drizzle/0026_b2b_order_reliability.sql',import.meta.url),'utf8');
const hash=createHash('sha256').update(content).digest('hex'),when=1793872800000;
export async function migrateOrderReliability(db,{journal=false}={}){
 const [state]=await db.query("select to_regclass('b2b_order_counter') is not null as applied");
 if(state.applied){if(journal){const [entry]=await db.query('select hash from drizzle.__drizzle_migrations where created_at=$1',[when]);assert.equal(entry?.hash,hash);}return {alreadyApplied:true};}
 if(journal){const [previous]=await db.query('select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1');assert.equal(Number(previous?.created_at),1793707200000,'Unexpected migration state');}
 await db.transaction(content.split('--> statement-breakpoint').map(text=>db.query(text)).concat(journal?[db.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)',[hash,when])]:[]));
 return {alreadyApplied:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));assert.equal(project.projectId,'prj_Ip1P7MnHAcBYOkIfs5gzLehy7575');
 const db=neon(process.env.DATABASE_URL),before=await db.query('select * from b2b_orders order by id');
 const mapping=await db.query("select id,order_number as previous_number,row_number() over(order by created_at,id)::int as new_number,location_snapshot->>'name' as location from b2b_orders order by created_at,id");
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',mapping},null,2));
 if(process.argv.includes('--apply')){
  const reportArg=process.argv.indexOf('--report'),path=reportArg>=0?process.argv[reportArg+1]:null;assert(path,'A backup/report path is required');
  const protectedTables=['b2b_order_items','b2b_products','b2b_cashback','member_order_seen','b2b_notifications'];const backup={orders:before};for(const t of protectedTables)backup[t]=await db.query(`select * from ${t} order by 1,2`);writeFileSync(path+'.before.json',JSON.stringify(backup,null,2));
  const result=await migrateOrderReliability(db,{journal:true});const after=await db.query('select * from b2b_orders order by id');assert.deepEqual(after.map(({order_number,...o})=>o),before.map(({order_number,...o})=>o));for(const t of protectedTables)assert.deepEqual(await db.query(`select * from ${t} order by 1,2`),backup[t],t+' changed');
  const numbers=after.map(o=>o.order_number).sort((a,b)=>a-b);assert.deepEqual(numbers,Array.from({length:after.length},(_,i)=>i+1));
  const report={...result,mapping,orders:after.length,protectedDataUnchanged:true,counter:await db.query('select * from b2b_order_counter')};writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}
