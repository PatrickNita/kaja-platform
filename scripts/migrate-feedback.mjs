import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";
import ts from "typescript";

const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575") throw Error("Unexpected project");
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const q = neon(process.env.DATABASE_URL);
const file = readFileSync(new URL("../drizzle/0018_product_feedback.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(file).digest("hex"), when = 1792490000000;
const [previous] = await q.query("select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
if (Number(previous?.created_at) !== 1792405000000 && !(Number(previous?.created_at) === when && previous.hash === hash)) throw Error("Unexpected migration state");
const output = ts.transpileModule(readFileSync(new URL("../src/lib/b2b/model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {}; new Function("exports", "require", output)(exports, createRequire(import.meta.url));
const products = exports.products;
const normalize = (name) => name.toLowerCase().replace(/^kaja\s*/, "").replace(/[^a-z0-9]/g, "");
const existing = await q.query("select id,title from workspace_items where brand='kaja' and section='catalogue' and catalogue_group='live' and deleted_at is null");
const [patrick] = await q.query("select id from members where slug='patrick'");
if (!patrick) throw Error("Patrick member missing");
const seed = [];
for (const [name, flavor] of products) {
  const matches = existing.filter((r) => normalize(r.title) === normalize(name));
  if (matches.length > 1) throw Error(`Duplicate active product: ${name}`);
  seed.push(matches.length
    ? q.query("update workspace_items set product_name=$1,flavor=$2 where id=$3 and (product_name is distinct from $1 or flavor is distinct from $2)", [name, flavor, matches[0].id])
    : q.query("insert into workspace_items(brand,section,catalogue_group,title,body,product_name,flavor,created_by,updated_by) values('kaja','catalogue','live',$1::varchar,$2::varchar,$1::varchar,$2::varchar,$3,$3)", [name, flavor, patrick.id]));
}
await q.transaction([
  q.query("select pg_advisory_xact_lock(1792490000)"),
  ...(Number(previous?.created_at) === when ? [] : file.split("--> statement-breakpoint").map((s) => q.query(s))),
  ...seed,
  ...(Number(previous?.created_at) === when ? [] : [q.query("insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)", [hash, when])]),
]);
const [result] = await q.query("select count(*)::int as count,count(distinct feedback_id)::int as links from workspace_items where brand='kaja' and section='catalogue' and catalogue_group='live' and deleted_at is null and product_name is not null and flavor is not null");
if (result.count < 25 || result.count !== result.links) throw Error("Feedback seed validation failed");
console.log(`Feedback migration complete: ${result.count} KAJA products with unique stable links. B2B unchanged.`);
