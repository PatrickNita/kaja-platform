// Disposable schema only: verifies chronological numbering without changing IDs.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {migrateOrderNumbers} from './migrate-b2b-order-numbers.mjs';
import {formatOrderNumber} from '../src/lib/b2b/model.ts';
const root=neon(process.env.DATABASE_URL),schema='kaja_numbers_test_'+randomBytes(6).toString('hex');
const db={query(text,params=[]){return {text,params,then(ok,fail){return root.transaction([root.query(`set local search_path to ${schema}`),root.query(text,params)]).then(r=>r[1]).then(ok,fail);}};},transaction(statements){return root.transaction([root.query(`set local search_path to ${schema}`),...statements.map(s=>root.query(s.text,s.params))]).then(r=>r.slice(1));}};
try{
 await root.query(`create schema ${schema}`);
 await db.query('create table b2b_orders(id serial primary key,created_at timestamptz default now(),status text default \'confirmed\',version integer default 1,total integer default 40000)');
 await db.query('create table order_references(order_id integer references b2b_orders(id),kind text)');
 await db.query("insert into b2b_orders(created_at) values ('2026-10-27T12:16Z'),('2026-10-27T15:46Z'),('2026-10-29T19:21Z'),('2026-10-09T10:25Z'),('2026-10-10T13:52Z'),('2026-10-10T13:52:39Z'),('2026-10-10T13:53Z'),('2026-10-10T13:54Z'),('2026-10-10T13:55Z'),('2026-10-10T13:58Z'),('2026-10-10T13:58:29Z'),('2026-10-10T13:59Z'),('2026-10-19T18:28Z')");
 await db.query("insert into order_references values(4,'invoice'),(3,'seen'),(1,'cashback')");
 const before=await db.query('select * from b2b_orders order by id');const refs=await db.query('select * from order_references');
 await migrateOrderNumbers(db);
 const after=await db.query('select * from b2b_orders order by id');assert.deepEqual(after.map(({order_number,...r})=>r),before);assert.deepEqual(await db.query('select * from order_references'),refs);
 assert.equal(after.find(o=>o.id===4).order_number,1);assert.equal(after.find(o=>o.id===3).order_number,13);assert.equal(after.find(o=>o.id===13).order_number,10);
 assert.equal((await migrateOrderNumbers(db)).alreadyApplied,true);assert.deepEqual(await db.query('select * from b2b_orders order by id'),after);
 const next=await Promise.all(Array.from({length:8},()=>db.query('insert into b2b_orders default values returning id,order_number')));const numbers=next.flat().map(r=>r.order_number).sort((a,b)=>a-b);assert.deepEqual(numbers,[14,15,16,17,18,19,20,21]);
 await db.query('update b2b_orders set version=2,status=\'paid\' where id=4');assert.equal((await db.query('select order_number from b2b_orders where id=4'))[0].order_number,1);
 assert.equal(formatOrderNumber(1),'001');assert.equal(formatOrderNumber(13),'013');assert.equal(formatOrderNumber(1000),'1000');
 console.log('PASS chronological backfill, IDs/references/data preserved, migration retry, stable numbers after edits, concurrent future orders #014+, and zero padding.');
}finally{await root.query(`drop schema if exists ${schema} cascade`);}
