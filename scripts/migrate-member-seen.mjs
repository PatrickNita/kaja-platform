import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575") throw Error("Unexpected project");
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const query = neon(process.env.DATABASE_URL);
const text = readFileSync(new URL("../drizzle/0021_member_seen.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(text).digest("hex"), when = 1792585000000;
const [previous] = await query.query("select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
if (Number(previous?.created_at) !== 1792533000000 && !(Number(previous?.created_at) === when && previous.hash === hash)) throw Error("Unexpected migration state");
await query.transaction([
  query.query("select pg_advisory_xact_lock(1792585000)"),
  ...text.split("--> statement-breakpoint").map(s => query.query(s)),
  query.query("insert into drizzle.__drizzle_migrations(hash,created_at) select $1,$2 where not exists(select 1 from drizzle.__drizzle_migrations where created_at=$2)", [hash, when]),
]);
console.log("Member read-state migration applied. Existing orders and feedback remain unread; business data unchanged.");
