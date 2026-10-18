// Invoked only by the explicitly staged production migration deployment.
import { neon } from "@neondatabase/serverless";
import { migrateAccessGroups } from "./migrate-b2b-access.mjs";
if (
  process.env.VERCEL_ENV !== "production" ||
  process.env.B2B_APPLY_ACCESS_GROUPS !== "1"
)
  throw Error("Explicit production migration deployment required");
if (
  !process.env.DATABASE_URL ||
  !/^[a-f0-9]{64}$/i.test(process.env.B2B_LINK_ENCRYPTION_KEY ?? "")
)
  throw Error("Production database and encryption configuration required");
console.log(
  "B2B access migration:",
  await migrateAccessGroups(neon(process.env.DATABASE_URL), { journal: true }),
);
