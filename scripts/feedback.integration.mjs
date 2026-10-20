// Isolated disposable schema only. No test rows are written to public tables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
const require = createRequire(import.meta.url), root = neon(process.env.DATABASE_URL);
const schema = "kaja_feedback_test_" + randomBytes(6).toString("hex");
const q = async (text, params = []) => (await root.transaction([root.query(`set local search_path to ${schema}, public`), root.query(text, params)]))[1];
const dialect = new PgDialect();
let member = null;
const cache = new Map();
function load(path) {
  path = resolve(path); if (cache.has(path)) return cache.get(path);
  const exports = {}; cache.set(path, exports);
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", code)(exports, (name) => {
    if (name === "server-only") return {};
    if (name.endsWith("/auth")) return { currentMember: async () => member };
    if (name.endsWith("/db")) return { db: { execute: async (sql) => { const stmt = dialect.sqlToQuery(sql); return { rows: await q(stmt.sql, stmt.params) }; } } };
    if (name.startsWith(".")) return load(resolve(dirname(path), name) + ".ts");
    return require(name);
  });
  return exports;
}
try {
  await root.query(`create schema ${schema}`);
  await q("create table workspace_items(id serial primary key, brand text,section text,catalogue_group text,title text,body text,deleted_at timestamptz)");
  for (const sql of readFileSync(new URL("../drizzle/0018_product_feedback.sql", import.meta.url), "utf8").split("--> statement-breakpoint")) await q(sql);
  const [item] = await q("insert into workspace_items(brand,section,catalogue_group,title,body,product_name,flavor) values('kaja','catalogue','live','TEST','PRIVATE DESCRIPTION','TEST','Gust test') returning id,feedback_id");
  const source = randomBytes(32).toString("hex");
  const send = async (requestId = randomUUID(), product = item.feedback_id, body = "Test anonim", key = source) => (await q("select submit_product_feedback($1,$2,$3,$4) as result", [product, body, requestId, key]))[0].result;
  const first = randomUUID(); assert.equal(await send(first), "ok"); assert.equal(await send(first), "ok");
  const parallel = await Promise.all(Array.from({ length: 8 }, () => send()));
  assert.equal(parallel.filter((v) => v === "ok").length, 4); assert.equal(parallel.filter((v) => v === "limited").length, 4);
  assert.equal((await q("select count(*)::int as n from product_feedback"))[0].n, 5);
  assert.equal(await send(randomUUID(), randomUUID()), "unavailable");
  assert.equal(await send(randomUUID(), item.feedback_id, " "), "invalid");
  assert.equal(await send(randomUUID(), item.feedback_id, "x".repeat(2001)), "invalid");
  await q("update feedback_rate_limits set expires_at=now()-interval '1 second'"); assert.equal(await send(), "ok");
  await q("update workspace_items set product_name='RENAMED',flavor='NEW' where id=$1", [item.id]);
  assert.equal((await q("select feedback_id from workspace_items where id=$1", [item.id]))[0].feedback_id, item.feedback_id);
  const server = load("src/lib/feedback-server.ts");
  const publicProduct = await server.publicFeedbackProduct(item.feedback_id);
  assert.deepEqual(Object.keys(publicProduct).sort(), ["brand", "flavor", "id", "name"]);
  await assert.rejects(server.memberProductComments(item.feedback_id));
  await assert.rejects(server.memberFeedbackProducts("kaja"));
  for (const slug of ["patrick", "ionut", "igor", "andrei"]) { member = { slug }; assert.equal((await server.memberProductComments(item.feedback_id)).length, 6); assert.equal((await server.memberFeedbackProducts("kaja")).length, 1); }
  assert.equal((await server.memberFeedbackProducts("hexenwerk")).length, 0);
  for (const brand of ["hexenwerk", "virginia"]) {
    await q("insert into workspace_items(brand,section,catalogue_group,title,body,product_name,flavor) values($1,'catalogue','live','TEST','PRIVATE','TEST BRAND','Gust')", [brand]);
    const rows = await server.memberFeedbackProducts(brand);
    assert.equal(rows.length, 1); assert.equal(rows[0].brand, brand);
  }
  await q("update workspace_items set deleted_at=now() where id=$1", [item.id]);
  assert.equal(await send(), "unavailable"); assert.equal(await server.publicFeedbackProduct(item.feedback_id), null);
  assert.equal((await server.memberProductComments(item.feedback_id)).length, 6);
  await q("update workspace_items set deleted_at=null,catalogue_group='upcoming' where id=$1", [item.id]); assert.equal(await send(), "unavailable");
  await q("insert into product_feedback(item_id,body,request_id) select $1,'Test pagina',gen_random_uuid() from generate_series(1,60)", [item.id]);
  const firstPage = await server.memberProductComments(item.feedback_id);
  assert.equal(firstPage.length, 51);
  const secondPage = await server.memberProductComments(item.feedback_id, firstPage[49].id);
  assert.equal(secondPage.length, 16);
  assert(!secondPage.some((c) => firstPage.slice(0, 50).some((p) => p.id === c.id)));
  console.log("Feedback integration passed: concurrent limits, retries, expiry, validation, stable links, private projection, all roles, brand filter and withdrawn products.");
} finally {
  if (!/^kaja_feedback_test_[a-f0-9]{12}$/.test(schema)) throw Error("Unsafe cleanup target");
  await root.query(`drop schema if exists ${schema} cascade`);
}
