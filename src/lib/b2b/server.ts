import "server-only";
import { cookies } from "next/headers";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { currentMember } from "../auth";
import { members } from "../schema";
import { decryptToken, parseSession } from "./crypto";
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
export async function currentLocation() {
  const raw = (await cookies()).get(B2B_COOKIE)?.value;
  if (!raw) return null;
  try {
    const identity = parseSession(raw);
    if (!identity) return null;
    const [location] = await query<Location>(
      sql`select id,name,address,contact,phone,version,details_version,coalesce((select sum(amount)::integer from b2b_cashback where location_id=l.id),0) as cashback from b2b_locations l where id=${identity.id} and version=${identity.version}`,
    );
    return location ?? null;
  } catch {
    return null;
  }
}
export async function loadData(location?: Location): Promise<B2BData> {
  const locations = location
    ? [location]
    : await query<Location & { token_cipher: string }>(
        sql`select id,name,address,contact,phone,version,details_version,token_cipher,coalesce((select sum(amount)::integer from b2b_cashback where location_id=l.id),0) as cashback from b2b_locations l order by lower(name),id`,
      );
  const [products, orders] = await Promise.all([
    query<Product>(
      sql`select id,name,flavor,grams,price from b2b_products order by position,id`,
    ),
    query<Order>(sql`select o.id,o.location_id,o.location_snapshot->>'name' as location_name,o.location_snapshot,o.author,o.status,o.version,o.total,o.created_at,coalesce(c.amount,0) as cashback,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'name',i.name,'flavor',i.flavor,'grams',i.grams,'price',i.price,'quantity',i.quantity) order by i.product_id) from b2b_order_items i where i.order_id=o.id),'[]'::jsonb) as items
 from b2b_orders o left join b2b_cashback c on c.order_id=o.id ${location ? sql`where o.location_id=${location.id}` : sql``} order by o.created_at desc,o.id desc`),
  ]);
  return {
    products,
    orders,
    locations: locations.map((l) => {
      if ("token_cipher" in l) {
        const { token_cipher, ...safe } = l;
        return {
          ...safe,
          link:
            "/comenzi/acces/" +
            l.id +
            "/" +
            decryptToken(token_cipher as string),
        };
      }
      return l;
    }),
  };
}
