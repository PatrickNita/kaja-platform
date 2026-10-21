import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';
import { PgDialect } from 'drizzle-orm/pg-core';
const require=createRequire(import.meta.url), exports={};
new Function('exports','require',ts.transpileModule(readFileSync(new URL('../src/lib/catalogue-usage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require);
const {catalogueUsageQuery,productLocationCount,productUsageLabel,missingLocationsQuery,catalogueLocationTotalQuery}=exports;
assert.equal(productLocationCount('  brain   FREEZE ',[{id:1,name:'BRAIN FREEZE',locations:3}]),3);
assert.equal(productLocationCount('Gheata',[{id:1,name:'Gheață',locations:1}]),1);
assert.equal(productLocationCount('Unknown',[]),0);
for(const count of [0,1,3]) assert.equal(productUsageLabel(count,25),`Folosit în ${count} ${count===1?'local':'localuri'} din 25`);
assert.equal(productUsageLabel(0,0),'Folosit în 0 localuri din 0');
if(process.env.DATABASE_URL){
 const db=neon(process.env.DATABASE_URL), query=new PgDialect().sqlToQuery(catalogueUsageQuery);
 const totalQuery = new PgDialect().sqlToQuery(catalogueLocationTotalQuery);
 const totals = await db.transaction([
 db.query('create temporary table b2b_locations(id integer,name text,contact text) on commit drop'),
 db.query(totalQuery.sql,totalQuery.params),
 db.query("insert into pg_temp.b2b_locations values (1,'KAMORA 1','Andrei'),(2,'KAMORA 2','Andrei'),(3,'IMPERATOR','Andrei')"),
 db.query(totalQuery.sql,totalQuery.params),
 db.query("insert into pg_temp.b2b_locations values (4,'Local fără comenzi','Other')"),
 db.query(totalQuery.sql,totalQuery.params),
 ]);
 assert.equal(totals[1][0].total,0);assert.equal(totals[3][0].total,3);assert.equal(totals[5][0].total,4);
 console.log('PASS: total counts all venues separately, includes venues without orders, updates after insertion and handles zero venues.');
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
 const missing = new PgDialect().sqlToQuery(missingLocationsQuery(1));
 const missingNilla = new PgDialect().sqlToQuery(missingLocationsQuery(2));
 const ordered = new PgDialect().sqlToQuery(missingLocationsQuery(1,true));
 const orderedNilla = new PgDialect().sqlToQuery(missingLocationsQuery(2,true));
 const orderedChck = new PgDialect().sqlToQuery(missingLocationsQuery(3,true));
 const missingChck = new PgDialect().sqlToQuery(missingLocationsQuery(3));
 const missingResults=await db.transaction([
 db.query('create temporary table b2b_locations(id integer,name text,address text,contact text) on commit drop'),
 db.query('create temporary table b2b_orders(id integer,location_id integer,status text) on commit drop'),
 db.query('create temporary table b2b_order_items(order_id integer,product_id integer,quantity integer) on commit drop'),
 db.query("insert into pg_temp.b2b_locations values (11,'Z LOCAL','Z address','Same contact'),(12,'A LOCAL','A address','Same contact'),(13,'M LOCAL','M address','Same contact'),(14,'B LOCAL','B address','Other contact')"),
 db.query("insert into pg_temp.b2b_orders values (1,11,'placed'),(2,11,'paid'),(3,12,'confirmed'),(4,13,'paid')"),
 db.query('insert into pg_temp.b2b_order_items values (1,1,1),(2,1,2),(3,1,1),(4,1,1),(1,2,1),(2,2,0)'),
 db.query(missing.sql,missing.params),db.query(missingNilla.sql,missingNilla.params),db.query(missingChck.sql,missingChck.params),
 db.query('delete from pg_temp.b2b_order_items where product_id=1 and order_id=3'),db.query(missing.sql,missing.params),
 db.query("insert into pg_temp.b2b_order_items values (5,1,1)"),db.query("insert into pg_temp.b2b_orders values(5,14,'placed')"),db.query("insert into pg_temp.b2b_order_items values(3,1,1)"),db.query(missing.sql,missing.params),
 db.query(ordered.sql,ordered.params),db.query(orderedNilla.sql,orderedNilla.params),db.query(orderedChck.sql,orderedChck.params),
 ]);
 assert.deepEqual(missingResults[6].map(l=>l.id),[14]);
 assert.deepEqual(missingResults[7].map(l=>l.id),[12,14,13]);
 assert.equal(missingResults[8].length,4);
 assert.deepEqual(missingResults[10].map(l=>l.id),[12,14]);
 assert.deepEqual(missingResults[14],[]);
 assert.deepEqual(missingResults[15].map(l=>l.id),[12,14,13,11]);
 assert.deepEqual(missingResults[16].map(l=>l.id),[11]);
 assert.deepEqual(missingResults[17],[]);
 assert.equal(missingResults[15].length+missingResults[14].length,4);
 assert.equal(missingResults[16].length+missingResults[7].length,4);
 assert(!missingResults[16].some(l=>missingResults[7].some(m=>m.id===l.id)));
 for(const rows of [missingResults[6],missingResults[7],missingResults[8]]) for(const row of rows) assert.deepEqual(Object.keys(row).sort(),['address','id','name']);
 console.log('PASS: missing venue SQL, all statuses, same contacts, repeated orders, alphabetical order, removed items, none/all ordered and restricted fields.');
 const first=results[6], after=results[8];assert.equal(productLocationCount('BRAIN FREEZE',first),3);assert.equal(productLocationCount('NILLA',first),1);assert.equal(productLocationCount('CHCK',first),0);assert.equal(productLocationCount('BRAIN FREEZE',after),2);
 console.log('PASS: real SQL, repeated venue orders, 3 distinct venues across all statuses, zero orders, removed/zero-quantity products.');
}
console.log('PASS: normalized commercial names, zero fallback and singular/plural labels.');
