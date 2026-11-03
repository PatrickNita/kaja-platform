// The real import function runs against disposable tables, never public orders.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { prepareImport, applyImport } from './efactura-import-lib.mjs';
import { contactKey, phoneHref } from '../src/lib/b2b/contact.ts';

const db=neon(process.env.DATABASE_URL),schema='kaja_efactura_test_'+randomBytes(6).toString('hex');
process.env.B2B_LINK_ENCRYPTION_KEY=randomBytes(32).toString('hex');
const source=JSON.parse(execFileSync(process.env.PYTHON_EXECUTABLE||'python',[fileURLToPath(new URL('./parse-efactura.py',import.meta.url)),process.argv[2]],{encoding:'utf8'}));
const livePlan=await prepareImport(db,source);
const q=async(text,params=[]) => (await db.transaction([db.query(`set local search_path to ${schema}, public`),db.query(text,params)]))[1];
const isolated={query:q};
try {
 await db.query(`create schema ${schema}`);
 await q('create table members(id integer primary key,name text,slug text)');
 await q('insert into members values($1,$2,$3)',[livePlan.member.id,livePlan.member.name,'patrick']);
 for(const statement of readFileSync(new URL('../drizzle/0014_b2b.sql',import.meta.url),'utf8').split('--> statement-breakpoint')) await q(statement);
 for(const file of ['0015_b2b_access_groups.sql','0016_b2b_company.sql','0017_b2b_notifications.sql','0022_b2b_stock.sql'])
  for(const statement of readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').split('--> statement-breakpoint')) await q(statement);
 for(const product of livePlan.products) await q('update b2b_products set name=$2,flavor=$3,grams=$4,price=$5 where id=$1',[product.id,product.name,product.flavor,product.grams,product.price]);
 for(const loc of livePlan.locations.filter(l=>l.id)) {
  const x=loc.expected,hash=randomBytes(32).toString('hex');
  await q('insert into b2b_access_groups(id,contact_key,token_hash,token_cipher) values($1,$2,$3,$4) on conflict(id) do nothing',[x.access_group_id,contactKey(x.contact,x.phone),hash,'test-cipher']);
  await q('insert into b2b_locations(id,name,address,contact,phone,company_name,idno,access_group_id,details_version,token_hash,token_cipher,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)',[loc.id,x.name,x.address,x.contact,x.phone,x.company_name,x.idno,x.access_group_id,x.details_version,hash,'test-cipher',livePlan.member.id]);
 }
 await q("select setval(pg_get_serial_sequence('b2b_locations','id'),(select max(id) from b2b_locations))");
 await q("select setval(pg_get_serial_sequence('b2b_access_groups','id'),(select max(id) from b2b_access_groups))");
 const existingLocation=livePlan.locations.find(l=>l.id).id;
 const [old]=await q("insert into b2b_orders(location_id,location_snapshot,author,request_key,total) values($1,'{}','Existing',gen_random_uuid(),40000) returning id",[existingLocation]);
 await q("insert into b2b_order_items values($1,1,'BRAIN FREEZE','Gheață',200,40000,1)",[old.id]);
 await q('update b2b_products set stock=case when id%2=0 then 0 else 7 end,stock_version=5');
 const stock=await q('select id,stock,stock_version from b2b_products order by id');
 const oldOrders=await q('select * from b2b_orders order by id');
 const plan=await prepareImport(isolated,source);
 const imported=await applyImport(db,plan,schema);
 assert.equal(imported.createdLocations,2);assert.equal(imported.createdOrders,10);
 assert.deepEqual(await q('select id,stock,stock_version from b2b_products order by id'),stock);
 assert.deepEqual(await q('select * from b2b_orders where id=$1',[old.id]),oldOrders);
 const [stats]=await q("select count(*)::int as orders,sum(total)::int as total,(select sum(quantity)::int from b2b_order_items where order_id<>$1) as units from b2b_orders where id<>$1",[old.id]);
 assert.deepEqual(stats,{orders:10,total:5840000,units:146});
 assert.equal((await q("select count(*)::int as n from b2b_orders where id<>$1 and (status<>'confirmed' or confirmed_at is null)",[old.id]))[0].n,0);
 const newcomers=await q("select name,contact,phone,access_group_id from b2b_locations where name in ('Pushkin 52','Bosco') order by name");
 assert.equal(newcomers[0].phone,'');assert.equal(newcomers[1].phone,'@drussik');
 assert.notEqual(newcomers[0].access_group_id,newcomers[1].access_group_id);
 assert(!livePlan.locations.filter(l=>l.id).some(l=>newcomers.some(n=>n.access_group_id===l.expected.access_group_id)));
 const repeated=await applyImport(db,await prepareImport(isolated,source),schema);
 assert.equal(repeated.createdOrders,0);assert.equal(repeated.createdLocations,0);assert.equal(repeated.skippedOrders,10);
 assert.equal((await q('select count(*)::int as n from b2b_notifications'))[0].n,0);
 assert.equal((await q('select count(*)::int as n from b2b_cashback'))[0].n,0);
 // Failure in the final invoice must roll back even a preceding new order.
 const invalid=await prepareImport(isolated,source);
 invalid.orders[0].requestKey='12345678-1234-4234-8234-123456789abc';
 invalid.orders[invalid.orders.length-1].total++;
 await assert.rejects(applyImport(db,invalid,schema));
 assert.equal((await q('select count(*)::int as n from b2b_orders'))[0].n,11);
 assert.deepEqual(await q('select id,stock,stock_version from b2b_products order by id'),stock);
 assert.equal(phoneHref('@drussik'),null);assert.equal(phoneHref(''),null);assert.equal(phoneHref('079 445 065'),'tel:079445065');
 assert.notEqual(contactKey('Andrei','@drussik'),contactKey('Andrei','068694838'));
 assert.equal(contactKey('Aurel','+37379445065'),contactKey('Aurel','079445065'));
 console.log('PASS: real XML, 10 invoices/58400 MDL/146 units, confirmed dates, dedicated contacts, zero-stock import, retry without duplicates, rollback, no cashback/notifications, unchanged stock/versions/existing order.');
} finally {
 assert(/^kaja_efactura_test_[a-f0-9]{12}$/.test(schema));
 await db.query(`drop schema if exists ${schema} cascade`);
}
