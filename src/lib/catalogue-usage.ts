import { sql } from "drizzle-orm";

export const catalogueUsageQuery = sql`
  select p.id, p.name, count(distinct o.location_id)::integer as locations
  from b2b_products p
  left join b2b_order_items i on i.product_id=p.id and i.quantity>0
  left join b2b_orders o on o.id=i.order_id
  group by p.id,p.name
`;
export type ProductUsage = { id: number; name: string; locations: number };
export const productNameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
export function productLocationCount(name: string, usage: ProductUsage[]) {
  return usage.find((row) => productNameKey(row.name) === productNameKey(name))?.locations ?? 0;
}
export const catalogueLocationTotalQuery = sql`select count(*)::integer as total from b2b_locations`;
export const productUsageLabel = (count: number, total: number) => `Folosit în ${count} ${count === 1 ? "local" : "localuri"} din ${total}`;

export type MissingLocation = { id: number; name: string; address: string };
export const missingLocationsQuery = (productId: number, ordered = false) => sql`
  select l.id,l.name,l.address from b2b_locations l
  where ${ordered ? sql`exists` : sql`not exists`} (
    select 1 from b2b_orders o join b2b_order_items i on i.order_id=o.id
    where o.location_id=l.id and i.product_id=${productId} and i.quantity>0
  )
  order by lower(l.name),l.id
`;
