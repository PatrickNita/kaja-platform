import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { workspaceItemImages, workspaceItems } from "../../../../lib/schema";

const brands = ["kaja", "hexenwerk", "virginia"];

export async function GET(request: Request) {
  const member = await currentMember();
  if (!member || member.slug !== "patrick" || !db) return new NextResponse("Unauthorized", { status: 401 });
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const brand = searchParams.get("brand");
  if (!url || !brand || !brands.includes(brand)) return new NextResponse("Not found", { status: 404 });
  const [record] = await db.select({ itemId: workspaceItemImages.itemId }).from(workspaceItemImages).innerJoin(workspaceItems, eq(workspaceItemImages.itemId, workspaceItems.id)).where(and(eq(workspaceItemImages.url, url), eq(workspaceItemImages.brand, brand), eq(workspaceItems.section, "merch"), isNull(workspaceItemImages.deletedAt), isNull(workspaceItems.deletedAt)));
  return record ? NextResponse.json(record) : new NextResponse("Not found", { status: 404 });
}
