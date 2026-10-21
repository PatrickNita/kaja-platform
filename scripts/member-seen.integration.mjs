// Real SQL in a disposable schema; no production records are created or marked read.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import ts from "typescript";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
assert(process.env.DATABASE_URL, "DATABASE_URL required");
const root = neon(process.env.DATABASE_URL), dialect = new PgDialect();
const schema = "kaja_seen_test_" + randomBytes(6).toString("hex");
const q = (text, values = []) => root.transaction([root.query(`set local search_path to ${schema}`), root.query(text, values)]).then(r => r[1]);
const execute = async statement => { const s = dialect.sqlToQuery(statement); return { rows: await q(s.sql, s.params) }; };
const require = createRequire(import.meta.url), cache = new Map(); let member = null;
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file);
  const result = {}; cache.set(file, result);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", code)(result, name => {
    if (name === "server-only") return {};
    if (name.endsWith("/db")) return { db: { execute } };
    if (name.endsWith("/auth")) return { currentMember: async () => member };
    if (name === "next/server") return { NextResponse: { json: (data, init) => Response.json(data, init) } };
    if (name.startsWith(".")) return load(resolve(dirname(file), name + ".ts"));
    return require(name);
  }); return result;
}
try {
  await root.query(`create schema ${schema}`);
  for (const text of [
    "create table members(id serial primary key,slug text unique,name text)",
    "create table workspace_items(id serial primary key,brand text,section text,product_name text,title text,flavor text)",
    "create table product_feedback(id serial primary key,item_id integer references workspace_items(id),body text,created_at timestamptz default now())",
    "create table b2b_orders(id serial primary key,version integer default 1,location_snapshot jsonb,created_at timestamptz default now(),updated_at timestamptz default now())",
    "create table tasks(id serial primary key,title text,brand text,updated_at timestamptz default now(),deleted_at timestamptz)",
    "create table task_assignees(task_id integer,member_id integer,completed boolean default false)",
  ]) await q(text);
  for (const text of readFileSync("drizzle/0021_member_seen.sql", "utf8").split("--> statement-breakpoint")) await q(text);
  await q("insert into members(slug,name) values('patrick','Patrick'),('ionut','Ionut'),('andrei','Andrei'),('igor','Igor')");
  await q("insert into workspace_items(brand,section,product_name,title) values('kaja','catalogue','NILLA','NILLA'),('hexenwerk','catalogue','TEST','TEST'),('virginia','catalogue','LUMEN TEST','LUMEN TEST')");
  await q("insert into product_feedback(item_id,body,created_at) select 1,'Feedback fictiv '||i,'2026-10-20T10:00:00Z'::timestamptz+(i%5)*interval '1 microsecond' from generate_series(1,65) i");
  await q("insert into b2b_orders(location_snapshot) select '{\"name\":\"Local fictiv\"}'::jsonb from generate_series(1,3)");
  await q("insert into tasks(title,brand) values('My task','kaja'),('Other task','kaja'),('Completed','kaja')");
  await q("insert into task_assignees values(1,1,false),(2,2,false),(3,1,true)");
  const seen = load("src/lib/member-seen.ts"), dashboard = load("src/lib/member-dashboard.ts"), history = load("src/lib/feedback-history.ts");
  const counts = async (slug = "patrick", brand = "all") => (await dashboard.dashboardData(slug, brand, false)).counts;
  assert.deepEqual(await counts(), { orders: 3, feedback: 65 });
  assert.deepEqual(await counts("patrick", "hexenwerk"), { orders: 0, feedback: 0 });
  for (const [slug, expected] of [["patrick", ["My task"]], ["ionut", ["Other task"]], ["andrei", []], ["igor", []]]) {
    assert.deepEqual((await dashboard.dashboardData(slug, "all", false)).tasks.map(t => t.title), expected);
    assert.deepEqual((await dashboard.dashboardData(slug, "hexenwerk", false)).tasks, []);
  }
  await seen.markOrderSeen("patrick", 1, 1); assert.equal((await counts()).orders, 2);
  assert.equal((await counts("ionut")).orders, 3);
  await q("update b2b_orders set version=2 where id=1");
  await seen.markOrderSeen("patrick", 1, 1); assert.equal((await counts()).orders, 3);
  await seen.markOrderSeen("patrick", 1, 2); await seen.markOrderSeen("patrick", 1, 1);
  assert.equal((await counts()).orders, 2); assert.equal((await q("select seen_version from member_order_seen where member_id=1 and order_id=1"))[0].seen_version, 2);
  await seen.markOrderSeen("patrick", 2, 999); assert.equal((await counts()).orders, 2);
  const first = (await execute(history.feedbackHistoryQuery("all", null, "patrick", true))).rows.slice(0, 50);
  await q("insert into product_feedback(item_id,body) values(1,'Arrived while dialog was open')");
  await seen.markFeedbackSeen("patrick", first.map(f => f.id)); assert.equal((await counts()).feedback, 16);
  assert.equal((await counts("ionut")).feedback, 66);
  const remaining = (await execute(history.feedbackHistoryQuery("all", null, "patrick", true))).rows;
  assert.equal(remaining.length, 16); assert(!remaining.some(r => first.some(f => f.id === r.id)));
  const route = load("src/app/api/member-seen/route.ts");
  const post = (body, origin = "http://localhost") => route.POST(new Request("http://localhost/api/member-seen", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  assert.equal((await post({ type: "order", id: 1, version: 2 })).status, 401);
  for (const slug of ["patrick", "ionut", "andrei", "igor"]) {
    member = { slug };
    assert.equal((await post({ type: "order", id: 1, version: 2 })).status, 200);
    assert.equal((await post({ type: "feedback", ids: [66, 66] })).status, 200);
    assert.equal((await post({ type: "order", id: 1, version: 2 }, "https://other.invalid")).status, 403);
    assert.equal((await post({ type: "order", id: 1, version: 2, memberId: 2 })).status, 400);
    assert.equal((await post({ type: "feedback", ids: Array(51).fill(1) })).status, 400);
  }
  const countsRoute = load("src/app/api/member-dashboard/route.ts");
  member = null;
  assert.equal((await countsRoute.GET(new Request("http://localhost/api/member-dashboard"))).status, 401);
  member = { slug: "patrick" };
  const dashboardResponse = await countsRoute.GET(new Request("http://localhost/api/member-dashboard?brand=kaja"));
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Object.keys(await dashboardResponse.json()).sort(), ["feedback", "orders"]);
  assert.equal((await countsRoute.GET(new Request("http://localhost/api/member-dashboard?brand=unknown"))).status, 400);
  console.log("PASS real SQL: all initially unread, four independent members, brand counts, own tasks, monotonic order versions, races, invalid future versions, loaded feedback only, pagination and member-only same-origin validation.");
} finally { await root.query(`drop schema if exists ${schema} cascade`); }
