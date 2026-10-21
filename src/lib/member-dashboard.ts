import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";

export type DashboardBrand = "all" | "kaja" | "hexenwerk" | "virginia";
export type DashboardEntry = { key: string; kind: "order" | "feedback" | "activity"; title: string; context: string; excerpt?: string; date: string; href: string; unread?: boolean };
async function query<T>(q: SQL) { if (!db) throw Error("Database unavailable"); return (await db.execute(q)).rows as T[]; }
export async function dashboardCounts(slug: string, brand: DashboardBrand) {
  const rows = await query<{ orders: number; feedback: number }>(sql`select
      (select count(*)::integer from b2b_orders o left join member_order_seen s on s.order_id=o.id and s.member_id=m.id where coalesce(s.seen_version,0)<o.version and ${brand === "all" || brand === "kaja"}) as orders,
      (select count(*)::integer from product_feedback f join workspace_items w on w.id=f.item_id left join member_feedback_seen s on s.feedback_id=f.id and s.member_id=m.id where s.feedback_id is null and w.section='catalogue' and w.brand in ('kaja','hexenwerk','virginia') ${brand !== "all" ? sql`and w.brand=${brand}` : sql``}) as feedback
      from members m where m.slug=${slug}`);
  return rows[0] ?? { orders: 0, feedback: 0 };
}
export async function dashboardData(slug: string, brand: DashboardBrand, full: boolean) {
  const [counts, orders, feedback, tasks] = await Promise.all([
    dashboardCounts(slug, brand),
    brand === "all" || brand === "kaja" ? query<{ id: number; name: string; date: string; unread: boolean }>(sql`select o.id,o.location_snapshot->>'name' as name,o.updated_at as date,coalesce(s.seen_version,0)<o.version as unread from b2b_orders o left join member_order_seen s on s.order_id=o.id and s.member_id=(select id from members where slug=${slug}) order by o.updated_at desc,o.id desc ${full ? sql`` : sql`limit 6`}`) : [],
    query<{ id: number; brand: string; name: string; body: string; date: string; unread: boolean }>(sql`select f.id,w.brand,coalesce(w.product_name,w.title) as name,f.body,f.created_at as date,s.feedback_id is null as unread from product_feedback f join workspace_items w on w.id=f.item_id left join member_feedback_seen s on s.feedback_id=f.id and s.member_id=(select id from members where slug=${slug}) where w.section='catalogue' and w.brand in ('kaja','hexenwerk','virginia') ${brand !== "all" ? sql`and w.brand=${brand}` : sql``} order by f.created_at desc,f.id desc ${full ? sql`` : sql`limit 6`}`),
    query<{ id: number; title: string; brand: string; date: string }>(sql`select t.id,t.title,t.brand,t.updated_at as date from tasks t join task_assignees a on a.task_id=t.id join members m on m.id=a.member_id where m.slug=${slug} and not a.completed and t.deleted_at is null ${brand !== "all" ? sql`and t.brand=${brand}` : sql``} order by t.updated_at desc,t.id desc limit 5`),
  ]);
  const entries: DashboardEntry[] = [
    ...orders.map(o => ({ key: `order-${o.id}`, kind: "order" as const, title: `Comanda #${o.id}`, context: o.name, date: o.date, unread: o.unread, href: `/b2b?tab=history&order=${o.id}` })),
    ...feedback.map(f => ({ key: `feedback-${f.id}`, kind: "feedback" as const, title: `Feedback pentru ${f.name}`, context: f.brand === "virginia" ? "LUMEN" : f.brand.toUpperCase(), excerpt: f.body, date: f.date, unread: f.unread, href: `/feedback?tab=history&brand=${f.brand}&comment=${f.id}` })),
  ];
  return { counts, entries, tasks };
}
