import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del, head } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { db, memberSeed } from "../../../lib/db";
import { activity, attachments, members } from "../../../lib/schema";
import { notifyTelegram } from "../../../lib/telegram";

const brands = ["kaja", "hexenwerk", "virginia"] as const;

export async function POST(request: Request) {
  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const member = await currentMember();
      if (!member) throw new Error("Unauthorized upload.");
      if (member.slug !== "patrick") throw new Error("Doar Patrick poate încărca PDF-uri.");
      const payload = JSON.parse(clientPayload || "{}") as { filename?: string; brand?: string };
      if (!payload.filename?.toLowerCase().endsWith(".pdf") || !brands.includes(payload.brand as typeof brands[number])) throw new Error("Sunt permise doar fișierele PDF.");
      return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 25 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ slug: member.slug, filename: payload.filename, brand: payload.brand }) };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload || blob.contentType !== "application/pdf") return;
      const payload = JSON.parse(tokenPayload) as { slug: string; filename: string; brand: typeof brands[number] };
      if (payload.slug !== "patrick") { await del(blob.url); return; }
      const seededMember = memberSeed.find((member) => member.slug === payload.slug);
      if (!seededMember) return;
      await db.insert(members).values(seededMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (!member) return;
      const storedBlob = await head(blob.url);
      const [attachment] = await db.insert(attachments).values({ brand: payload.brand, filename: payload.filename, pathname: blob.pathname, url: blob.url, size: storedBlob.size, uploadedBy: member.id }).onConflictDoNothing().returning();
      if (attachment) {
        await db.insert(activity).values({ brand: payload.brand, actorId: member.id, entityType: "attachment", entityId: attachment.id, action: "uploaded", summary: `a încărcat PDF-ul „${attachment.filename}”` });
        await notifyTelegram({ memberName: member.name, brand: payload.brand, entityType: "attachment", action: "uploaded", title: attachment.filename });
      }
    },
  });
  return NextResponse.json(response);
}
