import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { currentMember } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";
import { b2bProducts, workspaceItems } from "../../../../../lib/schema";
import { missingLocationsQuery, productNameKey } from "../../../../../lib/catalogue-usage";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember()) return json({ error: "Acces neautorizat." }, 401);
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return json({ error: "Cerere invalidă." }, 400);
  if (!db) return json({ error: "Verificarea nu este disponibilă momentan. Încearcă din nou." }, 503);
  try {
    const [item] = await db.select({ name: workspaceItems.productName, title: workspaceItems.title }).from(workspaceItems).where(and(eq(workspaceItems.id, Number(id)), eq(workspaceItems.brand, "kaja"), eq(workspaceItems.section, "catalogue"), eq(workspaceItems.catalogueGroup, "live"), isNull(workspaceItems.deletedAt))).limit(1);
    if (!item) return json({ error: "Produsul nu mai este disponibil în Catalog activ KAJA." }, 404);
    const products = await db.select({ id: b2bProducts.id, name: b2bProducts.name }).from(b2bProducts);
    const matched = products.filter((p) => productNameKey(p.name) === productNameKey(item.name ?? item.title));
    if (matched.length !== 1) return json({ error: "Verificarea nu este disponibilă: produsul nu poate fi asociat catalogului B2B." }, 422);
    const result = await db.execute(missingLocationsQuery(matched[0].id));
    return json({ locations: result.rows });
  } catch {
    return json({ error: "Localurile nu au putut fi încărcate. Încearcă din nou." }, 503);
  }
}
