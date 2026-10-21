import "server-only";
import { cookies } from "next/headers";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { currentMember } from "../auth";
import { members } from "../schema";
import { decryptToken, parseSession } from "./crypto";
import { canManageOrders } from "./model";
import type { B2BData, Location, Order, Product } from "./model";
export const SUPPORT =
  "Contactează-ne la 076922600 pe Telegram pentru suport tehnic.";
export const B2B_COOKIE = "kaja_b2b";
export async function query<T>(statement: SQL): Promise<T[]> {
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  return (await db.execute(statement)).rows as T[];
}
export async function internalMember() {
  const session = await currentMember();
  if (!session) throw new Error("Acces neautorizat.");
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  const [member] = await db
    .insert(members)
    .values(session)
    .onConflictDoUpdate({ target: members.slug, set: { name: session.name } })
    .returning();
  return member;
}
export async function currentAccess() {
  const raw = (await cookies()).get(B2B_COOKIE)?.value;
  if (!raw) return null;
  const identity = parseSession(raw);
  if (!identity) return null;
  const [group] = await query<{ id: number; version: number }>(
    sql`select g.id,g.version from b2b_access_groups g where g.id=${identity.id} and g.version=${identity.version} and exists(select 1 from b2b_locations l where l.access_group_id=g.id)`,
  );
  return group ?? null;
}
export async function currentLocation(locationId?: number) {
  const access = await currentAccess();
  if (!access) return null;
  const [location] = await query<Location>(
    sql`select l.id,l.name,l.address,l.contact,l.phone,g.version,l.details_version,l.access_group_id,coalesce((select sum(amount)::integer from b2b_cashback where location_id=l.id),0) as cashback from b2b_locations l join b2b_access_groups g on g.id=l.access_group_id where g.id=${access.id} and g.version=${access.version} ${locationId ? sql`and l.id=${locationId}` : sql``} order by lower(l.name),l.id limit 1`,
  );
  return location ?? null;
}
export async function loadData(location?: Location, memberLocationId?: number): Promise<B2BData> {
  const access = location ? await currentAccess() : null;
  const member = location ? null : await currentMember();
  if (!location && !member) throw Error("Acces neautorizat.");
  const internalFields = member && canManageOrders(member.slug);
  if (location && !access) throw Error("Acces neautorizat.");
  const scope = access
    ? sql`where g.id=${access.id} and g.version=${access.version}`
    : memberLocationId ? sql`where l.id=${memberLocationId}` : sql``;
  const locations = await query<
    Location & { token_cipher?: string; preview_revision?: string }
  >(
    sql`select l.id,l.name,l.address,l.contact,l.phone,g.version,l.details_version,l.access_group_id,(select max(o.created_at) from b2b_orders o where o.location_id=l.id) as last_order_at ${member ? sql`,(select count(*)::integer from b2b_orders o where o.location_id=l.id) as order_count` : sql``} ${internalFields ? sql`,l.company_name,l.idno` : sql``},(select count(*)::integer from b2b_locations peer where peer.access_group_id=g.id) as group_size,coalesce((select sum(amount)::integer from b2b_cashback where location_id=l.id),0) as cashback ${access ? sql`` : sql`,g.token_cipher,(select md5(jsonb_agg(peer.name order by lower(peer.name),peer.id)::text) from b2b_locations peer where peer.access_group_id=g.id) as preview_revision`} from b2b_locations l join b2b_access_groups g on g.id=l.access_group_id ${scope} order by lower(l.name),l.id`,
  );
  const [products, orders] = await Promise.all([
    query<Product>(
      sql`select id,name,flavor,grams,price,stock,stock_version as "stockVersion" from b2b_products order by position,id`,
    ),
    memberLocationId ? [] : query<Order>(sql`select o.id,o.location_id,o.location_snapshot->>'name' as location_name,o.location_snapshot,o.author,o.status,o.version,o.total,o.created_at ${member ? sql`,coalesce((select seen_version from member_order_seen s join members m on m.id=s.member_id where s.order_id=o.id and m.slug=${member.slug}),0) as seen_version` : sql``},coalesce(c.amount,0) as cashback,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'name',i.name,'flavor',i.flavor,'grams',i.grams,'price',i.price,'quantity',i.quantity) order by i.product_id) from b2b_order_items i where i.order_id=o.id),'[]'::jsonb) as items
 from b2b_orders o join b2b_locations l on l.id=o.location_id join b2b_access_groups g on g.id=l.access_group_id left join b2b_cashback c on c.order_id=o.id ${scope} order by o.created_at desc,o.id desc`),
  ]);
  return {
    products,
    orders,
    locations: locations.map((l) => {
      const { token_cipher, preview_revision, ...safe } = l;
      return token_cipher
        ? {
            ...safe,
            link:
              "/comenzi/acces/" +
              l.access_group_id +
              "/" +
              decryptToken(token_cipher) +
              "?preview=2-" +
              (preview_revision?.slice(0, 12) ?? "current"),
          }
        : safe;
    }),
  };
}
