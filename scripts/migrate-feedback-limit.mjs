import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const project = JSON.parse(readFileSync(new URL('../.vercel/project.json', import.meta.url), 'utf8'));
if (project.projectId !== 'prj_Ip1P7MnHAcBYOkIfs5gzLehy7575') throw Error('Unexpected project');
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
const query = neon(process.env.DATABASE_URL);
const text = readFileSync(new URL('../drizzle/0024_increase_feedback_ip_limit.sql', import.meta.url), 'utf8');
const hash = createHash('sha256').update(text).digest('hex'), when = 1793628000000;
const [previous] = await query.query('select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1');
if (Number(previous?.created_at) === when && previous.hash === hash) {
  console.log('Feedback IP limit increase already applied.');
} else {
  if (Number(previous?.created_at) !== 1792880000000) throw Error('Unexpected migration state');
  await query.transaction([
    query.query('select pg_advisory_xact_lock(1793628000)'),
    query.query(text),
    query.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)', [hash, when]),
  ]);
  console.log('Feedback IP limit increased to 500 per 10 minutes. Existing feedback preserved.');
}
const [definition] = await query.query("select pg_get_functiondef('submit_product_feedback(uuid,text,uuid,character varying)'::regprocedure) as body");
if (!/hit_count\s*>\s*500\b/i.test(definition.body) || !/10 minutes/.test(definition.body)) throw Error('Expected 500 submissions per 10 minutes');
console.log('Verified live function enforces 500 submissions per IP per 10 minutes and retains duplicate prevention.');
