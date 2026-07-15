import { get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { workspaceItems } from "../../../../lib/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember() || !db) return new NextResponse("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new NextResponse("Not found", { status: 404 });
  const [item] = await db.select().from(workspaceItems).where(and(eq(workspaceItems.id, id), eq(workspaceItems.section, "merch"), isNull(workspaceItems.deletedAt)));
  if (!item?.merchImageUrl) return new NextResponse("Not found", { status: 404 });
  const blob = await get(item.merchImageUrl, { access: "private" });
  if (!blob) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(blob.stream, { headers: { "Content-Type": blob.headers.get("content-type") || "image/jpeg" } });
}
