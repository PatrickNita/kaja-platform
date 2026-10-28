import { get } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";

// Only the current primary image of an active KAJA feedback product is public.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const value = (await params).id;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647 || !db) return new NextResponse("Not found", { status: 404 });
  const result = await db.execute(sql`select im.url from workspace_item_images im join workspace_items w on w.id=im.item_id and w.brand=im.brand
    where im.id=${Number(value)} and im.deleted_at is null and w.deleted_at is null and w.brand='kaja' and w.section='catalogue' and w.catalogue_group='live'
    and nullif(btrim(w.product_name),'') is not null and nullif(btrim(w.flavor),'') is not null and w.feedback_slug is not null
    and im.id=(select first_image.id from workspace_item_images first_image where first_image.item_id=w.id and first_image.brand=w.brand and first_image.deleted_at is null order by first_image.position,first_image.id limit 1)`);
  const record = result.rows[0] as { url: string } | undefined;
  if (!record) return new NextResponse("Not found", { status: 404 });
  const blob = await get(record.url, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new NextResponse("Not found", { status: 404 });
  const type = blob.headers.get("content-type") || "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(type)) return new NextResponse("Not found", { status: 404 });
  const bytes = await new Response(blob.stream).arrayBuffer();
  return new NextResponse(bytes, { headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
