// Applies only the additive 0014 migration; does not rerun historical migrations.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(
  readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"),
);
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575")
  throw new Error("Unexpected Vercel project");
const connection = process.env.B2B_MIGRATION_DATABASE_URL;
if (!connection) throw new Error("B2B_MIGRATION_DATABASE_URL is required");
const query = neon(connection);
const content = readFileSync(
  new URL("../drizzle/0014_b2b.sql", import.meta.url),
  "utf8",
);
const hash = createHash("sha256").update(content).digest("hex");
const journal = JSON.parse(
  readFileSync(
    new URL("../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ),
);
const entry = journal.entries.find((e) => e.tag === "0014_b2b");
const [state] = await query.query(
  "select to_regclass('drizzle.__drizzle_migrations') is not null as journal,to_regclass('public.b2b_locations') is not null as b2b",
);
if (!state.journal) throw new Error("Existing migration journal required");
const previous = await query.query(
  "select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
);
if (previous[0]?.hash === hash && state.b2b) {
  console.log("B2B migration already applied.");
  process.exit(0);
}
if (state.b2b || Number(previous[0]?.created_at) !== 1784908800000)
  throw new Error("Unexpected migration state; inspect before applying");
await query.transaction([
  ...content
    .split("--> statement-breakpoint")
    .map((statement) => query.query(statement)),
  query.query(
    "insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)",
    [hash, entry.when],
  ),
]);
console.log(
  "B2B additive migration applied and recorded. Existing workspace tables were not modified.",
);
