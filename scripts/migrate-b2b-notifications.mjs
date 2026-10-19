import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(
  readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"),
);
if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575")
  throw Error("Unexpected project");
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const db = neon(process.env.DATABASE_URL),
  content = readFileSync(
    new URL("../drizzle/0017_b2b_notifications.sql", import.meta.url),
    "utf8",
  );
const hash = createHash("sha256").update(content).digest("hex"),
  when = 1792405000000;
const [previous] = await db.query(
  "select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
);
if (Number(previous?.created_at) === when && previous.hash === hash) {
  console.log("Notification migration already applied");
  process.exit(0);
}
if (Number(previous?.created_at) !== 1792340000000)
  throw Error("Unexpected migration state");
await db.transaction([
  ...content.split("--> statement-breakpoint").map((q) => db.query(q)),
  db.query(
    "insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)",
    [hash, when],
  ),
]);
console.log("B2B notification migration applied; existing orders unchanged.");
