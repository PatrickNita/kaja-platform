import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import { taskAssignmentQueries } from "../src/lib/task-assignment-queries.ts";

const db = neon(process.env.DATABASE_URL);
const schema = "kaja_task_assignment_test_" + randomBytes(6).toString("hex");
const dialect = new PgDialect();
const scoped = (text, values = []) => db.transaction([
  db.query(`set local search_path to ${schema}`), db.query(text, values),
]).then(results => results[1]);
async function change(task, member, assigned, brand = "kaja", delay = false) {
  const [lock, mutation] = taskAssignmentQueries(task, brand, member, assigned).map(query => dialect.sqlToQuery(query));
  const result = await db.transaction([
    db.query(`set local search_path to ${schema}`), db.query(lock.sql, lock.params),
    ...(delay ? [db.query("select pg_sleep(0.15)")] : []), db.query(mutation.sql, mutation.params),
  ]);
  return result.at(-1);
}
try {
  await db.query(`create schema ${schema}`);
  await scoped("create table tasks(id integer primary key, brand text, deleted_at timestamptz)");
  await scoped("create table task_assignees(id serial primary key,task_id integer references tasks(id),member_id integer,completed boolean default false,unique(task_id,member_id))");
  await scoped("insert into tasks values(1,'kaja',null),(2,'kaja',null),(3,'kaja',now())");
  await scoped("insert into task_assignees(task_id,member_id) values(1,1),(2,1)");
  assert.equal((await change(1, 1, false)).length, 0);
  assert.equal((await scoped("select * from task_assignees where task_id=1")).length, 1);
  await change(1, 2, true); await change(1, 3, true);
  assert.equal((await change(1, 1, false)).length, 1);
  const race = await Promise.all([change(1, 2, false, "kaja", true), change(1, 3, false, "kaja", true)]);
  assert.equal(race.reduce((count, rows) => count + rows.length, 0), 1);
  const [survivor] = await scoped("select * from task_assignees where task_id=1");
  assert(survivor);
  const retries = await Promise.all(Array.from({ length: 8 }, () => change(1, survivor.member_id, false)));
  assert(retries.every(rows => rows.length === 0));
  assert.equal((await scoped("select * from task_assignees where task_id=1")).length, 1);
  await scoped("update task_assignees set completed=true where task_id=1");
  await change(1, survivor.member_id, true); // Duplicate add preserves completion.
  assert.equal((await scoped("select completed from task_assignees where task_id=1"))[0].completed, true);
  assert.equal((await change(1, 4, true, "hexenwerk")).length, 0);
  assert.equal((await change(3, 1, true)).length, 0);
  assert.equal((await scoped("select * from task_assignees where task_id=2")).length, 1);
  console.log("PASS isolated DB: final assignee protected, simultaneous removals serialized, retries, duplicate adds, completion, brand and deleted-task checks.");
} finally {
  assert.match(schema, /^kaja_task_assignment_test_[a-f0-9]+$/);
  await db.query(`drop schema if exists ${schema} cascade`);
}
