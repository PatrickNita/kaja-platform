import { sql } from "drizzle-orm";
import type { FeedbackBrand } from "./feedback-model";
export type FeedbackHistoryBrand = FeedbackBrand | "all";
export type FeedbackHistoryRow = { id: number; brand: string; product: string; flavor: string | null; body: string; createdAt: string; unread?: boolean };
export type FeedbackHistoryCursor = { date: string; id: number };
export const historyBrand = (value?: string): FeedbackHistoryBrand => ["kaja", "hexenwerk", "virginia"].includes(value ?? "") ? value as FeedbackBrand : "all";
export function encodeHistoryCursor(row: FeedbackHistoryRow) {
  return Buffer.from(JSON.stringify({ date: row.createdAt, id: row.id })).toString("base64url");
}
export function decodeHistoryCursor(value: string): FeedbackHistoryCursor | null {
  try {
    if (value.length > 250 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const row = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Number.isInteger(row.id) || row.id < 1 || row.id > 2147483647 || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(row.date)) return null;
    const date = new Date(row.date);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,19) === row.date.slice(0,19) ? row : null;
  } catch { return null; }
}
export const feedbackHistoryQuery = (brand: FeedbackHistoryBrand, before: FeedbackHistoryCursor | null, slug: string | null = null, unread = false, commentId?: number) => sql`
  select f.id,w.brand,coalesce(nullif(btrim(w.product_name),''),w.title) as product,nullif(btrim(w.flavor),'') as flavor,f.body,s.feedback_id is null as unread,
    to_char(f.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt"
  from product_feedback f join workspace_items w on w.id=f.item_id
  left join member_feedback_seen s on s.feedback_id=f.id and s.member_id=(select id from members where slug=${slug})
  where w.section='catalogue' and w.brand in ('kaja','hexenwerk','virginia')
    ${brand !== "all" ? sql`and w.brand=${brand}` : sql``}
    ${before ? sql`and (f.created_at,f.id)<(${before.date}::timestamptz,${before.id})` : sql``}
    ${unread ? sql`and s.feedback_id is null` : sql``}
    ${commentId ? sql`and f.id=${commentId}` : sql``}
  order by f.created_at desc,f.id desc limit 51
`;
