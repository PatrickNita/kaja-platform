import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575") throw Error("Unexpected project");
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const q = neon(process.env.DATABASE_URL);
const content = readFileSync(new URL("../drizzle/0019_correct_woodruff_flavor.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(content).digest("hex"), when = 1792532000000;
const [previous] = await q.query("select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
if (Number(previous?.created_at) === when && previous.hash === hash) { console.log("Flavor correction already applied."); process.exit(0); }
if (Number(previous?.created_at) !== 1792490000000) throw Error("Unexpected migration state");
await q.transaction([
  q.query("create temporary table flavor_guard on commit drop as select (select jsonb_agg(to_jsonb(o) order by id) from b2b_orders o) as orders, (select jsonb_agg(to_jsonb(c) order by order_id) from b2b_cashback c) as cashback, (select jsonb_agg(jsonb_build_array(id,feedback_id) order by id) from workspace_items) as links"),
  ...content.split("--> statement-breakpoint").map((s) => q.query(s)),
  q.query("do $$ begin if exists(select 1 from flavor_guard g where g.orders is distinct from (select jsonb_agg(to_jsonb(o) order by id) from b2b_orders o) or g.cashback is distinct from (select jsonb_agg(to_jsonb(c) order by order_id) from b2b_cashback c) or g.links is distinct from (select jsonb_agg(jsonb_build_array(id,feedback_id) order by id) from workspace_items)) then raise exception 'Protected data changed'; end if; end $$"),
  q.query("insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)", [hash, when]),
]);
console.log("Corrected Vinariță in catalogue, B2B products and order item descriptions. Order data, cashback and QR links unchanged.");
