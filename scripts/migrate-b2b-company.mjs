// Applies only 0016, in one transaction, without touching order/cashback rows.
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
    new URL("../drizzle/0016_b2b_company.sql", import.meta.url),
    "utf8",
  ).replace(/^\uFEFF/, "");
const [previous] = await db.query(
  "select hash,created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
);
const hash = createHash("sha256").update(content).digest("hex");
if (Number(previous?.created_at) === 1792340000000 && previous.hash === hash) {
  console.log("Company fields migration already applied.");
  process.exit(0);
}
if (Number(previous?.created_at) !== 1792330000000)
  throw Error("Unexpected migration state");
await db.transaction([
  db.query(content),
  db.query(
    "insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)",
    [hash, 1792340000000],
  ),
]);
console.log(
  "Company fields migration applied; existing orders and cashback unchanged.",
);
