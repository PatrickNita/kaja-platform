import { get, BlobNotFoundError } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { imageVariantUrl, isImageVariant } from "../../../../lib/image-variant-path";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { workspaceItemImages, workspaceItems } from "../../../../lib/schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember() || !db) return new NextResponse("Unauthorized", { status: 401 });
  const variant = new URL(request.url).searchParams.get("variant");
  if (variant !== null && !isImageVariant(variant)) return new NextResponse("Invalid variant", { status: 400 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return new NextResponse("Not found", { status: 404 });
  const [record] = await db.select({ url: workspaceItemImages.url, pathname: workspaceItemImages.pathname }).from(workspaceItemImages).innerJoin(workspaceItems, eq(workspaceItemImages.itemId, workspaceItems.id)).where(and(eq(workspaceItemImages.id, id), isNull(workspaceItemImages.deletedAt), isNull(workspaceItems.deletedAt)));
  if (!record) return new NextResponse("Not found", { status: 404 });
  try {
    const blob = await get(variant ? imageVariantUrl(record, variant) : record.url, { access: "private" });
    if (!blob || blob.statusCode !== 200) return new NextResponse("Not found", { status: 404 });
    const type = variant ? "image/webp" : blob.headers.get("content-type") || "image/jpeg";
    if (variant && blob.headers.get("content-type") !== type) return new NextResponse("Not found", { status: 404 });
    const bytes = await new Response(blob.stream).arrayBuffer();
    return new NextResponse(bytes, { headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength), "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return new NextResponse("Image unavailable", { status: error instanceof BlobNotFoundError ? 404 : 503 });
  }
}
