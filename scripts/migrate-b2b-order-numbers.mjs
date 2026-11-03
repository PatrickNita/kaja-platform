import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
const content=readFileSync(new URL('../drizzle/0025_b2b_order_numbers.sql',import.meta.url),'utf8');
const hash=createHash('sha256').update(content).digest('hex'),when=1793707200000;
export async function migrateOrderNumbers(db,{journal=false}={}) {
  const [state]=await db.query("select exists(select 1 from information_schema.columns where table_schema=current_schema() and table_name='b2b_orders' and column_name='order_number') as applied");
  if(state.applied){
    if(journal){const [entry]=await db.query('select hash from drizzle.__drizzle_migrations where created_at=$1',[when]);assert.equal(entry?.hash,hash,'Migration journal differs');}
    return {alreadyApplied:true};
  }
  if(journal){const [previous]=await db.query('select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1');assert.equal(Number(previous?.created_at),1793628000000,'Unexpected migration state');}
  await db.transaction([
    db.query('select pg_advisory_xact_lock(1793707200)'),
    ...content.split('--> statement-breakpoint').map(text=>db.query(text)),
    ...(journal?[db.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)',[hash,when])]:[]),
  ]);
  return {alreadyApplied:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));
  assert.equal(project.projectId,'prj_Ip1P7MnHAcBYOkIfs5gzLehy7575');
  const db=neon(process.env.DATABASE_URL);
  const before=await db.query('select * from b2b_orders order by id');
  const mapping=await db.query("select id,location_snapshot->>'name' as location,created_at,row_number() over(order by created_at,id)::int as order_number from b2b_orders order by created_at,id");
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',mapping},null,2));
  if(process.argv.includes('--apply')){
    const backup={orders:before};
    for(const table of ['b2b_order_items','b2b_products','b2b_cashback','member_order_seen','b2b_notifications'])backup[table]=await db.query(`select * from ${table} order by 1,2`);
    const reportArg=process.argv.indexOf('--report');const report=reportArg>=0?process.argv[reportArg+1]:null;
    if(report)writeFileSync(report+'.before.json',JSON.stringify(backup,null,2));
    const result=await migrateOrderNumbers(db,{journal:true});
    const after=await db.query('select * from b2b_orders order by id');
    assert.deepEqual(after.map(({order_number,...row})=>row),before.map(({order_number,...row})=>row));
    for(const table of Object.keys(backup).filter(k=>k!=='orders'))assert.deepEqual(await db.query(`select * from ${table} order by 1,2`),backup[table],table+' changed');
    for(const row of after)assert.equal(row.order_number,mapping.find(m=>m.id===row.id).order_number);
    const verified={...result,mapping,existingDataUnchanged:true};
    if(report)writeFileSync(report,JSON.stringify(verified,null,2));
    console.log(JSON.stringify(verified,null,2));
  }
}
