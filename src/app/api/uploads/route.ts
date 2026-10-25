import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del, get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { recordActivity } from "../../../lib/activity";
import { currentMember } from "../../../lib/auth";
import { db, memberSeed } from "../../../lib/db";
import { attachments, attachmentFolders, members } from "../../../lib/schema";
import { attachmentContentType, maxAttachmentSize, validAttachmentSignature } from "../../../lib/attachment-files";

const brands = ["kaja", "hexenwerk", "virginia"] as const;

export async function POST(request: Request) {
  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const member = await currentMember();
      if (!member) throw new Error("Unauthorized upload.");
      if (member.slug !== "patrick" || !db) throw new Error("Doar Patrick poate încărca fișiere.");
      const payload = JSON.parse(clientPayload || "{}") as { filename?: string; brand?: string; folderId?: number };
      const contentType = attachmentContentType(payload.filename ?? "");
      if (!contentType || !brands.includes(payload.brand as typeof brands[number])) throw new Error("Sunt permise doar PDF și PNG.");
      if (payload.folderId !== undefined) {
        if (!Number.isSafeInteger(payload.folderId) || payload.folderId < 1) throw new Error("Dosar invalid.");
        const [folder] = await db.select().from(attachmentFolders).where(and(eq(attachmentFolders.id, payload.folderId), eq(attachmentFolders.brand, payload.brand!), isNull(attachmentFolders.deletedAt)));
        if (!folder) throw new Error("Dosarul nu există.");
      }
      return { allowedContentTypes: [contentType], maximumSizeInBytes: maxAttachmentSize, addRandomSuffix: true, tokenPayload: JSON.stringify({ slug: member.slug, filename: payload.filename, brand: payload.brand, folderId: payload.folderId ?? null, contentType }) };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload) return;
      const payload = JSON.parse(tokenPayload) as { slug: string; filename: string; brand: typeof brands[number]; folderId: number | null; contentType: string };
      if (payload.slug !== "patrick") { await del(blob.url); return; }
      if (attachmentContentType(payload.filename) !== blob.contentType || payload.contentType !== blob.contentType) { await del(blob.url); return; }
      if (payload.folderId) {
        const [folder] = await db.select().from(attachmentFolders).where(and(eq(attachmentFolders.id, payload.folderId), eq(attachmentFolders.brand, payload.brand), isNull(attachmentFolders.deletedAt)));
        if (!folder) { await del(blob.url); return; }
      }
      const storedBlob = await get(blob.url, { access: "private" });
      if (!storedBlob || storedBlob.statusCode !== 200) throw new Error("Fișierul nu poate fi verificat.");
      const reader = storedBlob.stream.getReader();
      const prefix = new Uint8Array(8); let length = 0;
      try { while (length < 8) { const chunk = await reader.read(); if (chunk.done) break; const slice = chunk.value.subarray(0, 8 - length); prefix.set(slice, length); length += slice.length; } } finally { await reader.cancel(); }
      if (storedBlob.blob.size > maxAttachmentSize || !validAttachmentSignature(prefix.subarray(0, length), payload.contentType)) { await del(blob.url); return; }
      const seededMember = memberSeed.find((member) => member.slug === payload.slug);
      if (!seededMember) return;
      await db.insert(members).values(seededMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (!member) return;
      const [attachment] = await db.insert(attachments).values({ brand: payload.brand, filename: payload.filename, contentType: payload.contentType, folderId: payload.folderId, pathname: blob.pathname, url: blob.url, size: storedBlob.blob.size, uploadedBy: member.id }).onConflictDoNothing().returning();
      if (!attachment) {
        const [existing] = await db.select({ pathname: attachments.pathname }).from(attachments).where(eq(attachments.pathname, blob.pathname));
        if (!existing) await del(blob.url);
      }
      if (attachment) {
        await recordActivity(member, { brand: payload.brand, entityType: "attachment", entityId: attachment.id, action: "uploaded", summary: `a încărcat fișierul „${attachment.filename}”`, title: attachment.filename }, { notifyTelegram: !payload.folderId });
      }
    },
  });
  return NextResponse.json(response);
}
