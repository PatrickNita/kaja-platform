import { NextResponse } from "next/server";
import { currentMember } from "../../../../../lib/auth";
import { loadData } from "../../../../../lib/b2b/server";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await currentMember();
  if (!member) return json({ error: "Acces neautorizat." }, 401);
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return json({ error: "Cerere invalidă." }, 400);
  try {
    const data = await loadData(undefined, Number(id));
    if (!data.locations.length) return json({ error: "Localul nu mai este disponibil." }, 404);
    return json({ location: data.locations[0], products: data.products, memberSlug: member.slug });
  } catch {
    return json({ error: "Detaliile localului nu au putut fi încărcate." }, 503);
  }
}
