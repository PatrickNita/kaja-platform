import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import type { DashboardBrand } from "./member-dashboard";

export async function markDashboardSeen(slug: string, type: "orders" | "feedback", brand: DashboardBrand) {
  if (!db) throw Error("Database unavailable");
  if (type === "orders") {
    if (brand !== "all" && brand !== "kaja") return;
    await db.execute(sql`insert into member_order_seen(member_id,order_id,seen_version)
      select m.id,o.id,o.version from members m cross join b2b_orders o
      where m.slug=${slug}
      on conflict(member_id,order_id) do update set
        seen_version=greatest(member_order_seen.seen_version,excluded.seen_version),seen_at=now()`);
  } else {
    await db.execute(sql`insert into member_feedback_seen(member_id,feedback_id)
      select m.id,f.id from members m cross join product_feedback f
      join workspace_items w on w.id=f.item_id
      where m.slug=${slug} and w.section='catalogue' and w.brand in ('kaja','hexenwerk','virginia')
        ${brand !== "all" ? sql`and w.brand=${brand}` : sql``}
      on conflict(member_id,feedback_id) do nothing`);
  }
}

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
