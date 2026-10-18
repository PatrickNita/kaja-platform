import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contactKey } from "../src/lib/b2b/contact.ts";
import { encryptToken, newToken, tokenHash } from "../src/lib/b2b/crypto.ts";
export async function migrateAccessGroups(db, { journal = false } = {}) {
  const content = readFileSync(
    new URL("../drizzle/0015_b2b_access_groups.sql", import.meta.url),
    "utf8",
  ).replace(/^\uFEFF/, "");
  const hash = createHash("sha256").update(content).digest("hex");
  const [state] = await db.query(
    "select to_regclass('b2b_access_groups') is not null as applied",
  );
  if (state.applied) {
    const [bad] = await db.query(
      "select count(*)::integer as count from b2b_locations where access_group_id is null",
    );
    if (bad.count) throw Error("Incomplete grouping migration");
    return { alreadyApplied: true };
  }
  if (journal) {
    const [previous] = await db.query(
      "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    );
    if (Number(previous?.created_at) !== 1792240000000)
      throw Error("Unexpected migration journal state");
  }
  const rows = await db.query(
    "select id,contact,phone,version,details_version,token_hash,token_cipher from b2b_locations order by id",
  );
  const groups = new Map();
  for (const l of rows) {
    const key = contactKey(l.contact, l.phone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const statements = [
    db.query("LOCK TABLE b2b_locations IN ACCESS EXCLUSIVE MODE"),
    db.query(
      "select 1 / case when (select coalesce(jsonb_agg(jsonb_build_array(id,contact,phone,version,details_version) order by id),'[]'::jsonb) from b2b_locations) = $1::jsonb then 1 else 0 end as snapshot_unchanged",
      [
        JSON.stringify(
          rows.map((l) => [
            l.id,
            l.contact,
            l.phone,
            l.version,
            l.details_version,
          ]),
        ),
      ],
    ),
    ...content.split("--> statement-breakpoint").map((q) => db.query(q)),
  ];
  for (const [key, list] of groups) {
    const first = list[0],
      shared = list.length > 1,
      token = shared ? newToken() : null;
    statements.push(
      db.query(
        "insert into b2b_access_groups(id,contact_key,token_hash,token_cipher,version) values($1,$2,$3,$4,$5)",
        [
          first.id,
          key,
          shared ? tokenHash(token) : first.token_hash,
          shared ? encryptToken(token) : first.token_cipher,
          shared ? Math.max(...list.map((l) => l.version)) + 1 : first.version,
        ],
      ),
    );
    statements.push(
      db.query(
        "update b2b_locations set access_group_id=$1 where id=any($2::int[])",
        [first.id, list.map((l) => l.id)],
      ),
    );
  }
  statements.push(
    db.query(
      "select setval(pg_get_serial_sequence('b2b_access_groups','id'),greatest(coalesce((select max(id) from b2b_locations),0),1),exists(select 1 from b2b_locations))",
    ),
    db.query(
      "alter table b2b_locations alter column access_group_id set not null",
    ),
  );
  if (journal)
    statements.push(
      db.query(
        "insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)",
        [hash, 1792330000000],
      ),
    );
  await db.transaction(statements);
  return {
    locations: rows.length,
    groups: groups.size,
    sharedGroups: [...groups.values()].filter((x) => x.length > 1).length,
  };
}
if (process.argv[1]?.endsWith("migrate-b2b-access.mjs")) {
  const { neon } = await import("@neondatabase/serverless");
  const connection = process.env.B2B_MIGRATION_DATABASE_URL;
  if (!connection) throw Error("B2B_MIGRATION_DATABASE_URL required");
  const project = JSON.parse(
    readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"),
  );
  if (project.projectId !== "prj_Ip1P7MnHAcBYOkIfs5gzLehy7575")
    throw Error("Unexpected project");
  console.log(await migrateAccessGroups(neon(connection), { journal: true }));
}
