import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';
import { PgDialect } from 'drizzle-orm/pg-core';
const require=createRequire(import.meta.url), exports={};
new Function('exports','require',ts.transpileModule(readFileSync(new URL('../src/lib/catalogue-usage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require);
const {catalogueUsageQuery,productLocationCount,productUsageLabel}=exports;
assert.equal(productLocationCount('  brain   FREEZE ',[{id:1,name:'BRAIN FREEZE',locations:3}]),3);
assert.equal(productLocationCount('Gheata',[{id:1,name:'Gheață',locations:1}]),1);
assert.equal(productLocationCount('Unknown',[]),0);
for(const count of [0,1,3]) assert.equal(productUsageLabel(count),`Folosit în ${count} ${count===1?'local':'localuri'}`);
if(process.env.DATABASE_URL){
 const db=neon(process.env.DATABASE_URL), query=new PgDialect().sqlToQuery(catalogueUsageQuery);
 // Transaction-local temporary tables shadow public tables; no real catalogue or order data changes.
 const results=await db.transaction([
 db.query('create temporary table b2b_products(id integer primary key,name text) on commit drop'),
 db.query('create temporary table b2b_orders(id integer primary key,location_id integer,status text) on commit drop'),
 db.query('create temporary table b2b_order_items(order_id integer,product_id integer,quantity integer) on commit drop'),
 db.query("insert into pg_temp.b2b_products values(1,'BRAIN FREEZE'),(2,'NILLA'),(3,'CHCK')"),
 db.query("insert into pg_temp.b2b_orders values(1,11,'placed'),(2,11,'paid'),(3,12,'confirmed'),(4,13,'paid')"),
 db.query('insert into pg_temp.b2b_order_items values(1,1,2),(2,1,1),(3,1,1),(4,1,1),(1,2,1),(2,3,0)'),
 db.query(query.sql,query.params),
 db.query('delete from pg_temp.b2b_order_items where product_id=1 and order_id=3'),
 db.query(query.sql,query.params),
 ]);
 const first=results[6], after=results[8];assert.equal(productLocationCount('BRAIN FREEZE',first),3);assert.equal(productLocationCount('NILLA',first),1);assert.equal(productLocationCount('CHCK',first),0);assert.equal(productLocationCount('BRAIN FREEZE',after),2);
 console.log('PASS: real SQL, repeated venue orders, 3 distinct venues across all statuses, zero orders, removed/zero-quantity products.');
}
console.log('PASS: normalized commercial names, zero fallback and singular/plural labels.');
