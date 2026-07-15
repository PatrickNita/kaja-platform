import { get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { attachments } from "../../../../lib/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember() || !db) return new NextResponse("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new NextResponse("Not found", { status: 404 });
  const [attachment] = await db.select().from(attachments).where(and(eq(attachments.id, id), isNull(attachments.deletedAt)));
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  const blob = await get(attachment.url, { access: "private" });
  if (!blob) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(blob.stream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${attachment.filename.replace(/[^a-zA-Z0-9._ -]/g, "_")}"` } });
}
