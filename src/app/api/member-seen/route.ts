import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember } from "../../../lib/auth";
import { markFeedbackSeen, markOrderSeen } from "../../../lib/member-seen";

const id = z.number().int().positive().max(2147483647);
const payload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("order"), id, version: id }).strict(),
  z.object({ type: z.literal("feedback"), ids: z.array(id).min(1).max(50) }).strict(),
]);
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return json({ error: "Acces neautorizat." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Cerere neautorizată." }, 403);
  try {
    const data = payload.parse(await request.json());
    if (data.type === "order") await markOrderSeen(member.slug, data.id, data.version);
    else await markFeedbackSeen(member.slug, [...new Set(data.ids)]);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof z.ZodError || error instanceof SyntaxError ? "Cerere invalidă." : "Actualizarea nu a reușit. Încearcă din nou." }, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503);
  }
}
