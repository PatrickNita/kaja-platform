import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { memberProductComments } from "../../../../lib/feedback-server";
import { z } from "zod";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember()) return NextResponse.json({ error: "Acces neautorizat." }, { status: 401 });
  const { id } = await params;
  const before = request.nextUrl.searchParams.get("before");
  if (!z.uuid().safeParse(id).success || (before && !/^[1-9]\d{0,9}$/.test(before))) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  try {
    const rows = await memberProductComments(id, before ? Number(before) : undefined);
    return NextResponse.json({ comments: rows.slice(0, 50), more: rows.length > 50 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Comentariile nu au putut fi încărcate." }, { status: 503 });
  }
}
