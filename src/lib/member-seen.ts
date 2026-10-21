import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";

export async function markOrderSeen(slug: string, id: number, version: number) {
  if (!db) throw Error("Database unavailable");
  await db.execute(sql`insert into member_order_seen(member_id,order_id,seen_version)
    select m.id,o.id,${version} from members m cross join b2b_orders o
    where m.slug=${slug} and o.id=${id} and o.version>=${version}
    on conflict(member_id,order_id) do update set
      seen_version=greatest(member_order_seen.seen_version,excluded.seen_version),seen_at=now()`);
}

export async function markFeedbackSeen(slug: string, ids: number[]) {
  if (!db) throw Error("Database unavailable");
  if (!ids.length) return;
  await db.execute(sql`insert into member_feedback_seen(member_id,feedback_id)
    select m.id,f.id from members m cross join product_feedback f
    join workspace_items w on w.id=f.item_id
    where m.slug=${slug} and f.id in (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
      and w.section='catalogue' and w.brand in ('kaja','hexenwerk','virginia')
    on conflict(member_id,feedback_id) do nothing`);
}
