import { get, BlobNotFoundError } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { imageVariantUrl, isImageVariant } from "../../../../lib/image-variant-path";
import { currentMember } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { attachments, attachmentFolders } from "../../../../lib/schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await currentMember();
  if (!member || !db) return new NextResponse("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new NextResponse("Not found", { status: 404 });
  const [attachment] = await db.select().from(attachments).where(and(eq(attachments.id, id), isNull(attachments.deletedAt)));
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  if (attachment.folderId) {
    const [folder] = await db.select().from(attachmentFolders).where(and(eq(attachmentFolders.id, attachment.folderId), isNull(attachmentFolders.deletedAt)));
    if (!folder || folder.brand !== attachment.brand || (!folder.published && member.slug !== "patrick")) return new NextResponse("Not found", { status: 404 });
  }
  if (new URL(request.url).searchParams.get("open") === "1") {
    const destination = new URL("/", request.url);
    destination.searchParams.set("view", "uploads");
    destination.searchParams.set("brand", attachment.brand);
    if (attachment.folderId) destination.searchParams.set("folder", String(attachment.folderId));
    destination.hash = `attachment-${attachment.id}`;
    return NextResponse.redirect(destination);
  }
  const variant = new URL(request.url).searchParams.get("variant");
  if (variant !== null && (!isImageVariant(variant) || attachment.contentType !== "image/png")) return new NextResponse("Invalid variant", { status: 400 });
  let blob;
  try { blob = await get(variant && isImageVariant(variant) ? imageVariantUrl(attachment, variant) : attachment.url, { access: "private" }); }
  catch (error) { return new NextResponse("Image unavailable", { status: error instanceof BlobNotFoundError ? 404 : 503 }); }
  if (variant) {
    if (!blob || blob.statusCode !== 200 || blob.headers.get("content-type") !== "image/webp") return new NextResponse("Not found", { status: 404 });
    const bytes = await new Response(blob.stream).arrayBuffer();
    return new NextResponse(bytes, { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.byteLength), "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }
  if (!blob || blob.statusCode !== 200) return new NextResponse("Not found", { status: 404 });
  const preview = new URL(request.url).searchParams.get("preview") === "1" && attachment.contentType === "image/png";
  return new NextResponse(blob.stream, { headers: {
    "Content-Type": attachment.contentType === "image/png" ? "image/png" : "application/pdf",
    "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${attachment.filename.replace(/[^a-zA-Z0-9._ -]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
