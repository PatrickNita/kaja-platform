// All test data stays in a disposable schema; public feedback is never modified.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
const root = neon(process.env.DATABASE_URL);
const schema = 'kaja_feedback_test_' + randomBytes(6).toString('hex');
const q = async (text, params = []) => (await root.transaction([
  root.query(`set local search_path to ${schema}, public`), root.query(text, params),
]))[1];
try {
  await root.query(`create schema ${schema}`);
  await q('create table workspace_items(id serial primary key,brand text,section text,catalogue_group text,title text,body text,deleted_at timestamptz)');
  for (const statement of readFileSync(new URL('../drizzle/0018_product_feedback.sql', import.meta.url), 'utf8').split('--> statement-breakpoint')) await q(statement);
  await q(readFileSync(new URL('../drizzle/0024_increase_feedback_ip_limit.sql', import.meta.url), 'utf8'));
  const items = await q("insert into workspace_items(brand,section,catalogue_group,title,product_name,flavor) values('kaja','catalogue','live','TEST ONE','TEST ONE','Gust'),('kaja','catalogue','live','TEST TWO','TEST TWO','Gust') returning id,feedback_id");
  const source = 'same-shared-wifi';
  const send = async (request = randomUUID(), product = items[0].feedback_id, body = 'Feedback de test', key = source) => (await q('select submit_product_feedback($1,$2,$3,$4) as result', [product, body, request, key]))[0].result;
  const results = await q("select submit_product_feedback(case when i%2=0 then $1::uuid else $2::uuid end,'Test shared Wi-Fi',gen_random_uuid(),$3::varchar) as result from generate_series(1,500) i", [items[0].feedback_id, items[1].feedback_id, source]);
  assert.equal(results.length, 500);
  assert(results.every(row => row.result === 'ok'));
  assert.equal((await q('select count(*)::int as n from product_feedback'))[0].n, 500);
  const [first] = await q('select request_id,item_id from product_feedback order by id limit 1');
  const retryProduct = items.find(item => item.id === first.item_id).feedback_id;
  assert((await Promise.all(Array.from({ length: 10 }, () => send(first.request_id, retryProduct)))).every(result => result === 'ok'));
  assert.equal((await q('select hits from feedback_rate_limits where source_hash=$1', [source]))[0].hits, 500);
  assert.equal(await send(), 'limited');
  assert.equal((await q('select count(*)::int as n from product_feedback'))[0].n, 500);
  assert.equal(await send(randomUUID(), items[0].feedback_id, 'Other Wi-Fi', 'other-source'), 'ok');
  await q("update feedback_rate_limits set expires_at=now()-interval '1 second' where source_hash=$1", [source]);
  assert.equal(await send(), 'ok');
  assert.equal((await q('select hits from feedback_rate_limits where source_hash=$1', [source]))[0].hits, 1);
  await q('update feedback_rate_limits set hits=499 where source_hash=$1', [source]);
  const parallel = await Promise.all(Array.from({ length: 8 }, () => send()));
  assert.equal(parallel.filter(result => result === 'ok').length, 1);
  assert.equal(parallel.filter(result => result === 'limited').length, 7);
  for (const body of [' ', 'x'.repeat(2001)]) assert.equal(await send(randomUUID(), items[0].feedback_id, body), 'invalid');
  assert.equal(await send(randomUUID(), randomUUID()), 'unavailable');
  await q('update workspace_items set deleted_at=now() where id=$1', [items[0].id]);
  assert.equal(await send(), 'unavailable');
  console.log('PASS: first 500 accepted across products, 501st blocked, independent IPs, expiry, duplicate retries, concurrent boundary, validation and withdrawn products.');
} finally {
  if (!/^kaja_feedback_test_[a-f0-9]{12}$/.test(schema)) throw Error('Unsafe cleanup target');
  await root.query(`drop schema if exists ${schema} cascade`);
}
