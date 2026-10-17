import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  currentLocation,
  internalMember,
  query,
  SUPPORT,
} from "../../../lib/b2b/server";
import { encryptToken, newToken, tokenHash } from "../../../lib/b2b/crypto";
import {
  stockStatus,
  stockLimit,
  canManageOrders,
  type Product,
} from "../../../lib/b2b/model";

const id = z.number().int().positive();
const locationFields = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(500),
  contact: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(5).max(40),
});
const envelope = z.object({
  mode: z.enum(["admin", "portal"]),
  operation: z.enum([
    "createLocation",
    "editLocation",
    "rotateLink",
    "saveOrder",
    "status",
  ]),
});
const quantities = z
  .array(
    z.object({ productId: id, quantity: z.number().int().min(1).max(10000) }),
  )
  .min(1)
  .max(25)
  .refine((v) => new Set(v.map((i) => i.productId)).size === v.length);
const conflict =
  "Comanda sau datele au fost actualizate între timp. Reîncarcă pagina și verifică starea curentă.";

export async function POST(request: Request) {
  const expectedOrigin = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== expectedOrigin)
    return NextResponse.json(
      { error: "Cerere neautorizată." },
      { status: 403 },
    );
  try {
    const body = await request.json();
    const { mode, operation } = envelope.parse(body);
    const member = mode === "admin" ? await internalMember() : null;
    const location = mode === "portal" ? await currentLocation() : null;
    if (mode === "portal" && !location)
      return NextResponse.json(
        { error: SUPPORT, expired: true },
        { status: 401 },
      );
    const manager = Boolean(member && canManageOrders(member.slug));
    let result: unknown;
    if (operation === "createLocation" || operation === "editLocation") {
      if (!member)
        return NextResponse.json(
          { error: "Acces neautorizat." },
          { status: 403 },
        );
      if (operation === "editLocation" && !manager)
        return NextResponse.json(
          { error: "Doar Patrick și Ionut pot edita localuri." },
          { status: 403 },
        );
      const fields = locationFields.parse(body);
      if (operation === "createLocation") {
        const token = newToken();
        const [created] = await query<{
          id: number;
        }>(sql`insert into b2b_locations(name,address,contact,phone,token_hash,token_cipher,created_by,updated_by)
          values(${fields.name},${fields.address},${fields.contact},${fields.phone},${tokenHash(token)},${encryptToken(token)},${member.id},${member.id}) returning id`);
        result = created;
      } else {
        const locationId = id.parse(body.locationId);
        const version = id.parse(body.version);
        const [updated] = await query(
          sql`update b2b_locations set name=${fields.name},address=${fields.address},contact=${fields.contact},phone=${fields.phone},updated_by=${member.id},updated_at=now(),details_version=details_version+1 where id=${locationId} and details_version=${version} returning id`,
        );
        if (!updated)
          return NextResponse.json({ error: conflict }, { status: 409 });
      }
    } else if (operation === "rotateLink") {
      if (!manager || !member)
        return NextResponse.json(
          { error: "Doar Patrick și Ionut pot regenera linkuri." },
          { status: 403 },
        );
      const locationId = id.parse(body.locationId),
        version = id.parse(body.version);
      if (body.confirmed !== true || body.invalidateSessions !== true)
        return NextResponse.json(
          { error: "Sunt necesare ambele confirmări." },
          { status: 400 },
        );
      const token = newToken();
      const [updated] = await query(
        sql`update b2b_locations set token_hash=${tokenHash(token)},token_cipher=${encryptToken(token)},version=version+1,updated_by=${member.id},updated_at=now() where id=${locationId} and version=${version} returning id`,
      );
      if (!updated)
        return NextResponse.json({ error: conflict }, { status: 409 });
    } else if (operation === "saveOrder") {
      if (mode === "admin" && !manager)
        return NextResponse.json(
          { error: "Doar Patrick și Ionut pot plasa sau modifica comenzi." },
          { status: 403 },
        );
      const locationId = location?.id ?? id.parse(body.locationId);
      const selected = quantities.parse(body.quantities);
      const catalog = await query<Product>(
        sql`select id,name,flavor,grams,price from b2b_products`,
      );
      const lines = selected.map((item) => {
        const product = catalog.find((p) => p.id === item.productId);
        if (!product) throw new Error("Produs indisponibil.");
        return { ...product, quantity: item.quantity };
      });
      const unavailable = lines.filter(
        (line) => stockStatus(line.name) === "unavailable",
      );
      if (unavailable.length) {
        const existing = body.orderId
          ? await query<{ id: number; quantity: number }>(
              sql`select i.product_id as id,i.quantity from b2b_order_items i join b2b_orders o on o.id=i.order_id where o.id=${id.parse(body.orderId)} and o.location_id=${locationId}`,
            )
          : [];
        if (
          unavailable.some(
            (line) =>
              line.quantity >
              stockLimit(
                line.name,
                existing.find((i) => i.id === line.id)?.quantity ?? 0,
              ),
          )
        )
          return NextResponse.json(
            {
              error:
                "STWY are stoc epuizat. Nu poate fi adăugat sau mărit în comandă.",
            },
            { status: 400 },
          );
      }
      const total = lines.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      if (!Number.isSafeInteger(total) || total > 2147483647)
        return NextResponse.json(
          { error: "Cantitatea totală este prea mare." },
          { status: 400 },
        );
      const lineJson = JSON.stringify(lines);
      // Revalidate the location's session generation inside each mutation, too.
      const access = location ? sql`and l.version=${location.version}` : sql``;
      if (body.orderId) {
        const orderId = id.parse(body.orderId),
          version = id.parse(body.version);
        const allowed = manager
          ? sql`o.status in ('placed','confirmed')`
          : sql`o.status='placed'`;
        const [updated] = await query(sql`with changed as (
          update b2b_orders o set total=${total},version=o.version+1,updated_at=now()
          from b2b_locations l where o.id=${orderId} and o.location_id=${locationId} and l.id=o.location_id
          and o.version=${version} and ${allowed} ${access} returning o.id
        ), removed as (
          delete from b2b_order_items i using changed c where i.order_id=c.id
          and not exists(select 1 from jsonb_to_recordset(${lineJson}::jsonb) as x(id integer) where x.id=i.product_id)
        ), inserted as (
          insert into b2b_order_items(order_id,product_id,name,flavor,grams,price,quantity)
          select c.id,x.id,x.name,x.flavor,x.grams,x.price,x.quantity from changed c,
          jsonb_to_recordset(${lineJson}::jsonb) as x(id integer,name text,flavor text,grams integer,price integer,quantity integer)
          on conflict(order_id,product_id) do update set quantity=excluded.quantity
          returning order_id
        ) select id from changed`);
        if (!updated)
          return NextResponse.json({ error: conflict }, { status: 409 });
        result = { id: orderId };
      } else {
        const requestKey = z.uuid().parse(body.requestKey);
        const [created] = await query<{ id: number }>(sql`with created as (
          insert into b2b_orders(location_id,location_snapshot,author,author_member_id,request_key,total)
          select l.id,jsonb_build_object('name',l.name,'address',l.address,'contact',l.contact,'phone',l.phone),
          ${member?.name ?? "Local"},${member?.id ?? null},${requestKey}::uuid,${total} from b2b_locations l
          where l.id=${locationId} ${access} on conflict(request_key) do nothing returning id
        ), inserted as (
          insert into b2b_order_items(order_id,product_id,name,flavor,grams,price,quantity)
          select c.id,x.id,x.name,x.flavor,x.grams,x.price,x.quantity from created c,
          jsonb_to_recordset(${lineJson}::jsonb) as x(id integer,name text,flavor text,grams integer,price integer,quantity integer)
        ) select id from created`);
        if (created) result = created;
        else {
          const [existing] = await query<{ id: number }>(
            sql`select o.id from b2b_orders o join b2b_locations l on l.id=o.location_id where o.request_key=${requestKey}::uuid and o.location_id=${locationId} ${access}`,
          );
          if (!existing)
            return NextResponse.json({ error: conflict }, { status: 409 });
          result = existing;
        }
      }
    } else if (operation === "status") {
      if (!manager || !member)
        return NextResponse.json(
          { error: "Doar Patrick și Ionut pot schimba starea comenzilor." },
          { status: 403 },
        );
      const orderId = id.parse(body.orderId),
        version = id.parse(body.version);
      const status = z.enum(["confirmed", "paid"]).parse(body.status);
      const [updated] =
        status === "confirmed"
          ? await query(
              sql`update b2b_orders set status='confirmed',confirmed_by=${member.id},confirmed_at=now(),updated_at=now(),version=version+1 where id=${orderId} and status='placed' and version=${version} returning id`,
            )
          : await query(sql`with paid as (
          update b2b_orders set status='paid',paid_by=${member.id},paid_at=now(),updated_at=now(),version=version+1
          where id=${orderId} and status='confirmed' and version=${version} returning id,location_id,total
        ), credited as (
          insert into b2b_cashback(order_id,location_id,amount,credited_by)
          select id,location_id,(total*0.05)::integer,${member.id} from paid returning order_id
        ) select order_id as id from credited`);
      if (!updated)
        return NextResponse.json({ error: conflict }, { status: 409 });
    }
    revalidatePath("/b2b");
    revalidatePath("/comenzi");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error:
            "Verifică datele introduse. Completează toate câmpurile și selectează cantități valide.",
        },
        { status: 400 },
      );
    if (error instanceof Error && error.message === "Acces neautorizat.")
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json(
      {
        error:
          "Operația nu a reușit. Încearcă din nou; datele introduse au fost păstrate.",
      },
      { status: 500 },
    );
  }
}
