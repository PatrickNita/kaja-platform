import { markOrderSeen } from "../../../lib/member-seen";
import { b2bErrorCode } from "../../../lib/b2b/errors";
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

import { contactKey } from "../../../lib/b2b/contact";
import { assignLocation } from "../../../lib/b2b/access-statements";
import { enqueueOrderNotification } from "../../../lib/b2b/telegram";

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

function jsonResponse(data: { error?: string; [key: string]: unknown }, options?: { status: number }) {
  return NextResponse.json(data.error ? { ...data, errorCode: b2bErrorCode(data.error, options?.status ?? 500) } : data, options);
}

export async function POST(request: Request) {
  const expectedOrigin = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== expectedOrigin)
    return jsonResponse(
      { error: "Cerere neautorizată." },
      { status: 403 },
    );
  try {
    const body = await request.json();
    const { mode, operation } = envelope.parse(body);
    const member = mode === "admin" ? await internalMember() : null;
    const location =
      mode === "portal"
        ? await currentLocation(
            body.locationId === undefined
              ? undefined
              : id.parse(body.locationId),
          )
        : null;
    if (mode === "portal" && !location)
      return jsonResponse(
        { error: SUPPORT, expired: true },
        { status: 401 },
      );
    const manager = Boolean(member && canManageOrders(member.slug));
    let result: unknown;
    let notificationId: number | undefined;
    let seenOrder: { id: number; version: number } | undefined;
    if (operation === "createLocation" || operation === "editLocation") {
      if (!member)
        return jsonResponse(
          { error: "Acces neautorizat." },
          { status: 403 },
        );
      if (operation === "editLocation" && !manager)
        return jsonResponse(
          { error: "Doar Patrick și Ionut pot edita localuri." },
          { status: 403 },
        );
      if (
        operation === "createLocation" &&
        (body.companyName !== undefined || body.idno !== undefined)
      )
        return jsonResponse(
          {
            error:
              "Datele interne se completează doar la modificarea localului.",
          },
          { status: 403 },
        );
      const fields =
        operation === "editLocation"
          ? locationFields
              .extend({
                companyName: z.string().trim().max(160).optional(),
                idno: z.string().trim().max(32).optional(),
              })
              .parse(body)
          : locationFields.parse(body);
      const token = newToken();
      const [updated] = await query(
        assignLocation(
          fields,
          contactKey(fields.contact, fields.phone),
          tokenHash(token),
          encryptToken(token),
          member.id,
          operation === "editLocation"
            ? {
                id: id.parse(body.locationId),
                version: id.parse(body.version),
                confirmed: body.confirmContactChange === true,
              }
            : undefined,
        ),
      );
      if (!updated)
        return jsonResponse({ error: conflict }, { status: 409 });
      result = updated;
    } else if (operation === "rotateLink") {
      if (!manager || !member)
        return jsonResponse(
          { error: "Doar Patrick și Ionut pot regenera linkuri." },
          { status: 403 },
        );
      const locationId = id.parse(body.locationId),
        version = id.parse(body.version);
      if (body.confirmed !== true || body.invalidateSessions !== true)
        return jsonResponse(
          { error: "Sunt necesare ambele confirmări." },
          { status: 400 },
        );
      const token = newToken();
      const [updated] = await query(
        sql`update b2b_access_groups g set token_hash=${tokenHash(token)},token_cipher=${encryptToken(token)},version=g.version+1 where g.id=${id.parse(body.groupId)} and g.version=${version} and exists(select 1 from b2b_locations l where l.id=${locationId} and l.access_group_id=g.id) returning g.id`,
      );
      if (!updated)
        return jsonResponse({ error: conflict }, { status: 409 });
    } else if (operation === "saveOrder") {
      if (mode === "admin" && !manager)
        return jsonResponse(
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
          return jsonResponse(
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
        return jsonResponse(
          { error: "Cantitatea totală este prea mare." },
          { status: 400 },
        );
      const lineJson = JSON.stringify(lines);
      // Revalidate the location's session generation inside each mutation, too.
      const authorized = sql`select l.* from b2b_locations l join b2b_access_groups g on g.id=l.access_group_id where l.id=${locationId} ${location ? sql`and g.id=${location.access_group_id!} and g.version=${location.version}` : sql``} for share of l,g`;
      const access = sql``;
      if (body.orderId) {
        const orderId = id.parse(body.orderId),
          version = id.parse(body.version);
        const allowed = manager
          ? sql`o.status in ('placed','confirmed')`
          : sql`o.status='placed'`;
        const [updated] = await query<{
          id: number;
          notification_id: number | null;
        }>(sql`with authorized as materialized (${authorized}), previous as materialized (
          select o.*,coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'name',i.name,'flavor',i.flavor,'price',i.price,'quantity',i.quantity) order by i.product_id) from b2b_order_items i where i.order_id=o.id),'[]'::jsonb) as lines
          from b2b_orders o join authorized l on l.id=o.location_id where o.id=${orderId} and o.location_id=${locationId} for update of o
        ), changed as (
          update b2b_orders o set total=${total},version=o.version+1,updated_at=now()
          from previous p where o.id=p.id
          and o.version=${version} and ${allowed} ${access} returning o.id,o.version,o.location_snapshot
        ), removed as (
          delete from b2b_order_items i using changed c where i.order_id=c.id
          and not exists(select 1 from jsonb_to_recordset(${lineJson}::jsonb) as x(id integer) where x.id=i.product_id)
        ), inserted as (
          insert into b2b_order_items(order_id,product_id,name,flavor,grams,price,quantity)
          select c.id,x.id,x.name,x.flavor,x.grams,x.price,x.quantity from changed c,
          jsonb_to_recordset(${lineJson}::jsonb) as x(id integer,name text,flavor text,grams integer,price integer,quantity integer)
          on conflict(order_id,product_id) do update set quantity=excluded.quantity
          returning order_id
        ), notified as (
          insert into b2b_notifications(order_id,order_version,payload)
          select c.id,c.version,jsonb_build_object('kind','edited','orderId',c.id,'at',now(),'actor',${member?.name ?? "Local"}::text,
          'location',jsonb_build_object('name',c.location_snapshot->>'name','address',c.location_snapshot->>'address','idno',(select l.idno from authorized l)),
          'lines',${lineJson}::jsonb,'previous',p.lines,'total',${total}::integer) from changed c join previous p on p.id=c.id
          where (select jsonb_agg(jsonb_build_array(x.id,x.quantity) order by x.id) from jsonb_to_recordset(p.lines) as x(id integer,quantity integer))
            is distinct from (select jsonb_agg(jsonb_build_array(x.id,x.quantity) order by x.id) from jsonb_to_recordset(${lineJson}::jsonb) as x(id integer,quantity integer))
          returning id,order_id
        ) select c.id,n.id as notification_id from changed c left join notified n on n.order_id=c.id`);
        if (!updated)
          return jsonResponse({ error: conflict }, { status: 409 });
        result = { id: orderId };
        seenOrder = { id: orderId, version: version + 1 };
        notificationId = updated.notification_id ?? undefined;
      } else {
        const requestKey = z.uuid().parse(body.requestKey);
        const [created] = await query<{
          id: number;
          notification_id: number;
        }>(sql`with authorized as materialized (${authorized}), created as (
          insert into b2b_orders(location_id,location_snapshot,author,author_member_id,request_key,total)
          select l.id,jsonb_build_object('name',l.name,'address',l.address,'contact',l.contact,'phone',l.phone),
          ${member?.name ?? "Local"},${member?.id ?? null},${requestKey}::uuid,${total} from authorized l
          where l.id=${locationId} ${access} on conflict(request_key) do nothing returning id,version,location_snapshot
        ), inserted as (
          insert into b2b_order_items(order_id,product_id,name,flavor,grams,price,quantity)
          select c.id,x.id,x.name,x.flavor,x.grams,x.price,x.quantity from created c,
          jsonb_to_recordset(${lineJson}::jsonb) as x(id integer,name text,flavor text,grams integer,price integer,quantity integer)
        ), notified as (
          insert into b2b_notifications(order_id,order_version,payload)
          select c.id,c.version,jsonb_build_object('kind','created','orderId',c.id,'at',now(),'actor',${member?.name ?? "Local"}::text,
          'location',jsonb_build_object('name',c.location_snapshot->>'name','address',c.location_snapshot->>'address','idno',(select l.idno from authorized l)),
          'lines',${lineJson}::jsonb,'previous','[]'::jsonb,'total',${total}::integer) from created c returning id,order_id
        ) select c.id,n.id as notification_id from created c join notified n on n.order_id=c.id`);
        if (created) {
          result = { id: created.id };
          seenOrder = { id: created.id, version: 1 };
          notificationId = created.notification_id;
        } else {
          const [existing] = await query<{ id: number }>(
            sql`with authorized as materialized (${authorized}) select o.id from b2b_orders o join authorized l on l.id=o.location_id where o.request_key=${requestKey}::uuid and o.location_id=${locationId} ${access}`,
          );
          if (!existing)
            return jsonResponse({ error: conflict }, { status: 409 });
          result = existing;
          seenOrder = { id: existing.id, version: 1 };
        }
      }
    } else if (operation === "status") {
      if (!manager || !member)
        return jsonResponse(
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
        return jsonResponse({ error: conflict }, { status: 409 });
    }
    if (member && operation === "status") seenOrder = { id: id.parse(body.orderId), version: id.parse(body.version) + 1 };
    if (member && seenOrder) {
      try { await markOrderSeen(member.slug, seenOrder.id, seenOrder.version); }
      catch { console.error("Could not acknowledge own order version"); }
    }
    if (notificationId) await enqueueOrderNotification(notificationId);
    revalidatePath("/b2b");
    revalidatePath("/comenzi");
    return jsonResponse({ ok: true, result });
  } catch (error) {
    if (error instanceof z.ZodError)
      return jsonResponse(
        {
          error:
            "Verifică datele introduse. Completează toate câmpurile și selectează cantități valide.",
        },
        { status: 400 },
      );
    if (error instanceof Error && error.message === "Acces neautorizat.")
      return jsonResponse({ error: error.message }, { status: 403 });
    return jsonResponse(
      {
        error:
          "Operația nu a reușit. Încearcă din nou; datele introduse au fost păstrate.",
      },
      { status: 500 },
    );
  }
}
