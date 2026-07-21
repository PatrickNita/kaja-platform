import { get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { workspaceItemImages, workspaceItems } from "../../../../lib/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember() || !db) return new NextResponse("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new NextResponse("Not found", { status: 404 });
  const [record] = await db.select({ url: workspaceItemImages.url }).from(workspaceItemImages).innerJoin(workspaceItems, eq(workspaceItemImages.itemId, workspaceItems.id)).where(and(eq(workspaceItemImages.id, id), isNull(workspaceItemImages.deletedAt), isNull(workspaceItems.deletedAt)));
  if (!record) return new NextResponse("Not found", { status: 404 });
  const blob = await get(record.url, { access: "private" });
  if (!blob) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(blob.stream, { headers: { "Content-Type": blob.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
